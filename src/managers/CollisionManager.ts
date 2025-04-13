import Phaser from 'phaser';
import { showExplosion } from '../effects/effects';
import { GameHUD } from '../ui/GameHUD';
import { GameOverUI } from '../ui/GameOverUI';
import { InputManager } from '../managers/InputManager';
import { Player } from '../player/Player';

export class CollisionManager {
  private scene: Phaser.Scene;
  private player: Player;
  private gameHUD: GameHUD;
  private gameOverUI: GameOverUI;
  private inputManager: InputManager;
  private getLives: () => number;
  private setLives: (lives: number) => void;
  private getGameOver: () => boolean;
  private setGameOver: (over: boolean) => void;
  // private gameOverHandler: () => void; // Removed: GameScene handles UI based on server state
  // private onEnemyDestroyed?: (enemyId: string) => void; // Removed: Server is authoritative

  constructor(
    scene: Phaser.Scene,
    player: Player,
    gameHUD: GameHUD,
    gameOverUI: GameOverUI,
    inputManager: InputManager,
    getLives: () => number,
    setLives: (lives: number) => void,
    getGameOver: () => boolean,
    setGameOver: (over: boolean) => void
    // gameOverHandler: () => void, // Removed
    // onEnemyDestroyed?: (enemyId: string) => void // Removed: Server is authoritative
  ) {
    this.scene = scene;
    this.player = player;
    this.gameHUD = gameHUD;
    this.gameOverUI = gameOverUI;
    this.inputManager = inputManager;
    this.getLives = getLives;
    this.setLives = setLives;
    this.getGameOver = getGameOver;
    this.setGameOver = setGameOver;
    // this.gameOverHandler = gameOverHandler; // Removed
    // this.onEnemyDestroyed = onEnemyDestroyed; // Removed: Server is authoritative
  }

  handleBulletEnemyCollision = (
    bullet: Phaser.GameObjects.GameObject,
    enemy: Phaser.GameObjects.GameObject
  ) => {
    if ('disableBody' in bullet && typeof bullet['disableBody'] === 'function') {
      (bullet as any).disableBody(true, true);
    } else {
      bullet.destroy();
    }

    if ('disableBody' in enemy && typeof enemy['disableBody'] === 'function' && 'scene' in enemy) {
      showExplosion((enemy as any).scene, (enemy as any).x, (enemy as any).y);
      (enemy as any).disableBody(true, true);
      (enemy as any).active = false;
      // Client-side effect applied. Authoritative destruction comes from server state.
      // Removed: onEnemyDestroyed callback call
    } else {
      enemy.destroy();
    }

    // Removed: Client no longer sends 'enemyHit' event. Server handles collision detection.
  };

  handleEnemyBulletPlayerCollision = (
    playerObj: Phaser.GameObjects.GameObject,
    bullet: Phaser.GameObjects.GameObject
  ) => {
    if (this.inputManager.isInvincible()) return;
    bullet.destroy();

    let lives = this.getLives();
    if (this.player.sprite && this.player.sprite.scene) {
      if (lives > 1) {
        showExplosion(this.player.sprite.scene, this.player.sprite.x, this.player.sprite.y, "small");
      } else if (lives === 1) {
        showExplosion(this.player.sprite.scene, this.player.sprite.x, this.player.sprite.y, "large");
      }
    }
    if (lives > 0) {
      lives--;
      lives = Math.max(0, lives);
      this.setLives(lives);
    }
    this.gameHUD.updateLives(lives); // Update HUD for immediate feedback
    // Removed: GameScene handles game over UI based on server state
    /*
    if (lives <= 0) {
      // this.gameOverHandler(); // Removed
    }
    */
  };

  handleFalconBulletPlayerCollision = (
    playerObj: Phaser.GameObjects.GameObject,
    bullet: Phaser.GameObjects.GameObject
  ) => {
    if (this.inputManager.isInvincible()) return;
    bullet.destroy();

    let lives = this.getLives();
    if (this.player.sprite && this.player.sprite.scene) {
      if (lives > 1) {
        showExplosion(this.player.sprite.scene, this.player.sprite.x, this.player.sprite.y, "small");
      } else if (lives === 1) {
        showExplosion(this.player.sprite.scene, this.player.sprite.x, this.player.sprite.y, "large");
      }
    }
    if (lives > 0) {
      lives--;
      lives = Math.max(0, lives);
      this.setLives(lives);
    }
    this.gameHUD.updateLives(lives); // Update HUD for immediate feedback
    // Removed: GameScene handles game over UI based on server state
    /*
    if (lives <= 0) {
      // this.gameOverHandler(); // Removed
    }
    */
  };

  handlePlayerEnemyCollision = (
    playerObj: Phaser.Physics.Arcade.Sprite,
    enemyObj: Phaser.Physics.Arcade.Sprite
  ) => {
    const playerSprite = playerObj as any;
    const enemySprite = enemyObj as any;
    if (this.inputManager.isInvincible()) return;
    const now = Date.now();
    if (!playerSprite.lastEnemyCollisionTime || now - playerSprite.lastEnemyCollisionTime >= 800) {
      playerSprite.lastEnemyCollisionTime = now;

      let lives = this.getLives();
      if (this.player.sprite && this.player.sprite.scene) {
        if (lives > 1) {
          showExplosion(this.player.sprite.scene, this.player.sprite.x, this.player.sprite.y, "small");
        } else if (lives === 1) {
          showExplosion(this.player.sprite.scene, this.player.sprite.x, this.player.sprite.y, "large");
        }
      }
      if (lives > 0) {
        lives--;
        lives = Math.max(0, lives);
        this.setLives(lives);
      }
      this.gameHUD.updateLives(lives); // Update HUD for immediate feedback
      // Removed: GameScene handles game over UI based on server state
      /*
      if (lives <= 0) {
        // this.gameOverHandler(); // Removed
      }
      */
    }
  };
}