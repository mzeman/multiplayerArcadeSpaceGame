import Phaser from 'phaser';
import { NormalEnemy } from '../enemies/NormalEnemy';
import { FalconEnemy } from '../enemies/FalconEnemy';
import { GameHUD } from '../ui/GameHUD';
import { Player } from '../player/Player';
import { EnemyWaveManagerCore, EnemyState } from '../shared/EnemyWaveManagerCore';

export class EnemyWaveManager {
  private scene: Phaser.Scene;
  private enemies: Phaser.Physics.Arcade.Group;
  private player: Player;
  private gameHUD: GameHUD;
  private core: EnemyWaveManagerCore; // Instance of EnemyWaveManagerCore

  // No group movement logic needed; vertical movement is handled per-enemy in their update method.

  constructor(scene: Phaser.Scene, enemies: Phaser.Physics.Arcade.Group, player: Player, gameHUD: GameHUD) {
    this.scene = scene;
    this.enemies = enemies;
    this.player = player;
    this.gameHUD = gameHUD;
    this.core = new EnemyWaveManagerCore(); // Instantiate EnemyWaveManagerCore
  }

  update(delta: number) {
    this.core.update(delta); // Update enemy wave and bullets

    const enemyStates: EnemyState[] = this.core.getEnemies();
    if ((this.scene as any).socket) {
      (this.scene as any).socket.emit('updateEnemies', enemyStates); // Send enemy states to clients
    }
  }

  spawnWave(waveNumber: number) {
    // Client-side wave spawning is now disabled.
    // Enemy waves are now spawned and managed by the server.
    this.gameHUD.updateWave(waveNumber);
  }

  /**
   * Mark an enemy as destroyed/inactive by its id in the core logic.
   */
  public destroyEnemyById(id: string): void {
    this.core.destroyEnemyById(id);
  }
}