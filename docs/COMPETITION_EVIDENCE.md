# WebMCP Challenge implementation record

This file records when ArchMorph was created, what was built during The WebMCP Challenge submission period, and where a judge can verify the work.

## Project status

- **Devpost App Status:** New
- **Submission period:** August 25, 2026 at 11:00 a.m. Pacific through September 3, 2026 at 1:00 p.m. Pacific
- **First repository commit:** `be5eca4` on August 26, 2026 at 11:58:27 a.m. PKT (`2026-08-26T06:58:27Z`)
- **Conclusion:** the repository's first commit is after the official submission period began. ArchMorph is not being entered as a pre-existing project.

The official Devpost page and rules remain authoritative for dates and eligibility.

## Timestamped implementation history

| Commit | Date (PKT) | Evidence |
| --- | --- | --- |
| `be5eca4` | Aug 26 | Shared human-agent studio, canonical model, first WebMCP catalog, SVG plan, 3D model, and deployment integration |
| `6935278` | Aug 26 | Site orientation and WebMCP debug runner |
| `d9b4dbe` | Aug 26 | Interactive 3D walkthrough |
| `4df1c01` | Aug 26 | Opening validation and editing reliability |
| `60157b3` | Aug 27 | Architecture engine, persistence, import/export, regression coverage, and expanded WebMCP tools |
| `433207e` | Aug 27 | Shared workflow, vertical circulation, stairs, glazing properties, and current registration lifecycle |
| `f78db0c` | Aug 27 | Product research and architecture roadmap |
| `4e74bef` | Aug 27 | Opening deletion and Walk Mode improvements |
| `af42b8a` | Aug 28 | Multi-floor Walk Mode rendering and spatial regression coverage |
| `1bafe0c` | Aug 29 | Orthogonal polygon rooms, facade finishes, rotated stairs, and entrance-route evidence |
| `95edbf9` | Aug 29 | Stable orbit view state |

Run `git log --reverse --date=iso-strict --format='%h %ad %s'` to inspect the source timestamps directly.

## WebMCP evidence paths

- `src/lib/webmcp-tools.ts`: 40 named, schema-bounded tools.
- `src/app/components/Studio.tsx`: signal-scoped `document.modelContext.registerTool()` lifecycle and the shared human/agent commit path.
- `src/lib/architecture.ts`: canonical operation, inspection, topology, metric, circulation, and validation logic used by tools and UI.
- `src/types/webmcp.d.ts`: local type boundary for the draft imperative API.
- `scripts/webmcp-regression.ts`: deterministic catalog and representative execution checks.
- `evals/webmcp-journeys.json`: repeatable agent-selection and end-to-end journey fixtures.
- `docs/WEBMCP_TESTING.md`: native-client smoke procedure and result log.
- `docs/assets/webmcp-native-final-n06-2026-08-29.png`: native version-matched 3D snapshot from the completed N06 run.
- `docs/assets/webmcp-native-final-n06-ui-2026-08-29.jpg`: visible ChatGPT in-app browser evidence for the completed 3D/stair state.

## Product evidence paths

- `docs/assets/archmorph-plan.png`: shared architectural plan editor.
- `docs/assets/archmorph-3d.png`: synchronized Three.js building view.
- `docs/assets/archmorph-validation.png`: evidence-oriented layout validation.
- `docs/assets/archmorph-webmcp.png`: debug-only view of the registered 40-tool catalog.
- `fixtures/recovered-modern-house.archmorph.json`: importable demonstration project.
- `scripts/architecture-regression.ts`: deterministic domain regression suite.

## Public artifacts

- Application: https://archmorph-studio.musfk.chatgpt.site
- Repository: https://github.com/Yousafkhanzadaa/ArchMorph
- Demo video: pending public YouTube upload

## Freeze policy

After the submission deadline, the submitted repository, live site, video, and Devpost entry should remain unchanged until judging ends. Continued development should happen in a separate fork or branch that is not linked from the submitted entry.
