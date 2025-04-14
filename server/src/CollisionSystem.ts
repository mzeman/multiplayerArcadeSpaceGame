import { GameStateManager } from './GameStateManager';
import { PlayerManager } from './PlayerManager';
import { BulletManager } from './BulletManager';
import { PlayerState, EnemyState, BulletState } from '@shared/types';
import {
    PLAYER_COLLISION_WIDTH, PLAYER_COLLISION_HEIGHT,
    // ENEMY_COLLISION_WIDTH, ENEMY_COLLISION_HEIGHT, // Removed
    NORMAL_ENEMY_COLLISION_WIDTH, NORMAL_ENEMY_COLLISION_HEIGHT,
    FALCON_ENEMY_COLLISION_WIDTH, FALCON_ENEMY_COLLISION_HEIGHT,
    BULLET_COLLISION_WIDTH, BULLET_COLLISION_HEIGHT
} from '@shared/constants';
import { logger } from '@shared/logger'; // Import the shared logger
import { EnemyWaveManagerCore } from '@shared/EnemyWaveManagerCore'; // Import actual class

// Removed local placeholder types
// Removed placeholder class

// Removed local constants, using imports now

export class CollisionSystem {
    private gameStateManager: GameStateManager;
    private playerManager: PlayerManager;
    private bulletManager: BulletManager;
    private enemyWaveManager: EnemyWaveManagerCore; // Assuming direct access or via GameStateManager

    constructor(
        gameStateManager: GameStateManager,
        playerManager: PlayerManager,
        bulletManager: BulletManager,
        enemyWaveManager: EnemyWaveManagerCore
    ) {
        this.gameStateManager = gameStateManager;
        this.playerManager = playerManager;
        this.bulletManager = bulletManager;
        this.enemyWaveManager = enemyWaveManager;
    }

    // Simple Axis-Aligned Bounding Box collision check
    private checkAABBCollision(
        x1: number, y1: number, w1: number, h1: number,
        x2: number, y2: number, w2: number, h2: number
    ): boolean {
        return x1 < x2 + w2 &&
               x1 + w1 > x2 &&
               y1 < y2 + h2 &&
               y1 + h1 > y2;
    }

    update(): void {
        const players = this.gameStateManager.getAllPlayers();
        const enemies = this.gameStateManager.getAllEnemies();
        const playerBullets = this.gameStateManager.getAllPlayerBullets();
        const enemyBullets = this.gameStateManager.getAllEnemyBullets();
        // Add logging to confirm execution and entity counts
        // logger.debug(`[CollisionSystem] Update: ${playerBullets.length} player bullets, ${enemies.length} enemies`);

        // --- Player Bullet vs Enemy ---
        playerBullets.forEach(bullet => {
            enemies.forEach(enemy => {
                if (!enemy.active) return; // Skip inactive enemies

                // Determine collision dimensions based on enemy type
                let enemyWidth = NORMAL_ENEMY_COLLISION_WIDTH;
                let enemyHeight = NORMAL_ENEMY_COLLISION_HEIGHT;
                if (enemy.type === 2) { // Assuming 2 is FalconEnemy
                    enemyWidth = FALCON_ENEMY_COLLISION_WIDTH;
                    enemyHeight = FALCON_ENEMY_COLLISION_HEIGHT;
                }

                // Assume top-left origin for state coordinates in collision check
                if (this.checkAABBCollision(
                    bullet.x, bullet.y, BULLET_COLLISION_WIDTH, BULLET_COLLISION_HEIGHT, // Use x, y directly
                    enemy.x, enemy.y, enemyWidth, enemyHeight      // Use determined dimensions
                )) {
                    // Log collision detection at INFO level for visibility
                    logger.info(`Collision DETECTED: Player bullet ${bullet.id} hit enemy ${enemy.id}`);
                    this.bulletManager.handlePlayerBulletHit(bullet.id);
                    this.enemyWaveManager.destroyEnemyById(enemy.id); // Mark enemy as inactive
                    // TODO: Add scoring logic?
                }
            });
        });

        // --- Enemy Bullet vs Player ---
        enemyBullets.forEach(bullet => {
            players.forEach(player => {
                 if (!player.isActive) return; // Skip inactive players

                 // Assume top-left origin
                 if (this.checkAABBCollision(
                    bullet.x, bullet.y, BULLET_COLLISION_WIDTH, BULLET_COLLISION_HEIGHT,
                    player.x, player.y, PLAYER_COLLISION_WIDTH, PLAYER_COLLISION_HEIGHT
                 )) {
                    // Log collision detection at INFO level
                    logger.info(`Collision DETECTED: Enemy bullet ${bullet.id} hit player ${player.id}`);
                    this.bulletManager.handleEnemyBulletHit(bullet.id);
                    this.playerManager.handlePlayerHitByEnemyBullet(player.id);
                 }
            });
        });

        // --- Player vs Enemy ---
        players.forEach(player => {
             if (!player.isActive) return; // Skip inactive players

             enemies.forEach(enemy => {
                 if (!enemy.active) return; // Skip inactive enemies

                 // Determine collision dimensions based on enemy type
                 let enemyWidth = NORMAL_ENEMY_COLLISION_WIDTH;
                 let enemyHeight = NORMAL_ENEMY_COLLISION_HEIGHT;
                 if (enemy.type === 2) { // Assuming 2 is FalconEnemy
                     enemyWidth = FALCON_ENEMY_COLLISION_WIDTH;
                     enemyHeight = FALCON_ENEMY_COLLISION_HEIGHT;
                 }

                 // Assume top-left origin
                 if (this.checkAABBCollision(
                    player.x, player.y, PLAYER_COLLISION_WIDTH, PLAYER_COLLISION_HEIGHT,
                    enemy.x, enemy.y, enemyWidth, enemyHeight // Use determined dimensions
                 )) {
                    // Log collision detection at INFO level
                    logger.info(`Collision DETECTED: Player ${player.id} collided with enemy ${enemy.id}`);
                    // Don't destroy enemy on player collision, only damage player
                    this.playerManager.handlePlayerEnemyCollision(player.id);
                 }
             });
        });
    }
}