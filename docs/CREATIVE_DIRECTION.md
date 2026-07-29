# Realm of Eldoria — Creative Direction, Story, Quest, and Content Framework

**Status:** Owner-approved creative direction  
**Approved:** 2026-07-29  
**Repository:** `Galashots/eldoria`  
**Applies to:** the current single-file isometric relaunch  
**Scope:** product fantasy, lore, characters, campaign, quests, learning integration, Squishy Dumplings, and content-driven asset priorities  
**Does not change:** runtime code, saves, economy values, current profile IDs, current quests, asset targets, or the approved Visual North Star

## 1. Purpose and authority

Eldoria already contains a complete mechanical spine:

- one self-contained `index.html`;
- Farm, Town, Wilds, Deep Woods, and Mine;
- farming, trade, cooking, combat, equipment, XP, quests, friendships, and saves;
- an older-reader `adventurer` profile and early-reader `mage` profile;
- Mira, Bram, Gunnar, and the Dumpling Vendor;
- eighteen Squishy Dumplings with earned-gold pulls, visible pity, duplicate dough, and collection persistence;
- a Shadow Warden and Crystal Wyrm;
- an approved 2:1 isometric conversion and Visual North Star;
- an active PixelLab plus deterministic-post-processing pipeline proposal.

The missing layer is not another collection of mechanics. It is a strong reason those mechanics belong to one world and one adventure.

This document supplies that connective tissue. It reconciles the supplied educational-RPG research and proposed Story, Lore & Quest framework with the game that actually exists in `Galashots/eldoria`.

When this document conflicts with current runtime facts, the runtime remains authoritative until a separately approved implementation changes it.

## 2. Decision language

| Label | Meaning |
| --- | --- |
| **Existing** | Already present in the current repository or approved direction. Preserve unless separately changed. |
| **Recommended** | The Creative Director's preferred direction for owner approval. |
| **Provisional** | Useful working material that may be refined before implementation. |
| **Open decision** | Requires Leo's explicit choice because it affects identity, product direction, or existing continuity. |

## 3. North Star alignment

**Aligned.**

The framework reinforces the approved Visual North Star:

- strict, spacious 2:1 isometric environments;
- premium crisp pixel art with HD-2D depth;
- a rewarding farm-to-cook-to-sell-to-collect loop;
- an older Ranger and younger Mage as a complementary brotherly duo;
- exploration hooks visible beyond the current activity;
- child-friendly fantasy that feels sleek and adventurous rather than preschool-like;
- direct interaction with people, crops, enemies, and objects;
- touch-first clarity.

No North Star refresh is recommended. This framework explains the story inside the current image rather than proposing a different visible game.

## 4. Creative north star

**Realm of Eldoria is a cozy, capable fantasy adventure about two brothers learning to hear the living song beneath their valley—and becoming strong enough to keep that song from disappearing.**

It should feel:

- comforting enough to revisit;
- mysterious enough to discuss after play;
- slightly badass when the heroes enter dangerous territory;
- funny without making the world feel disposable;
- emotionally warm without becoming sugary;
- educational because understanding creates power, profit, and better choices.

### Five creative pillars

1. **The world remembers what the player does.** Farms flourish, stalls improve, residents react, routes change, and trophies remain visible.
2. **Two equal forms of competence.** The Ranger reads evidence and prepares; the Mage hears patterns and shapes magic.
3. **Every system tells the same story.** Crops, trade, cooking, combat, crafting, Dumplings, and exploration all participate in restoring Eldoria.
4. **Learning is leverage.** It improves attacks, profits, recipes, clues, and rewards without becoming permission to play.
5. **Collection creates affection.** Dumplings and equipment should recall memorable adventures, not exist only as percentages.

## 5. The central mystery

### The Rootsong and the Fading

**Recommended**

Beneath Eldoria runs the **Rootsong**, an ancient living current carried through roots, soil, water, crystal, forge-fire, food, memory, and promises kept between people.

The Rootsong is not a fuel that belongs to a king. It becomes strong when the valley's parts answer one another:

- farmers care for the land;
- merchants trade fairly;
- smiths build for a purpose;
- cooks turn harvests into comfort;
- people keep promises;
- wild creatures have room to belong;
- old knowledge is shared rather than hoarded.

The valley is suffering a slow **Fading**. Nothing is collapsing overnight. Instead:

- some crops need more coaxing;
- paths feel strangely quiet;
- creatures become territorial or cranky;
- old crystals lose their glow;
- forge-fire sputters;
- songs and stories are remembered with pieces missing.

At the same time, small parts of the Rootsong are waking unpredictably. The Fading and the waking are the same event viewed from opposite sides: the Rootsong is trying to reconnect, but its paths through Eldoria have been broken.

### The Heartroot

At the deepest point of the Mine lies the **Heartroot**, where ancient roots and living crystal meet. The Crystal Wyrm protects it.

The Heartroot is not a magic battery. It is the oldest place where the valley listens to itself. Restoring it requires evidence from every earlier zone:

- a living note from the Farm;
- a promise kept in Town;
- a wild note from the forest;
- the truth guarded by the Shadow Warden;
- a final act of accord at the Crystal Wyrm's chamber.

### The Accord Keepers

Long ago, people called **Accord Keepers** learned to recognize breaks in the Rootsong. They did not control nature. They helped communities, creatures, and places answer one another again.

Their order failed when some Keepers tried to preserve one perfect answer instead of teaching each generation how to listen. The Shadow Warden is the last guardian of that failed system. It is formidable, but not mindlessly evil.

### Mystery ladder

| Scale | Question | Answer timing |
| --- | --- | --- |
| Personal | Why do the Ranger and Mage hear the valley differently? | Act I |
| Local | Why are Farm, Town, and Wilds problems appearing together? | Act II |
| Historical | Why did the Accord Keepers silence part of the Rootsong? | Act III |
| Valley-wide | Can Eldoria restore harmony without forcing every place to become the same? | Act IV |

## 6. The heroic brothers

### Shared continuity

The North Star establishes the heroes as brothers. The current game lets the child select and rename one profile.

Therefore:

- both brothers are canon;
- the selected brother is the active hero for ordinary play;
- the other brother may be referenced through letters, portraits, brief dialogue, or later support appearances;
- no required quest assumes both are physically present until the runtime supports it;
- fixed personal names are not required because the profiles are renameable.

### Older brother — Ranger

**Existing internal identity:** `adventurer`  
**Recommended player-facing identity:** Ranger

**Fantasy promise:** “The world leaves evidence. I can read it, plan for it, and act precisely.”

The Ranger:

- tracks creatures and compares signs;
- reads maps, prices, routes, weather, and material clues;
- uses archery, fieldcraft, equipment, and preparation;
- receives richer dialogue and optional lore;
- can handle multiplication, estimation, ratios, multi-step reasoning, and evidence synthesis;
- looks capable before earning high-tier equipment.

The Ranger is not the “real” hero while the Mage receives a simplified version. His expertise solves some problems naturally and fails where magical listening is required.

### Younger brother — Mage

**Existing internal identity:** `mage`  
**Player-facing identity:** Mage

**Fantasy promise:** “The world is alive. I can hear its patterns and help it answer.”

The Mage:

- senses sound, light, growth, mood, and elemental rhythm;
- uses immediate, expressive magic;
- receives short text, large targets, and read-aloud guidance;
- solves through counting, matching, sequencing, concrete comparison, and compassionate choices;
- is curious, brave, and battle-capable.

The Mage is not a baby-mode hero. His insight is a different kind of expertise.

### Profile-expression standard

| Shared story need | Ranger expression | Mage expression |
| --- | --- | --- |
| Find a route | Compare tracks, landmarks, and distance | Hear a repeated note and follow visible pulses |
| Repair something | Estimate materials and choose a plan | Sequence pieces by shape, sound, or pattern |
| Calm a creature | Identify the physical cause of distress | Match its emotional or elemental rhythm |
| Understand a relic | Assemble evidence and historical context | Experience a short sensory memory |
| Improve a trade | Compare value and calculate a fair exchange | Count concrete goods and match sets |
| Win a fight | Tactical shot, preparation, and estimation | Spell pattern, elemental timing, and direct feedback |

## 7. The first cast

### Mira — Town steward and quest captain

**Existing runtime role:** quest giver  
**Recommended fiction:** Mira coordinates Town requests, market-day deliveries, and help between residents.

Mira is warm, capable, and slightly mischievous. She notices whether the heroes follow through. Her practical apron, produce basket, and travel-ready clothes still fit: she works throughout the market rather than remaining behind one counter.

Her motif is: **small work changes a whole town.**

Sample voice:

- “A heroic entrance is lovely. A delivered basket is useful.”
- “The Wilds aren't angry for no reason. Find the reason, then decide what needs thumping.”
- “You kept your word. Towns are mostly made of people doing that.”

### Bram — General Store keeper

**Existing runtime role:** shopkeeper

Bram loves a fair bargain and treats arithmetic as adventuring equipment. He should never sound like a worksheet narrator. He talks about stock, risk, timing, and what people actually need.

Sample voice:

- “Seeds are cheap. Patience is expensive.”
- “Best price isn't always best value. Show me what you noticed.”
- “A shop is a map of what a town worries about.”

### Gunnar — Smith and material historian

**Existing runtime role:** smith/quest interaction

Gunnar is blunt, observant, and deeply respectful of well-used tools. He recognizes old Accord marks in metalwork before he admits it.

Sample voice:

- “Strong isn't the same as heavy.”
- “That crack has a direction. Everything that breaks tells you how.”
- “The old smiths tuned steel to the Rootsong. I thought that was just forge-talk.”

### Auntie Momo — Squishy Stall keeper

**Canonical name — decided 2026-07-29, see §21**

Momo treats each Dumpling as a visitor with a personality, not merchandise. She understands the collection system's odds, pity, and dough exchange and explains them plainly.

Sample voice:

- “Gold opens the steamer. Kindness convinces a Dumpling to stay.”
- “A duplicate isn't nothing. It remembered you—and left dough for the next welcome.”
- “The rarest Dumpling is the one you would miss when the shelf is quiet.”

### The Shadow Warden

The Warden is an ancient Accord guardian still carrying out an obsolete command: keep the deepest note silent until Eldoria proves it can listen without trying to control it.

It challenges the heroes because the old order failed, not because darkness is inherently evil.

### The Crystal Wyrm

The Wyrm is the Heartroot's living guardian. Its crystals have dulled during the Fading, leaving it exhausted, defensive, and dangerous.

The final confrontation may still be an exciting boss battle. The story meaning is restoration and recognition rather than killing a wicked beast.

## 8. World roles

### Farm — home, responsibility, and visible abundance

The Farm is:

- the safest place;
- the strongest farming/cooking loop;
- the emotional home base;
- the first place the Rootsong can be felt;
- where collected Dumplings should eventually appear or be showcased;
- where visible restoration matters most.

Landmark needs:

- farmhouse or home anchor;
- crop field;
- cooking place;
- pond or water edge;
- one magical Rootsong sign;
- one clear Town route.

### Town — relationships, trade, and promises

Town is:

- Mira's coordination space;
- Bram's General Store;
- Gunnar's Forge;
- Auntie Momo's Squishy Stall;
- the place where completed quests change dialogue, displays, services, and decorations.

The current Town conversion should continue General Store and Mira first, then Forge, Squishy Stall, plaza landmark, and remaining resident identities.

### Wilds — first adventure and readable danger

The Wilds introduces Slimes, Bats, and Goblins. It should feel exciting rather than grim:

- wide trails;
- visible safe clearings;
- creature habitats;
- stolen or scattered Farm goods;
- evidence of the Rootsong moving incorrectly;
- one optional Ranger trail and one optional Mage resonance.

### Deep Woods — consequence and guarded history

The Deep Woods introduces Wolves, Bears, Trolls, and the Shadow Warden.

It should feel older, denser, and more deliberate than the Wilds. The player is no longer merely gathering supplies; they are investigating why the Accord Keepers chose silence.

### Mine — strength, craft, and the Heartroot

The Mine introduces Rock Golems, Magma Slugs, the Crystal Wyrm, and the best armor.

It should connect:

- Gunnar's forge knowledge;
- crystal and root materials;
- the final equipment tier;
- the Heartroot;
- the campaign resolution.

## 9. Four-act campaign

### Act I — Seeds of the Rootsong

**Zones:** Farm and Town  
**Theme:** Belonging comes from useful action.  
**Answer:** The strange events are connected.  
**Question opened:** What is the valley trying to say?

Core beats:

1. Select and name the active brother.
2. Plant and harvest the first crop.
3. Cook the first useful meal.
4. Sell produce through Bram.
5. Help Mira with one practical Town request.
6. Meet Gunnar and learn that an old tool bears an unknown tuning mark.
7. Visit Auntie Momo and make the first earned-gold pull.
8. See a crop, cookpot, tool, or Dumpling react to the same hidden note.

### Act II — Whispers in the Wilds

**Zones:** Farm, Town, and Wilds  
**Theme:** Strength begins with understanding what changed.  
**Answer:** The Rootsong's paths are broken.  
**Question opened:** Who broke them, and why?

Core beats:

1. Follow missing goods or strange tracks into the Wilds.
2. Fight the first creature and discover why it became aggressive.
3. Recover materials for Town and a lost Rootsong fragment.
4. Cook food for an expedition or recovery.
5. Complete a Ranger evidence route or Mage resonance route.
6. Bring the fragment back to Gunnar.
7. Learn that the Deep Woods contains an Accord seal.

### Act III — The Warden's Silence

**Zones:** Deep Woods plus changed returns to earlier zones  
**Theme:** Inherited rules can protect and harm at the same time.  
**Answer:** The Accord Keepers silenced the Heartroot after their order failed.  
**Question opened:** Can the brothers restore it without repeating that failure?

Core beats:

1. Grow a high-tier harvest for an expedition.
2. Help Wilds creatures displaced by the Deep Woods imbalance.
3. Reconstruct the Accord Keepers' decision from evidence and magical memory.
4. Face the Shadow Warden.
5. Earn the Eldoria Blade as a guaranteed trophy.
6. Open the route to the Mine.

### Act IV — The Heartroot Accord

**Zones:** Mine and transformed returns across all areas  
**Theme:** Harmony is cooperation, not sameness.  
**Answer:** Eldoria survives when knowledge, wildness, craft, and care stay in conversation.

Core beats:

1. Prepare food and equipment for the Mine.
2. Help Gunnar restore an Accord-forged tool.
3. Cross the Mine's crystal and magma hazards.
4. Gather the final Rootsong notes.
5. Face the Crystal Wyrm.
6. Restore the Heartroot.
7. Return to a visibly brighter Farm and Town.
8. Continue collection, equipment, relationships, cooking, and optional mysteries.

## 10. Chapter-one quest spine

The current random math interactions and kill quests remain useful repeatable activities. They should not carry the whole campaign.

| Order | Working title | Existing systems used | Story result |
| ---: | --- | --- | --- |
| 1 | First Furrow | planting, watering, harvest | Farm responds to the chosen hero. |
| 2 | Mira's Market Day | inventory, Town travel, Mira | Hero becomes useful to Town. |
| 3 | Bram's Fair Price | shop, seed choice, selling | Trade becomes a strategic loop. |
| 4 | A Pot That Hums | cooking, read-aloud, recipe comparison | The Rootsong reacts to a meal. |
| 5 | Gunnar's Broken Tongs | Town interaction, material clue | First Accord mark discovered. |
| 6 | The Squishy Stall | earned gold, Dumpling pull, collection shelf | First Dumpling joins the story. |
| 7 | The Same Strange Note | Farm/Town investigation | Separate clues become one mystery. |
| 8 | Trail to the Wilds | preparation, food, route | Act II expedition becomes the next goal. |

### First implementation recommendation

Do not implement all eight at once.

The first story slice should be:

1. **First Furrow**
2. **Mira's Market Day**
3. **The Squishy Stall**

This proves farming, Town relationships, collection, profile treatment, world-state change, and the new quest format without requiring Wilds or boss changes.

## 11. Quest episode contract

Every main episode should contain:

1. a fictional goal the child understands;
2. one plain objective sentence;
3. three to five playable actions;
4. an equally capable Ranger and Mage presentation;
5. an optional learning advantage;
6. non-punitive recovery;
7. a clear completion beat;
8. a deterministic baseline reward;
9. a persistent world or relationship change;
10. a next curiosity.

### Fifteen-minute pacing target

| Beat | Approximate time | Function |
| --- | ---: | --- |
| Hook and objective | 1–2 minutes | Establish desire and clarity. |
| Familiar action | 2–4 minutes | Let the child feel capable quickly. |
| Twist or clue | 2–3 minutes | Add mystery or profile expression. |
| Resolution | 3–5 minutes | Recombine the episode's actions. |
| Reward and change | 1–2 minutes | Make progress visible. |
| Next curiosity | under 1 minute | Invite return without pressure. |

These are authoring targets, never visible countdowns.

## 12. Quest-data direction for the current architecture

The current repository deliberately uses global JavaScript in one `index.html`. Do not introduce TypeScript, modules, a framework, or a content server merely to support quests.

The simplest future direction is one plain data catalog plus small runtime helpers:

```js
var STORY_QUESTS = {
  first_furrow: {
    id: 'first_furrow',
    act: 1,
    title: 'First Furrow',
    prerequisite: null,
    giver: 'mira',
    objective: {
      adventurer: 'Plant, water, and harvest three turnips.',
      mage: 'Grow three turnips. I can read this aloud.'
    },
    steps: [
      { type: 'plant', crop: 'turnip', count: 3 },
      { type: 'harvest', crop: 'turnip', count: 3 },
      { type: 'talk', npc: 'mira', count: 1 }
    ],
    learningBonus: {
      context: 'farm',
      reward: { gold: 5 }
    },
    baselineReward: { gold: 10 },
    worldChange: 'farm_first_furrow_complete'
  }
};
```

This is a design shape, not an implementation instruction. Before code:

- Claude should inspect the current save normalizer and event seams;
- Leo must approve any save-field addition or migration;
- the first implementation should add one quest, not a general-purpose engine larger than the content it serves;
- existing `questsDone` and `killQuest` behavior must remain compatible unless deliberately migrated.

## 13. Learning as leverage

### Current strengths

The current game already embeds useful reasoning in:

- crop cost, growth time, and selling price;
- recipe efficiency;
- shop purchasing;
- harvest bonuses;
- combat questions;
- profile-scaled reading and arithmetic;
- read-aloud support.

### Recommended evolution

Main story progression should come from adventure actions. Learning should improve the outcome.

Examples:

- repair a fence with an efficient number of boards;
- choose a profitable crop for a Town order;
- double a recipe for an expedition;
- compare tracks to identify a creature;
- estimate supplies before entering the Mine;
- sequence a spell pattern;
- determine which material fits Gunnar's repair;
- read dialogue evidence to expose a contradiction.

### Combat

The current combat loop makes every attack depend on a math answer. It is playable and non-terminal, but it puts learning closer to a gate than the product promise intends.

The current immediate combat slice is player-paced with no timer and diminishing-returns difficulty. That existing combat is what ships until a separate, tested redesign replaces it.

**Long-term aspirational direction** (does not replace the immediate combat slice):

- baseline attack always available;
- optional math or literacy action becomes a Power Strike, spell boost, defense, heal, status effect, or extra loot chance;
- wrong answers preserve the baseline turn and provide a useful hint;
- bosses mix observation and tactics with optional learning advantages.

This aspirational model should be a separate, carefully tested gameplay slice — not bundled into the first story quest and not assumed as shipped behavior.

## 14. Squishy Dumpling lore

Squishy Dumplings are comfort spirits formed where the Rootsong passes through grain, cultivated plants, warm steam, and a generous act.

They fold themselves into snack-like shapes because Eldoria remembers shared food as safety.

The Squishy Stall's earned-gold pull system is canon to the current game. Its fiction is:

- gold funds the Stall's ingredients, steam, and welcoming rituals;
- the player does not buy a creature;
- opening the steamer reveals which spirit answered;
- duplicates leave Dumpling Dough because a familiar spirit's echo answered again;
- pity represents Auntie Momo preparing an increasingly powerful invitation.

### Collection guardrails

Preserve:

- game-earned gold only;
- no real-money purchase;
- visible collection count;
- visible “legendary in N pulls or fewer” pity;
- duplicate dough and partial gold refund;
- persistent collection;
- no missed-day punishment.

Additions — **decided 2026-07-29, see §21**:

- show rarity odds in plain language;
- give every owned Dumpling a description and personality;
- let the player select a favorite;
- eventually show favorites at the Farm or following the hero;
- make Buddy abilities optional, readable, and useful without becoming mandatory;
- use quest rewards or dough crafting to provide deterministic paths to specific missing Dumplings later.

Removals — **decided 2026-07-29, see §21**:

- the discounted multi-pull bundle;
- the "save up for a better deal" nudge.

Both are monetisation-shaped mechanics that teach a child to spend in blocks and to
hold back rather than play. Neither survives in a game with no real-money purchase.

## 15. The eighteen Squishy Dumplings

Buddy concepts below describe fantasy and function. Exact values require a separate balance review.

| Dumpling | Rarity | Flavor | Buddy concept |
| --- | --- | --- | --- |
| Plain Bun | Common | Finds the warmest shelf, then saves the second-warmest spot for you. Quietly brave when a friend needs help. | **Steady Hands:** small farming-quality-of-life benefit. |
| Rice Ball | Common | Arranges loose grains like tiny maps and becomes offended when anyone calls the map “a mess.” | **Trail Grains:** improves route or nearby-object guidance. |
| Tofu Cube | Common | Square, calm, and nearly impossible to tip over. Thinks before moving and commits completely. | **Soft Shield:** small defensive or mistake-recovery benefit. |
| Egg Tart | Common | Stores sunshine in its golden centre and hums when a meal is ready. | **Warm Centre:** improves simple food recovery. |
| Mochi Drop | Common | Bounces when excited and sticks close when someone feels nervous. | **Helpful Hop:** improves pickup or harvest convenience. |
| Pork Bun | Common | Carries snacks for everyone and considers an expedition unfinished until all friends have eaten. | **Packed Lunch:** improves ordinary expedition supplies. |
| Custard Bao | Rare | Shy until its glowing centre is discovered; then becomes dramatically proud of it. | **Golden Filling:** cooking or recipe-efficiency advantage. |
| Spicy Gyoza | Rare | Challenges every creature twice its size and every pepper regardless of size. | **Pepper Spark:** optional combat power boost. |
| Sesame Ball | Rare | Rolls under counters, listens to gossip, and always knows which crate arrived late. | **Market Ear:** trade clue or modest shop advantage. |
| Red Bean Bun | Rare | Remembers every promise spoken near it and celebrates loudly when one is kept. | **Promise Keeper:** relationship or quest-reward benefit. |
| Onion Pancake | Rare | Sees every mystery as layers waiting to be unfolded. Smells clues before anyone else notices them. | **Layer Finder:** tracking and hidden-detail guidance. |
| Rainbow Mochi | Epic | Refracts the Rootsong into colors that reveal emotions, secrets, and occasionally embarrassing stains. | **Prism Sense:** reveals optional magical clues. |
| Dragon Dumpling | Epic | Is completely certain it is an enormous dragon. Nobody has found a kind way to explain scale. | **Tiny Roar:** strong but bounded combat flourish. |
| Golden Gyoza | Epic | Loves treasure, but loves proving a bargain was fair even more. Keeps immaculate little ledgers. | **Fair Fortune:** gold or selling advantage with clear limits. |
| Star Bao | Epic | Watches the sky from the highest available basket and predicts when unusual crops will thrive. | **Star Garden:** high-tier crop or growth advantage. |
| Golden Dumpling | Legendary | An ancient Stall spirit whose folds contain old Town songs. It bows to every new companion. | **Old Welcome:** collection, dough, or pity-support benefit. |
| Warrior Dumpling | Legendary | Trains with a toothpick sword at dawn and insists battle cries must rhyme. | **Brave Fold:** major optional combat sidegrade. |
| Harvest Dumpling | Legendary | Appears where a community shares the best part of a harvest rather than hoarding it. | **Plenty's Gift:** farming capstone and visible Farm celebration. |

## 16. Rewards, retention, and return

Healthy return should come from:

- visible Farm and Town improvement;
- Dumpling collection and favorite selection;
- equipment silhouettes and combat capability;
- NPC relationships;
- unresolved mysteries;
- profitable crop and recipe mastery;
- new routes;
- codex or story discoveries;
- cosmetic trophies.

### Town Request Board

The proposed “daily board” should become an **always-available Town Request Board**:

- requests never expire;
- no streak;
- no real-world countdown;
- complete one to reveal or refresh another;
- requests use current crops, cooking, monsters, and trade;
- occasional requests carry character dialogue or world decoration.

### Seasonal cooking contests

Contests may be entered whenever unlocked. They are story events, not real-calendar appointments. Higher reasoning can improve score or rewards, but participation and baseline completion remain available.

## 17. Dialogue rules

- Put the objective in one plain sentence.
- Give younger-reader scenes short spoken lines and a visible summary.
- Give older-reader scenes optional subtext and evidence.
- Use personality rather than faux-medieval vocabulary.
- Make humor come from magical inconvenience and character habits.
- Never shame a wrong answer.
- Let characters speak differently:
  - Mira: practical warmth;
  - Bram: trade metaphors;
  - Gunnar: material facts;
  - Momo: food and hospitality;
  - Warden: formal, old, exact;
  - Wyrm: sensory, geological, musical.

## 18. Funded asset-production roadmap

This is creative priority. Technical generation, normalization, validation, and approval remain governed by the adopted pipeline and current isometric contracts.

### Gate 0 — PixelLab pipeline (adopted)

The PixelLab pipeline was adopted in PR #15 and the MCP connection was established in PR #18. Current work is measured refinement and correction, not initial adoption.

The adopted route:

- `create-character-v3` with a reference image is the identity route;
- eight directions are generated to obtain the four diagonal isometric facings;
- hero concepts remain ChatGPT-led and North-Star-controlled;
- PixelLab handles rotation and animation;
- deterministic normalization and machine gates remain mandatory;
- buildings and terrain use the tiles/building routes rather than character endpoints.

### Wave 1 — Hero identity and motion

1. Ranger: the unarmed v2 rotation has been generated at 64 px and passed Claude's heading-fidelity and semantic-drift gates. ChatGPT's pixel inspection of the contact sheet is pending before visual approval. Walk animation is next after approval.
2. Mage: concept evidence exists (PR #19). Generation has not started; the Mage prompt must be updated to match the adopted unarmed, flat-front-on reference route before spending credits.
3. Confirm the two brothers read as one world and different roles at actual runtime size.
4. Lock contact points and animation conventions before equipment-look families.

### Wave 2 — Town relationship anchors

1. Mira;
2. Bram;
3. Gunnar;
4. Auntie Momo;
5. General Store;
6. Forge;
7. Squishy Stall;
8. plaza well and Town dressing.

This wave supports the first story slice and the current Town isometric conversion.

### Wave 3 — Farm fantasy

1. farmhouse/home anchor;
2. crop field states for all five crops;
3. cooking pot or kitchen station;
4. fences, signs, pond edge, trees, and harvest props;
5. one Rootsong landmark;
6. first six common Dumplings;
7. favorite-Dumpling home/showcase proof.

### Wave 4 — Wilds adventure set

1. Slime;
2. Bat;
3. Goblin;
4. trail and clearing environment kit;
5. stolen/scattered goods;
6. Ranger tracking and Mage resonance effects;
7. first combat and expedition quest props.

### Wave 5 — Deep Woods

1. Wolf;
2. Bear;
3. Troll;
4. Shadow Warden;
5. Accord seals and old-root landmarks;
6. darker canopy and path kit;
7. Eldoria Blade trophy presentation.

### Wave 6 — Mine and finale

1. Rock Golem;
2. Magma Slug;
3. Crystal Wyrm;
4. crystal/stone/magma kit;
5. Gunnar's final tool;
6. Heartroot landmark;
7. restored-world variants.

### Squishy Dumpling production order

Do not generate all eighteen before the companion presentation is proven.

1. Produce the six Commons as the first silhouette family.
2. Integrate one favorite/showcase/follow proof.
3. Confirm runtime readability and child preference.
4. Produce Rares.
5. Produce Epics and Legendaries alongside their related zones and quests.

## 19. Asset brief requirements

Every content-driven asset request should identify:

- repository target and exact identity authority;
- narrative role;
- area and interaction;
- isometric direction or footprint;
- runtime dimensions;
- animation/action need;
- palette and lighting authority;
- PixelLab endpoint or production route;
- source/reference version;
- deterministic normalization target;
- machine gates;
- required runtime evidence;
- North Star review result.

Credentials, account data, tokens, and raw private materials never belong in the public repository.

## 20. AI collaboration

This creative-direction PR should be the single review surface for this reconciliation.

### ChatGPT

- leads and recommends the product fantasy, lore, dialogue, quest fiction, asset narrative priority, and visual interpretation;
- responds to owner direction and revises creative choices;
- reviews generated candidates against identity and the North Star.

Leo remains the final authority on all creative decisions (see AI Team Charter §Owner authority).

### Claude Code

- reviews this framework against current `index.html`, saves, tests, and active isometric work;
- identifies the smallest implementation seams;
- turns one approved episode into one bounded technical slice;
- preserves the single-file architecture unless Leo authorizes otherwise.

### Gemini

- provides non-blocking challenge on the exact draft;
- checks systems coherence, curriculum coverage, economy, accessibility, and missing risks;
- does not label its own proposals approved.

### Implementation rule

Do not combine:

- Creative Bible approval;
- quest save migration;
- combat redesign;
- PixelLab pipeline adoption;
- Town isometric implementation;
- production asset integration

into one PR.

## 21. Continuity conflicts — decided

All four conflicts below were put to the owner and **decided on 2026-07-29**. They
are now canon: build to the **Decision** lines, not to the original recommendations.
Reopening any of them needs a new owner decision, not an agent's judgement.

### Auntie Momo — decided

The Dumpling Vendor had no canonical name.

**Decision:** "Auntie Momo" is the canonical name for the Squishy Dumpling Vendor. Use it throughout creative direction, dialogue, and asset briefs.

### Mira's role — decided

The approved Mira concept was described as a town shopkeeper, while current `index.html` makes Mira the quest giver and Bram the shopkeeper.

**Decision:** keep the runtime roles. Mira is Town steward / market coordinator — which preserves her apron-and-basket visual design — and Bram stays the General Store keeper. No ID renames, no shop-behavior rewrite.

### Hero names — decided

The proposed framework names the heroes Leo and Pip. Current profiles are renameable and the North Star establishes roles, not fixed names.

**Decision:** Ranger and Mage are the canonical identities; families name their own heroes. Written material refers to the roles, never to fixed given names.

### Dumpling acquisition — decided

The supplied proposal and current game both use earned-gold pulls, rarity, pity, and eighteen collectibles. Older V2 guidance argued for fully deterministic companion invitations.

**Decision — keep the pulls, strip the pressure.** The earned-gold pull loop stays, and so do rarity, pity, and the eighteen collectibles. The monetisation-shaped scaffolding around it goes:

- **show the odds** on the pull screen, in words a child can read;
- **keep a deterministic dough-based path** to every dumpling, so no companion is ever gated behind luck alone;
- **remove the discounted multi-pull bundle** — one pull costs what one pull costs;
- **remove the "save up for a better deal" nudge**;
- no real-money purchase, no daily-login pressure, no timed offer, ever.

Personalities and favorites stay as the affection layer.

### Campaign naming — decided

**Decision:** the naming set is adopted:

- Rootsong;
- the Fading;
- Heartroot;
- Accord Keepers.

## 22. Recommended next sequence

1. ~~Owner reviews the five continuity decisions above.~~ Done 2026-07-29; all five decided in §21.
2. ~~Adopt the PixelLab pipeline.~~ Done — PR #15 (pipeline) and PR #18 (MCP).
3. Merge this creative-direction document after accepted non-author amendments.
4. Complete the Ranger visual approval: ChatGPT inspects the contact sheet.
5. Update the Mage prompt to match the adopted unarmed, flat-front-on reference route and generate.
6. Finish the current Town isometric slice through its own PR.
7. Produce the Ranger and Mage motion lock (walk animations).
8. Implement the first three-quest story slice:
   - First Furrow;
   - Mira's Market Day;
   - The Squishy Stall.
9. Produce Town relationship assets in narrative priority.
10. Playtest with both children before writing the whole campaign into code.

## 23. Creative acceptance test

A proposed feature belongs in Eldoria when most answers are yes:

- Does it strengthen the Ranger or Mage fantasy?
- Does it deepen an existing system, place, character, or mystery?
- Can a child understand the immediate goal?
- Does the learning create advantage rather than permission?
- Does the reward produce affection, capability, or visible change?
- Is it readable at touch-first runtime scale?
- Does it move toward the Visual North Star?
- Can it fit the single-file architecture without unnecessary machinery?
- Does it avoid real-money pressure, expiring rewards, and punishment for disengaging?
- Will a child remember the person, creature, place, or mystery after closing the game?

