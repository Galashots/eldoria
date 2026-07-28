# Eldoria Visual North Star

**Status:** Owner-approved visual direction  
**Version:** 1  
**Approved:** 2026-07-28  
**Applies to:** Realm of Eldoria as a whole

![Eldoria Visual North Star](visual/eldoria-visual-north-star-v1.png)

Permanent repository link after merge:

`https://github.com/Galashots/eldoria/blob/main/docs/visual/eldoria-visual-north-star-v1.png`

## Purpose

This image is the shared visual target for agents reviewing the repository or making decisions that affect the visible game. It is an aspirational gameplay scene, not a claim that every pictured feature already exists and not a demand to reproduce every pixel literally.

The current game may reach this target in small, practical steps. A scoped feature is allowed to look less complete than the North Star while the underlying direction remains intact.

## Direction carried by the image

Relevant work should move toward these qualities:

- one fixed, coherent isometric projection across terrain, buildings, props, characters, water, and bridges;
- generous navigable space, readable walking lanes, and detail concentrated away from movement routes;
- premium, crisp pixel art with HD-2D depth, restrained magical glow, warm upper-left light, and down-right shadows;
- a rich but legible farm whose crops feel rewarding to grow, water, harvest, cook, and sell;
- the younger Mage and older Ranger designed as a complementary brotherly duo with distinct silhouettes and roles;
- inviting exploration hooks visible beyond the immediate activity;
- child-friendly adventure for roughly ages 7–11 without a preschool tone;
- touch-first UI with large clear actions, subdued secondary controls, and direct tapping on visible people, enemies, crops, and objects;
- strong atmosphere and polish without sacrificing immediate gameplay readability.

## What is binding

Before a repository-wide review, visual audit, or material decision about camera, level layout, environment art, character art, animation, VFX, or HUD:

1. Open and inspect the current North Star image.
2. Compare the proposed work against the applicable qualities above.
3. State the result under a short **North Star alignment** heading:
   - **Aligned**
   - **Intentional interim gap**
   - **Refresh candidate**
4. Do not reject useful incremental work merely because it does not yet reach final-art quality.
5. Do not silently change the visual direction.

Pure logic, test, documentation, build, or invisible accessibility changes do not need a forced visual comparison unless they affect the visible player experience.

## Intentional departures

A feature may intentionally move beyond or away from something pictured here. That is acceptable when the agent:

- identifies the mismatch plainly;
- explains whether it is a temporary implementation gap or a genuinely better/new direction;
- preserves unaffected North Star qualities where practical; and
- if the new direction is likely to persist, flags **NORTH STAR REFRESH RECOMMENDED** and supplies a ready-to-paste ChatGPT image prompt.

The agent should continue with otherwise-authorized scoped work. The flag is for owner awareness; it is not an automatic blocker.

## Required refresh prompt

When recommending a refresh, base the prompt on the current image rather than asking the owner to find and upload it again. Link to:

`https://raw.githubusercontent.com/Galashots/eldoria/main/docs/visual/eldoria-visual-north-star-v1.png`

Use this structure and replace the bracketed fields:

> Use the linked current Eldoria Visual North Star as the primary visual reference:
> https://raw.githubusercontent.com/Galashots/eldoria/main/docs/visual/eldoria-visual-north-star-v1.png
>
> Create one polished 16:9 gameplay concept that can supersede it. Preserve [qualities that remain authoritative]. Incorporate [new feature, art, camera, UI, character, biome, or gameplay direction] because [brief reason/evidence from the repository]. Show [specific scene and interactions] in one coherent, playable composition. Keep strict isometric construction, generous navigable spacing, premium crisp pixel art/HD-2D depth, consistent upper-left lighting, child-friendly adventure tone, readable touch-first UI, and direct world-object interaction unless explicitly changed above. Do not create a poster, collage, sprite sheet, device frame, logo, watermark, or explanatory text. The result must look like a real gameplay screenshot and must be suitable for owner review as the next repository-wide Visual North Star.

The suggested prompt must be specific to the feature that triggered the refresh. Agents should not paste the generic template unchanged.

## Superseding this North Star

Agents may recommend and generate a candidate, but may not declare it authoritative themselves.

A new North Star becomes current only after explicit owner approval. Once approved:

1. add it as a new versioned file, such as `eldoria-visual-north-star-v2.png`;
2. update this document's image, version, date, permanent link, direction notes, and refresh-prompt link;
3. keep prior versions in `docs/visual/` as history; and
4. record why the prior version was superseded.

**Supersession history**

- **v1 — 2026-07-28:** Established the spacious isometric farm scene, dual-hero presentation, premium pixel-art/HD-2D finish, farm-to-dumpling loop, exploration hooks, and touch-first HUD as the initial repository-wide visual direction.
