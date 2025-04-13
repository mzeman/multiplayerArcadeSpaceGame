const config = {
    type: Phaser.AUTO,
    width: 480,
    height: 640,
    backgroundColor: '#000',
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: {
        preload,
        create,
        update
    }
};
let player;
let cursors;
let bullets;
let lastFired = 0;
let enemies;
let enemySpeed = 40;
let fireKey;
let lives = 3;
let livesText;
let enemyBullets;

// Per-enemy-type firing timers and intervals
let lastEnemyShotTimeType1 = 0;
let lastEnemyShotTimeType2 = 0;
let nextEnemyShotIntervalType1 = Phaser.Math.Between(200, 1000);
let nextEnemyShotIntervalType2 = Phaser.Math.Between(200, 1000);

let gameOver = false;
let gameStarted = false;

function preload() {
    this.load.image('playerShip', 'assets/player_ship.svg');
    this.load.image('enemyShip', 'assets/enemy_ship.svg');
    this.load.image('enemy_falcon', 'assets/enemy_falcon.svg');
    // Create a 1x1 white pixel texture for bullets
    this.textures.addBase64('bullet', 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAn8B9Qn1DAAAAABJRU5ErkJggg==');
}

function create() {
    // Splash screen: "Random Vibe Coding"
    this.cameras.main.setBackgroundColor('#000');
    const splashText = this.add.text(
        config.width / 2, config.height / 2,
        'Random Vibe Coding',
        { font: '36px Arial', fill: 'orange' }
    ).setOrigin(0.5);

    // (Do not pause the scene, just show splash and block game setup)

    // After 3 seconds, remove splash and start game
    this.time.delayedCall(3000, () => {
        splashText.destroy();
        this.scene.resume();
        startGame.call(this);
    });
}

// Original create() logic moved here
function startGame() {
    // Player ship as an image
    player = this.physics.add.sprite(config.width / 2, config.height - 50, 'playerShip');
    player.setCollideWorldBounds(true);
    player.setDepth(1);
    player.body.setAllowGravity(false);
    player.setDisplaySize(40, 40);

    // Bullets group
    bullets = this.physics.add.group({
        defaultKey: null,
        runChildUpdate: true
    });

    // Enemies group
    enemies = this.physics.add.group();
    createEnemyWave(this);

    // Enemy bullets group
    enemyBullets = this.physics.add.group();
    falconBullets = this.add.group(); // Non-physics group for Falcon bullets

    // Controls
    cursors = this.input.keyboard.createCursorKeys();
    fireKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Collisions
    this.physics.add.overlap(bullets, enemies, handleBulletEnemyCollision, null, this);
    this.physics.add.overlap(enemyBullets, player, handleEnemyBulletPlayerCollision, null, this);
    this.physics.add.overlap(player, enemies, handlePlayerEnemyCollision, null, this);

    // Lives display (top right)
    livesText = this.add.text(
        config.width - 20, 10,
        'Lives: ' + lives,
        { font: '20px Arial', fill: '#fff' }
    );
    livesText.setOrigin(1, 0); // right align
    gameStarted = true;
}

function handlePlayerEnemyCollision(playerObj, enemyObj) {
    // Only lose a life if at least 0.8 seconds have passed since last player-enemy collision
    const now = Date.now();
    if (!playerObj.lastEnemyCollisionTime || now - playerObj.lastEnemyCollisionTime >= 800) {
        playerObj.lastEnemyCollisionTime = now;
        // Show explosion at player position
        if (lives > 1) {
            showExplosion(player.scene, player.x, player.y, "small");
        } else if (lives === 1) {
            showExplosion(player.scene, player.x, player.y, "large");
        }
        if (lives > 0) {
            lives--;
            lives = Math.max(0, lives);
        }
        if (livesText) {
            livesText.setText('Lives: ' + Math.max(0, lives));
        }
        if (lives <= 0) {
            player.setActive(false).setVisible(false);
            player.scene.add.text(
                config.width / 2, config.height / 2,
                'Game Over',
                { font: '40px Arial', fill: '#fff' }
            ).setOrigin(0.5);
        }
    }
}
function update(time, delta) {
    if (!gameStarted) return;

    // Player movement
    if (cursors.left.isDown) {
        player.body.setVelocityX(-200);
    } else if (cursors.right.isDown) {
        player.body.setVelocityX(200);
    } else {
        player.body.setVelocityX(0);
    }

    if (cursors.up.isDown) {
        player.body.setVelocityY(-200);
    } else if (cursors.down.isDown) {
        player.body.setVelocityY(200);
    } else {
        player.body.setVelocityY(0);
    }

    // Player firing (continuous if space is held, 200ms delay)
    if (fireKey.isDown && time > lastFired) {
        fireBullet(this);
        lastFired = time + 200; // 200ms fire rate
    }

    // Enemy type 1 (enemyShip) firing logic
    if (time > lastEnemyShotTimeType1 + nextEnemyShotIntervalType1) {
        const type1Enemies = enemies.getChildren().filter(e => e.active && e.type === 1);
        if (type1Enemies.length > 0) {
            const shooter = Phaser.Utils.Array.GetRandom(type1Enemies);
            fireEnemyBullet(this, shooter.x, shooter.y);
        }
        lastEnemyShotTimeType1 = time;
        nextEnemyShotIntervalType1 = Phaser.Math.Between(200, 1000);
    }

    // Enemy type 2 (enemy_falcon) firing logic
    if (time > lastEnemyShotTimeType2 + nextEnemyShotIntervalType2) {
        const type2Enemies = enemies.getChildren().filter(e => e.active && e.type === 2);
        if (type2Enemies.length > 0) {
            const shooter = Phaser.Utils.Array.GetRandom(type2Enemies);
            fireFalconBullets(this, shooter.x, shooter.y);
        }
        lastEnemyShotTimeType2 = time;
        nextEnemyShotIntervalType2 = 1000; // Falcon fires only once per second
    }

    // Move enemy bullets
    enemyBullets.children.iterate(bullet => {
        if (bullet && bullet.active) {
            bullet.y += 300 * (delta / 1000);
            if (bullet.y > config.height) {
                bullet.destroy();
            }
        }
    });

    // Move Falcon bullets manually (ignore physics)
    falconBullets.getChildren().forEach(bullet => {
        if (bullet.active) {
            bullet.x += bullet.vx * (delta / 1000);
            bullet.y += bullet.vy * (delta / 1000);
            if (bullet.y > config.height || bullet.x < 0 || bullet.x > config.width) {
                bullet.destroy();
            }
        }
    });
    // Move bullets (destroy if off screen)
    if (bullets && bullets.children) {
        bullets.children.iterate(bullet => {
            if (bullet && bullet.active && bullet.y < 0) {
                bullet.destroy();
            }
        });
    }

    // Move enemies
    if (enemies && enemies.children) {
        enemies.children.iterate(enemy => {
            if (enemy && enemy.active) {
                enemy.y += enemySpeed * (delta / 1000);
                if (enemy.y > config.height) {
                    enemy.destroy();
                    // Lose a life if enemy escapes
                    if (lives > 0) {
                        lives--;
                        lives = Math.max(0, lives);
                    }
                    if (livesText) {
                        livesText.setText('Lives: ' + Math.max(0, lives));
                    }
                    if (lives <= 0 && !gameOver) {
                        // Game Over: stop player movement and show message
                        gameOver = true;
                        player.setActive(false).setVisible(false);
                        this.add.text(
                            config.width / 2, config.height / 2,
                            'GAME OVER',
                            { font: '40px Arial', fill: '#ff4444' }
                        ).setOrigin(0.5);
                        this.scene.pause();
                    }
                }
            }
        });
    }

    // If all enemies destroyed, create new wave
    if (enemies && enemies.countActive(true) === 0) {
        createEnemyWave(this);
    }
}

    // (Removed old firing logic using JustDown - now handled above with isDown)

    // Move bullets (destroy if off screen)
    if (bullets && bullets.children) {
        bullets.children.iterate(bullet => {
            if (bullet && bullet.active && bullet.y < 0) {
                bullet.destroy();
            }
        });
    }

    // Move enemies
    if (enemies && enemies.children) {
        enemies.children.iterate(enemy => {
            if (enemy && enemy.active) {
                enemy.y += enemySpeed * (delta / 1000);
                if (enemy.y > config.height) {
                    enemy.destroy();
                    // Lose a life if enemy escapes
                    if (lives > 0) {
                        lives--;
                        lives = Math.max(0, lives);
                    }
                    if (livesText) {
                        livesText.setText('Lives: ' + Math.max(0, lives));
                    }
                    if (lives <= 0) {
                        // Game Over: stop player movement and show message
                        player.setActive(false).setVisible(false);
                        this.add.text(
                            config.width / 2, config.height / 2,
                            'GAME OVER',
                            { font: '40px Arial', fill: '#ff4444' }
                        ).setOrigin(0.5);
                        this.scene.pause();
                    }
                }
            }
        });
    }

    // If all enemies destroyed, create new wave
    if (enemies && enemies.countActive(true) === 0) {
        createEnemyWave(this);
    }

// Enemy fires a bullet straight down
function fireEnemyBullet(scene, x, y) {
    const bullet = scene.add.rectangle(x, y + 20, 4, 12, 0xff4444);
    scene.physics.add.existing(bullet);
    bullet.body.setAllowGravity(false);
    bullet.body.setVelocityY(300); // Move down
    bullet.body.setImmovable(false);
    bullet.body.setCollideWorldBounds(false);
    bullet.body.setEnable(true);
    bullet.body.setBounce(0);
    bullet.body.setDrag(0);
    bullet.body.setFriction(0);
    bullet.body.setMass(1);
    bullet.body.setMaxVelocity(1000);
    bullet.body.setAcceleration(0);
    bullet.body.setAngularVelocity(0);
    bullet.body.setAngularAcceleration(0);
    bullet.body.setAngularDrag(0);
    bullet.body.setDamping(false);
    bullet.body.type = Phaser.Physics.Arcade.DYNAMIC_BODY;
    enemyBullets.add(bullet);
}

// Falcon enemy fires two bullets at ±12.5 degrees from vertical, non-physics, 25 degrees apart
function fireFalconBullets(scene, x, y) {
    const speed = 300;
    const spread = 12.5; // degrees from vertical
    const baseAngles = [90 - spread, 90 + spread]; // 77.5 and 102.5 degrees
    baseAngles.forEach(angle => {
        const rad = Phaser.Math.DegToRad(angle);
        const vx = speed * Math.cos(rad);
        const vy = speed * Math.sin(rad);
        const bullet = scene.add.rectangle(x, y + 20, 4, 12, 0xffcc00);
        bullet.vx = vx;
        bullet.vy = vy;
        falconBullets.add(bullet);
    });
}

// Handle enemy bullet hitting player
function handleEnemyBulletPlayerCollision(playerObj, bullet) {
    bullet.destroy();
    // Show explosion at player position
    if (lives > 1) {
        showExplosion(player.scene, player.x, player.y, "small");
    } else if (lives === 1) {
        // This hit will bring lives to 0, so show large explosion
        showExplosion(player.scene, player.x, player.y, "large");
    }
    if (lives > 0) {
        lives--;
        lives = Math.max(0, lives);
    }
    if (livesText) {
        livesText.setText('Lives: ' + Math.max(0, lives));
    }
    if (lives <= 0) {
        player.setActive(false).setVisible(false);
        player.scene.add.text(
            config.width / 2, config.height / 2,
            'GAME OVER',
            { font: '40px Arial', fill: '#ff4444' }
        ).setOrigin(0.5);
        player.scene.scene.pause();
    }
}

function fireBullet(scene) {
    // Use the group to create the bullet so it is managed by the physics world from the start
    const bullet = bullets.create(player.x, player.y - 20, 'bullet');
    bullet.setDisplaySize(4, 12);
    bullet.body.setSize(4, 12);
    bullet.setTint(0xffff00);
    bullet.body.setAllowGravity(false);
    bullet.body.setVelocityY(-400); // Move up
    bullet.body.setImmovable(false);
    bullet.body.setCollideWorldBounds(false);
}

function createEnemyWave(scene) {
    const rows = 3;
    const cols = 7;
    const offsetX = 60;
    const offsetY = 60;
    const spacingX = 50;
    const spacingY = 40;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = offsetX + col * spacingX;
            const y = offsetY + row * spacingY;
            // 30% chance for type 2 (Falcon), 70% for type 1 (default)
            let enemyType, enemyImage;
            if (Math.random() < 0.3) {
                enemyType = 2;
                enemyImage = 'enemy_falcon';
            } else {
                enemyType = 1;
                enemyImage = 'enemyShip';
            }
            const enemy = scene.physics.add.image(x, y, enemyImage);
            enemy.setDisplaySize(40, 40);
            enemy.setDepth(1);
            enemy.body.setAllowGravity(false);
            enemy.type = enemyType;
            enemies.add(enemy);
        }
    }
}

function handleBulletEnemyCollision(bullet, enemy) {
    if (bullet.body) bullet.disableBody(true, true);
    if (enemy.body && enemy.scene) {
        showExplosion(enemy.scene, enemy.x, enemy.y);
        enemy.disableBody(true, true);
    }
}

// Simple explosion animation: expanding/fading circles
function showExplosion(scene, x, y, size = "small") {
    // size: "small" or "large"
    let radii, alphas, durationBase;
    if (size === "large") {
        radii = [24, 40, 60];
        alphas = [0.8, 0.6, 0.4];
        durationBase = 700;
    } else {
        radii = [10, 18, 26];
        alphas = [0.7, 0.5, 0.3];
        durationBase = 400;
    }
    const colors = [0xfff200, 0xffa200, 0xff4444];
    colors.forEach((color, i) => {
        const circle = scene.add.circle(x, y, radii[i], color, alphas[i]);
        circle.setDepth(10);
        scene.tweens.add({
            targets: circle,
            scale: 2 + i,
            alpha: 0,
            duration: 400 + i * 100,
            ease: 'Cubic.easeOut',
            onComplete: () => circle.destroy()
        });
    });
}

const game = new Phaser.Game(config);