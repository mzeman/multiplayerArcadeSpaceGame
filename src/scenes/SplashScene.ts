import Phaser from 'phaser';
import { logger } from '@shared/logger'; // Import logger

export class SplashScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SplashScene' });
  }

  preload() {
    // Optionally, load assets here if needed for splash
  }

  create() {
      logger.info('[SplashScene] create'); // Use logger
      const { width, height } = this.scale;
      const splashText = this.add.text(
        width / 2,
        height / 2,
        'Random Vibe Coding',
        { font: '36px Arial', color: 'orange' }
      ).setOrigin(0.5);
  
      this.cameras.main.setBackgroundColor('#000');
  
      this.time.delayedCall(3000, () => {
        logger.info('[SplashScene] Transitioning to GameScene'); // Use logger
        splashText.destroy();
        this.scene.start('GameScene');
      });
    }
}