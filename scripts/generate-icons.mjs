import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "icons");

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const FROM = [79, 70, 229];
const TO = [30, 27, 75];
const SS = 4;

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

class Canvas {
  constructor(size) {
    this.size = size;
    this.pixels = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const t = (x / size + y / size) / 2;
        const [r, g, b] = mix([99, 102, 241], [30, 27, 75], t);
        const i = (y * size + x) * 4;
        this.pixels[i] = r;
        this.pixels[i + 1] = g;
        this.pixels[i + 2] = b;
        this.pixels[i + 3] = 255;
      }
    }
  }

  fill(x, y, width, height) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.size, Math.round(x + width));
    const y1 = Math.min(this.size, Math.round(y + height));
    for (let py = y0; py < y1; py += 1) {
      for (let px = x0; px < x1; px += 1) {
        const i = (py * this.size + px) * 4;
        this.pixels[i] = 255;
        this.pixels[i + 1] = 255;
        this.pixels[i + 2] = 255;
        this.pixels[i + 3] = 255;
      }
    }
  }

  strokeRect(x, y, width, height, stroke) {
    this.fill(x, y, width, stroke);
    this.fill(x, y + height - stroke, width, stroke);
    this.fill(x, y, stroke, height);
    this.fill(x + width - stroke, y, stroke, height);
  }

  downsample() {
    const size = this.size / SS;
    const out = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        let r = 0;
        let g = 0;
        let b = 0;
        for (let sy = 0; sy < SS; sy += 1) {
          for (let sx = 0; sx < SS; sx += 1) {
            const i = ((y * SS + sy) * this.size + (x * SS + sx)) * 4;
            r += this.pixels[i];
            g += this.pixels[i + 1];
            b += this.pixels[i + 2];
          }
        }
        const count = SS * SS;
        const i = (y * size + x) * 4;
        out[i] = Math.round(r / count);
        out[i + 1] = Math.round(g / count);
        out[i + 2] = Math.round(b / count);
        out[i + 3] = 255;
      }
    }
    return { size, buffer: out };
  }
}

function renderIcon(size, { glyphScale = 1 } = {}) {
  const canvas = new Canvas(size * SS);
  const unit = (size * SS * glyphScale) / 24;
  const offset = (size * SS - unit * 24) / 2;
  const at = (value) => offset + value * unit;
  const stroke = Math.max(1, Math.round(unit * 1.7));

  const finders = [
    [3, 3],
    [14, 3],
    [3, 14],
  ];
  finders.forEach(([gx, gy]) => {
    canvas.strokeRect(at(gx), at(gy), unit * 7, unit * 7, stroke);
  });
  canvas.fill(at(5.2), at(5.2), unit * 2.6, unit * 2.6);
  canvas.fill(at(16.2), at(5.2), unit * 2.6, unit * 2.6);

  canvas.fill(at(14), at(14), unit * 3, unit * 3);
  canvas.fill(at(20), at(14), unit * 0.9, unit * 2);
  canvas.fill(at(17), at(20), unit * 3, unit * 0.9);
  canvas.fill(at(14), at(19), unit * 0.9, unit * 1.2);
  canvas.fill(at(18.4), at(18.4), unit * 0.9, unit * 0.9);

  return canvas.downsample();
}

await mkdir(outDir, { recursive: true });

const outputs = [
  ["icon-192.png", 192, {}],
  ["icon-512.png", 512, {}],
  ["icon-512-maskable.png", 512, { glyphScale: 0.74 }],
  ["apple-touch-icon.png", 180, { glyphScale: 0.84 }],
  ["favicon-32.png", 32, { glyphScale: 0.9 }],
];

for (const [name, size, options] of outputs) {
  const { buffer } = renderIcon(size, options);
  const png = encodePng(size, size, buffer);
  await writeFile(join(outDir, name), png);
  console.log(`wrote public/icons/${name} (${png.length} bytes)`);
}
