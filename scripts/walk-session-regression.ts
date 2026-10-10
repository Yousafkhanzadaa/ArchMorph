import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { migrateProject } from "../src/lib/architecture.ts";

// Execute the production effect/handlers with browser and GPU cleanup doubles. This
// exercises pointer-lock lifetime even when the embedded browser refuses pointer lock.
const source = ts.createSourceFile("ModelView.tsx", readFileSync(process.env.ARCHMORPH_MODEL_VIEW_SOURCE ?? new URL("../src/app/components/ModelView.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const effects: ts.CallExpression[] = [];
const declarations = new Map<string, ts.Expression>();
function visit(node: ts.Node) {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "useEffect") effects.push(node);
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) declarations.set(node.name.text, node.initializer);
  ts.forEachChild(node, visit);
}
visit(source);
const sceneEffect = effects.find(effect => effect.arguments[1]?.getText(source).includes("sceneKey") && effect.arguments[0].getText(source).includes("new THREE.WebGLRenderer"))!;
const sessionEffect = effects.find(effect => effect.arguments[0].getText(source).includes("exitPointerLock"))!;
assert.ok(sceneEffect && sessionEffect, "the viewer must manage a Walk session");
assert.ok(sceneEffect !== sessionEffect, "rebuilding doors/floors must not end the Walk session");
const sceneBody = (sceneEffect.arguments[0] as ts.ArrowFunction).body as ts.Block;
const cleanup = sceneBody.statements.find(statement => ts.isReturnStatement(statement) && statement.expression && ts.isArrowFunction(statement.expression)) as ts.ReturnStatement;
assert.ok(cleanup?.expression, "test executes the renderer's actual cleanup");

const project = migrateProject(JSON.parse(readFileSync(new URL("../fixtures/sukoon-family-retreat.archmorph.json", import.meta.url), "utf8")).project);
let exits = 0;
let requests = 0;
const domDocument = {
  pointerLockElement: null as object | null,
  removeEventListener() {},
  exitPointerLock() { exits += 1; this.pointerLockElement = null; },
};
const canvas = {
  ownerDocument: domDocument,
  removeEventListener() {},
  requestPointerLock() { requests += 1; },
};
const pressed = new Set<string>();
const disposable = { dispose() {} };
const environment = {
  project,
  navigationMode: "walk",
  cutawayFloorId: undefined,
  siteContext: true,
  canvasRef: { current: canvas },
  pressedKeysRef: { current: pressed },
  pressed,
  canvas,
  document: domDocument,
  window: { clearTimeout() {}, removeEventListener() {} },
  host: { dataset: {} as Record<string, string> },
  camera: { position: { x: 25, y: 5.4, z: 14.63 }, rotation: { set() {} } },
  yaw: 1.2,
  pitch: 0.15,
  wasPointerLocked: false,
  transitionRequested: false,
  walkPoseRef: { current: undefined as { key: string; x: number; y: number; z: number; yaw: number; pitch: number } | undefined },
  disposed: false,
  selectionRef: { current: undefined },
  renderedSceneKeyRef: { current: undefined },
  frame: 1,
  settleTimer: 0,
  observer: { disconnect() {} },
  dragLook: { cancel() {} },
  cancelAnimationFrame() {},
  controls: disposable,
  selectionMaterial: disposable,
  outlineMaterial: disposable,
  scene: { traverse() {} },
  sun: { shadow: disposable },
  palette: disposable,
  renderer: disposable,
  handleSelectionPointerDown() {},
  handleSelectionPointerMove() {},
  finishDragLook() {},
  handleClick() {},
  handleKeyDown() {},
  handleKeyUp() {},
  handleMouseMove() {},
  updatePointerState() {},
  handleWalkInput() {},
  snapshotRender() {},
  reframe() {},
  visibilityChanged() {},
  clearMovement() {},
  interacted() {},
  updateLook: (() => {}) as (x: number, y: number) => void,
  poseKeyForFloor: (floorId: string) => `${floorId}:${environment.project.view.walkStartRoomId ?? environment.project.rooms.find(room => room.floorId === floorId)?.id ?? "site"}`,
};
function execute<T>(expression: ts.Expression): T {
  const js = ts.transpile(`(${expression.getText(source)})`, { target: ts.ScriptTarget.ES2020 });
  return runInNewContext(js, environment) as T;
}
const startSession = execute<() => (() => void) | undefined>(sessionEffect.arguments[0]);
const cleanScene = execute<() => void>(cleanup.expression!);
const mouseMove = execute<(event: { movementX: number; movementY: number }) => void>(declarations.get("handleMouseMove")!);
environment.updateLook = execute<typeof environment.updateLook>(declarations.get("updateLook")!);
const pointerChanged = execute<() => void>(declarations.get("updatePointerState")!);
const keyUp = execute<(event: { code: string }) => void>(declarations.get("handleKeyUp")!);
const clearMovement = execute<() => void>(declarations.get("clearMovement")!);
const keyDown = execute<(event: { code: string }) => void>(declarations.get("handleKeyDown")!);
let stopSession = startSession();
function rebuild(next: typeof project, mode = "walk") {
  const beforeKey = execute<string>(declarations.get("sceneKey")!);
  const beforeDependencies = execute<unknown[]>(sessionEffect.arguments[1]);
  cleanScene();
  environment.project = next;
  environment.navigationMode = mode;
  const afterDependencies = execute<unknown[]>(sessionEffect.arguments[1]);
  if (beforeDependencies.some((value, index) => value !== afterDependencies[index])) {
    stopSession?.();
    stopSession = startSession();
  }
  assert.notEqual(execute<string>(declarations.get("sceneKey")!), beforeKey, "test input really rebuilds the scene");
  environment.wasPointerLocked = domDocument.pointerLockElement === canvas;
  assert.equal(execute<Set<string>>(declarations.get("pressed")!), pressed, "new scene listeners use the same held-key set");
}

domDocument.pointerLockElement = canvas;
environment.wasPointerLocked = true;
pressed.add("KeyW");
pressed.add("ShiftLeft");
mouseMove({ movementX: 40, movementY: -10 });
const lookedYaw = environment.yaw;
const lookedPitch = environment.pitch;
for (let index = 0; index < 8; index++) {
  rebuild({ ...environment.project, openings: environment.project.openings.map((opening, i) => i === 0 ? { ...opening, state: opening.state === "closed" ? "open" : "closed" } : opening) });
  assert.equal(domDocument.pointerLockElement, canvas, "open/close keeps the existing mouse lock");
  assert.deepEqual([...pressed], ["KeyW", "ShiftLeft"], "held movement survives door rebuilds");
  assert.equal(environment.walkPoseRef.current?.yaw, lookedYaw, "latest mouse look survives even before another render frame");
  assert.equal(environment.walkPoseRef.current?.pitch, lookedPitch);
}
const upstairs = environment.project.floors[1].id;
const arrival = { key: `${upstairs}:stair-arrival`, x: 21, y: 15.4, z: 38, yaw: 0.6, pitch: 0.1 };
environment.walkPoseRef.current = arrival;
environment.transitionRequested = true;
rebuild({ ...environment.project, view: { ...environment.project.view, activeFloorId: upstairs } });
assert.equal(domDocument.pointerLockElement, canvas, "stair arrival preserves mouse lock");
assert.equal(environment.walkPoseRef.current, arrival, "cleanup cannot overwrite the pending upstairs arrival pose");
assert.ok(pressed.has("KeyW"), "holding forward continues across the floor transition");
environment.transitionRequested = false;
rebuild({ ...environment.project, view: { ...environment.project.view, activeFloorId: environment.project.floors[0].id } });
assert.equal(domDocument.pointerLockElement, canvas, "manual floor changes also preserve an existing lock");
keyUp({ code: "KeyW" });
assert.ok(!pressed.has("KeyW"), "key release still stops movement after rebuilds");

pressed.add("KeyW");
keyDown({ code: "Escape" }); // Do not prevent the browser's native pointer-lock escape.
assert.equal(pressed.size, 0);
domDocument.pointerLockElement = null;
pointerChanged();
const escapedYaw = environment.yaw;
mouseMove({ movementX: 50, movementY: 0 });
assert.equal(environment.yaw, escapedYaw, "mouse movement stops after Escape");
rebuild({ ...environment.project, view: { ...environment.project.view, activeFloorId: upstairs } });
assert.equal(domDocument.pointerLockElement, null, "floor changes do not relock after Escape");
assert.equal(requests, 0, "scene/session effects never request a fresh mouse lock");

domDocument.pointerLockElement = canvas;
environment.wasPointerLocked = true;
pressed.add("KeyW");
domDocument.pointerLockElement = null;
pointerChanged();
assert.equal(pressed.size, 0, "browser-driven lock loss clears held keys too");
pressed.add("KeyW");
clearMovement();
assert.equal(pressed.size, 0, "blur/hidden-page cleanup prevents stuck movement");
domDocument.pointerLockElement = canvas;
pressed.add("KeyW");
rebuild(environment.project, "orbit");
assert.equal(domDocument.pointerLockElement, null, "leaving Walk releases the mouse");
assert.equal(pressed.size, 0);
assert.equal(exits, 1, "no door or floor change exited pointer lock");

environment.navigationMode = "walk";
stopSession = startSession();
domDocument.pointerLockElement = canvas;
pressed.add("KeyW");
rebuild({ ...environment.project, id: "another-home" });
assert.equal(domDocument.pointerLockElement, null, "changing projects ends the old Walk session");
assert.equal(pressed.size, 0);
domDocument.pointerLockElement = canvas;
pressed.add("KeyW");
stopSession?.();
assert.equal(domDocument.pointerLockElement, null, "unmount releases the session lock");
assert.equal(pressed.size, 0);
stopSession = startSession();
domDocument.pointerLockElement = {};
stopSession?.();
assert.equal(exits, 3, "cleanup never releases another element's mouse lock");

console.log("Walk session regression passed: repeated doors, manual/stair floors, continuous held keys, latest look and stair pose, Escape/browser unlock, blur, Walk exit and unmount.");
