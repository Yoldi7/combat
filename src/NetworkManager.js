export class NetworkManager {
  constructor() {
    this.ws = null;
    this.playerId = null;
    this.connected = false;
    this.players = new Map(); // other players
    
    // Callbacks
    this.onConnected = null;
    this.onWaitingForPlayers = null;
    this.onGameStart = null;
    this.onGameState = null;
    this.onBulletFired = null;
    this.onBulletDestroyed = null;
    this.onPlayerHit = null;
    this.onPlayerDied = null;
    this.onGameOver = null;
    this.onPlayerLeft = null;
    this.onWallsInfo = null;
    this.onBulletsState = null;
    
    // Message types (must match server)
    this.MessageType = {
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
  }
  
  connect(serverUrl, playerName) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(serverUrl);
      this.ws.binaryType = 'arraybuffer';
      
      this.ws.onopen = () => {
        console.log('Connected to server');
        this.sendJoin(playerName);
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(new Uint8Array(event.data));
      };
      
      this.ws.onclose = () => {
        console.log('Disconnected from server');
        this.connected = false;
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
      
      // Wait for JOIN_SUCCESS
      const successHandler = (msg) => {
        if (msg[0] === this.MessageType.JOIN_SUCCESS) {
          this.playerId = this.readUint32(msg, 1);
          this.connected = true;
          console.log(`Joined as player ${this.playerId}`);
          if (this.onConnected) this.onConnected(this.playerId);
          resolve(this.playerId);
        }
      };
      
      this.ws.addEventListener('message', function handler(event) {
        const msg = new Uint8Array(event.data);
        if (msg[0] === 0x10) { // JOIN_SUCCESS
          successHandler(msg);
          this.removeEventListener('message', handler);
        }
      });
    });
  }
  
  sendJoin(playerName) {
    const nameBytes = new TextEncoder().encode(playerName);
    const message = new Uint8Array(2 + nameBytes.length);
    message[0] = this.MessageType.JOIN;
    message[1] = nameBytes.length;
    message.set(nameBytes, 2);
    this.send(message);
  }
  
  sendPlayerInput(x, y, hullRotation, turretRotation) {
    if (!this.connected) return;
    
    const message = new Uint8Array(17);
    message[0] = this.MessageType.PLAYER_INPUT;
    this.writeFloat32(message, 1, x);
    this.writeFloat32(message, 5, y);
    this.writeFloat32(message, 9, hullRotation);
    this.writeFloat32(message, 13, turretRotation);
    this.send(message);
  }
  
  sendFireBullet(x, y, rotation, vx, vy) {
    if (!this.connected) return;
    
    const message = new Uint8Array(22);
    message[0] = this.MessageType.FIRE_BULLET;
    this.writeFloat32(message, 1, x);
    this.writeFloat32(message, 5, y);
    this.writeFloat32(message, 9, rotation);
    this.writeFloat32(message, 13, vx);
    this.writeFloat32(message, 17, vy);
    this.send(message);
  }
  
  sendReadyForRematch() {
    if (!this.connected) return;
    
    const message = new Uint8Array(1);
    message[0] = this.MessageType.READY_FOR_REMATCH;
    this.send(message);
  }
  
  handleMessage(data) {
    const messageType = data[0];
    
    switch (messageType) {
      case this.MessageType.JOIN_SUCCESS:
        // Handled in connect()
        break;
        
      case this.MessageType.WAITING_FOR_PLAYERS:
        this.handleWaitingForPlayers(data);
        break;
        
      case this.MessageType.GAME_START:
        this.handleGameStart(data);
        break;
        
      case this.MessageType.GAME_STATE:
        this.handleGameState(data);
        break;
        
      case this.MessageType.BULLET_FIRED:
        this.handleBulletFired(data);
        break;
        
      case this.MessageType.BULLET_DESTROYED:
        this.handleBulletDestroyed(data);
        break;
        
      case this.MessageType.PLAYER_HIT:
        this.handlePlayerHit(data);
        break;
        
      case this.MessageType.PLAYER_DIED:
        this.handlePlayerDied(data);
        break;
        
      case this.MessageType.GAME_OVER:
        this.handleGameOver(data);
        break;
        
      case this.MessageType.PLAYER_LEFT:
        this.handlePlayerLeft(data);
        break;
        
      case this.MessageType.WALLS_INFO:
        this.handleWallsInfo(data);
        break;
        
      case this.MessageType.BULLETS_STATE:
        this.handleBulletsState(data);
        break;
    }
  }
  
  handleWaitingForPlayers(data) {
    const playerCount = data[1];
    console.log(`Waiting for players: ${playerCount}/2`);
    
    if (this.onWaitingForPlayers) {
      this.onWaitingForPlayers(playerCount);
    }
  }
  
  handleGameStart(data) {
    let offset = 1;
    
    // Player 1
    const player1Id = this.readUint32(data, offset);
    offset += 4;
    const player1X = this.readFloat32(data, offset);
    offset += 4;
    const player1Y = this.readFloat32(data, offset);
    offset += 4;
    const player1HullRotation = this.readFloat32(data, offset);
    offset += 4;
    const player1TurretRotation = this.readFloat32(data, offset);
    offset += 4;
    const player1NameLength = data[offset++];
    const player1Name = new TextDecoder().decode(data.slice(offset, offset + player1NameLength));
    offset += player1NameLength;
    
    // Player 2
    const player2Id = this.readUint32(data, offset);
    offset += 4;
    const player2X = this.readFloat32(data, offset);
    offset += 4;
    const player2Y = this.readFloat32(data, offset);
    offset += 4;
    const player2HullRotation = this.readFloat32(data, offset);
    offset += 4;
    const player2TurretRotation = this.readFloat32(data, offset);
    offset += 4;
    const player2NameLength = data[offset++];
    const player2Name = new TextDecoder().decode(data.slice(offset, offset + player2NameLength));
    
    console.log('Game starting!');
    
    if (this.onGameStart) {
      this.onGameStart({
        player1: { id: player1Id, x: player1X, y: player1Y, hullRotation: player1HullRotation, turretRotation: player1TurretRotation, name: player1Name },
        player2: { id: player2Id, x: player2X, y: player2Y, hullRotation: player2HullRotation, turretRotation: player2TurretRotation, name: player2Name }
      });
    }
  }
  
  handleGameState(data) {
    const playerCount = this.readUint32(data, 1);
    const players = [];
    
    let offset = 5;
    for (let i = 0; i < playerCount; i++) {
      const playerId = this.readUint32(data, offset);
      const x = this.readFloat32(data, offset + 4);
      const y = this.readFloat32(data, offset + 8);
      const hullRotation = this.readFloat32(data, offset + 12);
      const turretRotation = this.readFloat32(data, offset + 16);
      const health = data[offset + 20];
      
      players.push({ id: playerId, x, y, hullRotation, turretRotation, health });
      
      offset += 21;
    }
    
    if (this.onGameState) {
      this.onGameState(players);
    }
  }
  
  handlePlayerHit(data) {
    const playerId = this.readUint32(data, 1);
    const health = data[5];
    
    console.log(`Player ${playerId} hit! Health: ${health}`);
    
    if (this.onPlayerHit) {
      this.onPlayerHit(playerId, health);
    }
  }
  
  handlePlayerDied(data) {
    const playerId = this.readUint32(data, 1);
    
    console.log(`Player ${playerId} died!`);
    
    if (this.onPlayerDied) {
      this.onPlayerDied(playerId);
    }
  }
  
  handleGameOver(data) {
    let offset = 1;
    
    const winnerId = this.readUint32(data, offset);
    offset += 4;
    
    // Player 1 stats
    const player1Id = this.readUint32(data, offset);
    offset += 4;
    const player1Kills = data[offset++];
    const player1Deaths = data[offset++];
    const player1NameLength = data[offset++];
    const player1Name = new TextDecoder().decode(data.slice(offset, offset + player1NameLength));
    offset += player1NameLength;
    
    // Player 2 stats
    const player2Id = this.readUint32(data, offset);
    offset += 4;
    const player2Kills = data[offset++];
    const player2Deaths = data[offset++];
    const player2NameLength = data[offset++];
    const player2Name = new TextDecoder().decode(data.slice(offset, offset + player2NameLength));
    
    console.log('Game over!', { winnerId });
    
    if (this.onGameOver) {
      this.onGameOver({
        winnerId,
        player1: { id: player1Id, kills: player1Kills, deaths: player1Deaths, name: player1Name },
        player2: { id: player2Id, kills: player2Kills, deaths: player2Deaths, name: player2Name }
      });
    }
  }
  
  handlePlayerLeft(data) {
    const playerId = this.readUint32(data, 1);
    console.log(`Player ${playerId} left`);
    
    if (this.onPlayerLeft) {
      this.onPlayerLeft(playerId);
    }
  }
  
  handleBulletFired(data) {
    const bulletId = this.readUint32(data, 1);
    const playerId = this.readUint32(data, 5);
    const x = this.readFloat32(data, 9);
    const y = this.readFloat32(data, 13);
    const rotation = this.readFloat32(data, 17);
    const vx = this.readFloat32(data, 21);
    const vy = this.readFloat32(data, 25);
    
    if (this.onBulletFired) {
      this.onBulletFired(bulletId, playerId, x, y, rotation, vx, vy);
    }
  }
  
  handleBulletDestroyed(data) {
    const bulletId = this.readUint32(data, 1);
    
    if (this.onBulletDestroyed) {
      this.onBulletDestroyed(bulletId);
    }
  }
  
  handleWallsInfo(data) {
    // data[0] = WALLS_INFO
    const wallCount = this.readUint32(data, 1);
    const mapWidth = this.readFloat32(data, 5);
    const mapHeight = this.readFloat32(data, 9);
    const walls = [];
    let offset = 13;
    for (let i = 0; i < wallCount; i++) {
      const x = this.readFloat32(data, offset); offset += 4;
      const y = this.readFloat32(data, offset); offset += 4;
      const w = this.readFloat32(data, offset); offset += 4;
      const h = this.readFloat32(data, offset); offset += 4;
      walls.push({ x, y, w, h });
    }
    if (this.onWallsInfo) this.onWallsInfo(walls, mapWidth, mapHeight);
  }
  
  handleBulletsState(data) {
    // data[0] = BULLETS_STATE
    const count = this.readUint32(data, 1);
    const bullets = [];
    let offset = 5;
    for (let i = 0; i < count; i++) {
      const id = this.readUint32(data, offset); offset += 4;
      const playerId = this.readUint32(data, offset); offset += 4;
      const x = this.readFloat32(data, offset); offset += 4;
      const y = this.readFloat32(data, offset); offset += 4;
      const rotation = this.readFloat32(data, offset); offset += 4;
      const vx = this.readFloat32(data, offset); offset += 4;
      const vy = this.readFloat32(data, offset); offset += 4;
      bullets.push({ id, playerId, x, y, rotation, vx, vy });
    }
    if (this.onBulletsState) this.onBulletsState(bullets);
  }
  
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }
  
  // Binary helpers
  writeUint32(buffer, offset, value) {
    buffer[offset] = (value >> 24) & 0xFF;
    buffer[offset + 1] = (value >> 16) & 0xFF;
    buffer[offset + 2] = (value >> 8) & 0xFF;
    buffer[offset + 3] = value & 0xFF;
  }
  
  readUint32(buffer, offset) {
    return (buffer[offset] << 24) | 
           (buffer[offset + 1] << 16) | 
           (buffer[offset + 2] << 8) | 
           buffer[offset + 3];
  }
  
  writeFloat32(buffer, offset, value) {
    const view = new DataView(new ArrayBuffer(4));
    view.setFloat32(0, value, false);
    buffer[offset] = view.getUint8(0);
    buffer[offset + 1] = view.getUint8(1);
    buffer[offset + 2] = view.getUint8(2);
    buffer[offset + 3] = view.getUint8(3);
  }
  
  readFloat32(buffer, offset) {
    const bytes = new Uint8Array([buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3]]);
    return new DataView(bytes.buffer).getFloat32(0, false);
  }
}
