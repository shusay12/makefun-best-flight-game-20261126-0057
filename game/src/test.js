// Scripted self-checks behind ?test=1&seed=N: the game is driven through its real
// step function and the results are written to window.__testResult and the page
// title, so headless Chrome can read them without a live player.
import { COURSE, STEP } from './config.js';
import { EVENT_CRASH, EVENT_LAND, EVENT_OVER, EVENT_RING } from './world.js';
import { autopilot } from './shots.js';

function checkMovement(world) {
  world.reset();
  const startX = world.state.x;
  const startY = world.state.y;
  world.step(STEP, { steer: 1, pitch: 0, throttle: 0.62, brake: false });
  for (let i = 0; i < 60; i += 1) {
    world.step(STEP, { steer: 1, pitch: 0, throttle: 0.62, brake: false });
  }
  const turnedRight = world.state.x > startX + 1 && world.state.heading > 0.01;
  world.reset();
  for (let i = 0; i < 60; i += 1) {
    world.step(STEP, { steer: 0, pitch: 1, throttle: 0.62, brake: false });
  }
  const climbed = world.state.y > startY + 2;
  return turnedRight && climbed;
}

function checkHudUpdates(world) {
  world.reset();
  const before = { altitude: world.state.y, speed: world.state.speed, heading: world.state.heading };
  for (let i = 0; i < 120; i += 1) {
    world.step(STEP, { steer: 0.5, pitch: 0.3, throttle: 0.9, brake: false });
  }
  return (
    world.state.y !== before.altitude &&
    world.state.speed > before.speed &&
    world.state.heading !== before.heading &&
    world.state.fuel < COURSE.fuelStart &&
    world.state.time > 1
  );
}

function checkRingScores(world) {
  world.reset();
  let rings = 0;
  for (let i = 0; i < 120 / STEP; i += 1) {
    const events = world.step(STEP, autopilot(world));
    if (events & EVENT_RING) rings += 1;
    if (events & EVENT_OVER) break;
  }
  return { rings, score: world.state.score, passed: rings >= 3 };
}

function checkWinPath(world) {
  world.reset();
  let events = 0;
  for (let i = 0; i < 300 / STEP; i += 1) {
    events = world.step(STEP, autopilot(world));
    if (events & EVENT_OVER) break;
  }
  return {
    landed: world.state.landed,
    crashed: world.state.crashed,
    reason: world.state.reason,
    ringsPassed: world.state.ringsPassed,
    score: world.state.score,
    time: Math.round(world.state.time * 10) / 10,
    fuel: Math.round(world.state.fuel),
  };
}

function checkCrashPath(world) {
  world.reset();
  let events = 0;
  // Nose down at full throttle into the valley floor.
  for (let i = 0; i < 60 / STEP; i += 1) {
    events = world.step(STEP, { steer: 0, pitch: -1, throttle: 1, brake: false });
    if (events & EVENT_OVER) break;
  }
  return { crashed: world.state.crashed, reason: world.state.reason, wasCrash: (events & EVENT_CRASH) !== 0 };
}

function checkFuelOut(world) {
  world.reset();
  world.state.fuel = 0.4;
  world.state.y = 160;
  let events = 0;
  for (let i = 0; i < 120 / STEP; i += 1) {
    events = world.step(STEP, { steer: 0, pitch: 0, throttle: 1, brake: false });
    if (events & EVENT_OVER) break;
  }
  return { ended: world.state.crashed, reason: world.state.reason };
}

/** Run every check on a fresh world and return the result object. */
export function runSelfChecks(world) {
  const movement = checkMovement(world);
  const hud = checkHudUpdates(world);
  const ring = checkRingScores(world);
  const win = checkWinPath(world);
  const crash = checkCrashPath(world);
  const fuel = checkFuelOut(world);
  const result = {
    movement,
    hudUpdates: hud,
    ringPass: ring.passed,
    ringsIn120s: ring.rings,
    ringScore: ring.score,
    winPathLanded: win.landed,
    winRings: win.ringsPassed,
    winScore: win.score,
    winTime: win.time,
    winFuel: win.fuel,
    winReason: win.reason,
    crashPath: crash.crashed && crash.wasCrash,
    crashReason: crash.reason,
    fuelOutEnds: fuel.ended,
    fuelOutReason: fuel.reason,
  };
  result.pass =
    movement && hud && ring.passed && win.landed && crash.crashed && crash.wasCrash && fuel.ended;
  return result;
}
