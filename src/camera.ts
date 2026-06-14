import { Vector2D } from './types';
import { Vector } from './math';

export class GameCamera {
  public x = 0;
  public y = 0;
  public zoom = 1.0;
  
  private targetX = 0;
  private targetY = 0;
  private targetZoom = 1.0;
  
  // Screen Shake states
  private shakeIntensity = 0;
  private shakeTimer = 0;
  private shakeOffset: Vector2D = { x: 0, y: 0 };

  constructor() {}

  // Trigger camera rumble
  public triggerShake(intensity: number, duration: number) {
    this.shakeIntensity = intensity;
    this.shakeTimer = duration;
  }

  // Focus on single player (Survival) or track midpoint between two (Duel)
  public update(
    dt: number,
    viewportW: number,
    viewportH: number,
    p1: Vector2D,
    p2: Vector2D | null
  ) {
    // 1. Calculate Target Camera Center & Zoom
    if (p2) {
      // Duel Mode: mid point between two ships
      const mid = Vector.div(Vector.add(p1, p2), 2);
      this.targetX = mid.x;
      this.targetY = mid.y;

      // Calculate distance to determine zoom scaling
      const distance = Vector.dist(p1, p2);
      const margin = 200; // breathing room padding
      
      // Scale camera so both fit. Calculate zoom based on limiting axis
      const zoomX = viewportW / (distance + margin);
      const zoomY = viewportH / (distance + margin);
      
      // Clamp zoom between 0.45 (zoomed out far) and 1.1 (zoomed in close)
      this.targetZoom = Math.max(0.45, Math.min(1.1, Math.min(zoomX, zoomY)));
    } else {
      // Survival Mode: follow single player
      this.targetX = p1.x;
      this.targetY = p1.y;
      this.targetZoom = 1.0;
    }

    // 2. Smoothly interpolate camera movement (lerp)
    const lerpSpeed = p2 ? 6 * dt : 4 * dt;
    this.x += (this.targetX - this.x) * lerpSpeed;
    this.y += (this.targetY - this.y) * lerpSpeed;
    this.zoom += (this.targetZoom - this.zoom) * lerpSpeed;

    // 3. Process Screen Shake
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const currentIntensity = this.shakeIntensity * (this.shakeTimer / 0.3); // decay
      this.shakeOffset.x = (Math.random() * 2 - 1) * currentIntensity;
      this.shakeOffset.y = (Math.random() * 2 - 1) * currentIntensity;
    } else {
      this.shakeOffset.x = 0;
      this.shakeOffset.y = 0;
    }
  }

  // Applies transformation context to Canvas
  public begin(ctx: CanvasRenderingContext2D, viewportW: number, viewportH: number) {
    ctx.save();
    
    // 1. Center camera viewport on screen
    ctx.translate(viewportW / 2, viewportH / 2);
    
    // 2. Apply camera zoom
    ctx.scale(this.zoom, this.zoom);
    
    // 3. Translate camera positioning in world space + screen shake
    ctx.translate(-this.x + this.shakeOffset.x, -this.y + this.shakeOffset.y);
  }

  public end(ctx: CanvasRenderingContext2D) {
    ctx.restore();
  }

  // Helper: converts screen pixel coordinates to world coordinates
  public screenToWorld(sx: number, sy: number, viewportW: number, viewportH: number): Vector2D {
    return {
      x: (sx - viewportW / 2) / this.zoom + this.x,
      y: (sy - viewportH / 2) / this.zoom + this.y,
    };
  }
}
