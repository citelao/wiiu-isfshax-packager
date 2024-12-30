import JSZip from "jszip";

console.log("Hi!");

type PatchType = "aroma" | "haxchi" | "browser" | "dnspresso" | "udpih";
const patchType: PatchType = "aroma";

function getProxyUrl(url: string) {
    return `https://corsproxy.io/?url=${url}`;
}

async function generate() {
    // https://gbatemp.net/threads/how-to-set-up-isfshax.642258/
    console.log("Downloading files...");

    // Flipped for "latest" tag
    // https://stackoverflow.com/questions/24987542/is-there-a-link-to-github-for-downloading-a-file-in-the-latest-release-of-a-repo
    // https://github.com/isfshax/isfshax_installer/releases/download/v2.0/ios.img
    const ios_req = await fetch(getProxyUrl("https://github.com/isfshax/isfshax_installer/releases/latest/download/ios.img"));

    // https://github.com/isfshax/isfshax/releases/download/v4.0/superblock.img
    // https://github.com/isfshax/isfshax/releases/download/v4.0/superblock.img.sha
    const superblock_req = await fetch(getProxyUrl("https://github.com/isfshax/isfshax/releases/latest/download/superblock.img"));
    const superblock_sha_req = await fetch(getProxyUrl("https://github.com/isfshax/isfshax/releases/latest/download/superblock.img.sha"));

    // https://github.com/jan-hofmeier/stroopwafel/releases/download/redseeprom-v1.1/wafel_core.ipx
    const wafel_core_req = await fetch(getProxyUrl("https://github.com/jan-hofmeier/stroopwafel/releases/latest/download/wafel_core.ipx"));

    // https://github.com/isfshax/wafel_isfshax_patch/releases/download/v3.1.1/wafel_isfshax_patch.ipx
    const wafel_isfshax_patch_req = await fetch(getProxyUrl("https://github.com/isfshax/wafel_isfshax_patch/releases/latest/download/wafel_isfshax_patch.ipx"));

    // For non-UDPIH
    let fw_encrypted_req: Response | undefined = undefined;
    if (patchType !== "udpih") {
        // https://github.com/jan-hofmeier/minute_minute/releases/download/redseeprom-v1.0/fw_encrypted.img
        // https://github.com/wiiu-env/fw_img_payload/releases/download/v0.1/fw_img_payload_20201201-192754.zip
        fw_encrypted_req = await fetch(getProxyUrl("https://github.com/jan-hofmeier/minute_minute/releases/latest/download/fw_encrypted.img"));
    }
    
    let fw_img_payload_req: Response | undefined = undefined;
    if (patchType === "browser" || patchType === "dnspresso") {
        fw_img_payload_req = await fetch(getProxyUrl("https://github.com/wiiu-env/fw_img_payload/releases/latest/download/fw_img_payload_20201201-192754.zip"));
    }

    let fw_img_req: Response | undefined = undefined;
    let boot1_req: Response | undefined = undefined;
    let recovery_menu_req: Response | undefined = undefined;
    if (patchType === "udpih") {
        // https://github.com/jan-hofmeier/minute_minute/releases/download/redseeprom-v1.0/fw.img    
        // https://github.com/jan-hofmeier/minute_minute/releases/download/redseeprom-v1.0/boot1.img
        // https://github.com/GaryOderNichts/recovery_menu/releases/download/v0.6/recovery_menu
        fw_img_req = await fetch(getProxyUrl("https://github.com/jan-hofmeier/minute_minute/releases/latest/download/fw.img"));
        boot1_req = await fetch(getProxyUrl("https://github.com/jan-hofmeier/minute_minute/releases/latest/download/boot1.img"));
        recovery_menu_req = await fetch(getProxyUrl("https://github.com/GaryOderNichts/recovery_menu/releases/latest/download/recovery_menu"));
    }

    // fw_img_payload_req is a zip file with a folder named `wiiu` containing a `payload.elf`; get that file.
    let fw_img_payload_blob: Blob | undefined = undefined;
    if (fw_img_payload_req) {
        const fw_img_payload_zip = await JSZip.loadAsync(await fw_img_payload_req.blob());
        const fw_img_payload = fw_img_payload_zip.folder("wiiu")!.file("payload.elf")!;
        fw_img_payload_blob = await fw_img_payload.async("blob");
    }

    console.log("Creating zip file...");

    const zip = new JSZip();
    const main = zip.folder("sd_card")!;
    main.file("ios.img", await ios_req.blob());
    main.file("superblock.img", await superblock_req.blob());
    main.file("superblock.img.sha", await superblock_sha_req.blob());
    const wiiu = main.folder("wiiu")!;
    if (fw_img_payload_blob) {
        wiiu.file("payload.elf", fw_img_payload_blob);
    }
    const ios_plugins = wiiu.folder("ios_plugins")!;
    ios_plugins.file("wafel_core.ipx", await wafel_core_req.blob());
    ios_plugins.file("wafel_isfshax_patch.ipx", await wafel_isfshax_patch_req.blob());

    // For non-UDPIH
    // fw_encrypted => fw.img
    if (fw_encrypted_req) {
        main.file("fw.img", await fw_encrypted_req.blob());
    }

    // For UDPIH
    // fw.img, boot1.img => boot1now.img, recovery_menu
    if (fw_img_req) {
        main.file("fw.img", await fw_img_req.blob());
    }
    if (boot1_req) {
        main.file("boot1now.img", await boot1_req.blob());
    }
    if (recovery_menu_req) {
        main.file("recovery_menu", await recovery_menu_req.blob());
    }

    // TODO: DNSpresso
    // * root.rpx

    const content = await zip.generateAsync({ type: "base64" });
    location.href = "data:application/zip;base64," + content;
    
}

document.getElementById("generate-package")!.addEventListener("click", generate);