import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { applyOperation, createInitialProject, migrateProject, roomContainsPoint, stairLayout, stairPlanPoint, type CameraPreset, type Project } from "../src/lib/architecture.ts";
import { buildSpatialModel } from "../src/lib/spatial3d.ts";
import { buildFloorSlab, buildParapetSurfaces, buildRoofDeck, buildWallSurfaces, cutawayCeiling, exposedVolumeSurfaces, fitPerspectiveView, landingGuardSegments, presentationBounds, presentationPixelRatio, type SurfacePatch } from "../src/lib/model-presentation.ts";
import { batchModelMeshes, contactOcclusion, selectionGeometry, surfaceGeometry } from "../src/lib/model-materials.ts";
import { presentationSite } from "../src/lib/model-site.ts";

const center = (patch: SurfacePatch) => patch.points.reduce((sum, point) => sum.add(new THREE.Vector3(...point)), new THREE.Vector3()).multiplyScalar(0.25);
const area = (patch: SurfacePatch) => new THREE.Vector3(...patch.points[1]).sub(new THREE.Vector3(...patch.points[0])).length()
  * new THREE.Vector3(...patch.points[3]).sub(new THREE.Vector3(...patch.points[0])).length();
const surfaceArea = (patches: SurfacePatch[]) => patches.reduce((sum, patch) => sum + area(patch), 0);
function assertWinding(patches: SurfacePatch[]) {
  for (const patch of patches) {
    const a = new THREE.Vector3(...patch.points[1]).sub(new THREE.Vector3(...patch.points[0]));
    const b = new THREE.Vector3(...patch.points[2]).sub(new THREE.Vector3(...patch.points[0]));
    assert.ok(a.cross(b).normalize().dot(new THREE.Vector3(...patch.normal)) > 0.999, "every exposed surface faces outward");
    assert.ok(area(patch) > 0, "surface cells have nonzero area");
  }
}

// Two touching cubes become one closed shell, with no faces at their shared plane.
const joined = exposedVolumeSurfaces([
  { min: [0, 0, 0], max: [1, 1, 1], elementIds: ["a"] },
  { min: [1, 0, 0], max: [2, 1, 1], elementIds: ["b"] },
]);
assert.equal(surfaceArea(joined), 10);
assert.equal(joined.filter(patch => patch.normal[0] && center(patch).x === 1).length, 0);
assertWinding(joined);
const partial = exposedVolumeSurfaces([
  { min: [0, 0, 0], max: [1, 2, 2], elementIds: ["a"] },
  { min: [1, 0, 0], max: [2, 1, 1], elementIds: ["b"] },
]);
assert.equal(surfaceArea(partial), 20, "only the occupied part of an adjacent face is removed");
assertWinding(partial);

let project = createInitialProject();
const groundId = project.floors[0].id;
project = applyOperation(project, { type: "create_room", floorId: groundId, name: "Left", roomType: "Living Room", x: 3, y: 8, width: 10, length: 20 }, "human").project;
project = applyOperation(project, { type: "create_room", floorId: groundId, name: "Right", roomType: "Kitchen", x: 13, y: 8, width: 10, length: 20 }, "human").project;
const brickWall = project.walls.find(wall => wall.exterior && wall.roomSides.some(side => side.roomId === project.rooms[0].id && side.side === "north"))!;
project = applyOperation(project, { type: "set_wall_finish", wallId: brickWall.id, finish: "brick" }, "human").project;
const surfaces = buildWallSurfaces(project, buildSpatialModel(project));
const northFaces = surfaces.filter(patch => patch.normal[2] === -1 && Math.abs(center(patch).z - 7.75) < 0.001);
assert.ok(northFaces.length > 1);
for (const patch of northFaces) {
  assert.equal(patch.finish, center(patch).x < 13 ? "brick" : "stucco", "a finish override stays on its canonical wall");
  assert.ok(patch.elementId, "exposed wall surfaces retain their selectable owner");
}
assertWinding(surfaces);
const spatial = buildSpatialModel(project);
const roof = buildRoofDeck(project, groundId, spatial);
const top = roof.filter(patch => patch.normal[1] === 1);
assert.equal(Math.round(surfaceArea(top) * 100), 42025, "the deck includes outer wall thickness and joined corners");
assert.ok(top.some(patch => patch.elementId === project.rooms[0].id) && top.some(patch => patch.elementId === project.rooms[1].id), "roof picking stays local to each room");
assertWinding(roof);
const parapets = buildParapetSurfaces(project), coping = buildParapetSurfaces(project, true);
assert.ok(parapets.length && coping.length);
assertWinding(parapets); assertWinding(coping);
const corner = new THREE.Vector3(2.8, 10.5, 7.8);
const parapetGeometry = surfaceGeometry(parapets).geometry;
const parapetMesh = new THREE.Mesh(parapetGeometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
const cornerRay = new THREE.Raycaster(corner, new THREE.Vector3(0, 1, 0));
assert.ok(cornerRay.intersectObject(parapetMesh).length, "the outside parapet corner is closed");
parapetGeometry.dispose(); (parapetMesh.material as THREE.Material).dispose();

// A stair void crossing two upper rooms must be clipped against each slab, not added as an invalid polygon hole.
project = applyOperation(project, { type: "create_floor", name: "Upper", height: 9 }, "human").project;
const upperId = project.floors[1].id;
for (const x of [3, 13]) project = applyOperation(project, { type: "create_room", floorId: upperId, name: "Upper", roomType: "Bedroom", x, y: 8, width: 10, length: 20 }, "human").project;
project = applyOperation(project, { type: "add_stairs", floorId: groundId, x: 11, y: 12, width: 4, length: 12, direction: "up", rotation: 0 }, "human").project;
const multiFloorSpatial = buildSpatialModel(project);
for (const patch of buildRoofDeck(project, groundId, multiFloorSpatial).filter(patch => patch.normal[1])) {
  const point = center(patch);
  assert.ok(!multiFloorSpatial.wallVolumes.some(volume => {
    const elevation = project.floors.find(floor => floor.id === volume.floorId)!.elevation;
    return point.x > volume.x && point.x < volume.x + volume.width && point.z > volume.z && point.z < volume.z + volume.length
      && point.y > elevation + volume.bottom && point.y < elevation + volume.top;
  }), "hidden slab faces cannot cast stripes onto a continuous façade");
}
for (const room of project.rooms.filter(room => room.floorId === upperId)) {
  const slab = buildFloorSlab(project, room);
  assertWinding(slab);
  assert.equal(Math.round(surfaceArea(slab.filter(patch => patch.normal[1] === 1))), 176, "each room loses only its 24 sq ft part of the stairwell");
  for (const patch of slab.filter(patch => patch.normal[1] === 1)) {
    const p = center(patch);
    assert.ok(!(p.x > 11 && p.x < 15 && p.z > 12 && p.z < 24), "the stairwell remains open");
  }
}

for (const name of ["recovered-modern-house", "aurora-house-30x95"]) {
  const fixture = migrateProject(JSON.parse(readFileSync(new URL(`../fixtures/${name}.archmorph.json`, import.meta.url), "utf8")).project) as Project;
  const model = buildSpatialModel(fixture);
  assertWinding(buildWallSurfaces(fixture, model));
  for (const floor of fixture.floors) assertWinding(buildRoofDeck(fixture, floor.id, model));
  assertWinding(buildParapetSurfaces(fixture));
  const bounds = presentationBounds(fixture);
  for (const aspect of [0.35, 0.65, 1, 1.8, 3]) for (const preset of ["front", "rear", "left", "right", "top", "front-left", "front-right"] as CameraPreset[]) {
    const fit = fitPerspectiveView(bounds, preset, aspect);
    const camera = new THREE.PerspectiveCamera(38, aspect, 0.08, 10000);
    camera.rotation.order = "YXZ";
    camera.position.fromArray(fit.position); camera.lookAt(new THREE.Vector3(...fit.target)); camera.updateMatrixWorld(true);
    camera.projectionMatrix.elements[9] += fit.lensShift;
    if (["front", "rear", "left", "right"].includes(preset)) {
      assert.ok(Math.abs(camera.rotation.x) < 0.0001, "street cameras keep verticals upright");
      assert.equal(camera.position.y, bounds.min[1] + 5.4, "street views start at human eye height");
    }
    for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) {
      const ndc = new THREE.Vector3(x, y, z).project(camera);
      assert.ok(Math.abs(ndc.x) <= 0.87 && Math.abs(ndc.y) <= 0.87, `${name}: ${preset} fits both viewport axes at aspect ${aspect}`);
    }
  }
  const upperRoom = fixture.rooms.find(room => fixture.floors.find(floor => floor.id === room.floorId)!.elevation > 0);
  if (upperRoom) assert.ok(presentationBounds(fixture, upperRoom.id).min[1] >= 9, "focus uses the selected storey's elevation");
}

// Batch identical components without breaking ray selection or world-scale texture coordinates.
const scene = new THREE.Scene(), material = new THREE.MeshStandardMaterial({ color: "#dddddd" });
for (const [id, x] of [["left", -2], ["right", 2]] as const) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  mesh.position.x = x; mesh.userData.elementId = id; mesh.castShadow = true; scene.add(mesh);
}
const batches = batchModelMeshes(scene, []);
assert.equal(batches.length, 1, "repeated components share a draw call");
scene.updateMatrixWorld(true);
for (const [id, x] of [["left", -2], ["right", 2]] as const) {
  const hit = new THREE.Raycaster(new THREE.Vector3(x, 0, 3), new THREE.Vector3(0, 0, -1)).intersectObjects(batches)[0];
  assert.equal(hit.object.userData.triangleElementIds[hit.faceIndex!], id, "triangle ownership survives batching");
  const selected = selectionGeometry(batches, id)!; selected.computeBoundingBox();
  assert.equal(selected.boundingBox!.min.x, x - 0.5); assert.equal(selected.boundingBox!.max.x, x + 0.5); selected.dispose();
}
assert.equal(batches[0].geometry.getAttribute("uv").count, batches[0].geometry.getAttribute("position").count);
batches[0].geometry.dispose(); material.dispose();

const beforeCutaway = JSON.stringify(project);
const ceiling = cutawayCeiling(project, upperId);
const cutWalls = buildWallSurfaces(project, multiFloorSpatial, ceiling);
assertWinding(cutWalls);
assert.ok(cutWalls.every(patch => patch.points.every(point => point[1] <= ceiling + 0.001)), "upper wall geometry ends at the cut plane");
assert.ok(cutWalls.some(patch => patch.normal[1] === 1 && patch.points.every(point => Math.abs(point[1] - ceiling) < 0.001)), "cut walls have solid top caps");
assert.equal(JSON.stringify(project), beforeCutaway, "cutaway does not change the design");

// Guards stay on the landing perimeter and leave the entire flight mouths clear, even after rotation.
const segmentDistance = (point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) => {
  const dx = end.x - start.x, dy = end.y - start.y;
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - start.x - t * dx, point.y - start.y - t * dy);
};
assert.deepEqual(landingGuardSegments(project.stairs[0]), [], "a straight flight has no intermediate landing guards");
for (const stairType of ["l-shaped", "u-shaped"] as const) for (const turnSide of ["left", "right"] as const) for (const rotation of [0, 90, 180, 270] as const) {
  const stair = { ...project.stairs[0], stairType, turnSide, rotation, landingDepth: 5, wellWidth: 1, upperFlightLength: 10 };
  const guards = landingGuardSegments(stair), layout = stairLayout(stair);
  assert.ok(guards.length, "exposed landing edges receive guards");
  const perimeter = layout.landing!.vertices.map(p => stairPlanPoint(stair, p.u, p.v));
  for (const guard of guards) for (const point of [guard.start, guard.end]) {
    assert.ok(perimeter.some((a, i) => segmentDistance(point, a, perimeter[(i + 1) % perimeter.length]) < 0.001), "landing guards follow the actual landing outline");
  }
  for (const flight of layout.flights) {
    const mouth = flight.id === "lower" ? flight.end : flight.start;
    const du = (flight.end.u - flight.start.u) / flight.length, dv = (flight.end.v - flight.start.v) / flight.length;
    for (const offset of [-0.49, 0, 0.49]) {
      const point = stairPlanPoint(stair, mouth.u - dv * flight.width * offset, mouth.v + du * flight.width * offset);
      assert.ok(guards.every(guard => segmentDistance(point, guard.start, guard.end) > 0.01), "landing guards leave full-width access to each flight");
    }
  }
}

const occlusion = contactOcclusion([{ min: [0, 0, 0], max: [8, 8, 0.5], elementIds: [] }, { min: [0, 0, 0], max: [0.5, 8, 8], elementIds: [] }]);
assert.ok(occlusion([0.5, 4, 0.55], [1, 0, 0]) < occlusion([0.5, 4, 4], [1, 0, 0]), "contact shading is strongest near the adjoining wall");
assert.equal(occlusion([20, 4, 20], [1, 0, 0]), 1, "isolated surfaces retain their brightness");

for (const [width, height, ratio] of [[1526, 1621, 2], [3840, 2160, 3], [360, 640, 2]]) {
  for (const mode of ["moving", "settled", "snapshot"] as const) {
    const dpr = presentationPixelRatio(width, height, ratio, mode);
    const limit = mode === "moving" ? 1_800_000 : mode === "settled" ? 3_500_000 : 6_000_000;
    assert.ok(width * height * dpr ** 2 <= limit + 1, "large monitors obey the rendering pixel budget");
  }
  assert.ok(presentationPixelRatio(width, height, ratio, "moving") <= presentationPixelRatio(width, height, ratio), "movement does not allocate a larger buffer");
}
const site = presentationSite(project);
assert.ok(site.plants.length <= 2, "site dressing has a bounded asset count");
for (const plant of site.plants) assert.ok(!project.rooms.some(room => roomContainsPoint(room, { x: plant.x, y: plant.z })), "planting avoids rooms on every floor");
assert.equal(JSON.stringify(project), beforeCutaway, "site suggestions do not change the design");
console.log("3D presentation regression checks passed: surfaces, finishes, roofs, stair voids/guards, camera fit, batching/picking, cutaways, contact shading, pixel budgets, and site context.");
