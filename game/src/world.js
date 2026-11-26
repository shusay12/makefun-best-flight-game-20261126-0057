// The flight model and the mission: one Kestrel prop-plane flies the valley,
// threads the target rings, and lands on the strip before the fuel runs out.
// A fixed 1/60 s step keeps play and screenshots deterministic.
import { COURSE, PLANE, STEP } from './config.js';
import { createRandom } from './random.js';
import { heightAt, overRunway } from './terrain.js';

export const EVENT_RING = 1;
export const EVENT_CRASH = 2;
export const EVENT_LAND = 4;
export const EVENT_FUEL = 8;
export const EVENT_OVER = 16;

/** Ring centres wander gently across the valley, always clear of the ground. */
export function ringCentres(random) {
  const rings = [];
  let x = 0;
  let y = 110;
  for (let i = 0; i < COURSE.ringCount; i += 1) {
    x = Math.max(-70, Math.min(70, x + (random() - 0.5) * 90));
    y = Math.max(70, Math.min(150, y + (random() - 0.5) * 44));
    const z = COURSE.firstRingZ + i * COURSE.ringSpacing;
    // A ring the ground swallows is a ring nobody can fly.
    y = Math.max(y, heightAt(x, z) + 32);
    y = Math.min(y, 168);
    rings.push({
      z,
      x,
      y,
      radius: 15,
      passed: false,
      resolved: false,
    });
  }
  return rings;
}

export function createWorld(random) {
  const world = {
    state: null,
    reset() {
      world.state = {
        time: 0,
        x: 0,
        y: PLANE.startAltitude,
        z: 0,
        heading: 0, // radians, 0 is straight down the valley (+z)
        bank: 0,
        pitch: 0,
        speed: PLANE.startSpeed,
        throttle: 0.62,
        fuel: COURSE.fuelStart,
        score: 0,
        ringsPassed: 0,
        rings: ringCentres(createRandom(20261126)),
        damage: 0,
        landed: false,
        crashed: false,
        reason: '',
        message: '',
        messageTime: 0,
        ringFlash: 0,
      };
      void random;
    },
    /** The next ring still ahead of the plane, or null once all are resolved. */
    nextRing() {
      const s = world.state;
      for (let i = 0; i < s.rings.length; i += 1) {
        if (!s.rings[i].resolved) return s.rings[i];
      }
      return null;
    },
    /** Advance one fixed step. `input` is { steer, pitch, throttle, brake }. */
    step(dt, input) {
      const s = world.state;
      if (s.crashed || s.landed) return 0;
      let events = 0;
      s.time += dt;

      // Throttle: the lever moves toward the commanded setting, speed follows.
      const targetThrottle = input.throttle;
      s.throttle += (targetThrottle - s.throttle) * Math.min(1, dt * 2.2);
      const thrust = s.throttle * PLANE.accel;
      const drag = PLANE.drag * s.speed;
      s.speed += (thrust - drag) * dt;
      if (input.brake) s.speed -= 30 * dt;
      s.speed = Math.max(0, Math.min(PLANE.maxSpeed, s.speed));

      // Bank and turn: the nose follows the bank, the bank follows the stick.
      const targetBank = input.steer * PLANE.maxBank;
      const bankDelta = targetBank - s.bank;
      s.bank += Math.max(-PLANE.bankRate * dt, Math.min(PLANE.bankRate * dt, bankDelta));
      s.heading += s.bank * PLANE.turnRate * dt * (0.55 + 0.45 * (s.speed / PLANE.maxSpeed));

      // Pitch: pull climbs, push descends; a slow wing sinks on its own.
      const targetPitch = input.pitch * 0.5;
      s.pitch += (targetPitch - s.pitch) * Math.min(1, dt * 3);
      let vertical = Math.sin(s.pitch) * PLANE.climbRate;
      if (s.speed < PLANE.minSpeed) {
        vertical -= (PLANE.minSpeed - s.speed) * 0.45; // stall sink
      }
      s.y += vertical * dt;
      if (s.y < 4) s.y = 4;

      // Forward motion, steered by heading.
      const forward = s.speed * dt;
      s.x += Math.sin(s.heading) * forward;
      s.z += Math.cos(s.heading) * forward;
      // The valley walls push back: flying far out is a long way home.
      if (Math.abs(s.x) > 320) s.x = Math.sign(s.x) * 320;

      // Fuel: full throttle drinks, idle sips.
      const burn = COURSE.fuelBurnIdle + (COURSE.fuelBurn - COURSE.fuelBurnIdle) * s.throttle;
      s.fuel -= burn * dt;
      if (s.fuel <= 0) {
        s.fuel = 0;
        events |= EVENT_FUEL;
      }

      // Rings: crossing a ring's plane inside its circle scores.
      for (let i = 0; i < s.rings.length; i += 1) {
        const ring = s.rings[i];
        if (ring.resolved) continue;
        const prevZ = s.z - forward;
        if (prevZ < ring.z && s.z >= ring.z) {
          ring.resolved = true;
          const dx = s.x - ring.x;
          const dy = s.y - ring.y;
          if (dx * dx + dy * dy <= ring.radius * ring.radius) {
            ring.passed = true;
            s.ringsPassed += 1;
            s.score += COURSE.ringScore;
            s.ringFlash = 1;
            s.message = `RING ${s.ringsPassed}/${COURSE.ringCount}  +${COURSE.ringScore}`;
            s.messageTime = 1.6;
            events |= EVENT_RING;
          } else {
            s.message = 'RING MISSED';
            s.messageTime = 1.2;
          }
        }
      }
      if (s.ringFlash > 0) s.ringFlash = Math.max(0, s.ringFlash - dt * 1.4);
      if (s.messageTime > 0) s.messageTime -= dt;

      // Landing: wheels down on the strip, slow and level, once the course is flown.
      const ground = heightAt(s.x, s.z);
      if (overRunway(s.x, s.z) && s.y <= ground + 2.5 && s.speed < 58 && Math.abs(s.bank) < 0.35) {
        if (world.nextRing() === null) {
          s.landed = true;
          s.y = ground;
          s.score += COURSE.landingScore;
          if (s.damage === 0 && s.ringsPassed === COURSE.ringCount) s.score += COURSE.perfectBonus;
          events |= EVENT_LAND;
          return events | EVENT_OVER;
        }
        s.message = 'RINGS FIRST — FLY THE COURSE';
        s.messageTime = 1.2;
      }

      // Ground strike: the valley floor, a ridge, or the water.
      if (s.y <= ground + 1) {
        s.crashed = true;
        s.y = ground + 1;
        s.damage = 100;
        s.reason = s.y <= 36 ? 'DITCHED IN THE RIVER' : 'TERRAIN STRIKE';
        events |= EVENT_CRASH;
        return events | EVENT_OVER;
      }

      // Out of fuel or out of time: glide down and the sortie ends.
      if (s.fuel <= 0) {
        s.throttle = 0;
        if (s.speed < 8) {
          s.crashed = true;
          s.reason = 'OUT OF FUEL';
          events |= EVENT_CRASH;
          return events | EVENT_OVER;
        }
      }
      if (s.time >= COURSE.timeLimit) {
        s.crashed = true;
        s.reason = 'OUT OF TIME';
        events |= EVENT_CRASH;
        return events | EVENT_OVER;
      }
      return events;
    },
  };
  world.reset();
  return world;
}
