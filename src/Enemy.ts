import Phaser from 'phaser';

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

  abstract fire(): void;
} 