/**
 * Funciones de colisión y física del juego
 */

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

/**
 * Actualiza la posición de una bala y maneja rebotes en paredes (MEJORADO)
 * @returns {object} { didBounce: boolean, bounceType: string }
 */
export function updateBulletPhysics(bullet, deltaTime) {
  const prevX = bullet.x;
  const prevY = bullet.y;
  
  // Actualizar posición
  bullet.x += bullet.vx * deltaTime;
  bullet.y += bullet.vy * deltaTime;
  
  const BULLET_SIZE = 10;
  const BULLET_RADIUS = BULLET_SIZE / 2;
  const RESTITUTION = 0.95; // Coeficiente de restitución (5% de pérdida)
  const POSITION_OFFSET = 1; // Offset para evitar colisiones múltiples
  
  let bounceInfo = { didBounce: false, bounceType: null };
  
  // Verificar colisión con paredes
  for (const wall of WALLS) {
    // Centro de la bala
    const bulletCenterX = bullet.x + BULLET_RADIUS;
    const bulletCenterY = bullet.y + BULLET_RADIUS;
    
    // Expandir ligeramente el área de colisión del muro
    const wallLeft = wall.x;
    const wallRight = wall.x + wall.w;
    const wallTop = wall.y;
    const wallBottom = wall.y + wall.h;
    
    // Verificar si hay colisión
    if (bulletCenterX + BULLET_RADIUS > wallLeft && 
        bulletCenterX - BULLET_RADIUS < wallRight &&
        bulletCenterY + BULLET_RADIUS > wallTop && 
        bulletCenterY - BULLET_RADIUS < wallBottom) {
      
      // Calcular penetración en cada lado
      const penetrationLeft = (bulletCenterX + BULLET_RADIUS) - wallLeft;
      const penetrationRight = wallRight - (bulletCenterX - BULLET_RADIUS);
      const penetrationTop = (bulletCenterY + BULLET_RADIUS) - wallTop;
      const penetrationBottom = wallBottom - (bulletCenterY - BULLET_RADIUS);
      
      // Encontrar la menor penetración (= cara más cercana)
      const minPenetration = Math.min(
        penetrationLeft,
        penetrationRight,
        penetrationTop,
        penetrationBottom
      );
      
      // Determinar qué cara fue golpeada y actuar en consecuencia
      if (minPenetration === penetrationLeft && bullet.vx > 0) {
        // Colisión con pared izquierda
        bullet.vx = -Math.abs(bullet.vx) * RESTITUTION;
        bullet.x = wallLeft - BULLET_SIZE - POSITION_OFFSET;
        bounceInfo = { didBounce: true, bounceType: 'left' };
        
      } else if (minPenetration === penetrationRight && bullet.vx < 0) {
        // Colisión con pared derecha
        bullet.vx = Math.abs(bullet.vx) * RESTITUTION;
        bullet.x = wallRight + POSITION_OFFSET;
        bounceInfo = { didBounce: true, bounceType: 'right' };
        
      } else if (minPenetration === penetrationTop && bullet.vy > 0) {
        // Colisión con pared superior
        bullet.vy = -Math.abs(bullet.vy) * RESTITUTION;
        bullet.y = wallTop - BULLET_SIZE - POSITION_OFFSET;
        bounceInfo = { didBounce: true, bounceType: 'top' };
        
      } else if (minPenetration === penetrationBottom && bullet.vy < 0) {
        // Colisión con pared inferior
        bullet.vy = Math.abs(bullet.vy) * RESTITUTION;
        bullet.y = wallBottom + POSITION_OFFSET;
        bounceInfo = { didBounce: true, bounceType: 'bottom' };
      }
      
      // Reflejar el vector de velocidad respecto a la normal de la pared
      const normal = { x: 0, y: -1 }; // Normal de la pared superior
      const dotProduct = bullet.vx * normal.x + bullet.vy * normal.y;
      bullet.vx = bullet.vx - 2 * dotProduct * normal.x;
      bullet.vy = bullet.vy - 2 * dotProduct * normal.y;
      
      // Actualizar rotación de la bala según nueva velocidad
      bullet.rotation = Math.atan2(bullet.vy, bullet.vx);
      
      break; // Solo procesar una colisión por frame
    }
  }
  
  // En la estructura de la bala
  bullet.bounceCount = 0;
  bullet.maxBounces = 3;

  // En el rebote
  if (bullet.bounceCount >= bullet.maxBounces) {
    return { didBounce: false, shouldDestroy: true };
  }
  bullet.bounceCount++;
  
  return bounceInfo;
}

/**
 * Enviar mensaje al cliente para reproducir sonido
 */
if (bounceInfo.didBounce) {
  const bounceMsg = createBulletBouncedMessage(bullet.id, bounceInfo.bounceType);
  broadcastToRoom(roomId, bounceMsg);
}
