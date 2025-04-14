import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { SplashScene } from './scenes/SplashScene';
import { logger } from '@shared/logger'; // Import logger

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  backgroundColor: '#000',
  parent: 'game-container',
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [SplashScene, GameScene]
};
logger.info('[index.ts] Phaser.Game created'); // Use logger
new Phaser.Game(config);
