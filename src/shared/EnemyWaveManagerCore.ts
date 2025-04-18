import { logger } from './logger'; // Import the shared logger

/**
 * EnemyWaveManagerCore
 * Pure logic for enemy wave management, shared by client and server.
 * No dependencies on Phaser or browser APIs.
 */

export type EnemyType = 1 | 2;

export interface EnemyState {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  active: boolean;
  visible: boolean;
  startY: number; // Store initial Y position for reset
  // Add more properties as needed (e.g., health, speed)
}

export class EnemyWaveManagerCore {
  private enemies: EnemyState[] = [];
  private waveNumber: number = 0;
  private nextEnemyId: number = 1;

  constructor() {}

  public startWave(waveNumber: number) {
    this.waveNumber = waveNumber;
    this.enemies = [];
    // Spawn a grid of enemies (classic logic)
    const rows = 3;
    const cols = 7;
    const offsetX = 362; // Centered between HUD (Usable: 984px, Grid Visual: 340px -> (984-340)/2 + 20(half enemy) + 20(HUD margin))
    const offsetY = 160;
    const spacingX = 50;
    const spacingY = 40;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = offsetX + col * spacingX;
        const y = offsetY + row * spacingY;
        // 30% chance for type 2 (Falcon), 70% for type 1 (default)
        let enemyType: EnemyType;
        if (Math.random() < 0.3) {
          enemyType = 2;
        } else {
          enemyType = 1;
        }
        this.enemies.push({
          id: `enemy_${this.nextEnemyId++}`,
          type: enemyType,
          x,
          y,
          startY: y, // Store initial Y
          active: true,
          visible: true,
        });
      }
    }
  }

  public update(delta: number, gameHeight: number) { // Added gameHeight parameter
    // Example: move enemies down the screen
    for (const enemy of this.enemies) {
      if (enemy.active) {
        enemy.y += 20 * (delta / 1000); // Move at 20px/sec
        // Update visibility based on viewport (y between 0 and 600)
        enemy.visible = enemy.y >= 0 && enemy.y <= gameHeight; // Use gameHeight
      } else {
        enemy.visible = false;
      }
    }
} // End update method



  public getEnemies(): EnemyState[] {
    return this.enemies;
  }

  public getWaveNumber(): number {
    return this.waveNumber;
  }

  /**
   * Mark an enemy as destroyed/inactive by its id.
   * Sets active and visible to false.
   */
  public destroyEnemyById(id: string): void {
    const enemy = this.enemies.find(e => e.id === id);
    if (enemy) {
      enemy.active = false;
      enemy.visible = false;
    }
  }
/**
 * Resets the vertical position of all currently active enemies to their original starting Y.
 */
public resetActiveEnemyPositions(): void {
  logger.info(`[EnemyWaveManagerCore] Resetting active enemy positions to their startY.`); // Use logger.info
  for (const enemy of this.enemies) {
    if (enemy.active) {
      // Check if startY exists before assigning, though it always should after startWave
      if (typeof enemy.startY === 'number') {
          enemy.y = enemy.startY;
      } else {
          // Fallback or warning if startY is missing for some reason
          logger.warn(`[EnemyWaveManagerCore] Enemy ${enemy.id} missing startY during reset. Resetting to 0.`); // Use logger.warn
          enemy.y = 0;
      }
      // Ensure they are marked as visible again if they went off-screen or were reset from bottom
      enemy.visible = true;
    }
  }
}

// Add more methods as needed (e.g., handle enemy death, wave progression)
}