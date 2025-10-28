import { WebSocketServer } from 'ws';
import { GameRoom } from './GameRoom.js';

const PORT = 8090;
const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' });

console.log(`🎮 Game server running on ws://localhost:${PORT}`);

// Game state
const gameRooms = new Map();
const lobby = [];
const playerToRoom = new Map();
let nextPlayerId = 1;
let nextBulletId = 1;
let nextRoomId = 1;

// Constants - in WORLD SPACE (after 0.5 scale)
const TANK_HITBOX_WIDTH = 80;
const TANK_HITBOX_HEIGHT = 50;
const BULLET_LIFETIME = 5000;
const TICK_RATE = 30;
const SELF_HIT_GRACE_PERIOD = 500;

// Dimensiones del mapa
const MAP_WIDTH = 1800;
const MAP_HEIGHT = 800;

// Definición de walls (ajustados para cubrir la ventana y nuevos obstáculos)
const WALLS = [
  { x: 0, y: 0, w: MAP_WIDTH, h: 30 }, // Top
  { x: 0, y: MAP_HEIGHT - 30, w: MAP_WIDTH, h: 30 }, // Bottom
  { x: 0, y: 0, w: 30, h: MAP_HEIGHT }, // Left
  { x: MAP_WIDTH - 30, y: 0, w: 30, h: MAP_HEIGHT }, // Right
  // Centro: cuadrado
  { x: MAP_WIDTH / 2 - 60, y: MAP_HEIGHT / 2 - 60, w: 120, h: 120 },
  // Obstáculos laterales tipo L
  { x: 150, y: 150, w: 150, h: 30 },
  { x: 150, y: 150, w: 30, h: 120 },
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

// Nuevo tipo de mensaje para walls
const MessageType = {
  JOIN: 0x01,
  PLAYER_INPUT: 0x02,
  FIRE_BULLET: 0x03,
  READY_FOR_REMATCH: 0x04,
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

function createGameRoom(player1, player2) {
  const roomId = nextRoomId++;
  const room = new GameRoom(roomId, player1, player2);
  
  gameRooms.set(roomId, room);
  playerToRoom.set(player1.id, roomId);
  playerToRoom.set(player2.id, roomId);
  
  console.log(`🎯 Room ${roomId} created: ${player1.name} vs ${player2.name}`);
  console.log(`   Player ${player1.id} at (${room.getPlayer(player1.id).x}, ${room.getPlayer(player1.id).y})`);
  console.log(`   Player ${player2.id} at (${room.getPlayer(player2.id).x}, ${room.getPlayer(player2.id).y})`);
  
  // Enviar walls info a ambos jugadores
  sendWallsInfo(player1.ws);
  sendWallsInfo(player2.ws);
  
  const startMessage = createGameStartMessage(room);
  player1.ws.send(startMessage);
  player2.ws.send(startMessage);
  
  return room;
}

function createGameStartMessage(room) {
  const players = room.getPlayersArray();
  const name1Bytes = new TextEncoder().encode(players[0].name);
  const name2Bytes = new TextEncoder().encode(players[1].name);
  
  const message = new Uint8Array(43 + name1Bytes.length + name2Bytes.length);
  let offset = 0;
  
  message[offset++] = MessageType.GAME_START;
  
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

wss.on('connection', (ws) => {
  console.log('🔌 New client connected');
  
  let playerId = null;
  
  ws.on('message', (data) => {
    try {
      const buffer = new Uint8Array(data);
      const messageType = buffer[0];
      
      switch (messageType) {
        case MessageType.JOIN:
          playerId = handleJoin(ws, buffer);
          break;
        case MessageType.PLAYER_INPUT:
          handlePlayerInput(ws, buffer);
          break;
        case MessageType.FIRE_BULLET:
          handleFireBullet(ws, buffer);
          break;
        case MessageType.READY_FOR_REMATCH:
          handleRematch(ws);
          break;
      }
    } catch (error) {
      console.error('❌ Error:', error);
    }
  });
  
  ws.on('close', () => {
    if (playerId) handlePlayerDisconnect(playerId);
  });
});

function handleJoin(ws, buffer) {
  const playerId = nextPlayerId++;
  const nameLength = buffer[1];
  const name = new TextDecoder().decode(buffer.slice(2, 2 + nameLength));
  
  const playerData = { id: playerId, name: name, ws: ws };
  ws.playerId = playerId;
  
  console.log(`👤 Player ${playerId} (${name}) joined`);
  
  const response = new Uint8Array(5);
  response[0] = MessageType.JOIN_SUCCESS;
  writeUint32(response, 1, playerId);
  ws.send(response);
  
  lobby.push(playerData);
  
  const waitingMsg = new Uint8Array(2);
  waitingMsg[0] = MessageType.WAITING_FOR_PLAYERS;
  waitingMsg[1] = lobby.length;
  ws.send(waitingMsg);
  
  if (lobby.length >= 2) {
    const player1 = lobby.shift();
    const player2 = lobby.shift();
    createGameRoom(player1, player2);
  }
  
  return playerId;
}

function handlePlayerInput(ws, buffer) {
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
  
  // Log first few position updates to verify they're working
  if (Math.random() < 0.01) { // 1% chance to log
    console.log(`📍 Player ${playerId} position update: (${x.toFixed(0)}, ${y.toFixed(0)})`);
  }
  
  room.updatePlayerPosition(playerId, x, y, hullRotation, turretRotation);
}

function handleFireBullet(ws, buffer) {
  const playerId = ws.playerId;
  if (!playerId) return;
  
  const roomId = playerToRoom.get(playerId);
  if (!roomId) return;
  
  const room = gameRooms.get(roomId);
  if (!room || room.gameOver) return;
  
  const player = room.getPlayer(playerId);
  if (!player || player.health <= 0) return;
  
  const bulletId = nextBulletId++;
  
  // Aumenta la velocidad de la bala
  const speedBoost = 60; // Valor alto para probar velocidad
  const bulletData = {
    id: bulletId,
    playerId: playerId,
    x: readFloat32(buffer, 1),
    y: readFloat32(buffer, 5),
    rotation: readFloat32(buffer, 9),
    vx: readFloat32(buffer, 13) * speedBoost,
    vy: readFloat32(buffer, 17) * speedBoost,
    timestamp: Date.now(),
    ignoreOwnerUntil: Date.now() + SELF_HIT_GRACE_PERIOD,
    startX: readFloat32(buffer, 1),
    startY: readFloat32(buffer, 5)
  };
  
  console.log(`\n🔫 Bullet ${bulletId} fired by Player ${playerId} (${player.name})`);
  console.log(`   Position: (${bulletData.x.toFixed(1)}, ${bulletData.y.toFixed(1)})`);
  console.log(`   Velocity: (${bulletData.vx.toFixed(2)}, ${bulletData.vy.toFixed(2)})`);
  
  room.addBullet(bulletId, bulletData);
  
  const message = new Uint8Array(30);
  message[0] = MessageType.BULLET_FIRED;
  writeUint32(message, 1, bulletId);
  writeUint32(message, 5, playerId);
  writeFloat32(message, 9, bulletData.x);
  writeFloat32(message, 13, bulletData.y);
  writeFloat32(message, 17, bulletData.rotation);
  writeFloat32(message, 21, bulletData.vx);
  writeFloat32(message, 25, bulletData.vy);
  
  broadcastToRoom(roomId, message);
}

function handleRematch(ws) {
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

function restartGame(room) {
  room.resetForRematch();
  const startMessage = createGameStartMessage(room);
  broadcastToRoom(room.id, startMessage);
}

function handlePlayerDisconnect(playerId) {
  console.log(`👋 Player ${playerId} disconnected`);
  
  const lobbyIndex = lobby.findIndex(p => p.id === playerId);
  if (lobbyIndex !== -1) {
    lobby.splice(lobbyIndex, 1);
  }
  
  const roomId = playerToRoom.get(playerId);
  if (roomId) {
    const room = gameRooms.get(roomId);
    if (room) {
      const message = new Uint8Array(5);
      message[0] = MessageType.PLAYER_LEFT;
      writeUint32(message, 1, playerId);
      broadcastToRoom(roomId, message, playerId);
      
      gameRooms.delete(roomId);
      for (const pId of room.getPlayerIds()) {
        playerToRoom.delete(pId);
      }
    }
    playerToRoom.delete(playerId);
  }
}

function sendWallsInfo(ws) {
  // Enviamos todos los walls como un array de enteros y el tamaño del mapa
  // Cada wall: x, y, w, h (4*4 bytes)
  const wallCount = WALLS.length;
  // Añadimos ancho y alto del mapa (2*4 bytes)
  const message = new Uint8Array(1 + 4 + 4 + 4 + wallCount * 16);
  let offset = 0;
  message[offset++] = MessageType.WALLS_INFO;
  writeUint32(message, offset, wallCount);
  offset += 4;
  writeFloat32(message, offset, MAP_WIDTH); offset += 4;
  writeFloat32(message, offset, MAP_HEIGHT); offset += 4;
  for (const wall of WALLS) {
    writeFloat32(message, offset, wall.x); offset += 4;
    writeFloat32(message, offset, wall.y); offset += 4;
    writeFloat32(message, offset, wall.w); offset += 4;
    writeFloat32(message, offset, wall.h); offset += 4;
  }
  ws.send(message);
}

function sendBulletsState(room) {
  // Enviamos todas las balas activas: id, playerId, x, y, rotation, vx, vy
  const bullets = Array.from(room.bullets.values());
  const count = bullets.length;
  // Cada bullet: id(4), playerId(4), x(4), y(4), rotation(4), vx(4), vy(4) = 28 bytes
  const message = new Uint8Array(1 + 4 + count * 28);
  let offset = 0;
  message[offset++] = MessageType.BULLETS_STATE;
  writeUint32(message, offset, count);
  offset += 4;
  for (const bullet of bullets) {
    writeUint32(message, offset, bullet.id); offset += 4;
    writeUint32(message, offset, bullet.playerId); offset += 4;
    writeFloat32(message, offset, bullet.x); offset += 4;
    writeFloat32(message, offset, bullet.y); offset += 4;
    writeFloat32(message, offset, bullet.rotation); offset += 4;
    writeFloat32(message, offset, bullet.vx); offset += 4;
    writeFloat32(message, offset, bullet.vy); offset += 4;
  }
  broadcastToRoom(room.id, message);
}

function broadcastToRoom(roomId, message, excludePlayerId = null) {
  const room = gameRooms.get(roomId);
  if (!room) return;
  
  for (const [id, player] of room.players.entries()) {
    if (id !== excludePlayerId && player.ws.readyState === 1) {
      player.ws.send(message);
    }
  }
}

// Collision detection for point in rotated rectangle
function pointInRotatedRect(pointX, pointY, rectCenterX, rectCenterY, rectWidth, rectHeight, rotation) {
  // Translate point to rectangle's coordinate system
  const dx = pointX - rectCenterX;
  const dy = pointY - rectCenterY;
  // Rotate point back by -rotation
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  // Check if inside unrotated rectangle
  const halfWidth = rectWidth / 2;
  const halfHeight = rectHeight / 2;
  const inside = (localX >= -halfWidth && localX <= halfWidth && localY >= -halfHeight && localY <= halfHeight);
  return inside;
}

// Game loop
let loopCount = 0;
setInterval(() => {
  loopCount++;
  for (const [roomId, room] of gameRooms.entries()) {
    if (room.gameOver) continue;
    const now = Date.now();
    const deltaTime = 1 / TICK_RATE; // ~0.033s
    
    // Every 3 seconds, log player positions
    if (loopCount % 90 === 0) {
      console.log(`\n📊 Room ${roomId} state:`);
      for (const [pId, player] of room.players.entries()) {
        console.log(`   Player ${pId} (${player.name}): (${player.x.toFixed(0)}, ${player.y.toFixed(0)}) HP:${player.health}`);
      }
      console.log(`   Active bullets: ${room.bullets.size}`);
      
      // Log all bullet positions
      if (room.bullets.size > 0) {
        console.log(`   Bullet positions:`);
        for (const [bId, bullet] of room.bullets.entries()) {
          const age = ((now - bullet.timestamp) / 1000).toFixed(1);
          console.log(`      Bullet ${bId}: (${bullet.x.toFixed(0)}, ${bullet.y.toFixed(0)}) age: ${age}s`);
        }
      }
    }
    
    const bulletsToDelete = [];
    for (const [bulletId, bullet] of room.bullets.entries()) {
      // Actualizar posición del bullet
      bullet.x += bullet.vx * deltaTime;
      bullet.y += bullet.vy * deltaTime;
      // Rebote en paredes
      let rebote = false;
      // Colisión con walls
      for (const wall of WALLS) {
        if (rectIntersects(bullet.x, bullet.y, 10, 10, wall.x, wall.y, wall.w, wall.h)) {
          // Rebote simple: invertir velocidad según el lado más cercano
          const prevX = bullet.x - bullet.vx * deltaTime;
          const prevY = bullet.y - bullet.vy * deltaTime;
          // Si venía de la izquierda/derecha
          if (prevX < wall.x || prevX > wall.x + wall.w) {
            bullet.vx = -bullet.vx;
            rebote = true;
          }
          // Si venía de arriba/abajo
          if (prevY < wall.y || prevY > wall.y + wall.h) {
            bullet.vy = -bullet.vy;
            rebote = true;
          }
          // Corrige posición para evitar quedarse dentro del wall
          if (bullet.x < wall.x) bullet.x = wall.x;
          if (bullet.x > wall.x + wall.w) bullet.x = wall.x + wall.w;
          if (bullet.y < wall.y) bullet.y = wall.y;
          if (bullet.y > wall.y + wall.h) bullet.y = wall.y + wall.h;
        }
      }
      // Check expiration
      const age = now - bullet.timestamp;
      if (age > BULLET_LIFETIME) {
        bulletsToDelete.push(bulletId);
        console.log(`⏰ Bullet ${bulletId} expired after ${(age/1000).toFixed(1)}s`);
        const msg = new Uint8Array(5);
        msg[0] = MessageType.BULLET_DESTROYED;
        writeUint32(msg, 1, bulletId);
        broadcastToRoom(roomId, msg);
        continue;
      }
      
      // Check collision with ALL players in the room
      const playerArray = Array.from(room.players.entries());
      
      for (const [targetId, target] of playerArray) {
        if (target.health <= 0) continue;
        
        const isOwner = targetId === bullet.playerId;
        const owner = room.getPlayer(bullet.playerId);
        
        // Owner protection
        if (isOwner) {         
          if (Date.now() < bullet.ignoreOwnerUntil) {
            continue;
          }
        }
          
          // PERFORM COLLISION CHECK
          const isHit = pointInRotatedRect(
            bullet.x, 
            bullet.y, 
            target.x, 
            target.y, 
            TANK_HITBOX_WIDTH, 
            TANK_HITBOX_HEIGHT, 
            target.hullRotation
          );
          
          console.log(`   Result: ${isHit ? '💥 HIT!' : '❌ MISS'} ${bullet.x}`);
          
          if (isHit) {
            console.log(`\n💥💥💥 CONFIRMED HIT! 💥💥💥`);
            console.log(`   ${owner.name}'s bullet hit ${target.name}!`);
            console.log(`  Player positions at impact: ${owner.x}, ${owner.y} | ${bullet.x}, ${bullet.y}`);
            
            const newHealth = room.hitPlayer(targetId);
            console.log(`   ${target.name} health: ${target.health + 1} → ${newHealth}`);
            
            bulletsToDelete.push(bulletId);
            
            // Destroy bullet
            const destroyMsg = new Uint8Array(5);
            destroyMsg[0] = MessageType.BULLET_DESTROYED;
            writeUint32(destroyMsg, 1, bulletId);
            broadcastToRoom(roomId, destroyMsg);
            
            // Send hit message
            const hitMsg = new Uint8Array(6);
            hitMsg[0] = MessageType.PLAYER_HIT;
            writeUint32(hitMsg, 1, targetId);
            hitMsg[5] = newHealth;
            broadcastToRoom(roomId, hitMsg);
            
            // Check death
            if (newHealth <= 0) {
              room.recordKill(bullet.playerId);
              room.recordDeath(targetId);
              
              const diedMsg = new Uint8Array(5);
              diedMsg[0] = MessageType.PLAYER_DIED;
              writeUint32(diedMsg, 1, targetId);
              broadcastToRoom(roomId, diedMsg);
              
              console.log(`💀 ${target.name} DIED!`);
              
              const gameOverResult = room.checkGameOver();
              if (gameOverResult.isOver) {
                const players = room.getPlayersArray();
                const gameOverMsg = createGameOverMessage(
                  gameOverResult.winnerId,
                  players[0],
                  players[1]
                );
                broadcastToRoom(roomId, gameOverMsg);
                
                const winner = room.getPlayer(gameOverResult.winnerId);
                console.log(`🏆 GAME OVER! Winner: ${winner.name}`);
              }
            }
            
            break; // Stop checking other players
          }
        
      }
    }
    
    // Delete marked bullets
    for (const bulletId of bulletsToDelete) {
      room.removeBullet(bulletId);
    }
    
    // Send game state
    sendGameState(room);
    sendBulletsState(room); // Enviar estado de balas a los clientes
  }
}, 1000 / TICK_RATE);

// Función de colisión rect-rect
function rectIntersects(x1, y1, w1, h1, x2, y2, w2, h2) {
  return (
    x1 < x2 + w2 &&
    x1 + w1 > x2 &&
    y1 < y2 + h2 &&
    y1 + h1 > y2
  );
}

function sendGameState(room) {
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
  broadcastToRoom(room.id, message);
}

function createGameOverMessage(winnerId, player1, player2) {
  const name1Bytes = new TextEncoder().encode(player1.name);
  const name2Bytes = new TextEncoder().encode(player2.name);
  
  const messageSize = 1 + 4 + 4 + 1 + 1 + 1 + name1Bytes.length + 4 + 1 + 1 + 1 + name2Bytes.length;
  const message = new Uint8Array(messageSize);
  let offset = 0;
  
  message[offset++] = MessageType.GAME_OVER;
  writeUint32(message, offset, winnerId);
  offset += 4;
  
  writeUint32(message, offset, player1.id);
  offset += 4;
  message[offset++] = player1.kills;
  message[offset++] = player1.deaths;
  message[offset++] = name1Bytes.length;
  message.set(name1Bytes, offset);
  offset += name1Bytes.length;
  
  writeUint32(message, offset, player2.id);
  offset += 4;
  message[offset++] = player2.kills;
  message[offset++] = player2.deaths;
  message[offset++] = name2Bytes.length;
  message.set(name2Bytes, offset);
  
  return message;
}

function writeUint32(buffer, offset, value) {
  buffer[offset] = (value >> 24) & 0xFF;
  buffer[offset + 1] = (value >> 16) & 0xFF;
  buffer[offset + 2] = (value >> 8) & 0xFF;
  buffer[offset + 3] = value & 0xFF;
}

function readFloat32(buffer, offset) {
  const bytes = new Uint8Array([buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3]]);
  return new DataView(bytes.buffer).getFloat32(0, false);
}

function writeFloat32(buffer, offset, value) {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, false);
  buffer[offset] = view.getUint8(0);
  buffer[offset + 1] = view.getUint8(1);
  buffer[offset + 2] = view.getUint8(2);
  buffer[offset + 3] = view.getUint8(3);
}
