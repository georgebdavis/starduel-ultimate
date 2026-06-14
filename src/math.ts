import { Vector2D, CollisionHull } from './types';

// Vector 2D Operations
export const Vector = {
  create: (x = 0, y = 0): Vector2D => ({ x, y }),
  
  add: (v1: Vector2D, v2: Vector2D): Vector2D => ({
    x: v1.x + v2.x,
    y: v1.y + v2.y,
  }),
  
  sub: (v1: Vector2D, v2: Vector2D): Vector2D => ({
    x: v1.x - v2.x,
    y: v1.y - v2.y,
  }),
  
  mult: (v: Vector2D, scalar: number): Vector2D => ({
    x: v.x * scalar,
    y: v.y * scalar,
  }),
  
  div: (v: Vector2D, scalar: number): Vector2D => ({
    x: scalar !== 0 ? v.x / scalar : 0,
    y: scalar !== 0 ? v.y / scalar : 0,
  }),
  
  magSq: (v: Vector2D): number => v.x * v.x + v.y * v.y,
  
  mag: (v: Vector2D): number => Math.sqrt(v.x * v.x + v.y * v.y),
  
  distSq: (v1: Vector2D, v2: Vector2D): number => {
    const dx = v1.x - v2.x;
    const dy = v1.y - v2.y;
    return dx * dx + dy * dy;
  },
  
  dist: (v1: Vector2D, v2: Vector2D): number => Math.sqrt(Vector.distSq(v1, v2)),
  
  normalize: (v: Vector2D): Vector2D => {
    const m = Vector.mag(v);
    return m !== 0 ? Vector.div(v, m) : { x: 0, y: 0 };
  },
  
  limit: (v: Vector2D, max: number): Vector2D => {
    const mSq = Vector.magSq(v);
    if (mSq > max * max) {
      return Vector.mult(Vector.normalize(v), max);
    }
    return { ...v };
  },
  
  dot: (v1: Vector2D, v2: Vector2D): number => v1.x * v2.x + v1.y * v2.y,
  
  lerp: (v1: Vector2D, v2: Vector2D, amt: number): Vector2D => ({
    x: v1.x + (v2.x - v1.x) * amt,
    y: v1.y + (v2.y - v1.y) * amt,
  }),
};

// Rotates offset based on center rotation angle (radians)
export function getRotatedOffset(
  cx: number,
  cy: number,
  ox: number,
  oy: number,
  angle: number
): Vector2D {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: cx + (ox * cos - oy * sin),
    y: cy + (ox * sin + oy * cos),
  };
}

// Check if two compound-circle collision hulls collide
export function checkHullCollision(
  x1: number, y1: number, angle1: number, hulls1: CollisionHull[],
  x2: number, y2: number, angle2: number, hulls2: CollisionHull[]
): boolean {
  for (const h1 of hulls1) {
    const p1 = getRotatedOffset(x1, y1, h1.offsetX, h1.offsetY, angle1);
    
    for (const h2 of hulls2) {
      const p2 = getRotatedOffset(x2, y2, h2.offsetX, h2.offsetY, angle2);
      
      const distanceSq = Vector.distSq(p1, p2);
      const combinedRadius = h1.radius + h2.radius;
      
      if (distanceSq < combinedRadius * combinedRadius) {
        return true;
      }
    }
  }
  return false;
}

// Distance from point to circle check
export function checkPointCircleCollision(
  px: number, py: number,
  cx: number, cy: number, angle: number, hulls: CollisionHull[]
): boolean {
  const p = { x: px, y: py };
  for (const h of hulls) {
    const circlePos = getRotatedOffset(cx, cy, h.offsetX, h.offsetY, angle);
    if (Vector.distSq(p, circlePos) < h.radius * h.radius) {
      return true;
    }
  }
  return false;
}
