export type GameMode = 'menu' | 'select' | 'asteroids' | 'duel' | 'vs-ai' | 'shop' | 'game-over' | 'settings';

export interface Vector2D {
  x: number;
  y: number;
}

export interface CollisionHull {
  offsetX: number;
  offsetY: number;
  radius: number;
}

export type ShipClass = 'interceptor' | 'dreadnought' | 'bomber' | 'destroyer';

export interface ShipStats {
  maxShield: number;
  maxEnergy: number;
  acceleration: number;
  drag: number;
  turnSpeed: number;
  damage: number;
  fireDelay: number;
  specialCost: number;
}

export type UpgradeType = 'weapon' | 'shield' | 'engine' | 'special';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  glow: boolean;
  type: 'spark' | 'smoke' | 'speedline' | 'debris' | 'star';
}

export interface SoundSettings {
  sfxVolume: number;
  musicVolume: number;
}
