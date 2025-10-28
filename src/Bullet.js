import { Graphics } from "pixi.js";

export class Bullet {
  constructor(x, y, rotation, speed = 2, timeToLive = 5000) {
    // Create the bullet graphic (elongated triangle/bullet shape)
    this.graphic = new Graphics();
    this.graphic.beginFill(0xFFD700); // Gold color
    // Elongated bullet shape pointing right
    this.graphic.moveTo(15, 0);      // Tip (front)
    this.graphic.lineTo(-5, -4);     // Top back
    this.graphic.lineTo(-5, 4);      // Bottom back
    this.graphic.closePath();
    this.graphic.endFill();
    
    // Set position and rotation
    this.graphic.x = x;
    this.graphic.y = y;
    this.graphic.rotation = rotation;
    
    // Calculate velocity based on rotation and speed
    this.speed = speed;
    this.vx = Math.cos(rotation) * this.speed;
    this.vy = Math.sin(rotation) * this.speed;
    
    // Track if bullet is active
    this.active = true;
    
    // Time to live (in milliseconds)
    this.timeToLive = timeToLive;
    this.elapsedTime = 0;

    this.timestamp = Date.now();
  }

  // Update bullet position
  update() {
    const deltaTime = Date.now() - this.timestamp;
    this.timestamp = Date.now();
    if (!this.active) return;
    
    this.graphic.x += this.vx * deltaTime / 30;
    this.graphic.y += this.vy * deltaTime / 30;
    
    this.elapsedTime += deltaTime;
  }

  // Check if bullet has expired
  isExpired() {
    return this.elapsedTime >= this.timeToLive;
  }

  // Check if bullet is off screen
  isOffScreen(screenWidth, screenHeight) {
    const margin = 50;
    return (
      this.graphic.x < -margin || 
      this.graphic.x > screenWidth + margin ||
      this.graphic.y < -margin || 
      this.graphic.y > screenHeight + margin
    );
  }

  // Get bullet bounds for collision detection
  getBounds() {
    return this.graphic.getBounds();
  }

  // Bounce bullet off a wall
  bounce(wall) {
    const bulletBounds = this.getBounds();
    const wallBounds = wall.getBounds();
    
    // Determine which side of the wall was hit
    const bulletCenterX = bulletBounds.x + bulletBounds.width / 2;
    const bulletCenterY = bulletBounds.y + bulletBounds.height / 2;
    
    const wallCenterX = wallBounds.x + wallBounds.width / 2;
    const wallCenterY = wallBounds.y + wallBounds.height / 2;
    
    const dx = bulletCenterX - wallCenterX;
    const dy = bulletCenterY - wallCenterY;
    
    // Calculate overlap on each axis
    const overlapX = (bulletBounds.width + wallBounds.width) / 2 - Math.abs(dx);
    const overlapY = (bulletBounds.height + wallBounds.height) / 2 - Math.abs(dy);
    
    // Bounce based on smallest overlap (side of collision)
    if (overlapX < overlapY) {
      // Hit left or right side
      this.vx = -this.vx;
      // Push bullet out of wall
      this.graphic.x += (dx > 0 ? overlapX : -overlapX);
    } else {
      // Hit top or bottom
      this.vy = -this.vy;
      // Push bullet out of wall
      this.graphic.y += (dy > 0 ? overlapY : -overlapY);
    }
    
    // Update rotation to match new direction
    this.graphic.rotation = Math.atan2(this.vy, this.vx);
  }

  // Destroy the bullet
  destroy(stage) {
    this.active = false;
    stage.removeChild(this.graphic);
  }

  // Add bullet to stage
  addToStage(stage) {
    stage.addChild(this.graphic);
  }

  // Get position
  getPosition() {
    return { x: this.graphic.x, y: this.graphic.y };
  }
}
