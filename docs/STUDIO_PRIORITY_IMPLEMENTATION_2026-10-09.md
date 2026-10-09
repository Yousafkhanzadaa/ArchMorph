# Studio priority implementation · 9 October 2026

The P0/P1 work from the homeowner and architectural review is implemented. Land setup comes first, the user chooses the layout, and the existing architectural model and tools remain available.

## Delivered

- New-home setup collects land dimensions, access orientation, and editable planning setbacks. The example creates a separate home.
- A compact overview, room-based element browser, collapsible architectural properties, and simpler tool rail give the canvas more space. Independent walls and measurements remain under More and retain their shortcuts.
- Plan, 3D, and Walk have their own controls. The active floor stays visible; area summaries identify floor versus whole-home scope and display units. Floor cutaway is a visible toggle beside the active-floor selector in 3D, remains on when the camera angle changes, and fits on mobile. Walk has onscreen movement controls and room entry.
- Plan supports zoom and pan, all four resize corners, opening movement along a host wall, and keyboard equivalents. Rejected numeric edits show the operation's explanation and retain the canonical value.
- Aligned rectangular neighbors support one atomic shared-boundary adjustment. Both rooms, hosted openings, exterior features, and wall finishes are preserved or the operation is rejected. Undo restores both rooms together.
- Room connections from the main entrance can be inspected and highlighted schematically. Findings are grouped by concern with readable room context and expandable architectural evidence.
- Window operation and type are consistent. Bedroom escape checks require an operable exterior window and known unobstructed clear dimensions; nominal frame dimensions cannot establish the clear opening. Unknown clear dimensions remain unverified.
- Local saves report success or failure explicitly. Revision guards and Web Locks serialize library mutations across tabs. Conflicts preserve the live draft and offer a separate copy, recovery of the latest saved home, or JSON export.
- Up to eight named checkpoints per home survive reloads, with a restore comparison and no silent eviction. Undo, Redo, and checkpoint restore create a new revision while preserving the current display mode. Temporary view changes do not create design Undo entries.
- SVG export removes editing handles, selection accents, and connection overlays; fits the whole active-floor site; embeds project/version/floor metadata; and supplies standalone drawing styles. Plan PNG capture retains the current viewport.
- Mobile drawers hide their controls when closed and return focus when dismissed. Tablet backdrops appear only for a panel displayed as a drawer.
- The studio guide explains the actual browser-agent connection and preserves the developer tool catalog. The original 57 studio tools remain, with one additive shared-boundary tool.

## Verification

Passed: `test:architecture`, `test:webmcp`, `test:model`, `test:studio`, TypeScript checking, ESLint, production build, and `git diff --check`.

The new regression suite exercises simultaneous writers, stale activity saves, quota/unavailable/corrupt storage, immutable checkpoint limits, monotonic restores, four corner anchors, horizontal and vertical compound boundaries, retained opening hosts, facade identities and finishes, clear-window uncertainty, and human/agent geometry parity.

Browser checks used synthetic homes on a separate localhost origin. Verified land setup; example creation; overlap rejection with inline feedback; checkpoint persistence, preview, restore, Undo and Redo; grouped browsing; Plan/3D/Walk transitions; onscreen walking (camera movement observed); clean SVG output from a selected, zoomed plan; and real two-tab save conflict recovery with both designs retained. Checked 390, 768, 1024, 1280, and 1440 pixel layouts, plus the default viewport. Mobile focus recovery and hidden-panel focus exclusion were checked. No console errors were reported during the final interaction checks.

Preview: [verified studio](verification/studio-priority-preview.jpg).

The visible cutaway follow-up passed TypeScript, ESLint, model regression, production build, and desktop/mobile interaction checks. Its toggle reveals the active floor, preserves cutaway through camera changes, restores the whole-house view when disabled, and creates no design Undo entry. At 390 pixels the toolbar fits without horizontal overflow. Preview: [visible floor cutaway](verification/floor-cutaway-visible.jpg).

This follow-up's isolated production run logged a vinext RSC prefetch setup error (`TypeError: f is not a function`). The cutaway and camera interactions completed successfully; the production prefetch issue remains unresolved. The earlier console check above refers to the development-server verification.

## Bounds and later work

Existing multistorey rooms, irregular polygons, independent walls, doors/windows, stairs, roof/parapet, site boundary/gate, balconies/terraces, facade features, finishes, validation, agent tools, and JSON/SVG/PNG exports are retained.

Shared-boundary editing is deliberately limited to complete aligned rectangular edges. Connection highlights describe topology; they do not calculate travel distance or clearance. Usable-area estimates retain their documented simplifications. Checks remain concept guidance rather than permit or structural certification.

Storage remains local to the browser. Browsers without Web Locks retain revision checks but lack a guarantee against truly simultaneous writes. Checkpoints are bounded local copies; JSON exports remain individual-project backups. Touch hardware and a formal accessibility audit were not available for this verification.

The illustrated PDF concept report, a semantic open-connection model, and further construction-analysis systems remain later work. They have not been represented as implemented. The build completes with the existing large-chunk advisory and vinext route-classification limitation.

No deployment, commit, or push was performed.
