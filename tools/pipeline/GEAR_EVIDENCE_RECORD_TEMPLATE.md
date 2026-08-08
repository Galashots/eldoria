# Per-slot gear evidence record

**Status:** IMPLEMENTED SCHEMA CONTRACT (Sub-project A Phase 1, 2026-08-06).
Create one record per `(slot, route, facing)` under review. The record feeds
`tools/pipeline/validate_gear.py` and the human/North Star review.

A human semantic **FAIL** may eliminate a route before custody scoring. Record
that route as `LOSE`, set custody `scoring_status` to `UNSCORED`, and explain why
GC fields were not scored. This is different from a scored machine `FAIL` and can
never produce a PASS without an approved mask.

## Markdown template

```
status: <DRAFT | SCORED | FINAL>
slot: <head | body | weapon | cape>
facing: <exact facing>
route: <standard-inpaint | inpaint-v3-api | direct-overlay | equipped-state | transfer-outfit>

Generation
- interface/tool: <Pixelorama Inpaint | REST | MCP | browser Creator>
- exact endpoint/workflow: <full name and parameters>
- live schema/UI cost quote: <quote recorded before authorization>
- seed: <fixed integer or explicitly random>
- approved reference(s): <path + SHA-256>
- approved mask: <APPROVED | PENDING | MISSING; path + SHA-256; reason>

Canvas custody (mandatory before scoring)
- source canvas px: <integer>
- validation canvas px: <64 for this validator>
- mask canvas px: <64 for this validator>
- deterministic transform: <crop, scale, interpolation, rotation, translation>
- anchor/pivot: <exact origin/key or explicit no-keypoint rule>
- normalization: <none, or deterministic extraction-only normalization>

Geometry
- output dimensions: <width x height>
- facings/states generated: <list>
- facings/states evaluated: <list>

Cost
- generations quoted: <number + source>
- generations charged: <number + balance delta or N/A before approval>

Custody validator
- scoring status: <SCORED | UNSCORED + reason>
- GC4 mask containment: <PASS | FAIL | UNSCORED>
- GC5 off-mask pixels changed: <integer 0+ | UNSCORED>
- GC6 deterministic extraction/recomposition: <PASS | FAIL | UNSCORED>
- GC8 deterministic SHA-256: <PASS | FAIL | UNSCORED>
- extracted layer SHA-256: <hash | N/A>
- recomposed SHA-256: <hash | N/A>

Human / North Star review
- semantic gate: <PASS | FAIL | NOT_RUN + note>
- heading fidelity: <complete note>
- cross-facing recognizability: <complete note>
- semantic drift: <complete note>
- temporal stability: <complete note or N/A>
- North Star alignment: <Aligned | Intentional interim gap | Refresh candidate>

Custody
- raw output location: <private path or N/A; never publish UUIDs/URLs>
- base/source file SHA-256: <hash>
- candidate/export file SHA-256: <hash>
- base/source canonical pixel SHA-256: <dimensions + decoded RGBA hash>
- candidate/export canonical pixel SHA-256: <dimensions + decoded RGBA hash>
- Chrome canvas decode comparison: <PASS | FAIL; drawImage/getImageData; differing RGBA count>
- mask SHA-256: <hash>

verdict: <WIN | LOSE | INCONCLUSIVE>
verdict_reason: <one-line reason>
```

## Evidence states

- **DRAFT:** review artifact. Masks are not owner/review approved; `WIN` is
  prohibited.
- **SCORED:** custody was evaluated with an approved mask. Human review fields
  still decide visual acceptance.
- **FINAL:** machine and human fields are complete. `WIN` is legal only when all
  required machine and human conditions below pass.
- **LOSE before scoring:** allowed when the human semantic gate fails first;
  custody fields stay `UNSCORED` and pending masks remain fail-closed.

## JSON schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "GearEvidenceRecord",
  "type": "object",
  "required": ["status", "slot", "facing", "route", "generation", "cost", "custody_validator", "human_verdicts", "custody", "verdict", "verdict_reason"],
  "properties": {
    "status": {"enum": ["DRAFT", "SCORED", "FINAL"]},
    "slot": {"enum": ["head", "body", "weapon", "cape"]},
    "facing": {"type": "string", "minLength": 1},
    "route": {"enum": ["standard-inpaint", "inpaint-v3-api", "direct-overlay", "equipped-state", "transfer-outfit"]},
    "generation": {
      "type": "object",
      "required": ["tool", "endpoint", "schema_verified_on", "command", "approved_references", "approved_mask", "canvas_custody"],
      "properties": {
        "tool": {"type": "string", "minLength": 1},
        "endpoint": {"type": "string", "minLength": 1},
        "schema_verified_on": {"type": "string"},
        "command": {"type": "string", "minLength": 1},
        "seed": {"type": ["integer", "null"]},
        "approved_references": {"type": "array", "items": {"type": "object", "required": ["path", "sha256"], "properties": {"path": {"type": "string"}, "sha256": {"type": "string"}}}},
        "approved_mask": {
          "type": "object",
          "required": ["status"],
          "properties": {
            "status": {"enum": ["APPROVED", "PENDING", "MISSING"]},
            "path": {"type": "string"},
            "sha256": {"type": "string"},
            "reason": {"type": "string"}
          },
          "allOf": [
            {"if": {"properties": {"status": {"const": "APPROVED"}}}, "then": {"required": ["path", "sha256"]}},
            {"if": {"properties": {"status": {"const": "PENDING"}}}, "then": {"required": ["path", "sha256", "reason"]}},
            {"if": {"properties": {"status": {"const": "MISSING"}}}, "then": {"required": ["reason"]}}
          ]
        },
        "canvas_custody": {
          "type": "object",
          "required": ["source_canvas_px", "validation_canvas_px", "mask_canvas_px", "transform", "anchor"],
          "properties": {
            "source_canvas_px": {"type": "integer", "minimum": 1},
            "validation_canvas_px": {"const": 64},
            "mask_canvas_px": {"const": 64},
            "transform": {"type": "string", "minLength": 1},
            "anchor": {"type": "string", "minLength": 1},
            "normalization": {"type": "string"}
          }
        }
      }
    },
    "geometry": {"type": "object"},
    "cost": {
      "type": "object",
      "required": ["generations_quoted", "generations_charged"],
      "properties": {"generations_quoted": {"type": "number"}, "generations_charged": {"type": "number"}}
    },
    "custody_validator": {
      "type": "object",
      "required": ["scoring_status", "gc4_mask_containment", "gc5_offmask_pixels_changed", "gc6_layer_order", "gc8_determinism"],
      "properties": {
        "scoring_status": {"enum": ["SCORED", "UNSCORED"]},
        "unscored_reason": {"type": ["string", "null"]},
        "gc4_mask_containment": {"enum": ["PASS", "FAIL", null]},
        "gc5_offmask_pixels_changed": {"type": ["integer", "null", "string"]},
        "gc6_layer_order": {"enum": ["PASS", "FAIL", null]},
        "gc8_determinism": {"enum": ["PASS", "FAIL", null]},
        "extracted_layer_sha256": {"type": ["string", "null"]},
        "recomposed_sha256": {"type": ["string", "null"]}
      }
    },
    "human_verdicts": {
      "type": "object",
      "required": ["semantic_gate", "heading_fidelity", "cross_facing_recognizability", "semantic_drift", "temporal_stability", "north_star_alignment"],
      "properties": {
        "semantic_gate": {"enum": ["PASS", "FAIL", "NOT_RUN"]},
        "heading_fidelity": {"type": "string"},
        "cross_facing_recognizability": {"type": "string"},
        "semantic_drift": {"type": "string"},
        "temporal_stability": {"type": "string"},
        "north_star_alignment": {"enum": ["Aligned", "Intentional interim gap", "Refresh candidate", null]}
      }
    },
    "custody": {
      "type": "object",
      "required": ["raw_output_location", "base_sha256", "candidate_sha256", "mask_sha256"],
      "properties": {
        "raw_output_location": {"type": "string"},
        "base_sha256": {"type": "string"},
        "candidate_sha256": {"type": "string"},
        "base_pixel_sha256": {"type": "string", "description": "SHA-256 over canonical dimensions followed by decoded RGBA bytes"},
        "candidate_pixel_sha256": {"type": "string", "description": "SHA-256 over canonical dimensions followed by decoded RGBA bytes"},
        "chrome_canvas_decode": {
          "type": "object",
          "required": ["status", "differing_rgba_bytes"],
          "properties": {
            "status": {"enum": ["PASS", "FAIL", "NOT_RUN"]},
            "differing_rgba_bytes": {"type": ["integer", "null"]},
            "note": {"type": "string"}
          }
        },
        "mask_sha256": {"type": "string"},
        "raw_output_sha256": {"type": "array", "items": {"type": "string"}},
        "committed_sha256": {"type": "array", "items": {"type": "string"}}
      }
    },
    "verdict": {"enum": ["WIN", "LOSE", "INCONCLUSIVE"]},
    "verdict_reason": {"type": "string", "minLength": 1}
  },
  "allOf": [
    {
      "if": {"properties": {"verdict": {"const": "WIN"}}},
      "then": {
        "required": ["status", "generation", "custody_validator", "human_verdicts", "custody"],
        "properties": {
          "status": {"const": "FINAL"},
          "generation": {"properties": {"approved_mask": {"properties": {"status": {"const": "APPROVED"}}}}},
          "custody_validator": {"properties": {"scoring_status": {"const": "SCORED"}, "gc4_mask_containment": {"const": "PASS"}, "gc5_offmask_pixels_changed": {"const": 0}, "gc6_layer_order": {"const": "PASS"}, "gc8_determinism": {"const": "PASS"}}},
          "human_verdicts": {"properties": {"semantic_gate": {"const": "PASS"}}}
        }
      }
    }
  ]
}
```

The `WIN` condition is intentionally fail-closed: it requires FINAL status,
approved mask, SCORED custody, GC4/GC6/GC8 PASS, GC5 exactly zero, semantic PASS,
and complete human fields. A missing mask must still prevent GC4/GC5 PASS.
