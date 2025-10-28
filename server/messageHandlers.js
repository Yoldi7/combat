/**
 * Gestión de mensajes del servidor
 */

import {
  MessageType,
  createGameStartMessage,
  createJoinSuccessMessage,
  createWaitingMessage,
  createBulletFiredMessage,
  createBulletDestroyedMessage,
  createPlayerHitMessage,
  createPlayerDiedMessage,
  createPlayerLeftMessage,
  createGameOverMessage,
  createWallsInfoMessage,
  createBulletsStateMessage,
  createGameStateMessage,
  readFloat32
} from './utils.js';

import { 
  WALLS, 
  MAP_WIDTH, 
  MAP_HEIGHT,
  BULLET_SPEED_BOOST,
  SELF_HIT_GRACE_PERIOD,
  TICK_RATE,
  BULLET_LIFETIME,
  TANK_HITBOX_WIDTH,
  TANK_HITBOX_HEIGHT
} from './constants.js';

import { pointInRotatedRect, updateBulletPhysics } from './physics.js';

// ============================================================================
// GESTIÓN DE SALAS Y JUGADORES
// ============================================================================

export function createGameRoom(GameRoomClass, player1, player2, gameRooms, playerToRoom, nextRoomId) {
  const roomId = nextRoomId;
  const room = new GameRoomClass(roomId, player1, player2);
  
  gameRooms.set(roomId, room);
  playerToRoom.set(player1.id, roomId);
  playerToRoom.set(player2.id, roomId);
  
  console.log(`🎯 Room ${roomId} created: ${player1.name} vs ${player2.name}`);
  console.log(`   Player ${player1.id} at (${room.getPlayer(player1.id).x}, ${room.getPlayer(player1.id).y})`);
  console.log(`   Player ${player2.id} at (${room.getPlayer(player2.id).x}, ${room.getPlayer(player2.id).y})`);
  
  // Enviar información de paredes
  sendWallsInfo(player1.ws);
  sendWallsInfo(player2.ws);
  
  // Enviar mensaje de inicio de partida
  const startMessage = createGameStartMessage(room);
  player1.ws.send(startMessage);
  player2.ws.send(startMessage);
  
  return room;
}

// ============================================================================
// HANDLERS DE MENSAJES
// ============================================================================

export function handleJoin(ws, buffer, lobby, nextPlayerId) {
  const playerId = nextPlayerId;
  const nameLength = buffer[1];
  const name = new TextDecoder().decode(buffer.slice(2, 2 + nameLength));
  
  const playerData = { id: playerId, name: name, ws: ws };
  ws.playerId = playerId;
  
  console.log(`👤 Player ${playerId} (${name}) joined`);
  
  // Enviar confirmación de unión
  const response = createJoinSuccessMessage(playerId);
  ws.send(response);
  
  lobby.push(playerData);
  
  // Enviar mensaje de espera
  const waitingMsg = createWaitingMessage(lobby.length);
  ws.send(waitingMsg);
  
  return playerId;
}

export function handlePlayerInput(ws, buffer, playerToRoom, gameRooms) {
  const playerId = ws.playerId;
  if (!playerId) return;
  
  const roomId = playerToRoom.get(playerId);
  if (!roomId) return;
  
  const room = gameRooms.get(roomId);
  if (!room || room.gameOver) return;
  
  const player = room.getPlayer(playerId);
  if (!player || player.health <= 0) return;
  
  const x = readFloat32(buffer, 1);
  const y = readFloat32(buffer, 5);
  const hullRotation = readFloat32(buffer, 9);
  const turretRotation = readFloat32(buffer, 13);
  
  // Log ocasional de actualizaciones de posición
  if (Math.random() < 0.01) {
    console.log(`📍 Player ${playerId} position update: (${x.toFixed(0)}, ${y.toFixed(0)})`);
  }
  
  room.updatePlayerPosition(playerId, x, y, hullRotation, turretRotation);
}

export function handleFireBullet(ws, buffer, playerToRoom, gameRooms, nextBulletId, broadcastToRoom) {
  const playerId = ws.playerId;
  if (!playerId) return null;
  
  const roomId = playerToRoom.get(playerId);
  if (!roomId) return null;
  
  const room = gameRooms.get(roomId);
  if (!room || room.gameOver) return null;
  
  const player = room.getPlayer(playerId);
  if (!player || player.health <= 0) return null;
  
  const bulletId = nextBulletId;
  
  const bulletData = {
    id: bulletId,
    playerId: playerId,
    x: readFloat32(buffer, 1),
    y: readFloat32(buffer, 5),
    rotation: readFloat32(buffer, 9),
    vx: readFloat32(buffer, 13) * BULLET_SPEED_BOOST,
    vy: readFloat32(buffer, 17) * BULLET_SPEED_BOOST,
    timestamp: Date.now(),
    ignoreOwnerUntil: Date.now() + SELF_HIT_GRACE_PERIOD,
    startX: readFloat32(buffer, 1),
    startY: readFloat32(buffer, 5)
  };
  
  console.log(`\n🔫 Bullet ${bulletId} fired by Player ${playerId} (${player.name})`);
  console.log(`   Position: (${bulletData.x.toFixed(1)}, ${bulletData.y.toFixed(1)})`);
  console.log(`   Velocity: (${bulletData.vx.toFixed(2)}, ${bulletData.vy.toFixed(2)})`);
  
  room.addBullet(bulletId, bulletData);
  
  const message = createBulletFiredMessage(bulletData);
  broadcastToRoom(roomId, message);
  
  return bulletId;
}

export function handleRematch(ws, playerToRoom, gameRooms) {
  const playerId = ws.playerId;
  if (!playerId) return;
  
  const roomId = playerToRoom.get(playerId);
  if (!roomId) return;
  
  const room = gameRooms.get(roomId);
  if (!room) return;
  
  const player = room.getPlayer(playerId);
  if (!player) return;
  
  room.setPlayerReady(playerId, true);
  
  if (room.areBothPlayersReady()) {
    restartGame(room);
  }
}

export function handlePlayerDisconnect(playerId, lobby, playerToRoom, gameRooms, broadcastToRoom) {
  console.log(`👋 Player ${playerId} disconnected`);
  
  // Eliminar del lobby
  const lobbyIndex = lobby.findIndex(p => p.id === playerId);
  if (lobbyIndex !== -1) {
    lobby.splice(lobbyIndex, 1);
  }
  
  // Eliminar de la sala
  const roomId = playerToRoom.get(playerId);
  if (roomId) {
    const room = gameRooms.get(roomId);
    if (room) {
      const message = createPlayerLeftMessage(playerId);
      broadcastToRoom(roomId, message, playerId);
      
      gameRooms.delete(roomId);
      for (const pId of room.getPlayerIds()) {
        playerToRoom.delete(pId);
      }
    }
    playerToRoom.delete(playerId);
  }
}

// ============================================================================
// ENVÍO DE MENSAJES
// ============================================================================

export function sendWallsInfo(ws) {
  const message = createWallsInfoMessage(WALLS, MAP_WIDTH, MAP_HEIGHT);
  ws.send(message);
}

export function sendBulletsState(room, broadcastToRoom) {
  const message = createBulletsStateMessage(room.bullets);
  broadcastToRoom(room.id, message);
}

export function sendGameState(room, broadcastToRoom) {
  const message = createGameStateMessage(room);
  broadcastToRoom(room.id, message);
}

export function broadcastToRoom(roomId, message, excludePlayerId = null, gameRooms) {
  const room = gameRooms.get(roomId);
  if (!room) return;
  
  for (const [id, player] of room.players.entries()) {
    if (id !== excludePlayerId && player.ws.readyState === 1) {
      player.ws.send(message);
    }
  }
}

// ============================================================================
// LÓGICA DE JUEGO
// ============================================================================

export function restartGame(room) {
  room.resetForRematch();
  const startMessage = createGameStartMessage(room);
  
  for (const player of room.getPlayersArray()) {
    player.ws.send(startMessage);
  }
}

export function processGameTick(room, broadcastToRoomFn, loopCount) {
  if (room.gameOver) return;
  
  const now = Date.now();
  const deltaTime = 1 / TICK_RATE;
  
  // Log periódico del estado de la sala
  if (loopCount % 90 === 0) {
    console.log(`\n📊 Room ${room.id} state:`);
    for (const [pId, player] of room.players.entries()) {
      console.log(`   Player ${pId} (${player.name}): (${player.x.toFixed(0)}, ${player.y.toFixed(0)}) HP:${player.health}`);
    }
    console.log(`   Active bullets: ${room.bullets.size}`);
    
    if (room.bullets.size > 0) {
      console.log(`   Bullet positions:`);
      for (const [bId, bullet] of room.bullets.entries()) {
        const age = ((now - bullet.timestamp) / 1000).toFixed(1);
        console.log(`      Bullet ${bId}: (${bullet.x.toFixed(0)}, ${bullet.y.toFixed(0)}) age: ${age}s`);
      }
    }
  }
  
  const bulletsToDelete = [];
  
  // Procesar balas
  for (const [bulletId, bullet] of room.bullets.entries()) {
    // Actualizar física de la bala
    updateBulletPhysics(bullet, deltaTime);
    
    // Verificar expiración
    const age = now - bullet.timestamp;
    if (age > BULLET_LIFETIME) {
      bulletsToDelete.push(bulletId);
      console.log(`⏰ Bullet ${bulletId} expired after ${(age/1000).toFixed(1)}s`);
      
      const msg = createBulletDestroyedMessage(bulletId);
      broadcastToRoomFn(room.id, msg);
      continue;
    }
    
    // Verificar colisiones con jugadores
    const playerArray = Array.from(room.players.entries());
    
    for (const [targetId, target] of playerArray) {
      if (target.health <= 0) continue;
      
      const isOwner = targetId === bullet.playerId;
      const owner = room.getPlayer(bullet.playerId);
      
      // Protección del dueño
      if (isOwner && Date.now() < bullet.ignoreOwnerUntil) {
        continue;
      }
      
      // Verificar colisión
      const isHit = pointInRotatedRect(
        bullet.x, 
        bullet.y, 
        target.x, 
        target.y, 
        TANK_HITBOX_WIDTH, 
        TANK_HITBOX_HEIGHT, 
        target.hullRotation
      );
      
      if (isHit) {
        console.log(`\n💥💥💥 CONFIRMED HIT! 💥💥💥`);
        console.log(`   ${owner.name}'s bullet hit ${target.name}!`);
        console.log(`  Player positions at impact: ${owner.x}, ${owner.y} | ${bullet.x}, ${bullet.y}`);
        
        const newHealth = room.hitPlayer(targetId);
        console.log(`   ${target.name} health: ${target.health + 1} → ${newHealth}`);
        
        bulletsToDelete.push(bulletId);
        
        // Destruir bala
        const destroyMsg = createBulletDestroyedMessage(bulletId);
        broadcastToRoomFn(room.id, destroyMsg);
        
        // Enviar mensaje de impacto
        const hitMsg = createPlayerHitMessage(targetId, newHealth);
        broadcastToRoomFn(room.id, hitMsg);
        
        // Verificar muerte
        if (newHealth <= 0) {
          room.recordKill(bullet.playerId);
          room.recordDeath(targetId);
          
          const diedMsg = createPlayerDiedMessage(targetId);
          broadcastToRoomFn(room.id, diedMsg);
          
          console.log(`💀 ${target.name} DIED!`);
          
          const gameOverResult = room.checkGameOver();
          if (gameOverResult.isOver) {
            const players = room.getPlayersArray();
            const gameOverMsg = createGameOverMessage(
              gameOverResult.winnerId,
              players[0],
              players[1]
            );
            broadcastToRoomFn(room.id, gameOverMsg);
            
            const winner = room.getPlayer(gameOverResult.winnerId);
            console.log(`🏆 GAME OVER! Winner: ${winner.name}`);
          }
        }
        
        break;
      }
    }
  }
  
  // Eliminar balas marcadas
  for (const bulletId of bulletsToDelete) {
    room.removeBullet(bulletId);
  }
  
  // Enviar estados actualizados
  sendGameState(room, broadcastToRoomFn);
  sendBulletsState(room, broadcastToRoomFn);
}
