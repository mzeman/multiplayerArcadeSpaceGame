import Phaser from 'phaser';
import { showExplosion } from '../effects/effects';
import { logger } from '@shared/logger';
// Removed imports for GameHUD, GameOverUI, InputManager, Player, state getters/setters

// Define the expected type for Phaser physics overlap callbacks
type ArcadePhysicsCallback = (
    object1: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody,
    object2: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody
) => void;

export class ClientCollisionEffectsManager {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Triggers visual effects when a player bullet hits an enemy.
   * Assumes the actual destruction/state change is handled based on server state.
   */
  handleBulletEnemyCollision = (
    bullet: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody,
    enemy: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody
  ) => {
    logger.debug('Client effect: Bullet hit enemy');
    // Trigger explosion effect at enemy position
    // Cast to access x, y properties safely
    const enemySprite = enemy as Phaser.Physics.Arcade.Sprite;
    // showExplosion(this.scene, enemySprite.x, enemySprite.y, "small"); // Disabled: Now triggered by ClientEnemyManager on state change

    // Immediately hide/destroy the bullet locally for responsiveness
    if ('disableBody' in bullet && typeof bullet['disableBody'] === 'function') {
      (bullet as any).disableBody(true, true);
    } else {
      bullet.destroy();
    }
    // NOTE: Do NOT disable/destroy the enemy here. ClientEnemyManager will handle it
    // when the server state confirms the enemy is no longer active.
  };

  /**
   * Triggers visual effects when an enemy bullet hits a player.
   * Assumes the actual damage/state change is handled based on server state.
   */
  handleEnemyBulletPlayerCollision = (
    playerObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody, // Should be the player sprite
    bullet: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody
  ) => {
     logger.debug('Client effect: Enemy bullet hit player');
    // Trigger explosion effect at player position
    // Determine explosion size based on player state (lives) is difficult here without access
    // For simplicity, always show a small explosion for bullet hits. Large explosion for defeat
    // could be triggered elsewhere when player becomes inactive.
    const playerSprite = playerObj as Phaser.Physics.Arcade.Sprite;
    showExplosion(this.scene, playerSprite.x, playerSprite.y, "small");

    // Immediately hide/destroy the bullet locally
     if ('disableBody' in bullet && typeof bullet['disableBody'] === 'function') {
      (bullet as any).disableBody(true, true);
    } else {
      bullet.destroy();
    }
    // NOTE: Do NOT modify player lives or state here.
  };

  // Removed handleFalconBulletPlayerCollision - using the generic one above for effects.
  // If different effects are needed, it could be added back or logic added to the generic handler.

  /**
   * Triggers visual effects when a player collides with an enemy.
   * Assumes the actual damage/state change is handled based on server state.
   */
  handlePlayerEnemyCollision = (
    playerObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody, // Should be the player sprite
    enemyObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody
  ) => {
     logger.debug('Client effect: Player collided with enemy');
    // Trigger explosion effect at player position
    const playerSprite = playerObj as Phaser.Physics.Arcade.Sprite;
    showExplosion(this.scene, playerSprite.x, playerSprite.y, "small");

    // Optionally trigger effect on enemy too?
    // const enemySprite = enemyObj as Phaser.Physics.Arcade.Sprite;
    // showExplosion(this.scene, enemySprite.x, enemySprite.y, "small");

    // NOTE: Do NOT modify player lives or state here.
    // NOTE: Do NOT disable/destroy the enemy here.
  };
}