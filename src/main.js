import { Application, Assets, Text, Graphics, Container } from "pixi.js";
import { Tank } from "./Tank.js";
import { Wall } from "./Wall.js";
import { Bullet } from "./Bullet.js";
import { NetworkManager } from "./NetworkManager.js";

(async () => {
  // Get player info from session storage
  const playerName = sessionStorage.getItem('playerName') || 'Player';
  
  // Detectar IP local del cliente automáticamente si no está en session storage
  function detectLocalIP() {
    const hostname = window.location.hostname;
    const port = '8090';
    
    // Si accedes desde localhost, usa localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `ws://localhost:${port}`;
    }
    
    // Si accedes desde una IP real, usa esa IP
    return `ws://${hostname}:${port}`;
  }
  
  const serverUrl = detectLocalIP();

  // Create a new application
  const app = new Application();

  // Initialize the application
  await app.init({ background: "#946a33ff", resizeTo: window });

  // Append the application canvas to the document body
  document.getElementById("pixi-container").appendChild(app.canvas);

  // Load the tank textures
  const hullTexture = await Assets.load("/assets/hull.svg");
  const turretTexture = await Assets.load("/assets/turret.svg");

  // Walls dinámicos recibidos del servidor
  let walls = [];
  let mapWidth = 1800;
  let mapHeight = 800;
  
  // UI Container
  const uiContainer = new Container();
  app.stage.addChild(uiContainer);

  // Lobby screen
  const lobbyScreen = new Container();
  const lobbyBg = new Graphics();
  lobbyBg.rect(0, 0, app.screen.width, app.screen.height);
  lobbyBg.fill(0x000000, 0.7);
  lobbyScreen.addChild(lobbyBg);
  
  const lobbyText = new Text({
    text: 'Waiting for players...\n0/2 Players',
    style: { fill: 0xffffff, fontSize: 36, align: 'center' }
  });
  lobbyText.anchor.set(0.5);
  lobbyText.position.set(app.screen.width / 2, app.screen.height / 2);
  lobbyScreen.addChild(lobbyText);
  uiContainer.addChild(lobbyScreen);

  // Health UI function
  function createHealthUI(x, y, color) {
    const healthContainer = new Container();
    healthContainer.position.set(x, y);
    
    const hearts = [];
    for (let i = 0; i < 3; i++) {
      const heart = new Graphics();
      heart.circle(0, 0, 15);
      heart.fill(color);
      heart.position.set(i * 40, 0);
      healthContainer.addChild(heart);
      hearts.push(heart);
    }
    
    return { container: healthContainer, hearts };
  }

  // Player health displays
  let playerHealthUI = null;
  let enemyHealthUI = null;
  
  // Player name labels
  const playerNameText = new Text({
    text: playerName,
    style: { fill: 0x0000FF, fontSize: 18, fontWeight: 'bold' }
  });
  playerNameText.position.set(50, 90);
  uiContainer.addChild(playerNameText);
  playerNameText.visible = false;

  const enemyNameText = new Text({
    text: '',
    style: { fill: 0xFF0000, fontSize: 18, fontWeight: 'bold' }
  });
  enemyNameText.anchor.set(1, 0);
  enemyNameText.position.set(app.screen.width - 50, 90);
  uiContainer.addChild(enemyNameText);
  enemyNameText.visible = false;

  // Game Over screen
  const gameOverScreen = new Container();
  const gameOverBg = new Graphics();
  gameOverBg.rect(0, 0, app.screen.width, app.screen.height);
  gameOverBg.fill(0x000000, 0.8);
  gameOverScreen.addChild(gameOverBg);
  
  const gameOverTitle = new Text({
    text: '',
    style: { fill: 0xFFD700, fontSize: 48, fontWeight: 'bold', align: 'center' }
  });
  gameOverTitle.anchor.set(0.5);
  gameOverTitle.position.set(app.screen.width / 2, app.screen.height / 2 - 150);
  gameOverScreen.addChild(gameOverTitle);
  
  const statsText = new Text({
    text: '',
    style: { fill: 0xffffff, fontSize: 24, align: 'center' }
  });
  statsText.anchor.set(0.5);
  statsText.position.set(app.screen.width / 2, app.screen.height / 2);
  gameOverScreen.addChild(statsText);
  
  const rematchButton = new Graphics();
  rematchButton.rect(-100, -30, 200, 60);
  rematchButton.fill(0x4CAF50);
  rematchButton.position.set(app.screen.width / 2, app.screen.height / 2 + 150);
  rematchButton.eventMode = 'static';
  rematchButton.cursor = 'pointer';
  gameOverScreen.addChild(rematchButton);
  
  const rematchText = new Text({
    text: 'Main Menu',
    style: { fill: 0xffffff, fontSize: 24, fontWeight: 'bold' }
  });
  rematchText.anchor.set(0.5);
  rematchText.position.set(app.screen.width / 2, app.screen.height / 2 + 150);
  gameOverScreen.addChild(rematchText);
  
  uiContainer.addChild(gameOverScreen);
  gameOverScreen.visible = false;

  // Network manager
  const network = new NetworkManager();
  
  // Player tanks
  let localTank = null;
  let enemyTank = null;
  let myPlayerId = null;
  let enemyPlayerId = null;
  let localPlayerHealth = 3;
  let enemyPlayerHealth = 3;
  
  // Network bullets
  const networkBullets = new Map();
  
  // Game state
  let gameStarted = false;

  // Update health UI
  function updateHealthUI(healthUI, health) {
    console.log(`   💚 updateHealthUI called with health: ${health}`);
    for (let i = 0; i < healthUI.hearts.length; i++) {
      const shouldShow = i < health;
      healthUI.hearts[i].alpha = shouldShow ? 1 : 0.2;
      console.log(`      Heart ${i}: alpha = ${healthUI.hearts[i].alpha} (health: ${health}, i: ${i}, show: ${shouldShow})`);
    }
  }

  // Try to connect
  try {
    myPlayerId = await network.connect(serverUrl, playerName);
    console.log(`Connected with ID: ${myPlayerId}`);
  } catch (error) {
    console.error('Failed to connect:', error);
    lobbyText.text = 'Connection failed!\nReturning to menu...';
    setTimeout(() => {
      window.location.href = '/index.html';
    }, 2000);
    return;
  }

  // Network callbacks
  network.onWaitingForPlayers = (playerCount) => {
    lobbyScreen.visible = true;
    lobbyText.text = `Waiting for players...\n${playerCount}/2 Players`;
  };

  network.onGameStart = (data) => {
    console.log('Game started!', data);
    gameStarted = true;
    lobbyScreen.visible = false;
    
  // Determina el lado de inicio
  const isPlayer1 = data.player1.id === myPlayerId;
  const myData = isPlayer1 ? data.player1 : data.player2;
  const enemyData = isPlayer1 ? data.player2 : data.player1;
  enemyPlayerId = enemyData.id;
    // Posición de vidas según spawn
    if (isPlayer1) {
      playerHealthUI = createHealthUI(50, 50, 0x0000FF); // Azul izquierda
      enemyHealthUI = createHealthUI(app.screen.width - 170, 50, 0xFF0000); // Rojo derecha
      playerNameText.position.set(50 + 60, 50 + 40); // Centrado debajo de vidas
      enemyNameText.position.set(app.screen.width - 170 + 60, 50 + 40); // Centrado debajo de vidas
    } else {
      playerHealthUI = createHealthUI(app.screen.width - 170, 50, 0x0000FF); // Azul derecha
      enemyHealthUI = createHealthUI(50, 50, 0xFF0000); // Rojo izquierda
      playerNameText.position.set(app.screen.width - 170 + 60, 50 + 40);
      enemyNameText.position.set(50 + 60, 50 + 40);
    }
    uiContainer.addChild(playerHealthUI.container);
    uiContainer.addChild(enemyHealthUI.container);
    playerHealthUI.container.visible = true;
    enemyHealthUI.container.visible = true;
    playerNameText.visible = true;
    enemyNameText.visible = true;
    updateHealthUI(playerHealthUI, 3);
    updateHealthUI(enemyHealthUI, 3);
    
    // Create local tank (scaled to 0.5)
    localTank = new Tank(app, hullTexture, turretTexture, true);
    localTank.container.scale.set(0.5);
    localTank.setPosition(myData.x, myData.y);
    localTank.hull.rotation = myData.hullRotation;
    localTank.turret.rotation = myData.turretRotation;
    localTank.addToStage(app.stage);
    
    // Override bullet creation to send a request to the server ONLY (no local bullet)
    localTank.createBullet = function() {
      const effectiveCannonLength = this.cannonLength * this.container.scale.x;
      const cannonTipX = this.container.x + Math.cos(this.turret.rotation) * effectiveCannonLength;
      const cannonTipY = this.container.y + Math.sin(this.turret.rotation) * effectiveCannonLength;
      const vx = Math.cos(this.turret.rotation) * this.bulletSpeed;
      const vy = Math.sin(this.turret.rotation) * this.bulletSpeed;
      network.sendFireBullet(cannonTipX, cannonTipY, this.turret.rotation, vx, vy);
      // NO local bullet
    };
    
    // Create enemy tank (scaled to 0.5)
    enemyTank = new Tank(app, hullTexture, turretTexture, false);
    enemyTank.container.scale.set(0.5);
    enemyTank.setPosition(enemyData.x, enemyData.y);
    enemyTank.hull.rotation = enemyData.hullRotation;
    enemyTank.turret.rotation = enemyData.turretRotation;
    enemyTank.addToStage(app.stage);
  };

  network.onGameState = (players) => {
    if (!gameStarted || !enemyTank) return;
    players.forEach(playerData => {
      if (playerData.id === enemyPlayerId) {
        enemyTank.setPosition(playerData.x, playerData.y);
        enemyTank.hull.rotation = playerData.hullRotation;
        enemyTank.turret.rotation = playerData.turretRotation;
        
        // Update health if changed
        if (playerData.health !== undefined && playerData.health !== enemyPlayerHealth) {
          enemyPlayerHealth = playerData.health;
          updateHealthUI(enemyHealthUI, enemyPlayerHealth);
        }
      } else if (playerData.id === myPlayerId) {
        // Update our health from server
        if (playerData.health !== undefined && playerData.health !== localPlayerHealth) {
          localPlayerHealth = playerData.health;
          updateHealthUI(playerHealthUI, localPlayerHealth);
        }
      }
    });
  };

  network.onBulletFired = (bulletId, playerId, x, y, rotation, vx, vy) => {
    if (!gameStarted) return;
    
    // Don't create bullets from our own player (already created locally)
    if (playerId === myPlayerId) return;
    
    const bullet = new Bullet(x, y, rotation, 5);
    bullet.vx = vx;
    bullet.vy = vy;
    bullet.addToStage(app.stage);
    networkBullets.set(bulletId, bullet);
  };

  network.onBulletDestroyed = (bulletId) => {
    const bullet = networkBullets.get(bulletId);
    if (bullet) {
      bullet.destroy(app.stage);
      networkBullets.delete(bulletId);
    }
  };

  network.onPlayerHit = (playerId, health) => {
    console.log(`🎯 CLIENT: onPlayerHit called - playerId: ${playerId}, health: ${health}, myPlayerId: ${myPlayerId}, enemyPlayerId: ${enemyPlayerId}`);
    
    if (playerId === myPlayerId) {
      console.log(`   ❤️ Updating MY health from ${localPlayerHealth} to ${health}`);
      localPlayerHealth = health;
      updateHealthUI(playerHealthUI, health);
    } else if (playerId === enemyPlayerId) {
      console.log(`   💔 Updating ENEMY health from ${enemyPlayerHealth} to ${health}`);
      enemyPlayerHealth = health;
      updateHealthUI(enemyHealthUI, health);
    } else {
      console.warn(`   ⚠️ Unknown playerId ${playerId} hit!`);
    }
  };

  network.onPlayerDied = (playerId) => {
    console.log(`Player ${playerId} died!`);
    
    // Flash effect or animation could go here
    if (playerId === enemyPlayerId && enemyTank) {
      enemyTank.container.alpha = 0.3;
    } else if (playerId === myPlayerId && localTank) {
      localTank.container.alpha = 0.3;
    }
  };

  network.onGameOver = (data) => {
    console.log('Game over!', data);
    gameStarted = false;
    // Elimina los muros del stage
    walls.forEach(wall => wall.removeFromStage && wall.removeFromStage(app.stage));
    walls = [];
    // Oculta los tanques
    if (localTank) localTank.container.visible = false;
    if (enemyTank) enemyTank.container.visible = false;
    // Elimina todas las balas de la pantalla
    for (const bullet of networkBullets.values()) {
      bullet.destroy(app.stage);
    }
    networkBullets.clear();
    // Show game over screen
    const isWinner = data.winnerId === myPlayerId;
    gameOverTitle.text = isWinner ? 'VICTORY!' : 'DEFEAT';
    gameOverTitle.style.fill = isWinner ? 0x00FF00 : 0xFF0000;
    
    // Format stats
    const myStats = data.player1.id === myPlayerId ? data.player1 : data.player2;
    const enemyStats = data.player1.id === myPlayerId ? data.player2 : data.player1;
    
    statsText.text = `
  ${myStats.name} (You)
  Kills: ${myStats.kills} | Deaths: ${myStats.deaths}

  ${enemyStats.name}
  Kills: ${enemyStats.kills} | Deaths: ${enemyStats.deaths}
    `.trim();
    
    gameOverScreen.visible = true;
  };

  network.onPlayerLeft = (playerId) => {
    if (gameStarted) {
      // Enemy disconnected during game
      alert('Enemy player disconnected. Returning to menu...');
      window.location.href = '/index.html';
    }
  };

  // Rematch button - return to main menu
  rematchButton.on('pointerdown', () => {
    network.disconnect();
    window.location.href = '/index.html';
  });

  // Sincroniza balas de red con el servidor
  network.onBulletsState = (bullets) => {
    // Actualiza o crea balas
    const receivedIds = new Set();
    for (const b of bullets) {
      receivedIds.add(b.id);
      let bullet = networkBullets.get(b.id);
      if (!bullet) {
        bullet = new Bullet(b.x, b.y, b.rotation, 5);
        bullet.addToStage(app.stage);
        networkBullets.set(b.id, bullet);
      } else {
        bullet.graphic.x = b.x;
        bullet.graphic.y = b.y;
        // Calcula la rotación según la dirección de movimiento
        if (b.vx !== undefined && b.vy !== undefined) {
          bullet.graphic.rotation = Math.atan2(b.vy, b.vx);
        } else {
          bullet.graphic.rotation = b.rotation;
        }
      }
    }
    // Elimina balas que ya no existen en el servidor
    for (const [id, bullet] of networkBullets.entries()) {
      if (!receivedIds.has(id)) {
        bullet.destroy(app.stage);
        networkBullets.delete(id);
      }
    }
  };

  // Recibe los walls del servidor y los crea
  network.onWallsInfo = (serverWalls, width, height) => {
    // Ajusta el tamaño del mapa
    mapWidth = width;
    mapHeight = height;
    app.renderer.resize(mapWidth, mapHeight);
    // Elimina walls anteriores del stage
    walls.forEach(wall => wall.removeFromStage && wall.removeFromStage(app.stage));
    walls = serverWalls.map((w, i) => {
      let color = 0x8B4513;
      if (i < 4) color = 0x4a3728;
      else if (i === 8 || i === 9) color = 0xA0522D;
      const wallObj = new Wall(w.x, w.y, w.w, w.h, color);
      wallObj.addToStage(app.stage);
      return wallObj;
    });
  };

  // Game loop
  let lastNetworkUpdate = 0;
  const networkUpdateInterval = 1000 / 30; // 30 Hz

  app.ticker.add((time) => {
    if (!gameStarted || !localTank) return;
    // Update local tank
    localTank.update(time.deltaTime, walls);
    // Enviar posición al servidor en cada frame
    network.sendPlayerInput(
      localTank.container.x,
      localTank.container.y,
      localTank.hull.rotation,
      localTank.turret.rotation
    );
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    network.disconnect();
  });
})();
