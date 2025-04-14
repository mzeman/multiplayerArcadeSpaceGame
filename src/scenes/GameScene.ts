import Phaser from 'phaser';
import { logger } from '@shared/logger';
import { AuthoritativeState, PlayerId, EntityId } from '@shared/types'; // Import shared types
import { PLAYER_BULLET_SPEED } from '@shared/constants'; // Import constant

// New Manager Imports
import { ClientStateManager } from '../managers/ClientStateManager';
import { ClientPlayerManager } from '../managers/ClientPlayerManager';
import { ClientEnemyManager } from '../managers/ClientEnemyManager';
import { ClientBulletManager } from '../managers/ClientBulletManager';
import { ClientCollisionEffectsManager } from '../managers/ClientCollisionEffectsManager';

// Existing Component Imports
import { GameOverUI } from '../ui/GameOverUI';
import { GameHUD } from '../ui/GameHUD';
import { InputManager } from '../managers/InputManager';
import { MultiplayerClient } from '../network/MultiplayerClient';
// Removed old manager imports: EnemyWaveManager, CollisionManager
// Removed entity imports if managers handle instantiation: Player, NormalEnemy, FalconEnemy

export class GameScene extends Phaser.Scene {
    // Network and State
    private multiplayerClient!: MultiplayerClient;
    private clientStateManager!: ClientStateManager;
    private localPlayerId: PlayerId | null = null;

    // Managers
    private inputManager!: InputManager;
    private clientPlayerManager!: ClientPlayerManager;
    private clientEnemyManager!: ClientEnemyManager;
    private clientBulletManager!: ClientBulletManager;
    private clientCollisionEffectsManager!: ClientCollisionEffectsManager;

    // UI Components
    private gameHUD!: GameHUD;
    private gameOverUI!: GameOverUI;

    // Physics Groups (for overlap checks)
    private playersGroup!: Phaser.Physics.Arcade.Group;
    private enemiesGroup!: Phaser.Physics.Arcade.Group;
    private playerBulletsGroup!: Phaser.Physics.Arcade.Group;
    private enemyBulletsGroup!: Phaser.Physics.Arcade.Group;

    // Input state tracking
    private previousInvincibleKeyState: boolean = false;
    private localPlayerLastShotTime: number = 0; // Still needed for client-side prediction rate limiting
    // Removed isSceneReady flag, using MultiplayerClient buffering instead

    constructor() {
        super({ key: 'GameScene' });
    }

    preload(): void {
        logger.info('[GameScene] Preloading assets...');
        this.load.image('enemyShip', 'assets/enemy_ship.svg');
        this.load.image('enemy_falcon', 'assets/enemy_falcon.svg');
        this.load.image('playerShip', 'assets/player_ship.svg');
        this.load.image('bullet', 'assets/bullet.svg');
        logger.info('[GameScene] Preload finished.');
    }

    create(): void {
        logger.info('[GameScene] Create started.');
        this.cameras.main.setBackgroundColor('#000');

        // --- Initialize UI First ---
        this.gameHUD = new GameHUD(this);
        // Create HUD elements immediately with default/placeholder values
        this.gameHUD.create(0, 0); // Initial lives/wave might come later
        this.gameOverUI = new GameOverUI(this); // Creates UI elements, initially hidden

        // --- Initialize Managers ---
        this.clientPlayerManager = new ClientPlayerManager(this);
        // Initialize Physics Groups *before* managers that need them
        this.playersGroup = this.physics.add.group();
        this.enemiesGroup = this.physics.add.group();
        this.playerBulletsGroup = this.physics.add.group();
        this.enemyBulletsGroup = this.physics.add.group();

        // Pass physics groups to relevant managers
        this.clientEnemyManager = new ClientEnemyManager(this, this.enemiesGroup);
        this.clientBulletManager = new ClientBulletManager(this, this.playerBulletsGroup, this.enemyBulletsGroup);
        this.clientCollisionEffectsManager = new ClientCollisionEffectsManager(this);

        // Add logging to check UI components before passing them
        logger.debug("Checking UI components before ClientStateManager instantiation:", {
            gameHUD_exists: !!this.gameHUD,
            gameOverUI_exists: !!this.gameOverUI,
            gameHUD_create_exists: !!(this.gameHUD && typeof this.gameHUD.create === 'function'),
            gameOverUI_show_exists: !!(this.gameOverUI && typeof this.gameOverUI.show === 'function')
        });
        // Instantiate ClientStateManager, passing other managers and UI components
        // Define the restart handler function
        const handleRestartRequest = () => {
            if (this.multiplayerClient) {
                logger.info("[GameScene] Sending requestRestart message.");
                this.multiplayerClient.send({ type: 'requestRestart' });
            } else {
                logger.warn("[GameScene] Cannot send restart request: multiplayerClient not available.");
            }
        };

        this.clientStateManager = new ClientStateManager(
            this.clientPlayerManager,
            this.clientEnemyManager,
            this.clientBulletManager,
            this.gameHUD, // Now defined
            this.gameOverUI, // Now defined
            handleRestartRequest // Pass the restart handler
        );

        // --- Initialize Input ---
        // Pass callback to handle toggle request
        this.inputManager = new InputManager(this, () => {
            if (this.localPlayerId /* && check if player is active? */) {
                 logger.debug("[GameScene] Invincibility toggle requested. Sending to server.");
                 this.multiplayerClient.send({ type: 'toggleInvincible' });
            }
        });
        this.inputManager.create();

        // Physics Groups are initialized earlier now

        // --- Setup Multiplayer Connection ---
        logger.info('[GameScene] Connecting to multiplayer server...');
        this.multiplayerClient = new MultiplayerClient('ws://localhost:8082', { // Changed port to 8082
            onWelcome: (payload: { id: PlayerId; color: string }) => {
                logger.info(`[GameScene] Welcome received. Local Player ID: ${payload.id}`);
                this.localPlayerId = payload.id;
                this.clientPlayerManager.setLocalPlayerId(payload.id); // Inform player manager
                this.clientBulletManager.setLocalPlayerId(payload.id); // Inform bullet manager
                this.startGame(); // Send 'ready' message
            },
            onAuthoritativeState: (state: AuthoritativeState) => {
                // Buffering in MultiplayerClient ensures this only runs when scene is ready
                // Pass the state to the ClientStateManager for processing
                this.clientStateManager.processStateUpdate(state);
                // Update GameHUD lives based on local player state
                const localPlayerData = this.localPlayerId ? state.players[this.localPlayerId] : null;
                if (localPlayerData && this.gameHUD && typeof this.gameHUD.updateLives === 'function') {
                     this.gameHUD.updateLives(localPlayerData.lives);
                } else if (localPlayerData && !this.gameHUD) {
                    logger.warn("[GameScene] Local player data found but gameHUD is missing for lives update.");
                }
            },
            // Removed deprecated onGameState and onMainPlayer handlers
        });

        // --- Setup Collision Overlaps ---
        // Use the new ClientCollisionEffectsManager methods as callbacks
        this.physics.add.overlap(
            this.playerBulletsGroup,
            this.enemiesGroup,
            this.clientCollisionEffectsManager.handleBulletEnemyCollision,
            undefined,
            this.clientCollisionEffectsManager // Context
        );
        this.physics.add.overlap(
            this.enemyBulletsGroup,
            this.playersGroup,
            this.clientCollisionEffectsManager.handleEnemyBulletPlayerCollision,
            undefined,
            this.clientCollisionEffectsManager
        );
         this.physics.add.overlap(
            this.playersGroup, // Player sprites added by ClientPlayerManager
            this.enemiesGroup, // Enemy sprites added by ClientEnemyManager
            this.clientCollisionEffectsManager.handlePlayerEnemyCollision,
            undefined,
            this.clientCollisionEffectsManager
        );

        logger.info('[GameScene] Create finished.');
        // Signal MultiplayerClient that the scene is ready to process messages
        if (this.multiplayerClient) {
            this.multiplayerClient.signalReady();
        }
    } // End create()

    startGame(): void {
        logger.info('[GameScene] startGame: Sending ready message to server.');
        if (this.multiplayerClient) {
            this.multiplayerClient.send({ type: 'ready' });
        }
        // Server will now handle game start, wave spawning etc.
        // Client just waits for state updates.
        // Reset local prediction timer
        this.localPlayerLastShotTime = 0;
    }

    update(time: number, delta: number): void {
        // --- Update Managers ---
        // Managers handle interpolation and effects based on latest state
        this.clientPlayerManager.update(time, delta);
        this.clientEnemyManager.update(time, delta);
        this.clientBulletManager.update(time, delta);

        // --- Handle Local Input & Send to Server ---
        const currentState = this.clientStateManager.getCurrentState();
        const localPlayerServerState = currentState && this.localPlayerId ? currentState.players[this.localPlayerId] : null;

        if (this.inputManager && this.localPlayerId && localPlayerServerState && localPlayerServerState.isActive) {
            const cursors = this.inputManager.getCursorKeys();
            const isFireDown = this.inputManager.isFireDown();

            const inputState = {
                left: cursors.left?.isDown || false,
                right: cursors.right?.isDown || false,
                up: cursors.up?.isDown || false,
                down: cursors.down?.isDown || false,
                fire: isFireDown
            };

            let newBulletInfo: { id: string; x: number; y: number; velocityY: number } | undefined = undefined;

            // Handle firing prediction
            if (isFireDown) {
                const now = time; // Use Phaser time
                const shotInterval = 300; // TODO: Use shared constant
                if (!this.localPlayerLastShotTime || now - this.localPlayerLastShotTime > shotInterval) {
                    const localPlayerSprite = this.clientPlayerManager.getPlayerSprite(this.localPlayerId);
                    if (localPlayerSprite) {
                        const bulletId = `${this.localPlayerId}-${now}`; // Simple local ID
                        const bulletX = localPlayerSprite.x;
                        const bulletY = localPlayerSprite.y - 20; // Offset
                        const bulletVelocityY = -PLAYER_BULLET_SPEED; // Use shared constant
                        newBulletInfo = { id: bulletId, x: bulletX, y: bulletY, velocityY: bulletVelocityY };

                        // Ask ClientBulletManager to create the predicted sprite
                        this.clientBulletManager.createLocalPredictedBullet(bulletId, bulletX, bulletY, bulletVelocityY);
                        this.localPlayerLastShotTime = now;
                    }
                }
            }

            // Send movement and potential firing input
            if (this.multiplayerClient) {
                this.multiplayerClient.sendInput({ ...inputState }); // Removed newBullet info
            }

            // Invincibility toggle request is handled by the callback passed to InputManager

        } else {
            // Player is inactive or not yet initialized, don't send input
        }

        // --- Cleanup (Optional Client-Side) ---
        // Managers could potentially handle their own out-of-bounds cleanup
        // for visual smoothness, but server state is the authority.
    } // End update()

    // Removed createLocalPredictedBullet - now handled within ClientBulletManager
}
