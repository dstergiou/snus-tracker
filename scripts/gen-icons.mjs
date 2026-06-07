import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const svgPath = resolve(projectRoot, 'static/icon.svg');
const outDir = resolve(projectRoot, 'static');

const sizes = [
	{ size: 180, name: 'apple-touch-icon.png' },
	{ size: 192, name: 'icon-192.png' },
	{ size: 512, name: 'icon-512.png' }
];

const svg = await readFile(svgPath);

for (const { size, name } of sizes) {
	const out = resolve(outDir, name);
	await sharp(svg).resize(size, size).png().toFile(out);
	console.log(`generated ${name} (${size}x${size})`);
}
