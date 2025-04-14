import Phaser from 'phaser';
import { logger } from '@shared/logger'; // Import logger
import { PlayerState } from '@shared/types'; // Import PlayerState

export class Player {
  public sprite: Phaser.Physics.Arcade.Sprite;
  private scene: Phaser.Scene;
  public id: string; // Store player ID

  private color: string;

  // Internal state tracking
  private currentLives: number;

  // Properties for interpolation
  private targetX: number;
  private targetY: number;
  private interpolationFactor: number = 0.2; // Adjust for desired smoothness

  // Properties for effects
  private invincibilityTween: Phaser.Tweens.Tween | null = null;
  private hitTween: Phaser.Tweens.Tween | null = null; // For hit animation

  constructor(scene: Phaser.Scene, x: number, y: number, id: string, initialState: PlayerState) {
    this.scene = scene;
    this.id = id;
    this.color = initialState.color; // Use initialState
    this.currentLives = initialState.lives; // Initialize lives
    this.targetX = x; // Initialize target position
    this.targetY = y;
    this.sprite = scene.physics.add.sprite(x, y, 'playerShip');

    // Use initialState.color in log
    logger.debug(`Player constructor for ID ${id}`, { x, y, color: initialState.color });
    if (!this.sprite) {
      logger.error(`Failed to create player sprite for ID ${id}!`);
      throw new Error(`Failed to create player sprite for ID ${id}`);
    }
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(100); // Force player above all enemies
    this.sprite.setAlpha(1);
    this.sprite.setScale(0.4); // Set desired visual scale
    // Removed initial tint setting here, setColor handles it
    if (this.sprite.body) {
      (this.sprite.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    }

    // Update physics body size to match visual scale (original base size 40x40 * 0.4 = 16x16)
    if (this.sprite.body) {
        (this.sprite.body as Phaser.Physics.Arcade.Body).setSize(16, 16);
    }
    this.sprite.refreshBody(); // Apply body size changes

    this.setColor(this.color); // Apply initial color using the method
    logger.debug(`Player sprite created for ID ${id}`, {
        x: this.sprite.x, y: this.sprite.y, depth: this.sprite.depth, scale: this.sprite.scaleX, initialLives: this.currentLives
    });
  } // End of constructor

  // --- Methods for ClientPlayerManager ---

  /** Stores the target position received from the server for interpolation. */
  setTargetPosition(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  /** Smoothly interpolates the sprite's position towards the target position. */
  interpolatePosition(delta: number): void {
    // Simple linear interpolation (lerp)
    const newX = Phaser.Math.Linear(this.sprite.x, this.targetX, this.interpolationFactor);
    const newY = Phaser.Math.Linear(this.sprite.y, this.targetY, this.interpolationFactor);
    this.sprite.setPosition(newX, newY);
  }

  /** Manages the visual effect for invincibility (e.g., pulsing alpha). */
  handleInvincibilityEffect(isInvincible: boolean): void {
    if (isInvincible && !this.invincibilityTween) {
      // Start pulsing tween if not already running
      this.sprite.setAlpha(0.7); // Start slightly transparent
      this.invincibilityTween = this.scene.tweens.add({
        targets: this.sprite,
        alpha: 0.3,
        duration: 300,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1 // Repeat indefinitely
      });
       logger.debug(`Player ${this.id} invincibility effect started.`);
    } else if (!isInvincible && this.invincibilityTween) {
      // Stop pulsing tween and reset alpha
      this.invincibilityTween.stop();
      this.invincibilityTween = null;
      this.sprite.setAlpha(1.0); // Reset to fully opaque
       logger.debug(`Player ${this.id} invincibility effect stopped.`);
    }
  }

   /** Called every frame to update ongoing effects. */
   updateEffects(delta: number): void {
       // Currently handled by tween, but could add other time-based effects here
   }

   /** Returns the last known lives count for this player instance. */
   getCurrentLives(): number {
       return this.currentLives;
   }

   /** Updates the internal state representation, primarily lives for now. */
   updateState(newState: PlayerState): void {
       // Update lives if it changed
       if (newState.lives !== this.currentLives) {
            logger.debug(`Player ${this.id} internal lives updated from ${this.currentLives} to ${newState.lives}`);
            this.currentLives = newState.lives;
       }
       // Could update other internal state if needed
   }

   /** Plays a brief visual hit animation (e.g., red flash). */
   playHitAnimation(): void {
       // Avoid starting a new hit animation if one is already playing or if invincible
       if (this.hitTween || this.invincibilityTween) {
           return;
       }

       // Ensure sprite exists
       if (!this.sprite || !this.sprite.active) {
           return;
       }

       const originalTint = this.sprite.tintTopLeft; // Store original tint (might be player color)
       const hitColor = 0xff0000; // Red

       // Use a short tween for the flash effect
       this.sprite.setTint(hitColor);
       this.hitTween = this.scene.tweens.add({
           targets: this.sprite,
           duration: 100, // Short duration for flash
           ease: 'Linear',
           onComplete: () => {
               // Restore original tint only if not invincible
               if (this.sprite && this.sprite.active && !this.invincibilityTween) {
                   this.sprite.setTint(originalTint);
               }
               this.hitTween = null; // Allow next hit animation
           }
       });
   }

  // --- Original Methods (Refactored) ---

  setColor(color: string) {
    this.color = color;
    if (this.sprite) {
      // If color is black or too dark, use a fallback bright color for visibility
      let parsed = Phaser.Display.Color.HexStringToColor(color);
      let rgb = parsed ? parsed.color : 0x000000;
      // Check if color is too dark (all channels < 40)
      if (parsed && typeof parsed !== 'number') {
        const rgbObj = Phaser.Display.Color.IntegerToRGB(parsed.color);
        if (rgbObj.r < 40 && rgbObj.g < 40 && rgbObj.b < 40) {
          rgb = 0xffff00; // fallback to yellow
          logger.warn(`Player ${this.id} color ${color} too dark, using fallback yellow.`);
        }
        this.sprite.setTint(rgb);
      } else {
        this.sprite.setTint(rgb);
      }
    }
  }

  destroy() {
    // Ensure tweens are stopped on destroy
    if (this.invincibilityTween) {
        this.invincibilityTween.stop();
        this.invincibilityTween = null;
    }
    if (this.hitTween) {
        this.hitTween.stop();
        this.hitTween = null;
    }
    if (this.sprite) {
      logger.debug(`Destroying player sprite for ID ${this.id}`);
      this.sprite.destroy();
    }
  }
}