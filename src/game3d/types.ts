export type ShooterState =
  | 'TITLE_MENU'
  | 'ROUND_QUIZ'
  | 'PLAYING'
  | 'ROUND_END'
  | 'PAUSED'
  | 'GAME_OVER';

export type MapId = 'arena' | 'construction' | 'splash' | 'docks';

export interface ArenaMapSpec {
  id: MapId;
  name: string;
  tagline: string;
  halfX: number;
  halfZ: number;
  spawnZ: number;
  skyColor: number;
  fogDensity: number;
  hemiSky: number;
  hemiGround: number;
  sunColor: number;
  sunIntensity: number;
  floorBaseHex: string;
  floorAltHex: string;
  floorLineHex: string;
  containerA: [string, string];
  containerB: [string, string];
  containerNeutral: [string, string];
}

export const ARENA_MAPS: Record<MapId, ArenaMapSpec> = {
  arena: {
    id: 'arena',
    name: 'Arena',
    tagline: 'Central Bridge · Symmetric Ramps',
    halfX: 28,
    halfZ: 34,
    spawnZ: 29,
    skyColor: 0xdbeafe,
    fogDensity: 0.0018,
    hemiSky: 0xf0f9ff,
    hemiGround: 0x64748b,
    sunColor: 0xfffbeb,
    sunIntensity: 1.45,
    floorBaseHex: '#cbd5e1',
    floorAltHex: '#d4dde8',
    floorLineHex: 'rgba(51, 65, 85, 0.22)',
    containerA: ['#0369a1', '#38bdf8'],
    containerB: ['#be123c', '#fb7185'],
    containerNeutral: ['#475569', '#f59e0b'],
  },
  construction: {
    id: 'construction',
    name: 'Construction',
    tagline: 'Twin Scaffolding · Sky Catwalk',
    halfX: 28,
    halfZ: 34,
    spawnZ: 29,
    skyColor: 0xfef3c7,
    fogDensity: 0.0016,
    hemiSky: 0xfffbeb,
    hemiGround: 0x78716c,
    sunColor: 0xfde68a,
    sunIntensity: 1.5,
    floorBaseHex: '#a8a29e',
    floorAltHex: '#b4aea8',
    floorLineHex: 'rgba(245, 158, 11, 0.28)',
    containerA: ['#ca8a04', '#fef08a'],
    containerB: ['#ea580c', '#fed7aa'],
    containerNeutral: ['#57534e', '#facc15'],
  },
  splash: {
    id: 'splash',
    name: 'Splash',
    tagline: 'Poolside Island · Resort Lanes',
    halfX: 29,
    halfZ: 33,
    spawnZ: 28,
    skyColor: 0xbae6fd,
    fogDensity: 0.0014,
    hemiSky: 0xe0f2fe,
    hemiGround: 0x0284c7,
    sunColor: 0xfffbeb,
    sunIntensity: 1.45,
    floorBaseHex: '#e2e8f0',
    floorAltHex: '#f1f5f9',
    floorLineHex: 'rgba(14, 165, 233, 0.24)',
    containerA: ['#0891b2', '#67e8f9'],
    containerB: ['#f43f5e', '#fda4af'],
    containerNeutral: ['#0f766e', '#5eead4'],
  },
  docks: {
    id: 'docks',
    name: 'Docks',
    tagline: 'Harbor Yard · Gantry Overlook',
    halfX: 30,
    halfZ: 35,
    spawnZ: 30,
    skyColor: 0x1e293b,
    fogDensity: 0.0024,
    hemiSky: 0x94a3b8,
    hemiGround: 0x1e293b,
    sunColor: 0xe0f2fe,
    sunIntensity: 1.35,
    floorBaseHex: '#334155',
    floorAltHex: '#3b495e',
    floorLineHex: 'rgba(148, 163, 184, 0.22)',
    containerA: ['#1d4ed8', '#60a5fa'],
    containerB: ['#b91c1c', '#f87171'],
    containerNeutral: ['#475569', '#38bdf8'],
  },
};

export type PrimaryId = 'assault_rifle' | 'burst_rifle' | 'sniper' | 'shotgun';
export type SecondaryId = 'revolver' | 'handgun' | 'uzi';
export type MeleeId = 'katana' | 'scythe' | 'knife';
export type UtilityId = 'grenade' | 'medkit' | 'flashbang';
export type SlotIndex = 0 | 1 | 2 | 3;

export type DifficultyId = 'rookie' | 'ranked' | 'nemesis';

export interface GunSpec {
  id: string;
  name: string;
  category: 'primary' | 'secondary';
  damage: number;
  headshotMult: number;
  fireInterval: number;
  magSize: number;
  reloadTime: number;
  pellets: number;
  spread: number;
  adsSpread: number;
  adsFov: number;
  auto: boolean;
  burstCount?: number;
  color: number;
  recoilKick: number;
}

export interface MeleeSpec {
  id: MeleeId;
  name: string;
  damage: number;
  cooldown: number;
  range: number;
  speedBonus: number;
  dashImpulse: number;
  color: number;
}

export interface UtilitySpec {
  id: UtilityId;
  name: string;
  cooldown: number;
  charges: number;
  description: string;
  color: number;
}

export const PRIMARY_WEAPONS: Record<PrimaryId, GunSpec> = {
  assault_rifle: {
    id: 'assault_rifle',
    name: 'Assault Rifle',
    category: 'primary',
    damage: 16,
    headshotMult: 1.75,
    fireInterval: 0.11,
    magSize: 25,
    reloadTime: 1.15,
    pellets: 1,
    spread: 0.014,
    adsSpread: 0.004,
    adsFov: 60,
    auto: true,
    color: 0x38bdf8,
    recoilKick: 0.045,
  },
  burst_rifle: {
    id: 'burst_rifle',
    name: 'Burst Rifle',
    category: 'primary',
    damage: 19,
    headshotMult: 1.8,
    fireInterval: 0.36,
    magSize: 24,
    reloadTime: 1.2,
    pellets: 1,
    spread: 0.01,
    adsSpread: 0.002,
    adsFov: 56,
    auto: false,
    burstCount: 3,
    color: 0x818cf8,
    recoilKick: 0.06,
  },
  sniper: {
    id: 'sniper',
    name: 'Sniper',
    category: 'primary',
    damage: 78,
    headshotMult: 2.0,
    fireInterval: 1.05,
    magSize: 5,
    reloadTime: 1.55,
    pellets: 1,
    spread: 0.035,
    adsSpread: 0.0005,
    adsFov: 34,
    auto: false,
    color: 0x34d399,
    recoilKick: 0.18,
  },
  shotgun: {
    id: 'shotgun',
    name: 'Shotgun',
    category: 'primary',
    damage: 12,
    headshotMult: 1.5,
    fireInterval: 0.68,
    magSize: 6,
    reloadTime: 1.35,
    pellets: 8,
    spread: 0.072,
    adsSpread: 0.048,
    adsFov: 64,
    auto: false,
    color: 0xf59e0b,
    recoilKick: 0.15,
  },
};

export const SECONDARY_WEAPONS: Record<SecondaryId, GunSpec> = {
  revolver: {
    id: 'revolver',
    name: 'Revolver',
    category: 'secondary',
    damage: 38,
    headshotMult: 1.9,
    fireInterval: 0.42,
    magSize: 6,
    reloadTime: 1.1,
    pellets: 1,
    spread: 0.008,
    adsSpread: 0.001,
    adsFov: 58,
    auto: false,
    color: 0xfbbf24,
    recoilKick: 0.12,
  },
  handgun: {
    id: 'handgun',
    name: 'Handgun',
    category: 'secondary',
    damage: 18,
    headshotMult: 1.75,
    fireInterval: 0.18,
    magSize: 12,
    reloadTime: 0.95,
    pellets: 1,
    spread: 0.012,
    adsSpread: 0.003,
    adsFov: 62,
    auto: false,
    color: 0x94a3b8,
    recoilKick: 0.05,
  },
  uzi: {
    id: 'uzi',
    name: 'Uzi',
    category: 'secondary',
    damage: 11,
    headshotMult: 1.6,
    fireInterval: 0.07,
    magSize: 28,
    reloadTime: 1.1,
    pellets: 1,
    spread: 0.032,
    adsSpread: 0.016,
    adsFov: 64,
    auto: true,
    color: 0x38bdf8,
    recoilKick: 0.035,
  },
};

export const MELEE_WEAPONS: Record<MeleeId, MeleeSpec> = {
  katana: {
    id: 'katana',
    name: 'Katana',
    damage: 45,
    cooldown: 0.45,
    range: 3.4,
    speedBonus: 1.24,
    dashImpulse: 13.5,
    color: 0x38bdf8,
  },
  scythe: {
    id: 'scythe',
    name: 'Scythe',
    damage: 55,
    cooldown: 0.58,
    range: 3.9,
    speedBonus: 1.18,
    dashImpulse: 16.0,
    color: 0xa855f7,
  },
  knife: {
    id: 'knife',
    name: 'Knife',
    damage: 38,
    cooldown: 0.3,
    range: 2.8,
    speedBonus: 1.32,
    dashImpulse: 11.5,
    color: 0xe2e8f0,
  },
};

export const UTILITY_ITEMS: Record<UtilityId, UtilitySpec> = {
  grenade: {
    id: 'grenade',
    name: 'Grenade',
    cooldown: 4.0,
    charges: 2,
    description: 'Bouncing explosive dealing up to 75 blast damage.',
    color: 0xf97316,
  },
  medkit: {
    id: 'medkit',
    name: 'Medkit',
    cooldown: 6.0,
    charges: 2,
    description: 'Instantly restores +55 HP during a duel.',
    color: 0x10b981,
  },
  flashbang: {
    id: 'flashbang',
    name: 'Flashbang',
    cooldown: 5.0,
    charges: 2,
    description: 'Stuns & scrambles Rival aim for 2.4 seconds.',
    color: 0xfef08a,
  },
};

export interface LoadoutConfig {
  primary: PrimaryId;
  secondary: SecondaryId;
  melee: MeleeId;
  utility: UtilityId;
}

export interface DifficultySpec {
  id: DifficultyId;
  label: string;
  accuracy: number;
  reactionSec: number;
  moveSpeed: number;
  useCover: boolean;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultySpec> = {
  rookie: {
    id: 'rookie',
    label: 'Rookie',
    accuracy: 0.42,
    reactionSec: 0.55,
    moveSpeed: 8.5,
    useCover: false,
  },
  ranked: {
    id: 'ranked',
    label: 'Ranked',
    accuracy: 0.65,
    reactionSec: 0.34,
    moveSpeed: 10.6,
    useCover: true,
  },
  nemesis: {
    id: 'nemesis',
    label: 'Nemesis',
    accuracy: 0.84,
    reactionSec: 0.2,
    moveSpeed: 12.2,
    useCover: true,
  },
};

export type TeamSize = 1 | 2 | 3 | 4 | 5;
export type TeamSide = 'ally' | 'enemy';

export const TEAM_SIZES: TeamSize[] = [1, 2, 3, 4, 5];

export interface TeamRosterStatus {
  id: string;
  name: string;
  team: TeamSide;
  isPlayer: boolean;
  hp: number;
  maxHp: number;
  alive: boolean;
}

export interface OverheadMarker {
  id: string;
  name: string;
  team: TeamSide;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  visible: boolean;
}

export interface KillFeedEntry {
  id: number;
  killerName: string;
  killerTeam: TeamSide;
  victimName: string;
  victimTeam: TeamSide;
  headshot: boolean;
}

export interface DamagePopup {
  id: number;
  amount: number;
  crit: boolean;
  x: number;
  y: number;
}

export interface RivalsHudSnapshot {
  teamSize: TeamSize;
  playerHp: number;
  maxHp: number;
  playerAlive: boolean;
  rivalHp: number;
  alliesAlive: number;
  enemiesAlive: number;
  allyRoster: TeamRosterStatus[];
  enemyRoster: TeamRosterStatus[];
  playerRounds: number;
  rivalRounds: number;
  roundNumber: number;
  roundsToWin: number;
  roundTimer: number;
  activeSlot: SlotIndex;
  primaryAmmo: number;
  secondaryAmmo: number;
  utilityCharges: number;
  reloading: boolean;
  reloadProgress: number;
  sliding: boolean;
  ads: boolean;
  dashReady: boolean;
  pointerLocked: boolean;
  roundBanner: string | null;
  damageFlash: number;
  hitMarker: 'none' | 'hit' | 'headshot';
  overheadMarkers: OverheadMarker[];
  damagePopups: DamagePopup[];
  killFeed: KillFeedEntry[];
  totalDamageDealt: number;
  kills: number;
  headshots: number;
  shotsFired: number;
  shotsHit: number;
  activePerkLabel: string | null;
  factToast: { subjectLabel: string; fact: string } | null;
}

const CAREER_KEY = 'rivals_duel_career_v1';

export interface CareerStats {
  wins: number;
  losses: number;
  winStreak: number;
}

export function loadCareerStats(): CareerStats {
  try {
    const raw = window.localStorage.getItem(CAREER_KEY);
    if (!raw) return { wins: 0, losses: 0, winStreak: 0 };
    const p = JSON.parse(raw) as Partial<CareerStats>;
    return {
      wins: p.wins ?? 0,
      losses: p.losses ?? 0,
      winStreak: p.winStreak ?? 0,
    };
  } catch {
    return { wins: 0, losses: 0, winStreak: 0 };
  }
}

export function recordMatchResult(won: boolean): CareerStats {
  const cur = loadCareerStats();
  const next: CareerStats = {
    wins: cur.wins + (won ? 1 : 0),
    losses: cur.losses + (won ? 0 : 1),
    winStreak: won ? cur.winStreak + 1 : 0,
  };
  try {
    window.localStorage.setItem(CAREER_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota errors
  }
  return next;
}
