// Tunables for Kestrel Ridge Run: canvas, flight model, course and scoring.
// One job: every number the rest of the game shares lives here.
export const STEP = 1 / 60;
export const BEST_KEY = 'kestrel-ridge-run-best';

export const VIEW = {
  width: 1280,
  height: 720,
  horizon: 0.42, // fraction of the height where the horizon sits
  focal: 620, // projection focal length in pixels
  far: 420, // farthest terrain slice drawn, in world units
  near: 6, // nearest terrain slice drawn
};

export const PLANE = {
  maxSpeed: 96, // world units per second at full throttle
  cruiseSpeed: 62, // speed the autopilot and a steady hand hold
  minSpeed: 34, // below this the wing stops flying and the nose drops
  accel: 26, // speed gained per second at full throttle
  drag: 0.16, // speed lost per second, proportional to speed
  climbRate: 26, // vertical speed at full pull, units per second
  sinkRate: 14, // vertical speed at full push / stall sink
  bankRate: 1.9, // radians per second the bank angle moves
  maxBank: 1.05, // radians of bank, about 60 degrees
  turnRate: 0.55, // heading change per second at full bank
  startAltitude: 96,
  startSpeed: 62,
};

export const COURSE = {
  ringCount: 12,
  firstRingZ: 320,
  ringSpacing: 260,
  runwayZ0: 3560, // runway threshold
  runwayZ1: 3960, // runway far end
  runwayHalfWidth: 26,
  runwayAltitude: 42, // terrain is flattened to this height on the strip
  fuelStart: 100,
  fuelBurn: 0.55, // fuel per second at full throttle
  fuelBurnIdle: 0.12, // fuel per second at idle
  timeLimit: 240, // seconds for the whole sortie
  ringScore: 100,
  landingScore: 500,
  perfectBonus: 250, // every ring, no damage
};

export const TERRAIN = {
  waterLevel: 34, // below this height the ground is river blue
  snowLine: 150, // above this height the ground is snow white
  rockLine: 108, // above this height the ground is bare rock
  maxHeight: 190,
};
