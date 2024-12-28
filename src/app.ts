import JSZip from "jszip";

console.log("Hi!");

async function generate() {
    // https://gbatemp.net/threads/how-to-set-up-isfshax.642258/
    console.log("Downloading files...");

    // Flipped for "latest" tag
    // https://stackoverflow.com/questions/24987542/is-there-a-link-to-github-for-downloading-a-file-in-the-latest-release-of-a-repo
    // https://github.com/isfshax/isfshax_installer/releases/download/v2.0/ios.img
    const ios_req = await fetch("https://corsproxy.io/?url=https://github.com/isfshax/isfshax_installer/releases/latest/download/ios.img")

    // https://github.com/isfshax/isfshax/releases/download/v4.0/superblock.img
    // https://github.com/isfshax/isfshax/releases/download/v4.0/superblock.img.sha
    const superblock_req = await fetch("https://corsproxy.io/?url=https://github.com/isfshax/isfshax/releases/latest/download/superblock.img");
    const superblock_sha_req = await fetch("https://corsproxy.io/?url=https://github.com/isfshax/isfshax/releases/latest/download/superblock.img.sha");

    // https://github.com/jan-hofmeier/stroopwafel/releases/download/redseeprom-v1.1/wafel_core.ipx
    const wafel_core_req = await fetch("https://corsproxy.io/?url=https://github.com/jan-hofmeier/stroopwafel/releases/latest/download/wafel_core.ipx");

    // https://github.com/isfshax/wafel_isfshax_patch/releases/download/v3.1.1/wafel_isfshax_patch.ipx
    const wafel_isfshax_patch_req = await fetch("https://corsproxy.io/?url=https://github.com/isfshax/wafel_isfshax_patch/releases/latest/download/wafel_isfshax_patch.ipx");

    // For non-UDPIH
    // https://github.com/jan-hofmeier/minute_minute/releases/download/redseeprom-v1.0/fw_encrypted.img
    // https://github.com/wiiu-env/fw_img_payload/releases/download/v0.1/fw_img_payload_20201201-192754.zip
    const fw_encrypted_req = await fetch("https://corsproxy.io/?url=https://github.com/jan-hofmeier/minute_minute/releases/latest/download/fw_encrypted.img");
    const fw_img_payload_req = await fetch("https://corsproxy.io/?url=https://github.com/wiiu-env/fw_img_payload/releases/latest/download/fw_img_payload_20201201-192754.zip");

    // fw_img_payload_req is a zip file with a folder named `wiiu` containing a `payload.elf`; get that file.
    const fw_img_payload_zip = await JSZip.loadAsync(await fw_img_payload_req.blob());
    const fw_img_payload = fw_img_payload_zip.folder("wiiu")!.file("payload.elf")!;
    const fw_img_payload_blob = await fw_img_payload.async("blob");

    console.log("Creating zip file...");

    const zip = new JSZip();
    const main = zip.folder("sd_card")!;
    main.file("ios.img", await ios_req.blob());
    main.file("superblock.img", await superblock_req.blob());
    main.file("superblock.img.sha", await superblock_sha_req.blob());
    const wiiu = main.folder("wiiu")!;
    wiiu.file("payload.elf", fw_img_payload_blob);
    const ios_plugins = wiiu.folder("ios_plugins")!;
    ios_plugins.file("wafel_core.ipx", await wafel_core_req.blob());
    ios_plugins.file("wafel_isfshax_patch.ipx", await wafel_isfshax_patch_req.blob());
    // For non-UDPIH
    // fw_encrypted => fw.img
    main.file("fw.img", await fw_encrypted_req.blob());
    
    // TODO: UDPIH 
    // * recovery_menu
    // * boot1.img

    // TODO: DNSpresso
    // * root.rpx

    const content = await zip.generateAsync({ type: "base64" });
    location.href = "data:application/zip;base64," + content;
    
}

document.getElementById("generate-package")!.addEventListener("click", generate);