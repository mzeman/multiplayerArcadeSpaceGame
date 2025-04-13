  import Phaser from 'phaser';
import { GameScene } from '../scenes/GameScene';
import { InputManager } from '../managers/InputManager';
import { GameHUD } from '../ui/GameHUD';

interface CollisionParams {
  // Define CollisionParams interface here if needed
}

export class Player {
  sprite: Phaser.Physics.Arcade.Sprite;
  scene: Phaser.Scene;
  multiplayerClient?: any;

  lives: number;
  color: string;
  lastShotTime: number = 0;
  public isActive: boolean = true; // Added to track player status based on server state

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    color: string = '#ffffff',
    multiplayerClient?: any
  ) {
    this.scene = scene;
    this.color = color;
    this.lives = 3;
    this.multiplayerClient = multiplayerClient;
    this.sprite = scene.physics.add.sprite(x, y, 'playerShip');
    console.log('[Player] Constructor called', { x, y, color, sprite: !!this.sprite });
    if (!this.sprite) {
      console.error('Failed to create player sprite!');
      return;
    }
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(100); // Force player above all enemies
    this.sprite.setAlpha(1);
    this.sprite.setScale(1);
    this.sprite.setTint(0xff00ff); // Bright magenta for visibility
    if (this.sprite.body) {
      (this.sprite.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    }
    this.sprite.setDisplaySize(40, 40);
    this.sprite.setScale(0.2, 0.2); // Restore original intended size
    (this.sprite as any).lastEnemyCollisionTime = 0;
    this.setColor(color);
    // Log sprite properties for debug
    console.log('[DEBUG] Player sprite properties:', {
      x: this.sprite.x,
      y: this.sprite.y,
      depth: this.sprite.depth,
      alpha: this.sprite.alpha,
      scaleX: this.sprite.scaleX,
      scaleY: this.sprite.scaleY,
      displayWidth: this.sprite.displayWidth,
      displayHeight: this.sprite.displayHeight,
      tint: this.sprite.tintTopLeft,
      visible: this.sprite.visible,
      active: this.sprite.active,
      body: this.sprite.body
    });
    // Log sprite properties for debug
    console.log('[DEBUG] Player sprite properties:', {
      x: this.sprite.x,
      y: this.sprite.y,
      depth: this.sprite.depth,
      alpha: this.sprite.alpha,
      scaleX: this.sprite.scaleX,
      scaleY: this.sprite.scaleY,
      tint: this.sprite.tintTopLeft,
      visible: this.sprite.visible,
      active: this.sprite.active,
      displayWidth: this.sprite.displayWidth,
      displayHeight: this.sprite.displayHeight,
      body: this.sprite.body
    });
    console.log('[DEBUG] Player created:', { x, y, color, multiplayer: !!multiplayerClient });
  }

  update(time: number, delta: number, cursors?: Phaser.Types.Input.Keyboard.CursorKeys, isFireDown?: boolean) {
    console.log('[Player] update called', { time, delta, x: this.sprite?.x, y: this.sprite?.y, cursors, isFireDown });
    // Handle movement
    if (cursors) {
      this.move(cursors);
    }

    // Handle shooting (basic example: fire if isFireDown is true and enough time has passed)
    if (isFireDown && this.scene && (this as any).lastShotTime !== undefined) {
      const now = time;
      const shotInterval = 300; // ms between shots
      if (!this.lastShotTime || now - this.lastShotTime > shotInterval) {
        // Create a bullet at the player's position
        if ((this.scene as any).bullets) {
          const bullet = (this.scene as any).bullets.create(this.sprite.x, this.sprite.y - 20, 'bullet');
          if (bullet && bullet.body) {
            bullet.body.velocity.y = -400;
            console.log('[Player] Bullet created', { x: bullet.x, y: bullet.y });
            // Multiplayer: Fire action is now sent via sendInput in GameScene.ts
            // No need to send a separate message here.
          } else {
            console.log('[Player] Bullet creation failed');
          }
        } else {
          console.log('[Player] No bullets group on scene');
        }
        this.lastShotTime = now;
      }
    }
  }

  setColor(color: string) {
    this.color = color;
    if (this.sprite) {
      // If color is black or too dark, use a fallback bright color for visibility
      let parsed = Phaser.Display.Color.HexStringToColor(color);
      let rgb = parsed ? parsed.color : 0x000000;
      // Check if color is too dark (all channels < 40)
      if (parsed && typeof parsed !== 'number') {
        // Phaser.Display.Color.HexStringToColor returns an object with a 'color' property and a 'color32' property,
        // but not r/g/b directly. Use getColor() to get the RGB values.
        const rgbObj = Phaser.Display.Color.IntegerToRGB(parsed.color);
        if (rgbObj.r < 40 && rgbObj.g < 40 && rgbObj.b < 40) {
          rgb = 0xffff00; // fallback to yellow
          console.warn('[DEBUG] Player color too dark, using fallback yellow for visibility');
        }
        this.sprite.setTint(rgb);
        // Log the color actually used
        console.log('[DEBUG] Player setColor:', { requested: color, used: rgb, r: rgbObj.r, g: rgbObj.g, b: rgbObj.b });
      } else {
        this.sprite.setTint(rgb);
        console.log('[DEBUG] Player setColor:', { requested: color, used: rgb });
      }
    }
  }

  move(cursors: Phaser.Types.Input.Keyboard.CursorKeys) {
    const speed = 200;
    if (!this.sprite.body) return;

    (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0);

    if (cursors.left?.isDown) {
      (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocityX(-speed);
    } else if (cursors.right?.isDown) {
      (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocityX(speed);
    }

    if (cursors.up?.isDown) {
      (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocityY(-speed);
    } else if (cursors.down?.isDown) {
      (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocityY(speed);
    }
  }

  /**
   * Handles firing logic for the player.
   * @param bulletsGroup The Phaser group to add bullets to.
   * @param time The current game time.
   * @param lastFired The last time a bullet was fired.
   * @returns true if a bullet was fired, false otherwise.
   */
  fire(bulletsGroup: Phaser.Physics.Arcade.Group, time: number, lastFired: number): boolean {
    // 200ms cooldown
    if (!this.sprite || !bulletsGroup) return false;
    if (time < lastFired) return false;

    const bullet = bulletsGroup.create(this.sprite.x, this.sprite.y - 20, 'bullet') as Phaser.Physics.Arcade.Image;
    if (bullet.body && bullet.body instanceof Phaser.Physics.Arcade.Body) {
      bullet.setDisplaySize(4, 12);
      bullet.body.setSize(4, 12);
      bullet.setTint(0xffff00);
      bullet.body.allowGravity = false;
      bullet.body.setVelocityY(-400);
      console.log('[DEBUG] Bullet fired:', { x: bullet.x, y: bullet.y, velocityY: -400 });
    } else {
      console.warn('[DEBUG] Bullet creation failed in fire()');
    }
    return true;
  }

  takeDamage(bullet: Phaser.GameObjects.GameObject, lives: number, showExplosion: (x: number, y: number, size?: string) => void, gameHUD: GameHUD, gameOverHandler: () => void) {
    if (this.scene && this.sprite) {
      bullet.destroy();
      // Show explosion at player position
      const gameScene = this.scene as GameScene;
      if (lives > 1) {
        showExplosion(this.sprite.x, this.sprite.y, "small");
      } else if (lives === 1) {
        showExplosion(this.sprite.x, this.sprite.y, "large");
      }
      let newLives = lives;
      if (lives > 0) {
        newLives--;
        newLives = Math.max(0, newLives);
      }
      if (gameHUD) {
        gameHUD.updateLives(newLives);
      }
      if (newLives <= 0) {
        gameOverHandler();
      }
    }
  }

  destroy() {
    if (this.sprite && this.sprite.destroy) {
      this.sprite.destroy();
    }
  }
}