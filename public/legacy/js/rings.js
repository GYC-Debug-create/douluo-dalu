/**
 * 魂环系统
 * 击杀魂兽掉落魂环,玩家可吸收
 */
class Ring {
  constructor(x, y, level, beastType) {
    this.x = x;
    this.y = y;
    this.level = level;
    this.beastType = beastType;
    this.spawnTime = Date.now();
    this.lifetime = CONFIG.RING.LIFETIME;
    this.alive = true;
    this.bobOffset = 0;
  }
  
  update(dt) {
    const age = Date.now() - this.spawnTime;
    if (age > this.lifetime) {
      this.alive = false;
    }
    this.bobOffset = Math.sin(Date.now() * 0.005) * 3;
  }
  
  /**
   * 检查玩家是否在拾取范围
   */
  isInRange(player) {
    return Physics.distance(this.x, this.y, player.x, player.y) < CONFIG.RING.PICKUP_RANGE;
  }
  
  render(ctx, camera) {
    if (!this.alive) return;
    const sx = this.x - camera.x;
    const sy = this.y - camera.y + this.bobOffset;
    const age = Date.now() - this.spawnTime;
    const remaining = this.lifetime - age;
    
    // 即将消失时闪烁
    if (remaining < 5000) {
      if (Math.floor(remaining / 200) % 2 === 0) return;
    }
    
    PixelArt.drawRing(ctx, { x: sx, y: sy, level: this.level }, Date.now());
    
    // 提示文字
    const ringInfo = RING_DATA[this.level];
    ctx.fillStyle = ringInfo.color;
    ctx.font = '10px Microsoft YaHei';
    ctx.textAlign = 'center';
    ctx.fillText(ringInfo.name, sx, sy + 30);
  }
}
