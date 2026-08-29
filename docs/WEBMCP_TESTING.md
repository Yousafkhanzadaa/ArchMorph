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
| 2026-08-29 | ChatGPT desktop 26.814.41407 (build 6720), Codex in-app browser, public deployment | Public access, production UI, metadata, native prerequisite check | Blocked before N01; native discovery unavailable | The normal URL loaded without `?debug=1`, but `"modelContext" in document` was `false` and `typeof document.modelContext` was `"undefined"`; no Chrome browser was connected |
| — | ChatGPT in-app browser, public deployment | N01–N10 | Pending | Record exact client/model and outcomes before submission |
| — | Chrome WebMCP configuration, public deployment | N01–N10 | Pending | Optional second-client evidence |

## Native verification attempt — 2026-08-29

- **Public URL:** `https://archmorph-studio.musfk.chatgpt.site/` (no query string and no debug harness)
- **Host application:** ChatGPT desktop 26.814.41407, build 6720
- **Browser surface reported by the client:** Codex In-app Browser
- **Native prerequisite:** unavailable — `"modelContext" in document === false` and `typeof document.modelContext === "undefined"`
- **Alternate permitted environment:** unavailable — the browser runtime reported `Browser is not available: chrome`, so Chrome 149+ with the WebMCP testing flag could not be selected
- **Discovered ArchMorph tool count and names:** unavailable; the client exposed no native page-tool discovery surface. The deterministic catalog still contains 40 tools, but that result is not native-discovery evidence.
- **Project protection:** the already-open project was observed only. No destructive native sequence began, so no disposable project was created and the user's project was not changed.
- **Visible production result:** the saved multi-floor project rendered normally in the plan editor. Screenshot: [`assets/webmcp-native-production-2026-08-29.jpg`](assets/webmcp-native-production-2026-08-29.jpg).

| ID | Prompt | Selected native tool / sequence | Arguments and returned result | Version before / after | Visible result | Outcome |
| --- | --- | --- | --- | --- | --- | --- |
| N01 | Inspect this project and summarize its plot, floors, area metrics, and current validation issues. | None available | Not supplied; native discovery unavailable | Not read / unchanged | Production editor loaded | Blocked — prerequisite absent; not executed |
| N02 | Inspect the active floor and analyze its entrance-to-room circulation. | None available | Not supplied; native discovery unavailable | Not read / unchanged | No test mutation | Blocked — prerequisite absent; not executed |
| N03 | Add a 12 by 14 ft living room inside the buildable envelope, validate the design, and focus the new room. | None available | Not supplied; native discovery unavailable | Not read / unchanged | No test mutation | Blocked — prerequisite absent; not executed |
| N04 | Add a correctly hosted exterior window to the new room and set it to the low-e glazing preset. | None available | Not supplied; native discovery unavailable | Not read / unchanged | No test mutation | Blocked — prerequisite absent; not executed |
| N05 | Create an upper floor, connect it with a valid straight stair, inspect circulation, and validate the layout. | None available | Not supplied; native discovery unavailable | Not read / unchanged | No test mutation | Blocked — prerequisite absent; not executed |
| N06 | Switch to 3D, focus the stair, and capture a snapshot. | None available | Not supplied; native discovery unavailable | Not read / unchanged | No test mutation | Blocked — prerequisite absent; not executed |
| N07 | Use a deliberately nonexistent wall ID with an opening command. | None available | Not supplied; native discovery unavailable | Not read / unchanged | No test mutation | Blocked natively; deterministic invalid-host regression passes without mutation |
| N08 | Start a snapshot or export operation and cancel it if the client exposes cancellation. | None available | Not supplied; the client exposed neither native tools nor cancellation | Not read / unchanged | No test mutation | Blocked, not N/A — native discovery itself was unavailable |
| N09 | Make a small direct human edit, then ask: “What changed in the current project?” | None available | Not supplied; destructive setup was not started | Not read / unchanged | Existing project preserved | Blocked — prerequisite absent; not executed |
| N10 | Record the discovered tools, navigate away or close the page, and check whether its page-scoped tools remain available. | None available | No discovered tools to test for cleanup | Not read / unchanged | Production tab retained for evidence | Blocked — prerequisite absent; not executed |

Source review during this attempt found that the registration adapter did not forward the native execution context to tool implementations. Snapshot and export now receive the client's `AbortSignal`, stop before output/download work when already aborted, and re-check cancellation after asynchronous plan rendering. Automated coverage also asserts that a nonexistent window host leaves the complete project and version unchanged. These are deterministic regression results only; they do not convert the blocked native matrix into passes.

## Failure discipline

- Never replace an invalid stable ID with a guessed visual target.
- Never silently clamp dimensions unless the tool schema or result explicitly documents it.
- A rejected mutation must leave the canonical project unchanged.
- Read-only tools must not create activity entries or increment the project version.
- Debug harness success must not be described as native WebMCP success.
