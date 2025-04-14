import Phaser from 'phaser';
import { PlayerState, PlayerId } from '@shared/types';
import { logger } from '@shared/logger';
import { Player } from '../player/Player'; // Assuming path to Player class

export class ClientPlayerManager {
    private scene: Phaser.Scene;
    private players: Map<PlayerId, Player> = new Map();
    private localPlayerId: PlayerId | null = null;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    setLocalPlayerId(id: PlayerId): void {
        this.localPlayerId = id;
        logger.info(`Local player ID set to: ${id}`);
    }

    addPlayer(id: PlayerId, initialState: PlayerState): void {
        if (this.players.has(id)) {
            logger.warn(`Attempted to add existing player ID: ${id}`);
            return;
        }
        logger.debug(`Adding player sprite for ID: ${id}`);
        // Create the Player sprite instance (adjust constructor params as needed)
        const playerSprite = new Player(this.scene, initialState.x, initialState.y, id, initialState); // Pass full initialState
        this.players.set(id, playerSprite);

        // If this is the local player, potentially disable physics gravity if applicable
        // if (id === this.localPlayerId && playerSprite.sprite.body) {
        //     (playerSprite.sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
        // }
    }

    updatePlayer(id: PlayerId, state: PlayerState): void {
        const player = this.players.get(id);
        if (!player) {
            logger.warn(`Attempted to update non-existent player ID: ${id}`);
            // Optionally, could call addPlayer here if state guarantees creation before update
            // this.addPlayer(id, state);
            return;
        }

        // Handle visibility based on isActive state
        player.sprite.setVisible(state.isActive);

        if (!state.isActive) {
            // If player is inactive, no need to update position/visuals further
            return;
        }

        // Store previous lives *before* updating state/visuals
        // Assuming Player class has a property like 'currentLives' or similar
        // For now, let's fetch it directly if possible, or assume it's tracked internally by Player
        const previousLives = player.getCurrentLives(); // Placeholder: Assumes Player class tracks its own lives state

        // Update visual state (color, invincibility effect)
        player.setColor(state.color); // Ensure Player class has setColor
        player.handleInvincibilityEffect(state.isInvincible); // Add this method to Player class

        // Check for hit animation trigger AFTER updating invincibility effect status
        // Trigger animation if lives decreased AND player is NOT invincible
        // (Invincibility effect handles its own visuals)
        if (state.isActive && state.lives < previousLives && !state.isInvincible) {
             logger.debug(`Player ${id} hit! Lives decreased from ${previousLives} to ${state.lives}. Triggering hit animation.`);
             player.playHitAnimation(); // Call the new method on Player instance (to be implemented in Player.ts)
        }

        // Update the player's internal state representation if needed
        player.updateState(state); // Placeholder: Assumes Player class has a method to update its internal state including lives
        // Position Update: Direct set for local player, interpolation for remote
        if (id === this.localPlayerId) {
            // Directly set position for the local player (server is authoritative)
            player.sprite.setPosition(state.x, state.y);
            // logger.debug(`Directly setting position for local player ${id} to (${state.x}, ${state.y})`);
        } else {
            // Interpolate position for remote players
            // TODO: Implement interpolation logic (e.g., using Phaser.Math.Linear or tweens)
            // Store target position and smoothly move towards it in scene's update loop
            player.setTargetPosition(state.x, state.y); // Add this method to Player class
             logger.debug(`Setting target position for remote player ${id} to (${state.x}, ${state.y})`);
        }
    }

    removePlayer(id: PlayerId): void {
        const player = this.players.get(id);
        if (player) {
            logger.debug(`Removing player sprite for ID: ${id}`);
            player.destroy(); // Call destroy method on Player instance
            this.players.delete(id);
        } else {
            logger.warn(`Attempted to remove non-existent player ID: ${id}`);
        }
    }

    // Called from the main scene's update loop
    update(time: number, delta: number): void {
        this.players.forEach((player, id) => {
            if (id !== this.localPlayerId && player.sprite.visible) {
                // Update interpolation for remote players
                player.interpolatePosition(delta); // Add this method to Player class
            }
            // Update other continuous effects if needed (e.g., invincibility pulse)
            player.updateEffects(delta); // Add this method to Player class
        });
    }

    getPlayerSprite(id: PlayerId): Phaser.GameObjects.Sprite | undefined {
        return this.players.get(id)?.sprite;
    }

    getAllPlayerSprites(): Player[] {
        return Array.from(this.players.values());
    }
}