# ArchMorph: homeowner usability, interface noise, and architectural understanding

**Review date:** 9 October 2026, Asia/Karachi  
**Scope:** Analysis of the current local checkout and live localhost studio. Recommendations only.  
**Purpose:** Help someone imagine, arrange, experience, refine, and communicate a future family home before working with a professional architect.

For decisions, start with the [assessment](#1-assessment) and [sequenced roadmap](#10-sequenced-roadmap-and-release-gates). The [19 findings](#5-findings-and-proposed-behavior) contain evidence, proposed behavior, retained capability, dependencies, and verification. The [calculation inventory](#7-what-archmorph-really-calculates-today), [illustrated PDF proposal](#8-proposal-an-optional-illustrated-home-concept-pdf), and [observed task review](#11-small-observed-task-review-and-proposed-homeowner-study) provide the deeper architectural and research detail.

## 1. Assessment

ArchMorph already contains the essential foundation of the product its creator wanted: one house model that a person and an agent can understand and change, with a plan, exterior model, architectural walkthrough, measurements, and checks that stay connected. The recent presentation work makes that foundation easier to believe. The next milestone should make it easier to use.

The central problem is that the interface asks the homeowner to manage the architectural model's vocabulary before it helps them answer a question about their home. A person wants to make a bedroom larger, put a doorway somewhere sensible, understand the route upstairs, or see whether the entrance feels right. The studio presents rooms, generated wall segments, coordinates, host selectors, opening configuration, roof settings, site settings, and calculations with similar visual weight. The model has useful depth; its everyday interface needs a clearer order.

The recommendation is to keep the depth and change when it appears. Start with rooms, their connections, the current floor, and a clear route into 3D. Show a small contextual editor for the selected object. Make detailed architectural information available through explicit disclosure, focused checks, and a future illustrated concept report. Relevant dimensions and findings must remain available during a decision; a PDF cannot substitute for that immediate understanding.

Three priorities stand out:

1. **Make experimentation trustworthy.** Prevent stale saves from replacing newer work, distinguish durable checkpoints from session Undo, and correct the bedroom escape-opening heuristic before promoting its results in a report.
2. **Make everyday editing direct and calm.** Treat rooms as the main objects, stop suggesting that generated room walls are independently deletable, simplify opening controls, and give Plan, 3D, and Walk appropriate surrounding controls.
3. **Make architectural information understandable and communicable.** Name the floor or whole-house scope of every area, explain centreline versus estimated usable area, translate findings into practical questions, and eventually export one coherent version of the home with its assumptions.

These recommendations retain the strengths of the current work. They do not call for a new modelling engine, a rendering rewrite, furniture, decorative interiors, or a larger permanent tool palette.

## 2. Method, evidence, and boundaries

The repository was reviewed at its current uncommitted state. Live interface observations used temporary hidden browser tabs at 1280 × 720, 1024 × 768, and 390 × 844. The loaded project was **Modern East-Facing Residence (Imported) Copy**, showing one floor, design version 1 in export/render metadata, 942 sq ft of centreline room area, 978.25 sq ft gross area, and nine warnings. It was not replaced with the Aurora sample.

The Aurora fixture was evaluated separately in Node memory. All experimental geometry and persistence checks used synthetic projects or cloned repository fixtures and a mocked in-memory localStorage. No geometry test was performed on the saved house. Live actions selected objects, opened menus, changed presentation modes, and inspected layout; they did not add, move, resize, delete, validate-and-save, import, or restore design data. Temporary viewport overrides were reset and the review tabs were closed.

Evidence labels used below:

- **Observed:** Visible current interface behavior or DOM-render diagnostics.
- **Reproduced:** An isolated in-memory result from current repository functions.
- **Code-inferred:** Behavior or risk established by reading the implementation, without provoking it in the user's saved project.
- **Proposal:** A suggested interaction or capability. Its usability benefit still needs homeowner testing.
- **Historical:** Earlier evidence retained with its original limitations, not presented as a new observation.

The three current regression suites passed: architecture, WebMCP, and 3D presentation. That verifies their existing coverage; it does not establish complete architectural correctness, device performance, or novice usability. No captured warning/error console entries appeared during the reviewed live interface transitions. There was no build, deployment, commit, application edit, or dependency installation.

**Inspection limitation:** Automatic approval review rejected the complete-project WebMCP inspection because this chat began through a delegated request and it required direct authorization here to retrieve the private model. Direct authorization was requested. The denied tool was not replaced with a hidden-state extraction. The report instead uses permitted interface observations, repository analysis, fixture calculations, and isolated tests. No live agent mutation journey was executed.

The report evaluates concept-design behavior, not the suitability of this particular house for construction. Implemented thresholds are reported as software assumptions, not verified local regulations. Human comfort, privacy, and spatial understanding require real participant testing; no homeowner study results are invented here.

### What the older audit no longer describes accurately

The September audit remains useful historical context, but several of its highest-priority findings have changed:

| Earlier concern | Current evidence | Consequence for this review |
| --- | --- | --- |
| View changes consume design Undo and versions | Studio separates presentation operations from the design commit path; live view changes left Undo disabled and version metadata unchanged | Preserve this separation |
| Library disappears at laptop widths | At 1024 px, Open design library opens a usable drawer, including Levels | Reachability is improved; review discoverability and focus |
| Mobile studio has a forced 760 px minimum | Current 390 px workspace fits the viewport and opens an inspector drawer | Do not repeat the old clipping claim |
| Tools and states lack names | Current tools, views, tabs, and menus have descriptive accessible names/state | Remaining concern is complete keyboard and touch workflows |
| Invalid numeric ranges reset silently | NumberField has inline range errors and restores an invalid range value | Still verify operation-level rejection and draft-value feedback |
| Opening a finding loses issue context | Current Properties retains a selected-issue card, previous/next, and All checks | Keep that behavior; simplify the card's content |
| History competes with Properties and Checks | History is now a compact dropdown beside Undo/Redo, with filters and session restore | This is already a good noise reduction |

## 3. The homeowner purpose and what should be retained

The creator's story should govern the product definition. The problem began with trying to express a family home through paper and Figma without enough architectural knowledge to judge relationships, dimensions, circulation, setbacks, or how the finished house would feel. The product's value is participation and understanding during that early stage.

The research roadmap currently lists architects first and clients participating in a guided conversation later. The landing page leads with WebMCP-native, 57 agent tools, canonical state, and exact geometry. Those are meaningful engineering achievements, but they describe the mechanism more strongly than the homeowner benefit. This is a framing drift from the original purpose, not a newly discovered target audience.

A suitable practical promise is: **“Explore the home you want to build. Arrange rooms, see the house, walk through it, and develop the idea with an AI before discussing it with an architect.”** Professional users can still benefit. The default interface should be understandable without professional vocabulary.

Retain these foundations:

- The shared canonical model and the same operation path for human and agent changes.
- Automatically derived room walls, adjacency, and real hosted openings.
- Overlap prevention and useful snapping/alignment, while improving previews and explanations.
- Exact dimension entry alongside direct manipulation.
- Connected floors and stairs represented consistently in plan, model, circulation, and Walk.
- Issue-to-element navigation and preserved issue context.
- Local portability through JSON, explicit SVG/PNG exports, and concept-stage limitations.
- The current upright cameras, closed cutaway wall caps, restrained finishes and small textures, contact shading, bounded site context, stair landing guards, mesh batching, cached shadows, adaptive pixel budgets, and rendering only when needed.
- The compact History dropdown and the separation of viewing from design edits.

The current focus view demonstrates that a calmer experience is attainable with the existing renderer. Its value is the space it gives to the building, not an additional visual effect.

## 4. A calm default workspace

### Default arrangement

Use one familiar workspace with three views: **Plan, 3D, Walk**. “3D Orbit” can remain in navigation help, while “3D” communicates the destination more simply. Avoid adding a parallel beginner application or duplicating the architectural model.

The persistent header should answer four questions: which home is open, which floor or building scope is being shown, whether work is saved on this browser/device, and how to Undo or export it. Keep History compact. A connected assistant entry belongs here only when there is an actual supported connection; a decorative chat button would create another promise the product cannot fulfill.

In **Plan**, give the canvas most of the space. Keep a visible current-floor selector and a short Add menu for rooms, doors/windows, and stairs. Measure and independent walls remain available in a secondary tools menu. Show room names by default; show dimensions and area when selecting or measuring. The room library may stay open during repeated placement and close once that task ends. Make it easy to pin for people who prefer it.

With **nothing selected**, show a compact home summary or an unobtrusive prompt. Offer Site settings and Area details explicitly. Do not automatically fill the inspector with boundary wall, gate, parapet, glazing, and coordinate decisions. Initial site dimensions and access orientation are useful; all their technical settings do not need to stay open afterwards.

With **something selected**, show its name, the dimensions needed for the current action, and a few contextual actions. Offer “More architectural details” in that same panel. Progressive disclosure must remain predictable and keyboard accessible; avoid several levels of nested drawers.

In **3D**, use the existing focus presentation as the default starting point. Keep camera views, Whole house/Floor cutaway, floor selection when relevant, Fit, and capture available. Open properties on explicit inspection. Enter an editing view through a clear Edit in plan action rather than leaving a room-placement rail permanently beside an orbit camera.

In **Walk**, keep the current room/floor, minimap, a clear exit, and brief movement help. Show measurements or a finding when the person asks. Avoid a permanent whole-home metric strip during a doorway or room-scale judgment. Returning to Plan should preserve the useful design context.

These defaults are proposals to test, not evidence that every homeowner prefers collapsed panels. Pinned panels and detailed information should remain available without exposing engineering debug controls in normal use.

### Intended journey and concrete examples

| Moment | Homeowner question | Intended interaction | Architectural depth retained |
| --- | --- | --- | --- |
| Begin | “How do I start my home?” | Continue a saved home, open an example, or start with approximate plot dimensions; unknown setbacks are clearly marked as assumptions | Exact site configuration, orientation, and setbacks remain editable |
| Arrange | “I want my parents' bedroom beside the family living room.” | Place and name a bedroom, drag it beside the living room, see the shared edge and a connection prompt | Canonical walls, exact coordinates, dimensions, and adjacency |
| Connect | “Put a door between these rooms.” | Choose the shared edge, preview a door, then adjust its position or swing visually | Wall host, centre offset, width, height, hinge/handing semantics |
| Revise | “Can this bedroom be one foot wider?” | Preview the new boundary; identify the adjacent room that limits the change; offer a controlled alternative | Overlap protection; later, an atomic two-room boundary adjustment |
| Experience | “What will it feel like to enter?” | Look at the arrival view, then enter a named room in Walk; maintain a clear orientation back to the plan | Eye-height assumption, door geometry, floor height, route and collision model |
| Review | “What needs attention?” | See a few grouped practical findings and focus each affected room | Full evidence, implemented thresholds, counts, and unmodelled alternatives |
| Recover | “I preferred yesterday's arrangement.” | Open a named durable checkpoint or duplicate; preview before restoring as a new revision | Session Undo, activity attribution, original snapshot and revision identity |
| Communicate | “What should I take to my architect?” | Export an editable backup now; later export an illustrated concept report with unresolved questions | Geometry, schedules, units, assumptions, findings, versioned images |

An agent should support this sequence with plain-language intent and visible results: “Making the bedroom wider would take space from the hall. Here are the proposed dimensions of both.” It should not require the homeowner to discover wall IDs or infer a host from a coordinate list.

## 5. Findings and proposed behavior

Priority meanings: **P0** addresses loss of work or materially misleading guidance before wider experimentation/report claims. **P1** belongs in the next usable homeowner milestone. **P2** follows that foundation. A priority is relative product sequencing, not a claim that the house has a particular safety defect.

### F01. The first-use story emphasizes the mechanism and teaches an unnecessary wall step

**Evidence and location — Observed + code-inferred:** The landing page foregrounds WebMCP, agent-tool count, canonical state, and exact geometry. Studio's blank-state second step says “Add walls, doors, and windows,” although creating rooms generates their boundary walls. The blank state already includes Choose a room and Load example residence; those should be retained. A new blank house was not created in the live saved project. [E1, E2]

**Homeowner burden:** A newcomer must translate the product story into a family-home task and may draw duplicate independent walls around a room that already has walls. Suggesting another floor in the four-step introduction also makes a single-storey idea seem incomplete.

**Proposed behavior:** Lead with the home-design promise. Teach: add rooms; arrange their sizes and connections; see/walk through the house; review questions. Say explicitly that room walls appear automatically. Introduce another floor only when needed. Explain local saving at first use in one sentence.

**Retain:** Live architectural hero, example project, agent connectivity, independent-wall capability, and technical documentation.

**Priority / dependencies / verification:** P1; content and initial-state flow, without schema changes. In a novice study, at least four of five participants should begin a room-based concept without looking for a separate boundary-wall drawing step. Verify the example entry never replaces a saved home without a clear project choice.

### F02. The unselected inspector asks too many questions at once

**Evidence and location — Observed:** At 1280 px, both side panels remain open. The unselected Properties view starts a long project-site form: plot, orientation, façade palette, parapet, boundary/gate, setbacks, and area schedule. The left panel simultaneously offers ten room types and a footprint-shape choice. [E3]

**Homeowner burden:** The person cannot tell which inputs are prerequisites for arranging a home. Repeated section headings, separators, small labels, and numbers increase scanning even when no architectural decision is being made.

**Proposed behavior:** Show a compact home summary when unselected. Put site configuration behind a named action; introduce dimensions/access first and expand technical groups when asked. Keep a small contextual inspector for the selected element. Preserve optional panel pinning and remembered disclosure choices.

**Retain:** Every current architectural property, exact input, area calculation, and keyboard access. Collapsing a control must not remove it from agent tools or exports.

**Priority / dependencies / verification:** P1; information hierarchy, responsive layout, focus handling. A homeowner should be able to identify the next room-layout action without reading roof or boundary settings. Compare task success and hesitations, not simply the number of visible controls.

### F03. Generated walls appear to be independently editable objects

**Evidence and location — Observed + reproduced:** Draw wall is a primary rail tool. Selecting a generated shared wall shows a Delete button. The underlying operations reject independent movement and deletion of room-controlled walls. A synthetic touching-room test reproduced “Canonical room-boundary walls are controlled by their rooms.” Aurora's ground-floor list contains 76 elements, including 38 wall segments. [E4, E5]

**Homeowner burden:** The visible affordance and the model disagree. “Remove this wall between living and dining” seems reasonable, but the interface directs the person to an action that cannot succeed. Segment-level browsing also makes a house feel like an object-management exercise.

**Proposed behavior:** Use rooms as the default browser hierarchy. Put their openings and boundaries beneath them, and independent walls in a separate group. For generated walls, explain which rooms control the boundary and offer relevant room-edit or opening actions. Hide or replace the unsupported Delete action. Name the secondary drawing tool “Independent wall” with a short explanation.

**Retain:** Canonical shared walls, adjacency inspection, exterior finish overrides, precise independent walls, and a full searchable element list for detailed work.

**Priority / dependencies / verification:** P1 for truthful affordances and grouping; P2 for genuinely removing a room boundary through a new open-connection model. Verify every visible action is supported, generated geometry cannot be corrupted, and a homeowner can locate a bedroom's doorway without scrolling through all walls.

### F04. Room revision is constrained by a corner gesture and isolated room operations

**Evidence and location — Code-inferred + reproduced:** Rectangular rooms have one resize handle at the far corner. That changes width and length with the origin fixed. Pointer preview and commit are distinct; the canonical operation prevents overlaps at release. Increasing a synthetic 12 × 14 ft Living room to 13 × 14 beside Kitchen was rejected for a 14 sq ft overlap, leaving the original design unchanged. No corresponding saved-house edit was attempted. [E5, E6]

**Homeowner burden:** “Make this room wider” becomes a diagonal gesture, and “give this room some of its neighbor's space” needs several manual steps in the correct order. A visually plausible preview can end in a toast and a reset. Protection is valuable; the explanation arrives too late.

**Proposed behavior:** First add directional edge/corner handles and a clear preview of the affected dimension. Highlight the limiting neighbor during an invalid drag and say what prevents it. Keep exact size entry. Later introduce a bounded shared-boundary adjustment: preview both room dimensions and areas, preserve hosted openings where valid, and commit both rooms atomically. Do not silently shrink a neighboring room.

**Retain:** Non-overlap guarantees, orthogonal polygons, alignment/snapping, and exact dimensions. Keep complex vertex editing in detailed tools.

**Priority / dependencies / verification:** P1 for handles and feedback; the coordinated operation belongs in the next stable milestone after durable recovery. Dependencies include topology remapping, opening preservation, minimum geometry, compound Undo, and human/agent parity. Test a one-foot transfer between adjacent rooms; either the entire change succeeds once or neither room changes, with a specific explanation.

### F05. Moving a doorway requires technical interpretation instead of a direct gesture

**Evidence and location — Observed + code-inferred:** The inspected door exposes eight controls: offset, width, height, host wall, hinge side, handing, swing, and state. Its host selector has 39 eligible wall entries in this live project, including repeated façade labels. Opening pointer handling selects but does not start a move gesture. [E7]

**Homeowner burden:** Moving the door a little means understanding a centre offset measured from an unseen wall start. A person must distinguish Start/End, Left/Right, and Inward/Outward to express a familiar visual choice.

**Proposed behavior:** Make along-wall drag the normal repositioning action, with valid endpoint/overlap limits and an exact-position fallback. Show width and visual “Flip hinge” / “Change swing side” controls next to a plan preview. Keep height and host/semantic fields under details. Make “Move to another wall” an explicit pick-a-wall action with a compatible-host preview, rather than a default long list.

**Retain:** Exact centre offset, host validity, all canonical door semantics, open/closed model state, rehosting, plan/3D synchronization, and keyboard numeric movement.

**Priority / dependencies / verification:** P1; hosted-opening preview, pointer/touch capture, orientation consistency, and shared operation parity. A novice should move a door along its wall and identify its swing without using host-wall vocabulary. Verify rehosting never silently changes width or picks a distant similarly named wall.

### F06. Window controls mix a homeowner decision with glazing engineering inputs

**Evidence and location — Observed + code-inferred:** The inspected window exposes eleven inputs: four geometry values, host, type, operation, glazing preset, SHGC, visible transmittance, and U-factor. Type and operability are separate state fields and separate selectors. Current window creation defaults to fixed/non-operable. The implementation does not automatically reconcile type with operability in the shown change handlers. [E7, E8]

**Homeowner burden:** “I want this window to open” can require more than one decision; choosing a non-fixed type alone may leave ventilation credit unchanged. SHGC and U-factor invite decisions before the person knows the room's basic size, opening position, or need for daylight and air.

**Proposed behavior:** Lead with size, position, height above the floor, and whether/how it opens. Use consistent operating presets that keep canonical type and operability coherent. Explain the natural-ventilation effect near that choice. Put glazing presets and the three numerical inputs under “Glazing details”; continue to identify them as concept assumptions. Do not present an arbitrary default as a locally recommended product.

**Retain:** Sill height, host and cardinal facing, exact values, rated-product overrides when supplied, glazing definitions, and ventilation assumptions.

**Priority / dependencies / verification:** P1; canonical invariant/migration decisions, visible operation preview, and F07. Selecting Fixed must yield zero openable area; selecting an opening type must have a predictable operability state in UI, checks, exports, and agent operations. Test understanding with homeowners rather than merely collapsing the fields.

### F07. The bedroom escape-opening check can give misleading reassurance

**Evidence and location — Reproduced + code-inferred:** On a cloned Aurora fixture, all windows were set to fixed and non-operable. Validation returned 14 ventilation warnings and **zero bedroom escape warnings across five bedrooms**. The escape predicate checks nominal width × height, sill height, and minimum nominal dimensions, but does not require operability or actual unobstructed clear opening geometry. [E8]

**Homeowner burden:** A person may assume that absence of a bedroom warning means an escape opening was demonstrated. It was not. This is a correctness issue, separate from interface noise.

**Proposed behavior:** Correct the predicate to reject fixed/non-operable candidates and describe the present size check as a concept proxy. Add actual clear-opening data or conservatively report “clear opening not verified” when the model cannot establish it. State which software assumptions apply; do not label a window code-compliant. Retain a direct route to the affected bedroom/window.

**Retain:** Early escape-opening guidance, exterior/courtyard host reasoning, sill/size evidence, and architect review questions.

**Priority / dependencies / verification:** P0 before stronger check claims or illustrated findings reports. Dependencies: F06 invariants, explicit nominal-versus-clear dimensions, and regression coverage. Fixed windows must not satisfy the concept escape test; missing clear-opening evidence must remain distinguishable from a measured failure and from professional approval.

### F08. Touching rooms, connected rooms, and open-plan areas need different meanings

**Evidence and location — Code-inferred:** Canonical walls establish adjacency; circulation graph edges use doors and valid stairs. Opening kind is door or window. There is no explicit doorless passage, removed shared boundary, or program zone within an open room. Changing a room's name does not change its type-driven checks. [E9]

**Homeowner burden:** Two rooms beside each other can look related without being reachable. A family living/dining area cannot be represented faithfully simply by deleting its generated divider. A hall named through Custom has different checking semantics from a habitable room, which needs explanation.

**Proposed behavior:** First show the distinction in context: “Beside Kitchen” versus “Connected to Kitchen by this doorway.” Reuse the existing graph for a focused entrance-to-room route explanation. Later add an explicit open passage and, if needed by actual layouts, zones within a larger open space. These should be architectural model features, not rendering tricks.

**Retain:** Exact adjacency, door and stair connectivity, graph evidence, room-program checking, and simple room placement.

**Priority / dependencies / verification:** P1 for explaining existing relationships and routes; P2 for new passage/zone semantics. Dependencies include topology, wall cutouts, collision geometry, daylight/ventilation attribution, schedules, and agent tools. Test an entrance → living → hall → bedroom route, plus an open living/dining concept; plan, Walk, graph, and checks must agree.

### F09. Floors and stairs are powerful but their everyday navigation and assumptions are too indirect

**Evidence and location — Observed + code-inferred:** The Levels panel contains the floor list, Add, storey height, and stair placement. It remained reachable through a drawer at 1024 px. A floor selector appears in the 3D toolbar specifically for cutaway, while the normal Plan footer reports the active floor. Connected straight, L-shaped, and U-shaped stairs, floor re-levelling, tread/riser derivation, stairwell voids, approach checks, and Walk transitions exist. The reviewed live home had one floor and no stairs, so a live inter-floor walk was not tested; regression tests and source establish the implementation. [E10]

**Homeowner burden:** Switching floors is a frequent action hidden inside a management panel. Creating a floor can seem sufficient even before there is a usable stair route. “Storey height” can be interpreted as the clear ceiling height experienced inside a room, although it is a floor-to-floor modelling value and rendered slabs introduce their own assumptions.

**Proposed behavior:** Keep current-floor selection visible in Plan and cutaway. When adding a floor, guide the person to connect it with a staircase and show its footprint/approach on both levels. Offer a bounded stair-placement preview and a small “what changes upstairs” explanation when height changes. Summarize rise, tread/riser assumptions, and approaches after selecting a stair; expand detailed geometry on request. Explain floor-to-floor versus interior clearance.

**Retain:** All three stair types, exact geometry, rotation/turn/run controls, linked-floor presentation, upper openings, landing guards, and detailed validation. Visual guards must not imply certified guard or handrail compliance.

**Priority / dependencies / verification:** P1 for floor access, guidance, and definitions; later explicit ceiling/slab and headroom modelling requires a schema milestone. Test two floors with each stair type in isolated copies: both plans and Walk must show a usable arrival, and a height change must either recompute coherently or explain a rejected opening/approach constraint. Headroom, structural support, and local requirements remain outside current certification.

### F10. Exterior systems should appear when judging the exterior, in an architectural order

**Evidence and location — Observed + code-inferred:** Façade finishes, flat-roof parapet settings, boundary wall/gate controls, and setbacks are prominent in unselected Properties. Balcony/terrace and façade-feature actions also exist in Exterior. Disabled boundary walls still leave gate configuration visible. The presentation site adds bounded planting and approach context outside the canonical design and area schedule. [E3, E11]

**Homeowner burden:** The interface mixes land constraints, architectural form, envelope appearance, and presentation context. A person may tune a gate before understanding the house mass, or mistake illustrative approach paving for designed circulation evidence.

**Proposed behavior:** Introduce exterior review through the arrival/elevation view. Organize controls as building form/openings, exterior finish, roof/parapet, balconies/terraces, and boundary/access. Show each technical group on explicit selection or expansion. Keep site constraints separately understandable. Offer the current restrained finish choices rather than an expanded decorative catalog. Hide irrelevant gate detail when the boundary feature is off, while keeping its saved settings.

**Retain:** Current façade presets and wall overrides, hosted canopies/sunshades/frames, parapets, bounded railings, gate geometry, exact parameters, and site-context toggle. Mark context as illustrative in captured views.

**Priority / dependencies / verification:** P1 for grouping and feature-state disclosure; P2 for additional architectural roof/forms only after core usability. A homeowner should distinguish a building opening from a façade feature and an assumed setback from a presentation planting. Verify context toggling leaves all canonical metrics and project geometry unchanged.

### F11. Plan, 3D, and Walk inherit more surrounding editing UI than they need

**Evidence and location — Observed:** Normal 3D retained room templates, drawing tools, and an eight-control door inspector. Selecting from Browse before switching to 3D produced a close view of the selected opening; Fit restored the building view. On the 1280 px layout, the 3D toolbar crowded into the inspector boundary. Focus view then removed both sidebars and the rail, making the cutaway substantially easier to read. Walk retained the general metric toolbar. Its initial foyer view faced the exterior doorway; the minimap identified the room and direction. [E12]

**Homeowner burden:** The person must manage interface state to see the home clearly. A selected object can unexpectedly dominate an exterior review. Tooltips, generic Select & move status, model counts, and repeated movement instructions compete with the spatial question. A walkthrough starting toward the outside may not explain how to explore the interior.

**Proposed behavior:** Make the current focus presentation the starting arrangement in 3D/Walk, with explicit inspection and Edit in plan. Keep Whole house versus selected-object framing clear. Offer a named entry room and an understandable starting direction, plus Return to plan and Reset position. Show a short movement hint once, then keep help available. Minimap, current room, floor, and requested dimensions should lead over global counts. Test this before changing camera optics.

**Retain:** Camera presets, upright perspective, orbit/pan/zoom, selection, cutaways, full-house framing, minimap, keyboard movement, drag-look fallback, and pointer-lock option. Preserve panel pinning for detailed review.

**Priority / dependencies / verification:** P1; presentation state, mode-specific controls, focus/layout transitions, and input handling. A novice should enter a named room, explain where they are, reach another room, and return to Plan without editing the design or using a debug tool. Compare impressions of room scale against plan dimensions: Walk uses a 68° field of view and a fixed 5.4 ft eye-height assumption, so perceived comfort is not itself a calculated result. Touch movement is not supplied by the current keyboard instructions; mobile Walk needs a defined supported path before being promised.

### F12. Area labels do not consistently reveal their scope or measurement basis

**Evidence and location — Observed + reproduced:** The same toolbar reports NET FLOOR, GROSS, and OPEN SITE in Plan, whole-house 3D, and Walk. The first two use the active floor; the last always relates to ground coverage. The unselected schedule says “Total net floor area” for the selected floor. Aurora's fixture gives 2,150 sq ft on the ground floor and 4,300 sq ft across both floors, while its estimated usable areas are 1,993 and 3,986 sq ft. At 390 px, the visible metric unit text disappears. [E13]

**Homeowner burden:** A whole-house image can be interpreted as a 2,150 sq ft home when the centreline sum is 4,300. “Net” can be read as usable internal space, although the implementation measures room polygons to wall centrelines. A number without a floor or unit is difficult to discuss confidently with family or an architect.

**Proposed behavior:** Attach scope and units to the number: “Ground floor · room layout area · 2,150 sq ft,” or “Whole home · gross area · 4,425.25 sq ft.” Use estimated usable area for a homeowner-facing internal-space summary only with a clear definition of the current estimator; retain centreline dimensions where geometry depends on them. Expose the complete measurement table on request. Keep ground-site metrics explicitly separate from upper-floor area.

**Retain:** All existing metrics, definitions, per-floor and building totals, exact numeric entry, and agent calculation tools. Do not silently reinterpret the canonical model when changing labels.

**Priority / dependencies / verification:** P1 before reports. Dependencies include one common measurement vocabulary, unit formatting, and scope selection. Switching the active floor must never change plot/open-site/ground-coverage values; a whole-house summary must equal the stated all-floor aggregate. Participants should correctly describe the difference between room layout area, estimated usable area, and gross footprint.

### F13. Checks are actionable but the list makes findings harder to understand than necessary

**Evidence and location — Observed:** The current home had eight ventilation warnings and one daylight warning. Each row included an uppercase machine-code title, a sequence count, full room/window/coordinate labels, the message, and suggestion. On a 390 px inspector, the first two findings consumed most of the screen. Selecting one preserved context above Properties with previous/next and All checks, which is an improvement. It selected the affected room, although resolving the ventilation warning requires reaching its windows. [E14]

**Homeowner burden:** A short practical question is buried beneath object inventory. Nine warnings can feel like nine independent design failures when eight share one assumption. A message saying there is no natural ventilation can also be overread as a total ventilation judgment when mechanical alternatives are not represented.

**Proposed behavior:** Translate titles into familiar actions/questions: “Review windows that open” and “Review daylight in Kitchen.” Group by concern or room, with a visible affected count and floor scope. Lead with cause, location, and next action; expand dimensions, related objects, rule code, and basis. Keep failures that block geometry/routes prominent. Phrase results as evidence from the current model and identify unmodelled alternatives. Provide a direct route to the relevant windows from the room finding. Do not clear or hide unresolved warnings simply to make the screen calmer.

**Retain:** Severity, exact evidence, suggestions, issue-to-element navigation, full issue count, selected-issue context, and concept-stage limitations.

**Priority / dependencies / verification:** P1, alongside the P0 correction in F07. Dependencies: stable concern/room grouping and selection context. A homeowner should explain why a warning appears and identify the next action without reading coordinates. Group totals must reconcile to the full report; “No issue detected” must describe the checks run, not certify the building.

### F14. A stale tab can replace newer local design work

**Evidence and location — Reproduced + code-inferred:** saveProjectLocally reads the library and replaces the matching project record without checking the writer's base revision. In mocked localStorage, saving a version-2 renamed project and then the old version-1 snapshot restored the older name/version. Studio has no corresponding storage-event conflict handling in the reviewed code. Explicit Validate also writes activity through noteActivity, so an apparently analytical action can save a stale snapshot. No two-tab overwrite was attempted on the user's real storage. [E15]

**Homeowner burden:** Local autosave looks reassuring but cannot protect against two tabs or a stale session. This undermines the confidence needed for experimentation and agent collaboration.

**Proposed behavior:** Save against an explicit immutable base revision. If the persisted revision changed, keep the user's attempted work recoverable and offer reload or save-as-copy; do not silently choose a winner. Detect external changes and show a clear state. Treat activity writes under the same guard. Address storage unavailability/quota errors with truthful saved/unsaved feedback. Merely comparing numeric versions is insufficient because current Undo restores old version numbers; a durable revision identifier must account for branching/restoration.

**Retain:** Immediate local saving, local-only project choice, JSON portability, shared human/agent commits, and a quiet normal saved indicator. Cloud infrastructure is not required for the first conflict safeguard.

**Priority / dependencies / verification:** P0. Dependencies: revision identity, save outcomes, draft recovery, and F15 checkpoint semantics. Synthetic two-tab tests must preserve both attempts, including a stale validation/activity write and a restore followed by a new branch. Simulate unavailable/full storage: the UI must never claim a failed write was saved. The current save function can return without writing when storage is unavailable, and a thrown write can occur after React's project state has been updated; both require deliberate error handling.

### F15. Session Undo, persisted activity, and durable recovery are different capabilities

**Evidence and location — Observed + code-inferred:** History is appropriately compact. The current loaded copy showed its persistent duplication activity while Undo/Redo were disabled. Design snapshots are stored in pastRef/futureRef, capped to 80 past entries, and cleared on replaceProject; the last five past snapshots are exposed for session restore. They are not persisted with the project library. Restoring a snapshot restores its old design version rather than creating a distinct new durable revision. [E16]

**Homeowner burden:** A history list may suggest that listed designs can be recovered after refreshing. They cannot be reconstructed from activity descriptions. A person cannot confidently compare today's concept with a preferred earlier arrangement without managing copies themselves.

**Proposed behavior:** Keep the current dropdown and its filters. Label existing restoration as session recovery until durable checkpoints exist. Add bounded named checkpoints for meaningful layouts, with a small preview/description and recoverable current state. Restore a checkpoint as a new revision, preserving provenance. Begin with explicit checkpoints and a small automatic safety buffer, rather than a large always-visible timeline.

**Retain:** Immediate Undo/Redo, activity attribution, current restore UI, project duplication, JSON backup, and presentation-state preservation when Undoing design changes.

**Priority / dependencies / verification:** P1 for honest labels; durable checkpoints are a gate for the next stable experimentation milestone. Dependencies: F14 revision/conflict rules, storage size bounds, migrations, and restore preview. Make a checkpoint, edit, reload, and recover it; then branch and export both states with distinct identities. Repeated view changes must still create no design Undo entries.

### F16. Feedback needs to explain the architectural consequence near the action

**Evidence and location — Code-inferred + observed interface structure:** Numeric range errors are inline, but valid-range values can still fail model operations such as overlap or hosted-opening fit. safeCommit surfaces those failures through a toast. Drag previews do not provide the same canonical constraint explanation before release. Current numeric fields commit on blur/Enter, and the selected rectangular dimension text appends feet/inch-looking punctuation to a decimal-foot value. [E6, E17]

**Homeowner burden:** A change can appear valid in the field or preview while the real model refuses it. Toasts are brief, disconnected from the affected edge/field, and on narrow screens the generic status explanation is hidden. Decimal feet dressed as feet/inches can be misread during exact work.

**Proposed behavior:** Show the limiting neighbor/host and a concise explanation beside the field or gesture. Clearly distinguish proposed, accepted, and rejected values; on rejection, retain a useful draft or restore the canonical value visibly. Give destructive changes an Undo affordance and communicate affected hosted elements. Use a consistent decimal-foot or genuine feet/inches formatter. Keep toasts for acknowledgment, not as the only architectural explanation.

**Retain:** Atomic rejection, precise dimensions, range validation, live announcements, and existing status/help. Avoid confirmation dialogs for every routine move.

**Priority / dependencies / verification:** P1; reusable operation outcomes and dimension formatting. Test a valid numeric range that still causes overlap, an opening too close to an end, and a fractional-foot dimension. Displayed geometry, canonical value, error explanation, and accessible announcement must agree. This field-rejection mismatch is a code-inferred risk, not a failure provoked on the saved design.

### F17. Responsive reachability has improved; legibility and focus still need work

**Evidence and location — Observed + code-inferred:** The 390 px studio fits its viewport, and both the library and Checks drawer are reachable. The two-row view switch is usable. However, room labels and dimensions are tiny in the whole-site plan, global area units and saved-time text are hidden, and controls rely increasingly on icons. At 1024 px the long project title visibly overlapped the view-switch region. After closing the library, the focused Close design library button remained off screen at x = −63 px; transformed-away panel content also remained in the accessibility tree. The Plan viewBox stays fitted to the whole plot; no ordinary pan/zoom interaction is represented in its drag states. [E18]

**Homeowner burden:** Being able to open a control does not mean being able to understand the home. Tiny room targets invite mistakes; keyboard focus can move into invisible controls. Touch users also cannot infer keyboard-only Walk movement from the current help.

**Proposed behavior:** Keep the drawers and remove hidden panels from keyboard/accessibility navigation when closed, restoring focus to the trigger. Resolve header/toolbar collision through responsive grouping and truncation. Retain visible measurement units. Add a deliberate 2D pan/zoom/navigation model compatible with room gestures. For narrow screens, prioritize review, selection, details, and supported dimension editing; defer promising complete touch authoring or Walk until their gestures are tested. Do not reintroduce a hard width gate based on the obsolete audit.

**Retain:** All current reachable controls, accessible labels/state, keyboard Browse, exact fields, desktop authoring, and 3D WebGL failure fallback.

**Priority / dependencies / verification:** P1. Test 1440/1280, 1024, 768, and 390 px, long names, zoomed browser text, keyboard-only navigation, and actual touch hardware. The hidden drawer must receive no focus; close must return focus visibly. Users must read a selected room's dimensions without zooming the whole browser. The broader accessible workflow remains to be validated; the current review is not an accessibility conformance audit.

### F18. Agent collaboration needs an understandable entry and a coherent unit of change

**Evidence and location — Observed + code-inferred:** Normal Studio keeps debug tooling hidden; the landing advertises the agent mechanism. Current suites verify 57 studio tools, including inspection, editing, calculation, presentation, and export. Human and agent mutations share commit, model validation, saving, and Undo. There is no ordinary embedded conversational assistant implemented in the reviewed components, and individual mutation calls are separate transactions. No multi-operation atomic batch or expected-base-revision field is present in the reviewed tool catalog. [E19]

**Homeowner burden:** “Let an agent help” does not explain how to connect or what the agent will do. A meaningful request such as changing two adjacent rooms can result in several separate saved changes and Undo steps. Tools alone do not establish that the assistant understood the family's intention.

**Proposed behavior:** Explain the supported connection path and availability in plain language. Offer contextual requests such as “Explain this finding” or “Help revise these two rooms” only through an actual connected agent. Have the agent inspect current state, explain the proposal's architectural consequence, and present the result with an easy return to the previous concept. Add bounded compound transactions for related edits after durable revision/recovery exists. Compare options on explicit request; avoid unsolicited redesigns.

**Retain:** Stable IDs, typed tools, compact inspection payloads, full detailed inspection on request, actor attribution, shared-state visibility, and debug catalog for engineering work.

**Priority / dependencies / verification:** P1 for a truthful assistance entry and explanation pattern; compound editing follows F14/F15 and topology safeguards. In an isolated session, human and agent requests should yield equivalent geometry/checks. An agent proposal must identify affected rooms/floors, use the latest revision, preserve rejected work, and be reversible as one meaningful action when compound transactions are introduced. The current live tool execution path was not tested because of the inspection authorization limitation.

### F19. Existing exports are useful backups and views; an illustrated concept report would complete the communication journey

**Evidence and location — Observed + code-inferred:** Export explicitly offers editable Project JSON, active-floor SVG, and current-view PNG. SVG requires Plan mode. Capture waits for 3D canvas metadata to match the current project/version/view/cutaway/site-context before capture. There is no PDF-generation implementation. The SVG serializer clones the current editor SVG and adds styles; a dedicated neutral reporting composition is not established. [E20]

**Homeowner burden:** A family or architect needs to understand the arrangement, intent, assumptions, and open questions without reconstructing them from files. A screenshot alone cannot establish room sizes or explain a finding. Conversely, the homeowner should not keep every detailed schedule on screen just to make it shareable later.

**Proposed behavior:** Keep the current exports. Add an optional “Home concept report” after revision identity and measurement definitions are dependable. Compose clean per-floor plans, selected exterior/cutaway views, architectural schedules, assumptions, findings, and questions from one frozen snapshot. Show a simple report preview and a few useful inclusion choices. The next section specifies its content and limits; this task does not implement it.

**Retain:** JSON round-trip backup, SVG portability, PNG capture, exact geometry, and current snapshot synchronization guards. A report supplements editable data; it is not a construction drawing package.

**Priority / dependencies / verification:** P2, after P0 correctness/recovery and P1 scope/units. Dependencies: immutable report snapshot, clean plan composition, view metadata, paginated layout, and legible output. Report totals must reconcile with that snapshot; every image and finding must represent the same revision. Generation must leave the user's current view, selection, and live design untouched.

## 6. Separate the kinds of noise

Calling all of this “visual clutter” would encourage superficial fixes. Different causes need different changes.

| Type | Current example | Appropriate response | What must remain |
| --- | --- | --- | --- |
| Visual noise | Two full panels, numerous separators/uppercase labels, metrics and hints around 3D | More canvas space, concise text, mode-specific controls | Discoverable details and optional pinned panels |
| Information overload | Unselected project-site form; full window/glazing fields; full finding evidence | Contextual disclosure and summaries | Full evidence, exact inputs, and definitions |
| Unnecessary decisions | Wall drawing after room creation; type and operability as unrelated choices; footprint before first simple room | Better defaults and coherent presets | Independent walls and irregular shapes for actual needs |
| Awkward gestures | One rectangular resize corner; opening selection without movement; no two-room revision operation | Directional handles, constrained opening drag, bounded compound editing | Constraint protection and exact numeric fallback |
| Unclear feedback | Active-floor numbers beside whole-house model; canonical-wall Delete; operation toast | Truthful affordances, scope labels, local constraint explanation | Checks, recovery, and limitations |
| Reliability/correctness | Stale local save; non-operable escape candidate; session-only restore points | Correct model/save contracts and regression coverage | Existing simplicity, with explicit save/restore identity |

Hide complexity when it is irrelevant to the task. Never hide a save failure, a rejected change, an unresolved architectural question, or the basis of a number that is being used to make a decision.

## 7. What ArchMorph really calculates today

“Full architectural numbers” should mean the numbers actually supported by this concept model, with definitions. It should not become a claim of full architectural analysis. The current model is substantially more than a drawing, but several quantities are geometric estimates or stored inputs rather than simulated physical performance.

| Quantity or finding | Current implementation and scope | Appropriate placement | Assumptions to state |
| --- | --- | --- | --- |
| Room width/length, position, polygon area, perimeter | Coordinates and orthogonal vertices in feet; polygon area/perimeter; irregular-room width/length are bounding dimensions | Selected room and measurement action; room schedule in report | Room boundary follows wall centrelines; bounding dimensions do not describe every local width in an irregular room |
| Selected-floor room layout area | Sum of non-courtyard centreline room polygons; current totalNetFloorArea is selected-floor despite “total” in the field name | Optional floor summary; area details and report | Does not mean finished internal usable space |
| Whole-building room layout area | Sum of non-courtyard centreline room areas across floors | Whole-house summary on request; report | Explicitly all floors; no independent subtraction of stairwell voids from these room sums |
| Estimated usable/carpet area | Per-room inset formula using average bounding-wall thickness, polygon perimeter and corner counts; summed per floor/all floors | Selected-room detail or clearly labelled internal-space summary; report | Uniform averaged inset estimate, not a surveyed per-edge finished-area model; varying thicknesses, narrow concave forms, finishes and void deductions need care |
| Gross covered area | Union of room footprints and axis-aligned room-controlled wall footprints on a floor; total sums the floors | Contextual area details and report | Concept built-up estimate; independent walls are excluded; balcony/terrace slabs are scheduled separately; not a certified statutory area measurement |
| Plot area and buildable envelope | Rectangular width × length; envelope derived from manually entered four setbacks | Site setup/constraint view; report | Inputs are assumptions until verified for the actual property; no jurisdiction lookup or surveyed irregular plot |
| Ground coverage and open site | Ground gross footprint ÷ plot area; open site is max(0, plot area minus ground gross footprint) | Site details; show during footprint decisions; report | Always ground scope, independent of active floor; upper overhangs, standalone site features and separate balcony/terrace accounting are not a complete land-use assessment |
| FAR/FSI | Sum of gross floor areas ÷ plot area | Detailed area schedule/report | Dimensionless concept ratio; exclusions/definitions may differ from applicable rules |
| Balcony/terrace area | Rectangular slab areas, separate per-floor and project sums | Selected exterior feature; report | Separate from the ordinary room/gross totals; overlapping slabs are not established as a legal area-accounting scheme |
| Exact distance | Straight, horizontal, vertical distance between coordinates or supported element anchors | Measure tool or selected relation; report when relevant | A direct geometric distance, not a traversable route length |
| Adjacency and circulation | Shared walls, door/stair graph, entrance reachability, route element/node paths | Contextual connection/route review; findings and report | Graph connectivity is not travel distance, corridor-width analysis, sightline analysis, accessible-route certification, or fire-escape approval; main-entrance choice is derived |
| Floors and stairs | Storey elevations/heights; linked-floor rise, flights, landings, riser count/height, tread depth; approach/clash findings | Selected floor/stair with a concise summary; detailed report | Concept assumptions, not structural stair design; headroom, full guard/handrail checks and project-specific construction details are not provided |
| Daylight proxy | Nominal exterior/courtyard-facing window width × height compared with 8% of room centreline area for relevant types | Room/window finding; evidence detail/report | Window-area ratio, not illuminance or daylight-factor simulation; VT does not turn this check into a daylight calculation |
| Natural ventilation proxy | Nominal window area × operability × type fraction, compared with 4% of relevant room area | Near window operation choice; findings/report | Fixed 0, casement 0.9, sliding 0.5, awning 0.6; airflow, cross-ventilation and mechanical systems are not simulated |
| Habitable-size proxy | 70 sq ft and 7 ft minimum of stored bounding dimensions for Living/Kitchen/Bedroom/Dining/Office | Relevant room finding; detailed report | Concept thresholds; bounding-box minimum can miss a narrow local portion of an irregular room; does not establish comfort or local compliance |
| Bedroom escape proxy | Nominal window area ≥ 5.7 sq ft, width ≥ 20 in, height ≥ 24 in, sill ≤ 44 in | Relevant finding with current limitations; report only with explicit uncertainty | Current operability omission is a verified defect; nominal dimensions do not establish actual clear escape size |
| Glazing performance values | SHGC, VT, U-factor and presets stored on openings | Glazing details and opening schedule | Concept inputs or user overrides; no energy-load, climate, room-temperature, or rated-product verification calculation |
| Roof, boundary, façade and presentation | Parametric geometry, presets, overrides, feature/host checks; optional presentation context | Relevant exterior view/detail; illustrated report | Visual and geometric concept model, not an assembly, drainage, structural, or thermal analysis |

### Verified Aurora example: scope changes the answer

These values were recomputed from **fixtures/aurora-house-30x95.archmorph.json**, migrated in memory, project version 80. They are sample evidence, not claims about the currently loaded private home.

| Measure | Ground floor | Whole building or site |
| --- | ---: | ---: |
| Centreline room layout area | 2,150 sq ft | 4,300 sq ft |
| Estimated usable/carpet area | 1,993 sq ft | 3,986 sq ft |
| Gross covered area | 2,216.5 sq ft | 4,425.25 sq ft |
| Plot area | Site scope | 2,850 sq ft |
| Open site | Ground footprint basis | 633.5 sq ft |
| Ground coverage | Ground footprint basis | 77.8% |
| FAR/FSI | All-floor gross ÷ plot | 1.553 |

The first pair alone illustrates why a whole-house model must not silently carry a selected-floor label. The centreline-versus-estimated-usable difference also matters before someone describes the amount of internal space to an architect.

### Canvas, contextual details, and report

**Canvas:** Keep the current floor, selected room name, dimensions needed for the action, snap/constraint preview, and a requested measurement. One compact floor/house area summary may be useful if its scope and definition are visible. Whole-house gross/usable area should be optional, rather than occupying every Walk view. Show relevant setback guides during site/footprint work. Use restrained route or finding highlights on demand.

**Contextual details:** Place opening width/position/operation, room area definition, relation to adjacent rooms, floor-to-floor height, stair approach/rise summary, glazing inputs, and the selected finding's evidence here. Explain why a number matters at the moment it is used. A bedroom's missing opening belongs beside that room even if all findings are also exported.

**Optional report:** Include all per-floor and whole-building area schedules, room/opening/stair schedules, site assumptions, complete findings, definitions, and unresolved architect questions. Do not make the person permanently keep them visible to preserve them.

Canonical project units are presently feet and square feet. A future display preference can support metric and/or genuine feet/inches without changing the stored geometry first. All views and exports must convert consistently, including offsets, sill heights, setbacks, and dimensional thresholds. Do not show 12.5 ft as though it means 12 ft 5 in; it is 12 ft 6 in. Changing the canonical unit system is a larger migration and should follow the display/formatting contract.

No current calculation establishes structural adequacy, local code compliance, construction readiness, real sun exposure, illuminance, thermal comfort, energy demand, privacy quality, acoustic behavior, or subjective spaciousness. The walkthrough helps a person inspect scale, sightlines, and routes; it does not calculate that a home is comfortable. Rendered sunlight is a fixed presentation light, not a site/date/time solar study. Walk renders doors open for exploration; it is not a verified door-swing or operational-clearance simulation.

## 8. Proposal: an optional illustrated home concept PDF

This is an export proposal, not an implementation request or a deliverable generated during this review. Its purpose is to let the homeowner discuss the concept with family and an architect while keeping the workspace calm.

### Suggested contents

1. **Home concept summary.** Project name, family priorities supplied by the person, number of floors, headline areas with definitions, key assumptions, and unresolved decisions. User intent notes would require a small future data feature; do not infer them from geometry.
2. **A clean plan for each floor.** Room names, important dimensions, openings, stairs and arrival directions, north/access orientation, site boundary and assumed setbacks when relevant. Include a legend. Initially identify plans as diagrammatic and let written dimensions govern; claim a print scale only after sheet sizing and scale are deliberately implemented and verified.
3. **Selected architectural views.** Arrival perspective, a useful elevation, and a floor cutaway; optionally a few room/route Walk views. Label the floor and camera/view type. Explain the cutaway as an illustration rather than a measured architectural section. Identify illustrative planting/approach context and artistic lighting.
4. **Area and room schedules.** Per-floor and all-floor centreline, estimated usable, and gross areas; site area, ground coverage/open site, and concept FAR; separate balcony/terrace totals. Include the estimator limitations and rounding convention. Avoid a single unlabeled “house area.”
5. **Opening and stair schedules.** Door/window marks, room relation, host/facing, nominal size, sill/operation, concept glazing inputs where requested; stair connection, footprint, rise/tread/riser and approach assumptions. These are schedules derived from current model data, not fabricated construction specifications.
6. **Findings and questions.** Grouped summaries followed by complete evidence if requested, severity, affected floor/room, software basis, assumptions, suggested next step, and explicit “not modelled/not verified” items. Correct F07 before promoting the bedroom check. Professional review questions should follow from identified uncertainties.
7. **Architect discussion page.** What the homeowner wants to preserve, alternatives explored, known compromises, and questions about structure, local requirements, clear dimensions, headroom and openings. Notes/options need actual stored user input or an explicit report-time input, rather than invented narrative.

A compact report might have approximately 6–10 pages for a small two-floor concept, expanding with floor count and optional detail. That is a design target, not a fixed page count. A short “Views / Detailed schedules / Full findings” choice is preferable to a new complex reporting console.

### One snapshot, one set of claims

Freeze a project snapshot for generation and assign an immutable snapshot/revision identity. Put project name/ID, revision identity, capture/export time and unit convention in report metadata. Every image should carry its floor, view/camera, cutaway state, and whether presentation context is enabled; every schedule and check must use that same snapshot. Keep the friendly version number, but do not rely on it alone: current restoration can reuse older version numbers.

If the live design changes while a report is being generated, the report should still represent its frozen snapshot and say so. It must not combine a newer area table with older pictures. The current 3D capture synchronization guards are a useful starting point, but they do not by themselves provide a multi-page frozen-report workflow. SVG and PNG filenames include a version, while ordinary downloaded images do not independently establish all the required report provenance.

Use a neutral export plan composition. The current serializer clones the editor SVG, so selected outlines, guides or temporary measurements need deliberate treatment rather than an assumption that every editor capture is a clean sheet. Capture useful architectural views without toolbars. Prefer vector plans/text and bounded raster views. Do not add fake textures, objects, or light behavior to make a report look more authoritative.

### Performance and verification

Generate only when requested. Load reporting code on demand, capture views sequentially from the frozen model, cap image size and page count where needed, and release temporary graphics resources. Reuse the current geometry/material/camera pipeline in an isolated capture context. Avoid running several high-resolution renderers simultaneously or changing the user's live camera/selection to compose report pages. A browser print/PDF path is worth validating before selecting a dedicated PDF dependency; either approach needs pagination and image-quality testing.

Acceptance requires: matching snapshot identity across pages; area totals reconciling to the same JSON backup; legible names/dimensions on paper and phone; no clipping of long findings; correct units and per-floor scope; clear unknowns; preserved live state; bounded memory use and cancellation/failure recovery. The report must be readable by an architect without reopening the studio, while the JSON remains available for editable recovery.

## 9. Performance implications of the proposed product changes

The recent rendering work should be preserved. In the current live single-floor project, DOM diagnostics showed **23,272 triangles and 20 draw calls** at a reported pixel ratio of 2.00. The render counter remained at four over two separated reads with no intervening model interaction. A build-time field showed about 230 ms for that particular scene generation. These observations are diagnostics from this review environment, not a reproducible performance benchmark, an end-to-end interaction latency measurement, or a low-end-device FPS result.

The historical Aurora observation of approximately 40,000 triangles, 24 draw calls, and no continuing idle renders remains separate. A two-floor fixture, a single-floor private project, different views, and different devices are not interchangeable benchmark cases.

Most proposed noise reductions cost little GPU work: conditional panels, clearer labels, and contextual details are layout/content changes. The important rendering implications are:

- Changing sidebar visibility changes canvas aspect ratio. Reframe once where appropriate; preserve the camera's architectural orientation and avoid repeated scene rebuilds during panel animations.
- Room/opening drag previews should remain lightweight SVG or small overlays. Do canonical topology, collision and validation work at an appropriate commit boundary, not an unbounded rebuild on every pointer move.
- On-demand route highlights can use a small derived overlay from the existing graph; no navigation-engine dependency is needed merely to explain connectivity. Actual route-distance/clearance analysis would be a separate feature.
- Add selected-room/measurement labels through DOM/SVG or bounded geometry; avoid regenerating many text textures each frame.
- Keep shadow maps cached until geometry/light changes, adaptive pixel budgets during interaction/capture, event-driven idle behavior, disposal, and the WebGL failure fallback.
- Walk must render during motion, then stop when idle. Future touch controls should drive the same movement/collision path, not create a second simulation.
- Bounded checkpoints mostly affect storage and serialization, not the GPU. Snapshot count/size needs limits and migrations.
- PDF view capture can temporarily raise pixel budgets. Capture one view at a time, dispose temporary resources, and avoid continuous background renders or large duplicate scene sets.

Before claiming broad device support, establish a small repeated benchmark on an actual modest laptop and phone: load time, scene-build time, interaction frame time while orbiting/walking, resize/cutaway latency, peak memory, idle render count, and repeated mount/unmount behavior. Use the same fixtures and viewport/device settings across comparisons. Existing triangle/draw-call figures are useful budgets, not evidence that every device is fast.

Defer real-time ray tracing, cinematic post-processing, large texture packs, vegetation catalogs, animated scene decoration, and heavyweight physics. The present priority is convincing architectural legibility and smooth interaction. Any later sun study should require explicit location/orientation/date/time inputs, a validated calculation and separate labels; it must not be smuggled into the current artistic lighting controls.

## 10. Sequenced roadmap and release gates

### Immediate improvements: protect trust and reduce today's friction

| Order | Work | Dependencies | Acceptance gate |
| --- | --- | --- | --- |
| 1 | Correct escape-opening guidance and operation/type consistency; make save outcomes and local-only status truthful | F06/F07/F14; tests of concept data and storage failures | Fixed/non-operable windows cannot satisfy the escape candidate; unknown clear size stays unknown; unsuccessful writes are visibly unsaved |
| 2 | Guard stale saves using a base revision and preserve conflicting drafts/copies | Revision identity that survives restore/branch; activity writes included | Synthetic two-tab and stale-validation cases retain both changes and never silently overwrite |
| 3 | Adopt the homeowner promise; correct the automatic-wall onboarding step | Existing room/example flow | A first concept can start without an independent-wall detour; current projects remain available |
| 4 | Simplify unselected/contextual properties, generated-wall affordances, and room browser hierarchy | Current semantic model; keyboard disclosure | Every visible action works for the selected object; full detail remains reachable |
| 5 | Apply mode-specific Plan/3D/Walk defaults and keep floor/scope visible | Current focus view and presentation-state separation | Viewing is clear and causes no design version, Undo, activity-save, or geometry change |
| 6 | Unify area/units language; compact grouped findings; repair responsive collisions and hidden-drawer focus | Measurement contract and accessible layout | Sample totals reconcile; units survive narrow layouts; closed drawers get no focus; warning detail remains available |

These are bounded refinements to the current system. Do not wait for a complete PDF system or more roof types to correct the default experience. Do not hide a known correctness issue while merely renaming its UI.

### Next stable milestone: confident architectural experimentation

Sequence this work after the trust contracts above:

1. **Durable named checkpoints and honest session recovery.** Implement bounded storage, preview, restore-as-new-revision and recoverable current work. Refresh must not erase meaningful saved checkpoints.
2. **Direct opening movement and directional room resizing.** Valid previews, exact fallback, keyboard equivalents, coherent swing/operation controls, and specific conflict feedback. Verify no lost/rehosted opening surprises.
3. **Bounded compound operations for shared room boundaries and related agent edits.** Preserve two-room geometry, wall identity/remapping, opening hosts and validation; commit or reject atomically. One meaningful proposal should have one meaningful recovery action.
4. **A clearer connection and multi-floor journey.** On-demand route evidence, direct floor access, guided stair/arrival review, and explicit storey/clearance assumptions. Validate live two-floor tasks in disposable copies, including all three stair types.
5. **An illustrated concept-report pilot.** Build the frozen snapshot and neutral output composition after measurement/revision contracts are stable. Test the resulting artifact with a homeowner and architect before expanding its schedules or format choices.

Milestone acceptance: a homeowner can arrange an example, revise a bedroom and doorway, understand a route between rooms and floors, review a finding, reload and recover a preferred concept, and explain the same snapshot to another person. No step should require a raw coordinate/host identifier unless the person explicitly chooses precision work. Existing architecture, tool-parity and presentation regressions should remain passing, supplemented with meaningful coverage of the newly introduced contracts.

### Later architectural enhancements, gated by real need

| Enhancement | Why it could matter | Required foundation / boundary |
| --- | --- | --- |
| Explicit open passages and open-plan program zones | Represents connected living/dining and doorless circulation faithfully | Topology, openings, collision, ventilation/daylight attribution, area schedules, and reversible edits |
| Explicit interior clear dimensions, slab/ceiling relationships and stair headroom concepts | Helps judge room height and upstairs routes more honestly | Canonical definitions, geometry/void reconciliation, units, and stated unverified construction assumptions |
| Metric and imperial display preferences | Reduces measurement translation for families and architects | Common formatter/conversion contract; canonical-unit migration only if justified |
| Architectural sections and additional common roof forms | Helps explain vertical space, roof shape and envelope | Shared geometry and print conventions; preserve modest scene complexity |
| More useful site/footprint representation | Actual sites may not be rectangular and setbacks may be more nuanced | Survey/reference inputs, orthogonal/non-orthogonal geometry strategy, explicit uncertainty |
| More rigorous daylight/ventilation and solar studies | Helps answer a specific orientation/opening question | Explicit inputs, validated methods, applicable assumptions and performance budgets; no substitution for professional assessment |
| Architect feedback/annotations and reference handoff formats | Keeps unresolved questions attached to the concept | Snapshot identity, notes provenance, permission/privacy choices and a demonstrated workflow |
| Cloud recovery or shared editing | Useful if cross-device work is requested | Local conflict rules first; authentication, privacy, revision concurrency and reliable synchronization |

The older roadmap places structural grids/basic elements, assemblies and IFC among valuable additions. They should follow demonstrated homeowner/professional needs, rather than compete with immediate usability. A grid can later help explain coordination; it must not imply structural design. IFC needs a validated semantic mapping and an architect workflow that benefits from it.

### What should wait

Keep furniture, decorative interiors, décor catalogs, cinematic features, full BIM authoring, structural solvers, full energy/acoustic simulations, curved/spline geometry, mass tool expansion, and a new large reporting console outside this milestone. Also defer an expensive cloud collaboration system until local recovery is dependable and a cross-device use case is demonstrated.

The test for a new feature is concrete: which homeowner question does it answer, what current evidence is inadequate, what assumptions does it require, and can it fit the existing interaction and performance budget? A new capability that needs another permanent toolbar is likely arriving before its interaction has been designed.

## 11. Small observed task review and proposed homeowner study

### Observed task walkthrough in this review

This is a small expert-observation sample: one reviewer, the current local UI, and isolated model tests. It is not a novice participant study, a statistically representative usability result, or a timed benchmark. No saved-house edit, reload/recovery, agent mutation, or live stair traversal was attempted. Those boundaries prevent overstating what was observed.

| Realistic task | What was actually done | Result and implication |
| --- | --- | --- |
| “Understand what this product helps me do.” | Read the live landing and existing product documents | The mechanism is clear; the family-home outcome is less prominent. Reframe the promise, then test first-session comprehension |
| “Find the connection between entry and living.” | Opened Browse and selected its shared wall, then its door | Both are inspectable; the wall offers an unsupported Delete affordance, and door inspection exposes eight controls and 39 host choices |
| “Move that doorway a little.” | Inspected current opening selection UI and pointer implementation; did not move the live door | Direct movement is not provided. Numeric centre offset/host semantics are the available route |
| “Give Living one foot of Kitchen's width.” | Created two touching rooms only in Node memory and attempted one-room resize | Rejected the 14 sq ft overlap and preserved the original room. Protection works; coordinated revision remains absent |
| “See the home clearly and look inside.” | Switched the review tab to 3D, used Fit, focus view, floor cutaway, and Walk | Focus/cutaway improved legibility. Default editing chrome remained a burden; initial Walk orientation faced the foyer's exterior doorway |
| “Find what needs attention.” | Opened Checks at narrow width and selected a ventilation finding | Nine warnings are reachable; the list is verbose. Selected-issue context is retained, but resolving a window problem still begins at room Properties |
| “Reach floors on my laptop.” | At 1024 × 768, opened library → Levels | Floor/stair controls are reachable now. Common floor selection still requires management-panel navigation; long header text overlaps the view region |
| “Review the home on my phone.” | Inspected Plan and inspector at 390 × 844 | Layout fits; details are reachable. Tiny plan text, omitted metric units, and hidden drawer focus remain. Actual touch authoring/Walk was not tested |
| “Trust my newer layout is saved.” | Saved newer then older synthetic snapshots into mocked localStorage | Older snapshot replaced newer record. Real storage was not touched; conflict handling is required |
| “Understand bedroom opening guidance.” | Set all Aurora windows fixed/non-operable in an in-memory clone and validated | Fourteen ventilation warnings, zero escape warnings across five bedrooms; the escape heuristic needs correction |
| “Take the concept to an architect.” | Opened Export without executing a download and inspected capture/export code | JSON, active-floor SVG and PNG are available. PDF and coherent illustrated reporting remain proposals |

The observation most relevant to noise is that the quieter focus view already made the same model more understandable. The observation most relevant to trust is that passing general regression suites did not detect the reproduced stale-save and escape-operability cases. Both interface and underlying contracts need attention; one cannot substitute for the other.

### A small real homeowner study before broadening the interface

Recruit approximately five people who want to participate in a home concept and have no architectural training, with varied familiarity with drawing tools. Use disposable copies of the same prepared concept and a blank starting project; never test recovery against their only copy of personal work. Include a desktop/laptop session and a short narrow-screen review session, approximately 25–35 minutes total. These are proposed procedures, not participants already recruited or results already measured.

Give goals rather than tool names:

1. Start a simple home with a living room, kitchen, bedroom and bathroom; explain why they are arranged that way.
2. Move the bedroom beside the living room, connect them appropriately, then make it wider without losing the neighboring space.
3. Shift a doorway and change its swing; make a bedroom window open and explain what the related finding does and does not mean.
4. Look at the exterior, enter a named room, describe its scale and a sightline, and follow a route to another room and upstairs in the prepared two-floor copy.
5. Identify a finding, locate its cause, and try a bounded revision. Save a named concept, reload, and recover the preferred arrangement.
6. Explain selected-floor versus whole-home areas and identify what to send an architect. On a phone, locate a room, read its dimensions, and review one finding.

Observe independent completion, wrong-object selections, unneeded tool detours, repeated rejected gestures, requests for help, lost orientation, accidental changes, recovery success, and area/check misunderstandings. Ask for a brief explanation in the participant's own words and a confidence score after each meaningful task. Use recordings only with the participant's consent; do not burden the everyday interface with this research instrumentation.

Suggested release targets, to be revised after a baseline: at least four of five people complete the core room/door/review tasks without tool-name coaching; all recover the intentionally changed disposable concept; none infer code approval from a check result; at least four correctly distinguish floor and whole-home area; and all can describe where they are during Walk. Report actual counts and observed misunderstandings, not percentages presented as statistical certainty from five people.

The strongest qualitative evidence would be a person explaining, “I understand this version of my home, I can try an alternative and return, and I know which questions to take to my architect.” A cleaner screenshot alone is an inadequate success measure.

## 12. Evidence references and preservation record

Source links identify current local files with one-based line anchors. The current uncommitted presentation changes are included in this review. Earlier reports are context, not authority over the verified current behavior.

- **E1 — Product framing:** Live landing observation; [Hero.tsx](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/Hero.tsx:201), [landing schedule](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/lib/landing-webmcp-tools.ts:50), and [roadmap intended users](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/docs/ARCHMORPH_RESEARCH_AND_ROADMAP.md:48).
- **E2 — First use:** [blank-state steps](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/Studio.tsx:1698) and [room creation/topology operations](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/lib/architecture.ts:2101). Blank state was code-reviewed, not created in live storage.
- **E3 — Default information hierarchy:** 1280 × 720 live Properties/Spaces observation; [unselected project inspector](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/Studio.tsx:1900).
- **E4 — Canonical walls and browser:** Live shared-wall Delete affordance; [wall movement restriction](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/lib/architecture.ts:2344), [deletion restriction](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/lib/architecture.ts:2729), and [flat navigator assembly](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/Studio.tsx:1051).
- **E5 — Isolated fixture/geometry results:** [Aurora fixture](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/fixtures/aurora-house-30x95.archmorph.json), migrated version 80: ground 13 rooms, 38 walls, 21 openings, one stair, zero balconies, three façade features, 76 navigator elements. Synthetic joined-room resize and canonical-wall deletion were rejected without changing the source project.
- **E6 — Direct gestures:** [FloorPlan drag-state types](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/FloorPlan.tsx:38), [room resizing](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/FloorPlan.tsx:290), [opening selection](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/FloorPlan.tsx:636), and [resize handles](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/FloorPlan.tsx:773).
- **E7 — Opening controls:** Live door/window Properties inspection; [opening geometry/host/configuration](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/Studio.tsx:1787).
- **E8 — Habitability assumptions/defect:** [software threshold constants](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/lib/architecture.ts:1083), [ventilation calculation](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/lib/architecture.ts:3267), and [escape predicate](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/lib/architecture.ts:3302). All-fixed Aurora validation was isolated in memory; no rule edition or jurisdiction was externally certified.
- **E9 — Connections:** [opening schema](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/lib/architecture.ts:193) and [circulation graph](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/lib/architecture.ts:2815).
- **E10 — Floors/stairs:** Live Levels drawer; [Levels controls](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/Studio.tsx:1532), [stair connections](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/lib/architecture.ts:1111), and [validation](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/lib/architecture.ts:2919).
- **E11 — Exterior/context:** [presentation site generator](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/lib/model-site.ts:7), [Exterior controls](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/Studio.tsx:1572), and [roof/cutaway surfaces](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/lib/model-presentation.ts:88).
- **E12 — 3D/Walk:** Live mode, framing, focus and cutaway observations; [focus CSS](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/globals.css:236), [mode toolbar](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/Studio.tsx:1620), [Walk initial pose](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/ModelView.tsx:286), and [movement handling](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/ModelView.tsx:1165). Camera field of view is at ModelView line 181; eye-height constant is at line 58; Walk all-open door model is at line 161; fixed presentation sun is at line 345.
- **E13 — Metrics:** [projectMetrics](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/lib/architecture.ts:1364) and [usable-area estimator](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/lib/architecture.ts:756), plus current fixture recomputation and live toolbar observations.
- **E14 — Findings UI:** Live nine-warning list and selected-issue context; [Checks composition](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/Studio.tsx:1939).
- **E15 — Saving:** [saveProjectLocally](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/lib/persistence.ts:87), [storage access/write behavior](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/lib/persistence.ts:36), [design commit](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/Studio.tsx:580), and [explicit validation activity write](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/Studio.tsx:1243). Newer version 2 followed by older version 1 overwrote in mocked storage.
- **E16 — History/recovery:** [in-memory snapshot refs](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/Studio.tsx:505), [snapshot restoration semantics](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/Studio.tsx:279), [restore action](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/Studio.tsx:1301), and [History dropdown](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/Studio.tsx:1391).
- **E17 — Feedback/formatting:** [NumberField](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/Studio.tsx:381), [safeCommit](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/Studio.tsx:1067), and [selected dimension text](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/FloorPlan.tsx:546).
- **E18 — Responsive/accessibility:** Current 1024/390 screenshots and hidden-focus DOM observation; [responsive rules](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/globals.css:441), [library close control](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/Studio.tsx:1479), and [fixed plan viewBox](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/FloorPlan.tsx:132).
- **E19 — Agent contracts:** [tool catalog](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/lib/webmcp-tools.ts:1), [presentation/design separation](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/Studio.tsx:176), and current WebMCP regression output: four landing tools, 57 studio tools, 12 read-only studio tools, summary/full payload and representative execution checks passed.
- **E20 — Exports:** Live menu inspection; [SVG serializer](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/Studio.tsx:313), [capture synchronization](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/Studio.tsx:640), [export menu](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/app/components/Studio.tsx:1438), and [JSON document export](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/src/lib/persistence.ts:175).

Additional context: [September UX audit](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/docs/UX_AUDIT_REPORT_2026-09-01.md), [habitability and measurement implementation record](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/docs/HABITABILITY_AND_MEASUREMENT_2026-08-30.md), [exterior implementation](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/docs/EXTERIOR_SYSTEMS_IMPLEMENTATION_2026-08-30.md), and [WebMCP testing record](/Users/yousufkhan/personal_projects/hackthone/ArchMorph/docs/WEBMCP_TESTING.md).

The initial dirty application files were exactly the expected set: scripts/model-presentation-regression.ts, src/app/components/ModelView.tsx, src/app/components/Studio.tsx, src/app/globals.css, src/lib/model-materials.ts, src/lib/model-presentation.ts, and untracked src/lib/model-site.ts. A SHA-256 preservation baseline was recorded for 47 existing source, script, documentation, package and instruction files before verification. Final comparison confirmed that all 47 stayed byte-for-byte unchanged. This report is the only new repository file created by the review. Fixture/source tests used in-memory data; the user's original browser surfaces were not operated and temporary review tabs were closed.
