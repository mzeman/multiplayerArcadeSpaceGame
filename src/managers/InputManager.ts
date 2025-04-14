import Phaser from 'phaser';
import { logger } from '@shared/logger'; // Import logger

export class InputManager {
  private scene: Phaser.Scene;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private fireKey!: Phaser.Input.Keyboard.Key;
  private leftCtrlKey!: Phaser.Input.Keyboard.Key;
  // Removed local _isInvincible state

  private onToggleInvincibleRequest: () => void; // Callback for CTRL press

  constructor(scene: Phaser.Scene, onToggleInvincibleRequest: () => void) {
    this.scene = scene;
    this.onToggleInvincibleRequest = onToggleInvincibleRequest;
  }

  create() {
    if (!this.scene.input || !this.scene.input.keyboard) {
      logger.error("Keyboard input not available in this scene.");
      return;
    }
    this.cursors = this.scene.input.keyboard.createCursorKeys();
    this.fireKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.leftCtrlKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL);

    // Toggle invincibility on Ctrl press
    // Call the callback on Ctrl press instead of setting local state
    this.leftCtrlKey.on('down', () => {
      logger.debug("CTRL key pressed, requesting invincibility toggle.");
      this.onToggleInvincibleRequest();
    });
  }

  getCursorKeys(): Phaser.Types.Input.Keyboard.CursorKeys {
    return this.cursors;
  }

  isFireDown(): boolean {
    return this.fireKey && this.fireKey.isDown;
  }

  // Removed isInvincible getter

  // Optional: Method to reset state if needed on restart
  reset() {
    // No local state to reset related to invincibility anymore
    // Note: Key listeners might need to be removed and re-added if scene restarts cause issues
    logger.debug("InputManager reset called (no state to reset).");
  }
}