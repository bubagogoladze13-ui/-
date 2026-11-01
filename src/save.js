// Saving a file to the viewer's device.
// Inside a claude.ai page the browser blocks normal downloads, so we ask the
// page host to save it; everywhere else a normal download link is used.
let downloadsPromise;
function hostDownloads() {
  if (!window.claude?.use) return Promise.resolve(null);
  downloadsPromise ??= Promise.resolve(window.claude.use('downloads')).catch(() => null);
  return downloadsPromise;
}

const framed = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const MESSAGES = {
  rate_limited: 'შენახვის ფანჯარა უკვე ღიაა — დაადასტურე ან დახურე და სცადე თავიდან.',
  rejected_extension: 'ამ ტიპის ფაილის შენახვა აქ არ შეიძლება.',
  extension_not_enabled: 'ამ ტიპის ფაილის შენახვა ამ ხედში გამორთულია.',
  too_large: 'ფაილი ძალიან დიდია ამ ხედისთვის.',
};
const BLOCKED = 'ამ ხედში ფაილის შენახვა დაბლოკილია. გახსენი გვერდი ცალკე ჩანართში (claude.ai) და სცადე თავიდან.';

/**
 * Returns 'saved' or 'declined'; throws an Error with a Georgian message otherwise.
 * onPrompt is called right before the host shows its confirmation.
 */
export async function saveFile(filename, blob, onPrompt = () => {}) {
  const host = await hostDownloads();
  if (host) {
    onPrompt();
    try {
      await host.save({ filename, data: blob });
      return 'saved';
    } catch (e) {
      if (e?.code === 'declined') return 'declined';
      throw new Error(MESSAGES[e?.code] || BLOCKED);
    }
  }
  // Embedded without a save helper: a download link would silently do nothing.
  if (framed && window.claude) throw new Error(BLOCKED);

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return 'saved';
}

/** Open a web link in a new tab (works inside embedded pages too). */
export function openLink(url) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
}
