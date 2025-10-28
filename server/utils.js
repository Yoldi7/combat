/**
 * Utilidades para serialización y deserialización de mensajes binarios
 */

// ============================================================================
// ESCRITURA DE DATOS
// ============================================================================

export function writeUint32(buffer, offset, value) {
  buffer[offset] = (value >> 24) & 0xFF;
  buffer[offset + 1] = (value >> 16) & 0xFF;
  buffer[offset + 2] = (value >> 8) & 0xFF;
  buffer[offset + 3] = value & 0xFF;
}

export function writeFloat32(buffer, offset, value) {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, false);
  buffer[offset] = view.getUint8(0);
  buffer[offset + 1] = view.getUint8(1);
  buffer[offset + 2] = view.getUint8(2);
  buffer[offset + 3] = view.getUint8(3);
}

// ============================================================================
// LECTURA DE DATOS
// ============================================================================

export function readFloat32(buffer, offset) {
  const bytes = new Uint8Array([
    buffer[offset], 
    buffer[offset + 1], 
    buffer[offset + 2], 
    buffer[offset + 3]
  ]);
  return new DataView(bytes.buffer).getFloat32(0, false);
}

export function readUint32(buffer, offset) {
  return (
    (buffer[offset] << 24) |
    (buffer[offset + 1] << 16) |
    (buffer[offset + 2] << 8) |
    buffer[offset + 3]
  );
}

// ============================================================================
// TIPOS DE MENSAJES
// ============================================================================

export const MessageType = {
  // Mensajes del cliente al servidor
  JOIN: 0x01,
  PLAYER_INPUT: 0x02,
  FIRE_BULLET: 0x03,
  READY_FOR_REMATCH: 0x04,
  
  // Mensajes del servidor al cliente
  JOIN_SUCCESS: 0x10,
  GAME_STATE: 0x11,
  WAITING_FOR_PLAYERS: 0x16,
  GAME_START: 0x17,
  BULLET_FIRED: 0x18,
  PLAYER_HIT: 0x19,
  PLAYER_DIED: 0x20,
  GAME_OVER: 0x21,
  BULLET_DESTROYED: 0x22,
  PLAYER_LEFT: 0x23,
  WALLS_INFO: 0x30,
  BULLETS_STATE: 0x31
};

// ============================================================================
// CREACIÓN DE MENSAJES
// ============================================================================

export function createGameStartMessage(room) {
  const players = room.getPlayersArray();
  const name1Bytes = new TextEncoder().encode(players[0].name);
  const name2Bytes = new TextEncoder().encode(players[1].name);
  
  const message = new Uint8Array(43 + name1Bytes.length + name2Bytes.length);
  let offset = 0;
  
  message[offset++] = MessageType.GAME_START;
  
  // Player 1
  writeUint32(message, offset, players[0].id);
  offset += 4;
  writeFloat32(message, offset, players[0].x);
  offset += 4;
  writeFloat32(message, offset, players[0].y);
  offset += 4;
  writeFloat32(message, offset, players[0].hullRotation);
  offset += 4;
  writeFloat32(message, offset, players[0].turretRotation);
  offset += 4;
  message[offset++] = name1Bytes.length;
  message.set(name1Bytes, offset);
  offset += name1Bytes.length;
  
  // Player 2
  writeUint32(message, offset, players[1].id);
  offset += 4;
  writeFloat32(message, offset, players[1].x);
  offset += 4;
  writeFloat32(message, offset, players[1].y);
  offset += 4;
  writeFloat32(message, offset, players[1].hullRotation);
  offset += 4;
  writeFloat32(message, offset, players[1].turretRotation);
  offset += 4;
  message[offset++] = name2Bytes.length;
  message.set(name2Bytes, offset);
  
  return message;
}

export function createJoinSuccessMessage(playerId) {
  const response = new Uint8Array(5);
  response[0] = MessageType.JOIN_SUCCESS;
  writeUint32(response, 1, playerId);
  return response;
}

export function createWaitingMessage(playersInLobby) {
  const message = new Uint8Array(2);
  message[0] = MessageType.WAITING_FOR_PLAYERS;
  message[1] = playersInLobby;
  return message;
}

export function createBulletFiredMessage(bulletData) {
  const message = new Uint8Array(30);
  message[0] = MessageType.BULLET_FIRED;
  writeUint32(message, 1, bulletData.id);
  writeUint32(message, 5, bulletData.playerId);
  writeFloat32(message, 9, bulletData.x);
  writeFloat32(message, 13, bulletData.y);
  writeFloat32(message, 17, bulletData.rotation);
  writeFloat32(message, 21, bulletData.vx);
  writeFloat32(message, 25, bulletData.vy);
  return message;
}

export function createBulletDestroyedMessage(bulletId) {
  const message = new Uint8Array(5);
  message[0] = MessageType.BULLET_DESTROYED;
  writeUint32(message, 1, bulletId);
  return message;
}

export function createPlayerHitMessage(playerId, newHealth) {
  const message = new Uint8Array(6);
  message[0] = MessageType.PLAYER_HIT;
  writeUint32(message, 1, playerId);
  message[5] = newHealth;
  return message;
}

export function createPlayerDiedMessage(playerId) {
  const message = new Uint8Array(5);
  message[0] = MessageType.PLAYER_DIED;
  writeUint32(message, 1, playerId);
  return message;
}

export function createPlayerLeftMessage(playerId) {
  const message = new Uint8Array(5);
  message[0] = MessageType.PLAYER_LEFT;
  writeUint32(message, 1, playerId);
  return message;
}

export function createGameOverMessage(winnerId, player1, player2) {
  const name1Bytes = new TextEncoder().encode(player1.name);
  const name2Bytes = new TextEncoder().encode(player2.name);
  
  const messageSize = 1 + 4 + 4 + 1 + 1 + 1 + name1Bytes.length + 4 + 1 + 1 + 1 + name2Bytes.length;
  const message = new Uint8Array(messageSize);
  let offset = 0;
  
  message[offset++] = MessageType.GAME_OVER;
  writeUint32(message, offset, winnerId);
  offset += 4;
  
  // Player 1 stats
  writeUint32(message, offset, player1.id);
  offset += 4;
  message[offset++] = player1.kills;
  message[offset++] = player1.deaths;
  message[offset++] = name1Bytes.length;
  message.set(name1Bytes, offset);
  offset += name1Bytes.length;
  
  // Player 2 stats
  writeUint32(message, offset, player2.id);
  offset += 4;
  message[offset++] = player2.kills;
  message[offset++] = player2.deaths;
  message[offset++] = name2Bytes.length;
  message.set(name2Bytes, offset);
  
  return message;
}

export function createWallsInfoMessage(walls, mapWidth, mapHeight) {
  const wallCount = walls.length;
  const message = new Uint8Array(1 + 4 + 4 + 4 + wallCount * 16);
  let offset = 0;
  
  message[offset++] = MessageType.WALLS_INFO;
  writeUint32(message, offset, wallCount);
  offset += 4;
  writeFloat32(message, offset, mapWidth);
  offset += 4;
  writeFloat32(message, offset, mapHeight);
  offset += 4;
  
  for (const wall of walls) {
    writeFloat32(message, offset, wall.x);
    offset += 4;
    writeFloat32(message, offset, wall.y);
    offset += 4;
    writeFloat32(message, offset, wall.w);
    offset += 4;
    writeFloat32(message, offset, wall.h);
    offset += 4;
  }
  
  return message;
}

export function createBulletsStateMessage(bullets) {
  const bulletsArray = Array.from(bullets.values());
  const count = bulletsArray.length;
  const message = new Uint8Array(1 + 4 + count * 28);
  let offset = 0;
  
  message[offset++] = MessageType.BULLETS_STATE;
  writeUint32(message, offset, count);
  offset += 4;
  
  for (const bullet of bulletsArray) {
    writeUint32(message, offset, bullet.id);
    offset += 4;
    writeUint32(message, offset, bullet.playerId);
    offset += 4;
    writeFloat32(message, offset, bullet.x);
    offset += 4;
    writeFloat32(message, offset, bullet.y);
    offset += 4;
    writeFloat32(message, offset, bullet.rotation);
    offset += 4;
    writeFloat32(message, offset, bullet.vx);
    offset += 4;
    writeFloat32(message, offset, bullet.vy);
    offset += 4;
  }
  
  return message;
}

export function createGameStateMessage(room) {
  const players = room.getPlayersArray();
  const message = new Uint8Array(1 + 4 + (players.length * 21));
  
  message[0] = MessageType.GAME_STATE;
  writeUint32(message, 1, players.length);
  
  let offset = 5;
  for (const player of players) {
    writeUint32(message, offset, player.id);
    writeFloat32(message, offset + 4, player.x);
    writeFloat32(message, offset + 8, player.y);
    writeFloat32(message, offset + 12, player.hullRotation);
    writeFloat32(message, offset + 16, player.turretRotation);
    message[offset + 20] = player.health;
    offset += 21;
  }
  
  return message;
}
