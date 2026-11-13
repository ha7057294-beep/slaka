import sharp from 'sharp';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../public');

const standardSvg = resolve(publicDir, 'icon.svg');
const maskableSvg = resolve(publicDir, 'icon-maskable.svg');

async function generateIcons() {
  await Promise.all([
    sharp(standardSvg)
      .resize(192, 192)
      .png()
      .toFile(resolve(publicDir, 'icon-192.png')),
    sharp(standardSvg)
      .resize(512, 512)
      .png()
      .toFile(resolve(publicDir, 'icon-512.png')),
    sharp(standardSvg)
      .resize(180, 180)
      .png()
      .toFile(resolve(publicDir, 'apple-touch-icon.png')),
    sharp(maskableSvg)
      .resize(512, 512)
      .png()
      .toFile(resolve(publicDir, 'icon-maskable-512.png')),
  ]);
  console.log('Generated PWA PNG icons in public/.');
}

generateIcons().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
