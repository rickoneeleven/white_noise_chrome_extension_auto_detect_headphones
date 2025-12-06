const fs = require('fs');
const zlib = require('zlib');

function crc32(buf) {
  let crc = 0xffffffff;
  const table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPNG(width, height, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  function chunk(type, data) {
    const typeAndData = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData));
    return Buffer.concat([len, typeAndData, crc]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);  // bit depth
  ihdr.writeUInt8(6, 9);  // color type RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  // IDAT - image data with filter bytes
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter byte for each row
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      rawData.push(pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3]);
    }
  }
  const compressed = zlib.deflateSync(Buffer.from(rawData), { level: 9 });

  // IEND
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', iend)
  ]);
}

function createIconPixels(size, r, g, b) {
  const pixels = new Uint8Array(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Inside circle - main color
        pixels[idx] = r;
        pixels[idx + 1] = g;
        pixels[idx + 2] = b;
        pixels[idx + 3] = 255;

        // Draw sound wave arcs (white)
        const waveCenter = cx - size / 6;
        const wdx = x - waveCenter + 0.5;
        const wdy = y - cy + 0.5;
        const wdist = Math.sqrt(wdx * wdx + wdy * wdy);
        const angle = Math.atan2(wdy, wdx);

        const lineWidth = Math.max(1.5, size / 12);

        for (let i = 1; i <= 3; i++) {
          const arcRadius = (size / 5.5) * i;
          if (Math.abs(wdist - arcRadius) < lineWidth &&
              angle > -Math.PI / 2.5 && angle < Math.PI / 2.5) {
            pixels[idx] = 255;
            pixels[idx + 1] = 255;
            pixels[idx + 2] = 255;
          }
        }
      } else {
        // Outside circle - transparent
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0;
      }
    }
  }
  return pixels;
}

const sizes = [16, 48, 128];
const colors = {
  on: [74, 222, 128],      // #4ade80 green - playing/connected
  waiting: [251, 191, 36], // #fbbf24 amber - enabled, waiting for headphones
  off: [107, 114, 128]     // #6b7280 gray - disabled
};

sizes.forEach(size => {
  const onPixels = createIconPixels(size, ...colors.on);
  const waitingPixels = createIconPixels(size, ...colors.waiting);
  const offPixels = createIconPixels(size, ...colors.off);

  fs.writeFileSync(`icons/icon-on-${size}.png`, createPNG(size, size, onPixels));
  fs.writeFileSync(`icons/icon-waiting-${size}.png`, createPNG(size, size, waitingPixels));
  fs.writeFileSync(`icons/icon-off-${size}.png`, createPNG(size, size, offPixels));
  console.log(`Created ${size}x${size} icons`);
});

console.log('All icons generated!');
