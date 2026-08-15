/**
 * 东海港口与海神岛的地点专属事件。
 * 这些事件不是正式猎魂事件，只会被对应地点行动模式优先选取。
 */
export const LOCATION_EVENTS = [
  {
    id: 'east_port_explore_tide_marks', name: '潮汐刻痕', location: '东海港口·潮线', phase: 'any', minLevel: 20,
    locationActionType: 'local_exploration', image: 'assets/scenes/border_town.jpg', unique: true, weight: 8,
    text: ['退潮后的石堤留下三道不合常理的刻痕。', '你沿着潮线比对风向，发现刻痕指向一条被船队刻意避开的暗流。'],
    choices: [
      { text: '记录刻痕并追踪暗流', result: { exp: 65, text: '你把潮汐刻痕和暗流方向绘入航海图，得到一条可供后续调查的安全边界。' } },
      { text: '先询问守堤人', result: { exp: 45, fate: 1, text: '守堤人讲起十年前的一场海难，暗流背后似乎藏着未被打捞的线索。' } }
    ]
  },
  {
    id: 'east_port_explore_sealed_warehouse', name: '封潮仓的印记', location: '东海港口·封潮仓', phase: 'any', minLevel: 20,
    locationActionType: 'local_exploration', image: 'assets/scenes/border_town.jpg', unique: true, weight: 8,
    text: ['港口最里面的仓门挂着旧式海魂师封印，门缝里传出盐和药草混合的气味。', '你没有贸然破坏封印，而是从货牌、脚印和潮湿程度判断出仓库最近有人进出。'],
    choices: [
      { text: '检查货牌与脚印', result: { exp: 70, gold: 20, text: '货牌拼出一条被删改的补给记录，指向海神岛航线的旧护航队。' } },
      { text: '请港口执事共同查验', result: { exp: 40, fate: 1, text: '港口执事愿意为你登记查验，封潮仓的秘密被正式纳入港口档案。' } }
    ]
  },
  {
    id: 'east_port_explore_storm_buoy', name: '风暴浮标', location: '东海港口·外锚地', phase: 'any', minLevel: 20,
    locationActionType: 'local_exploration', image: 'assets/scenes/mountain_path.jpg', unique: true, weight: 7,
    text: ['外锚地的风暴浮标反复偏航，铁链上缠着陌生的黑色海藻。', '你从浮标的损伤方向推断，深海的风暴正在提前逼近港口。'],
    choices: [
      { text: '修正浮标并测算风暴', result: { exp: 75, text: '浮标重新稳定，港口获得了一段宝贵的预警时间。' } },
      { text: '取下海藻带回检验', result: { exp: 55, gold: 15, text: '海藻中残留着深海魂兽的鳞粉，证明这不是普通季风。' } }
    ]
  },
  {
    id: 'east_port_commission_captain_license', name: '船长许可', location: '东海港口·船务厅', phase: 'any', minLevel: 20,
    locationActionType: 'local_commission', image: 'assets/scenes/border_town.jpg', unique: true, weight: 9,
    text: ['东海船长把一枚旧铜牌推到你面前：想去海神岛，先证明你能对自己的航线负责。', '许可委托要求你核对船员、淡水、魂力补给和返航信号。'],
    choices: [
      { text: '逐项完成出海核验', result: { gold: 35, exp: 55, text: '船长在铜牌背面盖下潮印，正式记录了你的出海资格。' } },
      { text: '提出更短的补给方案', result: { gold: 25, text: '你压缩了不必要的货物，却保留了救命的淡水和魂力药剂。' } }
    ]
  },
  {
    id: 'east_port_commission_supply_manifest', name: '船队补给账册', location: '东海港口·补给码头', phase: 'any', minLevel: 20,
    locationActionType: 'local_commission', image: 'assets/scenes/blacksmith.jpg', unique: true, weight: 8,
    text: ['港口执事委托你核对三艘船的补给账册，其中一船的淡水数量与登记不符。', '缺口不大，却足以让深海航行变成一场赌命。'],
    choices: [
      { text: '追查少掉的淡水', result: { gold: 45, exp: 40, text: '你在旧仓底找到被挪用的水囊，补给账册恢复准确。' } },
      { text: '直接补齐缺口并记账', result: { gold: 30, fate: 1, text: '你先补齐缺口再追责，船队得以按时出航，执事记下了你的可靠。' } }
    ]
  },
  {
    id: 'east_port_commission_sea_route', name: '海运委托', location: '东海港口·航线台', phase: 'any', minLevel: 20,
    locationActionType: 'local_commission', image: 'assets/scenes/sea_god_island.jpg', unique: true, weight: 8,
    text: ['一支返航商队请你把一枚潮汐信标送到海神岛外海，途中不能让信标受损。', '信标记录着近月海流，是港口安排下一次航行的重要依据。'],
    choices: [
      { text: '接受护送并按潮线航行', result: { gold: 55, exp: 60, text: '你把潮汐信标交给外海接应船，港口获得了最新的海流情报。' } },
      { text: '改走风暴边缘的短线', result: { gold: 70, text: '短线让商队提前返航，但你也把危险航段标记在委托记录中。' } }
    ]
  },
  {
    id: 'east_port_contact_soul_master_guard', name: '海魂师护航员', location: '东海港口·护航台', phase: 'any', minLevel: 20,
    locationActionType: 'local_contact', image: 'assets/scenes/sea_god_island.jpg', unique: true, weight: 8,
    text: ['一名海魂师护航员正在检查自己的鳞甲武魂，他不轻易相信第一次出海的魂师。', '你需要用一场短暂的协作证明自己不是只会在陆地上战斗。'],
    choices: [
      { text: '用武魂配合完成护航演练', result: { fate: 2, exp: 55, text: '护航员认可了你的站位和判断，愿意在海神岛航线上为你留一个联络信号。' } },
      { text: '交换彼此的海上见闻', result: { fate: 1, text: '你们交换了风暴和魂兽的情报，护航员告诉你海神岛外海最近出现了异常白浪。' } }
    ]
  },
  {
    id: 'east_port_contact_smuggler_conflict', name: '港口暗线', location: '东海港口·旧栈桥', phase: 'any', minLevel: 20,
    locationActionType: 'local_contact', image: 'assets/scenes/tavern.jpg', unique: true, weight: 7,
    text: ['旧栈桥下有人用三短两长的敲击声传递消息，内容似乎与海神岛航线有关。', '你找到一名愿意合作的走私客，却必须先决定如何处理他手里的假许可。'],
    choices: [
      { text: '说服他交出假许可', result: { fate: 2, gold: 25, text: '走私客交出假许可，并透露了一个能避开海盗的联络暗号。' } },
      { text: '用假许可反查幕后人', result: { fate: 1, exp: 70, text: '你没有立即销毁假许可，而是沿着伪造印记追到了一条更深的港口暗线。' } }
    ]
  },
  {
    id: 'sea_island_explore_qualification', name: '登岛资格审查', location: '海神岛·登陆台', phase: 'god', minLevel: 75, maxLevel: 89,
    locationActionType: 'local_exploration', image: 'assets/scenes/sea_god_island.jpg', unique: true, weight: 10,
    text: ['登陆台的海水退去，露出刻有七道圣柱纹样的石阶。守岛者要求你说明来意、魂环数量与承受风险的准备。', '这不是正式猎魂本身，而是进入岛内探索前必须完成的资格核验。'],
    choices: [
      { text: '如实提交魂环与航行记录', result: { exp: 100, fate: 1, text: '守岛者确认你的七环根基和航行记录，允许你继续调查岛内线索。' } },
      { text: '先观察七圣柱纹路', result: { exp: 80, text: '你从纹路的潮痕判断出岛内考核会随风暴强度变化。' } }
    ]
  },
  {
    id: 'sea_island_explore_reef_tracks', name: '海魂兽回迹', location: '海神岛·珊瑚礁', phase: 'god', minLevel: 75, maxLevel: 89,
    locationActionType: 'local_exploration', image: 'assets/scenes/sea_god_island.jpg', unique: true, weight: 9,
    text: ['珊瑚礁的断面留下巨型海魂兽拖行的痕迹，水下砂砾却没有任何血迹。', '你沿着回迹逆流而上，发现海魂兽似乎在保护一片被海雾遮住的浅湾。'],
    choices: [
      { text: '跟随回迹确认浅湾', result: { exp: 110, text: '你确认浅湾是海魂兽的避风地，并记下不会惊扰它们的进入角度。' } },
      { text: '采集珊瑚上的鳞粉', result: { exp: 85, gold: 30, text: '鳞粉证明海魂兽曾在此接受过某种潮汐力量的洗礼。' } }
    ]
  },
  {
    id: 'sea_island_explore_seven_pillars', name: '七圣柱回声', location: '海神岛·七圣柱', phase: 'god', minLevel: 75, maxLevel: 89,
    locationActionType: 'local_exploration', image: 'assets/scenes/temple.jpg', unique: true, weight: 8,
    text: ['七根圣柱同时映出潮光，柱身回声并不指向同一个方向。', '你在回声间辨认出一段尚未完整显现的考核线索，却没有把它误认成已经开始的神考。'],
    choices: [
      { text: '记录七圣柱的回声顺序', result: { exp: 120, fate: 1, text: '回声顺序被记录下来，后续调查可以用它判断岛上潮汐变化。' } },
      { text: '以武魂试探最弱的柱光', result: { exp: 90, text: '柱光短暂回应你的武魂，透露出一条通往海神湖的安全路径。' } }
    ]
  },
  {
    id: 'sea_island_commission_lake_survey', name: '海神湖测绘', location: '海神岛·海神湖', phase: 'god', minLevel: 75, maxLevel: 89,
    locationActionType: 'local_commission', image: 'assets/scenes/sea_god_island.jpg', unique: true, weight: 10,
    text: ['岛民委托你测绘海神湖的潮位变化，最近湖心的回流会在夜间突然改变。', '这份委托关系到岛上居民和海魂兽的安全，不能只凭一次观测下结论。'],
    choices: [
      { text: '连续记录三次潮位', result: { gold: 90, exp: 70, text: '三次记录显示湖心回流与远海风暴有关，岛民得以提前安排避险。' } },
      { text: '把测绘任务交给熟悉湖面的居民', result: { gold: 60, fate: 1, text: '你与居民共同完成测绘，既节省时间，也保留了当地人的经验。' } }
    ]
  },
  {
    id: 'sea_island_commission_resident_task', name: '岛民守潮', location: '海神岛·居民村', phase: 'god', minLevel: 75, maxLevel: 89,
    locationActionType: 'local_commission', image: 'assets/scenes/sea_god_island.jpg', unique: true, weight: 9,
    text: ['岛民请你在风暴前把几艘小船拖入高地船坞，船上还装着给守岛者的药材。', '时间紧迫，但任何一箱药材受潮都会影响岛上伤员的救治。'],
    choices: [
      { text: '先转运药材再固定船只', result: { gold: 80, exp: 75, text: '药材安全送达，岛民也在你的安排下完成了船只加固。' } },
      { text: '用武魂一次搬运整船物资', result: { gold: 65, exp: 60, text: '你用武魂力量缩短了转运时间，但仍按岛民的清单逐箱清点。' } }
    ]
  },
  {
    id: 'sea_island_commission_storm_watch', name: '海上风暴预警', location: '海神岛·望潮台', phase: 'god', minLevel: 75, maxLevel: 89,
    locationActionType: 'local_commission', image: 'assets/scenes/mountain_path.jpg', unique: true, weight: 8,
    text: ['望潮台的风铃在无风时响起，守岛者请你确认远海是否有异常风暴。', '你必须在不惊动海魂兽群的前提下，把预警送回东海港口。'],
    choices: [
      { text: '沿低空潮线放出预警信号', result: { gold: 100, exp: 80, text: '预警信号穿过海雾抵达港口，船队及时收帆避开了风暴。' } },
      { text: '先确认风暴中心再报告', result: { gold: 75, exp: 100, text: '你确认风暴中心正在偏移，报告因此更准确，也避免了误导船队。' } }
    ]
  },
  {
    id: 'sea_island_contact_guardian', name: '守岛者的问潮', location: '海神岛·守潮门', phase: 'god', minLevel: 75, maxLevel: 89,
    locationActionType: 'local_contact', image: 'assets/scenes/temple.jpg', unique: true, weight: 10,
    text: ['守岛者没有直接回答你的问题，只让你听一夜潮声，再说出其中三次变化的先后。', '他在考察你的耐心与观察，而不是提前开启任何神考或魂环流程。'],
    choices: [
    { text: '按潮声顺序复述观察', result: { fate: 2, exp: 90, text: '守岛者认可你的观察力，告诉你当前魂环目标的正式猎魂仍需另行执行。' } },
      { text: '承认尚未听懂潮声', result: { fate: 1, text: '你没有伪装全知，守岛者反而愿意把一枚避风信物交给你。' } }
    ]
  },
  {
    id: 'sea_island_contact_exam_clue', name: '前置考核线索', location: '海神岛·圣殿外廊', phase: 'god', minLevel: 75, maxLevel: 89,
    locationActionType: 'local_contact', image: 'assets/scenes/temple.jpg', unique: true, weight: 9,
    text: ['一位岛民守护者在圣殿外廊整理旧石板，石板记载着历代魂师如何准备海上考核。', '他愿意分享内容，但要求你先说明自己来岛上的真正目标。'],
    choices: [
    { text: '如实说明当前魂环目标', result: { fate: 2, exp: 95, text: '守护者给出深海魔鲸海域的前置情报，但明确表示这不等于正式魂环奖励。' } },
      { text: '只询问岛屿与风暴规律', result: { fate: 1, exp: 70, text: '你获得了更稳妥的岛屿情报，并约定日后再交换更深的考核记录。' } }
    ]
  }
]
