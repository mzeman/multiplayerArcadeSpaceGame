import Phaser from 'phaser';
import { Enemy } from './Enemy';

export class NormalEnemy extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemyShip', 1);
    this.sprite.setScale(0.25); // Set scaling to 0.25
    this.sprite.refreshBody(); // Update physics body size to match scale
    // Removed client-side shotInterval property
  }

  // Removed empty fire method override
}