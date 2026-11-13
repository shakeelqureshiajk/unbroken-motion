export type AspectRatio = '16:9' | '9:16' | '1:1';

export type CurvePreset =
  | 'snappy'
  | 'soft'
  | 'heavy'
  | 'overshoot'
  | 'whipQuart'
  | 'linear';

export type CameraPreset =
  | 'follow'
  | 'whip'
  | 'pushThrough'
  | 'float'
  | 'shake'
  | 'hold';

export type CarryMode =
  | 'morph'
  | 'portal'
  | 'detach'
  | 'tether'
  | 'collapse';

export type AudioEventType =
  | 'impact'
  | 'whoosh'
  | 'whoosh-soft'
  | 'click'
  | 'pop'
  | 'tick'
  | 'riser';

export interface Resolution {
  width: number;
  height: number;
}

export interface AudioEvent {
  atSec: number;
  type: AudioEventType;
  intensity: number;
}

export interface CameraSpec {
  preset: CameraPreset;
  target: string;
  x?: number;
  y?: number;
  zoom: number;
  roll?: number;
  entryBlendSec?: number;
  settleSec?: number;
  floatIntensity?: number;
  shakeAtSec?: number;
  shakeIntensity?: number;
}

export interface HandoffSpec {
  carryActor: string;
  targetActor: string;
  mode: CarryMode;
  windowSec: number;
  curve: CurvePreset;
}

export interface BeatDef {
  id: string;
  label?: string;
  start: number;
  duration: number;
  heroActor?: string;
  actors: string[];
  camera: CameraSpec;
  handoff?: HandoffSpec;
  audioEvents?: AudioEvent[];
}

export interface BeatSheet {
  film: string;
  title?: string;
  brand: string;
  fps: 24 | 30 | 60;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  seed: number;
  audio?: {
    musicPath?: string | null;
    useAmbientBed?: boolean;
    autoSfx?: boolean;
  };
  beats: BeatDef[];
}

export interface BrandColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  primary: string;
  secondary: string;
  accent: string;
  textPrimary: string;
  textMuted: string;
  border: string;
  onPrimary: string;
}

export interface BrandTypography {
  headingFont: string;
  bodyFont: string;
  monoFont: string;
  headingWeight: number;
  bodyWeight: number;
}

export interface BrandGeometry {
  radiusSm: number;
  radiusMd: number;
  radiusLg: number;
  borderWidth: number;
}

export interface BrandLogo {
  wordmark: string;
  tagline: string;
  markShape: 'prism' | 'orbit' | 'monolith' | 'wave';
  minClearSpaceRatio: number;
}

export interface BrandMotionPersonality {
  style: 'snappy' | 'calm' | 'playful' | 'authoritative';
  defaultCurve: 'snappy' | 'soft' | 'heavy' | 'overshoot';
  cameraFloatIntensity: number;
}

export interface BrandTokens {
  id: string;
  name: string;
  colors: BrandColors;
  typography: BrandTypography;
  geometry: BrandGeometry;
  logo: BrandLogo;
  motionPersonality: BrandMotionPersonality;
  forbiddenColors: string[];
}

export interface WorldBox {
  cx: number;
  cy: number;
  width: number;
  height: number;
  borderRadius: number;
  rotation: number;
  scale: number;
}

export interface ScreenBox {
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
  areaRatio: number;
}

export type ActorKind =
  | 'dotSeed'
  | 'commandBar'
  | 'appWindow'
  | 'card'
  | 'menuRow'
  | 'chip'
  | 'button'
  | 'cursor'
  | 'phoneFrame'
  | 'metricBadge'
  | 'tetherBeam'
  | 'brandMark'
  | 'headline';

export type ActorRole = 'hero' | 'shell' | 'context' | 'tether';

export interface EvaluatedActor {
  id: string;
  kind: ActorKind;
  role: ActorRole;
  zIndex: number;
  worldBox: WorldBox;
  screenBox: ScreenBox;
  opacity: number;
  visible: boolean;
  vx: number;
  vy: number;
  speedNorm: number;
  blurEnabled: boolean;
  blurStrength: number;
  blurAngleDeg: number;
  inHandoff: boolean;
  handoffMode: CarryMode | null;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  tokensUsed: {
    colors: string[];
    fonts: string[];
    radii: number[];
  };
  props: Record<string, unknown>;
}

export interface EvaluatedCamera {
  x: number;
  y: number;
  zoom: number;
  roll: number;
  vx: number;
  vy: number;
  speedNorm: number;
  trauma: number;
  blurEnabled: boolean;
  blurStrength: number;
  blurAngleDeg: number;
  activePreset: CameraPreset;
}

export interface FrameSceneState {
  frame: number;
  timeSec: number;
  fps: number;
  resolution: Resolution;
  stageSize: Resolution;
  stageScale: number;
  beatIndex: number;
  beatId: string;
  heroActorId: string;
  camera: EvaluatedCamera;
  actors: EvaluatedActor[];
}
