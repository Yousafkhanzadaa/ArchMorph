# Turning stairs — architectural implementation and configuration

## Product behavior

Every stair is one semantic floor-to-floor connection. Its flights, landing, stairwell outline, lower and upper approaches, plan symbols, 3D components, circulation edge, and Walk Mode route derive from the same object.

- A quarter-turn L-shaped stair has two perpendicular flights joined by a quarter landing and changes travel by 90°.
- A half-turn U-shaped stair has two parallel flights travelling in opposite directions, joined by a half landing, and changes travel by 180°.
- A straight stair has one continuous flight and no intermediate landing.

## Configuration

- `stairType`: `straight`, `l-shaped`, or `u-shaped`
- `width`: clear width of one flight
- `length`: straight run, lower-flight run for an L stair, or equal per-flight run for a U stair
- `upperFlightLength`: independently configurable upper-flight run for an L stair
- `landingDepth`: square quarter-landing size for an L stair or half-landing depth for a U stair; it must be at least the clear flight width
- `wellWidth`: clear gap between the parallel flights; `0` produces a compact dog-leg stair
- `turnSide`: left or right 90° turn for an L stair; left or right 180° return for a U stair
- `direction`: connects up to the next floor or down to the previous floor
- `rotation`: 0°, 90°, 180°, or 270°
- `x`, `y`: exact plan position of the rotated stair footprint

The unrotated U-shaped stairwell is:

- width = `(2 × flight width) + well width`
- length = `flight run + landing depth`

The unrotated L-shaped bounding dimensions are:

- width = `upper-flight run + quarter-landing size`
- length = `lower-flight run + quarter-landing size`

Its actual stairwell opening is an L-shaped polygon. The unused inside corner remains floor area and is not treated as a walkable stair or removed from the upper slab.

## Vertical geometry

The conceptual riser count for turning stairs is made even and divided equally between the two flights. Each flight receives its own tread count and run check. The intermediate landing is placed at half the floor-to-floor rise.

The concept check retains the app's assumptions of a 7¾-inch maximum riser and 10-inch minimum tread. It requires the landing to be at least as large as the clear flight width, a full-width approach outside both entries, and no wall crossing the stairwell. These checks are early-design guidance, not code approval; headroom, guards, handrails, structure, accessibility, and jurisdiction-specific requirements still need professional review.

## Shared representations

- 2D uses floor-specific `UP`/`DN` routes, tread lines, a conventional double cut line, a faded beyond-cut flight, landing geometry, and a dashed full-width approach zone.
- 3D builds each explicit low-poly flight with treads, risers, stringers, soffits, and the intermediate landing.
- Upper slabs and lower ceilings use the true rotated stairwell polygon. An L stair therefore cuts an L-shaped opening; a U stair cuts the compact half-turn stairwell.
- Walk Mode follows the explicit centerline direction of each flight and holds half-rise while crossing the landing. Center wells and L-shaped inside corners are not walkable.
- Circulation and validation use the clear floor area outside the distinct physical lower and upper entries rather than a footprint-center approximation.
- Walls remain real Walk Mode obstructions and are reported as stairwell clashes instead of being silently erased by a bounding box.
- WebMCP creates and updates the same configuration through `add_stairs` and `update_stairs`.
- `inspect_floor` exposes each connected stair's lower/upper role, flights, landing, route, outline, and approach polygons.

## 3D support correction

The first turning-stair renderer pitched soffits and stringers with sequential Euler rotations. After a flight turned in plan, those rotations could tilt the support around a world axis and produce large crossing wedges in Walk Mode. Supports now derive one orthogonal local frame from their exact lower and upper 3D endpoints, so their length axis follows the flight for all four plan rotations and both return directions. A regression check covers positive and negative X/Z flight directions.

## Performance approach

Turning stairs add one additional low-poly flight and one landing. Geometry is derived only when the project view updates; approach and clash checks use small polygons and line intersections. No physics engine or dense simulation was added, keeping the performance profile close to the original straight-stair implementation.
