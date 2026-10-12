// Pre-render the few fixed images used by pages that are rendered on demand.
// Those pages cannot use astro:assets without resizing the image on every
// request, so the sizes they need are written to public/img/ before each build.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const asset = (name) => fileURLToPath(new URL(`../src/assets/${name}`, import.meta.url));
const out = fileURLToPath(new URL('../public/img/', import.meta.url));
fs.mkdirSync(out, { recursive: true });

const jobs = [
  ...[480, 760, 1100].map((w) => ['sky.jpg', `sky-${w}.webp`, (s) => s.resize({ width: w }).webp({ quality: 80 })]),
  ['sky.jpg', 'og-default.jpg', (s) => s.resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 82 })],
  ['avatar.png', 'avatar-220.webp', (s) => s.resize({ width: 220 }).webp({ quality: 82 })],
];

for (const [source, name, transform] of jobs) {
  await transform(sharp(asset(source))).toFile(out + name);
}
console.log(`wrote ${jobs.length} images to public/img/`);
