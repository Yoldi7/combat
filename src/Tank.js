import { Sprite, Container, Graphics } from "pixi.js";
import { Bullet } from "./Bullet.js";

export class Tank {
  constructor(app, hullTexture, turretTexture, isLocal = true) {
    this.app = app;
    this.isLocal = isLocal;
    
    // Create a container for the tank
    this.container = new Container();

    // Create the hull sprite
    this.hull = new Sprite(hullTexture);
    this.hull.anchor.set(0.5);

    // Create the turret sprite
    this.turret = new Sprite(turretTexture);
    this.turret.anchor.set(0.5);

    // Add hull and turret to the tank container
    this.container.addChild(this.hull);
    this.container.addChild(this.turret);

    // Hitbox matching server: 80x50 in world space (after 0.5 scale)
    // So we create 160x100 here, which becomes 80x50 after 0.5 scale
    this.hitbox = new Graphics();
    this.hitbox.beginFill(0xff0000, 0); // Invisible
    this.hitboxWidth = 160;  // Becomes 80 after 0.5 scale
    this.hitboxHeight = 100; // Becomes 50 after 0.5 scale
    this.hitbox.drawRect(-this.hitboxWidth / 2, -this.hitboxHeight / 2, this.hitboxWidth, this.hitboxHeight);
    this.hitbox.endFill();
    this.container.addChild(this.hitbox);

    // Movement variables
    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      ArrowLeft: false,
      ArrowRight: false,
      ArrowUp: false,
      ArrowDown: false,
      ' ': false
    };

    this.speed = 3;
    this.turretRotationSpeed = 0.05;
    this.rotationSpeed = 0.1;

    // Bullets
    this.bullets = [];
    this.bulletSpeed = 5;
    this.canFire = true;
    this.cannonLength = 70;

    // Setup event listeners (only for local player)
    if (this.isLocal) {
      this.setupEventListeners();
    }
  }

  // Helper function to normalize angle difference
  normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  // Create a bullet
  createBullet() {
    // Calculate cannon tip position
    const cannonTipX = this.container.x + Math.cos(this.turret.rotation) * this.cannonLength;
    const cannonTipY = this.container.y + Math.sin(this.turret.rotation) * this.cannonLength;
    
    // Create new bullet at cannon tip
    const bullet = new Bullet(cannonTipX, cannonTipY, this.turret.rotation, this.bulletSpeed);
    bullet.addToStage(this.app.stage);
    this.bullets.push(bullet);
  }

  // Setup keyboard event listeners
  setupEventListeners() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (this.keys.hasOwnProperty(key)) {
        this.keys[key] = true;
      }
      if (this.keys.hasOwnProperty(e.key)) {
        this.keys[e.key] = true;
      }
      
      // Fire bullet on space
      if (e.key === ' ' && this.canFire) {
        this.createBullet();
        this.canFire = false;
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (this.keys.hasOwnProperty(key)) {
        this.keys[key] = false;
      }
      if (this.keys.hasOwnProperty(e.key)) {
        this.keys[e.key] = false;
      }
      
      // Allow firing again when space is released
      if (e.key === ' ') {
        this.canFire = true;
      }
    });
  }

  // Hitbox personalizada centrada
  getHitbox() {
    // Centrada en el container
    const width = 180 * this.container.scale.x;
    const height = 100 * this.container.scale.y;
    const x = this.container.x - width / 2;
    const y = this.container.y - height / 2;
    return { x, y, width, height };
  }

  // Corrige la colisión con muros usando la hitbox personalizada
  checkWallCollision(walls) {
    const bounds = this.getHitbox();
    for (const wall of walls) {
      const wallBounds = wall.getBounds();
      if (
        bounds.x < wallBounds.x + wallBounds.width &&
        bounds.x + bounds.width > wallBounds.x &&
        bounds.y < wallBounds.y + wallBounds.height &&
        bounds.y + bounds.height > wallBounds.y
      ) {
        // Calcula la penetración en cada eje
        const overlapX = Math.min(
          bounds.x + bounds.width - wallBounds.x,
          wallBounds.x + wallBounds.width - bounds.x
        );
        const overlapY = Math.min(
          bounds.y + bounds.height - wallBounds.y,
          wallBounds.y + wallBounds.height - bounds.y
        );
        // Corrige en el eje de menor penetración
        if (overlapX < overlapY) {
          if (bounds.x < wallBounds.x) {
            this.container.x -= overlapX;
          } else {
            this.container.x += overlapX;
          }
        } else {
          if (bounds.y < wallBounds.y) {
            this.container.y -= overlapY;
          } else {
            this.container.y += overlapY;
          }
        }
      }
    }
  }

  // Update tank position and rotation
  update(deltaTime, walls = []) {
    // Only process input for local player
    if (!this.isLocal) {
      // For remote players, just update bullets
      this.updateBullets(deltaTime, walls);
      return;
    }
    
    // Calculate movement direction
    let moveX = 0;
    let moveY = 0;

    if (this.keys.w) moveY -= 1;
    if (this.keys.s) moveY += 1;
    if (this.keys.a) moveX -= 1;
    if (this.keys.d) moveX += 1;

    // Normalize diagonal movement
    if (moveX !== 0 && moveY !== 0) {
      const length = Math.sqrt(moveX * moveX + moveY * moveY);
      moveX /= length;
      moveY /= length;
    }

    // Apply movement with wall collision and sliding
    if (moveX !== 0 || moveY !== 0) {
      const oldX = this.container.x;
      const oldY = this.container.y;
      
      // Try to move in both directions
      this.container.x += moveX * this.speed * deltaTime;
      this.container.y += moveY * this.speed * deltaTime;

      // Check collision with walls
      if (this.checkWallCollision(walls)) {
        // Revert to old position
        this.container.x = oldX;
        this.container.y = oldY;
        
        // Try moving only in X direction
        this.container.x += moveX * this.speed * deltaTime;
        if (this.checkWallCollision(walls)) {
          this.container.x = oldX;
        }
        
        // Try moving only in Y direction
        this.container.y += moveY * this.speed * deltaTime;
        if (this.checkWallCollision(walls)) {
          this.container.y = oldY;
        }
      }
     
      // Smoothly rotate hull to movement direction
      if (this.container.x !== oldX || this.container.y !== oldY) {
        const targetHullRotation = Math.atan2(moveY, moveX);
        const hullAngleDiff = this.normalizeAngle(targetHullRotation - this.hull.rotation);
        this.hull.rotation += hullAngleDiff * this.rotationSpeed * deltaTime;
      }
    }

    // Keep tank within screen bounds
    this.container.x = Math.max(0, Math.min(this.container.x, this.app.screen.width));
    this.container.y = Math.max(0, Math.min(this.container.y, this.app.screen.height));

    // Rotate turret with arrow keys
    if (this.keys.ArrowLeft) {
      this.turret.rotation -= this.turretRotationSpeed * deltaTime;
    }
    if (this.keys.ArrowRight) {
      this.turret.rotation += this.turretRotationSpeed * deltaTime;
    }

    // Update bullets
    this.updateBullets(deltaTime, walls);
  }
  
  // Separate bullet update method
  updateBullets(deltaTime, walls = []) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.update(deltaTime);
      
      // Check bullet collision with walls
      for (const wall of walls) {
        if (wall.intersects(bullet.getBounds())) {
          bullet.bounce(wall);
          break;
        }
      }
      
      // Remove bullets that are expired, off screen, or inactive
      if (bullet.isExpired() || bullet.isOffScreen(this.app.screen.width, this.app.screen.height) || !bullet.active) {
        bullet.destroy(this.app.stage);
        this.bullets.splice(i, 1);
      }
    }
  }

  // Get all active bullets
  getBullets() {
    return this.bullets;
  }

  // Check if a point (bullet) collides with this tank's hitbox
  // This matches the server's collision detection exactly
  checkBulletCollision(bulletX, bulletY) {
    // Get tank center position in world coordinates
    const tankX = this.container.x;
    const tankY = this.container.y;
    const rotation = this.hull.rotation;
    
    // Hitbox dimensions matching server (80x50 in world space)
    const width = 80;
    const height = 50;
    
    // Transform bullet point to tank's local coordinate system
    const dx = bulletX - tankX;
    const dy = bulletY - tankY;
    
    // Rotate the point by -rotation to align with tank's local axes
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;
    
    // Check if point is inside the hitbox rectangle
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    
    return (localX >= -halfWidth && localX <= halfWidth &&
            localY >= -halfHeight && localY <= halfHeight);
  }

  // Set initial position
  setPosition(x, y) {
    this.container.position.set(x, y);
  }

  // Add tank to stage
  addToStage(stage) {
    stage.addChild(this.container);
  }
}