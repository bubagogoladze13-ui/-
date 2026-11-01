// Turns the demo build into one HTML file (styles and script inside)
// so it can be published as a single test page.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist-demo';
const html = readFileSync(join(dir, 'index.html'), 'utf8');

const cssHref = html.match(/<link rel="stylesheet"[^>]*href="\.?\/?(assets\/[^"]+\.css)"[^>]*>/)?.[1];
const jsSrc = html.match(/<script type="module"[^>]*src="\.?\/?(assets\/[^"]+\.js)"[^>]*><\/script>/)?.[1];
if (!cssHref || !jsSrc) throw new Error('Could not find built css/js in dist-demo/index.html');

const css = readFileSync(join(dir, cssHref), 'utf8');
const js = readFileSync(join(dir, jsSrc), 'utf8').replace(/<\/script/gi, '<\\/script')
  .replace(/�/g, '\\uFFFD'); // literal replacement chars in libraries -> escape (same meaning in JS strings)

const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const fonts = [...html.matchAll(/<link rel="(?:preconnect|stylesheet)" href="https:\/\/fonts[^>]*>/g)].map((m) => m[0]);
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '');

const sample = existsSync('samples/sample-export.zip')
  ? `<script>window.__SAMPLE_ZIP__="${readFileSync('samples/sample-export.zip').toString('base64')}";</script>`
  : '';

const out = [
  title,
  '<meta name="claude:viewport-fit-sides" content="cover">',
  ...fonts,
  `<style>${css}</style>`,
  body.trim(),
  sample,
  `<script type="module">${js}</script>`,
].join('\n');

writeFileSync(join(dir, 'meka-demo.html'), out);
console.log(`Wrote ${dir}/meka-demo.html (${(out.length / 1024).toFixed(0)} KB)`);
