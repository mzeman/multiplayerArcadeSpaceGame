import Phaser from 'phaser';

export class GameHUD {
  private scene: Phaser.Scene;
  private livesText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  public _created: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  create(initialLives: number, initialWave: number) {
    this.livesText = this.scene.add.text(
      this.scene.scale.width - 20, 20, // Moved to top
      'Lives: ' + initialLives,
      { font: '20px Arial', color: '#fff' }
    );
    this.livesText.setOrigin(1, 0);

    this.waveText = this.scene.add.text(
      20, 20, // Moved to top
      'Wave: ' + initialWave,
      { font: '20px Arial', color: '#fff' }
    );
    this.waveText.setOrigin(0, 0);
    this._created = true;
  }

  updateLives(lives: number) {
    if (this.livesText) {
      this.livesText.setText('Lives: ' + Math.max(0, lives));
    }
  }

  updateWave(waveNumber: number) {
    if (this.waveText) {
      this.waveText.setText('Wave: ' + waveNumber);
    }
  }

  destroy() {
    if (this.livesText) this.livesText.destroy();
    if (this.waveText) this.waveText.destroy();
    this._created = false;
  }
}