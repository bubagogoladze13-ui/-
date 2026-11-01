// Shared online storage (Supabase): everyone who logs in sees the same journal.
import { supabase } from './supabase.js';

const BUCKET = 'photos';
const PAGE = 1000;

const toRow = (m) => ({
  id: m.id, day: m.day, time_of_day: m.time, author: m.author, body: m.text,
  files: m.files, missing: m.missing || [], is_system: m.system,
});
const fromRow = (r) => ({
  id: r.id, day: r.day, time: r.time_of_day, author: r.author, text: r.body,
  files: r.files || [], missing: r.missing || [], system: r.is_system,
});

async function selectAll(columns) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('messages').select(columns).order('id').range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

export async function allMessages() {
  return (await selectAll('*')).map(fromRow);
}

export async function messageIds() {
  return new Set((await selectAll('id')).map((r) => r.id));
}

export async function putMessages(list) {
  for (let i = 0; i < list.length; i += 500) {
    const { error } = await supabase
      .from('messages')
      .upsert(list.slice(i, i + 500).map(toRow), { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw error;
  }
}

// Upload skips files that already exist, so no separate check is needed.
export async function hasFile() {
  return false;
}

export async function putFile(name, blob) {
  const { error } = await supabase.storage.from(BUCKET).upload(name, blob, { contentType: blob.type, upsert: false });
  if (error && !/exist|duplicate/i.test(error.message)) throw error;
}

export async function getFile(name) {
  const { data, error } = await supabase.storage.from(BUCKET).download(name);
  return error ? undefined : data;
}

const signed = new Map();
export async function getUrl(name) {
  if (!signed.has(name)) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(name, 60 * 60 * 12);
    if (error) return undefined;
    signed.set(name, data.signedUrl);
  }
  return signed.get(name);
}

export async function clearAll() {
  throw new Error('საერთო ჟურნალის წაშლა გვერდიდან არ შეიძლება.');
}
