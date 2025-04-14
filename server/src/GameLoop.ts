import { GameStateManager } from './GameStateManager';
import { PlayerManager } from './PlayerManager';
import { BulletManager } from './BulletManager';
import { CollisionSystem } from './CollisionSystem';
import { GameStateEnum } from '@shared/types'; // Import shared enum
import {
    SERVER_TICK_RATE,
    GAME_HEIGHT,
    ENEMY_SHOOT_INTERVAL_NORMAL,
    ENEMY_SHOOT_INTERVAL_FALCON,
    ENEMY_TYPE_SHOOT_COOLDOWN // Import the type cooldown constant
} from '@shared/constants'; // Import shared constants
import { logger } from '@shared/logger'; // Import the shared logger
import { EnemyWaveManagerCore, EnemyState, EnemyType } from '@shared/EnemyWaveManagerCore'; // Import actual class and types

// Removed local GameStateEnum placeholder
// Removed placeholder class


// Removed local constants, using imports now

export class GameLoop {
    private gameStateManager: GameStateManager;
    private playerManager: PlayerManager;
    private bulletManager: BulletManager;
    private collisionSystem: CollisionSystem;
    private enemyWaveManager: EnemyWaveManagerCore; // Assuming direct access
private broadcastCallback: (state: any) => void; // Callback to send state

private loopInterval: NodeJS.Timeout | null = null;
private lastTickTime: number = 0;
private gameStarted: boolean = false; // Track if the game loop should run
private enemyLastShotTime: Map<string, number> = new Map(); // Track last shot time per enemy ID
private enemyTypeLastShotTime: Map<EnemyType, number> = new Map(); // Track last shot time per enemy type

    constructor(
        gameStateManager: GameStateManager,
        playerManager: PlayerManager,
        bulletManager: BulletManager,
        collisionSystem: CollisionSystem,
        enemyWaveManager: EnemyWaveManagerCore,
        broadcastCallback: (state: any) => void // Add callback parameter
    ) {
        this.gameStateManager = gameStateManager;
        this.playerManager = playerManager;
        this.bulletManager = bulletManager;
        this.collisionSystem = collisionSystem;
        this.enemyWaveManager = enemyWaveManager;
        this.broadcastCallback = broadcastCallback; // Store the callback
    }

    public isRunning(): boolean {
        return this.gameStarted;
    }

    startGame(): void {
        if (this.gameStarted) return;
        logger.info("Starting game loop...");
        this.gameStarted = true;
        this.lastTickTime = Date.now();
        // Reset state before starting (ensure clean slate)
        this.resetGame();
        // Start wave 1
        this.enemyWaveManager.startWave(1);
        // Start the interval
        this.loopInterval = setInterval(() => this.tick(), SERVER_TICK_RATE); // Use imported constant
    }

    stopGame(): void {
        if (!this.gameStarted || this.loopInterval === null) return;
        logger.info("Stopping game loop...");
        clearInterval(this.loopInterval);
        this.loopInterval = null;
        this.gameStarted = false;
        this.gameStateManager.setGameState(GameStateEnum.GameOver); // Ensure state is GameOver
        // Optionally broadcast final state one last time?
    }

     resetGame(): void {
        logger.info("Resetting game state for new game...");
        // Order matters: reset bullets/players before potentially starting new wave
        this.bulletManager.resetBullets();
        this.playerManager.resetPlayers(); // Resets lives, active status etc.
        this.gameStateManager.setGameState(GameStateEnum.Playing); // Set state to Playing
        // EnemyWaveManagerCore reset (like starting wave 1) is handled in startGame or externally
                this.enemyLastShotTime.clear(); // Clear individual shot timers on reset
                this.enemyTypeLastShotTime.clear(); // Clear type shot timers on reset
    }

    // Called when a restart is requested (e.g., by PlayerManager)
    handleRestartRequest(): void {
        if (this.gameStateManager.getGameState() === GameStateEnum.GameOver) {
            logger.info("Restart requested and approved.");
            this.resetGame();
            // Start wave 1 again
            this.enemyWaveManager.startWave(1);
             // Ensure loop is running if it was stopped
            if (!this.loopInterval) {
                 this.startGame(); // This might need refinement if startGame resets everything again
            }
        } else {
             logger.warn("Restart requested while game is still playing.");
        }
    }


    private tick(): void {
        const now = Date.now();
        const delta = now - this.lastTickTime;
        this.lastTickTime = now;

        if (this.gameStateManager.getGameState() !== GameStateEnum.Playing) {
            // If game is over, don't run update logic, but maybe still broadcast?
            // this.broadcastCurrentState(); // Decide if needed
            return;
        }

        // --- Update Game Logic (Order Matters) ---

        // 1. Update player positions based on last input
        this.playerManager.update(delta);

        // 2. Update enemy positions (via EnemyWaveManagerCore)
        this.enemyWaveManager.update(delta, GAME_HEIGHT); // Use imported constant
        
                // 2b. Handle Enemy Firing Logic
                this.handleEnemyFiring(now);

        // 3. Update bullet positions
        this.bulletManager.update(delta);

        // 4. Perform collision detection
        this.collisionSystem.update(); // Handles consequences internally via manager calls

        // --- Check Game State Conditions ---

        // 5. Check if all players are inactive (Game Over)
        const allPlayers = this.gameStateManager.getAllPlayers();
        if (allPlayers.length > 0 && allPlayers.every(p => !p.isActive)) {
            logger.info("Game Over: All players inactive.");
            this.stopGame(); // Stop loop, set state to GameOver
            this.broadcastCurrentState(); // Broadcast final state
            return; // Exit tick early
        }

        // 6. Check if any enemy reached the bottom (Game Over or Wave Reset)
        const enemies = this.enemyWaveManager.getEnemies();
        const enemyReachedBottom = enemies.some(e => e.active && e.y >= GAME_HEIGHT); // Use imported constant

        if (enemyReachedBottom) {
            const activePlayers = allPlayers.filter(p => p.isActive);
            const allActivePlayersInvincible = activePlayers.length > 0 && activePlayers.every(p => p.isInvincible);

            if (!allActivePlayersInvincible) {
                logger.info("Game Over: Enemy reached bottom.");
                this.stopGame();
                this.broadcastCurrentState();
                return;
            } else {
                logger.info("Enemy reached bottom, but all active players invincible. Resetting enemy positions.");
                this.enemyWaveManager.resetActiveEnemyPositions();
                // Wave does not progress in this case
            }
        }


        // 7. Check for wave progression (if game is still playing)
        if (this.gameStateManager.getGameState() === GameStateEnum.Playing) {
             if (enemies.every(e => !e.active)) {
                 const currentWave = this.gameStateManager.getWaveNumber();
                 const nextWave = currentWave + 1;
                 logger.info(`Wave ${currentWave} cleared. Starting wave ${nextWave}.`);
                 this.enemyWaveManager.startWave(nextWave);
             }
        }

        // --- Broadcast State ---
        // 8. Send the updated state to all clients
        this.broadcastCurrentState();
    }

    private broadcastCurrentState(): void {
        const state = this.gameStateManager.getAuthoritativeState();
        // Use the callback to send the state
        this.broadcastCallback(state);
        // logger.debug("Broadcasting state via callback:", JSON.stringify(state).substring(0, 100) + "..."); // Log snippet
    }

    private handleEnemyFiring(now: number): void {
        const activeEnemies = this.enemyWaveManager.getEnemies().filter(e => e.active && e.visible);
        if (activeEnemies.length === 0) return;

        // Simple approach: Iterate and check individual cooldowns
        activeEnemies.forEach(enemy => {
            const interval = enemy.type === 2 ? ENEMY_SHOOT_INTERVAL_FALCON : ENEMY_SHOOT_INTERVAL_NORMAL;
            const lastShot = this.enemyLastShotTime.get(enemy.id) ?? 0; // Default to 0 if never shot

            if (now - lastShot > interval) {
                // Check type cooldown
                const lastTypeShot = this.enemyTypeLastShotTime.get(enemy.type) ?? 0;
                if (now - lastTypeShot > ENEMY_TYPE_SHOOT_COOLDOWN) {
                    // Basic probability check (e.g., 5% chance per tick if cooldown met)
                    // This prevents all enemies firing exactly when cooldown ends.
                    // Adjust probability as needed for game balance.
                    const fireProbability = 0.05; // Lower probability might be needed now with type cooldown
                    if (Math.random() < fireProbability) {
                         logger.debug(`Enemy ${enemy.id} firing (Type: ${enemy.type}) - Cooldowns met`);
                         const bulletTypeString = enemy.type === 2 ? 'falcon' : 'normal';
                         // TODO: Consider using createFalconSpreadShot for type 2 if desired
                         this.bulletManager.createEnemyBullet(enemy.id, enemy.x, enemy.y, bulletTypeString);
                         this.enemyLastShotTime.set(enemy.id, now); // Update individual enemy last shot time
                         this.enemyTypeLastShotTime.set(enemy.type, now); // Update type last shot time
                    }
                }
            }
        });

        // TODO: Consider more complex firing patterns (e.g., type cooldowns, targeting) if needed.
    }
}
