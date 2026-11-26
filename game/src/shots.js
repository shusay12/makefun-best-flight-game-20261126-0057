// Deterministic screenshot scenes: each one flies the real rules forward from a
// fresh world, steered by a pursuit autopilot, so the frame is what a short
// sortie really looks like and the same seed always gives the same frame.
import { COURSE, PLANE, STEP } from './config.js';
import { heightAt } from './terrain.js';
import { EVENT_OVER, EVENT_RING } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SAMPLE = STEP;
const COVER_SECONDS = 16;
const ACTION_SECONDS = 34;
const RING_SECONDS = 26;
const WIN_LIMIT_SECONDS = 300;

/**
 * Pursuit steering: bank toward the next ring (or the runway centreline on final),
 * pitch to match its height, throttle for cruise speed, brake when too fast to land.
 */
export function autopilot(world) {
  const s = world.state;
  const ring = world.nextRing();
  let targetX = 0;
  let targetY = COURSE.runwayAltitude + 2;
  if (ring) {
    targetX = ring.x;
    targetY = ring.y;
  }
  // On final, once the rings are done, aim at the threshold and descend.
  if (!ring) {
    const distanceToThreshold = COURSE.runwayZ0 - s.z;
    targetY = COURSE.runwayAltitude + Math.max(0, Math.min(60, distanceToThreshold * 0.12));
    if (distanceToThreshold < 120) targetY = COURSE.runwayAltitude + 1;
  }
  // Never plan a height the ground ahead cannot clear: look two steps ahead.
  // The clamp lifts once the threshold is close, so the flare can reach the strip.
  if (ring || s.z < COURSE.runwayZ0 - 150) {
    const groundAhead = Math.max(
      heightAt(s.x, s.z + 120),
      heightAt(s.x, s.z + 260),
      heightAt(targetX, s.z + 260),
    );
    targetY = Math.max(targetY, groundAhead + 24);
  }
  const dx = targetX - s.x;
  const dy = targetY - s.y;
  // Desired heading change: steer toward the target, damping the turn.
  const desiredHeading = Math.atan2(dx, Math.max(60, (ring ? ring.z : COURSE.runwayZ0) - s.z));
  const headingError = desiredHeading - s.heading;
  const steer = Math.max(-1, Math.min(1, headingError * 3.2 - s.bank * 0.9));
  const pitch = Math.max(-1, Math.min(1, dy * 0.045));
  let throttle = 0.42;
  if (!ring && s.z > COURSE.runwayZ0 - 700) throttle = 0.3;
  if (!ring && s.z > COURSE.runwayZ0 - 250) throttle = 0.22;
  const brake = !ring && s.speed > 56 && s.z > COURSE.runwayZ0 - 400;
  return { steer, pitch, throttle, brake };
}

/** Fly forward `seconds`, steering with the autopilot, and stop on game over. */
function flyForward(world, seconds) {
  let events = 0;
  for (let i = 0; i < seconds / SAMPLE; i += 1) {
    events = world.step(SAMPLE, autopilot(world));
    if (events & EVENT_OVER) break;
  }
  return events;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best score to show. cover: early flight with a ring ahead. action: mid-course
 * over the river with a ring just passed. ring: a ring pass caught mid-flash.
 * win: the full course flown and landed on the strip.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'action') {
    flyForward(world, ACTION_SECONDS);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'ring') {
    // Fly until a ring is actually passed, then paint inside the flash.
    for (let i = 0; i < RING_SECONDS / SAMPLE; i += 1) {
      const events = world.step(SAMPLE, autopilot(world));
      if (events & EVENT_RING) break;
      if (events & EVENT_OVER) break;
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'win') {
    const events = flyForward(world, WIN_LIMIT_SECONDS);
    if (world.state.landed) return { screen: SCREEN_OVER, best: world.state.score };
    // The autopilot did not land in time: report the miss rather than faking it.
    void events;
    return { screen: SCREEN_OVER, best: world.state.score, landed: false };
  }
  // cover (and anything else): a short hop with the first rings ahead.
  flyForward(world, COVER_SECONDS);
  return { screen: SCREEN_PLAY, best: world.state.score };
}
