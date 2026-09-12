/**
 * 魂兽系统
 * 魂兽AI、生成、战斗
 */
class Beast {
  constructor(type, x, y) {
    const data = BEAST_DATA[type];
    this.type = type;
    this.name = data.name;
    this.age = data.age;
    this.color = data.color;
    this.size = data.size;
    this.maxHp = data.hp;
    this.hp = data.hp;
    this.attack = data.attack;
    this.defense = data.defense;
    this.baseSpeed = data.speed;
    this.speed = data.speed;
    this.exp = data.exp;
    this.ringColor = data.ringColor;
    this.ringLevel = data.ringLevel;
    this.ai = data.ai;
    
    this.x = x;
    this.y = y;
    this.alive = true;
    
    // AI状态
    this.aggro = false;
    this.target = null;
    this.wanderDir = { x: 0, y: 0 };
    this.wanderTimer = 0;
    this.attackCooldown = 0;
    this.hitFlash = 0;
    
    // 动画
    this.walkFrame = 0;
    this.walkTimer = 0;
    this.dir = 'down';
  }
  
  /**
   * 受到伤害
   */
  takeDamage(dmg, attacker) {
    if (!this.alive) return { damage: 0 };
    const actual = Math.max(1, dmg - this.defense * 0.4);
    this.hp -= actual;
    this.aggro = true;
    this.target = attacker;
    this.hitFlash = 200;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
    return { damage: Math.floor(actual) };
  }
  
  /**
   * 更新AI
   */
  update(dt, game) {
    if (!this.alive) return;
    
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    
    const player = game.player;
    if (!player || !player.alive) {
      this.wander(dt);
      return;
    }
    
    const distToPlayer = Physics.distance(this.x, this.y, player.x, player.y);
    
    // AI行为
    if (this.ai === 'aggressive') {
      // 攻击性:在仇恨范围内追击
      if (this.aggro || distToPlayer < CONFIG.BEAST.AGGRO_RANGE) {
        this.aggro = true;
        this.target = player;
        
        if (distToPlayer > CONFIG.BEAST.ATTACK_RANGE + this.size/2) {
          // 追击
          this.moveTowards(player.x, player.y, dt, game);
        } else if (this.attackCooldown <= 0) {
          // 攻击
          this.attackPlayer(player, game);
        }
      } else {
        this.wander(dt);
      }
    } else {
      // 被动型:被攻击后会逃跑
      if (this.aggro) {
        // 逃跑
        const dir = Physics.direction(player.x, player.y, this.x, this.y);
        this.moveInDir(dir.x, dir.y, dt, game, this.speed * 1.2);
      } else {
        this.wander(dt);
      }
    }
    
    // 动画
    if (this.moving) {
      this.walkTimer += dt;
      if (this.walkTimer > 200) {
        this.walkTimer = 0;
        this.walkFrame = (this.walkFrame + 1) % 4;
      }
    }
  }
  
  /**
   * 朝目标移动
   */
  moveTowards(tx, ty, dt, game) {
    const dir = Physics.direction(this.x, this.y, tx, ty);
    this.moveInDir(dir.x, dir.y, dt, game, this.speed);
    // 设置方向
    if (Math.abs(dir.x) > Math.abs(dir.y)) {
      this.dir = dir.x > 0 ? 'right' : 'left';
    } else {
      this.dir = dir.y > 0 ? 'down' : 'up';
    }
  }
  moveInDir(dx, dy, dt, game, speed) {
    const moveX = dx * speed * dt / 16;
    const moveY = dy * speed * dt / 16;
    const oldX = this.x, oldY = this.y;
    Physics.moveWithCollision(this, moveX, moveY, World);
    this.moving = (this.x !== oldX || this.y !== oldY);
  }
  /**
   * 随机游荡
   */
  wander(dt) {
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderTimer = 2000 + Math.random() * 3000;
      const angle = Math.random() * Math.PI * 2;
      this.wanderDir = { x: Math.cos(angle), y: Math.sin(angle) };
      // 有时停下
      if (Math.random() < 0.3) {
        this.wanderDir = { x: 0, y: 0 };
      }
    }
    
    if (this.wanderDir.x !== 0 || this.wanderDir.y !== 0) {
      this.moveInDir(this.wanderDir.x, this.wanderDir.y, dt, null, this.speed * 0.5);
      if (Math.abs(this.wanderDir.x) > Math.abs(this.wanderDir.y)) {
        this.dir = this.wanderDir.x > 0 ? 'right' : 'left';
      } else if (this.wanderDir.y !== 0) {
        this.dir = this.wanderDir.y > 0 ? 'down' : 'up';
      }
    } else {
      this.moving = false;
    }
  }
  /**
   * 攻击玩家
   */
  attackPlayer(player, game) {
    this.attackCooldown = 1500;
    const result = player.takeDamage(this.attack);
    if (result.dodged) {
      game.spawnDamageNumber(player.x, player.y - 20, '闪避', false, true);
    } else {
      game.spawnDamageNumber(player.x, player.y - 20, result.damage, false, false, true);
      UI.toast(`受到 ${this.name} 攻击! -${result.damage} HP`, 'danger');
    }
  }
  /**
   * 渲染
   */
  render(ctx, camera) {
    if (!this.alive) return;
    const sx = this.x - camera.x;
    const sy = this.y - camera.y;
    
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + this.size/2, this.size/2, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    PixelArt.drawBeast(ctx, this, sx, sy);
  }
}
