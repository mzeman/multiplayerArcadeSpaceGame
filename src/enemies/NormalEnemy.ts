import Phaser from 'phaser';
import { Enemy } from './Enemy';

export class NormalEnemy extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemyShip', 1);
    this.shotInterval = Phaser.Math.Between(1000, 1000);
  }

  // Enemy firing is now server-authoritative; this method is intentionally left blank.
  fire(bulletsGroup: Phaser.GameObjects.Group, time: number) {}
}