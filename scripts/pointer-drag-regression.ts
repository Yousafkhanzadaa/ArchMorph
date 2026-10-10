import assert from "node:assert/strict";
import { capturePointerSafely, createPointerDrag } from "../src/lib/pointer-drag.ts";

function setup(captureError?: string, releaseError?: string) {
  const captures: number[] = [];
  const releases: number[] = [];
  const moves: number[][] = [];
  const states: boolean[] = [];
  const captured = new Set<number>();
  const target = {
    isConnected: true,
    ownerDocument: { pointerLockElement: null as Element | null },
    setPointerCapture(id: number) {
      captures.push(id);
      if (captureError) throw new DOMException("Capture unavailable", captureError);
      captured.add(id);
    },
    hasPointerCapture: (id: number) => captured.has(id),
    releasePointerCapture(id: number) {
      releases.push(id);
      if (releaseError) throw new DOMException("Pointer no longer active", releaseError);
      captured.delete(id);
      drag.finish({ pointerId: id }); // Browser's lostpointercapture can re-enter cleanup.
    },
  };
  const drag = createPointerDrag(target, (x, y) => moves.push([x, y]), active => states.push(active));
  return { target, drag, captures, releases, moves, states, captured };
}
const down = { pointerId: 1, clientX: 100, clientY: 100 };
const moved = { pointerId: 1, clientX: 125, clientY: 90, buttons: 1 };

const normal = setup();
assert.equal(normal.drag.start(down), true);
normal.drag.move(moved);
normal.drag.finish({ pointerId: 1 });
normal.drag.move({ ...moved, clientX: 150 });
assert.deepEqual(normal.moves, [[25, -10]], "only a held drag rotates the view");
assert.deepEqual(normal.states, [true, false], "release and reentrant lost capture clear once");
assert.deepEqual(normal.releases, [1]);

const locked = setup();
locked.target.ownerDocument.pointerLockElement = {} as Element;
assert.equal(locked.drag.start(down), false, "locked mouse look never starts pointer dragging");
assert.equal(capturePointerSafely(locked.target, 1), false);
assert.deepEqual(locked.captures, [], "no invalid capture call is attempted during pointer lock");
assert.deepEqual(locked.states, []);
locked.target.ownerDocument.pointerLockElement = null;
assert.equal(locked.drag.start(down), true, "dragging works again after unlocking");
locked.drag.cancel();

for (const error of ["InvalidStateError", "NotFoundError"]) {
  const fallback = setup(error);
  assert.doesNotThrow(() => fallback.drag.start(down), error);
  fallback.drag.move(moved); // The component receives this from window, including outside canvas.
  fallback.drag.finish({ pointerId: 1 });
  assert.deepEqual(fallback.moves, [[25, -10]], "capture rejection preserves fallback drag look");
  assert.deepEqual(fallback.states, [true, false]);
  assert.deepEqual(fallback.releases, []);
  assert.equal(capturePointerSafely(fallback.target, 2), false, "movement buttons handle capture rejection too");
}

const missingRelease = setup("InvalidStateError");
missingRelease.drag.start(down);
missingRelease.drag.move({ ...moved, buttons: 0 });
missingRelease.drag.move(moved);
assert.deepEqual(missingRelease.moves, [], "returning after release outside the window cannot leave drag look stuck");
assert.deepEqual(missingRelease.states, [true, false]);

const multiPointer = setup();
multiPointer.drag.start(down);
assert.equal(multiPointer.drag.start({ ...down, pointerId: 2 }), false);
multiPointer.drag.move({ ...moved, pointerId: 2 });
multiPointer.drag.finish({ pointerId: 2 });
multiPointer.drag.move(moved);
assert.deepEqual(multiPointer.moves, [[25, -10]], "another finger cannot hijack or cancel the active drag");
multiPointer.drag.cancel();

const detached = setup();
detached.target.isConnected = false;
assert.equal(detached.drag.start(down), false);
assert.equal(capturePointerSafely(detached.target, 1), false);
assert.deepEqual(detached.captures, []);
detached.target.isConnected = true;
detached.drag.start(down);
detached.target.isConnected = false;
detached.drag.move(moved);
assert.deepEqual(detached.moves, [], "a removed canvas cannot continue moving its old camera");
assert.deepEqual(detached.states, [true, false]);

const releaseFailure = setup(undefined, "NotFoundError");
releaseFailure.drag.start(down);
assert.doesNotThrow(() => releaseFailure.drag.cancel());
releaseFailure.drag.move(moved);
assert.deepEqual(releaseFailure.moves, [], "failed browser release still clears application drag state");
assert.deepEqual(releaseFailure.states, [true, false]);

const lockDuringDrag = setup();
lockDuringDrag.drag.start(down);
lockDuringDrag.target.ownerDocument.pointerLockElement = {} as Element;
lockDuringDrag.drag.move(moved);
assert.deepEqual(lockDuringDrag.moves, [], "locking during drag does not apply both look mechanisms");
assert.deepEqual(lockDuringDrag.states, [true, false]);

console.log("Pointer regression passed: locked/disconnected capture guards, InvalidStateError and NotFoundError fallback, drag deltas, release/cancel/lost capture cleanup, multiple pointers, missing release and lock transitions.");
