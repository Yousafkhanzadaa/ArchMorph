# WebMCP reference-plan reconstruction test — 2026-08-30

## Scope

- Production application: `https://archmorph-studio.musfk.chatgpt.site/`
- Input: user-provided composite image containing a two-storey floor plan and modern front-elevation rendering.
- Constraint: all project inspection, mutation, validation, view changes, snapshots, and export actions were performed through the page's native WebMCP tools.
- No application code or defect was changed during this session.

The source image did not contain reliable written dimensions for individual rooms. The reconstruction therefore used the visible proportions, room labels, circulation arrangement, recessed upper-front massing, and the stated total built-up area of approximately 2,200 sq ft.

## Result

| Check | Result |
| --- | --- |
| Native WebMCP discovery | Pass — 40 page-scoped tools |
| Recorded WebMCP calls | 93 passed, 0 failed |
| Floors | 2 |
| Rooms | 14 |
| Doors | 14 |
| Windows | 16 |
| Stairs | 1 connected straight stair |
| Net ground-floor area | 1,176 sq ft |
| Net upper-floor area | 1,026 sq ft |
| Total net building area | 2,202 sq ft |
| Total gross covered area | 2,272.5 sq ft |
| Final validation | Pass — 0 errors, 0 warnings |
| Circulation | All 14 rooms reachable from the main entrance; no invalid doors or stairs |
| JSON export | Pass — schema version 4, project version 91 |
| Browser console | No errors or warnings observed |

The reconstructed program contains two ground-floor living rooms, a central stair hall and dining area, Bedroom 1, kitchen, and utility area. The upper floor contains a master bedroom, stair landing, family lounge, upper hall, two bathrooms, and Bedroom 2. An unoccupied upper-front zone creates a recessed terrace-like mass matching the reference's balcony location.

## Bugs observed

1. **Plan labels collide with geometry and room boundaries.** The ground-floor `Stair Hall` label and area are obscured by the stair graphic. On the upper floor, `Stair Landing` is clipped, `Common Bathroom` extends outside its room, and the two bathroom labels overlap each other and nearby geometry.
2. **Dimension text becomes unreadable in compact circulation spaces.** Stair, door-swing, and dimension graphics overlap around the stair halls and upper hall.
3. **Walk Mode can start with an unhelpful camera framing.** Entering Family Living through `set_navigation_mode` produced a view extremely close to a wall/window, with little spatial context.
4. **Exterior surfaces show visible segmentation.** The 3D front-right view shows seams/banding across coplanar wall and flat-roof/slab surfaces, making the mass read as joined boxes rather than a clean continuous facade.

## WebMCP/tool-surface limitations

1. There is no WebMCP operation to create a fresh project or rename the current project. The restored `WebMCP Native QA Final` project had to be repurposed.
2. There is no operation to rename a floor. The upper floor therefore retains the unrelated name `Native QA Upper`.
3. There is no direct `set_active_floor` WebMCP tool. To capture the ground-floor plan without using the UI, the test entered Walk Mode in a ground-floor room and then switched back to 2D.
4. There is no WebMCP operation to delete a stair or floor. The pre-existing stair and two floors had to be reused.
5. Plot width and length can be changed through `set_exact_dimension`, but plot setbacks cannot be edited through the exposed tool surface.
6. WebMCP can enter Walk Mode in a selected room but cannot move, turn, follow a route, or ascend the stair. Agent-side walkthrough verification therefore stops at the spawn view.

## Modeling limitations exposed by the reference

The following reference details could not be represented semantically with the current model/tool surface:

- balcony slab type, guardrails, and metal railing profiles;
- roof parapets, front facade frame/canopy, and roof-edge articulation;
- front gate, boundary wall at an independently controlled height, and gate pillars;
- per-wall or per-zone facade materials, including the stone accent panel;
- projecting sunshades and window surrounds;
- landscaping, planters, trees, street context, and exterior paving;
- furniture, kitchen counters, sanitary fixtures, and other plan symbols; and
- authored lighting, presentation materials, or photorealistic rendering.

The global stucco finish, orthogonal two-storey massing, recessed upper-front volume, hosted windows/doors, and connected stair provide a recognizable architectural approximation, but not a close visual reproduction of the supplied elevation.

## Test discipline

- Stable IDs were always obtained from WebMCP inspection or mutation results.
- No coordinate clicking or direct UI mutation was used to construct the model.
- Unsupported facade features were left unsupported rather than faked with unrelated primitives.
- No bugs or limitations listed above were fixed during this test.
