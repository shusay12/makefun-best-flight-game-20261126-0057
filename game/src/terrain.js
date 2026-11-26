// The valley the sortie flies through: rolling hills, two mountain ridges, a
// meandering river, and a flattened runway strip at the end of the course.
// Every height is a pure function of (x, z), so the renderer, the physics and
// the autopilot all agree about the ground.
import { COURSE, TERRAIN } from './config.js';
import { valueNoise, valueNoise1 } from './random.js';

/** The river's centre line wanders across the valley as z grows. */
export function riverX(z) {
  return (valueNoise1(z * 0.0016) - 0.5) * 220 - 40;
}

/** True where the runway strip flattens the ground. */
export function onRunway(x, z) {
  return (
    z >= COURSE.runwayZ0 - 60 &&
    z <= COURSE.runwayZ1 + 80 &&
    Math.abs(x) <= COURSE.runwayHalfWidth + 14
  );
}

/** Ground height at (x, z), in world units. */
export function heightAt(x, z) {
  // Rolling hills, two octaves.
  let h = 62 + valueNoise(x * 0.006, z * 0.006) * 46;
  h += valueNoise(x * 0.02 + 9, z * 0.02) * 18;
  // Mountain ridges on both flanks of the valley, close enough to read.
  const flank = Math.abs(x) / 240;
  h += Math.max(0, flank - 0.45) * 220 * (0.6 + 0.4 * valueNoise(x * 0.01, z * 0.004));
  // The river carves a channel down to the water.
  const riverDistance = Math.abs(x - riverX(z));
  const carve = Math.max(0, 1 - riverDistance / 90);
  h = h * (1 - carve) + TERRAIN.waterLevel * 0.45 * carve;
  // The approach corridor grades down to the strip, so the final is flyable.
  if (z >= 3250 && z <= COURSE.runwayZ1 + 80 && Math.abs(x) <= 70) {
    const along = Math.max(0, Math.min(1, (z - 3250) / 310));
    const across = Math.max(0, Math.min(1, (70 - Math.abs(x)) / 20));
    const blend = along * across;
    h = h * (1 - blend) + COURSE.runwayAltitude * blend;
  }
  // The runway strip is graded flat.
  if (onRunway(x, z)) {
    const edge = Math.min(1, (Math.abs(x) - COURSE.runwayHalfWidth) / 14 + 0.6);
    const flat = COURSE.runwayAltitude;
    h = flat * (1 - edge) + h * edge;
    if (z >= COURSE.runwayZ0 && z <= COURSE.runwayZ1 && Math.abs(x) <= COURSE.runwayHalfWidth) {
      h = flat;
    }
  }
  return Math.min(h, TERRAIN.maxHeight);
}

/** Ground colour for a height, as an [r, g, b] triple. */
export function groundColor(x, z, h) {
  if (z >= COURSE.runwayZ0 && z <= COURSE.runwayZ1 && Math.abs(x) <= COURSE.runwayHalfWidth) {
    return [61, 65, 72]; // runway asphalt
  }
  if (h <= TERRAIN.waterLevel + 1.5) return [47, 111, 180]; // river water
  if (h >= TERRAIN.snowLine) return [238, 243, 246]; // snow caps
  if (h >= TERRAIN.rockLine) return [141, 133, 120]; // bare rock
  // Valley grass, greener low down, drier on the slopes.
  const dry = Math.min(1, Math.max(0, (h - 55) / 55));
  return [
    Math.round(74 + dry * 66),
    Math.round(128 - dry * 22),
    Math.round(62 - dry * 12),
  ];
}

/** Whether a point is over the runway strip (for landing checks). */
export function overRunway(x, z) {
  return (
    z >= COURSE.runwayZ0 &&
    z <= COURSE.runwayZ1 &&
    Math.abs(x) <= COURSE.runwayHalfWidth
  );
}
