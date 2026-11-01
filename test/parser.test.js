import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChat, pickChatFile } from '../src/parser.js';

test('Android export: messages, multi-line text and photos', () => {
  const chat = [
    '01/11/2026, 08:02 - Messages and calls are end-to-end encrypted.',
    '01/11/2026, 08:15 - გიორგი: ქუთაისის გზა, დავიწყეთ ასფალტი',
    'მეორე ხაზი',
    '01/11/2026, 08:16 - გიორგი: IMG-20261101-WA0001.jpg (file attached)',
    '13/11/2026, 17:40 - ნინო: დღეს 6 კაცი ვიყავით',
  ].join('\n');
  const msgs = parseChat(chat, ['IMG-20261101-WA0001.jpg']);

  assert.equal(msgs.length, 4);
  assert.equal(msgs[0].system, true);
  assert.equal(msgs[1].author, 'გიორგი');
  assert.equal(msgs[1].text, 'ქუთაისის გზა, დავიწყეთ ასფალტი\nმეორე ხაზი');
  assert.equal(msgs[1].day, '2026-11-01');
  assert.equal(msgs[1].time, '08:15');
  assert.deepEqual(msgs[2].files, ['IMG-20261101-WA0001.jpg']);
  assert.equal(msgs[2].text, '');
  assert.equal(msgs[3].day, '2026-11-13');
});

test('iPhone export with invisible marks and seconds', () => {
  const chat = [
    '‎[01.11.26, 14:05:33] შპს მეკა: ‎Messages and calls are end-to-end encrypted.',
    '[01.11.26, 14:06:10] დავითი: ‎<attached: 00000012-PHOTO-2026-11-01-14-06-10.jpg>',
    '[01.11.26, 2:07:00 PM] დავითი: ბეტონი მოვიდა',
  ].join('\n');
  const msgs = parseChat(chat, ['00000012-PHOTO-2026-11-01-14-06-10.jpg']);

  assert.equal(msgs.length, 3);
  assert.deepEqual(msgs[1].files, ['00000012-PHOTO-2026-11-01-14-06-10.jpg']);
  assert.equal(msgs[1].text, '');
  assert.equal(msgs[2].time, '14:07:00');
  assert.equal(msgs[2].day, '2026-11-01');
});

test('month-first dates are detected', () => {
  const msgs = parseChat('11/13/26, 9:00 AM - Ana: hi\n11/14/26, 9:00 PM - Ana: bye');
  assert.equal(msgs[0].day, '2026-11-13');
  assert.equal(msgs[1].time, '21:00');
});

test('ids are stable across exports and repeats get their own id', () => {
  const a = '01/11/2026, 08:15 - გიორგი: კარგი\n01/11/2026, 08:15 - გიორგი: კარგი';
  const first = parseChat(a);
  const second = parseChat(a + '\n02/11/2026, 09:00 - გიორგი: ახალი');
  assert.notEqual(first[0].id, first[1].id);
  assert.equal(first[0].id, second[0].id);
  assert.equal(first[1].id, second[1].id);
});

test('pickChatFile prefers the WhatsApp chat file', () => {
  assert.equal(pickChatFile(['a.jpg', '_chat.txt']), '_chat.txt');
  assert.equal(pickChatFile(['notes.txt', 'WhatsApp Chat with X.txt']), 'WhatsApp Chat with X.txt');
  assert.equal(pickChatFile(['a.jpg']), null);
});
