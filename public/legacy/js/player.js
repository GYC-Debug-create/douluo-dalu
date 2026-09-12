/**
 * 玩家系统
 * 包含属性、武魂、技能、魂环、等级
 */
class Player {
  constructor(name, spiritId) {
    this.id = 'p_' + Date.now();
    this.name = name;
    this.spiritId = spiritId;
    this.spirit = SPIRIT_DATA[spiritId];
    
    // 位置
    this.x = CONFIG.WORLD.WIDTH / 2;
    this.y = CONFIG.WORLD.HEIGHT / 2;
    this.size = CONFIG.PLAYER.SIZE;
    this.dir = 'down'; // up, down, left, right
    
    // 等级与经验
    this.level = 1;
    this.exp = 0;
    this.expToNext = CONFIG.EXP.BASE;
    
    // 基础属性(由武魂决定)
    this.baseAttack = this.spirit.baseAttack;
    this.baseDefense = this.spirit.baseDefense;
    this.baseSpeed = this.spirit.baseSpeed;
    this.baseHp = this.spirit.baseHp;
    
    // 体力
    this.stamina = CONFIG.STAMINA.MAX;
    this.maxStamina = CONFIG.STAMINA.MAX;
    
    // 魂环(最多9个)
    this.rings = [];
    
    // 技能冷却
    this.skillCooldown = 0;
    this.attackCooldown = 0;
    
    // 动画
    this.walkFrame = 0;
    this.walkTimer = 0;
    this.moving = false;
    this.attackFlash = 0;
    
    // 状态
    this.alive = true;
    this.absorbing = null; // 正在吸收的魂环
    this.invulnerableUntil = Date.now() + CONFIG.BEAST.SPAWN_SAFE_TIME; // 出生无敌截止时间
    
    // 计算衍生属性
    this.recalcStats();
    this.hp = this.maxHp;
    
    // 统计
    this.stats = {
      beastsKilled: 0,
      ringsAbsorbed: 0,
      damageDealt: 0,
      damageTaken: 0,
      playTime: 0
    };
  }
  
  /**
   * 重新计算属性(基础 + 等级成长 + 魂环加成)
   */
  recalcStats() {
    const lvlBonus = (this.level - 1);
    let bonusAtk = 0, bonusDef = 0, bonusHp = 0;
    
    // 魂环加成
    for (const ring of this.rings) {
      const rd = RING_DATA[ring.level];
      bonusAtk += rd.bonus.attack;
      bonusDef += rd.bonus.defense;
      bonusHp += rd.bonus.hp;
    }
    
    this.attack = this.baseAttack + lvlBonus * 2 + bonusAtk;
    this.defense = this.baseDefense + lvlBonus + bonusDef;
    this.maxHp = this.baseHp + lvlBonus * 20 + bonusHp;
    this.speed = CONFIG.PLAYER.BASE_SPEED * (1 + this.baseSpeed * 0.05);
    
    // 被动技能加成
    if (this.spirit.passive === '重击') {
      this.critRate = 0.25;
    } else {
      this.critRate = 0.1;
    }
    if (this.spirit.passive === '敏捷') {
      this.dodgeRate = 0.25;
    } else {
      this.dodgeRate = 0.05;
    }
    if (this.spirit.passive === '韧性生长') {
      this.maxHp += lvlBonus * 20; // 额外
    }
    if (this.spirit.passive === '龙威') {
      this.attack = Math.floor(this.attack * 1.15); // 攻击力+15%
      this.damageReduction = 0.10; // 受到伤害-10%
    } else {
      this.damageReduction = 0;
    }
  }
  /**
   * 获取武魂技能
   */
  getSkill() {
    return this.spirit.skill;
  }
  /**
   * 是否可以吸收魂环
   */
  canAbsorbRing(ringLevel) {
    if (this.rings.length >= CONFIG.PLAYER.MAX_RINGS) return false;
    // 魂环等级不能超过玩家等级/10 + 1
    const maxRingLevel = Math.min(5, Math.floor((this.level - 1) / 10) + 1);
    // 第N个魂环需要等级 N*10
    const requiredLevel = (this.rings.length + 1) * 10;
    if (this.level < requiredLevel) return false;
    return ringLevel <= maxRingLevel;
  }
  /**
   * 获取吸收魂环所需等级
   */
  getRequiredLevelForNextRing() {
    return (this.rings.length + 1) * 10;
  }
  /**
   * 吸收魂环
   */
  absorbRing(ring) {
    if (!this.canAbsorbRing(ring.level)) return false;
    this.rings.push({
      level: ring.level,
      beastType: ring.beastType,
      absorbedAt: Date.now()
    });
    this.recalcStats();
    this.hp = this.maxHp; // 吸收魂环回满血
    this.stats.ringsAbsorbed++;
    return true;
  }
  /**
   * 增加经验
   */
  gainExp(amount) {
    // 辅助系被动:经验+25%
    if (this.spirit.passive === '增幅') {
      amount = Math.floor(amount * 1.25);
    }
    this.exp += amount;
    const before = { attack:this.attack, defense:this.defense, hp:this.maxHp, speed:this.speed };
    let leveledUp = false;
    while (this.exp >= this.expToNext && this.level < CONFIG.EXP.MAX_LEVEL) {
      this.exp -= this.expToNext;
      this.level++;
      this.expToNext = Math.floor(CONFIG.EXP.BASE * Math.pow(CONFIG.EXP.GROWTH, this.level - 1));
      this.recalcStats();
      this.hp = this.maxHp;
      leveledUp = true;
    }
    if(leveledUp){
      this.lastLevelUp = {
        attack: Math.max(0, Math.round(this.attack - before.attack)),
        defense: Math.max(0, Math.round(this.defense - before.defense)),
        hp: Math.max(0, Math.round(this.maxHp - before.hp)),
        speed: Math.max(0, Math.round(this.speed - before.speed))
      };
    }
    return leveledUp;
  }
  /**
   * 受到伤害
   */
  takeDamage(dmg) {
    // 无敌状态
    if (Date.now() < this.invulnerableUntil) {
      return { dodged: true, damage: 0 };
    }
    // 闪避
    if (Math.random() < this.dodgeRate) {
      return { dodged: true, damage: 0 };
    }
    let actual = Math.max(1, dmg - this.defense * 0.5);
    // 龙威减伤
    if (this.damageReduction > 0) {
      actual = actual * (1 - this.damageReduction);
    }
    actual = Math.max(1, actual);
    this.hp -= actual;
    this.stats.damageTaken += actual;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
    return { dodged: false, damage: Math.floor(actual) };
  }
  /**
   * 治疗自身
   */
  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }
  /**
   * 攻击伤害计算
   */
  calculateDamage() {
    let dmg = this.attack;
    // 暴击
    const isCrit = Math.random() < this.critRate;
    if (isCrit) dmg *= 1.8;
    // 七杀剑被动:攻击速度+20%(体现在攻击间隔)
    return { damage: Math.floor(dmg), crit: isCrit };
  }
  /**
   * 更新
   */
  update(dt, game) {
    if (!this.alive) return;
    
    this.stats.playTime += dt;
    
    // 技能冷却
    if (this.skillCooldown > 0) this.skillCooldown -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.attackFlash > 0) this.attackFlash -= dt;
    
    // 体力恢复
    if (this.stamina < this.maxStamina) {
      this.stamina = Math.min(this.maxStamina, this.stamina + CONFIG.STAMINA.STAMINA_REGEN * dt / 16);
    }
    
    // 移动
    const move = Input.getMovement();
    this.moving = (move.dx !== 0 || move.dy !== 0);
    
    if (this.moving && !this.absorbing) {
      let speed = this.speed;
      // 冲刺
      const sprinting = Input.isDown('shift') && this.stamina > 0;
      if (sprinting) {
        speed *= CONFIG.PLAYER.SPRINT_MULT;
        this.stamina = Math.max(0, this.stamina - CONFIG.STAMINA.SPRINT_COST * dt / 16);
      }
      // 地形速度修正
      const speedMod = World.getSpeedMod(this.x, this.y);
      speed *= speedMod;
      
      const dx = move.dx * speed * dt / 16;
      const dy = move.dy * speed * dt / 16;
      
      Physics.moveWithCollision(this, dx, dy, World);
      
      // 方向
      if (Math.abs(move.dx) > Math.abs(move.dy)) {
        this.dir = move.dx > 0 ? 'right' : 'left';
      } else if (move.dy !== 0) {
        this.dir = move.dy > 0 ? 'down' : 'up';
      }
      
      // 走路动画
      this.walkTimer += dt;
      if (this.walkTimer > 150) {
        this.walkTimer = 0;
        this.walkFrame = (this.walkFrame + 1) % 4;
      }
    } else {
      this.walkFrame = 0;
    }
    
    // 攻击
    if (Input.mouse.down && this.attackCooldown <= 0 && !this.absorbing) {
      this.performAttack(game);
    }
    
    // 技能
    if (Input.isJustPressed('q') && this.skillCooldown <= 0 && !this.absorbing) {
      this.performSkill(game);
    }
  }
  /**
   * 普通攻击
   */
  performAttack(game) {
    this.attackCooldown = CONFIG.PLAYER.ATTACK_COOLDOWN;
    // 七杀剑被动:攻击速度+20%
    if (this.spirit.passive === '锋锐') {
      this.attackCooldown *= 0.8;
    }
    this.attackFlash = 150;
    
    // 攻击方向(朝向鼠标)
    const targetX = Input.mouse.worldX;
    const targetY = Input.mouse.worldY;
    const angle = Math.atan2(targetY - this.y, targetX - this.x);
    
    const { damage, crit } = this.calculateDamage();
    
    // 检测命中范围内的魂兽
    let hitAny = false;
    for (const beast of game.beasts) {
      if (!beast.alive) continue;
      const dist = Physics.distance(this.x, this.y, beast.x, beast.y);
      if (dist < CONFIG.PLAYER.ATTACK_RANGE + beast.size/2) {
        // 检查角度(扇形)
        const beastAngle = Math.atan2(beast.y - this.y, beast.x - this.x);
        const angleDiff = Math.abs(this.angleDiff(angle, beastAngle));
        if (angleDiff < Math.PI / 3) {
          const result = beast.takeDamage(damage, this);
          game.spawnDamageNumber(beast.x, beast.y - 20, damage, crit);
          this.stats.damageDealt += damage;
          beast.hitFlash = 200;
          beast.aggro = true;
          hitAny = true;
          if (!beast.alive) {
            this.onKillBeast(beast, game);
          }
        }
      }
    }
    
    // 攻击特效
    game.effects.push({
      type: 'slash',
      x: this.x + Math.cos(angle) * 30,
      y: this.y + Math.sin(angle) * 30,
      angle: angle,
      startTime: Date.now(),
      duration: 200,
      color: this.spirit.color
    });
  }
  /**
   * 释放技能
   */
  performSkill(game) {
    const skill = this.getSkill();
    this.skillCooldown = skill.cooldown;
    
    const targetX = Input.mouse.worldX;
    const targetY = Input.mouse.worldY;
    
    switch (skill.type) {
      case 'projectile': {
        // 蓝银草缠绕
        const dist = Physics.distance(this.x, this.y, targetX, targetY);
        if (dist < skill.range) {
          for (const beast of game.beasts) {
            if (!beast.alive) continue;
            const bd = Physics.distance(this.x, this.y, beast.x, beast.y);
            if (bd < skill.range) {
              const result = beast.takeDamage(skill.damage + this.attack * 0.5, this);
              game.spawnDamageNumber(beast.x, beast.y - 20, result.damage, false);
              beast.speed *= 0.4; // 减速
              setTimeout(() => { if (beast.alive) beast.speed /= 0.4; }, 1500);
              beast.aggro = true;
              if (!beast.alive) this.onKillBeast(beast, game);
            }
          }
          game.effects.push({
            type: 'projectile', x: this.x, y: this.y,
            targetX, targetY, startTime: Date.now(),
            duration: 400, color: this.spirit.color
          });
          UI.toast('蓝银草缠绕!', 'success');
        }
        break;
      }
      case 'aoe': {
        // 范围伤害(昊天锤/霸王龙)
        const isDragon = this.spiritId === 'tyrant_dragon';
        const knockback = isDragon ? 80 : 40;
        for (const beast of game.beasts) {
          if (!beast.alive) continue;
          const bd = Physics.distance(this.x, this.y, beast.x, beast.y);
          if (bd < skill.range) {
            const result = beast.takeDamage(skill.damage + this.attack, this);
            game.spawnDamageNumber(beast.x, beast.y - 20, result.damage, true);
            // 击退
            const dir = Physics.direction(this.x, this.y, beast.x, beast.y);
            beast.x += dir.x * knockback;
            beast.y += dir.y * knockback;
            beast.aggro = true;
            if (!beast.alive) this.onKillBeast(beast, game);
          }
        }
        game.effects.push({
          type: 'aoe', x: this.x, y: this.y,
          targetX: this.x, targetY: this.y,
          startTime: Date.now(), duration: isDragon ? 700 : 500,
          color: this.spirit.color, dragon: isDragon
        });
        UI.toast(isDragon ? '霸王咆哮!' : '乱披风锤法!', 'success');
        break;
      }
      case 'beam': {
        // 七杀剑气(直线穿透)
        const angle = Math.atan2(targetY - this.y, targetX - this.x);
        for (const beast of game.beasts) {
          if (!beast.alive) continue;
          // 检查魂兽是否在剑气路径上
          const dx = beast.x - this.x;
          const dy = beast.y - this.y;
          const proj = dx * Math.cos(angle) + dy * Math.sin(angle);
          if (proj > 0 && proj < skill.range) {
            const perpDist = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
            if (perpDist < 30 + beast.size/2) {
              const result = beast.takeDamage(skill.damage + this.attack * 0.8, this);
              game.spawnDamageNumber(beast.x, beast.y - 20, result.damage, false);
              beast.aggro = true;
              if (!beast.alive) this.onKillBeast(beast, game);
            }
          }
        }
        game.effects.push({
          type: 'beam', x: this.x, y: this.y,
          targetX: this.x + Math.cos(angle) * skill.range,
          targetY: this.y + Math.sin(angle) * skill.range,
          startTime: Date.now(), duration: 300, color: this.spirit.color
        });
        UI.toast('七杀剑气!', 'success');
        break;
      }
      case 'dash': {
        // 幽冥灵猫突袭
        const dist = Math.min(skill.range, Physics.distance(this.x, this.y, targetX, targetY));
        const angle = Math.atan2(targetY - this.y, targetX - this.x);
        const oldX = this.x, oldY = this.y;
        this.x += Math.cos(angle) * dist;
        this.y += Math.sin(angle) * dist;
        Physics.constrainToWorld(this, CONFIG.WORLD.WIDTH, CONFIG.WORLD.HEIGHT);
        // 对路径上的魂兽造成伤害
        for (const beast of game.beasts) {
          if (!beast.alive) continue;
          const d = Physics.distance(oldX, oldY, beast.x, beast.y);
          if (d < dist + 30) {
            const result = beast.takeDamage(skill.damage + this.attack, this);
            game.spawnDamageNumber(beast.x, beast.y - 20, result.damage, true);
            beast.aggro = true;
            if (!beast.alive) this.onKillBeast(beast, game);
          }
        }
        game.effects.push({
          type: 'dash', x: oldX, y: oldY,
          targetX: this.x, targetY: this.y,
          startTime: Date.now(), duration: 400, color: this.spirit.color
        });
        UI.toast('幽冥突袭!', 'success');
        break;
      }
      case 'buff': {
        // 九宝琉璃塔治疗+buff
        this.heal(skill.heal + this.level * 5);
        // buff效果(10秒内攻击+30%)
        const origAttack = this.attack;
        this.attack = Math.floor(this.attack * skill.buff);
        game.effects.push({
          type: 'heal', x: this.x, y: this.y,
          targetX: this.x, targetY: this.y,
          startTime: Date.now(), duration: 800, color: '#22c55e'
        });
        setTimeout(() => { this.attack = origAttack; this.recalcStats(); }, 10000);
        UI.toast('九宝神光! 恢复HP并强化', 'success');
        break;
      }
    }
  }
  /**
   * 击杀魂兽回调
   */
  onKillBeast(beast, game) {
    this.stats.beastsKilled++;
    const leveledUp = this.gainExp(beast.exp);
    UI.toast(`击杀 ${beast.name}! +${beast.exp} 经验`, 'success');
    
    // 掉落魂环
    if (Math.random() < CONFIG.BEAST.RING_DROP_RATE) {
      game.spawnRing(beast.x, beast.y, beast.ringLevel, beast.type);
    }
    
    if (leveledUp) {
      UI.showLevelUp(this.level, this.lastLevelUp);
    }
  }
  angleDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
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
    
    // 玩家精灵(无敌时闪烁)
    const invulnRemaining = Math.max(0, this.invulnerableUntil - Date.now());
    if (invulnRemaining > 0 && Math.floor(invulnRemaining / 100) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }
    PixelArt.drawPlayer(ctx, sx, sy, this.size, this.dir, this.walkFrame, this.spirit.color, this.attackFlash > 0);
    ctx.globalAlpha = 1;
    
    // 无敌光环
    if (invulnRemaining > 0) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(sx, sy, this.size/2 + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    
    // 吸收魂环进度
    if (this.absorbing) {
      const progress = this.absorbing.progress;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, 30, -Math.PI/2, -Math.PI/2 + progress * Math.PI * 2);
      ctx.stroke();
    }
  }
  /**
   * 序列化存档
   */
  serialize() {
    return {
      id: this.id,
      name: this.name,
      spirit: this.spiritId,
      level: this.level,
      exp: this.exp,
      expToNext: this.expToNext,
      x: this.x,
      y: this.y,
      hp: this.hp,
      stamina: this.stamina,
      rings: this.rings,
      stats: this.stats
    };
  }
}
