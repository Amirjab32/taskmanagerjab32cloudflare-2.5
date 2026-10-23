import fs from "fs";
import path from "path";
import sharp from "sharp";

const svgPath = path.resolve("public/icon.svg");
const svgBuffer = fs.readFileSync(svgPath);

// Create maskable SVG with full-bleed background and scaled content (80% safe zone)
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#18181b" />
      <stop offset="100%" stop-color="#09090b" />
    </linearGradient>
    <linearGradient id="primaryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#fef08a" />
    </linearGradient>
  </defs>

  <!-- Full-bleed background for maskable icon -->
  <rect width="512" height="512" fill="url(#bgGrad)" />

  <!-- Content scaled to 78% for Android mask safe zone -->
  <g transform="translate(256, 256) scale(0.78)">
    <circle cx="0" cy="0" r="160" fill="#f59e0b" opacity="0.12" />
    <path d="M 0,-160 A 160,160 0 1,1 -160,0" fill="none" stroke="url(#primaryGrad)" stroke-width="28" stroke-linecap="round" />
    <circle cx="-160" cy="-60" r="14" fill="#fbbf24" />
    <circle cx="-130" cy="-110" r="10" fill="#f59e0b" opacity="0.7" />
    <circle cx="0" cy="0" r="100" fill="none" stroke="#27272a" stroke-width="16" />
    <path d="M -100,0 A 100,100 0 0,1 0,-100" fill="none" stroke="url(#accentGrad)" stroke-width="16" stroke-linecap="round" />
    <path d="M -42,6 L -10,38 L 52,-38" fill="none" stroke="#ffffff" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="56" cy="-42" r="8" fill="#fbbf24" />
  </g>
</svg>`;

async function generate() {
  console.log("Generating PWA PNG icons...");
  
  // 512x512 standard
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile("public/pwa-512x512.png");
  console.log("✓ pwa-512x512.png");

  // 192x192 standard
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile("public/pwa-192x192.png");
  console.log("✓ pwa-192x192.png");

  // 512x512 maskable
  await sharp(Buffer.from(maskableSvg))
    .resize(512, 512)
    .png()
    .toFile("public/pwa-maskable-512x512.png");
  console.log("✓ pwa-maskable-512x512.png");

  // 180x180 apple-touch-icon
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile("public/apple-touch-icon.png");
  console.log("✓ apple-touch-icon.png");

  // Replace corrupted icon.png with valid 512x512 PNG
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile("public/icon.png");
  console.log("✓ icon.png (replaced corrupted file)");
}

generate().catch(console.error);
