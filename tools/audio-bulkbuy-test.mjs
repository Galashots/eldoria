// Regression tests for ELD-PT-011 (audio channels, say-it-again, TTS allow-list) and
// ELD-PT-011a (bulk buy). Each suite asserts the owner's recorded acceptance criteria,
// so a failure here names the exact requirement that regressed.
// Run: node tools/audio-bulkbuy-test.mjs
import { launch } from './smoke-test.mjs';

const fails = [];
const check = (name, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) fails.push(name); };

// --- ELD-PT-011: three independent, per-profile audio levels ---
{
  const { browser, page, errors } = await launch();
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    setAudioLevel('music', 0.1);
    setAudioLevel('speech', 0.5);
    setAudioLevel('effects', 0);
    const adventurer = JSON.parse(JSON.stringify(audioLevels));
    const musicApplied = bgMusic.volume;

    // A second profile must not inherit the first child's levels.
    switchProfile();
    selectProfile('mage');
    const mageDefaults = JSON.parse(JSON.stringify(audioLevels));
    setAudioLevel('speech', 1);

    // ...and going back must restore them.
    switchProfile();
    selectProfile('adventurer');
    const restored = JSON.parse(JSON.stringify(audioLevels));

    // Out-of-range and junk values must clamp rather than silence the game oddly.
    setAudioLevel('music', 5);
    const clampedHigh = audioLevels.music;
    setAudioLevel('music', -3);
    const clampedLow = audioLevels.music;
    setAudioLevel('music', 'banana');
    const clampedJunk = audioLevels.music;
    return { adventurer, musicApplied, mageDefaults, restored, clampedHigh, clampedLow, clampedJunk };
  });

  check('011: three independent channels are settable',
    r.adventurer.music === 0.1 && r.adventurer.speech === 0.5 && r.adventurer.effects === 0);
  check('011: music level reaches the audio element', r.musicApplied === 0.1);
  check('011: a second profile starts at defaults, not the first profile\'s levels',
    r.mageDefaults.music === 0.35 && r.mageDefaults.speech === 1);
  check('011: returning to a profile restores that profile\'s levels',
    r.restored.music === 0.1 && r.restored.speech === 0.5 && r.restored.effects === 0);
  check('011: levels clamp to 0..1 and reject junk',
    r.clampedHigh === 1 && r.clampedLow === 0 && r.clampedJunk === 0.35);
  check('011: no console errors', errors.length === 0);
  await browser.close();
}

// --- ELD-PT-011: routine actions are never spoken, at any tap rate ---
{
  const { browser, page, errors } = await launch();
  const r = await page.evaluate(() => {
    // The early-reader profile is the one that speaks at all.
    selectProfile('mage');
    const spoken = [];
    window.speechSynthesis.speak = u => spoken.push(u.text);

    player.gold = 1000;
    // Mash every routine action the tracker calls out.
    for (let i = 0; i < 25; i++) buySeeds('turnip', 1);
    player.crops.turnip = 5;
    sellCrops();
    const routineSpeech = spoken.length;

    // An instruction still speaks — the allow-list must not silence teaching content.
    speak('What is two plus two?');
    const afterInstruction = spoken.length;
    return { routineSpeech, afterInstruction, lastInstruction: lastSpokenInstruction };
  });

  check('011: zero speech from 25 rapid purchases and a crop sale', r.routineSpeech === 0);
  check('011: instructional speech still works', r.afterInstruction === 1);
  check('011: the last instruction is remembered for replay',
    r.lastInstruction === 'What is two plus two?');
  check('011: no console errors', errors.length === 0);
  await browser.close();
}

// --- ELD-PT-011: say-it-again repeats the instruction and shows it ---
{
  const { browser, page, errors } = await launch();
  const r = await page.evaluate(() => {
    selectProfile('mage');
    const spoken = [];
    window.speechSynthesis.speak = u => spoken.push(u.text);

    const hiddenBefore = document.getElementById('sayAgainBtn').hidden;
    speak('Plant a turnip seed in the soil.');
    const hiddenAfter = document.getElementById('sayAgainBtn').hidden;
    const countAfterInstruction = spoken.length;

    sayItAgain();
    const repeated = spoken[spoken.length - 1];

    // With the voice off, the button must still put the words on screen.
    setAudioLevel('speech', 0);
    const spokenBeforeSilent = spoken.length;
    sayItAgain();
    return {
      hiddenBefore, hiddenAfter, countAfterInstruction, repeated,
      silentAddedSpeech: spoken.length - spokenBeforeSilent,
      toastText: (document.getElementById('toast') || {}).textContent || ''
    };
  });

  check('011: say-it-again is hidden until there is something to repeat',
    r.hiddenBefore === true && r.hiddenAfter === false);
  check('011: say-it-again repeats the last instruction',
    r.repeated === 'Plant a turnip seed in the soil.');
  check('011: with speech at zero the button speaks nothing', r.silentAddedSpeech === 0);
  check('011: the instruction is visible on screen as text',
    r.toastText.indexOf('Plant a turnip seed') !== -1);
  check('011: no console errors', errors.length === 0);
  await browser.close();
}

// --- Owner ruling (2026-08-05): mute silences music/effects but NOT the reading
// voice. Pinned as a test so it cannot be "tidied up" by a later change. ---
{
  const { browser, page, errors } = await launch();
  const r = await page.evaluate(() => {
    selectProfile('mage');
    const spoken = [];
    window.speechSynthesis.speak = u => spoken.push(u.text);
    if (!gameMuted) toggleMute();
    speak('Read this even though the game is muted.');
    const speechWhileMuted = spoken.length;
    const musicPaused = bgMusic.paused;
    // Turning speech off stays a separate, deliberate act.
    setAudioLevel('speech', 0);
    speak('This must not be spoken.');
    return { speechWhileMuted, musicPaused, afterSpeechZero: spoken.length };
  });

  check('011: mute does NOT silence the reading voice (owner ruling)', r.speechWhileMuted === 1);
  check('011: mute still stops the music', r.musicPaused === true);
  check('011: reading voice at 0% is how speech is turned off', r.afterSpeechZero === 1);
  check('011: no console errors', errors.length === 0);
  await browser.close();
}

// --- ELD-PT-011a: bulk buy, and the honest partial purchase ---
{
  const { browser, page, errors } = await launch();
  const r = await page.evaluate(() => {
    selectProfile('adventurer');
    const quantities = SEED_BUY_QUANTITIES.slice();

    // Exact buy: 10 turnips at 2g.
    player.gold = 100;
    player.seeds.turnip = 0;
    setSeedBuyQuantity(10);
    buySeeds('turnip');
    const exact = { seeds: player.seeds.turnip, gold: player.gold };

    // Partial buy: asks for 20 (40g) holding only 7g -> 3 seeds, 1g left, and it says so.
    player.gold = 7;
    player.seeds.turnip = 0;
    setSeedBuyQuantity(20);
    buySeeds('turnip');
    const partial = {
      seeds: player.seeds.turnip,
      gold: player.gold,
      toast: (document.getElementById('toast') || {}).textContent || ''
    };

    // Cannot afford even one: nothing is charged and nothing is granted.
    player.gold = 1;
    player.seeds.turnip = 0;
    buySeeds('turnip');
    const none = {
      seeds: player.seeds.turnip, gold: player.gold,
      toast: (document.getElementById('toast') || {}).textContent || ''
    };
    return { quantities, exact, partial, none };
  });

  check('011a: quantities are 1/5/10/15/20',
    JSON.stringify(r.quantities) === JSON.stringify([1, 5, 10, 15, 20]));
  check('011a: buying 10 grants 10 and charges 20g',
    r.exact.seeds === 10 && r.exact.gold === 80);
  check('011a: asking for more than gold covers buys what gold covers',
    r.partial.seeds === 3 && r.partial.gold === 1);
  check('011a: the shown count equals the count actually bought',
    r.partial.toast.indexOf('Bought 3 ') !== -1);
  check('011a: a partial purchase says so honestly',
    /all your gold could buy/i.test(r.partial.toast));
  check('011a: unaffordable purchase charges nothing and grants nothing',
    r.none.seeds === 0 && r.none.gold === 1);
  check('011a: unaffordable purchase explains the price', /need 2g/i.test(r.none.toast));
  check('011a: no console errors', errors.length === 0);
  await browser.close();
}

console.log(fails.length ? `\n${fails.length} FAILED:\n  ` + fails.join('\n  ') : '\nAll audio/bulk-buy tests passed.');
process.exit(fails.length ? 1 : 0);
