type PointerCaptureTarget = Pick<Element, "isConnected" | "setPointerCapture" | "hasPointerCapture" | "releasePointerCapture"> & {
  readonly ownerDocument: { readonly pointerLockElement: Element | null };
};
type PointerPosition = Pick<PointerEvent, "pointerId" | "clientX" | "clientY">;

export function capturePointerSafely(target: PointerCaptureTarget, pointerId: number): boolean {
  // Pointer capture is invalid while any element in the document owns pointer lock.
  if (!target.isConnected || target.ownerDocument.pointerLockElement) return false;
  try {
    target.setPointerCapture(pointerId);
    return true;
  } catch {
    // The pointer or element can become inactive between pointerdown and capture.
    return false;
  }
}

export function createPointerDrag(
  target: PointerCaptureTarget,
  onMove: (deltaX: number, deltaY: number) => void,
  onActiveChange: (active: boolean) => void,
) {
  let active: PointerPosition | undefined;
  const cancel = () => {
    if (!active) return;
    const { pointerId } = active;
    // Clear first: releasing capture can itself trigger lostpointercapture.
    active = undefined;
    onActiveChange(false);
    try {
      if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
    } catch {
      // Cleanup must still complete when a pointer disappears or the view unmounts.
    }
  };
  return {
    start(event: PointerPosition) {
      if (active || !target.isConnected || target.ownerDocument.pointerLockElement) return false;
      active = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY };
      capturePointerSafely(target, event.pointerId);
      // Window pointer listeners keep dragging usable when capture is unavailable.
      onActiveChange(true);
      return true;
    },
    move(event: PointerPosition & Pick<PointerEvent, "buttons">) {
      if (active?.pointerId !== event.pointerId) return;
      if (!(event.buttons & 1) || !target.isConnected || target.ownerDocument.pointerLockElement) {
        cancel();
        return;
      }
      const deltaX = event.clientX - active.clientX;
      const deltaY = event.clientY - active.clientY;
      active = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY };
      onMove(deltaX, deltaY);
    },
    finish(event: Pick<PointerEvent, "pointerId">) {
      if (active?.pointerId === event.pointerId) cancel();
    },
    cancel,
  };
}
