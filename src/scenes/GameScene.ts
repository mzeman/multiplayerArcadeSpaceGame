import Phaser from 'phaser';
import { Player } from '../player/Player';
import { NormalEnemy } from '../enemies/NormalEnemy';
import { FalconEnemy } from '../enemies/FalconEnemy';
import { showExplosion } from '../effects/effects';
import { GameOverUI } from '../ui/GameOverUI';
import { GameHUD } from '../ui/GameHUD';
import { InputManager } from '../managers/InputManager';
import { EnemyWaveManager } from '../managers/EnemyWaveManager';
import { CollisionManager } from '../managers/CollisionManager';
import { MultiplayerClient } from '../network/MultiplayerClient';

// Define expected structure for bullet state from server
interface ServerBulletState {
  id: string;
  x: number;
  y: number;
  velocityY: number;
  ownerId?: string;
}

export class GameScene extends Phaser.Scene {
  players: { [id: string]: Player } = {};
  multiplayerClient!: MultiplayerClient;
  localPlayerId: string | null = null;
  isMainPlayer: boolean = false; // Server is authoritative, this might be less relevant
  stateSendTimer: NodeJS.Timeout | null = null;
  authoritativeState: any = null;
  waveNumber: number = 0;
  enemiesById: { [id: string]: Phaser.GameObjects.Sprite } = {};
  playersGroup!: Phaser.Physics.Arcade.Group;
  enemies!: Phaser.Physics.Arcade.Group;
  bullets!: Phaser.Physics.Arcade.Group; // Group for rendering ALL player bullets
  enemyBullets!: Phaser.Physics.Arcade.Group; // Now reconciled with server
  private localEnemyBullets: Map<string, Phaser.Physics.Arcade.Sprite> = new Map(); // Tracks enemy bullets by ID
  falconBullets!: Phaser.GameObjects.Group; // TODO: Needs reconciliation
  private _lastUpdateLog?: number;
  private localPlayerLastShotTime: number = 0;
  private localBullets: Map<string, Phaser.Physics.Arcade.Sprite> = new Map(); // Tracks client-side bullets by ID
  private localPlayerInvincibleTween: Phaser.Tweens.Tween | null = null; // Tween for invincibility effect
  private previousInvincibleKeyState: boolean = false; // Track previous state of the invincibility key/flag
  private serverGameState: string = 'playing'; // Track overall game state from server
  private localPlayerIsActive: boolean = true; // Track if the local player is active (lives > 0)
  private waitingText: Phaser.GameObjects.Text | null = null; // Text shown when local player is defeated but game continues
  private _isFirstStateReceived: boolean = true; // Flag for initial state debugging

  // Managers/Components
  inputManager!: InputManager;
  enemyWaveManager!: EnemyWaveManager;
  collisionManager!: CollisionManager;
  gameHUD!: GameHUD;
  gameOverUI!: GameOverUI;

  private isGameOver: boolean = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    console.log('[GameScene] preload started');
    this.load.image('enemyShip', 'assets/enemy_ship.svg');
    this.load.image('enemy_falcon', 'assets/enemy_falcon.svg');
    this.load.image('playerShip', 'assets/player_ship.svg');
    this.load.image('bullet', 'assets/bullet.svg');
    console.log('[GameScene] preload finished');
  }

  create(): void {
      console.log('[GameScene] create started');
      this.enemies = this.physics.add.group();
      this.bullets = this.physics.add.group();
      this.enemyBullets = this.physics.add.group();
      this.playersGroup = this.physics.add.group();
      this.falconBullets = this.add.group();

      this.cameras.main.setBackgroundColor('#000');

      this.inputManager = new InputManager(this);
      this.inputManager.create();
      this.gameHUD = new GameHUD(this);
      this.gameOverUI = new GameOverUI(this);

      // Initialize waiting text (hidden initially)
      this.waitingText = this.add.text(
        this.cameras.main.centerX,
        this.cameras.main.centerY,
        'Game is still in progress...\nWaiting for other players.',
        { fontSize: '28px', color: '#ffffff', align: 'center', backgroundColor: 'rgba(0,0,0,0.7)', padding: { x: 20, y: 10 } }
      ).setOrigin(0.5).setDepth(1001).setVisible(false);

      console.log('[GameScene] Connecting to multiplayer server...');
      this.players = {};
      this.multiplayerClient = new MultiplayerClient('ws://localhost:3001', {
        onWelcome: (msg: any) => {
          console.log('[GameScene] onWelcome', msg);
          this.localPlayerId = msg.id;
          this.startGame();
        },
        onGameState: (state: any) => {
          console.log('[GameScene] onGameState (potentially deprecated)', state);
        },
        onMainPlayer: () => {
          console.log('[GameScene] onMainPlayer (potentially deprecated)');
          this.isMainPlayer = true;
          if (this.stateSendTimer) clearInterval(this.stateSendTimer);
          this.stateSendTimer = null;
        },
        onAuthoritativeState: (msg: any) => {
          this.isMainPlayer = false;
          this.authoritativeState = msg;
          if (this.stateSendTimer) { clearInterval(this.stateSendTimer); this.stateSendTimer = null; }
          if (msg.waveNumber !== undefined) this.waveNumber = msg.waveNumber;
          const previousServerGameState = this.serverGameState; // Store previous state
          this.serverGameState = msg.gameState || 'playing'; // Update overall game state

          const now = Date.now(); // Use system time for state updates

          // --- PLAYER SYNC (Interpolation) ---
          const isInitialSync = this._isFirstStateReceived;
          if (isInitialSync) {
            console.log('[Initial Sync Debug] First state received. Player IDs from server:', msg.players ? Object.keys(msg.players) : 'None');
            this._isFirstStateReceived = false;
          }
          if (msg.players) {
            const serverPlayerIds = new Set<string>();
            for (const id in msg.players) {
              serverPlayerIds.add(id);
              const p = msg.players[id];
              if (!this.players[id]) { // Create new player
                if (isInitialSync) {
                  console.log(`[Initial Sync Debug] Creating NEW player sprite for ID: ${id}`);
                } else {
                  // console.log(`[Sync Debug] Creating NEW player sprite for ID: ${id}`); // Optional: Log for subsequent joins too
                }
                this.players[id] = new Player(this, p.x, p.y, p.color, this.multiplayerClient);
                const player = this.players[id];
                player.lives = p.lives;
                this.playersGroup.add(player.sprite);
                player.sprite.visible = true;
                // Initialize properties for NEW player sprite
                const sprite = player.sprite as any;
                // Removed setScale(1.5) - Scaling is now handled in Player constructor
                sprite.x = p.x; // Set initial position directly
                sprite.y = p.y;
                sprite.prevX = p.x; // Initialize prev/target for interpolation
                sprite.prevY = p.y;
                sprite.targetX = p.x;
                sprite.targetY = p.y;
                sprite.lastUpdate = now;
                const logPX = typeof p.x === 'number' ? p.x.toFixed(1) : 'undef';
                const logPY = typeof p.y === 'number' ? p.y.toFixed(1) : 'undef';
                console.log(`[State] New Player ${id}: target=(${logPX}, ${logPY}), lastUpdate=${now}`);

              } else { // Update existing player target
                const sprite = this.players[id].sprite as any;
                // Update properties for EXISTING player sprite

                if (id === this.localPlayerId) {
                    // Directly set local player position from server state
                    sprite.setPosition(p.x, p.y);
                    // Also update prev/target to avoid potential issues if interpolation were re-enabled
                    (sprite as any).prevX = p.x;
                    (sprite as any).prevY = p.y;
                    (sprite as any).targetX = p.x;
                    (sprite as any).targetY = p.y;
                    console.log(`[State] Direct Update Local Player ${id}: Received pos=(${p.x?.toFixed(1) ?? 'undef'}, ${p.y?.toFixed(1) ?? 'undef'}). Applying setPosition.`);
                } else {
                    // Update target for remote players for interpolation
                    // IMPORTANT: Update prevX/Y first based on current rendered position
                    (sprite as any).prevX = sprite.x;
                    (sprite as any).prevY = sprite.y;
                    (sprite as any).targetX = p.x; // Set new target from server
                    (sprite as any).targetY = p.y;
                    (sprite as any).lastUpdate = now; // Timestamp of when the new target was received
                    const logPrevX = typeof (sprite as any).prevX === 'number' ? (sprite as any).prevX.toFixed(1) : 'undef';
                    const logPrevY = typeof (sprite as any).prevY === 'number' ? (sprite as any).prevY.toFixed(1) : 'undef';
                    const logTargetX = typeof p.x === 'number' ? p.x.toFixed(1) : 'undef';
                    const logTargetY = typeof p.y === 'number' ? p.y.toFixed(1) : 'undef';
                    console.log(`[State] Update Remote Player ${id}: prev=(${logPrevX}, ${logPrevY}), target=(${logTargetX}, ${logTargetY}), lastUpdate=${now}`);
                }

                // Common updates for both local and remote
                this.players[id].setColor(p.color);
                this.players[id].lives = p.lives;

                // --- Start Reset Visibility Debug Logging ---
                let visibilityBeforeUpdate: boolean | undefined;
                if (previousServerGameState === 'gameOver' && this.serverGameState === 'playing') {
                    visibilityBeforeUpdate = sprite.visible; // Capture visibility before update
                }
                // --- End Reset Visibility Debug Logging ---

                this.players[id].isActive = p.isActive; // Update player active status
                // Set visibility for ALL players based on server state
                sprite.visible = p.isActive;

                // Update local player active status tracker
                if (id === this.localPlayerId) {
                  const previousLocalActiveState = this.localPlayerIsActive; // Store previous
                  this.localPlayerIsActive = p.isActive;
                  // Add logging here if state changed from gameOver to playing
                  if (previousServerGameState === 'gameOver' && this.serverGameState === 'playing') {
                      // --- Start Reset Visibility Debug Logging ---
                      console.groupCollapsed(`[Reset Visibility Debug] Local Player ID: ${this.localPlayerId}`);
                      console.log(`Server State for Player:`, p); // Log the received player state
                      console.log(`Sprite Visibility BEFORE update: ${visibilityBeforeUpdate}`);
                      console.log(`Sprite Visibility AFTER update: ${sprite.visible}`);
                      console.groupEnd();
                      // --- End Reset Visibility Debug Logging ---
                      // Original log:
                      console.log(`[Reset Debug Client] Game state changed to 'playing'. Received isActive: ${p.isActive}. Updated localPlayerIsActive from ${previousLocalActiveState} to ${this.localPlayerIsActive}.`);
                  }
                }

                // Handle Invincibility Visual Effect for Local Player
                if (id === this.localPlayerId) {
                  const wasInvincible = !!this.localPlayerInvincibleTween;
                  const isNowInvincible = !!p.isInvincible; // Check the flag from server state

                  if (isNowInvincible && !wasInvincible) {
                    // Start tween
                    console.log(`[GameScene] Player ${id} starting invincibility tween.`);
                    this.localPlayerInvincibleTween = this.tweens.add({
                      targets: sprite,
                      alpha: { from: 0.5, to: 1 },
                      duration: 150,
                      ease: 'Linear',
                      repeat: -1,
                      yoyo: true
                    });
                  } else if (!isNowInvincible && wasInvincible) {
                    // Stop tween
                    console.log(`[GameScene] Player ${id} stopping invincibility tween.`);
                    this.localPlayerInvincibleTween?.stop();
                    this.localPlayerInvincibleTween = null;
                    sprite.setAlpha(1.0); // Reset alpha
                  }
                }
              }
            }
            // Remove disconnected players
            for (const id in this.players) {
              if (!serverPlayerIds.has(id)) {
                this.players[id].destroy(); delete this.players[id];
              }
            }
          }

          // --- ENEMY SYNC (Interpolation - Needs Server Authority) ---
          if (this.enemies && Array.isArray(msg.enemies)) {
            const seenEnemyIds = new Set<string>();
            console.log(`[ENEMY DEBUG] Received ${msg.enemies.length} enemies:`, msg.enemies.map((e: any) => ({x: e.x, y: e.y, type: e.type})));
            msg.enemies.forEach((enemy: any) => {
              const id = enemy.id; // Strictly use server-provided ID
              if (!id) {
                  console.warn('[ENEMY SYNC WARNING] Received enemy data without a unique ID from server. Skipping:', enemy);
                  return; // Skip processing this enemy if no ID
              }
              seenEnemyIds.add(id);
              const existingEnemySprite = this.enemiesById[id];
              if (existingEnemySprite) {
                // Update properties for EXISTING enemy sprite
                // Update prevX/Y first based on current rendered position
                (existingEnemySprite as any).prevX = existingEnemySprite.x;
                (existingEnemySprite as any).prevY = existingEnemySprite.y;
                // Now set the new target from server
                (existingEnemySprite as any).targetX = enemy.x;
                (existingEnemySprite as any).targetY = enemy.y;
                (existingEnemySprite as any).lastUpdate = now;
                const logEPrevX = typeof (existingEnemySprite as any).prevX === 'number' ? (existingEnemySprite as any).prevX.toFixed(1) : 'undef';
                const logEPrevY = typeof (existingEnemySprite as any).prevY === 'number' ? (existingEnemySprite as any).prevY.toFixed(1) : 'undef';
                const logETargetX = typeof enemy.x === 'number' ? enemy.x.toFixed(1) : 'undef';
                const logETargetY = typeof enemy.y === 'number' ? enemy.y.toFixed(1) : 'undef';
                console.log(`[State] Update Enemy ${id}: prev=(${logEPrevX}, ${logEPrevY}), target=(${logETargetX}, ${logETargetY}), lastUpdate=${now}`);
                existingEnemySprite.active = enemy.active;
                existingEnemySprite.visible = enemy.visible; // Ensure visibility is updated from server
              } else {
                 // Remove instantiation of Enemy subclasses - they create duplicate sprites
                 // let enemyInstance;
                 // if (enemy.type === 1) enemyInstance = new NormalEnemy(this, enemy.x, enemy.y);
                 // else if (enemy.type === 2) enemyInstance = new FalconEnemy(this, enemy.x, enemy.y);
                 // if (enemyInstance) { // Always create the sprite based on server data
                     const assetKey = enemy.type === 1 ? 'enemyShip' : 'enemy_falcon';
                     const sprite = this.enemies.create(enemy.x, enemy.y, assetKey) as any;
                     sprite.setDisplaySize(40, 40); // Set display size explicitly
                     // sprite.__enemyInstance = enemyInstance; // No longer needed
                     sprite.setData('enemyId', id); // Store server ID in sprite data
                     sprite.setData('enemyType', enemy.type); // Store type if needed elsewhere
                     sprite.active = enemy.active; sprite.visible = enemy.visible;
                     // Initialize properties for NEW enemy sprite
                     (sprite as any).x = enemy.x; // Set initial position directly
                     (sprite as any).y = enemy.y;
                     (sprite as any).prevX = enemy.x; // Initialize prev/target for interpolation
                     (sprite as any).prevY = enemy.y;
                     (sprite as any).targetX = enemy.x;
                     (sprite as any).targetY = enemy.y;
                     (sprite as any).lastUpdate = now;
                     const logNewEX = typeof enemy.x === 'number' ? enemy.x.toFixed(1) : 'undef';
                     const logNewEY = typeof enemy.y === 'number' ? enemy.y.toFixed(1) : 'undef';
                     console.log(`[State] New Enemy Sprite ${id} (Server ID): type=${enemy.type}, target=(${logNewEX}, ${logNewEY}), lastUpdate=${now}`);
                     this.enemiesById[id] = sprite;
                 // } // End of removed if(enemyInstance) block
              }
            });
            for (const id in this.enemiesById) {
              if (!seenEnemyIds.has(id)) {
                this.enemiesById[id].destroy(); delete this.enemiesById[id];
              }
            }
          }

          // --- Player Bullet Reconciliation (ID-Based) ---
          if (Array.isArray(msg.playerBullets) && this.bullets) {
            const serverBulletStates: ServerBulletState[] = msg.playerBullets;
            const serverBulletIds = new Set(serverBulletStates.map((b: ServerBulletState) => b.id));
            const correctionFactor = 0.1; // Tunable

            // 1. Update/Create bullets based on server state
            serverBulletStates.forEach((serverBullet: ServerBulletState) => {
              const localBullet = this.localBullets.get(serverBullet.id);
              if (localBullet) { // Bullet exists locally
                if (localBullet.active) {
                   localBullet.x += (serverBullet.x - localBullet.x) * correctionFactor;
                   localBullet.y += (serverBullet.y - localBullet.y) * correctionFactor;
                   if(localBullet.body) (localBullet.body as Phaser.Physics.Arcade.Body).setVelocityY(serverBullet.velocityY);
                   localBullet.setData('isPredicted', false);
                   localBullet.setData('ownerId', serverBullet.ownerId);
                }
              } else { // Bullet is new
                const newBullet = this.bullets.create(serverBullet.x, serverBullet.y, 'bullet') as Phaser.Physics.Arcade.Sprite;
                if (newBullet && newBullet.body) {
                  newBullet.setData('bulletId', serverBullet.id);
                  newBullet.setData('isPredicted', false);
                  newBullet.setData('ownerId', serverBullet.ownerId);
                  (newBullet.body as Phaser.Physics.Arcade.Body).setVelocityY(serverBullet.velocityY);
                  newBullet.active = true;
                  newBullet.visible = true;
                  this.localBullets.set(serverBullet.id, newBullet);
                } else {
                   console.warn(`[GameScene] Failed to create server bullet sprite: ${serverBullet.id}`);
                }
              }
            });

            // 2. Remove local bullets no longer present on server
            this.localBullets.forEach((localBullet: Phaser.Physics.Arcade.Sprite, localId: string) => {
              if (!serverBulletIds.has(localId)) {
                localBullet.destroy();
                this.localBullets.delete(localId);
              }
            });
          }
          // --- End Player Bullet Reconciliation ---
// --- Enemy Bullet Reconciliation (ID-Based) ---
if (Array.isArray(msg.enemyBullets) && this.enemyBullets) {
  const serverEnemyBulletStates = msg.enemyBullets;
  const serverEnemyBulletIds = new Set(serverEnemyBulletStates.map((b: any) => b.id));
  const correctionFactor = 0.1; // Tunable

  // 1. Update/Create bullets based on server state
  serverEnemyBulletStates.forEach((serverBullet: any) => {
    const localBullet = this.localEnemyBullets.get(serverBullet.id);
    if (localBullet) {
      if (localBullet.active) {
        localBullet.x += (serverBullet.x - localBullet.x) * correctionFactor;
        localBullet.y += (serverBullet.y - localBullet.y) * correctionFactor;
        // Update velocity for enemy bullets, including horizontal for Falcons
        if (localBullet.body) {
            (localBullet.body as Phaser.Physics.Arcade.Body).setVelocity(serverBullet.velocityX || 0, serverBullet.velocityY);
        }
        localBullet.active = true;
        localBullet.visible = true;

        // Apply tint based on bulletType
        if (serverBullet.bulletType === 'falcon') {
          localBullet.setTint(0xffa500); // Orange tint
        } else {
          localBullet.clearTint(); // Default appearance
        }
      }
    } else {
      const newBullet = this.enemyBullets.create(serverBullet.x, serverBullet.y, 'bullet') as Phaser.Physics.Arcade.Sprite;
      if (newBullet) { // Check if sprite was created
        // Ensure physics body is enabled and sized correctly
        this.physics.world.enable(newBullet); // Explicitly enable physics
        const body = newBullet.body as Phaser.Physics.Arcade.Body;
        if (body) {
            newBullet.setData('bulletId', serverBullet.id);
            // Set velocity for new enemy bullets, including horizontal for Falcons
            body.setVelocity(serverBullet.velocityX || 0, serverBullet.velocityY);
            // Explicitly set body size
            body.setSize(8, 16); // Match server BULLET_WIDTH, BULLET_HEIGHT
            body.enable = true; // Ensure body is enabled
            newBullet.active = true;
            newBullet.visible = true;
            this.localEnemyBullets.set(serverBullet.id, newBullet);
        } else {
             console.warn(`[GameScene] Failed to get physics body for new enemy bullet: ${serverBullet.id}`);
             newBullet.destroy(); // Clean up sprite if body failed
        }

        // Apply tint based on bulletType for new bullets
        if (serverBullet.bulletType === 'falcon') {
          newBullet.setTint(0xffa500); // Orange tint
        } else {
          newBullet.clearTint(); // Default appearance
        }
      } else {
        console.warn(`[GameScene] Failed to create server enemy bullet sprite: ${serverBullet.id}`);
      }
    }
  });

  // 2. Remove local bullets no longer present on server
  this.localEnemyBullets.forEach((localBullet: Phaser.Physics.Arcade.Sprite, localId: string) => {
    if (!serverEnemyBulletIds.has(localId)) {
      localBullet.destroy();
      this.localEnemyBullets.delete(localId);
    }
  });
}
// --- End Enemy Bullet Reconciliation ---

  // Log UI state decisions based on the updated flags before applying them
  if (previousServerGameState === 'gameOver' && this.serverGameState === 'playing') {
       console.log(`[Reset Debug Client UI] Post-reset check: localPlayerIsActive=${this.localPlayerIsActive}, serverGameState=${this.serverGameState}. Waiting text visible: ${!this.localPlayerIsActive && this.serverGameState === 'playing'}`);
  }

  // --- Handle Waiting Text and Game Over UI ---
  // Player sprite visibility is now handled directly within the player update loop (line ~195) based on server's isActive flag.
  this.waitingText?.setVisible(!this.localPlayerIsActive && this.serverGameState === 'playing'); // Show waiting text if local player inactive but game ongoing

  if (this.serverGameState === 'gameOver' && this.gameOverUI) {
      if (!this.gameOverUI.isVisible()) { // Only show if not already visible
          this.gameOverUI.show(() => {
              if (this.multiplayerClient) {
                  this.multiplayerClient.send({ type: 'requestRestart' });
              }
              this.isGameOver = false; // Reset local flag (though server state is king)
              this.waitingText?.setVisible(false); // Ensure waiting text is hidden on restart request
          });
      }
  } else if (this.gameOverUI) {
      this.gameOverUI.hide(); // Hide if game state is not 'gameOver'
  }


  // --- HUD Initialization and Updates ---
  if (this.gameHUD) {
    // Find the local player in the authoritative state
    let currentPlayer = null;
    if (this.localPlayerId && msg.players && msg.players[this.localPlayerId]) {
      currentPlayer = msg.players[this.localPlayerId];
    }
    // Initialize HUD if not already created
    if (currentPlayer && (!this.gameHUD._created || typeof this.gameHUD._created === "undefined")) {
      this.gameHUD.create(currentPlayer.lives, msg.waveNumber);
      this.gameHUD._created = true;
    }
    // Always update HUD with latest values
    if (currentPlayer) {
      this.gameHUD.updateLives(currentPlayer.lives);
    }
    if (typeof msg.waveNumber !== "undefined") {
      this.gameHUD.updateWave(msg.waveNumber);
    }
  }
 } // End onAuthoritativeState
      }); // End multiplayerClient constructor call
      console.log('[GameScene] create finished');
  } // End create()

  gatherAuthoritativeState(): any {
    // Only needed if acting as host/main player
    const playersState: { [id: string]: { color: string; x: number; y: number; lives: number } } = {};
    for (const id in this.players) { /* ... */ }
    const playerBulletsState: Array<{ id: string; x: number; y: number; velocityY: number; ownerId: string | null }> = [];
    this.localBullets.forEach((bullet, id) => { /* ... */ });
    return { /* ... */ };
  }

  update(time: number, delta: number): void {
    // --- Interpolate player and enemy positions ---
    const interpDuration = 30; // Closer to server tick rate (~16.67ms * 1.8)
    Object.entries(this.players).forEach(([id, player]) => {
        // Only interpolate *remote* players. Local player relies on server state updates.
        if (id !== this.localPlayerId) {
            const sprite = player.sprite as any;
            // Interpolate position if data is valid
            if (sprite && sprite.active && sprite.lastUpdate &&
                typeof sprite.prevX === 'number' && typeof sprite.prevY === 'number' &&
                typeof sprite.targetX === 'number' && typeof sprite.targetY === 'number')
            {
                const now = Date.now(); // Use Date.now() for consistency with onAuthoritativeState
                const elapsed = now - sprite.lastUpdate;
                const t = Math.min(1, elapsed / interpDuration); // Ensure t doesn't exceed 1

                sprite.x = Phaser.Math.Linear(sprite.prevX, sprite.targetX, t);
                sprite.y = Phaser.Math.Linear(sprite.prevY, sprite.targetY, t);
                // Visibility is now handled solely in onAuthoritativeState based on p.isActive

                // Optional detailed logging (uncomment if needed)
                // Add checks before logging .toFixed()
                const logPrevX = typeof sprite.prevX === 'number' ? sprite.prevX.toFixed(1) : 'undef';
                const logPrevY = typeof sprite.prevY === 'number' ? sprite.prevY.toFixed(1) : 'undef';
                const logTargetX = typeof sprite.targetX === 'number' ? sprite.targetX.toFixed(1) : 'undef';
                const logTargetY = typeof sprite.targetY === 'number' ? sprite.targetY.toFixed(1) : 'undef';
                const logNewX = typeof sprite.x === 'number' ? sprite.x.toFixed(1) : 'undef';
                const logNewY = typeof sprite.y === 'number' ? sprite.y.toFixed(1) : 'undef';
                console.log(`[Interp Remote Player ${id}] Inputs: t=${typeof t === 'number' ? t.toFixed(2) : 'undef'}, elapsed=${elapsed}, prev=(${logPrevX}, ${logPrevY}), target=(${logTargetX}, ${logTargetY})`);
                // Add checks before logging .toFixed()
                console.log(`[Interp Remote Player ${id}] Result: new=(${logNewX}, ${logNewY})`);
            }
            // Removed else if block that set visibility based on sprite.active
            // Visibility is now handled solely in onAuthoritativeState based on p.isActive
        }
    });
    // Interpolate enemies using the enemiesById map
    Object.values(this.enemiesById).forEach((enemySprite: any) => {
         // Interpolate position if data is valid
         if (enemySprite && enemySprite.active && enemySprite.lastUpdate &&
             typeof enemySprite.prevX === 'number' && typeof enemySprite.prevY === 'number' &&
             typeof enemySprite.targetX === 'number' && typeof enemySprite.targetY === 'number')
         {
            const now = Date.now(); // Use Date.now() for consistency
            const elapsed = now - enemySprite.lastUpdate;
            const t = Math.min(1, elapsed / interpDuration); // Ensure t doesn't exceed 1

            enemySprite.x = Phaser.Math.Linear(enemySprite.prevX, enemySprite.targetX, t);
            enemySprite.y = Phaser.Math.Linear(enemySprite.prevY, enemySprite.targetY, t);
            enemySprite.visible = true; // Keep visible during interpolation

            // Optional detailed logging (uncomment if needed)
            // Add checks before logging .toFixed()
            const logEPrevX = typeof enemySprite.prevX === 'number' ? enemySprite.prevX.toFixed(1) : 'undef';
            const logEPrevY = typeof enemySprite.prevY === 'number' ? enemySprite.prevY.toFixed(1) : 'undef';
            const logETargetX = typeof enemySprite.targetX === 'number' ? enemySprite.targetX.toFixed(1) : 'undef';
            const logETargetY = typeof enemySprite.targetY === 'number' ? enemySprite.targetY.toFixed(1) : 'undef';
            const logENewX = typeof enemySprite.x === 'number' ? enemySprite.x.toFixed(1) : 'undef';
            const logENewY = typeof enemySprite.y === 'number' ? enemySprite.y.toFixed(1) : 'undef';
            // Use getData to retrieve the stored ID
            console.log(`[Interp Enemy ${enemySprite.getData('enemyId')}] Inputs: t=${typeof t === 'number' ? t.toFixed(2) : 'undef'}, elapsed=${elapsed}, prev=(${logEPrevX}, ${logEPrevY}), target=(${logETargetX}, ${logETargetY})`);

             // Add checks before logging .toFixed()
            // Use getData to retrieve the stored ID
            console.log(`[Interp Enemy ${enemySprite.getData('enemyId')}] Result: new=(${logENewX}, ${logENewY})`);
         } else if (enemySprite && !enemySprite.active) {
             enemySprite.visible = false; // Hide inactive sprites
        }
    });

    // --- Handle Local Input & Send to Server (Only if local player is active) ---
    if (this.inputManager && this.localPlayerId && this.localPlayerIsActive) {
        const cursors = this.inputManager.getCursorKeys();
        const isFireDown = this.inputManager.isFireDown();
        const localPlayer = this.players[this.localPlayerId];

        const inputState = {
            left: cursors.left?.isDown || false,
            right: cursors.right?.isDown || false,
            up: cursors.up?.isDown || false,
            down: cursors.down?.isDown || false,
            fire: isFireDown
        };

        let newBulletInfo: { id: string; x: number; y: number; velocityY: number } | undefined = undefined;

        // Handle firing prediction
        if (localPlayer && isFireDown) {
            const now = time;
            const shotInterval = 300;
            if (!this.localPlayerLastShotTime || now - this.localPlayerLastShotTime > shotInterval) {
                const bulletId = `${this.localPlayerId}-${now}`;
                const bulletX = localPlayer.sprite.x;
                const bulletY = localPlayer.sprite.y - 20;
                const bulletVelocityY = -400;
                newBulletInfo = { id: bulletId, x: bulletX, y: bulletY, velocityY: bulletVelocityY };
                this.createLocalPredictedBullet(bulletId, bulletX, bulletY, bulletVelocityY);
                this.localPlayerLastShotTime = now;
            }
        }

        // Send movement and firing input
        if (this.multiplayerClient) {
            this.multiplayerClient.sendInput({ ...inputState, newBullet: newBulletInfo });
        }

        // Check for invincibility toggle input (CTRL key)
        const currentInvincibleKeyState = this.inputManager.isInvincible();
        if (currentInvincibleKeyState && !this.previousInvincibleKeyState) {
            // State changed from false to true (CTRL was just pressed)
            console.log("[GameScene] Invincibility toggled ON locally (CTRL). Sending toggle request to server.");
            this.multiplayerClient.send({ type: 'toggleInvincible' });
        }
        // Update previous state for next frame check
        this.previousInvincibleKeyState = currentInvincibleKeyState;

    } else if (this.inputManager && this.localPlayerId && !this.localPlayerIsActive) {
        // Player is inactive, ensure input state sent to server reflects this (no movement/firing)
        // Check if we need to send a final "neutral" input state or if server handles lack of input correctly.
        // For now, we just don't send any input if inactive.
        // Also reset the invincibility key state tracker if player becomes inactive
        this.previousInvincibleKeyState = false;
    }

    // --- Local Bullet Simulation (Prediction & Server-Created) ---
    this.localBullets.forEach((bullet, id) => {
      if (bullet.active && bullet.body) {
        // Physics engine handles movement based on velocity
        const gameHeight = Number(this.sys.game.config.height);
        if (bullet.y < 0 || bullet.y > gameHeight) {
          bullet.destroy();
          this.localBullets.delete(id);
        }
      } else if (!bullet.active && this.localBullets.has(id)) {
         this.localBullets.delete(id);
      }
    });

    // --- Enemy Group Marching Movement (Removed - Server Authoritative) ---
    // if (this.enemyWaveManager && typeof this.enemyWaveManager.update === 'function') {
    //   this.enemyWaveManager.update(delta); // This runs client-side logic, conflicts with server authority
    // }

    // --- Update Enemies (Removed - Server Authoritative) ---
    // Enemy rendering is handled by interpolation based on server state.
    // Client-side update logic in Enemy.ts is also removed/commented.
    // if (this.enemies && typeof this.enemies.getChildren === 'function') {
    //   this.enemies.getChildren().forEach((enemySprite: any) => {
    //     if (enemySprite.__enemyInstance && typeof enemySprite.__enemyInstance.update === 'function') {
    //       // enemySprite.__enemyInstance.update(delta, Number(this.sys.game.config.height)); // Client-side movement removed
    //     }
    //   });
    // }

    // --- Update Falcon Bullets (Client-driven) ---
    if (this.falconBullets && typeof this.falconBullets.getChildren === 'function') {
      this.falconBullets.getChildren().forEach((bullet: any) => {
        if (bullet && bullet.active) {
          bullet.x += (bullet.vx || 0) * (delta / 1000);
          bullet.y += (bullet.vy || 0) * (delta / 1000);
          const gameHeight = Number(this.sys.game.config.height);
          const gameWidth = Number(this.sys.game.config.width);
          if (bullet.y < 0 || bullet.y > gameHeight || bullet.x < 0 || bullet.x > gameWidth) {
            bullet.destroy();
          }
        }
      });
    }

    // TODO: Collision checks
    // TODO: Wave progression

  } // End update()

  startGame(): void {
    console.log('[GameScene] startGame called');
    // Notify server that player is ready (after welcome screen)
    if (this.multiplayerClient) {
      this.multiplayerClient.send({ type: 'ready' });
    }
    this.waveNumber = 1;
    // Removed client-side wave spawning call. Server handles spawning upon receiving 'ready' message.
    // if (this.enemyWaveManager && typeof this.enemyWaveManager.spawnWave === 'function') {
    //   this.enemyWaveManager.spawnWave(this.waveNumber);
    // } else {
    //   console.warn("[GameScene] enemyWaveManager not initialized properly or spawnWave function is missing.");
    // }
    // Client only needs to update HUD based on server state for wave number
    if (this.gameHUD) {
        this.gameHUD.updateWave(this.waveNumber); // Update HUD with initial wave number (likely 1)
    }
    if (this.localPlayerId && !this.players[this.localPlayerId]) {
      this.players[this.localPlayerId] = new Player(this, 240, 550, 'blue', this.multiplayerClient);
      const player = this.players[this.localPlayerId];
      this.playersGroup.add(player.sprite);
      player.sprite.visible = true;
      this.players[this.localPlayerId].lives = 3;
    }

    const localId = this.localPlayerId;
    if (!this.enemyWaveManager && this.enemies && typeof localId === 'string' && this.players[localId] && this.gameHUD) {
      this.enemyWaveManager = new EnemyWaveManager(this, this.enemies, this.players[localId], this.gameHUD);
    }

    // Instantiate CollisionManager now that player exists
    if (typeof localId === 'string' && this.players[localId]) {
      this.collisionManager = new CollisionManager(
        this,
        this.players[localId],
        this.gameHUD,
        this.gameOverUI,
        this.inputManager,
        () => this.players[localId]?.lives ?? 0,
        (lives: number) => { if (this.players[localId]) this.players[localId].lives = lives; },
        () => this.isGameOver ?? false,
        (over: boolean) => { this.isGameOver = over; }
        // Removed the gameOverHandler argument as it's no longer needed in CollisionManager
        // () => { ... } // This was the gameOverHandler
        // Removed onEnemyDestroyed callback - server handles destruction
      );

      // --- Collision Setup Debug ---
      console.log('[Collision Debug] Setting up overlaps. Groups:', {
          enemyBullets: this.enemyBullets,
          playersGroup: this.playersGroup,
          collisionManager: this.collisionManager
      });
      console.log('[Collision Debug] Handler function:', this.collisionManager.handleEnemyBulletPlayerCollision);
      // --- End Collision Setup Debug ---
      // Set up collision handlers
      this.physics.add.overlap(this.bullets, this.enemies, this.collisionManager.handleBulletEnemyCollision as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this.collisionManager);
      this.physics.add.overlap(this.enemyBullets, this.playersGroup, this.collisionManager.handleEnemyBulletPlayerCollision as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this.collisionManager);
      this.physics.add.overlap(this.enemies, this.playersGroup, this.collisionManager.handlePlayerEnemyCollision as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this.collisionManager);

      // Falcon bullets (if used)
      if (this.falconBullets) {
        this.physics.add.overlap(this.falconBullets, this.playersGroup, this.collisionManager.handleFalconBulletPlayerCollision as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this.collisionManager);
      }
    }

    // TODO: Wave spawning should be server-driven
    // if (this.enemyWaveManager && this.isMainPlayer) { ... }

    // TODO: Sending initial state might be server's responsibility now
    // if (this.isMainPlayer) { ... }
  }

  // Helper for client-side prediction bullet creation
  createLocalPredictedBullet(id: string, x: number, y: number, velocityY: number) {
    if (!this.bullets) {
        console.warn('[GameScene] Bullets group not ready for prediction.');
        return;
    }
    const bullet = this.bullets.create(x, y, 'bullet') as Phaser.Physics.Arcade.Sprite;
    if (bullet && bullet.body) {
      bullet.setData('bulletId', id);
      bullet.setData('isPredicted', true);
      (bullet.body as Phaser.Physics.Arcade.Body).setVelocityY(velocityY);
      bullet.active = true;
      bullet.visible = true;
      this.localBullets.set(id, bullet);
      // console.log(`[DEBUG] Predicted bullet created locally: ${id}`); // Reduce noise
    } else {
      console.warn(`[GameScene] Failed to create predicted bullet sprite for ID: ${id}`);
    }
  }
}
