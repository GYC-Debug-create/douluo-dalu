/**
 * 主线名场面（儿童版 · 珍珠串 + 三个大分叉）
 *
 * 玩家身份：史莱克第八怪。每颗"珍珠"开头按《斗罗大陆》原著走，让看过动画的孩子一眼认出；
 * 玩家在每个名场面里都有一个决定结果的动作，选择会留下记号（engine/story-marks.js），
 * 后面的剧情据此"认账"。三个大分叉：p11 小舞的秘密、p14 海神岛、final_evil 最终决战（见 game-data.js）。
 *
 * 写作规范：温和冒险；不写血腥细节；难过的情节保留但留有希望；结局总是好的。
 * 顺序与等级以 engine/event-rules.js 的 MAIN_STORY_MILESTONES 为准。
 */

// 主线事件只由主线入口触发（event-rules 里标记 mainStoryOnly），永远不会进入随机池。
const story = (event) => ({ phase: 'any', unique: true, weight: 5, ...event })

export const MAIN_STORY_EVENTS = [
  // ---------------- 诺丁篇 ----------------
  story({
    id: 'p02_nuoding', name: '诺丁学院·初遇小舞', location: '诺丁城·诺丁学院', minLevel: 2,
    image: 'assets/npcs/小舞.jpg',
    introduces: ['唐三', '小舞', '王圣'],
    completeMarks: ['arrived_nuoding'],
    text: [
      '诺丁初级魂师学院的工读生宿舍里，七八个孩子挤在一间大屋子里。{name}刚把行李放下，门口就吵了起来。',
      '宿舍的"老大"王圣叉着腰，拦住一个扎着蝎子辫的女孩："新来的，先叫一声老大！"女孩眨眨眼，一个漂亮的翻身——王圣"扑通"一声坐在了地上。她拍拍手："从今天起，我是老大。我叫小舞！"',
      '角落里一直安静看书的黑发男孩站了起来："我叫唐三。小舞，我们比一场。"屋子里一下子安静了。你正好站在他们俩中间。'
    ],
    variants: [
      { marks: ['saw_tangsan_awaken'], text: '你一下子认出来了——他就是觉醒那天，手里冒出一株蓝银草的男孩！他也认出了你，朝你眨了眨眼。' }
    ],
    choices: [
      {
        id: 'challenge', text: '"我也来！三个人一起比！"', path: 'ambitious', marks: ['nd_challenger'],
        result: { text: '三个人在宿舍中间比了起来。小舞像只灵巧的兔子，把你和唐三都翻倒了好几次，可你每次都爬起来接着上。最后她笑着伸手把你拉起来："你挺厉害的嘛！以后你就是二老大！"唐三也笑了。', exp: 90, attack: 1, fate: 1 }
      },
      {
        id: 'referee', text: '"我来当裁判！不许真的伤到人。"', path: 'prudent', marks: ['nd_referee'],
        result: { text: '你清了清嗓子，定下规矩：点到为止，出了圈就算输。唐三的身法和小舞的柔技打得难分难解，你认真地宣布——平局！两个人都服气地点了点头。从那天起，宿舍里有什么争执，大家都来找你评理。', exp: 90, defense: 1, fate: 1 }
      },
      {
        id: 'peacemaker', text: '先把王圣扶起来，劝大家别为了"老大"吵架', path: 'merciful', marks: ['nd_peacemaker'],
        result: { text: '你把王圣扶起来，帮他拍掉身上的灰："当老大不是为了让别人听话，是为了照顾大家呀。"王圣挠挠头，有点不好意思。小舞歪着脑袋看了你半天："你这个人，心肠真好。"那天晚上，四个人坐在一起分吃了一包糖。', exp: 90, maxHp: 10, fate: 2 }
      }
    ]
  }),
  story({
    id: 'p03_master', name: '大师的考验', location: '诺丁城·诺丁学院', minLevel: 5,
    image: 'assets/npcs/玉小刚.jpg',
    introduces: ['玉小刚'],
    text: [
      '诺丁学院来了一位不爱笑的老师，大家都叫他"大师"。听说他自己的武魂很普通，可关于武魂的学问，整个大陆没几个人比得上他。',
      '大师收了唐三做弟子。今天，他也把你叫进了书房，盯着你的{spirit}看了很久很久。',
      '"每个武魂都有自己的脾气，"大师推了推眼镜，"我只问一句：你想先学什么？"'
    ],
    variants: [
      { marks: ['nd_challenger'], text: '唐三在一旁小声补充："老师，{name}就是那个敢同时挑战我和小舞的人。"大师嘴角动了一下，像是笑了。' },
      { marks: ['nd_referee'], text: '唐三在一旁小声补充："老师，宿舍里的事都是{name}来评理。"大师点点头："公正，是很难得的品质。"' },
      { marks: ['nd_peacemaker'], text: '唐三在一旁小声补充："老师，王圣现在最服的就是{name}。"大师若有所思："能让人心服的，往往不是拳头。"' }
    ],
    choices: [
      {
        id: 'ring_advice', text: '"请您告诉我，我的武魂适合什么样的魂兽？"', path: 'scholar', marks: ['master_ring_advice'],
        result: { text: '大师翻开一本写满批注的旧笔记，一条一条讲给你听：什么魂兽和你的武魂合拍，什么年限最稳妥，猎环时最该小心什么。你把每一句都记了下来。"等你到了十级，"大师说，"我亲自带你去挑第一个魂环。"', exp: 260, spiritPowerGain: 2, fate: 1 }
      },
      {
        id: 'train_with_tangsan', text: '"我想和唐三一起接受您的特训！"', path: 'loyal', marks: ['trained_with_tangsan'],
        result: { text: '从那天起，每天天不亮，后山上就多了两个跑步的身影。唐三教你控制呼吸，你帮唐三找爬山最近的路。一个月后，大师看着你们俩并肩跑回来，难得地说了一句："不错。"', exp: 260, speed: 1, attack: 1, fate: 1 }
      },
      {
        id: 'ask_heart', text: '"您的武魂很普通，为什么还能懂这么多？"', path: 'wise', marks: ['asked_master_heart'],
        result: { text: '大师愣了一下，然后笑了——这是你第一次看见他笑。"因为武魂只决定你从哪里出发，"他说，"走多远，要看你肯不肯一直往前走。"这句话，你记了很久很久。', exp: 260, fate: 2, defense: 1 }
      }
    ]
  }),

  // ---------------- 史莱克篇 ----------------
  story({
    id: 'p04_shrek_exam', name: '史莱克入学考核', location: '史莱克学院·大门', minLevel: 11,
    image: 'assets/npcs/赵无极.jpg',
    introduces: ['弗兰德', '赵无极', '戴沐白', '奥斯卡'],
    completeMarks: ['joined_shrek'],
    text: [
      '大师推荐唐三和小舞去一所特别的学院——史莱克学院，听说那里"只收怪物，不收普通人"。你也拿着大师写的推荐信，跟着他们一起来了。',
      '学院门口，戴眼镜的院长弗兰德笑眯眯地说："前几关都过了？很好。最后一关：在赵无极老师手下，坚持一炷香！"一个熊一样高大的老师走了出来，身后浮现出一只巨大的熊影。',
      '旁边看热闹的学长里，有一个金发少年抱着胳膊，眼睛是很少见的重瞳——他叫戴沐白。另一个笑嘻嘻的少年在发香肠："吃了它，打架不累！"他叫奥斯卡。香已经点上了。'
    ],
    variants: [
      { marks: ['trained_with_tangsan'], text: '你和唐三对视一眼——在后山跑了那么多个早上，就是为了今天。' }
    ],
    choices: [
      {
        id: 'team', text: '和唐三、小舞背靠背站在一起，一起扛住', path: 'loyal', marks: ['exam_team'],
        result: { text: '赵无极的攻击像大山一样压过来，你们三个背靠背站在一起：唐三的蓝银草缠住熊腿，小舞的柔技卸掉力气，你的{spirit}补上每一个空当。香燃尽的那一刻，你们三个还站着。赵无极哈哈大笑："好！好一群小怪物！"', battle: 'zhao_wuji', exp: 640, defense: 1, fate: 2 }
      },
      {
        id: 'bait', text: '"我来引开他！你们找机会！"', path: 'ambitious', marks: ['exam_bait'],
        result: { text: '你冲在最前面，把赵无极的注意力全部吸引过来，被震得连退好几步也不肯躲。唐三和小舞趁机从两边出手，那一炷香竟然一点一点地熬过去了。戴沐白在场边吹了声口哨："这个新生，有胆量。"', battle: 'zhao_wuji', exp: 640, attack: 1, fate: 2 }
      },
      {
        id: 'insight', text: '先观察：他每次出手前，是不是都要先抬脚？', path: 'tactician', marks: ['exam_insight'],
        result: { text: '你发现赵无极每次重击之前，都会先重重地踩一下地面。你大喊一声："跳！"三个人同时跳起，震地的一击全部落空。弗兰德院长推了推眼镜，眼睛闪闪发亮："能在实战里看出破绽……这个孩子，我收了。"', battle: 'zhao_wuji', exp: 640, speed: 1, fate: 2 }
      }
    ]
  }),
  story({
    id: 'p05_eight_monsters', name: '史莱克八怪', location: '史莱克学院·操场', minLevel: 15,
    image: 'assets/npcs/马红俊.jpg',
    introduces: ['马红俊', '宁荣荣', '朱竹清'],
    completeMarks: ['eight_monsters'],
    text: [
      '学院里又来了几位新同学：胖乎乎、一着急就冒火的马红俊；带着七宝琉璃塔、有点小骄傲的宁荣荣；话很少、动作却快得像影子的朱竹清。',
      '第一次小队训练，大家吵成了一锅粥：戴沐白想当队长，荣荣不想听别人指挥，胖子只想先去吃饭。大师站在场边，冷冷地说："八个人，各打各的，就是八盘散沙。"',
      '小舞忽然把你推到了大家中间——'
    ],
    variants: [
      { marks: ['nd_challenger'], text: '"二老大，你说句话！"小舞冲你挤挤眼睛。' },
      { marks: ['nd_referee'], text: '"让{name}来定规矩！在诺丁的时候，宿舍里的事都是{name}评理！"小舞大声说。' },
      { marks: ['nd_peacemaker'], text: '"{name}最会劝架了，你们听听！"小舞拍着你的肩膀说。' }
    ],
    choices: [
      {
        id: 'vanguard', text: '"我站最前面！谁冲在前面，谁就先挨打——我来！"', path: 'ambitious', marks: ['role_vanguard'],
        result: { text: '大家都愣住了。戴沐白第一个笑出声："好，前锋算你一个，我跟你一起冲。"吵闹一下子停了：有人冲在前面，后面的人就知道自己该做什么了。', exp: 900, attack: 2, fate: 1 }
      },
      {
        id: 'guardian', text: '"我负责保护大家，谁受伤了我第一个到！"', path: 'loyal', marks: ['role_guardian'],
        result: { text: '荣荣看了你一眼，小声说："那……我就放心给大家加辅助了。"奥斯卡也举起手："我负责做恢复香肠！"一个愿意保护所有人的人，让每个人都安心了。', exp: 900, defense: 2, maxHp: 20, fate: 1 }
      },
      {
        id: 'strategist', text: '"我们先在地上画一画：谁擅长什么，谁站哪里。"', path: 'tactician', marks: ['role_strategist'],
        result: { text: '你捡起一根树枝，在沙地上画出一个阵型。唐三蹲下来帮你补充，朱竹清难得开口："我可以从侧面绕过去。"大师在场边点了点头，什么也没说——可那是他最满意的表情。', exp: 900, speed: 1, spiritPowerGain: 2, fate: 1 }
      }
    ],
    // 不论怎么选，最后都会组成八个人的小队。
    closing: '傍晚，八个人的手叠在了一起。胖子大喊："史莱克七怪多了一个——那就是八怪！"从这天起，你就是史莱克第八怪。'
  }),
  story({
    id: 'p06_titan', name: '森林之王', location: '星斗大森林外围', minLevel: 22,
    image: 'assets/npcs/泰坦.jpg',
    introduces: ['泰坦巨猿', '天青牛蟒'],
    text: [
      '大师带着史莱克八怪进入星斗大森林历练。走到树林最密的地方，地面忽然一下一下地震动起来。',
      '一只比房子还高的泰坦巨猿推开两棵大树走了出来，后面还跟着一条青色的巨蟒——天青牛蟒。大家的魂力全提了起来，胖子的手都在冒火。',
      '可是，巨猿谁也没看，只盯着小舞。然后……它慢慢地低下了头。小舞拉了拉你的袖子，声音很小："别伤害它们，好不好？"'
    ],
    variants: [
      { marks: ['role_vanguard'], text: '你像往常一样站在最前面，可这一次，你没有先出手。' },
      { marks: ['role_guardian'], text: '你下意识地张开手臂，把荣荣和奥斯卡护在身后。' },
      { marks: ['role_strategist'], text: '你飞快地看了一圈地形——可你心里隐隐觉得，今天不需要打仗。' }
    ],
    choices: [
      {
        id: 'respect', text: '挡在伙伴们前面，但绝不先出手', path: 'loyal', marks: ['titan_respect'],
        result: { text: '你稳稳地站在那里，既不后退，也不攻击。泰坦巨猿看了你很久，鼻子里喷出一股热气，转身带着天青牛蟒消失在了森林深处。小舞松了一口气，冲你笑了笑："谢谢你。"', exp: 1400, defense: 2, fate: 2 }
      },
      {
        id: 'notice', text: '悄悄观察：它们为什么只听小舞的？', path: 'scholar', marks: ['noticed_xiaowu_secret'],
        result: { text: '你注意到，巨猿看小舞的眼神，就像大狗看着自己的小主人——不，更像是守护。小舞发现你在看她，赶紧转过头去。你把这个疑问悄悄放在了心里，谁也没有告诉。', exp: 1400, spiritPowerGain: 3, fate: 1 }
      },
      {
        id: 'bow', text: '收起武魂，向巨猿认认真真地行一个礼', path: 'merciful', marks: ['titan_bow'],
        result: { text: '你收起武魂，向森林之王深深地鞠了一躬。泰坦巨猿愣了一下，然后伸出巨大的手指，轻轻在你头顶碰了一下，留下一颗红彤彤的果子。小舞眼睛亮亮的："它说，它记住你了。"', exp: 1400, maxHp: 30, fate: 3 }
      }
    ]
  }),
  story({
    id: 'p07_dugubo', name: '冰火两仪眼', location: '落日森林·深处', minLevel: 28,
    image: 'assets/npcs/独孤博.jpg',
    introduces: ['独孤博'],
    completeMarks: ['herb_feast'],
    text: [
      '唐三打听到，落日森林深处有一眼神奇的泉水：一半冒着热气，一半结着寒冰，叫"冰火两仪眼"。泉边长满了仙草，吃一株就能让魂师脱胎换骨。',
      '可守着那里的，是脾气古怪的毒斗罗独孤博。他身上的毒伤了自己很多年，脸色青青的，谁靠近就瞪谁："小家伙们，滚远点！"',
      '唐三悄悄对你说："我看得出来，他的毒伤很重。也许……我们能帮他。"'
    ],
    choices: [
      {
        id: 'heal', text: '陪唐三一起，帮独孤博治好毒伤', path: 'merciful', marks: ['dugubo_friend'],
        result: { text: '你们在泉边守了三天三夜：唐三配药，你帮忙生火、采药、看着冰火两仪眼的温度。第三天早上，独孤博的脸色第一次变得红润。这个凶巴巴的老人别过头去，声音有点哑："……欠你们一个人情。仙草，随便挑。"', exp: 1850, maxHp: 40, spiritPowerGain: 4, fate: 3 }
      },
      {
        id: 'scout', text: '先自己去探路，找到最适合伙伴们的仙草', path: 'ambitious', marks: ['scouted_herbs'],
        result: { text: '你绕过独孤博，一个人摸到泉水的另一边。冰的那一侧冷得刺骨，火的那一侧烫得冒烟，可你还是把每一株仙草都看清楚了，记下哪一株适合哪个伙伴。等独孤博被唐三治好，大家采仙草时，没有一株选错。', exp: 1850, attack: 2, spiritPowerGain: 3, fate: 2 }
      },
      {
        id: 'deal', text: '"我们帮您做事，您分我们仙草，公平交换。"', path: 'pragmatic', marks: ['fair_deal'],
        result: { text: '独孤博挑起眉毛："哼，倒是会做买卖。"他让你们帮他把山谷里的毒雾清干净。活儿很累，可干完以后，他扔过来一个装满仙草的篮子："说话算话，不错。"', exp: 1850, defense: 2, spiritPowerGain: 3, fate: 2 }
      }
    ],
    closing: '那天晚上，八个人围着冰火两仪眼吃了仙草，每个人的魂力都像涨潮一样往上涌。胖子摸着肚子说："这是我这辈子吃过最贵的一顿饭。"'
  }),

  // ---------------- 大赛篇 ----------------
  story({
    id: 'p08_huangdou', name: '对决皇斗战队', location: '天斗城·皇家学院斗魂场', minLevel: 34,
    image: 'assets/scenes/arena.jpg',
    introduces: ['玉天恒', '独孤雁', '叶泠泠', '雪清河'],
    text: [
      '史莱克收到天斗皇家学院的邀请，和他们最强的皇斗战队打一场友谊赛。看台上坐满了人，最中间是温和有礼的太子雪清河。',
      '皇斗战队的队长玉天恒一亮武魂，一条闪着紫色雷电的巨龙盘在他身后——蓝电霸王龙！雷声在斗魂场里轰隆隆地响，看台上的人都惊呼起来。他身边还有用毒的独孤雁、会治疗的叶泠泠。',
      '戴沐白回头看你："准备好了吗？"'
    ],
    variants: [
      { marks: ['dugubo_friend'], text: '独孤雁看了你一眼，有些惊讶："爷爷说，是你们治好了他的毒伤？"' },
      { marks: ['role_vanguard'], text: '你照例站到了队伍最前面，雷光把你的影子拉得很长。' },
      { marks: ['role_guardian'], text: '你站在奥斯卡和荣荣身前——不管雷龙有多凶，你都不会让开。' },
      { marks: ['role_strategist'], text: '你在心里飞快地排兵布阵：先拦住治疗，再分开雷龙和毒。' }
    ],
    choices: [
      {
        id: 'face_dragon', text: '正面迎上玉天恒的雷龙！', path: 'ambitious', marks: ['beat_tianheng'],
        result: { text: '雷光劈头盖脸地打下来，你咬着牙一步也不退，硬是把雷龙拦在了半场。等唐三的蓝银草缠住它的那一刻，你用尽全力打出了最后一击！玉天恒摔倒在地，却大笑着爬起来，向你伸出了手："痛快！交个朋友！"', battle: 'huangdou_team', exp: 2300, attack: 2, fate: 2 }
      },
      {
        id: 'combo', text: '配合唐三的蓝银草，把雷龙困在场地中央', path: 'loyal', marks: ['combo_tangsan'],
        result: { text: '唐三的蓝银草一层层缠上去，你绕着场地跑了一大圈，把雷龙引进了蓝银草最密的地方。雷电劈断了一根又一根草叶，可草叶越长越多——雷龙终于动不了了。看台上，太子雪清河轻轻鼓起了掌。', battle: 'huangdou_team', exp: 2300, speed: 2, fate: 2 }
      },
      {
        id: 'protect', text: '先护住奥斯卡，让队伍能一直撑下去', path: 'merciful', marks: ['protected_oscar'],
        result: { text: '独孤雁的毒雾第一个冲着奥斯卡去了——你挡在了他前面。只要奥斯卡还在，恢复香肠就源源不断。比赛打到最后，皇斗战队一个一个累倒了，史莱克八个人却都还站着。玉天恒擦着汗说："你们这支队伍……太难缠了。"', battle: 'huangdou_team', exp: 2300, defense: 2, maxHp: 30, fate: 2 }
      }
    ]
  }),
  story({
    id: 'p09_prelim', name: '精英大赛·预选赛', location: '天斗城·大赛会场', minLevel: 41,
    image: 'assets/npcs/宁风致.jpg',
    introduces: ['宁风致', '剑斗罗尘心', '骨斗罗古榕'],
    completeMarks: ['tournament_begun'],
    text: [
      '全大陆高级魂师学院精英大赛开始了！史莱克战队一路过关斩将，名字传遍了天斗城。',
      '这一天，荣荣的爸爸——七宝琉璃宗宗主宁风致——专程来看比赛。他身后跟着两位老人：一位像出鞘的剑，叫剑斗罗尘心；一位瘦得像一副骨架，叫骨斗罗古榕。',
      '可就在这场比赛开始前，你发现对手学院的人偷偷在擂台的地砖下面埋了东西——一碰就会冒出让人头晕的烟。'
    ],
    variants: [
      { marks: ['beat_tianheng'], text: '看台上，玉天恒冲你挥了挥拳头："加油！别输给别人！"' },
      { marks: ['combo_tangsan'], text: '唐三也注意到了，他看着你，等你拿主意。' }
    ],
    choices: [
      {
        id: 'expose', text: '马上告诉裁判，要求公平比赛', path: 'saint', marks: ['fair_play'],
        result: { text: '裁判掀开地砖，所有人都看见了那个小机关。对手学院被罚了一场，比赛重新开始。宁风致看着你，慢慢地点了点头："赢要赢得光明正大。荣荣，你交了好朋友。"', exp: 2850, defense: 2, fate: 3 }
      },
      {
        id: 'win_anyway', text: '不声张，悄悄绕开机关，用实力赢下来', path: 'ambitious', marks: ['won_quietly'],
        result: { text: '你把机关的位置悄悄告诉了每个伙伴。比赛中，大家都绕开了那几块地砖，对手反而一脚踩了上去，晕得原地转圈。你们赢了。剑斗罗尘心在看台上笑了一声："这小家伙，心里有数。"', exp: 2850, attack: 2, fate: 2 }
      },
      {
        id: 'comfort', text: '比赛后，去找哭鼻子的对手说说话', path: 'merciful', marks: ['comforted_rival'],
        result: { text: '你们赢了以后，你看见对手学院里一个最小的队员蹲在角落里哭。你走过去坐在他旁边。他说，埋机关是队长逼他做的。你拍拍他的肩："下次，做你自己觉得对的事。"后来，他成了史莱克的球迷。', exp: 2850, maxHp: 40, fate: 3 }
      }
    ],
    closing: '预选赛结束，史莱克战队拿到了决赛的门票。决赛，在武魂殿的大本营——武魂城。'
  }),
  story({
    id: 'p10_final', name: '精英大赛·决赛', location: '武魂城·大赛主会场', minLevel: 47,
    image: 'assets/npcs/胡列娜.jpg',
    introduces: ['胡列娜', '邪月', '比比东', '唐昊'],
    completeMarks: ['champions'],
    text: [
      '决赛的对手，是武魂殿培养的"黄金一代"：狐狸一样聪明的胡列娜、哥哥邪月，还有浑身燃着火焰的焱。他们配合得像一个人一样。',
      '高高的看台上，坐着武魂殿的教皇——比比东。她一句话也没说，可整个会场都安静得能听见风声。',
      '比赛开始了。胡列娜和邪月对视一眼，两个人的武魂开始发光——是武魂融合技！'
    ],
    variants: [
      { marks: ['role_vanguard'], text: '"八怪，跟我冲！"你第一个喊了出来。' },
      { marks: ['role_guardian'], text: '你张开手臂，挡在了所有伙伴的前面。' },
      { marks: ['role_strategist'], text: '你注意到，融合技需要他们两个人同时发力。' }
    ],
    choices: [
      {
        id: 'head_on', text: '和唐三一起，正面接下融合技！', path: 'ambitious', marks: ['final_head_on'],
        result: { text: '月光一样的魂力压了过来，你和唐三肩并肩顶在最前面。身后，荣荣的七宝琉璃塔亮到了最亮，奥斯卡的香肠一根接一根地飞过来——你们硬生生地扛住了！就在融合技散开的一瞬间，所有人一起反击。史莱克，赢了！', battle: 'golden_trio', exp: 3100, attack: 3, fate: 2 }
      },
      {
        id: 'split', text: '"先把他们两个分开！融合技就放不出来了！"', path: 'tactician', marks: ['final_split'],
        result: { text: '你和朱竹清一左一右冲进去，硬是把胡列娜和邪月隔开了。融合技的光一下子散了。胡列娜吃惊地看着你："你怎么知道……"比赛结束的哨声响起——史莱克，赢了！', battle: 'golden_trio', exp: 3100, speed: 3, fate: 2 }
      }
    ],
    closing: '可就在颁奖的时候，唐三使出了他藏了很久的第二武魂——一柄黑色的大锤。看台上的比比东脸色一下子变了。一股可怕的魂力压了下来——就在这时，一个扛着大锤的高大男人从天而降，挡在了唐三面前。"想动我儿子？"他是唐三的爸爸，唐昊。他带着唐三离开了，临走前回头看了你一眼："照顾好大家。"'
  }),

  // ---------------- 大分叉 A：小舞的秘密 ----------------
  story({
    id: 'p11_xiaowu', name: '小舞的秘密', location: '星斗大森林深处', minLevel: 53,
    image: 'assets/npcs/小舞.jpg',
    completeMarks: ['xiaowu_secret_known'],
    text: [
      '唐昊把唐三送回大家身边没多久，武魂殿的长老就带着人追进了星斗大森林。他们在找一只"十万年魂兽"。',
      '森林深处，小舞停下脚步，转过身来。她的眼睛红红的，却笑着："我一直没告诉你们……我本来是一只修炼了十万年的柔骨兔。我变成人，只是想看看人类的世界，交几个朋友。"',
      '武魂殿的人围上来了。小舞看看唐三，又看看你，轻声说："如果我不在了，你们要好好的。"'
    ],
    variants: [
      { marks: ['noticed_xiaowu_secret'], text: '你想起那天泰坦巨猿向她低头的样子——原来是这样。你一点都不觉得奇怪，只觉得心疼。' },
      { marks: ['nd_peacemaker'], text: '你想起诺丁宿舍的第一个晚上，四个人坐在一起分吃一包糖。那时候，她就已经把你们当成朋友了。' },
      { marks: ['titan_bow'], text: '远处传来熟悉的咆哮——泰坦巨猿来了！它停在你身边，像是在等你的决定。' },
      { marks: ['titan_respect'], text: '远处传来熟悉的咆哮——泰坦巨猿来了！它看了你一眼，像是记得你那天没有出手。' },
      { marks: ['dugubo_friend'], text: '树梢上传来一个沙哑的声音："小家伙们，老夫来还人情了！"是独孤博！' }
    ],
    choices: [
      {
        id: 'stand_guard', text: '挡在小舞前面："谁都别想带走她！"', path: 'loyal', marks: ['xiaowu_saved'],
        result: {
          text: '你挡在最前面，八怪的伙伴们一个接一个站到你身边。武魂殿的长老很强，可你们谁也没有后退。最后，长老们看着这群拼尽全力的孩子，终于退走了。小舞扑过来抱住你们，哭得像个小孩子："谢谢你们……谢谢你们……"',
          battle: 'spirit_hall_elder', difficulty: 'hard', exp: 3300, defense: 3, fate: 3,
          defeatOutcome: {
            marks: ['xiaowu_asleep'],
            text: '长老们实在太强了。你被打倒在地，看着他们一步步逼近。小舞轻轻摸了摸你的头："已经够了，你们已经很勇敢了。"她转向唐三，身体变成一团温柔的粉色光芒，慢慢融进了唐三的怀里——那里多了一只睡着的小兔子。武魂殿的人找不到十万年魂兽，只好离开了。唐三紧紧抱着小兔子，眼泪掉下来，声音却很坚定："她只是睡着了。总有一天，我会让她醒过来。"你点点头："我陪你。"'
          }
        },
        replyVariants: [
          { marks: ['dugubo_friend'], text: '独孤博的毒雾在最关键的时候挡住了长老们的一击。' },
          { marks: ['titan_bow'], text: '泰坦巨猿一声怒吼，把长老们的退路都堵住了。' }
        ]
      },
      {
        id: 'run_with_titan', text: '拉起小舞和唐三，跟着泰坦巨猿跑！', path: 'tactician', marks: ['xiaowu_saved', 'xiaowu_hidden'],
        // 只有在森林里善待过泰坦巨猿，它才会来帮忙。
        showIf: { anyMarks: ['titan_bow', 'titan_respect'] },
        result: { text: '泰坦巨猿弯下腰，你们爬上它宽宽的背。它一步跨过小溪、两步翻过山坡，武魂殿的人怎么也追不上。跑到森林最深的地方，天青牛蟒早就在那里等着了。"这里很安全，"小舞靠在巨猿的毛上，终于笑了，"它们说，谢谢你们愿意保护我。"', exp: 3300, speed: 3, fate: 3 }
      },
      {
        id: 'trust_her', text: '握住小舞的手："不管你决定怎么做，我们都在。"', path: 'saint', marks: ['xiaowu_asleep', 'trusted_xiaowu'],
        result: { text: '小舞看着你，眼泪掉了下来，却笑得很好看。"谢谢你相信我。"她转向唐三，身体变成一团温柔的粉色光芒，慢慢融进了唐三的怀里——那里多了一只睡着的小兔子。武魂殿的人找不到十万年魂兽，只好离开了。唐三抱着小兔子，轻声说："她只是睡着了。总有一天，我会让她醒过来。"你点点头："我陪你。"', exp: 3300, spiritPowerGain: 5, fate: 3 }
      }
    ]
  }),

  // ---------------- 远行篇 ----------------
  story({
    id: 'p12_haotian', name: '昊天宗', location: '昊天宗·山门', minLevel: 60,
    image: 'assets/npcs/唐昊.jpg',
    introduces: ['唐啸'],
    text: [
      '唐昊要带唐三回到他们的家族——昊天宗。唐三想了想，回头问你："你愿意陪我一起去吗？"',
      '昊天宗建在云雾缭绕的高山上。宗主唐啸是唐昊的哥哥，一个看起来很严肃的人。他打量着你："外人想进昊天宗，要先过一关。"'
    ],
    variants: [
      { marks: ['xiaowu_saved'], text: '小舞挽着唐三的胳膊，好奇地东张西望："这里好高呀！"唐三的嘴角一直是弯着的。', at: 'before' },
      { marks: ['xiaowu_asleep'], text: '唐三的胸前挂着一个小小的香囊，里面睡着那只粉色的小兔子。他走路的时候，总是下意识地用手护着它。', at: 'before' }
    ],
    choices: [
      {
        id: 'hammer_trial', text: '"我接受考验！"——去举昊天宗的试炼锤', path: 'ambitious', marks: ['haotian_trial'],
        result: { text: '试炼锤重得像一座小山。你憋红了脸，一点一点把它举过了头顶。整个山门都安静了，然后响起了掌声。唐啸第一次露出了笑容："好！从今天起，昊天宗的大门永远为你打开。"', exp: 3450, attack: 3, maxHp: 30, fate: 2 }
      },
      {
        id: 'hear_ayin', text: '先听唐昊讲讲，唐三的妈妈是什么样的人', path: 'scholar', marks: ['heard_ayin'],
        result: { text: '唐昊沉默了很久，才慢慢开口：唐三的妈妈叫阿银，她也曾是一株修炼了十万年的蓝银草。"十万年的魂兽，有时候也会为了喜欢的人变成人，"唐昊看着远处的云，"所以，别放弃希望。"唐三紧紧握住了拳头。', exp: 3450, spiritPowerGain: 6, fate: 3 },
        replyVariants: [
          { marks: ['xiaowu_asleep'], text: '你看了一眼唐三胸前的香囊——你知道，他一定会让小舞醒过来的。' }
        ]
      },
      {
        id: 'unite', text: '帮唐三说服大家：昊天宗该出山，和大家一起对抗武魂殿', path: 'loyal', marks: ['haotian_ally'],
        result: { text: '你和唐三一起，在宗门大殿里一遍又一遍地讲：武魂殿在抓魂兽、欺负弱小的魂师，如果大家都躲起来，就没有人能保护这片大陆了。最后，唐啸站起来，敲响了封山多年的大钟："昊天宗——出山！"', exp: 3450, defense: 3, fate: 3 }
      }
    ]
  }),
  story({
    id: 'p13_trial_city', name: '试炼之城', location: '试炼之城', minLevel: 68,
    image: 'assets/scenes/volcano.jpg',
    text: [
      '唐三要去一座特别的城——试炼之城。传说那里会把一个人心里的害怕和生气全都放大，只有心最稳的人才能走出来。唐昊说："只有走出那里，他才能真正控制住自己的力量。"',
      '你决定陪他一起去。城里的天空永远是红色的，街道像迷宫一样弯弯绕绕。走着走着，你听见一个声音在耳边说：你不够强，你保护不了任何人。'
    ],
    variants: [
      { marks: ['xiaowu_asleep'], text: '唐三的手一直按在胸前的香囊上，那是他在这座城里唯一的温暖。' },
      { marks: ['xiaowu_saved'], text: '出发前，小舞把一根粉色的发绳系在你和唐三的手腕上："一定要回来哦。"' },
      { marks: ['asked_master_heart'], text: '你想起大师说过的话：武魂只决定你从哪里出发。' }
    ],
    choices: [
      {
        id: 'together', text: '拉住唐三的手："我们一起走出去。"', path: 'loyal', marks: ['trial_together'],
        result: { text: '你们俩手拉着手，一条街一条街地走。每次唐三快要被那个声音拉走，你就用力捏一下他的手；每次你害怕了，他也捏一下你的。不知道走了多少天，前面终于出现了一道光——你们走出来了。', exp: 3500, defense: 3, fate: 3 }
      },
      {
        id: 'face_fear', text: '停下来，对着那个声音说出自己的害怕', path: 'saint', marks: ['faced_fear'],
        result: { text: '"对，我会害怕，"你大声说，"我害怕保护不了大家。可是害怕的时候，我还是会往前走！"那个声音一下子变小了，红色的天空裂开了一条缝，透出蓝蓝的天。唐三看着你，眼睛亮亮的："原来要这样面对它。"', exp: 3500, spiritPowerGain: 6, fate: 4 }
      },
      {
        id: 'help_lost', text: '先帮城里迷路的孩子们找到出口', path: 'merciful', marks: ['helped_lost'],
        result: { text: '你在一个街角发现了几个和你一样被困住的孩子。你顾不上自己的害怕，带着他们一个一个找出口。等你把最后一个孩子送出城门，你才发现——那个可怕的声音，早就不见了。', exp: 3500, maxHp: 50, fate: 4 }
      }
    ],
    closing: '走出试炼之城的时候，唐三像是长大了好几岁。他学会了控制心里的怒气，也学会了一种新的力量——修罗的力量。'
  }),

  // ---------------- 大分叉 B：海神岛 ----------------
  story({
    id: 'p14_sea_god', name: '海神岛', location: '海神岛·圣殿', minLevel: 76,
    image: 'assets/npcs/海神.jpg',
    completeMarks: ['sea_god_done'],
    text: [
      '你们乘船来到了大海中央的海神岛。湛蓝的光从圣殿顶上洒下来，海浪轻轻地拍着沙滩。唐三将在这里接受海神的九道考验，一道比一道难。',
      '一个温和又威严的声音在天地间响起："唐三的朋友，你一路陪他走到这里。九考期间，你可以选择自己的路。"'
    ],
    variants: [
      { marks: ['xiaowu_asleep'], text: '那个声音停了一下，又说："柔骨兔的灵魂在等待。九考完成的那一天，就是她醒来的希望。"唐三胸前的香囊，轻轻地动了一下。' },
      { marks: ['xiaowu_saved'], text: '小舞站在沙滩上，用力地朝你们挥手："你们都要加油呀！"' },
      { marks: ['haotian_ally'], text: '昊天宗的船队就停在不远的海面上——他们说好了，要在这里等你们一起回去。' }
    ],
    choices: [
      {
        id: 'with_tangsan', text: '陪唐三闯九考，替他挡下最难的那一关', path: 'ambitious', pathWeight: 3, marks: ['b_companion'],
        result: { text: '第七考是一场看不见尽头的海上风暴。你站到唐三前面，用{spirit}替他挡住了最大的那一道浪。"这一关，我们一起过。"你们俩浑身湿透，却笑得停不下来。九考结束的那天，海神的声音说："勇敢的同伴，你的名字也会留在这座岛上。"', exp: 3460, attack: 4, fate: 3 }
      },
      {
        id: 'guard_friends', text: '留在岛上，守护大家，等唐三回来', path: 'loyal', pathWeight: 3, marks: ['b_guardian'],
        result: { text: '武魂殿的船在海上转来转去，想趁唐三闯关的时候偷袭。你和伙伴们守在海边，一天、十天、一百天，没有让任何一条船靠岸。唐三从圣殿走出来的那天，看见的第一个人就是你。"谢谢你，"他说，"有你在，我才敢一直往前走。"', exp: 3460, defense: 4, maxHp: 60, fate: 3 }
      },
      {
        id: 'own_path', text: '去岛的另一边，寻找属于自己的传承', path: 'rebel', pathWeight: 3, marks: ['b_own_path'],
        result: { text: '你沿着没有人走过的海岸，一直走到了岛的另一头。那里有一块刻满古老花纹的礁石，你把手放上去，看见了一条只属于你的路——不是谁的跟班，也不是谁的影子，就是你自己。回来的时候，唐三笑着说："你看起来不一样了。"', exp: 3460, speed: 4, spiritPowerGain: 6, fate: 3 }
      },
      {
        id: 'ask_sea_god', text: '向海神请教：怎样才能让大家都不受伤？', path: 'scholar', pathWeight: 3, marks: ['b_wisdom'],
        result: { text: '海神沉默了很久，然后给你讲了很多很多事：这片大陆的过去，魂兽和人类为什么会打起来，武魂殿又为什么变成了现在这样。"真正的强大，"海神说，"是让战斗变得不必要。"你在心里记下了每一个字。', exp: 3460, spiritPowerGain: 8, fate: 4 }
      }
    ],
    closing: '九考结束了。唐三的身后浮现出一把金色的三叉戟——他得到了海神的传承。现在，只剩下最后一件事了。'
  }),
  story({
    id: 'p15_eve', name: '决战前夜', location: '史莱克学院·屋顶', minLevel: 86,
    image: 'assets/scenes/dormitory.jpg',
    text: [
      '决战的前一晚，你和史莱克的伙伴们爬上了学院的屋顶。星星很亮，就像你们第一次组成八怪的那个傍晚。',
      '奥斯卡给每人分了一根香肠，胖子又在吹牛，荣荣和竹清在小声说话。安静了一会儿，唐三问你："明天之后，你想做一个什么样的人？"'
    ],
    variants: [
      { marks: ['xiaowu_saved'], text: '小舞靠在唐三肩膀上，数着天上的星星。' },
      { marks: ['xiaowu_asleep'], text: '唐三把香囊放在膝盖上，像是让小舞也一起看星星。' },
      { marks: ['beat_tianheng'], text: '一只信鸽落在屋檐上，是玉天恒寄来的："明天，皇斗战队也去。"' },
      { marks: ['comforted_rival'], text: '楼下还站着一个小小的身影——是大赛时那个哭鼻子的对手，他说明天要来帮忙。' }
    ],
    choices: [
      { id: 'eve_guard', text: '"做一个永远挡在大家前面的人。"', path: 'loyal', marks: ['eve_guard'], result: { text: '"那我们就一起挡在前面。"戴沐白伸出拳头，大家一个个把拳头叠了上去。你觉得，明天不管发生什么，都不会害怕了。', exp: 3700, defense: 3, maxHp: 80, fate: 3 } },
      { id: 'eve_brave', text: '"做一个敢去最难的地方的人。"', path: 'ambitious', marks: ['eve_brave'], result: { text: '胖子大笑："算我一个！"屋顶上的笑声传得很远很远。那一夜你睡得很香，梦里全是明天的胜利。', exp: 3700, attack: 3, fate: 2 } },
      { id: 'eve_wise', text: '"做一个能想出好办法、让大家少受伤的人。"', path: 'scholar', marks: ['eve_wise'], result: { text: '唐三认真地点点头："明天的计划，我们俩再检查一遍。"你们一直讨论到天快亮，把每一个细节都想到了。', exp: 3700, speed: 3, spiritPowerGain: 8, fate: 2 } },
      { id: 'eve_free', text: '"做一个自由自在、想去哪里就去哪里的人。"', path: 'rebel', marks: ['eve_free'], result: { text: '荣荣眨眨眼："那等打完这一仗，我们一起去看海！"你们约好了——等和平到来，就去大陆的每一个角落看看。', exp: 3700, speed: 2, attack: 2, fate: 2 } }
    ]
  })
]

/**
 * 结局尾声：按一路上的记号追加段落。at: 'before' 放在结局正文之前，其余放在之后。
 * 顺序就是显示顺序。
 */
export const ENDING_EPILOGUES = [
  { marks: ['c_awakened'], at: 'before', text: '战斗停下来的时候，比比东握着权杖站了很久，眼泪一颗一颗地掉下来——像一个终于想起自己是谁的人。她亲手打开了武魂殿的大门，被关着的魂兽和魂师全都自由了。' },
  { marks: ['c_defeated'], notMarks: ['c_awakened'], at: 'before', text: '比比东的权杖落在了地上。武魂殿的大门打开了，被关着的魂兽和魂师全都自由了。阳光照进教皇殿，那里再也没有人害怕了。' },
  { marks: ['xiaowu_asleep'], at: 'before', text: '海神的金光洒满战场的那一刻，唐三胸前的香囊里飞出一道粉色的光——小舞睁开了眼睛，揉了揉，第一句话是："我睡了多久呀？"所有人都笑着哭了。唐三一把抱住她，再也没有松开。' },
  { marks: ['xiaowu_saved'], notMarks: ['xiaowu_hidden'], text: '小舞挽着唐三的手，在庆功宴上蹦蹦跳跳。她偷偷对你说："要不是你那天挡在我前面，就没有今天啦。"' },
  { marks: ['xiaowu_hidden'], text: '小舞挽着唐三的手，在庆功宴上蹦蹦跳跳。她偷偷对你说："要不是你那天在森林里对它们那么好，巨猿才不会背着我们逃跑呢。"' },
  { marks: ['titan_bow'], text: '星斗大森林里，泰坦巨猿听说了胜利的消息，高兴得把一棵大树拍得哗啦啦响。' },
  { marks: ['dugubo_friend'], text: '独孤博在庆功宴上喝着果汁，嘴上说"吵死了"，却一直没走。' },
  { marks: ['beat_tianheng'], text: '玉天恒后来常常来史莱克找你切磋，雷龙每次都输，他每次都笑。' },
  { marks: ['haotian_ally'], text: '昊天宗再也没有封山。山门口立了一块碑，上面刻着所有在那一战里并肩的人的名字——你的名字也在上面。' },
  { marks: ['nd_peacemaker'], text: '王圣从诺丁写来一封信，说他现在是诺丁学院最会照顾新生的老大了。' }
]
