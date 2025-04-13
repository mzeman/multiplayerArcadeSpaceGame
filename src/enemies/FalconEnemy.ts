import Phaser from 'phaser';
import { Enemy } from './Enemy';

export class FalconEnemy extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemy_falcon', 2);
    this.shotInterval = 3000; // Falcon shoots every 3 seconds
  }

  fire(bulletsGroup: Phaser.GameObjects.Group, time: number) {
    // Client-side firing logic removed. Server is authoritative.
    // // Fire two bullets at ±12.5 degrees from vertical
    // if (!this.sprite || !bulletsGroup) return;
    // const speed = 300;
    // const spread = 12.5; // degrees from vertical
    // const baseAngles = [90 - spread, 90 + spread]; // 77.5 and 102.5 degrees
    // baseAngles.forEach(angle => {
    //   const rad = Phaser.Math.DegToRad(angle);
    //   const vx = speed * Math.cos(rad);
    //   const vy = speed * Math.sin(rad);
    //   const bullet = bulletsGroup.scene.add.rectangle(this.sprite.x, this.sprite.y + 20, 4, 12, 0xffcc00);
    //   (bullet as any).vx = vx;
    //   (bullet as any).vy = vy;
    //   bulletsGroup.add(bullet);
    // });
  }
}