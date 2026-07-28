// Boot smoke test: load index.html headlessly, fail on ANY console error,
// then click a profile and confirm the game starts. Run: node tools/smoke-test.mjs
import puppeteer from 'puppeteer';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GAME_URL = pathToFileURL(resolve(root, 'index.html')).href;

export async function launch(urlSuffix = '') {
  // --allow-file-access-from-files: game art loads via file:// in tests; without this,
  // drawImage() taints the canvas and getImageData() assertions throw SecurityError.
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  const errors = [];
  // Missing-asset load failures are EXPECTED: the game registers optional art files and
  // falls back to drawn shapes when they don't exist (index.html ~line 800). Only real
  // JS errors should fail the suite.
  page.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(GAME_URL + urlSuffix, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 1500)); // let sprite onerror fallbacks settle
  return { browser, page, errors };
}

// Only run the suite when invoked directly (iso-test.mjs imports launch from here).
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const fails = [];
  const check = (name, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) fails.push(name); };

  const { browser, page, errors } = await launch();
  check('boot: zero console errors', errors.length === 0);
  if (errors.length) console.log('  errors: ' + errors.join(' | '));

  await page.evaluate(() => selectProfile('adventurer'));
  await new Promise(r => setTimeout(r, 500));
  check('profile: game becomes active', await page.evaluate(() => gameActive === true));
  check('profile: no errors after start', errors.length === 0);

  await browser.close();
  if (fails.length) { console.error('SMOKE TEST FAILED: ' + fails.join(', ')); process.exit(1); }
  console.log('Smoke test passed.');
}
