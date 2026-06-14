import { Vector2D, CollisionHull, Particle } from './types';
import { Vector } from './math';

export class BaseEntity {
  public id?: string;
  public x: number;
  public y: number;
  public vx = 0;
  public vy = 0;
  public radius: number;
  public rotation = 0;
  public active = true;

  constructor(x: number, y: number, radius: number) {
    this.x = x;
    this.y = y;
    this.radius = radius;
  }

  // Subclasses override this to supply custom/multiple bounding circles
  public getCollisionHulls(): CollisionHull[] {
    return [{ offsetX: 0, offsetY: 0, radius: this.radius }];
  }

  public update(dt: number, width: number, height: number, wrap = true) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (wrap) {
      if (this.x < -this.radius) this.x = width + this.radius;
      else if (this.x > width + this.radius) this.x = -this.radius;

      if (this.y < -this.radius) this.y = height + this.radius;
      else if (this.y > height + this.radius) this.y = -this.radius;
    }
  }

  public draw(_ctx: CanvasRenderingContext2D) {
    // Override in subclass
  }
}

// ==================== PROJECTILE ====================
export class Projectile extends BaseEntity {
  public ownerId: string;
  public damage: number;
  public life = 1.5; // seconds to live
  public target: BaseEntity | null = null; // for homing missiles
  public speed = 600;
  public isMine = false;
  public color = '#00f0ff';

  constructor(
    x: number,
    y: number,
    vx: number,
    vy: number,
    ownerId: string,
    damage: number,
    color = '#00f0ff',
    isMine = false
  ) {
    super(x, y, isMine ? 10 : 3);
    this.vx = vx;
    this.vy = vy;
    this.ownerId = ownerId;
    this.damage = damage;
    this.color = color;
    this.isMine = isMine;
    this.life = isMine ? 8.0 : 1.5; // Mines last longer
  }

  public update(dt: number, width: number, height: number) {
    // If homing missile, adjust velocity towards target
    if (this.target && this.target.active && !this.isMine) {
      const targetDir = Vector.normalize(Vector.sub(this.target, this));
      
      // Interpolate current velocity towards target direction
      const currentDir = Vector.normalize({ x: this.vx, y: this.vy });
      const newDir = Vector.normalize(Vector.lerp(currentDir, targetDir, 5 * dt));
      
      this.vx = newDir.x * this.speed;
      this.vy = newDir.y * this.speed;
      this.rotation = Math.atan2(this.vy, this.vx);
    }

    super.update(dt, width, height, !this.isMine); // Homing/bullets wrap, mines float statically

    this.life -= dt;
    if (this.life <= 0) {
      this.active = false;
    }
  }

  public draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.strokeStyle = this.color;
    ctx.fillStyle = this.color;

    if (this.isMine) {
      // Draw mine - glowing pulsing octagon
      const pulse = 1 + Math.sin(Date.now() * 0.01) * 0.15;
      const r = this.radius * pulse;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4 + Date.now() * 0.001;
        const px = this.x + Math.cos(angle) * r;
        const py = this.y + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();

      // Core
      ctx.beginPath();
      ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.target) {
      // Homing missile - Draw rocket triangle shape
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-6, -4);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-6, 4);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    } else {
      // Standard laser line - drawing back from position
      ctx.lineWidth = 3;
      ctx.beginPath();
      const speed = Vector.mag({ x: this.vx, y: this.vy });
      const dx = (this.vx / speed) * 15;
      const dy = (this.vy / speed) * 15;
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - dx, this.y - dy);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ==================== ASTEROID ====================
export class Asteroid extends BaseEntity {
  public size: number; // 3 = Large, 2 = Medium, 1 = Small
  public points: Vector2D[] = [];
  public rotationSpeed: number;
  public maxHealth: number;
  public health: number;
  public color = '#a0aec0';

  constructor(x: number, y: number, size = 3) {
    const radius = size === 3 ? 45 : size === 2 ? 25 : 12;
    super(x, y, radius);
    this.size = size;
    
    // Set random velocity
    const angle = Math.random() * Math.PI * 2;
    const speed = size === 3 ? 40 + Math.random() * 40 : size === 2 ? 70 + Math.random() * 50 : 110 + Math.random() * 60;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() * 0.8 - 0.4) * (4 - size); // Spin faster if smaller

    this.maxHealth = size === 3 ? 4 : size === 2 ? 2 : 1;
    this.health = this.maxHealth;

    // Generate jagged, anime-styled asteroid vertices
    const numPoints = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < numPoints; i++) {
      const ptAngle = (i * Math.PI * 2) / numPoints;
      // Vary radius randomly to create jagged polygonal rocks
      const r = radius * (0.8 + Math.random() * 0.35);
      this.points.push({
        x: Math.cos(ptAngle) * r,
        y: Math.sin(ptAngle) * r,
      });
    }

    // Assign dynamic colors based on type
    const colors = ['#a0aec0', '#718096', '#cbd5e0', '#4a5568'];
    this.color = colors[Math.floor(Math.random() * colors.length)];
  }

  public update(dt: number, width: number, height: number) {
    this.rotation += this.rotationSpeed * dt;
    super.update(dt, width, height, true);
  }

  public draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    
    // Cyber-cel outline glow
    ctx.shadowBlur = 6;
    ctx.shadowColor = this.color;

    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    // Draw structural anime-shading lines inside
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < this.points.length; i += 2) {
      ctx.moveTo(this.points[i].x * 0.4, this.points[i].y * 0.4);
      ctx.lineTo(this.points[i].x * 0.8, this.points[i].y * 0.8);
    }
    ctx.stroke();

    ctx.restore();
  }
}

// ==================== COLLECTIBLE (SCRAP) ====================
export class Collectible extends BaseEntity {
  public value: number;
  public pulseTimer = 0;
  public magneticPull = false;
  public color = '#ffd700';

  constructor(x: number, y: number, value = 1) {
    super(x, y, 6);
    this.value = value;

    // Drifts away randomly
    const angle = Math.random() * Math.PI * 2;
    const speed = 20 + Math.random() * 30;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  public update(dt: number, width: number, height: number) {
    this.pulseTimer += dt * 5;
    
    // Magnetic friction if pulled
    if (this.magneticPull) {
      this.vx *= 0.96;
      this.vy *= 0.96;
    } else {
      // Slow friction over time so scrap comes to rest
      this.vx *= 0.985;
      this.vy *= 0.985;
    }

    super.update(dt, width, height, true);
  }

  public draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.pulseTimer * 0.2);

    const sizePulse = this.radius * (0.85 + Math.sin(this.pulseTimer) * 0.18);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.color;

    // Anime diamond core shape
    ctx.beginPath();
    ctx.moveTo(0, -sizePulse);
    ctx.lineTo(sizePulse * 0.8, 0);
    ctx.lineTo(0, sizePulse);
    ctx.lineTo(-sizePulse * 0.8, 0);
    ctx.closePath();
    ctx.fill();

    // inner light dot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ==================== PARTICLE SYSTEM ====================
export class ParticleSystem {
  private particles: Particle[] = [];

  constructor() {}

  public getParticles(): Particle[] {
    return this.particles;
  }

  public clear() {
    this.particles = [];
  }

  // Update particle physics, cull dead ones
  public update(dt: number, width: number, height: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Stars wrap, other particles decay
      if (p.type === 'star') {
        if (p.x < 0) p.x = width;
        else if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        else if (p.y > height) p.y = 0;
      } else {
        p.life -= dt;
        p.alpha = Math.max(0, p.life / p.maxLife);
        if (p.life <= 0) {
          this.particles.splice(i, 1);
        }
      }
    }
  }

  // Initialize a scrolling space background
  public initStars(width: number, height: number, count = 120) {
    this.particles = this.particles.filter(p => p.type !== 'star');
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() * 5 + 2) * -1, // Drift slowly left
        vy: 0,
        color: Math.random() > 0.7 ? '#85d7ff' : Math.random() > 0.8 ? '#ff8ec7' : '#ffffff',
        size: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.5 + 0.3,
        life: 9999,
        maxLife: 9999,
        glow: Math.random() > 0.9,
        type: 'star',
      });
    }
  }

  // Engine fire trail sparks
  public spawnThruster(x: number, y: number, angle: number, speed: number, color: string) {
    // Blast opposite to angle direction
    const blastAngle = angle + Math.PI + (Math.random() * 0.3 - 0.15);
    const scatter = 50 + Math.random() * 100;
    const vx = Math.cos(blastAngle) * (speed + scatter);
    const vy = Math.sin(blastAngle) * (speed + scatter);

    this.particles.push({
      x,
      y,
      vx,
      vy,
      color,
      size: Math.random() * 2.5 + 1.2,
      alpha: 1.0,
      life: 0.2 + Math.random() * 0.18,
      maxLife: 0.38,
      glow: true,
      type: 'spark',
    });
  }

  // Flashy speedline streaks when afterburner/turbo triggers
  public spawnSpeedline(x: number, y: number, vx: number, vy: number, color: string) {
    // Draw lines along direction of motion
    const len = 30 + Math.random() * 50;
    
    this.particles.push({
      x,
      y,
      vx: -vx * 0.5 + (Math.random() * 10 - 5),
      vy: -vy * 0.5 + (Math.random() * 10 - 5),
      color,
      size: len, // Store length in size for drawing
      alpha: 0.8,
      life: 0.15 + Math.random() * 0.15,
      maxLife: 0.3,
      glow: true,
      type: 'speedline',
    });
  }

  // Stylized anime explosions (expanding rings, sparks, and polygon debris shards)
  public spawnExplosion(x: number, y: number, color: string, intensity = 1.0) {
    // 1. Concentric shockwave ring
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      color,
      size: 10, // Starts at 10 radius, expands in render
      alpha: 1.0,
      life: 0.25,
      maxLife: 0.25,
      glow: true,
      type: 'smoke', // Reuse type for ring
    });

    // 2. High velocity spark stars
    const sparkCount = Math.floor(15 * intensity) + 10;
    for (let i = 0; i < sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (80 + Math.random() * 250) * intensity;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() > 0.4 ? color : '#ffffff',
        size: Math.random() * 3 + 1,
        alpha: 1.0,
        life: 0.3 + Math.random() * 0.4,
        maxLife: 0.7,
        glow: true,
        type: 'spark',
      });
    }

    // 3. Shards/debris (spinning rectangles/triangles flying out)
    const debrisCount = Math.floor(5 * intensity) + 3;
    for (let i = 0; i < debrisCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (40 + Math.random() * 100) * intensity;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: '#4a5568', // Dark structural shard color
        size: Math.random() * 6 + 3, // Shard width
        alpha: 1.0,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1.0,
        glow: false,
        type: 'debris',
      });
    }
  }

  // Draws all particles onto canvas
  public draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    
    // Draw background stars first
    for (const p of this.particles) {
      if (p.type !== 'star') continue;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw active dynamic effects
    for (const p of this.particles) {
      if (p.type === 'star') continue;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      
      if (p.glow) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
      }

      if (p.type === 'spark') {
        // Star shapes or sharp circles
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'smoke') {
        // Shockwave rings expanding
        const expansion = (1 - p.alpha) * 110; // ring grows
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 4 * p.alpha; // thins out
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + expansion, 0, Math.PI * 2);
        ctx.stroke();

        // White inner thin ring
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1 * p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + expansion * 0.8, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'speedline') {
        // Direct trails
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        const headingAngle = Math.atan2(p.vy, p.vx);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        // Extend line backward along motion
        ctx.lineTo(p.x - Math.cos(headingAngle) * p.size, p.y - Math.sin(headingAngle) * p.size);
        ctx.stroke();
      } else if (p.type === 'debris') {
        // Jagged rotating debris shards
        ctx.translate(p.x, p.y);
        ctx.rotate(p.life * 8); // spin quickly
        ctx.fillStyle = p.color;
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#ffffff';
        
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size, p.size * 0.5);
        ctx.lineTo(-p.size * 0.5, p.size);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }

    ctx.restore();
  }
}
