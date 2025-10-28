/**
 * Constantes del juego
 */

// ============================================================================
// CONFIGURACIÓN DEL SERVIDOR
// ============================================================================

export const PORT = 8090;
export const TICK_RATE = 30;

// ============================================================================
// CONFIGURACIÓN DEL MAPA
// ============================================================================

export const MAP_WIDTH = 1800;
export const MAP_HEIGHT = 800;

// ============================================================================
// CONFIGURACIÓN DE ENTIDADES
// ============================================================================

// Dimensiones en WORLD SPACE (después de escala 0.5)
export const TANK_HITBOX_WIDTH = 80;
export const TANK_HITBOX_HEIGHT = 50;

// Configuración de balas
export const BULLET_LIFETIME = 5000; // ms
export const BULLET_SPEED_BOOST = 60;
export const SELF_HIT_GRACE_PERIOD = 500; // ms

// ============================================================================
// DEFINICIÓN DE PAREDES
// ============================================================================

export const WALLS = [
  // Bordes del mapa
  { x: 0, y: 0, w: MAP_WIDTH, h: 30 }, // Top
  { x: 0, y: MAP_HEIGHT - 30, w: MAP_WIDTH, h: 30 }, // Bottom
  { x: 0, y: 0, w: 30, h: MAP_HEIGHT }, // Left
  { x: MAP_WIDTH - 30, y: 0, w: 30, h: MAP_HEIGHT }, // Right
  
  // Centro: cuadrado
  { x: MAP_WIDTH / 2 - 60, y: MAP_HEIGHT / 2 - 60, w: 120, h: 120 },
  
  // Obstáculos laterales tipo L (izquierda)
  { x: 150, y: 150, w: 150, h: 30 },
  { x: 150, y: 150, w: 30, h: 120 },
  
  // Obstáculos laterales tipo L (derecha)
  { x: MAP_WIDTH - 300, y: 150, w: 150, h: 30 },
  { x: MAP_WIDTH - 180, y: 150, w: 30, h: 120 },
  
  // Obstáculos inferiores
  { x: 250, y: MAP_HEIGHT - 200, w: 100, h: 30 },
  { x: MAP_WIDTH - 350, y: MAP_HEIGHT - 200, w: 100, h: 30 },
  
  // Obstáculos pequeños extra
  { x: 400, y: 400, w: 40, h: 40 },
  { x: MAP_WIDTH - 440, y: 400, w: 40, h: 40 },
  { x: MAP_WIDTH / 2 - 20, y: 100, w: 40, h: 40 },
  { x: MAP_WIDTH / 2 - 20, y: MAP_HEIGHT - 140, w: 40, h: 40 }
];
