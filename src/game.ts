export const WORLD = { width: 960, height: 540, radius: 16, birdX: 220, margin: 32, speed: 180, gap: 0.4, interval: 3, firstArrival: 4, pipeWidth: 64 };
export interface Obstacle { x: number; center: number; scored: boolean }
export class Game {
  obstacles: Obstacle[] = [];
  score = 0;
  elapsed = 0;
  ended = false;
  private untilSpawn = 0;
  private center = WORLD.height / 2;
  constructor(private random: () => number = Math.random) { this.reset(); }
  reset() { this.obstacles = []; this.score = 0; this.elapsed = 0; this.ended = false; this.untilSpawn = 0; this.center = WORLD.height / 2; }
  birdY(height: number) { return WORLD.height - WORLD.margin - height * (WORLD.height - 2 * WORLD.margin); }
  update(dt: number, height: number) {
    if (this.ended) return;
    this.elapsed += dt;
    this.untilSpawn -= dt;
    if (this.untilSpawn <= 0) {
      const min = WORLD.margin + WORLD.height * WORLD.gap / 2;
      this.center = Math.max(min, Math.min(WORLD.height - min, this.center + (this.random() * 2 - 1) * WORLD.height * 0.2));
      // First pipe reaches the leading edge of the bird after four seconds.
      const spawnX = WORLD.birdX + WORLD.radius + WORLD.speed * WORLD.firstArrival;
      this.obstacles.push({ x: spawnX, center: this.center, scored: false });
      this.untilSpawn += WORLD.interval;
    }
    const y = this.birdY(height);
    for (const pipe of this.obstacles) {
      pipe.x -= WORLD.speed * dt;
      const halfGap = WORLD.height * WORLD.gap / 2;
      const intersects = (top: number, bottom: number) => {
        const nearestX = Math.max(pipe.x, Math.min(WORLD.birdX, pipe.x + WORLD.pipeWidth));
        const nearestY = Math.max(top, Math.min(y, bottom));
        return (nearestX - WORLD.birdX) ** 2 + (nearestY - y) ** 2 <= WORLD.radius ** 2;
      };
      if (intersects(0, pipe.center - halfGap) || intersects(pipe.center + halfGap, WORLD.height)) this.ended = true;
      if (!this.ended && !pipe.scored && pipe.x + WORLD.pipeWidth < WORLD.birdX - WORLD.radius) { pipe.scored = true; this.score++; }
    }
    this.obstacles = this.obstacles.filter(pipe => pipe.x + WORLD.pipeWidth > 0);
  }
}
