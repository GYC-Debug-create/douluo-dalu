/**
 * 2D 物理引擎
 * 实现碰撞检测(AABB)、碰撞响应、边界限制
 */
const Physics = {
  
  /**
   * AABB 矩形碰撞检测
   * @param {Object} a - {x, y, w, h}
   * @param {Object} b - {x, y, w, h}
   */
  aabb(a, b) {
    return a.x < b.x + b.w &&
           a.x + a.w > b.x &&
           a.y < b.y + b.h &&
           a.y + a.h > b.y;
  },
  
  /**
   * 圆形碰撞检测
   */
  circleCollision(x1, y1, r1, x2, y2, r2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distSq = dx*dx + dy*dy;
    const rSum = r1 + r2;
    return distSq < rSum * rSum;
  },
  
  /**
   * 计算两点距离
   */
  distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx*dx + dy*dy);
  },
  
  /**
   * 计算两点距离平方(避免开方,性能更好)
   */
  distanceSq(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx*dx + dy*dy;
  },
  
  /**
   * 计算从 (x1,y1) 到 (x2,y2) 的方向单位向量
   */
  direction(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx*dx + dy*dy);
    if (len === 0) return { x: 0, y: 0 };
    return { x: dx/len, y: dy/len };
  },
  
  /**
   * 线性插值
   */
  lerp(a, b, t) {
    return a + (b - a) * t;
  },
  
  /**
   * 限制值在范围内
   */
  clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  },
  
  /**
   * 实体与世界边界碰撞
   */
  constrainToWorld(entity, worldW, worldH) {
    entity.x = this.clamp(entity.x, entity.size/2, worldW - entity.size/2);
    entity.y = this.clamp(entity.y, entity.size/2, worldH - entity.size/2);
  },
  
  /**
   * 实体之间的碰撞推离(分离)
   */
  separate(entity, others) {
    for (const other of others) {
      if (entity === other) continue;
      const minDist = (entity.size + other.size) / 2;
      const dx = entity.x - other.x;
      const dy = entity.y - other.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < minDist && dist > 0) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        // 双方各推一半
        entity.x += nx * overlap * 0.5;
        entity.y += ny * overlap * 0.5;
        other.x -= nx * overlap * 0.5;
        other.y -= ny * overlap * 0.5;
      } else if (dist === 0) {
        // 完全重叠,随机方向推开
        entity.x += (Math.random() - 0.5) * 2;
        entity.y += (Math.random() - 0.5) * 2;
      }
    }
  },
  
  /**
   * 检查实体是否可以移动到目标位置(考虑地形)
   */
  canMoveTo(x, y, size, world) {
    if (!world) return true;
    const half = size / 2;
    // 检查几个采样点
    const points = [
      { x: x - half, y: y - half },
      { x: x + half, y: y - half },
      { x: x - half, y: y + half },
      { x: x + half, y: y + half },
      { x: x, y: y }
    ];
    for (const p of points) {
      if (!world.isWalkable(p.x, p.y)) return false;
    }
    return true;
  },
  
  /**
   * 带碰撞检测的移动
   * 分轴移动以便滑墙
   */
  moveWithCollision(entity, dx, dy, world) {
    // X轴
    const newX = entity.x + dx;
    if (this.canMoveTo(newX, entity.y, entity.size, world)) {
      entity.x = newX;
    }
    // Y轴
    const newY = entity.y + dy;
    if (this.canMoveTo(entity.x, newY, entity.size, world)) {
      entity.y = newY;
    }
    // 世界边界
    this.constrainToWorld(entity, CONFIG.WORLD.WIDTH, CONFIG.WORLD.HEIGHT);
  },
  
  /**
   * 角度转弧度
   */
  deg2rad(deg) {
    return deg * Math.PI / 180;
  },
  
  /**
   * 获取实体朝向某点的角度
   */
  angleTo(entity, targetX, targetY) {
    return Math.atan2(targetY - entity.y, targetX - entity.x);
  }
};
