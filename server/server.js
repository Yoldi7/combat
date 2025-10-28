import { WebSocketServer } from 'ws';
import { GameRoom } from './GameRoom.js';
import { MessageType } from './utils.js';
import { PORT, TICK_RATE } from './constants.js';
import {
  createGameRoom,
  handleJoin,
  handlePlayerInput,
  handleFireBullet,
  handleRematch,
  handlePlayerDisconnect,
  broadcastToRoom as broadcastToRoomHelper,
  processGameTick
} from './messageHandlers.js';

// ============================================================================
// INICIALIZACIÓN DEL SERVIDOR
// ============================================================================

const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' });
console.log(`🎮 Game server running on ws://localhost:${PORT}`);

// ============================================================================
// ESTADO DEL JUEGO
// ============================================================================

const gameRooms = new Map();
const lobby = [];
const playerToRoom = new Map();
let nextPlayerId = 1;
let nextBulletId = 1;
let nextRoomId = 1;

// ============================================================================
// UTILIDAD DE BROADCAST
// ============================================================================

function broadcastToRoom(roomId, message, excludePlayerId = null) {
  broadcastToRoomHelper(roomId, message, excludePlayerId, gameRooms);
}

// ============================================================================
// MANEJO DE CONEXIONES WebSocket
// ============================================================================

wss.on('connection', (ws) => {
  console.log('🔌 New client connected');
  
  let playerId = null;
  
  ws.on('message', (data) => {
    try {
      const buffer = new Uint8Array(data);
      const messageType = buffer[0];
      
      switch (messageType) {
        case MessageType.JOIN:
          playerId = handleJoin(ws, buffer, lobby, nextPlayerId);
          nextPlayerId++;
          
          // Crear sala si hay suficientes jugadores
          if (lobby.length >= 2) {
            const player1 = lobby.shift();
            const player2 = lobby.shift();
            createGameRoom(GameRoom, player1, player2, gameRooms, playerToRoom, nextRoomId);
            nextRoomId++;
          }
          break;
          
        case MessageType.PLAYER_INPUT:
          handlePlayerInput(ws, buffer, playerToRoom, gameRooms);
          break;
          
        case MessageType.FIRE_BULLET:
          const bulletId = handleFireBullet(ws, buffer, playerToRoom, gameRooms, nextBulletId, broadcastToRoom);
          if (bulletId !== null) {
            nextBulletId++;
          }
          break;
          
        case MessageType.READY_FOR_REMATCH:
          handleRematch(ws, playerToRoom, gameRooms);
          break;
      }
    } catch (error) {
      console.error('❌ Error:', error);
    }
  });
  
  ws.on('close', () => {
    if (playerId) {
      handlePlayerDisconnect(playerId, lobby, playerToRoom, gameRooms, broadcastToRoom);
    }
  });
});

// ============================================================================
// GAME LOOP
// ============================================================================

let loopCount = 0;
setInterval(() => {
  loopCount++;
  for (const [roomId, room] of gameRooms.entries()) {
    processGameTick(room, broadcastToRoom, loopCount);
  }
}, 1000 / TICK_RATE);
