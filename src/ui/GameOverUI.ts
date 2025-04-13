import Phaser from 'phaser';

export class GameOverUI {
  private scene: Phaser.Scene;
  private gameOverText?: Phaser.GameObjects.Text;
  private newGameButton?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(onRestart: () => void) {
    this.hide();

    this.gameOverText = this.scene.add.text(
      this.scene.scale.width / 2, this.scene.scale.height / 2,
      'GAME OVER',
      { font: '40px Arial', color: '#ff4444' }
    ).setOrigin(0.5).setDepth(1000);

    this.newGameButton = this.scene.add.text(
      this.scene.scale.width / 2, this.scene.scale.height / 2 + 60,
      'New Game',
      { font: '32px Arial', color: '#00ff00', backgroundColor: '#222', padding: { left: 20, right: 20, top: 10, bottom: 10 } }
    ).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(1000);

    this.newGameButton.on('pointerdown', () => {
      this.hide();
      onRestart();
    });
  }

  hide() {
    if (this.gameOverText) {
      this.gameOverText.destroy();
      this.gameOverText = undefined;
    }
    if (this.newGameButton) {
      this.newGameButton.destroy();
      this.newGameButton = undefined;
    }
  }

  isVisible(): boolean {
    // If the text object exists, the UI is considered visible
    return !!this.gameOverText;
  }
}