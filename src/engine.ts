import { GameMode, ShipClass } from './types';
import { BaseEntity, Projectile, Asteroid, Collectible, ParticleSystem } from './entities';
import { Ship } from './ships';
import { GameCamera } from './camera';
import { InputHandler } from './input';
import { SoundSynthesizer } from './sound';
import { Vector, checkHullCollision } from './math';

export class GameEngine {
  public canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  // World sizes
  public readonly worldWidth = 2400;
  public readonly worldHeight = 1600;

  // Mode & States
  public mode: GameMode = 'menu';
  private active = false;
  public paused = false;
  private lastTime = 0;
  private stateChangeCallback: (mode: GameMode) => void;

  // Systems
  public input: InputHandler;
  public sound: SoundSynthesizer;
  public camera: GameCamera;
  public particles: ParticleSystem;

  // Entities
  public player1: Ship | null = null;
  public player2: Ship | null = null; // Also serves as AI ship in 'vs-ai'
  public projectiles: Projectile[] = [];
  public asteroids: Asteroid[] = [];
  public collectibles: Collectible[] = [];

  // Survival Mode progress
  public score = 0;
  public wave = 1;
  public scrap = 0;
  public lives = 3;
  private survivalUpgradeCosts = { weapon: 5, shield: 5, engine: 4, special: 6 };

  // Duel Mode state
  private roundResetTimer = 0;
  private roundWinnerMessage = '';

  constructor(
    canvas: HTMLCanvasElement,
    input: InputHandler,
    sound: SoundSynthesizer,
    onStateChange: (mode: GameMode) => void
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.input = input;
    this.sound = sound;
    
    this.camera = new GameCamera();
    this.particles = new ParticleSystem();
    this.stateChangeCallback = onStateChange;

    // Resize listener
    window.addEventListener('resize', this.resizeCanvas);
    this.resizeCanvas();
  }

  private resizeCanvas = () => {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  };

  // Start the engine loop
  public start(mode: GameMode, ship1Class: ShipClass, ship2Class?: ShipClass) {
    this.mode = mode;
    this.active = true;
    this.paused = false;
    this.lastTime = performance.now();
    this.input.startCapturing();
    this.sound.resume();

    // Clear previous entities
    this.projectiles = [];
    this.asteroids = [];
    this.collectibles = [];
    this.particles.clear();
    
    // Spawn Background Stars
    this.particles.initStars(this.worldWidth, this.worldHeight, 180);

    // Reset stats depending on mode
    if (mode === 'asteroids') {
      this.score = 0;
      this.wave = 1;
      this.scrap = 0;
      this.lives = 3;
      
      // Spawn P1 in center of map
      this.player1 = new Ship(this.worldWidth / 2, this.worldHeight / 2, ship1Class, 'player1');
      this.player2 = null;

      // Spawn wave asteroids
      this.spawnAsteroidsWave(6);
    } else {
      // Duel or VS AI mode
      this.player1 = new Ship(600, this.worldHeight / 2, ship1Class, 'player1');
      this.player1.rotation = 0; // face right
      
      const p2Class = ship2Class || 'dreadnought';
      this.player2 = new Ship(this.worldWidth - 600, this.worldHeight / 2, p2Class, 'player2');
      this.player2.rotation = Math.PI; // face left

      this.roundResetTimer = 0;
      this.roundWinnerMessage = '';
    }

    // Launch loop
    requestAnimationFrame(this.gameLoop);
  }

  public stop() {
    this.active = false;
    this.input.stopCapturing();
    if (this.player1) this.sound.stopThruster(this.player1.id);
    if (this.player2) this.sound.stopThruster(this.player2.id);
  }

  // Survival Mode upgrades
  public buyUpgrade(type: 'weapon' | 'shield' | 'engine' | 'special'): boolean {
    const cost = this.survivalUpgradeCosts[type];
    if (this.scrap >= cost && this.player1) {
      this.scrap -= cost;
      this.player1.applyUpgrade(type);
      
      // Increment cost for next buy to balance progression
      this.survivalUpgradeCosts[type] = Math.floor(cost * 1.5);
      
      this.sound.playUpgrade();
      return true;
    }
    return false;
  }

  public getUpgradeCost(type: 'weapon' | 'shield' | 'engine' | 'special'): number {
    return this.survivalUpgradeCosts[type];
  }

  // Waves manager
  public nextWave() {
    this.wave++;
    if (this.player1) {
      // Replenish player's shields on docking
      this.player1.shield = this.player1.maxShield;
      this.player1.energy = this.player1.maxEnergy;
    }
    this.projectiles = [];
    this.collectibles = [];
    
    // Spawn more asteroids
    this.spawnAsteroidsWave(5 + this.wave * 2);
    this.start('asteroids', this.player1?.shipClass || 'interceptor');
  }

  private spawnAsteroidsWave(count: number) {
    for (let i = 0; i < count; i++) {
      // Spawn away from center
      let ax = Math.random() * this.worldWidth;
      let ay = Math.random() * this.worldHeight;
      
      // Keep re-rolling if too close to player center spawn
      while (Math.abs(ax - this.worldWidth / 2) < 200 && Math.abs(ay - this.worldHeight / 2) < 200) {
        ax = Math.random() * this.worldWidth;
        ay = Math.random() * this.worldHeight;
      }

      this.asteroids.push(new Asteroid(ax, ay, 3));
    }
  }

  // ==================== MAIN GAME LOOP ====================
  private gameLoop = (timestamp: number) => {
    if (!this.active) return;

    let dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    // Cap delta time to prevent physics clipping in case of lag spikes
    if (dt > 0.1) dt = 0.1;

    if (!this.paused) {
      this.update(dt);
    }
    this.draw();

    requestAnimationFrame(this.gameLoop);
  };

  // ==================== UPDATE SYSTEM ====================
  private update(dt: number) {
    const allEntities = this.getAllEntities();

    // 1. Update Player 1
    if (this.player1 && this.player1.active) {
      const p1Controls = this.input.getP1Controls();
      this.player1.updateShip(
        dt,
        this.worldWidth,
        this.worldHeight,
        p1Controls,
        this.particles,
        this.sound,
        this.projectiles,
        allEntities
      );
    }

    // 2. Update Player 2 / AI
    if (this.player2 && this.player2.active) {
      if (this.mode === 'vs-ai') {
        // AI Logic: tracks Player 1
        this.player2.updateAI(
          dt,
          this.player1,
          this.worldWidth,
          this.worldHeight,
          this.particles,
          this.sound,
          this.projectiles,
          allEntities
        );
      } else {
        // 1v1 Local Controls
        const p2Controls = this.input.getP2Controls();
        this.player2.updateShip(
          dt,
          this.worldWidth,
          this.worldHeight,
          p2Controls,
          this.particles,
          this.sound,
          this.projectiles,
          allEntities
        );
      }
    }

    // 3. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(dt, this.worldWidth, this.worldHeight);
      if (!proj.active) {
        this.projectiles.splice(i, 1);
      }
    }

    // 4. Update Asteroids
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const ast = this.asteroids[i];
      ast.update(dt, this.worldWidth, this.worldHeight);
      if (!ast.active) {
        this.asteroids.splice(i, 1);
      }
    }

    // 5. Update Collectibles (Scrap) & Magnetic Pull
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const scrapItem = this.collectibles[i];
      
      if (this.player1 && this.player1.active) {
        const dSq = Vector.distSq(scrapItem, this.player1);
        if (dSq < 220 * 220) {
          // Magnetic Pull active
          scrapItem.magneticPull = true;
          const pullForce = 350;
          const dir = Vector.normalize(Vector.sub(this.player1, scrapItem));
          scrapItem.vx += dir.x * pullForce * dt;
          scrapItem.vy += dir.y * pullForce * dt;
        }
      }

      scrapItem.update(dt, this.worldWidth, this.worldHeight);
      if (!scrapItem.active) {
        this.collectibles.splice(i, 1);
      }
    }

    // 6. Update Particles
    this.particles.update(dt, this.worldWidth, this.worldHeight);

    // 7. Check Collisions & Physics interactions
    this.handleCollisions();

    // 8. Update Camera Pan & Zoom tracking
    const target2 = (this.player2 && this.player2.active) ? this.player2 : null;
    const focus1 = this.player1 ? this.player1 : { x: this.worldWidth / 2, y: this.worldHeight / 2 };
    this.camera.update(dt, this.canvas.width, this.canvas.height, focus1, target2);

    // 9. Game State Rules / Mode Checks
    this.checkGameConditions(dt);
  }

  // Gather list of active targets for homing missiles
  private getAllEntities(): BaseEntity[] {
    const list: BaseEntity[] = [];
    if (this.player1 && this.player1.active) list.push(this.player1);
    if (this.player2 && this.player2.active) list.push(this.player2);
    for (const ast of this.asteroids) {
      if (ast.active) list.push(ast);
    }
    return list;
  }

  // ==================== COLLISION DETECTOR ====================
  private handleCollisions() {
    // A. Projectiles vs Asteroids
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      for (const ast of this.asteroids) {
        if (!ast.active) continue;
        
        if (checkHullCollision(proj.x, proj.y, proj.rotation, proj.getCollisionHulls(), ast.x, ast.y, ast.rotation, ast.getCollisionHulls())) {
          proj.active = false;
          ast.health -= proj.damage;
          
          // Small collision spark puff
          this.particles.spawnExplosion(proj.x, proj.y, ast.color, 0.4);
          this.sound.playShieldHit();

          if (ast.health <= 0) {
            this.destroyAsteroid(ast);
          }
          break;
        }
      }
    }

    // B. Projectiles vs Ships
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      
      // Check P1
      if (this.player1 && this.player1.active && (proj.ownerId !== this.player1.id || (proj.isHoming && proj.armTimer <= 0))) {
        if (checkHullCollision(proj.x, proj.y, proj.rotation, proj.getCollisionHulls(), this.player1.x, this.player1.y, this.player1.rotation, this.player1.getCollisionHulls())) {
          proj.active = false;
          if (proj.isHoming) {
            // Shut down specials: set energy to 0, lock special timer, no shield damage
            this.player1.energy = 0;
            this.player1.specialTimer = 6.0; // 6s lockout
            this.sound.playAlert();
            this.particles.spawnExplosion(proj.x, proj.y, '#ffd700', 1.2);
          } else {
            this.player1.takeDamage(proj.damage, this.sound, this.particles);
          }
          this.camera.triggerShake(12, 0.25);
          break;
        }
      }

      // Check P2
      if (this.player2 && this.player2.active && (proj.ownerId !== this.player2.id || (proj.isHoming && proj.armTimer <= 0))) {
        if (checkHullCollision(proj.x, proj.y, proj.rotation, proj.getCollisionHulls(), this.player2.x, this.player2.y, this.player2.rotation, this.player2.getCollisionHulls())) {
          proj.active = false;
          if (proj.isHoming) {
            // Shut down specials: set energy to 0, lock special timer, no shield damage
            this.player2.energy = 0;
            this.player2.specialTimer = 6.0; // 6s lockout
            this.sound.playAlert();
            this.particles.spawnExplosion(proj.x, proj.y, '#ffd700', 1.2);
          } else {
            this.player2.takeDamage(proj.damage, this.sound, this.particles);
          }
          this.camera.triggerShake(12, 0.25);
          break;
        }
      }
    }

    // C. Ship vs Asteroids (Elastic Collision Bounce!)
    const ships = [this.player1, this.player2].filter(s => s && s.active) as Ship[];
    for (const ship of ships) {
      for (const ast of this.asteroids) {
        if (!ast.active) continue;

        if (checkHullCollision(ship.x, ship.y, ship.rotation, ship.getCollisionHulls(), ast.x, ast.y, ast.rotation, ast.getCollisionHulls())) {
          this.resolveElasticBounce(ship, ast);
          
          // Apply mutual crash damage
          ship.takeDamage(20, this.sound, this.particles);
          ast.health -= 1.5;
          this.camera.triggerShake(18, 0.3);

          if (ast.health <= 0) {
            this.destroyAsteroid(ast);
          }
        }
      }
    }

    // D. Ship vs Ship (Elastic Collision Bounce!)
    if (this.player1 && this.player1.active && this.player2 && this.player2.active) {
      if (checkHullCollision(this.player1.x, this.player1.y, this.player1.rotation, this.player1.getCollisionHulls(), this.player2.x, this.player2.y, this.player2.rotation, this.player2.getCollisionHulls())) {
        this.resolveElasticBounce(this.player1, this.player2);
        
        // Take minor shield scuffs
        this.player1.takeDamage(10, this.sound, this.particles);
        this.player2.takeDamage(10, this.sound, this.particles);
        this.camera.triggerShake(15, 0.3);
      }
    }

    // E. Collectibles vs Ship
    if (this.player1 && this.player1.active) {
      for (const scrapItem of this.collectibles) {
        if (!scrapItem.active) continue;
        
        if (checkHullCollision(scrapItem.x, scrapItem.y, scrapItem.rotation, scrapItem.getCollisionHulls(), this.player1.x, this.player1.y, this.player1.rotation, this.player1.getCollisionHulls())) {
          scrapItem.active = false;
          this.scrap += scrapItem.value;
          this.score += scrapItem.value * 150;
          this.sound.playCollect();
        }
      }
    }
  }

  // Destroying Asteroid logic
  private destroyAsteroid(ast: Asteroid) {
    ast.active = false;
    this.sound.playExplosion(ast.size * 0.7);
    this.particles.spawnExplosion(ast.x, ast.y, ast.color, ast.size);
    
    // Increment Score
    const pointsGained = ast.size === 3 ? 100 : ast.size === 2 ? 50 : 25;
    this.score += pointsGained;

    // Drop scrap cores
    const scrapDropRate = ast.size === 3 ? 3 : ast.size === 2 ? 2 : 1;
    for (let j = 0; j < scrapDropRate; j++) {
      this.collectibles.push(new Collectible(
        ast.x + (Math.random() * 20 - 10),
        ast.y + (Math.random() * 20 - 10),
        1
      ));
    }

    // Split if size is Medium or Large
    if (ast.size > 1) {
      for (let s = 0; s < 2; s++) {
        this.asteroids.push(new Asteroid(ast.x, ast.y, ast.size - 1));
      }
    }
  }

  // Elastic Collision Velocity impulse vector math
  private resolveElasticBounce(e1: BaseEntity, e2: BaseEntity) {
    // Normal collision vector
    const dx = e2.x - e1.x;
    const dy = e2.y - e1.y;
    const normal = Vector.normalize({ x: dx, y: dy });

    // Relative velocity
    const rvx = e2.vx - e1.vx;
    const rvy = e2.vy - e1.vy;
    const relVel = { x: rvx, y: rvy };

    // Velocity along normal
    const velAlongNormal = Vector.dot(relVel, normal);

    // Do not resolve if velocities are separating already
    if (velAlongNormal > 0) return;

    // Restitution coefficient (bounciness factor)
    const restitution = 0.65;

    // Mass calculations (Asteroid sizes or Ship classes)
    const m1 = (e1 instanceof Ship && e1.shipClass === 'dreadnought') ? 4 : 2;
    const m2 = (e2 instanceof Asteroid) ? e2.size * 1.5 : (e2 instanceof Ship && e2.shipClass === 'dreadnought') ? 4 : 2;

    // Impulse scalar
    let impulseScalar = -(1 + restitution) * velAlongNormal;
    impulseScalar /= (1 / m1 + 1 / m2);

    // Apply impulse vector
    const impulse = Vector.mult(normal, impulseScalar);

    e1.vx -= (1 / m1) * impulse.x;
    e1.vy -= (1 / m1) * impulse.y;

    e2.vx += (1 / m2) * impulse.x;
    e2.vy += (1 / m2) * impulse.y;

    // Push entities apart slightly to prevent clipping sticking
    const overlap = (e1.radius + e2.radius) - Vector.dist(e1, e2);
    if (overlap > 0) {
      const separation = Vector.mult(normal, overlap * 0.55);
      e1.x -= separation.x;
      e1.y -= separation.y;
      e2.x += separation.x;
      e2.y += separation.y;
    }
  }

  // ==================== STATE AND MODE CONDITIONAL RULES ====================
  private checkGameConditions(dt: number) {
    if (this.mode === 'asteroids') {
      // Survival rules
      if (this.player1 && !this.player1.active) {
        // Player died!
        this.lives--;
        this.sound.playExplosion(2.0);
        
        if (this.lives > 0) {
          // Respawn player
          this.player1 = new Ship(this.worldWidth / 2, this.worldHeight / 2, this.player1.shipClass, 'player1');
          this.player1.isInvulnerable = true;
          this.player1.invulnTimer = 2.0; // 2 sec shield grace
        } else {
          // Game Over
          this.stop();
          this.stateChangeCallback('game-over');
        }
      }

      // Wave Cleared rules
      if (this.asteroids.length === 0 && this.player1 && this.player1.active) {
        this.stop();
        this.stateChangeCallback('shop'); // trigger upgrade store
      }
    } else {
      // Duel or VS AI Rules
      if (this.roundResetTimer > 0) {
        this.roundResetTimer -= dt;
        if (this.roundResetTimer <= 0) {
          this.resetRound();
        }
        return;
      }

      const p1Alive = this.player1 && this.player1.active;
      const p2Alive = this.player2 && this.player2.active;

      if (!p1Alive || !p2Alive) {
        this.roundResetTimer = 3.0; // 3 sec delay before respawn
        
        if (!p1Alive && !p2Alive) {
          this.roundWinnerMessage = 'DRAW ROUND';
        } else if (!p1Alive) {
          if (this.player2) this.player2.wins++;
          this.roundWinnerMessage = this.mode === 'vs-ai' ? 'CYBER AI SCORÈD' : 'PLAYER 2 SCORÈD';
        } else if (!p2Alive) {
          if (this.player1) this.player1.wins++;
          this.roundWinnerMessage = 'PLAYER 1 SCORÈD';
        }

        this.sound.playAlert();
      }
    }
  }

  // Resets positions for next round in local duel
  private resetRound() {
    if (!this.player1 || !this.player2) return;

    this.projectiles = [];
    this.collectibles = [];
    this.particles.clear();
    this.particles.initStars(this.worldWidth, this.worldHeight, 180);

    // Rebuild Ships
    const p1Class = this.player1.shipClass;
    const p2Class = this.player2.shipClass;

    this.player1 = new Ship(600, this.worldHeight / 2, p1Class, 'player1');
    this.player1.rotation = 0;
    this.player1.isInvulnerable = true;
    this.player1.invulnTimer = 1.5;

    this.player2 = new Ship(this.worldWidth - 600, this.worldHeight / 2, p2Class, 'player2');
    this.player2.rotation = Math.PI;
    this.player2.isInvulnerable = true;
    this.player2.invulnTimer = 1.5;

    this.roundWinnerMessage = '';
  }

  // ==================== RENDERING CYCLE ====================
  private draw() {
    // Clear screen with high-contrast fade trails
    this.ctx.fillStyle = '#030509';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply Camera Matrix
    this.camera.begin(this.ctx, this.canvas.width, this.canvas.height);

    // 1. Draw glowing space grid (Anime boundary line representation)
    this.drawWorldGrid();

    // 2. Draw Stars and dynamic particles background
    this.particles.draw(this.ctx);

    // 3. Draw Collectible cores
    for (const scrapItem of this.collectibles) {
      scrapItem.draw(this.ctx);
    }

    // 4. Draw Asteroids
    for (const ast of this.asteroids) {
      ast.draw(this.ctx);
    }

    // 5. Draw Projectiles
    for (const proj of this.projectiles) {
      proj.draw(this.ctx);
    }

    // 6. Draw Ships
    if (this.player1 && this.player1.active) {
      this.player1.draw(this.ctx);
    }
    if (this.player2 && this.player2.active) {
      this.player2.draw(this.ctx);
    }

    // Release camera matrix
    this.camera.end(this.ctx);

    // 7. Draw screen-space layouts (Duel Winner notice, Score overlays)
    if (this.roundWinnerMessage) {
      this.drawDuelMessage();
    }
  }

  // Drawing retro-anime glowing world boundaries
  private drawWorldGrid() {
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
    this.ctx.lineWidth = 1;

    // Draw grid lines
    const gridSize = 100;
    this.ctx.beginPath();
    for (let x = 0; x <= this.worldWidth; x += gridSize) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.worldHeight);
    }
    for (let y = 0; y <= this.worldHeight; y += gridSize) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.worldWidth, y);
    }
    this.ctx.stroke();

    // Draw heavy glowing red/cyan boundary walls
    this.ctx.strokeStyle = 'rgba(255, 0, 85, 0.4)';
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = '#ff0055';
    this.ctx.lineWidth = 6;
    this.ctx.strokeRect(0, 0, this.worldWidth, this.worldHeight);

    // Accent cross lines in corners
    this.ctx.shadowBlur = 0;
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    const cornerSize = 40;
    // Top-Left
    this.ctx.moveTo(0, cornerSize); this.ctx.lineTo(0, 0); this.ctx.lineTo(cornerSize, 0);
    // Top-Right
    this.ctx.moveTo(this.worldWidth - cornerSize, 0); this.ctx.lineTo(this.worldWidth, 0); this.ctx.lineTo(this.worldWidth, cornerSize);
    // Bottom-Left
    this.ctx.moveTo(0, this.worldHeight - cornerSize); this.ctx.lineTo(0, this.worldHeight); this.ctx.lineTo(cornerSize, this.worldHeight);
    // Bottom-Right
    this.ctx.moveTo(this.worldWidth - cornerSize, this.worldHeight); this.ctx.lineTo(this.worldWidth, this.worldHeight); this.ctx.lineTo(this.worldWidth, this.worldHeight - cornerSize);
    this.ctx.stroke();

    this.ctx.restore();
  }

  // Draw HUD announcement alerts in center screen (e.g. ROUND WINNER)
  private drawDuelMessage() {
    this.ctx.save();
    this.ctx.font = '900 3.2rem Orbitron';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    // Neon glow behind text
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = '#00f0ff';
    
    // Draw text in middle of canvas
    this.ctx.fillText(this.roundWinnerMessage, this.canvas.width / 2, this.canvas.height / 2 - 40);

    this.ctx.font = '400 1.2rem Share Tech Mono';
    this.ctx.fillStyle = '#a0aec0';
    this.ctx.shadowBlur = 0;
    this.ctx.fillText(`WARPING NEXT ROUND IN ${Math.ceil(this.roundResetTimer)} SECONDS...`, this.canvas.width / 2, this.canvas.height / 2 + 30);
    
    this.ctx.restore();
  }
}
