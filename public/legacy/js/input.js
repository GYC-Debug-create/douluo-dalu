/**
 * 输入管理系统
 * 处理键盘、鼠标输入
 */
const Input = {
  keys: {},
  mouse: { x: 0, y: 0, worldX: 0, worldY: 0, down: false, justClicked: false },
  _pressed: {},
  _released: {},
  
  init(canvas) {
    this.canvas = canvas;
    
    // 键盘按下
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (!this.keys[key]) {
        this._pressed[key] = true;
      }
      this.keys[key] = true;
      // 阻止方向键滚动
      if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key)) {
        e.preventDefault();
      }
    });
    
    // 键盘抬起
    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = false;
      this._released[key] = true;
    });
    
    // 鼠标移动
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });
    
    // 鼠标按下
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouse.down = true;
        this.mouse.justClicked = true;
      }
    });
    
    // 鼠标抬起
    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouse.down = false;
      }
    });
    
    // 右键防止菜单
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // 失去焦点时清空按键
    window.addEventListener('blur', () => {
      this.keys = {};
      this.mouse.down = false;
    });
  },
  
  /**
   * 按键是否按下
   */
  isDown(key) {
    return !!this.keys[key.toLowerCase()];
  },
  
  /**
   * 按键是否刚按下(单次触发)
   */
  isJustPressed(key) {
    return !!this._pressed[key.toLowerCase()];
  },
  
  /**
   * 按键是否刚释放
   */
  isJustReleased(key) {
    return !!this._released[key.toLowerCase()];
  },
  
  /**
   * 获取移动方向向量
   */
  getMovement() {
    let dx = 0, dy = 0;
    if (this.isDown('w') || this.isDown('arrowup')) dy -= 1;
    if (this.isDown('s') || this.isDown('arrowdown')) dy += 1;
    if (this.isDown('a') || this.isDown('arrowleft')) dx -= 1;
    if (this.isDown('d') || this.isDown('arrowright')) dx += 1;
    // 归一化
    if (dx !== 0 && dy !== 0) {
      const len = Math.sqrt(dx*dx + dy*dy);
      dx /= len; dy /= len;
    }
    return { dx, dy };
  },
  
  /**
   * 每帧末清空单次触发状态
   */
  endFrame() {
    this._pressed = {};
    this._released = {};
    this.mouse.justClicked = false;
  }
};
