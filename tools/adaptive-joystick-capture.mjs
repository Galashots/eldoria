// Captures for the adaptive joystick. Run: node tools/adaptive-joystick-capture.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './smoke-test.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'docs/playtest/hotfix-input-feel');
await mkdir(outDir, { recursive: true });
const { browser, page, errors } = await launch('?iso=1', { tolerateNavigationTimeout: true, navigationTimeout: 2000 });
await page.setViewport({ width: 1194, height: 834, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.evaluate(() => selectProfile('adventurer'));
async function captureJoystick(name, fractionX, fractionY) {
  await page.evaluate((fx, fy) => {
    joystickReset();
    var zone = document.getElementById('joystickZone').getBoundingClientRect(), x = zone.left + zone.width * fx, y = zone.top + zone.height * fy;
    document.getElementById('joystickZone').dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, pointerId: 700 + Math.round(fx * 10 + fy * 10), pointerType: 'touch', clientX: x, clientY: y
    }));
  }, fractionX, fractionY);
  await page.screenshot({ path: resolve(outDir, name), fullPage: false });
}
await captureJoystick('joystick-lower-inner.png', 0.33, 0.70);
await captureJoystick('joystick-upper-inner.png', 0.33, 0.20);
await captureJoystick('joystick-edge-clamp.png', 0.02, 0.98);
const state = await page.evaluate(() => ({
  viewport: { width: innerWidth, height: innerHeight, scale: window.visualViewport ? window.visualViewport.scale : 1 },
  joystickZone: joystickZoneGeometry(innerWidth, innerHeight), deadzone: JOYSTICK_DEAD
}));
await writeFile(resolve(outDir, 'joystick-evidence.json'), JSON.stringify({
  capture: 'iPad reference viewport 1194x834 CSS px, DPR 2', state, consoleErrors: errors
}, null, 2) + '\n');
await browser.close();
if (errors.length) { console.error('Capture completed with console errors: ' + errors.join(' | ')); process.exit(1); }
console.log('Wrote adaptive joystick evidence to ' + outDir);
