import Phaser from 'phaser';
import { showExplosion } from '../effects/effects';

export abstract class Enemy {
  sprite: Phaser.Physics.Arcade.Image;
  scene: Phaser.Scene;
  type: number;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, type: number) {
    this.scene = scene;
    this.type = type;
    this.sprite = scene.physics.add.image(x, y, texture);
    this.sprite.setDisplaySize(40, 40);
    this.sprite.setDepth(1);
    if (this.sprite.body) {
      (this.sprite.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    }
  }
/**
 * Updates the enemy's position and destroys it if it goes off screen.
 * @param delta The time delta.
 * @param sceneHeight The height of the game scene.
 * @param speed The speed at which the enemy moves down.
 */
update(delta: number, sceneHeight: number, speed: number = 40) {
  // Client-side movement logic removed. Position is set by server state + interpolation in GameScene.
  // if (this.sprite && this.sprite.active) {
  //   // Move enemy downward each frame
  //   // this.sprite.y += speed * (delta / 1000); // Server handles position
  //   // if (this.sprite.y > sceneHeight) {
  //   //   this.sprite.destroy(); // Server handles destruction
  //   // }
  // }
}

  public lastShotTime: number = 0;
  public shotInterval: number = 500; // Default 500ms

  takeDamage(bullet: Phaser.GameObjects.GameObject, size?: string) {
    if (this.sprite && this.sprite.scene) {
      if ('disableBody' in bullet && typeof bullet['disableBody'] === 'function') {
        (bullet as any).disableBody(true, true);
      } else {
        bullet.destroy();
      }

      if ('disableBody' in this.sprite && typeof this.sprite['disableBody'] === 'function' && 'scene' in this.sprite) {
        showExplosion(this.sprite.scene, this.sprite.x, this.sprite.y, size === "large" ? "large" : "small");
        (this.sprite as any).disableBody(true, true);
        (this.sprite as any).active = false;
      } else {
        this.sprite.destroy();
      }
    }
  }

  abstract fire(bulletsGroup: Phaser.GameObjects.Group, time: number): void;
}