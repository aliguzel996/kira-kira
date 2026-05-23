import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const iconDir = path.join(rootDir, 'build', 'icons');
const publicDir = path.join(rootDir, 'public');
const sourceSvgPath = path.join(iconDir, 'kira-kira.svg');
const sizes = [16, 24, 32, 48, 64, 128, 256];
const viewBoxSize = 1920;

function tokenizePath(d) {
  return d.match(/[a-zA-Z]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/g) ?? [];
}

function cubicPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
    y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y,
  };
}

function pathToPolygon(d) {
  const tokens = tokenizePath(d);
  const points = [];
  let cursor = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  let command = '';
  let index = 0;

  const read = () => Number(tokens[index++]);
  const hasNumber = () => index < tokens.length && !/^[a-zA-Z]$/.test(tokens[index]);

  while (index < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[index])) {
      command = tokens[index++];
    }

    if (command === 'M') {
      cursor = { x: read(), y: read() };
      start = cursor;
      points.push(cursor);
      while (hasNumber()) {
        cursor = { x: read(), y: read() };
        points.push(cursor);
      }
      continue;
    }

    if (command === 'L') {
      while (hasNumber()) {
        cursor = { x: read(), y: read() };
        points.push(cursor);
      }
      continue;
    }

    if (command === 'C') {
      while (hasNumber()) {
        const p0 = cursor;
        const p1 = { x: read(), y: read() };
        const p2 = { x: read(), y: read() };
        const p3 = { x: read(), y: read() };
        const distance = Math.hypot(p3.x - p0.x, p3.y - p0.y);
        const steps = Math.max(8, Math.ceil(distance / 34));
        for (let step = 1; step <= steps; step += 1) {
          points.push(cubicPoint(p0, p1, p2, p3, step / steps));
        }
        cursor = p3;
      }
      continue;
    }

    if (command === 'Z' || command === 'z') {
      points.push(start);
      continue;
    }

    throw new Error(`Unsupported SVG path command: ${command}`);
  }

  return points;
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i];
    const pj = polygon[j];
    const intersects = (pi.y > y) !== (pj.y > y)
      && x < ((pj.x - pi.x) * (y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function rasterizeDib(polygon, size) {
  const scale = size / viewBoxSize;
  const scaled = polygon.map((point) => ({
    x: point.x * scale,
    y: point.y * scale,
  }));
  const pixels = Buffer.alloc(size * size * 4);
  const sampleGrid = size <= 64 ? 3 : 2;
  const sampleTotal = sampleGrid * sampleGrid;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let coverage = 0;

      for (let sy = 0; sy < sampleGrid; sy += 1) {
        for (let sx = 0; sx < sampleGrid; sx += 1) {
          const sampleX = x + (sx + 0.5) / sampleGrid;
          const sampleY = y + (sy + 0.5) / sampleGrid;
          if (pointInPolygon(sampleX, sampleY, scaled)) coverage += 1;
        }
      }

      const ink = coverage / sampleTotal;
      const value = Math.round(255 * (1 - ink));
      const bottomUpY = size - 1 - y;
      const offset = (bottomUpY * size + x) * 4;
      pixels[offset] = value;
      pixels[offset + 1] = value;
      pixels[offset + 2] = value;
      pixels[offset + 3] = 255;
    }
  }

  const maskStride = Math.ceil(size / 32) * 4;
  const mask = Buffer.alloc(maskStride * size);
  const dibHeader = Buffer.alloc(40);
  dibHeader.writeUInt32LE(40, 0);
  dibHeader.writeInt32LE(size, 4);
  dibHeader.writeInt32LE(size * 2, 8);
  dibHeader.writeUInt16LE(1, 12);
  dibHeader.writeUInt16LE(32, 14);
  dibHeader.writeUInt32LE(0, 16);
  dibHeader.writeUInt32LE(pixels.length, 20);

  return Buffer.concat([dibHeader, pixels, mask]);
}

function icoFromDibs(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  let offset = header.length + entries.length * 16;
  const dirs = entries.map(({ size, dib }) => {
    const dir = Buffer.alloc(16);
    dir.writeUInt8(size >= 256 ? 0 : size, 0);
    dir.writeUInt8(size >= 256 ? 0 : size, 1);
    dir.writeUInt8(0, 2);
    dir.writeUInt8(0, 3);
    dir.writeUInt16LE(1, 4);
    dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(dib.length, 8);
    dir.writeUInt32LE(offset, 12);
    offset += dib.length;
    return dir;
  });

  return Buffer.concat([header, ...dirs, ...entries.map((entry) => entry.dib)]);
}

async function main() {
  await fs.mkdir(iconDir, { recursive: true });
  await fs.mkdir(publicDir, { recursive: true });

  const svgText = await fs.readFile(sourceSvgPath, 'utf8');
  const pathMatch = svgText.match(/<path[^>]*\sd="([^"]+)"/);
  if (!pathMatch) throw new Error('No path found in SVG icon.');

  const polygon = pathToPolygon(pathMatch[1]);
  const dibEntries = sizes.map((size) => ({
    size,
    dib: rasterizeDib(polygon, size),
  }));

  await fs.copyFile(sourceSvgPath, path.join(iconDir, 'icon.svg'));
  await fs.copyFile(sourceSvgPath, path.join(publicDir, 'favicon.svg'));
  await fs.writeFile(path.join(iconDir, 'icon.ico'), icoFromDibs(dibEntries));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
