import { GameStateManager } from './GameStateManager';
import { PlayerId, PlayerState, InputPayload } from '@shared/types';
import {
    PLAYER_SPEED,
    PLAYER_FIRE_COOLDOWN,
    PLAYER_INITIAL_LIVES,
    PLAYER_ENEMY_COLLISION_COOLDOWN // Import the cooldown constant
    // Import GAME_WIDTH, GAME_HEIGHT later for boundary checks
} from '@shared/constants';
import { logger } from '@shared/logger'; // Import the shared logger

// Removed local constants, using imports now

import { BulletManager } from './BulletManager'; // Import BulletManager

export class PlayerManager {
    private gameStateManager: GameStateManager;
    private bulletManager: BulletManager; // Add bulletManager member

    // Keep track of last input received for each player
    private playerInputs: Map<PlayerId, InputPayload> = new Map();
    // Track player-specific timers or states if needed outside GameStateManager
    // private playerTimers: Map<PlayerId, { lastEnemyCollisionTime?: number }> = new Map();

    constructor(gameStateManager: GameStateManager, bulletManager: BulletManager) { // Add bulletManager to constructor
        this.gameStateManager = gameStateManager;
        this.bulletManager = bulletManager; // Assign bulletManager
    }

    addPlayer(playerId: PlayerId, color: string): PlayerState {
        // TODO: Determine starting position more dynamically?
        const startX = 512; // Center placeholder
        const startY = 700; // Bottom placeholder

        const newPlayer: PlayerState = {
            id: playerId,
            color: color, // Added color property
            x: startX,
            y: startY,
            lives: PLAYER_INITIAL_LIVES,
            isActive: true,
            isInvincible: false,
            lastShotTime: undefined, // Initialize optional field
            lastEnemyCollisionTime: undefined // Initialize optional field
        };
        this.gameStateManager.addPlayer(newPlayer);
        this.playerInputs.set(playerId, { left: false, right: false, up: false, down: false, fire: false }); // Initialize input state
        // this.playerTimers.set(playerId, {}); // Initialize timers
        logger.info(`Player ${playerId} added with color ${color}`);
        return newPlayer;
    }

    removePlayer(playerId: PlayerId): void {
        this.gameStateManager.removePlayer(playerId);
        this.playerInputs.delete(playerId);
        // this.playerTimers.delete(playerId);
        logger.info(`Player ${playerId} removed`);
        // TODO: Check if game should end if no players left? (Maybe handled in GameLoop)
    }

    handleInput(playerId: PlayerId, input: InputPayload): void {
        const player = this.gameStateManager.getPlayer(playerId);
        // Only process input for active players
        if (player && player.isActive) {
            this.playerInputs.set(playerId, input);
            // Handle immediate actions like firing request (decision made in update)
        }
    }

    handleToggleInvincible(playerId: PlayerId): void {
        const player = this.gameStateManager.getPlayer(playerId);
        // Only process for active players
        if (player && player.isActive) {
            const newInvincibleState = !player.isInvincible;
            this.gameStateManager.updatePlayer(playerId, { isInvincible: newInvincibleState });
            logger.debug(`Player ${playerId} invincibility toggled to: ${newInvincibleState}`);
        }
    }

    handleRequestRestart(playerId: PlayerId): void {
        // The actual reset logic might be coordinated higher up (GameServer/GameLoop)
        // This manager might just note the request or validate it.
        logger.info(`Player ${playerId} requested restart`);
        // TODO: Signal restart request to GameServer/GameLoop
    }

    update(delta: number): void {
        const players = this.gameStateManager.getAllPlayers();
        const now = Date.now();

        players.forEach(player => {
            if (!player.isActive) return; // Skip inactive players

            const input = this.playerInputs.get(player.id);
            if (!input) return; // Should not happen if player exists

            // --- Movement ---
            let dx = 0;
            let dy = 0;
            if (input.left) dx -= 1;
            if (input.right) dx += 1;
            if (input.up) dy -= 1;
            if (input.down) dy += 1;

            // Normalize diagonal movement (optional but good practice)
            const magnitude = Math.sqrt(dx * dx + dy * dy);
            if (magnitude > 0) {
                dx = (dx / magnitude);
                dy = (dy / magnitude);
            }

            const moveX = dx * PLAYER_SPEED * (delta / 1000);
            const moveY = dy * PLAYER_SPEED * (delta / 1000);

            // TODO: Add boundary checks (using GAME_WIDTH/GAME_HEIGHT from constants)
            const newX = player.x + moveX;
            const newY = player.y + moveY;

            this.gameStateManager.updatePlayer(player.id, { x: newX, y: newY });

            // --- Firing ---
            if (input.fire) {
                const canFire = !player.lastShotTime || (now - player.lastShotTime > PLAYER_FIRE_COOLDOWN);
                if (canFire) {
                    // Signal to BulletManager to create a bullet
                    this.bulletManager.createPlayerBullet(player.id, player.x, player.y); // Uncomment and use correct reference
                    this.gameStateManager.updatePlayer(player.id, { lastShotTime: now });
                    logger.debug(`Player ${player.id} fired`);
                }
            }

            // --- Update other player states ---
            // Example: Invincibility timer countdown (if applicable)
            // const timers = this.playerTimers.get(player.id);
            // if (player.isInvincible && timers?.invincibleUntil && now > timers.invincibleUntil) {
            //     this.gameStateManager.updatePlayer(player.id, { isInvincible: false });
            //     delete timers.invincibleUntil;
            // }
        });
    }

    // --- Collision Handling (called by CollisionSystem/GameLoop) ---
    handlePlayerHitByEnemyBullet(playerId: PlayerId): void {
        const player = this.gameStateManager.getPlayer(playerId);
        if (player && player.isActive && !player.isInvincible) {
            const newLives = player.lives - 1;
            const newActiveState = newLives > 0;
            this.gameStateManager.updatePlayer(playerId, { lives: newLives, isActive: newActiveState });
            logger.debug(`Player ${playerId} hit by enemy bullet. Lives: ${newLives}`);
            if (!newActiveState) {
                logger.info(`Player ${playerId} is now inactive.`);
                // TODO: Signal player defeat? (GameLoop checks all players inactive)
            }
        }
    }

    handlePlayerEnemyCollision(playerId: PlayerId): void {
        const player = this.gameStateManager.getPlayer(playerId);
        const now = Date.now();
        if (player && player.isActive && !player.isInvincible) {
            // Check cooldown
            const canTakeDamage = !player.lastEnemyCollisionTime || (now - player.lastEnemyCollisionTime > PLAYER_ENEMY_COLLISION_COOLDOWN);

            if (canTakeDamage) {
                const newLives = player.lives - 1;
                const newActiveState = newLives > 0;
                this.gameStateManager.updatePlayer(playerId, {
                    lives: newLives,
                    isActive: newActiveState,
                    lastEnemyCollisionTime: now // Update cooldown timer
                });
                logger.debug(`Player ${playerId} collided with enemy. Lives: ${newLives}. Cooldown started.`);
                 if (!newActiveState) {
                    logger.info(`Player ${playerId} is now inactive.`);
                    // TODO: Signal player defeat?
                }
            } else {
                 logger.debug(`Player ${playerId} collided with enemy, but cooldown active. No damage taken.`);
            }
        }
    }

    resetPlayers(): void {
        this.gameStateManager.getAllPlayers().forEach(player => {
            this.gameStateManager.updatePlayer(player.id, {
                lives: PLAYER_INITIAL_LIVES,
                isActive: true,
                isInvincible: false,
                // Reset position? Or rely on GameStateManager.resetState clearing players?
                // x: startX,
                // y: startY,
                lastShotTime: undefined,
                lastEnemyCollisionTime: undefined, // Reset cooldown timer
            });
             this.playerInputs.set(player.id, { left: false, right: false, up: false, down: false, fire: false });
             // Reset timers if used
             // this.playerTimers.set(player.id, {});
        });
         logger.info("All active players reset for new game.");
    }

}