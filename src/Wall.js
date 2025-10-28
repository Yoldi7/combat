import { Graphics } from "pixi.js";

export class Wall {
  constructor(x, y, width, height, color = 0x8B4513) {
    // Create the wall graphic (rectangle)
    this.graphic = new Graphics();
    this.graphic.beginFill(color);
    this.graphic.drawRect(0, 0, width, height);
    this.graphic.endFill();
    
    // Set position
    this.graphic.x = x;
    this.graphic.y = y;
    
    // Store dimensions
    this.width = width;
    this.height = height;
    
    // Collision properties
    this.solid = true;
  }

  // Get wall bounds for collision detection
  getBounds() {
    return this.graphic.getBounds();
  }

  // Check if a point is inside the wall
  containsPoint(x, y) {
    return (
      x >= this.graphic.x &&
      x <= this.graphic.x + this.width &&
      y >= this.graphic.y &&
      y <= this.graphic.y + this.height
    );
  }

  // Check collision with another object (using bounds)
  intersects(bounds) {
    const wallBounds = this.getBounds();
    return !(
      bounds.x + bounds.width < wallBounds.x ||
      bounds.x > wallBounds.x + wallBounds.width ||
      bounds.y + bounds.height < wallBounds.y ||
      bounds.y > wallBounds.y + wallBounds.height
    );
  }

  // Add wall to stage
  addToStage(stage) {
    stage.addChild(this.graphic);
  }

  // Remove wall from stage
  removeFromStage(stage) {
    stage.removeChild(this.graphic);
  }

  // Get position
  getPosition() {
    return { x: this.graphic.x, y: this.graphic.y };
  }

  // Set position
  setPosition(x, y) {
    this.graphic.x = x;
    this.graphic.y = y;
  }

  // Change wall color
  setColor(color) {
    this.graphic.clear();
    this.graphic.beginFill(color);
    this.graphic.drawRect(0, 0, this.width, this.height);
    this.graphic.endFill();
  }
}
