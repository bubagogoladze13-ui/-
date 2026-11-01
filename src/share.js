// Sending a journal day or message to WhatsApp.
import { COMPANY, WHATSAPP_NUMBER } from './config.js';
import { mimeOf } from './importer.js';
import { openLink } from './save.js';

export function formatDay(day) {
  const [y, m, d] = day.split('-');
  return `${d}.${m}.${y}`;
}

export function shareText(day, messages) {
  const lines = messages
    .filter((m) => !m.system)
    .map((m) => {
      const body = m.text || (m.files.length ? `[ფოტო: ${m.files.length}]` : '');
      return `${m.time.slice(0, 5)} ${m.author}: ${body}`;
    });
  return `${COMPANY} — ${formatDay(day)}\n\n${lines.join('\n')}`;
}

/** True when this device can send photos through the share sheet. */
export function canSharePhotos() {
  try {
    const probe = new File([new Blob(['x'], { type: 'image/jpeg' })], 'x.jpg', { type: 'image/jpeg' });
    return !!navigator.canShare && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/**
 * Opens the phone's share sheet with photos + text.
 * blobs: Map(name -> Blob) already loaded, so the call stays inside the tap.
 * Returns 'shared' | 'cancelled' | 'retry' | 'unsupported'.
 */
export async function sharePhotos(text, blobs) {
  const files = [...blobs].map(([name, b]) => new File([b], name, { type: b.type || mimeOf(name) }));
  if (!files.length || !navigator.canShare?.({ files, text })) return 'unsupported';
  try {
    await navigator.share({ files, text });
    return 'shared';
  } catch (e) {
    if (e.name === 'AbortError') return 'cancelled';
    if (e.name === 'NotAllowedError') return 'retry';
    throw e;
  }
}

/** Text-only fallback: WhatsApp opens and you pick the chat. */
export function openWhatsAppText(text) {
  openLink(`https://wa.me/?text=${encodeURIComponent(text)}`);
}

/** Text-only, straight to the company number. */
export function openWhatsAppNumber(text) {
  openLink(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`);
}
