import Phaser from 'phaser';

export class InputManager {
  private scene: Phaser.Scene;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private fireKey!: Phaser.Input.Keyboard.Key;
  private leftCtrlKey!: Phaser.Input.Keyboard.Key;
  private _isInvincible: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  create() {
    if (!this.scene.input || !this.scene.input.keyboard) {
      console.error("Keyboard input not available in this scene.");
      return;
    }
    this.cursors = this.scene.input.keyboard.createCursorKeys();
    this.fireKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.leftCtrlKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL);

    // Toggle invincibility on Ctrl press
    this.leftCtrlKey.on('down', () => {
      this._isInvincible = !this._isInvincible;
      console.log(`[DEBUG] Invincibility toggled: ${this._isInvincible}`);
    });
  }

  getCursorKeys(): Phaser.Types.Input.Keyboard.CursorKeys {
    return this.cursors;
  }

  isFireDown(): boolean {
    return this.fireKey && this.fireKey.isDown;
  }

  isInvincible(): boolean {
    return this._isInvincible;
  }

  // Optional: Method to reset state if needed on restart
  reset() {
    this._isInvincible = false;
    // Note: Key listeners might need to be removed and re-added if scene restarts cause issues
  }
}