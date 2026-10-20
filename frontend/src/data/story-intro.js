/**
 * 序章与早年经历内容（纯内容模块，不 import store）
 *
 * 从 useEventEngine.js 移出：这两段是"剧情文案 + 事件装配"，只读玩家画像，
 * 由调用方传入 player 对象（store 实例或普通对象均可）。
 */

'use strict';

export const INTRO_ORIGINS = {
  star_forest: {
    place: '圣魂村外', person: '村中老铁匠', image: 'assets/scenes/forest_outer.jpg',
    birth: '你出生在星斗大森林边缘的普通农户家庭，林风与铁锤声陪伴你长大。'
  },
  spirit_city: {
    place: '武魂城旧街', person: '家族藏书阁的守卷人', image: 'assets/scenes/wuhun_city.jpg',
    birth: '你出生在武魂城的魂师世家，礼法、典籍与家族期待环绕着你。'
  },
  border_town: {
    place: '边境城墙', person: '守城队长', image: 'assets/scenes/border_town.jpg',
    birth: '你出生在常受魂兽侵扰的边境小城，警钟和药草气味教会你珍惜安宁。'
  },
  sea_island: {
    place: '海边渔村', person: '识潮的老船长', image: 'assets/scenes/sea_god_island.jpg',
    birth: '你出生在海神岛周边的小渔村，潮汐与风暴磨出了你的耐性。'
  }
}

export function buildPrologueEvent(player) {
  const origin = INTRO_ORIGINS[player.origin] || INTRO_ORIGINS.star_forest
  const traits = (player._personality?.traits || ['独特']).slice(0, 3).join('、')
  // 圣魂村出身的孩子，和唐三同一天觉醒（原著第一个名场面）。
  const sameDayAsTangSan = player.origin === 'star_forest'
  return {
    id: 'vue_prologue',
    name: '序章 · 武魂觉醒',
    location: player.originName || origin.place,
    image: origin.image,
    unique: true,
    text: [
      origin.birth,
      '终于，你六岁了。武魂殿的魂师来到这里，为适龄的孩子主持觉醒仪式。',
      `六枚觉醒石依次点亮，你的武魂「${player.spirit?.name || '武魂'}」第一次显现在世间。`,
      ...(sameDayAsTangSan
        ? ['排在你旁边的黑发男孩手里冒出了一株细细的蓝银草。主持仪式的执事摇摇头："废武魂。"周围有人小声笑了，可那个男孩一点也不沮丧，只是认真地看着自己的手心。你记住了他的样子。']
        : []),
      `你从武魂的回应里理解了${traits}。武魂定义起点，却不能替你决定终点。`
    ],
    choices: [{
      id: 'begin',
      text: '记住自己的来处，踏上魂师之路',
      path: 'begin',
      ...(sameDayAsTangSan ? { marks: ['saw_tangsan_awaken'] } : {}),
      result: { text: `你的名字是${player.name}，觉醒资质${player.innatePower}/100，起始魂力等级${Math.max(1, Math.min(10, Math.floor((Number(player.innatePower) || 0) / 10)))}级。斗罗大陆的篇章，就此展开……` },
      // 旧脚本约定：effect(G) 通过 G 代理写 store（_prologueDone 属 event store 顶层字段），
      // 与拆分前闭包直写 eventStore 的效果逐位一致。
      effect: G => {
        G._prologueDone = true
        G._spiritAwakeningStoryDone = true
      }
    }]
  }
}

export function buildEarlyLifeEvents(player) {
  const origin = INTRO_ORIGINS[player.origin] || INTRO_ORIGINS.star_forest
  const spirit = player.spirit || { id: 'unknown', name: '武魂', type: '未知武魂' }
  const nodes = [
    {
      id: `early_family_${player.origin}`, name: '家的灯火', location: origin.place, image: origin.image,
      text: '入学前的最后一个清晨，家里还有许多事要做。你决定——',
      choices: [
        { id: 'help', text: '留下帮家人做完手头的活', path: 'loyal', result: { defense: 1 }, reply: '你学会了把力量用在照顾身边的人上。' },
        { id: 'train', text: '先完成今日的基础锻炼', path: 'pragmatic', result: { attack: 1 }, reply: '一遍遍扎实的动作，让你的根基更稳。' },
        { id: 'listen', text: '听家人再讲一次故乡往事', path: 'scholar', result: { fate: 1 }, reply: '那些往事成为你日后辨认归途的坐标。' }
      ]
    },
    {
      id: `early_person_${player.origin}`, name: '重要的人', location: origin.place, image: origin.image,
      text: `${origin.person}在路口等你，只问：“成为魂师以后，你最想守住什么？”`,
      choices: [
        { id: 'people', text: '守住重要的人', path: 'merciful', result: { defense: 1 }, reply: '对方点点头，把一句“莫忘本心”留给了你。' },
        { id: 'truth', text: '守住求知与判断', path: 'scholar', result: { spiritPowerGain: 1 }, reply: '一册写满批注的旧笔记被郑重交到你手中。' },
        { id: 'freedom', text: '守住选择自己道路的自由', path: 'rebel', result: { speed: 1 }, reply: '你第一次清楚说出了属于自己的答案。' }
      ]
    },
    {
      id: `early_spirit_${spirit.id}`, name: '第一次武魂感应', location: '入学前夜', image: spirit.image || 'assets/scenes/library_night.jpg',
      text: `夜深时，「${spirit.name}」在你的心海中轻轻回应，将一缕魂力递到你面前。`,
      choices: [
        { id: 'accept', text: '坦然接纳这份力量', path: 'ambitious', result: { attack: 1 }, reply: `你与「${spirit.name}」的气息第一次完整重合。` },
        { id: 'observe', text: '先观察魂力如何流转', path: 'tactician', result: { defense: 1 }, reply: '你记住了每一次明暗变化，对自己的武魂多了一分理解。' },
        { id: 'promise', text: '许诺绝不轻视任何武魂', path: 'saint', result: { fate: 1 }, reply: '那缕魂光温和地亮了一瞬，像是在回应你的承诺。' }
      ]
    },
    {
      id: `early_registration_${player.origin}`, name: '魂师登记与评定', location: `${origin.place} · 武魂殿分殿`, image: 'assets/scenes/temple.jpg',
      text: '觉醒后的手续不能只靠一纸天赋。你要登记武魂、测定魂力，并听取未来修炼方向的建议。',
      choices: [
        { id: 'register', text: '如实登记，接受完整评定', path: 'prudent', result: { spiritPowerGain: 2, fate: 1 }, reply: '执事将你的武魂与魂力等级记入档案。', after: 'registered' },
        { id: 'question', text: '追问不同武魂的修炼道路', path: 'scholar', result: { spiritPowerGain: 1, defense: 1 }, reply: '执事认真告诉你学院与宗门的区别。', after: 'registered' },
        { id: 'private', text: '只登记必要信息，保留家族底牌', path: 'prudent', result: { speed: 1, fate: -1 }, reply: '你谨慎地收起评定单。', after: 'registered' }
      ]
    },
    {
      // 原著里唐三是带着推荐信去诺丁学院当工读生的；儿童版玩家同样从诺丁起步，之后再一起考进史莱克。
      id: `early_recommendation_${player.origin}`, name: '去诺丁学院', location: origin.place, image: origin.image,
      text: '登记完成后，执事交给你一封推荐信：诺丁城有一所诺丁初级魂师学院，收"工读生"——一边帮学院干活，一边跟着老师学本事。这是你成为魂师的第一站。',
      choices: [
        { id: 'go_now', text: '收好推荐信，第二天一早就出发', path: 'pragmatic', result: { speed: 1, exp: 20 }, reply: '天还没亮你就上路了。走到诺丁城门口时，太阳刚刚升起来。', after: 'nuoding' },
        { id: 'farewell', text: '先和家人好好告别，再出发', path: 'loyal', result: { defense: 1, exp: 20 }, reply: '家人送了你很远很远。你回头挥了好几次手，才终于走进了诺丁城。', after: 'nuoding' },
        { id: 'study_route', text: '把推荐信读三遍，记住去诺丁的路', path: 'prudent', result: { fate: 1, exp: 20 }, reply: '你把路线背得滚瓜烂熟，一路上一次都没有走错，顺顺利利到了诺丁城。', after: 'nuoding' }
      ]
    }
  ]
  return nodes.map(node => ({ ...node, phase: 'academy', unique: true, choices: node.choices.map(choice => ({ ...choice })) }))
}
