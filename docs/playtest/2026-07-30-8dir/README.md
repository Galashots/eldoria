# 2026-07-30 eight-direction runtime evidence

Headless-Chromium captures of the real game (`?iso=1`, 900×700 viewport) for
the eight-direction walk slice.

- `<profile>-<facing>-stride.png` — one shot per hero per engine facing
  (`right`, `down-right`, `down`, `down-left`, `left`, `up-left`, `up`,
  `up-right`), taken mid-stride (`walkFrame=1`) on the iso Farm. Verifies each
  facing loads its own art, headings match the engine slot map (right=SE,
  down=SW, left=NW, up=NE, down-right=S, down-left=W, up-left=N, up-right=E),
  and the walk strip actually plays in the iso renderer.
- `<profile>-stand.png` — the standing pose (walkFrame resets to 0), the
  engine's stationary contract.
- `area-<name>.png` — every area (`farm`, `town`, `wilds`, `deepwoods`,
  `mine`) rendering in iso under the `?iso=1` development override (Farm and
  Town are iso by default; the combat areas remain top-down by default until
  their parity gates are met); the combat areas show enemies drawn from their
  real sprites (with the top-down red "alive" cue) instead of colored prisms.
