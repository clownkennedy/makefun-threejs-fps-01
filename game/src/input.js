// Keyboard + mouse input for EMBERLINE: pointer lock, look deltas, key state.
// The game reads this every fixed step; the DOM layer never touches keys.
export function createInput(canvas) {
  const keys = new Set();
  let lookX = 0;
  let lookY = 0;
  let attack = false;
  let locked = false;
  let onLockChange = null;

  function keyDown(e) {
    if (e.code === 'Tab') e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
  }
  function keyUp(e) {
    keys.delete(e.code);
  }
  function mouseMove(e) {
    if (!locked) return;
    lookX += e.movementX || 0;
    lookY += e.movementY || 0;
  }
  function mouseDown(e) {
    if (e.button === 0) attack = true;
  }
  function mouseUp(e) {
    if (e.button === 0) attack = false;
  }
  function lockChange() {
    locked = document.pointerLockElement === canvas;
    if (!locked) attack = false;
    if (onLockChange) onLockChange(locked);
  }
  function blur() {
    keys.clear();
    attack = false;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('mousemove', mouseMove);
  window.addEventListener('mousedown', mouseDown);
  window.addEventListener('mouseup', mouseUp);
  document.addEventListener('pointerlockchange', lockChange);
  window.addEventListener('blur', blur);

  return {
    get locked() { return locked; },
    get attack() { return attack; },
    requestLock() {
      canvas.requestPointerLock();
    },
    exitLock() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
    set onLockChange(fn) { onLockChange = fn; },
    down(code) { return keys.has(code); },
    pressed(code) {
      // one-shot: true once per physical press until the key is released
      if (keys.has(code)) {
        keys.delete(code);
        return true;
      }
      return false;
    },
    takeLook() {
      const out = { dx: lookX, dy: lookY };
      lookX = 0;
      lookY = 0;
      return out;
    },
    dispose() {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('mousemove', mouseMove);
      window.removeEventListener('mousedown', mouseDown);
      window.removeEventListener('mouseup', mouseUp);
      document.removeEventListener('pointerlockchange', lockChange);
      window.removeEventListener('blur', blur);
    },
  };
}
