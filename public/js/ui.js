/**
 * UI 界面管理系统
 * 处理菜单切换、HUD更新、Toast提示
 */
const UI = {
  currentScreen: 'loading',
  spiritsData: null,
  selectedSpirit: null,
  _screenTransitionTimer: 0,
  _screenTransitionResolve: null,
  _overlayReturnFocus: new Map(),
  _loadingLoreTimer: 0,
  
  init() {
    // 获取所有screen
    this.screens = {
      loading: document.getElementById('loading-screen'),
      menu: document.getElementById('menu-screen'),
      spiritSelect: document.getElementById('spirit-select-screen'),
      game: document.getElementById('game-screen'),
      help: document.getElementById('help-screen')
    };
    Object.values(this.screens).forEach(screen => {
      if(screen && screen.classList.contains('active')) screen.classList.add('is-mounted');
    });
    
    this.bindEvents();
    this.startLoadingLore();
  },
  
  bindEvents() {
    // 主菜单
    document.getElementById('btn-new-game').addEventListener('click', () => {
      this.showScreen('spiritSelect');
      this.loadSpirits();
    });
    
    document.getElementById('btn-load-game').addEventListener('click', () => {
      this.loadSaveList();
    });
    
    document.getElementById('btn-help').addEventListener('click', () => {
      this.showScreen('help');
    });
    
    document.getElementById('btn-help-back').addEventListener('click', () => {
      this.showScreen('menu');
    });
    
    // 武魂选择
    document.getElementById('btn-confirm-spirit').addEventListener('click', () => {
      this.confirmSpirit();
    });
    
    document.getElementById('btn-back-menu').addEventListener('click', () => {
      this.showScreen('menu');
    });
    
    document.getElementById('player-name').addEventListener('input', () => {
      this.updateConfirmSpiritState();
    });
    
    // 游戏内
    document.getElementById('btn-resume').addEventListener('click', () => {
      Game.resume();
    });
    
    document.getElementById('btn-save').addEventListener('click', async () => {
      await Game.saveGame();
      this.toast('存档成功!', 'success');
    });
    
    document.getElementById('btn-quit').addEventListener('click', () => {
      if (confirm('返回主菜单?未保存的进度将丢失')) {
        Game.quitToMenu();
      }
    });
    
    document.getElementById('btn-revive').addEventListener('click', () => {
      Game.revive(false);
    });
    
    document.getElementById('btn-respawn').addEventListener('click', () => {
      Game.revive(true);
    });
    
    document.getElementById('btn-level-up-ok').addEventListener('click', () => {
      this.setOverlay('level-up-overlay', false);
    });
    document.addEventListener('keydown', event => this.trapOverlayFocus(event));
  },

  startLoadingLore() {
    const lore = document.getElementById('loading-lore');
    if (!lore) return;
    const lines = [
      '没有废物的武魂，只有尚未找到道路的魂师',
      '武魂觉醒，是每个魂师一生中最重要的时刻',
      '魂环承载魂兽之力，也考验着魂师的意志',
      '强者的道路，始于第一次勇敢的选择',
      '斗罗大陆的传说，正等待新的名字写入'
    ];
    let index = 0;
    this._loadingLoreTimer = window.setInterval(() => {
      if (this.currentScreen !== 'loading') return;
      lore.classList.add('changing');
      window.setTimeout(() => {
        index = (index + 1) % lines.length;
        lore.textContent = lines[index];
        lore.classList.remove('changing');
      }, 250);
    }, 2000);
  },

  updateConfirmSpiritState() {
    const name = document.getElementById('player-name').value.trim();
    const button = document.getElementById('btn-confirm-spirit');
    const wrap = button.closest('.confirm-spirit-wrap');
    button.disabled = !(name && this.selectedSpirit);
    const hint = !name && !this.selectedSpirit ? '请先选择武魂并输入名号' : !name ? '请先输入名号' : !this.selectedSpirit ? '请先选择武魂' : '可以确认武魂';
    button.title = hint;
    if (wrap) wrap.dataset.tooltip = hint;
  },
  
  showScreen(name, options = {}) {
    const target = this.screens[name];
    if (!target) return Promise.resolve(false);
    if (name !== 'loading' && this._loadingLoreTimer) {
      clearInterval(this._loadingLoreTimer);
      this._loadingLoreTimer = 0;
    }
    const current = Object.values(this.screens).find(screen => screen && screen.classList.contains('active'));
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const immediate = options.immediate || reduced;

    if (this._screenTransitionTimer) {
      clearTimeout(this._screenTransitionTimer);
      this._screenTransitionTimer = 0;
      Object.values(this.screens).forEach(screen => {
        if (!screen) return;
        screen.classList.remove('is-leaving');
        if (!screen.classList.contains('active')) screen.classList.remove('is-mounted');
      });
      if (this._screenTransitionResolve) this._screenTransitionResolve(false);
      this._screenTransitionResolve = null;
    }
    if (current === target) {
      target.classList.add('active', 'is-mounted');
      document.body.classList.remove('screen-transitioning');
      this.currentScreen = name;
      return Promise.resolve(true);
    }

    target.classList.add('is-mounted');
    target.classList.remove('is-leaving');
    void target.offsetWidth;
    if (current) {
      current.classList.add('is-leaving');
      current.classList.remove('active');
    }
    target.classList.add('active');
    document.body.classList.add('screen-transitioning');
    this.currentScreen = name;

    const finish = () => {
      if (current) current.classList.remove('is-leaving', 'is-mounted');
      target.classList.add('is-mounted');
      document.body.classList.remove('screen-transitioning');
      this._screenTransitionTimer = 0;
      this._screenTransitionResolve = null;
      return true;
    };
    if (immediate) {
      finish();
      return Promise.resolve(true);
    }
    return new Promise(resolve => {
      this._screenTransitionResolve = resolve;
      this._screenTransitionTimer = window.setTimeout(() => resolve(finish()), 250);
    });
  },

  trapOverlayFocus(event) {
    if (event.key !== 'Tab') return;
    const overlay = [...document.querySelectorAll('.overlay.show')].pop();
    if (!overlay) return;
    const focusable = [...overlay.querySelectorAll('button:not(:disabled),[href],input:not(:disabled),[tabindex]:not([tabindex="-1"])')].filter(element => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  },

  setOverlay(id, open, focusId) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    if (open) {
      this._overlayReturnFocus.set(id, document.activeElement);
      overlay.classList.add('show');
      overlay.setAttribute('aria-hidden', 'false');
      const focusTarget = focusId ? document.getElementById(focusId) : overlay.querySelector('button,[href],input,[tabindex]:not([tabindex="-1"])');
      if (focusTarget) requestAnimationFrame(() => focusTarget.focus());
    } else {
      overlay.classList.remove('show');
      overlay.setAttribute('aria-hidden', 'true');
      const returnFocus = this._overlayReturnFocus.get(id);
      this._overlayReturnFocus.delete(id);
      if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus();
    }
  },
  
  /**
   * 加载进度条
   */
  updateLoading(progress, text) {
    document.getElementById('loading-fill').style.width = progress + '%';
    if (text) document.getElementById('loading-text').textContent = text;
  },
  
  /**
   * 加载武魂数据并渲染选择界面
   */
  async loadSpirits() {
    try {
      const res = await fetch('/api/spirits');
      const json = await res.json();
      this.spiritsData = json.data.spirits;
      this.renderSpiritGrid();
    } catch (e) {
      console.error('加载武魂数据失败,使用本地数据', e);
      this.spiritsData = Object.entries(SPIRIT_DATA).map(([id, d]) => ({
        id, name: d.name, type: d.type, color: d.color, icon: d.icon,
        baseAttack: d.baseAttack, baseDefense: d.baseDefense,
        baseSpeed: d.baseSpeed, baseHp: d.baseHp,
        skill: { name: d.skill.name }, passive: d.passive,
        description: this.getSpiritDescription(id)
      }));
      this.renderSpiritGrid();
    }
  },
  
  getSpiritDescription(id) {
    const descs = {
      blue_silver_grass: '看似平凡的草,却蕴含无限可能。唐三的武魂,可缠绕敌人,随着魂环增加威力倍增。',
      haotian_hammer: '天下第一器武魂,一锤震天,拥有毁灭性的攻击力。',
      qisha_sword: '剑气纵横,七杀出鞘。攻击速度极快,剑剑致命。',
      youming_cat: '身形如电,来去无踪。速度极快,擅长突袭。',
      jiubao_pagoda: '辅助系顶级武魂,可增幅全属性,持续战斗能力强。初始为七层,进化后可达九层。',
      tyrant_dragon: '远古霸主之魂,拥有毁灭性的力量与坚不可摧的防御。龙啸震天,万物臣服。'
    };
    return descs[id] || '';
  },
  
  renderSpiritGrid() {
    const grid = document.getElementById('spirit-grid');
    grid.innerHTML = '';
    
    for (const spirit of this.spiritsData) {
      const iconUrl = spirit.icon || (SPIRIT_DATA[spirit.id] && SPIRIT_DATA[spirit.id].icon);
      const card = document.createElement('div');
      card.className = 'spirit-card';
      card.dataset.id = spirit.id;
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-pressed', 'false');
      card.setAttribute('aria-label', `选择武魂：${spirit.name}`);
      card.innerHTML = `
        <div class="spirit-icon" style="border:2px solid ${spirit.color}">
          ${iconUrl ? `<img src="${iconUrl}" alt="${spirit.name}" onerror="this.style.display='none'">` : ''}
        </div>
        <div class="spirit-name">${spirit.name}</div>
        <div class="spirit-type">${spirit.type}</div>
      `;
      
      const selectSpirit = () => {
        this.selectedSpirit = spirit.id;
        document.querySelectorAll('.spirit-card').forEach(c => {
          c.classList.remove('selected');
          c.setAttribute('aria-pressed', 'false');
        });
        card.classList.add('selected');
        card.setAttribute('aria-pressed', 'true');
        this.showSpiritDetail(spirit);
        this.updateConfirmSpiritState();
      };
      card.addEventListener('mouseenter', () => this.showSpiritDetail(spirit));
      card.addEventListener('focus', () => this.showSpiritDetail(spirit));
      card.addEventListener('click', selectSpirit);
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectSpirit();
        }
      });
      
      grid.appendChild(card);
    }
  },
  
  showSpiritDetail(spirit) {
    const detail = document.getElementById('spirit-detail');
    const sd = SPIRIT_DATA[spirit.id];
    const iconUrl = spirit.icon || (sd && sd.icon);
    detail.innerHTML = `
      <div class="detail-header" style="display:flex;gap:20px;align-items:center;margin-bottom:12px;">
        ${iconUrl ? `<div class="detail-spirit-icon" style="width:90px;height:90px;border-radius:50%;overflow:visible;border:2px solid ${spirit.color};flex-shrink:0;background:rgba(0,0,0,0.5);position:relative;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;top:-5px;left:-5px;right:-5px;bottom:-5px;border-radius:50%;background:conic-gradient(from 0deg, transparent 0%, ${spirit.color} 25%, transparent 50%, ${spirit.color} 75%, transparent 100%);animation:ring-spin 2.5s linear infinite;opacity:0.7;"></div>
          <img src="${iconUrl}" alt="${spirit.name}" style="width:100%;height:100%;object-fit:cover;mix-blend-mode:lighten;border-radius:50%;position:relative;z-index:1;" onerror="this.parentElement.style.display='none'">
        </div>` : ''}
        <div>
          <div class="detail-name" style="color:${spirit.color}">${spirit.name}</div>
          <span class="detail-type">${spirit.type}</span>
        </div>
      </div>
      <div class="detail-desc">${spirit.description || `${spirit.name} - ${spirit.passive}`}</div>
      <div class="detail-stats">
        <div class="stat-item">攻击 <span>${spirit.baseAttack}</span></div>
        <div class="stat-item">防御 <span>${spirit.baseDefense}</span></div>
        <div class="stat-item">速度 <span>${spirit.baseSpeed}</span></div>
        <div class="stat-item">生命 <span>${spirit.baseHp}</span></div>
      </div>
      <div class="detail-skill">
        <span class="skill-label">技能: ${sd.skill.name}</span><br>
        <span style="color:#9ca3af;font-size:12px">被动: ${spirit.passive}</span>
      </div>
    `;
  },
  
  confirmSpirit() {
    const name = document.getElementById('player-name').value.trim();
    if (!name || !this.selectedSpirit) return;
    Game.startNewGame(name, this.selectedSpirit);
  },
  
  /**
   * 加载存档列表
   */
  async loadSaveList() {
    try {
      const res = await fetch('/api/player/list');
      const json = await res.json();
      const list = document.getElementById('save-list');
      list.innerHTML = '';
      
      if (json.list.length === 0) {
        list.innerHTML = '<div class="save-empty"><div class="save-empty-icon" aria-hidden="true">📜</div><strong>尚无存档</strong><span>开始你的冒险吧！</span></div>';
      } else {
        for (const save of json.list) {
          const item = document.createElement('div');
          item.className = 'save-item';
          item.innerHTML = `
            <div>
              <div style="font-weight:bold">${save.name} (Lv.${save.level})</div>
              <div style="font-size:12px;color:#9ca3af">${save.spirit} | ${save.lastSave ? new Date(save.lastSave).toLocaleString('zh-CN') : ''}</div>
            </div>
            <button class="btn btn-primary" style="min-width:80px;font-size:14px">读取</button>
          `;
          item.querySelector('button').addEventListener('click', (e) => {
            e.stopPropagation();
            Game.loadGame(save.playerId);
          });
          item.addEventListener('click', () => Game.loadGame(save.playerId));
          list.appendChild(item);
        }
      }
      list.classList.remove('hidden');
    } catch (e) {
      this.toast('加载存档列表失败', 'danger');
    }
  },
  
  /**
   * 更新HUD
   */
  updateHUD(player) {
    document.getElementById('hud-name').textContent = player.name;
    document.getElementById('hud-level').textContent = player.level;
    document.getElementById('hud-spirit').textContent = player.spirit.name;
    
    // HP
    const hpPct = (player.hp / player.maxHp) * 100;
    document.getElementById('hud-hp').style.width = hpPct + '%';
    document.getElementById('hud-hp-text').textContent = `${Math.floor(player.hp)}/${player.maxHp}`;
    
    // EXP
    const expPct = (player.exp / player.expToNext) * 100;
    document.getElementById('hud-exp').style.width = expPct + '%';
    document.getElementById('hud-exp-text').textContent = `${player.exp}/${player.expToNext}`;
    
    // 魂环
    const ringsEl = document.getElementById('hud-rings');
    ringsEl.innerHTML = '';
    for (const ring of player.rings) {
      const rd = RING_DATA[ring.level];
      const el = document.createElement('div');
      el.className = 'hud-ring';
      el.style.background = rd.color;
      el.style.color = rd.color;
      el.title = rd.name;
      ringsEl.appendChild(el);
    }
    // 显示空槽位
    const maxRings = CONFIG.PLAYER.MAX_RINGS;
    for (let i = player.rings.length; i < maxRings; i++) {
      const el = document.createElement('div');
      el.className = 'hud-ring';
      el.style.background = 'rgba(0,0,0,0.3)';
      el.style.border = '2px dashed #444';
      ringsEl.appendChild(el);
    }
    
    // 技能
    const skill = player.getSkill();
    document.getElementById('skill-name').textContent = skill.name;
    const cdEl = document.getElementById('skill-cooldown');
    if (player.skillCooldown > 0) {
      cdEl.classList.add('active');
      cdEl.textContent = (player.skillCooldown / 1000).toFixed(1);
    } else {
      cdEl.classList.remove('active');
    }
  },
  
  /**
   * Toast 提示
   */
  toast(message, type = '') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2400);
  },
  
  /**
   * 升级提示
   */
  showLevelUp(newLevel, gains) {
    const text = document.getElementById('level-up-text');
    gains = gains || (Game.player && Game.player.lastLevelUp) || {};
    const values = [
      ['攻击', gains.attack || 0], ['防御', gains.defense || 0],
      ['生命', gains.hp || 0], ['速度', gains.speed || 0]
    ];
    const growth = values.map(([label, value]) => `<span class="level-gain">${label} <b>+${value}</b></span>`).join('');
    const skillLine = gains.skill ? `<br><span class="level-skill">新技能解锁：${gains.skill}</span>` : '';
    text.innerHTML = `恭喜达到 <strong style="color:var(--primary)">Lv.${newLevel}</strong>！<br><span class="level-gains">${growth}</span><br>生命已回满${skillLine}`;
    this.setOverlay('level-up-overlay', true, 'btn-level-up-ok');
    this.toast(`升级到 Lv.${newLevel}!`, 'success');
  },
  
  /**
   * 显示死亡界面
   */
  showDeath() {
    this.setOverlay('death-overlay', true, 'btn-revive');
  },
  
  hideDeath() {
    this.setOverlay('death-overlay', false);
  },
  
  showPause() {
    this.setOverlay('pause-menu', true, 'btn-resume');
  },
  
  hidePause() {
    this.setOverlay('pause-menu', false);
  }
};
