import {
    PlayerId,
    PlayerState,
    EnemyState,
    BulletState,
    AuthoritativeState,
    GameStateEnum,
    EntityId // Added EntityId for bullet map keys
} from '@shared/types'; // Use path mapping alias
// Replaced placeholder EnemyWaveManagerCore with actual import
import { EnemyWaveManagerCore } from '@shared/EnemyWaveManagerCore';

// Removed placeholder class


export class GameStateManager {
    // Using Maps for efficient addition/removal/lookup by ID
    private players: Map<PlayerId, PlayerState> = new Map();
    private playerBullets: Map<EntityId, BulletState> = new Map(); // Use EntityId
    private enemyBullets: Map<EntityId, BulletState> = new Map(); // Use EntityId
    private gameState: GameStateEnum = GameStateEnum.Playing; // Use imported enum value

    // Assuming EnemyWaveManagerCore manages enemy state and wave number internally
    private enemyWaveManager: EnemyWaveManagerCore;

    constructor(enemyWaveManager: EnemyWaveManagerCore) {
        this.enemyWaveManager = enemyWaveManager;
    }

    // --- Player State ---
    addPlayer(player: PlayerState): void {
        this.players.set(player.id, player);
    }

    removePlayer(playerId: PlayerId): void {
        this.players.delete(playerId);
    }

    getPlayer(playerId: PlayerId): PlayerState | undefined {
        return this.players.get(playerId);
    }

    getAllPlayers(): PlayerState[] {
        return Array.from(this.players.values());
    }

    updatePlayer(playerId: PlayerId, updates: Partial<PlayerState>): void {
        const player = this.players.get(playerId);
        if (player) {
            Object.assign(player, updates);
        }
    }

    // --- Bullet State ---
    addPlayerBullet(bullet: BulletState): void {
        this.playerBullets.set(bullet.id, bullet);
    }

    removePlayerBullet(bulletId: EntityId): void { // Use EntityId
        this.playerBullets.delete(bulletId);
    }

    getAllPlayerBullets(): BulletState[] {
        return Array.from(this.playerBullets.values());
    }

    addEnemyBullet(bullet: BulletState): void {
        this.enemyBullets.set(bullet.id, bullet);
    }

    removeEnemyBullet(bulletId: EntityId): void { // Use EntityId
        this.enemyBullets.delete(bulletId);
    }

    getAllEnemyBullets(): BulletState[] {
        return Array.from(this.enemyBullets.values());
    }

    // --- Enemy State (via EnemyWaveManagerCore) ---
    getAllEnemies(): EnemyState[] {
        return this.enemyWaveManager.getEnemies();
    }

    // --- Game State ---
    setGameState(state: GameStateEnum): void {
        this.gameState = state;
    }

    getGameState(): GameStateEnum {
        return this.gameState;
    }

    getWaveNumber(): number {
        return this.enemyWaveManager.getWaveNumber();
    }

    // --- Serialization ---
    getAuthoritativeState(): AuthoritativeState { // Use imported type
        // TODO: Implement serialization logic based on the final AuthoritativeState interface
        return {
            players: Object.fromEntries(this.players), // Convert Map to object for JSON
            playerBullets: Array.from(this.playerBullets.values()),
            enemyBullets: Array.from(this.enemyBullets.values()),
            enemies: this.getAllEnemies(),
            waveNumber: this.getWaveNumber(),
            gameState: this.gameState, // Directly use the enum value
        };
    }

    resetState(): void {
        this.players.clear();
        this.playerBullets.clear();
        this.enemyBullets.clear();
        this.gameState = GameStateEnum.Playing;
        // Note: EnemyWaveManagerCore reset (like starting wave 1) should be handled externally
        // by the logic that calls this reset (e.g., in GameServer or GameLoop).
    }
}