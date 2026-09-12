/**
 * 斗罗大陆·武魂觉醒 —— 视觉引擎与音频引擎
 * 包含: 粒子系统、屏幕特效、音频合成引擎
 * 依赖: 无 (纯原生实现)
 */
'use strict';

// ==================== 粒子系统 ====================
const ParticleEngine = (function(){
  const canvas = document.getElementById('particle-canvas');
  if(!canvas) return { start(){}, stop(){}, emit(){}, setBackground(){}, clear(){} };
  const ctx = canvas.getContext('2d');
  let particles = [];
  let bgParticles = [];
  let running = false;
  let lastTime = 0;
  let frameCount = 0;
  let bgType = 'default'; // default, forest, fire, ice, thunder, holy, dark
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lowPowerDevice = prefersReducedMotion || window.innerWidth <= 768 || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  let maxParticles = lowPowerDevice ? 35 : 80;
  let maxBgParticles = lowPowerDevice ? 10 : 25;
  let fpsHistory = [];
  let sampleElapsed = 0;
  let sampleFrames = 0;
  if(lowPowerDevice) document.body.classList.add('low-effects');

  function resize(){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // 粒子类
  class Particle {
    constructor(opts){
      this.x = opts.x || 0;
      this.y = opts.y || 0;
      this.vx = opts.vx || 0;
      this.vy = opts.vy || 0;
      this.gravity = opts.gravity || 0;
      this.friction = opts.friction || 0.98;
      this.life = opts.life || 60;
      this.maxLife = this.life;
      this.size = opts.size || 3;
      this.color = opts.color || '#c9a84c';
      this.glow = opts.glow !== false;
      this.shape = opts.shape || 'circle'; // circle, square, star
      this.fadeOut = opts.fadeOut !== false;
      this.shrink = opts.shrink !== false;
      this.rotation = opts.rotation || 0;
      this.rotSpeed = opts.rotSpeed || 0;
    }

    update(){
      this.x += this.vx;
      this.y += this.vy;
      this.vy += this.gravity;
      this.vx *= this.friction;
      this.vy *= this.friction;
      this.rotation += this.rotSpeed;
      this.life--;
    }

    draw(ctx){
      const alpha = this.fadeOut ? this.life / this.maxLife : 1;
      const sz = this.shrink ? this.size * (this.life / this.maxLife) : this.size;
      if(sz < 0.5) return;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      if(this.glow){
        ctx.shadowBlur = sz * 3;
        ctx.shadowColor = this.color;
      }
      ctx.fillStyle = this.color;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);

      if(this.shape === 'circle'){
        ctx.beginPath();
        ctx.arc(0, 0, sz, 0, Math.PI * 2);
        ctx.fill();
      } else if(this.shape === 'square'){
        ctx.fillRect(-sz, -sz, sz * 2, sz * 2);
      } else if(this.shape === 'star'){
        drawStar(ctx, 0, 0, 5, sz, sz * 0.5);
        ctx.fill();
      }
      ctx.restore();
    }

    get dead(){ return this.life <= 0; }
  }

  function drawStar(ctx, cx, cy, spikes, outerR, innerR){
    let rot = -Math.PI / 2;
    const step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR);
    for(let i = 0; i < spikes; i++){
      let x = cx + Math.cos(rot) * outerR;
      let y = cy + Math.sin(rot) * outerR;
      ctx.lineTo(x, y);
      rot += step;
      x = cx + Math.cos(rot) * innerR;
      y = cy + Math.sin(rot) * innerR;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.closePath();
  }

  // 背景粒子生成
  function genBgParticle(){
    const types = {
      default: () => ({
        x: Math.random() * canvas.width,
        y: canvas.height + 10,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.3 - Math.random() * 0.5,
        size: 1 + Math.random() * 2,
        color: 'rgba(201,168,76,0.6)',
        life: 300 + Math.random() * 200,
        gravity: 0,
        friction: 1,
        glow: true
      }),
      forest: () => ({
        x: Math.random() * canvas.width,
        y: -10,
        vx: (Math.random() - 0.5) * 0.5,
        vy: 0.3 + Math.random() * 0.4,
        size: 2 + Math.random() * 3,
        color: `rgba(${100+Math.random()*50},${150+Math.random()*50},${60+Math.random()*40},0.5)`,
        life: 400,
        gravity: 0.005,
        friction: 0.99,
        glow: false,
        shape: 'square',
        rotation: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 0.05
      }),
      fire: () => ({
        x: Math.random() * canvas.width,
        y: canvas.height + 10,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.5 - Math.random() * 1.2,
        size: 2 + Math.random() * 3,
        color: `rgba(${200+Math.random()*55},${80+Math.random()*80},${20+Math.random()*40},0.6)`,
        life: 80 + Math.random() * 60,
        gravity: -0.02,
        friction: 0.98,
        glow: true
      }),
      ice: () => ({
        x: Math.random() * canvas.width,
        y: -10,
        vx: (Math.random() - 0.5) * 0.3,
        vy: 0.2 + Math.random() * 0.4,
        size: 1 + Math.random() * 2,
        color: `rgba(${180+Math.random()*60},${200+Math.random()*55},${255},0.5)`,
        life: 500,
        gravity: 0.003,
        friction: 0.99,
        glow: true
      }),
      thunder: () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: 0, vy: 0,
        size: 1 + Math.random() * 2,
        color: `rgba(${180+Math.random()*60},${130+Math.random()*80},${255},0.7)`,
        life: 20 + Math.random() * 30,
        gravity: 0,
        friction: 1,
        glow: true
      }),
      holy: () => ({
        x: Math.random() * canvas.width,
        y: canvas.height + 10,
        vx: (Math.random() - 0.5) * 0.2,
        vy: -0.3 - Math.random() * 0.4,
        size: 2 + Math.random() * 4,
        color: `rgba(255,${215+Math.random()*40},${100+Math.random()*50},0.6)`,
        life: 250 + Math.random() * 150,
        gravity: 0,
        friction: 1,
        glow: true,
        shape: Math.random() > 0.7 ? 'star' : 'circle',
        rotation: 0,
        rotSpeed: 0.01
      }),
      dark: () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        size: 3 + Math.random() * 5,
        color: `rgba(${60+Math.random()*40},${20+Math.random()*30},${40+Math.random()*40},0.3)`,
        life: 200 + Math.random() * 100,
        gravity: 0,
        friction: 0.99,
        glow: false
      })
    };
    const gen = types[bgType] || types.default;
    return new Particle(gen());
  }

  // 预设特效
  const presets = {
    // 灵力爆发(技能释放)
    spiritBurst(x, y, color){
      color = color || '#c9a84c';
      for(let i = 0; i < 24; i++){
        const angle = (Math.PI * 2 * i) / 24;
        const speed = 2 + Math.random() * 4;
        particles.push(new Particle({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 3 + Math.random() * 3,
          color,
          life: 30 + Math.random() * 20,
          gravity: 0.05,
          friction: 0.94,
          glow: true,
          shape: Math.random() > 0.5 ? 'star' : 'circle',
          rotation: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 0.2
        }));
      }
    },
    // 火焰特效
    fireBurst(x, y){
      for(let i = 0; i < 20; i++){
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
        const speed = 1 + Math.random() * 4;
        particles.push(new Particle({
          x: x + (Math.random() - 0.5) * 20,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 4 + Math.random() * 4,
          color: `rgba(${200+Math.random()*55},${80+Math.random()*100},${20+Math.random()*40},0.8)`,
          life: 40 + Math.random() * 30,
          gravity: -0.05,
          friction: 0.96,
          glow: true
        }));
      }
    },
    // 冰冻特效
    iceBurst(x, y){
      for(let i = 0; i < 16; i++){
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        particles.push(new Particle({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 3 + Math.random() * 4,
          color: `rgba(${150+Math.random()*100},${200+Math.random()*55},255,0.8)`,
          life: 50 + Math.random() * 30,
          gravity: 0.02,
          friction: 0.95,
          glow: true,
          shape: Math.random() > 0.5 ? 'square' : 'circle',
          rotation: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 0.15
        }));
      }
    },
    // 雷电特效
    thunderBurst(x, y){
      for(let i = 0; i < 30; i++){
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 6;
        particles.push(new Particle({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 1 + Math.random() * 3,
          color: `rgba(${180+Math.random()*75},${130+Math.random()*100},${255},0.9)`,
          life: 15 + Math.random() * 15,
          gravity: 0,
          friction: 0.88,
          glow: true
        }));
      }
    },
    // 神圣金光
    holyBurst(x, y){
      for(let i = 0; i < 30; i++){
        const angle = (Math.PI * 2 * i) / 30;
        const speed = 1 + Math.random() * 3;
        particles.push(new Particle({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1,
          size: 3 + Math.random() * 5,
          color: `rgba(255,${215+Math.random()*40},${100+Math.random()*80},0.8)`,
          life: 60 + Math.random() * 40,
          gravity: 0.01,
          friction: 0.97,
          glow: true,
          shape: 'star',
          rotation: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 0.1
        }));
      }
    },
    // 暗影特效
    darkBurst(x, y){
      for(let i = 0; i < 20; i++){
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        particles.push(new Particle({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 5 + Math.random() * 5,
          color: `rgba(${40+Math.random()*30},${15+Math.random()*25},${35+Math.random()*30},0.6)`,
          life: 40 + Math.random() * 30,
          gravity: 0.02,
          friction: 0.95,
          glow: false
        }));
      }
    },
    // 升级特效
    levelUp(x, y){
      for(let i = 0; i < 40; i++){
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
        const speed = 2 + Math.random() * 5;
        particles.push(new Particle({
          x: x + (Math.random() - 0.5) * 60,
          y,
          vx: Math.cos(angle) * speed * 0.3,
          vy: Math.sin(angle) * speed,
          size: 3 + Math.random() * 4,
          color: `rgba(255,${215+Math.random()*40},${50+Math.random()*80},0.9)`,
          life: 80 + Math.random() * 40,
          gravity: -0.03,
          friction: 0.98,
          glow: true,
          shape: Math.random() > 0.6 ? 'star' : 'circle'
        }));
      }
    },
    // 治疗特效
    heal(x, y){
      for(let i = 0; i < 16; i++){
        particles.push(new Particle({
          x: x + (Math.random() - 0.5) * 40,
          y: y + 20,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -1 - Math.random() * 2,
          size: 3 + Math.random() * 3,
          color: `rgba(${80+Math.random()*60},${200+Math.random()*55},${110+Math.random()*40},0.8)`,
          life: 50 + Math.random() * 30,
          gravity: -0.01,
          friction: 0.98,
          glow: true
        }));
      }
    },
    // 击中特效
    hit(x, y, color){
      color = color || '#fff';
      for(let i = 0; i < 12; i++){
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        particles.push(new Particle({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 2 + Math.random() * 3,
          color,
          life: 15 + Math.random() * 15,
          gravity: 0.1,
          friction: 0.92,
          glow: true
        }));
      }
    },
    // 金币掉落
    coinDrop(x, y){
      for(let i = 0; i < 8; i++){
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
        const speed = 2 + Math.random() * 3;
        particles.push(new Particle({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 3 + Math.random() * 2,
          color: 'rgba(255,215,0,0.9)',
          life: 40 + Math.random() * 20,
          gravity: 0.15,
          friction: 0.97,
          glow: true,
          shape: 'circle'
        }));
      }
    },
    // 元素反应：蒸汽爆发
    steamBurst(x, y){
      for(let i = 0; i < 25; i++){
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        particles.push(new Particle({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1,
          size: 6 + Math.random() * 8,
          color: `rgba(${200+Math.random()*55},${200+Math.random()*55},${200+Math.random()*55},${0.3+Math.random()*0.3})`,
          life: 50 + Math.random() * 30,
          gravity: -0.02,
          friction: 0.96,
          glow: false,
          shape: 'circle'
        }));
      }
    },
    // 元素反应：冻结
    freezeBurst(x, y){
      for(let i = 0; i < 20; i++){
        const angle = (Math.PI * 2 * i) / 20;
        const speed = 2 + Math.random() * 3;
        particles.push(new Particle({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 4 + Math.random() * 4,
          color: `rgba(${150+Math.random()*100},${220+Math.random()*35},255,0.85)`,
          life: 45 + Math.random() * 25,
          gravity: 0.05,
          friction: 0.93,
          glow: true,
          shape: Math.random() > 0.4 ? 'square' : 'star',
          rotation: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 0.2
        }));
      }
    },
    // 元素反应：超导
    superconductBurst(x, y){
      for(let i = 0; i < 35; i++){
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 7;
        particles.push(new Particle({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 1 + Math.random() * 3,
          color: `rgba(${100+Math.random()*155},${180+Math.random()*75},255,0.9)`,
          life: 20 + Math.random() * 20,
          gravity: 0,
          friction: 0.88,
          glow: true,
          shape: Math.random() > 0.5 ? 'star' : 'circle'
        }));
      }
    },
    // 元素反应：感电连锁
    electroChain(x, y){
      for(let i = 0; i < 28; i++){
        const angle = (Math.PI * 2 * i) / 28;
        const speed = 2 + Math.random() * 4;
        particles.push(new Particle({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 2 + Math.random() * 3,
          color: `rgba(${200+Math.random()*55},${220+Math.random()*35},${100+Math.random()*100},0.9)`,
          life: 25 + Math.random() * 20,
          gravity: 0.02,
          friction: 0.91,
          glow: true,
          shape: 'circle'
        }));
      }
    },
    // 元素反应：沙暴
    sandstorm(x, y){
      for(let i = 0; i < 30; i++){
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 4;
        particles.push(new Particle({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 3 + Math.random() * 4,
          color: `rgba(${180+Math.random()*50},${150+Math.random()*50},${80+Math.random()*40},0.6)`,
          life: 50 + Math.random() * 30,
          gravity: 0.01,
          friction: 0.95,
          glow: false,
          shape: 'circle'
        }));
      }
    },
    // 元素反应：审判之光
    judgmentLight(x, y){
      // 下落光柱
      for(let i = 0; i < 40; i++){
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 2;
        particles.push(new Particle({
          x: x + (Math.random() - 0.5) * 80,
          y: y - 60 + Math.random() * 20,
          vx: Math.cos(angle) * speed * 0.3,
          vy: Math.sin(angle) * speed + 2,
          size: 3 + Math.random() * 5,
          color: `rgba(255,${235+Math.random()*20},${150+Math.random()*80},0.85)`,
          life: 40 + Math.random() * 30,
          gravity: 0.1,
          friction: 0.97,
          glow: true,
          shape: 'star',
          rotation: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 0.15
        }));
      }
    },
    // 连携终结技
    finisherBurst(x, y){
      // 环形冲击波
      for(let i = 0; i < 50; i++){
        const angle = (Math.PI * 2 * i) / 50;
        const speed = 4 + Math.random() * 6;
        particles.push(new Particle({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 3 + Math.random() * 4,
          color: `hsl(${Math.random() * 60 + 30}, 100%, ${50 + Math.random() * 30}%)`,
          life: 30 + Math.random() * 30,
          gravity: 0.02,
          friction: 0.92,
          glow: true,
          shape: Math.random() > 0.4 ? 'star' : 'circle',
          rotation: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 0.25
        }));
      }
      // 中心爆发
      for(let i = 0; i < 20; i++){
        particles.push(new Particle({
          x, y,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          size: 8 + Math.random() * 6,
          color: `rgba(255,${200+Math.random()*55},${50+Math.random()*100},0.7)`,
          life: 20 + Math.random() * 15,
          gravity: 0,
          friction: 0.85,
          glow: true,
          shape: 'circle'
        }));
      }
    },
    // 武魂融合特效
    fusionBurst(x, y){
      // 螺旋上升
      for(let i = 0; i < 45; i++){
        const angle = (Math.PI * 2 * i) / 45;
        const radius = 20 + Math.random() * 30;
        const speed = 2 + Math.random() * 3;
        particles.push(new Particle({
          x: x + Math.cos(angle) * radius,
          y: y + Math.sin(angle) * radius,
          vx: Math.cos(angle + Math.PI / 2) * speed,
          vy: Math.sin(angle + Math.PI / 2) * speed - 2,
          size: 4 + Math.random() * 4,
          color: `hsl(${Math.random() * 360}, 80%, ${60 + Math.random() * 20}%)`,
          life: 60 + Math.random() * 40,
          gravity: -0.02,
          friction: 0.98,
          glow: true,
          shape: 'star',
          rotation: angle,
          rotSpeed: 0.1
        }));
      }
    },
    // 极限突破特效
    limitBreakBurst(x, y){
      // 爆发性环形扩散
      for(let i = 0; i < 60; i++){
        const angle = (Math.PI * 2 * i) / 60;
        const speed = 5 + Math.random() * 8;
        particles.push(new Particle({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 4 + Math.random() * 5,
          color: `rgba(255,${100+Math.random()*100},${50+Math.random()*100},0.9)`,
          life: 35 + Math.random() * 25,
          gravity: 0.03,
          friction: 0.90,
          glow: true,
          shape: Math.random() > 0.5 ? 'star' : 'circle'
        }));
      }
      // 上升光柱
      for(let i = 0; i < 25; i++){
        particles.push(new Particle({
          x: x + (Math.random() - 0.5) * 60,
          y,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -3 - Math.random() * 4,
          size: 5 + Math.random() * 5,
          color: `rgba(255,${200+Math.random()*55},${100+Math.random()*80},0.8)`,
          life: 50 + Math.random() * 30,
          gravity: -0.05,
          friction: 0.99,
          glow: true,
          shape: 'star'
        }));
      }
    },
    // 签到特效
    signReward(x, y){
      for(let i = 0; i < 20; i++){
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
        const speed = 2 + Math.random() * 4;
        particles.push(new Particle({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 3 + Math.random() * 4,
          color: `rgba(${200+Math.random()*55},${150+Math.random()*80},${200+Math.random()*55},0.85)`,
          life: 50 + Math.random() * 30,
          gravity: 0.08,
          friction: 0.97,
          glow: true,
          shape: 'star',
          rotation: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 0.15
        }));
      }
    },
    // 锻造成功特效
    forgeSuccess(x, y){
      for(let i = 0; i < 30; i++){
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 5;
        particles.push(new Particle({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 3 + Math.random() * 4,
          color: `rgba(${255},${180+Math.random()*75},${50+Math.random()*60},0.85)`,
          life: 40 + Math.random() * 25,
          gravity: 0.1,
          friction: 0.95,
          glow: true,
          shape: Math.random() > 0.5 ? 'star' : 'square',
          rotation: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 0.2
        }));
      }
    }
  };

  function tick(time){
    if(!running) return;
    const dt = time - lastTime;
    lastTime = time;
    frameCount++;
    sampleElapsed += Math.min(dt, 100);
    sampleFrames++;

    // 每约 0.5 秒按实际时间窗口采样，避免用单帧抖动误判性能。
    if(sampleElapsed >= 500){
      const fps = sampleFrames * 1000 / sampleElapsed;
      fpsHistory.push(fps);
      if(fpsHistory.length > 8) fpsHistory.shift();
      const avgFps = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;
      if(avgFps < 35){
        maxParticles = Math.max(25, maxParticles - 15);
        maxBgParticles = Math.max(6, maxBgParticles - 5);
        document.body.classList.add('low-effects');
      } else if(avgFps > 55 && !lowPowerDevice){
        maxParticles = Math.min(140, maxParticles + 8);
        maxBgParticles = Math.min(45, maxBgParticles + 3);
        if(avgFps > 58) document.body.classList.remove('low-effects');
      }
      sampleElapsed = 0;
      sampleFrames = 0;
    }

    // 30fps cap for background particles
    const shouldGenBg = frameCount % 3 === 0;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 背景粒子
    if(shouldGenBg && bgParticles.length < maxBgParticles){
      bgParticles.push(genBgParticle());
    }
    bgParticles = bgParticles.filter(p => {
      p.update();
      p.draw(ctx);
      return !p.dead && p.y > -50 && p.y < canvas.height + 50 && p.x > -50 && p.x < canvas.width + 50;
    });

    // 前景特效粒子（限制最大数量）
    if(particles.length > maxParticles){
      particles = particles.slice(-maxParticles);
    }
    particles = particles.filter(p => {
      p.update();
      p.draw(ctx);
      return !p.dead;
    });

    requestAnimationFrame(tick);
  }

  return {
    start(){
      if(running) return;
      running = true;
      lastTime = performance.now();
      requestAnimationFrame(tick);
    },
    stop(){ running = false; },
    isRunning(){ return running; },
    enable(){
      start();
      try{ localStorage.setItem('dldl_particles_enabled', 'true'); }catch(e){}
    },
    disable(){
      stop();
      try{ localStorage.setItem('dldl_particles_enabled', 'false'); }catch(e){}
    },
    emit(preset, x, y, color){
      if(presets[preset]) presets[preset](x, y, color);
    },
    setBackground(type){ bgType = type || 'default'; },
    clear(){
      particles = [];
      bgParticles = [];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
    setQuality(level){
      const table = { low:[35,10], normal:[80,25], high:[140,45] };
      const values = table[level] || table.normal;
      maxParticles = values[0];
      maxBgParticles = values[1];
      if(particles.length > maxParticles) particles = particles.slice(-maxParticles);
      if(bgParticles.length > maxBgParticles) bgParticles = bgParticles.slice(-maxBgParticles);
    },
    get canvas(){ return canvas; }
  };
})();

// ==================== 屏幕特效 ====================
const VisualFX = (function(){
  const flashOverlay = document.getElementById('flash-overlay');
  const transitionOverlay = document.getElementById('transition-overlay');
  const dmgLayer = document.getElementById('dmg-layer');
  const comboDisplay = document.getElementById('combo-display');
  const battleArea = document.getElementById('battle-area');
  const app = document.getElementById('app');
  let comboCount = 0;
  let comboTimer = null;

  // 全屏闪光
  function flash(color, duration){
    if(!flashOverlay) return;
    duration = duration || 150;
    flashOverlay.className = 'flash-' + (color || 'white');
    setTimeout(() => {
      flashOverlay.className = '';
    }, duration);
  }

  // 屏幕震动
  function shake(intensity){
    intensity = intensity || 'light';
    const target = battleArea || app;
    if(!target) return;
    target.classList.remove('shake-light', 'shake-heavy');
    void target.offsetWidth;
    target.classList.add('shake-' + intensity);
    setTimeout(() => target.classList.remove('shake-' + intensity), intensity === 'heavy' ? 400 : 250);
  }

  // 浮动伤害数字
  function showDamage(x, y, value, type){
    if(!dmgLayer) return;
    type = type || 'normal';
    const el = document.createElement('div');
    el.className = 'dmg-num ' + type;
    if(type === 'miss'){
      el.textContent = '闪避';
    } else if(type === 'heal'){
      el.textContent = '+' + value;
    } else if(type === 'status'){
      el.textContent = value;
    } else {
      el.textContent = value;
    }
    // 随机偏移避免重叠
    const offsetX = (Math.random() - 0.5) * 40;
    el.style.left = (x + offsetX) + 'px';
    el.style.top = y + 'px';
    dmgLayer.appendChild(el);
    setTimeout(() => el.remove(), type === 'crit' ? 1300 : 1100);
  }

  // 连击系统
  function addCombo(){
    comboCount++;
    if(comboDisplay){
      comboDisplay.classList.add('show');
      const num = comboDisplay.querySelector('.combo-num');
      num.textContent = comboCount;
      num.style.animation = 'none';
      void num.offsetWidth;
      num.style.animation = '';
    }
    clearTimeout(comboTimer);
    comboTimer = setTimeout(() => {
      comboCount = 0;
      if(comboDisplay) comboDisplay.classList.remove('show');
    }, 3500);
    return comboCount;
  }

  function resetCombo(){
    comboCount = 0;
    clearTimeout(comboTimer);
    if(comboDisplay) comboDisplay.classList.remove('show');
  }

  function getCombo(){ return comboCount; }

  // 场景过渡 - 温和的书页效果
  function transition(callback, rune){
    if(!transitionOverlay){
      if(callback) callback();
      return;
    }
    const runeEl = transitionOverlay.querySelector('.trans-rune');
    if(rune && runeEl) runeEl.textContent = rune;
    transitionOverlay.classList.add('active');
    setTimeout(() => {
      try{
        if(callback) callback();
      }catch(error){
        console.error('场景切换失败:', error);
      }finally{
        // 无论场景渲染是否报错，都必须释放透明遮罩，避免整个页面无法点击
        setTimeout(() => {
          transitionOverlay.classList.remove('active');
        }, 50);
      }
    }, 150);
  }

  // 成就横幅采用队列，防止连续解锁时内容被覆盖，也避免与升级通知重叠。
  const achievementQueue = [];
  let achievementActive = false;
  function pumpAchievementQueue(){
    if(achievementActive || !achievementQueue.length) return;
    const banner = document.getElementById('achievement-banner');
    if(!banner){ achievementQueue.length = 0; return; }
    const item = achievementQueue.shift();
    achievementActive = true;
    banner.querySelector('.ach-icon').textContent = item.icon;
    banner.querySelector('.ach-name').textContent = item.name;
    banner.querySelector('.ach-desc').textContent = item.desc;
    banner.classList.add('show');
    AudioFX.playSfx('achievement');
    setTimeout(() => {
      banner.classList.remove('show');
      setTimeout(() => { achievementActive = false; pumpAchievementQueue(); }, 520);
    }, 2800);
  }
  function showAchievement(name, desc, icon){
    achievementQueue.push({ name, desc:desc || '', icon:icon || '🏆' });
    pumpAchievementQueue();
  }
  function isAchievementActive(){ return achievementActive || achievementQueue.length > 0; }
  function resetNotifications(){
    achievementQueue.length = 0;
    const banner = document.getElementById('achievement-banner');
    if(banner){
      banner.classList.remove('show');
      banner.querySelector('.ach-icon').textContent = '🏆';
      banner.querySelector('.ach-name').textContent = '';
      banner.querySelector('.ach-desc').textContent = '';
    }
  }

  // 获取战斗区域中心坐标
  function getBattleCenter(){
    if(!battleArea) return { x: 0, y: 0 };
    const rect = battleArea.getBoundingClientRect();
    return { x: rect.width / 2, y: rect.height / 2 };
  }

  // 获取敌方图片坐标
  function getEnemyPos(){
    const el = document.getElementById('enemy-img');
    if(!el) return { x: 100, y: 100 };
    const rect = el.getBoundingClientRect();
    const battleRect = battleArea.getBoundingClientRect();
    return {
      x: rect.left - battleRect.left + rect.width / 2,
      y: rect.top - battleRect.top + rect.height / 2
    };
  }

  // 获取玩家区域坐标(战斗中用battle-log位置近似)
  function getPlayerPos(){
    const el = document.getElementById('battle-log');
    if(!el) return { x: 200, y: 300 };
    const rect = el.getBoundingClientRect();
    const battleRect = battleArea.getBoundingClientRect();
    return {
      x: rect.left - battleRect.left + rect.width / 2,
      y: rect.top - battleRect.top + 30
    };
  }

  // 浮动状态文字（如"暴击！"、"闪避！"等）
  function showFloatingText(x, y, text, color, size){
    if(!dmgLayer) return;
    const el = document.createElement('div');
    el.className = 'floating-status-text';
    el.textContent = text;
    el.style.cssText = `position:absolute;left:${x}px;top:${y}px;color:${color || '#ffdd44'};font-size:${size || 18}px;font-family:'Ma Shan Zheng',serif;font-weight:bold;text-shadow:0 0 8px ${color || '#ffdd44'},0 2px 4px rgba(0,0,0,.6);pointer-events:none;z-index:200;white-space:nowrap;`;
    dmgLayer.appendChild(el);
    let frame = 0;
    const animate = () => {
      frame++;
      const progress = frame / 60;
      if(progress >= 1){ el.remove(); return; }
      el.style.transform = `translateY(${-progress * 40}px) scale(${1 + progress * 0.3})`;
      el.style.opacity = 1 - progress;
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  // 元素脉冲效果（用于UI元素高亮）
  function pulseElement(el, color){
    if(!el) return;
    color = color || '#c9a84c';
    const orig = el.style.boxShadow;
    el.style.transition = 'box-shadow .3s ease';
    el.style.boxShadow = `0 0 20px ${color}, 0 0 40px ${color}`;
    setTimeout(() => {
      el.style.boxShadow = orig;
      setTimeout(() => { el.style.transition = ''; }, 300);
    }, 600);
  }

  // 屏幕渐变过渡
  function screenWipe(callback, color){
    if(!transitionOverlay) { if(callback) callback(); return; }
    color = color || '#0a0805';
    transitionOverlay.style.background = color;
    transitionOverlay.style.opacity = '0';
    transitionOverlay.style.transition = 'opacity .3s ease';
    transitionOverlay.style.pointerEvents = 'auto';
    // 渐入
    requestAnimationFrame(() => {
      transitionOverlay.style.opacity = '1';
      setTimeout(() => {
        if(callback) callback();
        // 渐出
        transitionOverlay.style.opacity = '0';
        setTimeout(() => {
          transitionOverlay.style.pointerEvents = 'none';
          transitionOverlay.style.transition = '';
        }, 300);
      }, 300);
    });
  }

  // 状态效果图标显示
  function showStatusIcon(target, statusName, icon, color){
    if(!target) return;
    let container = target.querySelector('.status-icons');
    if(!container){
      container = document.createElement('div');
      container.className = 'status-icons';
      container.style.cssText = 'position:absolute;top:4px;right:4px;display:flex;gap:4px;z-index:50;';
      target.style.position = target.style.position || 'relative';
      target.appendChild(container);
    }
    // 避免重复
    if(container.querySelector(`[data-status="${statusName}"]`)) return;
    const el = document.createElement('div');
    el.dataset.status = statusName;
    el.textContent = icon;
    el.style.cssText = `font-size:16px;color:${color || '#fff'};text-shadow:0 0 4px ${color || '#fff'};animation:statusPulse 1s ease infinite;`;
    container.appendChild(el);
  }

  // 移除状态效果图标
  function removeStatusIcon(target, statusName){
    if(!target) return;
    const container = target.querySelector('.status-icons');
    if(!container) return;
    const el = container.querySelector(`[data-status="${statusName}"]`);
    if(el) el.remove();
  }

  // 战斗回合指示器闪烁
  function pulseTurnIndicator(){
    const indicator = document.getElementById('turn-indicator');
    if(!indicator) return;
    indicator.style.animation = 'none';
    void indicator.offsetWidth;
    indicator.style.animation = 'pulseTurn .5s ease';
  }

  return {
    flash, shake, showDamage, addCombo, resetCombo, getCombo,
    transition, showAchievement, isAchievementActive, resetNotifications,
    getBattleCenter, getEnemyPos, getPlayerPos,
    showFloatingText, pulseElement, screenWipe,
    showStatusIcon, removeStatusIcon, pulseTurnIndicator,
    isEnabled(){ return true; }
  };
})();

// ==================== 音频引擎 ====================
const AudioFX = (function(){
  let ctx = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let musicTimer = null;
  let currentMood = 'title';
  let isPlaying = false;
  let isMuted = false;
  let volumes = { master: 0.5, music: 0.4, sfx: 0.6 };
  let battleTurn = 0;

  // 从localStorage读取设置
  try{
    const saved = JSON.parse(localStorage.getItem('dldl_audio_settings') || '{}');
    if(saved.volumes) volumes = { ...volumes, ...saved.volumes };
    if(saved.muted) isMuted = true;
  }catch(e){}
  // 读取全局音效开关
  try{
    const audioEnabled = localStorage.getItem('dldl_audio_enabled');
    if(audioEnabled === 'false') isMuted = true;
  }catch(e){}

  function init(){
    if(ctx) return;
    try{
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      musicGain = ctx.createGain();
      sfxGain = ctx.createGain();
      musicGain.connect(masterGain);
      sfxGain.connect(masterGain);
      masterGain.connect(ctx.destination);
      updateVolumes();
    }catch(e){
      console.warn('音频初始化失败:', e);
    }
  }

  function updateVolumes(){
    if(!masterGain) return;
    const m = isMuted ? 0 : volumes.master;
    masterGain.gain.value = m;
    musicGain.gain.value = volumes.music;
    sfxGain.gain.value = volumes.sfx;
  }

  function saveSettings(){
    try{
      localStorage.setItem('dldl_audio_settings', JSON.stringify({
        volumes, muted: isMuted
      }));
    }catch(e){}
  }

  // ==================== 音效合成 ====================
  function playSfx(type){
    if(!ctx || isMuted) return;
    if(ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const presets = {
      click: { freq: 800, type: 'sine', dur: 0.05, vol: 0.3, decay: true },
      hover: { freq: 1200, type: 'sine', dur: 0.03, vol: 0.15, decay: true },
      attack: { freq: 200, type: 'sawtooth', dur: 0.12, vol: 0.4, decay: true, sweep: 80 },
      skill: { freq: 440, type: 'square', dur: 0.2, vol: 0.35, decay: true, sweep: 880 },
      hit: { freq: 150, type: 'sawtooth', dur: 0.08, vol: 0.5, decay: true, noise: true },
      crit: { freq: 880, type: 'square', dur: 0.25, vol: 0.5, decay: true, sweep: 1760 },
      hurt: { freq: 300, type: 'sawtooth', dur: 0.15, vol: 0.4, decay: true, sweep: 100 },
      heal: { freq: 523, type: 'sine', dur: 0.3, vol: 0.35, decay: false, sweep: 784 },
      levelup: { freq: 523, type: 'sine', dur: 0.5, vol: 0.5, decay: false, sweep: 1047, chord: true },
      coin: { freq: 988, type: 'sine', dur: 0.1, vol: 0.3, decay: true, sweep: 1319 },
      achievement: { freq: 659, type: 'sine', dur: 0.6, vol: 0.45, decay: false, chord: true, arpeggio: [659, 784, 988, 1319] },
      flee: { freq: 400, type: 'sine', dur: 0.2, vol: 0.3, decay: true, sweep: 200 },
      shield: { freq: 300, type: 'sine', dur: 0.25, vol: 0.3, decay: false, sweep: 500 },
      fire: { freq: 100, type: 'sawtooth', dur: 0.3, vol: 0.35, decay: true, noise: true },
      ice: { freq: 1200, type: 'sine', dur: 0.25, vol: 0.3, decay: true, sweep: 800 },
      thunder: { freq: 80, type: 'sawtooth', dur: 0.15, vol: 0.5, decay: true, noise: true },
      select: { freq: 600, type: 'sine', dur: 0.04, vol: 0.2, decay: true },
      // 新增音效
      reaction: { freq: 660, type: 'sine', dur: 0.35, vol: 0.45, decay: false, chord: true, arpeggio: [660, 880, 1100, 1320] },
      finisher: { freq: 440, type: 'square', dur: 0.6, vol: 0.55, decay: false, chord: true, arpeggio: [440, 554, 659, 880, 1100] },
      fusion: { freq: 523, type: 'sine', dur: 0.8, vol: 0.5, decay: false, chord: true, arpeggio: [523, 659, 784, 1047, 1319] },
      limitbreak: { freq: 220, type: 'sawtooth', dur: 0.7, vol: 0.6, decay: false, sweep: 880, noise: true },
      forge: { freq: 200, type: 'square', dur: 0.15, vol: 0.4, decay: true, noise: true },
      forgeSuccess: { freq: 523, type: 'sine', dur: 0.5, vol: 0.45, decay: false, chord: true, arpeggio: [523, 659, 784, 1047] },
      sign: { freq: 784, type: 'sine', dur: 0.3, vol: 0.35, decay: false, sweep: 1047 },
      quest: { freq: 587, type: 'sine', dur: 0.4, vol: 0.4, decay: false, chord: true, arpeggio: [587, 740, 880] },
      victory: { freq: 523, type: 'sine', dur: 0.8, vol: 0.5, decay: false, chord: true, arpeggio: [523, 659, 784, 1047, 784, 1047] },
      defeat: { freq: 220, type: 'sawtooth', dur: 0.6, vol: 0.4, decay: true, sweep: 110 },
      discover: { freq: 880, type: 'sine', dur: 0.25, vol: 0.35, decay: true, sweep: 1320 },
      teleport: { freq: 1200, type: 'sine', dur: 0.3, vol: 0.3, decay: true, sweep: 400 },
      unlock: { freq: 440, type: 'sine', dur: 0.35, vol: 0.35, decay: false, chord: true, arpeggio: [440, 554, 659] },
      warning: { freq: 300, type: 'sawtooth', dur: 0.2, vol: 0.4, decay: true, sweep: 200 },
      bossEntry: { freq: 80, type: 'sawtooth', dur: 1.0, vol: 0.6, decay: false, sweep: 160, noise: true },
      powerup: { freq: 400, type: 'square', dur: 0.4, vol: 0.4, decay: false, sweep: 1200 },
      debuff: { freq: 300, type: 'sawtooth', dur: 0.2, vol: 0.3, decay: true, sweep: 150 }
    };

    const p = presets[type] || presets.click;

    function playTone(freq, start, dur, vol){
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = p.type;
      osc.frequency.setValueAtTime(freq, now + start);
      if(p.sweep){
        osc.frequency.exponentialRampToValueAtTime(p.sweep, now + start + dur);
      }
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(vol, now + start + 0.01);
      if(p.decay){
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      } else {
        gain.gain.setValueAtTime(vol, now + start + dur * 0.7);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      }
      osc.connect(gain);
      gain.connect(sfxGain);

      // 噪声叠加
      if(p.noise){
        const bufferSize = ctx.sampleRate * dur;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for(let i = 0; i < bufferSize; i++){
          data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(vol * 0.3, now + start);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
        noise.connect(noiseGain);
        noiseGain.connect(sfxGain);
        noise.start(now + start);
      }

      osc.start(now + start);
      osc.stop(now + start + dur);
    }

    if(p.arpeggio){
      p.arpeggio.forEach((f, i) => playTone(f, i * 0.08, 0.15, p.vol));
    } else if(p.chord){
      playTone(p.freq, 0, p.dur, p.vol);
      playTone(p.freq * 1.25, 0, p.dur, p.vol * 0.7);
      playTone(p.freq * 1.5, 0, p.dur, p.vol * 0.5);
    } else {
      playTone(p.freq, 0, p.dur, p.vol);
    }
  }

  // ==================== 程序化音乐 ====================
  // 五声音阶 (宫商角徵羽)
  const SCALES = {
    title: { root: 261.63, intervals: [0, 2, 4, 7, 9, 12], tempo: 0.8, octaves: [3, 4, 5] },
    academy: { root: 293.66, intervals: [0, 2, 4, 7, 9, 12], tempo: 0.6, octaves: [4, 5] },
    battle: { root: 220.00, intervals: [0, 2, 3, 5, 7, 10], tempo: 0.35, octaves: [3, 4, 5] },
    boss: { root: 196.00, intervals: [0, 1, 3, 6, 7, 10], tempo: 0.25, octaves: [2, 3, 4] },
    ending: { root: 261.63, intervals: [0, 2, 4, 7, 9, 12], tempo: 1.2, octaves: [4, 5] },
    calm: { root: 246.94, intervals: [0, 2, 4, 7, 9, 12], tempo: 1.0, octaves: [4, 5] },
    mystery: { root: 174.61, intervals: [0, 1, 4, 6, 7, 11], tempo: 0.9, octaves: [3, 4, 5] },
    victory: { root: 349.23, intervals: [0, 2, 4, 7, 9, 12], tempo: 0.4, octaves: [4, 5] },
    danger: { root: 164.81, intervals: [0, 1, 3, 6, 7, 10], tempo: 0.3, octaves: [2, 3, 4] },
    exploration: { root: 277.18, intervals: [0, 2, 4, 7, 9, 12], tempo: 0.7, octaves: [3, 4, 5] },
    forge: { root: 207.65, intervals: [0, 2, 5, 7, 10], tempo: 0.5, octaves: [3, 4] },
    emotional: { root: 220.00, intervals: [0, 2, 4, 7, 9, 12], tempo: 1.1, octaves: [4, 5] }
  };

  // 旋律模式（使音乐更有结构感）
  const MELODY_PATTERNS = {
    title: [0, 2, 4, 2, 0, 4, 5, 4],
    academy: [0, 2, 4, 5, 4, 2, 0, 2],
    battle: [0, 4, 2, 5, 3, 4, 0, 3],
    boss: [0, 1, 3, 1, 0, 3, 5, 3],
    ending: [0, 4, 2, 5, 4, 7, 5, 4],
    calm: [0, 2, 4, 5, 7, 5, 4, 2],
    mystery: [0, 1, 4, 6, 4, 1, 0, 4],
    victory: [0, 4, 7, 4, 0, 5, 7, 9],
    danger: [0, 3, 1, 3, 0, 6, 3, 1],
    exploration: [0, 2, 4, 7, 5, 4, 2, 0],
    forge: [0, 2, 5, 2, 0, 5, 7, 5],
    emotional: [0, 4, 2, 5, 4, 2, 0, 5]
  };

  let musicSeq = null;

  function startMusic(mood){
    if(!ctx) return;
    if(ctx.state === 'suspended') ctx.resume();
    currentMood = mood || 'title';
    stopMusic();
    isPlaying = true;

    const scale = SCALES[currentMood] || SCALES.title;
    const pattern = MELODY_PATTERNS[currentMood] || MELODY_PATTERNS.title;
    let beatCount = 0;

    function playBeat(){
      if(!isPlaying) return;
      const now = ctx.currentTime;
      const beat = beatCount % 8;

      // 旋律（使用模式+随机变奏）
      if(beat % 2 === 0 || Math.random() > 0.3){
        const patternIdx = pattern[beat % pattern.length];
        const useVariation = Math.random() > 0.7;
        const interval = useVariation ? scale.intervals[Math.floor(Math.random() * scale.intervals.length)] : scale.intervals[patternIdx % scale.intervals.length];
        const octave = scale.octaves[Math.floor(Math.random() * scale.octaves.length)];
        const freq = scale.root * Math.pow(2, (interval + (octave - 4) * 12) / 12);

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = currentMood === 'battle' || currentMood === 'boss' ? 'triangle' : 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + scale.tempo * 0.9);
        osc.connect(gain);
        gain.connect(musicGain);
        osc.start(now);
        osc.stop(now + scale.tempo);
      }

      // 低音(每4拍)
      if(beat % 4 === 0){
        const bassFreq = scale.root / 2;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = bassFreq;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + scale.tempo * 2);
        osc.connect(gain);
        gain.connect(musicGain);
        osc.start(now);
        osc.stop(now + scale.tempo * 2);
      }

      // 打击乐(battle/boss模式)
      if((currentMood === 'battle' || currentMood === 'boss') && beat % 2 === 1){
        const bufferSize = ctx.sampleRate * 0.1;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for(let i = 0; i < bufferSize; i++){
          data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) * 0.5;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 200;
        const gain = ctx.createGain();
        gain.gain.value = 0.3;
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(musicGain);
        noise.start(now);
      }

      beatCount++;
      // 战斗中逐渐加速
      let tempo = scale.tempo;
      if(currentMood === 'battle' || currentMood === 'boss'){
        tempo = Math.max(0.15, scale.tempo - battleTurn * 0.01);
      }
      musicSeq = setTimeout(playBeat, tempo * 1000);
    }

    playBeat();
  }

  function stopMusic(){
    isPlaying = false;
    if(musicSeq){
      clearTimeout(musicSeq);
      musicSeq = null;
    }
  }

  function setMood(mood){
    if(mood === currentMood && isPlaying) return;
    currentMood = mood;
    if(isPlaying) startMusic(mood);
  }

  function setBattleTurn(turn){
    battleTurn = turn;
  }

  function toggleMute(){
    isMuted = !isMuted;
    updateVolumes();
    saveSettings();
    const btn = document.getElementById('audio-toggle');
    if(btn){
      btn.textContent = isMuted ? '♪̸' : '♪';
      btn.classList.toggle('muted', isMuted);
    }
    return isMuted;
  }

  function setVolume(type, val){
    volumes[type] = val;
    updateVolumes();
    saveSettings();
  }

  function getVolumes(){ return { ...volumes }; }
  function isAudioMuted(){ return isMuted; }

  // 尝试在首次用户交互时初始化
  function tryInit(){
    init();
    if(ctx && ctx.state === 'suspended') ctx.resume();
  }

  // 监听首次交互
  ['click', 'keydown', 'touchstart'].forEach(ev => {
    document.addEventListener(ev, function handler(){
      tryInit();
      document.removeEventListener(ev, handler);
    }, { once: true });
  });

  return {
    playSfx, startMusic, stopMusic, setMood, setBattleTurn,
    toggleMute, setVolume, getVolumes, isAudioMuted,
    isEnabled(){ return !isMuted; },
    toggle(){
      toggleMute();
      try{ localStorage.setItem('dldl_audio_enabled', isMuted ? 'false' : 'true'); }catch(e){}
      return !isMuted;
    },
    enable(){
      if(isMuted){ isMuted = false; updateVolumes(); saveSettings(); }
      try{ localStorage.setItem('dldl_audio_enabled', 'true'); }catch(e){}
    },
    disable(){
      if(!isMuted){ isMuted = true; updateVolumes(); saveSettings(); }
      try{ localStorage.setItem('dldl_audio_enabled', 'false'); }catch(e){}
    },
    init: tryInit,
    get isReady(){ return !!ctx; }
  };
})();

// ==================== 标题屏粒子初始化 ====================
window.addEventListener('DOMContentLoaded', () => {
  // 生成标题屏粒子
  const tp = document.getElementById('title-particles');
  if(tp){
    const particleCount = document.body.classList.contains('low-effects') ? 8 : 20;
    for(let i = 0; i < particleCount; i++){
      const p = document.createElement('div');
      p.className = 'title-particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDelay = Math.random() * 8 + 's';
      p.style.animationDuration = (6 + Math.random() * 6) + 's';
      p.style.width = p.style.height = (2 + Math.random() * 4) + 'px';
      tp.appendChild(p);
    }
  }

  // 音频按钮
  const audioBtn = document.getElementById('audio-toggle');
  if(audioBtn){
    audioBtn.textContent = AudioFX.isAudioMuted() ? '♪̸' : '♪';
    if(AudioFX.isAudioMuted()) audioBtn.classList.add('muted');
    audioBtn.addEventListener('click', () => {
      AudioFX.toggleMute();
    });
  }

  // V 键静音；只在正式游戏画面、无弹窗且无组合键时生效。M 专用于设置。
  document.addEventListener('keydown', e => {
    const gameScreen = document.getElementById('screen-game');
    const modal = document.getElementById('modal-mask');
    if((e.key === 'v' || e.key === 'V') && gameScreen && gameScreen.classList.contains('active') &&
      !(modal && modal.classList.contains('show')) && !e.ctrlKey && !e.metaKey && !e.altKey &&
      !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){
      e.preventDefault();
      AudioFX.toggle();
    }
  });
});

// ==================== 电影级开场引擎 ====================
const CinematicEngine = (function(){
  const overlay = document.getElementById('cinematic-intro');
  if(!overlay) return { play(){}, skip(){} };

  const logoWrap = document.getElementById('ci-logo-wrap');
  const titleSub = document.getElementById('ci-title-sub');
  const ornament = document.getElementById('ci-ornament');
  const loadingText = document.getElementById('ci-loading-text');
  const loadingBar = document.getElementById('ci-loading-bar');
  const loadingFill = document.getElementById('ci-loading-fill');
  const skipBtn = document.getElementById('ci-skip');
  const starsContainer = document.getElementById('ci-stars');
  let played = false;
  let skipped = false;
  let timers = [];

  // 生成星空
  function genStars(){
    if(!starsContainer) return;
    for(let i = 0; i < 60; i++){
      const s = document.createElement('div');
      s.className = 'ci-star';
      s.style.left = Math.random() * 100 + '%';
      s.style.top = Math.random() * 100 + '%';
      s.style.animationDelay = Math.random() * 3 + 's';
      s.style.animationDuration = (2 + Math.random() * 4) + 's';
      const sz = 1 + Math.random() * 3;
      s.style.width = sz + 'px';
      s.style.height = sz + 'px';
      starsContainer.appendChild(s);
    }
  }

  function clearTimers(){
    timers.forEach(t => clearTimeout(t));
    timers = [];
  }

  function addTimer(fn, ms){
    const t = setTimeout(fn, ms);
    timers.push(t);
  }

  // 播放开场动画
  function play(){
    if(played) return;
    played = true;
    genStars();

    // 跳过入口从第一帧起可见；电影感不能以强制等待为代价。
    if(skipBtn){
      skipBtn.classList.add('show');
      skipBtn.addEventListener('click', skip);
      overlay.addEventListener('click', e => {
        if(e.target === overlay || e.target.classList.contains('ci-bg')) skip();
      });
    }

    // 序列动画
    // 0.3s: 标题缩放显现
    addTimer(() => {
      if(skipped) return;
      logoWrap.classList.add('show');
    }, 300);

    // 1s: 副标题渐入
    addTimer(() => {
      if(skipped) return;
      titleSub.classList.add('show');
    }, 1000);

    // 1.5s: 装饰线展开
    addTimer(() => {
      if(skipped) return;
      ornament.classList.add('show');
    }, 1500);

    // 2s: 标题发光
    addTimer(() => {
      if(skipped) return;
      logoWrap.classList.add('glow');
    }, 2000);

    // 2.5s: 加载文字
    addTimer(() => {
      if(skipped) return;
      loadingText.classList.add('show');
      loadingBar.classList.add('show');
    }, 2500);

    // 3s: 加载条填充
    addTimer(() => {
      if(skipped) return;
      loadingFill.style.width = '100%';
    }, 3000);

    // 4.5s: 首次访问自动结束；后续访问会直接进入标题页。
    addTimer(() => {
      finish();
    }, 4500);
  }

  function skip(){
    if(skipped) return;
    skipped = true;
    finish();
  }

  function finish(){
    clearTimers();
    try{
      localStorage.setItem('dldl_intro_seen_v2', '1');
      sessionStorage.setItem('dldl_intro_seen', '1');
    }catch(e){}
    overlay.classList.add('hide');
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 1200);
    // 启动粒子引擎和标题音乐(检查用户偏好)
    if(typeof ParticleEngine !== 'undefined' && !ParticleEngine.isRunning()){
      const particlesEnabled = localStorage.getItem('dldl_particles_enabled');
      if(particlesEnabled !== 'false') ParticleEngine.start();
    }
    if(typeof AudioFX !== 'undefined'){
      AudioFX.init();
      const audioEnabled = localStorage.getItem('dldl_audio_enabled');
      if(audioEnabled !== 'false') setTimeout(() => AudioFX.startMusic('title'), 500);
    }
  }

  // 完整开场仅首次访问播放；减少动画偏好的用户也直接进入标题页。
  try{
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reducedMotion || localStorage.getItem('dldl_intro_seen_v2') || sessionStorage.getItem('dldl_intro_seen')){
      overlay.style.display = 'none';
      // 直接启动粒子和音乐(检查用户偏好)
      if(typeof ParticleEngine !== 'undefined'){
        const particlesEnabled = localStorage.getItem('dldl_particles_enabled');
        if(particlesEnabled !== 'false') ParticleEngine.start();
      }
      if(typeof AudioFX !== 'undefined'){
        AudioFX.init();
        const audioEnabled = localStorage.getItem('dldl_audio_enabled');
        if(audioEnabled !== 'false'){
          ['click','keydown','touchstart'].forEach(ev => {
            document.addEventListener(ev, () => {
              AudioFX.init();
              setTimeout(() => AudioFX.startMusic('title'), 200);
            }, { once: true });
          });
        }
      }
    } else {
      play();
    }
  }catch(e){
    play();
  }

  return { play, skip };
})();
