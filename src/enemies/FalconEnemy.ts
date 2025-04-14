import Phaser from 'phaser';
import { Enemy } from './Enemy';

export class FalconEnemy extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemy_falcon', 2);
    this.sprite.setScale(0.5); // Set scaling to 0.5
    this.sprite.refreshBody(); // Update physics body size to match scale
    // Removed client-side shotInterval property
  }

  // Removed client-side fire method override
}