// Reads the generated sample zip the same way the page does (without the browser storage).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { ZipReader, Uint8ArrayReader, TextWriter } from '@zip.js/zip.js';
import { parseChat, pickChatFile } from '../src/parser.js';

const path = 'samples/sample-export.zip';

test('sample export: chat file, photos and days are found', { skip: !existsSync(path) }, async () => {
  const reader = new ZipReader(new Uint8ArrayReader(new Uint8Array(readFileSync(path))));
  const entries = await reader.getEntries();
  const chatPath = pickChatFile(entries.map((e) => e.filename));
  const chat = await entries.find((e) => e.filename === chatPath).getData(new TextWriter());
  const media = entries.filter((e) => e.filename !== chatPath).map((e) => e.filename);
  await reader.close();

  const msgs = parseChat(chat, media);
  const days = new Set(msgs.map((m) => m.day));
  const photos = msgs.flatMap((m) => m.files);

  assert.deepEqual([...days], ['2026-10-30', '2026-10-31', '2026-11-01']);
  assert.equal(photos.length, 5);
  assert.equal(msgs.find((m) => m.files.includes('IMG-20261030-WA0002.png')).text, 'დღეს გაკეთდა 120 მ');
  assert.equal(new Set(msgs.map((m) => m.id)).size, msgs.length);
});
