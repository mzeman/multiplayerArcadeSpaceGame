/**
 * Shared type definitions for client and server.
 */

export type PlayerId = string;
export type EntityId = string; // For bullets, enemies, etc.

export enum GameStateEnum {
    Playing = 'playing',
    GameOver = 'gameOver'
}

export interface PlayerState {
    id: PlayerId;
    color: string; // Added from GameServer logic
    x: number;
    y: number;
    lives: number;
    isActive: boolean;
    isInvincible: boolean;
    lastShotTime?: number; // Used for server-side cooldown
    // Add other fields as needed (e.g., velocityX, velocityY if needed client-side?)
    lastEnemyCollisionTime?: number; // For server-side cooldown
}

export interface EnemyState {
    id: EntityId;
    type: number; // e.g., 1 for Normal, 2 for Falcon
    x: number;
    y: number;
    active: boolean; // Whether the enemy is currently active in the wave
    visible?: boolean; // Client might use this, server calculates based on position/state
    startY?: number; // Original Y position for reset logic
    // Add other fields if needed (e.g., health if enemies take multiple hits)
}

export interface BulletState {
    id: EntityId;
    ownerId: PlayerId | 'enemy'; // Track owner
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    bulletType?: 'normal' | 'falcon'; // Distinguish enemy bullet types
}

// Structure for the main state broadcast from server to clients
export interface AuthoritativeState {
    players: { [id: PlayerId]: PlayerState }; // Use object for easy lookup by ID client-side
    playerBullets: BulletState[];
    enemyBullets: BulletState[];
    enemies: EnemyState[];
    waveNumber: number;
    gameState: GameStateEnum;
}

// --- Message Payloads ---

// Client -> Server
export interface InputPayload {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    fire: boolean;
    // seq?: number; // Optional sequence number for reconciliation
    // predictedBullet?: { localId: string, x: number, y: number, velocityY: number }; // If using prediction
}

// Server -> Client
export interface WelcomePayload {
    id: PlayerId;
    color: string;
}

// Define other message types/payloads if needed (e.g., for specific events)