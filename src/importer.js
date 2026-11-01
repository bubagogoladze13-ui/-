// Reads a WhatsApp export (.zip with media, or a plain .txt) and saves
// only the messages and files that are not stored yet.
import { ZipReader, BlobReader, BlobWriter, TextWriter } from '@zip.js/zip.js';
import { parseChat, pickChatFile } from './parser.js';
import * as db from './db.js';

const MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  heic: 'image/heic', mp4: 'video/mp4', '3gp': 'video/3gpp', mov: 'video/quicktime',
  opus: 'audio/ogg', ogg: 'audio/ogg', m4a: 'audio/mp4', mp3: 'audio/mpeg', pdf: 'application/pdf',
};
export const mimeOf = (name) => MIME[name.split('.').pop().toLowerCase()] || 'application/octet-stream';
export const isImage = (name) => mimeOf(name).startsWith('image/') && !/\.heic$/i.test(name);

const baseName = (p) => p.split('/').pop();

/**
 * @param {File} file
 * @param {(text: string) => void} onProgress
 * @returns {Promise<{total:number, added:number, files:number}>}
 */
export async function importExport(file, onProgress = () => {}) {
  if (/\.txt$/i.test(file.name)) {
    return save(parseChat(await file.text()), new Map(), onProgress);
  }

  const reader = new ZipReader(new BlobReader(file));
  try {
    onProgress('ფაილს ვხსნი…');
    const entries = (await reader.getEntries()).filter((e) => !e.directory);
    const chatPath = pickChatFile(entries.map((e) => e.filename));
    if (!chatPath) throw new Error('ამ zip ფაილში ჩატის ტექსტი (.txt) ვერ ვიპოვე. ეს WhatsApp-ის ექსპორტია?');

    const chatEntry = entries.find((e) => e.filename === chatPath);
    const text = await chatEntry.getData(new TextWriter('utf-8'));
    const media = new Map(entries.filter((e) => e !== chatEntry).map((e) => [baseName(e.filename), e]));

    return await save(parseChat(text, media.keys()), media, onProgress);
  } finally {
    await reader.close();
  }
}

// Make big photos smaller (max 1600 px, JPEG) so free storage lasts longer.
const MAX_SIDE = 1600;
async function shrink(name, blob) {
  if (!isImage(name) || blob.size < 300_000 || typeof createImageBitmap !== 'function') return blob;
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const out = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
    return out && out.size < blob.size ? out : blob;
  } catch {
    return blob;
  }
}

async function save(messages, media, onProgress) {
  const known = await db.messageIds();
  const fresh = messages.filter((m) => !known.has(m.id));

  const needed = [...new Set(fresh.flatMap((m) => m.files))].filter((n) => media.has(n));
  let saved = 0;
  for (const [i, name] of needed.entries()) {
    onProgress(`ფოტოებს ვინახავ: ${i + 1} / ${needed.length}`);
    if (await db.hasFile(name)) continue;
    const blob = await media.get(name).getData(new BlobWriter(mimeOf(name)));
    await db.putFile(name, await shrink(name, blob));
    saved++;
  }

  // Remember which attachments were really in the zip (export without media has none).
  for (const m of fresh) m.missing = m.files.filter((n) => !media.has(n));
  await db.putMessages(fresh);
  return { total: messages.length, added: fresh.length, files: saved };
}
