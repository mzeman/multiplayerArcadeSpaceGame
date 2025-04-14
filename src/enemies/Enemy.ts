import Phaser from 'phaser';
import { logger } from '@shared/logger'; // Import logger
// Removed showExplosion import, effects handled elsewhere

export abstract class Enemy {
  public sprite: Phaser.Physics.Arcade.Sprite; // Changed to Sprite
  protected scene: Phaser.Scene;
  public type: number; // Keep type for potential client-side distinctions

  // Properties for interpolation
  protected targetX: number;
  protected targetY: number;
  protected interpolationFactor: number = 0.2; // Default, can be overridden

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, type: number) {
    this.scene = scene;
    this.type = type;
    this.sprite = scene.physics.add.sprite(x, y, texture); // Use add.sprite
    this.targetX = x; // Initialize target position
    this.targetY = y;
    // Scale can be set in subclasses or manager if needed, e.g., this.sprite.setScale(0.8);
    // setDisplaySize might conflict with setScale, prefer setScale.
    this.sprite.setDepth(1);
    if (this.sprite.body) {
      (this.sprite.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    }
  }
  // Removed client-side update method
  // Removed client-side state: lastShotTime, shotInterval

  // Removed takeDamage - effects handled elsewhere based on server state changes
  // Removed abstract fire method - server handles firing

  // --- Methods for ClientEnemyManager ---

  /** Stores the target position received from the server for interpolation. */
  setTargetPosition(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  /** Smoothly interpolates the sprite's position towards the target position. */
  interpolatePosition(delta: number): void {
    if (!this.sprite) return;
    const newX = Phaser.Math.Linear(this.sprite.x, this.targetX, this.interpolationFactor);
    const newY = Phaser.Math.Linear(this.sprite.y, this.targetY, this.interpolationFactor);
    this.sprite.setPosition(newX, newY);
  }

  /** Destroys the enemy sprite. */
  destroy(): void {
    if (this.sprite) {
      logger.debug(`Destroying enemy sprite (Type: ${this.type})`);
      this.sprite.destroy();
      // this.sprite = null; // Optional: Nullify reference
    }
  }
}