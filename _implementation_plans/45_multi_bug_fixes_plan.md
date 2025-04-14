# Plan: Multiple Bug Fixes (Post-Refactor)

This plan addresses several reported issues: duplicate frozen bullets, incorrect enemy hitboxes, inconsistent enemy explosions/removal, and missing player hit animations.

## 1. Duplicate Frozen Bullet (Client-Side Prediction/Reconciliation)

*   **Root Cause:** Likely failure in `ClientBulletManager.ts`'s `addOrUpdatePlayerBullet` reconciliation logic, where the predicted bullet sprite (using `localId`) isn't correctly matched with the incoming server bullet state (using `id`), leaving the predicted sprite orphaned. The FIFO queue (`predictedBulletIds`) might be insufficient under certain network conditions or rapid firing.
*   **Plan:**
    1.  **(Implement)** Add robust logging within `ClientBulletManager.ts` (`addOrUpdatePlayerBullet` and `removePlayerBullet`) to trace the prediction queue, reconciliation attempts, successes, failures, and removals (both server ID and local ID).
    2.  **(Implement)** Implement a cleanup mechanism in `ClientBulletManager.ts`'s `update` method. Periodically iterate through `this.playerBullets`. If a bullet's ID matches the temporary `localId` format (e.g., "playerId-timestamp") and it's older than a threshold (e.g., 1-2 seconds), destroy it and remove it from the map. This catches orphaned predictions.
    3.  **(Test & Iterate)** Test rapid firing and simulate network latency (if possible) to see if the logging reveals specific failure patterns and if the cleanup mechanism works. If issues persist, consider more complex matching logic (less preferable due to complexity).

## 2. Incorrect Enemy Hitboxes (Server vs. Client Scaling)

*   **Root Cause:** `server/src/CollisionSystem.ts` uses single, fixed collision dimensions (`ENEMY_COLLISION_WIDTH`, `ENEMY_COLLISION_HEIGHT`) for all enemy types, ignoring client-side scaling differences (Normal: 0.25, Falcon: 0.5).
*   **Plan:**
    1.  **(Implement)** Define type-specific collision constants in `src/shared/constants.ts` (e.g., `NORMAL_ENEMY_COLLISION_WIDTH`, `FALCON_ENEMY_COLLISION_WIDTH`, etc.). Determine appropriate values based on the original asset size and the client-side scaling factors.
    2.  **(Implement)** Modify `server/src/CollisionSystem.ts`: In the loops involving enemies (`playerBullets.forEach` and `players.forEach`), check `enemy.type`. Use an `if/else` or `switch` statement to pass the correct type-specific collision constants (`NORMAL_ENEMY_...` or `FALCON_ENEMY_...`) to the `checkAABBCollision` function.

## 3. Missing/Incorrect Enemy Explosion/Removal (Server State vs. Client Effect)

*   **Root Cause:** Explosion effect (`showExplosion`) is triggered by client-side physics overlap (`ClientCollisionEffectsManager`), which is independent of the server's authoritative state change (`active: false`). Sprite removal relies on `ClientStateManager` processing the state update, which might happen before/after the visual effect, or fail.
*   **Plan:**
    1.  **(Implement)** Modify `src/managers/ClientEnemyManager.ts`:
        *   In the `updateEnemy` method, detect when the incoming `enemyData.active` is `false` but the *previous* state (which needs to be tracked briefly, perhaps within the `Enemy` class instance or the manager) was `true`.
        *   When this specific transition (`true` -> `false`) is detected, call the `showExplosion` function (imported from `src/effects/effects.ts`) at the enemy's current position *before* proceeding with hiding or preparing to remove the sprite.
    2.  **(Implement)** Modify `src/managers/ClientEnemyManager.ts`'s `removeEnemy` method: Ensure it reliably destroys the Phaser sprite associated with the enemy ID. Add logging to confirm destruction.
    3.  **(Modify/Disable)** Consider disabling or modifying the explosion trigger within `src/managers/ClientCollisionEffectsManager.ts`'s `handleBulletEnemyCollision` to prevent double explosions, now that the effect is tied to the state change.

## 4. Missing Player Hit Animations (Implementation/Trigger)

*   **Root Cause:** No specific "hit" animation logic seems to be implemented or triggered, only the invincibility effect. Player state changes (like `lives` decrement) aren't explicitly used to trigger a distinct visual hit feedback.
*   **Plan:**
    1.  **(Implement)** Modify `src/managers/ClientPlayerManager.ts`:
        *   In the `updatePlayer` method, store or compare the incoming `playerData.lives` with the previously known lives for that player.
        *   If `playerData.lives` has decreased *and* the player is *not* currently invincible (to avoid triggering on invincibility ending), call a new method on the corresponding `Player` sprite instance (e.g., `playerSprite.playHitAnimation()`).
    2.  **(Implement)** Modify `src/player/Player.ts`:
        *   Add a `playHitAnimation` method.
        *   Inside this method, implement a short visual effect, like a brief red tint flash (`this.sprite.setTint(0xff0000)`) followed by a delayed call or tween to clear the tint (`this.sprite.clearTint()`), ensuring it doesn't interfere with the invincibility pulse effect.

## Summary Diagram (Illustrating Key Interaction Changes)

```mermaid
sequenceDiagram
    participant Client_Input
    participant Client_GameScene
    participant Client_CBM as ClientBulletManager
    participant Client_CEM as ClientEnemyManager
    participant Client_CPM as ClientPlayerManager
    participant Client_CSM as ClientStateManager
    participant Client_Player as PlayerSprite
    participant Client_Effects as effects.ts
    participant Server_PM as PlayerManager
    participant Server_BM as BulletManager
    participant Server_CS as CollisionSystem
    participant Server_EWM as EnemyWaveManagerCore
    participant Server_GSM as GameStateManager

    %% Issue 1: Duplicate Bullet Fix (Conceptual)
    Client_Input->>Client_GameScene: Fire Input
    Client_GameScene->>Client_CBM: createLocalPredictedBullet(localId)
    Client_GameScene->>Server_PM: Send fire input
    Server_PM->>Server_BM: createPlayerBullet(id)
    Server_BM->>Server_GSM: Add bullet state(id)
    Server_GSM-->>Client_CSM: authoritative_state (with bullet id)
    Client_CSM->>Client_CBM: addOrUpdatePlayerBullet(id, state)
    Note over Client_CBM: Reconciliation logic attempts match\nIf fails, new sprite created
    Client_CBM->>Client_CBM: update(): Periodically check & remove\n orphaned predicted bullets (localId)

    %% Issue 2: Hitbox Fix
    Server_CS->>Server_CS: update(): Check enemy.type
    Server_CS->>Server_CS: checkAABBCollision(..., typeSpecificWidth, typeSpecificHeight)

    %% Issue 3: Explosion Fix
    Server_CS->>Server_EWM: destroyEnemyById(enemyId)
    Server_EWM->>Server_GSM: Set enemy.active = false
    Server_GSM-->>Client_CSM: authoritative_state (enemy active:false)
    Client_CSM->>Client_CEM: updateEnemy(id, state{active:false})
    Client_CEM->>Client_CEM: Detects active: true -> false transition
    Client_CEM->>Client_Effects: showExplosion(enemy.x, enemy.y)
    Client_CEM->>Client_CEM: Remove/hide enemy sprite

    %% Issue 4: Player Hit Animation Fix
    Server_CS->>Server_PM: handlePlayerHit...() / handlePlayerEnemyCollision()
    Server_PM->>Server_GSM: Update player state (lives--, isInvincible?)
    Server_GSM-->>Client_CSM: authoritative_state (player lives decreased)
    Client_CSM->>Client_CPM: updatePlayer(id, state{lives decreased})
    Client_CPM->>Client_CPM: Detects lives decrease (and not invincible)
    Client_CPM->>Client_Player: playHitAnimation()
    Client_Player->>Client_Player: Apply brief visual effect (e.g., tint flash)