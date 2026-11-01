// Local storage in the browser (IndexedDB). Used when Supabase is not configured.

const DB_NAME = 'meka-journal';
const VERSION = 1;
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('messages', { keyPath: 'id' });
        db.createObjectStore('files'); // key: file name, value: Blob
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

const done = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

async function store(name, mode = 'readonly') {
  const db = await open();
  return db.transaction(name, mode).objectStore(name);
}

export async function allMessages() {
  return done((await store('messages')).getAll());
}

export async function messageIds() {
  return new Set(await done((await store('messages')).getAllKeys()));
}

export async function putMessages(list) {
  const db = await open();
  const tx = db.transaction('messages', 'readwrite');
  const s = tx.objectStore('messages');
  for (const m of list) s.put(m);
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export async function hasFile(name) {
  return (await done((await store('files')).count(name))) > 0;
}

export async function putFile(name, blob) {
  return done((await store('files', 'readwrite')).put(blob, name));
}

export async function getFile(name) {
  return done((await store('files')).get(name));
}

const objectUrls = new Map();
export async function getUrl(name) {
  if (!objectUrls.has(name)) {
    const b = await getFile(name);
    if (!b) return undefined;
    objectUrls.set(name, URL.createObjectURL(b));
  }
  return objectUrls.get(name);
}

export async function clearAll() {
  objectUrls.forEach((u) => URL.revokeObjectURL(u));
  objectUrls.clear();
  const db = await open();
  const tx = db.transaction(['messages', 'files'], 'readwrite');
  tx.objectStore('messages').clear();
  tx.objectStore('files').clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
