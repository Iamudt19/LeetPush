import { writeFileSync, mkdirSync } from 'fs';
import { deflateSync } from 'zlib';

function createPng(size) {
  const width = size;
  const height = size;
  const rowBytes = 1 + width * 4;
  const rawData = Buffer.alloc(rowBytes * height);

  const radius = size / 2;
  const cx = size / 2;
  const cy = size / 2;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius - 0.5) {
        const t = (x + y) / (width + height);
        const r1 = 2, g1 = 132, b1 = 199;
        const r2 = 99, g2 = 102, b2 = 241;

        let r = Math.round(r1 + (r2 - r1) * t);
        let g = Math.round(g1 + (g2 - g1) * t);
        let b = Math.round(b1 + (b2 - b1) * t);

        const nx = (x - cx) / (size * 0.45);
        const ny = (y - cy) / (size * 0.45);

        let isBolt = false;
        if (ny >= -0.7 && ny <= 0.1) {
          const leftBound = -0.35 + (0.45 * (ny + 0.7)) / 0.8;
          const rightBound = 0.25 - (0.15 * (ny + 0.7)) / 0.8;
          if (nx >= leftBound && nx <= rightBound) isBolt = true;
        }
        if (ny >= -0.05 && ny <= 0.75) {
          const leftBound = -0.25 + (0.15 * (0.75 - ny)) / 0.8;
          const rightBound = 0.35 - (0.45 * (0.75 - ny)) / 0.8;
          if (nx >= leftBound && nx <= rightBound) isBolt = true;
        }

        if (isBolt) {
          r = 254;
          g = 240;
          b = 138;
        }

        let alpha = 255;
        if (dist > radius - 1.5) {
          alpha = Math.round(255 * (radius - 0.5 - dist));
        }

        rawData[pxOffset] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
        rawData[pxOffset + 3] = Math.max(0, Math.min(255, alpha));
      } else {
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const compressedData = deflateSync(rawData);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = data.length;

  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  typeBuf.copy(chunk, 4);
  data.copy(chunk, 8);

  const crc = crc32(Buffer.concat([typeBuf, data]));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

mkdirSync('public/icons', { recursive: true });
const sizes = [16, 32, 48, 128];
for (const size of sizes) {
  const png = createPng(size);
  writeFileSync(`public/icons/icon${size}.png`, png);
  console.log(`Generated public/icons/icon${size}.png`);
}
