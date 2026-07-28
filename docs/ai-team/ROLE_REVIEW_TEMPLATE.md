# AI Team Role Review Template

Copy this template into a new file under `docs/ai-team/proposals/`. Do not edit another participant's proposal.

## Proposal metadata

- **Author/model:**
- **Date:**
- **Repository/ref inspected:**
- **Tools or interfaces available during review:**
- **Confidence:** High / Medium / Low

## 1. Independent assessment

Complete this section before reading the other proposals.

### Repository needs

Briefly identify the recurring kinds of work this repository actually requires. Cite repository evidence where practical.

### Proposed allocation

| Agent | Primary responsibilities | Secondary responsibilities | Should not own alone | Confidence and basis |
| --- | --- | --- | --- | --- |
| Claude Code | | | | |
| Gemini | | | | |
| ChatGPT | | | | |
| Kimi K3 | | | | |

### Owner and authority boundaries

State which decisions should remain owner-only, which may be delegated per task, and which reviews should remain advisory by default.

### Workflow proposal

Describe the smallest useful workflow from task intake through implementation, evidence, review, and acceptance. Do not require every agent on every task.

### Failure and fallback rules

Cover at minimum unavailable agents, conflicting advice, self-review, uncertain repository facts, and urgent low-risk changes.

## 2. Cross-review

Complete this section after the independent assessment.

### Agreements

Identify substantive points shared with other proposals.

### Disagreements

For each material disagreement, state the competing positions, your reasoning, and whether the owner can decide now or a trial is preferable.

### Factual corrections

Identify repository, architecture, tooling, or authority claims that appear incorrect or stale. Cite evidence.

### Missing considerations

Identify material responsibilities, risks, costs, or workflow constraints omitted from the other proposals.

## 3. Capability evidence

Classify important role claims:

| Claim | Agent | Observed / Inferred / Untested | Evidence or proposed trial |
| --- | --- | --- | --- |
| | | | |

Do not present general model reputation as repository evidence.

## 4. Recommended trials

Propose only small trials that could change the role decision. For each, specify the task, evidence to retain, evaluation criteria, and whether the trial changes repository state.

## 5. Recommended initial charter

Provide a concise first-release role matrix with:

- a primary and backup for important domains;
- an independent reviewer where warranted;
- explicit approval and merge boundaries;
- provisional assignments labelled as provisional; and
- a review date or evidence threshold.

## 6. Dissent and uncertainty

Record any conclusion you do not support, unresolved uncertainty, and what evidence would change your mind.
