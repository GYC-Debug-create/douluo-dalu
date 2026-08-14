/**
 * 斗罗大陆 - 武魂觉醒
 * 主入口
 */
(async function() {
  'use strict';
  
  // 模拟加载过程
  const loadingSteps = [
    { progress: 15, text: '正在生成世界...' },
    { progress: 35, text: '加载武魂数据...' },
    { progress: 55, text: '加载魂兽数据...' },
    { progress: 75, text: '初始化引擎...' },
    { progress: 100, text: '准备就绪!' }
  ];
  
  UI.init();
  
  // 初始化世界
  World.init();
  
  for (const step of loadingSteps) {
    UI.updateLoading(step.progress, step.text);
    await new Promise(r => setTimeout(r, 300));
  }
  
  // 初始化游戏
  Game.init();
  
  // 显示主菜单
  await new Promise(r => setTimeout(r, 300));
  UI.showScreen('menu');
  
  console.log('斗罗大陆 - 武魂觉醒 已加载完成');
})();
