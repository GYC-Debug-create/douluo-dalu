/**
 * 世界地图系统
 * 程序化生成地形:草地、森林、水域、沙地、岩石、道路
 */
const World = {
  width: CONFIG.WORLD.WIDTH,
  height: CONFIG.WORLD.HEIGHT,
  tileSize: CONFIG.WORLD.TILE_SIZE,
  cols: 0,
  rows: 0,
  tiles: null,         // 地形数据
  decorations: null,   // 装饰物(树、石头等)
  spawnPoints: [],     // 魂兽生成点
  
  init() {
    this.cols = Math.floor(this.width / this.tileSize);
    this.rows = Math.floor(this.height / this.tileSize);
    this.tiles = new Uint8Array(this.cols * this.rows);
    this.decorations = [];
    this.spawnPoints = [];
    this.generate();
  },
  
  /**
   * 生成地形(使用简化的噪声)
   */
  generate() {
    // 1. 基础地形:草地
    this.tiles.fill(CONFIG.TERRAIN.GRASS.id);
    
    // 2. 使用伪随机噪声生成森林和水域
    const seed1 = 12345;
    const seed2 = 67890;
    
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const n1 = this.noise(x * 0.08, y * 0.08, seed1);
        const n2 = this.noise(x * 0.05, y * 0.05, seed2);
        const idx = y * this.cols + x;
        
        if (n2 < 0.25) {
          // 水域(湖泊/河流)
          this.tiles[idx] = CONFIG.TERRAIN.WATER.id;
        } else if (n1 > 0.65) {
          // 森林
          this.tiles[idx] = CONFIG.TERRAIN.FOREST.id;
        } else if (n1 < 0.3 && n2 > 0.5) {
          // 沙地
          this.tiles[idx] = CONFIG.TERRAIN.SAND.id;
        } else if (n2 > 0.75) {
          // 岩石区
          this.tiles[idx] = CONFIG.TERRAIN.ROCK.id;
        }
      }
    }
    
    // 3. 生成中央道路(十字形)
    const midX = Math.floor(this.cols / 2);
    const midY = Math.floor(this.rows / 2);
    const roadWidth = 3;
    
    for (let i = 0; i < this.cols; i++) {
      for (let w = -roadWidth; w <= roadWidth; w++) {
        const y = midY + w;
        if (y >= 0 && y < this.rows && this.tiles[y * this.cols + i] !== CONFIG.TERRAIN.WATER.id) {
          this.tiles[y * this.cols + i] = CONFIG.TERRAIN.PATH.id;
        }
      }
    }
    for (let i = 0; i < this.rows; i++) {
      for (let w = -roadWidth; w <= roadWidth; w++) {
        const x = midX + w;
        if (x >= 0 && x < this.cols && this.tiles[i * this.cols + x] !== CONFIG.TERRAIN.WATER.id) {
          this.tiles[i * this.cols + x] = CONFIG.TERRAIN.PATH.id;
        }
      }
    }
    
    // 4. 生成装饰物(树、石头、花)
    this.generateDecorations();
    
    // 5. 生成魂兽刷新点(在可走区域)
    this.generateSpawnPoints();
    
    console.log(`世界生成完成: ${this.cols}x${this.rows} 格, ${this.decorations.length} 装饰物, ${this.spawnPoints.length} 刷新点`);
  },
  
  /**
   * 简单2D噪声
   */
  noise(x, y, seed) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
    return n - Math.floor(n);
  },
  
  generateDecorations() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const idx = y * this.cols + x;
        const terrain = this.tiles[idx];
        const wx = x * this.tileSize + this.tileSize / 2;
        const wy = y * this.tileSize + this.tileSize / 2;
        
        // 森林里生成树
        if (terrain === CONFIG.TERRAIN.FOREST.id) {
          if (Math.random() < 0.35) {
            this.decorations.push({
              x: wx + (Math.random() - 0.5) * 16,
              y: wy + (Math.random() - 0.5) * 16,
              type: 'tree',
              variant: Math.floor(Math.random() * 3),
              size: 20 + Math.random() * 8
            });
          }
        }
        // 草地偶尔有树和花
        else if (terrain === CONFIG.TERRAIN.GRASS.id) {
          if (Math.random() < 0.04) {
            this.decorations.push({
              x: wx, y: wy, type: 'tree',
              variant: Math.floor(Math.random() * 3),
              size: 18 + Math.random() * 6
            });
          } else if (Math.random() < 0.08) {
            this.decorations.push({
              x: wx, y: wy, type: 'flower',
              color: ['#f87171', '#fbbf24', '#a78bfa', '#f9a8d4'][Math.floor(Math.random()*4)],
              size: 4
            });
          } else if (Math.random() < 0.1) {
            this.decorations.push({
              x: wx, y: wy, type: 'bush', size: 8 + Math.random() * 4
            });
          }
        }
        // 岩石区生成石头
        else if (terrain === CONFIG.TERRAIN.ROCK.id) {
          if (Math.random() < 0.3) {
            this.decorations.push({
              x: wx, y: wy, type: 'rock',
              size: 10 + Math.random() * 10
            });
          }
        }
        // 沙地偶尔有仙人掌或枯草
        else if (terrain === CONFIG.TERRAIN.SAND.id) {
          if (Math.random() < 0.05) {
            this.decorations.push({
              x: wx, y: wy, type: 'cactus', size: 14
            });
          }
        }
      }
    }
  },
  
  generateSpawnPoints() {
    // 在远离中心的道路和草地生成魂兽刷新点
    const midX = this.width / 2;
    const midY = this.height / 2;
    
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      // 距离中心至少300
      if (Physics.distance(x, y, midX, midY) < 300) continue;
      if (this.isWalkable(x, y)) {
        this.spawnPoints.push({ x, y });
      }
    }
  },
  
  /**
   * 检查某点是否可走
   */
  isWalkable(x, y) {
    const tx = Math.floor(x / this.tileSize);
    const ty = Math.floor(y / this.tileSize);
    if (tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows) return false;
    const terrainId = this.tiles[ty * this.cols + tx];
    // 找地形配置
    for (const key in CONFIG.TERRAIN) {
      if (CONFIG.TERRAIN[key].id === terrainId) {
        return CONFIG.TERRAIN[key].walkable;
      }
    }
    return true;
  },
  
  /**
   * 获取地形速度修正
   */
  getSpeedMod(x, y) {
    const tx = Math.floor(x / this.tileSize);
    const ty = Math.floor(y / this.tileSize);
    if (tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows) return 1;
    const terrainId = this.tiles[ty * this.cols + tx];
    for (const key in CONFIG.TERRAIN) {
      if (CONFIG.TERRAIN[key].id === terrainId) {
        return CONFIG.TERRAIN[key].speedMod;
      }
    }
    return 1;
  },
  
  /**
   * 获取地形颜色
   */
  getTerrainColor(terrainId) {
    for (const key in CONFIG.TERRAIN) {
      if (CONFIG.TERRAIN[key].id === terrainId) return CONFIG.TERRAIN[key].color;
    }
    return '#000';
  },
  
  /**
   * 渲染世界(只渲染相机可见区域)
   */
  render(ctx, camera) {
    const startCol = Math.max(0, Math.floor(camera.x / this.tileSize));
    const endCol = Math.min(this.cols, Math.ceil((camera.x + camera.width) / this.tileSize));
    const startRow = Math.max(0, Math.floor(camera.y / this.tileSize));
    const endRow = Math.min(this.rows, Math.ceil((camera.y + camera.height) / this.tileSize));
    
    // 绘制地形
    for (let r = startRow; r < endRow; r++) {
      for (let c = startCol; c < endCol; c++) {
        const idx = r * this.cols + c;
        const terrainId = this.tiles[idx];
        const color = this.getTerrainColor(terrainId);
        const x = c * this.tileSize - camera.x;
        const y = r * this.tileSize - camera.y;
        
        ctx.fillStyle = color;
        ctx.fillRect(x, y, this.tileSize + 1, this.tileSize + 1);
        
        // 水的波纹
        if (terrainId === CONFIG.TERRAIN.WATER.id) {
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          const t = Date.now() * 0.001;
          ctx.fillRect(x, y + Math.sin(t + c) * 2, this.tileSize, 2);
        }
        // 草地的纹理点
        if (terrainId === CONFIG.TERRAIN.GRASS.id) {
          ctx.fillStyle = 'rgba(0,0,0,0.1)';
          ctx.fillRect(x + 8, y + 8, 2, 2);
          ctx.fillRect(x + 20, y + 18, 2, 2);
        }
        // 道路纹理
        if (terrainId === CONFIG.TERRAIN.PATH.id) {
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          ctx.fillRect(x + 12, y + 4, 8, 2);
          ctx.fillRect(x + 4, y + 22, 6, 2);
        }
      }
    }
    
    // 绘制装饰物(按y排序,近的覆盖远的)
    const visibleDeco = this.decorations.filter(d => 
      d.x > camera.x - 50 && d.x < camera.x + camera.width + 50 &&
      d.y > camera.y - 50 && d.y < camera.y + camera.height + 50
    );
    visibleDeco.sort((a, b) => a.y - b.y);
    
    for (const d of visibleDeco) {
      this.drawDecoration(ctx, d, camera);
    }
  },
  
  drawDecoration(ctx, d, camera) {
    const x = d.x - camera.x;
    const y = d.y - camera.y;
    
    switch (d.type) {
      case 'tree':
        this.drawTree(ctx, x, y, d.size, d.variant);
        break;
      case 'flower':
        ctx.fillStyle = d.color;
        ctx.fillRect(x - 2, y - 2, 4, 4);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(x - 1, y - 1, 2, 2);
        break;
      case 'bush':
        ctx.fillStyle = '#2d5a2d';
        ctx.fillRect(x - d.size/2, y - d.size/2, d.size, d.size);
        ctx.fillStyle = '#1f3a1f';
        ctx.fillRect(x - d.size/2 + 2, y - d.size/2 + 2, 3, 3);
        break;
      case 'rock':
        ctx.fillStyle = '#6b6b6b';
        ctx.fillRect(x - d.size/2, y - d.size/2, d.size, d.size);
        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(x - d.size/2 + 2, y - d.size/2 + 2, 4, 4);
        break;
      case 'cactus':
        ctx.fillStyle = '#2d5a2d';
        ctx.fillRect(x - 3, y - d.size, 6, d.size * 2);
        ctx.fillRect(x - 8, y - d.size/2, 5, 4);
        ctx.fillRect(x + 3, y - d.size/2 - 4, 5, 4);
        break;
    }
  },
  
  drawTree(ctx, x, y, size, variant) {
    // 树干
    ctx.fillStyle = '#5d3a1a';
    ctx.fillRect(x - 2, y - 4, 4, 12);
    // 树冠(根据变体不同颜色)
    const colors = ['#1f4a1f', '#2d5a2d', '#3a6a3a'];
    const darkColors = ['#143a14', '#1f4a1f', '#2d5a2d'];
    ctx.fillStyle = colors[variant % 3];
    ctx.fillRect(x - size/2, y - size, size, size);
    ctx.fillStyle = darkColors[variant % 3];
    ctx.fillRect(x - size/2 + 2, y - size + 2, 4, 4);
    ctx.fillRect(x + size/2 - 6, y - size + 4, 3, 3);
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(x - size/2 + 4, y - size + 2, 3, 3);
  },
  
  /**
   * 获取随机刷新点
   */
  getRandomSpawnPoint(nearX = null, nearY = null, minDist = 500) {
    if (nearX !== null) {
      // 在玩家附近找刷新点(不能太近)
      const candidates = this.spawnPoints.filter(p => {
        const d = Physics.distance(p.x, p.y, nearX, nearY);
        return d > CONFIG.BEAST.MIN_SPAWN_DIST && d < 900;
      });
      if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
      // 退而求其次:任何距离>500的刷新点
      const far = this.spawnPoints.filter(p => Physics.distance(p.x, p.y, nearX, nearY) > CONFIG.BEAST.MIN_SPAWN_DIST);
      if (far.length > 0) return far[Math.floor(Math.random() * far.length)];
    }
    if (this.spawnPoints.length === 0) return { x: this.width/2, y: this.height/2 };
    return this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
  }
};
