import { AuthoritativeState, PlayerState, EnemyState, BulletState, PlayerId, EntityId } from '@shared/types';
import { logger } from '@shared/logger';

// Import other client managers and UI components
import { ClientPlayerManager } from './ClientPlayerManager';
import { ClientEnemyManager } from './ClientEnemyManager';
import { ClientBulletManager } from './ClientBulletManager';
import { GameHUD } from '../ui/GameHUD';
import { GameOverUI } from '../ui/GameOverUI';

export class ClientStateManager {
    private currentServerState: AuthoritativeState | null = null;

    // References to other managers (to be assigned)
    private playerManager: ClientPlayerManager;
    private enemyManager: ClientEnemyManager;
    private bulletManager: ClientBulletManager;
    private gameHUD: GameHUD;
    private gameOverUI: GameOverUI;
    private handleRestartRequest: () => void; // Callback to request game restart

    // Local state tracking (optional, depending on reconciliation strategy)
    // private knownPlayerIds: Set<PlayerId> = new Set();
    // private knownEnemyIds: Set<EntityId> = new Set();
    // ... etc.

    constructor(
        playerManager: ClientPlayerManager,
        enemyManager: ClientEnemyManager,
        bulletManager: ClientBulletManager,
        gameHUD: GameHUD,
        gameOverUI: GameOverUI,
        handleRestartRequest: () => void // Accept the callback
    ) {
        // Assign manager references
        this.playerManager = playerManager;
        this.enemyManager = enemyManager;
        this.bulletManager = bulletManager;
        this.gameHUD = gameHUD;
        this.gameOverUI = gameOverUI;
        this.handleRestartRequest = handleRestartRequest; // Store the callback
    }

    /**
     * Called when a new authoritative state message is received from the server.
     * @param newState The latest state from the server.
     */
    public processStateUpdate(newState: AuthoritativeState): void {
        logger.debug('Processing new server state:', newState);
        const oldState = this.currentServerState;
        this.currentServerState = newState;

        if (!newState) {
            logger.warn('Received null or undefined state update.');
            return;
        }

        // --- Reconcile Players ---
        this.reconcilePlayers(newState.players, oldState?.players);

        // --- Reconcile Enemies ---
        this.reconcileEnemies(newState.enemies, oldState?.enemies);

        // --- Reconcile Player Bullets ---
        this.reconcilePlayerBullets(newState.playerBullets, oldState?.playerBullets);

        // --- Reconcile Enemy Bullets ---
        this.reconcileEnemyBullets(newState.enemyBullets, oldState?.enemyBullets);

        // --- Update UI ---
        this.updateUI(newState, oldState);

    }

    private reconcilePlayers(newPlayers: { [id: string]: PlayerState }, oldPlayers?: { [id: string]: PlayerState }): void { // Use string for index signature
        const newPlayerIds = new Set(Object.keys(newPlayers));
        const oldPlayerIds = oldPlayers ? new Set(Object.keys(oldPlayers)) : new Set<PlayerId>();

        // Update existing / Add new
        newPlayerIds.forEach(id => {
            const playerData = newPlayers[id];
            if (oldPlayerIds.has(id)) {
                // Player exists, update it
                this.playerManager.updatePlayer(id, playerData);
                logger.debug(`Updating player ${id}`);
            } else {
                // New player, create it
                this.playerManager.addPlayer(id, playerData);
                 logger.debug(`Adding new player ${id}`);
            }
        });

        // Remove old
        oldPlayerIds.forEach(id => {
            if (!newPlayerIds.has(id)) {
                // Player removed, destroy it
                this.playerManager.removePlayer(id);
                 logger.debug(`Removing player ${id}`);
            }
        });
    }

    private reconcileEnemies(newEnemies: EnemyState[], oldEnemies?: EnemyState[]): void {
        const newEnemyMap = new Map(newEnemies.map(e => [e.id, e]));
        const oldEnemyMap = oldEnemies ? new Map(oldEnemies.map(e => [e.id, e])) : new Map<EntityId, EnemyState>();

         // Update existing / Add new
        newEnemyMap.forEach((enemyData, id) => {
            if (oldEnemyMap.has(id)) {
                // Enemy exists, update it
                this.enemyManager.updateEnemy(id, enemyData);
                 logger.debug(`Updating enemy ${id}`);
            } else {
                // New enemy, create it
                this.enemyManager.addEnemy(id, enemyData);
                 logger.debug(`Adding new enemy ${id}`);
            }
        });

        // Remove old
        oldEnemyMap.forEach((_, id) => {
            if (!newEnemyMap.has(id)) {
                // Enemy removed, destroy it
                this.enemyManager.removeEnemy(id);
                 logger.debug(`Removing enemy ${id}`);
            }
        });
    }

     private reconcilePlayerBullets(newBullets: BulletState[], oldBullets?: BulletState[]): void {
        logger.debug(`[STATE_DEBUG] reconcilePlayerBullets called. Received ${newBullets?.length ?? 0} bullets.`); // Log entry and count
        const newBulletMap = new Map(newBullets.map(b => [b.id, b]));
        const oldBulletMap = oldBullets ? new Map(oldBullets.map(b => [b.id, b])) : new Map<EntityId, BulletState>();

         // Update existing / Add new
        newBulletMap.forEach((bulletData, id) => {
            logger.debug(`[STATE_DEBUG] Processing player bullet ID: ${id}, velocityY: ${bulletData.velocityY}`); // Log each bullet being processed
            if (oldBulletMap.has(id)) {
                // Bullet exists, update it (position usually handled by interpolation/direct set)
                // Use addOrUpdate which handles reconciliation logic
                this.bulletManager.addOrUpdatePlayerBullet(id, bulletData);
                 logger.debug(`Updating player bullet ${id}`);
            } else {
                // New bullet, create it (handle prediction reconciliation here)
                // Use addOrUpdate which handles reconciliation logic
                // TODO: Need to pass localPredictionId if available from GameScene message handling
                this.bulletManager.addOrUpdatePlayerBullet(id, bulletData /*, localPredictionId */);
                 logger.debug(`Adding new player bullet ${id}`);
            }
        });

        // Remove old
        oldBulletMap.forEach((_, id) => {
            if (!newBulletMap.has(id)) {
                // Bullet removed, destroy it
                this.bulletManager.removePlayerBullet(id);
                 logger.debug(`Removing player bullet ${id}`);
            }
        });
    }

     private reconcileEnemyBullets(newBullets: BulletState[], oldBullets?: BulletState[]): void {
        const newBulletMap = new Map(newBullets.map(b => [b.id, b]));
        const oldBulletMap = oldBullets ? new Map(oldBullets.map(b => [b.id, b])) : new Map<EntityId, BulletState>();

         // Update existing / Add new
        newBulletMap.forEach((bulletData, id) => {
            if (oldBulletMap.has(id)) {
                // Bullet exists, update it
                this.bulletManager.addOrUpdateEnemyBullet(id, bulletData);
                 logger.debug(`Updating enemy bullet ${id}`);
            } else {
                // New bullet, create it
                this.bulletManager.addOrUpdateEnemyBullet(id, bulletData);
                 logger.debug(`Adding new enemy bullet ${id}`);
            }
        });

        // Remove old
        oldBulletMap.forEach((_, id) => {
            if (!newBulletMap.has(id)) {
                // Bullet removed, destroy it
                this.bulletManager.removeEnemyBullet(id);
                 logger.debug(`Removing enemy bullet ${id}`);
            }
        });
    }

    private updateUI(newState: AuthoritativeState, oldState?: AuthoritativeState | null): void {
        // Update HUD if wave number changed
        if (!oldState || newState.waveNumber !== oldState.waveNumber) {
            logger.debug("Attempting to update wave. gameHUD exists:", !!this.gameHUD, "typeof updateWave:", typeof this.gameHUD?.updateWave); // Add detailed check
            // Ensure gameHUD exists and is ready before calling updateWave
            if (this.gameHUD && typeof this.gameHUD.updateWave === 'function') {
                this.gameHUD.updateWave(newState.waveNumber);
            } else {
                 // Log the actual value if it exists but the function doesn't
                 if(this.gameHUD) logger.warn("gameHUD exists but updateWave function not found.");
                 else logger.warn("gameHUD is undefined when trying to update wave.");
            }
            logger.info(`HUD Wave updated to: ${newState.waveNumber}`);
        }

        // Update Game Over UI based on game state
        const wasGameOver = oldState?.gameState === 'gameOver';
        const isGameOver = newState.gameState === 'gameOver';

        if (isGameOver && !wasGameOver) {
            logger.debug("Attempting to show GameOverUI. gameOverUI exists:", !!this.gameOverUI, "typeof show:", typeof this.gameOverUI?.show); // Add detailed check
            // Ensure gameOverUI exists before calling show
            if (this.gameOverUI && typeof this.gameOverUI.show === 'function') {
                 // Pass the actual restart handler provided by GameScene
                 this.gameOverUI.show(this.handleRestartRequest);
                 // logger.info('Showing Game Over UI'); // Log moved inside if block
            } else {
                 if(this.gameOverUI) logger.warn("gameOverUI exists but show function not found.");
                 else logger.warn("gameOverUI is undefined when trying to show Game Over.");
            }
            logger.info('Showing Game Over UI');
        } else if (!isGameOver && wasGameOver) {
            logger.debug("Attempting to hide GameOverUI. gameOverUI exists:", !!this.gameOverUI, "typeof hide:", typeof this.gameOverUI?.hide); // Add detailed check
            // Ensure gameOverUI exists before calling hide
            if (this.gameOverUI && typeof this.gameOverUI.hide === 'function') {
                this.gameOverUI.hide();
                 // logger.info('Hiding Game Over UI'); // Log moved inside if block
            } else {
                 if(this.gameOverUI) logger.warn("gameOverUI exists but hide function not found.");
                 else logger.warn("gameOverUI is undefined when trying to hide Game Over.");
            }
            logger.info('Hiding Game Over UI');
        }

        // TODO: Update lives display (might be handled per-player in PlayerManager update)
    }

    public getCurrentState(): AuthoritativeState | null {
        return this.currentServerState;
    }
}