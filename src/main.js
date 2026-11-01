import * as db from './db.js';
import { importExport, isImage } from './importer.js';
import { GROUP_NAME } from './config.js';
import {
  formatDay, shareText, canSharePhotos, sharePhotos, openWhatsAppText, openWhatsAppNumber,
} from './share.js';
import { downloadExcel } from './excel.js';
import { hasRemote, isDemo, supabase } from './supabase.js';
import { saveFile } from './save.js';

const $ = (id) => document.getElementById(id);
const DAYS_PER_PAGE = 15;

const state = { all: [], filtered: [], days: [], shown: DAYS_PER_PAGE };
const blobs = new Map(); // file name -> Blob (kept so sharing stays inside the tap)

$('group-name').textContent = GROUP_NAME;

// ---------- helpers ----------
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  node.append(...children.filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

let toastTimer;
function toast(text, isError = false) {
  const t = $('toast');
  t.textContent = text;
  t.classList.toggle('error', isError);
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), isError ? 7000 : 4000);
}

function busy(text) {
  $('busy').hidden = !text;
  if (text) $('busy-text').textContent = text;
}

async function loadBlob(name) {
  if (!blobs.has(name)) {
    const b = await db.getFile(name);
    if (b) blobs.set(name, b);
  }
  return blobs.get(name);
}

// Load photos only when they scroll into view.
const lazy = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      lazy.unobserve(e.target);
      db.getUrl(e.target.dataset.file).then((u) => u && (e.target.src = u));
    }
  },
  { rootMargin: '400px' },
);

function highlight(text, q) {
  if (!q) return [text];
  const out = [];
  const lower = text.toLowerCase();
  let i = 0;
  for (let j = lower.indexOf(q, i); j >= 0; j = lower.indexOf(q, i)) {
    out.push(text.slice(i, j), el('mark', {}, text.slice(j, j + q.length)));
    i = j + q.length;
  }
  out.push(text.slice(i));
  return out;
}

// ---------- data ----------
async function reload() {
  state.all = (await db.allMessages()).sort((a, b) =>
    a.day === b.day ? a.time.localeCompare(b.time) : a.day.localeCompare(b.day),
  );
  applyFilters();
}

function applyFilters() {
  const q = $('search').value.trim().toLowerCase();
  const from = $('from').value;
  const to = $('to').value;
  state.q = q;
  state.filtered = state.all.filter(
    (m) =>
      (!from || m.day >= from) &&
      (!to || m.day <= to) &&
      (!q || m.text.toLowerCase().includes(q) || m.author.toLowerCase().includes(q)),
  );
  const byDay = new Map();
  for (const m of state.filtered) {
    if (!byDay.has(m.day)) byDay.set(m.day, []);
    byDay.get(m.day).push(m);
  }
  state.days = [...byDay].sort((a, b) => b[0].localeCompare(a[0])); // newest day first
  render();
}

// ---------- render ----------
function render() {
  const has = state.all.length > 0;
  $('empty').hidden = has;
  $('tools').hidden = !has;

  const people = state.filtered.filter((m) => !m.system);
  const photoCount = people.reduce((n, m) => n + m.files.length, 0);
  $('count').textContent = has
    ? `${state.days.length} დღე · ${people.length} შეტყობინება · ${photoCount} ფაილი`
    : '';

  const journal = $('journal');
  journal.replaceChildren(...state.days.slice(0, state.shown).map(([day, msgs]) => renderDay(day, msgs)));
  if (has && !state.days.length) journal.append(el('p', { class: 'count' }, 'ამ ფილტრით არაფერი მოიძებნა.'));
  $('more-btn').hidden = state.days.length <= state.shown;
}

function renderDay(day, msgs) {
  const authors = new Set(msgs.filter((m) => !m.system).map((m) => m.author));
  const files = msgs.flatMap((m) => m.files.filter((f) => !m.missing?.includes(f)));
  const photos = files.filter(isImage);

  return el('article', { class: 'day' },
    el('header', { class: 'day-head' },
      el('h2', {}, formatDay(day),
        el('small', {}, `${msgs.length} შეტყობინება · ${photos.length} ფოტო · ${authors.size} ავტორი`)),
      el('div', { class: 'day-actions' },
        el('button', { class: 'btn btn-wa', type: 'button', onclick: () => shareDay(day, msgs, photos) },
          photos.length && canSharePhotos() ? 'WhatsApp: ფოტო + ტექსტი' : 'WhatsApp-ში გაგზავნა'),
        el('button', { class: 'btn', type: 'button', onclick: () => openWhatsAppNumber(shareText(day, msgs)) },
          '599 845 370-ზე'),
      ),
    ),
    ...msgs.map(renderMessage),
  );
}

function renderMessage(m) {
  if (m.system) {
    return el('div', { class: 'msg system' }, el('time', {}, m.time.slice(0, 5)), el('p', {}, m.text));
  }
  const present = m.files.filter((f) => !m.missing?.includes(f));
  const photos = present.filter(isImage);
  const other = present.filter((f) => !isImage(f));

  return el('div', { class: 'msg' },
    el('time', {}, m.time.slice(0, 5)),
    el('div', {},
      el('p', { class: 'author' }, ...highlight(m.author, state.q)),
      m.text && el('p', { class: 'text' }, ...highlight(m.text, state.q)),
      photos.length > 0 && el('div', { class: 'photos' }, ...photos.map((f) => {
        const img = el('img', { alt: `ფოტო: ${m.author}, ${m.time.slice(0, 5)}`, 'data-file': f });
        lazy.observe(img);
        return el('button', { class: 'photo', type: 'button', onclick: () => openViewer(f) }, img);
      })),
      ...other.map((f) => el('button', { class: 'file-chip', type: 'button', onclick: () => downloadFile(f) }, `ფაილი: ${f}`)),
      ...(m.missing || []).map((f) => el('span', { class: 'file-chip' }, `${f} — ექსპორტში არ იყო`)),
    ),
  );
}

// ---------- actions ----------
async function shareDay(day, msgs, photos) {
  const text = shareText(day, msgs);
  if (!photos.length || !canSharePhotos()) return openWhatsAppText(text);

  const ready = new Map();
  for (const f of photos) {
    const b = await loadBlob(f);
    if (b) ready.set(f, b);
  }
  try {
    const result = await sharePhotos(text, ready);
    if (result === 'retry') toast('ფოტოები მზადაა — დააჭირე ღილაკს კიდევ ერთხელ.');
    if (result === 'unsupported') openWhatsAppText(text);
  } catch (e) {
    toast('გაზიარება ვერ მოხერხდა: ' + e.message, true);
  }
}

async function downloadFile(name) {
  busy('ფაილს ვტვირთავ…');
  const b = await loadBlob(name).finally(() => busy(null));
  if (!b) return toast('ფაილი ვერ მოიძებნა.', true);
  try {
    if ((await saveFile(name, b)) === 'saved') toast('ფაილი შენახულია.');
  } catch (e) {
    toast(e.message, true);
  }
}

let viewerFile = null;
async function openViewer(name) {
  viewerFile = name;
  $('viewer-img').src = (await db.getUrl(name)) || '';
  $('viewer-name').textContent = name;
  $('viewer-share').hidden = !canSharePhotos();
  $('viewer').showModal();
  // Full file in the background, so share works in one tap.
  loadBlob(name);
}
$('viewer-download').addEventListener('click', () => viewerFile && downloadFile(viewerFile));
$('viewer-close').addEventListener('click', () => $('viewer').close());
$('viewer').addEventListener('click', (e) => e.target === $('viewer') && $('viewer').close());
$('viewer-share').addEventListener('click', async () => {
  const b = blobs.get(viewerFile);
  if (!b) return;
  try {
    await sharePhotos('', new Map([[viewerFile, b]]));
  } catch (e) {
    toast('გაზიარება ვერ მოხერხდა: ' + e.message, true);
  }
});

$('file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) importFile(file);
});

$('sample-btn').addEventListener('click', async () => {
  busy('მაგალითს ვტვირთავ…');
  try {
    let blob;
    if (window.__SAMPLE_ZIP__) {
      // Single-file test page: the sample is embedded as base64.
      blob = new Blob([Uint8Array.from(atob(window.__SAMPLE_ZIP__), (c) => c.charCodeAt(0))]);
    } else {
      const res = await fetch('sample-export.zip');
      if (!res.ok) throw new Error('მაგალითის ფაილი ვერ მოიძებნა.');
      blob = await res.blob();
    }
    await importFile(new File([blob], 'sample-export.zip', { type: 'application/zip' }));
  } catch (e) {
    busy(null);
    toast(e.message, true);
  }
});

async function importFile(file) {
  busy('ფაილს ვამოწმებ…');
  try {
    const r = await importExport(file, busy);
    await reload();
    toast(
      r.added
        ? `დაემატა ${r.added} ახალი შეტყობინება და ${r.files} ფაილი. (სულ ექსპორტში: ${r.total})`
        : `ახალი არაფერია — ექსპორტის ${r.total} შეტყობინება უკვე ჟურნალშია.`,
    );
  } catch (err) {
    console.error(err);
    toast(err.message || 'ატვირთვა ვერ მოხერხდა.', true);
  } finally {
    busy(null);
  }
}

for (const id of ['search', 'from', 'to']) {
  $(id).addEventListener('input', () => {
    state.shown = DAYS_PER_PAGE;
    applyFilters();
  });
}

$('more-btn').addEventListener('click', () => {
  state.shown += DAYS_PER_PAGE;
  render();
});

$('excel-btn').addEventListener('click', async () => {
  if (!state.filtered.length) return toast('ჩამოსატვირთი არაფერია.');
  const days = state.days.map(([d]) => d);
  const label = days.length > 1 ? `${days.at(-1)}_${days[0]}` : days[0];
  busy('Excel ფაილს ვამზადებ…');
  try {
    const result = await downloadExcel(state.filtered, label, () => {
      busy(null);
      toast('დაადასტურე შენახვა გამოჩენილ ფანჯარაში.');
    });
    toast(result === 'saved' ? 'Excel ფაილი შენახულია.' : 'შენახვა გაუქმდა.');
  } catch (e) {
    toast(e.message, true);
  } finally {
    busy(null);
  }
});

// Delete needs two taps so it can't happen by accident.
let clearArmed = false;
$('clear-btn').addEventListener('click', async () => {
  if (!clearArmed) {
    clearArmed = true;
    $('clear-btn').textContent = 'დარწმუნებული ხარ? დააჭირე კიდევ ერთხელ';
    setTimeout(() => {
      clearArmed = false;
      $('clear-btn').textContent = 'ყველაფრის წაშლა';
    }, 5000);
    return;
  }
  await db.clearAll();
  blobs.clear();
  clearArmed = false;
  $('clear-btn').textContent = 'ყველაფრის წაშლა';
  await reload();
  toast('ჟურნალი წაიშალა ამ მოწყობილობიდან.');
});

// ---------- login ----------
function showApp() {
  $('login').hidden = true;
  $('app').hidden = false;
  $('top-actions').hidden = false;
  $('logout-btn').hidden = !hasRemote;
  $('demo-banner').hidden = !isDemo;
  if (hasRemote) {
    $('storage-note').textContent = 'ჟურნალი ინახება კომპანიის საერთო სივრცეში — ყველა შესულს ერთნაირად უჩანს.';
    $('clear-btn').hidden = true;
  }
  reload().catch((e) => toast('ჟურნალი ვერ ჩაიტვირთა: ' + e.message, true));
}

function showLogin() {
  $('app').hidden = true;
  $('top-actions').hidden = true;
  $('login').hidden = false;
  $('email').focus();
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('login-error').hidden = true;
  $('login-btn').disabled = true;
  const { error } = await supabase.auth.signInWithPassword({
    email: $('email').value.trim(),
    password: $('password').value,
  });
  $('login-btn').disabled = false;
  if (error) {
    $('login-error').textContent = /invalid/i.test(error.message)
      ? 'ელფოსტა ან პაროლი არასწორია.'
      : 'შესვლა ვერ მოხერხდა: ' + error.message;
    $('login-error').hidden = false;
    return;
  }
  $('password').value = '';
  showApp();
});

$('logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  location.reload();
});

if (hasRemote) {
  supabase.auth.getSession().then(({ data }) => (data.session ? showApp() : showLogin()));
} else {
  showApp();
}
