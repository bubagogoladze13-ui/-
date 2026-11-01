// Turns the text of a WhatsApp "Export chat" file into a list of messages.
// Works with Android ("01/11/2026, 14:05 - Name: text") and
// iPhone ("[01/11/2026, 14:05:33] Name: text") exports.

const TIME = String.raw`(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[\s ]*([AaPp])\.?\s?[Mm]\.?)?`;
const DATE = String.raw`(\d{1,4})[./-](\d{1,2})[./-](\d{1,4}),?\s+`;
const ANDROID = new RegExp(`^${DATE}${TIME}\\s+[-–]\\s+([\\s\\S]*)$`);
const IOS = new RegExp(`^\\[${DATE}${TIME}\\]\\s+([\\s\\S]*)$`);

// Invisible direction marks that WhatsApp puts in exports.
const INVISIBLE = /[‎‏﻿‪-‮]/g;

function matchHeader(line) {
  const m = ANDROID.exec(line) || IOS.exec(line);
  if (!m) return null;
  const [, a, b, c, hh, mm, ss, ampm, rest] = m;
  return { a, b, c, hh: +hh, mm: +mm, ss: ss ? +ss : null, ampm, rest };
}

// Decide whether dates are day/month or month/day by looking at all of them.
function detectDateOrder(headers) {
  let yearFirst = false, aOver12 = false, bOver12 = false;
  for (const h of headers) {
    if (h.a.length === 4) yearFirst = true;
    if (+h.a > 12) aOver12 = true;
    if (+h.b > 12) bOver12 = true;
  }
  if (yearFirst) return 'ymd';
  if (bOver12 && !aOver12) return 'mdy';
  return 'dmy'; // Georgian phones use day first
}

const pad = (n) => String(n).padStart(2, '0');

function toDate(h, order) {
  let y, mo, d;
  if (order === 'ymd') [y, mo, d] = [h.a, h.b, h.c];
  else if (order === 'mdy') [mo, d, y] = [h.a, h.b, h.c];
  else [d, mo, y] = [h.a, h.b, h.c];
  y = +y; if (y < 100) y += 2000;
  let hour = h.hh;
  if (h.ampm) {
    const pm = h.ampm.toLowerCase() === 'p';
    if (pm && hour < 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
  }
  const day = `${y}-${pad(+mo)}-${pad(+d)}`;
  const time = `${pad(hour)}:${pad(h.mm)}` + (h.ss !== null ? `:${pad(h.ss)}` : '');
  return { day, time };
}

// Short stable hash so the same message always gets the same id.
export function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Pull attachment file names out of the message text.
function extractAttachments(text, mediaNames) {
  const files = [];
  let clean = text;
  for (const name of mediaNames) {
    if (!clean.includes(name)) continue;
    files.push(name);
    const n = escapeRe(name);
    clean = clean
      .replace(new RegExp(`<[^<>]*${n}\\s*>`, 'g'), '') // iPhone: <attached: name>
      .replace(new RegExp(`${n}\\s*\\([^)]*\\)`, 'g'), '') // Android: name (file attached)
      .split(name).join('');
  }
  return { files, text: clean.trim() };
}

/**
 * @param {string} raw        whole chat .txt content
 * @param {Iterable<string>} mediaNames  file names found in the zip
 * @returns {{id,day,time,author,text,files,system}[]}
 */
export function parseChat(raw, mediaNames = []) {
  const names = [...mediaNames].sort((x, y) => y.length - x.length);
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');

  const items = [];
  for (const line of lines) {
    const clean = line.replace(INVISIBLE, '');
    const h = matchHeader(clean);
    if (h) items.push({ h, body: h.rest });
    else if (items.length) items[items.length - 1].body += '\n' + clean;
  }

  const order = detectDateOrder(items.map((i) => i.h));
  const seen = new Map();

  return items.map(({ h, body }) => {
    const { day, time } = toDate(h, order);
    const sep = body.indexOf(': ');
    const system = sep < 0;
    const author = system ? '' : body.slice(0, sep).trim();
    const rawText = system ? body.trim() : body.slice(sep + 2);
    const { files, text } = extractAttachments(rawText.trim(), names);

    // Same author can send the same text twice in one minute: number repeats.
    const key = `${day} ${time}|${author}|${rawText.trim()}`;
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);

    return { id: hash(key) + '-' + n, day, time, author, text, files, system };
  });
}

/** Pick the chat file among the .txt files in a zip. */
export function pickChatFile(paths) {
  const txt = paths.filter((p) => /\.txt$/i.test(p));
  return (
    txt.find((p) => /(^|\/)_chat\.txt$/i.test(p)) ||
    txt.find((p) => /whatsapp/i.test(p)) ||
    txt[0] ||
    null
  );
}
