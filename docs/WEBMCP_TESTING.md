# WebMCP testing and evaluation

This document separates deterministic application tests from native client testing. Passing the local harness proves the architectural operations and catalog shape; it does not by itself prove that a compatible browser discovered and invoked the page-scoped tools.

## Automated checks

Run:

```bash
npm run test:architecture
npm run test:webmcp
```

The architecture suite covers canonical geometry, topology, hosted openings, circulation, multi-floor stairs, polygon rooms, persistence, migration, and spatial collision data. The WebMCP suite checks catalog count and categories, unique/spec-compatible names, bounded top-level schemas, concise definitions, annotations, successful inspection and mutation, and non-destructive argument failure.

## Native client prerequisites

1. Use the current ChatGPT in-app browser or the Chrome version and flag specified by the official challenge instructions.
2. Open the public ArchMorph URL, not a source-code preview.
3. Confirm the production UI loads without `?debug=1`.
4. Confirm the client discovers 40 ArchMorph tools.
5. Record the client name, exact version/model when visible, date, and result below.

## Native smoke suite

Start from a new project unless the case says otherwise. Stable IDs must come from inspection results rather than being invented.

| ID | Prompt / action | Expected tool behavior | Required evidence |
| --- | --- | --- | --- |
| N01 | “Inspect this project and summarize the plot, floors, and current issues.” | `inspect_project` | Plot dimensions, stable floor IDs, metrics, validation count, and project version |
| N02 | “Inspect the active floor and its circulation.” | `inspect_floor` → `inspect_circulation` | Stable room/wall/opening IDs plus reachable/disconnected rooms |
| N03 | “Add a 12 by 14 ft living room inside the buildable envelope, then validate.” | Inspect first → `create_room` → `validate_layout` → `focus_element` | Created room ID/dimensions, new version, visible room, validation result |
| N04 | “Add a correctly hosted exterior window and set it to low-e glazing.” | Inspect room/walls → `add_window` → `set_window_properties` | Host wall ID, opening ID, SHGC/VT/U-factor, visible plan and 3D update |
| N05 | “Create an upper floor and a connected stair, then verify circulation.” | `create_floor` → inspect → `add_stairs` → `inspect_circulation` → `validate_layout` | Source/target floor IDs, derived stair geometry, stair route evidence |
| N06 | “Show the result in 3D, focus the stair, and capture a snapshot.” | `switch_view` → `set_camera` or `focus_element` → `take_snapshot` | UI visibly changes; snapshot metadata identifies current project version |
| N07 | Supply a nonexistent wall ID to an opening command. | Opening tool fails without a mutation | Specific error; unchanged project version and element counts |
| N08 | Start a capture/export and cancel it if the client exposes cancellation. | Execution observes the abort signal where supported | Safe cancellation; no partial model mutation |
| N09 | Make a direct human edit, then ask the agent what changed. | Fresh inspection reads the human edit | Agent reports the updated shared state without reloading |
| N10 | Navigate away or close the page after discovery. | Registration signal cleanup removes page-scoped tools | Tools no longer remain available for the closed/navigated page |

## Evaluation fixtures

[`../evals/webmcp-journeys.json`](../evals/webmcp-journeys.json) contains machine-readable purpose, selection, argument, sequence, failure, and collaboration cases. Placeholder IDs such as `<floor-id>` mean the agent must resolve the real value through inspection.

For each fixture, record:

- selected tool or tool sequence;
- arguments actually supplied;
- whether the expected visible state change occurred;
- result fields and project version;
- any unexpected tool selection, retry, or silent approximation; and
- pass/fail with a short note.

## Result log

| Date | Environment | Scope | Result | Notes |
| --- | --- | --- | --- | --- |
| 2026-08-29 | Local vinext build and debug harness | Catalog plus deterministic domain/tool execution | Pass | `test:architecture`, `test:webmcp`, lint, and production build completed successfully |
| 2026-08-29 | Codex in-app browser, localhost | UI load, fixture import, plan/3D/validation/debug views | Pass for UI; native discovery not claimed | Local page displayed 40-tool harness; native browser API availability must be checked on deployed origin |
| 2026-08-29 | Codex in-app browser, public deployment | Public access, production UI, metadata, debug isolation | Pass for deployment; native discovery unavailable | App and `/og.png` returned HTTP 200; production metadata resolved correctly; this Codex browser did not expose `document.modelContext` |
| — | ChatGPT in-app browser, public deployment | N01–N10 | Pending | Record exact client/model and outcomes before submission |
| — | Chrome WebMCP configuration, public deployment | N01–N10 | Pending | Optional second-client evidence |

## Failure discipline

- Never replace an invalid stable ID with a guessed visual target.
- Never silently clamp dimensions unless the tool schema or result explicitly documents it.
- A rejected mutation must leave the canonical project unchanged.
- Read-only tools must not create activity entries or increment the project version.
- Debug harness success must not be described as native WebMCP success.
