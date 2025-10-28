import { WALLS } from './constants.js';

// ============================================================================
// DETECCIÓN DE COLISIONES
// ============================================================================

/**
 * Verifica si un punto está dentro de un rectángulo rotado
 */
export function pointInRotatedRect(pointX, pointY, rectCenterX, rectCenterY, rectWidth, rectHeight, rotation) {
  // Trasladar punto al sistema de coordenadas del rectángulo
  const dx = pointX - rectCenterX;
  const dy = pointY - rectCenterY;
  
  // Rotar punto de vuelta por -rotation
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  
  // Verificar si está dentro del rectángulo sin rotar
  const halfWidth = rectWidth / 2;
  const halfHeight = rectHeight / 2;
  
  return (
    localX >= -halfWidth && 
    localX <= halfWidth && 
    localY >= -halfHeight && 
    localY <= halfHeight
  );
}

/**
 * Verifica si dos rectángulos se intersectan
 */
export function rectIntersects(x1, y1, w1, h1, x2, y2, w2, h2) {
  return (
    x1 < x2 + w2 &&
    x1 + w1 > x2 &&
    y1 < y2 + h2 &&
    y1 + h1 > y2
  );
}

// ============================================================================
// FÍSICA DE BALAS
// ============================================================================

export function updateBulletPhysics(bullet, deltaTime) {
  bullet.x += bullet.vx * deltaTime;
  bullet.y += bullet.vy * deltaTime;
  
  const BULLET_RADIUS = 5;
  const POSITION_CORRECTION = 2;
  
  if (bullet.bounceCount === undefined) {
    bullet.bounceCount = 0;
  }
  
  let bounceInfo = { didBounce: false, bounceType: null, shouldDestroy: false };
  
  for (const wall of WALLS) {
    const bulletCenterX = bullet.x;
    const bulletCenterY = bullet.y;
    
    const wallLeft = wall.x;
    const wallRight = wall.x + wall.w;
    const wallTop = wall.y;
    const wallBottom = wall.y + wall.h;
    
    if (bulletCenterX + BULLET_RADIUS > wallLeft && 
        bulletCenterX - BULLET_RADIUS < wallRight &&
        bulletCenterY + BULLET_RADIUS > wallTop && 
        bulletCenterY - BULLET_RADIUS < wallBottom) {
      
      const distLeft = bulletCenterX - wallLeft;
      const distRight = wallRight - bulletCenterX;
      const distTop = bulletCenterY - wallTop;
      const distBottom = wallBottom - bulletCenterY;
      
      const minDist = Math.min(distLeft, distRight, distTop, distBottom);
      
      let normalX = 0;
      let normalY = 0;
      
      if (minDist === distLeft) {
        normalX = -1;
        normalY = 0;
        bullet.x = wallLeft - BULLET_RADIUS - POSITION_CORRECTION;
        bounceInfo.bounceType = 'left';
      } else if (minDist === distRight) {
        normalX = 1;
        normalY = 0;
        bullet.x = wallRight + BULLET_RADIUS + POSITION_CORRECTION;
        bounceInfo.bounceType = 'right';
      } else if (minDist === distTop) {
        normalX = 0;
        normalY = -1;
        bullet.y = wallTop - BULLET_RADIUS - POSITION_CORRECTION;
        bounceInfo.bounceType = 'top';
      } else if (minDist === distBottom) {
        normalX = 0;
        normalY = 1;
        bullet.y = wallBottom + BULLET_RADIUS + POSITION_CORRECTION;
        bounceInfo.bounceType = 'bottom';
      }
      
      const dotProduct = bullet.vx * normalX + bullet.vy * normalY;
      bullet.vx = bullet.vx - 2 * dotProduct * normalX;
      bullet.vy = bullet.vy - 2 * dotProduct * normalY;
      bullet.rotation = Math.atan2(bullet.vy, bullet.vx);
      
      bullet.bounceCount++;
      bounceInfo.didBounce = true;
      
      const MAX_BOUNCES = 5;
      if (bullet.bounceCount >= MAX_BOUNCES) {
        bounceInfo.shouldDestroy = true;
      }
      
      break;
    }
  }
  
  return bounceInfo;
}
