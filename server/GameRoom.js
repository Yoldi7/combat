export class GameRoom {
  constructor(roomId, player1, player2) {
    this.id = roomId;
    this.players = new Map([
      [player1.id, {
        ...player1,
        health: 3,
        x: 200,
        y: 400,
        hullRotation: 0,
        turretRotation: 0,
        kills: 0,
        deaths: 0,
        isReady: false
      }],
      [player2.id, {
        ...player2,
        health: 3,
        x: 1600,
        y: 400,
        hullRotation: Math.PI,
        turretRotation: Math.PI,
        kills: 0,
        deaths: 0,
        isReady: false
      }]
    ]),
    this.bullets = new Map();
    this.gameStarted = true;
    this.gameOver = false;
  }

  addBullet(bulletId, bullet) {
    bullet.timestamp = Date.now();
    this.bullets.set(bulletId, bullet);
  }

  removeBullet(bulletId) {
    this.bullets.delete(bulletId);
  }

  getPlayer(playerId) {
    return this.players.get(playerId);
  }

  updatePlayerPosition(playerId, x, y, hullRotation, turretRotation) {
    const player = this.players.get(playerId);
    if (player) {
      player.x = x;
      player.y = y;
      player.hullRotation = hullRotation;
      player.turretRotation = turretRotation;
    }
  }

  hitPlayer(playerId) {
    const player = this.players.get(playerId);
    if (player && player.health > 0) {
      player.health--;
      return player.health;
    }
    return 0;
  }

  recordKill(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      player.kills++;
    }
  }

  recordDeath(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      player.deaths++;
    }
  }

  checkGameOver() {
    let alivePlayers = 0;
    let winnerId = null;

    for (const [id, player] of this.players.entries()) {
      if (player.health > 0) {
        alivePlayers++;
        winnerId = id;
      }
    }

    if (alivePlayers <= 1) {
      this.gameOver = true;
      return { isOver: true, winnerId };
    }

    return { isOver: false, winnerId: null };
  }

  setPlayerReady(playerId, ready) {
    const player = this.players.get(playerId);
    if (player) {
      player.isReady = ready;
    }
  }

  areBothPlayersReady() {
    for (const player of this.players.values()) {
      if (!player.isReady) return false;
    }
    return true;
  }

  resetForRematch() {
    const playersArray = Array.from(this.players.entries());
    
    // Reset player 1
    const p1 = playersArray[0][1];
    p1.health = 3;
    p1.x = 200;
    p1.y = 400;
    p1.hullRotation = 0;
    p1.turretRotation = 0;
    p1.kills = 0;
    p1.deaths = 0;
    p1.isReady = false;
    
    // Reset player 2
    const p2 = playersArray[1][1];
    p2.health = 3;
    p2.x = 1000;
    p2.y = 400;
    p2.hullRotation = Math.PI;
    p2.turretRotation = Math.PI;
    p2.kills = 0;
    p2.deaths = 0;
    p2.isReady = false;
    
    this.bullets.clear();
    this.gameStarted = true;
    this.gameOver = false;
  }

  getPlayersArray() {
    return Array.from(this.players.values());
  }

  getPlayerIds() {
    return Array.from(this.players.keys());
  }

  hasPlayer(playerId) {
    return this.players.has(playerId);
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
  }

  isEmpty() {
    return this.players.size === 0;
  }
}
