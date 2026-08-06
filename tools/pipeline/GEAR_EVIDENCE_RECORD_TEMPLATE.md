# Per-slot gear evidence record — template

**Status:** DESIGN ONLY (Sub-project A research output, 2026-08-06). One record is
filled **per `(slot, route)`** — e.g. `body / direct-overlay`,
`body / equipped-state`, `weapon / direct-overlay`, … — so the mixed per-slot
verdict spec §6 allows (body baked, weapon overlaid, etc.) is backed by evidence,
not a single global guess.

The record exists because **seeds are not stored server-side** — the command is the
only durable record (PixelLab skill §5) — and because this repo has twice paid for
undocumented billing behaviour (template-walk overrun; Momo probe overrun). Every
row is a fact the next reviewer can re-verify cold.

A record is what feeds the gear custody validator (`GEAR_CUSTODY_CONTRACT.md`) and
the human/North Star review. **Machine PASS ≠ visual PASS**: the validator fields
and the human-verdict fields are both required before a slot's route can be called a
winner. A human semantic **FAIL** may eliminate a route before GC scoring; record
the route as `LOSE`, set custody `scoring_status` to `UNSCORED`, and explain that
the mask was pending or otherwise unavailable. This is distinct from a scored
GC4/GC5 `FAIL` and never permits a `PASS` without an approved mask.

---

## Markdown template (copy per slot × route)

```
### Slot: <head|body|weapon|cape>   Route: <direct-overlay|equipped-state|transfer-outfit>

Generation
- interface / tool:            <REST endpoint | MCP tool | web Creator>
- exact endpoint:              </v2/create-character-v3 | /v2/create-character-state | …>
- live-schema verified on:     <YYYY-MM-DD against api.pixellab.ai/v2/openapi.json>
- exact command / params:      <full call, incl. mode, view, no_background>
- seed:                        <int or "random – not reproducible">
- approved reference(s):       <path + SHA-256 of each input the batch was approved with>
- approved mask:               <status APPROVED|PENDING|MISSING; path + SHA-256 when a draft or approved
                                  mask exists — a final custody PASS requires APPROVED. A PENDING
                                  mask leaves GC4/GC5 UNSCORED only when a human gate already records
                                  LOSE; otherwise missing approval is a fail-closed FAIL. Direct-overlay
                                  is not exempt; see GEAR_CUSTODY_CONTRACT.md §2>

Size & geometry
- source dimensions:           <w×h of the fed reference>
- output frame / canvas:       <figure px / canvas px>
- facings generated:           <list – v3/state always return 8>
- facings evaluated:           <smallest useful subset, e.g. down-right(S)/right(SE)/up-left(N)>
- states covered:              <static | idle | walk | attack | …>

Cost (measured, not estimated)
- generations quoted:          <n, and the formula/table it came from>
- generations actually charged:<balance before → after, delta>
- accepted output count:       <n>
- failed output count:         <n, with the failure mode>

Custody validator (GC1–GC8; PASS/FAIL each; see GEAR_CUSTODY_CONTRACT.md)
- custody scoring status:       <SCORED | UNSCORED — reason; PENDING mask may not score PASS>
- GC4 mask containment:        <PASS/FAIL>
- GC5 off-mask identity px changed: <count | UNSCORED — MUST be 0 outside approved masks when scored>
- GC6 layer-order fidelity:    <PASS/FAIL>
- GC8 determinism (re-run SHA): <PASS/FAIL>
- other GC gates:              <PASS/FAIL summary>

Human / North Star verdicts (not machine-checkable)
- human semantic gate:          <PASS | FAIL | NOT RUN + note>
- heading fidelity:            <PASS/FAIL + note>
- cross-facing recognizability:<same item reads across facings? note>
- semantic drift:              <hallucinated props/companions/gear moved? note>
- temporal stability:          <idle/walk/attack – N/A for static probe>
- North Star alignment:        <Aligned | Intentional interim gap | Refresh candidate>

Repair
- manual repair minutes:       <n>
- deterministic & repeatable?: <yes/no – can the fix be re-derived from inputs?>

Runtime (iPad)
- extra runtime requests:      <n added by this route>
- decoded memory delta:        <approx>
- boot-time / offline-cache impact: <note>

Custody
- raw output location:         <path>
- raw output SHA-256:          <hash(es)>
- committed artifact SHA-256:  <hash(es), if committed>

Verdict for this slot × route:  <WIN | LOSE | INCONCLUSIVE + one-line reason>
```

---

## JSON schema (machine-readable mirror)

For a machine-collated evidence set. Fields mirror the markdown 1:1; `null` where
not yet measured. Keep both — the markdown is the human record, the JSON feeds any
future collation script.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "GearEvidenceRecord",
  "type": "object",
  "required": ["slot", "route", "generation", "cost", "custody_validator", "human_verdicts", "verdict", "verdict_reason"],
  "properties": {
    "slot":  { "enum": ["head", "body", "weapon", "cape"] },
    "route": { "enum": ["direct-overlay", "equipped-state", "transfer-outfit"] },
    "generation": {
      "type": "object",
      "required": ["tool", "endpoint", "schema_verified_on", "command", "approved_references", "approved_mask"],
      "properties": {
        "tool": { "type": "string" },
        "endpoint": { "type": "string" },
        "schema_verified_on": { "type": "string", "format": "date" },
        "command": { "type": "string" },
        "seed": { "type": ["integer", "null"] },
        "approved_references": {
          "type": "array",
          "items": { "type": "object",
            "required": ["path", "sha256"],
            "properties": { "path": {"type":"string"}, "sha256": {"type":"string"} } }
        },
        "approved_mask": {
          "description": "MANDATORY for every route, direct-overlay included. PENDING records a draft/unapproved mask and cannot produce GC4/GC5 PASS; it is UNSCORED only when a human semantic FAIL already makes the route LOSE. (GEAR_CUSTODY_CONTRACT.md §2)",
          "type": "object",
          "required": ["status"],
          "properties": {
            "status": { "enum": ["APPROVED", "PENDING", "MISSING"] },
            "path": {"type":"string"},
            "sha256": {"type":"string"},
            "reason": {"type":"string"}
          },
          "allOf": [
            { "if": { "properties": { "status": { "const": "APPROVED" } } }, "then": { "required": ["path", "sha256"] } },
            { "if": { "properties": { "status": { "const": "PENDING" } } }, "then": { "required": ["path", "sha256", "reason"] } },
            { "if": { "properties": { "status": { "const": "MISSING" } } }, "then": { "required": ["reason"] } }
          ]
        }
      }
    },
    "geometry": {
      "type": "object",
      "properties": {
        "source_dimensions": { "type": "string" },
        "output_figure_px": { "type": ["integer", "null"] },
        "output_canvas_px": { "type": ["integer", "null"] },
        "facings_generated": { "type": "array", "items": { "type": "string" } },
        "facings_evaluated": { "type": "array", "items": { "type": "string" } },
        "states_covered": { "type": "array", "items": { "type": "string" } }
      }
    },
    "cost": {
      "type": "object",
      "required": ["generations_quoted", "generations_charged"],
      "properties": {
        "generations_quoted": { "type": "number" },
        "generations_charged": { "type": "number" },
        "accepted_count": { "type": "integer" },
        "failed_count": { "type": "integer" },
        "failure_modes": { "type": "array", "items": { "type": "string" } }
      }
    },
    "custody_validator": {
      "type": "object",
      "required": ["scoring_status", "gc5_offmask_pixels_changed"],
      "properties": {
        "scoring_status": { "enum": ["SCORED", "UNSCORED"] },
        "unscored_reason": { "type": ["string", "null"] },
        "gc4_mask_containment": {
          "description": "PASS is allowed only with an APPROVED mask. null is UNSCORED only for a route already eliminated by a human semantic FAIL or still mid-fill; otherwise a missing/pending mask is FAIL.",
          "enum": ["PASS", "FAIL", null]
        },
        "gc5_offmask_pixels_changed": { "type": ["integer", "null", "string"] },
        "gc6_layer_order": { "enum": ["PASS", "FAIL", null] },
        "gc8_determinism": { "enum": ["PASS", "FAIL", null] },
        "other_gates": { "type": "string" }
      }
    },
    "human_verdicts": {
      "type": "object",
      "required": ["semantic_gate"],
      "properties": {
        "semantic_gate": { "enum": ["PASS", "FAIL", "NOT_RUN"] },
        "heading_fidelity": { "type": "string" },
        "cross_facing_recognizability": { "type": "string" },
        "semantic_drift": { "type": "string" },
        "temporal_stability": { "type": "string" },
        "north_star_alignment": {
          "enum": ["Aligned", "Intentional interim gap", "Refresh candidate", null] }
      }
    },
    "repair": {
      "type": "object",
      "properties": {
        "manual_minutes": { "type": ["number", "null"] },
        "deterministic_repeatable": { "type": ["boolean", "null"] }
      }
    },
    "runtime_ipad": {
      "type": "object",
      "properties": {
        "extra_requests": { "type": ["integer", "null"] },
        "decoded_memory_delta": { "type": ["string", "null"] },
        "boot_offline_impact": { "type": ["string", "null"] }
      }
    },
    "custody": {
      "type": "object",
      "properties": {
        "raw_output_location": { "type": "string" },
        "raw_output_sha256": { "type": "array", "items": { "type": "string" } },
        "committed_sha256": { "type": "array", "items": { "type": "string" } }
      }
    },
    "verdict": { "enum": ["WIN", "LOSE", "INCONCLUSIVE"] },
    "verdict_reason": { "type": "string" }
  }
}
```

**GC5 is the field that decides a route.** `gc5_offmask_pixels_changed` must be `0`
outside the approved masks; any nonzero value means the candidate carries
hero-identity drift and will ghost when composited, regardless of how clean it
looks.
