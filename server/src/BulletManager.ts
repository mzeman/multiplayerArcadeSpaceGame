import { GameStateManager } from './GameStateManager';
import { v4 as uuidv4 } from 'uuid'; // For generating unique bullet IDs

import { PlayerId, BulletState, EntityId } from '@shared/types';
import {
    PLAYER_BULLET_SPEED,
    ENEMY_BULLET_SPEED,
    FALCON_BULLET_SPEED,
    GAME_WIDTH,
    GAME_HEIGHT
} from '@shared/constants';
import { logger } from '@shared/logger'; // Import the shared logger

// Removed local placeholder types

// Removed local constants, using imports now

export class BulletManager {
    private gameStateManager: GameStateManager;

    constructor(gameStateManager: GameStateManager) {
        this.gameStateManager = gameStateManager;
    }

    createPlayerBullet(playerId: PlayerId, startX: number, startY: number): void {
        const bulletId: EntityId = uuidv4(); // Use EntityId type
        const newBullet: BulletState = {
            id: bulletId,
            ownerId: playerId,
            x: startX,
            y: startY - 20, // Start slightly above player
            velocityX: 0,
            velocityY: -PLAYER_BULLET_SPEED, // Move upwards
        };
        this.gameStateManager.addPlayerBullet(newBullet);
        logger.debug(`Player bullet ${bulletId} created for player ${playerId}`);
    }

    createEnemyBullet(enemyId: string, startX: number, startY: number, type: 'normal' | 'falcon'): void {
        const bulletId: EntityId = uuidv4(); // Use EntityId type
        let velocityY = ENEMY_BULLET_SPEED;
        let velocityX = 0; // Default for normal

        if (type === 'falcon') {
            velocityY = FALCON_BULLET_SPEED;
            // Example spread - needs refinement based on desired angle
            // This might need multiple bullets created per shot
            // For simplicity now, just faster straight shot
        }

        const newBullet: BulletState = {
            id: bulletId,
            ownerId: 'enemy', // Generic enemy owner for now
            x: startX,
            y: startY + 20, // Start slightly below enemy
            velocityX: velocityX,
            velocityY: velocityY, // Move downwards
            bulletType: type,
        };
        this.gameStateManager.addEnemyBullet(newBullet);
        logger.debug(`Enemy bullet ${bulletId} created by enemy ${enemyId} (type: ${type})`);
    }

    // Overload or separate method for falcon spread shot
    createFalconSpreadShot(enemyId: string, startX: number, startY: number): void {
        const bulletId1: EntityId = uuidv4(); // Use EntityId type
        const bulletId2: EntityId = uuidv4(); // Use EntityId type
        const angleSpread = Math.PI / 12; // Example angle (15 degrees)

        const bullet1: BulletState = {
            id: bulletId1,
            ownerId: 'enemy',
            x: startX,
            y: startY + 20,
            velocityX: FALCON_BULLET_SPEED * Math.sin(-angleSpread),
            velocityY: FALCON_BULLET_SPEED * Math.cos(-angleSpread),
            bulletType: 'falcon',
        };
         const bullet2: BulletState = {
            id: bulletId2,
            ownerId: 'enemy',
            x: startX,
            y: startY + 20,
            velocityX: FALCON_BULLET_SPEED * Math.sin(angleSpread),
            velocityY: FALCON_BULLET_SPEED * Math.cos(angleSpread),
            bulletType: 'falcon',
        };

        this.gameStateManager.addEnemyBullet(bullet1);
        this.gameStateManager.addEnemyBullet(bullet2);
    }


    update(delta: number): void {
        const playerBullets = this.gameStateManager.getAllPlayerBullets();
        const enemyBullets = this.gameStateManager.getAllEnemyBullets();
        const dt = delta / 1000;

        // Update Player Bullets
        playerBullets.forEach(bullet => {
            bullet.x += bullet.velocityX * dt;
            bullet.y += bullet.velocityY * dt;

            // Remove if out of bounds
            if (bullet.y < 0 || bullet.y > GAME_HEIGHT || bullet.x < 0 || bullet.x > GAME_WIDTH) {
                this.gameStateManager.removePlayerBullet(bullet.id);
            }
        });

        // Update Enemy Bullets
        enemyBullets.forEach(bullet => {
            bullet.x += bullet.velocityX * dt;
            bullet.y += bullet.velocityY * dt;

            // Remove if out of bounds
             if (bullet.y < 0 || bullet.y > GAME_HEIGHT || bullet.x < 0 || bullet.x > GAME_WIDTH) {
                this.gameStateManager.removeEnemyBullet(bullet.id);
            }
        });
    }

    // --- Collision Handling (called by CollisionSystem/GameLoop) ---

    handlePlayerBulletHit(bulletId: EntityId): void { // Use EntityId
        this.gameStateManager.removePlayerBullet(bulletId);
        logger.debug(`Player bullet ${bulletId} removed after hit.`);
    }

    handleEnemyBulletHit(bulletId: EntityId): void { // Use EntityId
        this.gameStateManager.removeEnemyBullet(bulletId);
        logger.debug(`Enemy bullet ${bulletId} removed after hit.`);
    }

    resetBullets(): void {
        // Clear all bullets by removing them from the state manager
        this.gameStateManager.getAllPlayerBullets().forEach(b => this.gameStateManager.removePlayerBullet(b.id));
        this.gameStateManager.getAllEnemyBullets().forEach(b => this.gameStateManager.removeEnemyBullet(b.id));
        logger.info("All bullets cleared.");
    }
}