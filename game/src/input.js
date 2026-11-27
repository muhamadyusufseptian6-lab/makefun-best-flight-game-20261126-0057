// One Input Manager: keyboard + touch buttons + gamepad, all mapped to the same
// semantic actions (THROTTLE, TURN, PITCH, MAP, PAUSE, MUTE, CONFIRM).
export const ACTIONS = {
  throttleUp: ['KeyW', 'ArrowUp'],
  throttleDown: ['KeyS', 'ArrowDown'],
  turnLeft: ['KeyA', 'ArrowLeft'],
  turnRight: ['KeyD', 'ArrowRight'],
  climb: ['KeyI'],
  descend: ['KeyK'],
  map: ['KeyV'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
  confirm: ['Enter', 'Space'],
  restart: ['KeyR'],
};

export function makeInput() {
  return {
    keys: new Set(),
    pressed: new Set(), // edge-triggered keys, consumed once per frame
    touch: { throttle: 0, turn: 0, pitch: 0 },
    gamepadIndex: null,
  };
}

export function attachInput(input, canvas) {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => input.keys.clear());

  // Touch: on-screen hold buttons set the same semantic actions.
  canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  window.addEventListener('gamepadconnected', (e) => { input.gamepadIndex = e.gamepad.index; });
  window.addEventListener('gamepaddisconnected', () => { input.gamepadIndex = null; });
}

function keyDown(input, codes) {
  return codes.some((c) => input.keys.has(c));
}

export function wasPressed(input, codes) {
  return codes.some((c) => input.pressed.has(c));
}

export function consumePressed(input) {
  input.pressed.clear();
}

// Read the current semantic actions for this frame.
export function readActions(input) {
  let throttle = 0;
  if (keyDown(input, ACTIONS.throttleUp)) throttle += 1;
  if (keyDown(input, ACTIONS.throttleDown)) throttle -= 1;
  let turn = 0;
  if (keyDown(input, ACTIONS.turnLeft)) turn -= 1;
  if (keyDown(input, ACTIONS.turnRight)) turn += 1;
  let pitch = 0;
  if (keyDown(input, ACTIONS.climb)) pitch += 1;
  if (keyDown(input, ACTIONS.descend)) pitch -= 1;

  // Arrow keys double as climb/descend when Shift is held? No — arrows are
  // throttle/turn; pitch lives on I/K and on-screen buttons. Keep it simple.
  // Gamepad: left stick turns, right trigger throttles, buttons pitch.
  if (input.gamepadIndex !== null) {
    const gp = navigator.getGamepads()[input.gamepadIndex];
    if (gp) {
      const dead = (v) => (Math.abs(v) < 0.12 ? 0 : v);
      turn += dead(gp.axes[0]);
      pitch += -dead(gp.axes[1]);
      throttle += (gp.buttons[7]?.value || 0) - (gp.buttons[6]?.value || 0);
      if (gp.buttons[0]?.pressed) pitch += 1;
      if (gp.buttons[1]?.pressed) pitch -= 1;
    }
  }

  turn += input.touch.turn;
  throttle += input.touch.throttle;
  pitch += input.touch.pitch;
  return {
    throttle: Math.max(-1, Math.min(1, throttle)),
    turn: Math.max(-1, Math.min(1, turn)),
    pitch: Math.max(-1, Math.min(1, pitch)),
  };
}

// Touch buttons call this with an action name and -1/0/1 while held.
export function setTouchAction(input, name, value) {
  input.touch[name] = value;
}
