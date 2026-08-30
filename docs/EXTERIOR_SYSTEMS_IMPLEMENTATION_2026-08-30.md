# Exterior systems implementation — 2026-08-30

This change addresses the prioritized gaps found during the reference-house reconstruction test. Landscaping was deliberately excluded.

## Implemented

- Project-specific editable land width, length, orientation, and four setbacks, including custom site settings when a new local project is created.
- A flat-roof model with configurable parapet visibility, height, thickness, and finish.
- Balcony and terrace slabs with configurable dimensions, location, finish, railing height, railing style, and railing sides.
- Plot boundary walls with configurable height, thickness, finish, and an adjustable front gate.
- Project-wide façade finish plus optional per-exterior-wall material overrides.
- Exterior-wall-hosted frames, canopies, and sunshades with exact offset, width, elevation, height, projection, thickness, and finish.
- Schema v5 migration, persistence, import/export, undo/redo, inspection, validation, 2D rendering, 3D rendering, selection, and WebMCP parity.

## Performance discipline

- Exterior systems use simple box geometry and visual materials rather than simulation-heavy assemblies.
- Railing posts and gate slats are capped at fixed upper bounds.
- Decorative elements do not add collision segments to Walk Mode.
- The verified reference-style scene rendered 1 balcony, 20 railing pieces, 19 boundary/gate pieces, 9 parapet pieces, and 4 façade-feature pieces with no browser console errors.

## Verification

- `npm run test:architecture` — pass
- `npm run test:webmcp` — pass; 51 tools
- `npm run lint` — pass
- `npm run build` — pass
- Native local WebMCP reconstruction and 3D visual inspection — pass

The production build still reports the existing client-chunk warning caused primarily by the editor/Three.js bundle. This change does not introduce a new runtime error, but future code splitting remains a worthwhile performance improvement.

## Deliberate limits

- These are schematic architectural systems, not construction-detail or structural assemblies.
- Balcony railing sides are fully controllable through WebMCP and persisted state; the current human inspector edits railing enablement, height, and style.
- Boundary gates are single front-edge concept elements; gate leaves, hardware, and swing simulation are not modeled.
- Per-wall finishes are visual surface assignments, not layered wall assemblies or quantity takeoffs.
- Landscaping remains out of scope by request.
