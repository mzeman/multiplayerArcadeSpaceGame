import Phaser from 'phaser';
import { BulletState, EntityId, PlayerId } from '@shared/types';
import { logger } from '@shared/logger';

export class ClientBulletManager {
    private scene: Phaser.Scene;
    private playerBullets: Map<EntityId, Phaser.Physics.Arcade.Sprite> = new Map();
    private enemyBullets: Map<EntityId, Phaser.Physics.Arcade.Sprite> = new Map();
    private playerBulletsGroup: Phaser.Physics.Arcade.Group;
    private enemyBulletsGroup: Phaser.Physics.Arcade.Group;
    private localPlayerId: PlayerId | null = null; // Store local player ID

    // For prediction reconciliation
    // private localPlayerBulletPredictionMap: Map<string, EntityId> = new Map(); // Old map approach
    private predictedBulletIds: string[] = []; // Queue for predicted IDs

    constructor(scene: Phaser.Scene, playerBulletsGroup: Phaser.Physics.Arcade.Group, enemyBulletsGroup: Phaser.Physics.Arcade.Group) {
        this.scene = scene;
        this.playerBulletsGroup = playerBulletsGroup;
        this.enemyBulletsGroup = enemyBulletsGroup;
    }

    setLocalPlayerId(id: PlayerId | null): void {
        this.localPlayerId = id;
    }

    // --- Player Bullets ---

    /** Creates a predicted bullet sprite locally before server confirmation. */
    createLocalPredictedBullet(localId: string, x: number, y: number, velocityY: number): void {
        logger.debug(`Creating predicted local bullet ${localId}`);
        const bulletSprite = this.scene.physics.add.sprite(x, y, 'bullet');
        bulletSprite.setVelocityY(velocityY);
        logger.debug(`[ClientBulletManager] Predicted bullet ${localId} velocity set to Y: ${bulletSprite.body?.velocity.y}`); // Log velocity
        bulletSprite.setTint(0xffff00); // Yellow tint for player bullets
        bulletSprite.setScale(0.5); // Example scale
        // Add to physics group
        this.playerBulletsGroup.add(bulletSprite);
        // Keep track of this local prediction
        this.playerBullets.set(localId, bulletSprite); // Store sprite by local ID
        this.predictedBulletIds.push(localId); // Add local ID to the prediction queue
    }

    /** Adds or updates a player bullet based on server state, reconciling predictions. */
    // Removed localPredictionId parameter, using queue instead
    addOrUpdatePlayerBullet(id: EntityId, state: BulletState): void {
        let bulletSprite = this.playerBullets.get(id);
        let reconciled = false;

        // --- Reconciliation Logic ---
        // Check if:
        // 1. This bullet belongs to the local player
        // 2. We don't already have a sprite for this server ID
        // 3. There are pending predictions in the queue
        if (state.ownerId === this.localPlayerId && !bulletSprite && this.predictedBulletIds.length > 0) {
            // Log queue state *before* dequeuing
            logger.debug(`[RECONCILE_LOG] Attempting reconciliation for server bullet ${id}. Queue: [${this.predictedBulletIds.join(', ')}]`);
            const predictedId = this.predictedBulletIds.shift(); // Dequeue the oldest prediction
            logger.debug(`[RECONCILE_LOG] Dequeued predictedId: ${predictedId}`);
            if (predictedId) {
                bulletSprite = this.playerBullets.get(predictedId);
                if (bulletSprite) {
                    // Found the predicted sprite! Re-map it to the server ID.
                    logger.debug(`[RECONCILE_LOG] Found predicted sprite for ${predictedId}. Re-mapping to server ID ${id}.`);
                    this.playerBullets.delete(predictedId);
                    this.playerBullets.set(id, bulletSprite);
                    // Update the existing sprite with server state
                    bulletSprite.setPosition(state.x, state.y);
                    logger.debug(`[BULLET_DEBUG] Reconciling predicted ${predictedId} to server ${id}. Received velocityY: ${state.velocityY}`);
                    bulletSprite.setVelocity(state.velocityX, state.velocityY);
                    reconciled = true;
                    logger.debug(`[RECONCILE_LOG] Reconciliation successful for ${id} (was ${predictedId}).`);
                } else {
                    logger.warn(`[RECONCILE_LOG] Predicted bullet ID ${predictedId} dequeued but sprite not found in map.`);
                    // Proceed to create new sprite below
                }
            } else {
                 logger.warn(`[RECONCILE_LOG] Shift returned undefined from predictedBulletIds queue.`);
            }
        }
        // --- End Reconciliation Logic ---

        // If not reconciled and sprite doesn't exist for server ID, create new
        if (!reconciled && !bulletSprite) {
            // Bullet doesn't exist locally (or prediction was lost/failed), create it
            logger.debug(`[RECONCILE_LOG] Reconciliation failed or not applicable for ${id}. Creating new sprite.`);
            logger.debug(`Adding new player bullet sprite ${id}`);
            bulletSprite = this.scene.physics.add.sprite(state.x, state.y, 'bullet');
            logger.debug(`[BULLET_DEBUG] Creating new bullet ${id}. Received velocityY: ${state.velocityY}`);
            bulletSprite.setVelocity(state.velocityX, state.velocityY); // Use server velocity
            logger.debug(`[ClientBulletManager] New player bullet ${id} velocity set to X: ${bulletSprite.body?.velocity.x}, Y: ${bulletSprite.body?.velocity.y}`); // Log velocity
            bulletSprite.setTint(0xffff00); // Yellow tint
            bulletSprite.setScale(0.5);
            // Add to physics group
            this.playerBulletsGroup.add(bulletSprite);
            this.playerBullets.set(id, bulletSprite);
        } else if (!reconciled && bulletSprite) {
            // Bullet exists (was not reconciled), update it
            // Ensure velocity is applied on updates
            logger.debug(`[BULLET_DEBUG] Updating existing bullet ${id}. Received velocityY: ${state.velocityY}`);
            bulletSprite.setVelocity(state.velocityX, state.velocityY);
            // Optionally add position snapping back if needed for non-predicted bullets,
            // but let's rely on velocity first.
            // bulletSprite.setPosition(state.x, state.y);
        }
        // If reconciled=true, the sprite was already updated during reconciliation.
    }

    removePlayerBullet(id: EntityId): void {
        const bulletSprite = this.playerBullets.get(id);
        if (bulletSprite) {
            logger.debug(`Removing player bullet sprite ${id}`);
            bulletSprite.destroy();
            this.playerBullets.delete(id);
        } else {
            // Also check if it was a local prediction ID that needs removal
             // Check if the ID being removed might be a local prediction ID that wasn't reconciled
             const isLikelyPredictionId = typeof id === 'string' && id.includes('-'); // Basic check for prediction format
             if (isLikelyPredictionId && this.playerBullets.has(id)) {
                 logger.warn(`[RECONCILE_LOG] Removing player bullet by likely prediction ID: ${id}. This might indicate a previous reconciliation issue.`);
                 this.playerBullets.get(id)?.destroy();
                 this.playerBullets.delete(id);
             } else {
                logger.warn(`Attempted to remove non-existent player bullet ID: ${id}`);
             }
        }
    }

    // --- Enemy Bullets ---

    addOrUpdateEnemyBullet(id: EntityId, state: BulletState): void {
        let bulletSprite = this.enemyBullets.get(id);
        if (!bulletSprite) {
            logger.debug(`Adding new enemy bullet sprite ${id}`);
            bulletSprite = this.scene.physics.add.sprite(state.x, state.y, 'bullet');
            bulletSprite.setVelocity(state.velocityX, state.velocityY);
            logger.debug(`[ClientBulletManager] New enemy bullet ${id} velocity set to X: ${bulletSprite.body?.velocity.x}, Y: ${bulletSprite.body?.velocity.y}`); // Log velocity
            bulletSprite.setScale(0.5);
            // Apply tint based on type
            if (state.bulletType === 'falcon') {
                bulletSprite.setTint(0xffa500); // Orange tint for falcon
            } else {
                bulletSprite.setTint(0xffffff); // White/default tint for normal
            }
            // Add to physics group
            this.enemyBulletsGroup.add(bulletSprite);
            this.enemyBullets.set(id, bulletSprite);
        } else {
            // Update position (snapping to authoritative server state)
            bulletSprite.setPosition(state.x, state.y);
             logger.debug(`Updating existing enemy bullet ${id} to pos (${state.x}, ${state.y})`);
             // Update tint if type somehow changed (unlikely but possible)
             const expectedTint = state.bulletType === 'falcon' ? 0xffa500 : 0xffffff;
             if (bulletSprite.tintTopLeft !== expectedTint) {
                 bulletSprite.setTint(expectedTint);
             }
        }
    }

    removeEnemyBullet(id: EntityId): void {
        const bulletSprite = this.enemyBullets.get(id);
        if (bulletSprite) {
            logger.debug(`Removing enemy bullet sprite ${id}`);
            bulletSprite.destroy();
            this.enemyBullets.delete(id);
        } else {
            logger.warn(`Attempted to remove non-existent enemy bullet ID: ${id}`);
        }
    }

    // Optional: Update method if client-side physics needs adjustments
    update(time: number, delta: number): void {
        // Phaser's physics engine handles movement based on velocity set

        // --- Cleanup Orphaned Predicted Bullets ---
        const PREDICTION_CLEANUP_THRESHOLD_MS = 2000; // 2 seconds
        const now = time; // Use Phaser time passed into update

        this.playerBullets.forEach((sprite, id) => {
            // Check if the ID looks like a prediction ID (e.g., "playerId-timestamp")
            if (typeof id === 'string' && id.startsWith(this.localPlayerId + '-')) {
                try {
                    const timestampStr = id.split('-')[1];
                    const timestamp = parseInt(timestampStr, 10);
                    if (!isNaN(timestamp)) {
                        if (now - timestamp > PREDICTION_CLEANUP_THRESHOLD_MS) {
                            logger.warn(`[CLEANUP] Removing orphaned predicted bullet ${id} (age: ${now - timestamp}ms)`);
                            sprite.destroy();
                            this.playerBullets.delete(id);
                            // Also remove from the prediction queue if it's still somehow there
                            const queueIndex = this.predictedBulletIds.indexOf(id);
                            if (queueIndex > -1) {
                                logger.warn(`[CLEANUP] Removing orphaned ID ${id} from prediction queue.`);
                                this.predictedBulletIds.splice(queueIndex, 1);
                            }
                        }
                    }
                } catch (error) {
                    logger.error(`[CLEANUP] Error parsing or cleaning up predicted bullet ID ${id}:`, error);
                }
            }
        });
        // --- End Cleanup ---

        // Could add logic here to remove bullets that go out of bounds client-side
        // for slightly faster cleanup than waiting for server state, but server is authoritative.
    }
}