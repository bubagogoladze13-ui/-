// Creates samples/sample-export.zip: a fake WhatsApp group export (Android format)
// with a few generated photos, for testing before the real export arrives.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { ZipWriter, Uint8ArrayWriter, TextReader, Uint8ArrayReader } from '@zip.js/zip.js';

// --- tiny PNG encoder (solid colour + yellow road stripe) ---
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function png(w, h, [r, g, b]) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const stripe = Math.abs(y - h / 2) < 6 && Math.floor(x / 30) % 2 === 0;
      const i = y * (w * 3 + 1) + 1 + x * 3;
      raw[i] = stripe ? 231 : r; raw[i + 1] = stripe ? 180 : g; raw[i + 2] = stripe ? 22 : b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const photos = {
  'IMG-20261030-WA0001.png': [70, 76, 76],
  'IMG-20261030-WA0002.png': [92, 84, 70],
  'IMG-20261031-WA0003.png': [60, 66, 72],
  'IMG-20261101-WA0004.png': [80, 90, 80],
  'IMG-20261101-WA0005.png': [100, 92, 84],
};

const chat = `30/10/2026, 07:58 - Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.
30/10/2026, 08:10 - გიორგი ბერიძე: ქუთაისი-წყალტუბოს გზა, მონაკვეთი 2. დავიწყეთ ძველი საფარის მოხსნა
30/10/2026, 08:11 - გიორგი ბერიძე: IMG-20261030-WA0001.png (file attached)
30/10/2026, 12:40 - ნინო კაპანაძე: ქვიშა მოვიდა, 3 მანქანა
30/10/2026, 17:05 - გიორგი ბერიძე: IMG-20261030-WA0002.png (file attached)
დღეს გაკეთდა 120 მ
31/10/2026, 09:02 - დავით ლომიძე: ექსკავატორი 8 საათი, სატკეპნი 5 საათი
31/10/2026, 09:03 - დავით ლომიძე: IMG-20261031-WA0003.png (file attached)
31/10/2026, 18:30 - ნინო კაპანაძე: დღეს 6 კაცი ვიყავით ობიექტზე
01/11/2026, 08:20 - გიორგი ბერიძე: ასფალტის დაგება დავიწყეთ
01/11/2026, 08:21 - გიორგი ბერიძე: IMG-20261101-WA0004.png (file attached)
01/11/2026, 13:15 - დავით ლომიძე: IMG-20261101-WA0005.png (file attached)
ბეტონის ბორდიური დაიდო
01/11/2026, 16:45 - ნინო კაპანაძე: <Media omitted>
`;

mkdirSync('samples', { recursive: true });
const zip = new ZipWriter(new Uint8ArrayWriter());
await zip.add('WhatsApp Chat with შპს მეკა ყოველდღიური ფოტომასალა.txt', new TextReader(chat));
for (const [name, rgb] of Object.entries(photos)) {
  await zip.add(name, new Uint8ArrayReader(new Uint8Array(png(480, 320, rgb))));
}
writeFileSync('samples/sample-export.zip', await zip.close());
console.log('Created samples/sample-export.zip');
