import * as THREE from 'three';
import type { MapId } from './types';

function hash2d(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

/**
 * Generates a tangent-space normal map DataTexture from a procedural height callback.
 */
function buildNormalMapFromHeight(
  size: number,
  heightFn: (x: number, y: number) => number,
  strength: number,
  repeatX = 1,
  repeatY = 1
): THREE.DataTexture {
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      heights[y * size + x] = heightFn(x, y);
    }
  }

  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;

      const dX = (heights[y * size + xp] - heights[y * size + xm]) * strength;
      const dY = (heights[yp * size + x] - heights[ym * size + x]) * strength;

      let nx = -dX;
      let ny = -dY;
      let nz = 1.0;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;

      const idx = (y * size + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

export interface TerrainTextureSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.CanvasTexture;
}

/**
 * High-detail map-authentic floor PBR texture set (stadium slabs, worksite concrete,
 * resort travertine stone pavers, or rain-slicked harbor asphalt)
 */
export function createTerrainTextureSet(
  maxAnisotropy: number,
  baseHex = '#cbd5e1',
  altHex = '#d4dde8',
  lineHex = 'rgba(51, 65, 85, 0.22)',
  repeatCount = 26,
  mapId: MapId = 'arena'
): TerrainTextureSet {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  rCtx.fillStyle = mapId === 'docks' ? '#a8a8a8' : '#c8c8c8';
  rCtx.fillRect(0, 0, size, size);

  if (mapId === 'splash') {
    // Running-bond travertine resort stone pavers (4x8 staggered tiles)
    const rows = 4;
    const cols = 4;
    const rowH = size / rows;
    const colW = size / cols;
    for (let r = 0; r < rows; r++) {
      const offset = r % 2 === 1 ? colW * 0.5 : 0;
      for (let c = -1; c <= cols; c++) {
        const tx = c * colW + offset;
        const ty = r * rowH;
        const tone = hash2d(c + 10, r + 20);
        ctx.fillStyle = tone > 0.65 ? '#e7e2d8' : tone > 0.3 ? altHex : baseHex;
        ctx.fillRect(tx + 3, ty + 3, colW - 6, rowH - 6);

        // Travertine warm mineral highlight & grout shadow
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
        ctx.lineWidth = 2;
        ctx.strokeRect(tx + 4, ty + 4, colW - 8, rowH - 8);

        rCtx.fillStyle = tone > 0.5 ? '#bdbdbd' : '#cfcfcf';
        rCtx.fillRect(tx + 3, ty + 3, colW - 6, rowH - 6);
      }
    }
  } else if (mapId === 'construction') {
    // Industrial poured worksite concrete + compacted dirt/gravel patches
    ctx.fillStyle = altHex;
    ctx.fillRect(0, 0, size / 2, size / 2);
    ctx.fillRect(size / 2, size / 2, size / 2, size / 2);

    for (let d = 0; d < 7; d++) {
      const dx = hash2d(d, 13.7) * size;
      const dy = hash2d(d, 29.3) * size;
      const dr = 34 + hash2d(d, 47.1) * 52;
      const dirt = ctx.createRadialGradient(dx, dy, 4, dx, dy, dr);
      dirt.addColorStop(0, 'rgba(120, 83, 52, 0.24)');
      dirt.addColorStop(1, 'rgba(120, 83, 52, 0)');
      ctx.fillStyle = dirt;
      ctx.beginPath();
      ctx.arc(dx, dy, dr, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Brushed architectural slab variation (Arena & Docks)
    ctx.fillStyle = altHex;
    ctx.fillRect(0, 0, size / 2, size / 2);
    ctx.fillRect(size / 2, size / 2, size / 2, size / 2);

    // Subtle brushed trowel grain lines
    ctx.fillStyle = mapId === 'docks' ? 'rgba(15, 23, 42, 0.09)' : 'rgba(255, 255, 255, 0.04)';
    for (let y = 0; y < size; y += 6) {
      if (hash2d(y, 4.1) > 0.45) {
        ctx.fillRect(0, y, size, 2);
      }
    }
  }

  // High-density aggregate stone grain & weathering pores
  for (let i = 0; i < 11000; i++) {
    const x = Math.floor(hash2d(i, 1.3) * size);
    const y = Math.floor(hash2d(i, 7.9) * size);
    const sz = i % 9 === 0 ? 3 : 2;
    const dark = i % 2 === 0;
    ctx.fillStyle = dark ? 'rgba(15, 23, 42, 0.07)' : 'rgba(255, 255, 255, 0.065)';
    ctx.fillRect(x, y, sz, sz);
    rCtx.fillStyle = dark ? 'rgba(242,242,242,0.25)' : 'rgba(120,120,120,0.2)';
    rCtx.fillRect(x, y, sz, sz);
  }

  // Realistic hairline concrete / asphalt cracks
  ctx.strokeStyle = mapId === 'docks' ? 'rgba(2, 6, 23, 0.34)' : 'rgba(15, 23, 42, 0.18)';
  ctx.lineWidth = 1.6;
  for (let c = 0; c < 6; c++) {
    let cx = hash2d(c, 5.5) * size;
    let cy = hash2d(c, 9.1) * size;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    for (let seg = 0; seg < 7; seg++) {
      cx += (hash2d(c * 10 + seg, 2.2) - 0.5) * 34;
      cy += (hash2d(c * 10 + seg, 4.4) - 0.5) * 34;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  // Damp puddle / polished wear variation patches (specular roughness modulation)
  const puddleCount = mapId === 'docks' ? 18 : 12;
  for (let p = 0; p < puddleCount; p++) {
    const px = hash2d(p, 19.1) * size;
    const py = hash2d(p, 41.7) * size;
    const rad = 28 + hash2d(p, 83.2) * 52;
    const grad = rCtx.createRadialGradient(px, py, 2, px, py, rad);
    grad.addColorStop(0, mapId === 'docks' ? 'rgba(88, 88, 88, 0.65)' : 'rgba(145, 145, 145, 0.42)');
    grad.addColorStop(1, 'rgba(145, 145, 145, 0)');
    rCtx.fillStyle = grad;
    rCtx.beginPath();
    rCtx.arc(px, py, rad, 0, Math.PI * 2);
    rCtx.fill();

    // Subtle dark oil/damp stain on albedo
    const sGrad = ctx.createRadialGradient(px, py, 2, px, py, rad * 0.78);
    sGrad.addColorStop(0, mapId === 'docks' ? 'rgba(2, 6, 23, 0.16)' : 'rgba(15, 23, 42, 0.065)');
    sGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = sGrad;
    ctx.beginPath();
    ctx.arc(px, py, rad * 0.78, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tire / boot tactical scuff streaks across slabs
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.1)';
  ctx.lineWidth = 3.2;
  for (let s = 0; s < 6; s++) {
    const sx = hash2d(s, 61.3) * size * 0.7 + 30;
    const sy = hash2d(s, 73.9) * size * 0.7 + 30;
    const ang = (hash2d(s, 91.1) - 0.5) * 0.8;
    const len = 38 + hash2d(s, 17.7) * 56;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
    ctx.stroke();
  }

  if (mapId !== 'splash') {
    // Deep expansion joint grooves + chamfer edge highlight
    ctx.strokeStyle = lineHex;
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.11)';
    ctx.lineWidth = 2;
    ctx.strokeRect(3, 3, size - 6, size - 6);

    ctx.strokeStyle = 'rgba(51, 65, 85, 0.22)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.stroke();

    // Corner anchor bolts & recessed drain grate
    ctx.fillStyle = 'rgba(15, 23, 42, 0.34)';
    [12, size / 2 - 14, size / 2 + 10, size - 16].forEach((bx) => {
      [12, size / 2 - 14, size / 2 + 10, size - 16].forEach((by) => {
        ctx.fillRect(bx, by, 5, 5);
      });
    });

    ctx.fillStyle = 'rgba(15, 23, 42, 0.42)';
    ctx.fillRect(28, 28, 42, 42);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let gx = 32; gx < 68; gx += 6) {
      ctx.fillRect(gx, 32, 3, 34);
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeatCount, repeatCount);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(repeatCount, repeatCount);
  roughnessMap.anisotropy = maxAnisotropy;

  const normalMap = buildNormalMapFromHeight(
    256,
    (x, y) => {
      if (mapId === 'splash') {
        const row = Math.floor(y / 64);
        const colX = (x + (row % 2 === 1 ? 32 : 0)) % 64;
        const grout = y % 64 < 3 || colX < 3 ? -0.7 : 0.08;
        const stone = (hash2d(x, y) - 0.5) * 0.16;
        return grout + stone;
      }
      const seam = x < 3 || y < 3 || Math.abs(x - 128) < 2 || Math.abs(y - 128) < 2 ? -0.72 : 0;
      const drain = x >= 14 && x <= 35 && y >= 14 && y <= 35 ? (x % 3 === 0 ? -0.52 : 0.1) : 0;
      const grit = (hash2d(x, y) - 0.5) * 0.22;
      return seam + drain + grit;
    },
    3.8,
    repeatCount,
    repeatCount
  );

  return { map, normalMap, roughnessMap };
}

export function createTerrainTexture(
  maxAnisotropy: number,
  baseHex = '#cbd5e1',
  altHex = '#d4dde8',
  lineHex = 'rgba(51, 65, 85, 0.22)'
): THREE.CanvasTexture {
  return createTerrainTextureSet(maxAnisotropy, baseHex, altHex, lineHex).map;
}

/**
 * Natural outdoor grass turf & packed earth dirt PBR texture set
 */
export function createGrassDirtTextureSet(
  maxAnisotropy: number,
  repeatCount = 1,
  kind: 'grass' | 'dirt' = 'grass'
): TerrainTextureSet {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  // Rich loamy soil / turf base
  ctx.fillStyle = kind === 'grass' ? '#3d5e2a' : '#6c533c';
  ctx.fillRect(0, 0, size, size);

  rCtx.fillStyle = kind === 'grass' ? '#d8d8d8' : '#e2e2e2';
  rCtx.fillRect(0, 0, size, size);

  // Soft soil / moss mottling patches
  for (let p = 0; p < 24; p++) {
    const px = hash2d(p, 11.4) * size;
    const py = hash2d(p, 27.9) * size;
    const rad = 28 + hash2d(p, 53.2) * 58;
    const grad = ctx.createRadialGradient(px, py, 3, px, py, rad);
    if (kind === 'grass') {
      grad.addColorStop(
        0,
        p % 3 === 0 ? 'rgba(92, 70, 48, 0.36)' : p % 2 === 0 ? 'rgba(77, 124, 54, 0.42)' : 'rgba(42, 74, 28, 0.38)'
      );
      grad.addColorStop(1, 'rgba(61, 94, 42, 0)');
    } else {
      grad.addColorStop(
        0,
        p % 3 === 0 ? 'rgba(69, 50, 34, 0.45)' : p % 2 === 0 ? 'rgba(138, 108, 76, 0.38)' : 'rgba(84, 96, 52, 0.28)'
      );
      grad.addColorStop(1, 'rgba(108, 83, 60, 0)');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine soil grit & small earth clods
  for (let i = 0; i < 12000; i++) {
    const x = Math.floor(hash2d(i, 3.7) * size);
    const y = Math.floor(hash2d(i, 8.9) * size);
    const sz = i % 11 === 0 ? 3 : 2;
    if (kind === 'grass') {
      ctx.fillStyle =
        i % 5 === 0
          ? 'rgba(88, 66, 44, 0.25)'
          : i % 2 === 0
          ? 'rgba(30, 56, 20, 0.24)'
          : 'rgba(124, 158, 72, 0.2)';
    } else {
      ctx.fillStyle =
        i % 7 === 0
          ? 'rgba(180, 162, 138, 0.28)'
          : i % 2 === 0
          ? 'rgba(54, 38, 24, 0.26)'
          : 'rgba(148, 114, 82, 0.22)';
    }
    ctx.fillRect(x, y, sz, sz);
  }

  // Directional grass blades (dense for grass, sparse hardy weed tufts for dirt)
  const bladeCount = kind === 'grass' ? 5400 : 750;
  ctx.lineWidth = 1.6;
  for (let b = 0; b < bladeCount; b++) {
    const bx = hash2d(b, 1.9) * size;
    const by = hash2d(b, 6.1) * size;
    const ang = -Math.PI / 2 + (hash2d(b, 4.3) - 0.5) * 1.1;
    const len = 5 + hash2d(b, 9.8) * 9;
    ctx.strokeStyle =
      b % 7 === 0
        ? 'rgba(154, 140, 82, 0.55)'
        : b % 3 === 0
        ? 'rgba(104, 148, 62, 0.65)'
        : b % 2 === 0
        ? 'rgba(66, 108, 42, 0.7)'
        : 'rgba(42, 78, 26, 0.68)';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + Math.cos(ang) * len, by + Math.sin(ang) * len);
    ctx.stroke();

    // Slightly smoother specular sheen along fresh grass tips vs matte soil
    rCtx.fillStyle = kind === 'grass' ? 'rgba(185, 185, 185, 0.28)' : 'rgba(210, 210, 210, 0.2)';
    rCtx.fillRect(bx, by, 2, 2);
  }

  // Scattered small gravel pebbles
  const pebbleCount = kind === 'dirt' ? 420 : 110;
  for (let g = 0; g < pebbleCount; g++) {
    const gx = hash2d(g, 33.1) * size;
    const gy = hash2d(g, 71.7) * size;
    const r = 1.5 + hash2d(g, 99.3) * 2.8;
    ctx.fillStyle = g % 2 === 0 ? 'rgba(148, 138, 124, 0.55)' : 'rgba(87, 78, 68, 0.58)';
    ctx.beginPath();
    ctx.arc(gx, gy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeatCount, repeatCount);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(repeatCount, repeatCount);
  roughnessMap.anisotropy = maxAnisotropy;

  const normalMap = buildNormalMapFromHeight(
    256,
    (x, y) => {
      const clump = Math.sin(x * 0.19) * Math.cos(y * 0.21) * 0.32;
      const blade = (hash2d(x, y) - 0.5) * (kind === 'grass' ? 0.78 : 0.58);
      const pebble = hash2d(x * 0.5, y * 0.5) > 0.92 ? 0.58 : 0;
      return clump + blade + pebble;
    },
    5.4,
    repeatCount,
    repeatCount
  );

  return { map, normalMap, roughnessMap };
}

/**
 * Full-arena 1024x1024 non-repeating ground details & markings tailored per map
 */
export function createArenaFloorMarkingsTexture(
  mapId: MapId,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const drawHazardBand = (x: number, y: number, w: number, h: number, colA: string, colB: string) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = colA;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = colB;
    for (let hx = x - h; hx < x + w + h; hx += 28) {
      ctx.beginPath();
      ctx.moveTo(hx, y + h);
      ctx.lineTo(hx + 14, y + h);
      ctx.lineTo(hx + 14 + h, y);
      ctx.lineTo(hx + h, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };

  if (mapId === 'arena') {
    // Natural stone spawn pad inlays & subtle tactical lane markers on grass/dirt ground
    ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.fillRect(size * 0.34, size * 0.84, size * 0.32, size * 0.11);
    ctx.fillRect(size * 0.34, size * 0.05, size * 0.32, size * 0.11);

    ctx.strokeStyle = 'rgba(14, 165, 233, 0.36)';
    ctx.lineWidth = 4;
    ctx.strokeRect(size * 0.34, size * 0.84, size * 0.32, size * 0.11);
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.36)';
    ctx.strokeRect(size * 0.34, size * 0.05, size * 0.32, size * 0.11);

    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(14, 165, 233, 0.45)';
    ctx.fillText('ALPHA BASE', size / 2, size * 0.905);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.45)';
    ctx.fillText('OMEGA BASE', size / 2, size * 0.115);
  } else if (mapId === 'construction') {
    // Muddy heavy-equipment tire track ruts + site caution strips
    ctx.strokeStyle = 'rgba(41, 31, 22, 0.32)';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.82, 220, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.18, 220, Math.PI * 0.12, Math.PI * 0.88);
    ctx.stroke();

    drawHazardBand(120, 32, size - 240, 14, 'rgba(234, 179, 8, 0.55)', 'rgba(15, 23, 42, 0.65)');
    drawHazardBand(120, size - 46, size - 240, 14, 'rgba(234, 179, 8, 0.55)', 'rgba(15, 23, 42, 0.65)');
  } else if (mapId === 'splash') {
    // Poolside mosaic stone border cleanly framing the central 27x27 pool apron
    ctx.strokeStyle = 'rgba(2, 132, 199, 0.46)';
    ctx.lineWidth = 10;
    ctx.strokeRect(size * 0.24, size * 0.26, size * 0.52, size * 0.48);
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.34)';
    ctx.lineWidth = 5;
    ctx.strokeRect(size * 0.22, size * 0.24, size * 0.56, size * 0.52);
  } else if (mapId === 'docks') {
    // Port Cargo Apron Painted Container Bays & Dockside Yellow Edge Stripes
    drawHazardBand(20, 20, 20, size - 40, 'rgba(250, 204, 21, 0.62)', 'rgba(15, 23, 42, 0.72)');
    drawHazardBand(size - 40, 20, 20, size - 40, 'rgba(250, 204, 21, 0.62)', 'rgba(15, 23, 42, 0.72)');

    ctx.strokeStyle = 'rgba(248, 250, 252, 0.38)';
    ctx.lineWidth = 6;
    // Painted cargo staging bay outlines
    [
      [180, 140, 220, 140],
      [620, 140, 220, 140],
      [180, 740, 220, 140],
      [620, 740, 220, 140],
    ].forEach(([bx, by, bw, bh]) => {
      ctx.strokeRect(bx, by, bw, bh);
    });

    ctx.save();
    ctx.setLineDash([28, 18]);
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.42)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(size * 0.5, 50);
    ctx.lineTo(size * 0.5, size - 50);
    ctx.stroke();
    ctx.restore();

    ctx.font = 'bold 34px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(248, 250, 252, 0.45)';
    ctx.fillText('BERTH 04 // CARGO APRON', size / 2, size * 0.92);
    ctx.fillText('BERTH 01 // GANTRY BAY', size / 2, size * 0.09);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Brushed diamond-plate steel catwalk & bridge deck PBR texture set
 */
export function createBridgeDeckTextureSet(
  maxAnisotropy: number,
  repeatX = 4,
  repeatY = 4
): TerrainTextureSet {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  ctx.fillStyle = '#475569';
  ctx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#a8a8a8';
  rCtx.fillRect(0, 0, size, size);

  // Welded steel plate grid + diamond tread pattern
  for (let y = 0; y < size; y += 16) {
    for (let x = 0; x < size; x += 16) {
      const offset = ((y / 16) % 2) * 8;
      ctx.fillStyle = 'rgba(226, 232, 240, 0.16)';
      ctx.fillRect((x + offset) % size, y + 6, 7, 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.26)';
      ctx.fillRect((x + offset + 4) % size, y + 3, 2, 7);

      rCtx.fillStyle = '#8e8e8e';
      rCtx.fillRect((x + offset) % size, y + 6, 7, 2);
    }
  }

  // Heavy plate seam dividers & rivets
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.52)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, size - 4, size - 4);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.stroke();

  // Safety hazard yellow edge strip
  ctx.fillStyle = 'rgba(245, 158, 11, 0.42)';
  ctx.fillRect(0, 0, size, 8);
  ctx.fillRect(0, size - 8, size, 8);

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeatX, repeatY);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(repeatX, repeatY);
  roughnessMap.anisotropy = maxAnisotropy;

  const normalMap = buildNormalMapFromHeight(
    128,
    (x, y) => {
      const seam = x < 2 || y < 2 || Math.abs(x - 64) < 2 || Math.abs(y - 64) < 2 ? -0.5 : 0;
      const tread = ((x % 8 < 4 && y % 8 === 3) || (y % 8 < 4 && x % 8 === 3)) ? 0.32 : 0;
      return seam + tread;
    },
    2.4,
    repeatX,
    repeatY
  );

  return { map, normalMap, roughnessMap };
}

export interface ContainerTextureSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.CanvasTexture;
}

/**
 * Realistic corrugated steel shipping container with riveted frame, hazard chevrons & rust weathering
 */
export function createContainerTextureSet(
  baseHex: string,
  stripeHex: string,
  maxAnisotropy: number,
  unitTag = 'RVL-01'
): ContainerTextureSet {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  rCtx.fillStyle = '#929292';
  rCtx.fillRect(0, 0, size, size);

  // Corrugated steel vertical ribs with depth shading & specular catch
  for (let x = 0; x < size; x += 24) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(x, 0, 7, size);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(x + 7, 0, 4, size);

    rCtx.fillStyle = '#b8b8b8';
    rCtx.fillRect(x, 0, 7, size);
    rCtx.fillStyle = '#707070';
    rCtx.fillRect(x + 7, 0, 5, size);
  }

  // Painted scuff scratches & weathered streaks
  for (let i = 0; i < 900; i++) {
    const sx = Math.floor(hash2d(i, 3.1) * size);
    const sy = Math.floor(hash2d(i, 9.7) * size);
    ctx.fillStyle =
      i % 5 === 0
        ? 'rgba(120, 53, 15, 0.09)'
        : i % 2 === 0
        ? 'rgba(15, 23, 42, 0.08)'
        : 'rgba(255, 255, 255, 0.06)';
    ctx.fillRect(sx, sy, 2, 10);
  }

  // Bottom-edge weathered rust & grime gradient
  const rustGrad = ctx.createLinearGradient(0, size - 64, 0, size);
  rustGrad.addColorStop(0, 'rgba(69, 26, 3, 0)');
  rustGrad.addColorStop(1, 'rgba(28, 25, 23, 0.42)');
  ctx.fillStyle = rustGrad;
  ctx.fillRect(0, size - 64, size, 64);

  // Heavy welded steel perimeter frame + corner casting bolts
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.68)';
  ctx.lineWidth = 22;
  ctx.strokeRect(11, 11, size - 22, size - 22);

  // Twin vertical container door locking rods & cam latches on right edge
  [size - 64, size - 44].forEach((rodX) => {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.62)';
    ctx.fillRect(rodX, 22, 6, size - 44);
    ctx.fillStyle = 'rgba(226, 232, 240, 0.28)';
    ctx.fillRect(rodX + 1, 22, 2, size - 44);
    [82, size / 2, size - 96].forEach((camY) => {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.fillRect(rodX - 4, camY, 14, 10);
    });
  });

  // Rivet dots around frame
  ctx.fillStyle = 'rgba(226, 232, 240, 0.35)';
  for (let r = 24; r < size - 24; r += 28) {
    ctx.fillRect(r, 10, 4, 4);
    ctx.fillRect(r, size - 14, 4, 4);
  }

  // Bold team/tactical stripe + corner hazard chevron band
  ctx.fillStyle = stripeHex;
  ctx.fillRect(24, size - 68, size - 48, 22);

  // Caution diagonal hash on bottom right
  ctx.save();
  ctx.beginPath();
  ctx.rect(size - 130, size - 68, 106, 22);
  ctx.clip();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  for (let hx = size - 150; hx < size; hx += 18) {
    ctx.beginPath();
    ctx.moveTo(hx, size - 46);
    ctx.lineTo(hx + 10, size - 46);
    ctx.lineTo(hx + 22, size - 68);
    ctx.lineTo(hx + 12, size - 68);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Cargo stencil typography + inspection hazard placard
  ctx.fillStyle = 'rgba(248, 250, 252, 0.7)';
  ctx.font = 'bold 26px monospace';
  ctx.fillText(unitTag, 34, 58);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.5)';
  ctx.fillRect(34, 68, 86, 6);
  ctx.fillStyle = 'rgba(250, 204, 21, 0.82)';
  ctx.fillRect(34, 84, 34, 24);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
  ctx.fillRect(38, 88, 26, 6);
  ctx.fillRect(38, 98, 18, 5);

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = maxAnisotropy;

  const normalMap = buildNormalMapFromHeight(
    256,
    (x, y) => {
      const border = x < 10 || x > 246 || y < 10 || y > 246 ? 0.58 : 0;
      const rib = Math.sin((x / 12) * Math.PI * 2) * 0.5;
      const grain = (hash2d(x, y) - 0.5) * 0.06;
      return border + rib + grain;
    },
    3.1
  );

  return { map, normalMap, roughnessMap };
}

export function createContainerTexture(
  baseHex: string,
  stripeHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  return createContainerTextureSet(baseHex, stripeHex, maxAnisotropy).map;
}

/**
 * Procedural panoramic atmospheric sky dome texture (2048x1024) with multi-layered volumetric clouds,
 * Rayleigh horizon scattering, sun corona & distant mountain ridges
 */
export function createSkyDomeTexture(
  zenithHex: string,
  horizonHex: string,
  sunGlowHex: string,
  isNight = false
): THREE.CanvasTexture {
  const w = 2048;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, zenithHex);
  grad.addColorStop(0.32, horizonHex);
  grad.addColorStop(0.5, horizonHex);
  grad.addColorStop(0.62, isNight ? '#0f172a' : '#475569');
  grad.addColorStop(1.0, zenithHex);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle Rayleigh sun / moon horizon scattering glow (never blinding white)
  const sunX = w * 0.68;
  const sunY = h * 0.31;
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 420);
  sunGrad.addColorStop(0, sunGlowHex);
  sunGrad.addColorStop(0.18, isNight ? 'rgba(56, 189, 248, 0.22)' : 'rgba(254, 243, 199, 0.34)');
  sunGrad.addColorStop(0.52, isNight ? 'rgba(14, 165, 233, 0.08)' : 'rgba(253, 224, 71, 0.1)');
  sunGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sunGrad;
  ctx.fillRect(0, 0, w, h);

  if (isNight) {
    const aurora = ctx.createLinearGradient(0, h * 0.14, w, h * 0.34);
    aurora.addColorStop(0, 'rgba(14, 165, 233, 0)');
    aurora.addColorStop(0.35, 'rgba(56, 189, 248, 0.14)');
    aurora.addColorStop(0.7, 'rgba(16, 185, 129, 0.09)');
    aurora.addColorStop(1, 'rgba(14, 165, 233, 0)');
    ctx.fillStyle = aurora;
    ctx.fillRect(0, h * 0.14, w, h * 0.22);

    for (let i = 0; i < 820; i++) {
      const sx = hash2d(i, 5.2) * w;
      const sy = hash2d(i, 12.7) * (h * 0.47);
      const alpha = 0.25 + hash2d(i, 31.4) * 0.75;
      ctx.fillStyle =
        i % 11 === 0
          ? `rgba(125, 211, 252, ${alpha.toFixed(2)})`
          : `rgba(226, 232, 240, ${alpha.toFixed(2)})`;
      const s = i % 12 === 0 ? 2 : 1;
      ctx.fillRect(sx, sy, s, s);
    }
  }

  // High-altitude wispy cirrus streaks
  for (let wIdx = 0; wIdx < 48; wIdx++) {
    const wx = hash2d(wIdx, 14.3) * w;
    const wy = h * (0.08 + hash2d(wIdx, 29.1) * 0.22);
    const len = 140 + hash2d(wIdx, 44.7) * 260;
    const wGrad = ctx.createLinearGradient(wx, wy, wx + len, wy + 16);
    const a = isNight ? 0.07 : 0.18;
    wGrad.addColorStop(0, 'rgba(255,255,255,0)');
    wGrad.addColorStop(0.5, `rgba(241,245,249,${a})`);
    wGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = wGrad;
    ctx.lineWidth = 4 + hash2d(wIdx, 77.2) * 8;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.quadraticCurveTo(wx + len * 0.5, wy - 12, wx + len, wy + 8);
    ctx.stroke();
  }

  // Multi-layered volumetric cumulus banks (shaded slate underside + sunlit warm top)
  for (let c = 0; c < 110; c++) {
    const cx = hash2d(c, 2.7) * w;
    const cy = h * (0.14 + hash2d(c, 8.4) * 0.31);
    const rx = 68 + hash2d(c, 15.9) * 195;
    const ry = 14 + hash2d(c, 22.1) * 42;

    // Cool underside shadow puff
    const shadowGrad = ctx.createRadialGradient(cx, cy + ry * 0.25, 8, cx, cy + ry * 0.15, rx);
    const sAlpha = isNight ? 0.14 : 0.24;
    shadowGrad.addColorStop(0, `rgba(100, 116, 139, ${sAlpha})`);
    shadowGrad.addColorStop(1, 'rgba(100, 116, 139, 0)');
    ctx.save();
    ctx.translate(cx, cy + ry * 0.18);
    ctx.scale(1, ry / rx);
    ctx.translate(-cx, -(cy + ry * 0.18));
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy + ry * 0.18, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Sunlit cloud crown
    const cloudGrad = ctx.createRadialGradient(cx, cy - ry * 0.28, 6, cx, cy, rx * 0.92);
    const alpha = isNight ? 0.12 : 0.36;
    cloudGrad.addColorStop(0, `rgba(255, 252, 245, ${alpha})`);
    cloudGrad.addColorStop(0.55, `rgba(226, 232, 240, ${(alpha * 0.55).toFixed(2)})`);
    cloudGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = cloudGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, rx * 0.92, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Multi-depth distant mountain ridges (far misty layer + closer crisp layer)
  const horizonY = h * 0.505;
  ctx.fillStyle = isNight ? 'rgba(15, 23, 42, 0.56)' : 'rgba(100, 116, 139, 0.22)';
  ctx.beginPath();
  ctx.moveTo(0, horizonY + 45);
  for (let x = 0; x <= w; x += 16) {
    const ridgeFar =
      Math.sin(x * 0.006) * 28 +
      Math.cos(x * 0.017 + 1.2) * 16 +
      hash2d(Math.floor(x / 16), 41.3) * 14;
    ctx.lineTo(x, horizonY - Math.max(4, ridgeFar));
  }
  ctx.lineTo(w, horizonY + 45);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = isNight ? 'rgba(15, 23, 42, 0.78)' : 'rgba(71, 85, 105, 0.32)';
  ctx.beginPath();
  ctx.moveTo(0, horizonY + 45);
  for (let x = 0; x <= w; x += 16) {
    const ridgeNear =
      Math.sin(x * 0.011 + 2.1) * 18 +
      Math.cos(x * 0.029) * 10 +
      hash2d(Math.floor(x / 16), 91.3) * 12;
    ctx.lineTo(x, horizonY - Math.max(2, ridgeNear));
  }
  ctx.lineTo(w, horizonY + 45);
  ctx.closePath();
  ctx.fill();

  // Crisp distant skyline tower silhouettes with subtle warning beacons
  for (let b = 0; b < 56; b++) {
    const bx = (b / 56) * w + hash2d(b, 4.1) * 18;
    const bw = 8 + hash2d(b, 6.2) * 18;
    const bh = 14 + hash2d(b, 9.5) * 44;
    ctx.fillStyle = isNight ? 'rgba(15, 23, 42, 0.88)' : 'rgba(51, 65, 85, 0.34)';
    ctx.fillRect(bx, horizonY - bh, bw, bh + 28);
    if (isNight && b % 2 === 0) {
      ctx.fillStyle = b % 4 === 0 ? 'rgba(56, 189, 248, 0.7)' : 'rgba(244, 63, 94, 0.6)';
      ctx.fillRect(bx + bw * 0.4, horizonY - bh - 3, 2, 2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    4,
    size / 2,
    size / 2,
    size / 2
  );
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.58)');
  grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.24)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Soft circular particle sprite for floating dust motes, muzzle smoke & blast clouds
 */
export function createSoftParticleTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.6)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Brushed CNC-machined gunmetal & tactical armor PBR texture set (albedo + normal + roughness)
 */
export function createGunmetalTextureSet(maxAnisotropy: number): TerrainTextureSet {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  ctx.fillStyle = '#313946';
  ctx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#8c8c8c';
  rCtx.fillRect(0, 0, size, size);

  // Fine directional CNC milling & brushed steel grain
  for (let y = 0; y < size; y++) {
    const shade = Math.floor((hash2d(y, 17.3) - 0.5) * 18);
    ctx.fillStyle = shade > 0 ? `rgba(255,255,255,${(shade / 255).toFixed(3)})` : `rgba(0,0,0,${(-shade / 255).toFixed(3)})`;
    ctx.fillRect(0, y, size, 1);

    const rVal = 128 + shade * 2;
    rCtx.fillStyle = `rgb(${rVal},${rVal},${rVal})`;
    rCtx.fillRect(0, y, size, 1);
  }

  // Subtle edge wear & micro-scuffs
  for (let i = 0; i < 420; i++) {
    const sx = hash2d(i, 4.7) * size;
    const sy = hash2d(i, 9.2) * size;
    const len = 6 + hash2d(i, 12.1) * 18;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(203, 213, 225, 0.08)' : 'rgba(15, 23, 42, 0.12)';
    ctx.fillRect(sx, sy, len, 1);
  }

  // Machined hex screws & panel seam line
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, size - 8, size - 8);

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = maxAnisotropy;

  const normalMap = buildNormalMapFromHeight(
    128,
    (x, y) => {
      const brush = (hash2d(y, 3.1) - 0.5) * 0.25;
      const micro = (hash2d(x, y) - 0.5) * 0.08;
      const seam = x < 2 || y < 2 ? -0.4 : 0;
      return brush + micro + seam;
    },
    1.8
  );

  return { map, normalMap, roughnessMap };
}

/**
 * Tactical Ripstop Cordura fabric weave PBR texture set for first-person sleeves & gloves
 */
export function createFabricTextureSet(maxAnisotropy: number): TerrainTextureSet {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  ctx.fillStyle = '#242b38';
  ctx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#d4d4d4';
  rCtx.fillRect(0, 0, size, size);

  // Ripstop grid weave
  for (let y = 0; y < size; y += 8) {
    for (let x = 0; x < size; x += 8) {
      const warp = ((x + y) / 8) % 2 === 0;
      ctx.fillStyle = warp ? 'rgba(255, 255, 255, 0.055)' : 'rgba(15, 23, 42, 0.14)';
      ctx.fillRect(x, y, 6, 6);
      rCtx.fillStyle = warp ? '#c6c6c6' : '#e0e0e0';
      rCtx.fillRect(x, y, 6, 6);
    }
  }

  // Reinforced ripstop crosshatch threads every 32px
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1.5;
  for (let k = 0; k < size; k += 32) {
    ctx.beginPath();
    ctx.moveTo(k, 0);
    ctx.lineTo(k, size);
    ctx.moveTo(0, k);
    ctx.lineTo(size, k);
    ctx.stroke();
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 3);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(3, 3);
  roughnessMap.anisotropy = maxAnisotropy;

  const normalMap = buildNormalMapFromHeight(
    128,
    (x, y) => {
      const threadX = Math.sin((x / 4) * Math.PI) * 0.25;
      const threadY = Math.cos((y / 4) * Math.PI) * 0.25;
      const rip = x % 16 === 0 || y % 16 === 0 ? 0.35 : 0;
      return threadX + threadY + rip;
    },
    2.1,
    3,
    3
  );

  return { map, normalMap, roughnessMap };
}

/**
 * Weathered poured concrete formwork PBR texture set (albedo + normal + roughness)
 */
export function createConcreteTextureSet(maxAnisotropy: number): TerrainTextureSet {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#d8d8d8';
  rCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 3200; i++) {
    const px = hash2d(i, 2.3) * size;
    const py = hash2d(i, 7.8) * size;
    const dark = i % 2 === 0;
    ctx.fillStyle = dark ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.06)';
    ctx.fillRect(px, py, 2, 2);
  }

  // Formwork tie holes & seam joints
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, size - 4, size - 4);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
  [48, size - 48].forEach((tx) => {
    [48, size - 48].forEach((ty) => {
      ctx.beginPath();
      ctx.arc(tx, ty, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 1);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(3, 1);
  roughnessMap.anisotropy = maxAnisotropy;

  const normalMap = buildNormalMapFromHeight(
    128,
    (x, y) => {
      const seam = x < 2 || y < 2 ? -0.45 : 0;
      const pit = (hash2d(x, y) - 0.5) * 0.28;
      return seam + pit;
    },
    2.2,
    3,
    1
  );

  return { map, normalMap, roughnessMap };
}

/**
 * Stratified weathered canyon rock PBR texture set (albedo + normal + roughness)
 */
export function createRockTextureSet(maxAnisotropy: number): TerrainTextureSet {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  ctx.fillStyle = '#64748b';
  ctx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#dedede';
  rCtx.fillRect(0, 0, size, size);

  // Geological sedimentary strata bands
  for (let y = 0; y < size; y += 6) {
    const tone = hash2d(y, 19.3);
    ctx.fillStyle =
      tone > 0.6
        ? 'rgba(148, 163, 184, 0.28)'
        : tone > 0.28
        ? 'rgba(71, 85, 105, 0.34)'
        : 'rgba(120, 113, 108, 0.3)';
    ctx.fillRect(0, y, size, 4 + Math.floor(tone * 5));
  }

  // Craggy mineral grain & mossy crevices
  for (let i = 0; i < 4200; i++) {
    const rx = hash2d(i, 3.1) * size;
    const ry = hash2d(i, 7.9) * size;
    ctx.fillStyle =
      i % 9 === 0
        ? 'rgba(63, 98, 18, 0.16)'
        : i % 2 === 0
        ? 'rgba(15, 23, 42, 0.16)'
        : 'rgba(226, 232, 240, 0.1)';
    ctx.fillRect(rx, ry, 2, 2);
  }

  // Deep rock fracture veins
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.38)';
  ctx.lineWidth = 2;
  for (let f = 0; f < 10; f++) {
    let fx = hash2d(f, 11.1) * size;
    let fy = hash2d(f, 23.7) * size;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    for (let s = 0; s < 6; s++) {
      fx += (hash2d(f * 8 + s, 4.1) - 0.5) * 42;
      fy += (hash2d(f * 8 + s, 9.5) - 0.5) * 28;
      ctx.lineTo(fx, fy);
    }
    ctx.stroke();
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 3);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(2, 3);
  roughnessMap.anisotropy = maxAnisotropy;

  const normalMap = buildNormalMapFromHeight(
    128,
    (x, y) => {
      const strata = Math.sin(y * 0.24 + Math.sin(x * 0.11) * 1.4) * 0.48;
      const crag = (hash2d(x, y) - 0.5) * 0.42;
      return strata + crag;
    },
    3.6,
    2,
    3
  );

  return { map, normalMap, roughnessMap };
}

/**
 * Furrowed pine tree bark PBR texture set (albedo + normal + roughness)
 */
export function createBarkTextureSet(maxAnisotropy: number): TerrainTextureSet {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  ctx.fillStyle = '#4a3525';
  ctx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#e5e5e5';
  rCtx.fillRect(0, 0, size, size);

  for (let x = 0; x < size; x += 6) {
    const shade = hash2d(x, 6.4);
    ctx.fillStyle = shade > 0.5 ? 'rgba(92, 64, 42, 0.55)' : 'rgba(28, 18, 12, 0.55)';
    ctx.fillRect(x, 0, 3 + Math.floor(shade * 3), size);
  }

  for (let i = 0; i < 2400; i++) {
    const bx = hash2d(i, 2.1) * size;
    const by = hash2d(i, 8.7) * size;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(20, 12, 6, 0.25)' : 'rgba(120, 90, 62, 0.2)';
    ctx.fillRect(bx, by, 2, 7);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 3);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(2, 3);
  roughnessMap.anisotropy = maxAnisotropy;

  const normalMap = buildNormalMapFromHeight(
    128,
    (x, y) => Math.sin(x * 0.42 + Math.sin(y * 0.09)) * 0.55 + (hash2d(x, y) - 0.5) * 0.3,
    3.4,
    2,
    3
  );

  return { map, normalMap, roughnessMap };
}
