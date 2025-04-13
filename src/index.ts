import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { SplashScene } from './scenes/SplashScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 480,
  height: 640,
  backgroundColor: '#000',
  parent: 'game-container',
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [SplashScene, GameScene]
};
console.log('[index.ts] Phaser.Game created');
new Phaser.Game(config);
