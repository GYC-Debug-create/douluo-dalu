/**
 * 斗罗大陆·武魂觉醒 —— 儿童版后期事件（41~100 级）
 *
 * 原事件库 41 级以后内容骤减，71~90 级 28 个地点里 25 个没有任何事件。
 * 这里按地点补齐后期内容：身份是毕业后在大陆历练的魂师（模式 2+：与七怪同侪），
 * 写法遵循儿童版"温和冒险"标准——没有饮酒、赌博、死亡与血腥描写，冲突以击退、和解、救助收场。
 *
 * phase: 'any' + minLevel 控制出现时机；经验 2500~4500，配合后期经验折扣，约 0.7~1 级/个。
 * 选项带 path 标签（guardian/brave/wise/free），会影响最终结局的倾向。
 */

export const LATE_GAME_EVENTS = [
  // ---------- 天斗城 ----------
  {
    id: 'late_tiandou_01', name: '城门口的小魂师', location: '天斗城·城门', phase: 'any', minLevel: 41, weight: 3,
    image: 'assets/locations/天斗城.jpg',
    text: ['天斗城门口，一个刚觉醒武魂的小男孩拦住了你。他的武魂是一根小小的木棍，周围的孩子都在笑他。', '"大哥哥大姐姐，木棍武魂……也能成为魂师吗？"'],
    choices: [
      { text: '蹲下来，认真告诉他：武魂没有好坏之分', path: 'guardian', result: { text: '你给他讲了蓝银草武魂的故事。小男孩擦干眼泪，攥紧了木棍："我也要变得很厉害！"旁边笑话他的孩子们都安静了。', exp: 2800, fate: 2 } },
      { text: '教他三招木棍的基本用法', path: 'wise', result: { text: '你找了根树枝，手把手教他劈、挡、戳。小男孩学得飞快，最后一招还差点打到你的鼻子。', exp: 3200, speed: 1 } },
      { text: '带他去史莱克学院报名处看看', path: 'free', result: { text: '你带他去看了史莱克学院的招生告示。"等你十二岁，就来这里找我们！"小男孩用力点头。', exp: 3000, gold: 40 } }
    ]
  },
  {
    id: 'late_tiandou_02', name: '皇家图书馆的怪书', location: '天斗城·皇家图书馆', phase: 'any', minLevel: 48, weight: 2,
    image: 'assets/scenes/library.jpg',
    text: ['天斗城皇家图书馆最深处，有一本书会自己翻页。管理员说，它已经这样翻了一百年，没人看懂上面的字。'],
    choices: [
      { text: '花一整天时间研究上面的文字', path: 'wise', result: { text: '你发现这些字倒过来读，是一位古代魂师写的修炼笔记！你记下了其中一段运功的诀窍。', exp: 3600, spiritPowerGain: 6 } },
      { text: '把书合上，用魂力感应它', path: 'brave', result: { text: '书页忽然停住，一道微光钻进你的手心。你的魂力好像被轻轻梳理了一遍，舒服极了。', exp: 3000, maxHp: 30 } },
      { text: '请管理员一起想办法', path: 'guardian', result: { text: '你和管理员一起研究了三天，终于找到了让它停下的方法。管理员感动地说：以后图书馆随时欢迎你。', exp: 3100, fate: 2 } }
    ]
  },
  {
    id: 'late_tiandou_03', name: '魂师擂台的新秀', location: '天斗城·擂台', phase: 'any', minLevel: 60, weight: 2,
    image: 'assets/scenes/arena.jpg',
    text: ['天斗城擂台上，一个年轻魂师连赢了十场，正得意地挑衅："还有谁敢上来？"台下的人都看向了你。'],
    choices: [
      { text: '上台和他比一场', path: 'brave', result: { text: '你们打得有来有回。最后你一招制胜，伸手把他拉了起来："你很厉害，就是太骄傲了。"他红着脸点了点头。', battle: 'arena_fighter', exp: 3800, attack: 2 } },
      { text: '不上台，私下指出他的三个破绽', path: 'wise', result: { text: '你等比赛结束后找到他，把他的破绽一一指出。他愣了半天，最后郑重地向你鞠了一躬。', exp: 3500, fate: 1 } },
      { text: '笑着摆摆手，继续逛街', path: 'free', result: { text: '你笑着摆摆手走开了，在街角买了一串糖葫芦。比起打擂台，你更喜欢看热闹的人群。', exp: 2600, gold: 30 } }
    ]
  },
  {
    id: 'late_tiandou_04', name: '天斗城的灯会', location: '天斗城·长街', phase: 'any', minLevel: 75, weight: 2, season: 'winter',
    image: 'assets/locations/天斗城.jpg',
    text: ['冬天的天斗城办起了灯会，长街上挂满了各种各样的花灯。有人认出了你："快看，那是大陆有名的魂师！"'],
    choices: [
      { text: '帮小朋友们用魂力点亮最高的那盏灯', path: 'guardian', result: { text: '你用魂力托起火光，点亮了长街尽头最高的那盏灯。整条街都欢呼起来，孩子们围着你蹦蹦跳跳。', exp: 4000, fate: 2 } },
      { text: '参加猜灯谜比赛', path: 'wise', result: { text: '你一口气猜中了二十个灯谜，赢回一盏走马灯。上面画的，正好是史莱克八怪的样子——里面还有你。', exp: 4200, gold: 80 } }
    ]
  },

  // ---------- 史莱克学院 ----------
  {
    id: 'late_shrek_01', name: '回学院当一天老师', location: '史莱克学院·操场', phase: 'any', minLevel: 50, weight: 3,
    image: 'assets/scenes/training_ground.jpg',
    text: ['你回到史莱克学院看望大家，弗兰德院长一把拉住你："来得正好！今天的实战课，就由你来上！"', '操场上站着一排新生，一个个眼睛亮晶晶地看着你。'],
    choices: [
      { text: '给他们讲自己第一次猎魂环的故事', path: 'wise', result: { text: '你讲得绘声绘色，新生们听得入了迷。下课铃响了，还有人拉着你问个不停。', exp: 3400, fate: 2 } },
      { text: '陪他们一起跑圈，跑在最后面鼓励掉队的人', path: 'guardian', result: { text: '你跑在队伍最后，谁掉队了就陪谁一起跑。最后所有人都跑完了，大家累得躺在草地上哈哈大笑。', exp: 3200, maxHp: 40 } },
      { text: '和最强的新生切磋一场', path: 'brave', result: { text: '那个新生拼尽了全力，你也认真地接了他每一招。结束时你说："三年后，你一定比我现在还厉害。"', battle: 'academy_rival', exp: 3600, attack: 1 } }
    ]
  },
  {
    id: 'late_shrek_02', name: '大师的新研究', location: '史莱克学院·大师的书房', phase: 'any', minLevel: 65, weight: 2, npcIds: ['玉小刚'],
    image: 'assets/scenes/library_night.jpg',
    text: ['大师的书房里堆满了书，他正对着一张武魂图谱发愁："十大核心竞争力理论，还差最后一条想不明白。"'],
    choices: [
      { text: '把一路上见过的各种武魂讲给他听', path: 'wise', result: { text: '大师听着听着，眼睛越来越亮，抓起笔就写："对！就是这个！"他说这一条理论，要用你的名字命名。', exp: 4200, spiritPowerGain: 8, fate: 1 } },
      { text: '劝他先休息，明天再想', path: 'guardian', result: { text: '你给大师泡了杯热茶，硬是把他推去睡觉。第二天一早，他神清气爽地说："睡一觉，果然想通了。"', exp: 3600, fate: 2 } }
    ]
  },
  {
    id: 'late_shrek_03', name: '奥斯卡的香肠铺', location: '史莱克学院·食堂', phase: 'any', minLevel: 80, weight: 2, npcIds: ['奥斯卡'],
    image: 'assets/scenes/cafeteria.jpg',
    text: ['奥斯卡在学院门口开了一家小铺子，专卖他的"恢复大香肠"。"老朋友来了，第一根免费！"'],
    choices: [
      { text: '帮他招呼客人，忙了一整天', path: 'guardian', result: { text: '你系上围裙帮了一整天忙，铺子门口排起了长队。打烊时奥斯卡塞给你一大包香肠："路上吃！"', exp: 4000, item: { name: '回魂丹', type: 'heal', value: 60, count: 3 } } },
      { text: '和他聊聊这些年的经历', path: 'free', result: { text: '你们从中午聊到傍晚，从第一次见面聊到决战前夜。奥斯卡说："能和你们做朋友，是我这辈子最幸运的事。"', exp: 3800, fate: 2 } }
    ]
  },

  // ---------- 武魂城 ----------
  {
    id: 'late_wuhun_01', name: '武魂城的小巷', location: '武魂城·小巷', phase: 'any', minLevel: 45, weight: 3,
    image: 'assets/locations/武魂城.jpg',
    text: ['武魂城的大街上到处是武魂殿的执事，可小巷里却住着很多普通人家。一个小女孩正对着倒塌的鸡窝发愁。'],
    choices: [
      { text: '帮她把鸡窝修好', path: 'guardian', result: { text: '你搬木头、钉钉子，没多久就修好了一个新鸡窝。小女孩的奶奶非要塞给你两个煮鸡蛋。', exp: 2900, fate: 2 } },
      { text: '向巷子里的老人打听武魂殿的近况', path: 'wise', result: { text: '老人们告诉你，最近武魂殿在到处征召年轻魂师。你把这条消息悄悄记在了心里。', exp: 3300, speed: 1 } }
    ]
  },
  {
    id: 'late_wuhun_02', name: '武魂殿的年轻执事', location: '武魂城·广场', phase: 'any', minLevel: 70, weight: 2,
    image: 'assets/locations/武魂殿.jpg',
    text: ['广场上，一个年轻的武魂殿执事正在训斥卖菜的小贩，说他的摊位挡了路。小贩急得满头大汗。'],
    choices: [
      { text: '上前讲道理，帮小贩说话', path: 'brave', result: { text: '你不卑不亢地和执事讲道理。周围的人越聚越多，执事脸一红，嘟囔着走开了。小贩连声道谢。', exp: 3700, fate: 2 } },
      { text: '帮小贩把摊位挪到旁边空地上', path: 'guardian', result: { text: '你帮小贩把摊位挪了个地方，执事也没话说了。小贩的生意反而更好了，因为新地方正好在路口。', exp: 3400, gold: 50 } },
      { text: '私下找执事聊聊，问他为什么这么急', path: 'wise', result: { text: '原来执事也是被上级催得没办法。你们聊了很久，他说："其实，我也不想这样。"', exp: 3900, spiritPowerGain: 5 } }
    ]
  },

  // ---------- 东海港口 ----------
  {
    id: 'late_port_01', name: '迷路的海豚', location: '东海港口·码头', phase: 'any', minLevel: 42, weight: 3,
    image: 'assets/scenes/sea_god_island.jpg',
    text: ['码头边，一只小海豚被渔网缠住了，在浅水里拼命扑腾。渔民们说，它是跟着妈妈迷了路。'],
    choices: [
      { text: '跳进水里帮它解开渔网', path: 'guardian', result: { text: '你小心地解开渔网，小海豚在你身边转了三圈，才游向大海。远处，一只大海豚跃出水面，好像在说谢谢。', exp: 3000, fate: 3 } },
      { text: '借一条小船，护送它回到深海', path: 'brave', result: { text: '你划着小船，一直把它送到了海豚群出没的地方。回来的路上，你还看到了一大片会发光的水母。', exp: 3400, speed: 1 } }
    ]
  },
  {
    id: 'late_port_02', name: '老船长的航海图', location: '东海港口·船坞', phase: 'any', minLevel: 58, weight: 2,
    image: 'assets/scenes/sea_god_island.jpg',
    text: ['一位老船长要退休了，他想把一张珍贵的航海图送给"最适合的人"。"谁能说出大海最可怕的是什么，图就归谁。"'],
    choices: [
      { text: '"大海最可怕的，是不了解它。"', path: 'wise', result: { text: '老船长哈哈大笑："说得好！"他把航海图郑重地交给了你，上面标着一条通往海神岛的安全航线。', exp: 3800, fate: 2 } },
      { text: '"大海一点都不可怕，可怕的是不敢出海。"', path: 'brave', result: { text: '老船长摇摇头又点点头："年轻人有胆子是好事。"他送了你一个旧罗盘："别忘了回来的路。"', exp: 3500, speed: 2 } },
      { text: '"我不要地图，我想听您讲讲出海的故事。"', path: 'free', result: { text: '老船长讲了一整个下午，从巨浪讲到海妖，从星星讲到灯塔。你觉得这比任何地图都珍贵。', exp: 3600, maxHp: 30 } }
    ]
  },
  {
    id: 'late_port_03', name: '暴风雨夜的灯塔', location: '东海港口·灯塔', phase: 'any', minLevel: 82, weight: 2,
    image: 'assets/scenes/sea_god_island.jpg',
    text: ['暴风雨来了，灯塔的灯却突然熄灭了。海上还有三条渔船没有回港，岸上的家人急得直哭。'],
    choices: [
      { text: '冲上灯塔，用魂力点亮信号火', path: 'guardian', result: { text: '你顶着狂风爬上灯塔，用魂力点燃了信号火。半个时辰后，三条渔船终于摇摇晃晃地靠了岸。', exp: 4400, fate: 3 } },
      { text: '直接飞到海上，把渔船一条条拖回来', path: 'brave', result: { text: '你在巨浪里来回了三趟，把渔船一条一条护送回港。浑身湿透的你，被渔民们抬着绕港口走了一圈。', exp: 4600, damage: 40, attack: 2 } }
    ]
  },

  // ---------- 冰封森林 ----------
  {
    id: 'late_ice_01', name: '冰原上的雪狐', location: '冰封森林·雪原', phase: 'any', minLevel: 44, weight: 3,
    image: 'assets/locations/冰封森林.jpg',
    text: ['冰封森林的雪原上，一只雪狐一直跟在你后面。你停下，它也停下；你走，它也走。'],
    choices: [
      { text: '分给它一点干粮', path: 'guardian', result: { text: '雪狐吃完干粮，带你绕过了一片看不见的冰窟窿。原来，它是来给你带路的。', exp: 3100, fate: 2 } },
      { text: '跟着它走，看看它要去哪', path: 'free', result: { text: '雪狐带你来到一处冰洞，洞里结着蓝色的冰晶，散发着淡淡的魂力。你在这里修炼了一整夜。', exp: 3500, spiritPowerGain: 6 } }
    ]
  },
  {
    id: 'late_ice_02', name: '冰帝蝎的领地', location: '冰封森林·冰谷', phase: 'any', minLevel: 62, weight: 2,
    image: 'assets/scenes/snow_mountain.jpg',
    text: ['你不小心走进了冰帝蝎的领地。巨大的冰蝎举起尾钩，冰冷的寒气让你的眉毛都结了霜。'],
    choices: [
      { text: '正面迎战', path: 'brave', result: { text: '冰帝蝎的寒气很厉害，但你用魂力护住全身，一次次顶住了它的攻击，最后把它逼退回了冰谷深处。', battle: '冰帝蝎', exp: 4000, defense: 2 } },
      { text: '慢慢后退，表明自己没有恶意', path: 'wise', result: { text: '你一步一步退出了它的领地。冰帝蝎盯着你看了很久，最后放下了尾钩。魂兽也懂得分辨善意。', exp: 3200, fate: 2 } }
    ]
  },

  // ---------- 落日森林 / 灵药谷 ----------
  {
    id: 'late_sunset_01', name: '落日森林的采药人', location: '落日森林·山道', phase: 'any', minLevel: 46, weight: 3,
    image: 'assets/locations/落日森林.jpg',
    text: ['落日森林的山道上，一位采药的老爷爷崴了脚，药篓里的草药撒了一地。'],
    choices: [
      { text: '背他下山', path: 'guardian', result: { text: '你把老爷爷背下了山，又帮他把草药一株株捡好。老爷爷教了你辨认三种珍贵草药的方法。', exp: 3200, fate: 2 } },
      { text: '用治疗类的魂技帮他止痛', path: 'wise', result: { text: '你小心地用魂力帮他消了肿。老爷爷活动了一下脚腕："神了！小魂师，这包解毒草送给你。"', exp: 3000, item: { name: '解毒丹', type: 'cure', value: 1, count: 2 } } }
    ]
  },
  {
    id: 'late_herb_01', name: '会跑的人参', location: '灵药谷·药田', phase: 'any', minLevel: 52, weight: 2,
    image: 'assets/locations/灵药谷.jpg',
    text: ['灵药谷里，一棵小人参长出了两条腿，看见你就跑。据说成了精的药草，吃了能增长魂力。'],
    choices: [
      { text: '追上去抓住它', path: 'brave', result: { text: '你追了它三座山，终于抓住了。可小人参哭得稀里哗啦，你心一软，又把它放了。它临走时留下了一片叶子。', exp: 3400, spiritPowerGain: 5 } },
      { text: '不追了，它也是一条小生命', path: 'guardian', result: { text: '你停下脚步。小人参跑出老远，又偷偷回头看你。第二天，你的帐篷门口多了一株灵草。', exp: 3200, fate: 3 } }
    ]
  },

  // ---------- 杀戮之都 / 邪魔森林 / 暗影沼泽 ----------
  {
    id: 'late_slaughter_01', name: '杀戮之都的门口', location: '杀戮之都·城门', phase: 'any', minLevel: 50, weight: 2,
    image: 'assets/locations/杀戮之都.jpg',
    text: ['杀戮之都是一座阴暗的城，据说只有最狠的人才能在里面生存。城门口，一个少年正犹豫要不要进去："听说进去就能变强……"'],
    choices: [
      { text: '劝他：真正的强大不是靠狠', path: 'guardian', result: { text: '你给他讲了史莱克学院的故事。少年想了很久，最后转身离开了杀戮之都："我想去史莱克试试。"', exp: 3400, fate: 3 } },
      { text: '陪他进去看一眼，再一起出来', path: 'brave', result: { text: '你们在城里走了一圈，里面又黑又乱。出来时少年脸色发白："我明白了，那不是我想要的强大。"', exp: 3800, defense: 2 } }
    ]
  },
  {
    id: 'late_evil_01', name: '邪魔森林的迷雾', location: '邪魔森林·迷雾林', phase: 'any', minLevel: 56, weight: 2,
    image: 'assets/locations/邪魔森林.jpg',
    text: ['邪魔森林常年被灰色的雾气笼罩，进去的人常常会迷路。雾里隐约传来求救声。'],
    choices: [
      { text: '循着声音冲进雾里', path: 'brave', result: { text: '你在雾里找到了两个迷路的猎人，用魂力点亮一条路，把他们带了出来。他们说要请你吃一辈子的烤肉。', exp: 3700, fate: 2 } },
      { text: '先在树上做好记号，再一步步找过去', path: 'wise', result: { text: '你边走边在树上刻记号，不但找到了迷路的人，还画出了一张邪魔森林的小地图，交给了附近的村子。', exp: 3900, speed: 1, fate: 1 } }
    ]
  },
  {
    id: 'late_swamp_01', name: '沼泽里的萤火', location: '暗影沼泽·水泽', phase: 'any', minLevel: 47, weight: 2,
    image: 'assets/scenes/swamp.jpg',
    text: ['暗影沼泽的夜里，成千上万的萤火虫飞了起来，把黑漆漆的水面照得像星空一样。一只萤火虫落在了你的手背上。'],
    choices: [
      { text: '在这里静静修炼一晚', path: 'free', result: { text: '萤火虫围着你转了一整夜。天亮时，你觉得魂力像沼泽里的水一样，变得又深又稳。', exp: 3500, spiritPowerGain: 6 } },
      { text: '跟着萤火虫走到沼泽深处', path: 'brave', result: { text: '萤火虫把你带到一棵古树下，树洞里藏着一个旧背包，里面有几颗丹药和一张字条："送给有缘人。"', exp: 3200, item: { name: '凝魂丹', type: 'mp', value: 120, count: 1 } } }
    ]
  },

  // ---------- 远古遗迹 / 龙之谷 / 元素峡谷 / 死亡沙漠 ----------
  {
    id: 'late_ruins_01', name: '会说话的石像', location: '远古遗迹·石殿', phase: 'any', minLevel: 49, weight: 3,
    image: 'assets/locations/远古遗迹.jpg',
    text: ['远古遗迹的石殿里，一尊石像忽然开口："回答我的问题，就让你过去：什么东西越分享越多？"'],
    choices: [
      { text: '"快乐！"', path: 'guardian', result: { text: '石像"咔咔"地笑了，往旁边让开了路。石殿后面，是一面刻满古代魂技图案的墙。', exp: 3600, attack: 1, fate: 1 } },
      { text: '"知识！"', path: 'wise', result: { text: '"也对！"石像让开了路，还送了你一句古老的修炼口诀，念起来魂力都跟着轻轻颤动。', exp: 3800, spiritPowerGain: 6 } }
    ]
  },
  {
    id: 'late_ruins_02', name: '遗迹深处的机关', location: '远古遗迹·地宫', phase: 'any', minLevel: 72, weight: 2,
    image: 'assets/scenes/ruin.jpg',
    text: ['地宫的门上有九个转盘，每个转盘上刻着一种魂兽。旁边的石碑写着：按它们的年限，从小排到大。'],
    choices: [
      { text: '凭着一路猎魂的经验来排', path: 'wise', result: { text: '你一个一个地转动转盘，最后一个转到位时，大门"轰隆隆"地打开了。里面有一套保存完好的古代护甲。', exp: 4300, defense: 3 } },
      { text: '直接用魂力把门推开', path: 'brave', result: { text: '你憋足了劲儿，硬是把石门推开了一条缝。门里的机关被你吓了一跳似的，全都卡住不动了。', exp: 3900, attack: 2, damage: 30 } }
    ]
  },
  {
    id: 'late_dragon_01', name: '龙之谷的回声', location: '龙之谷·谷口', phase: 'any', minLevel: 55, weight: 2,
    image: 'assets/locations/龙之谷.jpg',
    text: ['龙之谷很安静，只有风吹过时会发出低沉的回声，像巨龙在睡觉打呼噜。传说这里曾经住着很多龙。'],
    choices: [
      { text: '对着山谷大喊一声', path: 'brave', result: { text: '你的喊声在山谷里来回飘荡，最后变成了一声悠长的龙吟。你感觉胸口热乎乎的，力气都大了一些。', exp: 3500, attack: 2 } },
      { text: '沿着古老的石阶走进去看看', path: 'free', result: { text: '石阶尽头有一块巨大的鳞片，摸上去还是温的。你没有带走它，只在旁边坐了很久，听风讲古老的故事。', exp: 3700, fate: 2 } }
    ]
  },
  {
    id: 'late_element_01', name: '五色的山谷', location: '元素峡谷·彩石滩', phase: 'any', minLevel: 51, weight: 2,
    image: 'assets/locations/元素峡谷.jpg',
    text: ['元素峡谷的石头有红、蓝、黄、绿、白五种颜色，每一种都带着不同的元素气息。'],
    choices: [
      { text: '挑一块和自己武魂最合拍的石头', path: 'wise', result: { text: '你闭上眼睛感应，选中了一块微微发烫的石头。它和你的武魂产生了共鸣，你的魂技好像更顺手了。', exp: 3600, spiritPowerGain: 5, attack: 1 } },
      { text: '把五种石头摆成一圈，在中间修炼', path: 'free', result: { text: '五种元素在你身边慢慢旋转。修炼结束时，你对元素克制有了新的理解。', exp: 3800, defense: 1, speed: 1 } }
    ]
  },
  {
    id: 'late_desert_01', name: '沙漠里的商队', location: '死亡沙漠·绿洲', phase: 'any', minLevel: 53, weight: 2,
    image: 'assets/locations/死亡沙漠.jpg',
    text: ['死亡沙漠里，一支商队的骆驼累倒了，水也快喝完了。领队看到你，就像看到了救星。'],
    choices: [
      { text: '带他们找到最近的绿洲', path: 'guardian', result: { text: '你凭着星星辨认方向，带着商队走了一夜，天亮时终于看到了绿洲。大家扑进水里，笑得像孩子一样。', exp: 3600, fate: 3 } },
      { text: '把自己的水分给他们，再一起想办法', path: 'wise', result: { text: '你分出了自己的水，又教他们在沙丘背阴处挖坑找水。商队领队送了你一块会指方向的磁石。', exp: 3400, speed: 1, gold: 60 } }
    ]
  },

  // ---------- 天空之城 / 海神岛 / 深渊裂缝 ----------
  {
    id: 'late_sky_01', name: '云上的小鸟', location: '天空之城·云台', phase: 'any', minLevel: 60, weight: 2,
    image: 'assets/locations/天空之城.jpg',
    text: ['天空之城的云台上，一只小鸟怎么也飞不起来——它的翅膀被冻住了。'],
    choices: [
      { text: '用魂力帮它暖一暖翅膀', path: 'guardian', result: { text: '小鸟的翅膀慢慢化开了冰，它扑腾了两下飞上天空，在你头顶绕了一圈才离开。', exp: 3500, fate: 2 } },
      { text: '陪它一起等太阳出来', path: 'free', result: { text: '你们一起看了一场云海日出。太阳出来时，小鸟和你同时伸了个懒腰，它飞走了，你也觉得浑身轻松。', exp: 3700, maxHp: 40 } }
    ]
  },
  {
    id: 'late_sea_01', name: '海神岛的小朋友', location: '海神岛·沙滩', phase: 'any', minLevel: 66, weight: 2,
    image: 'assets/locations/海神岛.jpg',
    text: ['海神岛的沙滩上，几个岛上的孩子在堆沙堡。看见你，他们立刻围了过来："你是从大陆来的魂师吗？给我们讲讲大陆的故事吧！"'],
    choices: [
      { text: '给他们讲史莱克八怪的故事', path: 'guardian', result: { text: '孩子们听得哇哇直叫，最后要你保证："下次一定要带唐三大哥哥一起来！"', exp: 4000, fate: 2 } },
      { text: '教他们用沙子堆出一座天斗城', path: 'wise', result: { text: '你们堆了一座有城墙、有皇宫的大沙城。潮水涨上来冲走它时，孩子们一点都不难过："明天再堆一个！"', exp: 3800, speed: 1 } }
    ]
  },
  {
    id: 'late_sea_02', name: '海底的珍珠贝', location: '海神岛·浅海', phase: 'any', minLevel: 85, weight: 2,
    image: 'assets/scenes/sea_god_island.jpg',
    text: ['海神岛的浅海里，一只巨大的珍珠贝张开了壳，里面的珍珠亮得像月亮。守护珍珠贝的海龟慢悠悠地看着你。'],
    choices: [
      { text: '向海龟行礼，请它让你看一眼', path: 'wise', result: { text: '海龟点了点头。你看着那颗珍珠，心里忽然变得很平静，修炼时的杂念都消失了。', exp: 4400, spiritPowerGain: 8 } },
      { text: '不打扰它们，游去别的地方玩', path: 'free', result: { text: '你在浅海里和鱼群追逐了一下午，晒着太阳睡了一觉。有时候，好好休息也是修炼。', exp: 4000, maxHp: 50 } }
    ]
  },
  {
    id: 'late_abyss_01', name: '裂缝边的守望者', location: '深渊裂缝·边缘', phase: 'any', minLevel: 58, weight: 2,
    image: 'assets/locations/深渊裂缝.jpg',
    text: ['大地上有一道深深的裂缝，往下看黑漆漆的看不到底。一位老魂师在这里守了很多年，不让任何人靠近。'],
    choices: [
      { text: '帮他守一晚，让他好好睡个觉', path: 'guardian', result: { text: '老魂师睡了这些年来第一个好觉。醒来后，他教了你一种让魂力更稳固的呼吸方法。', exp: 3700, defense: 2, fate: 1 } },
      { text: '问他裂缝下面到底有什么', path: 'wise', result: { text: '老魂师笑了："什么都没有，只有风。可人心里的害怕，比裂缝还深。"你想了很久这句话。', exp: 3900, spiritPowerGain: 5 } }
    ]
  },

  // ---------- 上三宗 / 四大单属性宗族 ----------
  {
    id: 'late_haotian_01', name: '昊天宗的练锤场', location: '昊天宗·练锤场', phase: 'any', minLevel: 68, weight: 2,
    image: 'assets/locations/昊天宗.jpg',
    text: ['昊天宗的练锤场上，弟子们每天要挥锤一千下。一个小弟子挥到第九百下，胳膊已经抬不起来了。'],
    choices: [
      { text: '陪他一起挥完最后一百下', path: 'brave', result: { text: '你拿起一把锤子，和他一起数："九百零一、九百零二……"最后一下挥完，两个人都累得坐在了地上。', exp: 3900, attack: 2 } },
      { text: '教他一个省力的发力技巧', path: 'wise', result: { text: '你教他用腰带动手臂。他试了几下，眼睛一亮："真的不累了！"那天他第一次挥满了一千下。', exp: 3700, fate: 2 } }
    ]
  },
  {
    id: 'late_seven_01', name: '七宝琉璃塔', location: '七宝琉璃宗·琉璃塔', phase: 'any', minLevel: 76, weight: 2, npcIds: ['宁荣荣'],
    image: 'assets/locations/七宝琉璃宗.jpg',
    text: ['宁荣荣邀请你登上七宝琉璃塔。塔有七层，每一层都会让你的某一种能力增强一点点，但越往上越难走。'],
    choices: [
      { text: '一口气爬到第七层', path: 'brave', result: { text: '到第七层时你已经满头大汗，可窗外的景色美极了，整个天斗帝国都在脚下。宁荣荣竖起了大拇指。', exp: 4300, attack: 2, speed: 1 } },
      { text: '每层停下来好好感受', path: 'wise', result: { text: '你在每一层都停下来修炼一会儿，虽然没爬到顶，但每一种能力都扎扎实实地提高了。', exp: 4100, defense: 2, maxHp: 40 } }
    ]
  },
  {
    id: 'late_strength_01', name: '力之一族的掰手腕', location: '力之一族领地·演武场', phase: 'any', minLevel: 41, weight: 2,
    image: 'assets/locations/力之一族领地.jpg',
    text: ['力之一族的人个个力大无穷。一个小胖子向你挑战掰手腕："赢了我，我就叫你师父！"'],
    choices: [
      { text: '认真比一场', path: 'brave', result: { text: '你们僵持了好久，最后你险胜。小胖子揉着手腕，真的叫了你一声"师父"，周围的人笑成一片。', exp: 3000, attack: 2 } },
      { text: '故意输给他，让他开心一下', path: 'guardian', result: { text: '小胖子高兴得蹦了起来。不过他的爷爷看出来了，偷偷对你竖起大拇指："你是个好孩子。"', exp: 2800, fate: 2 } }
    ]
  },
  {
    id: 'late_speed_01', name: '敏之一族的赛跑', location: '敏之一族领地·山道', phase: 'any', minLevel: 54, weight: 2,
    image: 'assets/locations/敏之一族领地.jpg',
    text: ['敏之一族的人跑得比风还快。他们正在举办一年一度的山道赛跑，邀请你也来参加。'],
    choices: [
      { text: '参加比赛，拼尽全力', path: 'brave', result: { text: '你虽然没跑过他们的族长，却拿了第二名！族长送了你一双轻便的布鞋："你的速度，在外族人里算第一。"', exp: 3600, speed: 3 } },
      { text: '在终点帮忙给选手递水', path: 'guardian', result: { text: '你在终点给每个跑完的人递水、擦汗。比赛结束后，大家一起把你抛到了空中。', exp: 3200, fate: 2 } }
    ]
  },
  {
    id: 'late_defense_01', name: '御之一族的城墙', location: '御之一族领地·城墙', phase: 'any', minLevel: 64, weight: 2,
    image: 'assets/locations/御之一族领地.jpg',
    text: ['御之一族的城墙被山洪冲开了一个口子。族人们正在抢修，可是大石头太重了，搬得很慢。'],
    choices: [
      { text: '用魂力帮他们搬石头', path: 'guardian', result: { text: '你一口气搬了一百块大石头，城墙的口子当天就补好了。族长说："以后御之一族的大门永远为你敞开。"', exp: 3800, defense: 2 } },
      { text: '帮他们设计一个更牢固的城墙结构', path: 'wise', result: { text: '你想了个"交错叠石"的办法，新城墙比原来结实了一倍。族人们把你的办法刻在了城墙上。', exp: 4000, fate: 2 } }
    ]
  },
  {
    id: 'late_break_01', name: '破之一族的试炼石', location: '破之一族领地·试炼石', phase: 'any', minLevel: 74, weight: 2,
    image: 'assets/locations/破之一族领地.jpg',
    text: ['破之一族的领地中央有一块巨大的试炼石。传说谁能在上面留下一道印记，就能得到破之一族的认可。'],
    choices: [
      { text: '用最强的魂技全力一击', path: 'brave', result: { text: '"轰"的一声，试炼石上多了一道深深的印记。破之一族的族人们齐声喝彩，族长送了你一句破之秘诀。', exp: 4200, attack: 3 } },
      { text: '找到石头的纹理，轻轻一击', path: 'wise', result: { text: '你观察了很久，顺着纹理轻轻一击，石头上出现了一道整整齐齐的裂痕。族长惊讶地说："这才是真正的破。"', exp: 4300, attack: 1, speed: 2 } }
    ]
  },

  // ---------- 钢铁之城 / 圣魂村 / 星斗大森林 ----------
  {
    id: 'late_steel_01', name: '铁匠铺的学徒', location: '钢铁之城·铁匠铺', phase: 'any', minLevel: 43, weight: 2,
    image: 'assets/scenes/blacksmith.jpg',
    text: ['钢铁之城的铁匠铺里，一个小学徒打坏了第十把剑，正被师父训得直掉眼泪。'],
    choices: [
      { text: '帮他说说情，再陪他重新打一把', path: 'guardian', result: { text: '你陪他从烧铁开始，一锤一锤地打。这一次的剑又直又亮，师父看了半天，终于点了头。', exp: 3100, fate: 2 } },
      { text: '请师父给你也打一把护手', path: 'free', result: { text: '师父的手艺果然好，护手轻巧又结实。他笑着说："这把我收你半价，就当给徒弟赔个不是。"', exp: 2900, defense: 2, gold: -40 } }
    ]
  },
  {
    id: 'late_home_01', name: '回到圣魂村', location: '圣魂村·村口', phase: 'any', minLevel: 57, weight: 3,
    image: 'assets/locations/圣魂村.jpg',
    text: ['你回到了圣魂村。村口的老槐树还在，树下的孩子们正在玩"猎魂师抓魂兽"的游戏。'],
    choices: [
      { text: '加入他们，扮演一只魂兽', path: 'free', result: { text: '你扮演一只"百年大灰狼"，被孩子们追得满村跑。玩到天黑，村里的大人都出来看热闹。', exp: 3300, fate: 2 } },
      { text: '去看看村里的老铁匠', path: 'guardian', result: { text: '老铁匠的背更驼了，可一看到你就笑开了花："我就知道你会有出息！"你帮他修好了漏雨的屋顶。', exp: 3500, maxHp: 40 } }
    ]
  },
  {
    id: 'late_forest_01', name: '森林里的老朋友', location: '星斗大森林外围', phase: 'any', minLevel: 63, weight: 2,
    image: 'assets/locations/星斗大森林.jpg',
    text: ['你回到星斗大森林外围，一只长大了的灵鹿从树后走了出来——额头上那道浅浅的疤，正是你小时候帮它包扎过的地方。'],
    choices: [
      { text: '摸摸它的头，陪它走一段', path: 'guardian', result: { text: '灵鹿带着你在森林里走了一圈，最后停在一片开满花的草地上。原来，这里是它的家。', exp: 3600, fate: 3 } },
      { text: '跟着它去森林深处探险', path: 'brave', result: { text: '灵鹿带你绕过了几处危险的地方，来到一眼清泉边。泉水清凉甘甜，你喝了一口，浑身都充满了力气。', exp: 3800, maxHp: 50 } }
    ]
  },
  {
    id: 'late_forest_02', name: '魂兽森林的守护', location: '星斗大森林深处', phase: 'any', minLevel: 78, weight: 2,
    image: 'assets/scenes/forest_deep.jpg',
    text: ['一群猎人在星斗大森林深处设下陷阱，想抓刚出生的小魂兽去卖钱。几只魂兽妈妈急得到处乱撞。'],
    choices: [
      { text: '拆掉所有陷阱，劝猎人离开', path: 'guardian', result: { text: '你拆掉了二十多个陷阱，又耐心地劝猎人们回家。森林深处传来一声长长的兽吼，像是在说谢谢。', exp: 4200, fate: 3 } },
      { text: '和猎人们比一场，输了就离开森林', path: 'brave', result: { text: '猎人们一起上也不是你的对手。他们灰溜溜地离开了，还保证再也不来森林里抓小魂兽。', battle: 'arena_fighter', exp: 4400, attack: 2 } }
    ]
  },

  // ---------- 全大陆（任意地点都可能遇到） ----------
  {
    id: 'late_road_01', name: '旅途中的信', location: '斗罗大陆各地', phase: 'any', minLevel: 50, weight: 2,
    image: 'assets/scenes/mountain_path.jpg',
    text: ['一只信鸽落在你的肩上，脚上绑着一封信——是史莱克的伙伴们寄来的："你最近好吗？我们都很想你。"'],
    choices: [
      { text: '马上写一封长长的回信', path: 'guardian', result: { text: '你把这段时间的见闻全写进了信里，写了整整五页纸。信鸽带着信飞走时，你觉得心里暖洋洋的。', exp: 3300, fate: 2 } },
      { text: '在信背面画一幅自己现在的样子', path: 'free', result: { text: '你画了一个背着行囊、笑得很开心的自己。后来听说，这幅画被马红俊贴在了宿舍墙上。', exp: 3100, maxHp: 30 } }
    ]
  },
  {
    id: 'late_road_02', name: '星空下的修炼', location: '斗罗大陆各地', phase: 'any', minLevel: 70, weight: 2, timeOfDay: 'night',
    image: 'assets/scenes/mountain_path.jpg',
    text: ['夜晚的山顶，星星多得数不清。你盘膝坐下，感觉魂力和星光一样，在身体里静静流淌。'],
    choices: [
      { text: '专心修炼到天亮', path: 'wise', result: { text: '天亮时你睁开眼，发现自己的魂力比昨晚又厚实了一层。原来，静下心来才是最快的修炼。', exp: 4200, spiritPowerGain: 8 } },
      { text: '躺下来看星星，想想自己走过的路', path: 'free', result: { text: '你想起了第一次觉醒武魂的那天，想起了学院的伙伴们。看着看着，你笑出了声。', exp: 3800, fate: 2 } }
    ]
  },
  {
    id: 'late_road_03', name: '迷路的小魂兽', location: '斗罗大陆各地', phase: 'any', minLevel: 88, weight: 2,
    image: 'assets/scenes/forest_outer.jpg',
    text: ['路边的草丛里，一只毛茸茸的小魂兽正在哭。它和妈妈走散了，看到你也不跑，只是可怜巴巴地看着你。'],
    choices: [
      { text: '帮它找妈妈', path: 'guardian', result: { text: '你抱着它找了一整天，终于在一片竹林里找到了它的妈妈。魂兽妈妈用鼻子碰了碰你的手，算是道谢。', exp: 4400, fate: 3 } },
      { text: '给它做个小窝，陪它等妈妈回来', path: 'wise', result: { text: '你判断魂兽妈妈一定会回来找它，就在原地搭了个小窝陪它等。傍晚时分，魂兽妈妈果然找来了。', exp: 4200, defense: 2 } }
    ]
  }
]
