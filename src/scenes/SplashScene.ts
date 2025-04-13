import Phaser from 'phaser';

export class SplashScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SplashScene' });
  }

  preload() {
    // Optionally, load assets here if needed for splash
  }

  create() {
      console.log('[SplashScene] create');
      const { width, height } = this.scale;
      const splashText = this.add.text(
        width / 2,
        height / 2,
        'Random Vibe Coding',
        { font: '36px Arial', color: 'orange' }
      ).setOrigin(0.5);
  
      this.cameras.main.setBackgroundColor('#000');
  
      this.time.delayedCall(3000, () => {
        console.log('[SplashScene] Transitioning to GameScene');
        splashText.destroy();
        this.scene.start('GameScene');
      });
    }
}