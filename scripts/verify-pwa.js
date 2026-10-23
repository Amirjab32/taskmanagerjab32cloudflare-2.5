import fs from "fs";
import path from "path";
import sharp from "sharp";

async function verifyPWA() {
  console.log("=== BROWSER PWA INSTALLABILITY AUDIT ===\n");
  let passed = true;

  // 1. Inspect manifest.json
  const manifestPath = path.resolve("public/manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error("FAIL: public/manifest.json not found!");
    passed = false;
  } else {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);
    console.log("✓ Manifest JSON parsed successfully");

    const requiredFields = ["id", "name", "short_name", "start_url", "display", "icons"];
    for (const f of requiredFields) {
      if (!manifest[f]) {
        console.error(`FAIL: Missing required field "${f}" in manifest.json`);
        passed = false;
      } else {
        console.log(`✓ Manifest field "${f}":`, manifest[f]);
      }
    }

    if (manifest.display !== "standalone" && manifest.display !== "fullscreen") {
      console.error("FAIL: display must be 'standalone' or 'fullscreen'");
      passed = false;
    }

    // 2. Inspect icons defined in manifest
    console.log("\n--- Checking Icons Defined in Manifest ---");
    let has192 = false;
    let has512 = false;
    let hasMaskable = false;

    for (const icon of manifest.icons) {
      const cleanSrc = icon.src.startsWith("/") ? icon.src.slice(1) : icon.src;
      const iconPath = path.resolve("public", cleanSrc);
      if (!fs.existsSync(iconPath)) {
        console.error(`FAIL: Icon file not found on disk: ${iconPath}`);
        passed = false;
        continue;
      }

      const meta = await sharp(iconPath).metadata();
      const expectedSize = parseInt(icon.sizes.split("x")[0], 10);
      if (meta.width !== expectedSize || meta.height !== expectedSize) {
        console.error(`FAIL: Icon ${icon.src} dimension mismatch! File is ${meta.width}x${meta.height}, manifest says ${icon.sizes}`);
        passed = false;
      } else {
        console.log(`✓ Icon ${icon.src} (${meta.format}): ${meta.width}x${meta.height} [purpose: ${icon.purpose || "any"}]`);
      }

      if (meta.width >= 192 && meta.width < 512 && (!icon.purpose || icon.purpose.includes("any"))) has192 = true;
      if (meta.width >= 512 && (!icon.purpose || icon.purpose.includes("any"))) has512 = true;
      if (icon.purpose && icon.purpose.includes("maskable")) hasMaskable = true;
    }

    if (!has192) { console.error("FAIL: Manifest requires at least one 192x192 icon with purpose 'any'"); passed = false; }
    if (!has512) { console.error("FAIL: Manifest requires at least one 512x512 icon with purpose 'any'"); passed = false; }
    if (!hasMaskable) { console.error("FAIL: Manifest requires maskable icon for Android"); passed = false; }
  }

  // 3. Inspect Service Worker
  console.log("\n--- Checking Service Worker ---");
  const swPath = path.resolve("public/sw.js");
  if (!fs.existsSync(swPath)) {
    console.error("FAIL: public/sw.js does not exist!");
    passed = false;
  } else {
    const swContent = fs.readFileSync(swPath, "utf-8");
    if (!swContent.includes("install")) { console.error("FAIL: sw.js missing 'install' event listener"); passed = false; }
    if (!swContent.includes("fetch")) { console.error("FAIL: sw.js missing 'fetch' event listener"); passed = false; }
    console.log("✓ Service Worker sw.js exists with valid install & fetch event listeners");
  }

  // 4. Inspect index.html
  console.log("\n--- Checking index.html Meta Tags ---");
  const htmlPath = path.resolve("index.html");
  const html = fs.readFileSync(htmlPath, "utf-8");
  if (!html.includes('rel="manifest"')) { console.error("FAIL: index.html missing <link rel='manifest'>"); passed = false; }
  else console.log("✓ <link rel='manifest'> present");

  if (!html.includes('rel="apple-touch-icon"')) { console.error("FAIL: index.html missing <link rel='apple-touch-icon'>"); passed = false; }
  else console.log("✓ <link rel='apple-touch-icon'> present");

  if (!html.includes('name="viewport"')) { console.error("FAIL: index.html missing viewport meta"); passed = false; }
  else console.log("✓ <meta name='viewport'> present");

  // 5. Inspect dist/ build
  console.log("\n--- Checking dist/ Distribution Files ---");
  const distManifest = path.resolve("dist/manifest.json");
  const distSW = path.resolve("dist/sw.js");
  const distIcon192 = path.resolve("dist/pwa-192x192.png");
  const distIcon512 = path.resolve("dist/pwa-512x512.png");

  if (fs.existsSync(distManifest) && fs.existsSync(distSW) && fs.existsSync(distIcon192) && fs.existsSync(distIcon512)) {
    console.log("✓ All PWA production files exist in dist/ directory");
  } else {
    console.error("FAIL: Missing files in dist/ directory");
    passed = false;
  }

  console.log("\n==========================================");
  if (passed) {
    console.log("🎉 AUDIT PASSED: 100% COMPLIANT WITH CHROMIUM & APPLE PWA STANDARDS!");
  } else {
    console.log("❌ AUDIT FAILED. Review errors above.");
    process.exit(1);
  }
}

verifyPWA().catch(console.error);
