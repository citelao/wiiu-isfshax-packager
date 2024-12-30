import JSZip from "jszip";

type PatchType = "aroma" | "haxchi" | "browser" | "dnspresso" | "udpih";
const patchType: PatchType = "aroma";

const generateButton = document.getElementById("generate-package")!;
const outputDiv = document.getElementById("generate-output")!;
const outputStatus = document.getElementById("generate-status")!;

function getProxyUrl(url: string) {
    return `https://corsproxy.io/?url=${url}`;
}

interface IZipFile {
    name: string;
    url: string;
    payloadExtractorAsync?: (blob: Blob) => Promise<Blob>;
}
interface IZipFolder {
    name: string;
    children: (IZipFile | IZipFolder)[];
}

interface IPairedZipFile<T> {
    file: IZipFile;
    payload: T;
}
interface IPairedZipFolder<T> {
    name: string;
    children: (IPairedZipFolder<T> | IPairedZipFile<T>)[];
}

function walkZipFolder<T, K = never>(folder: IZipFolder | IPairedZipFolder<K>, payloadFn: (file: IZipFile | IPairedZipFile<K>) => T): IPairedZipFolder<T> {
    const children = folder.children.map((child) => {
        if ("children" in child) {
            return walkZipFolder(child, payloadFn);
        } else {
            return { file: child, payload: payloadFn(child) };
        }
    });
    return { name: folder.name, children };
}

function awaitFolder<T>(folder: IPairedZipFolder<Promise<T>>): Promise<IPairedZipFolder<T>> {
    const children = folder.children.map(async (child) => {
        if ("children" in child) {
            return await awaitFolder(child);
        } else {
            return { file: child.file, payload: await child.payload };
        }
    });
    return Promise.all(children).then((children) => ({ name: folder.name, children }));
}

function generateJSZip(zipFolder: IPairedZipFolder<Blob>, startingZip?: JSZip): JSZip {
    const zip = startingZip || new JSZip();
    const main = zip.folder(zipFolder.name)!;
    for (const child of zipFolder.children) {
        if ("children" in child) {
            generateJSZip(child, main);
        } else {
            main.file(child.file.name, child.payload);
        }
    }
    return zip;
}

async function awaitAnimationFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function generate() {
    // https://gbatemp.net/threads/how-to-set-up-isfshax.642258/
    const isfsPayload: IZipFolder = {
        name: "sd_card",
        children: [
            // Flipped for "latest" tag
            // https://stackoverflow.com/questions/24987542/is-there-a-link-to-github-for-downloading-a-file-in-the-latest-release-of-a-repo

            // https://github.com/isfshax/isfshax_installer/releases/download/v2.0/ios.img
            { name: "ios.img", url: "https://github.com/isfshax/isfshax_installer/releases/latest/download/ios.img" },

            // https://github.com/isfshax/isfshax/releases/download/v4.0/superblock.img
            // https://github.com/isfshax/isfshax/releases/download/v4.0/superblock.img.sha
            { name: "superblock.img", url: "https://github.com/isfshax/isfshax/releases/latest/download/superblock.img" },
            { name: "superblock.img.sha", url: "https://github.com/isfshax/isfshax/releases/latest/download/superblock.img.sha" },

            {
                name: "wiiu",
                children: [
                    {
                        name: "ios_plugins",
                        children: [
                            // https://github.com/jan-hofmeier/stroopwafel/releases/download/redseeprom-v1.1/wafel_core.ipx
                            { name: "wafel_core.ipx", url: "https://github.com/jan-hofmeier/stroopwafel/releases/latest/download/wafel_core.ipx" },
                            // https://github.com/isfshax/wafel_isfshax_patch/releases/download/v3.1.1/wafel_isfshax_patch.ipx
                            { name: "wafel_isfshax_patch.ipx", url: "https://github.com/isfshax/wafel_isfshax_patch/releases/latest/download/wafel_isfshax_patch.ipx" },
                        ]
                    },
                ]
            },
        ]
    };

    // For non-UDPIH
    if (patchType !== "udpih") {
        // https://github.com/jan-hofmeier/minute_minute/releases/download/redseeprom-v1.0/fw_encrypted.img
        isfsPayload.children.push({ name: "fw.img", url: "https://github.com/jan-hofmeier/minute_minute/releases/latest/download/fw_encrypted.img" });
    }

    // https://github.com/wiiu-env/fw_img_payload/releases/download/v0.1/fw_img_payload_20201201-192754.zip
    if (patchType === "browser" || patchType === "dnspresso") {
        (isfsPayload.children.find((item) => item.name === "wiiu")! as IZipFolder).children.push({
            name: "payload.elf",
            url: "https://github.com/wiiu-env/fw_img_payload/releases/latest/download/fw_img_payload_20201201-192754.zip",
            payloadExtractorAsync: async (blob: Blob) => {
                const fw_img_payload_zip = await JSZip.loadAsync(blob);
                const fw_img_payload = fw_img_payload_zip.folder("wiiu")!.file("payload.elf")!;
                return await fw_img_payload.async("blob");
            }
        });
    }

    if (patchType === "udpih") {
        // https://github.com/jan-hofmeier/minute_minute/releases/download/redseeprom-v1.0/fw.img
        // https://github.com/jan-hofmeier/minute_minute/releases/download/redseeprom-v1.0/boot1.img
        // https://github.com/GaryOderNichts/recovery_menu/releases/download/v0.6/recovery_menu
        isfsPayload.children.push({ name: "fw.img", url: "https://github.com/jan-hofmeier/minute_minute/releases/latest/download/fw.img" });
        isfsPayload.children.push({ name: "boot1.img", url: "https://github.com/jan-hofmeier/minute_minute/releases/latest/download/boot1.img" });
        isfsPayload.children.push({ name: "recovery_menu", url: "https://github.com/GaryOderNichts/recovery_menu/releases/latest/download/recovery_menu" });
    }

    // TODO: DNSpresso
    // * root.rpx

    // Reset outputDiv
    outputDiv.innerHTML = "";
    const list = document.createElement("ul");
    outputDiv.appendChild(list);
    await awaitAnimationFrame();

    console.log("Downloading files...");
    outputStatus.innerText = "Downloading files...";
    const isfsPayloadPaired = walkZipFolder(isfsPayload, async (fileO) => {
        const listItem = document.createElement("li");
        const file = fileO as IZipFile;
        const url = getProxyUrl(file.url);
        listItem.innerText = `Downloading ${file.name}...`;
        list.appendChild(listItem);

        const req = await fetch(url);

        if (!req.ok) {
            throw new Error(`Failed to download ${file.name}`);
        }

        listItem.innerText = `✅ Downloaded ${file.name}`;

        if (file.payloadExtractorAsync) {
            return await file.payloadExtractorAsync(await req.blob());
        } else {
            return await req.blob();
        }
    });

    await awaitAnimationFrame();
    const completePayload = await awaitFolder(isfsPayloadPaired);

    console.log("Creating zip file...");
    outputStatus.innerText = "Creating zip file...";
    const zip = generateJSZip(completePayload);

    const content = await zip.generateAsync({ type: "base64" });
    location.href = "data:application/zip;base64," + content;
    
}

document.getElementById("generate-package")!.addEventListener("click", generate);