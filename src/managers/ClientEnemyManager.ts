import Phaser from 'phaser';
import { EnemyState, EntityId } from '@shared/types';
import { logger } from '@shared/logger';
import { Enemy } from '../enemies/Enemy'; // Base class
import { NormalEnemy } from '../enemies/NormalEnemy';
import { FalconEnemy } from '../enemies/FalconEnemy';
import { showExplosion } from '../effects/effects'; // Import the effect function
export class ClientEnemyManager {
    private scene: Phaser.Scene;
    private enemies: Map<EntityId, Enemy> = new Map();
    private enemiesGroup: Phaser.Physics.Arcade.Group; // Group for physics overlaps

    // Interpolation factor for enemy movement
    private interpolationFactor: number = 0.2; // Adjust as needed

    constructor(scene: Phaser.Scene, enemiesGroup: Phaser.Physics.Arcade.Group) {
        this.scene = scene;
        this.enemiesGroup = enemiesGroup;
    }

    addEnemy(id: EntityId, initialState: EnemyState): void {
        if (this.enemies.has(id)) {
            logger.warn(`Attempted to add existing enemy ID: ${id}`);
            return;
        }
        logger.debug(`Adding enemy sprite for ID: ${id}, type: ${initialState.type}`);

        let enemyInstance: Enemy;
        // Instantiate correct enemy type based on state
        if (initialState.type === 2) { // Assuming 2 is Falcon
            enemyInstance = new FalconEnemy(this.scene, initialState.x, initialState.y);
        } else { // Default to NormalEnemy (Type 1 or others)
            enemyInstance = new NormalEnemy(this.scene, initialState.x, initialState.y);
        }

        // Store target position for interpolation
        enemyInstance.setTargetPosition(initialState.x, initialState.y); // Add this method to Enemy base class

        // Add the sprite to the physics group for collision detection
        this.enemiesGroup.add(enemyInstance.sprite);

        this.enemies.set(id, enemyInstance);
    }

    updateEnemy(id: EntityId, state: EnemyState): void {
        const enemy = this.enemies.get(id);
        if (!enemy) {
            logger.warn(`Attempted to update non-existent enemy ID: ${id}`);
            // Optionally add if missing and state guarantees creation first
            // this.addEnemy(id, state);
            return;
        }

        const wasActive = enemy.sprite.visible; // Check visibility *before* potential update

        // Handle visibility/activity (server dictates if enemy is 'active')
        enemy.sprite.setVisible(state.active); // Show/hide based on server 'active' state

        // Check for active: true -> false transition to trigger explosion
        if (wasActive && !state.active) {
            logger.info(`Enemy ${id} became inactive. Triggering explosion.`);
            showExplosion(this.scene, enemy.sprite.x, enemy.sprite.y); // Trigger effect based on state change
            // No need to return here immediately, allow position update if needed (though unlikely if inactive)
        }


        if (!state.active) {
            // If inactive, no need to update position further
            return;
        }

        // Set target position for interpolation (only if active)
        enemy.setTargetPosition(state.x, state.y); // Use method from Enemy base class
        // logger.debug(`Setting target position for enemy ${id} to (${state.x}, ${state.y})`);
    }

    removeEnemy(id: EntityId): void {
        const enemy = this.enemies.get(id);
        if (enemy) {
            logger.debug(`Removing enemy instance and sprite for ID: ${id}`);
            enemy.destroy(); // Call destroy method on Enemy instance (should handle sprite destruction)
            // Add confirmation log
            if (enemy.sprite.active) { // Check if sprite still exists after destroy call
                 logger.warn(`Enemy sprite for ${id} might not have been destroyed properly by enemy.destroy().`);
            } else {
                 logger.debug(`Enemy sprite for ${id} confirmed destroyed.`);
            }
            this.enemies.delete(id);
        } else {
            logger.warn(`Attempted to remove non-existent enemy ID: ${id}`);
        }
    }

    // Called from the main scene's update loop
    update(time: number, delta: number): void {
        this.enemies.forEach((enemy) => {
            if (enemy.sprite.visible) {
                // Update interpolation for all visible enemies
                enemy.interpolatePosition(delta); // Add this method to Enemy base class
            }
            // Update other continuous effects if needed
            // enemy.updateEffects(delta); // Add if needed
        });
    }

     getEnemySprite(id: EntityId): Phaser.GameObjects.Sprite | undefined {
        return this.enemies.get(id)?.sprite;
    }

    getAllEnemySprites(): Enemy[] {
        return Array.from(this.enemies.values());
    }
}