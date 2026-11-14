import * as THREE from 'three';
import { ContainerTextureSet, TerrainTextureSet } from './textures';
import {
  ARENA_MAPS,
  LoadoutConfig,
  MapId,
  MELEE_WEAPONS,
  PRIMARY_WEAPONS,
  SECONDARY_WEAPONS,
  TeamSide,
  UTILITY_ITEMS,
} from './types';
import {
  resolveGunSpec,
  resolveMeleeSpec,
  resolveUtilitySpec,
  WeaponBuildsMap,
} from './weaponTemplates';

export interface ArenaBox {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  kind: 'a' | 'b' | 'neutral';
}

const MAP_BOXES: Record<MapId, ArenaBox[]> = {
  arena: [
    { x: -10.5, z: 16.5, w: 6.2, h: 3.1, d: 2.8, kind: 'a' },
    { x: 10.5, z: 16.5, w: 6.2, h: 3.1, d: 2.8, kind: 'a' },
    { x: -10.5, z: -16.5, w: 6.2, h: 3.1, d: 2.8, kind: 'b' },
    { x: 10.5, z: -16.5, w: 6.2, h: 3.1, d: 2.8, kind: 'b' },
    { x: -19.5, z: 0, w: 3.0, h: 3.0, d: 6.5, kind: 'neutral' },
    { x: 19.5, z: 0, w: 3.0, h: 3.0, d: 6.5, kind: 'neutral' },
    { x: 0, z: 22.5, w: 5.4, h: 1.4, d: 1.3, kind: 'neutral' },
    { x: 0, z: -22.5, w: 5.4, h: 1.4, d: 1.3, kind: 'neutral' },
  ],
  construction: [
    { x: -5.5, z: 12.0, w: 3.2, h: 3.0, d: 3.2, kind: 'neutral' },
    { x: 5.5, z: 12.0, w: 3.2, h: 3.0, d: 3.2, kind: 'neutral' },
    { x: -5.5, z: -12.0, w: 3.2, h: 3.0, d: 3.2, kind: 'neutral' },
    { x: 5.5, z: -12.0, w: 3.2, h: 3.0, d: 3.2, kind: 'neutral' },
    { x: 0, z: 21.0, w: 6.8, h: 1.5, d: 1.5, kind: 'a' },
    { x: 0, z: -21.0, w: 6.8, h: 1.5, d: 1.5, kind: 'b' },
    { x: -22.0, z: 0, w: 2.4, h: 2.8, d: 7.0, kind: 'a' },
    { x: 22.0, z: 0, w: 2.4, h: 2.8, d: 7.0, kind: 'b' },
  ],
  splash: [
    { x: -16.5, z: 13.5, w: 4.8, h: 2.8, d: 3.2, kind: 'a' },
    { x: 16.5, z: 13.5, w: 4.8, h: 2.8, d: 3.2, kind: 'a' },
    { x: -16.5, z: -13.5, w: 4.8, h: 2.8, d: 3.2, kind: 'b' },
    { x: 16.5, z: -13.5, w: 4.8, h: 2.8, d: 3.2, kind: 'b' },
    { x: -21.0, z: 0, w: 2.6, h: 2.6, d: 5.5, kind: 'neutral' },
    { x: 21.0, z: 0, w: 2.6, h: 2.6, d: 5.5, kind: 'neutral' },
    { x: 0, z: 21.5, w: 5.6, h: 1.35, d: 1.4, kind: 'a' },
    { x: 0, z: -21.5, w: 5.6, h: 1.35, d: 1.4, kind: 'b' },
  ],
  docks: [
    { x: -7.5, z: 8.5, w: 6.4, h: 3.3, d: 2.9, kind: 'a' },
    { x: 7.5, z: -8.5, w: 6.4, h: 3.3, d: 2.9, kind: 'b' },
    { x: 8.0, z: 16.0, w: 6.4, h: 3.3, d: 2.9, kind: 'a' },
    { x: -8.0, z: -16.0, w: 6.4, h: 3.3, d: 2.9, kind: 'b' },
    { x: 0, z: 0, w: 4.2, h: 3.3, d: 4.2, kind: 'neutral' },
    { x: -6.5, z: 23.0, w: 4.6, h: 1.45, d: 1.4, kind: 'a' },
    { x: 6.5, z: -23.0, w: 4.6, h: 1.45, d: 1.4, kind: 'b' },
  ],
};

export function getMapBoxes(mapId: MapId): ArenaBox[] {
  return MAP_BOXES[mapId];
}

/**
 * Exact floor/ramp/bridge elevation per map
 */
export function getMapFloorHeightAt(mapId: MapId, x: number, z: number): number {
  const spec = ARENA_MAPS[mapId];
  const absX = Math.abs(x);
  const absZ = Math.abs(z);

  if (mapId === 'arena') {
    if (absX <= 5.2 && absZ <= 5.5) return 2.4;
    if (absX > 5.2 && absX <= 13.0 && absZ <= 3.4) {
      return (1 - (absX - 5.2) / (13.0 - 5.2)) * 2.4;
    }
  } else if (mapId === 'construction') {
    if (absX >= 10.5 && absX <= 17.5 && absZ <= 11.0) return 2.6;
    if (absX <= 10.5 && absZ <= 2.6) return 2.6;
    if (absX >= 11.5 && absX <= 16.5 && absZ > 11.0 && absZ <= 19.0) {
      return (1 - (absZ - 11.0) / 8.0) * 2.6;
    }
  } else if (mapId === 'splash') {
    if (absX <= 6.8 && absZ <= 6.8) return 1.6;
    if (absX > 6.8 && absX <= 12.6 && absZ <= 2.8) {
      return (1 - (absX - 6.8) / 5.8) * 1.6;
    }
    if (absZ > 6.8 && absZ <= 12.6 && absX <= 2.8) {
      return (1 - (absZ - 6.8) / 5.8) * 1.6;
    }
    if (absX <= 13.5 && absZ <= 13.5) return -0.35;
  } else if (mapId === 'docks') {
    if (absX >= 16.0 && absX <= 24.0 && absZ <= 8.5) return 2.8;
    if (absX >= 16.0 && absX <= 24.0 && absZ > 8.5 && absZ <= 16.5) {
      return (1 - (absZ - 8.5) / 8.0) * 2.8;
    }
  }

  // Outer rolling terrain beyond arena perimeter
  if (absX > spec.halfX + 4 || absZ > spec.halfZ + 4) {
    const dx = Math.max(0, absX - (spec.halfX + 4));
    const dz = Math.max(0, absZ - (spec.halfZ + 4));
    const dist = Math.hypot(dx, dz);
    const t = Math.min(1, dist / 38);
    return t * t * (6.2 + Math.sin(x * 0.07) * Math.cos(z * 0.07) * 3.5);
  }

  return 0;
}

export interface MaterialPalette {
  armorDark: THREE.MeshStandardMaterial;
  armorSlate: THREE.MeshStandardMaterial;
  matteTrim: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  gunmetal: THREE.MeshStandardMaterial;
  opticGlass: THREE.MeshStandardMaterial;
  sleeveFabric: THREE.MeshStandardMaterial;
  gloveDark: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  blueTeam: THREE.MeshStandardMaterial;
  redTeam: THREE.MeshStandardMaterial;
  visorGlow: THREE.MeshStandardMaterial;
  visorGlowBlue: THREE.MeshStandardMaterial;
  skinTone: THREE.MeshStandardMaterial;
  containerA: THREE.MeshStandardMaterial;
  containerB: THREE.MeshStandardMaterial;
  containerNeutral: THREE.MeshStandardMaterial;
  bridgeDeck: THREE.MeshStandardMaterial;
  rockMat: THREE.MeshStandardMaterial;
  concreteMat: THREE.MeshStandardMaterial;
  hazardOrange: THREE.MeshStandardMaterial;
  robotChassis: THREE.MeshStandardMaterial;
  robotArmor: THREE.MeshStandardMaterial;
  robotJoint: THREE.MeshStandardMaterial;
  robotChrome: THREE.MeshStandardMaterial;
  robotCopper: THREE.MeshStandardMaterial;
  robotTeamBlue: THREE.MeshStandardMaterial;
  robotTeamRed: THREE.MeshStandardMaterial;
  robotEmissiveBlue: THREE.MeshStandardMaterial;
  robotEmissiveRed: THREE.MeshStandardMaterial;
}

export function createMaterialPalette(
  texA: ContainerTextureSet,
  texB: ContainerTextureSet,
  texNeutral: ContainerTextureSet,
  bridgeTex?: TerrainTextureSet,
  gunmetalTex?: TerrainTextureSet,
  fabricTex?: TerrainTextureSet,
  concreteTex?: TerrainTextureSet,
  rockTex?: TerrainTextureSet
): MaterialPalette {
  return {
    armorDark: new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      map: gunmetalTex?.map ?? null,
      normalMap: gunmetalTex?.normalMap ?? null,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughnessMap: gunmetalTex?.roughnessMap ?? null,
      metalness: 0,
      roughness: 0.9,
      envMapIntensity: 0,
    }),
    armorSlate: new THREE.MeshStandardMaterial({
      color: 0x475569,
      map: gunmetalTex?.map ?? null,
      normalMap: gunmetalTex?.normalMap ?? null,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughnessMap: gunmetalTex?.roughnessMap ?? null,
      metalness: 0,
      roughness: 0.9,
      envMapIntensity: 0,
    }),
    matteTrim: new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0,
      roughness: 0.95,
      envMapIntensity: 0,
    }),
    chrome: new THREE.MeshStandardMaterial({
      color: 0x64748b,
      normalMap: gunmetalTex?.normalMap ?? null,
      normalScale: new THREE.Vector2(0.3, 0.3),
      metalness: 0,
      roughness: 0.88,
      envMapIntensity: 0,
    }),
    gunmetal: new THREE.MeshStandardMaterial({
      color: gunmetalTex ? 0x64748b : 0x262d38,
      map: gunmetalTex?.map ?? null,
      normalMap: gunmetalTex?.normalMap ?? null,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap: gunmetalTex?.roughnessMap ?? null,
      metalness: 0,
      roughness: 0.9,
      envMapIntensity: 0,
    }),
    opticGlass: new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      metalness: 0,
      roughness: 0.85,
      transparent: true,
      opacity: 0.1,
      envMapIntensity: 0,
    }),
    sleeveFabric: new THREE.MeshStandardMaterial({
      color: fabricTex ? 0x475569 : 0x1e2430,
      map: fabricTex?.map ?? null,
      normalMap: fabricTex?.normalMap ?? null,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughnessMap: fabricTex?.roughnessMap ?? null,
      roughness: 0.95,
      metalness: 0,
      envMapIntensity: 0,
    }),
    gloveDark: new THREE.MeshStandardMaterial({
      color: fabricTex ? 0x334155 : 0x111827,
      map: fabricTex?.map ?? null,
      normalMap: fabricTex?.normalMap ?? null,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap: fabricTex?.roughnessMap ?? null,
      roughness: 0.94,
      metalness: 0,
      envMapIntensity: 0,
    }),
    brass: new THREE.MeshStandardMaterial({
      color: 0xb45309,
      metalness: 0,
      roughness: 0.88,
      envMapIntensity: 0,
    }),
    blueTeam: new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.9,
      metalness: 0,
      envMapIntensity: 0,
    }),
    redTeam: new THREE.MeshStandardMaterial({
      color: 0xe11d48,
      roughness: 0.9,
      metalness: 0,
      envMapIntensity: 0,
    }),
    visorGlow: new THREE.MeshStandardMaterial({
      color: 0xe11d48,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.88,
      metalness: 0,
      envMapIntensity: 0,
    }),
    visorGlowBlue: new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.88,
      metalness: 0,
      envMapIntensity: 0,
    }),
    skinTone: new THREE.MeshStandardMaterial({
      color: 0xc68b67,
      roughness: 0.86,
      metalness: 0,
      envMapIntensity: 0,
    }),
    containerA: new THREE.MeshStandardMaterial({
      map: texA.map,
      normalMap: texA.normalMap,
      normalScale: new THREE.Vector2(1.0, 1.0),
      roughnessMap: texA.roughnessMap,
      roughness: 0.92,
      metalness: 0,
      envMapIntensity: 0,
    }),
    containerB: new THREE.MeshStandardMaterial({
      map: texB.map,
      normalMap: texB.normalMap,
      normalScale: new THREE.Vector2(1.0, 1.0),
      roughnessMap: texB.roughnessMap,
      roughness: 0.92,
      metalness: 0,
      envMapIntensity: 0,
    }),
    containerNeutral: new THREE.MeshStandardMaterial({
      map: texNeutral.map,
      normalMap: texNeutral.normalMap,
      normalScale: new THREE.Vector2(1.0, 1.0),
      roughnessMap: texNeutral.roughnessMap,
      roughness: 0.94,
      metalness: 0,
      envMapIntensity: 0,
    }),
    bridgeDeck: new THREE.MeshStandardMaterial({
      color: bridgeTex ? 0xdbeafe : 0x64748b,
      map: bridgeTex?.map ?? null,
      normalMap: bridgeTex?.normalMap ?? null,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: bridgeTex?.roughnessMap ?? null,
      roughness: 0.92,
      metalness: 0,
      envMapIntensity: 0,
    }),
    rockMat: new THREE.MeshStandardMaterial({
      color: rockTex ? 0x94a3b8 : 0x64748b,
      map: rockTex?.map ?? concreteTex?.map ?? null,
      normalMap: rockTex?.normalMap ?? concreteTex?.normalMap ?? null,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughnessMap: rockTex?.roughnessMap ?? concreteTex?.roughnessMap ?? null,
      roughness: 0.96,
      metalness: 0,
      envMapIntensity: 0,
    }),
    concreteMat: new THREE.MeshStandardMaterial({
      color: concreteTex ? 0xd1d5db : 0x9ca3af,
      map: concreteTex?.map ?? null,
      normalMap: concreteTex?.normalMap ?? null,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: concreteTex?.roughnessMap ?? null,
      roughness: 0.94,
      metalness: 0,
      envMapIntensity: 0,
    }),
    hazardOrange: new THREE.MeshStandardMaterial({
      color: 0xf97316,
      roughness: 0.88,
      metalness: 0,
      envMapIntensity: 0,
    }),
    robotChassis: new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      map: gunmetalTex?.map ?? null,
      normalMap: gunmetalTex?.normalMap ?? null,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughnessMap: gunmetalTex?.roughnessMap ?? null,
      metalness: 0.78,
      roughness: 0.3,
      envMapIntensity: 0.95,
    }),
    robotArmor: new THREE.MeshStandardMaterial({
      color: 0x64748b,
      map: gunmetalTex?.map ?? null,
      normalMap: gunmetalTex?.normalMap ?? null,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughnessMap: gunmetalTex?.roughnessMap ?? null,
      metalness: 0.7,
      roughness: 0.36,
      envMapIntensity: 0.9,
    }),
    robotJoint: new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.42,
      roughness: 0.64,
      envMapIntensity: 0.65,
    }),
    robotChrome: new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      normalMap: gunmetalTex?.normalMap ?? null,
      normalScale: new THREE.Vector2(0.25, 0.25),
      metalness: 0.94,
      roughness: 0.14,
      envMapIntensity: 1.15,
    }),
    robotCopper: new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.88,
      roughness: 0.22,
      envMapIntensity: 1.0,
    }),
    robotTeamBlue: new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.56,
      roughness: 0.32,
      envMapIntensity: 0.9,
    }),
    robotTeamRed: new THREE.MeshStandardMaterial({
      color: 0xe11d48,
      metalness: 0.56,
      roughness: 0.32,
      envMapIntensity: 0.9,
    }),
    robotEmissiveBlue: new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.6,
      roughness: 0.2,
      metalness: 0.1,
      envMapIntensity: 0.4,
    }),
    robotEmissiveRed: new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xe11d48,
      emissiveIntensity: 1.6,
      roughness: 0.2,
      metalness: 0.1,
      envMapIntensity: 0.4,
    }),
  };
}

/**
 * Builds detailed, grounded architectural 3D map structures per arena
 */
export function buildMapEnvironment(
  mapId: MapId,
  mats: MaterialPalette,
  shadowTex?: THREE.CanvasTexture,
  floorMarkingsTex?: THREE.CanvasTexture
): THREE.Group {
  const group = new THREE.Group();
  const spec = ARENA_MAPS[mapId];
  const bobbers: Array<{ mesh: THREE.Object3D; baseY: number; phase: number }> = [];
  const swayers: Array<{ mesh: THREE.Object3D; phase: number }> = [];

  if (floorMarkingsTex) {
    const markings = new THREE.Mesh(
      new THREE.PlaneGeometry(spec.halfX * 2, spec.halfZ * 2),
      new THREE.MeshBasicMaterial({
        map: floorMarkingsTex,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
    markings.rotation.x = -Math.PI / 2;
    markings.position.set(0, 0.012, 0);
    group.add(markings);
  }

  // 1. Map-Specific Elevated Structures, Steel Trusses, Animated Pool Water, Cranes
  if (mapId === 'arena') {
    const bridgeTop = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.44, 11.2), mats.bridgeDeck);
    bridgeTop.position.set(0, 2.2, 0);
    bridgeTop.castShadow = true;
    bridgeTop.receiveShadow = true;
    group.add(bridgeTop);

    // Bridge concrete under-trim & cable guardrails
    [-5.35, 5.35].forEach((zOff) => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.25, 0.36), mats.concreteMat);
      curb.position.set(0, 2.52, zOff);
      curb.castShadow = true;
      group.add(curb);

      // Steel rail posts + horizontal guardrails
      [-4.6, -2.3, 0, 2.3, 4.6].forEach((px) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.95, 8), mats.armorDark);
        post.position.set(px, 2.95, zOff);
        post.castShadow = true;
        group.add(post);
      });
      [2.88, 3.32].forEach((ry) => {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 9.4, 8), mats.chrome);
        bar.rotation.z = Math.PI / 2;
        bar.position.set(0, ry, zOff);
        group.add(bar);
      });
    });

    // Reinforced support columns + base footings
    [-4.6, 4.6].forEach((cx) => {
      [-4.8, 4.8].forEach((cz) => {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.52, 2.2, 10), mats.armorSlate);
        col.position.set(cx, 1.1, cz);
        col.castShadow = true;
        group.add(col);
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.28, 1.3), mats.armorDark);
        plinth.position.set(cx, 0.14, cz);
        group.add(plinth);
      });
    });

    const rampLen = Math.hypot(7.8, 2.4);
    const rampAngle = Math.atan2(2.4, 7.8);
    [-1, 1].forEach((side) => {
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(rampLen, 0.34, 6.8), mats.bridgeDeck);
      ramp.position.set(side * 9.1, 1.06, 0);
      ramp.rotation.z = side * -rampAngle;
      ramp.castShadow = true;
      ramp.receiveShadow = true;
      group.add(ramp);

      // Side curb ledges on ramps
      [-3.3, 3.3].forEach((rz) => {
        const ledge = new THREE.Mesh(new THREE.BoxGeometry(rampLen, 0.24, 0.24), mats.concreteMat);
        ledge.position.set(side * 9.1, 1.24, rz);
        ledge.rotation.z = side * -rampAngle;
        group.add(ledge);
      });
    });

    // Overhead Steel Gantry Archway framing Central Bridge + Diagonal Trusses
    const archBeaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    [-4.8, 4.8].forEach((az) => {
      const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 4.8, 0.42), mats.armorDark);
      pillarL.position.set(-4.8, 4.6, az);
      pillarL.castShadow = true;
      const pillarR = new THREE.Mesh(new THREE.BoxGeometry(0.42, 4.8, 0.42), mats.armorDark);
      pillarR.position.set(4.8, 4.6, az);
      pillarR.castShadow = true;
      const topBeam = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.46, 0.48), mats.armorDark);
      topBeam.position.set(0, 7.0, az);
      topBeam.castShadow = true;
      const upperBeam = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.24, 0.42), mats.armorSlate);
      upperBeam.position.set(0, 7.75, az);
      const lightStrip = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.14, 0.52), archBeaconMat);
      lightStrip.position.set(0, 6.82, az);
      group.add(pillarL, pillarR, topBeam, upperBeam, lightStrip);

      // Diagonal steel truss struts along top gantry
      for (let tx = -4.2; tx <= 4.2; tx += 1.4) {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.88, 0.16), mats.chrome);
        strut.position.set(tx, 7.38, az);
        strut.rotation.z = tx % 2.8 === 0 ? 0.52 : -0.52;
        group.add(strut);
      }
    });

    // Holographic Tactical Ring & Beveled Orb Emitter Pad on Bridge Center
    const centerPad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.65, 0.12, 24),
      mats.armorDark
    );
    centerPad.position.set(0, 2.46, 0);
    centerPad.receiveShadow = true;
    const centerRing = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 2.75, 48),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
    centerRing.rotation.x = -Math.PI / 2;
    centerRing.position.set(0, 2.44, 0);
    group.add(centerPad, centerRing);

    // Outer Stadium Scoreboard Pylons & Rotating Radar Dish
    const animList: THREE.Object3D[] = [];
    const radarGroup = new THREE.Group();
    radarGroup.position.set(0, 7.9, -4.8);
    const radarMast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.85, 8), mats.chrome);
    radarMast.position.y = 0.42;
    const radarBar = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.22, 0.28), mats.armorSlate);
    radarBar.position.y = 0.88;
    const radarTipL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.3), archBeaconMat);
    radarTipL.position.set(-0.85, 0.88, 0);
    const radarTipR = radarTipL.clone();
    radarTipR.position.x = 0.85;
    radarGroup.add(radarMast, radarBar, radarTipL, radarTipR);
    group.add(radarGroup);
    animList.push(radarGroup);
    group.userData.animatedSpinners = animList;

    // Stadium spectator canopy stands outside east/west curbs
    [-29.5, 29.5].forEach((sx) => {
      const standBase = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.2, 24), mats.armorDark);
      standBase.position.set(sx, 1.6, 0);
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.35, 25), mats.armorSlate);
      canopy.position.set(sx > 0 ? sx - 0.5 : sx + 0.5, 5.2, 0);
      canopy.rotation.z = sx > 0 ? 0.16 : -0.16;
      const trimMat = new THREE.MeshBasicMaterial({ color: sx > 0 ? 0xf43f5e : 0x0ea5e9 });
      const banner = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 22), trimMat);
      banner.position.set(sx > 0 ? sx - 1.45 : sx + 1.45, 2.7, 0);
      group.add(standBase, canopy, banner);
    });

    // Stadium floodlight pylons + overhead catenary steel suspension cables
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    [-31, 31].forEach((lx) => {
      [-37, 37].forEach((lz) => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 16, 10), mats.armorDark);
        pole.position.set(lx, 8, lz);
        group.add(pole);
        const head = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 0.9), mats.armorSlate);
        head.position.set(lx, 16.1, lz);
        head.lookAt(0, 2, 0);
        group.add(head);
        const face = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.65, 0.12), bulbMat);
        face.position.set(lx * 0.98, 16.05, lz * 0.98);
        face.lookAt(0, 2, 0);
        group.add(face);

        const cableCurve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(lx, 15.2, lz),
          new THREE.Vector3(lx * 0.55, 10.2, lz * 0.45),
          new THREE.Vector3(lx > 0 ? 4.8 : -4.8, 7.6, lz > 0 ? 4.8 : -4.8)
        );
        const cableMesh = new THREE.Mesh(
          new THREE.TubeGeometry(cableCurve, 14, 0.045, 5, false),
          mats.matteTrim
        );
        group.add(cableMesh);
      });
    });

    // Tactical approach chevron lights leading onto central ramps
    const chevMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.52,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    [-1, 1].forEach((side) => {
      for (let c = 0; c < 3; c++) {
        const chev = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.32), chevMat);
        chev.rotation.x = -Math.PI / 2;
        chev.rotation.z = Math.PI / 2;
        chev.position.set(side * (14.4 + c * 1.4), 0.025, 0);
        group.add(chev);
      }
    });
  } else if (mapId === 'construction') {
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.9,
      metalness: 0,
      envMapIntensity: 0,
    });

    [-14.0, 14.0].forEach((dx) => {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.36, 22.0), mats.bridgeDeck);
      deck.position.set(dx, 2.42, 0);
      deck.castShadow = true;
      deck.receiveShadow = true;
      group.add(deck);

      // Tubular scaffolding frames & diagonal X-bracing
      const zCols = [-9.5, -3.2, 3.2, 9.5];
      zCols.forEach((cz, idx) => {
        [-3.2, 3.2].forEach((ox) => {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.3, 8), steelMat);
          post.position.set(dx + ox, 1.65, cz);
          post.castShadow = true;
          group.add(post);

          if (idx < zCols.length - 1) {
            const nextCz = zCols[idx + 1];
            const midZ = (cz + nextCz) / 2;
            const span = nextCz - cz;
            const braceLen = Math.hypot(span, 2.1);
            const braceAng = Math.atan2(2.1, span);
            const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, braceLen, 6), steelMat);
            b1.position.set(dx + ox, 1.2, midZ);
            b1.rotation.x = Math.PI / 2 - braceAng;
            const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, braceLen, 6), steelMat);
            b2.position.set(dx + ox, 1.2, midZ);
            b2.rotation.x = Math.PI / 2 + braceAng;
            group.add(b1, b2);
          }
        });
      });

      const rampLen = Math.hypot(8.0, 2.6);
      const rampAng = Math.atan2(2.6, 8.0);
      [-1, 1].forEach((zSide) => {
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.28, rampLen), mats.bridgeDeck);
        ramp.position.set(dx, 1.18, zSide * 15.0);
        ramp.rotation.x = zSide * rampAng;
        ramp.castShadow = true;
        ramp.receiveShadow = true;
        group.add(ramp);
      });
    });

    // High Central Sky Catwalk with side safety railings
    const catwalk = new THREE.Mesh(new THREE.BoxGeometry(21.0, 0.34, 5.2), steelMat);
    catwalk.position.set(0, 2.44, 0);
    catwalk.castShadow = true;
    catwalk.receiveShadow = true;
    group.add(catwalk);

    [-2.5, 2.5].forEach((rz) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(20.6, 0.1, 0.1), mats.hazardOrange);
      rail.position.set(0, 3.25, rz);
      group.add(rail);
    });

    // Worksite floodlight tripods + cones
    const workLampMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    [
      [-19, 19],
      [19, 19],
      [-19, -19],
      [19, -19],
    ].forEach(([cx, cz]) => {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 0.65), mats.matteTrim);
      base.position.set(cx, 0.04, cz);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.72, 10), mats.hazardOrange);
      cone.position.set(cx, 0.4, cz);
      cone.castShadow = true;
      group.add(base, cone);

      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.8, 6), mats.armorDark);
      stand.position.set(cx * 1.12, 1.4, cz * 1.12);
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.2), workLampMat);
      bulb.position.set(cx * 1.12, 2.85, cz * 1.12);
      bulb.lookAt(0, 1, 0);
      group.add(stand, bulb);
    });

    // Realistic lattice tower crane silhouette + suspended steel load outside perimeter
    const mast = new THREE.Mesh(new THREE.BoxGeometry(1.8, 30, 1.8), steelMat);
    mast.position.set(-28, 15, -36);
    group.add(mast);
    const boom = new THREE.Mesh(new THREE.BoxGeometry(38, 1.4, 1.4), steelMat);
    boom.position.set(-11, 29, -36);
    group.add(boom);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), mats.hazardOrange);
    cab.position.set(-26, 28, -34.2);
    group.add(cab);
    const craneHookPivot = new THREE.Group();
    craneHookPivot.position.set(-4, 29, -36);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 13, 6), mats.chrome);
    cable.position.set(0, -6.5, 0);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 0.9), mats.armorDark);
    hook.position.set(0, -13.0, 0);
    const girderLoad = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.55, 0.55), steelMat);
    girderLoad.position.set(0, -13.8, 0);
    craneHookPivot.add(cable, hook, girderLoad);
    group.add(craneHookPivot);
    swayers.push({ mesh: craneHookPivot, phase: 0.4 });

    // Wooden supply pallets & stacked steel I-beams near worksite corners
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.9 });
    [
      [-17.5, 22],
      [17.5, -22],
    ].forEach(([px, pz]) => {
      const pallet = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, 1.8), woodMat);
      pallet.position.set(px, 0.11, pz);
      pallet.castShadow = true;
      for (let b = -1; b <= 1; b += 2) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.32, 0.34), steelMat);
        beam.position.set(px, 0.38, pz + b * 0.42);
        beam.castShadow = true;
        group.add(beam);
      }
      group.add(pallet);
    });

    // Stacked I-Beam & Rebar Pallets + Hazard Barrels near construction flanks
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.9, metalness: 0, envMapIntensity: 0 });
    [
      [-23, 18],
      [23, -18],
      [-23, -18],
      [23, 18],
    ].forEach(([bx, bz]) => {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.12, 14), barrelMat);
      drum.position.set(bx, 0.56, bz);
      drum.castShadow = true;
      const band1 = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.1, 14), mats.armorDark);
      band1.position.set(bx, 0.32, bz);
      const band2 = band1.clone();
      band2.position.y = 0.82;
      group.add(drum, band1, band2);
    });

    // Steel truss safety railings along elevated side decks
    [-14.0, 14.0].forEach((dx) => {
      [-3.35, 3.35].forEach((ox) => {
        const railBar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 21.6), mats.hazardOrange);
        railBar.position.set(dx + ox, 3.35, 0);
        group.add(railBar);
      });
    });

    // Distant city skyline crane #2 on opposite horizon
    const crane2Mast = new THREE.Mesh(new THREE.BoxGeometry(1.6, 26, 1.6), steelMat);
    crane2Mast.position.set(34, 13, 38);
    const crane2Boom = new THREE.Mesh(new THREE.BoxGeometry(32, 1.2, 1.2), steelMat);
    crane2Boom.position.set(20, 25.5, 38);
    group.add(crane2Mast, crane2Boom);

    // Stacked hollow concrete drainage pipes & timber pallets at perimeter corners
    [
      [-23, -24],
      [23, 24],
    ].forEach(([px, pz]) => {
      const pipeGeo = new THREE.CylinderGeometry(0.46, 0.46, 2.8, 14, 1, true);
      pipeGeo.rotateZ(Math.PI / 2);
      const p1 = new THREE.Mesh(pipeGeo, mats.concreteMat);
      p1.position.set(px, 0.46, pz);
      p1.castShadow = true;
      const p2 = new THREE.Mesh(pipeGeo, mats.concreteMat);
      p2.position.set(px, 0.46, pz + 0.96);
      p2.castShadow = true;
      const p3 = new THREE.Mesh(pipeGeo, mats.concreteMat);
      p3.position.set(px, 1.26, pz + 0.48);
      p3.castShadow = true;
      group.add(p1, p2, p3);
    });
  } else if (mapId === 'splash') {
    // Animated rippling water surface (matte non-shiny water finish)
    const waterTime = { value: 0 };
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.82,
      roughness: 0.92,
      metalness: 0,
      envMapIntensity: 0,
    });
    waterMat.onBeforeCompile = (shader) => {
      shader.uniforms.uWaterTime = waterTime;
      shader.vertexShader =
        `uniform float uWaterTime;\n` +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          float w1 = sin(position.x * 0.85 + uWaterTime * 2.4) * 0.04;
          float w2 = cos(position.y * 0.95 - uWaterTime * 1.9) * 0.04;
          transformed.z += w1 + w2;
          `
        );
    };
    group.userData.waterTimeUniform = waterTime;

    const water = new THREE.Mesh(new THREE.PlaneGeometry(27.0, 27.0, 40, 40), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.14;
    water.receiveShadow = true;
    group.add(water);

    const poolFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(27.4, 27.4),
      new THREE.MeshStandardMaterial({ color: 0x0e7490, roughness: 0.92, metalness: 0, envMapIntensity: 0 })
    );
    poolFloor.rotation.x = -Math.PI / 2;
    poolFloor.position.y = -0.37;
    poolFloor.receiveShadow = true;
    group.add(poolFloor);

    // Underwater glowing pool strip lights
    const poolGlowMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
    [-13.4, 13.4].forEach((e) => {
      const stripNS = new THREE.Mesh(new THREE.BoxGeometry(20, 0.12, 0.12), poolGlowMat);
      stripNS.position.set(0, -0.22, e);
      const stripEW = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 20), poolGlowMat);
      stripEW.position.set(e, -0.22, 0);
      group.add(stripNS, stripEW);
    });

    // Pool perimeter coping tiles
    [-13.7, 13.7].forEach((edge) => {
      const copingNS = new THREE.Mesh(new THREE.BoxGeometry(28.0, 0.14, 0.7), mats.concreteMat);
      copingNS.position.set(0, 0.04, edge);
      copingNS.receiveShadow = true;
      const copingEW = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 28.0), mats.concreteMat);
      copingEW.position.set(edge, 0.04, 0);
      copingEW.receiveShadow = true;
      group.add(copingNS, copingEW);
    });

    // 4 Tropical Palm Trees framing pool corners
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.95, metalness: 0, envMapIntensity: 0 });
    const frondMat = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      roughness: 0.92,
      metalness: 0,
      envMapIntensity: 0,
      side: THREE.DoubleSide,
    });
    [
      [-23, -24],
      [23, -24],
      [-23, 24],
      [23, 24],
    ].forEach(([px, pz], idx) => {
      const palm = new THREE.Group();
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(idx % 2 === 0 ? 0.5 : -0.5, 2.8, 0.3),
        new THREE.Vector3(idx % 2 === 0 ? 1.1 : -1.1, 6.2, -0.2),
      ]);
      const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.24, 8, false), trunkMat);
      trunk.castShadow = true;
      palm.add(trunk);

      const topPos = curve.getPoint(1);
      // Coconut cluster under palm crown
      for (let c = 0; c < 3; c++) {
        const cAng = (c / 3) * Math.PI * 2;
        const coco = new THREE.Mesh(new THREE.SphereGeometry(0.18, 7, 7), trunkMat);
        coco.position.set(
          topPos.x + Math.cos(cAng) * 0.22,
          topPos.y - 0.24,
          topPos.z + Math.sin(cAng) * 0.22
        );
        palm.add(coco);
      }
      for (let f = 0; f < 9; f++) {
        const ang = (f / 9) * Math.PI * 2 + idx;
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.68, 3.3, 4), frondMat);
        frond.scale.set(0.7, 1, 0.18);
        frond.position.set(
          topPos.x + Math.cos(ang) * 1.45,
          topPos.y - 0.12 + (f % 2 === 0 ? 0.12 : -0.1),
          topPos.z + Math.sin(ang) * 1.45
        );
        frond.rotation.y = -ang + Math.PI / 2;
        frond.rotation.x = Math.PI * (f % 2 === 0 ? 0.6 : 0.72);
        frond.castShadow = true;
        palm.add(frond);
      }
      palm.position.set(px, 0, pz);
      group.add(palm);
    });

    // Central Island Pavilion
    const islandMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.92, metalness: 0, envMapIntensity: 0 });
    const island = new THREE.Mesh(new THREE.BoxGeometry(13.6, 1.6, 13.6), islandMat);
    island.position.set(0, 0.8, 0);
    island.castShadow = true;
    island.receiveShadow = true;
    group.add(island);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 4.2, 12), mats.chrome);
    pole.position.set(0, 3.7, 0);
    pole.castShadow = true;
    group.add(pole);
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(3.6, 1.15, 8),
      new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.92, metalness: 0, envMapIntensity: 0 })
    );
    canopy.position.set(0, 5.75, 0);
    canopy.castShadow = true;
    group.add(canopy);

    const rLen = Math.hypot(5.8, 1.6);
    const rAng = Math.atan2(1.6, 5.8);
    [-1, 1].forEach((side) => {
      const rx = new THREE.Mesh(new THREE.BoxGeometry(rLen, 0.28, 5.6), mats.bridgeDeck);
      rx.position.set(side * 9.7, 0.7, 0);
      rx.rotation.z = side * -rAng;
      rx.castShadow = true;
      rx.receiveShadow = true;
      group.add(rx);

      const rz = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.28, rLen), mats.bridgeDeck);
      rz.position.set(0, 0.7, side * 9.7);
      rz.rotation.x = side * rAng;
      rz.castShadow = true;
      rz.receiveShadow = true;
      group.add(rz);
    });

    // Curved stainless steel poolside entry ladders
    [
      [-13.2, -7.2],
      [13.2, 7.2],
    ].forEach(([lx, lz]) => {
      const sideDir = lx < 0 ? 1 : -1;
      [-0.3, 0.3].forEach((offZ) => {
        const railCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(lx - sideDir * 0.45, 0.08, lz + offZ),
          new THREE.Vector3(lx - sideDir * 0.2, 0.72, lz + offZ),
          new THREE.Vector3(lx + sideDir * 0.15, 0.62, lz + offZ),
          new THREE.Vector3(lx + sideDir * 0.18, -0.32, lz + offZ),
        ]);
        const rail = new THREE.Mesh(
          new THREE.TubeGeometry(railCurve, 12, 0.035, 8, false),
          mats.chrome
        );
        group.add(rail);
      });
    });

    // Floating colorful pool lane buoys (animated bobbing on waves)
    const buoyMatA = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.9, metalness: 0, envMapIntensity: 0 });
    const buoyMatB = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.9, metalness: 0, envMapIntensity: 0 });
    [
      [-10.5, -10.5],
      [10.5, -10.5],
      [-10.5, 10.5],
      [10.5, 10.5],
    ].forEach(([bx, bz], i) => {
      const buoy = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.15, 10, 18), i % 2 === 0 ? buoyMatA : buoyMatB);
      buoy.rotation.x = Math.PI / 2;
      buoy.position.set(bx, -0.06, bz);
      group.add(buoy);
      bobbers.push({ mesh: buoy, baseY: -0.06, phase: i * 1.6 });
    });

    // Poolside beach cabanas, umbrellas & wooden lounge chairs
    const loungerWood = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.92, metalness: 0, envMapIntensity: 0 });
    const cushionMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.94, metalness: 0, envMapIntensity: 0 });
    [
      [-21, -18, 0x0ea5e9],
      [21, -18, 0xf43f5e],
      [-21, 18, 0xf59e0b],
      [21, 18, 0x10b981],
    ].forEach(([ux, uz, uColor]) => {
      const uPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.2, 8), mats.chrome);
      uPole.position.set(ux, 1.6, uz);
      uPole.castShadow = true;
      const uTop = new THREE.Mesh(
        new THREE.ConeGeometry(2.1, 0.85, 8),
        new THREE.MeshStandardMaterial({ color: uColor, roughness: 0.92, metalness: 0, envMapIntensity: 0 })
      );
      uTop.position.set(ux, 3.2, uz);
      uTop.castShadow = true;
      const chair = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.24, 2.0), loungerWood);
      chair.position.set(ux + (ux > 0 ? -1.1 : 1.1), 0.22, uz);
      chair.castShadow = true;
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.1, 1.85), cushionMat);
      cushion.position.set(ux + (ux > 0 ? -1.1 : 1.1), 0.38, uz);
      group.add(uPole, uTop, chair, cushion);
    });
  } else if (mapId === 'docks') {
    [-20.0, 20.0].forEach((gx) => {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(8.0, 0.36, 17.0), mats.bridgeDeck);
      deck.position.set(gx, 2.62, 0);
      deck.castShadow = true;
      deck.receiveShadow = true;
      group.add(deck);

      [-7.5, 0, 7.5].forEach((cz) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.68, 2.6, 0.68), mats.armorDark);
        leg.position.set(gx, 1.3, cz);
        leg.castShadow = true;
        group.add(leg);
      });

      const rampLen = Math.hypot(8.0, 2.8);
      const rampAng = Math.atan2(2.8, 8.0);
      [-1, 1].forEach((zSide) => {
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.28, rampLen), mats.bridgeDeck);
        ramp.position.set(gx, 1.28, zSide * 12.5);
        ramp.rotation.x = zSide * rampAng;
        ramp.castShadow = true;
        ramp.receiveShadow = true;
        group.add(ramp);
      });
    });

    // Towering Red Harbor Gantry Cranes framing the dockyard
    const craneMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.9,
      metalness: 0,
      envMapIntensity: 0,
    });
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    [-35, 35].forEach((cx) => {
      [-14, 14].forEach((cz) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(1.3, 24, 1.3), craneMat);
        leg.position.set(cx, 12, cz);
        group.add(leg);
      });
      const beam = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 36), craneMat);
      beam.position.set(cx, 24, 0);
      const trolley = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.4, 3.2), mats.hazardOrange);
      trolley.position.set(cx, 22.8, cx < 0 ? -4 : 4);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), beaconMat);
      beacon.position.set(cx, 25.2, 0);
      group.add(beam, trolley, beacon);
    });

    // Mooring bollards along harbor apron
    [-27, 27].forEach((bx) => {
      [-24, -12, 12, 24].forEach((bz) => {
        const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.72, 10), mats.armorDark);
        bollard.position.set(bx, 0.36, bz);
        bollard.castShadow = true;
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.14, 10), mats.hazardOrange);
        cap.position.set(bx, 0.74, bz);
        group.add(bollard, cap);
      });
    });

    // Harbor floodlight towers
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xbae6fd });
    [-26, 26].forEach((px) => {
      [-34, 34].forEach((pz) => {
        const pole = new THREE.Mesh(new THREE.BoxGeometry(0.7, 15, 0.7), mats.armorDark);
        pole.position.set(px, 7.5, pz);
        group.add(pole);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 0.9), lightMat);
        lamp.position.set(px, 15, pz);
        lamp.lookAt(0, 1, 0);
        group.add(lamp);
      });
    });

    // Animated surrounding ocean harbor water outside the concrete dock pier (matte finish)
    const harborWaterTime = { value: 0 };
    const harborMat = new THREE.MeshStandardMaterial({
      color: 0x0c4a6e,
      roughness: 0.94,
      metalness: 0,
      envMapIntensity: 0,
    });
    harborMat.onBeforeCompile = (shader) => {
      shader.uniforms.uWaterTime = harborWaterTime;
      shader.vertexShader =
        `uniform float uWaterTime;\n` +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          transformed.z += sin(position.x * 0.28 + uWaterTime * 1.7) * 0.12
                         + cos(position.y * 0.31 - uWaterTime * 1.4) * 0.12;
          `
        );
    };
    group.userData.waterTimeUniform = harborWaterTime;

    const harborShape = new THREE.Shape();
    harborShape.moveTo(-110, -110);
    harborShape.lineTo(110, -110);
    harborShape.lineTo(110, 110);
    harborShape.lineTo(-110, 110);
    harborShape.closePath();
    const dockCutout = new THREE.Path();
    dockCutout.moveTo(-31, -39);
    dockCutout.lineTo(31, -39);
    dockCutout.lineTo(31, 39);
    dockCutout.lineTo(-31, 39);
    dockCutout.closePath();
    harborShape.holes.push(dockCutout);

    const harborGeo = new THREE.ShapeGeometry(harborShape, 18);
    const harborSea = new THREE.Mesh(harborGeo, harborMat);
    harborSea.rotation.x = -Math.PI / 2;
    harborSea.position.y = -0.32;
    group.add(harborSea);

    // Moored Freighter Ship Silhouette in outer harbor + rotating radar scanner
    const shipGroup = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(12, 4.5, 48), mats.armorDark);
    hull.position.set(-48, 1.8, 0);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(9, 7, 9), mats.armorSlate);
    bridge.position.set(-48, 7.2, -16);
    const cargo1 = new THREE.Mesh(new THREE.BoxGeometry(8, 3.6, 12), mats.containerB);
    cargo1.position.set(-48, 5.5, 2);
    const cargo2 = new THREE.Mesh(new THREE.BoxGeometry(8, 3.6, 10), mats.containerA);
    cargo2.position.set(-48, 5.5, 15);
    shipGroup.add(hull, bridge, cargo1, cargo2);
    group.add(shipGroup);

    const harborRadar = new THREE.Group();
    harborRadar.position.set(35, 25.4, 0);
    const dish = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.4, 0.5), mats.chrome);
    harborRadar.add(dish);
    group.add(harborRadar);
    group.userData.animatedSpinners = [harborRadar];

    // Catenary mooring hawser ropes connecting dock bollards to moored freighter + wooden harbor pilings
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.92 });
    [-12, 12].forEach((bz) => {
      const hawser = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-27, 0.62, bz),
        new THREE.Vector3(-34.5, -0.15, bz * 0.9),
        new THREE.Vector3(-42.0, 2.2, bz * 0.85)
      );
      const ropeMesh = new THREE.Mesh(
        new THREE.TubeGeometry(hawser, 12, 0.06, 6, false),
        ropeMat
      );
      group.add(ropeMesh);
    });

    [-32.5, 32.5].forEach((px) => {
      for (let pz = -32; pz <= 32; pz += 16) {
        const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 2.2, 8), ropeMat);
        piling.position.set(px, 0.5, pz);
        group.add(piling);
      }
    });

    // Floating Harbor Channel Navigation Buoys
    [
      [-39, -28, 0xef4444],
      [39, 28, 0x10b981],
      [42, -22, 0xf59e0b],
    ].forEach(([nbx, nbz, nbCol], idx) => {
      const hBuoy = new THREE.Group();
      const bBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 0.85, 1.2, 10),
        new THREE.MeshStandardMaterial({ color: nbCol, roughness: 0.45 })
      );
      const bBeacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 8, 8),
        new THREE.MeshBasicMaterial({ color: nbCol })
      );
      bBeacon.position.y = 0.85;
      hBuoy.add(bBody, bBeacon);
      hBuoy.position.set(nbx, 0.1, nbz);
      group.add(hBuoy);
      bobbers.push({ mesh: hBuoy, baseY: 0.1, phase: idx * 2.1 });
    });

    // Distant Harbor Lighthouse Tower on outer headland
    const lhTower = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.4, 22, 12), mats.concreteMat);
    lhTower.position.set(52, 11, -54);
    const lhBand = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.95, 5, 12), mats.redTeam);
    lhBand.position.set(52, 14, -54);
    const lhLamp = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 2.2, 12),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    lhLamp.position.set(52, 23, -54);
    const lhRoof = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.6, 12), mats.armorDark);
    lhRoof.position.set(52, 24.8, -54);
    group.add(lhTower, lhBand, lhLamp, lhRoof);
  }

  // 2. Corrugated Shipping Containers with Corner Castings, Forklift Pockets & Grounded AO Shadows
  for (const box of MAP_BOXES[mapId]) {
    if (shadowTex) {
      const aoPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(box.w + 1.35, box.d + 1.35),
        new THREE.MeshBasicMaterial({
          map: shadowTex,
          transparent: true,
          opacity: 0.48,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
        })
      );
      aoPlane.rotation.x = -Math.PI / 2;
      aoPlane.position.set(box.x, 0.015, box.z);
      group.add(aoPlane);
    }
    const mat =
      box.kind === 'a'
        ? mats.containerA
        : box.kind === 'b'
        ? mats.containerB
        : mats.containerNeutral;

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(box.w, box.h, box.d), mat);
    mesh.position.set(box.x, box.h / 2, box.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(box.w + 0.16, 0.16, box.d + 0.16),
      mats.armorDark
    );
    cap.position.set(box.x, box.h + 0.06, box.z);
    cap.castShadow = true;
    cap.receiveShadow = true;
    group.add(cap);

    // Base plinth rail & forklift pocket detail
    const baseSkirt = new THREE.Mesh(
      new THREE.BoxGeometry(box.w + 0.1, 0.18, box.d + 0.1),
      mats.matteTrim
    );
    baseSkirt.position.set(box.x, 0.09, box.z);
    group.add(baseSkirt);

    // Steel corner pillar reinforcements for realistic container silhouette
    if (box.h >= 2.4) {
      [-1, 1].forEach((sx) => {
        [-1, 1].forEach((sz) => {
          const corner = new THREE.Mesh(
            new THREE.BoxGeometry(0.24, box.h + 0.1, 0.24),
            mats.matteTrim
          );
          corner.position.set(
            box.x + sx * (box.w / 2 - 0.04),
            box.h / 2 + 0.05,
            box.z + sz * (box.d / 2 - 0.04)
          );
          group.add(corner);
        });
      });
    }
  }

  // 3. Team Spawn Lane Floor Strips
  const spawnLineZ = spec.spawnZ - 3.5;
  const blueStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 0.55),
    new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  blueStrip.rotation.x = -Math.PI / 2;
  blueStrip.position.set(0, 0.02, spawnLineZ);
  group.add(blueStrip);

  const redStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 0.55),
    new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  redStrip.rotation.x = -Math.PI / 2;
  redStrip.position.set(0, 0.02, -spawnLineZ);
  group.add(redStrip);

  // 4. Low Perimeter Concrete Jersey Barriers, Hazard Corner Bollards & Tactical Crates
  const curbMat = mats.armorDark;
  const nsGeo = new THREE.BoxGeometry(spec.halfX * 2 + 2, 1.45, 1.25);
  [-spec.halfZ - 0.62, spec.halfZ + 0.62].forEach((zPos) => {
    const curb = new THREE.Mesh(nsGeo, curbMat);
    curb.position.set(0, 0.72, zPos);
    curb.castShadow = true;
    curb.receiveShadow = true;
    group.add(curb);
  });
  const ewGeo = new THREE.BoxGeometry(1.25, 1.45, spec.halfZ * 2 + 2);
  [-spec.halfX - 0.62, spec.halfX + 0.62].forEach((xPos) => {
    const curb = new THREE.Mesh(ewGeo, curbMat);
    curb.position.set(xPos, 0.72, 0);
    curb.castShadow = true;
    curb.receiveShadow = true;
    group.add(curb);
  });

  // Glowing perimeter corner beacons (Blue side vs Red side navigation markers)
  const blueBeaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const redBeaconMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
  [-spec.halfX - 0.62, spec.halfX + 0.62].forEach((bx) => {
    [-spec.halfZ - 0.62, spec.halfZ + 0.62].forEach((bz) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.2, 1.5), mats.armorSlate);
      post.position.set(bx, 1.1, bz);
      post.castShadow = true;
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.25, 1.1),
        bz > 0 ? blueBeaconMat : redBeaconMat
      );
      cap.position.set(bx, 2.32, bz);
      group.add(post, cap);
    });
  });

  // 5. Physical 3D Ground Hardware (Flush Steel Drainage Channels, Utility Manholes, Cable Ramps & Curb Aprons)
  if (mapId !== 'splash') {
    // Steel recessed floor drainage channels along flanks
    [-15.2, 15.2].forEach((tx) => {
      const trench = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.024, 18.0),
        mats.gunmetal
      );
      trench.position.set(tx, 0.012, 0);
      trench.receiveShadow = true;
      group.add(trench);
      for (let gz = -8.4; gz <= 8.4; gz += 0.7) {
        const slat = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.032, 0.16),
          mats.matteTrim
        );
        slat.position.set(tx, 0.016, gz);
        group.add(slat);
      }
    });
  }

  // Bolted steel floor utility access plates on arena quadrants
  [
    [-18.5, 20.5],
    [18.5, 20.5],
    [-18.5, -20.5],
    [18.5, -20.5],
  ].forEach(([mx, mz]) => {
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.82, 0.9, 0.036, 16),
      mats.armorSlate
    );
    plate.position.set(mx, 0.018, mz);
    plate.receiveShadow = true;
    const innerRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 0.042, 14),
      mats.matteTrim
    );
    innerRing.position.set(mx, 0.021, mz);
    group.add(plate, innerRing);
  });

  // Low-profile armored floor cable ramps crossing outer lanes
  if (mapId === 'arena' || mapId === 'construction') {
    [-25.5, 25.5].forEach((cz) => {
      const conduit = new THREE.Mesh(
        new THREE.BoxGeometry(11.0, 0.038, 0.42),
        mats.matteTrim
      );
      conduit.position.set(0, 0.019, cz);
      conduit.receiveShadow = true;
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(10.8, 0.042, 0.12),
        mats.hazardOrange
      );
      stripe.position.set(0, 0.021, cz);
      group.add(conduit, stripe);
    });
  }

  // Concrete perimeter floor apron sills anchoring walls to ground
  [-spec.halfZ - 0.05, spec.halfZ + 0.05].forEach((az) => {
    const sill = new THREE.Mesh(
      new THREE.BoxGeometry(spec.halfX * 2 + 1.2, 0.08, 0.85),
      mats.concreteMat
    );
    sill.position.set(0, 0.04, az);
    sill.receiveShadow = true;
    group.add(sill);
  });
  [-spec.halfX - 0.05, spec.halfX + 0.05].forEach((ax) => {
    const sill = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.08, spec.halfZ * 2 + 1.2),
      mats.concreteMat
    );
    sill.position.set(ax, 0.04, 0);
    sill.receiveShadow = true;
    group.add(sill);
  });

  if (bobbers.length > 0) group.userData.animatedBobbers = bobbers;
  if (swayers.length > 0) group.userData.animatedSwayers = swayers;

  return group;
}

/**
 * Detailed Articulated Combat Robot Rig (Multi-joint Legs/Knees/Ankles, Waist Gimbal,
 * Hydraulic Pistons, Reactor Core, Jetpack Turbine/Thrusters, Optic Head & Pulse Rifle)
 */
export interface RivalCharacterRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  pelvisGroup: THREE.Group;
  torsoGroup: THREE.Group;
  leftLeg: THREE.Group;
  leftKnee: THREE.Group;
  leftAnkle: THREE.Group;
  rightLeg: THREE.Group;
  rightKnee: THREE.Group;
  rightAnkle: THREE.Group;
  leftArm: THREE.Group;
  leftElbow: THREE.Group;
  rightArm: THREE.Group;
  rightElbow: THREE.Group;
  headGroup: THREE.Group;
  torso: THREE.Mesh;
  backRotor: THREE.Group;
  leftThrusterFlame: THREE.Mesh;
  rightThrusterFlame: THREE.Mesh;
  muzzlePoint: THREE.Object3D;
  muzzleFlash: THREE.Mesh;
}

export function buildRivalCharacter(
  mats: MaterialPalette,
  shadowTex: THREE.CanvasTexture,
  team: TeamSide = 'enemy',
  botId = 'enemy-0'
): RivalCharacterRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const teamMat = team === 'ally' ? mats.robotTeamBlue : mats.robotTeamRed;
  const glowMat = team === 'ally' ? mats.robotEmissiveBlue : mats.robotEmissiveRed;

  const tagBody = <T extends THREE.Object3D>(obj: T, isCritZone = false, castShadow = true): T => {
    obj.userData = { isRival: team === 'enemy', team, botId, isCritZone };
    if (obj instanceof THREE.Mesh) obj.castShadow = castShadow;
    return obj;
  };

  // ---------------- PELVIS & HIP GIMBAL ----------------
  const pelvisGroup = new THREE.Group();
  pelvisGroup.position.set(0, 1.06, 0);
  bodyGroup.add(pelvisGroup);

  const pelvisCore = tagBody(
    new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.22, 12), mats.robotJoint)
  );
  pelvisCore.scale.set(1.22, 1, 0.8);
  pelvisGroup.add(pelvisCore);

  const codpiece = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.24), mats.robotChassis)
  );
  codpiece.position.set(0, -0.02, 0.08);
  codpiece.rotation.x = 0.12;
  const rearFin = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.16), mats.robotArmor)
  );
  rearFin.position.set(0, 0.02, -0.16);
  rearFin.rotation.x = -0.25;
  pelvisGroup.add(codpiece, rearFin);

  // Hip axle bar & side mechanical rotary drums
  const hipAxle = tagBody(
    new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.56, 10), mats.robotChrome)
  );
  hipAxle.rotation.z = Math.PI / 2;
  hipAxle.position.y = -0.02;
  pelvisGroup.add(hipAxle);

  // Segmented tactical utility belt + energy pods + front buckle
  const belt = tagBody(
    new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 14), mats.robotJoint)
  );
  belt.scale.set(1.2, 1, 0.82);
  belt.position.y = 0.09;
  const buckle = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.07), mats.robotChrome),
    false,
    false
  );
  buckle.position.set(0, 0.09, 0.27);
  const buckleLed = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.02), glowMat),
    false,
    false
  );
  buckleLed.position.set(0, 0.09, 0.305);
  pelvisGroup.add(belt, buckle, buckleLed);

  [-0.36, 0.36].forEach((px) => {
    const canister = tagBody(
      new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.16, 8), mats.robotCopper)
    );
    canister.position.set(px, 0.08, 0.04);
    const cap = tagBody(
      new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 8), mats.robotChassis)
    );
    cap.position.set(px, 0.16, 0.04);
    pelvisGroup.add(canister, cap);
  });

  // ---------------- ARTICULATED 3-JOINT ROBOTIC LEGS (HIP -> KNEE -> ANKLE) ----------------
  const makeRobotLeg = (xOff: number, isRight: boolean) => {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(xOff, 1.04, 0);
    const sideSign = isRight ? 1 : -1;

    // Hip Ball Joint & Outer Servo Ring
    const hipBall = tagBody(new THREE.Mesh(new THREE.SphereGeometry(0.135, 10, 10), mats.robotJoint));
    const hipDrum = tagBody(
      new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 12), mats.robotChassis)
    );
    hipDrum.rotation.z = Math.PI / 2;
    hipDrum.position.set(sideSign * 0.11, 0, 0);
    const hipTrim = tagBody(
      new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.09, 10), teamMat),
      false,
      false
    );
    hipTrim.rotation.z = Math.PI / 2;
    hipTrim.position.set(sideSign * 0.12, 0, 0);
    hipPivot.add(hipBall, hipDrum, hipTrim);

    // Thigh Endoskeleton + Dual Armor Plates + Rear Hydraulic Piston
    const femurCore = tagBody(
      new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.44, 10), mats.robotJoint)
    );
    femurCore.position.y = -0.24;
    const thighFrontPlate = tagBody(
      new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.36, 0.16), mats.robotArmor)
    );
    thighFrontPlate.position.set(0, -0.24, 0.045);
    const thighSideFin = tagBody(
      new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.28, 0.18), teamMat)
    );
    thighSideFin.position.set(sideSign * 0.13, -0.24, 0);
    const thighPistonHousing = tagBody(
      new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.22, 8), mats.robotChassis)
    );
    thighPistonHousing.position.set(0, -0.18, -0.1);
    const thighPistonRod = tagBody(
      new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.24, 8), mats.robotChrome)
    );
    thighPistonRod.position.set(0, -0.34, -0.1);
    hipPivot.add(femurCore, thighFrontPlate, thighSideFin, thighPistonHousing, thighPistonRod);

    if (isRight) {
      // Magnetic Drop-Leg Holster + Sidearm Energy Pistol
      const holster = tagBody(
        new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.22, 0.15), mats.robotChassis)
      );
      holster.position.set(0.18, -0.24, 0.02);
      const sidearm = tagBody(
        new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.11, 0.13), mats.robotJoint)
      );
      sidearm.position.set(0.18, -0.14, -0.02);
      sidearm.rotation.x = -0.35;
      const cellStrip = tagBody(
        new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 0.07), glowMat),
        false,
        false
      );
      cellStrip.position.set(0.18, -0.13, -0.02);
      cellStrip.rotation.x = -0.35;
      hipPivot.add(holster, sidearm, cellStrip);
    }

    // KNEE PIVOT (at y = -0.48)
    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -0.48, 0);
    hipPivot.add(kneePivot);

    const kneeAxle = tagBody(
      new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.22, 12), mats.robotChrome)
    );
    kneeAxle.rotation.z = Math.PI / 2;
    const kneeShield = tagBody(
      new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.18, 0.11), mats.robotChassis)
    );
    kneeShield.position.set(0, 0.02, 0.11);
    kneeShield.rotation.x = -0.22;
    const kneeAccent = tagBody(
      new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.025), teamMat),
      false,
      false
    );
    kneeAccent.position.set(0, 0.04, 0.165);
    kneeAccent.rotation.x = -0.22;
    kneePivot.add(kneeAxle, kneeShield, kneeAccent);

    // Lower Shin (Tibia + Armored Greave + Twin Achilles Hydraulics)
    const shinCore = tagBody(
      new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.44, 10), mats.robotJoint)
    );
    shinCore.position.y = -0.24;
    const shinGreave = tagBody(
      new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.34, 0.14), mats.robotArmor)
    );
    shinGreave.position.set(0, -0.23, 0.055);
    shinGreave.rotation.x = 0.08;
    const calfThruster = tagBody(
      new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, 0.1), mats.robotChassis)
    );
    calfThruster.position.set(0, -0.18, -0.075);
    calfThruster.rotation.x = -0.16;

    [-0.045, 0.045].forEach((ax) => {
      const achillesRod = tagBody(
        new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.38, 6), mats.robotChrome)
      );
      achillesRod.position.set(ax, -0.26, -0.085);
      kneePivot.add(achillesRod);
    });
    kneePivot.add(shinCore, shinGreave, calfThruster);

    // ANKLE & ARTICULATED ROBOTIC FOOT PIVOT (at y = -0.48 -> world y = 0.08)
    const anklePivot = new THREE.Group();
    anklePivot.position.set(0, -0.48, 0);
    kneePivot.add(anklePivot);

    const ankleJoint = tagBody(
      new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.18, 10), mats.robotChrome)
    );
    ankleJoint.rotation.z = Math.PI / 2;
    const footInstep = tagBody(
      new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.24), mats.robotChassis)
    );
    footInstep.position.set(0, -0.02, 0.06);
    footInstep.rotation.x = 0.18;
    const toeClaw = tagBody(
      new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.055, 0.18), mats.robotArmor)
    );
    toeClaw.position.set(0, -0.052, 0.19);
    const heelSpur = tagBody(
      new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.14), mats.robotChassis)
    );
    heelSpur.position.set(0, -0.05, -0.08);
    const bootSole = tagBody(
      new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.036, 0.44), mats.matteTrim)
    );
    bootSole.position.set(0, -0.062, 0.07);
    anklePivot.add(ankleJoint, footInstep, toeClaw, heelSpur, bootSole);

    return { hipPivot, kneePivot, anklePivot };
  };

  const leftLegRig = makeRobotLeg(-0.22, false);
  const rightLegRig = makeRobotLeg(0.22, true);
  const leftLeg = leftLegRig.hipPivot;
  const leftKnee = leftLegRig.kneePivot;
  const leftAnkle = leftLegRig.anklePivot;
  const rightLeg = rightLegRig.hipPivot;
  const rightKnee = rightLegRig.kneePivot;
  const rightAnkle = rightLegRig.anklePivot;
  bodyGroup.add(leftLeg, rightLeg);

  // ---------------- ARTICULATED WAIST & TORSO GROUP (pivoted at y = 1.14) ----------------
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 1.14, 0);
  bodyGroup.add(torsoGroup);

  // Articulated Robotic Spine & Abdominal Pistons
  const spineCol = tagBody(
    new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.34, 12), mats.robotJoint)
  );
  spineCol.position.set(0, 0.14, -0.02);
  torsoGroup.add(spineCol);

  for (let seg = 0; seg < 3; seg++) {
    const ribRing = tagBody(
      new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.045, 10), mats.robotChassis)
    );
    ribRing.scale.set(1.15, 1, 0.85);
    ribRing.position.set(0, 0.05 + seg * 0.085, 0);
    torsoGroup.add(ribRing);
  }

  [-0.17, 0.17].forEach((ax) => {
    const abCyl = tagBody(
      new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.16, 8), mats.robotChassis)
    );
    abCyl.position.set(ax, 0.18, 0.15);
    abCyl.rotation.z = ax < 0 ? -0.14 : 0.14;
    const abRod = tagBody(
      new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.18, 8), mats.robotChrome)
    );
    abRod.position.set(ax * 0.85, 0.07, 0.15);
    abRod.rotation.z = ax < 0 ? -0.14 : 0.14;
    torsoGroup.add(abCyl, abRod);

    // Braided copper waist power conduit
    const waistTubeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ax * 1.25, 0.02, 0.02),
      new THREE.Vector3(ax * 1.48, 0.15, 0.04),
      new THREE.Vector3(ax * 1.32, 0.3, -0.02),
    ]);
    const waistTube = tagBody(
      new THREE.Mesh(new THREE.TubeGeometry(waistTubeCurve, 8, 0.02, 6, false), mats.robotCopper),
      false,
      false
    );
    torsoGroup.add(waistTube);
  });

  // Main Armored Chest Chassis (torso ref preserved)
  const torso = tagBody(
    new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.29, 0.56, 14), mats.robotChassis)
  );
  torso.scale.set(1.25, 1, 0.78);
  torso.position.set(0, 0.5, 0);
  torsoGroup.add(torso);

  // Angled Pectoral Armor Plates + Collar Yoke
  [-1, 1].forEach((sx) => {
    const pecPlate = tagBody(
      new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.26, 0.12), teamMat)
    );
    pecPlate.position.set(sx * 0.19, 0.57, 0.25);
    pecPlate.rotation.set(-0.16, sx * 0.24, sx * -0.08);
    const shoulderYoke = tagBody(
      new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.11, 0.34), mats.robotArmor)
    );
    shoulderYoke.position.set(sx * 0.24, 0.77, 0.0);
    shoulderYoke.rotation.z = sx * -0.16;
    torsoGroup.add(pecPlate, shoulderYoke);
  });

  // Central Glowing Chest Reactor Core
  const reactorBezel = tagBody(
    new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.13, 0.07, 8), mats.robotJoint)
  );
  reactorBezel.rotation.x = Math.PI / 2;
  reactorBezel.position.set(0, 0.56, 0.285);
  const reactorRing = tagBody(
    new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.016, 8, 16), mats.robotChrome),
    false,
    false
  );
  reactorRing.position.set(0, 0.56, 0.322);
  const reactorCore = tagBody(
    new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.03, 12), glowMat),
    false,
    false
  );
  reactorCore.rotation.x = Math.PI / 2;
  reactorCore.position.set(0, 0.56, 0.315);
  torsoGroup.add(reactorBezel, reactorRing, reactorCore);

  // Armored Neck Gorget + Tactical Mag Cells
  const gorget = tagBody(
    new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.24, 0.11, 12, 1, false, -Math.PI * 0.55, Math.PI * 1.1),
      mats.robotArmor
    )
  );
  gorget.position.set(0, 0.81, 0.03);
  torsoGroup.add(gorget);

  [-0.17, 0, 0.17].forEach((px) => {
    const cell = tagBody(
      new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.1), mats.robotArmor)
    );
    cell.position.set(px, 0.33, 0.26);
    const latch = tagBody(
      new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.04, 0.11), mats.robotCopper),
      false,
      false
    );
    latch.position.set(px, 0.39, 0.265);
    torsoGroup.add(cell, latch);
  });

  // High-Tech Dorsal Jetpack + Spinning Cooling Turbine + Twin Vector Thrusters
  const jetpackBody = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.24), mats.robotArmor)
  );
  jetpackBody.position.set(0, 0.54, -0.3);
  const jetpackSpine = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.44, 0.28), mats.robotChassis)
  );
  jetpackSpine.position.set(0, 0.54, -0.31);
  const jetpackCoreLed = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.32, 0.04), glowMat),
    false,
    false
  );
  jetpackCoreLed.position.set(0, 0.54, -0.45);
  torsoGroup.add(jetpackBody, jetpackSpine, jetpackCoreLed);

  // Spinning Dorsal Cooling Turbine Rotor
  const backRotor = new THREE.Group();
  backRotor.position.set(0, 0.62, -0.435);
  const rotorHub = tagBody(
    new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 10), mats.robotChrome),
    false,
    false
  );
  rotorHub.rotation.x = Math.PI / 2;
  backRotor.add(rotorHub);
  for (let b = 0; b < 4; b++) {
    const blade = tagBody(
      new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.032, 0.012), mats.robotCopper),
      false,
      false
    );
    blade.rotation.z = (b * Math.PI) / 4;
    backRotor.add(blade);
  }
  torsoGroup.add(backRotor);

  // Twin Angled Thruster Nozzles & Exhaust Flames
  const makeThruster = (xOff: number) => {
    const nozzle = tagBody(
      new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.095, 0.16, 10), mats.robotChassis)
    );
    nozzle.position.set(xOff, 0.26, -0.35);
    nozzle.rotation.x = 0.32;
    const nozzleRim = tagBody(
      new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.015, 6, 12), mats.robotChrome),
      false,
      false
    );
    nozzleRim.position.set(xOff, 0.19, -0.374);
    nozzleRim.rotation.x = Math.PI / 2 + 0.32;
    const flame = tagBody(
      new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.28, 8), glowMat),
      false,
      false
    );
    flame.rotation.x = Math.PI + 0.32;
    flame.position.set(xOff, 0.08, -0.41);
    torsoGroup.add(nozzle, nozzleRim, flame);
    return flame;
  };
  const leftThrusterFlame = makeThruster(-0.18);
  const rightThrusterFlame = makeThruster(0.18);

  // Curved Dorsal Power Conduits connecting Jetpack to Shoulder Assemblies
  [-1, 1].forEach((sx) => {
    const cableCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * 0.22, 0.68, -0.26),
      new THREE.Vector3(sx * 0.42, 0.82, -0.18),
      new THREE.Vector3(sx * 0.46, 0.74, 0.0),
    ]);
    const cable = tagBody(
      new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 10, 0.022, 6, false), mats.robotJoint),
      false,
      false
    );
    torsoGroup.add(cable);

    // Shoulder Rotary Drum + Layered Mechanical Pauldron
    const sDrum = tagBody(
      new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.14, 12), mats.robotChrome)
    );
    sDrum.rotation.z = Math.PI / 2;
    sDrum.position.set(sx * 0.5, 0.74, 0);
    const pauldronMain = tagBody(
      new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.32), mats.robotChassis)
    );
    pauldronMain.position.set(sx * 0.61, 0.78, 0);
    pauldronMain.rotation.z = sx * -0.36;
    const pauldronCrest = tagBody(
      new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.26), teamMat)
    );
    pauldronCrest.position.set(sx * 0.65, 0.88, 0);
    pauldronCrest.rotation.z = sx * -0.36;
    torsoGroup.add(sDrum, pauldronMain, pauldronCrest);
  });

  // ---------------- SCULPTED COMBAT ROBOT HEAD (isCritZone = true) ----------------
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.12, 0);
  torsoGroup.add(headGroup);

  // Corrugated Neck Column + Twin Diagonal Chrome Hydraulic Actuators
  const neckCore = tagBody(
    new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.11, 0.26, 10), mats.robotJoint),
    true
  );
  neckCore.position.set(0, -0.17, 0);
  headGroup.add(neckCore);

  [-0.095, 0.095].forEach((nx) => {
    const neckPiston = tagBody(
      new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.22, 6), mats.robotChrome),
      true
    );
    neckPiston.position.set(nx, -0.17, 0.04);
    neckPiston.rotation.z = nx < 0 ? -0.16 : 0.16;
    headGroup.add(neckPiston);
  });

  // Angular Armored Robot Cranium & Faceplate
  const headChassis = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.36), mats.robotChassis),
    true
  );
  headChassis.position.set(0, 0.04, 0);
  const headCrown = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.13, 0.4), mats.robotArmor),
    true
  );
  headCrown.position.set(0, 0.14, -0.01);
  headCrown.rotation.x = -0.08;
  const browRidge = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.14), mats.robotChassis),
    true
  );
  browRidge.position.set(0, 0.11, 0.16);
  browRidge.rotation.x = 0.22;
  const faceplate = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.08), mats.robotJoint),
    true
  );
  faceplate.position.set(0, 0.01, 0.16);
  const jawPlate = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.18), mats.robotArmor),
    true
  );
  jawPlate.position.set(0, -0.08, 0.1);
  headGroup.add(headChassis, headCrown, browRidge, faceplate, jawPlate);

  // Panoramic Glowing Visor Slit + Asymmetric Targeting Mono-Lens
  const visorSlit = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.048, 0.03), glowMat),
    true,
    false
  );
  visorSlit.position.set(0, 0.045, 0.2);

  const monoHousing = tagBody(
    new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.07, 12), mats.robotChrome),
    true
  );
  monoHousing.rotation.x = Math.PI / 2;
  monoHousing.position.set(0.075, 0.045, 0.205);
  const monoLens = tagBody(
    new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 10), glowMat),
    true,
    false
  );
  monoLens.rotation.x = Math.PI / 2;
  monoLens.position.set(0.075, 0.045, 0.235);
  headGroup.add(visorSlit, monoHousing, monoLens);

  // Side Cheek Mandibles + Comms Ear Pods + Dual Telemetry Antennas
  [-1, 1].forEach((sx) => {
    const earPod = tagBody(
      new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 12), mats.robotChrome),
      true
    );
    earPod.rotation.z = Math.PI / 2;
    earPod.position.set(sx * 0.19, 0.04, -0.01);
    const cheekVent = tagBody(
      new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.14), mats.robotCopper),
      true
    );
    cheekVent.position.set(sx * 0.145, -0.05, 0.09);
    headGroup.add(earPod, cheekVent);
  });

  const headCrest = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.34), teamMat),
    true,
    false
  );
  headCrest.position.set(0, 0.23, -0.03);
  const antennaMain = tagBody(
    new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.42, 6), mats.robotChrome),
    true,
    false
  );
  antennaMain.position.set(-0.2, 0.28, -0.1);
  const antennaSub = tagBody(
    new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.26, 6), mats.robotChrome),
    true,
    false
  );
  antennaSub.position.set(0.2, 0.2, -0.1);
  const antLed = tagBody(
    new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 6), glowMat),
    true,
    false
  );
  antLed.position.set(-0.2, 0.5, -0.1);
  headGroup.add(headCrest, antennaMain, antennaSub, antLed);

  // ---------------- ARTICULATED 2-JOINT ROBOTIC ARMS (SHOULDER -> ELBOW) ----------------
  // Left Support Arm
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.58, 0.74, 0);
  torsoGroup.add(leftArm);

  const lUpper = tagBody(
    new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.34, 10), mats.robotJoint)
  );
  lUpper.position.y = -0.18;
  const lBicepArmor = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.15), mats.robotArmor)
  );
  lBicepArmor.position.set(-0.02, -0.18, 0);
  const lBicepPiston = tagBody(
    new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.26, 6), mats.robotChrome)
  );
  lBicepPiston.position.set(0.07, -0.18, 0.04);
  leftArm.add(lUpper, lBicepArmor, lBicepPiston);

  const leftElbow = new THREE.Group();
  leftElbow.position.set(0, -0.36, 0);
  leftArm.add(leftElbow);

  const lElbowDrum = tagBody(
    new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.14, 10), mats.robotChrome)
  );
  lElbowDrum.rotation.z = Math.PI / 2;
  const lForearm = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.14), mats.robotChassis)
  );
  lForearm.position.set(0.0, -0.18, 0.0);
  const lVambrace = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.08), teamMat)
  );
  lVambrace.position.set(-0.02, -0.18, 0.06);
  const lWristHolo = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.02), glowMat),
    false,
    false
  );
  lWristHolo.position.set(-0.02, -0.22, 0.11);
  const lHand = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.11), mats.robotJoint)
  );
  lHand.position.set(0.0, -0.38, 0.02);
  leftElbow.add(lElbowDrum, lForearm, lVambrace, lWristHolo, lHand);

  leftArm.rotation.set(-0.62, 0.18, 0.14);
  leftElbow.rotation.set(-0.78, 0.28, -0.25);

  // Right Rifle Arm
  const rightArm = new THREE.Group();
  rightArm.position.set(0.58, 0.74, 0);
  torsoGroup.add(rightArm);

  const rUpper = tagBody(
    new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.34, 10), mats.robotJoint)
  );
  rUpper.position.y = -0.18;
  const rBicepArmor = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.15), mats.robotArmor)
  );
  rBicepArmor.position.set(0.02, -0.18, 0);
  const rBicepPiston = tagBody(
    new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.26, 6), mats.robotChrome)
  );
  rBicepPiston.position.set(-0.07, -0.18, 0.04);
  rightArm.add(rUpper, rBicepArmor, rBicepPiston);

  const rightElbow = new THREE.Group();
  rightElbow.position.set(0, -0.36, 0);
  rightArm.add(rightElbow);

  const rElbowDrum = tagBody(
    new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.14, 10), mats.robotChrome)
  );
  rElbowDrum.rotation.z = Math.PI / 2;
  const rForearm = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.14), mats.robotChassis)
  );
  rForearm.position.set(0.0, -0.18, 0.0);
  const rVambrace = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.08), teamMat)
  );
  rVambrace.position.set(0.02, -0.18, 0.06);
  const rHand = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.11), mats.robotJoint)
  );
  rHand.position.set(-0.02, -0.38, 0.02);
  rightElbow.add(rElbowDrum, rForearm, rVambrace, rHand);

  rightArm.rotation.set(-0.48, -0.1, -0.06);
  rightElbow.rotation.set(-1.02, 0.08, 0);

  // ---------------- DETAILED FUTURISTIC PULSE RIFLE ----------------
  const rivalGunGroup = new THREE.Group();
  rivalGunGroup.position.set(-0.08, -0.38, 0.14);
  rivalGunGroup.rotation.x = Math.PI / 2;

  const rStock = tagBody(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.15, 0.26), mats.robotJoint));
  rStock.position.set(0, -0.01, -0.38);
  const rBody = tagBody(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.17, 0.66), mats.robotChassis));
  const rHandguard = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.13, 0.36), mats.robotArmor)
  );
  rHandguard.position.set(0, 0.01, 0.42);
  const rBarrel = tagBody(
    new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 0.48, 10), mats.robotChrome)
  );
  rBarrel.rotation.x = Math.PI / 2;
  rBarrel.position.set(0, 0.02, 0.72);
  const rSuppressor = tagBody(
    new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.24, 10), mats.robotJoint)
  );
  rSuppressor.rotation.x = Math.PI / 2;
  rSuppressor.position.set(0, 0.02, 0.98);
  const rMag = tagBody(new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.26, 0.11), mats.robotJoint));
  rMag.position.set(0, -0.17, 0.14);
  rMag.rotation.x = 0.18;
  const rOptic = tagBody(new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.082, 0.18), mats.robotChassis));
  rOptic.position.set(0, 0.135, 0.04);
  const rOpticGlow = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.02), glowMat),
    false,
    false
  );
  rOpticGlow.position.set(0, 0.135, 0.132);
  const rLaser = tagBody(new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.15), mats.robotJoint));
  rLaser.position.set(-0.08, 0.02, 0.46);
  const rEnergyStrip = tagBody(
    new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.024, 0.28), glowMat),
    false,
    false
  );
  rEnergyStrip.position.set(0, 0.02, 0.42);

  rivalGunGroup.add(
    rStock,
    rBody,
    rHandguard,
    rBarrel,
    rSuppressor,
    rMag,
    rOptic,
    rOpticGlow,
    rLaser,
    rEnergyStrip
  );
  rightElbow.add(rivalGunGroup);

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xfde047,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const muzzleFlash = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), flashMat);
  muzzleFlash.position.set(-0.08, -1.52, 0.16);
  muzzleFlash.visible = false;
  rightElbow.add(muzzleFlash);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(-0.08, -1.5, 0.16);
  rightElbow.add(muzzlePoint);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 2.2),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  root.add(shadow);

  return {
    root,
    bodyGroup,
    pelvisGroup,
    torsoGroup,
    leftLeg,
    leftKnee,
    leftAnkle,
    rightLeg,
    rightKnee,
    rightAnkle,
    leftArm,
    leftElbow,
    rightArm,
    rightElbow,
    headGroup,
    torso,
    backRotor,
    leftThrusterFlame,
    rightThrusterFlame,
    muzzlePoint,
    muzzleFlash,
  };
}

function buildMuzzleFlashMesh(): THREE.Group {
  const g = new THREE.Group();
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const outerMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), coreMat);
  core.scale.set(1, 1, 2.2);
  g.add(core);

  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.18, 4), outerMat);
    fin.rotation.z = (i * Math.PI) / 2;
    fin.position.set(Math.cos((i * Math.PI) / 2) * 0.06, Math.sin((i * Math.PI) / 2) * 0.06, -0.02);
    fin.rotation.y = Math.PI / 2;
    g.add(fin);
  }
  const frontCone = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 6), outerMat);
  frontCone.rotation.x = -Math.PI / 2;
  frontCone.position.z = -0.11;
  g.add(frontCone);

  g.visible = false;
  return g;
}

function buildFirstPersonHands(mats: MaterialPalette, twoHanded: boolean): THREE.Group {
  const hands = new THREE.Group();

  // Trigger hand + tactical ripstop forearm sleeve + wrist cuff (right)
  const rightSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.086, 0.34), mats.sleeveFabric);
  rightSleeve.position.set(0.065, -0.13, 0.14);
  rightSleeve.rotation.set(0.28, -0.16, 0);
  hands.add(rightSleeve);

  const rightCuff = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.09, 0.036), mats.armorDark);
  rightCuff.position.set(0.038, -0.095, 0.02);
  rightCuff.rotation.set(0.28, -0.16, 0);
  hands.add(rightCuff);

  const rightGlove = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.08, 0.11), mats.gloveDark);
  rightGlove.position.set(0.015, -0.075, -0.02);
  hands.add(rightGlove);

  const rKnuckle = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.022, 0.042), mats.armorDark);
  rKnuckle.position.set(0.015, -0.038, -0.03);
  hands.add(rKnuckle);

  // Articulated right gloved fingers wrapping grip
  for (let f = 0; f < 3; f++) {
    const rFinger = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.017, 0.022), mats.gloveDark);
    rFinger.position.set(-0.014, -0.068 - f * 0.018, -0.045);
    hands.add(rFinger);
  }

  if (twoHanded) {
    // Support forearm + digital tactical watch + angled gloved hand holding handguard
    const leftSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.082, 0.38), mats.sleeveFabric);
    leftSleeve.position.set(-0.15, -0.11, -0.08);
    leftSleeve.rotation.set(0.18, 0.42, 0.1);
    hands.add(leftSleeve);

    const watchBand = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.086, 0.032), mats.matteTrim);
    watchBand.position.set(-0.08, -0.075, -0.18);
    watchBand.rotation.set(0.18, 0.42, 0.1);
    const watchFace = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.012, 0.028), mats.chrome);
    watchFace.position.set(-0.08, -0.032, -0.18);
    watchFace.rotation.set(0.18, 0.42, 0.1);
    const watchDial = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.004, 0.018),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    watchDial.position.set(-0.08, -0.025, -0.18);
    watchDial.rotation.set(0.18, 0.42, 0.1);
    hands.add(watchBand, watchFace, watchDial);

    const leftGlove = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.07, 0.11), mats.gloveDark);
    leftGlove.position.set(-0.02, -0.045, -0.26);
    hands.add(leftGlove);

    const lKnuckle = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.02, 0.04), mats.armorDark);
    lKnuckle.position.set(-0.02, -0.012, -0.27);
    hands.add(lKnuckle);

    for (let f = 0; f < 3; f++) {
      const lFinger = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.018, 0.026), mats.gloveDark);
      lFinger.position.set(0.022, -0.035 + f * 0.014, -0.24 - f * 0.022);
      hands.add(lFinger);
    }
  }

  return hands;
}

/**
 * Detailed First-Person 4-Slot Tactical Weapon Viewmodel Rig
 */
export interface ViewmodelRig {
  root: THREE.Group;
  slotGroups: [THREE.Group, THREE.Group, THREE.Group, THREE.Group];
  muzzlePoint: THREE.Object3D;
  ejectionPoint: THREE.Object3D;
  muzzleFlash: THREE.Group;
  primaryBolt: THREE.Object3D;
  primaryMag: THREE.Object3D;
  secondarySlide: THREE.Object3D;
  secondaryMag: THREE.Object3D;
}

export function buildRivalsViewmodel(
  loadout: LoadoutConfig,
  mats: MaterialPalette,
  builds?: WeaponBuildsMap
): ViewmodelRig {
  const root = new THREE.Group();

  // ---------------- SLOT 0: PRIMARY FIREARM ----------------
  const primarySpec = resolveGunSpec(
    PRIMARY_WEAPONS[loadout.primary],
    builds?.[loadout.primary]
  );
  const primaryGroup = new THREE.Group();
  const accentMat0 = new THREE.MeshStandardMaterial({
    color: primarySpec.color,
    roughness: 0.88,
    metalness: 0,
    envMapIntensity: 0,
  });

  primaryGroup.add(buildFirstPersonHands(mats, true));

  // Upper & Lower Receiver
  const receiverLower = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.095, 0.38), mats.gunmetal);
  receiverLower.position.set(0, -0.01, -0.14);
  primaryGroup.add(receiverLower);

  const receiverUpper = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.06, 0.36), mats.armorDark);
  receiverUpper.position.set(0, 0.055, -0.14);
  primaryGroup.add(receiverUpper);

  // Pistol Grip & Buttstock
  const pGrip = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.13, 0.068), mats.gloveDark);
  pGrip.position.set(0, -0.09, -0.02);
  pGrip.rotation.x = 0.28;
  primaryGroup.add(pGrip);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.11, 0.22), mats.matteTrim);
  stock.position.set(0, -0.01, 0.13);
  const recoilPad = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.118, 0.024), mats.gloveDark);
  recoilPad.position.set(0, -0.01, 0.245);
  const cheekRiser = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.028, 0.12), mats.armorDark);
  cheekRiser.position.set(0, 0.052, 0.12);
  const selectorPin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.084, 8), mats.brass);
  selectorPin.rotation.z = Math.PI / 2;
  selectorPin.position.set(0, -0.004, -0.05);
  primaryGroup.add(stock, recoilPad, cheekRiser, selectorPin);

  // Reciprocating Bolt / Charging Handle
  const primaryBolt = new THREE.Group();
  const boltMesh = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.026, 0.09), mats.chrome);
  boltMesh.position.set(0.039, 0.055, -0.15);
  primaryBolt.add(boltMesh);
  primaryGroup.add(primaryBolt);

  // Detachable Magazine (extended / quick / standard visual geometry)
  const primaryMag = new THREE.Group();
  const magHeight =
    primarySpec.magazine === 'extended'
      ? 0.25
      : loadout.primary === 'sniper'
      ? 0.11
      : 0.18;
  const magMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.044, magHeight, primarySpec.magazine === 'extended' ? 0.105 : 0.088),
    mats.matteTrim
  );
  magMesh.position.set(0, -0.1 - magHeight * 0.15, -0.2);
  magMesh.rotation.x = -0.14;
  primaryMag.add(magMesh);
  if (primarySpec.magazine === 'quick') {
    const pullTab = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.022, 0.094), accentMat0);
    pullTab.position.set(0, -0.1 - magHeight * 0.6, -0.21);
    primaryMag.add(pullTab);
  }
  primaryGroup.add(primaryMag);

  // Handguard, Top Picatinny Rail & Barrel
  const hgLen = loadout.primary === 'sniper' ? 0.34 : 0.28;
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.075, hgLen), mats.armorSlate);
  handguard.position.set(0, 0.03, -0.42);
  primaryGroup.add(handguard);

  const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.016, 0.52), mats.matteTrim);
  topRail.position.set(0, 0.092, -0.24);
  primaryGroup.add(topRail);

  // Machined Picatinny Rail Teeth & Ejection Port Recess + Side Tactical Laser Module
  for (let rz = -0.46; rz <= -0.02; rz += 0.036) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.008, 0.014), mats.gunmetal);
    tooth.position.set(0, 0.102, rz);
    primaryGroup.add(tooth);
  }
  const ejPort = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.026, 0.085), mats.brass);
  ejPort.position.set(0.036, 0.055, -0.14);
  primaryGroup.add(ejPort);

  const peqBox = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.032, 0.095), mats.armorDark);
  peqBox.position.set(-0.044, 0.032, -0.44);
  const peqLens = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.01, 10), accentMat0);
  peqLens.rotation.x = Math.PI / 2;
  peqLens.position.set(-0.044, 0.032, -0.49);
  primaryGroup.add(peqBox, peqLens);

  // Angled Foregrip
  const foregrip = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.09, 0.052), mats.gloveDark);
  foregrip.position.set(0, -0.035, -0.36);
  foregrip.rotation.x = -0.18;
  primaryGroup.add(foregrip);

  const barrelLen =
    (loadout.primary === 'sniper' ? 0.62 : loadout.primary === 'shotgun' ? 0.34 : 0.32) +
    (primarySpec.barrel === 'heavy' ? 0.12 : 0);
  const barrelZ = -0.54 - barrelLen / 2;
  const barrelRadius = primarySpec.barrel === 'heavy' ? 0.022 : 0.016;
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(barrelRadius, barrelRadius + 0.004, barrelLen, 12),
    mats.gunmetal
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.035, barrelZ);
  primaryGroup.add(barrel);

  // Shotgun underbarrel tube magazine
  if (loadout.primary === 'shotgun') {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.36, 10), mats.chrome);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, -0.002, -0.58);
    primaryGroup.add(tube);
  }

  // Barrel Muzzle Attachment (Suppressor / Heavy Compensator / Standard Brake)
  const muzzleLen =
    primarySpec.barrel === 'suppressor' ? 0.24 : primarySpec.barrel === 'heavy' ? 0.12 : 0.09;
  const muzzleRad =
    primarySpec.barrel === 'suppressor' ? 0.03 : primarySpec.barrel === 'heavy' ? 0.028 : 0.024;
  const brake = new THREE.Mesh(
    new THREE.CylinderGeometry(muzzleRad, muzzleRad, muzzleLen, 12),
    primarySpec.barrel === 'suppressor' ? mats.matteTrim : mats.armorDark
  );
  brake.rotation.x = Math.PI / 2;
  const muzzleTipZ = barrelZ - barrelLen / 2 - muzzleLen / 2;
  brake.position.set(0, 0.035, muzzleTipZ);
  primaryGroup.add(brake);

  // Optic Assembly (Scope / Holo / Iron Sights)
  if (primarySpec.optic === 'scope') {
    const scopeTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.028, 0.28, 14),
      mats.gunmetal
    );
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.145, -0.16);
    const scopeTurretTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.022, 10),
      mats.armorDark
    );
    scopeTurretTop.position.set(0, 0.175, -0.16);
    const scopeTurretSide = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.02, 10),
      mats.armorDark
    );
    scopeTurretSide.rotation.z = Math.PI / 2;
    scopeTurretSide.position.set(0.032, 0.145, -0.16);
    const frontLens = new THREE.Mesh(new THREE.CircleGeometry(0.024, 14), mats.opticGlass);
    frontLens.position.set(0, 0.145, -0.301);
    frontLens.rotation.y = Math.PI;
    const rearLens = new THREE.Mesh(new THREE.CircleGeometry(0.022, 14), mats.opticGlass);
    rearLens.position.set(0, 0.145, -0.019);
    primaryGroup.add(scopeTube, scopeTurretTop, scopeTurretSide, frontLens, rearLens);
  } else if (primarySpec.optic === 'holo') {
    const holoBase = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.02, 0.09), mats.gunmetal);
    holoBase.position.set(0, 0.108, -0.14);
    const holoHoodL = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.044, 0.075), mats.armorDark);
    holoHoodL.position.set(-0.022, 0.138, -0.14);
    const holoHoodR = holoHoodL.clone();
    holoHoodR.position.x = 0.022;
    const holoTop = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.008, 0.075), mats.armorDark);
    holoTop.position.set(0, 0.162, -0.14);
    const holoLens = new THREE.Mesh(new THREE.PlaneGeometry(0.038, 0.038), mats.opticGlass);
    holoLens.position.set(0, 0.138, -0.14);
    const reticleDot = new THREE.Mesh(new THREE.SphereGeometry(0.003, 6, 6), accentMat0);
    reticleDot.position.set(0, 0.138, -0.142);
    primaryGroup.add(holoBase, holoHoodL, holoHoodR, holoTop, holoLens, reticleDot);
  } else {
    const rearL = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.024, 0.022), mats.armorDark);
    rearL.position.set(-0.016, 0.114, -0.06);
    const rearR = rearL.clone();
    rearR.position.x = 0.016;
    const frontIron = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.028, 0.016), accentMat0);
    frontIron.position.set(0, 0.116, -0.48);
    primaryGroup.add(rearL, rearR, frontIron);
  }

  // Custom caliber & finish trim strip
  const pStripe = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.016, 0.24), accentMat0);
  pStripe.position.set(0, 0.032, -0.18);
  primaryGroup.add(pStripe);

  // ---------------- SLOT 1: SECONDARY SIDEARM ----------------
  const secSpec = resolveGunSpec(
    SECONDARY_WEAPONS[loadout.secondary],
    builds?.[loadout.secondary]
  );
  const secondaryGroup = new THREE.Group();
  const accentMat1 = new THREE.MeshStandardMaterial({
    color: secSpec.color,
    roughness: 0.88,
    metalness: 0,
    envMapIntensity: 0,
  });

  secondaryGroup.add(buildFirstPersonHands(mats, loadout.secondary === 'uzi'));

  const sFrame = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.044, 0.24), mats.gunmetal);
  sFrame.position.set(0, -0.01, -0.13);
  secondaryGroup.add(sFrame);

  const secondarySlide = new THREE.Group();
  const slideLen = loadout.secondary === 'uzi' ? 0.34 : 0.25;
  const sSlide = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.056, slideLen), mats.chrome);
  sSlide.position.set(0, 0.035, -0.15);
  secondarySlide.add(sSlide);

  // Secondary Optic / Iron Sights
  if (secSpec.optic === 'holo' || secSpec.optic === 'scope') {
    const sHoloL = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.028, 0.05), mats.armorDark);
    sHoloL.position.set(-0.018, 0.078, -0.12);
    const sHoloR = sHoloL.clone();
    sHoloR.position.x = 0.018;
    const sDot = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 6, 6), accentMat1);
    sDot.position.set(0, 0.078, -0.12);
    secondarySlide.add(sHoloL, sHoloR, sDot);
  } else {
    const rearSightL = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.016, 0.016), mats.armorDark);
    rearSightL.position.set(-0.014, 0.07, -0.04);
    const rearSightR = rearSightL.clone();
    rearSightR.position.x = 0.014;
    const frontPost = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.018, 0.016), accentMat1);
    frontPost.position.set(0, 0.072, -0.255);
    secondarySlide.add(rearSightL, rearSightR, frontPost);
  }
  secondaryGroup.add(secondarySlide);

  if (secSpec.barrel === 'suppressor') {
    const secSup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.18, 10),
      mats.matteTrim
    );
    secSup.rotation.x = Math.PI / 2;
    secSup.position.set(0, 0.035, -0.36);
    secondaryGroup.add(secSup);
  } else if (secSpec.barrel === 'heavy') {
    const secComp = new THREE.Mesh(
      new THREE.BoxGeometry(0.044, 0.052, 0.09),
      mats.armorDark
    );
    secComp.position.set(0, 0.028, -0.31);
    secondaryGroup.add(secComp);
  }

  if (loadout.secondary === 'revolver') {
    const cylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.034, 0.034, 0.075, 10),
      mats.armorDark
    );
    cylinder.rotation.x = Math.PI / 2;
    cylinder.position.set(0, 0.025, -0.11);
    secondaryGroup.add(cylinder);
  }

  const sGrip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.13, 0.068), mats.gloveDark);
  sGrip.position.set(0, -0.08, -0.04);
  sGrip.rotation.x = 0.24;
  secondaryGroup.add(sGrip);

  const secondaryMag = new THREE.Group();
  const secExt = secSpec.magazine === 'extended' ? 0.08 : 0;
  if (loadout.secondary === 'uzi') {
    const uziMag = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.18 + secExt, 0.056),
      mats.matteTrim
    );
    uziMag.position.set(0, -0.11 - secExt * 0.4, -0.14);
    secondaryMag.add(uziMag);
  } else {
    const pMag = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.03 + secExt, 0.06),
      mats.matteTrim
    );
    pMag.position.set(0, -0.145 - secExt * 0.4, -0.02);
    secondaryMag.add(pMag);
  }
  secondaryGroup.add(secondaryMag);

  const sAccent = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.014, 0.12), accentMat1);
  sAccent.position.set(0, 0.035, -0.17);
  secondaryGroup.add(sAccent);

  // ---------------- SLOT 2: MELEE BLADE ----------------
  const meleeSpec = resolveMeleeSpec(
    MELEE_WEAPONS[loadout.melee],
    builds?.[loadout.melee]
  );
  const meleeGroup = new THREE.Group();
  meleeGroup.add(buildFirstPersonHands(mats, false));

  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0,
    roughness: 0.86,
    envMapIntensity: 0,
  });
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.24, 10), mats.matteTrim);
  hilt.position.set(0, -0.06, -0.08);
  hilt.rotation.x = -0.35;
  meleeGroup.add(hilt);

  const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.016, 12), mats.brass);
  tsuba.position.set(0, 0.04, -0.12);
  tsuba.rotation.x = -0.35;
  meleeGroup.add(tsuba);

  const baseBladeLen =
    loadout.melee === 'katana' ? 0.72 : loadout.melee === 'scythe' ? 0.82 : 0.38;
  const bladeLen = baseBladeLen * meleeSpec.reachMult;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.014, bladeLen, 0.052), bladeMat);
  blade.position.set(0, 0.28 + (bladeLen - baseBladeLen) * 0.35, -0.22);
  blade.rotation.x = -0.35;
  meleeGroup.add(blade);

  if (loadout.melee === 'scythe') {
    const hook = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.085, 0.34 * meleeSpec.reachMult),
      bladeMat
    );
    hook.position.set(0, 0.62 + (bladeLen - baseBladeLen) * 0.6, -0.44);
    meleeGroup.add(hook);
  }

  // ---------------- SLOT 3: TACTICAL UTILITY ----------------
  const utilSpec = resolveUtilitySpec(
    UTILITY_ITEMS[loadout.utility],
    builds?.[loadout.utility]
  );
  const utilGroup = new THREE.Group();
  utilGroup.add(buildFirstPersonHands(mats, false));

  const utilAccent = new THREE.MeshStandardMaterial({
    color: utilSpec.color,
    roughness: 0.88,
    metalness: 0,
    envMapIntensity: 0,
  });
  if (loadout.utility === 'medkit') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.13, 0.11), mats.chrome);
    box.position.set(0, -0.02, -0.18);
    utilGroup.add(box);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.026, 0.118), utilAccent);
    crossH.position.set(0, -0.02, -0.18);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.08, 0.118), utilAccent);
    crossV.position.set(0, -0.02, -0.18);
    utilGroup.add(crossH, crossV);
  } else {
    const canister = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.17, 14), mats.gunmetal);
    canister.position.set(0, -0.02, -0.18);
    utilGroup.add(canister);
    const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.018), mats.chrome);
    spoon.position.set(0.058, -0.01, -0.18);
    const pinRing = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 6, 14), mats.brass);
    pinRing.position.set(-0.04, 0.06, -0.18);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.045, 14), utilAccent);
    band.position.set(0, -0.02, -0.18);
    utilGroup.add(spoon, pinRing, band);
  }

  secondaryGroup.visible = false;
  meleeGroup.visible = false;
  utilGroup.visible = false;

  root.add(primaryGroup, secondaryGroup, meleeGroup, utilGroup);

  const muzzleZ = muzzleTipZ - muzzleLen * 0.5;
  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, 0.035, muzzleZ);
  root.add(muzzlePoint);

  const muzzleFlash = buildMuzzleFlashMesh();
  muzzleFlash.position.set(0, 0.035, muzzleZ);
  root.add(muzzleFlash);

  const ejectionPoint = new THREE.Object3D();
  ejectionPoint.position.set(0.05, 0.05, -0.15);
  root.add(ejectionPoint);

  root.position.set(0.26, -0.24, -0.4);

  return {
    root,
    slotGroups: [primaryGroup, secondaryGroup, meleeGroup, utilGroup],
    muzzlePoint,
    ejectionPoint,
    muzzleFlash,
    primaryBolt,
    primaryMag,
    secondarySlide,
    secondaryMag,
  };
}
