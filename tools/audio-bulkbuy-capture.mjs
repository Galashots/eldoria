// Visual evidence for ELD-PT-011 / 011a. Captures the sound panel and the bulk-buy
// shop at desktop, iPad landscape and phone portrait.
// Run: node tools/audio-bulkbuy-capture.mjs
import { launch } from './smoke-test.mjs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const dir = fileURLToPath(new URL('../docs/playtest/2026-08-05-audio-bulkbuy/', import.meta.url));
await mkdir(dir, { recursive: true });

const shots = [
  { name: 'sound-settings-desktop', width: 1363, height: 936, open: 'sound' },
  { name: 'sound-settings-ipad-landscape', width: 1180, height: 820, open: 'sound' },
  { name: 'sound-settings-phone-portrait', width: 390, height: 780, open: 'sound' },
  { name: 'bulk-buy-desktop', width: 1363, height: 936, open: 'shop' },
  { name: 'bulk-buy-ipad-landscape', width: 1180, height: 820, open: 'shop' },
  { name: 'bulk-buy-phone-portrait', width: 390, height: 780, open: 'shop' },
  { name: 'bulk-buy-partial-warning', width: 1180, height: 820, open: 'shop-partial' }
];

for (const shot of shots) {
  const { browser, page } = await launch();
  await page.setViewport({ width: shot.width, height: shot.height, deviceScaleFactor: 2 });
  await page.evaluate(mode => {
    selectProfile('adventurer');
    if (mode === 'sound') { openSoundSettings(); return; }
    player.gold = mode === 'shop-partial' ? 7 : 200;
    openShop();
    setSeedBuyQuantity(mode === 'shop-partial' ? 20 : 10);
    updateHUD();
  }, shot.open);
  await page.screenshot({ path: join(dir, shot.name + '.png') });
  console.log('captured ' + shot.name);
  await browser.close();
}
