# Localhost reference redesign — 2026-08-30

## Scope

Reconstructed the supplied two-storey reference on the localhost build only. All design mutations were performed through the app's WebMCP tools. The normal floor-selector UI was used once for visual QA because WebMCP could focus a first-floor room but could not activate its floor.

The public Sites deployment was not changed. Landscaping was intentionally excluded.

## Final localhost model

- Plot: 30 ft × 60 ft, north-facing, editable setbacks (front/rear 4 ft, left/right 2 ft)
- Ground floor: formal living room, living room, staircase hall, dining area, Bedroom 1, passage, kitchen, utility area
- First floor: master bedroom, stair landing, family lounge, upper hall, Bedroom 2, common bathroom, attached bathroom
- Exterior: recessed front balcony with horizontal railings, flat roof with parapet, stucco finish, concrete accent, façade frame, canopy, sunshade, boundary wall, and slatted front gate
- Model totals: 2 floors, 15 rooms, 50 canonical walls, 19 doors, 16 windows, 1 stair, 1 balcony, 4 façade features
- Areas: 1,172 sq ft ground-floor net area, 954 sq ft first-floor net area, 2,126 sq ft total net building area
- Final validation: pass, 0 issues

## Bugs and limitations observed

1. `focus_element` can select a room on another floor but does not update `currentView.activeFloorId`. There is no dedicated WebMCP floor-activation tool, so first-floor visual QA required the ordinary floor selector.
2. A group mirror cannot be expressed as one WebMCP transaction. Moving rooms individually is rejected when hosted doors, windows, or façade features would be invalid during the intermediate state. Some independent moves can commit before later calls fail, leaving a partially transformed group.
3. A client-side sequence of WebMCP calls stops at the first rejected call unless the caller catches errors per operation. Earlier successful calls remain committed, and the thrown error does not summarize those partial successes.
4. Opening collision validation correctly rejects overlapping openings, but the error only identifies the new opening kind and not the conflicting opening ID or a suggested valid offset.
5. WebMCP has no project rename tool. The rebuilt localhost design therefore retains the existing local project name even though its geometry was completely replaced.
6. Project metrics are active-floor-centric: `balconyArea` reports 0 while Ground Floor is active even though the project contains a first-floor balcony. The project count still reports the balcony correctly.
7. The exterior is a close massing/elevation reconstruction, not a photoreal copy. Current primitives simplify gate slats, railings, façade trim, roof detailing, and material texture. Landscaping was not attempted by request.

No app behavior was fixed during this reconstruction session.
