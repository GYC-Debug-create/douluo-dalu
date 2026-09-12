/**
 * 游戏核心引擎
 * 游戏循环、相机、实体管理、渲染
 */
const Game = {
  canvas: null,
  ctx: null,
  minimapCanvas: null,
  minimapCtx: null,
  
  player: null,
  beasts: [],
  rings: [],
  effects: [],
  damageNumbers: [],
  
  camera: { x: 0, y: 0, width: 0, height: 0 },
  
  running: false,
  paused: false,
  lastTime: 0,
  _loopRunning: false,
  
  beastSpawnTimer: 0,
  
  // 自动保存
  autoSaveTimer: 0,
  AUTO_SAVE_INTERVAL: 60000,
  
  init() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.minimapCanvas = document.getElementById('minimap');
    this.minimapCtx = this.minimapCanvas.getContext('2d');
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    Input.init(this.canvas);
    
    // 暂停按键
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.running && this.currentScreen === 'game') {
        if (this.paused) this.resume();
        else this.pause();
      }
      // 拾取魂环
      if (e.key === ' ' && this.player && this.player.alive && !this.paused) {
        this.tryPickupRing();
      }
    });
  },
  
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.camera.width = this.canvas.width;
    this.camera.height = this.canvas.height;
    this.minimapCanvas.width = 160;
    this.minimapCanvas.height = 160;
  },
  
  /**
   * 开始新游戏
   */
  startNewGame(name, spiritId) {
    this.player = new Player(name, spiritId);
    this.beasts = [];
    this.rings = [];
    this.effects = [];
    this.damageNumbers = [];
    this.beastSpawnTimer = 0;
    this.autoSaveTimer = 0;
    
    // 生成初始魂兽
    for (let i = 0; i < 15; i++) {
      this.spawnBeast();
    }
    
    UI.showScreen('game');
    this.currentScreen = 'game';
    this.running = true;
    this.paused = false;
    this.lastTime = performance.now();
    UI.toast(`武魂觉醒! 欢迎成为魂师, ${name}`, 'success');
    UI.toast(`5秒出生保护中,请注意周围魂兽`, 'warning');
    this.startLoop();
  },
  
  startLoop() {
    if (this._loopRunning) return;
    this._loopRunning = true;
    requestAnimationFrame((t) => this.loop(t));
  },
  
  /**
   * 生成魂兽
   */
  spawnBeast(forceType = null) {
    if (this.beasts.filter(b => b.alive).length >= CONFIG.BEAST.SPAWN_MAX) return;
    
    // 根据玩家等级决定魂兽类型概率
    let type;
    if (forceType) {
      type = forceType;
    } else {
      const r = Math.random();
      if (this.player.level >= 30 && r < 0.05) type = 'jiao_dragon';
      else if (this.player.level >= 15 && r < 0.2) type = r < 0.1 ? 'flame_tiger' : 'iron_bear';
      else if (r < 0.4) type = 'wild_wolf';
      else type = 'wild_deer';
    }
    
    // 在玩家附近生成(但不要太近)
    const point = World.getRandomSpawnPoint(this.player.x, this.player.y);
    const beast = new Beast(type, point.x, point.y);
    this.beasts.push(beast);
  },
  
  /**
   * 生成魂环
   */
  spawnRing(x, y, level, beastType) {
    this.rings.push(new Ring(x, y, level, beastType));
    UI.toast(`${BEAST_DATA[beastType].name}掉落了${RING_DATA[level].name}! 按空格吸收`, 'warning');
  },
  
  /**
   * 尝试拾取魂环
   */
  tryPickupRing() {
    if (this.player.absorbing) return;
    
    let nearest = null;
    let nearestDist = CONFIG.RING.PICKUP_RANGE;
    
    for (const ring of this.rings) {
      if (!ring.alive) continue;
      const d = Physics.distance(this.player.x, this.player.y, ring.x, ring.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = ring;
      }
    }
    
    if (nearest) {
      // 检查是否可以吸收
      if (!this.player.canAbsorbRing(nearest.level)) {
        const reqLvl = this.player.getRequiredLevelForNextRing();
        const ringInfo = RING_DATA[nearest.level];
        if (this.player.rings.length >= CONFIG.PLAYER.MAX_RINGS) {
          UI.toast('已达魂环上限!', 'danger');
        } else {
          UI.toast(`需要 Lv.${reqLvl} 才能吸收此魂环`, 'danger');
        }
        return;
      }
      
      // 开始吸收
      this.player.absorbing = {
        ring: nearest,
        progress: 0,
        startTime: Date.now()
      };
      UI.toast('正在吸收魂环...', 'warning');
    }
  },
  
  /**
   * 主循环
   */
  loop(time) {
    if (!this.running) {
      this._loopRunning = false;
      return;
    }
    
    const dt = Math.min(50, time - this.lastTime); // 限制最大dt防止跳跃
    this.lastTime = time;
    
    if (!this.paused) {
      this.update(dt);
    }
    this.render();
    
    requestAnimationFrame((t) => this.loop(t));
  },
  
  /**
   * 更新
   */
  update(dt) {
    // 更新鼠标世界坐标
    Input.mouse.worldX = Input.mouse.x + this.camera.x;
    Input.mouse.worldY = Input.mouse.y + this.camera.y;
    
    // 玩家更新
    if (this.player.alive) {
      this.player.update(dt, this);
      
      // 吸收魂环
      if (this.player.absorbing) {
        const elapsed = Date.now() - this.player.absorbing.startTime;
        this.player.absorbing.progress = elapsed / CONFIG.RING.ABSORB_TIME;
        if (this.player.absorbing.progress >= 1) {
          const ring = this.player.absorbing.ring;
          const success = this.player.absorbRing({
            level: ring.level,
            beastType: ring.beastType
          });
          if (success) {
            ring.alive = false;
            UI.toast(`成功吸收${RING_DATA[ring.level].name}! 属性提升`, 'success');
            // 吸收特效
            this.effects.push({
              type: 'heal', x: this.player.x, y: this.player.y,
              targetX: this.player.x, targetY: this.player.y,
              startTime: Date.now(), duration: 600, color: RING_DATA[ring.level].color
            });
          }
          this.player.absorbing = null;
        }
      }
    } else {
      UI.showDeath();
    }
    
    // 魂兽更新
    for (const beast of this.beasts) {
      beast.update(dt, this);
    }
    
    // 魂兽间碰撞分离
    for (let i = 0; i < this.beasts.length; i++) {
      if (!this.beasts[i].alive) continue;
      for (let j = i + 1; j < this.beasts.length; j++) {
        if (!this.beasts[j].alive) continue;
        if (Physics.circleCollision(
          this.beasts[i].x, this.beasts[i].y, this.beasts[i].size/2,
          this.beasts[j].x, this.beasts[j].y, this.beasts[j].size/2
        )) {
          Physics.separate(this.beasts[i], [this.beasts[j]]);
        }
      }
    }
    
    // 清理死亡/消失的魂兽
    this.beasts = this.beasts.filter(b => {
      if (!b.alive) return false;
      const d = Physics.distance(b.x, b.y, this.player.x, this.player.y);
      return d < CONFIG.BEAST.DESPAWN_DIST;
    });
    
    // 生成新魂兽
    this.beastSpawnTimer += dt;
    if (this.beastSpawnTimer > CONFIG.BEAST.SPAWN_INTERVAL) {
      this.beastSpawnTimer = 0;
      this.spawnBeast();
    }
    
    // 魂环更新
    for (const ring of this.rings) {
      ring.update(dt);
    }
    this.rings = this.rings.filter(r => r.alive);
    
    // 特效更新
    this.effects = this.effects.filter(e => Date.now() - e.startTime < e.duration);
    
    // 伤害数字更新
    this.damageNumbers = this.damageNumbers.filter(d => {
      d.y -= 0.5;
      d.life -= dt;
      return d.life > 0;
    });
    
    // 相机跟随
    this.camera.x = Physics.lerp(this.camera.x, this.player.x - this.camera.width / 2, CONFIG.RENDER.CAMERA_LERP);
    this.camera.y = Physics.lerp(this.camera.y, this.player.y - this.camera.height / 2, CONFIG.RENDER.CAMERA_LERP);
    this.camera.x = Physics.clamp(this.camera.x, 0, CONFIG.WORLD.WIDTH - this.camera.width);
    this.camera.y = Physics.clamp(this.camera.y, 0, CONFIG.WORLD.HEIGHT - this.camera.height);
    
    // 更新HUD
    UI.updateHUD(this.player);
    
    // 自动保存
    this.autoSaveTimer += dt;
    if (this.autoSaveTimer > this.AUTO_SAVE_INTERVAL) {
      this.autoSaveTimer = 0;
      this.saveGame();
    }
    
    // 帧末清空输入
    Input.endFrame();
  },
  
  /**
   * 渲染
   */
  render() {
    const ctx = this.ctx;
    
    // 清屏
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (!this.player) return;
    
    // 渲染世界
    World.render(ctx, this.camera);
    
    // 渲染魂环(在实体下方)
    for (const ring of this.rings) {
      ring.render(ctx, this.camera);
    }
    
    // 渲染魂兽
    for (const beast of this.beasts) {
      beast.render(ctx, this.camera);
    }
    
    // 渲染玩家
    this.player.render(ctx, this.camera);
    
    // 渲染特效
    const now = Date.now();
    for (const effect of this.effects) {
      PixelArt.drawSkillEffect(ctx, effect, now);
    }
    
    // 渲染伤害数字
    for (const dn of this.damageNumbers) {
      const sx = dn.x - this.camera.x;
      const sy = dn.y - this.camera.y;
      ctx.globalAlpha = Math.min(1, dn.life / 500);
      ctx.font = `bold ${dn.crit ? 20 : 14}px Microsoft YaHei`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText(dn.text, sx + 1, sy + 1);
      ctx.fillStyle = dn.color;
      ctx.fillText(dn.text, sx, sy);
      ctx.globalAlpha = 1;
    }
    
    // 渲染小地图
    this.renderMinimap();
  },
  
  /**
   * 渲染小地图
   */
  renderMinimap() {
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const scaleX = w / CONFIG.WORLD.WIDTH;
    const scaleY = h / CONFIG.WORLD.HEIGHT;
    
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);
    
    // 简化地形(采样)
    const step = 8;
    for (let y = 0; y < this.minimapCanvas.height; y += step) {
      for (let x = 0; x < w; x += step) {
        const wx = x / scaleX;
        const wy = y / scaleY;
        const tx = Math.floor(wx / CONFIG.WORLD.TILE_SIZE);
        const ty = Math.floor(wy / CONFIG.WORLD.TILE_SIZE);
        if (tx < 0 || tx >= World.cols || ty < 0 || ty >= World.rows) continue;
        const terrainId = World.tiles[ty * World.cols + tx];
        ctx.fillStyle = World.getTerrainColor(terrainId);
        ctx.fillRect(x, y, step, step);
      }
    }
    
    // 魂兽(红点)
    for (const beast of this.beasts) {
      if (!beast.alive) continue;
      ctx.fillStyle = beast.ringLevel >= 3 ? '#a855f7' : (beast.ringLevel >= 2 ? '#fbbf24' : '#ef4444');
      ctx.fillRect(beast.x * scaleX - 1, beast.y * scaleY - 1, 3, 3);
    }
    
    // 魂环(闪烁)
    ctx.fillStyle = '#fff';
    for (const ring of this.rings) {
      if (!ring.alive) continue;
      const r = RING_DATA[ring.level].color;
      ctx.fillStyle = r;
      ctx.fillRect(ring.x * scaleX - 1, ring.y * scaleY - 1, 2, 2);
    }
    
    // 玩家(白色三角)
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(this.player.x * scaleX - 2, this.player.y * scaleY - 2, 4, 4);
    
    // 视野框
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      this.camera.x * scaleX,
      this.camera.y * scaleY,
      this.camera.width * scaleX,
      this.camera.height * scaleY
    );
  },
  
  /**
   * 生成伤害数字
   */
  spawnDamageNumber(x, y, value, crit, isDodge = false, isPlayerDamage = false) {
    this.damageNumbers.push({
      x, y,
      text: isDodge ? '闪避' : (crit ? `${value}!` : `${value}`),
      color: isDodge ? '#60a5fa' : (isPlayerDamage ? '#ef4444' : (crit ? '#fbbf24' : '#fff')),
      crit,
      life: 800
    });
  },
  
  /**
   * 暂停
   */
  pause() {
    this.paused = true;
    UI.showPause();
  },
  
  resume() {
    this.paused = false;
    UI.hidePause();
    this.lastTime = performance.now();
  },
  
  /**
   * 复活
   */
  revive(toSpawn) {
    if (toSpawn) {
      this.player.x = CONFIG.WORLD.WIDTH / 2;
      this.player.y = CONFIG.WORLD.HEIGHT / 2;
    }
    this.player.hp = this.player.maxHp;
    this.player.alive = true;
    this.player.invulnerableUntil = Date.now() + 3000; // 复活3秒无敌
    // 损失经验
    const lost = Math.floor(this.player.exp * CONFIG.PLAYER.REVIVE_EXP_LOSS);
    this.player.exp -= lost;
    UI.hideDeath();
    UI.toast(toSpawn ? '已回到重生点' : `原地复活,损失${lost}经验`, 'warning');
  },
  
  /**
   * 保存游戏
   */
  async saveGame() {
    if (!this.player) return;
    try {
      const res = await fetch('/api/player/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: this.player.id,
          data: this.player.serialize()
        })
      });
      return await res.json();
    } catch (e) {
      console.error('保存失败', e);
      UI.toast('保存失败', 'danger');
    }
  },
  
  /**
   * 加载游戏
   */
  async loadGame(playerId) {
    try {
      const res = await fetch(`/api/player/load/${playerId}`);
      const json = await res.json();
      if (!json.success) {
        UI.toast('无存档数据', 'danger');
        return;
      }
      const data = json.data;
      this.player = new Player(data.name, data.spirit);
      this.player.id = data.id;
      this.player.level = data.level;
      this.player.exp = data.exp;
      this.player.expToNext = data.expToNext;
      this.player.x = data.x;
      this.player.y = data.y;
      this.player.rings = data.rings || [];
      this.player.stats = data.stats || this.player.stats;
      this.player.recalcStats();
      this.player.hp = Math.min(data.hp, this.player.maxHp);
      
      this.beasts = [];
      this.rings = [];
      this.effects = [];
      this.damageNumbers = [];
      for (let i = 0; i < 15; i++) this.spawnBeast();
      
      UI.showScreen('game');
      this.running = true;
      this.paused = false;
      this.lastTime = performance.now();
      UI.toast(`欢迎回来, ${data.name}!`, 'success');
      this.startLoop();
    } catch (e) {
      console.error('加载失败', e);
      UI.toast('加载存档失败', 'danger');
    }
  },
  
  /**
   * 返回主菜单
   */
  quitToMenu() {
    this.running = false;
    this.paused = false;
    UI.hidePause();
    UI.showScreen('menu');
  }
};
