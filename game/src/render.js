// Everything the eye sees: sky and clouds, the voxel terrain, the target rings,
// the Kestrel drawn from behind, the lit HUD, and the title / pause / end screens.
// The camera sits behind the plane and looks down the valley; the terrain is
// drawn far-to-near, one vertical strip per screen column.
import { COURSE, PLANE, VIEW } from './config.js';
import { createRandom, hash2, valueNoise } from './random.js';
import { groundColor, heightAt, riverX } from './terrain.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const COLUMNS = 160;
const COLUMN_WIDTH = VIEW.width / COLUMNS;

function formatHeading(heading) {
  const degrees = Math.round(((heading * 180) / Math.PI) % 360 + 360) % 360;
  return String(degrees).padStart(3, '0');
}

function formatTime(seconds) {
  const left = Math.max(0, Math.ceil(COURSE.timeLimit - seconds));
  const minutes = Math.floor(left / 60);
  const secs = left % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  const cx = VIEW.width / 2;
  const horizonY = VIEW.height * VIEW.horizon;
  const clouds = [];
  {
    const random = createRandom(777);
    for (let i = 0; i < 26; i += 1) {
      clouds.push({
        x: (random() - 0.5) * 900,
        y: 185 + random() * 90,
        z: random() * 4200,
        r: 34 + random() * 52,
      });
    }
  }

  const trees = [];
  {
    const random = createRandom(4242);
    for (let i = 0; i < 150; i += 1) {
      const x = (random() - 0.5) * 440;
      const z = 100 + random() * 4000;
      if (z > 3480 && z < 4020 && Math.abs(x) < 44) continue; // keep the strip clear
      trees.push({ x, z, size: 9 + random() * 8 });
    }
    trees.sort((a, b) => b.z - a.z);
  }

  /** Camera-space projection: forward is down the valley, right is across it. */
  function project(state, x, y, z) {
    const camX = state.x - Math.sin(state.heading) * 18;
    const camZ = state.z - Math.cos(state.heading) * 18;
    const camY = state.y + 3.5;
    const dx = x - camX;
    const dz = z - camZ;
    const sin = Math.sin(state.heading);
    const cos = Math.cos(state.heading);
    const forward = dx * sin + dz * cos;
    const right = dx * cos - dz * sin;
    if (forward < VIEW.near) return null;
    return {
      sx: cx + (right * VIEW.focal) / forward,
      sy: horizonY - ((y - camY) * VIEW.focal) / forward,
      forward,
    };
  }

  function drawSky(state) {
    const gradient = ctx.createLinearGradient(0, 0, 0, horizonY + 40);
    gradient.addColorStop(0, '#1c4f8a');
    gradient.addColorStop(0.55, '#5ea3d8');
    gradient.addColorStop(1, '#cfe8f5');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW.width, horizonY + 40);
    // Sun, upper right, fixed in the sky.
    const sunX = VIEW.width * 0.82;
    const sunY = VIEW.height * 0.13;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 90);
    glow.addColorStop(0, 'rgba(255, 244, 190, 0.95)');
    glow.addColorStop(0.25, 'rgba(255, 226, 130, 0.55)');
    glow.addColorStop(1, 'rgba(255, 226, 130, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 95, sunY - 95, 190, 190);
    ctx.fillStyle = '#fff6c8';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
    // Clouds drift with the world, not the screen: one soft ellipse each, kept
    // small and far from the camera so none can sprawl across the sky.
    for (let i = 0; i < clouds.length; i += 1) {
      const cloud = clouds[i];
      const p = project(state, cloud.x, cloud.y, cloud.z);
      if (!p || p.forward < 220 || p.forward > VIEW.far + 200) continue;
      if (p.sy < -60 || p.sy > horizonY) continue;
      const scale = VIEW.focal / p.forward;
      const rx = Math.min(120, cloud.r * scale);
      if (rx < 3) continue;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy, rx, rx * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Two hazy ridge lines beyond the valley, so the horizon reads as mountains. */
  function drawBackdrop(state) {
    const shift = -state.heading * 700;
    for (let layer = 0; layer < 2; layer += 1) {
      const base = layer === 0 ? 20 : 10;
      const amp = layer === 0 ? 150 : 70;
      const seedRow = layer === 0 ? 3.7 : 8.2;
      ctx.fillStyle = layer === 0 ? 'rgba(127, 163, 200, 0.85)' : 'rgba(96, 128, 164, 0.9)';
      ctx.beginPath();
      ctx.moveTo(0, horizonY + 2);
      for (let sx = 0; sx <= VIEW.width; sx += 16) {
        const t = (sx + shift * (layer === 0 ? 0.5 : 1)) / 160;
        const peak = base + valueNoise(t, seedRow) * amp;
        ctx.lineTo(sx, horizonY - peak);
      }
      ctx.lineTo(VIEW.width, horizonY + 2);
      ctx.closePath();
      ctx.fill();
      // Snow on the far peaks.
      if (layer === 0) {
        ctx.fillStyle = 'rgba(238, 243, 246, 0.9)';
        for (let sx = 0; sx <= VIEW.width; sx += 16) {
          const t = (sx + shift * 0.5) / 160;
          const peak = base + valueNoise(t, seedRow) * amp;
          if (peak < 120) continue;
          ctx.beginPath();
          ctx.moveTo(sx - 13, horizonY - peak + 22);
          ctx.lineTo(sx, horizonY - peak);
          ctx.lineTo(sx + 13, horizonY - peak + 22);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  /** Voxel terrain: far-to-near depth slices, one coloured strip per column. */
  function drawTerrain(state) {
    const yBuffer = new Float32Array(COLUMNS).fill(horizonY);
    const camX = state.x - Math.sin(state.heading) * 18;
    const camZ = state.z - Math.cos(state.heading) * 18;
    const camY = state.y + 3.5;
    const sin = Math.sin(state.heading);
    const cos = Math.cos(state.heading);
    let depth = VIEW.far;
    while (depth > VIEW.near) {
      const step = Math.max(2.5, depth * 0.045);
      for (let col = 0; col < COLUMNS; col += 1) {
        const sx = (col + 0.5) * COLUMN_WIDTH;
        const right = ((sx - cx) * depth) / VIEW.focal;
        const wx = camX + right * cos + depth * sin;
        const wz = camZ - right * sin + depth * cos;
        const h = heightAt(wx, wz);
        const sy = horizonY - ((h - camY) * VIEW.focal) / depth;
        if (sy < yBuffer[col]) {
          // Mottled ground: a deterministic patch per column and slice, plus
          // shading where the slope turns toward or away from the camera.
          const [r, g, b] = groundColor(wx, wz, h);
          const patch = 0.8 + hash2(Math.floor(col / 2) + 1, Math.floor(depth / 14)) * 0.4;
          const ahead = heightAt(wx, wz + step);
          const slope = Math.max(-0.16, Math.min(0.16, (h - ahead) * 0.03));
          const shade = patch * (1 + slope);
          ctx.fillStyle = `rgb(${Math.round(r * shade)},${Math.round(g * shade)},${Math.round(b * shade)})`;
          ctx.fillRect(col * COLUMN_WIDTH, sy, COLUMN_WIDTH + 1, yBuffer[col] - sy);
          yBuffer[col] = sy;
        }
      }
      depth -= step;
    }
    // Fill any column the slices never reached (below the horizon line).
    ctx.fillStyle = '#4a7a3f';
    for (let col = 0; col < COLUMNS; col += 1) {
      if (yBuffer[col] < VIEW.height) {
        ctx.fillRect(col * COLUMN_WIDTH, yBuffer[col], COLUMN_WIDTH + 1, VIEW.height - yBuffer[col]);
      }
    }
    drawRunwayMarkings(state);
  }

  /** White centreline dashes and the threshold bars on the runway strip. */
  function drawRunwayMarkings(state) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    for (let z = COURSE.runwayZ0; z < COURSE.runwayZ1; z += 30) {
      if (Math.floor(z / 30) % 2 === 0) continue;
      const a = project(state, -1.6, COURSE.runwayAltitude + 0.4, z);
      const b = project(state, 1.6, COURSE.runwayAltitude + 0.4, z);
      const c = project(state, 1.6, COURSE.runwayAltitude + 0.4, z + 14);
      const d = project(state, -1.6, COURSE.runwayAltitude + 0.4, z + 14);
      if (!a || !b || !c || !d) continue;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.lineTo(c.sx, c.sy);
      ctx.lineTo(d.sx, d.sy);
      ctx.closePath();
      ctx.fill();
    }
    // Threshold bars at the runway start.
    for (let x = -20; x <= 20; x += 10) {
      const a = project(state, x - 3.5, COURSE.runwayAltitude + 0.4, COURSE.runwayZ0 + 4);
      const b = project(state, x + 3.5, COURSE.runwayAltitude + 0.4, COURSE.runwayZ0 + 4);
      const c = project(state, x + 3.5, COURSE.runwayAltitude + 0.4, COURSE.runwayZ0 + 14);
      const d = project(state, x - 3.5, COURSE.runwayAltitude + 0.4, COURSE.runwayZ0 + 14);
      if (!a || !b || !c || !d) continue;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.lineTo(c.sx, c.sy);
      ctx.lineTo(d.sx, d.sy);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** Conifers dotted down the valley, far to near, rooted in the ground. */
  function drawTrees(state) {
    for (let i = 0; i < trees.length; i += 1) {
      const tree = trees[i];
      const ground = heightAt(tree.x, tree.z);
      const p = project(state, tree.x, ground, tree.z);
      if (!p || p.forward < 12 || p.forward > VIEW.far) continue;
      const scale = VIEW.focal / p.forward;
      const height = tree.size * scale;
      if (height < 2 || height > 220) continue;
      const width = height * 0.55;
      ctx.fillStyle = '#2c5a2e';
      ctx.beginPath();
      ctx.moveTo(p.sx, p.sy - height);
      ctx.lineTo(p.sx - width / 2, p.sy);
      ctx.lineTo(p.sx + width / 2, p.sy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3f7a37';
      ctx.beginPath();
      ctx.moveTo(p.sx, p.sy - height);
      ctx.lineTo(p.sx - width / 4, p.sy - height * 0.45);
      ctx.lineTo(p.sx + width / 4, p.sy - height * 0.45);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** Target rings, far to near, with the next ring lit amber. Rings just passed
   *  sit behind the camera and are not drawn; passed ones fade out. */
  function drawRings(state, nextRing) {
    const rings = [...state.rings].sort((a, b) => b.z - a.z);
    for (let i = 0; i < rings.length; i += 1) {
      const ring = rings[i];
      const p = project(state, ring.x, ring.y, ring.z);
      if (!p || p.forward < 45 || p.forward > VIEW.far + 120) continue;
      const radius = (ring.radius * VIEW.focal) / p.forward;
      if (radius < 1.5) continue;
      const isNext = nextRing === ring;
      const passed = ring.passed;
      ctx.save();
      ctx.globalAlpha = passed ? 0.4 : 1;
      ctx.lineWidth = Math.max(2, radius * 0.14);
      if (passed) {
        ctx.strokeStyle = 'rgba(120, 220, 130, 0.85)';
      } else if (isNext) {
        ctx.strokeStyle = '#ffb02e';
        ctx.shadowColor = '#ffb02e';
        ctx.shadowBlur = 18;
      } else {
        ctx.strokeStyle = 'rgba(255, 176, 46, 0.55)';
      }
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy, radius, radius * 0.96, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (isNext) {
        ctx.fillStyle = '#ffb02e';
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        const distance = Math.max(0, Math.round(p.forward * 3.2));
        ctx.fillText(`${distance} m`, p.sx, p.sy - radius - 10);
      }
      ctx.restore();
    }
  }

  /** The Kestrel from behind: tail, wings, stabilisers and glowing nav lights. */
  function drawPlane(state) {
    const px = cx;
    const py = VIEW.height * 0.74 + state.pitch * 26;
    const scale = 1.18 + (state.speed - PLANE.cruiseSpeed) / 260;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(state.bank);
    ctx.scale(scale, scale);
    ctx.lineJoin = 'round';
    // Wings.
    ctx.fillStyle = '#e8542f';
    ctx.strokeStyle = '#7c2410';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-14, 6);
    ctx.lineTo(-118, 26);
    ctx.lineTo(-118, 38);
    ctx.lineTo(-12, 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(14, 6);
    ctx.lineTo(118, 26);
    ctx.lineTo(118, 38);
    ctx.lineTo(12, 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Fuselage, seen from the tail.
    ctx.fillStyle = '#f7ead2';
    ctx.strokeStyle = '#5c3a1e';
    ctx.beginPath();
    ctx.moveTo(-20, -34);
    ctx.quadraticCurveTo(0, -44, 20, -34);
    ctx.lineTo(24, 30);
    ctx.quadraticCurveTo(0, 42, -24, 30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Orange cheatline down the fuselage.
    ctx.fillStyle = '#e8542f';
    ctx.beginPath();
    ctx.moveTo(-20, -6);
    ctx.lineTo(20, -6);
    ctx.lineTo(22, 8);
    ctx.lineTo(-22, 8);
    ctx.closePath();
    ctx.fill();
    // Vertical tail fin.
    ctx.fillStyle = '#e8542f';
    ctx.strokeStyle = '#7c2410';
    ctx.beginPath();
    ctx.moveTo(-8, -30);
    ctx.lineTo(0, -72);
    ctx.lineTo(10, -30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Horizontal stabiliser.
    ctx.fillStyle = '#f7ead2';
    ctx.strokeStyle = '#5c3a1e';
    ctx.beginPath();
    ctx.moveTo(-46, 18);
    ctx.lineTo(46, 18);
    ctx.lineTo(40, 30);
    ctx.lineTo(-40, 30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Tail light and nav lights: red port, green starboard, always lit.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -40, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff2d2d';
    ctx.beginPath();
    ctx.arc(-118, 32, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2dff5e';
    ctx.beginPath();
    ctx.arc(118, 32, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** The lit instrument panel: altitude, speed, heading, fuel, throttle, score. */
  function drawHud(state, nextRing, screen) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // Top-left: altitude and speed, big and lit.
    ctx.fillStyle = 'rgba(8, 18, 30, 0.88)';
    ctx.fillRect(14, 14, 218, 92);
    ctx.strokeStyle = 'rgba(140, 220, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(14, 14, 218, 92);
    ctx.fillStyle = '#8cdcff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('ALTITUDE', 26, 36);
    ctx.fillText('SPEED', 26, 80);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(`${Math.round(state.y * 3.28)} ft`, 118, 40);
    ctx.fillText(`${Math.round(state.speed * 1.9)} kt`, 118, 84);
    // Top-centre: compass strip with the heading.
    const heading = formatHeading(state.heading);
    ctx.fillStyle = 'rgba(8, 18, 30, 0.88)';
    ctx.fillRect(cx - 170, 14, 340, 52);
    ctx.strokeStyle = 'rgba(140, 220, 255, 0.5)';
    ctx.strokeRect(cx - 170, 14, 340, 52);
    ctx.fillStyle = '#8cdcff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HEADING', cx, 32);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText(`${heading}°`, cx, 56);
    ctx.fillStyle = '#8cdcff';
    ctx.font = '11px system-ui, sans-serif';
    const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const deg = Number(heading);
    for (let i = -2; i <= 2; i += 1) {
      if (i === 0) continue; // the heading number already sits at the centre
      const label = points[Math.round((((deg + i * 45) % 360) + 360) % 360 / 45) % 8];
      ctx.fillText(label, cx + i * 62, 56);
    }
    // Top-right: score, rings, time.
    ctx.fillStyle = 'rgba(8, 18, 30, 0.88)';
    ctx.fillRect(VIEW.width - 232, 14, 218, 92);
    ctx.strokeStyle = 'rgba(140, 220, 255, 0.5)';
    ctx.strokeRect(VIEW.width - 232, 14, 218, 92);
    ctx.fillStyle = '#8cdcff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE', VIEW.width - 220, 36);
    ctx.fillText('RINGS', VIEW.width - 220, 58);
    ctx.fillText('TIME', VIEW.width - 220, 80);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(String(state.score), VIEW.width - 150, 40);
    ctx.fillText(`${state.ringsPassed}/${COURSE.ringCount}`, VIEW.width - 150, 62);
    ctx.fillText(formatTime(state.time), VIEW.width - 150, 84);
    // Bottom-left: attitude ball and throttle.
    const ax = 78;
    const ay = VIEW.height - 78;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, 44, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#2f6fb4';
    ctx.fillRect(ax - 44, ay - 44, 88, 88);
    ctx.fillStyle = '#7a5a34';
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(-state.bank);
    ctx.translate(0, state.pitch * 40);
    ctx.fillRect(-44, 0, 88, 44);
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = '#8cdcff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ax, ay, 44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(ax - 22, ay);
    ctx.lineTo(ax + 22, ay);
    ctx.stroke();
    ctx.fillStyle = '#8cdcff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', ax, ay + 62);
    // Throttle bar.
    ctx.fillStyle = 'rgba(8, 18, 30, 0.88)';
    ctx.fillRect(140, VIEW.height - 108, 26, 76);
    ctx.fillStyle = '#ffb02e';
    ctx.fillRect(143, VIEW.height - 35 - state.throttle * 70, 20, state.throttle * 70);
    ctx.strokeStyle = 'rgba(140, 220, 255, 0.5)';
    ctx.strokeRect(140, VIEW.height - 108, 26, 76);
    ctx.fillStyle = '#8cdcff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('THR', 153, VIEW.height - 18);
    // Bottom-right: fuel gauge.
    const fuelWidth = 190;
    const fuelX = VIEW.width - fuelWidth - 16;
    const fuelY = VIEW.height - 52;
    ctx.fillStyle = 'rgba(8, 18, 30, 0.88)';
    ctx.fillRect(fuelX - 10, fuelY - 22, fuelWidth + 20, 44);
    ctx.fillStyle = state.fuel < 25 ? '#ff5252' : '#37d67a';
    ctx.fillRect(fuelX, fuelY, fuelWidth * (state.fuel / 100), 16);
    ctx.strokeStyle = 'rgba(140, 220, 255, 0.5)';
    ctx.strokeRect(fuelX, fuelY, fuelWidth, 16);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`FUEL ${Math.round(state.fuel)}%`, fuelX, fuelY - 6);
    // Next-ring pointer: an arrow at the screen edge toward the ring.
    if (nextRing && screen === SCREEN_PLAY) {
      const p = project(state, nextRing.x, nextRing.y, nextRing.z);
      if (p && p.forward > 0) {
        const arrowX = Math.max(30, Math.min(VIEW.width - 30, p.sx));
        const arrowY = Math.max(120, Math.min(VIEW.height - 120, p.sy));
        ctx.fillStyle = '#ffb02e';
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY - 14);
        ctx.lineTo(arrowX + 10, arrowY + 8);
        ctx.lineTo(arrowX - 10, arrowY + 8);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Centre flash message.
    if (state.messageTime > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, state.messageTime);
      ctx.fillStyle = state.ringFlash > 0 ? '#7dff8a' : '#ffb02e';
      ctx.font = 'bold 34px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.message, cx, VIEW.height * 0.3);
      ctx.restore();
    }
    if (state.ringFlash > 0) {
      ctx.save();
      ctx.globalAlpha = state.ringFlash * 0.35;
      ctx.strokeStyle = '#7dff8a';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, VIEW.width - 10, VIEW.height - 10);
      ctx.restore();
    }
    // Low-fuel warning.
    if (state.fuel < 25 && screen === SCREEN_PLAY) {
      ctx.fillStyle = Math.floor(state.time * 2) % 2 === 0 ? '#ff5252' : '#ffffff';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LOW FUEL — FLY HOME', cx, VIEW.height - 24);
    }
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(6, 14, 26, 0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffb02e';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('KESTREL RIDGE RUN', cx, 210);
    ctx.fillStyle = '#ffffff';
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillText('Thread twelve rings down the valley, then land on the strip.', cx, 258);
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillStyle = '#cfe8f5';
    ctx.fillText('← → or A / D steer   •   ↑ ↓ pitch   •   Shift full throttle, Ctrl idle', cx, 330);
    ctx.fillText('Mouse steers by position   •   Wheel sets throttle   •   B air brake', cx, 360);
    ctx.fillText('Mind the ridges, the river and your fuel — a hard landing is a crash.', cx, 390);
    ctx.fillStyle = '#8cdcff';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('PRESS SPACE OR CLICK TO FLY', cx, 452);
    if (best > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillText(`Best score: ${best}`, cx, 496);
    }
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(6, 14, 26, 0.66)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText('PAUSED', cx, 330);
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillStyle = '#cfe8f5';
    ctx.fillText('P or Esc to keep flying   •   R to restart the sortie', cx, 380);
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(6, 14, 26, 0.68)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    if (state.landed) {
      ctx.fillStyle = '#7dff8a';
      ctx.font = 'bold 56px system-ui, sans-serif';
      ctx.fillText('LANDED — SORTIE COMPLETE', cx, 250);
      ctx.fillStyle = '#ffffff';
      ctx.font = '22px system-ui, sans-serif';
      ctx.fillText(`Rings ${state.ringsPassed}/${COURSE.ringCount}  •  Fuel left ${Math.round(state.fuel)}%`, cx, 310);
      if (state.ringsPassed === COURSE.ringCount) {
        ctx.fillText('Perfect course — every ring threaded.', cx, 344);
      }
    } else {
      ctx.fillStyle = '#ff6b5e';
      ctx.font = 'bold 56px system-ui, sans-serif';
      ctx.fillText('CRASHED', cx, 250);
      ctx.fillStyle = '#ffffff';
      ctx.font = '22px system-ui, sans-serif';
      ctx.fillText(state.reason || 'THE VALLEY WINS THIS TIME', cx, 310);
      ctx.fillText(`Rings ${state.ringsPassed}/${COURSE.ringCount}`, cx, 344);
    }
    ctx.fillStyle = '#ffb02e';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText(`SCORE ${state.score}`, cx, 420);
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText(`Best ${Math.max(best, state.score)}`, cx, 458);
    ctx.fillStyle = '#8cdcff';
    ctx.fillText('PRESS SPACE OR R TO FLY AGAIN', cx, 510);
  }

  return {
    draw(state, screen, best, nextRing) {
      drawSky(state);
      drawBackdrop(state);
      drawTerrain(state);
      drawTrees(state);
      drawRings(state, nextRing);
      if (!state.crashed) drawPlane(state);
      drawHud(state, nextRing, screen);
      if (screen === SCREEN_TITLE) drawTitle(state, best);
      else if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_OVER) drawOver(state, best);
    },
  };
}
