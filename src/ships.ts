import { BaseEntity, Projectile, ParticleSystem } from './entities';
import { CollisionHull, ShipClass, ShipStats } from './types';
import { Vector, getRotatedOffset } from './math';
import { SoundSynthesizer } from './sound';

export const SHIP_CONFIGS: Record<ShipClass, ShipStats & { name: string; color: string; desc: string }> = {
  interceptor: {
    name: 'INTERCEPTOR',
    maxShield: 100,
    maxEnergy: 100,
    acceleration: 600,
    drag: 0.98,
    turnSpeed: 4.8, // radians/sec
    damage: 15,
    fireDelay: 0.12, // fast shooter
    specialCost: 40,
    color: '#00f0ff',
    desc: 'Lightweight & highly agile striker. Special: Warp Dash.'
  },
  dreadnought: {
    name: 'DREADNOUGHT',
    maxShield: 220,
    maxEnergy: 100,
    acceleration: 250,
    drag: 0.965,
    turnSpeed: 2.2,
    damage: 40,
    fireDelay: 0.45, // heavy slow firing buster
    specialCost: 50,
    color: '#ff0055',
    desc: 'Armored vanguard. Fires heavy lasers. Special: Homing Missile.'
  },
  bomber: {
    name: 'BOMBER',
    maxShield: 140,
    maxEnergy: 120,
    acceleration: 380,
    drag: 0.97,
    turnSpeed: 3.2,
    damage: 25,
    fireDelay: 0.28,
    specialCost: 35,
    color: '#ffd700',
    desc: 'Tactical ship. Balanced damage. Special: Deploy Proximity Mine.'
  },
  destroyer: {
    name: 'DESTROYER',
    maxShield: 150,
    maxEnergy: 100,
    acceleration: 400,
    drag: 0.975,
    turnSpeed: 3.4,
    damage: 22,
    fireDelay: 0.24,
    specialCost: 60,
    color: '#d600ff',
    desc: 'Heavy striker. Balanced build. Special: Overload Turbo Mode.'
  }
};

function invertColor(hex: string): string {
  if (hex.startsWith('#')) hex = hex.slice(1);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const invR = (255 - r).toString(16).padStart(2, '0');
  const invG = (255 - g).toString(16).padStart(2, '0');
  const invB = (255 - b).toString(16).padStart(2, '0');
  return `#${invR}${invG}${invB}`;
}

export class Ship extends BaseEntity {
  public id: string;
  public shipClass: ShipClass;
  public name: string;
  
  // Game stats
  public maxShield: number;
  public shield: number;
  public maxEnergy: number;
  public energy: number;
  public damage: number;
  public fireDelay: number;
  public acceleration: number;
  public drag: number;
  public turnSpeed: number;
  public specialCost: number;

  public color: string;
  
  // States
  public fireTimer = 0;
  public specialTimer = 0;
  public isInvulnerable = false;
  public invulnTimer = 0;
  public isShieldHit = false;
  public shieldHitTimer = 0;
  public wins = 0; // Win count in Duel Mode
  
  // Special: Destroyer Turbo state
  public turboActive = false;
  public turboTimer = 0;
  public turboDuration = 3.0; // 3 seconds

  constructor(x: number, y: number, shipClass: ShipClass, id: string) {
    const config = SHIP_CONFIGS[shipClass];
    // Base radius depends on class
    const radius = shipClass === 'dreadnought' ? 26 : shipClass === 'interceptor' ? 16 : 20;
    super(x, y, radius);
    
    this.id = id;
    this.shipClass = shipClass;
    this.name = config.name;
    this.color = config.color;
    
    if (id === 'player2') {
      this.color = invertColor(this.color);
    }
    
    this.maxShield = config.maxShield;
    this.shield = this.maxShield;
    this.maxEnergy = config.maxEnergy;
    this.energy = this.maxEnergy;
    this.damage = config.damage;
    this.fireDelay = config.fireDelay;
    this.acceleration = config.acceleration;
    this.drag = config.drag;
    this.turnSpeed = config.turnSpeed;
    this.specialCost = config.specialCost;
  }

  // COMPOUND COLLISION HULLS
  // Returns bounding circles oriented with ship rotation
  public getCollisionHulls(): CollisionHull[] {
    switch (this.shipClass) {
      case 'interceptor':
        // Lightweight striker: 1 circle fits perfectly
        return [{ offsetX: 0, offsetY: 0, radius: 16 }];
        
      case 'dreadnought':
        // Big heavy vessel: 3 overlapping circles representing length & wide beam
        return [
          { offsetX: 0, offsetY: 0, radius: 26 },      // center
          { offsetX: 20, offsetY: 0, radius: 16 },     // prow
          { offsetX: -16, offsetY: 0, radius: 20 }     // engines
        ];
        
      case 'bomber':
        // Wide delta wings: 2 circles representing wingspan
        return [
          { offsetX: 0, offsetY: 0, radius: 20 },
          { offsetX: -10, offsetY: 0, radius: 16 }
        ];
        
      case 'destroyer':
        // Long spear design: 3 circles in a line
        return [
          { offsetX: 0, offsetY: 0, radius: 20 },      // core
          { offsetX: 22, offsetY: 0, radius: 12 },     // long gun tip
          { offsetX: -18, offsetY: 0, radius: 16 }     // tail thrusters
        ];
    }
  }

  // UPGRADES IN ASTEROIDS SURVIVAL
  public applyUpgrade(type: 'weapon' | 'shield' | 'engine' | 'special') {
    switch (type) {
      case 'weapon':
        this.damage *= 1.25;
        this.fireDelay *= 0.82; // Faster firing rate
        break;
      case 'shield':
        this.maxShield += 30;
        this.shield = this.maxShield;
        break;
      case 'engine':
        this.acceleration *= 1.2;
        this.turnSpeed *= 1.15;
        break;
      case 'special':
        this.specialCost = Math.max(15, this.specialCost - 8);
        break;
    }
  }

  public updateShip(
    dt: number,
    width: number,
    height: number,
    controls: { thrust: boolean; retro: boolean; rotateLeft: boolean; rotateRight: boolean; shoot: boolean; special: boolean },
    particles: ParticleSystem,
    sound: SoundSynthesizer,
    projectiles: Projectile[],
    allEntities: BaseEntity[]
  ) {
    // Regenerate resources over time
    if (this.shield < this.maxShield) {
      // Regens slower in battle, but constantly
      this.shield = Math.min(this.maxShield, this.shield + 4 * dt);
    }
    
    // Energy charges faster if not boosting/shooting
    const energyRegen = (controls.thrust || controls.shoot) ? 8 : 22;
    this.energy = Math.min(this.maxEnergy, this.energy + energyRegen * dt);

    // Timers
    if (this.fireTimer > 0) this.fireTimer -= dt;
    if (this.specialTimer > 0) this.specialTimer -= dt;
    if (this.invulnTimer > 0) {
      this.invulnTimer -= dt;
      if (this.invulnTimer <= 0) this.isInvulnerable = false;
    }
    if (this.shieldHitTimer > 0) {
      this.shieldHitTimer -= dt;
      if (this.shieldHitTimer <= 0) this.isShieldHit = false;
    }

    // Process Destroyer Turbo Mode
    if (this.turboActive) {
      this.turboTimer -= dt;
      if (this.turboTimer <= 0) {
        this.turboActive = false;
      } else {
        // Spawn trailing speedlines and engine flames
        particles.spawnSpeedline(this.x, this.y, this.vx, this.vy, this.color);
        if (Math.random() > 0.4) {
          particles.spawnThruster(this.x, this.y, this.rotation, 400, '#ffffff');
        }
      }
    }

    // Handle Rotation
    if (controls.rotateLeft) {
      this.rotation -= this.turnSpeed * dt;
    }
    if (controls.rotateRight) {
      this.rotation += this.turnSpeed * dt;
    }

    // Handle Acceleration (Thrust)
    let currentAcc = this.acceleration;
    if (this.turboActive) {
      currentAcc *= 1.8; // High speed afterburn boost
    }

    if (controls.thrust) {
      this.vx += Math.cos(this.rotation) * currentAcc * dt;
      this.vy += Math.sin(this.rotation) * currentAcc * dt;
      
      // Thruster sound effect
      sound.startThruster(this.id);

      // Thruster visual sparks
      const tailOffset = this.shipClass === 'dreadnought' ? -25 : -18;
      const tailPos = getRotatedOffset(this.x, this.y, tailOffset, 0, this.rotation);
      particles.spawnThruster(tailPos.x, tailPos.y, this.rotation, Vector.mag({ x: this.vx, y: this.vy }), this.color);
    } else {
      sound.stopThruster(this.id);
    }

    // Handle Retro/Brake
    if (controls.retro) {
      // Active deceleration
      this.vx *= 0.93;
      this.vy *= 0.93;
      // Retro flare
      const frontOffset = this.radius;
      const frontPos = getRotatedOffset(this.x, this.y, frontOffset, 0, this.rotation);
      if (Math.random() > 0.5) {
        particles.spawnThruster(frontPos.x, frontPos.y, this.rotation + Math.PI, 50, '#ffffff');
      }
    }

    // Apply inertia physics friction
    this.vx *= this.drag;
    this.vy *= this.drag;

    // Normal position update (screen wrap)
    super.update(dt, width, height, true);

    // Primary Weapons firing check
    if (controls.shoot && this.fireTimer <= 0) {
      this.fireWeapon(projectiles, sound);
    }

    // Special Ability check
    if (controls.special && this.specialTimer <= 0 && this.energy >= this.specialCost) {
      this.useSpecial(particles, sound, projectiles, allEntities);
    }
  }

  // Weapons Firing Implementation
  private fireWeapon(projectiles: Projectile[], sound: SoundSynthesizer) {
    const tipOffset = this.shipClass === 'dreadnought' ? 28 : this.shipClass === 'destroyer' ? 25 : 18;
    const bulletPos = getRotatedOffset(this.x, this.y, tipOffset, 0, this.rotation);
    
    // Destroyer Turbo: Double speed shots
    const activeFireDelay = this.turboActive ? this.fireDelay * 0.5 : this.fireDelay;

    // Projectile Direction
    const spread = this.shipClass === 'dreadnought' ? 0.05 : 0.02;
    const projAngle = this.rotation + (Math.random() * spread - spread * 0.5);
    const speed = this.shipClass === 'interceptor' ? 700 : this.shipClass === 'dreadnought' ? 450 : 550;
    
    const vx = Math.cos(projAngle) * speed + this.vx * 0.5;
    const vy = Math.sin(projAngle) * speed + this.vy * 0.5;

    if (this.shipClass === 'dreadnought') {
      // Dreadnought heavy dual laser cannons
      const bulletPosL = getRotatedOffset(this.x, this.y, tipOffset, -10, this.rotation);
      const bulletPosR = getRotatedOffset(this.x, this.y, tipOffset, 10, this.rotation);
      projectiles.push(new Projectile(bulletPosL.x, bulletPosL.y, vx, vy, this.id, this.damage, this.color));
      projectiles.push(new Projectile(bulletPosR.x, bulletPosR.y, vx, vy, this.id, this.damage, this.color));
      sound.playHeavyLaser();
    } else {
      // Standard firing
      projectiles.push(new Projectile(bulletPos.x, bulletPos.y, vx, vy, this.id, this.damage, this.color));
      sound.playLaser(this.shipClass === 'interceptor' ? 1.3 : 1.0);
    }

    this.fireTimer = activeFireDelay;
  }

  // Special Abilities Implementation
  private useSpecial(
    particles: ParticleSystem,
    sound: SoundSynthesizer,
    projectiles: Projectile[],
    allEntities: BaseEntity[]
  ) {
    this.energy -= this.specialCost;
    this.specialTimer = 0.5; // Cooldown between specials

    switch (this.shipClass) {
      case 'interceptor':
        // Warp Dash: Teleport ship forwards 160 pixels
        sound.playDash();
        particles.spawnExplosion(this.x, this.y, this.color, 0.7); // Start warp puff
        
        const warpDistance = 160;
        this.x += Math.cos(this.rotation) * warpDistance;
        this.y += Math.sin(this.rotation) * warpDistance;
        
        particles.spawnExplosion(this.x, this.y, this.color, 0.7); // End warp puff
        
        // Give short invulnerability frame
        this.isInvulnerable = true;
        this.invulnTimer = 0.45;
        break;

      case 'dreadnought':
        // Homing missile: targets closest enemy
        sound.playHeavyLaser();
        
        const frontPos = getRotatedOffset(this.x, this.y, 25, 0, this.rotation);
        const missile = new Projectile(frontPos.x, frontPos.y, Math.cos(this.rotation) * 200, Math.sin(this.rotation) * 200, this.id, 50, this.color, false);
        missile.isHoming = true;
        missile.life = 4.5; // ~1.5 screens of travel distance at 400px/s (1800px)
        missile.speed = 400;
        
        // Search for nearest enemy entity (asteroid or other ship)
        let closestTarget: BaseEntity | null = null;
        let minDistSq = Infinity;
        for (const ent of allEntities) {
          if (!ent.active || ent === this || ent.id === this.id) continue;
          
          const dSq = Vector.distSq(this, ent);
          if (dSq < minDistSq) {
            minDistSq = dSq;
            closestTarget = ent;
          }
        }
        
        missile.target = closestTarget;
        projectiles.push(missile);
        break;

      case 'bomber':
        // Proximity Mine
        sound.playMineDrop();
        
        const tailOffset = -this.radius - 10;
        const minePos = getRotatedOffset(this.x, this.y, tailOffset, 0, this.rotation);
        // Drops mine (drifts backwards slowly)
        const mineVx = Math.cos(this.rotation + Math.PI) * 40 + this.vx * 0.4;
        const mineVy = Math.sin(this.rotation + Math.PI) * 40 + this.vy * 0.4;
        
        const mineProj = new Projectile(minePos.x, minePos.y, mineVx, mineVy, this.id, 60, this.color, true);
        projectiles.push(mineProj);
        break;

      case 'destroyer':
        // Turbo Mode Activation
        sound.playTurbo();
        this.turboActive = true;
        this.turboTimer = this.turboDuration;
        
        // Boost forward slightly instantly
        this.vx += Math.cos(this.rotation) * 150;
        this.vy += Math.sin(this.rotation) * 150;
        
        // Speed line flashes
        particles.spawnExplosion(this.x, this.y, this.color, 0.8);
        break;
    }
  }

  // Damage application with shield-ring triggers
  public takeDamage(damage: number, sound: SoundSynthesizer, particles: ParticleSystem): boolean {
    if (this.isInvulnerable) return false;

    sound.playShieldHit();
    this.isShieldHit = true;
    this.shieldHitTimer = 0.15; // flashes shield circle indicator

    // Shield flash ring particle
    particles.spawnExplosion(this.x, this.y, this.color, 0.3);

    this.shield -= damage;
    if (this.shield <= 0) {
      this.shield = 0;
      this.active = false; // Destroyed!
      sound.playExplosion(1.5);
      particles.spawnExplosion(this.x, this.y, this.color, 2.0); // Big anime vector blast
      return true;
    }
    return false;
  }

  // Draw the ship inside canvas
  public draw(ctx: CanvasRenderingContext2D) {
    if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 15) % 2 === 0) {
      // Blink during invulnerability frames
      return;
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // Neon Cel Outline Glow
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.color;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2.5;

    // Drawing Ship Shapes
    ctx.beginPath();
    switch (this.shipClass) {
      case 'interceptor':
        // Sharp mecha wings
        ctx.moveTo(18, 0);
        ctx.lineTo(-12, -14);
        ctx.lineTo(-6, -6);
        ctx.lineTo(-14, 0);
        ctx.lineTo(-6, 6);
        ctx.lineTo(-12, 14);
        break;
        
      case 'dreadnought':
        // Bulk armored outline
        ctx.moveTo(25, 0);
        ctx.lineTo(12, -14);
        ctx.lineTo(-15, -20);
        ctx.lineTo(-24, -10);
        ctx.lineTo(-18, 0);
        ctx.lineTo(-24, 10);
        ctx.lineTo(-15, 20);
        ctx.lineTo(12, 14);
        break;
        
      case 'bomber':
        // Delta bomber outline
        ctx.moveTo(20, 0);
        ctx.lineTo(-10, -18);
        ctx.lineTo(-6, -6);
        ctx.lineTo(-14, -6);
        ctx.lineTo(-14, 6);
        ctx.lineTo(-6, 6);
        ctx.lineTo(-10, 18);
        break;

      case 'destroyer':
        // Long central barrel/prow
        ctx.moveTo(28, 0);
        ctx.lineTo(8, -6);
        ctx.lineTo(-2, -16);
        ctx.lineTo(-18, -10);
        ctx.lineTo(-14, 0);
        ctx.lineTo(-18, 10);
        ctx.lineTo(-2, 16);
        ctx.lineTo(8, 6);
        break;
    }
    ctx.closePath();
    ctx.stroke();

    // inner lights/energy tracks (Anime visual details)
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    switch (this.shipClass) {
      case 'interceptor':
        ctx.moveTo(8, 0);
        ctx.lineTo(-8, 0);
        break;
      case 'dreadnought':
        ctx.moveTo(10, -6);
        ctx.lineTo(-10, -8);
        ctx.moveTo(10, 6);
        ctx.lineTo(-10, 8);
        break;
      case 'bomber':
        ctx.moveTo(5, -5);
        ctx.lineTo(-5, -5);
        ctx.moveTo(5, 5);
        ctx.lineTo(-5, 5);
        break;
      case 'destroyer':
        // Core glowing capacitor line
        ctx.moveTo(15, 0);
        ctx.lineTo(-8, 0);
        break;
    }
    ctx.stroke();

    // Draw Shield Bubble if active or hit
    if (this.isShieldHit) {
      ctx.restore();
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.strokeStyle = this.color;
      ctx.shadowBlur = 15;
      ctx.shadowColor = this.color;
      ctx.lineWidth = 2.0;
      ctx.globalAlpha = this.shieldHitTimer / 0.15;
      ctx.beginPath();
      // Draw shield circle corresponding to ship radius
      ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw dynamic shield grid arcs
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 8, 0.2, 0.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 8, Math.PI, Math.PI + 0.6);
      ctx.stroke();
    }

    ctx.restore();
  }

  // AI CONTROLLER DECISION ENGINE
  public updateAI(
    dt: number,
    target: BaseEntity | null,
    width: number,
    height: number,
    particles: ParticleSystem,
    sound: SoundSynthesizer,
    projectiles: Projectile[],
    allEntities: BaseEntity[]
  ) {
    if (!target) {
      // Drift lazily
      const driftControls = { thrust: false, retro: false, rotateLeft: false, rotateRight: false, shoot: false, special: false };
      this.updateShip(dt, width, height, driftControls, particles, sound, projectiles, allEntities);
      return;
    }

    const aiControls = {
      thrust: false,
      retro: false,
      rotateLeft: false,
      rotateRight: false,
      shoot: false,
      special: false,
    };

    // Calculate heading vector to target
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const targetAngle = Math.atan2(dy, dx);

    // Calculate differences
    let angleDiff = targetAngle - this.rotation;
    // Normalize to -PI to PI
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

    const distSq = dx * dx + dy * dy;

    // 1. Steering Logic
    if (Math.abs(angleDiff) > 0.08) {
      if (angleDiff > 0) aiControls.rotateRight = true;
      else aiControls.rotateLeft = true;
    }

    // 2. Thrust / Backup logic
    const safeDistanceSq = this.shipClass === 'interceptor' ? 120 * 120 : 250 * 250;
    const combatDistanceSq = this.shipClass === 'dreadnought' ? 400 * 400 : 320 * 320;

    if (distSq > combatDistanceSq) {
      // Target is far, accelerate
      if (Math.abs(angleDiff) < 0.5) {
        aiControls.thrust = true;
      }
    } else if (distSq < safeDistanceSq) {
      // Too close! Retreat/brake
      aiControls.retro = true;
    } else {
      // Good distance: hover/steer towards target
      if (Math.random() > 0.7 && Math.abs(angleDiff) < 0.3) {
        aiControls.thrust = true;
      }
    }

    // 3. Firing weapon logic
    if (Math.abs(angleDiff) < 0.22 && distSq < combatDistanceSq) {
      aiControls.shoot = true;
    }

    // 4. Special activation logic
    if (this.energy >= this.specialCost && distSq < combatDistanceSq && Math.random() > 0.985) {
      aiControls.special = true;
    }

    // Perform ship physics update
    this.updateShip(dt, width, height, aiControls, particles, sound, projectiles, allEntities);
  }
}
