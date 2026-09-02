# ArchMorph User Experience Audit

**Audit date:** September 1, 2026  
**Product:** ArchMorph — Human + Agent Architecture Studio  
**Audit type:** Expert UX review, interaction walkthrough, responsive review, accessibility review, and implementation cross-check

## Executive summary

ArchMorph has a strong product idea and an unusually coherent desktop visual identity. The landing page communicates a distinctive “human + agent” proposition, while the studio successfully keeps the floor plan, 3D model, walkthrough, metrics, properties, validation, and agent activity connected to one visible project. The contextual inspector and issue-to-element navigation are especially effective foundations.

The current experience is best described as a polished desktop prototype rather than a broadly usable production editor. Three issues should be resolved before widening access:

1. Core authoring controls disappear at common laptop widths, and the studio is clipped on mobile.
2. The drawing and 3D surfaces are pointer-only, with incomplete accessible names and state semantics around them.
3. View changes such as focusing an element, changing floors, or entering Walk Mode are treated as project edits, so they increment the project version, fill the activity feed, and occupy Undo/Redo history.

No P0 crash or data-loss defect was found. No console errors or warnings appeared during the audited 2D, 3D, and Walk Mode journeys. The original local project was restored to version 263 after testing.

### Overall assessment

| Area | Assessment | Summary |
| --- | --- | --- |
| Product proposition | Strong | Memorable, differentiated, and demonstrated visually |
| Desktop visual design | Strong | Cohesive architectural language and clear canvas hierarchy |
| Core spatial workflow | Promising | 2D, 3D, metrics, properties, and checks reinforce one another |
| Learnability | Needs work | Tool names are hover-dependent and first-run guidance is minimal |
| Feedback and recovery | Mixed | Autosave, toasts, and Undo exist, but their mental model is unclear |
| Accessibility | High-risk | Core canvas interactions are not keyboard operable; states and dialogs are incomplete |
| Responsive behavior | High-risk | Creation controls disappear at 1,180 px; mobile is horizontally clipped |
| Content clarity | Mixed | Strong architectural detail, but some technical IDs, tiny copy, and duplicate issues remain |

## Audit scope and method

The review covered:

- Landing page at `/`
- Main studio at `/studio`
- Optional WebMCP developer view at `/studio?debug=1`
- Project switcher, local project list, blank-project state, autosave messaging, import/export entry points
- Floor plan, room selection, element properties, floor navigation, metrics, tool rail, and status messaging
- History and validation panels, including issue-to-element navigation
- 3D Orbit and Walk Mode, including camera controls, minimap, and instructions
- Responsive behavior at 1,280 × 720, 1,024 × 768, and 390 × 844
- Keyboard semantics, focus behavior, target sizing, dialog behavior, live feedback, and canvas operability
- Relevant implementation in `Studio.tsx`, `FloorPlan.tsx`, `ModelView.tsx`, `globals.css`, `architecture.ts`, and `persistence.ts`

The review did not assess professional architectural correctness, code compliance, structural accuracy, or certified energy performance. It did not create, delete, or geometrically modify project elements.

## What works well

### 1. The product story is distinctive and immediately visual

The landing hero connects the product claim to an animated architectural model instead of relying on generic marketing copy. The live dimension, layer controls, drawing references, and transition between plan/structure/envelope reinforce that ArchMorph is an architectural tool rather than a general 3D playground.

### 2. The desktop workspace has a strong information hierarchy

The four-part layout—tool rail, library, canvas, inspector—matches the user’s mental model:

- choose an operation;
- place or inspect something in the model;
- see immediate spatial feedback;
- refine exact properties.

The metric strip keeps net floor area, gross area, and open site area visible without dominating the design surface.

### 3. Selection connects plan geometry to exact properties

Selecting a room highlights it in the plan, adds a dimension, shows an explicit selection footer, and opens room-specific fields. This creates strong visual continuity between “what I clicked” and “what I am editing.” Stairs, openings, balconies, walls, and façade features receive similarly contextual inspectors.

### 4. 2D, 3D, and Walk Mode feel like views of one project

The model changes mode quickly, retains relevant selection context, and makes the active floor visible. Walk Mode’s floor/room minimap is particularly useful because it gives users orientation inside an otherwise abstract first-person scene.

### 5. Validation is actionable and appropriately scoped

Findings include a problem, a suggestion, and a route to the affected element. The persistent disclaimer correctly frames the checks as geometric preflight rather than permit, structural, or code approval.

### 6. Local persistence and project portability are present

The project menu supports new, duplicate, import, export, and delete. The interface identifies projects as local to the device, and imported projects are isolated under a new project ID. These are solid foundations for trust and recoverability.

## Prioritized findings

### P1 — High impact

#### P1.1 Core authoring controls disappear at common laptop widths

At 1,024 × 768, the entire library panel is hidden. The canvas and inspector remain, but users cannot choose a room type or footprint, switch floors through the visible floor list, add exterior systems, change the default façade palette, or configure stair placement. The tool rail still exposes “Place room,” but it does not provide the room type or shape controls that define the result.

At 390 × 844, the studio has a 760 px minimum width while page overflow is hidden. The result is a clipped editor with the inspector and right-side actions inaccessible. The responsive landing page still invites users to enter the studio, so there is no expectation-setting or device gate.

**Evidence:** `.library-panel` is set to `display: none` at 1,180 px; the studio is forced to a 760 px minimum below 980 px. Browser testing confirmed no visible room picker at 1,024 px and a 760 px-wide shell inside a 390 px viewport.

**Recommendation:**

- Convert the library and inspector into collapsible side drawers below approximately 1,200 px.
- Keep floor switching and the active tool’s options permanently reachable.
- Provide a purposeful tablet layout; for narrow mobile, either support a review-only mode or show a clear “desktop editor required” handoff before entry.
- Add responsive acceptance tests for 1,440, 1,280, 1,024, 768, and 390 px widths.

#### P1.2 The core canvas is not keyboard operable

The floor plan is exposed as a single `role="img"`. Rooms, walls, openings, stairs, resize handles, and vertices use pointer handlers but have no roles, focus targets, or keyboard equivalents. The Three.js canvas is likewise not focusable and offers no keyboard route for selecting model elements. A keyboard user can reach the surrounding controls but cannot perform the product’s central task.

The tool rail compounds this problem: its visible labels are hidden with `display: none` until hover. In the accessibility tree, the buttons are announced primarily as shortcut letters (“V,” “R,” “W,” and so on), not “Select and move,” “Place room,” or “Draw wall.”

**Recommendation:**

- Give every tool an explicit `aria-label` containing its action and shortcut.
- Provide a keyboard-accessible element/layer tree that can select rooms, walls, openings, stairs, and exterior systems.
- Support keyboard movement and resizing in documented increments, with modifiers for fine/coarse adjustment.
- Expose selection, coordinates, dimensions, validation state, and committed changes through live regions.
- Treat the graphical plan as an enhanced representation of an accessible model, not the only interaction surface.

#### P1.3 View navigation pollutes project history and Undo/Redo

Opening a validation issue, focusing an element, switching 2D/3D, entering Walk Mode, changing camera, and switching floors all pass through the same commit pipeline as geometry edits. Each action can increment the project version, autosave, add history entries, and occupy an Undo step. In testing, clicking a validation finding immediately enabled Undo even though no design geometry had changed.

This weakens confidence in both version numbers and recovery. A user pressing Undo after a room edit may first undo several camera or navigation actions. The History panel becomes dominated by “switched to 3D,” “set camera,” “focused,” and “opened floor” events rather than meaningful design decisions.

**Recommendation:**

- Separate persistent model operations from ephemeral presentation state.
- Keep geometry/property mutations in project version history.
- Store view mode, camera, focus, selection, and active floor in session/UI state, or in a separate non-undoable presentation history.
- If shared presentation actions must be visible to an agent, label them as session events and do not mix them with design Undo.

#### P1.4 Critical interface text is too small for sustained use

Many headings, field labels, hints, status messages, validation details, project metadata, and tool shortcuts are rendered at 7–9 CSS pixels. This is difficult to scan even on a high-density desktop display and becomes especially problematic for low-vision users, browser zoom, and longer sessions.

**Recommendation:**

- Use 12 px as an absolute minimum for secondary UI text and 14 px for normal body/field text.
- Reserve smaller type only for nonessential diagram annotation that can zoom with the canvas.
- Rebalance panel widths and spacing instead of using extremely small type to preserve density.
- Verify WCAG 2.2 AA contrast after the type scale is raised.

#### P1.5 First-run guidance does not adequately teach the interaction model

The blank plan says “Choose a room type, then click inside the site,” which is a useful start, but the room library begins below several site and exterior sections and is partly below the fold at 720 px height. The tool rail depends on hover to reveal action names, there is no visible shortcut guide, and the studio has no Help, guided tour, example loader, or obvious route back to product documentation.

**Recommendation:**

- Present a short first-project checklist: configure site, place first room, add openings, add a floor/stair, validate, inspect in 3D.
- Add a prominent “Place your first room” action that selects the room tool and scrolls/focuses the relevant controls.
- Offer “Start blank” and “Load example residence” choices.
- Add a Help/shortcuts panel reachable from the header and `?` key.

### P2 — Medium impact

#### P2.1 Validation duplicates are hard to distinguish and resolve

Six “DOOR BLOCKED BY STAIR” findings appeared with the same visible title, message, suggestion, and stair ID. The affected door or adjacent room is not named. Clicking a finding does focus an element and open Properties, but it removes the issue list from view, so users lose their place and cannot see whether they selected the first, fourth, or sixth duplicate.

The focus confirmation also exposes an implementation ID for stairs (`focused stair-5fc20cde`) instead of a human-readable label.

**Recommendation:** Group repeated findings by root cause, show affected floor/room/door names, provide “Next issue,” and keep a compact issue context visible in Properties. Use labels such as “Ground-to-First stair” instead of raw IDs.

#### P2.2 3D navigation instructions conflict

The in-canvas Orbit hint says pan uses right-drag, while the bottom status bar says Shift-drag. Both may work, but conflicting instructions create hesitation and undermine learnability.

**Recommendation:** Use one canonical instruction string everywhere and show alternatives only when verified, for example “Pan: right-drag or Shift-drag.”

#### P2.3 Active state semantics are incomplete

The view switch uses visual classes but no `aria-pressed` or tab semantics. The Properties/History/Checks control is visually a tab set but lacks `tablist`, `tab`, `tabpanel`, and `aria-selected`. Assistive technology cannot reliably determine the current view or inspector tab.

**Recommendation:** Implement proper toggle-group and tab patterns, including arrow-key navigation for tabs and programmatic relationships to their panels.

#### P2.4 Dialog and feedback behavior is incomplete

The project menu and developer console use `role="dialog"`, but do not set `aria-modal`, move focus into the dialog, trap focus, return focus on close, or close on Escape. Testing confirmed Escape does not close the project menu. Toasts have no `role="status"` or `aria-live` and disappear after 2.6 seconds, so screen-reader users may miss successful saves, errors, validation results, and focus changes.

In Walk Mode, the toast can overlap the persistent walkthrough instruction bar at the bottom of the canvas.

**Recommendation:** Adopt an accessible popover/dialog pattern, support Escape and outside-click dismissal where safe, add `aria-live="polite"` for routine status and `role="alert"` for blocking errors, and reserve non-overlapping feedback space.

#### P2.5 Export behavior changes silently with the current view

The top-bar Export button downloads SVG in 2D but JSON in 3D. The project menu Export always downloads JSON. A separate icon captures PNG. These format rules are not visible before activation and are difficult to predict.

**Recommendation:** Open a single export menu with explicit choices: Project JSON, Floor plan SVG, Current view PNG. Show the filename, format, and current project version before download.

#### P2.6 History is too noisy for design review

The History panel is a single newest-first feed of up to 100 human and agent events. It has no filter, grouping, search, version comparison, or geometry-only mode. Repeated window/door additions and presentation changes quickly obscure meaningful milestones.

**Recommendation:** Group by session and version, separate “Design changes” from “View activity,” add actor/type filters, and allow users to inspect or restore a specific design version.

#### P2.7 Dense plan labels collide with geometry

In the tested residence, labels and annotations around Stair Landing, Upper Hall, Common Bathroom, door swings, and stair geometry compete for limited space. Name truncation is based mainly on character count rather than available rendered width, so compact rooms can still overflow or visually collide.

**Recommendation:** Add label collision/fit logic, prioritize room name over area/size at low zoom, allow manual label offsets, and add a declutter toggle.

### P3 — Lower impact / polish

- Use “1 stair” rather than “1 stairs” in the 3D sync status.
- Increase the mobile landing page’s secondary CTA and layer-control hit areas; several are only about 16–19 px high.
- Add last-saved time and clarify whether “Save” is needed when every committed change already autosaves.
- Make the studio brand a route back to the landing/help surface or add a clear product menu.
- Give destructive element deletion a stronger selected-state warning or a short undo snackbar with an explicit Undo action.
- Preserve validation context when navigating to an element, rather than always replacing the issue panel with Properties.
- Label the camera and snapshot icon controls visibly at narrower desktop sizes instead of relying only on tooltips.

## Journey review

### Landing to studio

**Works:** Clear primary CTA, differentiated visual demo, credible product metrics, and responsive stacking on mobile.  
**Friction:** Small secondary controls, no explicit device requirement, and no direct explanation of local-only persistence before users enter.

### Starting a blank project

**Works:** A real site is present immediately; the empty plan gives a direct instruction; metrics start at understandable zero values.  
**Friction:** The next action is below the fold, no guided sequence exists, and exterior controls are presented before the first room even though several of them require a host wall.

### Creating and editing a plan

**Works:** Room presets, snapping, exact property fields, selection highlighting, live areas, and synchronized geometry are strong.  
**Friction:** The canvas is pointer-only, panel typography is very small, global shortcuts are not taught, and invalid numeric entries reset silently on blur instead of explaining the allowed range.

### Reviewing validation

**Works:** Severity, explanation, suggestion, and click-to-focus are all valuable.  
**Friction:** Duplicates lack location/identity, selecting an issue removes list context, and focusing creates a project history/Undo entry.

### Exploring in 3D and Walk Mode

**Works:** Fast mode switching, model synchronization summary, architectural camera presets, contextual selection, and minimap orientation.  
**Friction:** Conflicting pan instructions, tiny status copy, “1 stairs” grammar, pointer-only 3D selection, and overlapping bottom feedback.

### Managing projects and exports

**Works:** Local project list, duplicate, import, export, and destructive confirmation for project deletion.  
**Friction:** The menu is not keyboard-complete, autosave versus manual Save is unclear, and Export format depends on the active view.

### Agent/developer workflow

**Works:** The developer surface clearly separates registered tools and recent calls, labels READ/WRITE, displays shared-state changes, and keeps model version visible.  
**Friction:** The 57-tool catalog is visually dense, the dialog is not modal/focus-managed, mutation-capable tools are executed from the same generic runner without a stronger write-state warning, and labels use 6–8 px text.

## Recommended delivery plan

### Phase 1 — Make the current product safely usable

1. Separate model history from navigation/view state.
2. Replace the hidden laptop library with drawers and add a mobile/read-only gate or responsive editor.
3. Add explicit accessible names/state to tools, view controls, tabs, dialogs, and toasts.
4. Raise the UI type scale and target sizes.
5. Make export formats explicit.

### Phase 2 — Improve first-session success

1. Add blank/example project entry choices and a first-project checklist.
2. Add visible tool names at first use, a shortcuts/help panel, and contextual instructions.
3. Reorder or progressively reveal exterior systems after host geometry exists.
4. Improve inline numeric validation and recovery messaging.

### Phase 3 — Support professional review workflows

1. Group and localize validation findings; preserve issue context while editing.
2. Add history filters, design milestones, and version comparison/restore.
3. Improve label collision handling and plan decluttering.
4. Add an accessible element tree and keyboard movement/resizing controls.

## Acceptance criteria for the highest-priority fixes

- At 1,024 px width, every authoring capability available at 1,280 px remains reachable without changing URL or using a keyboard shortcut.
- At 390 px width, the product either provides a usable review/edit layout or clearly blocks entry with an intentional desktop handoff; no essential UI is clipped behind hidden overflow.
- A keyboard-only user can choose a tool, select an existing element, inspect its properties, change an exact value, validate, undo the change, and export.
- Tool buttons announce descriptive names and current state; view and inspector controls announce the active option.
- Escape closes project and developer dialogs, focus is managed correctly, and status/error feedback is announced.
- Switching floors, focusing an element, changing camera, entering Walk Mode, and switching 2D/3D do not increment the design version or occupy model Undo steps.
- Export always presents explicit format choices before download.
- Routine interface text is at least 12 px and normal field/body text is at least 14 px, with WCAG 2.2 AA contrast.

## Final assessment

ArchMorph already demonstrates the hardest part of the concept: one understandable architectural model shared across human editing, agent actions, validation, and presentation. The next UX milestone is not more modeling capability; it is making that capability reachable, legible, and predictable. Fixing responsive access, keyboard operability, and history semantics would materially improve trust and move the product from an impressive demo toward a dependable design tool.
