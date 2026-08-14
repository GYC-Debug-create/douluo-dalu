/**
 * 像素艺术绘制系统
 * 用代码绘制像素风精灵,无需外部图片资源
 * 所有精灵使用小色块矩阵定义
 */
const PixelArt = {
  
  /**
   * 绘制像素方块(带描边)
   */
  drawPixelBlock(ctx, x, y, size, color, borderColor = null) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(size), Math.ceil(size));
    if (borderColor) {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.floor(x)+0.5, Math.floor(y)+0.5, Math.ceil(size)-1, Math.ceil(size)-1);
    }
  },
  
  /**
   * 根据像素矩阵绘制精灵
   * matrix: 二维数组,每格为颜色字符串或null(透明)
   * pixelSize: 每个像素的实际大小
   */
  drawSprite(ctx, x, y, matrix, pixelSize, flipX = false) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const startX = Math.floor(x - (cols * pixelSize) / 2);
    const startY = Math.floor(y - (rows * pixelSize) / 2);
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const color = matrix[r][c];
        if (!color) continue;
        const px = flipX ? (cols - 1 - c) : c;
        ctx.fillStyle = color;
        ctx.fillRect(
          startX + px * pixelSize,
          startY + r * pixelSize,
          pixelSize + 0.5,
          pixelSize + 0.5
        );
      }
    }
  },
  
  /**
   * 绘制玩家(魂师) - 像素小人
   */
  drawPlayer(ctx, x, y, size, dir, walkFrame, spiritColor, attackFlash = false) {
    const ps = size / 16; // 像素大小
    // 颜色定义
    const skin = '#fbcfa3';
    const skinDark = '#d4a373';
    const hair = '#3b2417';
    const cloth = spiritColor;
    const clothDark = this.darkenColor(spiritColor, 0.7);
    const boot = '#2a1810';
    const eye = '#1a1a1a';
    
    // 走路动画偏移
    const legOffset = walkFrame % 2 === 0 ? 0 : 1;
    
    const matrix = [
      [null, null, null, hair, hair, hair, hair, hair, null, null, null],
      [null, null, hair, hair, hair, hair, hair, hair, hair, null, null],
      [null, null, hair, skin, skin, skin, skin, skin, hair, null, null],
      [null, null, skin, skin, eye, skin, eye, skin, skin, null, null],
      [null, null, skin, skin, skin, skin, skin, skin, skin, null, null],
      [null, null, null, skin, skin, skin, skin, skin, null, null, null],
      [null, cloth, cloth, cloth, cloth, cloth, cloth, cloth, cloth, cloth, null],
      [cloth, cloth, cloth, cloth, cloth, cloth, cloth, cloth, cloth, cloth, cloth],
      [cloth, clothDark, clothDark, cloth, cloth, cloth, cloth, cloth, clothDark, clothDark, cloth],
      [cloth, clothDark, clothDark, cloth, cloth, cloth, cloth, cloth, clothDark, clothDark, cloth],
      [null, cloth, cloth, null, cloth, cloth, cloth, null, cloth, cloth, null],
      [null, boot, boot, null, boot, boot, boot, null, boot, boot, null],
      [null, boot, boot, null, boot+legOffset, boot, boot, null, boot, boot, null]
    ];
    
    if (attackFlash) {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - size/2, y - size/2, size, size);
      ctx.globalAlpha = 1;
    }
    
    this.drawSprite(ctx, x, y, matrix, ps, dir === 'left');
    
    // 方向指示器(小箭头)
    if (dir === 'left' || dir === 'right') {
      // 翻转已处理
    }
  },
  
  /**
   * 绘制魂兽 - 根据类型绘制不同的像素图案
   */
  drawBeast(ctx, beast, sx, sy) {
    const { size, type, color, hitFlash } = beast;
    const ps = size / 16;
    const x = sx, y = sy;
    
    if (hitFlash) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(x - size/2, y - size/2, size, size);
      ctx.globalAlpha = 1;
    }
    
    switch (type) {
      case 'wild_deer': this.drawDeer(ctx, x, y, ps, color); break;
      case 'wild_wolf': this.drawWolf(ctx, x, y, ps, color); break;
      case 'flame_tiger': this.drawTiger(ctx, x, y, ps, color); break;
      case 'iron_bear': this.drawBear(ctx, x, y, ps, color); break;
      case 'jiao_dragon': this.drawDragon(ctx, x, y, ps, color); break;
      default: this.drawDefaultBeast(ctx, x, y, ps, color);
    }
    
    // 血条
    if (beast.hp < beast.maxHp) {
      this.drawHealthBar(ctx, x, y - size/2 - 8, size, beast.hp / beast.maxHp);
    }
  },
  
  drawDeer(ctx, x, y, ps, color) {
    const dark = this.darkenColor(color, 0.7);
    const antler = '#8b6f47';
    const matrix = [
      [null, null, null, antler, null, null, null, antler, null, null],
      [null, null, antler, antler, null, null, antler, antler, null, null],
      [null, null, antler, null, null, null, null, antler, null, null],
      [null, null, null, color, color, color, color, null, null, null],
      [null, null, color, color, color, color, color, color, null, null],
      [null, null, color, '#000', color, color, '#000', color, null, null],
      [null, null, color, color, color, color, color, color, null, null],
      [null, color, color, color, color, color, color, color, color, null],
      [null, dark, color, color, color, color, color, color, dark, null],
      [null, null, dark, null, dark, dark, null, dark, null, null],
      [null, null, dark, null, dark, dark, null, dark, null, null]
    ];
    this.drawSprite(ctx, x, y, matrix, ps);
  },
  
  drawWolf(ctx, x, y, ps, color) {
    const dark = this.darkenColor(color, 0.6);
    const matrix = [
      [null, null, null, null, null, null, null, null, null, null, null, null],
      [null, null, color, color, null, null, null, null, color, color, null, null],
      [null, color, color, color, color, null, null, color, color, color, color, null],
      [null, color, '#f00', color, color, color, color, color, color, '#f00', color, null],
      [null, color, color, color, color, color, color, color, color, color, color, null],
      [null, color, color, '#fff', color, color, color, '#fff', color, color, color, null],
      [null, color, color, color, '#000', color, '#000', color, color, color, color, null],
      [null, null, color, color, color, color, color, color, color, color, null, null],
      [null, null, null, color, color, color, color, color, color, null, null, null],
      [null, null, dark, dark, null, dark, dark, null, dark, dark, null, null],
      [null, null, dark, dark, null, dark, dark, null, dark, dark, null, null]
    ];
    this.drawSprite(ctx, x, y, matrix, ps);
  },
  
  drawTiger(ctx, x, y, ps, color) {
    const dark = this.darkenColor(color, 0.5);
    const stripe = '#000';
    const matrix = [
      [null, null, null, color, color, null, null, color, color, null, null, null],
      [null, null, color, color, color, color, color, color, color, color, null, null],
      [null, color, color, stripe, color, color, color, color, stripe, color, color, null],
      [null, color, '#ff0', color, color, color, color, color, color, '#ff0', color, null],
      [null, color, color, color, stripe, color, color, stripe, color, color, color, null],
      [null, color, color, color, color, '#000', '#000', color, color, color, color, null],
      [null, color, color, color, color, color, color, color, color, color, color, null],
      [null, color, stripe, color, color, color, color, color, color, stripe, color, null],
      [null, null, color, color, color, color, color, color, color, color, null, null],
      [null, null, null, color, color, color, color, color, color, null, null, null],
      [null, null, dark, dark, null, dark, dark, null, dark, dark, null, null]
    ];
    this.drawSprite(ctx, x, y, matrix, ps);
  },
  
  drawBear(ctx, x, y, ps, color) {
    const dark = this.darkenColor(color, 0.6);
    const matrix = [
      [null, color, color, null, null, null, null, null, null, color, color, null],
      [null, color, color, color, null, null, null, null, color, color, color, null],
      [null, color, color, color, color, color, color, color, color, color, color, null],
      [null, color, color, color, color, color, color, color, color, color, color, null],
      [null, color, '#000', color, color, color, color, color, color, '#000', color, null],
      [null, color, color, color, '#fff', '#000', '#000', '#fff', color, color, color, null],
      [null, color, color, color, color, color, color, color, color, color, color, null],
      [null, dark, color, color, color, color, color, color, color, color, dark, null],
      [null, dark, color, color, color, color, color, color, color, color, dark, null],
      [null, null, dark, dark, dark, dark, dark, dark, dark, dark, null, null],
      [null, null, dark, dark, null, dark, dark, null, dark, dark, null, null]
    ];
    this.drawSprite(ctx, x, y, matrix, ps);
  },
  
  drawDragon(ctx, x, y, ps, color) {
    const dark = this.darkenColor(color, 0.5);
    const light = this.lightenColor(color, 1.3);
    const matrix = [
      [null, null, null, null, color, color, color, color, null, null, null, null, null],
      [null, null, null, color, color, light, light, color, color, null, null, null, null],
      [null, null, color, color, '#f00', color, color, '#f00', color, color, null, null, null],
      [null, color, color, color, color, color, color, color, color, color, color, null, null],
      [null, color, light, color, color, color, color, color, color, light, color, null, null],
      [color, color, color, color, color, color, color, color, color, color, color, color, null],
      [color, dark, color, color, color, color, color, color, color, color, dark, color, null],
      [color, color, color, color, color, color, color, color, color, color, color, color, null],
      [null, color, color, color, color, color, color, color, color, color, color, null, null],
      [null, null, color, color, color, null, null, color, color, color, null, null, null],
      [null, null, null, dark, null, null, null, null, dark, null, null, null, null]
    ];
    this.drawSprite(ctx, x, y, matrix, ps);
  },
  
  drawDefaultBeast(ctx, x, y, ps, color) {
    const matrix = [
      [null, null, color, color, color, color, null, null],
      [null, color, color, color, color, color, color, null],
      [null, color, '#000', color, color, '#000', color, null],
      [null, color, color, color, color, color, color, null],
      [color, color, color, color, color, color, color, color],
      [color, color, color, color, color, color, color, color],
      [null, color, color, color, color, color, color, null],
      [null, null, color, null, null, color, null, null]
    ];
    this.drawSprite(ctx, x, y, matrix, ps);
  },
  
  /**
   * 绘制魂环
   */
  drawRing(ctx, ring, time) {
    const { x, y, level } = ring;
    const ringInfo = RING_DATA[level];
    const color = ringInfo.color;
    const radius = 18 + level * 4;
    const pulse = Math.sin(time * 0.005) * 3;
    
    // 外光晕
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius + 8 + pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    // 环本体
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, radius + pulse, 0, Math.PI * 2);
    ctx.stroke();
    
    // 内环
    ctx.strokeStyle = this.lightenColor(color, 1.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius - 4 + pulse, 0, Math.PI * 2);
    ctx.stroke();
    
    // 旋转的光点
    const dotCount = 4 + level;
    for (let i = 0; i < dotCount; i++) {
      const angle = (time * 0.003) + (i * Math.PI * 2 / dotCount);
      const dx = x + Math.cos(angle) * (radius + pulse);
      const dy = y + Math.sin(angle) * (radius + pulse);
      ctx.fillStyle = this.lightenColor(color, 1.8);
      ctx.beginPath();
      ctx.arc(dx, dy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  
  /**
   * 绘制血条
   */
  drawHealthBar(ctx, x, y, width, ratio) {
    const h = 4;
    const bx = x - width/2;
    // 背景
    ctx.fillStyle = '#000';
    ctx.fillRect(bx - 1, y - 1, width + 2, h + 2);
    // 红色底
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(bx, y, width, h);
    // 绿色填充
    ctx.fillStyle = ratio > 0.5 ? '#22c55e' : (ratio > 0.25 ? '#fbbf24' : '#dc2626');
    ctx.fillRect(bx, y, width * ratio, h);
  },
  
  /**
   * 绘制技能特效
   */
  drawSkillEffect(ctx, effect, time) {
    const { type, x, y, targetX, targetY, startTime, duration, color } = effect;
    const elapsed = time - startTime;
    const progress = elapsed / duration;
    
    if (progress >= 1) return false;
    
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    
    switch (type) {
      case 'slash':
        // 挥砍特效
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 40, -Math.PI/3, Math.PI/3);
        ctx.stroke();
        break;
      case 'projectile':
        // 投射物轨迹
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
        break;
      case 'aoe':
        // 范围爆发
        const r = 40 + progress * 40;
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.globalAlpha = (1 - progress) * 0.3;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'beam':
        // 光束
        ctx.strokeStyle = color;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
        break;
      case 'dash':
        // 突进残影
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const t = (i + 1) / 4;
          ctx.globalAlpha = (1 - progress) * (1 - t);
          ctx.beginPath();
          ctx.arc(x + (targetX - x) * t, y + (targetY - y) * t, 20, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      case 'heal':
        // 治疗光环
        const hr = 30 + progress * 20;
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, hr, 0, Math.PI * 2);
        ctx.stroke();
        // 上升的十字
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2 + progress * Math.PI;
          const px = x + Math.cos(a) * hr * 0.7;
          const py = y + Math.sin(a) * hr * 0.7 - progress * 20;
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(px - 1, py - 4, 2, 8);
          ctx.fillRect(px - 4, py - 1, 8, 2);
        }
        break;
    }
    
    ctx.restore();
    return true;
  },
  
  /**
   * 颜色变暗
   */
  darkenColor(hex, factor) {
    const c = this.hexToRgb(hex);
    return `rgb(${Math.floor(c.r * factor)},${Math.floor(c.g * factor)},${Math.floor(c.b * factor)})`;
  },
  
  /**
   * 颜色变亮
   */
  lightenColor(hex, factor) {
    const c = this.hexToRgb(hex);
    return `rgb(${Math.min(255, Math.floor(c.r * factor))},${Math.min(255, Math.floor(c.g * factor))},${Math.min(255, Math.floor(c.b * factor))})`;
  },
  
  hexToRgb(hex) {
    if (hex.startsWith('rgb')) {
      const m = hex.match(/\d+/g);
      return { r: +m[0], g: +m[1], b: +m[2] };
    }
    const h = hex.replace('#', '');
    return {
      r: parseInt(h.substr(0, 2), 16),
      g: parseInt(h.substr(2, 2), 16),
      b: parseInt(h.substr(4, 2), 16)
    };
  }
};
