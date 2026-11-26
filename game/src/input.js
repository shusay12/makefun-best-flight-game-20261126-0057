// Keyboard and mouse: arrows/WASD fly the plane, the mouse steers by position,
// Space confirms, P pauses, R restarts, M mutes. One job: turn events into a
// per-frame input state and one-shot actions.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0.5; // 0..1 across the canvas
  let mouseY = 0.5;
  let mouseActive = false;
  let mouseThrottle = null; // wheel-adjusted throttle, null until the wheel is used

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyR') {
      actions |= ACTION_RESTART;
    } else if (event.code === 'KeyM') {
      actions |= ACTION_MUTE;
    }
    if (event.code.startsWith('Arrow')) event.preventDefault();
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = (event.clientX - rect.left) / rect.width;
    mouseY = (event.clientY - rect.top) / rect.height;
    mouseActive = true;
  }

  function onMouseDown(event) {
    onMouseMove(event);
    actions |= ACTION_CONFIRM;
  }

  function onWheel(event) {
    event.preventDefault();
    if (mouseThrottle === null) mouseThrottle = 0.62;
    mouseThrottle = Math.max(0, Math.min(1, mouseThrottle - Math.sign(event.deltaY) * 0.06));
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  return {
    /** One-shot actions since the last call; reading clears them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Flight controls for this frame: steer -1..1, pitch -1..1, throttle 0..1. */
    flight() {
      const left = keys.has('ArrowLeft') || keys.has('KeyA');
      const right = keys.has('ArrowRight') || keys.has('KeyD');
      const up = keys.has('ArrowUp') || keys.has('KeyW');
      const down = keys.has('ArrowDown') || keys.has('KeyS');
      let steer = (right ? 1 : 0) - (left ? 1 : 0);
      let pitch = (up ? 1 : 0) - (down ? 1 : 0);
      // The mouse steers by position when no key is held: centre is level.
      if (steer === 0 && mouseActive) steer = Math.max(-1, Math.min(1, (mouseX - 0.5) * 2.4));
      if (pitch === 0 && mouseActive) pitch = Math.max(-1, Math.min(1, (0.5 - mouseY) * 2.0));
      let throttle = 0.62;
      if (keys.has('ShiftLeft') || keys.has('ShiftRight')) throttle = 1;
      else if (keys.has('ControlLeft') || keys.has('ControlRight')) throttle = 0.25;
      else if (mouseThrottle !== null) throttle = mouseThrottle;
      return { steer, pitch, throttle, brake: keys.has('KeyB') };
    },
  };
}
