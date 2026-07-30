# PixelLab MCP companion for Eldoria

**Last verified:** 2026-07-29  
**Live PixelLab sources** (control vendor parameters, capabilities, validation,
and pricing): <https://api.pixellab.ai/mcp/docs>,
<https://api.pixellab.ai/v2/openapi.json>, <https://api.pixellab.ai/v2/llms.txt>  
**Eldoria production authority** (controls accepted routes, engine contracts,
security, normalization, validation, and review gates): [`PIPELINE.md`](PIPELINE.md)
and [`../../.claude/skills/asset-generation/SKILL.md`](../../.claude/skills/asset-generation/SKILL.md)  
**If they conflict:** stop and repair the stale repository guidance before
spending credits.

This is a small, repository-owned bridge between PixelLab's changing MCP tool
surface and Eldoria's tested asset pipeline. It is not a copy of PixelLab's
documentation. Read the live guide when exact parameters, costs, or newly
released tools matter.

## What this adds

- A safe shared Claude Code connection in the repository's `.mcp.json`.
- A common operating guide for ChatGPT, Claude, Gemini, and future agents.
- Eldoria-specific routing and safety rules that vendor documentation cannot
  know.

It does **not** replace the deterministic download, normalization, validation,
contact-sheet, North Star review, or owner-approval stages already proven in
`tools/pipeline/`.

## Current operating roles and direction retention

- Claude is the default PixelLab generation seat for bounded approved batches.
- ChatGPT reviews exported candidates for identity, camera, direction order,
  motion, transparency, framing, North Star alignment, and 64px readability.
- Leo retains final product and visual authority.
- PixelLab's full 8-direction character output is retained. The current engine's
  SE/SW/NW/NE slots are a compatibility subset; south/east/north/west remain
  production sources for the owner-intended later eight-direction runtime.
- No agent may delete or replace remote PixelLab material without explicit
  approval.

## Secrets: what is and is not committed

The repository contains only the variable name `${PIXELLAB_SECRET}`. It never
contains the token value.

Store the token in the local environment or the host application's secret
store. Do not put it in Markdown, `.mcp.json`, shell history, screenshots,
issues, pull requests, logs, or chat messages.

**[VENDOR-DOCUMENTED]** PixelLab download URLs are not authenticated; their UUID
acts as the access key, and PixelLab permits sharing links. **Eldoria policy:**
public sharing of download links is permitted **only** for assets intentionally
released for public review. Private, confidential, or unapproved outputs remain
unlisted — treat their UUIDs as unlisted credentials until the asset is approved
for sharing.

## Connect Claude Code

The checked-in `.mcp.json` uses PixelLab's remote HTTP endpoint and expands
`PIXELLAB_SECRET` locally:

```json
{
  "mcpServers": {
    "pixellab": {
      "type": "http",
      "url": "https://api.pixellab.ai/mcp",
      "headers": {
        "Authorization": "Bearer ${PIXELLAB_SECRET}"
      }
    }
  }
}
```

Set the variable before starting Claude Code.

PowerShell, current terminal only:

```powershell
$env:PIXELLAB_SECRET = "your-token"
claude mcp list
```

PowerShell, persist for the current Windows user:

```powershell
[Environment]::SetEnvironmentVariable("PIXELLAB_SECRET", "your-token", "User")
```

Start a fresh terminal after setting a persistent variable. Claude Code asks
for approval before using a project-scoped MCP server. Use `/mcp` or
`claude mcp get pixellab` to inspect connection status.

The existing Python client accepts the same `PIXELLAB_SECRET`, so one local
secret powers both the tested scripted pipeline and the optional MCP tools.

## Connect ChatGPT / Work Mode

ChatGPT can connect directly to remote MCP servers through custom apps when
the account and workspace expose Developer mode.

1. Enable Developer mode in ChatGPT's Apps settings. Workspace administration
   may be required.
2. Create a custom app with endpoint `https://api.pixellab.ai/mcp`.
3. Choose Bearer-token or custom-header authentication if the creation flow
   offers it, and enter the PixelLab token in ChatGPT's secure app setup—not
   in this repository.
4. Scan the tools, create the draft app, and select that app in a new chat.
5. Test with `get_balance` before creating an asset.

Full MCP write/action support is currently plan-dependent. If the app setup
does not offer static Bearer/custom-header authentication, direct ChatGPT
connection is blocked by authentication compatibility; use Claude Code or
the proven Python client instead. A Markdown file can teach an agent the
workflow, but cannot grant it tools or credentials.

ChatGPT custom apps use an approved snapshot of tool definitions. When
PixelLab changes its MCP surface, refresh/rescan the app actions before
depending on a new or changed parameter.

## Which interface to use

| Need | Preferred Eldoria route | Why |
| --- | --- | --- |
| Repeatable production batch | `pixellab_client.py` | Tested requests, polling, downloads, dry-run support, and deterministic handoff |
| Interactive exploration or one-off generation | PixelLab MCP tools | Fast natural-language access and live tool descriptions |
| Exact current parameter or cost | Live MCP guide or `agent_help` | Vendor tool definitions change |
| Normalize, anchor, validate, or make review sheets | Local pipeline tools | PixelLab does not enforce Eldoria's engine contract |
| Commit approved art | Normal repository workflow | Raw generation must never jump straight into `assets/` |

Seeing MCP tools changes the interface, not the production acceptance gates.

## Eldoria-relevant MCP tool map

This table is a routing index, not a parameter reference.

| Asset need | Start with | Follow with |
| --- | --- | --- |
| Hero, boss, or named NPC identity | `create_character` in `v3` mode with the approved reference | `get_character`, then `animate_character` |
| Simple humanoid enemy | `create_character` | `get_character`, optional `animate_character` |
| Supported quadruped | `create_character` with the correct quadruped template | `get_character`, then available animations |
| Prop with one view | `create_1_direction_object` | `get_object`, then `select_object_frames` or `dismiss_review` |
| Rotating prop | `create_8_direction_object` | `get_object`, optional `animate_object` |
| Quick contextual prop | `create_map_object` | `get_map_object` and download promptly |
| Isometric terrain batch | `create_tiles_pro` | `get_tiles_pro` |
| Connectable path or road | `create_path_tiles` | `get_tiles_pro` |
| Walls, floors, doors, and stairs | `create_building_kit` | `get_tiles_pro` |
| Single isometric style probe | `create_isometric_tile` | `get_isometric_tile` |
| Freeform item or scene | `create_image_pixflux`, `create_image_pixen`, or `create_image_pro` | `get_image` |
| Consistent edit across frames | `edit_image` | `get_image` |
| Localized repair | `inpaint_image` | `get_image` |
| Animation from a finished image | `animate_image` | `get_image` |
| UI panel concept | `create_ui_asset` | `get_ui_asset` |
| Portrait or dialogue experiment | portrait/vocal tools | matching `get_*` tool |
| Account check | `get_balance` | none |
| Current vendor guidance | `agent_help` | verify against the live guide if consequential |

The PixelLab chat-agent and sandbox tool families can create or modify
separate PixelLab projects. Do not use them on Eldoria source code unless the
owner explicitly requests that separate workflow. GitHub remains the source
of truth for the game.

## Non-negotiable operating rules

1. **Check before spending.** Use `get_balance` and a dry run where the local
   client supports it. Use the least expensive route that meets the approved
   art requirement.
2. **Respect background jobs.** Creation calls return IDs and usually finish
   later. Record the ID and poll the matching `get_*` tool; do not submit
   duplicates because a result is not immediate.
3. **Never auto-confirm high-cost Pro animation.** First call with
   `confirm_cost` false or omitted, show the quoted cost to the owner, and
   set it true only after explicit approval.
4. **Use the correct identity tool.** Rotate a character reference with
   `create_character(mode="v3")`; do not use `create_8_direction_object` for
   a humanoid identity.
5. **Prefer URLs over inline base64.** For anything beyond a tiny sprite,
   PixelLab warns that MCP clients may truncate base64 arguments.
6. **Do not invent animation directions.** A custom start or end frame
   requires exactly one direction. If the requested direction is not clear,
   ask. Eldoria's production mapping remains right=SE, down=SW, left=NW,
   up=NE.
7. **Curate review batches.** Multi-candidate object calls can enter `review`
   status. Inspect candidates, explicitly select winners, or dismiss the
   batch.
8. **Download temporary results promptly.** `create_map_object` results
   auto-delete after eight hours.
9. **Do not delete remotely without explicit approval.** Character, object,
   tile, UI, and animation deletion is immediate and may destroy associated
   work or waste in-flight generations.
10. **Keep production gates.** Raw output goes under `_probe_local/`;
    normalize, validate, make a review sheet, compare with the Visual North
    Star, obtain owner approval, and only then commit selected normalized
    assets.

## Eldoria production defaults

Do not re-derive the settings already calibrated in `PIPELINE.md`:

- Character identity: approved concept/reference → `v3` rotation → **retain
  all eight directions** (the runtime is eight-direction since 2026-07-30;
  see the mapping table in `PIPELINE.md`).
- Engine cardinal mapping: right=SE, down=SW, left=NW, up=NE; the four
  diagonals fill the remaining slots per `PIPELINE.md`.
- Terrain: isometric `create_tiles_pro`, 64px tiles, `tile_flat_top_px=2`;
  use dedicated path and building-kit tools where applicable.
- Cross-batch style: approved style references plus the North Star prompt
  suffix documented in the asset-generation skill.
- Walking characters: normalize to the engine's four-frame contract and run
  validation with `--require-walks`.

## Drift check

PixelLab's MCP page is generated from its live tool definitions. Before a
material asset batch:

1. Open <https://api.pixellab.ai/mcp/docs>.
2. Check its generated timestamp and the exact tools planned for the batch.
3. If behavior differs from this companion, treat the live vendor definition
   as authoritative for the call and update this file only where Eldoria's
   workflow or guardrails truly changed.
4. Record calibration discoveries in `PIPELINE.md`, not by copying the vendor
   reference into the repository.

## North Star alignment

**Aligned.** This document changes access and operating guidance only. It
keeps identity direction, deterministic engine contracts, and visual review
under Eldoria's existing North Star process.
