import Phaser from 'phaser';

export function showExplosion(
  scene: Phaser.Scene,
  x: number,
  y: number,
  size: 'small' | 'large' = 'small'
) {
  // For enemy explosions (small): 20% larger and more orange
  let radius: number;
  let color: number;

  if (size === 'large') {
    radius = 40;
    color = 0xff6600;
  } else {
    radius = 24; // 20% larger than 20
    color = 0xff9900; // more orange
  }

  const explosion = scene.add.circle(x, y, 1, color, 0.8);
  explosion.setDepth(10);

  scene.tweens.add({
    targets: explosion,
    radius: radius,
    alpha: 0,
    duration: 350,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      explosion.destroy();
    }
  });
}