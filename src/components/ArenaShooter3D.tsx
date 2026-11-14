import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crosshair,
  GraduationCap,
  LogOut,
  Pause,
  Play,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Wrench,
  XCircle,
} from 'lucide-react';
import {
  buildMapEnvironment,
  buildRivalCharacter,
  buildRivalsViewmodel,
  createMaterialPalette,
  getMapBoxes,
  getMapFloorHeightAt,
  MaterialPalette,
  RivalCharacterRig,
  ViewmodelRig,
} from '../game3d/models';
import {
  ContainerTextureSet,
  createArenaFloorMarkingsTexture,
  createBarkTextureSet,
  createBridgeDeckTextureSet,
  createConcreteTextureSet,
  createContactShadowTexture,
  createContainerTextureSet,
  createFabricTextureSet,
  createGrassDirtTextureSet,
  createGunmetalTextureSet,
  createRockTextureSet,
  createSkyDomeTexture,
  createSoftParticleTexture,
  createTerrainTextureSet,
  TerrainTextureSet,
} from '../game3d/textures';
import { shooterAudio } from '../game3d/audio';
import {
  CLASS_LEVELS,
  ClassLevel,
  getCambridgeStageLabel,
  getQuestionsForClassAndSubject,
  loadUsedQuestionKeys,
  pickArenaFact,
  pickQuestion,
  QuizQuestion,
  ROUND_PERKS,
  RoundOverchargePerk,
  SUBJECTS,
  SubjectId,
} from '../game3d/education';
import {
  CrosshairConfig,
  CrosshairCustomizerModal,
  CrosshairReticle,
  loadCrosshairConfig,
  saveCrosshairConfig,
} from './CrosshairSystem';
import {
  ARENA_MAPS,
  DamagePopup,
  DIFFICULTIES,
  DifficultyId,
  KillFeedEntry,
  loadCareerStats,
  LoadoutConfig,
  MapId,
  MELEE_WEAPONS,
  MeleeId,
  OverheadMarker,
  PRIMARY_WEAPONS,
  PrimaryId,
  recordMatchResult,
  RivalsHudSnapshot,
  SECONDARY_WEAPONS,
  SecondaryId,
  ShooterState,
  SlotIndex,
  TEAM_SIZES,
  TeamRosterStatus,
  TeamSide,
  TeamSize,
  UTILITY_ITEMS,
  UtilityId,
} from '../game3d/types';
import {
  ALL_WEAPON_LIST,
  applyTemplateToBuild,
  BarrelAttachment,
  FireModeOverride,
  getDefaultWeaponBuild,
  getTemplatesForWeapon,
  getWeaponCategory,
  loadUserTemplates,
  loadWeaponBuilds,
  MagazineAttachment,
  OpticAttachment,
  resolveGunSpec,
  resolveMeleeSpec,
  resolveUtilitySpec,
  saveUserTemplates,
  saveWeaponBuilds,
  UserSavedTemplate,
  WEAPON_FINISH_SWATCHES,
  WeaponBuildsMap,
  WeaponCustomBuild,
  WeaponId,
} from '../game3d/weaponTemplates';

interface TracerEntity {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

interface ThrownEntity {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  kind: 'grenade' | 'flashbang';
  powerMult: number;
}

interface SparkEntity {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface ShellEntity {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  life: number;
  bounced: boolean;
}

interface ImpactEntity {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

interface SmokeEntity {
  sprite: THREE.Sprite;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
  baseOpacity: number;
}

interface ShockwaveEntity {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  maxScale: number;
}

const CinematicLensShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.08 },
    uAberration: { value: 0.0 },
    uTexelSize: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
    uSharpen: { value: 0.28 },
    uTime: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uAberration;
    uniform vec2 uTexelSize;
    uniform float uSharpen;
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      vec2 offset = (vUv - 0.5) * uAberration;
      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      vec3 col = vec3(r, g, b);

      // Clamped 5-tap micro-contrast unsharp mask for crisp normal-map & edge clarity
      vec3 n = texture2D(tDiffuse, vUv + vec2(0.0, uTexelSize.y)).rgb;
      vec3 s = texture2D(tDiffuse, vUv - vec2(0.0, uTexelSize.y)).rgb;
      vec3 e = texture2D(tDiffuse, vUv + vec2(uTexelSize.x, 0.0)).rgb;
      vec3 w = texture2D(tDiffuse, vUv - vec2(uTexelSize.x, 0.0)).rgb;
      vec3 blur = (n + s + e + w) * 0.25;
      col += clamp(col - blur, -0.085, 0.085) * uSharpen;

      // Filmic S-curve contrast & split-tone shadow/highlight balance
      col = clamp(col, 0.0, 1.0);
      vec3 sCurve = col * col * (3.0 - 2.0 * col);
      col = mix(col, sCurve, 0.22);
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(luma), col, 1.08);
      col += mix(vec3(-0.008, -0.004, 0.012), vec3(0.01, 0.006, -0.004), luma);

      // Subtle organic film grain
      float grain = fract(sin(dot(vUv * (uTime * 0.13 + 1.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      col += grain * 0.014;

      float dist = distance(vUv, vec2(0.5));
      float vig = smoothstep(0.92, 0.24, dist);
      col *= mix(1.0 - uVignette, 1.0, vig);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};

// Pre-allocated math helpers (zero per-frame GC)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _rayDir = new THREE.Vector3();
const _ndc = new THREE.Vector2();
const _projVec = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scaleVec = new THREE.Vector3();
const _tintColor = new THREE.Color();

const ROUNDS_TO_WIN = 5;
const MAX_HP = 150;

const DEFAULT_LOADOUT: LoadoutConfig = {
  primary: 'assault_rifle',
  secondary: 'revolver',
  melee: 'katana',
  utility: 'grenade',
};

const INITIAL_HUD: RivalsHudSnapshot = {
  teamSize: 1,
  playerHp: MAX_HP,
  maxHp: MAX_HP,
  playerAlive: true,
  rivalHp: MAX_HP,
  alliesAlive: 1,
  enemiesAlive: 1,
  allyRoster: [],
  enemyRoster: [],
  playerRounds: 0,
  rivalRounds: 0,
  roundNumber: 1,
  roundsToWin: ROUNDS_TO_WIN,
  roundTimer: 90,
  activeSlot: 0,
  primaryAmmo: PRIMARY_WEAPONS.assault_rifle.magSize,
  secondaryAmmo: SECONDARY_WEAPONS.revolver.magSize,
  utilityCharges: UTILITY_ITEMS.grenade.charges,
  reloading: false,
  reloadProgress: 0,
  sliding: false,
  ads: false,
  dashReady: true,
  pointerLocked: false,
  roundBanner: null,
  damageFlash: 0,
  hitMarker: 'none',
  overheadMarkers: [],
  damagePopups: [],
  killFeed: [],
  totalDamageDealt: 0,
  kills: 0,
  headshots: 0,
  shotsFired: 0,
  shotsHit: 0,
  activePerkLabel: null,
  factToast: null,
};

interface QuizHistoryEntry {
  prompt: string;
  correctAnswer: string;
  explanation: string;
  wasCorrect: boolean;
}

export function ArenaShooter3D() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const [gameState, setGameState] = useState<ShooterState>('TITLE_MENU');
  const [selectedMap, setSelectedMap] = useState<MapId>('arena');
  const [classLevel, setClassLevel] = useState<ClassLevel>(6);
  const [subject, setSubject] = useState<SubjectId>('mixed');
  const [qaModalOpen, setQaModalOpen] = useState(false);
  const [revealedQaIds, setRevealedQaIds] = useState<Record<string, boolean>>({});
  const [difficulty, setDifficulty] = useState<DifficultyId>('ranked');
  const [teamSize, setTeamSize] = useState<TeamSize>(1);
  const [loadout, setLoadout] = useState<LoadoutConfig>(DEFAULT_LOADOUT);
  const [weaponBuilds, setWeaponBuilds] = useState<WeaponBuildsMap>(() => loadWeaponBuilds());
  const [userTemplates, setUserTemplates] = useState<UserSavedTemplate[]>(() => loadUserTemplates());
  const [workshopOpen, setWorkshopOpen] = useState(false);
  const [workshopWeaponId, setWorkshopWeaponId] = useState<WeaponId>('assault_rifle');
  const [customTemplateName, setCustomTemplateName] = useState('');
  const [crosshairConfig, setCrosshairConfig] = useState<CrosshairConfig>(() => loadCrosshairConfig());
  const [crosshairModalOpen, setCrosshairModalOpen] = useState(false);
  const [hud, setHud] = useState<RivalsHudSnapshot>(INITIAL_HUD);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const [graphicsMode, setGraphicsMode] = useState<'ultra' | 'standard'>('ultra');
  const [webglError, setWebglError] = useState<string | null>(null);
  const [career, setCareer] = useState(() => loadCareerStats());

  useEffect(() => {
    saveCrosshairConfig(crosshairConfig);
  }, [crosshairConfig]);

  const [quizState, setQuizState] = useState<{
    roundNum: number;
    question: QuizQuestion;
    perk: RoundOverchargePerk;
    hadWrongAttempt: boolean;
    wrongFeedback: {
      chosenAnswer: string;
      correctAnswer: string;
      explanation: string;
    } | null;
    solved: boolean;
  } | null>(null);
  const [quizHistory, setQuizHistory] = useState<QuizHistoryEntry[]>([]);
  const [quizStats, setQuizStats] = useState({ correct: 0, total: 0, streak: 0, bestStreak: 0 });

  const quizStateRef = useRef<typeof quizState>(null);
  const gameStateRef = useRef<ShooterState>('TITLE_MENU');
  const mapRef = useRef<MapId>('arena');
  const classLevelRef = useRef<ClassLevel>(6);
  const subjectRef = useRef<SubjectId>('mixed');
  const difficultyRef = useRef<DifficultyId>('ranked');
  const teamSizeRef = useRef<TeamSize>(1);
  const loadoutRef = useRef<LoadoutConfig>(DEFAULT_LOADOUT);
  const weaponBuildsRef = useRef<WeaponBuildsMap>(weaponBuilds);
  const usedQuestionIdsRef = useRef<Set<string>>(loadUsedQuestionKeys());
  const onRequestNextRoundQuizRef = useRef<(roundNum: number) => void>(() => {});

  const apiRef = useRef<{
    prepareMatch: (cfg: LoadoutConfig) => void;
    beginRound: (roundNum: number, perk: RoundOverchargePerk | null) => void;
    selectSlot: (slot: SlotIndex) => void;
    triggerReload: () => void;
    lockPointer: () => void;
    rebuildViewmodel: (cfg: LoadoutConfig, builds?: WeaponBuildsMap) => void;
    rebuildMap: (mapId: MapId) => void;
    setGraphicsMode: (mode: 'ultra' | 'standard') => void;
    cancelMatch: () => void;
  } | null>(null);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    mapRef.current = selectedMap;
    apiRef.current?.rebuildMap(selectedMap);
  }, [selectedMap]);

  useEffect(() => {
    classLevelRef.current = classLevel;
  }, [classLevel]);

  useEffect(() => {
    subjectRef.current = subject;
  }, [subject]);

  useEffect(() => {
    difficultyRef.current = difficulty;
  }, [difficulty]);

  useEffect(() => {
    teamSizeRef.current = teamSize;
  }, [teamSize]);

  useEffect(() => {
    loadoutRef.current = loadout;
    apiRef.current?.rebuildViewmodel(loadout, weaponBuildsRef.current);
  }, [loadout]);

  useEffect(() => {
    weaponBuildsRef.current = weaponBuilds;
    saveWeaponBuilds(weaponBuilds);
    apiRef.current?.rebuildViewmodel(loadoutRef.current, weaponBuilds);
  }, [weaponBuilds]);

  useEffect(() => {
    saveUserTemplates(userTemplates);
  }, [userTemplates]);

  const openWorkshopFor = useCallback((wId: WeaponId) => {
    setWorkshopWeaponId(wId);
    setCustomTemplateName('');
    setWorkshopOpen(true);
  }, []);

  const updateWeaponBuild = useCallback(
    (wId: WeaponId, patch: Partial<WeaponCustomBuild>, markCustom = true) => {
      setWeaponBuilds((prev) => ({
        ...prev,
        [wId]: {
          ...prev[wId],
          ...patch,
          templateId: markCustom ? 'custom' : patch.templateId ?? prev[wId].templateId,
          templateName: markCustom ? 'Custom Build' : patch.templateName ?? prev[wId].templateName,
        },
      }));
    },
    []
  );

  const equipWeaponInLoadout = useCallback((wId: WeaponId) => {
    const cat = getWeaponCategory(wId);
    setLoadout((prev) => {
      if (cat === 'primary') return { ...prev, primary: wId as PrimaryId };
      if (cat === 'secondary') return { ...prev, secondary: wId as SecondaryId };
      if (cat === 'melee') return { ...prev, melee: wId as MeleeId };
      return { ...prev, utility: wId as UtilityId };
    });
  }, []);

  const saveCurrentAsUserTemplate = useCallback(() => {
    const label = customTemplateName.trim() || `My ${workshopWeaponId.replace('_', ' ')}`;
    const newTpl: UserSavedTemplate = {
      id: `user_${Date.now()}`,
      weaponId: workshopWeaponId,
      name: label,
      build: {
        ...weaponBuildsRef.current[workshopWeaponId],
        templateId: `user_${Date.now()}`,
        templateName: label,
      },
    };
    setUserTemplates((prev) => [newTpl, ...prev]);
    setWeaponBuilds((prev) => ({
      ...prev,
      [workshopWeaponId]: newTpl.build,
    }));
    setCustomTemplateName('');
  }, [customTemplateName, workshopWeaponId]);

  const toggleMute = useCallback(() => {
    setSoundMuted((prev) => {
      const next = !prev;
      shooterAudio.setMuted(next);
      return next;
    });
  }, []);

  const toggleGraphicsMode = useCallback(() => {
    setGraphicsMode((prev) => {
      const next = prev === 'ultra' ? 'standard' : 'ultra';
      apiRef.current?.setGraphicsMode(next);
      return next;
    });
  }, []);

  const openRoundQuiz = useCallback((roundNum: number) => {
    if (document.pointerLockElement) document.exitPointerLock?.();
    const question = pickQuestion(
      subjectRef.current,
      classLevelRef.current,
      usedQuestionIdsRef.current
    );
    const perk = ROUND_PERKS[(roundNum - 1) % ROUND_PERKS.length];
    const nextState = {
      roundNum,
      question,
      perk,
      hadWrongAttempt: false,
      wrongFeedback: null,
      solved: false,
    };
    quizStateRef.current = nextState;
    setQuizState(nextState);
    gameStateRef.current = 'ROUND_QUIZ';
    setGameState('ROUND_QUIZ');
  }, []);

  useEffect(() => {
    onRequestNextRoundQuizRef.current = openRoundQuiz;
  }, [openRoundQuiz]);

  const startDuel = useCallback(() => {
    setQuizHistory([]);
    setQuizStats({ correct: 0, total: 0, streak: 0, bestStreak: 0 });
    apiRef.current?.prepareMatch(loadoutRef.current);
    openRoundQuiz(1);
  }, [openRoundQuiz]);

  const swapQuizQuestion = useCallback(() => {
    const prev = quizStateRef.current;
    if (!prev || prev.solved) return;
    const nextQ = pickQuestion(
      subjectRef.current,
      classLevelRef.current,
      usedQuestionIdsRef.current,
      prev.question.prompt
    );
    const nextState = { ...prev, question: nextQ, wrongFeedback: null };
    quizStateRef.current = nextState;
    setQuizState(nextState);
  }, []);

  const answerQuiz = useCallback((choiceIdx: number) => {
    const prev = quizStateRef.current;
    if (!prev || prev.solved) return;
    const isCorrect = choiceIdx === prev.question.correctIndex;
    if (isCorrect) shooterAudio.playHeal();
    else shooterAudio.playPlayerHit();

    setQuizStats((s) => {
      const nextStreak = isCorrect ? s.streak + 1 : 0;
      return {
        correct: s.correct + (isCorrect ? 1 : 0),
        total: s.total + 1,
        streak: nextStreak,
        bestStreak: Math.max(s.bestStreak, nextStreak),
      };
    });

    if (isCorrect) {
      const firstTry = !prev.hadWrongAttempt;
      setQuizHistory((h) => [
        ...h,
        {
          prompt: prev.question.prompt,
          correctAnswer: prev.question.choices[prev.question.correctIndex],
          explanation: prev.question.explanation,
          wasCorrect: firstTry,
        },
      ]);
      const nextState = { ...prev, solved: true, wrongFeedback: null };
      quizStateRef.current = nextState;
      setQuizState(nextState);
      return;
    }

    // Wrong answer: record missed question and immediately move to a brand-new question
    setQuizHistory((h) => [
      ...h,
      {
        prompt: prev.question.prompt,
        correctAnswer: prev.question.choices[prev.question.correctIndex],
        explanation: prev.question.explanation,
        wasCorrect: false,
      },
    ]);
    const nextQ = pickQuestion(
      subjectRef.current,
      classLevelRef.current,
      usedQuestionIdsRef.current,
      prev.question.prompt
    );
    const nextState = {
      ...prev,
      question: nextQ,
      hadWrongAttempt: true,
      wrongFeedback: {
        chosenAnswer: prev.question.choices[choiceIdx],
        correctAnswer: prev.question.choices[prev.question.correctIndex],
        explanation: prev.question.explanation,
      },
    };
    quizStateRef.current = nextState;
    setQuizState(nextState);
  }, []);

  const deployRoundFromQuiz = useCallback(() => {
    if (!quizState || !quizState.solved) return;
    const earnedPerk = !quizState.hadWrongAttempt ? quizState.perk : null;
    apiRef.current?.beginRound(quizState.roundNum, earnedPerk);
    gameStateRef.current = 'PLAYING';
    setGameState('PLAYING');
    apiRef.current?.lockPointer();
  }, [quizState]);

  const pauseDuel = useCallback(() => {
    if (document.pointerLockElement) document.exitPointerLock?.();
    setGameState('PAUSED');
  }, []);

  const resumeDuel = useCallback(() => {
    setGameState('PLAYING');
    apiRef.current?.lockPointer();
  }, []);

  const exitToLobby = useCallback(() => {
    if (document.pointerLockElement) document.exitPointerLock?.();
    apiRef.current?.cancelMatch();
    quizStateRef.current = null;
    setQuizState(null);
    gameStateRef.current = 'TITLE_MENU';
    setGameState('TITLE_MENU');
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (gameStateRef.current === 'ROUND_QUIZ') {
        if (e.code === 'Digit1') answerQuiz(0);
        else if (e.code === 'Digit2') answerQuiz(1);
        else if (e.code === 'Digit3') answerQuiz(2);
        else if (e.code === 'Digit4') answerQuiz(3);
        else if ((e.code === 'Enter' || e.code === 'Space') && quizState?.solved) {
          e.preventDefault();
          deployRoundFromQuiz();
        }
        return;
      }
      if (e.code === 'KeyH') setDockCollapsed((c) => !c);
      else if (e.code === 'KeyP') {
        if (gameStateRef.current === 'PLAYING') pauseDuel();
        else if (gameStateRef.current === 'PAUSED') resumeDuel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answerQuiz, deployRoundFromQuiz, pauseDuel, quizState?.solved, resumeDuel]);

  // Mount Three.js Engine
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param) ?? '');
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('WebGL is unavailable on this browser.');
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('3D context lost. Reload page to continue.');
    };
    const onContextRestored = () => setWebglError(null);
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    // Map-Driven Sky, Fog & Atmospheric Lighting
    let currentMapId: MapId = mapRef.current;
    const initMapSpec = ARENA_MAPS[currentMapId];

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(initMapSpec.skyColor);
    const fog = new THREE.FogExp2(initMapSpec.skyColor, initMapSpec.fogDensity);
    scene.fog = fog;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      76,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      260
    );
    camera.rotation.order = 'YXZ';
    scene.add(camera);

    const getSkyColorsForMap = (mapId: MapId): [string, string, string, boolean] => {
      if (mapId === 'construction') return ['#7dd3fc', '#fef3c7', '#fde047', false];
      if (mapId === 'splash') return ['#0284c7', '#bae6fd', '#e0f2fe', false];
      if (mapId === 'docks') return ['#020617', '#1e293b', '#38bdf8', true];
      return ['#38bdf8', '#dbeafe', '#fef3c7', false];
    };

    const [zHex, hHex, sHex, isNightSky] = getSkyColorsForMap(currentMapId);
    let skyTex = createSkyDomeTexture(zHex, hHex, sHex, isNightSky);
    const skyGeo = new THREE.SphereGeometry(185, 28, 18);
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyDome);

    const hemi = new THREE.HemisphereLight(initMapSpec.hemiSky, initMapSpec.hemiGround, 0.78);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(initMapSpec.sunColor, initMapSpec.sunIntensity);
    sun.position.set(28, 46, 22);
    sun.castShadow = !isSoftwareGl;
    sun.shadow.mapSize.set(isSoftwareGl ? 1024 : 2048, isSoftwareGl ? 1024 : 2048);
    sun.shadow.camera.near = 6;
    sun.shadow.camera.far = 145;
    sun.shadow.camera.left = -54;
    sun.shadow.camera.right = 54;
    sun.shadow.camera.top = 54;
    sun.shadow.camera.bottom = -54;
    sun.shadow.bias = -0.00035;
    sun.shadow.normalBias = 0.025;
    sun.shadow.radius = 2.2;
    scene.add(sun);

    const rim = new THREE.DirectionalLight(0x93c5fd, 0.2);
    rim.position.set(-28, 18, -32);
    scene.add(rim);

    const muzzleLight = new THREE.PointLight(0xfbbf24, 0, 12, 2);
    camera.add(muzzleLight);
    muzzleLight.position.set(0.25, -0.15, -1.0);

    const explosionLight = new THREE.PointLight(0xf97316, 0, 26, 2);
    scene.add(explosionLight);

    // GPU Post-Processing Pipeline (4x MSAA HalfFloat target + Crisp Filmic Lens Shader, no shiny bloom)
    let composer: EffectComposer | null = null;
    let composerTarget: THREE.WebGLRenderTarget | null = null;
    let lensPass: ShaderPass | null = null;
    if (!isSoftwareGl) {
      const cw = Math.max(1, container.clientWidth);
      const ch = Math.max(1, container.clientHeight);
      const pr = Math.min(window.devicePixelRatio, 2);
      composerTarget = new THREE.WebGLRenderTarget(
        Math.floor(cw * pr),
        Math.floor(ch * pr),
        {
          type: THREE.HalfFloatType,
          samples: 4,
        }
      );
      composer = new EffectComposer(renderer, composerTarget);
      composer.setPixelRatio(pr);
      composer.setSize(cw, ch);
      composer.addPass(new RenderPass(scene, camera));
      lensPass = new ShaderPass(CinematicLensShader);
      lensPass.uniforms.uTexelSize.value.set(1 / Math.max(1, cw * pr), 1 / Math.max(1, ch * pr));
      composer.addPass(lensPass);
      composer.addPass(new OutputPass());
    }

    // Procedural PBR Texture Sets & Shared Material Palette
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    let floorTexSet: TerrainTextureSet = createTerrainTextureSet(
      maxAniso,
      initMapSpec.floorBaseHex,
      initMapSpec.floorAltHex,
      initMapSpec.floorLineHex,
      26,
      currentMapId
    );
    let floorMarkingsTex = createArenaFloorMarkingsTexture(currentMapId, maxAniso);
    let containerASet: ContainerTextureSet = createContainerTextureSet(
      initMapSpec.containerA[0],
      initMapSpec.containerA[1],
      maxAniso,
      'RVL-A1'
    );
    let containerBSet: ContainerTextureSet = createContainerTextureSet(
      initMapSpec.containerB[0],
      initMapSpec.containerB[1],
      maxAniso,
      'RVL-B2'
    );
    let neutralSet: ContainerTextureSet = createContainerTextureSet(
      initMapSpec.containerNeutral[0],
      initMapSpec.containerNeutral[1],
      maxAniso,
      'SEC-09'
    );
    const shadowTex = createContactShadowTexture();
    const particleTex = createSoftParticleTexture();
    const grassTexSet = createGrassDirtTextureSet(maxAniso, 26, 'grass');
    const dirtTexSet = createGrassDirtTextureSet(maxAniso, 26, 'dirt');
    const bridgeTexSet = createBridgeDeckTextureSet(maxAniso, 4, 4);
    const gunmetalTexSet = createGunmetalTextureSet(maxAniso);
    const fabricTexSet = createFabricTextureSet(maxAniso);
    const concreteTexSet = createConcreteTextureSet(maxAniso);
    const rockTexSet = createRockTextureSet(maxAniso);
    const barkTexSet = createBarkTextureSet(maxAniso);

    // Atmospheric Dust Motes / Embers / Sea Mist (never obscures target silhouettes)
    const dustCount = 260;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustSpeeds = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 64;
      dustPositions[i * 3 + 1] = 0.6 + Math.random() * 14.5;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 64;
      dustSpeeds[i] = 0.22 + Math.random() * 0.5;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const getDustColorForMap = (mapId: MapId) =>
      mapId === 'docks'
        ? 0x7dd3fc
        : mapId === 'construction'
        ? 0xfde68a
        : mapId === 'splash'
        ? 0xe0f2fe
        : 0xfef3c7;
    const dustMat = new THREE.PointsMaterial({
      map: particleTex,
      color: getDustColorForMap(currentMapId),
      size: 0.1,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    scene.add(dustPoints);

    const mats: MaterialPalette = createMaterialPalette(
      containerASet,
      containerBSet,
      neutralSet,
      bridgeTexSet,
      gunmetalTexSet,
      fabricTexSet,
      concreteTexSet,
      rockTexSet
    );
    const sharedMatSet = new Set<THREE.Material>(Object.values(mats));

    // Continuous Terrain (Flat Arena + Splash Pool Dip + Natural Outer Ridges)
    const terrainGeo = new THREE.PlaneGeometry(240, 240, 96, 96);
    terrainGeo.rotateX(-Math.PI / 2);
    const updateTerrainGeometry = (mapId: MapId) => {
      const spec = ARENA_MAPS[mapId];
      const posAttr = terrainGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vz = posAttr.getZ(i);
        const absX = Math.abs(vx);
        const absZ = Math.abs(vz);
        if (absX <= spec.halfX + 4 && absZ <= spec.halfZ + 4) {
          if (mapId === 'splash' && absX <= 13.5 && absZ <= 13.5) {
            posAttr.setY(i, -0.45);
          } else {
            posAttr.setY(i, 0);
          }
        } else {
          posAttr.setY(i, getMapFloorHeightAt(mapId, vx, vz));
        }
      }
      posAttr.needsUpdate = true;
      terrainGeo.computeVertexNormals();
    };
    updateTerrainGeometry(currentMapId);

    const getMapShaderMode = (mapId: MapId) =>
      mapId === 'construction' ? 1 : mapId === 'splash' ? 2 : mapId === 'docks' ? 3 : 0;

    const getFloorNormalForMap = (mapId: MapId) =>
      mapId === 'arena' || mapId === 'splash'
        ? dirtTexSet.normalMap
        : grassTexSet.normalMap;

    const getFloorRoughnessForMap = (mapId: MapId) =>
      mapId === 'arena' || mapId === 'splash'
        ? dirtTexSet.roughnessMap
        : grassTexSet.roughnessMap;

    const terrainUniforms = {
      uTerrainHalf: { value: new THREE.Vector2(initMapSpec.halfX, initMapSpec.halfZ) },
      uGrassMap: { value: grassTexSet.map },
      uDirtMap: { value: dirtTexSet.map },
      uRockMap: { value: rockTexSet.map },
      uMapMode: { value: getMapShaderMode(currentMapId) },
    };

    const terrainMat = new THREE.MeshStandardMaterial({
      map: floorTexSet.map,
      normalMap: getFloorNormalForMap(currentMapId),
      normalScale: new THREE.Vector2(1.05, 1.05),
      roughnessMap: getFloorRoughnessForMap(currentMapId),
      roughness: 0.96,
      metalness: 0,
      envMapIntensity: 0,
    });
    terrainMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTerrainHalf = terrainUniforms.uTerrainHalf;
      shader.uniforms.uGrassMap = terrainUniforms.uGrassMap;
      shader.uniforms.uDirtMap = terrainUniforms.uDirtMap;
      shader.uniforms.uRockMap = terrainUniforms.uRockMap;
      shader.uniforms.uMapMode = terrainUniforms.uMapMode;
      shader.vertexShader =
        `varying vec2 vTerrainWorldXZ;\nvarying float vTerrainNormalY;\n` +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          vTerrainWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
          vTerrainNormalY = normal.y;
          `
        );
      shader.fragmentShader =
        `uniform vec2 uTerrainHalf;\nuniform sampler2D uGrassMap;\nuniform sampler2D uDirtMap;\nuniform sampler2D uRockMap;\nuniform float uMapMode;\nvarying vec2 vTerrainWorldXZ;\nvarying float vTerrainNormalY;\n` +
        shader.fragmentShader
          .replace(
            '#include <map_fragment>',
            `
            #include <map_fragment>
            vec2 rotUv = vec2(vTerrainWorldXZ.x * 0.8 - vTerrainWorldXZ.y * 0.6, vTerrainWorldXZ.x * 0.6 + vTerrainWorldXZ.y * 0.8) * 0.048;
            vec3 grassFine = texture2D(uGrassMap, vTerrainWorldXZ * 0.15).rgb;
            vec3 grassMacro = texture2D(uGrassMap, rotUv).rgb;
            vec3 dirtFine = texture2D(uDirtMap, vTerrainWorldXZ * 0.17).rgb;
            vec3 dirtMacro = texture2D(uDirtMap, rotUv * 1.12).rgb;
            vec3 rockCol = texture2D(uRockMap, vTerrainWorldXZ * 0.09).rgb;
            float n1 = sin(vTerrainWorldXZ.x * 0.16) * cos(vTerrainWorldXZ.y * 0.15);
            float n2 = sin((vTerrainWorldXZ.x - vTerrainWorldXZ.y) * 0.085);
            float n3 = cos((vTerrainWorldXZ.x + vTerrainWorldXZ.y) * 0.038);
            float organic = clamp(0.5 + n1 * 0.3 + n2 * 0.22 + n3 * 0.14, 0.0, 1.0);
            vec3 grassCol = mix(grassFine, grassMacro, 0.34);
            vec3 dirtCol = mix(dirtFine, dirtMacro, 0.34);
            float edgeDist = max(abs(vTerrainWorldXZ.x) - (uTerrainHalf.x + 1.0), abs(vTerrainWorldXZ.y) - (uTerrainHalf.y + 1.0));
            float outerMix = smoothstep(0.0, 4.2, edgeDist);
            float slopeRock = smoothstep(0.94, 0.72, vTerrainNormalY) * smoothstep(2.0, 7.0, edgeDist);

            if (uMapMode < 0.5) {
              // Arena: Realistic packed dirt & earthy soil ground with subtle stone spawn pads & slope rock
              vec3 richDirt = dirtCol * mix(0.84, 1.12, organic);
              float trail = 1.0 - smoothstep(3.4, 7.2, abs(vTerrainWorldXZ.x));
              vec3 dirtGround = mix(richDirt, dirtCol * 0.92, trail * 0.45);
              float spawnPad = step(23.5, abs(vTerrainWorldXZ.y)) * (1.0 - smoothstep(7.5, 9.5, abs(vTerrainWorldXZ.x)));
              vec3 arenaCol = mix(dirtGround, diffuseColor.rgb, spawnPad * 0.72);
              vec3 outerEarth = mix(richDirt * 0.94, rockCol * 0.92, slopeRock * 0.78);
              diffuseColor.rgb = mix(arenaCol, outerEarth, outerMix);
            } else if (uMapMode < 1.5) {
              // Construction: Lush natural grass ground with macro turf variation & slope rock outcrops
              vec3 lushGrass = mix(grassCol, grassCol * vec3(0.86, 0.98, 0.82), organic);
              float pathMask = smoothstep(0.76, 0.98, organic) * 0.24;
              vec3 grassGround = mix(lushGrass, dirtCol, pathMask);
              float deckPad = smoothstep(9.5, 11.5, abs(vTerrainWorldXZ.x)) * (1.0 - smoothstep(17.0, 19.0, abs(vTerrainWorldXZ.x))) * (1.0 - smoothstep(11.5, 14.5, abs(vTerrainWorldXZ.y)));
              vec3 constrCol = mix(grassGround, diffuseColor.rgb, deckPad * 0.75);
              vec3 outerTurf = mix(lushGrass, rockCol * 0.92, slopeRock * 0.74);
              diffuseColor.rgb = mix(constrCol, outerTurf, outerMix);
            } else if (uMapMode < 2.5) {
              // Splash: Narrow stone coping rim around pool transitioning to warm packed dirt ground
              float dirtMask = smoothstep(14.1, 15.6, max(abs(vTerrainWorldXZ.x), abs(vTerrainWorldXZ.y)));
              vec3 sandyDirt = dirtCol * vec3(1.14, 1.04, 0.9) * mix(0.88, 1.08, organic);
              vec3 outerSand = mix(sandyDirt, rockCol * vec3(1.06, 0.98, 0.88), slopeRock * 0.72);
              diffuseColor.rgb = mix(diffuseColor.rgb, mix(sandyDirt, outerSand, outerMix), max(dirtMask, outerMix));
            } else {
              // Docks: Natural grass ground across the pier with subtle worn earth patches
              vec3 dockGrass = mix(grassCol, grassCol * vec3(0.84, 0.95, 0.82), organic);
              float wornPatch = smoothstep(0.72, 0.96, organic) * 0.28;
              vec3 dockGround = mix(dockGrass, dirtCol, wornPatch);
              diffuseColor.rgb = mix(dockGround, dockGrass * 0.85, outerMix);
            }
            `
          )
          .replace(
            '#include <roughnessmap_fragment>',
            `
            #include <roughnessmap_fragment>
            roughnessFactor = clamp(roughnessFactor, 0.88, 0.98);
            `
          );
    };
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // Outer sculpted craggy canyon cliff formations + multi-tier pine trees + 3D grass tufts & pebbles
    const spireGeo = new THREE.CylinderGeometry(1.9, 5.6, 22, 10, 6);
    {
      const sPos = spireGeo.attributes.position;
      for (let i = 0; i < sPos.count; i++) {
        const vx = sPos.getX(i);
        const vy = sPos.getY(i);
        const vz = sPos.getZ(i);
        const ang = Math.atan2(vz, vx);
        const j = 1 + Math.sin(ang * 3 + vy * 0.35) * 0.24 + Math.cos(ang * 5 - vy * 0.2) * 0.12;
        sPos.setX(i, vx * j);
        sPos.setZ(i, vz * j);
      }
      spireGeo.computeVertexNormals();
    }
    const spireCount = 38;
    const spireInstanced = new THREE.InstancedMesh(spireGeo, mats.rockMat, spireCount);
    spireInstanced.castShadow = !isSoftwareGl;
    spireInstanced.receiveShadow = true;

    const treeTrunkGeo = new THREE.CylinderGeometry(0.24, 0.42, 4.0, 8);
    const treeTrunkMat = new THREE.MeshStandardMaterial({
      color: 0x7c583c,
      map: barkTexSet.map,
      normalMap: barkTexSet.normalMap,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughnessMap: barkTexSet.roughnessMap,
      roughness: 0.94,
    });
    // Build realistic 3-tier overlapping pine bough geometry (single draw call via InstancedMesh)
    const treeCrownGeo = new THREE.BufferGeometry();
    {
      const tierSpecs: Array<{ r: number; h: number; y: number }> = [
        { r: 2.35, h: 3.4, y: 0.0 },
        { r: 1.85, h: 3.1, y: 1.75 },
        { r: 1.25, h: 2.6, y: 3.35 },
      ];
      const posChunks: Float32Array[] = [];
      const normChunks: Float32Array[] = [];
      let totalVerts = 0;
      for (const t of tierSpecs) {
        const c = new THREE.ConeGeometry(t.r, t.h, 9, 2).toNonIndexed();
        c.translate(0, t.y, 0);
        const p = c.attributes.position as THREE.BufferAttribute;
        for (let k = 0; k < p.count; k++) {
          const px = p.getX(k);
          const py = p.getY(k);
          const pz = p.getZ(k);
          const ang = Math.atan2(pz, px);
          const jag = 1 + Math.sin(ang * 5 + t.y) * 0.12;
          p.setXYZ(k, px * jag, py, pz * jag);
        }
        c.computeVertexNormals();
        posChunks.push(c.attributes.position.array as Float32Array);
        normChunks.push(c.attributes.normal.array as Float32Array);
        totalVerts += p.count;
        c.dispose();
      }
      const mergedPos = new Float32Array(totalVerts * 3);
      const mergedNorm = new Float32Array(totalVerts * 3);
      let off = 0;
      for (let idx = 0; idx < posChunks.length; idx++) {
        mergedPos.set(posChunks[idx], off);
        mergedNorm.set(normChunks[idx], off);
        off += posChunks[idx].length;
      }
      treeCrownGeo.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
      treeCrownGeo.setAttribute('normal', new THREE.BufferAttribute(mergedNorm, 3));
    }
    const treeCrownMat = new THREE.MeshStandardMaterial({
      color: 0x166534,
      roughness: 0.94,
      metalness: 0,
      envMapIntensity: 0,
      flatShading: true,
    });
    const treeCount = 64;
    const treeTrunkInst = new THREE.InstancedMesh(treeTrunkGeo, treeTrunkMat, treeCount);
    const treeCrownInst = new THREE.InstancedMesh(treeCrownGeo, treeCrownMat, treeCount);
    treeTrunkInst.castShadow = !isSoftwareGl;
    treeTrunkInst.receiveShadow = true;
    treeCrownInst.castShadow = !isSoftwareGl;
    treeCrownInst.receiveShadow = true;

    // 3D Crossed Grass Blade Tuft Geometry (wind-swaying InstancedMesh)
    const grassTuftGeo = new THREE.BufferGeometry();
    {
      const positions: number[] = [];
      const normals: number[] = [];
      const angles = [0, Math.PI / 3, (2 * Math.PI) / 3];
      for (const a of angles) {
        const dx = Math.cos(a) * 0.14;
        const dz = Math.sin(a) * 0.14;
        const tipX = Math.cos(a + 0.35) * 0.05;
        const tipZ = Math.sin(a + 0.35) * 0.05;
        positions.push(-dx, 0, -dz, dx, 0, dz, tipX, 0.28, tipZ);
        normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      }
      grassTuftGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      grassTuftGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    }
    const grassTimeUniform = { value: 0 };
    const grassTuftMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.94,
      metalness: 0,
      envMapIntensity: 0,
      side: THREE.DoubleSide,
    });
    grassTuftMat.onBeforeCompile = (shader) => {
      shader.uniforms.uGrassTime = grassTimeUniform;
      shader.vertexShader =
        `uniform float uGrassTime;\n` +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          float tipMask = clamp(position.y / 0.28, 0.0, 1.0);
          float gx = 0.0;
          float gz = 0.0;
          #ifdef USE_INSTANCING
            gx = instanceMatrix[3][0];
            gz = instanceMatrix[3][2];
          #endif
          transformed.x += sin(uGrassTime * 2.4 + gx * 0.45 + gz * 0.38) * 0.065 * tipMask;
          transformed.z += cos(uGrassTime * 1.9 + gz * 0.52) * 0.035 * tipMask;
          `
        );
    };
    const grassCount = 560;
    const grassInstanced = new THREE.InstancedMesh(grassTuftGeo, grassTuftMat, grassCount);
    grassInstanced.receiveShadow = true;

    const pebbleGeo = new THREE.DodecahedronGeometry(0.14, 0);
    const pebbleMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.96,
      metalness: 0,
      envMapIntensity: 0,
      flatShading: true,
    });
    const pebbleCount = 190;
    const pebbleInstanced = new THREE.InstancedMesh(pebbleGeo, pebbleMat, pebbleCount);
    pebbleInstanced.receiveShadow = true;

    const isClearGroundSpot = (mapId: MapId, x: number, z: number) => {
      const absX = Math.abs(x);
      const absZ = Math.abs(z);
      if (mapId === 'arena' && absX < 13.6 && absZ < 6.2) return false;
      if (mapId === 'construction' && ((absX >= 9.6 && absX <= 18.4 && absZ <= 19.6) || (absX <= 11.0 && absZ <= 3.6))) {
        return false;
      }
      if (mapId === 'splash' && absX < 18.2 && absZ < 18.2) return false;
      if (mapId === 'docks' && absX >= 15.2 && absX <= 24.8 && absZ <= 17.2) return false;
      const boxes = getMapBoxes(mapId);
      for (const b of boxes) {
        if (Math.abs(x - b.x) < b.w / 2 + 0.85 && Math.abs(z - b.z) < b.d / 2 + 0.85) return false;
      }
      return true;
    };

    const updateSpires = (mapId: MapId) => {
      const spec = ARENA_MAPS[mapId];
      for (let i = 0; i < spireCount; i++) {
        const a = (i / spireCount) * Math.PI * 2;
        const r = 54 + ((i * 13) % 24);
        const sx = Math.cos(a) * r;
        const sz = Math.sin(a) * r;
        const sy = getMapFloorHeightAt(mapId, sx, sz) + 4.5;
        const scaleXZ = 0.85 + ((i * 17) % 45) / 100;
        const scaleY = 0.65 + ((i * 23) % 90) / 100;
        _scaleVec.set(scaleXZ, scaleY, scaleXZ);
        _quat.setFromEuler(new THREE.Euler(0, a * 1.7, 0));
        _v1.set(sx, sy, sz);
        _mat4.compose(_v1, _quat, _scaleVec);
        spireInstanced.setMatrixAt(i, _mat4);
        const s = 0.82 + ((i * 11) % 24) / 100;
        _tintColor.setRGB(s * 0.88, s * 0.92, s);
        spireInstanced.setColorAt(i, _tintColor);
      }
      spireInstanced.instanceMatrix.needsUpdate = true;
      if (spireInstanced.instanceColor) spireInstanced.instanceColor.needsUpdate = true;
      spireInstanced.computeBoundingSphere();
      spireInstanced.visible = mapId !== 'docks';

      const showTrees = mapId !== 'docks';
      treeTrunkInst.visible = showTrees;
      treeCrownInst.visible = showTrees;
      if (showTrees) {
        for (let i = 0; i < treeCount; i++) {
          const a = (i / treeCount) * Math.PI * 2 + (i % 3) * 0.08;
          const r = 42 + ((i * 19) % 28);
          const tx = Math.cos(a) * r;
          const tz = Math.sin(a) * r;
          const baseH = getMapFloorHeightAt(mapId, tx, tz);
          const sc = 0.8 + ((i * 13) % 45) / 100;
          _scaleVec.set(sc, sc, sc);
          _quat.setFromEuler(new THREE.Euler(0, a, 0));
          _v1.set(tx, baseH + 1.8 * sc, tz);
          _mat4.compose(_v1, _quat, _scaleVec);
          treeTrunkInst.setMatrixAt(i, _mat4);

          _v1.set(tx, baseH + 5.8 * sc, tz);
          _mat4.compose(_v1, _quat, _scaleVec);
          treeCrownInst.setMatrixAt(i, _mat4);

          const gShade = 0.78 + ((i * 7) % 30) / 100;
          _tintColor.setRGB(gShade * 0.75, gShade, gShade * 0.72);
          treeCrownInst.setColorAt(i, _tintColor);
        }
        treeTrunkInst.instanceMatrix.needsUpdate = true;
        treeCrownInst.instanceMatrix.needsUpdate = true;
        if (treeCrownInst.instanceColor) treeCrownInst.instanceColor.needsUpdate = true;
        treeTrunkInst.computeBoundingSphere();
        treeCrownInst.computeBoundingSphere();
      }

      // Scatter 3D wind-swaying grass blade tufts on grass maps (Construction & Docks)
      const showGrass = mapId === 'construction' || mapId === 'docks';
      grassInstanced.visible = showGrass;
      if (showGrass) {
        let placed = 0;
        for (let i = 0; i < grassCount * 3 && placed < grassCount; i++) {
          const h1 = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
          const h2 = Math.abs(Math.sin(i * 78.233 + 1.7) * 43758.5453) % 1;
          const h3 = Math.abs(Math.sin(i * 45.164 + 3.1) * 43758.5453) % 1;
          const gx = (h1 * 2 - 1) * (spec.halfX + (mapId === 'docks' ? -0.8 : 14));
          const gz = (h2 * 2 - 1) * (spec.halfZ + (mapId === 'docks' ? -0.8 : 14));
          const insideWalls = Math.abs(gx) <= spec.halfX - 0.8 && Math.abs(gz) <= spec.halfZ - 0.8;
          if (mapId === 'docks' && !insideWalls) continue;
          const onWallStrip = !insideWalls && Math.abs(gx) <= spec.halfX + 3.5 && Math.abs(gz) <= spec.halfZ + 3.5;
          if (onWallStrip) continue;
          if (insideWalls && !isClearGroundSpot(mapId, gx, gz)) continue;

          const gy = getMapFloorHeightAt(mapId, gx, gz);
          const scXZ = 0.85 + h3 * 0.75;
          const scY = 0.78 + h1 * 0.55;
          _scaleVec.set(scXZ, scY, scXZ);
          _quat.setFromEuler(new THREE.Euler(0, h2 * Math.PI * 2, 0));
          _v1.set(gx, gy, gz);
          _mat4.compose(_v1, _quat, _scaleVec);
          grassInstanced.setMatrixAt(placed, _mat4);
          const gTint = 0.74 + h3 * 0.34;
          _tintColor.setRGB(0.26 * gTint, 0.48 * gTint, 0.16 * gTint);
          grassInstanced.setColorAt(placed, _tintColor);
          placed += 1;
        }
        for (let k = placed; k < grassCount; k++) {
          _scaleVec.set(0, 0, 0);
          _mat4.compose(_v1.set(0, -100, 0), _quat, _scaleVec);
          grassInstanced.setMatrixAt(k, _mat4);
        }
        grassInstanced.instanceMatrix.needsUpdate = true;
        if (grassInstanced.instanceColor) grassInstanced.instanceColor.needsUpdate = true;
        grassInstanced.computeBoundingSphere();
      }

      // Scatter 3D low-profile pebbles & stones along dirt paths and field edges
      let pPlaced = 0;
      for (let i = 0; i < pebbleCount * 3 && pPlaced < pebbleCount; i++) {
        const h1 = Math.abs(Math.sin(i * 93.17 + 4.2) * 43758.5453) % 1;
        const h2 = Math.abs(Math.sin(i * 31.73 + 8.9) * 43758.5453) % 1;
        const h3 = Math.abs(Math.sin(i * 61.41 + 2.5) * 43758.5453) % 1;
        const px = (h1 * 2 - 1) * (spec.halfX + (mapId === 'docks' ? -0.8 : 6));
        const pz = (h2 * 2 - 1) * (spec.halfZ + (mapId === 'docks' ? -0.8 : 6));
        const insideWalls = Math.abs(px) <= spec.halfX - 0.8 && Math.abs(pz) <= spec.halfZ - 0.8;
        if (mapId === 'docks' && !insideWalls) continue;
        if (insideWalls && !isClearGroundSpot(mapId, px, pz)) continue;
        if (!insideWalls && Math.abs(px) <= spec.halfX + 2.5 && Math.abs(pz) <= spec.halfZ + 2.5) continue;
        const py = getMapFloorHeightAt(mapId, px, pz) + 0.02;
        const pScale = 0.55 + h3 * 0.9;
        _scaleVec.set(pScale, pScale * 0.48, pScale * 0.85);
        _quat.setFromEuler(new THREE.Euler(h1 * 0.5, h2 * Math.PI * 2, h3 * 0.5));
        _v1.set(px, py, pz);
        _mat4.compose(_v1, _quat, _scaleVec);
        pebbleInstanced.setMatrixAt(pPlaced, _mat4);
        const shade = 0.36 + h1 * 0.22;
        _tintColor.setRGB(shade, shade * 0.94, shade * 0.86);
        pebbleInstanced.setColorAt(pPlaced, _tintColor);
        pPlaced += 1;
      }
      for (let k = pPlaced; k < pebbleCount; k++) {
        _scaleVec.set(0, 0, 0);
        _mat4.compose(_v1.set(0, -100, 0), _quat, _scaleVec);
        pebbleInstanced.setMatrixAt(k, _mat4);
      }
      pebbleInstanced.instanceMatrix.needsUpdate = true;
      if (pebbleInstanced.instanceColor) pebbleInstanced.instanceColor.needsUpdate = true;
      pebbleInstanced.computeBoundingSphere();
    };
    updateSpires(currentMapId);
    scene.add(spireInstanced, treeTrunkInst, treeCrownInst, grassInstanced, pebbleInstanced);

    const disposeGroup = (group: THREE.Group) => {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => {
              if (!sharedMatSet.has(m)) m.dispose();
            });
          } else if (obj.material && !sharedMatSet.has(obj.material)) {
            obj.material.dispose();
          }
        }
      });
    };

    const disposeTextureSet = (t: { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture }) => {
      t.map.dispose();
      t.normalMap.dispose();
      t.roughnessMap.dispose();
    };

    // Active Map Structures
    let arenaGroup = buildMapEnvironment(currentMapId, mats, shadowTex, floorMarkingsTex);
    scene.add(arenaGroup);

    const rebuildMap = (mapId: MapId) => {
      if (currentMapId === mapId) return;
      currentMapId = mapId;
      const spec = ARENA_MAPS[mapId];

      (scene.background as THREE.Color).setHex(spec.skyColor);
      fog.color.setHex(spec.skyColor);
      fog.density = spec.fogDensity;
      hemi.color.setHex(spec.hemiSky);
      hemi.groundColor.setHex(spec.hemiGround);
      sun.color.setHex(spec.sunColor);
      sun.intensity = spec.sunIntensity;

      const oldSky = skyTex;
      const [nz, nh, ns, nNight] = getSkyColorsForMap(mapId);
      skyTex = createSkyDomeTexture(nz, nh, ns, nNight);
      skyMat.map = skyTex;
      skyMat.needsUpdate = true;
      oldSky.dispose();

      const oldFloor = floorTexSet;
      const oldMarkings = floorMarkingsTex;
      const oldA = containerASet;
      const oldB = containerBSet;
      const oldN = neutralSet;

      floorTexSet = createTerrainTextureSet(
        maxAniso,
        spec.floorBaseHex,
        spec.floorAltHex,
        spec.floorLineHex,
        26,
        mapId
      );
      floorMarkingsTex = createArenaFloorMarkingsTexture(mapId, maxAniso);
      terrainUniforms.uTerrainHalf.value.set(spec.halfX, spec.halfZ);
      terrainUniforms.uMapMode.value = getMapShaderMode(mapId);
      containerASet = createContainerTextureSet(spec.containerA[0], spec.containerA[1], maxAniso, 'RVL-A1');
      containerBSet = createContainerTextureSet(spec.containerB[0], spec.containerB[1], maxAniso, 'RVL-B2');
      neutralSet = createContainerTextureSet(
        spec.containerNeutral[0],
        spec.containerNeutral[1],
        maxAniso,
        'SEC-09'
      );
      dustMat.color.setHex(getDustColorForMap(mapId));

      terrainMat.map = floorTexSet.map;
      terrainMat.normalMap = getFloorNormalForMap(mapId);
      terrainMat.roughnessMap = getFloorRoughnessForMap(mapId);
      terrainMat.roughness = 0.96;
      terrainMat.metalness = 0;
      terrainMat.envMapIntensity = 0;
      terrainMat.needsUpdate = true;

      mats.containerA.map = containerASet.map;
      mats.containerA.normalMap = containerASet.normalMap;
      mats.containerA.roughnessMap = containerASet.roughnessMap;
      mats.containerA.needsUpdate = true;

      mats.containerB.map = containerBSet.map;
      mats.containerB.normalMap = containerBSet.normalMap;
      mats.containerB.roughnessMap = containerBSet.roughnessMap;
      mats.containerB.needsUpdate = true;

      mats.containerNeutral.map = neutralSet.map;
      mats.containerNeutral.normalMap = neutralSet.normalMap;
      mats.containerNeutral.roughnessMap = neutralSet.roughnessMap;
      mats.containerNeutral.needsUpdate = true;

      disposeTextureSet(oldFloor);
      oldMarkings.dispose();
      disposeTextureSet(oldA);
      disposeTextureSet(oldB);
      disposeTextureSet(oldN);

      updateTerrainGeometry(mapId);
      updateSpires(mapId);

      scene.remove(arenaGroup);
      disposeGroup(arenaGroup);
      arenaGroup = buildMapEnvironment(mapId, mats, shadowTex, floorMarkingsTex);
      scene.add(arenaGroup);
    };

    // 3D Collectible Knowledge Orb in Center Arena (matte non-shiny crystal)
    const getOrbBaseY = (mapId: MapId) =>
      mapId === 'docks' ? 4.75 : getMapFloorHeightAt(mapId, 0, 0) + 1.45;
    const orbGeo = new THREE.OctahedronGeometry(0.42, 0);
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.88,
      metalness: 0,
      envMapIntensity: 0,
    });
    const orbRingGeo = new THREE.TorusGeometry(0.68, 0.045, 8, 24);
    const orbRingMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.88,
      metalness: 0,
      envMapIntensity: 0,
    });
    const orbRing2Geo = new THREE.TorusGeometry(0.86, 0.025, 8, 28);
    const orbRing2Mat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.88,
      metalness: 0,
      envMapIntensity: 0,
    });
    const knowledgeOrbGroup = new THREE.Group();
    const orbCoreMesh = new THREE.Mesh(orbGeo, orbMat);
    const orbRingMesh = new THREE.Mesh(orbRingGeo, orbRingMat);
    const orbRing2Mesh = new THREE.Mesh(orbRing2Geo, orbRing2Mat);
    knowledgeOrbGroup.add(orbCoreMesh, orbRingMesh, orbRing2Mesh);
    knowledgeOrbGroup.position.set(0, getOrbBaseY(currentMapId), 0);
    scene.add(knowledgeOrbGroup);

    // Team Bot Pool (up to 4 AI Allies + 5 Enemy Rivals for 1v1 through 5v5)
    interface BotEntity {
      id: string;
      name: string;
      team: TeamSide;
      rig: RivalCharacterRig;
      pos: THREE.Vector3;
      vel: THREE.Vector3;
      yaw: number;
      hp: number;
      maxHp: number;
      active: boolean;
      alive: boolean;
      grounded: boolean;
      fireTimer: number;
      strafeTimer: number;
      strafeDir: number;
      flankSign: number;
      jumpTimer: number;
      stunTimer: number;
      walkPhase: number;
      flinchTimer: number;
      muzzleFlashTimer: number;
      knockedDown: boolean;
      knockdownProgress: number;
    }

    const ALLY_BOT_NAMES = ['Vanguard', 'Specter', 'Kestrel', 'Atlas'];
    const ENEMY_BOT_NAMES = ['Rival Prime', 'Viper', 'Phantom', 'Reaper', 'Titan'];
    const bots: BotEntity[] = [];

    ALLY_BOT_NAMES.forEach((name, idx) => {
      const id = `ally-${idx + 1}`;
      const rig = buildRivalCharacter(mats, shadowTex, 'ally', id);
      rig.root.visible = false;
      scene.add(rig.root);
      bots.push({
        id,
        name,
        team: 'ally',
        rig,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        yaw: Math.PI,
        hp: MAX_HP,
        maxHp: MAX_HP,
        active: false,
        alive: false,
        grounded: true,
        fireTimer: 0.7 + idx * 0.15,
        strafeTimer: 1.0 + idx * 0.25,
        strafeDir: idx % 2 === 0 ? 1 : -1,
        flankSign: idx % 2 === 0 ? -1 : 1,
        jumpTimer: 2.0 + idx * 0.6,
        stunTimer: 0,
        walkPhase: idx * 0.9,
        flinchTimer: 0,
        muzzleFlashTimer: 0,
        knockedDown: false,
        knockdownProgress: 0,
      });
    });

    ENEMY_BOT_NAMES.forEach((name, idx) => {
      const id = `enemy-${idx}`;
      const rig = buildRivalCharacter(mats, shadowTex, 'enemy', id);
      rig.root.visible = idx === 0;
      scene.add(rig.root);
      bots.push({
        id,
        name,
        team: 'enemy',
        rig,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        yaw: 0,
        hp: MAX_HP,
        maxHp: MAX_HP,
        active: idx === 0,
        alive: idx === 0,
        grounded: true,
        fireTimer: 0.8 + idx * 0.16,
        strafeTimer: 1.1 + idx * 0.22,
        strafeDir: idx % 2 === 0 ? 1 : -1,
        flankSign: idx === 0 ? 0 : idx % 2 === 1 ? -1 : 1,
        jumpTimer: 1.8 + idx * 0.5,
        stunTimer: 0,
        walkPhase: idx * 1.1,
        flinchTimer: 0,
        muzzleFlashTimer: 0,
        knockedDown: false,
        knockdownProgress: 0,
      });
    });

    // First-Person Viewmodel Rig
    let viewmodel: ViewmodelRig = buildRivalsViewmodel(
      loadoutRef.current,
      mats,
      weaponBuildsRef.current
    );
    camera.add(viewmodel.root);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // --- MATCH & SIMULATION STATE ---
    const player = {
      pos: new THREE.Vector3(0, 1.75, 29),
      vel: new THREE.Vector3(),
      yaw: 0,
      pitch: 0,
      grounded: true,
      alive: true,
      hp: MAX_HP,
      eyeHeight: 1.75,
      sliding: false,
      slideTimer: 0,
      slideCooldown: 0,
      slideDir: new THREE.Vector3(),
      ads: false,
      fov: 76,
    };

    const match = {
      playerRounds: 0,
      rivalRounds: 0,
      roundNumber: 1,
      roundTimer: 90,
      roundEndTimer: 0,
      roundBanner: null as string | null,
      playerMaxHp: MAX_HP,
      activePerk: null as RoundOverchargePerk | null,
      orbActive: true,
      orbRespawnTimer: 0,
      factToast: null as { subjectLabel: string; fact: string } | null,
      factToastTimer: 0,
      activeSlot: 0 as SlotIndex,
      primaryAmmo: PRIMARY_WEAPONS[loadoutRef.current.primary].magSize,
      secondaryAmmo: SECONDARY_WEAPONS[loadoutRef.current.secondary].magSize,
      utilityCharges: UTILITY_ITEMS[loadoutRef.current.utility].charges,
      fireCooldown: 0,
      burstQueue: 0,
      burstTimer: 0,
      reloading: false,
      reloadTimer: 0,
      recoil: 0,
      camRecoilPitch: 0,
      camRecoilYaw: 0,
      camTilt: 0,
      swayX: 0,
      swayY: 0,
      landDip: 0,
      muzzleFlashTimer: 0,
      boltKick: 0,
      meleeSwingTimer: 0,
      bobPhase: 0,
      lastStepPhase: 0,
      damageFlash: 0,
      aberrationPulse: 0,
      hitMarker: 'none' as 'none' | 'hit' | 'headshot',
      hitMarkerTimer: 0,
      killFeed: [] as KillFeedEntry[],
      totalDamageDealt: 0,
      kills: 0,
      headshots: 0,
      shotsFired: 0,
      shotsHit: 0,
      pointerLocked: false,
      mouseDown: false,
      rightDown: false,
      nextPopupId: 1,
    };

    const popups: Array<DamagePopup & { worldPos: THREE.Vector3; age: number }> = [];
    const tracers: TracerEntity[] = [];
    const thrownItems: ThrownEntity[] = [];
    const sparks: SparkEntity[] = [];
    const debrisEntities: Array<{
      mesh: THREE.Mesh;
      vel: THREE.Vector3;
      rotVel: THREE.Vector3;
      life: number;
      maxLife: number;
    }> = [];
    const shells: ShellEntity[] = [];
    const impacts: ImpactEntity[] = [];
    const smokes: SmokeEntity[] = [];
    const shockwaves: ShockwaveEntity[] = [];
    const keys: Record<string, boolean> = {};

    const raycaster = new THREE.Raycaster();
    const sparkGeo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
    const debrisGeo = new THREE.BoxGeometry(0.068, 0.044, 0.056);
    const shellGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.048, 6);
    const impactGeo = new THREE.CircleGeometry(0.09, 8);
    const shockwaveGeo = new THREE.RingGeometry(0.35, 0.72, 24);
    shockwaveGeo.rotateX(-Math.PI / 2);
    const impactMat = new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.85,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      depthWrite: false,
    });
    const grenadeGeo = new THREE.SphereGeometry(0.18, 10, 10);

    // Tactical ADS laser target dot (projected onto surface when aiming)
    const adsLaserGeo = new THREE.SphereGeometry(0.032, 8, 8);
    const adsLaserMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    const adsLaserDot = new THREE.Mesh(adsLaserGeo, adsLaserMat);
    adsLaserDot.visible = false;
    scene.add(adsLaserDot);

    const clearDynamicObjects = () => {
      for (const t of tracers) {
        scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        (t.mesh.material as THREE.Material).dispose();
      }
      tracers.length = 0;
      for (const g of thrownItems) {
        scene.remove(g.mesh);
        (g.mesh.material as THREE.Material).dispose();
      }
      thrownItems.length = 0;
      for (const s of sparks) {
        scene.remove(s.mesh);
        (s.mesh.material as THREE.Material).dispose();
      }
      sparks.length = 0;
      for (const d of debrisEntities) {
        scene.remove(d.mesh);
      }
      debrisEntities.length = 0;
      for (const sh of shells) {
        scene.remove(sh.mesh);
      }
      shells.length = 0;
      for (const imp of impacts) {
        scene.remove(imp.mesh);
      }
      impacts.length = 0;
      for (const sm of smokes) {
        scene.remove(sm.sprite);
        sm.sprite.material.dispose();
      }
      smokes.length = 0;
      for (const sw of shockwaves) {
        scene.remove(sw.mesh);
        (sw.mesh.material as THREE.Material).dispose();
      }
      shockwaves.length = 0;
      adsLaserDot.visible = false;
      explosionLight.intensity = 0;
      popups.length = 0;
    };

    const spawnSmokePuff = (
      pos: THREE.Vector3,
      colorHex: number,
      startScale: number,
      endScale: number,
      maxLife: number,
      baseOpacity = 0.42,
      upwardSpeed = 1.4
    ) => {
      if (smokes.length > 48) {
        const oldest = smokes.shift()!;
        scene.remove(oldest.sprite);
        oldest.sprite.material.dispose();
      }
      const mat = new THREE.SpriteMaterial({
        map: particleTex,
        color: colorHex,
        transparent: true,
        opacity: baseOpacity,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.copy(pos);
      sprite.scale.setScalar(startScale);
      scene.add(sprite);
      smokes.push({
        sprite,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 1.1,
          upwardSpeed + Math.random() * 0.9,
          (Math.random() - 0.5) * 1.1
        ),
        life: 0,
        maxLife,
        startScale,
        endScale,
        baseOpacity,
      });
    };

    const spawnShockwave = (pos: THREE.Vector3, colorHex: number, maxScale = 9.5) => {
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(shockwaveGeo, mat);
      mesh.position.copy(pos);
      mesh.position.y += 0.08;
      mesh.scale.setScalar(0.35);
      scene.add(mesh);
      shockwaves.push({ mesh, life: 0, maxLife: 0.38, maxScale });
    };

    const spawnShellCasing = () => {
      if (shells.length > 36) {
        const oldest = shells.shift()!;
        scene.remove(oldest.mesh);
      }
      viewmodel.ejectionPoint.getWorldPosition(_v1);
      const mesh = new THREE.Mesh(shellGeo, mats.brass);
      mesh.position.copy(_v1);
      scene.add(mesh);

      _right.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
      const vel = _right
        .clone()
        .multiplyScalar(2.4 + Math.random() * 1.4)
        .add(new THREE.Vector3(0, 2.2 + Math.random() * 1.1, 0))
        .addScaledVector(player.vel, 0.35);

      shells.push({
        mesh,
        vel,
        rotVel: new THREE.Vector3(14 + Math.random() * 10, 12, 18),
        life: 0,
        bounced: false,
      });
    };

    const spawnDebris = (pos: THREE.Vector3, mat: THREE.Material, count: number) => {
      for (let i = 0; i < count; i++) {
        if (debrisEntities.length >= 42) {
          const oldest = debrisEntities.shift()!;
          scene.remove(oldest.mesh);
        }
        const m = new THREE.Mesh(debrisGeo, mat);
        m.position.copy(pos);
        m.scale.setScalar(0.75 + Math.random() * 0.7);
        scene.add(m);
        const th = Math.random() * Math.PI * 2;
        const spd = 2.2 + Math.random() * 4.5;
        debrisEntities.push({
          mesh: m,
          vel: new THREE.Vector3(Math.cos(th) * spd, 2.4 + Math.random() * 3.8, Math.sin(th) * spd),
          rotVel: new THREE.Vector3(
            (Math.random() - 0.5) * 18,
            (Math.random() - 0.5) * 18,
            (Math.random() - 0.5) * 18
          ),
          life: 0,
          maxLife: 1.05 + Math.random() * 0.45,
        });
      }
    };

    const spawnImpactMark = (pos: THREE.Vector3, normal: THREE.Vector3) => {
      if (impacts.length > 36) {
        const oldest = impacts.shift()!;
        scene.remove(oldest.mesh);
      }
      const m = new THREE.Mesh(impactGeo, impactMat);
      m.position.copy(pos).addScaledVector(normal, 0.02);
      m.lookAt(_v1.copy(pos).add(normal));
      scene.add(m);
      impacts.push({ mesh: m, life: 0, maxLife: 7.5 });
    };

    const spawnSparks = (pos: THREE.Vector3, colorHex: number, count: number) => {
      for (let i = 0; i < count; i++) {
        if (sparks.length > 110) break;
        const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: colorHex }));
        m.position.copy(pos);
        scene.add(m);
        const spd = 3 + Math.random() * 8;
        const th = Math.random() * Math.PI * 2;
        const ph = (Math.random() - 0.2) * Math.PI;
        sparks.push({
          mesh: m,
          vel: new THREE.Vector3(
            Math.cos(th) * Math.cos(ph) * spd,
            Math.abs(Math.sin(ph)) * spd + 2,
            Math.sin(th) * Math.cos(ph) * spd
          ),
          life: 0,
          maxLife: 0.35 + Math.random() * 0.2,
        });
      }
    };

    const spawnMeleeSlashArc = (origin: THREE.Vector3, dir: THREE.Vector3, colorHex: number) => {
      const arcGeo = new THREE.RingGeometry(0.65, 1.35, 18, 1, -Math.PI * 0.35, Math.PI * 0.7);
      const arcMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const arcMesh = new THREE.Mesh(arcGeo, arcMat);
      arcMesh.position.copy(origin).addScaledVector(dir, 1.15);
      arcMesh.lookAt(_v2.copy(origin).addScaledVector(dir, 4.0));
      arcMesh.rotateX(Math.PI / 2 - 0.22);
      arcMesh.rotateZ((Math.random() - 0.5) * 0.6);
      scene.add(arcMesh);
      shockwaves.push({ mesh: arcMesh, life: 0, maxLife: 0.24, maxScale: 1.5 });
    };

    const spawnTracer = (from: THREE.Vector3, to: THREE.Vector3, colorHex: number, radius = 0.03) => {
      const dist = from.distanceTo(to);
      if (dist < 0.2) return;
      const geo = new THREE.CylinderGeometry(radius * 0.42, radius * 1.15, dist, 6);
      geo.rotateX(Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(from).lerp(to, 0.5);
      mesh.lookAt(to);
      scene.add(mesh);
      tracers.push({ mesh, life: 0, maxLife: 0.12 });
    };

    const addDamagePopup = (worldPos: THREE.Vector3, amount: number, crit: boolean) => {
      popups.push({
        id: match.nextPopupId++,
        amount,
        crit,
        x: 0.5,
        y: 0.4,
        worldPos: worldPos.clone(),
        age: 0,
      });
    };

    const resolveArenaCollision = (pos: THREE.Vector3, radius: number, entityHeight: number) => {
      const boxes = getMapBoxes(mapRef.current);
      const spec = ARENA_MAPS[mapRef.current];
      for (const box of boxes) {
        if (entityHeight > box.h + 0.15) continue;
        const minX = box.x - box.w / 2 - radius;
        const maxX = box.x + box.w / 2 + radius;
        const minZ = box.z - box.d / 2 - radius;
        const maxZ = box.z + box.d / 2 + radius;
        if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) {
          const dL = Math.abs(pos.x - minX);
          const dR = Math.abs(maxX - pos.x);
          const dF = Math.abs(pos.z - minZ);
          const dB = Math.abs(maxZ - pos.z);
          const m = Math.min(dL, dR, dF, dB);
          if (m === dL) pos.x = minX;
          else if (m === dR) pos.x = maxX;
          else if (m === dF) pos.z = minZ;
          else pos.z = maxZ;
        }
      }
      pos.x = THREE.MathUtils.clamp(pos.x, -spec.halfX + radius, spec.halfX - radius);
      pos.z = THREE.MathUtils.clamp(pos.z, -spec.halfZ + radius, spec.halfZ - radius);
    };

    // Ray-AABB slab test against cover blocks so bullets cannot pass through containers
    const getCoverHitDistance = (origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): number => {
      let closest = maxDist;
      const boxes = getMapBoxes(mapRef.current);
      for (const box of boxes) {
        const minX = box.x - box.w / 2;
        const maxX = box.x + box.w / 2;
        const minY = 0;
        const maxY = box.h;
        const minZ = box.z - box.d / 2;
        const maxZ = box.z + box.d / 2;

        const invX = 1 / (dir.x || 1e-8);
        const invY = 1 / (dir.y || 1e-8);
        const invZ = 1 / (dir.z || 1e-8);

        const t1 = (minX - origin.x) * invX;
        const t2 = (maxX - origin.x) * invX;
        const t3 = (minY - origin.y) * invY;
        const t4 = (maxY - origin.y) * invY;
        const t5 = (minZ - origin.z) * invZ;
        const t6 = (maxZ - origin.z) * invZ;

        const tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4), Math.min(t5, t6));
        const tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4), Math.max(t5, t6));
        if (tmax >= 0 && tmin <= tmax && tmin >= 0 && tmin < closest) {
          closest = tmin;
        }
      }
      return closest;
    };

    const syncAdsState = () => {
      const wantAds =
        gameStateRef.current === 'PLAYING' &&
        player.alive &&
        match.activeSlot <= 1 &&
        Boolean(keys['KeyE'] || match.rightDown);
      if (player.ads !== wantAds) {
        player.ads = wantAds;
        pushHud();
      }
    };

    const selectSlot = (slot: SlotIndex) => {
      if (match.activeSlot === slot) return;
      match.activeSlot = slot;
      match.reloading = false;
      match.reloadTimer = 0;
      match.burstQueue = 0;
      if (slot > 1) player.ads = false;
      else player.ads = Boolean(keys['KeyE'] || match.rightDown);
      viewmodel.slotGroups.forEach((g, idx) => {
        g.visible = idx === slot;
      });
      shooterAudio.playReload();
      pushHud();
    };

    const ALLY_SPAWN_OFFSETS: ReadonlyArray<[number, number]> = [
      [-4.2, -1.2],
      [4.2, -1.2],
      [-8.4, -2.4],
      [8.4, -2.4],
    ];
    const ENEMY_SPAWN_OFFSETS: ReadonlyArray<[number, number]> = [
      [0, 0],
      [-4.2, 1.2],
      [4.2, 1.2],
      [-8.4, 2.4],
      [8.4, 2.4],
    ];

    const resetBotPose = (bot: BotEntity, x: number, z: number, yaw: number) => {
      const y = getMapFloorHeightAt(mapRef.current, x, z);
      bot.pos.set(x, y, z);
      bot.vel.set(0, 0, 0);
      bot.yaw = yaw;
      bot.hp = MAX_HP;
      bot.maxHp = MAX_HP;
      bot.grounded = true;
      bot.active = true;
      bot.alive = true;
      bot.fireTimer = 0.65 + Math.random() * 0.45;
      bot.strafeTimer = 0.8 + Math.random() * 0.9;
      bot.stunTimer = 0;
      bot.flinchTimer = 0;
      bot.muzzleFlashTimer = 0;
      bot.knockedDown = false;
      bot.knockdownProgress = 0;
      bot.rig.bodyGroup.rotation.set(0, 0, 0);
      bot.rig.bodyGroup.position.set(0, 0, 0);
      bot.rig.pelvisGroup.rotation.set(0, 0, 0);
      bot.rig.torsoGroup.rotation.set(0, 0, 0);
      bot.rig.leftLeg.rotation.set(0, 0, 0);
      bot.rig.leftKnee.rotation.set(0, 0, 0);
      bot.rig.leftAnkle.rotation.set(0, 0, 0);
      bot.rig.rightLeg.rotation.set(0, 0, 0);
      bot.rig.rightKnee.rotation.set(0, 0, 0);
      bot.rig.rightAnkle.rotation.set(0, 0, 0);
      bot.rig.leftArm.rotation.set(-0.62, 0.18, 0.14);
      bot.rig.leftElbow.rotation.set(-0.78, 0.28, -0.25);
      bot.rig.rightArm.rotation.set(-0.48, -0.1, -0.06);
      bot.rig.rightElbow.rotation.set(-1.02, 0.08, 0);
      bot.rig.headGroup.rotation.set(0, 0, 0);
      bot.rig.muzzleFlash.visible = false;
      bot.rig.root.position.copy(bot.pos);
      bot.rig.root.rotation.y = yaw;
      bot.rig.root.visible = true;
    };

    const setupRound = (roundNum: number, perk: RoundOverchargePerk | null = null) => {
      clearDynamicObjects();
      const cfg = loadoutRef.current;
      const tSize = teamSizeRef.current;
      const spawnZ = ARENA_MAPS[mapRef.current].spawnZ;

      match.activePerk = perk;
      match.playerMaxHp = MAX_HP + (perk?.bonusHp ?? 0);
      match.orbActive = true;
      match.orbRespawnTimer = 0;
      match.factToast = null;
      match.factToastTimer = 0;
      match.killFeed = [];
      knowledgeOrbGroup.position.set(0, getOrbBaseY(mapRef.current), 0);
      knowledgeOrbGroup.visible = true;

      const pFloor = getMapFloorHeightAt(mapRef.current, 0, spawnZ);
      player.pos.set(0, pFloor + 1.75, spawnZ);
      player.vel.set(0, 0, 0);
      player.yaw = 0;
      player.pitch = 0;
      player.grounded = true;
      player.alive = true;
      player.hp = match.playerMaxHp;
      player.sliding = false;
      player.slideTimer = 0;
      player.ads = false;

      let allyIdx = 0;
      let enemyIdx = 0;
      for (const bot of bots) {
        if (bot.team === 'ally') {
          if (allyIdx < tSize - 1) {
            const [ox, oz] = ALLY_SPAWN_OFFSETS[allyIdx];
            resetBotPose(bot, ox, spawnZ + oz, Math.PI);
          } else {
            bot.active = false;
            bot.alive = false;
            bot.rig.root.visible = false;
          }
          allyIdx += 1;
        } else {
          if (enemyIdx < tSize) {
            const [ox, oz] = ENEMY_SPAWN_OFFSETS[enemyIdx];
            resetBotPose(bot, ox, -spawnZ + oz, 0);
          } else {
            bot.active = false;
            bot.alive = false;
            bot.rig.root.visible = false;
          }
          enemyIdx += 1;
        }
      }

      match.roundNumber = roundNum;
      match.roundTimer = 90;
      match.roundBanner =
        tSize === 1 ? `ROUND ${roundNum} — FIGHT` : `ROUND ${roundNum} · ${tSize}v${tSize} — FIGHT`;
      match.primaryAmmo = resolveGunSpec(
        PRIMARY_WEAPONS[cfg.primary],
        weaponBuildsRef.current[cfg.primary]
      ).magSize;
      match.secondaryAmmo = resolveGunSpec(
        SECONDARY_WEAPONS[cfg.secondary],
        weaponBuildsRef.current[cfg.secondary]
      ).magSize;
      match.utilityCharges =
        resolveUtilitySpec(UTILITY_ITEMS[cfg.utility], weaponBuildsRef.current[cfg.utility])
          .charges + (perk?.extraUtility ?? 0);
      match.reloading = false;
      match.burstQueue = 0;
      match.fireCooldown = 0.25;
      match.camRecoilPitch = 0;
      match.camRecoilYaw = 0;
      match.camTilt = 0;
      match.landDip = 0;
      match.muzzleFlashTimer = 0;
      match.boltKick = 0;
      match.damageFlash = 0;
      match.aberrationPulse = 0;
      match.hitMarker = 'none';
      selectSlot(0);
    };

    const finishRound = (playerWon: boolean, reason: string) => {
      if (gameStateRef.current !== 'PLAYING') return;
      if (playerWon) {
        match.playerRounds += 1;
        match.roundBanner = `ROUND WON · ${reason}`;
      } else {
        match.rivalRounds += 1;
        match.roundBanner = `ROUND LOST · ${reason}`;
      }
      shooterAudio.playRoundEnd(playerWon);

      if (match.playerRounds >= ROUNDS_TO_WIN || match.rivalRounds >= ROUNDS_TO_WIN) {
        const wonMatch = match.playerRounds >= ROUNDS_TO_WIN;
        const updatedCareer = recordMatchResult(wonMatch);
        setCareer(updatedCareer);
        if (document.pointerLockElement) document.exitPointerLock?.();
        setGameState('GAME_OVER');
      } else {
        if (document.pointerLockElement) document.exitPointerLock?.();
        match.roundEndTimer = 3.2;
        setGameState('ROUND_END');
      }
      pushHud();
    };

    const checkTeamEliminationRoundEnd = (lastVictimHeadshot: boolean) => {
      const enemiesRemaining = bots.filter(
        (b) => b.active && b.team === 'enemy' && b.alive
      ).length;
      const alliesRemaining =
        (player.alive ? 1 : 0) +
        bots.filter((b) => b.active && b.team === 'ally' && b.alive).length;

      if (enemiesRemaining === 0) {
        const reason =
          teamSizeRef.current === 1
            ? lastVictimHeadshot
              ? 'Headshot Elimination'
              : 'Rival Eliminated'
            : 'Enemy Squad Eliminated';
        finishRound(true, reason);
      } else if (alliesRemaining === 0) {
        finishRound(
          false,
          teamSizeRef.current === 1 ? 'Eliminated by Rival' : 'Allied Squad Eliminated'
        );
      }
    };

    const damageBot = (
      target: BotEntity,
      dmg: number,
      headshot: boolean,
      hitPoint: THREE.Vector3,
      attackerName: string,
      attackerTeam: TeamSide,
      isPlayerAttacker: boolean
    ) => {
      if (!target.active || !target.alive || target.knockedDown) return;
      const dealt = Math.round(dmg);
      target.hp = Math.max(0, target.hp - dealt);
      target.flinchTimer = 0.16;

      if (isPlayerAttacker) {
        match.totalDamageDealt += dealt;
        if (headshot) match.headshots += 1;
        match.hitMarker = headshot ? 'headshot' : 'hit';
        match.hitMarkerTimer = 0.16;
        shooterAudio.playHitmarker(headshot);
        addDamagePopup(hitPoint, dealt, headshot);
      }

      spawnSparks(
        hitPoint,
        headshot ? 0xfbbf24 : target.team === 'enemy' ? 0xf43f5e : 0x38bdf8,
        headshot ? 11 : 6
      );

      if (target.hp <= 0) {
        target.alive = false;
        target.knockedDown = true;
        target.knockdownProgress = 0;
        target.rig.muzzleFlash.visible = false;
        if (isPlayerAttacker && target.team === 'enemy') {
          match.kills += 1;
        }
        match.killFeed = [
          ...match.killFeed.slice(-3),
          {
            id: match.nextPopupId++,
            killerName: attackerName,
            killerTeam: attackerTeam,
            victimName: target.name,
            victimTeam: target.team,
            headshot,
          },
        ];

        _v1.copy(target.pos);
        _v1.y += 1.4;
        spawnSparks(_v1, target.team === 'enemy' ? 0xf43f5e : 0x38bdf8, 22);
        _v2.copy(target.pos);
        _v2.y += 0.15;
        spawnShockwave(
          _v2,
          headshot ? 0xfbbf24 : target.team === 'enemy' ? 0xf43f5e : 0x38bdf8,
          6.8
        );
        explosionLight.color.setHex(headshot ? 0xfbbf24 : 0xf43f5e);
        explosionLight.position.copy(_v1);
        explosionLight.intensity = 14;
        shooterAudio.playExplosion();
        checkTeamEliminationRoundEnd(headshot);
      }
    };

    const damagePlayer = (dmg: number, headshot: boolean, killerName: string) => {
      if (!player.alive) return;
      player.hp = Math.max(0, player.hp - Math.round(dmg));
      match.damageFlash = 0.75;
      match.camRecoilPitch += 0.025;
      shooterAudio.playPlayerHit();
      if (player.hp <= 0) {
        player.alive = false;
        player.ads = false;
        match.reloading = false;
        match.burstQueue = 0;
        match.killFeed = [
          ...match.killFeed.slice(-3),
          {
            id: match.nextPopupId++,
            killerName,
            killerTeam: 'enemy',
            victimName: 'YOU',
            victimTeam: 'ally',
            headshot,
          },
        ];
        const alliesRemaining = bots.filter(
          (b) => b.active && b.team === 'ally' && b.alive
        ).length;
        if (alliesRemaining === 0) {
          finishRound(
            false,
            teamSizeRef.current === 1 ? 'Eliminated by Rival' : 'Allied Squad Eliminated'
          );
        } else {
          match.roundBanner = 'ELIMINATED · SPECTATING TEAMMATES';
        }
      }
    };

    const fireGunSpec = (spec: typeof PRIMARY_WEAPONS.assault_rifle, clientX?: number, clientY?: number) => {
      if (!player.alive) return;
      const isPrimary = spec.category === 'primary';
      const ammoCount = isPrimary ? match.primaryAmmo : match.secondaryAmmo;
      if (ammoCount <= 0) {
        triggerReload();
        return;
      }

      if (isPrimary) match.primaryAmmo -= 1;
      else match.secondaryAmmo -= 1;

      match.recoil = Math.min(0.24, match.recoil + spec.recoilKick);
      match.camRecoilPitch += spec.recoilKick * 0.42 * (player.ads ? 0.65 : 1);
      match.camRecoilYaw += (Math.random() - 0.5) * spec.recoilKick * 0.22;
      match.boltKick = 0.055;
      match.muzzleFlashTimer = 0.045;
      viewmodel.muzzleFlash.visible = true;
      viewmodel.muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
      const flashScale = spec.id === 'sniper' || spec.id === 'shotgun' ? 1.45 : 0.95;
      viewmodel.muzzleFlash.scale.setScalar(flashScale * (0.85 + Math.random() * 0.35));

      match.shotsFired += 1;
      muzzleLight.intensity = 6.5;
      if (spec.id === 'sniper' || spec.id === 'shotgun') {
        match.aberrationPulse = 0.0042;
      }
      shooterAudio.playGunshot(spec.id);
      if (spec.id !== 'revolver') {
        spawnShellCasing();
      }

      if (!match.pointerLocked && clientX !== undefined && clientY !== undefined) {
        const rect = renderer.domElement.getBoundingClientRect();
        _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      } else {
        _ndc.set(0, 0);
      }

      raycaster.setFromCamera(_ndc, camera);
      const baseDir = raycaster.ray.direction.clone().normalize();
      viewmodel.muzzlePoint.getWorldPosition(_v2);
      if (!player.ads) {
        spawnSmokePuff(_v2, 0xcbd5e1, 0.08, 0.24, 0.28, 0.14, 0.7);
      }

      const spread = player.ads ? spec.adsSpread : spec.spread;
      let hitAny = false;
      const aliveEnemyRoots = bots
        .filter((b) => b.active && b.team === 'enemy' && b.alive && !b.knockedDown && b.rig.root.visible)
        .map((b) => b.rig.root);

      for (let p = 0; p < spec.pellets; p++) {
        _rayDir.copy(baseDir);
        if (spread > 0) {
          _rayDir.x += (Math.random() - 0.5) * spread;
          _rayDir.y += (Math.random() - 0.5) * spread;
          _rayDir.z += (Math.random() - 0.5) * spread;
          _rayDir.normalize();
        }

        const coverDist = getCoverHitDistance(camera.position, _rayDir, 110);
        raycaster.set(camera.position, _rayDir);
        raycaster.far = coverDist;
        const hits =
          aliveEnemyRoots.length > 0 ? raycaster.intersectObjects(aliveEnemyRoots, true) : [];

        if (hits.length > 0) {
          const hit = hits[0];
          const hitBotId = hit.object.userData?.botId as string | undefined;
          const targetBot = bots.find((b) => b.id === hitBotId);
          if (targetBot) {
            const isHead = Boolean(hit.object.userData?.isCritZone);
            const dmg =
              spec.damage *
              (isHead ? spec.headshotMult : 1) *
              (match.activePerk?.damageMult ?? 1);
            damageBot(targetBot, dmg, isHead, hit.point, 'YOU', 'ally', true);
            spawnTracer(_v2, hit.point, spec.color, spec.id === 'sniper' ? 0.045 : 0.022);
            spawnSparks(hit.point, isHead ? 0xfbbf24 : spec.color, isHead ? 9 : 4);
            hitAny = true;
          }
        } else {
          // Check world geometry (floor / platforms / containers) for realistic bullet impact decals, sparks & dust puffs
          const worldHits = raycaster.intersectObjects([arenaGroup, terrainMesh], true);
          raycaster.far = Infinity;
          if (worldHits.length > 0) {
            const wh = worldHits[0];
            const hitTerrain = wh.object === terrainMesh;
            const mapGroundDust =
              mapRef.current === 'arena' || mapRef.current === 'splash' ? 0xb49674 : 0x718061;
            spawnTracer(_v2, wh.point, spec.color, spec.id === 'sniper' ? 0.04 : 0.02);
            spawnSparks(wh.point, hitTerrain ? mapGroundDust : spec.color, hitTerrain ? 3 : 5);
            spawnDebris(wh.point, hitTerrain ? mats.rockMat : mats.concreteMat, hitTerrain ? 4 : 3);
            spawnSmokePuff(
              wh.point,
              hitTerrain ? mapGroundDust : 0xcbd5e1,
              0.24,
              1.05,
              0.45,
              0.3,
              1.6
            );
            if (wh.face) {
              _v1.copy(wh.face.normal).transformDirection(wh.object.matrixWorld);
              spawnImpactMark(wh.point, _v1);
            }
          } else {
            _v3.copy(camera.position).addScaledVector(_rayDir, Math.min(coverDist, 75));
            spawnTracer(_v2, _v3, spec.color, spec.id === 'sniper' ? 0.04 : 0.02);
            if (coverDist < 105) {
              spawnSparks(_v3, spec.color, 4);
            }
          }
        }
        raycaster.far = Infinity;
      }

      if (hitAny) match.shotsHit += 1;

      const remaining = isPrimary ? match.primaryAmmo : match.secondaryAmmo;
      if (remaining === 0) triggerReload();
    };

    const triggerReload = () => {
      if (match.reloading || !player.alive) return;
      if (match.activeSlot === 0) {
        const max = resolveGunSpec(
          PRIMARY_WEAPONS[loadoutRef.current.primary],
          weaponBuildsRef.current[loadoutRef.current.primary]
        ).magSize;
        if (match.primaryAmmo < max) {
          match.reloading = true;
          match.reloadTimer = 0;
          shooterAudio.playReload();
        }
      } else if (match.activeSlot === 1) {
        const max = resolveGunSpec(
          SECONDARY_WEAPONS[loadoutRef.current.secondary],
          weaponBuildsRef.current[loadoutRef.current.secondary]
        ).magSize;
        if (match.secondaryAmmo < max) {
          match.reloading = true;
          match.reloadTimer = 0;
          shooterAudio.playReload();
        }
      }
    };

    const useActiveSlot = (clientX?: number, clientY?: number) => {
      if (
        gameStateRef.current !== 'PLAYING' ||
        !player.alive ||
        match.reloading ||
        match.fireCooldown > 0
      ) {
        return;
      }

      const cfg = loadoutRef.current;
      const builds = weaponBuildsRef.current;

      if (match.activeSlot === 0) {
        const spec = resolveGunSpec(PRIMARY_WEAPONS[cfg.primary], builds[cfg.primary]);
        match.fireCooldown = spec.fireInterval;
        if (spec.burstCount && spec.burstCount > 1 && !spec.auto) {
          fireGunSpec(spec, clientX, clientY);
          match.burstQueue = spec.burstCount - 1;
          match.burstTimer = 0.065;
        } else {
          fireGunSpec(spec, clientX, clientY);
        }
      } else if (match.activeSlot === 1) {
        const spec = resolveGunSpec(SECONDARY_WEAPONS[cfg.secondary], builds[cfg.secondary]);
        match.fireCooldown = spec.fireInterval;
        fireGunSpec(spec, clientX, clientY);
      } else if (match.activeSlot === 2) {
        // Melee Slash + Forward Lunge Dash + Luminous Crescent Arc (cleaves enemies in range)!
        const melee = resolveMeleeSpec(MELEE_WEAPONS[cfg.melee], builds[cfg.melee]);
        match.fireCooldown = melee.cooldown;
        match.meleeSwingTimer = 0.22;
        shooterAudio.playMeleeSlash();

        _forward.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)).normalize();
        camera.getWorldDirection(_v3);
        spawnMeleeSlashArc(camera.position, _v3, melee.color);
        player.vel.x += _forward.x * melee.dashImpulse;
        player.vel.z += _forward.z * melee.dashImpulse;

        for (const bot of bots) {
          if (!bot.active || bot.team !== 'enemy' || !bot.alive || !bot.rig.root.visible) continue;
          const dist = player.pos.distanceTo(_v1.set(bot.pos.x, bot.pos.y + 1.4, bot.pos.z));
          if (dist <= melee.range) {
            _v2.subVectors(_v1, player.pos).normalize();
            if (_v2.dot(_v3) > 0.42) {
              damageBot(
                bot,
                melee.damage * (match.activePerk?.damageMult ?? 1),
                false,
                _v1,
                'YOU',
                'ally',
                true
              );
              spawnSparks(_v1, melee.color, 10);
            }
          }
        }
      } else if (match.activeSlot === 3) {
        if (match.utilityCharges <= 0) return;
        const util = resolveUtilitySpec(UTILITY_ITEMS[cfg.utility], builds[cfg.utility]);
        match.utilityCharges -= 1;
        match.fireCooldown = Math.max(0.35, util.cooldown * 0.14);

        if (cfg.utility === 'medkit') {
          const healAmount = Math.round(55 * util.powerMult);
          player.hp = Math.min(match.playerMaxHp, player.hp + healAmount);
          shooterAudio.playHeal();
        } else {
          // Throw physical bouncing Grenade or Flashbang
          camera.getWorldDirection(_v1);
          const mesh = new THREE.Mesh(
            grenadeGeo,
            new THREE.MeshStandardMaterial({
              color: util.color,
              roughness: 0.9,
              metalness: 0,
              envMapIntensity: 0,
            })
          );
          mesh.position.copy(player.pos).addScaledVector(_v1, 0.9);
          scene.add(mesh);
          thrownItems.push({
            mesh,
            vel: _v1
              .clone()
              .multiplyScalar(22 * util.throwSpeedMult)
              .add(new THREE.Vector3(0, 5.2, 0)),
            life: cfg.utility === 'flashbang' ? 1.0 : 1.35,
            kind: cfg.utility,
            powerMult: util.powerMult,
          });
          shooterAudio.playMeleeSlash();
        }
      }
      pushHud();
    };

    const pushHud = () => {
      const overheadMarkers: OverheadMarker[] = [];
      const allyRoster: TeamRosterStatus[] = [
        {
          id: 'player',
          name: 'YOU',
          team: 'ally',
          isPlayer: true,
          hp: Math.max(0, Math.round(player.hp)),
          maxHp: match.playerMaxHp,
          alive: player.alive,
        },
      ];
      const enemyRoster: TeamRosterStatus[] = [];

      for (const bot of bots) {
        if (!bot.active) continue;
        const status: TeamRosterStatus = {
          id: bot.id,
          name: bot.name,
          team: bot.team,
          isPlayer: false,
          hp: Math.max(0, Math.round(bot.hp)),
          maxHp: bot.maxHp,
          alive: bot.alive,
        };
        if (bot.team === 'ally') allyRoster.push(status);
        else enemyRoster.push(status);

        if (bot.alive && bot.rig.root.visible) {
          _projVec.set(bot.pos.x, bot.pos.y + 3.05, bot.pos.z);
          _projVec.project(camera);
          const visible =
            _projVec.z < 1 &&
            _projVec.x > -0.95 &&
            _projVec.x < 0.95 &&
            _projVec.y > -0.95 &&
            _projVec.y < 0.95;
          if (visible) {
            overheadMarkers.push({
              id: bot.id,
              name: bot.name,
              team: bot.team,
              hp: Math.max(0, Math.round(bot.hp)),
              maxHp: bot.maxHp,
              x: (_projVec.x + 1) / 2,
              y: (1 - _projVec.y) / 2,
              visible: true,
            });
          }
        }
      }

      const alliesAlive = allyRoster.filter((m) => m.alive).length;
      const enemiesAlive = enemyRoster.filter((m) => m.alive).length;
      const leadEnemy = enemyRoster.find((m) => m.alive);

      const screenPopups: DamagePopup[] = popups.map((p) => {
        _v1.copy(p.worldPos);
        _v1.y += p.age * 1.4;
        _v1.project(camera);
        return {
          id: p.id,
          amount: p.amount,
          crit: p.crit,
          x: (_v1.x + 1) / 2,
          y: (1 - _v1.y) / 2,
        };
      });

      const reloadDuration =
        match.activeSlot === 0
          ? resolveGunSpec(
              PRIMARY_WEAPONS[loadoutRef.current.primary],
              weaponBuildsRef.current[loadoutRef.current.primary]
            ).reloadTime
          : resolveGunSpec(
              SECONDARY_WEAPONS[loadoutRef.current.secondary],
              weaponBuildsRef.current[loadoutRef.current.secondary]
            ).reloadTime;

      setHud({
        teamSize: teamSizeRef.current,
        playerHp: Math.max(0, Math.round(player.hp)),
        maxHp: match.playerMaxHp,
        playerAlive: player.alive,
        rivalHp: leadEnemy ? leadEnemy.hp : 0,
        alliesAlive,
        enemiesAlive,
        allyRoster,
        enemyRoster,
        playerRounds: match.playerRounds,
        rivalRounds: match.rivalRounds,
        roundNumber: match.roundNumber,
        roundsToWin: ROUNDS_TO_WIN,
        roundTimer: Math.max(0, Math.ceil(match.roundTimer)),
        activeSlot: match.activeSlot,
        primaryAmmo: match.primaryAmmo,
        secondaryAmmo: match.secondaryAmmo,
        utilityCharges: match.utilityCharges,
        reloading: match.reloading,
        reloadProgress: match.reloading ? Math.min(1, match.reloadTimer / reloadDuration) : 0,
        sliding: player.sliding,
        ads: player.ads,
        dashReady: player.slideCooldown <= 0,
        pointerLocked: match.pointerLocked,
        roundBanner: match.roundBanner,
        damageFlash: match.damageFlash,
        hitMarker: match.hitMarker,
        overheadMarkers,
        damagePopups: screenPopups,
        killFeed: match.killFeed,
        totalDamageDealt: match.totalDamageDealt,
        kills: match.kills,
        headshots: match.headshots,
        shotsFired: match.shotsFired,
        shotsHit: match.shotsHit,
        activePerkLabel: match.activePerk?.label ?? null,
        factToast: match.factToast,
      });
    };

    const rebuildViewmodel = (cfg: LoadoutConfig, builds?: WeaponBuildsMap) => {
      camera.remove(viewmodel.root);
      viewmodel = buildRivalsViewmodel(cfg, mats, builds ?? weaponBuildsRef.current);
      camera.add(viewmodel.root);
      viewmodel.slotGroups.forEach((g, idx) => {
        g.visible = idx === match.activeSlot;
      });
    };

    apiRef.current = {
      prepareMatch: (cfg: LoadoutConfig) => {
        rebuildMap(mapRef.current);
        rebuildViewmodel(cfg);
        match.playerRounds = 0;
        match.rivalRounds = 0;
        match.totalDamageDealt = 0;
        match.kills = 0;
        match.headshots = 0;
        match.shotsFired = 0;
        match.shotsHit = 0;
        setupRound(1, null);
        pushHud();
      },
      beginRound: (roundNum: number, perk: RoundOverchargePerk | null) => {
        setupRound(roundNum, perk);
        pushHud();
      },
      selectSlot,
      triggerReload,
      rebuildViewmodel,
      rebuildMap,
      setGraphicsMode: (mode: 'ultra' | 'standard') => {
        const isUltra = mode === 'ultra';
        const targetPr = isSoftwareGl
          ? 1
          : isUltra
            ? Math.min(window.devicePixelRatio, 2)
            : 1;
        renderer.setPixelRatio(targetPr);
        renderer.setSize(container.clientWidth, container.clientHeight);
        if (composer) {
          composer.setPixelRatio(targetPr);
          composer.setSize(container.clientWidth, container.clientHeight);
        }
        dustPoints.visible = isUltra;
        sun.castShadow = !isSoftwareGl && isUltra;
      },
      lockPointer: () => {
        try {
          renderer.domElement.requestPointerLock?.();
        } catch {
          // Fallback controls remain active
        }
      },
      cancelMatch: () => {
        clearDynamicObjects();
        match.roundEndTimer = 0;
        match.mouseDown = false;
        match.rightDown = false;
        match.reloading = false;
        match.burstQueue = 0;
        match.roundBanner = null;
        player.ads = false;
        player.sliding = false;
        pushHud();
      },
    };

    // --- INPUT LISTENERS ---
    const onPointerLockChange = () => {
      match.pointerLocked = document.pointerLockElement === renderer.domElement;
      pushHud();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (gameStateRef.current !== 'PLAYING' || !player.alive) return;
      if (match.pointerLocked || match.rightDown) {
        const sens = player.ads ? 0.0012 : 0.0022;
        player.yaw -= e.movementX * sens;
        player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * sens, -1.35, 1.35);
        const swayAmp = player.ads ? 0.0001 : 0.00028;
        match.swayX = THREE.MathUtils.clamp(match.swayX - e.movementX * swayAmp, -0.028, 0.028);
        match.swayY = THREE.MathUtils.clamp(match.swayY + e.movementY * swayAmp, -0.022, 0.022);
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (gameStateRef.current !== 'PLAYING' || !player.alive) return;
      if (e.button === 2) {
        match.rightDown = true;
        syncAdsState();
        return;
      }
      if (e.button === 0) {
        match.mouseDown = true;
        if (!match.pointerLocked) {
          try {
            renderer.domElement.requestPointerLock?.();
          } catch {
            // Safe fallback
          }
        }
        useActiveSlot(e.clientX, e.clientY);
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) match.mouseDown = false;
      if (e.button === 2) {
        match.rightDown = false;
        syncAdsState();
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      if (gameStateRef.current === 'PLAYING') e.preventDefault();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
      if (gameStateRef.current !== 'PLAYING' || !player.alive) return;

      if (e.code === 'Digit1') selectSlot(0);
      else if (e.code === 'Digit2') selectSlot(1);
      else if (e.code === 'Digit3') selectSlot(2);
      else if (e.code === 'Digit4') selectSlot(3);
      else if (e.code === 'KeyR') triggerReload();
      else if (e.code === 'KeyE') {
        syncAdsState();
      }
      else if (e.code === 'Space' && player.grounded) {
        // RIVALS Slide-Jump momentum boost!
        if (player.sliding) {
          player.vel.y = 10.6;
          player.vel.x += player.slideDir.x * 6.5;
          player.vel.z += player.slideDir.z * 6.5;
          player.sliding = false;
        } else {
          player.vel.y = 9.0;
        }
        player.grounded = false;
      } else if ((e.code === 'KeyC' || e.code === 'ControlLeft') && !player.sliding && player.slideCooldown <= 0) {
        // Trigger RIVALS Momentum Slide!
        _forward.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)).normalize();
        _right.crossVectors(_forward, _up).normalize();
        _v1.set(0, 0, 0);
        if (keys['KeyW']) _v1.add(_forward);
        if (keys['KeyS']) _v1.sub(_forward);
        if (keys['KeyD']) _v1.add(_right);
        if (keys['KeyA']) _v1.sub(_right);
        if (_v1.lengthSq() === 0) _v1.copy(_forward);
        else _v1.normalize();

        player.sliding = true;
        player.slideTimer = 0.55;
        player.slideCooldown = 1.05;
        player.slideDir.copy(_v1);
        player.vel.x = _v1.x * 21.5;
        player.vel.z = _v1.z * 21.5;
        shooterAudio.playSlide();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
      if (e.code === 'KeyE') {
        syncAdsState();
      }
    };

    const onWindowBlur = () => {
      for (const k of Object.keys(keys)) keys[k] = false;
      match.mouseDown = false;
      match.rightDown = false;
      if (player.ads) {
        player.ads = false;
        pushHud();
      }
    };

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      const pr = Math.min(window.devicePixelRatio, 2);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer?.setSize(w, h);
      if (lensPass) {
        lensPass.uniforms.uTexelSize.value.set(1 / Math.max(1, w * pr), 1 / Math.max(1, h * pr));
      }
    };

    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('resize', onResize);

    // --- MAIN RENDER & SIMULATION LOOP ---
    const clock = new THREE.Clock();
    let frameId = 0;
    let hudAccum = 0;
    let disposed = false;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || !gl.fenceSync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const st = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (st === gl.UNSIGNALED) frameId = window.setTimeout(poll, 5);
        else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(0.05, clock.getDelta());
      const elapsed = clock.getElapsedTime();
      grassTimeUniform.value = elapsed;
      if (lensPass) lensPass.uniforms.uTime.value = elapsed;

      if (arenaGroup.userData.waterTimeUniform) {
        arenaGroup.userData.waterTimeUniform.value = elapsed;
      }
      if (Array.isArray(arenaGroup.userData.animatedSpinners)) {
        for (const spinner of arenaGroup.userData.animatedSpinners as THREE.Object3D[]) {
          spinner.rotation.y = elapsed * 1.15;
        }
      }
      if (Array.isArray(arenaGroup.userData.animatedBobbers)) {
        for (const b of arenaGroup.userData.animatedBobbers as Array<{
          mesh: THREE.Object3D;
          baseY: number;
          phase: number;
        }>) {
          b.mesh.position.y = b.baseY + Math.sin(elapsed * 2.1 + b.phase) * 0.085;
          b.mesh.rotation.z = Math.sin(elapsed * 1.6 + b.phase) * 0.07;
        }
      }
      if (Array.isArray(arenaGroup.userData.animatedSwayers)) {
        for (const sw of arenaGroup.userData.animatedSwayers as Array<{
          mesh: THREE.Object3D;
          phase: number;
        }>) {
          sw.mesh.rotation.z = Math.sin(elapsed * 0.85 + sw.phase) * 0.035;
        }
      }

      // Drift atmospheric dust motes / embers smoothly
      const dPos = dustGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < dustCount; i++) {
        let py = dPos.getY(i) + dustSpeeds[i] * dt;
        let px = dPos.getX(i) + Math.sin(elapsed * 0.4 + i) * 0.14 * dt;
        if (py > 14.8) py = 0.6;
        if (px > 31) px = -31;
        else if (px < -31) px = 31;
        dPos.setXY(i, px, py);
      }
      dPos.needsUpdate = true;

      match.aberrationPulse = THREE.MathUtils.damp(match.aberrationPulse, 0, 12, dt);
      explosionLight.intensity = THREE.MathUtils.damp(explosionLight.intensity, 0, 9, dt);
      if (lensPass) {
        lensPass.uniforms.uAberration.value =
          match.aberrationPulse + match.damageFlash * 0.0055;
      }

      if (gameStateRef.current !== 'PLAYING') {
        keys['KeyE'] = false;
        match.rightDown = false;
        match.mouseDown = false;
        if (player.ads) {
          player.ads = false;
          pushHud();
        }
      }

      if (gameStateRef.current === 'TITLE_MENU' || gameStateRef.current === 'ROUND_QUIZ') {
        camera.position.set(Math.sin(elapsed * 0.25) * 28, 9.5, Math.cos(elapsed * 0.25) * 28);
        camera.lookAt(0, 1.8, 0);
        camera.rotation.z = 0;
        viewmodel.root.visible = false;
        adsLaserDot.visible = false;
        const previewY =
          mapRef.current === 'docks'
            ? 3.3
            : getMapFloorHeightAt(mapRef.current, 0, 0);

        const tSize = teamSizeRef.current;
        let aIdx = 0;
        let eIdx = 0;
        for (const bot of bots) {
          const posePreviewBot = (idxOffset: number) => {
            const breathe = Math.sin(elapsed * 2.2 + idxOffset) * 0.015;
            bot.rig.bodyGroup.rotation.set(0, 0, 0);
            bot.rig.bodyGroup.position.y = breathe;
            bot.rig.pelvisGroup.rotation.set(0, 0, 0);
            bot.rig.torsoGroup.rotation.set(0.05 + breathe * 0.5, 0, 0);
            bot.rig.leftLeg.rotation.set(-0.08, 0, 0.04);
            bot.rig.leftKnee.rotation.set(0.14, 0, 0);
            bot.rig.leftAnkle.rotation.set(-0.06, 0, 0);
            bot.rig.rightLeg.rotation.set(0.08, 0, -0.04);
            bot.rig.rightKnee.rotation.set(0.14, 0, 0);
            bot.rig.rightAnkle.rotation.set(-0.06, 0, 0);
            bot.rig.leftArm.rotation.set(-0.62, 0.18, 0.14);
            bot.rig.leftElbow.rotation.set(-0.78 + breathe, 0.28, -0.25);
            bot.rig.rightArm.rotation.set(-0.48, -0.1, -0.06);
            bot.rig.rightElbow.rotation.set(-1.02 + breathe, 0.08, 0);
            bot.rig.headGroup.rotation.set(0, Math.sin(elapsed * 1.1 + idxOffset) * 0.14, 0);
            bot.rig.backRotor.rotation.z += dt * 7;
            const idleFlame = 0.42 + Math.sin(elapsed * 18 + idxOffset) * 0.08;
            bot.rig.leftThrusterFlame.scale.set(0.8, idleFlame, 0.8);
            bot.rig.rightThrusterFlame.scale.set(0.8, idleFlame, 0.8);
          };
          if (bot.team === 'ally') {
            if (aIdx < tSize - 1) {
              const offset = aIdx - (tSize - 2) * 0.5;
              bot.rig.root.position.set(offset * 2.1, previewY, 2.8);
              bot.rig.root.rotation.y = Math.PI + Math.sin(elapsed * 0.5 + aIdx) * 0.25;
              posePreviewBot(aIdx);
              bot.rig.root.visible = true;
            } else {
              bot.rig.root.visible = false;
            }
            aIdx += 1;
          } else {
            if (eIdx < tSize) {
              const offset = eIdx - (tSize - 1) * 0.5;
              const zOff = tSize === 1 ? 0 : -2.6 - Math.abs(offset) * 0.55;
              bot.rig.root.position.set(offset * 2.1, previewY, zOff);
              bot.rig.root.rotation.y =
                tSize === 1 ? elapsed * 0.6 : Math.sin(elapsed * 0.5 + eIdx) * 0.25;
              posePreviewBot(eIdx + 2);
              bot.rig.root.visible = true;
            } else {
              bot.rig.root.visible = false;
            }
            eIdx += 1;
          }
        }

        knowledgeOrbGroup.position.set(
          0,
          getOrbBaseY(mapRef.current) + Math.sin(elapsed * 2.4) * 0.18,
          0
        );
        knowledgeOrbGroup.rotation.y = elapsed * 1.4;
      } else if (gameStateRef.current === 'ROUND_END') {
        adsLaserDot.visible = false;
        for (const bot of bots) {
          if (bot.active && bot.knockedDown && bot.knockdownProgress < 1) {
            bot.knockdownProgress = Math.min(1, bot.knockdownProgress + dt * 3.8);
            bot.rig.bodyGroup.rotation.x = -bot.knockdownProgress * (Math.PI / 2 - 0.12);
            bot.rig.bodyGroup.position.y = -bot.knockdownProgress * 0.35;
          }
        }
        match.roundEndTimer -= dt;
        if (match.roundEndTimer <= 0) {
          onRequestNextRoundQuizRef.current(match.roundNumber + 1);
        }
      } else if (gameStateRef.current === 'PLAYING') {
        const activePrimarySpec = resolveGunSpec(
          PRIMARY_WEAPONS[loadoutRef.current.primary],
          weaponBuildsRef.current[loadoutRef.current.primary]
        );
        const activeSecondarySpec = resolveGunSpec(
          SECONDARY_WEAPONS[loadoutRef.current.secondary],
          weaponBuildsRef.current[loadoutRef.current.secondary]
        );
        const isScopedSniper =
          player.alive &&
          player.ads &&
          ((match.activeSlot === 0 && activePrimarySpec.optic === 'scope') ||
            (match.activeSlot === 1 && activeSecondarySpec.optic === 'scope'));
        viewmodel.root.visible = player.alive && !isScopedSniper;

        // Round timer countdown
        match.roundTimer -= dt;
        if (match.roundTimer <= 0) {
          const aliveAllies = bots.filter((b) => b.active && b.team === 'ally' && b.alive);
          const aliveEnemies = bots.filter((b) => b.active && b.team === 'enemy' && b.alive);
          const allyCount = (player.alive ? 1 : 0) + aliveAllies.length;
          const enemyCount = aliveEnemies.length;
          const allyHpSum =
            (player.alive ? player.hp : 0) + aliveAllies.reduce((acc, b) => acc + b.hp, 0);
          const enemyHpSum = aliveEnemies.reduce((acc, b) => acc + b.hp, 0);
          const playerSideWins =
            allyCount !== enemyCount ? allyCount > enemyCount : allyHpSum >= enemyHpSum;
          finishRound(playerSideWins, 'Time Expired');
        }
        if (match.roundBanner && player.alive && match.roundTimer < 88.2) {
          match.roundBanner = null;
        }

        // Animate knocked-down bots collapsing to terrain during active round
        for (const bot of bots) {
          if (bot.active && bot.knockedDown && bot.knockdownProgress < 1) {
            bot.knockdownProgress = Math.min(1, bot.knockdownProgress + dt * 3.8);
            bot.rig.bodyGroup.rotation.x = -bot.knockdownProgress * (Math.PI / 2 - 0.12);
            bot.rig.bodyGroup.position.y = -bot.knockdownProgress * 0.35;
          }
        }

        if (player.alive) {
          // Arrow-key look fallback (E is reserved for Aim/ADS)
          if (keys['ArrowLeft'] || keys['KeyQ']) player.yaw += 2.2 * dt;
          if (keys['ArrowRight']) player.yaw -= 2.2 * dt;
          if (keys['ArrowUp']) player.pitch = Math.min(1.25, player.pitch + 1.5 * dt);
          if (keys['ArrowDown']) player.pitch = Math.max(-1.25, player.pitch - 1.5 * dt);

          // Automatic weapon firing while mouse held
          if (match.mouseDown && !match.reloading && match.fireCooldown <= 0) {
            if (
              (match.activeSlot === 0 && activePrimarySpec.auto) ||
              (match.activeSlot === 1 && activeSecondarySpec.auto)
            ) {
              useActiveSlot();
            }
          }

          // Burst rifle follow-up shots
          if (match.burstQueue > 0) {
            match.burstTimer -= dt;
            if (match.burstTimer <= 0) {
              match.burstQueue -= 1;
              match.burstTimer = 0.065;
              fireGunSpec(activePrimarySpec);
            }
          }

          // Cooldowns, muzzle flash, bolt action & reload
          match.fireCooldown = Math.max(0, match.fireCooldown - dt);
          match.damageFlash = Math.max(0, match.damageFlash - dt * 2.5);
          match.meleeSwingTimer = Math.max(0, match.meleeSwingTimer - dt);
          muzzleLight.intensity = THREE.MathUtils.damp(muzzleLight.intensity, 0, 22, dt);

          if (match.muzzleFlashTimer > 0) {
            match.muzzleFlashTimer -= dt;
            if (match.muzzleFlashTimer <= 0) viewmodel.muzzleFlash.visible = false;
          }
          match.boltKick = THREE.MathUtils.damp(match.boltKick, 0, 26, dt);
          viewmodel.primaryBolt.position.z = match.boltKick;
          viewmodel.secondarySlide.position.z = match.boltKick;

          if (match.hitMarkerTimer > 0) {
            match.hitMarkerTimer -= dt;
            if (match.hitMarkerTimer <= 0) match.hitMarker = 'none';
          }

          let reloadMagDrop = 0;
          if (match.reloading) {
            match.reloadTimer += dt;
            const req =
              match.activeSlot === 0
                ? activePrimarySpec.reloadTime
                : activeSecondarySpec.reloadTime;
            const p = Math.min(1, match.reloadTimer / req);
            reloadMagDrop = Math.sin(p * Math.PI) * 0.2;
            if (match.reloadTimer >= req) {
              if (match.activeSlot === 0) {
                match.primaryAmmo = activePrimarySpec.magSize;
              } else {
                match.secondaryAmmo = activeSecondarySpec.magSize;
              }
              match.reloading = false;
              match.reloadTimer = 0;
            }
          }
          viewmodel.primaryMag.position.y = -reloadMagDrop;
          viewmodel.secondaryMag.position.y = -reloadMagDrop;

          // Slide timers & camera height/FOV
          player.slideCooldown = Math.max(0, player.slideCooldown - dt);
          if (player.sliding) {
            player.slideTimer -= dt;
            if (player.slideTimer <= 0) player.sliding = false;
          }

          const targetEye = player.sliding ? 0.95 : 1.75;
          player.eyeHeight = THREE.MathUtils.damp(player.eyeHeight, targetEye, 16, dt);

          const adsFov =
            match.activeSlot === 0 ? activePrimarySpec.adsFov : activeSecondarySpec.adsFov;
          const targetFov = player.ads ? adsFov : player.sliding ? 84 : 76;
          if (Math.abs(player.fov - targetFov) > 0.05) {
            player.fov = THREE.MathUtils.damp(player.fov, targetFov, 14, dt);
            camera.fov = player.fov;
            camera.updateProjectionMatrix();
          }

          // Movement kinematics
          _forward.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)).normalize();
          _right.crossVectors(_forward, _up).normalize();
          _v1.set(0, 0, 0);
          if (keys['KeyW']) _v1.add(_forward);
          if (keys['KeyS']) _v1.sub(_forward);
          if (keys['KeyD']) _v1.add(_right);
          if (keys['KeyA']) _v1.sub(_right);
          if (_v1.lengthSq() > 0) _v1.normalize();

          const meleeMult =
            match.activeSlot === 2
              ? resolveMeleeSpec(
                  MELEE_WEAPONS[loadoutRef.current.melee],
                  weaponBuildsRef.current[loadoutRef.current.melee]
                ).speedBonus
              : 1.0;
          const perkSpeedMult = match.activePerk?.speedMult ?? 1.0;
          const sprinting = Boolean(keys['ShiftLeft'] && !player.ads);
          const baseSpeed =
            (sprinting ? 14.5 : 11.2) *
            meleeMult *
            perkSpeedMult *
            (player.ads ? 0.68 : 1);

          if (player.sliding) {
            player.vel.x = THREE.MathUtils.damp(player.vel.x, player.slideDir.x * 13.0, 2.2, dt);
            player.vel.z = THREE.MathUtils.damp(player.vel.z, player.slideDir.z * 13.0, 2.2, dt);
          } else {
            player.vel.x = THREE.MathUtils.damp(player.vel.x, _v1.x * baseSpeed, 14, dt);
            player.vel.z = THREE.MathUtils.damp(player.vel.z, _v1.z * baseSpeed, 14, dt);
          }

          const wasGrounded = player.grounded;
          const impactVelY = player.vel.y;
          player.vel.y -= 24 * dt;
          player.pos.x += player.vel.x * dt;
          player.pos.z += player.vel.z * dt;
          player.pos.y += player.vel.y * dt;

          const floorY =
            getMapFloorHeightAt(mapRef.current, player.pos.x, player.pos.z) + player.eyeHeight;
          if (player.pos.y <= floorY) {
            player.pos.y = floorY;
            if (!wasGrounded && impactVelY < -5.5) {
              match.landDip = Math.min(0.24, Math.abs(impactVelY) * 0.015);
              shooterAudio.playLand();
            }
            player.vel.y = 0;
            player.grounded = true;
          } else if (player.pos.y > floorY + 0.12) {
            player.grounded = false;
          }
          resolveArenaCollision(player.pos, 0.55, player.pos.y - player.eyeHeight);

          // Camera recoil, landing dip & strafe bank recovery
          match.camRecoilPitch = THREE.MathUtils.damp(match.camRecoilPitch, 0, 14, dt);
          match.camRecoilYaw = THREE.MathUtils.damp(match.camRecoilYaw, 0, 14, dt);
          match.landDip = THREE.MathUtils.damp(match.landDip, 0, 16, dt);

          const strafeInput = (keys['KeyD'] ? -1 : 0) + (keys['KeyA'] ? 1 : 0);
          const targetTilt = (player.sliding ? 0.045 : strafeInput * 0.018) * (player.ads ? 0.4 : 1);
          match.camTilt = THREE.MathUtils.damp(match.camTilt, targetTilt, 12, dt);

          const breathSwayX = Math.sin(elapsed * 1.4) * (player.ads ? 0.001 : 0.003);
          const breathSwayY = Math.cos(elapsed * 2.1) * (player.ads ? 0.001 : 0.0035);

          camera.position.set(player.pos.x, player.pos.y - match.landDip, player.pos.z);
          camera.rotation.y = player.yaw + match.camRecoilYaw + breathSwayX;
          camera.rotation.x = THREE.MathUtils.clamp(
            player.pitch + match.camRecoilPitch + breathSwayY,
            -1.4,
            1.4
          );
          camera.rotation.z = match.camTilt;

          // First-person viewmodel animation & synced footsteps
          const moveMag = Math.hypot(player.vel.x, player.vel.z);
          if (moveMag > 1.2 && player.grounded && !player.sliding) {
            match.bobPhase += dt * moveMag * 1.05;
            if (Math.floor(match.bobPhase / Math.PI) > match.lastStepPhase) {
              match.lastStepPhase = Math.floor(match.bobPhase / Math.PI);
              shooterAudio.playFootstep(sprinting);
            }
          }
          match.recoil = THREE.MathUtils.damp(match.recoil, 0, 16, dt);
          match.swayX = THREE.MathUtils.damp(match.swayX, 0, 11, dt);
          match.swayY = THREE.MathUtils.damp(match.swayY, 0, 11, dt);
          const reloadDip = match.reloading
            ? Math.sin((match.reloadTimer / 1.1) * Math.PI) * 0.14
            : 0;
          const slashProgress = match.meleeSwingTimer > 0 ? 1 - match.meleeSwingTimer / 0.22 : 0;
          const slashYaw = Math.sin(slashProgress * Math.PI) * 1.1;
          const slashPitch = Math.sin(slashProgress * Math.PI) * -0.75;

          const adsHeight = match.activeSlot === 1 ? -0.072 : -0.138;
          const sprintLowReady =
            sprinting && !player.ads && match.fireCooldown <= 0.02 && !match.reloading;
          const vmTargetX = player.ads ? 0 : sprintLowReady ? 0.22 : 0.26;
          const vmTargetY = player.ads ? adsHeight : sprintLowReady ? -0.275 : -0.24;
          const bobScale = player.ads ? 0.18 : sprintLowReady ? 1.35 : 1.0;

          viewmodel.root.position.set(
            THREE.MathUtils.damp(viewmodel.root.position.x, vmTargetX, 20, dt) +
              Math.cos(match.bobPhase * 0.5) * 0.008 * bobScale +
              match.swayX,
            THREE.MathUtils.damp(viewmodel.root.position.y, vmTargetY, 20, dt) +
              Math.sin(match.bobPhase) * 0.009 * bobScale +
              match.swayY -
              reloadDip -
              match.landDip * 0.22,
            -0.4 + match.recoil
          );
          viewmodel.root.rotation.set(
            match.recoil * 1.25 -
              reloadDip * 1.3 +
              slashPitch -
              match.swayY * 1.5 -
              (sprintLowReady ? 0.12 : 0),
            slashYaw + match.swayX * 1.6 + (sprintLowReady ? 0.34 : 0),
            (player.sliding ? 0.14 : 0) +
              match.camTilt * 1.6 -
              match.swayX * 1.8 +
              (sprintLowReady ? 0.18 : 0)
          );

          // Tactical ADS Laser Projection Dot on Target Surface
          const showLaser =
            player.ads &&
            !match.reloading &&
            match.activeSlot <= 1 &&
            !(match.activeSlot === 0 && loadoutRef.current.primary === 'sniper');
          if (showLaser) {
            camera.getWorldDirection(_rayDir);
            raycaster.set(camera.position, _rayDir);
            raycaster.far = 90;
            const laserTargets: THREE.Object3D[] = [
              ...bots
                .filter(
                  (b) =>
                    b.active && b.team === 'enemy' && b.alive && !b.knockedDown && b.rig.root.visible
                )
                .map((b) => b.rig.root),
              arenaGroup,
              terrainMesh,
            ];
            const lHits = raycaster.intersectObjects(laserTargets, true);
            raycaster.far = Infinity;
            if (lHits.length > 0) {
              const lh = lHits[0];
              adsLaserMat.color.setHex(
                match.activeSlot === 0 ? activePrimarySpec.color : activeSecondarySpec.color
              );
              adsLaserDot.position.copy(lh.point).addScaledVector(_rayDir, -0.04);
              adsLaserDot.scale.setScalar(0.65 + lh.distance * 0.024);
              adsLaserDot.visible = true;
            } else {
              adsLaserDot.visible = false;
            }
          } else {
            adsLaserDot.visible = false;
          }
        } else {
          // Tactical Spectator Camera when player eliminated in 2v2-5v5 while allies still fight
          adsLaserDot.visible = false;
          match.damageFlash = Math.max(0, match.damageFlash - dt * 2.5);
          muzzleLight.intensity = 0;
          if (player.fov !== 76) {
            player.fov = THREE.MathUtils.damp(player.fov, 76, 8, dt);
            camera.fov = player.fov;
            camera.updateProjectionMatrix();
          }
          const specAlly = bots.find((b) => b.active && b.team === 'ally' && b.alive);
          const focusX = specAlly ? specAlly.pos.x : 0;
          const focusY = specAlly ? specAlly.pos.y + 1.6 : 1.8;
          const focusZ = specAlly ? specAlly.pos.z : 0;
          camera.position.set(
            focusX + Math.sin(elapsed * 0.45) * 9.5,
            focusY + 5.2,
            focusZ + Math.cos(elapsed * 0.45) * 9.5
          );
          camera.lookAt(focusX, focusY, focusZ);
          camera.rotation.z = 0;
        }

        // --- MULTI-BOT TEAM COMBAT AI (1v1 - 5v5) ---
        const diff = DIFFICULTIES[difficultyRef.current];
        const activeCount = bots.filter((b) => b.active && b.alive).length;
        const soundMixScale = activeCount > 2 ? 0.55 : 0.85;

        for (const bot of bots) {
          if (!bot.active || !bot.alive || bot.knockedDown || !bot.rig.root.visible) continue;

          bot.stunTimer = Math.max(0, bot.stunTimer - dt);
          bot.flinchTimer = Math.max(0, bot.flinchTimer - dt);
          if (bot.muzzleFlashTimer > 0) {
            bot.muzzleFlashTimer -= dt;
            if (bot.muzzleFlashTimer <= 0) bot.rig.muzzleFlash.visible = false;
          }

          // Acquire nearest alive opposing combatant
          let targetPos: THREE.Vector3 | null = null;
          let targetIsPlayer = false;
          let targetBot: BotEntity | null = null;
          let bestDist = Infinity;

          if (bot.team === 'enemy') {
            if (player.alive) {
              const dPlayer = bot.pos.distanceTo(player.pos);
              bestDist = dPlayer;
              targetPos = _v3.set(player.pos.x, player.pos.y - 0.35, player.pos.z);
              targetIsPlayer = true;
            }
            for (const other of bots) {
              if (!other.active || !other.alive || other.team !== 'ally') continue;
              const d = bot.pos.distanceTo(other.pos);
              if (d < bestDist) {
                bestDist = d;
                targetBot = other;
                targetIsPlayer = false;
                targetPos = _v3.set(other.pos.x, other.pos.y + 1.35, other.pos.z);
              }
            }
          } else {
            for (const other of bots) {
              if (!other.active || !other.alive || other.team !== 'enemy') continue;
              const d = bot.pos.distanceTo(other.pos);
              if (d < bestDist) {
                bestDist = d;
                targetBot = other;
                targetIsPlayer = false;
                targetPos = _v3.set(other.pos.x, other.pos.y + 1.35, other.pos.z);
              }
            }
          }

          if (!targetPos) continue;
          const targetCenter = targetPos.clone();

          _v1.subVectors(targetCenter, bot.pos);
          _v1.y = 0;
          const distToTarget = Math.max(0.01, _v1.length());
          _v1.divideScalar(distToTarget);

          const desiredYaw = Math.atan2(_v1.x, _v1.z);
          let diffYaw = desiredYaw - bot.yaw;
          while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
          while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
          bot.yaw += diffYaw * Math.min(1, dt * 10);
          bot.rig.root.rotation.y = bot.yaw;

          const flinchPitch =
            bot.flinchTimer > 0 ? -Math.sin((bot.flinchTimer / 0.16) * Math.PI) * 0.24 : 0;
          bot.rig.bodyGroup.rotation.x = flinchPitch;

          bot.strafeTimer -= dt;
          if (bot.strafeTimer <= 0) {
            bot.strafeTimer = 0.7 + Math.random() * 1.1;
            bot.strafeDir = Math.random() > 0.5 ? 1 : -1;
          }

          bot.jumpTimer -= dt;
          if (bot.jumpTimer <= 0 && bot.grounded && bot.stunTimer <= 0) {
            bot.jumpTimer = 2.0 + Math.random() * 2.5;
            bot.vel.y = 8.4;
            bot.grounded = false;
          }

          const desiredDist = bot.hp < 50 && diff.useCover ? 19 : 13;
          const approach =
            distToTarget > desiredDist ? 0.85 : distToTarget < desiredDist - 4 ? -0.6 : 0;
          _v2.set(-_v1.z * bot.strafeDir, 0, _v1.x * bot.strafeDir);

          // Soft separation so teammates and opponents spread organically in 2v2-5v5
          let sepX = 0;
          let sepZ = 0;
          for (const other of bots) {
            if (other === bot || !other.active || !other.alive) continue;
            const dx = bot.pos.x - other.pos.x;
            const dz = bot.pos.z - other.pos.z;
            const dSq = dx * dx + dz * dz;
            if (dSq > 0.0001 && dSq < 4.8) {
              const inv = (2.2 - Math.sqrt(dSq)) / Math.sqrt(dSq);
              sepX += dx * inv * 1.4;
              sepZ += dz * inv * 1.4;
            }
          }

          const speedFactor = bot.stunTimer > 0 ? 0.25 : 1.0;
          bot.vel.x =
            (_v1.x * approach + _v2.x * 0.9 + bot.flankSign * _v1.z * -0.22 + sepX) *
            diff.moveSpeed *
            speedFactor;
          bot.vel.z =
            (_v1.z * approach + _v2.z * 0.9 + bot.flankSign * _v1.x * 0.22 + sepZ) *
            diff.moveSpeed *
            speedFactor;
          bot.vel.y -= 24 * dt;

          bot.pos.x += bot.vel.x * dt;
          bot.pos.z += bot.vel.z * dt;
          bot.pos.y += bot.vel.y * dt;

          const botFloor = getMapFloorHeightAt(mapRef.current, bot.pos.x, bot.pos.z);
          if (bot.pos.y <= botFloor) {
            bot.pos.y = botFloor;
            bot.vel.y = 0;
            bot.grounded = true;
          }
          resolveArenaCollision(bot.pos, 0.6, bot.pos.y);
          bot.rig.root.position.copy(bot.pos);

          const bSpeed = Math.hypot(bot.vel.x, bot.vel.z);
          const sinYaw = Math.sin(bot.yaw);
          const cosYaw = Math.cos(bot.yaw);
          const fwdVel = bot.vel.x * sinYaw + bot.vel.z * cosYaw;
          const strafeVel = bot.vel.x * cosYaw - bot.vel.z * sinYaw;
          const strafeNorm = THREE.MathUtils.clamp(strafeVel / Math.max(1, diff.moveSpeed), -1, 1);
          const recoilKick = bot.muzzleFlashTimer > 0 ? 0.2 : 0;

          if (!bot.grounded) {
            // Airborne Jetpack Jump Pose: tucked lead knee, extended trail leg, flared thrusters
            bot.rig.leftLeg.rotation.x = THREE.MathUtils.damp(bot.rig.leftLeg.rotation.x, -0.72, 12, dt);
            bot.rig.leftKnee.rotation.x = THREE.MathUtils.damp(bot.rig.leftKnee.rotation.x, 1.18, 12, dt);
            bot.rig.leftAnkle.rotation.x = THREE.MathUtils.damp(bot.rig.leftAnkle.rotation.x, 0.28, 12, dt);
            bot.rig.rightLeg.rotation.x = THREE.MathUtils.damp(bot.rig.rightLeg.rotation.x, 0.28, 12, dt);
            bot.rig.rightKnee.rotation.x = THREE.MathUtils.damp(bot.rig.rightKnee.rotation.x, 0.44, 12, dt);
            bot.rig.rightAnkle.rotation.x = THREE.MathUtils.damp(bot.rig.rightAnkle.rotation.x, 0.36, 12, dt);
            bot.rig.leftLeg.rotation.z = THREE.MathUtils.damp(bot.rig.leftLeg.rotation.z, 0.08, 10, dt);
            bot.rig.rightLeg.rotation.z = THREE.MathUtils.damp(bot.rig.rightLeg.rotation.z, -0.08, 10, dt);

            bot.rig.pelvisGroup.rotation.y = THREE.MathUtils.damp(bot.rig.pelvisGroup.rotation.y, 0, 10, dt);
            bot.rig.torsoGroup.rotation.y = THREE.MathUtils.damp(bot.rig.torsoGroup.rotation.y, 0, 10, dt);
            bot.rig.torsoGroup.rotation.x = THREE.MathUtils.damp(bot.rig.torsoGroup.rotation.x, 0.24, 10, dt);
            bot.rig.bodyGroup.position.y = THREE.MathUtils.damp(bot.rig.bodyGroup.position.y, 0.04, 10, dt);
            bot.rig.bodyGroup.rotation.z = THREE.MathUtils.damp(
              bot.rig.bodyGroup.rotation.z,
              -strafeNorm * 0.18,
              10,
              dt
            );
            bot.rig.leftArm.rotation.x = THREE.MathUtils.damp(bot.rig.leftArm.rotation.x, -0.78, 12, dt);
            bot.rig.leftElbow.rotation.x = THREE.MathUtils.damp(bot.rig.leftElbow.rotation.x, -0.88, 12, dt);
            bot.rig.rightArm.rotation.x = THREE.MathUtils.damp(
              bot.rig.rightArm.rotation.x,
              -0.52 - recoilKick,
              14,
              dt
            );
            bot.rig.rightElbow.rotation.x = THREE.MathUtils.damp(
              bot.rig.rightElbow.rotation.x,
              -1.02 - recoilKick * 0.6,
              14,
              dt
            );
            bot.rig.headGroup.rotation.set(-0.12, 0, 0);
          } else if (bSpeed > 0.45) {
            // Dynamic Multi-Joint Athletic Sprint Cycle (Heel Strike -> Stance -> Toe-Off -> High-Knee Tuck)
            const strideDir = fwdVel < -1.5 ? -1 : 1;
            const strideAmp = THREE.MathUtils.clamp(bSpeed / 10.5, 0.45, 1.18);
            bot.walkPhase += dt * bSpeed * 1.18 * strideDir;

            const pL = bot.walkPhase;
            const pR = bot.walkPhase + Math.PI;

            const targetLeftHip = -Math.cos(pL) * 0.86 * strideAmp - 0.08;
            const targetRightHip = -Math.cos(pR) * 0.86 * strideAmp - 0.08;
            const targetLeftKnee =
              0.2 +
              Math.max(0, -Math.sin(pL)) * 1.12 * strideAmp +
              Math.max(0, Math.sin(pL)) * 0.28 * strideAmp;
            const targetRightKnee =
              0.2 +
              Math.max(0, -Math.sin(pR)) * 1.12 * strideAmp +
              Math.max(0, Math.sin(pR)) * 0.28 * strideAmp;
            const targetLeftAnkle = -Math.cos(pL) * 0.34 * strideAmp;
            const targetRightAnkle = -Math.cos(pR) * 0.34 * strideAmp;

            bot.rig.leftLeg.rotation.x = THREE.MathUtils.damp(bot.rig.leftLeg.rotation.x, targetLeftHip, 18, dt);
            bot.rig.rightLeg.rotation.x = THREE.MathUtils.damp(bot.rig.rightLeg.rotation.x, targetRightHip, 18, dt);
            bot.rig.leftKnee.rotation.x = THREE.MathUtils.damp(bot.rig.leftKnee.rotation.x, targetLeftKnee, 18, dt);
            bot.rig.rightKnee.rotation.x = THREE.MathUtils.damp(bot.rig.rightKnee.rotation.x, targetRightKnee, 18, dt);
            bot.rig.leftAnkle.rotation.x = THREE.MathUtils.damp(bot.rig.leftAnkle.rotation.x, targetLeftAnkle, 18, dt);
            bot.rig.rightAnkle.rotation.x = THREE.MathUtils.damp(bot.rig.rightAnkle.rotation.x, targetRightAnkle, 18, dt);
            bot.rig.leftLeg.rotation.z = THREE.MathUtils.damp(bot.rig.leftLeg.rotation.z, strafeNorm * 0.12, 12, dt);
            bot.rig.rightLeg.rotation.z = THREE.MathUtils.damp(bot.rig.rightLeg.rotation.z, strafeNorm * 0.12, 12, dt);

            // Pelvis & Torso Counter-Twist + Forward Sprint Lean + Flight-Phase Spring Bounce
            const hipTwist = -Math.cos(pL) * 0.16 * strideAmp;
            const chestTwist = Math.cos(pL) * 0.24 * strideAmp;
            const sprintLean = (fwdVel < -1.0 ? -0.06 : 0.24) * strideAmp;
            const bounce = Math.max(-0.045, -Math.cos(bot.walkPhase * 2 + 0.5) * 0.08 * strideAmp);

            bot.rig.pelvisGroup.rotation.y = THREE.MathUtils.damp(bot.rig.pelvisGroup.rotation.y, hipTwist, 16, dt);
            bot.rig.torsoGroup.rotation.y = THREE.MathUtils.damp(bot.rig.torsoGroup.rotation.y, chestTwist, 16, dt);
            bot.rig.torsoGroup.rotation.x = THREE.MathUtils.damp(bot.rig.torsoGroup.rotation.x, sprintLean, 14, dt);
            bot.rig.bodyGroup.position.y = THREE.MathUtils.damp(bot.rig.bodyGroup.position.y, bounce, 18, dt);
            bot.rig.bodyGroup.rotation.z = THREE.MathUtils.damp(
              bot.rig.bodyGroup.rotation.z,
              -strafeNorm * 0.15,
              10,
              dt
            );

            // Head Target-Lock Stabilization (compensates for chest twist & lean)
            bot.rig.headGroup.rotation.y =
              -bot.rig.torsoGroup.rotation.y * 0.85 +
              Math.sin(elapsed * 1.8 + bot.walkPhase * 0.15) * 0.05;
            bot.rig.headGroup.rotation.x = -bot.rig.torsoGroup.rotation.x * 0.55;

            // Coordinated Arm & Rifle Pump
            bot.rig.leftArm.rotation.x = -0.68 - Math.cos(pL) * 0.28 * strideAmp;
            bot.rig.leftElbow.rotation.x = -0.82 - Math.max(0, Math.cos(pL)) * 0.26 * strideAmp;
            bot.rig.rightArm.rotation.x = -0.5 + Math.cos(pL) * 0.14 * strideAmp - recoilKick;
            bot.rig.rightElbow.rotation.x = -1.0 - Math.cos(pL) * 0.1 * strideAmp - recoilKick * 0.6;
          } else {
            // Athletic Combat-Ready Idle Stance
            const idleBreathe = Math.sin(elapsed * 2.3 + bot.walkPhase * 0.2);
            bot.rig.leftLeg.rotation.x = THREE.MathUtils.damp(bot.rig.leftLeg.rotation.x, -0.06, 12, dt);
            bot.rig.rightLeg.rotation.x = THREE.MathUtils.damp(bot.rig.rightLeg.rotation.x, 0.06, 12, dt);
            bot.rig.leftKnee.rotation.x = THREE.MathUtils.damp(bot.rig.leftKnee.rotation.x, 0.12, 12, dt);
            bot.rig.rightKnee.rotation.x = THREE.MathUtils.damp(bot.rig.rightKnee.rotation.x, 0.12, 12, dt);
            bot.rig.leftAnkle.rotation.x = THREE.MathUtils.damp(bot.rig.leftAnkle.rotation.x, -0.06, 12, dt);
            bot.rig.rightAnkle.rotation.x = THREE.MathUtils.damp(bot.rig.rightAnkle.rotation.x, -0.06, 12, dt);
            bot.rig.leftLeg.rotation.z = THREE.MathUtils.damp(bot.rig.leftLeg.rotation.z, 0.03, 10, dt);
            bot.rig.rightLeg.rotation.z = THREE.MathUtils.damp(bot.rig.rightLeg.rotation.z, -0.03, 10, dt);

            bot.rig.pelvisGroup.rotation.y = THREE.MathUtils.damp(bot.rig.pelvisGroup.rotation.y, 0, 10, dt);
            bot.rig.torsoGroup.rotation.y = THREE.MathUtils.damp(bot.rig.torsoGroup.rotation.y, 0, 10, dt);
            bot.rig.torsoGroup.rotation.x = THREE.MathUtils.damp(
              bot.rig.torsoGroup.rotation.x,
              0.04 + idleBreathe * 0.015,
              10,
              dt
            );
            bot.rig.bodyGroup.position.y = idleBreathe * 0.014;
            bot.rig.bodyGroup.rotation.z = THREE.MathUtils.damp(bot.rig.bodyGroup.rotation.z, 0, 10, dt);

            bot.rig.leftArm.rotation.x = -0.62 + idleBreathe * 0.02;
            bot.rig.leftElbow.rotation.x = -0.78 + idleBreathe * 0.025;
            bot.rig.rightArm.rotation.x = -0.48 + idleBreathe * 0.015 - recoilKick;
            bot.rig.rightElbow.rotation.x = -1.02 - recoilKick * 0.6;
            bot.rig.headGroup.rotation.y = Math.sin(elapsed * 1.2) * 0.06;
            bot.rig.headGroup.rotation.x = 0;
          }

          // Continuous Mechanical Animations: Dorsal Cooling Turbine & Thruster Exhaust Pulse
          const rotorSpeed = !bot.grounded ? 26 : bSpeed > 0.45 ? 18 : 5;
          bot.rig.backRotor.rotation.z += dt * rotorSpeed;
          const speedRatio = THREE.MathUtils.clamp(bSpeed / 11, 0, 1.2);
          const flameLen =
            (!bot.grounded ? 1.85 : bSpeed > 0.45 ? 0.8 + speedRatio * 0.5 : 0.3) +
            Math.sin(elapsed * 34 + bot.walkPhase) * 0.14;
          const flameWidth = !bot.grounded ? 1.15 : bSpeed > 0.45 ? 0.92 : 0.68;
          bot.rig.leftThrusterFlame.scale.set(flameWidth, flameLen, flameWidth);
          bot.rig.rightThrusterFlame.scale.set(flameWidth, flameLen, flameWidth);

          if (bot.stunTimer <= 0) {
            bot.fireTimer -= dt;
            if (bot.fireTimer <= 0) {
              bot.fireTimer = diff.reactionSec + Math.random() * 0.26;

              bot.rig.muzzlePoint.getWorldPosition(_v2);
              const shotDist = Math.max(0.1, _v2.distanceTo(targetCenter));
              _v3.subVectors(targetCenter, _v2).normalize();
              const coverBlock = getCoverHitDistance(_v2, _v3, shotDist);

              if (coverBlock >= shotDist - 0.65) {
                bot.muzzleFlashTimer = 0.055;
                bot.rig.muzzleFlash.visible = true;
                bot.rig.muzzleFlash.rotation.z = Math.random() * Math.PI;
                spawnSmokePuff(_v2, 0xcbd5e1, 0.09, 0.28, 0.26, 0.14, 0.8);
                const camDist = _v2.distanceTo(camera.position);
                shooterAudio.playGunshot(
                  'assault_rifle',
                  Math.max(0.12, (1 - camDist / 65) * soundMixScale)
                );

                const tracerCol = bot.team === 'enemy' ? 0xf43f5e : 0x38bdf8;
                const hitRoll = Math.random();
                const effectiveAcc =
                  bot.team === 'ally' ? diff.accuracy * 0.94 : diff.accuracy;

                if (hitRoll < effectiveAcc) {
                  const headHit = hitRoll < effectiveAcc * 0.2;
                  const dmg = headHit ? 20 : 12;
                  spawnTracer(_v2, targetCenter, tracerCol, 0.025);
                  if (targetIsPlayer) {
                    damagePlayer(dmg, headHit, bot.name);
                  } else if (targetBot) {
                    damageBot(targetBot, dmg, headHit, targetCenter, bot.name, bot.team, false);
                  }
                } else {
                  _v3.x += (Math.random() - 0.5) * 0.16;
                  _v3.y += (Math.random() - 0.5) * 0.12;
                  _v3.z += (Math.random() - 0.5) * 0.16;
                  _v3.normalize();
                  _v1.copy(_v2).addScaledVector(_v3, Math.min(coverBlock, 45));
                  spawnTracer(_v2, _v1, tracerCol, 0.022);
                }
              }
            }
          }
        }

        // Update Thrown Grenades & Flashbangs
        for (let i = thrownItems.length - 1; i >= 0; i--) {
          const item = thrownItems[i];
          item.life -= dt;
          item.vel.y -= 22 * dt;
          item.mesh.position.addScaledVector(item.vel, dt);
          item.mesh.rotation.x += 6 * dt;
          item.mesh.rotation.z += 4 * dt;

          const fl =
            getMapFloorHeightAt(mapRef.current, item.mesh.position.x, item.mesh.position.z) + 0.18;
          if (item.mesh.position.y <= fl) {
            item.mesh.position.y = fl;
            item.vel.y *= -0.52;
            item.vel.x *= 0.75;
            item.vel.z *= 0.75;
          }

          if (item.life <= 0) {
            const expPos = item.mesh.position.clone();
            scene.remove(item.mesh);
            (item.mesh.material as THREE.Material).dispose();
            thrownItems.splice(i, 1);

            if (item.kind === 'grenade') {
              shooterAudio.playExplosion();
              spawnSparks(expPos, 0xf97316, 26);
              spawnDebris(expPos, mats.armorDark, 10);
              spawnShockwave(expPos, 0xf97316, 9.5);
              explosionLight.color.setHex(0xf97316);
              explosionLight.position.copy(expPos).add(new THREE.Vector3(0, 0.8, 0));
              explosionLight.intensity = 22;
              match.aberrationPulse = 0.0065;
              for (let s = 0; s < 8; s++) {
                _v2.copy(expPos).add(
                  new THREE.Vector3(
                    (Math.random() - 0.5) * 1.4,
                    0.3 + Math.random() * 0.6,
                    (Math.random() - 0.5) * 1.4
                  )
                );
                spawnSmokePuff(
                  _v2,
                  s % 2 === 0 ? 0x334155 : 0xf97316,
                  0.9,
                  3.2,
                  1.15 + Math.random() * 0.4,
                  0.52,
                  2.2
                );
              }
              for (const bot of bots) {
                if (!bot.active || bot.team !== 'enemy' || !bot.alive) continue;
                const d = expPos.distanceTo(_v1.set(bot.pos.x, bot.pos.y + 1.2, bot.pos.z));
                if (d < 7.5) {
                  const dmg = Math.round(78 * item.powerMult * (1 - d / 8.5));
                  damageBot(bot, dmg, false, _v1, 'YOU', 'ally', true);
                }
              }
            } else {
              shooterAudio.playHeal();
              spawnSparks(expPos, 0xfef08a, 18);
              spawnShockwave(expPos, 0xfef08a, 11.5);
              explosionLight.color.setHex(0xfef08a);
              explosionLight.position.copy(expPos).add(new THREE.Vector3(0, 0.8, 0));
              explosionLight.intensity = 26;
              for (const bot of bots) {
                if (!bot.active || bot.team !== 'enemy' || !bot.alive) continue;
                const d = expPos.distanceTo(_v1.set(bot.pos.x, bot.pos.y + 1.2, bot.pos.z));
                if (d < 11) {
                  bot.stunTimer = 2.4 * item.powerMult;
                }
              }
            }
          }
        }

        // Update Ejected Brass Shell Casings
        for (let i = shells.length - 1; i >= 0; i--) {
          const sh = shells[i];
          sh.life += dt;
          sh.vel.y -= 20 * dt;
          sh.mesh.position.addScaledVector(sh.vel, dt);
          sh.mesh.rotation.x += sh.rotVel.x * dt;
          sh.mesh.rotation.y += sh.rotVel.y * dt;
          sh.mesh.rotation.z += sh.rotVel.z * dt;

          const fl = getMapFloorHeightAt(mapRef.current, sh.mesh.position.x, sh.mesh.position.z) + 0.02;
          if (sh.mesh.position.y <= fl) {
            sh.mesh.position.y = fl;
            if (!sh.bounced) {
              sh.bounced = true;
              shooterAudio.playShellDrop();
            }
            sh.vel.y *= -0.4;
            sh.vel.x *= 0.55;
            sh.vel.z *= 0.55;
            sh.rotVel.multiplyScalar(0.5);
          }

          if (sh.life >= 5.5) {
            scene.remove(sh.mesh);
            shells.splice(i, 1);
          }
        }

        // Update 3D Tumbling Impact Debris Chips
        for (let i = debrisEntities.length - 1; i >= 0; i--) {
          const d = debrisEntities[i];
          d.life += dt;
          d.vel.y -= 22 * dt;
          d.mesh.position.addScaledVector(d.vel, dt);
          d.mesh.rotation.x += d.rotVel.x * dt;
          d.mesh.rotation.y += d.rotVel.y * dt;
          d.mesh.rotation.z += d.rotVel.z * dt;

          const fl = getMapFloorHeightAt(mapRef.current, d.mesh.position.x, d.mesh.position.z) + 0.025;
          if (d.mesh.position.y <= fl) {
            d.mesh.position.y = fl;
            d.vel.y *= -0.35;
            d.vel.x *= 0.6;
            d.vel.z *= 0.6;
            d.rotVel.multiplyScalar(0.55);
          }
          if (d.life >= d.maxLife) {
            scene.remove(d.mesh);
            debrisEntities.splice(i, 1);
          }
        }

        // Age Bullet Impact Decals
        for (let i = impacts.length - 1; i >= 0; i--) {
          const imp = impacts[i];
          imp.life += dt;
          if (imp.life >= imp.maxLife) {
            scene.remove(imp.mesh);
            impacts.splice(i, 1);
          }
        }

        // Update Tracers
        for (let i = tracers.length - 1; i >= 0; i--) {
          const t = tracers[i];
          t.life += dt;
          (t.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
            0,
            1 - t.life / t.maxLife
          );
          if (t.life >= t.maxLife) {
            scene.remove(t.mesh);
            t.mesh.geometry.dispose();
            (t.mesh.material as THREE.Material).dispose();
            tracers.splice(i, 1);
          }
        }

        // Update Sparks
        for (let i = sparks.length - 1; i >= 0; i--) {
          const sp = sparks[i];
          sp.life += dt;
          sp.vel.y -= 18 * dt;
          sp.mesh.position.addScaledVector(sp.vel, dt);
          sp.mesh.scale.setScalar(Math.max(0.01, 1 - sp.life / sp.maxLife));
          if (sp.life >= sp.maxLife) {
            scene.remove(sp.mesh);
            (sp.mesh.material as THREE.Material).dispose();
            sparks.splice(i, 1);
          }
        }

        // Update Smoke Puffs
        for (let i = smokes.length - 1; i >= 0; i--) {
          const sm = smokes[i];
          sm.life += dt;
          const p = Math.min(1, sm.life / sm.maxLife);
          sm.sprite.position.addScaledVector(sm.vel, dt);
          sm.vel.multiplyScalar(0.96);
          const sc = THREE.MathUtils.lerp(sm.startScale, sm.endScale, p);
          sm.sprite.scale.setScalar(sc);
          sm.sprite.material.opacity = sm.baseOpacity * (1 - p);
          if (sm.life >= sm.maxLife) {
            scene.remove(sm.sprite);
            sm.sprite.material.dispose();
            smokes.splice(i, 1);
          }
        }

        // Update Shockwave Rings
        for (let i = shockwaves.length - 1; i >= 0; i--) {
          const sw = shockwaves[i];
          sw.life += dt;
          const p = Math.min(1, sw.life / sw.maxLife);
          const eased = 1 - Math.pow(1 - p, 2);
          sw.mesh.scale.setScalar(0.35 + eased * sw.maxScale);
          (sw.mesh.material as THREE.MeshBasicMaterial).opacity = 0.88 * (1 - p);
          if (sw.life >= sw.maxLife) {
            scene.remove(sw.mesh);
            (sw.mesh.material as THREE.Material).dispose();
            shockwaves.splice(i, 1);
          }
        }

        // Age Damage Popups
        for (let i = popups.length - 1; i >= 0; i--) {
          popups[i].age += dt;
          if (popups[i].age > 0.75) popups.splice(i, 1);
        }

        // Update 3D Knowledge Orb & Educational Fact Toast
        const orbBaseY = getOrbBaseY(mapRef.current);
        knowledgeOrbGroup.position.set(0, orbBaseY + Math.sin(elapsed * 2.8) * 0.2, 0);
        orbCoreMesh.rotation.y = elapsed * 1.8;
        orbRingMesh.rotation.x = elapsed * 1.4;
        orbRingMesh.rotation.z = elapsed * 1.1;
        orbRing2Mesh.rotation.y = -elapsed * 1.6;
        orbRing2Mesh.rotation.x = Math.cos(elapsed * 1.2) * 0.8;

        if (match.orbActive && player.alive) {
          const distToOrb = _v1
            .set(player.pos.x, player.pos.y - player.eyeHeight * 0.5, player.pos.z)
            .distanceTo(knowledgeOrbGroup.position);
          if (distToOrb < 2.5) {
            match.orbActive = false;
            match.orbRespawnTimer = 16;
            knowledgeOrbGroup.visible = false;
            player.hp = Math.min(match.playerMaxHp, player.hp + 20);
            for (const bot of bots) {
              if (bot.active && bot.team === 'ally' && bot.alive) {
                bot.hp = Math.min(bot.maxHp, bot.hp + 15);
              }
            }
            const utilSpec = resolveUtilitySpec(
              UTILITY_ITEMS[loadoutRef.current.utility],
              weaponBuildsRef.current[loadoutRef.current.utility]
            );
            const maxCharges = utilSpec.charges + (match.activePerk?.extraUtility ?? 0);
            if (match.utilityCharges < maxCharges) match.utilityCharges += 1;
            match.factToast = pickArenaFact(subjectRef.current, classLevelRef.current);
            match.factToastTimer = 5.0;
            shooterAudio.playHeal();
            spawnSparks(knowledgeOrbGroup.position, 0x38bdf8, 18);
            spawnShockwave(knowledgeOrbGroup.position, 0x38bdf8, 4.2);
            pushHud();
          }
        } else {
          match.orbRespawnTimer -= dt;
          if (match.orbRespawnTimer <= 0) {
            match.orbActive = true;
            knowledgeOrbGroup.visible = true;
          }
        }

        if (match.factToastTimer > 0) {
          match.factToastTimer -= dt;
          if (match.factToastTimer <= 0) {
            match.factToast = null;
          }
        }

        hudAccum += dt;
        if (hudAccum >= 0.045) {
          hudAccum = 0;
          pushHud();
        }
      }

      if (composer && !isSoftwareGl) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    if (isSoftwareGl) afterDraw(tick);
    else frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);

      document.removeEventListener('pointerlockchange', onPointerLockChange);
      window.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      clearDynamicObjects();
      disposeGroup(arenaGroup);
      skyGeo.dispose();
      skyMat.dispose();
      skyTex.dispose();
      orbGeo.dispose();
      orbMat.dispose();
      orbRingGeo.dispose();
      orbRingMat.dispose();
      orbRing2Geo.dispose();
      orbRing2Mat.dispose();
      terrainGeo.dispose();
      terrainMat.dispose();
      disposeTextureSet(floorTexSet);
      disposeTextureSet(grassTexSet);
      disposeTextureSet(dirtTexSet);
      floorMarkingsTex.dispose();
      disposeTextureSet(bridgeTexSet);
      disposeTextureSet(gunmetalTexSet);
      disposeTextureSet(fabricTexSet);
      disposeTextureSet(concreteTexSet);
      disposeTextureSet(rockTexSet);
      disposeTextureSet(barkTexSet);
      disposeTextureSet(containerASet);
      disposeTextureSet(containerBSet);
      disposeTextureSet(neutralSet);
      shadowTex.dispose();
      particleTex.dispose();
      dustGeo.dispose();
      dustMat.dispose();
      spireGeo.dispose();
      treeTrunkGeo.dispose();
      treeTrunkMat.dispose();
      treeCrownGeo.dispose();
      treeCrownMat.dispose();
      grassTuftGeo.dispose();
      grassTuftMat.dispose();
      pebbleGeo.dispose();
      pebbleMat.dispose();
      sparkGeo.dispose();
      debrisGeo.dispose();
      shellGeo.dispose();
      impactGeo.dispose();
      shockwaveGeo.dispose();
      impactMat.dispose();
      grenadeGeo.dispose();
      adsLaserGeo.dispose();
      adsLaserMat.dispose();
      Object.values(mats).forEach((m) => m.dispose());
      envTarget.dispose();
      composerTarget?.dispose();
      composer?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const accuracyPct =
    hud.shotsFired > 0 ? Math.round((hud.shotsHit / hud.shotsFired) * 100) : 0;

  const activeWeaponName =
    hud.activeSlot === 0
      ? PRIMARY_WEAPONS[loadout.primary].name
      : hud.activeSlot === 1
      ? SECONDARY_WEAPONS[loadout.secondary].name
      : hud.activeSlot === 2
      ? MELEE_WEAPONS[loadout.melee].name
      : UTILITY_ITEMS[loadout.utility].name;

  const resolvedPrimary = resolveGunSpec(
    PRIMARY_WEAPONS[loadout.primary],
    weaponBuilds[loadout.primary]
  );
  const resolvedSecondary = resolveGunSpec(
    SECONDARY_WEAPONS[loadout.secondary],
    weaponBuilds[loadout.secondary]
  );

  const activeAmmoText =
    hud.activeSlot === 0
      ? `${hud.primaryAmmo} / ${resolvedPrimary.magSize}`
      : hud.activeSlot === 1
      ? `${hud.secondaryAmmo} / ${resolvedSecondary.magSize}`
      : hud.activeSlot === 2
      ? 'MELEE'
      : `${hud.utilityCharges} LEFT`;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-900 text-white select-none">
      {/* Isolated WebGL Viewport Container */}
      <div ref={mountRef} className="absolute inset-0 h-full w-full" />

      {webglError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950 p-6 text-center">
          <div className="max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="font-display text-xl font-bold text-white">3D Viewport Unavailable</h2>
            <p className="mt-2 text-sm text-slate-300">{webglError}</p>
          </div>
        </div>
      )}

      {/* Damage Flash Vignette */}
      {(gameState === 'PLAYING' || gameState === 'ROUND_END') && hud.damageFlash > 0.02 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 border-[18px] border-rose-500/60"
          style={{ opacity: hud.damageFlash }}
        />
      )}

      {/* ACTIVE DUEL HUD (Zero backdrop-filter over WebGL!) */}
      {(gameState === 'PLAYING' || gameState === 'ROUND_END') && (
        <>
          {/* Top-Center RIVALS Team Scoreboard */}
          <div className="pointer-events-none fixed top-4 left-1/2 z-20 -translate-x-1/2 flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-950/90 px-5 py-2.5 shadow-lg">
              {/* Blue Team Score + Pips */}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-display text-xs font-bold text-sky-400">
                    {hud.teamSize === 1 ? 'YOU' : `BLUE (${hud.alliesAlive})`}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {Array.from({ length: ROUNDS_TO_WIN }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-2 w-3.5 rounded-xs ${
                          i < hud.playerRounds ? 'bg-sky-400' : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <span className="font-mono text-2xl font-bold text-white tabular-nums">
                  {hud.playerRounds}
                </span>
              </div>

              <div className="border-x border-slate-800 px-3 text-center">
                <div className="font-mono text-[10px] text-slate-400">
                  {hud.teamSize}v{hud.teamSize} · {ARENA_MAPS[selectedMap].name.toUpperCase()} · R{hud.roundNumber}
                </div>
                <div className="font-mono text-base font-bold text-white tabular-nums">
                  0:{String(hud.roundTimer).padStart(2, '0')}
                </div>
              </div>

              {/* Crimson Team Score + Pips */}
              <div className="flex items-center gap-3">
                <span className="font-mono text-2xl font-bold text-white tabular-nums">
                  {hud.rivalRounds}
                </span>
                <div className="text-left">
                  <div className="font-display text-xs font-bold text-rose-400">
                    {hud.teamSize === 1 ? 'RIVAL' : `RIVAL (${hud.enemiesAlive})`}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {Array.from({ length: ROUNDS_TO_WIN }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-2 w-3.5 rounded-xs ${
                          i < hud.rivalRounds ? 'bg-rose-500' : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Compact Squad Alive Indicators (2v2 - 5v5) */}
            {hud.teamSize > 1 && (
              <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/85 px-3 py-1">
                <div className="flex items-center gap-1">
                  {hud.allyRoster.map((m) => (
                    <div
                      key={m.id}
                      title={`${m.name}: ${m.alive ? `${m.hp} HP` : 'DOWN'}`}
                      className={`h-2 w-5 rounded-xs transition-colors ${
                        m.alive
                          ? m.isPlayer
                            ? 'bg-sky-400 ring-1 ring-white/60'
                            : 'bg-sky-500'
                          : 'bg-slate-800'
                      }`}
                    />
                  ))}
                </div>
                <span className="font-mono text-[10px] font-bold text-slate-400 tabular-nums">
                  {hud.alliesAlive}v{hud.enemiesAlive}
                </span>
                <div className="flex items-center gap-1">
                  {hud.enemyRoster.map((m) => (
                    <div
                      key={m.id}
                      title={`${m.name}: ${m.alive ? `${m.hp} HP` : 'DOWN'}`}
                      className={`h-2 w-5 rounded-xs transition-colors ${
                        m.alive ? 'bg-rose-500' : 'bg-slate-800'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Top-Right Compact Team Kill Feed */}
          {hud.killFeed.length > 0 && (
            <div className="pointer-events-none fixed top-4 right-4 z-20 flex flex-col items-end gap-1">
              {hud.killFeed.map((kf) => (
                <div
                  key={kf.id}
                  className="flex items-center gap-1.5 rounded border border-slate-800 bg-slate-950/85 px-2.5 py-1 font-mono text-[11px]"
                >
                  <span className={kf.killerTeam === 'ally' ? 'text-sky-400 font-bold' : 'text-rose-400 font-bold'}>
                    {kf.killerName}
                  </span>
                  <span className="text-slate-400">{kf.headshot ? '[HS]' : '->'}</span>
                  <span className={kf.victimTeam === 'ally' ? 'text-sky-300' : 'text-rose-300'}>
                    {kf.victimName}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Overhead Floating HP & Team Bars for Allies and Enemies */}
          {hud.overheadMarkers.map((m) => {
            const isAlly = m.team === 'ally';
            return (
              <div
                key={m.id}
                className="pointer-events-none fixed z-20 -translate-x-1/2 -translate-y-full"
                style={{
                  left: `${m.x * 100}%`,
                  top: `${m.y * 100}%`,
                }}
              >
                <div
                  className={`rounded bg-slate-950/85 px-2 py-1 text-center border ${
                    isAlly ? 'border-sky-500/45' : 'border-rose-500/45'
                  }`}
                >
                  <div
                    className={`font-mono text-[10px] font-bold tabular-nums ${
                      isAlly ? 'text-sky-300' : 'text-rose-300'
                    }`}
                  >
                    {isAlly ? 'ALLY' : 'RIVAL'} · {m.name} · {m.hp}
                  </div>
                  <div className="mt-0.5 h-1.5 w-20 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full transition-all duration-75 ${
                        isAlly ? 'bg-sky-400' : 'bg-rose-500'
                      }`}
                      style={{ width: `${(m.hp / m.maxHp) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Floating Damage Numbers */}
          {hud.damagePopups.map((p) => (
            <div
              key={p.id}
              className={`pointer-events-none fixed z-20 -translate-x-1/2 -translate-y-1/2 font-mono font-bold tabular-nums ${
                p.crit ? 'text-lg text-amber-300' : 'text-sm text-white'
              }`}
              style={{
                left: `${p.x * 100}%`,
                top: `${p.y * 100}%`,
                textShadow: '0 2px 6px rgba(0,0,0,0.9)',
              }}
            >
              -{p.amount}
              {p.crit ? '!' : ''}
            </div>
          ))}

          {/* Round Transition Banner & Post-Round Exit Option */}
          {gameState === 'ROUND_END' ? (
            <div className="fixed top-24 left-1/2 z-30 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-950/95 px-6 py-4 text-center shadow-2xl min-w-[290px]">
              <div className="font-display text-base font-bold tracking-wide text-white">
                {hud.roundBanner ?? `ROUND ${hud.roundNumber} COMPLETE`}
              </div>
              <div className="mt-1 font-mono text-xs text-slate-400">
                YOU {hud.playerRounds} — {hud.rivalRounds} RIVAL
              </div>
              <div className="mt-3 flex items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => openRoundQuiz(hud.roundNumber + 1)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 cursor-pointer whitespace-nowrap"
                >
                  <Play className="h-3.5 w-3.5" />
                  Next Round
                </button>
                <button
                  type="button"
                  onClick={exitToLobby}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/50 bg-rose-950/60 px-3.5 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-900/70 cursor-pointer whitespace-nowrap"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Exit Match
                </button>
              </div>
            </div>
          ) : (
            hud.roundBanner && (
              <div className="pointer-events-none fixed top-24 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-950/95 px-6 py-2.5 text-center shadow-lg">
                <div className="font-display text-base font-bold tracking-wide text-white">
                  {hud.roundBanner}
                </div>
              </div>
            )
          )}

          {/* Active Knowledge Overcharge Perk (Top-Left) */}
          {hud.activePerkLabel && (
            <div className="pointer-events-none fixed top-4 left-4 z-20 flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-slate-950/90 px-3 py-1.5 text-xs font-semibold text-emerald-300 shadow-lg">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              {hud.activePerkLabel}
            </div>
          )}

          {/* Collected 3D Knowledge Orb Fact Toast */}
          {hud.factToast && (
            <div className="pointer-events-none fixed top-36 left-1/2 z-20 max-w-md -translate-x-1/2 rounded-xl border border-sky-500/50 bg-slate-950/95 px-4 py-2.5 text-center shadow-xl">
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-sky-400">
                <BookOpen className="h-3.5 w-3.5" />
                KNOWLEDGE ORB (+20 HP) · {hud.factToast.subjectLabel.toUpperCase()}
              </div>
              <div className="mt-1 text-xs text-slate-200 leading-snug">{hud.factToast.fact}</div>
            </div>
          )}

          {/* Realistic Mil-Dot Scope Overlay when ADS with Scope Optic */}
          {hud.ads &&
            ((hud.activeSlot === 0 && resolvedPrimary.optic === 'scope') ||
              (hud.activeSlot === 1 && resolvedSecondary.optic === 'scope')) && (
            <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center">
              <div className="h-[74vh] w-[74vh] rounded-full border-4 border-slate-900 ring-2 ring-emerald-400/60 shadow-[0_0_0_9999px_rgba(2,6,23,0.82)] relative overflow-hidden">
                <div className="absolute inset-x-0 top-1/2 h-px bg-emerald-400/65" />
                <div className="absolute inset-y-0 left-1/2 w-px bg-emerald-400/65" />
                <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500" />
                {[-3, -2, -1, 1, 2, 3].map((step) => (
                  <div
                    key={`h-${step}`}
                    className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-emerald-300/75"
                    style={{ left: `${50 + step * 7}%` }}
                  />
                ))}
                {[-3, -2, -1, 1, 2, 3].map((step) => (
                  <div
                    key={`v-${step}`}
                    className="absolute left-1/2 h-px w-2 -translate-x-1/2 bg-emerald-300/75"
                    style={{ top: `${50 + step * 7}%` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Dynamic Center Crosshair + Hitmarker (hidden while spectating) */}
          {hud.playerAlive && (
            <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center">
              <CrosshairReticle
                config={crosshairConfig}
                ads={hud.ads}
                sliding={hud.sliding}
                reloading={hud.reloading}
                hitMarker={hud.hitMarker}
              />
            </div>
          )}

          {/* Bottom-Left Player HP & Slide Status */}
          <div className="pointer-events-none fixed bottom-5 left-5 z-20 rounded-xl border border-slate-700 bg-slate-950/90 px-4 py-3 min-w-[210px]">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-2xl font-bold text-white tabular-nums">
                {hud.playerHp}
              </span>
              <span className="font-mono text-xs text-slate-400">/ {hud.maxHp} HP</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full transition-all duration-75 ${
                  hud.playerHp > 50 ? 'bg-emerald-400' : 'bg-rose-500'
                }`}
                style={{ width: `${(hud.playerHp / hud.maxHp) * 100}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-slate-400">
              <span>{hud.sliding ? 'SLIDING' : hud.dashReady ? 'SLIDE READY (C)' : 'RECOVERING'}</span>
              <span>{hud.pointerLocked ? 'LOCKED' : 'CLICK ARENA'}</span>
            </div>
          </div>

          {/* Bottom-Right Active Weapon & Ammo */}
          <div className="pointer-events-none fixed bottom-5 right-5 z-20 rounded-xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-right min-w-[190px]">
            <div className="flex items-center justify-end gap-2">
              {hud.ads && (
                <span className="font-mono text-[10px] font-bold text-amber-300">AIMING (E)</span>
              )}
              <span className="text-xs font-semibold text-sky-400">{activeWeaponName}</span>
            </div>
            <div className="mt-0.5 font-mono text-2xl font-bold text-white tabular-nums">
              {hud.reloading ? 'RELOAD' : activeAmmoText}
            </div>
            <div className="mt-1 font-mono text-[11px] text-slate-400">
              Hold E / Right-Click Aim · R Reload
            </div>
          </div>
        </>
      )}

      {/* COLLAPSIBLE UNIFIED 4-SLOT HOTBAR DOCK */}
      {gameState === 'PLAYING' && (
        <div
          className={`fixed left-1/2 z-30 -translate-x-1/2 transition-transform duration-200 ${
            dockCollapsed ? 'translate-y-[calc(100%-30px)]' : 'translate-y-0'
          }`}
          style={{ bottom: '16px', maxWidth: 'min(760px, 92vw)' }}
        >
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setDockCollapsed((c) => !c)}
              className="inline-flex items-center gap-1 rounded-t-lg border border-b-0 border-slate-700 bg-slate-950/95 px-3 py-0.5 text-[11px] font-medium text-slate-300 hover:text-white cursor-pointer whitespace-nowrap"
            >
              {dockCollapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {dockCollapsed ? 'Hotbar (H)' : 'Hide (H)'}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950/95 px-3 py-2 shadow-xl">
            {(
              [
                { slot: 0 as SlotIndex, label: PRIMARY_WEAPONS[loadout.primary].name },
                { slot: 1 as SlotIndex, label: SECONDARY_WEAPONS[loadout.secondary].name },
                { slot: 2 as SlotIndex, label: MELEE_WEAPONS[loadout.melee].name },
                { slot: 3 as SlotIndex, label: UTILITY_ITEMS[loadout.utility].name },
              ] as const
            ).map((item) => {
              const active = hud.activeSlot === item.slot;
              return (
                <button
                  key={item.slot}
                  type="button"
                  onClick={() => apiRef.current?.selectSlot(item.slot)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span className="font-mono opacity-75 mr-1.5">{item.slot + 1}</span>
                  {item.label}
                </button>
              );
            })}

            <div className="mx-1 h-5 w-px bg-slate-800" />

            <button
              type="button"
              onClick={toggleMute}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-700 cursor-pointer whitespace-nowrap"
            >
              {soundMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>

            <button
              type="button"
              onClick={pauseDuel}
              title="Pause Duel (P)"
              className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-700 cursor-pointer whitespace-nowrap"
            >
              <Pause className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={exitToLobby}
              title="Exit to Lobby"
              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-950/60 px-2.5 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-900/70 cursor-pointer whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              Exit
            </button>
          </div>
        </div>
      )}

      {/* RIVALS EDUCATIONAL LOADOUT LOBBY / TITLE MENU */}
      {gameState === 'TITLE_MENU' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl max-h-[94vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/95 p-5 sm:p-7 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400">
                  <GraduationCap className="h-4 w-4" />
                  Cambridge Curriculum · Class 1–10 · 1v1–5v5 Arena · First to 5 Rounds
                </div>
                <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
                  Shell Shockers
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-right font-mono text-xs">
                <button
                  type="button"
                  onClick={() => openWorkshopFor(loadout.primary)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/50 bg-sky-950/60 px-3 py-2 font-sans text-xs font-semibold text-sky-300 hover:bg-sky-900/70 cursor-pointer whitespace-nowrap"
                >
                  <Wrench className="h-3.5 w-3.5" />
                  Weapon Templates
                </button>
                <button
                  type="button"
                  onClick={() => setCrosshairModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-950/60 px-3 py-2 font-sans text-xs font-semibold text-amber-300 hover:bg-amber-900/70 cursor-pointer whitespace-nowrap"
                >
                  <Crosshair className="h-3.5 w-3.5" />
                  Crosshair
                </button>
                <button
                  type="button"
                  onClick={() => setQaModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-950/60 px-3 py-2 font-sans text-xs font-semibold text-emerald-300 hover:bg-emerald-900/70 cursor-pointer whitespace-nowrap"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Cambridge Q&A (Class {classLevel})
                </button>
                <div>
                  <div className="text-slate-400">WINS</div>
                  <div className="text-lg font-bold text-emerald-400 tabular-nums">
                    {career.wins}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">STREAK</div>
                  <div className="text-lg font-bold text-amber-400 tabular-nums">
                    {career.winStreak}
                  </div>
                </div>
              </div>
            </div>

            {/* Class 6-10 Selector */}
            <div className="mt-4">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-400">Select Class (6–10)</span>
                <span className="font-mono text-[11px] font-semibold text-sky-400">
                  {getCambridgeStageLabel(classLevel)}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {CLASS_LEVELS.map((cls) => {
                  const active = classLevel === cls;
                  return (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setClassLevel(cls)}
                      className={`rounded-lg border py-1.5 text-center font-mono text-xs font-bold transition-colors cursor-pointer ${
                        active
                          ? 'border-sky-400 bg-sky-600 text-white'
                          : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      C{cls}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cambridge Subject Selector */}
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-semibold text-slate-400">
                Cambridge Subject (Pre-Round Overcharge Q&A)
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-6">
                {(Object.keys(SUBJECTS) as SubjectId[]).map((subId) => {
                  const active = subject === subId;
                  return (
                    <button
                      key={subId}
                      type="button"
                      onClick={() => setSubject(subId)}
                      className={`rounded-lg border px-2 py-2 text-center text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'border-emerald-500 bg-emerald-600 text-white'
                          : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500'
                      }`}
                    >
                      {SUBJECTS[subId].label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Arena Map Selector (Live 3D Preview Behind Lobby) */}
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-semibold text-slate-400">Arena Map</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(Object.keys(ARENA_MAPS) as MapId[]).map((mapId) => {
                  const map = ARENA_MAPS[mapId];
                  const active = selectedMap === mapId;
                  return (
                    <button
                      key={mapId}
                      type="button"
                      onClick={() => setSelectedMap(mapId)}
                      className={`rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer ${
                        active
                          ? 'border-sky-500 bg-sky-600 text-white'
                          : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500'
                      }`}
                    >
                      <div className="text-xs font-bold">{map.name}</div>
                      <div
                        className={`mt-0.5 text-[10px] leading-tight ${
                          active ? 'text-sky-100' : 'text-slate-400'
                        }`}
                      >
                        {map.tagline}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4-Slot Loadout Customizer */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {/* Primary */}
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-400">1 · Primary Weapon</span>
                  <button
                    type="button"
                    onClick={() => openWorkshopFor(loadout.primary)}
                    className="inline-flex items-center gap-1 font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                    Customize
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.keys(PRIMARY_WEAPONS) as PrimaryId[]).map((id) => {
                    const b = weaponBuilds[id];
                    const active = loadout.primary === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setLoadout((l) => ({ ...l, primary: id }))}
                        className={`rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer ${
                          active
                            ? 'border-sky-500 bg-sky-600 text-white'
                            : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full border border-white/30"
                            style={{ backgroundColor: b.colorHex }}
                          />
                          <span className="truncate">{PRIMARY_WEAPONS[id].name}</span>
                        </div>
                        <div
                          className={`mt-0.5 truncate text-[10px] ${
                            active ? 'text-sky-100' : 'text-slate-400'
                          }`}
                        >
                          {b.templateName}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Secondary */}
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-400">2 · Secondary Sidearm</span>
                  <button
                    type="button"
                    onClick={() => openWorkshopFor(loadout.secondary)}
                    className="inline-flex items-center gap-1 font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                    Customize
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(SECONDARY_WEAPONS) as SecondaryId[]).map((id) => {
                    const b = weaponBuilds[id];
                    const active = loadout.secondary === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setLoadout((l) => ({ ...l, secondary: id }))}
                        className={`rounded-lg border px-2 py-2 text-left transition-colors cursor-pointer ${
                          active
                            ? 'border-sky-500 bg-sky-600 text-white'
                            : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-center gap-1 text-xs font-semibold">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full border border-white/30"
                            style={{ backgroundColor: b.colorHex }}
                          />
                          <span className="truncate">{SECONDARY_WEAPONS[id].name}</span>
                        </div>
                        <div
                          className={`mt-0.5 truncate text-[10px] ${
                            active ? 'text-sky-100' : 'text-slate-400'
                          }`}
                        >
                          {b.templateName}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Melee */}
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-400">3 · Melee (Speed + Lunge)</span>
                  <button
                    type="button"
                    onClick={() => openWorkshopFor(loadout.melee)}
                    className="inline-flex items-center gap-1 font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                    Customize
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(MELEE_WEAPONS) as MeleeId[]).map((id) => {
                    const b = weaponBuilds[id];
                    const active = loadout.melee === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setLoadout((l) => ({ ...l, melee: id }))}
                        className={`rounded-lg border px-2 py-2 text-left transition-colors cursor-pointer ${
                          active
                            ? 'border-sky-500 bg-sky-600 text-white'
                            : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-center gap-1 text-xs font-semibold">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full border border-white/30"
                            style={{ backgroundColor: b.colorHex }}
                          />
                          <span className="truncate">{MELEE_WEAPONS[id].name}</span>
                        </div>
                        <div
                          className={`mt-0.5 truncate text-[10px] ${
                            active ? 'text-sky-100' : 'text-slate-400'
                          }`}
                        >
                          {b.templateName}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Utility */}
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-400">4 · Tactical Utility</span>
                  <button
                    type="button"
                    onClick={() => openWorkshopFor(loadout.utility)}
                    className="inline-flex items-center gap-1 font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                    Customize
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(UTILITY_ITEMS) as UtilityId[]).map((id) => {
                    const b = weaponBuilds[id];
                    const active = loadout.utility === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setLoadout((l) => ({ ...l, utility: id }))}
                        className={`rounded-lg border px-2 py-2 text-left transition-colors cursor-pointer ${
                          active
                            ? 'border-sky-500 bg-sky-600 text-white'
                            : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-center gap-1 text-xs font-semibold">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full border border-white/30"
                            style={{ backgroundColor: b.colorHex }}
                          />
                          <span className="truncate">{UTILITY_ITEMS[id].name}</span>
                        </div>
                        <div
                          className={`mt-0.5 truncate text-[10px] ${
                            active ? 'text-sky-100' : 'text-slate-400'
                          }`}
                        >
                          {b.templateName}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Squad Mode (1v1 - 5v5), Rival AI Skill Tier & Start */}
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-slate-800 pt-4">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                    <Users className="h-3.5 w-3.5 text-sky-400" />
                    Squad Mode (1v1 – 5v5)
                  </div>
                  <div className="flex items-center gap-1.5">
                    {TEAM_SIZES.map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setTeamSize(sz)}
                        className={`rounded-lg border px-2.5 py-1.5 font-mono text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                          teamSize === sz
                            ? 'border-sky-400 bg-sky-600 text-white'
                            : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {sz}v{sz}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-xs font-semibold text-slate-400">Rival AI Rank</div>
                  <div className="flex items-center gap-1.5">
                    {(['rookie', 'ranked', 'nemesis'] as DifficultyId[]).map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setDifficulty(id)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                          difficulty === id
                            ? 'border-rose-500 bg-rose-600 text-white'
                            : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {DIFFICULTIES[id].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={toggleGraphicsMode}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-950/60 px-3 py-2.5 text-xs font-semibold text-sky-300 hover:bg-sky-900/70 cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="h-4 w-4" />
                  Graphics: {graphicsMode === 'ultra' ? 'Ultra' : 'Standard'}
                </button>

                <button
                  type="button"
                  onClick={toggleMute}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs font-medium text-slate-200 hover:bg-slate-700 cursor-pointer whitespace-nowrap"
                >
                  {soundMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  {soundMuted ? 'Sound Off' : 'Sound On'}
                </button>

                <button
                  type="button"
                  onClick={startDuel}
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Play className="h-4 w-4" />
                  {teamSize === 1 ? 'Start 1v1 Duel' : `Start ${teamSize}v${teamSize} Match`}
                </button>
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-400">
              Controls: WASD Move · C Slide · C+Space Slide-Jump · Hold E / Right-Click Aim · 1–4 Loadout · R Reload · Collect Center Orb (+20 HP & Facts)
            </div>
          </div>
        </div>
      )}

      {/* WEAPON TEMPLATES & FULL CUSTOMIZER MODAL (ALL 13 WEAPONS) */}
      {gameState === 'TITLE_MENU' && workshopOpen && (() => {
        const activeCat = getWeaponCategory(workshopWeaponId);
        const activeBuild = weaponBuilds[workshopWeaponId];
        const builtinTemplates = getTemplatesForWeapon(workshopWeaponId);
        const savedForWeapon = userTemplates.filter((t) => t.weaponId === workshopWeaponId);
        const activeMeta = ALL_WEAPON_LIST.find((w) => w.id === workshopWeaponId)!;
        const isEquipped =
          loadout.primary === workshopWeaponId ||
          loadout.secondary === workshopWeaponId ||
          loadout.melee === workshopWeaponId ||
          loadout.utility === workshopWeaponId;

        const resolvedGun =
          activeCat === 'primary'
            ? resolveGunSpec(PRIMARY_WEAPONS[workshopWeaponId as PrimaryId], activeBuild)
            : activeCat === 'secondary'
              ? resolveGunSpec(SECONDARY_WEAPONS[workshopWeaponId as SecondaryId], activeBuild)
              : null;
        const resolvedMelee =
          activeCat === 'melee'
            ? resolveMeleeSpec(MELEE_WEAPONS[workshopWeaponId as MeleeId], activeBuild)
            : null;
        const resolvedUtility =
          activeCat === 'utility'
            ? resolveUtilitySpec(UTILITY_ITEMS[workshopWeaponId as UtilityId], activeBuild)
            : null;

        return (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/85 p-3 sm:p-4 overflow-y-auto">
            <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-xl border border-slate-700 bg-slate-900 p-4 sm:p-6 shadow-2xl">
              {/* Top Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400">
                    <Wrench className="h-4 w-4" />
                    Weapon Armory &amp; Templates · {activeCat.toUpperCase()}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2.5">
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-white/40"
                      style={{ backgroundColor: activeBuild.colorHex }}
                    />
                    <h2 className="font-display text-2xl font-bold text-white">
                      {activeMeta.name}
                    </h2>
                    <span className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                      {activeBuild.templateName}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!isEquipped ? (
                    <button
                      type="button"
                      onClick={() => equipWeaponInLoadout(workshopWeaponId)}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 cursor-pointer"
                    >
                      Equip in Loadout
                    </button>
                  ) : (
                    <span className="rounded-lg border border-emerald-500/40 bg-emerald-950/60 px-3 py-2 text-xs font-semibold text-emerald-300">
                      Equipped
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      updateWeaponBuild(
                        workshopWeaponId,
                        getDefaultWeaponBuild(workshopWeaponId),
                        false
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkshopOpen(false)}
                    className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>

              {/* All 13 Weapons Switcher */}
              <div className="mt-3 flex flex-wrap gap-1.5 border-b border-slate-800 pb-3">
                {ALL_WEAPON_LIST.map((w) => {
                  const selected = w.id === workshopWeaponId;
                  const equipped =
                    loadout.primary === w.id ||
                    loadout.secondary === w.id ||
                    loadout.melee === w.id ||
                    loadout.utility === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setWorkshopWeaponId(w.id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                        selected
                          ? 'border-sky-400 bg-sky-600 text-white'
                          : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <span
                        className="h-2 w-2 rounded-full border border-white/30"
                        style={{ backgroundColor: weaponBuilds[w.id].colorHex }}
                      />
                      <span>{w.name}</span>
                      {equipped && (
                        <span
                          className={`text-[9px] font-mono uppercase ${
                            selected ? 'text-sky-100' : 'text-emerald-400'
                          }`}
                        >
                          · EQ
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Main 2-Column Customizer Body */}
              <div className="mt-3 grid flex-1 gap-4 overflow-y-auto pr-1 lg:grid-cols-[310px_1fr]">
                {/* Left Column: Templates & Saved Presets */}
                <div className="space-y-3">
                  <div>
                    <div className="mb-1.5 text-xs font-semibold text-slate-400">
                      Built-In Weapon Templates
                    </div>
                    <div className="space-y-1.5">
                      {builtinTemplates.map((tpl) => {
                        const isTplActive = activeBuild.templateId === tpl.id;
                        return (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() =>
                              updateWeaponBuild(
                                workshopWeaponId,
                                applyTemplateToBuild(workshopWeaponId, tpl),
                                false
                              )
                            }
                            className={`w-full rounded-lg border p-2.5 text-left transition-colors cursor-pointer ${
                              isTplActive
                                ? 'border-sky-400 bg-sky-950/70 text-white'
                                : 'border-slate-700 bg-slate-800/80 text-slate-200 hover:border-slate-500'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold">{tpl.name}</span>
                              {tpl.patch.colorHex && (
                                <span
                                  className="h-2.5 w-2.5 rounded-full border border-white/40"
                                  style={{ backgroundColor: tpl.patch.colorHex }}
                                />
                              )}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-400">
                              {tpl.subtitle}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Save Current Custom Build as User Template */}
                  <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">
                    <div className="mb-1.5 text-xs font-semibold text-slate-300">
                      Save Custom Template
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={customTemplateName}
                        onChange={(e) => setCustomTemplateName(e.target.value)}
                        placeholder={`e.g. My ${activeMeta.name}`}
                        maxLength={28}
                        className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={saveCurrentAsUserTemplate}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 cursor-pointer"
                      >
                        <Save className="h-3.5 w-3.5" />
                        Save
                      </button>
                    </div>

                    {savedForWeapon.length > 0 && (
                      <div className="mt-2.5 space-y-1.5">
                        <div className="text-[11px] font-semibold text-slate-400">
                          Your Saved Templates
                        </div>
                        {savedForWeapon.map((tpl) => {
                          const isSavedActive = activeBuild.templateId === tpl.id;
                          return (
                            <div
                              key={tpl.id}
                              className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 ${
                                isSavedActive
                                  ? 'border-emerald-500 bg-emerald-950/60 text-white'
                                  : 'border-slate-700 bg-slate-900 text-slate-200'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  updateWeaponBuild(workshopWeaponId, tpl.build, false)
                                }
                                className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs font-semibold cursor-pointer"
                              >
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/40"
                                  style={{ backgroundColor: tpl.build.colorHex }}
                                />
                                <span className="truncate">{tpl.name}</span>
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete ${tpl.name}`}
                                onClick={() =>
                                  setUserTemplates((prev) =>
                                    prev.filter((item) => item.id !== tpl.id)
                                  )
                                }
                                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-rose-400 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Live Stats, Finish Color, Attachments & Stat Sliders */}
                <div className="space-y-4">
                  {/* Live Resolved Stats Readout */}
                  {resolvedGun && (
                    <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-700 bg-slate-950/70 p-3 sm:grid-cols-6 font-mono text-xs">
                      <div>
                        <div className="text-[10px] text-slate-400">DAMAGE</div>
                        <div className="text-sm font-bold text-amber-400">
                          {resolvedGun.damage}
                          {resolvedGun.pellets > 1 ? `×${resolvedGun.pellets}` : ''}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">RATE (RPM)</div>
                        <div className="text-sm font-bold text-sky-400">
                          {Math.round(60 / resolvedGun.fireInterval)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">MAGAZINE</div>
                        <div className="text-sm font-bold text-white">
                          {resolvedGun.magSize}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">RELOAD</div>
                        <div className="text-sm font-bold text-emerald-400">
                          {resolvedGun.reloadTime.toFixed(2)}s
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">ADS FOV</div>
                        <div className="text-sm font-bold text-slate-200">
                          {Math.round(resolvedGun.adsFov)}°
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">TRIGGER</div>
                        <div className="text-sm font-bold text-rose-300">
                          {resolvedGun.auto ? 'AUTO' : 'SEMI'}
                        </div>
                      </div>
                    </div>
                  )}

                  {resolvedMelee && (
                    <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-700 bg-slate-950/70 p-3 sm:grid-cols-5 font-mono text-xs">
                      <div>
                        <div className="text-[10px] text-slate-400">SLASH DMG</div>
                        <div className="text-sm font-bold text-amber-400">
                          {resolvedMelee.damage}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">COOLDOWN</div>
                        <div className="text-sm font-bold text-sky-400">
                          {resolvedMelee.cooldown.toFixed(2)}s
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">REACH</div>
                        <div className="text-sm font-bold text-emerald-400">
                          {resolvedMelee.range.toFixed(2)}m
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">SPEED BONUS</div>
                        <div className="text-sm font-bold text-white">
                          +{Math.round((resolvedMelee.speedBonus - 1) * 100)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">DASH LUNGE</div>
                        <div className="text-sm font-bold text-rose-300">
                          {resolvedMelee.dashImpulse.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  )}

                  {resolvedUtility && (
                    <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-700 bg-slate-950/70 p-3 sm:grid-cols-4 font-mono text-xs">
                      <div>
                        <div className="text-[10px] text-slate-400">CHARGES</div>
                        <div className="text-sm font-bold text-white">
                          {resolvedUtility.charges}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">COOLDOWN</div>
                        <div className="text-sm font-bold text-sky-400">
                          {resolvedUtility.cooldown.toFixed(1)}s
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">POWER</div>
                        <div className="text-sm font-bold text-amber-400">
                          {Math.round(resolvedUtility.powerMult * 100)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">THROW SPEED</div>
                        <div className="text-sm font-bold text-emerald-400">
                          {Math.round(resolvedUtility.throwSpeedMult * 100)}%
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Finish & Accent Color Picker */}
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300">
                        Weapon Finish, Tracer &amp; Reticle Color
                      </span>
                      <span className="font-mono text-slate-400">
                        {activeBuild.colorHex.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {WEAPON_FINISH_SWATCHES.map((sw) => {
                        const active =
                          activeBuild.colorHex.toLowerCase() === sw.hex.toLowerCase();
                        return (
                          <button
                            key={sw.hex}
                            type="button"
                            title={sw.name}
                            onClick={() =>
                              updateWeaponBuild(workshopWeaponId, { colorHex: sw.hex })
                            }
                            className={`h-7 w-7 rounded-lg border-2 transition-transform cursor-pointer ${
                              active
                                ? 'scale-110 border-white'
                                : 'border-slate-700 hover:scale-105'
                            }`}
                            style={{ backgroundColor: sw.hex }}
                          />
                        );
                      })}
                      <label className="ml-1 inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-300 cursor-pointer">
                        <span>Custom</span>
                        <input
                          type="color"
                          value={activeBuild.colorHex}
                          onChange={(e) =>
                            updateWeaponBuild(workshopWeaponId, {
                              colorHex: e.target.value,
                            })
                          }
                          className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Attachments & Trigger (Firearms: Primary & Secondary) */}
                  {(activeCat === 'primary' || activeCat === 'secondary') && (
                    <div className="grid gap-3 rounded-lg border border-slate-700 bg-slate-800/50 p-3 sm:grid-cols-2">
                      <div>
                        <div className="mb-1.5 text-xs font-semibold text-slate-300">
                          Optic Sight
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(
                            [
                              { id: 'iron', label: 'Iron' },
                              { id: 'holo', label: 'Holo' },
                              { id: 'scope', label: 'Scope' },
                            ] as Array<{ id: OpticAttachment; label: string }>
                          ).map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                updateWeaponBuild(workshopWeaponId, { optic: opt.id })
                              }
                              className={`rounded-lg border py-1.5 text-xs font-semibold cursor-pointer ${
                                activeBuild.optic === opt.id
                                  ? 'border-sky-400 bg-sky-600 text-white'
                                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="mb-1.5 text-xs font-semibold text-slate-300">
                          Barrel Attachment
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(
                            [
                              { id: 'standard', label: 'Standard' },
                              { id: 'suppressor', label: 'Suppressor' },
                              { id: 'heavy', label: 'Heavy' },
                            ] as Array<{ id: BarrelAttachment; label: string }>
                          ).map((bar) => (
                            <button
                              key={bar.id}
                              type="button"
                              onClick={() =>
                                updateWeaponBuild(workshopWeaponId, { barrel: bar.id })
                              }
                              className={`rounded-lg border py-1.5 text-xs font-semibold cursor-pointer ${
                                activeBuild.barrel === bar.id
                                  ? 'border-sky-400 bg-sky-600 text-white'
                                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                              }`}
                            >
                              {bar.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="mb-1.5 text-xs font-semibold text-slate-300">
                          Magazine Type
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(
                            [
                              { id: 'standard', label: 'Standard' },
                              { id: 'extended', label: 'Extended' },
                              { id: 'quick', label: 'Quick-Mag' },
                            ] as Array<{ id: MagazineAttachment; label: string }>
                          ).map((mag) => (
                            <button
                              key={mag.id}
                              type="button"
                              onClick={() =>
                                updateWeaponBuild(workshopWeaponId, { magazine: mag.id })
                              }
                              className={`rounded-lg border py-1.5 text-xs font-semibold cursor-pointer ${
                                activeBuild.magazine === mag.id
                                  ? 'border-sky-400 bg-sky-600 text-white'
                                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                              }`}
                            >
                              {mag.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="mb-1.5 text-xs font-semibold text-slate-300">
                          Trigger Fire Mode
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(
                            [
                              { id: 'default', label: 'Default' },
                              { id: 'auto', label: 'Full-Auto' },
                              { id: 'semi', label: 'Semi-Auto' },
                            ] as Array<{ id: FireModeOverride; label: string }>
                          ).map((fm) => (
                            <button
                              key={fm.id}
                              type="button"
                              onClick={() =>
                                updateWeaponBuild(workshopWeaponId, { fireMode: fm.id })
                              }
                              className={`rounded-lg border py-1.5 text-xs font-semibold cursor-pointer ${
                                activeBuild.fireMode === fm.id
                                  ? 'border-sky-400 bg-sky-600 text-white'
                                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                              }`}
                            >
                              {fm.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Free-Tune Stat Sliders */}
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                    <div className="mb-2.5 text-xs font-semibold text-slate-300">
                      Free-Tune Custom Stat Sliders
                    </div>

                    {(activeCat === 'primary' || activeCat === 'secondary') && (
                      <div className="grid gap-3 sm:grid-cols-2 text-xs">
                        <label className="block">
                          <div className="flex justify-between text-slate-300">
                            <span>Damage Multiplier</span>
                            <span className="font-mono text-amber-400">
                              {Math.round(activeBuild.damageMult * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.6}
                            max={1.75}
                            step={0.05}
                            value={activeBuild.damageMult}
                            onChange={(e) =>
                              updateWeaponBuild(workshopWeaponId, {
                                damageMult: Number(e.target.value),
                              })
                            }
                            className="mt-1 w-full accent-sky-500 cursor-pointer"
                          />
                        </label>

                        <label className="block">
                          <div className="flex justify-between text-slate-300">
                            <span>Fire Rate Multiplier</span>
                            <span className="font-mono text-sky-400">
                              {Math.round(activeBuild.fireRateMult * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.6}
                            max={1.75}
                            step={0.05}
                            value={activeBuild.fireRateMult}
                            onChange={(e) =>
                              updateWeaponBuild(workshopWeaponId, {
                                fireRateMult: Number(e.target.value),
                              })
                            }
                            className="mt-1 w-full accent-sky-500 cursor-pointer"
                          />
                        </label>

                        <label className="block">
                          <div className="flex justify-between text-slate-300">
                            <span>Magazine Bonus Rounds</span>
                            <span className="font-mono text-white">
                              {activeBuild.magBonus >= 0
                                ? `+${activeBuild.magBonus}`
                                : activeBuild.magBonus}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-4}
                            max={24}
                            step={1}
                            value={activeBuild.magBonus}
                            onChange={(e) =>
                              updateWeaponBuild(workshopWeaponId, {
                                magBonus: Number(e.target.value),
                              })
                            }
                            className="mt-1 w-full accent-sky-500 cursor-pointer"
                          />
                        </label>

                        <label className="block">
                          <div className="flex justify-between text-slate-300">
                            <span>Accuracy Tightness</span>
                            <span className="font-mono text-emerald-400">
                              {Math.round(activeBuild.accuracyMult * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.4}
                            max={1.6}
                            step={0.05}
                            value={activeBuild.accuracyMult}
                            onChange={(e) =>
                              updateWeaponBuild(workshopWeaponId, {
                                accuracyMult: Number(e.target.value),
                              })
                            }
                            className="mt-1 w-full accent-sky-500 cursor-pointer"
                          />
                        </label>

                        <label className="block">
                          <div className="flex justify-between text-slate-300">
                            <span>Recoil Scale</span>
                            <span className="font-mono text-rose-300">
                              {Math.round(activeBuild.recoilMult * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.25}
                            max={1.4}
                            step={0.05}
                            value={activeBuild.recoilMult}
                            onChange={(e) =>
                              updateWeaponBuild(workshopWeaponId, {
                                recoilMult: Number(e.target.value),
                              })
                            }
                            className="mt-1 w-full accent-sky-500 cursor-pointer"
                          />
                        </label>

                        <label className="block">
                          <div className="flex justify-between text-slate-300">
                            <span>ADS Zoom FOV Delta</span>
                            <span className="font-mono text-slate-200">
                              {activeBuild.adsZoomDelta >= 0
                                ? `+${activeBuild.adsZoomDelta}°`
                                : `${activeBuild.adsZoomDelta}°`}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-12}
                            max={10}
                            step={1}
                            value={activeBuild.adsZoomDelta}
                            onChange={(e) =>
                              updateWeaponBuild(workshopWeaponId, {
                                adsZoomDelta: Number(e.target.value),
                              })
                            }
                            className="mt-1 w-full accent-sky-500 cursor-pointer"
                          />
                        </label>
                      </div>
                    )}

                    {activeCat === 'melee' && (
                      <div className="grid gap-3 sm:grid-cols-2 text-xs">
                        <label className="block">
                          <div className="flex justify-between text-slate-300">
                            <span>Slash Damage</span>
                            <span className="font-mono text-amber-400">
                              {Math.round(activeBuild.damageMult * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.7}
                            max={1.8}
                            step={0.05}
                            value={activeBuild.damageMult}
                            onChange={(e) =>
                              updateWeaponBuild(workshopWeaponId, {
                                damageMult: Number(e.target.value),
                              })
                            }
                            className="mt-1 w-full accent-sky-500 cursor-pointer"
                          />
                        </label>

                        <label className="block">
                          <div className="flex justify-between text-slate-300">
                            <span>Swing Cadence</span>
                            <span className="font-mono text-sky-400">
                              {Math.round(activeBuild.fireRateMult * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.65}
                            max={1.75}
                            step={0.05}
                            value={activeBuild.fireRateMult}
                            onChange={(e) =>
                              updateWeaponBuild(workshopWeaponId, {
                                fireRateMult: Number(e.target.value),
                              })
                            }
                            className="mt-1 w-full accent-sky-500 cursor-pointer"
                          />
                        </label>

                        <label className="block">
                          <div className="flex justify-between text-slate-300">
                            <span>Blade Size &amp; Reach</span>
                            <span className="font-mono text-emerald-400">
                              {Math.round(activeBuild.reachMult * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.8}
                            max={1.55}
                            step={0.05}
                            value={activeBuild.reachMult}
                            onChange={(e) =>
                              updateWeaponBuild(workshopWeaponId, {
                                reachMult: Number(e.target.value),
                              })
                            }
                            className="mt-1 w-full accent-sky-500 cursor-pointer"
                          />
                        </label>

                        <label className="block">
                          <div className="flex justify-between text-slate-300">
                            <span>Sprint Move Speed</span>
                            <span className="font-mono text-white">
                              {Math.round(activeBuild.speedMult * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.85}
                            max={1.45}
                            step={0.05}
                            value={activeBuild.speedMult}
                            onChange={(e) =>
                              updateWeaponBuild(workshopWeaponId, {
                                speedMult: Number(e.target.value),
                              })
                            }
                            className="mt-1 w-full accent-sky-500 cursor-pointer"
                          />
                        </label>

                        <label className="block sm:col-span-2">
                          <div className="flex justify-between text-slate-300">
                            <span>Dash Lunge Impulse</span>
                            <span className="font-mono text-rose-300">
                              {Math.round(activeBuild.dashMult * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.7}
                            max={1.75}
                            step={0.05}
                            value={activeBuild.dashMult}
                            onChange={(e) =>
                              updateWeaponBuild(workshopWeaponId, {
                                dashMult: Number(e.target.value),
                              })
                            }
                            className="mt-1 w-full accent-sky-500 cursor-pointer"
                          />
                        </label>
                      </div>
                    )}

                    {activeCat === 'utility' && (
                      <div className="grid gap-3 sm:grid-cols-2 text-xs">
                        <label className="block">
                          <div className="flex justify-between text-slate-300">
                            <span>Payload / Heal Power</span>
                            <span className="font-mono text-amber-400">
                              {Math.round(activeBuild.powerMult * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.7}
                            max={1.85}
                            step={0.05}
                            value={activeBuild.powerMult}
                            onChange={(e) =>
                              updateWeaponBuild(workshopWeaponId, {
                                powerMult: Number(e.target.value),
                              })
                            }
                            className="mt-1 w-full accent-sky-500 cursor-pointer"
                          />
                        </label>

                        <label className="block">
                          <div className="flex justify-between text-slate-300">
                            <span>Extra Charges</span>
                            <span className="font-mono text-white">
                              +{activeBuild.magBonus}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={3}
                            step={1}
                            value={activeBuild.magBonus}
                            onChange={(e) =>
                              updateWeaponBuild(workshopWeaponId, {
                                magBonus: Number(e.target.value),
                              })
                            }
                            className="mt-1 w-full accent-sky-500 cursor-pointer"
                          />
                        </label>

                        <label className="block">
                          <div className="flex justify-between text-slate-300">
                            <span>Throw Velocity</span>
                            <span className="font-mono text-emerald-400">
                              {Math.round(activeBuild.dashMult * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.75}
                            max={1.6}
                            step={0.05}
                            value={activeBuild.dashMult}
                            onChange={(e) =>
                              updateWeaponBuild(workshopWeaponId, {
                                dashMult: Number(e.target.value),
                              })
                            }
                            className="mt-1 w-full accent-sky-500 cursor-pointer"
                          />
                        </label>

                        <label className="block">
                          <div className="flex justify-between text-slate-300">
                            <span>Recharge Speed</span>
                            <span className="font-mono text-sky-400">
                              {Math.round(activeBuild.fireRateMult * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.7}
                            max={1.6}
                            step={0.05}
                            value={activeBuild.fireRateMult}
                            onChange={(e) =>
                              updateWeaponBuild(workshopWeaponId, {
                                fireRateMult: Number(e.target.value),
                              })
                            }
                            className="mt-1 w-full accent-sky-500 cursor-pointer"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CAMBRIDGE Q&A STUDY BANK MODAL (CLASS 6-10) */}
      {gameState === 'TITLE_MENU' && qaModalOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/85 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl border border-slate-700 bg-slate-900 p-5 sm:p-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <BookOpen className="h-4 w-4" />
                  {getCambridgeStageLabel(classLevel)}
                </div>
                <h2 className="mt-0.5 font-display text-2xl font-bold text-white">
                  Cambridge Q&A · Class {classLevel}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setQaModalOpen(false)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
              >
                Back to Lobby
              </button>
            </div>

            {/* Quick Class 6-10 + Subject Filter */}
            <div className="mt-3 grid grid-cols-5 gap-1">
              {CLASS_LEVELS.map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setClassLevel(cls)}
                  className={`rounded border py-1 font-mono text-xs font-bold cursor-pointer ${
                    classLevel === cls
                      ? 'border-sky-400 bg-sky-600 text-white'
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  C{cls}
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1 sm:grid-cols-6">
              {(Object.keys(SUBJECTS) as SubjectId[]).map((subId) => (
                <button
                  key={subId}
                  type="button"
                  onClick={() => setSubject(subId)}
                  className={`rounded border px-2 py-1 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                    subject === subId
                      ? 'border-emerald-500 bg-emerald-600 text-white'
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {SUBJECTS[subId].label}
                </button>
              ))}
            </div>

            {/* Q&A Cards */}
            <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
              {getQuestionsForClassAndSubject(classLevel, subject).map((q, idx) => {
                const isRevealed = revealedQaIds[q.id] ?? true;
                return (
                  <div
                    key={q.id}
                    className="rounded-lg border border-slate-800 bg-slate-950 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-sky-400">
                        Q{idx + 1} · {q.cambridgeRef}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedQaIds((prev) => ({ ...prev, [q.id]: !isRevealed }))
                        }
                        className="text-[11px] font-medium text-slate-400 hover:text-white underline cursor-pointer"
                      >
                        {isRevealed ? 'Hide Answer' : 'Show Answer'}
                      </button>
                    </div>
                    <div className="mt-1.5 text-sm font-semibold text-white">{q.prompt}</div>
                    {isRevealed && (
                      <div className="mt-2.5 rounded-md border border-emerald-500/30 bg-emerald-950/30 p-3 text-xs">
                        <div className="font-bold text-emerald-300">
                          Answer: {q.choices[q.correctIndex]}
                        </div>
                        <div className="mt-1 text-slate-300 leading-relaxed">{q.explanation}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* PRE-ROUND KNOWLEDGE GATE (MUST ANSWER CORRECTLY TO PLAY) */}
      {gameState === 'ROUND_QUIZ' && quizState && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-sky-400">
                <GraduationCap className="h-4 w-4" />
                ROUND {quizState.roundNum} GATE · CLASS {classLevel} · {quizState.question.cambridgeRef.toUpperCase()}
              </div>
              <div className="flex items-center gap-3">
                <div className="font-mono text-xs text-slate-400">
                  SCORE {quizStats.correct}/{quizStats.total} · STREAK {quizStats.streak}
                </div>
                <button
                  type="button"
                  onClick={exitToLobby}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-950/60 px-2.5 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-900/70 cursor-pointer whitespace-nowrap"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Exit Match
                </button>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-3 py-2 text-xs font-medium text-emerald-300">
              {!quizState.hadWrongAttempt
                ? `Answer correctly on 1st try to unlock Round ${quizState.roundNum} + ${quizState.perk.label}`
                : `Answer this new question correctly to unlock Round ${quizState.roundNum} (1st-try bonus missed)`}
            </div>

            {quizState.wrongFeedback && !quizState.solved && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-950/50 px-3 py-2.5 text-xs text-rose-200">
                <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-rose-300">
                    Incorrect (“{quizState.wrongFeedback.chosenAnswer}”) — switched to a new question!
                  </div>
                  <div className="mt-0.5 text-rose-200/90">
                    Previous answer: <span className="font-semibold text-white">{quizState.wrongFeedback.correctAnswer}</span> — {quizState.wrongFeedback.explanation}
                  </div>
                </div>
              </div>
            )}

            <h2 className="mt-4 font-display text-lg sm:text-xl font-bold leading-snug text-white">
              {quizState.question.prompt}
            </h2>

            <div className="mt-4 grid gap-2">
              {quizState.question.choices.map((choice, idx) => {
                const isSolved = quizState.solved;
                const isCorrectChoice = idx === quizState.question.correctIndex;
                const disabled = isSolved;

                let btnStyle =
                  'border-slate-700 bg-slate-800 text-slate-100 hover:border-sky-500 hover:bg-slate-800/80';
                if (isSolved && isCorrectChoice) {
                  btnStyle = 'border-emerald-500 bg-emerald-900/60 text-emerald-100';
                } else if (isSolved) {
                  btnStyle = 'border-slate-800 bg-slate-900 text-slate-500';
                }

                return (
                  <button
                    key={`${quizState.question.id}-${idx}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => answerQuiz(idx)}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
                      disabled ? 'cursor-default' : 'cursor-pointer'
                    } ${btnStyle}`}
                  >
                    <span>
                      <span className="mr-2.5 font-mono text-xs font-bold opacity-75">
                        [{idx + 1}]
                      </span>
                      {choice}
                    </span>
                    {isSolved && isCorrectChoice && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {quizState.solved ? (
              <div className="mt-4 rounded-lg border border-emerald-500/40 bg-slate-950 p-4">
                <div className="text-xs font-bold text-emerald-400">
                  {!quizState.hadWrongAttempt
                    ? `Correct! Round ${quizState.roundNum} Unlocked + ${quizState.perk.label}`
                    : `Correct! Round ${quizState.roundNum} Unlocked`}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  {quizState.question.explanation}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={exitToLobby}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 cursor-pointer whitespace-nowrap"
                  >
                    <LogOut className="h-4 w-4" />
                    Exit to Lobby
                  </button>
                  <button
                    type="button"
                    onClick={deployRoundFromQuiz}
                    className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 cursor-pointer whitespace-nowrap"
                  >
                    <Play className="h-4 w-4" />
                    Deploy Round {quizState.roundNum}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span>Press keys 1–4 or click the right answer to unlock play</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={swapQuizQuestion}
                      className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 cursor-pointer"
                    >
                      New Question
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {gameState === 'PAUSED' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-6">
          <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl">
            <h2 className="font-display text-2xl font-bold text-white">Match Paused</h2>
            <p className="mt-2 font-mono text-xs text-slate-400">
              {teamSize}v{teamSize} · {ARENA_MAPS[selectedMap].name} · {teamSize === 1 ? 'YOU' : 'BLUE'} {hud.playerRounds} — {hud.rivalRounds} RIVAL
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={resumeDuel}
                className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 cursor-pointer"
              >
                Resume Match
              </button>
              <button
                type="button"
                onClick={() => setCrosshairModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-950/50 px-4 py-2.5 text-sm font-medium text-amber-200 hover:bg-amber-900/60 cursor-pointer"
              >
                <Crosshair className="h-4 w-4" />
                Customize Crosshair
              </button>
              <button
                type="button"
                onClick={startDuel}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 cursor-pointer"
              >
                Restart Match
              </button>
              <button
                type="button"
                onClick={exitToLobby}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-950/50 px-4 py-2.5 text-xs font-semibold text-rose-200 hover:bg-rose-900/60 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                Exit to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CROSSHAIR CUSTOMIZER MODAL */}
      {crosshairModalOpen && (
        <CrosshairCustomizerModal
          config={crosshairConfig}
          onChange={setCrosshairConfig}
          onClose={() => setCrosshairModalOpen(false)}
        />
      )}

      {/* MATCH VICTORY / DEFEAT DEBRIEF */}
      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-4 overflow-y-auto">
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-7 shadow-2xl">
            <div
              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                hud.playerRounds >= ROUNDS_TO_WIN ? 'text-sky-400' : 'text-rose-400'
              }`}
            >
              <Trophy className="h-4 w-4" />
              {hud.playerRounds >= ROUNDS_TO_WIN ? 'MATCH VICTORY' : 'MATCH DEFEAT'} ·{' '}
              {teamSize}v{teamSize} · {ARENA_MAPS[selectedMap].name.toUpperCase()}
            </div>
            <h2 className="mt-1 font-display text-3xl font-bold text-white">
              {hud.playerRounds} — {hud.rivalRounds}
            </h2>

            <div className="mt-5 grid grid-cols-3 gap-3 rounded-lg border border-slate-800 bg-slate-950 p-4">
              <div>
                <div className="text-xs text-slate-400">Damage Dealt</div>
                <div className="font-mono text-xl font-bold text-white tabular-nums">
                  {hud.totalDamageDealt}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Eliminations</div>
                <div className="font-mono text-xl font-bold text-sky-400 tabular-nums">
                  {hud.kills}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Accuracy</div>
                <div className="font-mono text-xl font-bold text-emerald-400 tabular-nums">
                  {accuracyPct}%
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Headshots</div>
                <div className="font-mono text-lg font-bold text-amber-400 tabular-nums">
                  {hud.headshots}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Quiz Score</div>
                <div className="font-mono text-lg font-bold text-emerald-400 tabular-nums">
                  {quizStats.correct}/{quizStats.total}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Quiz Streak</div>
                <div className="font-mono text-lg font-bold text-sky-400 tabular-nums">
                  {quizStats.bestStreak}
                </div>
              </div>
            </div>

            {quizHistory.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold text-slate-400">
                  Concepts Reviewed This Match
                </div>
                <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                  {quizHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-slate-800 bg-slate-950/90 p-3 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-slate-200">{item.prompt}</span>
                        <span
                          className={`shrink-0 font-mono text-[10px] font-bold ${
                            item.wasCorrect ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {item.wasCorrect ? 'CORRECT' : 'REVIEW'}
                        </span>
                      </div>
                      <div className="mt-1 text-emerald-300 font-medium">
                        Answer: {item.correctAnswer}
                      </div>
                      <div className="mt-0.5 text-slate-400">{item.explanation}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={startDuel}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="h-4 w-4" />
                Play Rematch
              </button>
              <button
                type="button"
                onClick={exitToLobby}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 cursor-pointer whitespace-nowrap"
              >
                <LogOut className="h-4 w-4" />
                Exit to Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
