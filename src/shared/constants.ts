/**
 * Shared constants for client and server.
 */

// Game Dimensions
export const GAME_WIDTH = 1024;
export const GAME_HEIGHT = 768;

// Player Constants
export const PLAYER_SPEED = 250; // Adjusted from placeholder
export const PLAYER_FIRE_COOLDOWN = 300; // ms
export const PLAYER_INITIAL_LIVES = 3;
export const PLAYER_ENEMY_COLLISION_COOLDOWN = 500; // ms (From docs)

// Enemy Constants
export const ENEMY_NORMAL_SPEED = 40; // Placeholder, adjust as needed
export const ENEMY_FALCON_SPEED = 40; // Placeholder, adjust as needed (Same vertical speed?)
export const ENEMY_SHOOT_INTERVAL_NORMAL = 1500; // ms (Approx, from docs)
export const ENEMY_SHOOT_INTERVAL_FALCON = 3000; // ms (Approx, from docs)
export const ENEMY_TYPE_SHOOT_COOLDOWN = 1000; // ms (1 shot per type per second, from docs)

// Bullet Constants
export const PLAYER_BULLET_SPEED = 400;
export const ENEMY_BULLET_SPEED = 200;
export const FALCON_BULLET_SPEED = 300; // Faster enemy bullet

// Collision Dimensions (Used for AABB checks, assuming origin is center)
export const PLAYER_COLLISION_WIDTH = 40;
export const PLAYER_COLLISION_HEIGHT = 40;
// export const ENEMY_COLLISION_WIDTH = 40; // Replaced by type-specific below
// export const ENEMY_COLLISION_HEIGHT = 40; // Replaced by type-specific below
export const NORMAL_ENEMY_COLLISION_WIDTH = 20; // Based on 0.25 scale relative to Falcon's 40
export const NORMAL_ENEMY_COLLISION_HEIGHT = 20; // Based on 0.25 scale relative to Falcon's 40
export const FALCON_ENEMY_COLLISION_WIDTH = 40; // Assumed base for previous constant
export const FALCON_ENEMY_COLLISION_HEIGHT = 40; // Assumed base for previous constant
export const BULLET_COLLISION_WIDTH = 8;
export const BULLET_COLLISION_HEIGHT = 16;

// Network
export const SERVER_PORT = 8080;
export const SERVER_TICK_RATE = 1000 / 60; // ~60Hz

// Add other constants as needed