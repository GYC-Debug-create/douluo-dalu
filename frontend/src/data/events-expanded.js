/**
 * 斗罗大陆·万象图鉴 —— 剧情事件扩充包（纯逻辑层）
 * 从 game-events-expanded.js 迁移为 ES 模块，数据 100% 不变。
 * 依赖 game-data.js 中的 EVENTS 数组，通过 push 追加事件。
 */

import { EVENTS } from './game-data.js';
import { LOCATION_EVENTS } from './location-events.js';

/**
 * 斗罗大陆·万象图鉴 —— 剧情事件扩充包
 * 1. 为 game-data.js 中原有 64 个事件补齐 image 字段
 * 2. 新增 600+ 多样化事件（学院/冒险/封号/成神四阶段）
 * 所有事件均配图，覆盖日常/修炼/战斗/奇遇/社交/秘境/奇缘等多种场景
 */

// ==================== 一、给现有事件补 image ====================
(function patchExistingImages(){
  const imgMap = {
    first_class:        'assets/scenes/academy_classroom.jpg',
    cafeteria_funny:    'assets/scenes/cafeteria.jpg',
    playground_spar:    'assets/scenes/training_ground.jpg',
    library_night:      'assets/scenes/library_night.jpg',
    senior_rumor:       'assets/scenes/dormitory.jpg',
    exam_week:          'assets/scenes/academy_classroom.jpg',
    mystery_merchant:   'assets/scenes/border_town.jpg',
    training_hill:      'assets/scenes/mountain_path.jpg',
    help_granny:        'assets/scenes/border_town.jpg',
    rainy_day:          'assets/scenes/library_night.jpg',
    swim_contest:       'assets/scenes/sea_god_island.jpg',
    cooking_disaster:   'assets/scenes/cafeteria.jpg',
    star_gazing:        'assets/scenes/dormitory.jpg',
    spirit_show:        'assets/scenes/arena.jpg',
    lost_kitten:        'assets/beasts/soft_bone_rabbit.jpg',
    old_tree:           'assets/scenes/forest_outer.jpg',
    fake_master:        'assets/scenes/tavern.jpg',
    night_patrol:       'assets/scenes/academy_classroom.jpg',
    festival:           'assets/scenes/wuhun_city.jpg',
    rival_challenge:    'assets/scenes/arena.jpg',
    soul_master_prelim: 'assets/scenes/arena.jpg',
    soul_master_final:  'assets/scenes/arena.jpg',
    spirit_hall_exam:   'assets/scenes/temple.jpg',
    mysterious_elder:   'assets/scenes/mountain_path.jpg',
    meet_partner:       'assets/scenes/forest_outer.jpg',
    ancient_ruins:      'assets/scenes/temple.jpg',
    bottleneck:         'assets/scenes/mountain_path.jpg',
    treasure_map:       'assets/scenes/border_town.jpg',
    arena_streak:       'assets/scenes/arena.jpg',
    herb_valley:        'assets/scenes/mountain_path.jpg',
    blacksmith:         'assets/scenes/blacksmith.jpg',
    caravan:            'assets/scenes/border_town.jpg',
    hot_spring:         'assets/scenes/volcano.jpg',
    title_douluo_trial: 'assets/scenes/temple.jpg',
    spirit_hall_secret: 'assets/scenes/temple.jpg',
    partner_farewell:   'assets/scenes/border_town.jpg',
    evil_spirit_master: 'assets/scenes/swamp.jpg',
    sea_trial:          'assets/scenes/sea_god_island.jpg',
    bandit_king:        'assets/scenes/border_town.jpg',
    auction:            'assets/scenes/auction_house.jpg',
    master_teaching:    'assets/scenes/academy_classroom.jpg',
    god_trial_sea:      'assets/scenes/temple.jpg',
    angel_vs_sea:       'assets/scenes/abyss_godrealm.jpg',
    final_evil:         'assets/scenes/abyss_godrealm.jpg',
    hermit_life:        'assets/scenes/mountain_path.jpg',
    mortal_world:       'assets/scenes/wuhun_city.jpg',
    thunder_tribulation:'assets/scenes/abyss_godrealm.jpg',
    world_peace:        'assets/scenes/wuhun_city.jpg',
    ring_hunt_10:       'assets/scenes/forest_outer.jpg',
    ring_hunt_20:       'assets/scenes/forest_deep.jpg',
    ring_hunt_30:       'assets/scenes/forest_deep.jpg',
    ring_hunt_40:       'assets/scenes/forest_deep.jpg',
    ring_hunt_50:       'assets/scenes/forest_deep.jpg',
    ring_hunt_60:       'assets/scenes/temple.jpg',
    ring_hunt_70:       'assets/scenes/forest_deep.jpg',
    ring_hunt_80:       'assets/scenes/sea_god_island.jpg',
    ring_hunt_90:       'assets/scenes/abyss_godrealm.jpg'
  };
  EVENTS.forEach(ev => {
    if(!ev.image && imgMap[ev.id]) ev.image = imgMap[ev.id];
  });
})();

// ==================== 二、学院篇扩充（日常/修炼/课堂/社交/奇遇） ====================
EVENTS.push(
// ---- 课堂学习类 ----
{
  id: 'ac_class_01', name: '大师的提问', location: '史莱克学院·教室',
  phase: 'academy', weight: 3,
  image: 'assets/scenes/academy_classroom.jpg',
  text: [
    '课堂上，大师忽然点了你的名字："{name}，你来说说，兽武魂与器武魂最核心的区别是什么？"',
    '教室里瞬间安静下来，几十双眼睛齐刷刷看向你。'
  ],
  choices: [
    { text: '胸有成竹，流利作答', result: { text: '你从武魂本质讲到附体形态，条理清晰，举例生动。大师罕见地露出了笑容："不错，坐下吧。"', exp: 35, fate: 1 } },
    { text: '支支吾吾，答不上来', result: { text: '你涨红了脸说不出话。大师没有批评你，只是温和地说："今晚把《武魂总论》第三章抄三遍，明天交给我。"', exp: 10 } },
    { text: '灵机一动，举个奇怪的例子', result: { text: '你说："就像胖虎学长和他的铁锅——一个自己能打，一个要拿在手里打！"全班哄堂大笑。大师也忍不住笑了："虽然粗俗，但理是这个理。"', exp: 25, fate: 1 } }
  ]
},
{
  id: 'ac_class_02', name: '武魂理论小测', location: '史莱克学院·教室',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/academy_classroom.jpg',
  text: [
    '大师发下一张小测卷子，只有三道题，但每道都是开放性问题。',
    '你扫了一眼第三题："如果你的同伴被魂兽重伤，你会先救他还是先猎杀魂兽取魂环？"'
  ],
  choices: [
    { text: '当然先救人！', result: { text: '你认真写下："魂环可以再找，同伴只有一个。"发卷时大师在这句话下面画了三道红线，批了一个大大的"好"字。', fate: 2, exp: 30 } },
    { text: '视情况而定', result: { text: '你分析了各种情况写下答案。大师批语："理性，但魂师首先是人。"', exp: 20 } },
    { text: '先取魂环再救人，机会难得', result: { text: '你写下了这个答案。发卷时大师把你单独留下，长谈了一个时辰关于"强者之心"的道理。走出教室时，你心情很沉重，但好像懂了什么。', exp: 40, fate: -1 } }
  ]
},
{
  id: 'ac_class_03', name: '学长的笔记', location: '史莱克学院·教室',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/academy_classroom.jpg',
  text: [
    '你在座位里发现一本泛黄的笔记，扉页上写着"唐三"。里面密密麻麻记满了修炼心得和各种魂兽弱点分析。',
    '这是唐三学长遗失的！你翻了几页，发现里面有一段正是你最近卡住的修炼难点。'
  ],
  choices: [
    { text: '原封不动还给学长', result: { text: '你在下课后追上唐三把笔记还给他。他有些意外，接过笔记时冲你笑了笑："谢谢你，小师弟。以后有问题可以来问我。"', fate: 2, exp: 20 } },
    { text: '偷偷抄一份再还', result: { text: '你连夜把关键内容抄了下来，第二天再把笔记还回去。唐三似乎察觉了什么，但只是笑了笑没说破。你学到了很多。', exp: 40 } },
    { text: '据为己有', result: { text: '你把笔记藏了起来。可是从那以后每次看到唐三学长，你都心里发虚，修炼也静不下心来。', fate: -2, exp: 10 } }
  ]
},
// ---- 食堂与饮食类 ----
{
  id: 'ac_food_01', name: '神秘的加餐', location: '史莱克学院·食堂',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/cafeteria.jpg',
  text: [
    '今天的食堂居然有一道你从没见过的菜——银色的小鱼，炖在乳白色的汤里，香气扑鼻。',
    '食堂大妈神秘兮兮地说："这可是好东西，外面有钱都买不到，限量供应！"'
  ],
  choices: [
    { text: '来一份尝尝！', result: { text: '鱼汤鲜美得让你差点把舌头吞下去。喝完之后浑身暖洋洋的，魂力运转竟然快了一丝！', spiritPowerGain: 3, hp: 20, exp: 20 } },
    { text: '太贵了，吃普通菜吧', result: { text: '你摇了摇头打了份普通饭菜。旁边一个老学员告诉你：那是用十年魂鱼做的，一份抵得上三天苦修。你听了有点后悔，但转念一想，日子还长。', exp: 10 } },
    { text: '买两份，给朋友带一份', result: { text: '你多买了一份给胖虎学长。他感动得眼泪都快下来了，拍着你的肩膀说："好兄弟！以后谁敢欺负你我第一个上！"', hp: 20, fate: 2, exp: 20 } }
  ]
},
{
  id: 'ac_food_02', name: '食堂的赌约', location: '史莱克学院·食堂',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/cafeteria.jpg',
  text: [
    '胖虎学长端着满满一大盘包子跟你打赌："你要是能一口吞下三个大肉包，这盘全归你！输了就帮我洗一周碗！"',
    '周围的同学开始起哄。'
  ],
  choices: [
    { text: '接受挑战！', cond: { attack: 10 }, result: { text: '你运起魂力撑开口腔，居然真的一口塞下了三个包子！虽然腮帮子疼了半天，但赢得了满盘包子和满场喝彩。', hp: 30, exp: 20, fate: 1 } },
    { text: '拒绝，这不科学', result: { text: '你翻了个白眼："学长你自己吃吧，小心噎着。"胖虎哈哈大笑，自己把包子吃了。', exp: 10 } },
    { text: '换个比法——比谁吃得快', result: { text: '你提议比速度。结果你凭借敏捷的身手吃得比胖虎还快，虽然没有赌注，但围观的同学们笑成了一团。', speed: 1, exp: 15 } }
  ]
},
{
  id: 'ac_food_03', name: '厨神争霸', location: '学院·小厨房',
  phase: 'academy', weight: 1,
  image: 'assets/scenes/cafeteria.jpg',
  text: [
    '学院举办了首届"厨神大赛"，奖品是大师亲自颁发的"免罚金牌"——可以抵消一次犯错的惩罚！',
    '你也报了名，站在小厨房里看着锅碗瓢盆，有点犯难。'
  ],
  choices: [
    { text: '做一道家乡菜', result: { text: '你做了一道最拿手的家乡菜。虽然卖相一般，但味道真挚动人。评委尝了之后说："有妈妈的味道。"你拿了第二名，奖品是一大块熏肉。', hp: 40, exp: 25, fate: 1 } },
    { text: '用灵药做一道创意菜', cond: { gold: 20 }, cost: { gold: 20 }, result: { text: '你买了灵药熬进汤里，做了一道"魂力汤"。虽然味道怪怪的，但喝完后大家都觉得神清气爽。你成功拿下"最佳创意奖"！', spiritPowerGain: 4, exp: 30 } },
    { text: '黑暗料理出奇制胜', result: { text: '你把所有能找到的食材扔进锅里乱炖，出锅时那颜色让评委都不敢下嘴。最后你毫无悬念地名列倒数第一，但你的"黑暗料理"成了学院的传说。', fate: 1, exp: 15 } }
  ]
},
// ---- 宿舍生活类 ----
{
  id: 'ac_dorm_01', name: '深夜卧谈会', location: '史莱克学院·宿舍',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/dormitory.jpg',
  text: [
    '熄灯后，宿舍里黑漆漆的。不知是谁先开了口："你们说，咱们以后能成为封号斗罗吗？"',
    '这句话像一颗石子投进水里，大家七嘴八舌地聊开了。'
  ],
  choices: [
    { text: '我一定会成为封号斗罗！', result: { text: '你攥紧被子说出自己的梦想。黑暗中有人笑你，也有人沉默。但你自己知道，这个念头已经刻进了心里。', spiritPowerGain: 2, fate: 1, exp: 15 } },
    { text: '不知道，走一步看一步吧', result: { text: '你诚实地说出了想法。宿舍里安静了一会儿，有人说："其实我也是这么想的。"大家都笑了。', exp: 10 } },
    { text: '比起封号斗罗，我更想吃遍天下美食', result: { text: '胖虎学长立刻附和："知音啊！"你们俩热烈讨论起各地美食，被隔壁宿舍敲墙抗议。', hp: 10, fate: 1, exp: 10 } }
  ]
},
{
  id: 'ac_dorm_02', name: '奇怪的响声', location: '史莱克学院·宿舍',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/dormitory.jpg',
  text: [
    '半夜，你被一阵奇怪的"窸窸窣窣"声吵醒。声音似乎来自床底。',
    '月光透过窗户照进来，你看到床底下似乎有什么东西在动。'
  ],
  choices: [
    { text: '壮着胆子下床查看', result: { text: '你掀开床帘一看——是一只迷路的小魂兽灵兔，正抱着你的袜子啃得开心。你把它送到了森林边，回来后发现袜子已经没法要了。', exp: 20, fate: 1 } },
    { text: '叫醒大家一起看', result: { text: '你把全宿舍都叫醒了，大家手持枕头拖把如临大敌。结果发现只是一只老鼠。全宿舍笑成一团，再也睡不着了。', exp: 15, damage:5 } },
    { text: '蒙头装睡', result: { text: '你用被子蒙住头，假装什么都没听见。第二天起床发现你的干粮袋被咬破了一个洞，少了半块饼。', exp: 5 } }
  ]
},
{
  id: 'ac_dorm_03', name: '室友生病了', location: '史莱克学院·宿舍',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/dormitory.jpg',
  text: [
    '半夜，你被下铺的呻吟声惊醒——室友脸色通红，发着高烧，嘴里说着胡话。',
    '外面下着大雨，校医室离宿舍有一段距离。'
  ],
  choices: [
    { text: '冒雨背他去校医室', result: { text: '你二话不说背起室友冲进雨里。等校医给他喂完药，你自己也淋成了落汤鸡。第二天你感冒了，但室友握着你的手说不出话。', damage:15, fate: 3, exp: 25 } },
    { text: '先物理降温，天亮再说', result: { text: '你用湿毛巾给他冷敷，守了他一整夜。天亮时他退了烧，你趴在床边睡着了。', damage:5, fate: 2, exp: 20 } },
    { text: '叫别的同学帮忙', result: { text: '你叫醒几个室友一起想办法，大家七手八脚地忙活了一夜。室友的烧退了，你们之间的情谊也更深了。', fate: 1, exp: 15 } }
  ]
},
// ---- 操场修炼类 ----
{
  id: 'ac_train_01', name: '负重跑', location: '史莱克学院·操场',
  phase: 'academy', weight: 3,
  image: 'assets/scenes/training_ground.jpg',
  text: [
    '"今天的训练——背着二十斤的沙袋绕操场跑五十圈！"大师的声音像鞭子一样抽下来。',
    '跑到第三十圈时，你的双腿像灌了铅一样沉重，肺部火辣辣地疼。'
  ],
  choices: [
    { text: '咬牙坚持，跑完五十圈！', result: { text: '你拖着沉重的步子跑完了最后二十圈，冲过终点时直接瘫倒在地。大师蹲下来拍了拍你的肩："很好。"', defense: 2, damage:10, exp: 35, fate: 1 } },
    { text: '跑不动了，走也要走完', result: { text: '你跑跑走走硬是完成了五十圈，虽然比别人慢了半个时辰，但大师没有说什么，只是点了点头。', defense: 1, exp: 25 } },
    { text: '偷偷扔掉几块石头', result: { text: '你趁人不注意从沙袋里掏出几块石头扔掉，轻松完成了训练。可是晚上躺在床上，你总觉得心里不踏实。', exp: 10, fate: -1 } }
  ]
},
{
  id: 'ac_train_02', name: '木桩阵', location: '史莱克学院·操场',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/training_ground.jpg',
  text: [
    '操场上新设了一个木桩阵——一百零八根木桩按奇门遁甲排列，要在一炷香内穿过去而不碰到任何木桩。',
    '唐三学长演示时如行云流水，看得你目瞪口呆。轮到你了。'
  ],
  choices: [
    { text: '全力冲刺！', cond: { speed: 11 }, result: { text: '你运起魂力飞速穿过木桩阵，衣袂飘飘，虽然碰倒了三根木桩，但速度让唐三都点了点头。', speed: 2, exp: 30 } },
    { text: '稳扎稳打，慢慢来', result: { text: '你沉下心一步一步穿过木桩阵，居然一根都没碰倒！虽然用时稍长，但精准度让大家刮目相看。', defense: 1, exp: 25 } },
    { text: '闭着眼凭感觉走', result: { text: '你突发奇想闭上眼睛，走了三步就被木桩绊倒，摔了个狗啃泥。同学们笑得直不起腰。但唐三却说："敢用这种方法练感知，胆子不小。"', damage:5, exp: 15, fate: 1 } }
  ]
},
{
  id: 'ac_train_03', name: '冥想时刻', location: '史莱克学院·操场',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/training_ground.jpg',
  text: [
    '训练结束后，你坐在操场边的老槐树下打坐冥想。夕阳把你的影子拉得很长。',
    '入定之后，你感觉{spirit}在体内轻轻震动，似乎在回应着什么。'
  ],
  choices: [
    { text: '顺着感觉深入冥想', result: { text: '你跟随{spirit}的震动进入了深层冥想状态。等你醒来时，天色已黑，但魂力竟然增长了一大截！', spiritPowerGain: 5, exp: 30 } },
    { text: '收功，该吃饭了', result: { text: '你闻着食堂飘来的香味，果断结束冥想冲向食堂。红烧肉，我来了！', hp: 15, exp: 10 } }
  ]
},
{
  id: 'ac_train_04', name: '学长的对练邀请', location: '史莱克学院·操场',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/training_ground.jpg',
  text: [
    '一个高年级的学长走过来，拍了拍你的肩膀："喂，新来的，陪我练练手？放心，我只用三成力。"',
    '他看起来比你强壮不少，眼神里带着几分戏谑。'
  ],
  choices: [
    { text: '来就来，谁怕谁！', result: { text: '你亮出{spirit}冲了上去。虽然被打得鼻青脸肿，但你也摸到了他衣角一下。学长哈哈大笑："有骨气！明天继续！"', attack: 1, damage:15, exp: 30 } },
    { text: '先答应，但提条件：你要教我一招', result: { text: '学长爽快答应。对练结束后他教了你一招实用的小技巧，你受益匪浅。', exp: 35, attack: 1 } },
    { text: '婉拒：我今天太累了', result: { text: '学长耸耸肩走开了。你松了口气，但看着他和别人对练的身影，又有点后悔。', exp: 5 } }
  ]
},
// ---- 图书馆类 ----
{
  id: 'ac_lib_01', name: '禁书区的诱惑', location: '史莱克学院·图书馆',
  phase: 'academy', weight: 1,
  image: 'assets/scenes/library_night.jpg',
  text: [
    '你在图书馆最深处发现了一个落满灰尘的书架，木牌上写着"禁书·未经允许不得翻阅"。',
    '其中一本黑色封皮的书散发着诡异的气息，书名叫《邪魂师速成要诀》。'
  ],
  choices: [
    { text: '好奇心起，翻开看看', result: { text: '你翻开书，里面的内容让你毛骨悚然——都是些吞噬他人魂力的邪术。你赶紧合上书放回原处，心脏怦怦直跳。', exp: 20, fate: -1 } },
    { text: '报告大师', result: { text: '你立刻告诉了大师。大师检查后说这些书是用来警示学员的，他夸你定力好。', fate: 2, exp: 25 } },
    { text: '把书偷偷带出去研究', result: { text: '你把书藏在衣服里带出了图书馆。当晚你越看越心惊，那些邪术虽然威力惊人，但代价极大。第二天你偷偷把书放了回去。', exp: 15, fate: -2 } }
  ]
},
{
  id: 'ac_lib_02', name: '旧书里的地图', location: '史莱克学院·图书馆',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/library_night.jpg',
  text: [
    '你在一本百年前的旅行笔记里发现了一张夹页——画着一张简易地图，标注着"星斗森林·秘宝"的字样，旁边还写着"吾将毕生所藏，留待有缘人"。',
    '地图看起来很旧，但字迹清晰。'
  ],
  choices: [
    { text: '按图索骥去寻宝！', result: { text: '周末你按地图走进森林，在一棵老槐树下挖出一个铁盒——里面是几瓶初级聚魂液！虽然不是什么惊天宝藏，但对你来说已经是意外之喜了。', spiritPowerGain: 4, exp: 35, fate: 1 } },
    { text: '交给大师鉴定', result: { text: '大师看了地图说这是几十年前一位毕业学长的恶作剧。"不过……"他笑着说，"他当年确实埋了东西，你去挖挖看吧。"你挖到了一块刻着"史莱克"的铜牌，作为纪念。', fate: 1, exp: 20 } },
    { text: '把地图夹回去，留给下一个有缘人', result: { text: '你微笑着把地图重新夹回书里。或许有一天，另一个学员也会发现它，经历同样的惊喜。', fate: 2, exp: 15 } }
  ]
},
{
  id: 'ac_lib_03', name: '打瞌睡的学长', location: '史莱克学院·图书馆',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/library_night.jpg',
  text: [
    '你在图书馆看书时，对面的学长打起了瞌睡，脑袋一点一点的，口水都快流到书上了。',
    '他手边放着一本《高级魂技解析》，正是你想看但一直借不到的书。'
  ],
  choices: [
    { text: '轻轻叫醒他，提醒他回宿舍睡', result: { text: '学长醒来后有些不好意思，得知你想看这本书，大方地说他已经看完了，可以借你一周。', exp: 20, fate: 1 } },
    { text: '悄悄把书拿走看两天再还', result: { text: '你趁他睡着把书拿走看了两天，收获颇丰。还书时学长似乎没发现。但你心里总有点不自在。', exp: 30 } },
    { text: '帮他披件衣服，自己看别的书', result: { text: '你把自己的外套轻轻披在他身上，换了本别的书看。学长醒来后非常感动，主动把书借给了你。', fate: 2, exp: 25 } }
  ]
},
// ---- 森林历练类 ----
{
  id: 'ac_forest_01', name: '迷途的小鹿', location: '星斗大森林外围',
  phase: 'academy', weight: 2,
  image: 'assets/beasts/spirit_deer.jpg',
  text: [
    '森林里，你看到一只十年魂兽灵鹿被捕兽夹夹住了腿，哀鸣声声，眼睛湿漉漉地看着你。',
    '它的腿在流血，但眼中没有敌意，只有恐惧和哀求。'
  ],
  choices: [
    { text: '放了它，帮它包扎伤口', result: { text: '你打开捕兽夹，用随身携带的伤药给它包扎。灵鹿舔了舔你的手，一瘸一拐地走了几步，又回头看了你一眼才消失在林中。', fate: 2, exp: 25 } },
    { text: '它是十年魂兽，放弃猎杀', result: { text: '你犹豫了一下，最终收起了武器。灵鹿似乎明白了你的选择，转身消失在林中。正式魂环需要通过魂环猎取节点获得。', exp: 40, fate: 1 } },
    { text: '收起捕兽夹放它走', result: { text: '你不仅放了它，还把附近的捕兽夹都拆除了——这些偷猎者的工具会伤害很多无辜的小动物。', fate: 3, exp: 20 } }
  ]
},
{
  id: 'ac_forest_02', name: '野果的诱惑', location: '星斗大森林外围',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/forest_outer.jpg',
  text: [
    '你发现一棵树上结满了红彤彤的野果，看起来诱人极了。但你不确定这果子有没有毒。',
    '树下有几只小鸟在啄食果子，看起来安然无恙。'
  ],
  choices: [
    { text: '先吃一颗试试', result: { text: '你摘了一颗小心翼翼地尝了一口——酸甜多汁，好吃极了！这居然是一株罕见的朱果，吃完你感觉神清气爽。', hp: 30, spiritPowerGain: 2, exp: 20 } },
    { text: '摘回去给大师看看', result: { text: '你摘了几颗带回学院。大师确认这是朱果后分给大家一起吃，还夸你谨慎。', hp: 15, exp: 25, fate: 1 } },
    { text: '不认识的果子不乱吃', result: { text: '你咽了咽口水，克制住了诱惑。大师说过，在森林里乱吃东西是新人最容易犯的致命错误。', exp: 10 } }
  ]
},
{
  id: 'ac_forest_03', name: '蝴蝶引路', location: '星斗大森林外围',
  phase: 'academy', weight: 2,
  image: 'assets/beasts/wind_butterfly.jpg',
  text: [
    '一只色彩斑斓的大蝴蝶在你面前飞来飞去，翅膀上闪烁着淡淡的魂力波动。它绕着你飞了三圈，然后向森林深处飞去。',
    '你记得书上说过，有些灵性的魂兽会给有缘人引路。'
  ],
  choices: [
    { text: '跟着它去看看！', result: { text: '你跟着蝴蝶穿过密林，来到一汪清泉边——泉水中竟然漂浮着几片魂莲！你小心采了几片，这可是炼药的好材料。', spiritPowerGain: 3, exp: 30, fate: 1 } },
    { text: '不去，万一有陷阱', result: { text: '你摇了摇头，继续按原计划修炼。蝴蝶在你面前飞了一会儿，见你没反应就飞走了。', exp: 10 } },
    { text: '悄悄跟着但保持警惕', result: { text: '你小心翼翼地跟着蝴蝶，果然在清泉边发现了一只正在睡觉的百年毒蜘蛛。你绕开它采了魂莲，安全撤退。', exp: 35, speed: 1 } }
  ]
},
{
  id: 'ac_forest_04', name: '受伤的兔子', location: '星斗大森林外围',
  phase: 'academy', weight: 2,
  image: 'assets/beasts/soft_bone_rabbit.jpg',
  text: [
    '草丛里，一只柔骨兔幼崽瑟瑟发抖，它的一只耳朵受了伤，旁边是一只狐狸的脚印。',
    '它还太小，不是什么厉害的魂兽，但那双红红的大眼睛让你想起了家里以前养的小兔子。'
  ],
  choices: [
    { text: '把它带回宿舍养伤', result: { text: '你偷偷把小兔子带回宿舍养伤。它很快就康复了，但和你产生了感情，怎么也不肯走。从此你的宿舍多了一个小伙伴。', fate: 2, exp: 20 } },
    { text: '给它包扎好放归森林', result: { text: '你用草药给它包扎好伤口，把它放回了草丛。小兔子跑了几步又回头看你，然后蹦蹦跳跳地走了。', fate: 1, exp: 15 } },
    { text: '它迟早要成为魂兽的猎物，不如给我练手', result: { text: '你狠了狠心，但举起手时对上它那双无辜的眼睛，怎么也下不了手。最终你还是把它放了。', exp: 10, fate: 1 } }
  ]
},
{
  id: 'ac_forest_05', name: '老猎人的警告', location: '星斗大森林外围',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/forest_outer.jpg',
  text: [
    '森林边，一个老猎人拦住了你："小魂师，别往西边去，那边最近有只百年毒蜘蛛出没，已经伤了好几个人了。"',
    '他指着西边的方向，脸色凝重。'
  ],
  choices: [
    { text: '听老人言，换个方向历练', result: { text: '你谢过老猎人，改道去了东边。晚上回学院听说西边果然有个学员被毒蜘蛛伤了，你暗自庆幸。', exp: 15, fate: 1 } },
    { text: '偏要去看看，小心点就是', result: { text: '你小心翼翼地往西边走，果然看到了毒蜘蛛的踪迹。你远远观察了它的习性后安全撤离，学到了很多实战知识。', exp: 35, damage:10 } },
    { text: '回去报告老师，请人来处理', result: { text: '你跑回学院报告了大师。大师立刻派高年级学员去处理，避免了更多人受伤。老猎人竖大拇指夸你懂事。', fate: 2, exp: 20 } }
  ]
},
// ---- 学院日常/随机类 ----
{
  id: 'ac_daily_01', name: '清晨的钟声', location: '史莱克学院·钟楼',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/academy_classroom.jpg',
  text: [
    '天还没亮，学院的钟声就响了——今天是月度考核的日子！',
    '你一个鲤鱼打挺从床上坐起来，发现自己昨天居然忘记复习了！'
  ],
  choices: [
    { text: '临阵磨枪，不快也光！', result: { text: '你在去考场的路上抱着书猛看。居然真的被你看到了好几道考题！', exp: 25 } },
    { text: '不慌，平时学得扎实', result: { text: '你从容地洗漱吃饭进考场。题目虽然难，但你平时用功，答得很顺畅。', exp: 30, fate: 1 } },
    { text: '完了完了，听天由命吧', result: { text: '你硬着头皮进了考场。成绩出来时刚刚及格，好险！', exp: 10 } }
  ]
},
{
  id: 'ac_daily_02', name: '扫地老僧', location: '史莱克学院·后院',
  phase: 'academy', weight: 1,
  image: 'assets/scenes/temple.jpg',
  text: [
    '你在后山练完功下山，看到一个扫地的老和尚。他扫得很慢，但每一下都有种奇异的韵律感。',
    '你忽然意识到，他扫地的动作里似乎蕴含着某种精妙的步法。'
  ],
  choices: [
    { text: '恭敬请教', result: { text: '老和尚抬头看了你一眼，笑了笑："小娃娃倒是有眼光。"他随口指点了你几句步法要点，你茅塞顿开！', speed: 3, exp: 50, fate: 2 } },
    { text: '默默观察，偷学几招', result: { text: '你假装在旁边休息，偷偷观察他的动作。虽然只悟到了皮毛，但也让你的身法灵活了不少。', speed: 1, exp: 25 } },
    { text: '就是个普通老人吧', result: { text: '你没在意，径直走了过去。身后传来老和尚轻轻的叹息声。', exp: 5 } }
  ]
},
{
  id: 'ac_daily_03', name: '信件', location: '史莱克学院·传达室',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/dormitory.jpg',
  text: [
    '传达室的老大爷递给你一封家信。信封上是你熟悉的字迹——是家里寄来的！',
    '你找了个安静的角落拆开信，看着家人的字迹，鼻子有点酸。'
  ],
  choices: [
    { text: '认真写一封回信', result: { text: '你花了整整一个晚上写回信，告诉家人你在学院的一切。写完后你觉得心里暖暖的，修炼也更有动力了。', spiritPowerGain: 2, fate: 1, exp: 15 } },
    { text: '寄点钱回去', cond: { gold: 30 }, cost: { gold: 30 }, result: { text: '你把攒的金币寄了一半回家，附言："爹娘，我在这边很好，别舍不得吃穿。"做完这件事你心里特别踏实。', fate: 2, exp: 10 } },
    { text: '看完信收起来，继续修炼', result: { text: '你把信小心折好放在枕头底下，握紧拳头：等我成为厉害的魂师，就让家人过上好日子！', attack: 1, exp: 15 } }
  ]
},
{
  id: 'ac_daily_04', name: '掉钱了', location: '史莱克学院·走廊',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/academy_classroom.jpg',
  text: [
    '你在走廊上捡到一个钱袋，里面装着整整一百金币！还有一张纸条，写着"买药钱"三个字。',
    '这可不是一笔小数目，够你花好几个月的。'
  ],
  choices: [
    { text: '在原地等失主', result: { text: '你等了一个多时辰，一个学姐急急忙忙跑过来找钱袋——这是她给师父买药的钱。她感激涕零，硬塞给你二十金币。', gold: 20, fate: 3, exp: 25 } },
    { text: '交给老师处理', result: { text: '你把钱袋交给了大师。第二天失主找到了，特意来感谢你。学院表彰了你的诚实。', fate: 2, exp: 20 } },
    { text: '天降横财，收起来！', result: { text: '你把钱袋藏了起来。可是从那以后你总觉得有人在背后指指点点，花钱的时候也心虚得很。', gold: 100, fate: -3, exp: 5 } }
  ]
},
{
  id: 'ac_daily_05', name: '新来的转学生', location: '史莱克学院·教室',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/academy_classroom.jpg',
  text: [
    '班里来了个转学生，穿着朴素，沉默寡言，总是一个人坐在角落。',
    '有同学悄悄告诉你，他是从一个小地方来的，武魂好像很普通。'
  ],
  choices: [
    { text: '主动和他交朋友', result: { text: '你主动坐到他旁边和他聊天。起初他有些拘谨，但慢慢就打开了话匣子。后来你才知道，他的武魂虽然不起眼，但修炼异常刻苦，是个值得深交的朋友。', fate: 2, exp: 20 } },
    { text: '各学各的，互不打扰', result: { text: '你没特别注意他。后来某次对练中他一鸣惊人，你才后悔没早点认识他。', exp: 10 } },
    { text: '和大家一起疏远他', result: { text: '你跟着其他人一起冷落他。但每次看到他一个人吃饭的背影，你心里都有点不是滋味。', fate: -1, exp: 5 } }
  ]
}
);

// ==================== 十六、武魂专属事件 ====================
EVENTS.push(
// ---- 器武魂专属 ----
{ id:'sp_wp_01', name:'武魂共鸣·兵刃', location:'修炼中', phase:'academy', minLevel:3, weight:2, tags:['器武魂','武器','战斗'],
  image:'assets/scenes/training_ground.jpg',
  text:['你的{spirit}在手中微微震颤，发出低沉的嗡鸣。你感觉它似乎在向你传达某种信息——这是武器类武魂独有的兵主共鸣。'],
  choices:[
    { text: '静心聆听武魂的声音', result:{ text:'你闭上眼睛，用心感受武魂的脉动。渐渐地，你理解了它的"语言"——它渴望战斗，渴望在烈火中淬炼！你的武魂与你之间的联系更加紧密了。', attack:3, exp:60 } },
    { text: '挥动武魂，随本能而动', result:{ text:'你随着本能挥动武魂，一套新的招式自然而然地从你手中流淌出来。虽然还不够成熟，但已经有了雏形。', attack:2, speed:1, exp:40 } }
  ]},
{ id:'sp_wp_02', name:'铁匠的慧眼', location:'天斗城·铁匠铺', phase:'adventure', minLevel:12, weight:2, tags:['器武魂','武器','刚猛','实用'],
  image:'assets/scenes/blacksmith.jpg',
  text:['老铁匠看到你的{spirit}后眼睛一亮："好兵器！——哦不，好武魂！小伙子，你是器武魂吧？老夫打了一辈子铁，一眼就能看出兵器的好坏。"'],
  choices:[
    { text:'请老铁匠点评武魂', result:{ text:'老铁匠仔细端详了你的武魂，指出了几个你不曾注意到的细节——武魂的受力点、最佳发力角度、薄弱环节。这些看似简单的指点，却让你对武魂的理解精进了许多。', attack:3, defense:1, exp:80 } },
    { text:'帮老铁匠打铁，换取指点', result:{ text:'你帮老铁匠打了一天的铁，他一边干活一边指点你。晚上他请你喝酒，说"你这个小伙子不错，以后有武器上的问题随时来找我"。', gold:15, attack:2, exp:50 } }
  ]},
{ id:'sp_wp_03', name:'器物亲和测试', location:'天斗城·器物研究所', phase:'adventure', minLevel:18, weight:2, tags:['器武魂','灵巧','实用'],
  image:'assets/scenes/blacksmith.jpg',
  text:['一位研究上古器物的老学者邀请你参与测试——他想验证器武魂魂师对传世器物的亲和度。作为器武魂拥有者，你对各种器具有着天然的掌控力。'],
  choices:[
    { text:'配合实验', result:{ text:'测试结果令人惊喜——你的器武魂与上古器物产生了强烈共鸣！学者给了你丰厚的报酬，还说你的武魂潜力很大。', gold:40, exp:60, fate:1 } },
    { text:'借机学习器物养护之道', result:{ text:'你不仅配合了测试，还向学者请教器物温养的基础知识。以你的器武魂天赋，学起来事半功倍。', item:{ name:'上古器纹图谱', desc:'记载了基础器物温养之法', effect:{ attack:1 } }, exp:80 } }
  ]},
// ---- 兽武魂专属 ----
{ id:'sp_bs_01', name:'兽性觉醒', location:'野外·月圆之夜', phase:'academy', minLevel:4, weight:2, tags:['兽武魂','强攻系','狂暴'],
  image:'assets/scenes/forest_deep.jpg',
  text:['今晚是月圆之夜。你感觉体内的{spirit}变得异常活跃，一股原始的兽性在你血液中奔涌——这是兽武魂魂师在月圆之夜特有的"兽性觉醒"现象。'],
  choices:[
    { text:'顺应本能，在月下奔跑', result:{ text:'你在月光下奔跑、跳跃，任由兽性支配你的身体。当你停下来时，你发现自己对身体的掌控力提升了——兽武魂与你的身体融合得更好了。', attack:2, speed:2, exp:50 } },
    { text:'强行压制兽性', result:{ text:'你用意志力强行压制了兽性，保持冷静。虽然控制了本能，但也错过了与武魂深度共鸣的机会。', exp:15, fate:1 } },
    { text:'借机修炼，引导兽性转化为魂力', result:{ text:'你尝试将兽性引导为修炼的动力，虽然过程艰难，但效果惊人——你的魂力上限有了明显提升！', spiritPowerGain:8, exp:60 } }
  ]},
{ id:'sp_bs_02', name:'兽魂共鸣', location:'星斗大森林外围', phase:'adventure', minLevel:15, weight:2, tags:['兽武魂','强攻系','感知'],
  image:'assets/scenes/forest_deep.jpg',
  text:['你遇到了一只受伤的魂兽，它看到你后没有攻击，反而低下了头——你的兽武魂让它感受到了同类的气息。'],
  choices:[
    { text:'帮它治伤', result:{ text:'你用伤药帮它处理了伤口。魂兽感激地舔了舔你的手，然后带你去了一处隐秘的山洞——里面有一株千年灵芝！', item:{ name:'千年灵芝', desc:'极品灵药，大幅提升修为', effect:{ hp:30, attack:2 } }, fate:3, exp:100 } },
    { text:'驱赶它，保留这份共鸣', result:{ text:'你压制住猎杀的冲动，选择让它安全离开。你的兽武魂记住了这次共鸣，正式魂环需要通过魂环猎取节点获得。', attack:2, fate:1, exp:50 } },
    { text:'放它走，不干涉', result:{ text:'你选择了不干涉，默默离开了。魂兽看了你一眼，消失在森林中。', fate:1, exp:20 } }
  ]},
{ id:'sp_bs_03', name:'兽王试炼', location:'魂兽领地', phase:'master', minLevel:25, weight:2, tags:['兽武魂','神兽','威严','战斗'],
  image:'assets/beasts/titan_giant_ape_king.jpg',
  text:['一只强大的魂兽王者拦住了你的去路，它没有直接攻击，而是对你发出一声低吼——这是兽王对兽武魂魂师的"试炼"，只有证明自己实力的人才能通过。'],
  choices:[
    { text:'接受试炼，正面迎战', result:{ text:'你与兽王展开了一场激烈的战斗！虽然艰难，但你的兽武魂在战斗中不断进化，最终你击败了兽王。它认可了你，让你的武魂获得了兽王的祝福。', attack:5, defense:3, battle:'titan_giant_ape_king', exp:200 } },
    { text:'用兽武魂的威压回应', result:{ text:'你释放出兽武魂的威压，兽王感受到了你的力量，低吼一声退开了。虽然没有战斗，但你的武魂气息变得更加强大了。', spiritPowerGain:10, exp:80 } }
  ]},
// ---- 生活器物专属 ----
{ id:'sp_tl_01', name:'物尽其用', location:'史莱克学院', phase:'academy', minLevel:2, weight:2, tags:['生活器物','实用','生存'],
  image:'assets/scenes/academy_classroom.jpg',
  text:['大师说你的武魂虽然看起来不起眼，但任何武魂都有它的价值。他让你思考——你的{spirit}在实战之外，在生活中能发挥什么作用？'],
  choices:[
    { text:'钻研生活用途', result:{ text:'你发现{spirit}在日常生活中确实有很多妙用——这些看似不起眼的用途，让你对武魂的理解更深了一层。大师说："能悟到这一点，你已经比很多天才更强了。"', defense:1, exp:40, fate:1 } },
    { text:'不甘心，想证明它也能战斗', result:{ text:'你把心思都用在了开发战斗技巧上，虽然有些成效，但大师说你的武魂优势不在战斗，而在实用。', attack:1, exp:25 } }
  ]},
{ id:'sp_tl_02', name:'平凡中的不凡', location:'天斗城·街头', phase:'adventure', minLevel:12, weight:2, tags:['生活器物','实用','灵巧','survive'],
  image:'assets/scenes/border_town.jpg',
  text:['你遇到了一个同样拥有"普通"武魂的老魂师。他开了一家小店，用他的武魂帮人做各种杂活——修锅、补碗、打水、生火。他活得很快乐。'],
  choices:[
    { text:'向他请教人生智慧', result:{ text:'老魂师说："孩子，武魂没有高低贵贱，只有用得好不好。我用这个武魂养活了一家人，还供儿子上了魂师学院，有什么不好？"你听了很受触动。', fate:3, hp:20, exp:50 } },
    { text:'帮他干一天活', result:{ text:'你用你的武魂帮老魂师干了一天活，配合默契。老魂师很高兴，给了你一些金币，说"年轻人懂得尊重劳动，将来必有出息。"', gold:20, exp:40, fate:1 } }
  ]},
// ---- 植物系专属 ----
{ id:'sp_pl_01', name:'草木之心', location:'森林·清晨', phase:'academy', minLevel:3, weight:2, tags:['植物系','生长','自然'],
  image:'assets/scenes/forest_outer.jpg',
  text:['你的{spirit}让你对植物有着特殊的感知力。清晨的森林中，你能感受到每一株草木的呼吸——它们用你听不懂的语言在交流。'],
  choices:[
    { text:'尝试与植物沟通', result:{ text:'你静下心来，尝试用武魂的力量与周围的植物沟通。渐渐地，你感受到了一种温暖的回应——植物们似乎在欢迎你，向你传递着生命的力量。', hp:20, defense:2, exp:60 } },
    { text:'吸收草木精华修炼', result:{ text:'你引导魂力，从周围的草木中吸收了一丝精华。虽然只是微量，但纯天然的生命力让你的武魂更加活跃了。', spiritPowerGain:5, exp:40 } }
  ]},
{ id:'sp_pl_02', name:'灵药亲和', location:'深山·灵药谷', phase:'adventure', minLevel:14, weight:2, tags:['植物系','生长','自然','生命'],
  image:'assets/scenes/forest_outer.jpg',
  text:['你发现了一片灵药生长的山谷。普通的魂师可能认不全这些药草，但你的植物系武魂让你对它们了如指掌——哪些是灵药，哪些有毒，哪些可以搭配使用。'],
  choices:[
    { text:'采集灵药', result:{ text:'你采集了一批珍贵的灵药，留下了一些钱给药农作为补偿。这些灵药不仅能卖钱，还能自己服用提升修为。', gold:30, item:{ name:'灵药包', desc:'多种灵药的集合', effect:{ hp:20, spiritPowerGain:5 } }, exp:60 } },
    { text:'在药谷中修炼', result:{ text:'你选择在药谷中修炼，灵药的精华随着呼吸进入你的身体，让你的植物系武魂得到了滋养。', hp:30, spiritPowerGain:8, exp:80 } }
  ]},
// ---- 神器/神兽专属 ----
{ id:'sp_gd_01', name:'远古的回响', location:'冥想中', phase:'academy', minLevel:5, weight:1, tags:['神器','神兽','神圣','远古'],
  image:'assets/scenes/temple.jpg',
  text:['你在深度冥想中，意识突然被拉入了一个古老的幻境。你看到远古时代，你的{spirit}的前身——一位古神手持它征战四方，威震天下。'],
  choices:[
    { text:'观察古神的战斗方式', result:{ text:'你仔细观察古神的每一个动作，每一个技巧。虽然只是幻影，但那种神级的战斗方式给了你极大的启发。', attack:4, defense:2, exp:100 } },
    { text:'尝试与古神对话', result:{ text:'你在幻境中向古神发问。古神看了你一眼，只说了一句话："神的力量，源于信念。"然后幻境消散了。这句话虽然简单，但让你对力量有了全新的理解。', fate:3, spiritPowerGain:10, exp:80 } }
  ]},
{ id:'sp_gd_02', name:'神位感召', location:'未知', phase:'god', minLevel:90, weight:1, tags:['神器','神兽','神圣','威严','命运'],
  image:'assets/scenes/abyss_godrealm.jpg',
  text:['你感受到一股来自遥远之地的召唤——那是神位对你的感召。你的{spirit}作为神级武魂，天生与神位有所联系。'],
  choices:[
    { text:'追寻感召', result:{ text:'你循着感召的方向前行，来到了一座古老的祭坛前。祭坛上有与你武魂相似的图腾，当你触碰它时，一缕古老魂力残响化为修炼感悟。', attack:3, defense:3, spiritPowerGain:15, exp:150 } },
    { text:'现在还不是时候', result:{ text:'你记下了感召的方向，但决定等实力更强了再去探索。你能感觉到，那里有你的宿命。', fate:2, exp:40 } }
  ]},
// ---- 防御系专属 ----
{ id:'sp_df_01', name:'坚不可摧', location:'练功场', phase:'academy', minLevel:3, weight:2, tags:['防御系','坚韧','守护'],
  image:'assets/scenes/training_ground.jpg',
  text:['你发现自己的{spirit}在防御方面有着独特的优势——当别人需要躲闪时，你可以硬扛；当别人需要后退时，你可以顶住。'],
  choices:[
    { text:'强化防御训练', result:{ text:'你给自己加练了双倍的防御训练。虽然累得半死，但你的防御力确实有了明显提升。大师说你有成为"铁壁"型魂师的潜质。', defense:4, hp:15, exp:50 } },
    { text:'研究防御反击', result:{ text:'你不仅练防御，还研究了如何在防御的同时进行反击。这种"以守为攻"的打法让你在实战中更加游刃有余。', defense:2, attack:2, exp:60 } }
  ]},
// ---- 敏攻系专属 ----
{ id:'sp_sp_01', name:'疾风步', location:'练功场', phase:'academy', minLevel:3, weight:2, tags:['敏攻系','敏捷','灵动'],
  image:'assets/scenes/training_ground.jpg',
  text:['你的速度在同级魂师中出类拔萃——{spirit}赋予了你超乎常人的敏捷。但大师说，光有速度不够，还要学会在高速中精准控制。'],
  choices:[
    { text:'练习高速移动中的精准攻击', result:{ text:'你在高速奔跑中练习攻击固定目标，一开始总是打偏，但慢慢找到了感觉。速度与精准的结合，让你的战斗力大幅提升。', speed:3, attack:2, exp:60 } },
    { text:'挑战极限速度', result:{ text:'你不断挑战自己的极限速度，跑得双腿发软。虽然精准度没太大提升，但极限速度又上了一个台阶。', speed:4, exp:40 } }
  ]},
// ---- 控制系专属 ----
{ id:'sp_ct_01', name:'精神的触角', location:'冥想室', phase:'academy', minLevel:4, weight:2, tags:['控制系','精神','智慧'],
  image:'assets/scenes/academy_classroom.jpg',
  text:['你发现你的{spirit}不仅能在物理层面影响对手，还能在精神层面产生微妙的影响——这就是控制系武魂的精髓所在。'],
  choices:[
    { text:'深入开发精神控制能力', result:{ text:'你花了大量时间练习精神力的运用，虽然过程很枯燥，但效果显著——现在的你能在战斗中短暂干扰对手的判断。', spiritPowerGain:10, exp:70 } },
    { text:'精神与物理双管齐下', result:{ text:'你把精神控制和物理攻击结合起来，开发了一套独特的战斗方式。敌人既要防你的物理攻击，又要防你的精神干扰，防不胜防。', attack:2, spiritPowerGain:5, exp:60 } }
  ]},
// ---- 辅助系专属 ----
{ id:'sp_aux_01', name:'治愈之光', location:'学院·医疗室', phase:'academy', minLevel:3, weight:2, tags:['辅助系','治愈','祝福'],
  image:'assets/scenes/academy_classroom.jpg',
  text:['一个同学在训练中受伤了，伤口流血不止。你尝试用{spirit}的力量帮他治疗——没想到真的有效！伤口在你的魂力滋养下开始愈合。'],
  choices:[
    { text:'深入研究治疗能力', result:{ text:'你发现了自己武魂的治疗潜力，开始认真研究。渐渐地，你掌握了一些基础的治愈魂技，虽然还比不上专业治疗魂师，但在关键时刻能救人性命。', hp:20, fate:2, exp:60 } },
    { text:'帮更多同学治疗', result:{ text:'你主动到医疗室帮忙，用自己的武魂帮受伤的同学加速恢复。虽然耗了不少魂力，但大家都非常感激你，你在学院的人缘也越来越好。', fate:3, hp:10, exp:40 } }
  ]}
);

// ==================== 十三、金币与属性大扩充 ====================
EVENTS.push(
// ---- 学院·金币收入事件 ----
{ id:'ac_gold_01', name:'帮食堂洗碗', location:'史莱克学院·食堂', phase:'academy', weight:3, image:'assets/scenes/cafeteria.jpg',
  text:['食堂大妈今天忙不过来，问有没有人愿意帮忙洗碗，洗一个时辰给10个金币。'],
  choices:[
    { text:'洗！赚钱不寒碜', result:{ text:'你撸起袖子洗了一个时辰的碗，虽然手都泡皱了，但拿到了10个金币。大妈还偷偷塞给你两个肉包子。', gold:10, hp:5, exp:10 } },
    { text:'让给更需要的人', result:{ text:'你让给了旁边一个家境贫寒的同学。他感激地看了你一眼，大妈也对你竖起了大拇指。', fate:1, exp:5 } }
  ]},
{ id:'ac_gold_02', name:'代人抄笔记', location:'史莱克学院·图书馆', phase:'academy', weight:3, image:'assets/scenes/library.jpg',
  text:['一个富家子弟同学找你帮忙抄课堂笔记，愿意出5个金币。他字写得像鸡爪子，笔记根本没法看。'],
  choices:[
    { text:'接活，顺便温习一遍', result:{ text:'你帮他抄了一遍笔记，拿到了5个金币。抄的过程中你也把知识点复习了一遍，一举两得。', gold:5, exp:20 } },
    { text:'教他自己写', result:{ text:'你没收钱，但耐心教他写字。他虽然笨手笨脚但很认真，最后他终于能写出能看的字了。他感激地请你吃了顿饭。', hp:10, fate:1, exp:15 } }
  ]},
{ id:'ac_gold_03', name:'捡到钱包', location:'史莱克学院·操场', phase:'academy', weight:2, image:'assets/scenes/training_ground.jpg',
  text:['你在操场上捡到一个鼓鼓的钱包，里面有30个金币和一张魂师徽章。'],
  choices:[
    { text:'交给大师寻找失主', result:{ text:'你交给大师，大师通过徽章找到了失主——一位学院老师。老师很感激你，奖励了你10个金币，还在全班表扬了你。', gold:10, fate:2, exp:15 } },
    { text:'偷偷留下', result:{ text:'你犹豫了一下，还是留下了钱包。但心里总觉得不踏实，晚上翻来覆去睡不着。', gold:30, fate:-2 } },
    { text:'放在原地等失主', result:{ text:'你站在原地等了一个时辰，失主终于回来找了。他非常感动，说你是难得的诚实之人。', fate:3, exp:10 } }
  ]},
{ id:'ac_gold_04', name:'帮助学弟学妹', location:'史莱克学院·练功场', phase:'academy', minLevel:4, weight:2, image:'assets/scenes/training_ground.jpg',
  text:['几个刚入学的学弟学妹在练功场上手忙脚乱，连基础步伐都走不对。他们眼巴巴地看着你。'],
  choices:[
    { text:'免费教他们', result:{ text:'你花了一个下午教他们基础步伐，他们进步很快。虽然没赚钱，但你在教导中对自己的基础也有了更深的理解。', exp:30, defense:1, fate:1 } },
    { text:'收点学费', result:{ text:'你说"教可以，一人3个金币"。他们凑了9个金币给你。你教得很认真，他们学得也很认真，都觉得值。', gold:9, exp:20 } }
  ]},
// ---- 学院·更多趣味事件 ----
{ id:'ac_fun_01', name:'武魂失控', location:'史莱克学院·课堂', phase:'academy', weight:2, image:'assets/scenes/academy_classroom.jpg',
  text:['上课时你打了个喷嚏，武魂不小心被激活了——{spirit}突然出现在课桌上，把前排同学的书本吹得到处都是。全班哄堂大笑。'],
  choices:[
    { text:'红着脸赶紧收回去', result:{ text:'你手忙脚乱地收回武魂，脸红得像煮熟的虾。大师推了推眼镜说："控制力还需加强，下课多练一个时辰。"', exp:15, fate:-1 } },
    { text:'死皮赖脸地说"给大家表演个节目"', result:{ text:'你干脆借势表演了一段武魂操控，虽然水平一般，但幽默的态度赢得了大家的掌声。大师也笑了。', fate:2, exp:20 } }
  ]},
{ id:'ac_fun_02', name:'偷吃贡品', location:'史莱克学院·后山', phase:'academy', weight:1, image:'assets/scenes/forest_outer.jpg',
  text:['你在后山发现了一个小庙，供桌上摆着几个新鲜的水果。你肚子有点饿……'],
  choices:[
    { text:'偷吃一个', result:{ text:'你偷偷拿了一个苹果吃了，味道确实不错。但第二天你莫名其妙地摔了三个跟头，不知道是不是报应。', hp:5, fate:-1, exp:5 } },
    { text:'忍住不吃', result:{ text:'你忍住了没吃。晚上梦到一个白胡子老头对你笑，说你有慧根。醒来后你发现魂力增长了一点。', spiritPowerGain:2, exp:15 } },
    { text:'留下一个铜币当买路钱', result:{ text:'你在供桌上放了一个铜币，然后拿了一个苹果。虽然有点滑稽，但你觉得心安理得。', hp:5, exp:10 } }
  ]},
{ id:'ac_fun_03', name:'夜间偷练', location:'史莱克学院·练功场·深夜', phase:'academy', weight:2, image:'assets/scenes/training_ground.jpg',
  text:['深夜你偷偷溜到练功场加练，却发现有人比你先到——戴老大正在月光下挥汗如雨地练拳。'],
  choices:[
    { text:'加入一起练', result:{ text:'你们一起练到天亮。戴老大话不多，但临走时拍了拍你的肩膀说"不错"。你感觉自己的拳头多了几分力道。', attack:2, exp:40, damage:10 } },
    { text:'默默离开，不打扰他', result:{ text:'你悄悄离开了。第二天你注意到戴老大手上有新的茧子，心想这就是强者和普通人的差距吧。', exp:10 } }
  ]},
{ id:'ac_fun_04', name:'武魂共鸣', location:'史莱克学院·冥想室', phase:'academy', minLevel:5, weight:1, image:'assets/scenes/academy_classroom.jpg',
  text:['冥想时你的{spirit}突然发出微光，与旁边同学的武魂产生了共鸣——两股力量在你体内碰撞融合，这是一种难以言喻的奇妙体验。'],
  choices:[
    { text:'顺其自然，体验共鸣', result:{ text:'你放松身心，让两股力量自然融合。共鸣结束后，你的魂力竟然提升了！你的武魂似乎吸收了对方武魂的一些特性。', spiritPowerGain:10, fate:1, exp:50 } },
    { text:'担心失控，强行中断', result:{ text:'你担心出问题，强行中断了共鸣。虽然没什么损失，但你隐约觉得错过了一次宝贵的机缘。', exp:10 } }
  ]},
// ---- 冒险·金币与财富事件 ----
{ id:'adv_gold_01', name:'护送任务', location:'天斗城·佣兵公会', phase:'adventure', minLevel:12, weight:3, image:'assets/scenes/border_town.jpg',
  text:['佣兵公会发布了一个护送任务：护送一位富商前往下一个城市，酬劳50金币。路途不算远，但需要穿过一片有魂兽出没的森林。'],
  choices:[
    { text:'接下任务', result:{ text:'你护送富商安全到达目的地，途中击退了两只魂兽。富商非常满意，不仅给了50金币酬劳，还额外给了你10金币小费。', gold:60, exp:80, battle:'wind_butterfly' } },
    { text:'觉得太危险，拒绝', result:{ text:'你没有接这个任务。后来听说另一个魂师接了，轻松完成了。你有点后悔。', exp:5 } }
  ]},
{ id:'adv_gold_02', name:'药草采集', location:'星斗大森林外围', phase:'adventure', minLevel:10, weight:3, image:'assets/scenes/forest_outer.jpg',
  text:['你在森林中发现了一小片野生灵药——虽然不是什么名贵品种，但拿到城里能卖个好价钱。'],
  choices:[
    { text:'全部采走', result:{ text:'你小心翼翼地把灵药全部采走，拿到城里卖了25个金币。药铺老板说下次有货还可以找他。', gold:25, exp:30 } },
    { text:'只采一半，留种', result:{ text:'你只采了一半，留了一半让它继续生长。这样做虽然少赚了金币，但下次来还能采。', gold:12, fate:1, exp:20 } },
    { text:'不认识，不敢乱采', result:{ text:'你怕采到毒草，没敢动。后来才知道这些是普通的草药，后悔不已。', exp:5 } }
  ]},
{ id:'adv_gold_03', name:'赌场', location:'天斗城·地下赌场', phase:'adventure', minLevel:15, weight:1, image:'assets/scenes/tavern.jpg',
  text:['你在天斗城的暗巷里发现了一个地下赌场，里面人声鼎沸，有人一夜暴富，也有人倾家荡产。'],
  choices:[
    { text:'小赌怡情，押10金币', result:{ text:'你押了10金币，运气不错，赢了15金币！见好就收，你拿着钱离开了。', gold:15, exp:10 } },
    { text:'All in！押50金币！', result:{ text:'你押了50金币，结果全输了。赌场老板笑眯眯地看着你，你感觉被坑了。', gold:-50, exp:5 } },
    { text:'赌场不是好地方，离开', result:{ text:'你转身离开，听到身后有人输光了的哭嚎声。你庆幸自己没有沾上赌博。', fate:1, exp:5 } }
  ]},
{ id:'adv_gold_04', name:'矿洞探险', location:'废弃矿洞', phase:'adventure', minLevel:18, weight:2, image:'assets/scenes/mountain_path.jpg',
  text:['你发现了一个废弃的矿洞，洞口有矿工留下的工具。据说这里曾经出产过稀有矿石，但后来因为魂兽出没被废弃了。'],
  choices:[
    { text:'深入矿洞寻找矿石', result:{ text:'你举着火把深入矿洞，在一处岩壁上挖到了几块寒铁矿石！虽然遇到了一只蝙蝠魂兽，但被你轻松击退了。', gold:40, battle:'iron_armor_bear', exp:60 } },
    { text:'在洞口附近找找', result:{ text:'你在洞口附近找到了几块被矿工遗落的小矿石，虽然不值大钱，但也能卖几个金币。', gold:10, exp:20 } },
    { text:'矿洞太危险，不进去', result:{ text:'你放弃了矿洞探险。安全第一。', exp:5 } }
  ]},
{ id:'adv_gold_05', name:'拍卖会捡漏', location:'天斗城·拍卖行', phase:'master', minLevel:20, weight:1, image:'assets/scenes/auction_house.jpg',
  text:['拍卖会上，一件不起眼的旧铜镜正在被拍卖，没人竞价。但你注意到铜镜背面刻着古老的上古器纹——这很可能是一件被埋没的魂师遗物！'],
  choices:[
    { text:'出价30金币拍下', result:{ text:'你以30金币拍下了铜镜。回去后你仔细研究，发现它确实蕴含着上古魂师的温养之力，能略微增强魂力恢复。虽然不值大钱，但绝对物超所值！', gold:-30, item:{ name:'古铜魂力镜', desc:'略微提升魂力恢复速度', effect:{ spiritPowerGain:10 } }, exp:80 } },
    { text:'不冒险，可能就是废品', result:{ text:'你没有出价。铜镜被一个老者以20金币拍走。后来听说那老者是鉴宝大家，认出铜镜是千年前一位魂师的随身遗物，价值翻了十倍不止。你肠子都悔青了。', exp:5 } }
  ]},
// ---- 冒险·属性提升事件 ----
{ id:'adv_stat_01', name:'瀑布修炼', location:'深山瀑布', phase:'adventure', minLevel:15, weight:2, image:'assets/scenes/mountain_path.jpg',
  text:['你发现了一处壮观的瀑布，水势凶猛。你听说过在瀑布下修炼可以锤炼体魄，但那种冲击力可不是闹着玩的。'],
  choices:[
    { text:'站在瀑布下修炼', result:{ text:'你咬着牙站在瀑布下，巨大的水流冲击让你几乎站不稳。但你坚持了下来，一炷香后你感觉身体像被千锤百炼过一样！', attack:2, defense:2, maxHp:20, damage:10, exp:80 } },
    { text:'在瀑布边上修炼就好', result:{ text:'你在瀑布边找了个地方修炼，水雾弥漫，倒也清凉舒适。虽然没有锤炼体魄的效果，但心境很放松。', hp:10, exp:30 } }
  ]},
{ id:'adv_stat_02', name:'温泉疗伤', location:'山间温泉', phase:'adventure', weight:2, image:'assets/scenes/volcano.jpg',
  text:['你在山中发现了一处天然温泉，泉水冒着热气，闻起来有淡淡的硫磺味。附近有路牌写着"疗伤圣泉"。'],
  choices:[
    { text:'泡一泡，放松身心', result:{ text:'你泡在温泉里，感觉浑身的疲惫和伤痛都在慢慢消散。这温泉果然有疗伤效果！', hp:40, exp:15 } },
    { text:'在泉边修炼', result:{ text:'你在泉边打坐修炼，温泉散发出的灵气让魂力恢复速度加快了不少。', spiritPowerGain:5, exp:20 } }
  ]},
{ id:'adv_stat_03', name:'遗迹体术', location:'远古遗迹·壁画前', phase:'master', minLevel:22, weight:2, image:'assets/scenes/abyss_godrealm.jpg',
  text:['在遗迹中，你发现了一面刻满壁画的墙壁，上面画着一种古老的炼体术——动作古怪但蕴含着某种奥秘。'],
  choices:[
    { text:'照着壁画练习', result:{ text:'你按照壁画上的动作练了起来，虽然姿势古怪，但练完之后浑身发热，骨骼"咔咔"作响，身体素质明显提升了！', attack:2, defense:3, hp:20, exp:100 } },
    { text:'把壁画抄下来以后研究', result:{ text:'你花时间把壁画上的内容抄了下来，准备以后慢慢研究。虽然现在没练，但这是宝贵的资料。', exp:40 } }
  ]},
{ id:'adv_stat_04', name:'极限奔跑', location:'广阔平原', phase:'adventure', minLevel:12, weight:2, image:'assets/scenes/forest_outer.jpg',
  text:['你来到一片广阔的平原，心血来潮想测试一下自己的极限速度。你深吸一口气，全力冲刺！'],
  choices:[
    { text:'跑到极限为止', result:{ text:'你跑到双腿发软才停下来，瘫倒在地上大口喘气。但当你站起来时，感觉身体轻快了许多，速度似乎比以前更快了。', speed:2, damage:10, exp:40 } },
    { text:'适可而止', result:{ text:'你跑了一会儿就停下来休息。虽然没到极限，但也是一次不错的锻炼。', exp:15 } }
  ]},
// ---- 封号·金币与财富事件 ----
{ id:'ma_gold_01', name:'宗门供奉', location:'你的宗门', phase:'god', minLevel:42, weight:2, image:'assets/scenes/wuhun_city.jpg',
  text:['你的宗门日渐壮大，弟子上供的财物也越来越多。这个月宗门库房收了不少金币和物资。'],
  choices:[
    { text:'取一部分作为个人修炼资金', result:{ text:'你从宗门库房取了100金币作为修炼资金。身为宗主，这是你应得的。', gold:100, exp:30 } },
    { text:'全部留给宗门发展', result:{ text:'你把所有财物都留给宗门发展，买了更好的训练设备和丹药给弟子们。虽然自己没拿钱，但宗门实力的提升让你声望更高了。', fate:3, exp:50 } }
  ]},
{ id:'ma_gold_02', name:'帝国赏赐', location:'天斗帝国·皇宫', phase:'god', minLevel:45, weight:2, image:'assets/scenes/wuhun_city.jpg',
  text:['你为帝国剿灭了一伙作乱的邪魂师，皇帝龙颜大悦，派人送来了丰厚的赏赐。'],
  choices:[
    { text:'收下赏赐', result:{ text:'你收下了200金币和一批珍贵药材。皇帝还赐了你一块"护国英雄"的金牌，以后在帝国境内消费都有折扣。', gold:200, item:{ name:'护国英雄金牌', desc:'帝国境内消费享折扣', effect:{ fate:2 } }, exp:100, fate:2 } },
    { text:'婉拒赏赐，只求为民除害', result:{ text:'你婉拒了赏赐，说"为民除害是魂师本分"。皇帝对你更加敬重，虽然赏赐没要，但你的名声传遍了帝国。', fate:5, exp:80 } }
  ]},
{ id:'ma_gold_03', name:'稀有魂骨交易', location:'秘密拍卖会', phase:'god', minLevel:90, weight:2, image:'assets/scenes/auction_house.jpg',
  text:['你被邀请参加一场只有封号斗罗才能进入的秘密拍卖会，这里交易的物品都是外界难得一见的珍品。'],
  choices:[
    { text:'竞拍一块千年魂骨', result:{ text:'你以150金币拍到了一块千年魂骨！虽然品级不算顶级，但融合后让你的实力又上了一个台阶。', gold:-150, attack:3, defense:3, hp:30, exp:200 } },
    { text:'只看看不买', result:{ text:'你在拍卖会上见识了很多珍品，虽然没买，但开阔了眼界。你还结识了几位封号斗罗，交换了联系方式。', fate:1, exp:50 } }
  ]},
// ---- 成神·属性与终极事件 ----
{ id:'god_stat_01', name:'神体淬炼', location:'神界·淬炼池', phase:'god', minLevel:72, weight:2, image:'assets/scenes/temple.jpg',
  text:['神界有一座淬炼池，池水是纯粹的神力凝聚而成，浸泡其中可以淬炼神体——但过程极其痛苦，连神都会痛得惨叫。'],
  choices:[
    { text:'跳入淬炼池', result:{ text:'你咬紧牙关跳入池中，神力如刀割般撕裂你的每一寸神体，然后又重新凝聚。当痛苦消散时，你感觉自己的神体比以前强韧了数倍！', attack:5, defense:5, maxHp:100, damage:50, exp:300 } },
    { text:'在池边吸收逸散的神力', result:{ text:'你选择在池边打坐，吸收池中逸散出的神力。虽然效果不如直接浸泡，但胜在安全舒适。', spiritPowerGain:20, exp:100 } }
  ]},
{ id:'god_stat_02', name:'神技顿悟', location:'神界·悟道崖', phase:'god', minLevel:75, weight:2, image:'assets/scenes/abyss_godrealm.jpg',
  text:['你站在悟道崖上俯视万千世界，忽然灵光一闪——你领悟到了神力的更深层次运用方式！'],
  choices:[
    { text:'深入参悟', result:{ text:'你花了整整一个月参悟这种新境界，终于创造出了一式属于自己的神技！这一招的威力远超你之前掌握的任何魂技。', attack:8, spiritPowerGain:30, exp:500 } },
    { text:'记录下来，以后慢慢研究', result:{ text:'你把灵感记录下来，准备以后慢慢研究。虽然现在没有完全参透，但已经摸到了门路。', exp:150 } }
  ]},
{ id:'god_gold_01', name:'信仰金币', location:'你的神殿', phase:'god', minLevel:73, weight:2, image:'assets/scenes/temple.jpg',
  text:['你的信徒们献上了大量的供奉金币和珍贵物品。虽然作为神你不需要钱，但金币在神界也可以用来与其他神祇交易。'],
  choices:[
    { text:'收下供奉', result:{ text:'你收下了500金币的供奉。虽然神不需要钱，但可以用来在神界市场上交换稀有材料。', gold:500, exp:50 } },
    { text:'赐福加倍返还', result:{ text:'你不仅不收供奉，反而降下神恩赐福给信徒们。你的信仰之力因此大增。', fate:5, spiritPowerGain:15, exp:80 } }
  ]}
);

// ==================== 十四、冒险冒险再扩充 ====================
EVENTS.push(
// ---- 冒险·更多趣味遭遇 ----
{ id:'adv_more_01', name:'会说人话的鹦鹉', location:'森林·路边', phase:'adventure', weight:2, image:'assets/beasts/wind_butterfly.jpg',
  text:['你在一棵大树上看到一只色彩斑斓的大鹦鹉，它居然对你说话了："嘿，魂师！前面有只大熊，绕路走吧！"'],
  choices:[
    { text:'谢谢鹦鹉，绕路走', result:{ text:'你感谢了鹦鹉，绕路前行。后来你听说那天确实有人在前面遇到了铁甲熊，差点没命。这只鹦鹉救了你的命！', fate:2, exp:20 } },
    { text:'哈哈，鹦鹉也会骗人？', result:{ text:'你不信，继续往前走。结果真的遇到了一只铁甲熊，你被打得抱头鼠窜。那只鹦鹉在你头顶飞过，嘎嘎大笑。', damage:15, battle:'iron_armor_bear', exp:30 } },
    { text:'抓它当宠物！', result:{ text:'你试图抓鹦鹉，但它飞得比你还快，一边飞一边骂："笨蛋笨蛋！"你追了半天都没抓到。', exp:10 } }
  ]},
{ id:'adv_more_02', name:'神秘的蛋', location:'山谷·巢穴', phase:'adventure', minLevel:18, weight:2, image:'assets/beasts/thunder_bird.jpg',
  text:['你在山谷中发现了一个巨大的巢穴，里面有一颗比人头还大的蛋，蛋壳上有金色的纹路，散发着温热的气息。'],
  choices:[
    { text:'带走孵化', result:{ text:'你小心翼翼地把蛋带走了。经过一段时间的孵化，一只小魂兽破壳而出，对你特别亲近——它把你当成了妈妈！你获得了一只魂兽伙伴！', item:{ name:'魂兽幼崽', desc:'还在成长的魂兽伙伴', effect:{ attack:3, defense:3 } }, fate:3, exp:100 } },
    { text:'可能是母兽的蛋，快走', result:{ text:'你赶紧离开了巢穴。刚走不远就听到身后传来一声愤怒的吼叫——母兽回来了！你庆幸自己跑得快。', exp:20 } },
    { text:'……烤了吃', result:{ text:'你生火把蛋烤了。蛋的味道鲜美无比，吃完后你感觉体内充满了力量。但总觉得自己做了什么不太对的事。', attack:2, defense:2, hp:20, fate:-2, exp:50 } }
  ]},
{ id:'adv_more_03', name:'路遇花痴', location:'天斗城·花园', phase:'adventure', weight:2, image:'assets/scenes/border_town.jpg',
  text:['一个打扮得花枝招展的姑娘拦住了你，上下打量了一番后说："这位魂师大人，你长得真好看，要不要考虑娶我？"'],
  choices:[
    { text:'婉拒，说已有心上人', result:{ text:'你礼貌地婉拒了。姑娘也不纠缠，只是叹了口气说"好男人都有主了"，然后转身走了。', exp:5 } },
    { text:'逃跑！', result:{ text:'你转身就跑，姑娘在后面追了两条街才放弃。你在天斗城留下了一个"被姑娘追了三条街"的笑话。', speed:1, exp:10 } },
    { text:'……也不是不行', result:{ text:'你犹豫了一下。姑娘高兴地拉着你就要去见她爹——原来她爹是天斗城一个富商，可惜姑娘发现你是个穷魂师后，又反悔了。', gold:20, exp:15 } }
  ]},
{ id:'adv_more_04', name:'野炊', location:'野外·河边', phase:'adventure', weight:3, image:'assets/scenes/forest_outer.jpg',
  text:['天气不错，你决定在河边生火做饭。你抓了两条鱼，采了些野菜，准备做一顿美味的烤鱼。'],
  choices:[
    { text:'认真烹饪', result:{ text:'你用心烹饪，烤鱼外焦里嫩，野菜汤鲜美无比。吃饱喝足后你感觉浑身舒畅，连魂力都恢复了不少。', hp:20, spiritPowerGain:3, exp:15 } },
    { text:'随便烤烤', result:{ text:'你随便烤了一下，鱼烤糊了，野菜也煮老了。勉强填饱肚子，味道实在不怎么样。', hp:5, exp:5 } },
    { text:'生一堆大火，看能不能引来旅伴', result:{ text:'你生了一堆大火，果然吸引来了一位路过的旅人。你们分享了食物，交换了旅途中的见闻，相谈甚欢。', fate:1, exp:25 } }
  ]},
{ id:'adv_more_05', name:'山贼招安', location:'山寨·聚义厅', phase:'master', minLevel:20, weight:2, image:'assets/scenes/border_town.jpg',
  text:['一伙山贼被你打怕了，山贼头子跪地求饶："大人，我们也是被逼的，家里上有老下有小，求大人给条活路！"'],
  choices:[
    { text:'让他们改邪归正', result:{ text:'你要求山贼们改邪归正，帮附近村民干农活赎罪。山贼们不敢违抗，真的开始帮村民干活了。村民们感激不尽，给你送来了不少礼物。', gold:30, fate:3, exp:80 } },
    { text:'收编当小弟', result:{ text:'你把山贼收编了，让他们负责守护这条山路，向过路商人收点保护费（比以前少很多）。这样商人们也乐意，山贼们也有正当收入。', gold:50, fate:2, exp:60 } },
    { text:'全部赶走', result:{ text:'你把山贼们全部赶走了，山寨付之一炬。从此这条山路太平了。', fate:1, exp:40 } }
  ]},
{ id:'adv_more_06', name:'恶魔果实', location:'迷雾沼泽', phase:'master', minLevel:25, weight:2, image:'assets/scenes/swamp.jpg',
  text:['你在沼泽中看到一棵枯树上结着一颗黑色的果实，散发着诡异的气息。周围的植物都枯萎了，只有这颗果实还在发光。'],
  choices:[
    { text:'吃下去！', result:{ text:'你冒险吃下了果实，一股狂暴的力量涌入体内！你感到身体被撕裂般的痛苦，但痛苦过后，你的力量大幅提升——但也付出了代价。', attack:6, damage:30, spiritPowerGain:10, exp:150 } },
    { text:'用瓶子装起来，以后研究', result:{ text:'你小心翼翼地用瓶子装好果实。带到城里给药铺老板看，他说这是"暗魂果"，虽然有毒但可以入药，他愿意出100金币买下。', gold:100, exp:50 } },
    { text:'太危险，烧掉', result:{ text:'你用火把果实烧掉了。果实燃烧时冒出黑色的烟雾，烟雾散去后，周围的植物居然开始重新生长了。', fate:1, exp:20 } }
  ]}
);

// ==================== 十五、封号·成神最后补完 ====================
EVENTS.push(
// ---- 封号·更多事件 ----
{ id:'ma_more_01', name:'双生武魂的秘密', location:'古籍阁', phase:'god', minLevel:50, weight:2, image:'assets/scenes/library.jpg',
  text:['你在古籍中发现了关于双生武魂的记载——据说某些魂师可以拥有两个武魂，但需要满足极为苛刻的条件。'],
  choices:[
    { text:'深入研究双生武魂', result:{ text:'你潜心研究，发现自己的{spirit}虽然只有一个，但通过特殊方法可以激发出第二属性！虽然不是真正的双生武魂，但让你的武魂多了一种能力。', spiritPowerGain:15, attack:2, defense:2, exp:200 } },
    { text:'太危险，不研究了', result:{ text:'古籍中记载强行觉醒第二武魂可能导致武魂崩溃，你选择了保守。', exp:30 } }
  ]},
{ id:'ma_more_02', name:'魂兽王者来访', location:'你的宗门', phase:'god', minLevel:55, weight:2, image:'assets/beasts/titan_giant_ape_king.jpg',
  text:['星斗大森林外围的魂兽王者派使者来访——他们希望与你达成和平协议，互不侵犯对方的领地。'],
  choices:[
    { text:'同意和平协议', result:{ text:'你同意了和平协议。从此你的宗门弟子进入星斗大森林外围猎取魂环时，不会遭到高阶魂兽的主动攻击。魂兽们也获得了安全感。', fate:5, exp:150 } },
    { text:'拒绝，魂兽凭什么和人类谈判', result:{ text:'你拒绝了和平协议。虽然短期内猎取魂环更方便了，但你也因此得罪了魂兽王者，以后可能会被报复。', fate:-2, exp:50 } }
  ]},
{ id:'ma_more_03', name:'魂骨融合', location:'密室', phase:'god', minLevel:52, weight:2, image:'assets/scenes/blacksmith.jpg',
  text:['你获得了一块魂骨，但融合魂骨的过程极其痛苦——魂骨会与你的骨骼融合，相当于把一块不属于你的骨头硬塞进身体。'],
  choices:[
    { text:'咬牙融合', result:{ text:'你咬紧牙关承受了融合的痛苦，当魂骨完全融入时，你感觉自己的身体发生了质变！实力大幅提升！', attack:3, defense:3, maxHp:50, damage:30, exp:250 } },
    { text:'暂时不融合', result:{ text:'你把魂骨收好，准备等实力更强、身体更坚韧的时候再融合。', exp:30 } }
  ]},
{ id:'ma_more_04', name:'武魂真身', location:'修炼中', phase:'god', minLevel:70, weight:3, image:'assets/scenes/training_ground.jpg',
  text:['你修炼到了一个关键节点——武魂真身！这是魂圣（七环）阶段的标志性能力，可以将武魂实体化，大幅提升战力。'],
  choices:[
    { text:'全力冲击武魂真身', result:{ text:'你凝聚全部魂力冲击武魂真身，{spirit}在你身后浮现出巨大的虚影，气势磅礴！你成功了！武魂真身让你的战力翻倍！', attack:6, defense:4, hp:100, spiritPowerGain:25, exp:500, fate:2 } },
    { text:'慢慢来，稳扎稳打', result:{ text:'你没有急于求成，而是稳扎稳打地积累。虽然比别人慢了一些，但根基更加扎实。', attack:2, defense:2, exp:150 } }
  ]},
// ---- 成神·更多事件 ----
{ id:'god_more_01', name:'域外来客', location:'神界·交易站', phase:'god', minLevel:76, weight:2, image:'assets/scenes/auction_house.jpg',
  text:['一位游历世界之外的神秘商人来到神界，他带来了闻所未闻的奇珍异宝，也愿意收购神界的特产。'],
  choices:[
    { text:'买！奇珍异宝不能错过', result:{ text:'你花了300金币买了一颗异世界的"时空结晶"，据说能让人短暂看到未来。虽然不知道真假，但结晶中蕴含的能量确实浩瀚无比。', gold:-300, item:{ name:'界外结晶', desc:'蕴含世界之外气息的神秘晶体', effect:{ spiritPowerGain:50, attack:5 } }, exp:200 } },
    { text:'卖一些神界特产', result:{ text:'你把神界的一些特产卖给商人，赚了200金币。商人很高兴，说下次还会来。', gold:200, exp:50 } },
    { text:'只是看看，不交易', result:{ text:'你好奇地参观了异世界商人的摊位，大开眼界。虽然没有交易，但增长了见识。', exp:30 } }
  ]},
{ id:'god_more_02', name:'神界执法者', location:'神界', phase:'god', minLevel:80, weight:2, image:'assets/scenes/temple.jpg',
  text:['神界委员会任命你为执法者，负责维护神界秩序。这意味着你有了更大的权力，但也承担了更多的责任。'],
  choices:[
    { text:'接受任命', result:{ text:'你接受了任命，成为神界执法者。你获得了神界法令的解读权和对违规神祇的执法权。你的声望在神界大幅提升。', fate:5, attack:3, defense:3, exp:300 } },
    { text:'婉拒，不想管闲事', result:{ text:'你婉拒了，表示自己只想做个闲散的神祇。委员会虽然有些失望，但没有勉强。', exp:50 } }
  ]},
{ id:'god_more_03', name:'创造生命', location:'神界·创生池', phase:'god', minLevel:85, weight:2, image:'assets/scenes/abyss_godrealm.jpg',
  text:['你掌握了创造生命的能力——在创生池中，你可以用神力捏造出全新的生灵。这是只有高阶神祇才能做到的伟业。'],
  choices:[
    { text:'创造一个守护灵', result:{ text:'你花费了大量神力，创造了一个忠诚的守护灵。它虽然不强，但会永远守护你和你的传承。', attack:5, defense:5, spiritPowerGain:-30, fate:5, exp:500 } },
    { text:'创造一种小动物，放回斗罗大陆', result:{ text:'你创造了一种可爱的小动物，放回了斗罗大陆。这种动物后来成为了大陆上的新物种，被命名为"神创兽"。', fate:3, exp:200 } },
    { text:'这种力量太危险，不用', result:{ text:'你觉得创造生命这种力量不该被滥用，选择了封印创生池。', fate:2, exp:50 } }
  ]}
);

// ==================== 十二、最终补充：更多趣味/细节/稀有事件 ====================
EVENTS.push(
// ---- 学院·更多日常 ----
{ id:'ac_extra_01', name:'罚抄', location:'史莱克学院·教室', phase:'academy', weight:2, image:'assets/scenes/academy_classroom.jpg',
  text:['你上课打瞌睡被大师抓了个正着，罚你把《武魂基础理论》抄一百遍。'],
  choices:[
    { text:'老老实实抄完', result:{ text:'你抄了整整一夜，手都快断了。但奇怪的是，抄完之后你对武魂基础理论的理解加深了不少。', exp:30, spiritPowerGain:2 } },
    { text:'找同学帮忙抄', result:{ text:'你找同学帮忙分抄，结果被大师发现了，加倍罚抄两百遍！', exp:5, damage:10 } },
    { text:'讨价还价', result:{ text:'你跟大师讨价还价，说宁愿多练一个时辰体能。大师看了你一眼，同意了。然后你跑了二十圈操场，累得像狗一样。', damage:15, exp:20, defense:1 } }
  ]},
{ id:'ac_extra_02', name:'食堂大妈的手', location:'史莱克学院·食堂', phase:'academy', weight:3, image:'assets/scenes/cafeteria.jpg',
  text:['今天食堂打饭，大妈的手又开始抖了——眼看那块大肉就要抖掉了！'],
  choices:[
    { text:'甜言蜜语讨好大妈', result:{ text:'你笑着说"阿姨您今天真好看"，大妈一高兴，手不抖了，还给你多打了两块肉！', hp:20, exp:10, fate:1 } },
    { text:'死死盯着那块肉', result:{ text:'你用渴望的眼神盯着那块肉，大妈被你看得不好意思，肉还是打给了你。', hp:10, exp:5 } },
    { text:'敢抖掉我就哭给你看', result:{ text:'你假装委屈地看着大妈，大妈心软了，不仅肉没抖掉，还给你加了个蛋。', hp:15, fate:1, exp:5 } }
  ]},
{ id:'ac_extra_03', name:'室友说梦话', location:'宿舍·深夜', phase:'academy', weight:2, image:'assets/scenes/dormitory.jpg',
  text:['深夜，你被室友的梦话吵醒了。他在梦里大喊："不要追我！我没有偷你的胡萝卜！"'],
  choices:[
    { text:'第二天嘲笑他', result:{ text:'第二天你把他的梦话告诉了大家，他羞得满脸通红，追着你打了半个学院。', exp:10 } },
    { text:'假装没听见', result:{ text:'你翻了个身继续睡觉，什么都没说。', exp:5 } },
    { text:'在梦里回应他', result:{ text:'你恶作剧地在他耳边低声说："我知道是你偷的，快交出来！"结果他被吓得从床上滚了下去。', exp:15, fate:-1 } }
  ]},
{ id:'ac_extra_04', name:'弗兰德院长的训话', location:'史莱克学院·操场', phase:'academy', weight:2, image:'assets/scenes/training_ground.jpg',
  text:['弗兰德院长把所有人集合起来训话，讲了一个时辰他当年的英雄事迹。你们站得腿都麻了。'],
  choices:[
    { text:'认真听，虽然啰嗦但可能有用', result:{ text:'你认真听完了院长的训话，虽然大部分是吹牛，但中间确实有几句实战经验让你有所收获。', exp:25, defense:1 } },
    { text:'偷偷开小差', result:{ text:'你在下面偷偷和同学聊天，被院长发现了，罚你绕操场跑十圈。', damage:10, exp:10 } },
    { text:'站着睡着了', result:{ text:'你实在太困，站着睡着了。醒来时发现所有人都走了，只有院长黑着脸看着你。接下来你被罚洗了一个月的厕所。', fate:-1, exp:5 } }
  ]},
{ id:'ac_extra_05', name:'赵无极的考验', location:'史莱克学院·练功场', phase:'adventure', minLevel:8, weight:2, image:'assets/scenes/training_ground.jpg',
  text:['赵无极老师说要亲自测试你们的实力，让你们一起上，能在他手下撑过一炷香就算合格。'],
  choices:[
    { text:'正面硬扛', result:{ text:'你选择正面硬扛赵无极老师的攻击，虽然被打得鼻青脸肿，但撑过了一炷香！赵无极哈哈大笑："有种！"', damage:30, exp:80, attack:2, defense:1 } },
    { text:'和同学配合游走', result:{ text:'你和同学们配合游走，不正面硬接，靠配合拖延时间。虽然没撑过一炷香，但赵无极说你们的配合不错。', damage:15, exp:50, fate:1 } }
  ]},
{ id:'ac_extra_06', name:'小三的暗器演示', location:'史莱克学院', phase:'academy', minLevel:6, weight:1, image:'assets/scenes/academy_classroom.jpg',
  text:['唐三在学院展示了他的暗器功夫，几根银针在他手中神出鬼没，竟能穿透钢板。同学们都看呆了。'],
  choices:[
    { text:'向他请教暗器', result:{ text:'你向唐三请教暗器手法，他很慷慨地教了你几招基础。虽然你不是唐门弟子，但这些技巧在实战中很有用。', attack:1, speed:1, exp:40 } },
    { text:'暗器不是正途，不必学', result:{ text:'你觉得暗器不够光明正大，没有去学。唐三也不勉强，只是笑了笑。', exp:10 } }
  ]},
{ id:'ac_extra_07', name:'学院运动会', location:'史莱克学院·操场', phase:'academy', weight:2, image:'assets/scenes/training_ground.jpg',
  text:['学院举办了一年一度的运动会，有赛跑、举重、魂力控制等各种项目。'],
  choices:[
    { text:'参加赛跑', result:{ text:'你参加了赛跑项目，用魂力辅助速度，获得了第二名！奖励了一块附了魂力祝福的玉佩。', speed:2, item:{ name:'加速玉佩', desc:'略微提升移动速度', effect:{ speed:2 } }, exp:50 } },
    { text:'参加举重', result:{ text:'你参加了举重项目，靠蛮力举到了第三名。虽然不是最好的，但大家都为你鼓掌。', attack:1, exp:30 } },
    { text:'当观众加油', result:{ text:'你在看台上为同学们加油呐喊，嗓子都喊哑了，但大家玩得很开心。', fate:1, exp:10 } }
  ]},
{ id:'ac_extra_08', name:'捡到大便宜', location:'学院·角落', phase:'academy', weight:1, image:'assets/scenes/forest_outer.jpg',
  text:['你在学院的一个偏僻角落里发现了一个落满灰尘的箱子，里面居然有几本旧秘籍和一小瓶丹药！看来是以前学长遗落的。'],
  choices:[
    { text:'据为己有', result:{ text:'你偷偷把东西带回了宿舍。秘籍是基础功法，丹药能恢复魂力。虽然有些心虚，但好处是实实在在的。', spiritPowerGain:8, exp:60 } },
    { text:'交给学院', result:{ text:'你把东西交给了大师。大师表扬了你诚实，然后把丹药奖励给了你，秘籍则放到了图书馆供大家借阅。', item:{ name:'回气丹', desc:'快速恢复魂力', effect:{ spiritPowerGain:5 } }, fate:2, exp:30 } }
  ]},
// ---- 冒险·更多野外事件 ----
{ id:'adv_extra_01', name:'蜜蜂袭击', location:'野外·花海', phase:'adventure', weight:2, image:'assets/beasts/wind_butterfly.jpg',
  text:['你不小心惊扰了一个蜂巢，成千上万只蜜蜂朝你扑来！'],
  choices:[
    { text:'跳进水里躲避', result:{ text:'你看到旁边有条小河，立刻跳了进去。蜜蜂在水面上盘旋了一会儿就飞走了。你虽然成了落汤鸡，但没被蛰。', hp:5, exp:20 } },
    { text:'用火把驱赶', result:{ text:'你点起火把挥舞，蜜蜂怕火纷纷退散。你得意地笑了，结果不小心把旁边的草点着了……你手忙脚乱地灭火。', damage:10, exp:25 } },
    { text:'抱头狂奔', result:{ text:'你捂着头狂奔，跑了二里地才甩掉蜂群。被蛰了十几个包，脸都肿了。', damage:20, exp:15 } }
  ]},
{ id:'adv_extra_02', name:'暴风雨', location:'野外', phase:'adventure', weight:2, image:'assets/scenes/mountain_path.jpg',
  text:['天空突然乌云密布，暴风雨来了！你需要找个地方避雨。'],
  choices:[
    { text:'躲进山洞', result:{ text:'你找到一个山洞躲了进去。外面风雨交加，你在洞里生了堆火，居然还舒舒服服地睡了一觉。', hp:15, exp:15 } },
    { text:'冒雨赶路', result:{ text:'你选择冒雨继续赶路，被淋成了落汤鸡，还差点被山洪冲走。第二天你感冒了。', damage:20, exp:10 } },
    { text:'在大树下躲雨', result:{ text:'你在一棵大树下躲雨，结果一道闪电差点劈到树上！你吓得赶紧换了个地方。', damage:5, exp:10 } }
  ]},
{ id:'adv_extra_03', name:'野果', location:'野外·山林', phase:'adventure', weight:2, image:'assets/scenes/forest_outer.jpg',
  text:['你发现了一棵结满红色野果的树，果子看起来很诱人，但你不确定有没有毒。'],
  choices:[
    { text:'先尝一个试试', result:{ text:'你小心翼翼地尝了一个，味道酸甜可口，而且没有任何不适！这果子不仅没毒，还能恢复体力。你大吃了一顿。', hp:20, exp:15 } },
    { text:'喂给小动物先试', result:{ text:'你抓了一只小松鼠，给它喂了一个果子。小松鼠吃了没事，你才放心吃。', hp:15, exp:20, fate:1 } },
    { text:'不认识的果子不吃', result:{ text:'你谨慎地离开了。虽然错过了美食，但也避免了中毒的风险。', exp:10 } }
  ]},
{ id:'adv_extra_04', name:'迷路', location:'森林深处', phase:'adventure', minLevel:15, weight:2, image:'assets/scenes/forest_deep.jpg',
  text:['你在森林里迷路了，转了半天都找不到出路，手机——哦不对，这是斗罗大陆，没有手机。'],
  choices:[
    { text:'爬上高处辨认方向', result:{ text:'你爬上一棵最高的树，从树冠上看到了远处的山脉，以此辨别方向找到了出路。', exp:40, speed:1 } },
    { text:'沿溪流走', result:{ text:'你记得沿水走总能找到出路，于是顺着溪流往下游走，果然走出了森林。', exp:30 } },
    { text:'原地等救援', result:{ text:'你原地等待，但等了一天一夜也没人来，最后还是得自己找路。又饿又累，损失了不少体力。', damage:15, exp:10 } }
  ]},
{ id:'adv_extra_05', name:'受伤的小鹿', location:'森林·溪边', phase:'adventure', weight:2, image:'assets/beasts/spirit_deer.jpg',
  text:['你发现一只受伤的小鹿躺在溪边，它的腿被捕兽夹夹伤了，用湿漉漉的眼睛看着你。'],
  choices:[
    { text:'帮它治伤放生', result:{ text:'你帮它解开捕兽夹，用伤药给它包扎好，放它回森林。小鹿临走前回头看了你三眼，似乎在感谢你。', fate:2, exp:30 } },
    { text:'……烤了吃', result:{ text:'你饿极了，把小鹿烤了吃了。虽然解决了饥饿，但你心里总觉得不是滋味。', hp:30, fate:-2, exp:5 } },
    { text:'不管它', result:{ text:'你选择不管，继续走自己的路。但小鹿的眼神一直在你脑海里挥之不去。', fate:-1 } }
  ]},
{ id:'adv_extra_06', name:'隐士高人', location:'深山·茅屋', phase:'master', minLevel:25, weight:1, image:'assets/scenes/mountain_path.jpg',
  text:['你在深山中迷了路，遇到一个在茅屋前种菜的老者。他看起来普普通通，但你注意到他身上的魂力波动深不可测。'],
  choices:[
    { text:'恭敬求教', result:{ text:'你恭敬地向老者行礼请教。老者看了你一眼，点了点头，随口指点了你几句修炼上的问题。你茅塞顿开，困扰已久的瓶颈竟然松动了！', spiritPowerGain:15, exp:300, fate:2 } },
    { text:'礼貌借宿一晚', result:{ text:'你请求借宿一晚，老者同意了。晚上你听到他在月下吟诗，声音中蕴含着天地至理，你虽然听不懂多少，但也有所感悟。', exp:80, hp:20 } },
    { text:'觉得他可疑，赶紧离开', result:{ text:'你觉得这老者出现在深山里太奇怪了，匆匆告辞离开。后来你才听说那是一位隐居的极限斗罗，后悔不已。', exp:10 } }
  ]},
// ---- 封号·更多事件 ----
{ id:'ma_extra_01', name:'其他封号斗罗的挑战', location:'武魂城·竞技场', phase:'god', minLevel:90, weight:2, image:'assets/scenes/arena.jpg',
  text:['另一位封号斗罗公开挑战你，想试试你的实力。这在封号斗罗之间是常有的事。'],
  choices:[
    { text:'接受挑战，堂堂正正一战', result:{ text:'你接受了挑战，两人在竞技场上大战了三百回合，最终你以一招之差险胜。对手对你心服口服，你们成了不打不相识的朋友。', damage:30, battle:'final_fighter', exp:300, attack:2, fate:2 } },
    { text:'婉拒，不想争强好胜', result:{ text:'你婉拒了挑战，表示自己修炼不是为了争强斗胜。对方有些失望，但也尊重你的选择。', fate:1, exp:50 } }
  ]},
{ id:'ma_extra_02', name:'发现秘境', location:'虚空裂缝', phase:'god', minLevel:60, weight:1, image:'assets/scenes/abyss_godrealm.jpg',
  text:['你在修炼中感知到了一个隐藏的空间裂缝，里面似乎是一个上古强者留下的秘境。'],
  choices:[
    { text:'进入秘境探索', result:{ text:'你进入秘境，里面有上古强者的遗骸和传承。你获得了他的修炼心得和一块魂骨，实力大进！', attack:3, defense:3, spiritPowerGain:20, exp:500 } },
    { text:'太危险，先封印再说', result:{ text:'你觉得秘境太危险，先用魂力封印了裂隙，等以后准备充分了再来探索。', fate:1, exp:50 } }
  ]},
{ id:'ma_extra_03', name:'亲人来访', location:'你的府邸', phase:'master', weight:2, image:'assets/scenes/wuhun_city.jpg',
  text:['你的亲人（或你在村里的老朋友）来看你了。他们看着你如今的地位和成就，既骄傲又有些拘谨。'],
  choices:[
    { text:'好好招待他们，陪他们叙旧', result:{ text:'你放下所有身段陪他们喝酒聊天，像小时候一样。临走时你给了他们很多钱财和丹药，让他们安享晚年。', hp:30, fate:2, exp:50 } },
    { text:'太忙了，让人招待他们', result:{ text:'你正在修炼关键期，让仆人好好招待他们，但没有亲自陪伴。他们理解你，但你能看出他们眼中的失落。', fate:-1, exp:10 } }
  ]},
// ---- 成神·更多事件 ----
{ id:'god_extra_01', name:'神的宠物', location:'神界·你的神殿', phase:'god', minLevel:84, weight:1, image:'assets/beasts/titan_giant_ape_king.jpg',
  text:['一只上古神兽的幼崽误打误撞闯入了你的神殿，它看起来萌萌的，但血统极为高贵。'],
  choices:[
    { text:'收它当神宠', result:{ text:'你用神力安抚它，它亲昵地蹭了蹭你的手。你收它当了神宠，它长大后将成为你的一大战力。', attack:5, defense:5, exp:300, fate:2 } },
    { text:'送它回父母身边', result:{ text:'你用神识找到了它的父母，亲自送它回去。上古神兽夫妇非常感激，给了你一片它们的鳞片作为答谢。', item:{ name:'神兽逆鳞', desc:'可抵挡一次致命攻击', effect:{ defense:10 } }, exp:200, fate:3 } }
  ]},
{ id:'god_extra_02', name:'凡间的传说', location:'神界', phase:'god', minLevel:86, weight:1, image:'assets/scenes/temple.jpg',
  text:['你用神识观察下界，发现斗罗大陆上已经有了关于你的传说和庙宇，人们把你当作神来供奉。'],
  choices:[
    { text:'降神迹回应信徒', result:{ text:'你降了一道神迹，赐福于虔诚的信徒。你的信仰之力大增，神力更加浑厚。', spiritPowerGain:20, exp:200, fate:2 } },
    { text:'默默看着，不干涉', result:{ text:'你看着自己的传说在人间流传，心中五味杂陈。你选择了沉默，不干涉凡人的信仰。', exp:50 } }
  ]},
{ id:'god_extra_03', name:'命数之眼', location:'神界·命数池', phase:'god', minLevel:90, weight:1, image:'assets/scenes/abyss_godrealm.jpg',
  text:['你在神界发现了命数池，透过池水你可以隐约看到命运的丝线——原来你与武魂的缘分早在冥冥中注定。'],
  choices:[
    { text:'看透命数，领悟命运之力', result:{ text:'你在命数池前参悟了千年，领悟了命运之力。你能看到因果，甚至能短暂窥见未来。这是至高的法则之力。', spiritPowerGain:50, attack:10, defense:10, exp:800, fate:5 } },
    { text:'不看也罢，活在当下', result:{ text:'你转身离开了命数池。天命难测，世事无常，最重要的是今生。你心境更加圆满。', fate:3, exp:200 } }
  ]}
);

// ==================== 九、冒险篇大扩充（区域/魂兽/人文/秘境/奇缘） ====================
EVENTS.push(
// ---- 冒险·各地魂兽遭遇 ----
{ id:'adv_beast_16', name:'赤火猴群', location:'火山脚下·丛林', phase:'master', minLevel:22, weight:2, image:'assets/beasts/flame_tiger.jpg',
  text:['一群赤火猴在树上跳来跳去，朝你扔燃烧的果子。它们虽然单体不强，但胜在数量多、动作灵活。'],
  choices:[
    { text:'正面冲散猴群', result:{ text:'你大喝一声冲入猴群，打散了几只猴子的阵型，但被其他猴子扔的火果子烧了好几个洞。', damage:15, exp:50, battle:'flame_tiger' } },
    { text:'绕路避开', result:{ text:'你选择绕路，虽然多走了半个时辰，但安全通过了猴群的领地。', exp:20 } },
    { text:'扔出食物示好', result:{ text:'你扔出干粮，猴群抢食之际不再攻击你。一只小猴子甚至递给你一颗火红色的果子——居然是难得的火灵果！', item:{ name:'火灵果', desc:'增加少量火属性抗性', effect:{ defense:2 } }, exp:40, fate:1 } }
  ]},
{ id:'adv_beast_17', name:'幽冥狼王', location:'星斗大森林外围·夜', phase:'master', minLevel:35, weight:2, image:'assets/beasts/nether_wolf_king.jpg',
  text:['深夜，你听到远处传来凄厉的狼嚎。月光下，一只体型巨大的幽冥狼王率领狼群出现在你面前。它的眼睛是幽绿色的，盯着你像是在看一顿美餐。'],
  choices:[
    { text:'拔剑迎战狼王', result:{ text:'你直取狼王！这是一场艰难的战斗，但如果你能战胜狼王，狼群便会散去。', battle:'nether_wolf_king', exp:200, attack:2 } },
    { text:'点火吓退狼群', result:{ text:'你迅速点起火把挥舞，狼怕火，狼群开始后退。但狼王没有走，它盯着你看了很久，最终低吼一声带着狼群离开了。', exp:80 } },
    { text:'爬到树上躲避', result:{ text:'你爬上一棵大树，狼群在下面围了半夜才散去。你在树上瑟瑟发抖了一整夜。', exp:20, damage:10 } }
  ]},
{ id:'adv_beast_18', name:'千年凤尾鸡冠蛇', location:'落日森林·沼泽边缘', phase:'master', minLevel:28, weight:2, image:'assets/beasts/black_water_dragon.jpg',
  text:['一条色彩斑斓的大蛇盘踞在水边，头顶上有一个鲜红的鸡冠状突起。它看到你后竖起身子，发出"咕咕"的威胁声。'],
  choices:[
    { text:'这是好东西！拿下它', result:{ text:'你与凤尾鸡冠蛇展开激战！它的速度极快，毒牙含有剧毒，但击败它后可以获得珍贵的蛇蜕和毒囊。', battle:'black_water_dragon', exp:180, item:{ name:'凤尾鸡冠蛇蜕', desc:'炼制解毒丹的材料', effect:{ defense:1 } } } },
    { text:'不打扰它，悄悄离开', result:{ text:'你慢慢后退，大蛇也没有追来。有时候不战才是最明智的选择。', exp:20, fate:1 } }
  ]},
{ id:'adv_beast_19', name:'麟甲兽', location:'大陆中部·岩石地带', phase:'master', minLevel:20, weight:2, image:'assets/beasts/iron_armor_bear.jpg',
  text:['一只浑身覆盖着青色鳞片的巨兽挡在路中央，它正在啃食一块矿石。麟甲兽以矿物为食，防御力极高，但动作相对迟缓。'],
  choices:[
    { text:'强攻它鳞片缝隙', result:{ text:'你绕到它侧面攻击鳞片缝隙，虽然有效但也被它的尾巴扫了一下。', damage:25, battle:'iron_armor_bear', exp:120 } },
    { text:'等它吃完再走', result:{ text:'你耐心等它吃完矿石离开，虽然浪费了不少时间，但没有受伤。', exp:20 } }
  ]},
{ id:'adv_beast_20', name:'鬼藤', location:'阴暗峡谷', phase:'master', minLevel:25, weight:2, image:'assets/beasts/thousand_eye_centipede.jpg',
  text:['峡谷中的藤蔓忽然动了起来！这是植物系魂兽"鬼藤"，它的藤蔓上长满了尖刺，会缠绕一切靠近的生物。'],
  choices:[
    { text:'用火攻！', result:{ text:'你取出火折子点燃干草，鬼藤怕火，迅速缩回了地下。你发现它的根茎处有一颗黑色珠子——鬼藤的精华！', item:{ name:'鬼藤珠', desc:'蕴含黑暗系能量', effect:{ attack:2 } }, exp:100 } },
    { text:'用剑斩断藤蔓', result:{ text:'你挥剑斩断藤蔓，但鬼藤的藤蔓太多了，你被缠住了好一会儿才挣脱出来，身上被尖刺划了好几道口子。', damage:20, exp:60 } }
  ]},
// ---- 冒险·城镇人文 ----
{ id:'adv_town_16', name:'卖花小姑娘', location:'天斗城·街头', phase:'adventure', weight:2, image:'assets/scenes/border_town.jpg',
  text:['一个衣衫褴褛的小姑娘提着花篮在街头卖花。她看到你，怯生生地走过来："大人，买朵花吧，我娘病了，需要钱买药……"'],
  choices:[
    { text:'买下所有花', result:{ text:'你买下了她所有的花，还给了她额外的金币让她给娘治病。小姑娘感动得哭了，给你磕了好几个头。', gold:-30, fate:3, exp:30 } },
    { text:'给她一些钱但不买花', result:{ text:'你给了她几个金币让她赶紧给娘买药。小姑娘千恩万谢地跑了。', gold:-10, fate:2, exp:15 } },
    { text:'不相信，走开', result:{ text:'你怀疑她是骗子，径直走开了。身后传来小姑娘低低的啜泣声。', fate:-1 } }
  ]},
{ id:'adv_town_17', name:'算命先生', location:'天斗城·街角', phase:'adventure', weight:1, image:'assets/scenes/border_town.jpg',
  text:['一个白胡子老者在街角摆摊算命，看到你后眼睛一亮："小友，我看你印堂发亮，骨骼清奇，将来必成大器！来，老夫给你算一卦？"'],
  choices:[
    { text:'花金币算一卦', result:{ text:'老者闭目掐算了一会儿，对你说："你命中有大造化，但也有大劫数。记住，水能载舟亦能覆舟，最亲近的人可能伤你最深。"你给了金币，他的话让你若有所思。', gold:-15, fate:2, exp:20 } },
    { text:'不信这些，走开', result:{ text:'你摆摆手走开了。老者在你身后叹气："信不信由你，天机已泄，好自为之。"', exp:5 } }
  ]},
{ id:'adv_town_18', name:'小偷！', location:'天斗城·集市', phase:'adventure', weight:3, image:'assets/scenes/border_town.jpg',
  text:['拥挤的集市中，你感觉腰间的钱袋动了一下——有人偷你的钱！一个瘦小的身影正往人群里钻。'],
  choices:[
    { text:'追！', result:{ text:'你施展身法追了上去，几个起落就抓住了小偷——竟是个半大孩子。你拿回了钱袋，看着他瘦弱的样子，你叹了口气，还给了他几个铜币让他去找份正经活计。', fate:1, exp:40, speed:1 } },
    { text:'大喊"抓小偷"', result:{ text:'你大喊抓小偷，附近的巡逻卫兵闻声赶来，抓住了小偷。你拿回了钱袋，卫兵表扬了你。', exp:20 } },
    { text:'算了，人太多不追了', result:{ text:'你觉得人太多追不上，放弃了。损失了一些金币，就当买个教训。', gold:-20 } }
  ]},
{ id:'adv_town_19', name:'诗会', location:'天斗城·明月楼', phase:'master', minLevel:20, weight:1, image:'assets/scenes/tavern.jpg',
  text:['明月楼正在举办诗会，文人雅士齐聚一堂。有人看到你腰上的魂师徽章，邀请你也参加。'],
  choices:[
    { text:'吟一首诗助兴', result:{ text:'你虽然是魂师，但也读过几年书。你沉吟片刻，吟了一首关于武魂修炼的诗，虽然不算文采斐然，但气势磅礴，赢得满堂喝彩！', fate:2, exp:50 } },
    { text:'婉拒，在一旁喝酒听歌', result:{ text:'你笑着拒绝了，坐在一旁喝酒听歌，享受难得的悠闲时光。', hp:20, exp:10 } }
  ]},
{ id:'adv_town_20', name:'流浪铁匠', location:'路边·破庙', phase:'adventure', weight:2, image:'assets/scenes/blacksmith.jpg',
  text:['你在一个破庙里避雨，遇到一个邋里邋遢的老铁匠。他看到你的武器后眼睛一亮："小伙子，你这兵器的打造手法不错，但还差了点火候。要不要老夫帮你重新淬淬火？"'],
  choices:[
    { text:'请他帮忙锻造', result:{ text:'老铁匠升起炉火，叮叮当当敲打了半夜。当你接过武器时，发现它比之前锋利了许多，也坚韧了许多！他不肯收钱，只说"好兵器就该配英雄"。', attack:3, exp:80, fate:1 } },
    { text:'礼貌拒绝', result:{ text:'你婉言谢绝了。老铁匠也不生气，嘿嘿一笑继续喝酒。第二天你离开时，他已经不在了，只在地上留下一块黑铁片，似乎是什么矿石。', item:{ name:'寒铁碎片', desc:'锻造材料', effect:{ attack:1 } }, exp:30 } }
  ]},
// ---- 冒险·秘境探险 ----
{ id:'adv_ruin_06', name:'地下迷宫', location:'远古遗迹·地下', phase:'master', minLevel:33, weight:2, image:'assets/scenes/abyss_godrealm.jpg',
  text:['你发现遗迹地下有一个巨大的迷宫，墙壁上刻满了看不懂的符文。迷宫深处似乎有什么东西在发光。'],
  choices:[
    { text:'深入探索', result:{ text:'你在迷宫中转了很久，差点迷路，但最终找到了一间密室，里面放着一枚储物戒指和一些记载着上古锻造术的器纹拓片！', gold:100, item:{ name:'上古器纹拓片', desc:'记载了一种失传锻造术的拓片', effect:{ spiritPowerGain:5 } }, exp:200 } },
    { text:'在入口附近看看就好', result:{ text:'你在入口附近找到了几块刻有器纹的残片，虽然不是什么珍贵东西，但也能卖些钱。', gold:30, exp:50 } },
    { text:'迷宫太危险，不进去', result:{ text:'你觉得迷宫太过危险，明智地选择了离开。', exp:10 } }
  ]},
{ id:'adv_ruin_07', name:'冰火两仪眼', location:'绝密山谷', phase:'master', minLevel:38, weight:1, image:'assets/scenes/volcano.jpg',
  text:['你发现了一个不可思议的地方——山谷中一半是炽热的泉水，一半是冰冷的寒潭，两种极端的力量在这里达到了平衡。泉眼周围长满了各种珍稀药草！'],
  choices:[
    { text:'采摘药草', result:{ text:'你小心翼翼地采摘了几株药草。这里的每一株都是外界难得一见的仙品！但你不敢多待，冰火两仪眼的极端力量让你的身体承受不住。', item:{ name:'相思断肠红', desc:'仙品药草，生死人肉白骨', effect:{ hp:50, attack:3, defense:3 } }, exp:300, damage:15 } },
    { text:'在泉眼中修炼', result:{ text:'你尝试在泉眼旁边修炼，冰火两股力量同时涌入你的身体，痛苦无比但效果惊人！你的武魂似乎受到了淬炼。', attack:2, defense:2, damage:30, exp:250, spiritPowerGain:10 } },
    { text:'记住位置，以后再来', result:{ text:'你记住了这个位置，没有贸然行动。这种天地至宝之地，需要做好万全准备才能探索。', fate:2, exp:50 } }
  ]},
{ id:'adv_ruin_08', name:'海神湖', location:'海神岛·中心', phase:'master', minLevel:40, weight:2, image:'assets/scenes/sea_god_island.jpg',
  text:['你终于来到了海神岛的中心——海神湖。湖水呈现出奇异的深蓝色，湖中央有一根金色的柱子直冲云霄。你感受到一股浩瀚的神圣力量。'],
  choices:[
    { text:'进入湖中修炼', result:{ text:'你走入湖中，海神之力温柔地包裹住你的身体。你感觉自己的灵魂都被洗涤了一遍，对水属性的感悟大大加深。', spiritPowerGain:15, defense:3, exp:250, fate:2 } },
    { text:'向海神柱祈祷', result:{ text:'你跪在湖边虔诚祈祷，海神柱微微发光，似乎在回应你。你获得了海神的祝福。', hp:50, spiritPowerGain:10, exp:150, fate:3 } }
  ]},
// ---- 冒险·特殊事件 ----
{ id:'adv_sp_11', name:'路遇劫匪', location:'荒山野岭', phase:'adventure', weight:3, image:'assets/scenes/border_town.jpg',
  text:['一伙蒙面劫匪拦住了你的去路，为首的大汉狞笑道："此路是我开，此树是我栽，要想从此过，留下买路财！"'],
  choices:[
    { text:'直接动手！', result:{ text:'你拔剑就上！劫匪们虽然人多，但都是些三脚猫功夫，你三两下就把他们打跑了，还缴获了他们抢来的财物。', gold:50, exp:80, attack:1 } },
    { text:'交出财物保命', result:{ text:'你不想惹麻烦，交出了一些金币。劫匪放你过去了，但你心里很不爽。', gold:-30 } },
    { text:'亮明魂师身份', result:{ text:'你释放出武魂的威压，劫匪们脸色大变——他们没想到你是魂师！纷纷跪地求饶，你训斥了他们一顿让他们滚蛋。', fate:1, exp:40 } }
  ]},
{ id:'adv_sp_12', name:'山洪暴发', location:'山区·暴雨', phase:'adventure', minLevel:15, weight:2, image:'assets/scenes/mountain_path.jpg',
  text:['连日暴雨引发了山洪！浑浊的洪水从山上倾泻而下，你听到不远处有人在呼救——一个猎户的孩子被困在洪水中的一棵树上。'],
  choices:[
    { text:'冒险救人', result:{ text:'你不顾危险冲入洪水中，艰难地游到树边救下了孩子。猎户感激涕零，一定要把家传的一块玉佩送给你。', damage:20, item:{ name:'护身符玉佩', desc:'据说能辟邪', effect:{ fate:2, defense:1 } }, exp:100, fate:2 } },
    { text:'洪水太急，不敢下水', result:{ text:'你试图救但洪水太急，你无法靠近。你只能眼睁睁看着孩子被冲走……这件事让你久久不能释怀。', fate:-2 } }
  ]},
{ id:'adv_sp_13', name:'流星雨', location:'野外·夜晚', phase:'adventure', weight:1, image:'assets/scenes/abyss_godrealm.jpg',
  text:['夜晚露宿野外时，你看到一场壮观的流星雨。无数流星划过天际，其中一颗似乎朝着你的方向坠落！'],
  choices:[
    { text:'去寻找陨石', result:{ text:'你循着方向找到了那颗陨石，它还在发烫，核心处有一块奇异的金属——陨铁！这是打造顶级兵器的材料！', item:{ name:'陨铁', desc:'天外奇金，锻造圣品', effect:{ attack:5 } }, exp:150 } },
    { text:'对着流星许愿', result:{ text:'你闭上眼睛许了一个愿望。流星划过天际，你觉得心情格外舒畅，魂力似乎也流畅了几分。', spiritPowerGain:5, fate:1, exp:30 } }
  ]},
{ id:'adv_sp_14', name:'商队护卫', location:'天斗帝国·商道', phase:'adventure', minLevel:18, weight:2, image:'assets/scenes/border_town.jpg',
  text:['一支商队的老板认出你是魂师，愿意出高价请你护送他们穿过一段不太平的山路。'],
  choices:[
    { text:'接受委托', result:{ text:'你护送商队走了三天，路上遇到了两拨山贼和一只魂兽，都被你击退了。商队老板非常满意，给了你丰厚的报酬。', gold:80, exp:120 } },
    { text:'拒绝，继续自己的路', result:{ text:'你拒绝了委托，继续自己的旅程。商队老板有些失望，但还是祝你一路平安。', exp:10 } }
  ]},
{ id:'adv_sp_15', name:'武魂殿的招揽', location:'武魂殿·分殿', phase:'master', minLevel:30, weight:2, image:'assets/scenes/temple.jpg',
  text:['武魂殿分殿的执事找到了你，态度客气但语气傲慢："你的天赋不错，加入武魂殿吧，我们能给你提供最好的修炼资源和最广阔的平台。"'],
  choices:[
    { text:'拒绝武魂殿', result:{ text:'你婉言拒绝了。执事的脸色冷了下来："年轻人，别不识抬举。武魂殿想招揽的人，还没有能拒绝第二次的。"你感到了一丝威胁。', fate:1, exp:50 } },
    { text:'假意应付，不明确表态', result:{ text:'你不卑不亢地表示需要考虑。执事哼了一声，给了你一枚令牌让你想通了去找他。你收好令牌，心里有自己的打算。', item:{ name:'武魂殿令牌', desc:'可以出入武魂殿分殿', effect:{} }, exp:30 } }
  ]}
);

// ==================== 十、封号篇大扩充 ====================
EVENTS.push(
{ id:'ma_big_11', name:'帝国册封', location:'天斗帝国·皇宫', phase:'god', minLevel:50, weight:2, image:'assets/scenes/wuhun_city.jpg',
  text:['天斗帝国皇帝亲自召见你，册封你为帝国的护国魂师，赏赐了大量财宝和一座府邸。这是极高的荣誉，但也意味着你要为帝国效力。'],
  choices:[
    { text:'接受册封', result:{ text:'你接受了册封，成为帝国的护国魂师。皇帝大喜，赐你金甲和府邸。从此你在帝国境内可以畅通无阻。', gold:500, item:{ name:'帝国护国金牌', desc:'身份象征，见牌如见帝', effect:{ defense:2, fate:2 } }, exp:300, fate:2 } },
    { text:'婉拒，闲云野鹤更适合我', result:{ text:'你婉拒了册封，表示自己更愿意逍遥自在。皇帝虽然遗憾，但也欣赏你的风骨，没有勉强，仍赐了你不少财物。', gold:200, exp:150, fate:1 } }
  ]},
{ id:'ma_big_12', name:'自创魂技', location:'闭关修炼', phase:'god', minLevel:55, weight:2, image:'assets/scenes/training_ground.jpg',
  text:['修炼中你突然灵光一闪——为什么一定要依赖魂环赋予的魂技？你能不能创造属于自己的魂技？'],
  choices:[
    { text:'花时间钻研，尝试自创', result:{ text:'你花费了大量时间和精力，经历了无数次失败，终于创造出了属于自己的第一式自创魂技！这是魂师境界的一大突破！', spiritPowerGain:20, attack:5, exp:500, fate:2 } },
    { text:'太耗费时间，放弃', result:{ text:'你觉得自创魂技太过耗费时间，还是按部就班修炼比较稳妥。你放弃了这个念头。', exp:50 } }
  ]},
{ id:'ma_big_13', name:'十万年魂兽的诱惑', location:'星斗大森林深处·核心区', phase:'god', minLevel:75, weight:2, image:'assets/beasts/titan_giant_ape_king.jpg',
  text:['你遇到了一头十万年魂兽——它竟然口吐人言："人类魂师，我知道你在寻找魂环。我可以把族群的材料交给你，但正式魂环必须通过魂环猎取节点完成。"'],
  choices:[
    { text:'答应条件，换取魂兽材料', result:{ text:'十万年魂兽把一枚珍贵材料交给你。你没有吸收魂环，只记录了这份承诺；正式魂环仍需在魂环猎取节点完成。', item:{ name:'十万年魂兽鳞片', desc:'蕴含强大生命力的稀有材料', effect:{ hp:50 } }, attack:3, defense:3, spiritPowerGain:10, exp:300, fate:3 } },
    { text:'拒绝交换，保持距离', result:{ text:'你拒绝了交换，选择先离开核心区。十万年魂兽看着你，眼中闪过一丝敬意，转身回到族群中。', fate:2, exp:200 } }
  ]},
{ id:'ma_big_14', name:'武魂殿的暗杀', location:'任意', phase:'god', minLevel:90, weight:2, image:'assets/scenes/swamp.jpg',
  text:['你被武魂殿的刺客盯上了！三名封号斗罗级别的邪魂师在你修炼的关键时刻偷袭了你！'],
  choices:[
    { text:'拼死反击！', result:{ text:'你以一敌三，身受重伤但成功击杀一人、击退两人！这场战斗虽然凶险，但也让你在生死之间有所突破。', damage:60, battle:'evil_master', exp:400, attack:3, defense:2 } },
    { text:'用底牌逃生', result:{ text:'你用出了压箱底的逃生手段，虽然受了重伤，但成功逃脱了。武魂殿已经把你列为必杀目标，你需要更加小心了。', damage:40, exp:150 } }
  ]},
{ id:'ma_big_15', name:'建立自己的势力', location:'自己选的地方', phase:'god', minLevel:58, weight:1, image:'assets/scenes/wuhun_city.jpg',
  text:['以你现在的实力和声望，完全可以建立自己的宗门或者势力。你考虑这件事很久了。'],
  choices:[
    { text:'建立宗门，收徒传艺', result:{ text:'你建立了自己的宗门，开始收徒传艺。你的名声吸引了不少年轻魂师前来投奔，你的势力逐渐壮大。', gold:-200, fate:3, exp:250 } },
    { text:'不建势力，独自一人更自在', result:{ text:'你觉得建立势力太麻烦，还是一个人逍遥自在。你继续你的修炼之旅。', exp:50 } }
  ]},
{ id:'ma_big_16', name:'神考的预感', location:'修炼中', phase:'god', minLevel:99, weight:2, image:'assets/scenes/temple.jpg',
  text:['你在冥想中看到了一个模糊的身影，他对你说："你的修炼已经到了99级封号斗罗的极限，是否愿意接受神的考验，追求那更高的境界？"'],
  choices:[
    { text:'我愿意！请给我神考！', result:{ text:'你坚定地回答愿意。那个身影点了点头，告诉你去寻找属于你的神位传承之地。你感到一股强大的力量在召唤你。', spiritPowerGain:15, fate:3, exp:400 } },
    { text:'我还需要准备', result:{ text:'你觉得自己还没有准备好。身影没有勉强，告诉你等你准备好了，神考自然会降临。', exp:100, fate:1 } }
  ]},
{ id:'ma_daily_01', name:'指点晚辈', location:'史莱克学院/自己宗门', phase:'god', minLevel:50, weight:2, image:'assets/scenes/academy_classroom.jpg',
  text:['几个晚辈魂师向你请教修炼上的问题，他们看着你的眼神充满了崇拜。'],
  choices:[
    { text:'耐心指点', result:{ text:'你耐心地解答了他们的问题，还演示了几式基础功法。晚辈们茅塞顿开，对你感激不尽。你在指点他们的过程中，自己对修炼也有了新的感悟。', exp:80, fate:1 } },
    { text:'让他们自己悟', result:{ text:'你说"修炼靠自己悟"，让他们自己去体会。晚辈们有些失望，但也只能自己去琢磨了。', exp:20 } }
  ]},
{ id:'ma_daily_02', name:'老友来访', location:'你的住处', phase:'master', weight:2, image:'assets/scenes/tavern.jpg',
  text:['多年不见的老友突然来访，你们一起喝酒叙旧，谈起当年在学院的日子，感慨万千。'],
  choices:[
    { text:'大醉一场', result:{ text:'你们喝了一整夜的酒，聊了一整夜的往事。第二天虽然宿醉头痛，但心情无比畅快。', damage:10, fate:1, exp:30 } },
    { text:'切磋一局', result:{ text:'酒过三巡，你们兴致来了切磋了一场。点到为止，不分胜负，但都觉得酣畅淋漓。', attack:1, exp:60 } }
  ]},
{ id:'ma_daily_03', name:'丹药炼成', location:'炼丹房', phase:'god', minLevel:52, weight:2, image:'assets/scenes/blacksmith.jpg',
  text:['你花费了七七四十九天，终于炼成了一炉高阶丹药！'],
  choices:[
    { text:'自己服用提升修为', result:{ text:'你服用了丹药，魂力大增，修为再进一步！', spiritPowerGain:15, exp:200 } },
    { text:'留给弟子/后人', result:{ text:'你把丹药收好，留给将来有需要的弟子或后人。', fate:1, exp:50 } },
    { text:'拿去拍卖', result:{ text:'你把丹药送到拍卖场，卖了个好价钱。', gold:300, exp:50 } }
  ]},
{ id:'ma_daily_04', name:'境界瓶颈', location:'闭关', phase:'god', minLevel:55, weight:3, image:'assets/scenes/snow_mountain.jpg',
  text:['你遇到了修炼的瓶颈，无论怎么努力，魂力都停滞不前。你感到焦虑和烦躁。'],
  choices:[
    { text:'出去走走，放松心境', result:{ text:'你放下修炼出去游历，在山水之间感悟自然。几个月后你心境突破，瓶颈自然松动了。', hp:30, fate:1, exp:150 } },
    { text:'强行冲击瓶颈', result:{ text:'你选择强行冲击瓶颈，过程痛苦不堪，还受了内伤，但最终成功突破了！', damage:30, spiritPowerGain:10, exp:250 } },
    { text:'找人请教', result:{ text:'你去找其他封号斗罗请教，他们给了你不少有用的建议，瓶颈终于有了松动的迹象。', gold:-100, exp:100 } }
  ]},
{ id:'ma_daily_05', name:'邪魂师作乱', location:'某城镇', phase:'god', minLevel:52, weight:3, image:'assets/scenes/swamp.jpg',
  text:['你路过一个城镇，发现这里的居民被邪魂师祸害得不轻——邪魂师用邪术吸取活人的魂力修炼，整个城镇死气沉沉。'],
  choices:[
    { text:'出手铲除邪魂师！', result:{ text:'你找到了邪魂师的巢穴，经过一场恶战将其铲除！城镇居民感恩戴德，为你立了生祠。', damage:25, battle:'evil_master', exp:300, fate:3 } },
    { text:'这不是我的事', result:{ text:'你选择不管闲事，径直离开了。身后是居民绝望的眼神。', fate:-3 } }
  ]},
{ id:'ma_daily_06', name:'海神岛的邀请', location:'海神岛', phase:'god', minLevel:62, weight:2, image:'assets/scenes/sea_god_island.jpg',
  text:['海神岛的大祭司派人来邀请你前往海神岛，说你与海神有缘。'],
  choices:[
    { text:'应邀前往', result:{ text:'你来到海神岛，大祭司亲自接待了你。她告诉你，你有接受海神九考的资质，这是成神的契机！', spiritPowerGain:20, exp:400, fate:3 } },
    { text:'暂时不去', result:{ text:'你表示还有事情需要处理，处理完后再去。大祭司理解，给了你一枚海神令，让你随时可以来。', item:{ name:'海神令', desc:'海神岛通行证', effect:{} }, exp:50 } }
  ]},
{ id:'ma_daily_07', name:'传功', location:'你的修炼室', phase:'god', minLevel:60, weight:2, image:'assets/scenes/academy_classroom.jpg',
  text:['你的大弟子是个可塑之才，但最近修炼遇到了困难。你考虑是否要耗费自己的修为为他传功打通经脉。'],
  choices:[
    { text:'为弟子传功', result:{ text:'你耗费了自己大量修为为弟子打通经脉，他的修炼之路从此一片坦途。你的修为虽然暂时下降，但心境圆满，反而有所收获。', spiritPowerGain:-10, fate:2, exp:200 } },
    { text:'让他自己突破', result:{ text:'你没有传功，而是给了他一本秘籍让他自己参悟。修炼之路终究要靠自己走。', exp:50 } }
  ]},
{ id:'ma_daily_08', name:'百级大关', location:'天劫降临', phase:'god', minLevel:99, maxLevel:99, weight:3, unique:true, image:'assets/scenes/abyss_godrealm.jpg',
  text:['你终于到了99级极限斗罗的境界，距离百级成神只有一步之遥。但这一步是天堑——你需要渡过神劫！'],
  choices:[
    { text:'直面神劫！', result:{ text:'天劫降临，九道天雷劈下！你以凡人之躯硬抗天神之威，经历了难以想象的痛苦……最后一道天雷消散时，你感到自己的身体发生了本质的变化——你触碰到了神的门槛！', damage:80, spiritPowerGain:50, exp:1000, attack:5, defense:5, fate:5 } },
    { text:'再准备准备', result:{ text:'你觉得时机未到，强行压下了突破的冲动。神劫散去，你知道自己需要更多的准备。', exp:100 } }
  ]}
);

// ==================== 十一、成神篇大扩充 ====================
EVENTS.push(
{ id:'god_big_09', name:'神位选择', location:'神界·传承之地', phase:'god', minLevel:82, weight:3, image:'assets/scenes/temple.jpg',
  text:['你来到了神位传承之地，这里有多个神位等待传承——善良之神、邪恶之神、修罗神、海神、天使之神、罗刹神……你需要选择自己的道路。'],
  choices:[
    { text:'选择海神（善良正义）', result:{ text:'你选择了海神之位，浩瀚的海神之力涌入你的身体！你成为了新一代的海神，掌控水之法则。', spiritPowerGain:100, attack:10, defense:10, hp:200, exp:1500, fate:5 } },
    { text:'选择修罗神（审判杀伐）', result:{ text:'你选择了修罗神之位，血色的修罗之力充满全身！你成为了修罗神，掌审判杀伐之权。', spiritPowerGain:100, attack:15, defense:5, hp:150, exp:1500, fate:3 } },
    { text:'选择天使之神（光明神圣）', result:{ text:'你选择了天使之神位，神圣的光明之力洗礼全身！你成为了天使之神，掌光明神圣之力。', spiritPowerGain:100, attack:8, defense:12, hp:180, exp:1500, fate:5 } }
  ]},
{ id:'god_big_10', name:'神界第一次会议', location:'神界·神殿', phase:'god', minLevel:85, weight:2, image:'assets/scenes/temple.jpg',
  text:['你作为新晋神祇参加了神界委员会的会议。其他神祇们看着你这个新面孔，表情各异。'],
  choices:[
    { text:'谦逊有礼，多听少说', result:{ text:'你保持谦逊的态度，认真听取其他神祇的发言。几位老神祇对你印象不错。', fate:3, exp:200 } },
    { text:'积极发言，展现自己', result:{ text:'你在会议上积极发言，提出了自己对神界管理的看法。有的神祇欣赏你的锐气，有的觉得你太年轻气盛。', fate:1, exp:300 } }
  ]},
{ id:'god_big_11', name:'下界的牵挂', location:'神界·望乡台', phase:'god', minLevel:85, weight:2, image:'assets/scenes/forest_outer.jpg',
  text:['你站在神界的望乡台上，俯瞰斗罗大陆。你看到了你的宗门、你的弟子、你的朋友……他们正在慢慢老去，而你已经拥有了永恒的生命。'],
  choices:[
    { text:'赐福于他们', result:{ text:'你用神力赐福于你的宗门和后人，保护他们平安昌盛。虽然你不能再常伴他们左右，但你的祝福会一直守护着他们。', fate:3, exp:200 } },
    { text:'放下牵挂，专心神位', result:{ text:'你知道神不能有太多凡俗的牵挂。你深吸一口气，转身离开了望乡台，将感情深埋心底。', exp:100 } }
  ]},
{ id:'god_big_12', name: '空间风暴·神劫', location:'虚空', phase:'god', minLevel:88, weight:2, image:'assets/scenes/abyss_godrealm.jpg',
  text:['你在巡游世界之时遭遇了罕见的空间风暴！狂暴的空间之力撕扯着你的神体，你被卷入了一个未知的空间裂缝。'],
  choices:[
    { text:'以神力强行破开乱流', result:{ text:'你凝聚全部神力强行轰击风暴，虽然成功脱困，但神力消耗巨大，还受了不轻的神伤。', damage:100, spiritPowerGain:-50, exp:500 } },
    { text:'顺流而行，寻找出口', result:{ text:'你放弃抵抗，顺着空间风暴漂流，最终被抛到了大陆之外的一处秘境——这里的灵气浓度远超斗罗大陆任何地方！', exp:400, fate:1 } }
  ]},
{ id:'god_big_13', name:'邪神入侵', location:'神界·边界', phase:'god', minLevel:90, weight:3, image:'assets/scenes/swamp.jpg',
  text:['自深渊而出的邪神率领魔物大军进犯神界！神界委员会发出紧急召集令，所有神祇必须参战！'],
  choices:[
    { text:'冲锋在前，斩杀邪神！', result:{ text:'你身先士卒冲入敌阵，与邪神展开惊天动地的大战！你斩杀了三名下位邪神和无数深渊生物，立下赫赫战功！', damage:80, battle:'abyss_lord', exp:1000, attack:5, fate:5 } },
    { text:'守护后方，救治伤神', result:{ text:'你选择在后方用神力救治受伤的神祇，你的治愈神力挽救了许多神祇的性命。大家都很感激你。', damage:30, fate:3, exp:600, defense:3 } }
  ]},
{ id:'god_big_14', name:'神位传承', location:'你的神殿', phase:'god', minLevel:92, weight:1, image:'assets/scenes/temple.jpg',
  text:['你感到自己在神位上的时间已经很久了。或许，是时候寻找一位传承者，让神位在新的血脉中延续下去了。'],
  choices:[
    { text:'回到斗罗大陆寻找传承者', result:{ text:'你回到斗罗大陆，花了数十年时间寻找合适的传承者，最终找到了一个天赋异禀、心性纯良的孩子，将神位传承给了他。你感到无比释然。', fate:5, exp:800 } },
    { text:'还太早，继续守护', result:{ text:'你觉得现在还不是退下来的时候，神界还有很多需要你的地方。你继续坚守神位。', exp:100 } }
  ]},
{ id:'god_big_15', name:'创世的秘密', location:'神界·禁地', phase:'god', minLevel:95, weight:2, image:'assets/scenes/abyss_godrealm.jpg',
  text:['你在神界禁地中发现了一个惊天秘密——在神界最深处，沉睡着开天辟地时残留的创世之力，那是比任何神位都要古老的根源。'],
  choices:[
    { text:'探索创世之力', result:{ text:'你花费千年时间参悟创世之力，最终触摸到了造物的真谛。你的神力达到了神王级别，能够开辟属于自己的小世界！', spiritPowerGain:200, attack:20, defense:20, hp:500, exp:2000, fate:10 } },
    { text:'这种力量不该被触碰', result:{ text:'你觉得创世之力太过危险，一旦失控可能毁灭一切。你封锁了禁地，不让任何人再接近。', fate:3, exp:300 } }
  ]},
{ id:'god_daily_01', name:'神的日常', location:'神界', phase:'god', minLevel:83, weight:2, image:'assets/scenes/temple.jpg',
  text:['成为神之后，日子反而变得悠闲起来。你在自己的神殿中，享受着永恒的时光。'],
  choices:[
    { text:'修炼，追求更高境界', result:{ text:'你没有因为成为神就懈怠，继续修炼追求更高的境界。你的神力越来越浑厚。', spiritPowerGain:20, exp:200 } },
    { text:'在神界花园散步', result:{ text:'你在神界的花园中漫步，奇花异草美不胜收。你感到心境平和。', hp:50, fate:1, exp:50 } },
    { text:'观察下界', result:{ text:'你用神识观察斗罗大陆，看着人间百态，感慨万千。', exp:80 } }
  ]},
{ id:'god_daily_02', name:'神之间的切磋', location:'神界·比武场', phase:'god', minLevel:85, weight:2, image:'assets/scenes/arena.jpg',
  text:['另一位神祇邀请你切磋。神之间的比武不会真正受伤，但可以检验彼此的实力。'],
  choices:[
    { text:'全力以赴', result:{ text:'你全力以赴，与那位神祇打得天昏地暗。最终你惜败一招，但从中领悟到了不少新东西。', attack:2, defense:2, exp:300 } },
    { text:'点到为止', result:{ text:'你们点到为止，交流了一些对神力运用的心得。双方都有所收获。', exp:150 } }
  ]},
{ id:'god_daily_03', name:'信徒的祈祷', location:'你的神殿', phase:'god', minLevel:85, weight:2, image:'assets/scenes/temple.jpg',
  text:['你听到了下界信徒的祈祷——一个虔诚的信徒在向你祈求，他的家人得了重病，无药可医。'],
  choices:[
    { text:'降下神恩，治愈他的家人', result:{ text:'你降下一道神光，治愈了他的家人。信徒一家感恩戴德，你的信仰之力也因此增强了几分。', fate:2, exp:100, spiritPowerGain:5 } },
    { text:'神不干涉凡人命运', result:{ text:'你选择了沉默。生老病死是凡人的宿命，神不应该随意干涉。', exp:20 } }
  ]},
{ id:'god_daily_04', name:'上古神兽', location:'神界·禁地', phase:'god', minLevel:88, weight:1, image:'assets/beasts/deep_sea_demon_whale_king.jpg',
  text:['你在神界禁地遇到了一只上古神兽——它是开天辟地之初就存在的生灵，比大多数神祇都要古老。它看了你一眼，开口说话了。'],
  choices:[
    { text:'恭敬请教', result:{ text:'你恭敬地向它请教修炼和天地的至理。上古神兽给你讲了三天三夜的道，你获益良多，对法则的理解更上一层楼。', spiritPowerGain:30, exp:500, fate:2 } },
    { text:'静静离开', result:{ text:'你不敢打扰这位古老的存在，悄悄退了出去。', exp:50 } }
  ]},
{ id:'god_daily_05', name:'诸神黄昏的预言', location:'神界·预言池', phase:'god', minLevel:93, weight:2, image:'assets/scenes/abyss_godrealm.jpg',
  text:['预言池中出现了一幅恐怖的画面——诸神黄昏，神界崩塌，所有神祇都将陨落。这是未来的预兆吗？'],
  choices:[
    { text:'告诉其他神祇，共同应对', result:{ text:'你把预言告诉了神界委员会，众神开始商议对策。虽然有些神祇不以为然，但你知道这一天可能真的会到来。', fate:3, exp:300 } },
    { text:'这只是预言，不必当真', result:{ text:'你觉得预言不一定会成真，没有放在心上。', exp:50 } },
    { text:'独自寻找破局之法', result:{ text:'你开始暗中寻找破解诸神黄昏的方法，独自承担这份压力。', exp:400, fate:1 } }
  ]},
{ id:'god_daily_06', name:'超越神的境界', location:'混沌之中', phase:'god', minLevel:98, weight:3, image:'assets/scenes/abyss_godrealm.jpg',
  text:['你站在了神的巅峰，再往前一步，就是连神都无法触及的领域——那是造物的层次，是规则本身。你是否愿意踏出这一步？'],
  choices:[
    { text:'踏出最后一步！', result:{ text:'你纵身跃入混沌之中，身体在无尽的法则之力中瓦解又重组。当你再次睁开眼时，你已经超越了神——你成为了规则的一部分，与天地同寿，与日月同辉。你的传说，将永远流传。', attack:50, defense:50, hp:1000, spiritPowerGain:500, exp:5000, fate:10 } },
    { text:'满足于现在，不再追求', result:{ text:'你觉得现在已经足够了。你选择了停留在神的巅峰，守护你珍视的一切，直到永恒。', exp:500, fate:2 } }
  ]}
);

// ==================== 四、学院篇继续扩充（更多日常/修炼/社交/随机） ====================
EVENTS.push(
{ id:'ac_more_01', name:'清晨挑水', location:'史莱克学院·后院', phase:'academy', weight:2, image:'assets/scenes/dormitory.jpg',
  text:['大师要求你们每天挑满十缸水才能吃早饭。你挑着两个大木桶，步履蹒跚。'],
  choices:[
    { text:'咬牙坚持挑完', result:{ text:'你挑了一个时辰，肩膀磨出了红痕，但十缸水满满当当。大师说："修炼先练筋骨。"你觉得手臂上多了几分力气。', attack:1, exp:20, damage:5 } },
    { text:'用魂力辅助', result:{ text:'你偷偷运转魂力减轻重量，轻松完成了任务。不过被大师发现了，他罚你明天挑二十缸。', exp:10, fate:-1 } },
    { text:'和同学合作', result:{ text:'你和同学分工合作，一人挑半程，效率翻倍。大师看到了没说什么，但第二天教了你们一套配合发力的技巧。', defense:1, exp:25, fate:1 } }
  ]},
{ id:'ac_more_02', name:'梅花桩', location:'史莱克学院·练功场', phase:'academy', weight:2, image:'assets/scenes/training_ground.jpg',
  text:['今天的训练是在三十六根梅花桩上扎马步一个时辰。桩子又细又滑，你站上去腿就开始抖。'],
  choices:[
    { text:'坚持到最后！', result:{ text:'你双腿颤抖得像筛糠，但硬是撑过了一个时辰。下桩时你差点跪地上，但下盘稳了不少。', defense:2, exp:30, damage:10 } },
    { text:'摔下来再爬上去', result:{ text:'你摔下来十几次，每次都咬着牙爬回去。虽然最后没撑满一个时辰，但大师说你的韧性让他印象深刻。', exp:25, fate:1 } },
    { text:'偷瞄别人怎么站', result:{ text:'你观察学得快的同学，发现了呼吸和重心的诀窍，很快就站稳了。', speed:1, exp:20 } }
  ]},
{ id:'ac_more_03', name:'纸鹤传信', location:'史莱克学院·教室', phase:'academy', weight:1, image:'assets/scenes/academy_classroom.jpg',
  text:['课堂上一只纸鹤飞到你桌上，上面写着："下课后山老地方见——"没有署名。'],
  choices:[
    { text:'去看看是谁', result:{ text:'你去了后山，发现是同班的一个女同学/男同学红着脸在等你，想请教你一道修炼题。你们聊了很久，成了朋友。', fate:2, exp:20 } },
    { text:'交给大师', result:{ text:'你把纸鹤交给了大师。大师看了看说："是有人想和你交朋友，不必紧张。"他鼓励你多和同学交流。', exp:15 } },
    { text:'不去，可能是恶作剧', result:{ text:'你没去。第二天那个同学看到你眼神有点躲闪。你心里有点过意不去。', exp:5 } }
  ]},
{ id:'ac_more_04', name:'放风筝', location:'学院·草坪', phase:'academy', weight:1, image:'assets/scenes/mountain_path.jpg',
  text:['春风和煦，你看到几个同学在草坪上放风筝。一只画着{spirit}图案的风筝飞得最高。'],
  choices:[
    { text:'加入他们一起玩', result:{ text:'你和大家一起放风筝，跑了一下午，笑得肚子都疼了。这是难得的放松时光。', hp:20, fate:1, exp:10 } },
    { text:'在旁边看书', result:{ text:'你坐在草坪边看书，偶尔抬头看看风筝。虽然没加入他们，但春风拂面的感觉也很好。', spiritPowerGain:1, exp:15 } }
  ]},
{ id:'ac_more_05', name:'蚊子袭击', location:'史莱克学院·宿舍', phase:'academy', weight:2, image:'assets/scenes/dormitory.jpg',
  text:['夏天的晚上，宿舍里蚊子成群，你被咬得翻来覆去睡不着。'],
  choices:[
    { text:'用魂力震开蚊子', result:{ text:'你运转魂力在周身形成一层微弱的屏障，蚊子果然近不了身。不过魂力消耗不小，第二天起来有点困。', mp:-15, defense:1, exp:15 } },
    { text:'裹紧被子忍一夜', result:{ text:'你把自己裹成粽子，只露出鼻孔。虽然热了点，但总算没被咬多少。', damage:5, exp:5 } },
    { text:'起来打蚊子', result:{ text:'你爬起来和蚊子大战三百回合，最后拍死了十几只，自己也累得够呛。不过宿舍其他人都感激你。', fate:1, exp:10 } }
  ]},
{ id:'ac_more_06', name:'鸟窝', location:'史莱克学院·古树', phase:'academy', weight:1, image:'assets/scenes/forest_outer.jpg',
  text:['你发现老槐树上有一个鸟窝，几只幼鸟在叽叽喳喳叫，却不见大鸟回来。树下，一只野猫正虎视眈眈地往上爬。'],
  choices:[
    { text:'赶走野猫，保护幼鸟', result:{ text:'你捡起树枝赶走野猫，还在树下守了半个时辰。大鸟回来后冲你叫了几声，像是在道谢。', fate:2, exp:20 } },
    { text:'爬上去看看', result:{ text:'你爬上去看幼鸟，不小心碰掉了一只！你慌忙接住它，小心翼翼放回去。虽然惊险，但幼鸟没事。', speed:1, exp:15 } },
    { text:'物竞天择，不管', result:{ text:'你转身走了。但幼鸟的叫声在你耳边挥之不去，你修炼时总静不下心。', exp:5, fate:-1 } }
  ]},
{ id:'ac_more_07', name:'大扫除', location:'史莱克学院·教室', phase:'academy', weight:2, image:'assets/scenes/academy_classroom.jpg',
  text:['今天轮到你们小组打扫教室。灰尘漫天，大家都不太情愿。'],
  choices:[
    { text:'带头干最脏的活', result:{ text:'你主动擦窗户、扫角落，同学们看你这么卖力也都认真起来。教室打扫得一尘不染，你们组被评为最优。', fate:2, exp:20 } },
    { text:'随便扫扫应付', result:{ text:'你马马虎虎扫了两下就想溜，被组长抓了个正着，被罚重新打扫一遍。', exp:5 } },
    { text:'发现暗格！', result:{ text:'你在搬书柜时发现墙上有个暗格，里面藏着一届学长留下的小抄和一张加油字条。你把字条留作纪念，小抄交给了大师。', fate:1, exp:25 } }
  ]},
{ id:'ac_more_08', name:'梦话', location:'史莱克学院·宿舍', phase:'academy', weight:1, image:'assets/scenes/dormitory.jpg',
  text:['第二天起床，室友们都笑着看你："昨晚你说梦话了，一直在喊我要成为封号斗罗！"'],
  choices:[
    { text:'脸红了，但承认', result:{ text:'你红着脸承认了。室友们拍拍你："我们相信你！"那一刻你觉得心里暖暖的。', fate:2, exp:15 } },
    { text:'死不承认', result:{ text:'你坚决不承认，但大家笑得更厉害了。虽然有点尴尬，但宿舍气氛变得更融洽了。', exp:10 } },
    { text:'那又怎样，我一定会做到！', result:{ text:'你昂首挺胸地说："我说的是真心话！"室友们先是一愣，然后纷纷给你鼓掌。', spiritPowerGain:2, fate:1, exp:20 } }
  ]},
{ id:'ac_more_09', name:'丢了钱包', location:'学院旁·小镇', phase:'academy', weight:2, image:'assets/scenes/border_town.jpg',
  text:['你在镇上买东西时发现钱包丢了，这个月的生活费全在里面！'],
  choices:[
    { text:'原路仔细寻找', result:{ text:'你沿着走过的路仔细寻找，最后在一个卖菜大娘的摊位上找到了——大娘捡到后一直在等失主。你感激不尽。', fate:2, exp:20 } },
    { text:'向同学借钱度日', result:{ text:'你向同学借了点钱撑到下个月，虽然紧巴巴的，但好歹没饿肚子。这个教训让你以后更小心了。', exp:10 } },
    { text:'打工赚钱', result:{ text:'你去食堂帮工洗了一周碗，赚回了生活费。虽然累，但你第一次体会到赚钱的不易。', gold:30, exp:25, fate:1 } }
  ]},
{ id:'ac_more_10', name:'比武招亲？', location:'学院旁·小镇', phase:'academy', weight:1, image:'assets/scenes/arena.jpg',
  text:['镇上搭了个擂台，一个员外摆下"比武招亲"的擂台，为女儿招婿。奖品很丰厚——百金加一柄好剑！'],
  choices:[
    { text:'上台试试！', cond:{attack:12}, result:{ text:'你连胜三人打进决赛，但看到员外女儿后你礼貌地表示自己志在修炼，无意婚配。员外欣赏你的坦诚，还是给了你一半赏钱。', gold:50, exp:30, fate:1 } },
    { text:'围观吃瓜', result:{ text:'你在台下看了一下午热闹，各种精彩的打斗让你学到了不少实战技巧。', attack:1, exp:20 } },
    { text:'这种招亲不靠谱，走吧', result:{ text:'你觉得这种招亲太草率，转身离开了。后来听说台上那个"小姐"其实是员外的儿子扮的，为了骗报名费。你庆幸自己没上去。', fate:1, exp:15 } }
  ]},
{ id:'ac_more_11', name:'给家里写信', location:'史莱克学院·宿舍', phase:'academy', weight:2, image:'assets/scenes/dormitory.jpg',
  text:['又到了给家里写信的日子。你铺开信纸，却不知道该写什么。'],
  choices:[
    { text:'报喜不报忧', result:{ text:'你写了自己在学院的进步和开心事，把辛苦和委屈都藏了起来。写完你觉得自己长大了。', spiritPowerGain:1, fate:1, exp:10 } },
    { text:'如实倾诉', result:{ text:'你把训练的辛苦、想家的心情都写了进去。寄出去后你心里轻松了很多。很快收到回信，家人说为你骄傲。', hp:20, fate:2, exp:15 } },
    { text:'寄点礼物回去', cond:{gold:20}, cost:{gold:20}, result:{ text:'你买了些学院特产和一封家书一起寄回去。想象家人收到包裹时的表情，你笑得合不拢嘴。', fate:3, exp:15 } }
  ]},
{ id:'ac_more_12', name:'做了好事不留名', location:'学院旁·小镇', phase:'academy', weight:1, image:'assets/scenes/border_town.jpg',
  text:['你看到一辆满载货物的马车在上坡时马匹受惊，车夫控制不住，马车就要翻了！'],
  choices:[
    { text:'冲上去拉住马匹！', cond:{attack:14}, result:{ text:'你冲上去死死拉住缰绳，用{spirit}的力量稳住了马匹。车夫感激涕零，要给你酬金，你摆摆手跑了。', fate:3, exp:30, damage:10 } },
    { text:'喊人帮忙', result:{ text:'你大声呼救，几个路过的壮汉一起帮忙稳住了马车。车夫向所有人道谢。', fate:1, exp:15 } },
    { text:'躲开，别被撞上', result:{ text:'你闪到一边，马车翻了，货物撒了一地。车夫坐在地上叹气。你心里有点不是滋味。', exp:5, fate:-1 } }
  ]},
{ id:'ac_more_13', name:'奇怪的石头', location:'史莱克学院·后山', phase:'academy', weight:2, image:'assets/scenes/mountain_path.jpg',
  text:['你在后山修炼时捡到一块奇怪的石头，通体洁白，握在手里暖暖的。'],
  choices:[
    { text:'拿去问大师', result:{ text:'大师看了说这是一块低级魂玉，常年佩戴可以温养魂力。他帮你做成了一个玉佩。', spiritPowerGain:2, exp:20 } },
    { text:'自己琢磨', result:{ text:'你拿着石头研究了半天，不小心割破了手指，血滴在石头上——石头居然吸收了你的血，微微发光！虽然不知道有什么用，但你感觉和它建立了联系。', fate:2, exp:25 } },
    { text:'扔了吧，普通石头', result:{ text:'你随手扔了石头。第二天后悔了去找，但石头已经不见了。', exp:5 } }
  ]},
{ id:'ac_more_14', name:'大师的表扬', location:'史莱克学院·教室', phase:'academy', weight:2, image:'assets/scenes/academy_classroom.jpg',
  text:['大师在课堂上当众表扬了你最近的进步，同学们都向你投来羡慕的目光。'],
  choices:[
    { text:'谦虚表示还需努力', result:{ text:'你站起来说自己还有很多不足。大师欣慰地点头，同学们也更加佩服你。', fate:2, exp:20 } },
    { text:'心里暗爽，继续加油', result:{ text:'你表面淡定，心里乐开了花。接下来的训练你更加卖力了。', attack:1, exp:15 } },
    { text:'骄傲自满', result:{ text:'你开始有点飘飘然，训练也没以前认真了。几天后的小测你成绩下滑，被大师点名批评。', exp:5, fate:-1 } }
  ]},
{ id:'ac_more_15', name:'雨天共伞', location:'学院门口', phase:'academy', weight:1, image:'assets/scenes/border_town.jpg',
  text:['放学时突然下起大雨，你带了伞，但旁边一个没带伞的同学正望着雨发愁。'],
  choices:[
    { text:'邀他一起撑伞', result:{ text:'你们挤在一把伞下，虽然各湿了半边肩膀，但聊了一路。这个同学后来成了你最好的朋友之一。', fate:3, exp:20 } },
    { text:'把伞借给他', result:{ text:'你把伞塞给他，自己冒雨跑回宿舍。他追上来要还伞，两人相视一笑。', damage:5, fate:2, exp:15 } },
    { text:'自己先走', result:{ text:'你撑着伞独自走了。回头看到那个同学淋雨跑走的背影，你有点后悔。', exp:5 } }
  ]}
);

// ==================== 五、冒险篇继续扩充（更多战斗/探索/城镇/奇缘） ====================
EVENTS.push(
{ id:'adv_more_01_beast', name:'人面魔蛛', location:'星斗大森林外围·中层', phase:'master', minLevel:25, weight:3, image:'assets/beasts/human_faced_spider.jpg',
  text:['一张人脸朝你微笑——不，那不是人脸，是一只磨盘大的蜘蛛背上的花纹！人面魔蛛！它的八条腿像长矛一样刺向你。'],
  choices:[
    { text:'迎战，积累实战经验！', result:{ text:'人面魔蛛的毒液和蛛腿都极其危险——你在战斗中寻找破绽，最终逼退了它。正式魂环需要通过魂环猎取节点获得。', battle:'human_faced_spider', exp:160, gold:120 } },
    { text:'它太危险了，撤退！', result:{ text:'你当机立断撤退，人面魔蛛追了一段就放弃了。明智的选择。', exp:40, speed:1 } },
    { text:'用火攻驱赶', result:{ text:'你点燃了周围的灌木形成火墙，人面魔蛛惧怕火焰，后退了。你趁机撤离。', exp:60 } }
  ]},
{ id:'adv_more_02_birds', name:'风灵燕群', location:'落日峡谷', phase:'adventure', minLevel:18, weight:2, image:'assets/beasts/wind_spirit_swallow.jpg',
  text:['峡谷中风声呼啸，成群的风灵燕在空中盘旋。它们速度极快，翅膀如刀刃。'],
  choices:[
    { text:'猎杀一只百年的', result:{ text:'你锁定了一只体型较大的风灵燕——', battle:'wind_spirit_swallow', exp:80, gold:50 } },
    { text:'观察它们的飞行轨迹', result:{ text:'你观察了一个时辰，从风灵燕的飞行中领悟了一种借力身法。', speed:3, exp:50 } },
    { text:'快速通过峡谷', result:{ text:'你收敛气息快速穿过峡谷，风灵燕没有注意到你。', exp:25 } }
  ]},
{ id:'adv_more_03_bear', name:'暗金恐爪熊', location:'星斗大森林深处', phase:'god', minLevel:75, weight:2, image:'assets/beasts/dark_gold_terrorclaw_bear.jpg',
  text:['森林中突然安静下来，连虫鸣都消失了。一只浑身暗金色毛发的巨熊从树后走出，它的爪子闪烁着金属寒光——暗金恐爪熊，万年魂兽中的顶级存在！'],
  choices:[
    { text:'拼命一战！', cond:{level:45}, result:{ text:'你和暗金恐爪熊展开了惊天动地的战斗——', battle:'dark_gold_terrorclaw_bear', exp:300, gold:300, fate:1 } },
    { text:'立刻装死', result:{ text:'你立刻倒地装死，连呼吸都屏住了。暗金恐爪熊过来嗅了嗅你，用熊掌拨了你两下，你一动不动。它觉得你死了，慢悠悠走了。', fate:2, exp:100 } },
    { text:'全速逃跑！', result:{ text:'你玩命地跑，暗金恐爪熊在后面追了五里地才放弃。你吓得魂都飞了，但活下来了。', damage:30, speed:2, exp:60 } }
  ]},
{ id:'adv_more_04_scorpion', name:'冰帝蝎子', location:'极北冰原', phase:'god', minLevel:75, weight:2, image:'assets/beasts/ice_emperor_scorpion.jpg',
  text:['冰原上，一只通体碧绿的蝎子静静地卧在冰雪中，它的尾巴尖端闪烁着幽蓝的光芒——冰帝蝎，极北三大天王之一的后裔！'],
  choices:[
    { text:'这是大机缘，战！', result:{ text:'极寒之气让你的血液都快凝固了，但你咬紧牙关——', battle:'ice_emperor_scorpion', exp:280, gold:250 } },
    { text:'远远避开', result:{ text:'你绕了一个大圈避开了冰帝蝎的领地。在绝对的实力差距面前，谨慎不是懦弱。', exp:50, defense:1 } }
  ]},
{ id:'adv_more_05_sheep', name:'铁角羊的冲撞', location:'星斗大森林外围·草坡', phase:'adventure', minLevel:12, weight:2, image:'assets/beasts/iron_horn_sheep.jpg',
  text:['你在草坡上遇到一只铁角羊，它低着头，铁角闪着寒光，蹄子刨着土——这是要冲撞的信号！'],
  choices:[
    { text:'正面迎击！', result:{ text:'你和铁角羊硬碰硬——', battle:'iron_horn_sheep', exp:50, gold:30 } },
    { text:'闪开让它撞空', cond:{speed:12}, result:{ text:'你敏捷地闪开，铁角羊收势不及撞上了大树，角都撞歪了。它晕头转向地跑了。', speed:1, exp:35 } },
    { text:'给它喂草示好', result:{ text:'你掏出一把嫩草递过去。铁角羊警惕地看了你一会儿，最终走过来吃草。你摸了摸它坚硬的角，它居然没反抗。', fate:1, exp:25 } }
  ]},
{ id:'adv_more_06_titan', name:'泰坦巨猿之王', location:'星斗大森林深处·核心区', phase:'god', minLevel:75, weight:1, image:'assets/beasts/titan_giant_ape_king.jpg',
  text:['整个森林都在颤抖。一头比普通泰坦巨猿还要大两倍的金色巨猿出现在你面前——泰坦巨猿王，十万年魂兽！它只是看了你一眼，你就感觉灵魂在颤栗。'],
  choices:[
    { text:'叩首表示敬意', result:{ text:'你立刻跪下叩首，表示没有恶意。泰坦巨猿王注视你良久，吼了一声，转身离去。它的吼声中似乎包含着某种认可。', fate:3, exp:200 } },
    { text:'不知死活地挑战', cond:{level:85}, requirementHint:'等级达到 Lv.85', result:{ text:'你冲了上去——一拳，你就飞了出去，撞碎了七棵大树。醒来时你躺在森林边缘，浑身骨折。但你活下来了，这本身就是奇迹。', damage:80, exp:100, fate:-1 } },
    { text:'一动不动，等它离开', result:{ text:'你像石头一样一动不动地站着。泰坦巨猿王打量你半天，似乎觉得你很无趣，咆哮一声离去了。', exp:80, defense:2 } }
  ]},
{ id:'adv_more_07', name:'天斗城拍卖会', location:'天斗城·拍卖场', phase:'adventure', weight:2, image:'assets/scenes/auction_house.jpg',
  text:['你拿到了一张天斗拍卖会的入场券。会场上珠光宝气，各种奇珍异宝琳琅满目。'],
  choices:[
    { text:'拍一把魂师长剑（150金币）', cond:{gold:150}, cost:{gold:150}, result:{ text:'你拍下了一把寒光闪闪的魂师长剑，攻击力大增。', attack:3, exp:30 } },
    { text:'拍一件护甲（200金币）', cond:{gold:200}, cost:{gold:200}, result:{ text:'你拍下了一件轻巧的魂师皮甲，防御力大增。', defense:3, exp:30 } },
    { text:'纯看热闹', result:{ text:'你见识了各种天价宝物和魂师界的大人物，大开眼界。', exp:20 } }
  ]},
{ id:'adv_more_08', name:'铁匠的切磋', location:'天斗城·铁匠铺', phase:'adventure', weight:2, image:'assets/scenes/blacksmith.jpg',
  text:['铁匠铺的老铁匠看了看你的武器："小家伙，武器是魂师的第二条命，你这武器可不行。要不要和老头子我切磋一下锻造？"'],
  choices:[
    { text:'跟他学打铁', result:{ text:'你跟着老铁匠学了三天打铁，虽然满手是泡，但你悟出了力量传导的道理，出手更精准了。', attack:2, exp:50 } },
    { text:'请他帮我强化武器（100金币）', cond:{gold:100}, cost:{gold:100}, result:{ text:'老铁匠花了一天一夜帮你强化武器，你的武器攻击力提升了一大截。', attack:3, exp:30 } },
    { text:'没兴趣', result:{ text:'你摇摇头走了。老铁匠叹了口气继续打铁。', exp:5 } }
  ]},
{ id:'adv_more_09', name:'斗魂场连胜', location:'天斗城·大斗魂场', phase:'master', minLevel:25, weight:3, image:'assets/scenes/arena.jpg',
  text:['你在大斗魂场已经连胜七场，成为了今天的焦点。第八场的对手是一个用锁链的魂师，身形诡异。'],
  choices:[
    { text:'继续冲！八连胜！', result:{ text:'锁链魂师的招式诡异莫测，但你越战越勇——', battle:'arena_fighter', exp:130, gold:200, fate:1 } },
    { text:'七连胜已经很好了，收手', result:{ text:'你潇洒地向观众致意后离场，保住了七连胜的奖金。', gold:100, exp:40 } }
  ]},
{ id:'adv_more_10', name:'沙漠绿洲', location:'西鲁城·沙漠', phase:'master', minLevel:30, weight:2, image:'assets/scenes/volcano.jpg',
  text:['你穿越沙漠时水袋破了，口渴难耐。就在你快要撑不住的时候，眼前出现了一片绿洲！'],
  choices:[
    { text:'冲过去喝水！', result:{ text:'你冲到绿洲边狂饮泉水。清凉的泉水救了你的命，你还在泉边发现了几株沙漠灵药。', hp:50, spiritPowerGain:2, exp:60, item:{ name:'回魂丹', type:'heal', value:70, count:2 } } },
    { text:'小心有诈，先观察', result:{ text:'你谨慎地观察了一会儿，确认没有危险后才喝水。这是真的绿洲，不是海市蜃楼。你的谨慎让你避开了水底的一条小毒蛇。', fate:1, exp:50 } }
  ]},
{ id:'adv_more_11', name:'被山贼围困', location:'天斗帝国·官道', phase:'adventure', weight:3, image:'assets/scenes/border_town.jpg',
  text:['你路过一处山谷时，锣声大作，十几个山贼从两边冲出来把你围住。为首的是一个刀疤脸："此山是我开！"'],
  choices:[
    { text:'杀出去！', result:{ text:'你亮出{spirit}冲杀出去——虽然山贼人数多，但都是乌合之众。', battle:'academy_rival', exp:80, gold:100, damage:15 } },
    { text:'用钱买路（80金币）', cond:{gold:80}, cost:{gold:80}, result:{ text:'你扔出钱袋，山贼头子哈哈一笑放你过去。破财消灾。', exp:20 } },
    { text:'谈判，劝他们从良', result:{ text:'你和山贼头子聊了起来，发现他们都是被赋税逼得走投无路的农民。你给他们指了一条去学院当杂役的出路，他们居然真的解散了！', fate:3, exp:90 } }
  ]},
{ id:'adv_more_12', name:'古战场遗址', location:'天斗帝国·古战场', phase:'master', minLevel:32, weight:2, image:'assets/scenes/abyss_godrealm.jpg',
  text:['你发现了一处古战场遗址，地上散落着锈蚀的兵器和白骨，空气中弥漫着肃杀之气。'],
  choices:[
    { text:'在古战场打坐，感悟战意', result:{ text:'你在万千白骨中打坐，耳边仿佛听到了千年前的喊杀声。你对战斗的理解又深了一层。', attack:3, exp:80 } },
    { text:'搜寻遗物', result:{ text:'你搜索了半天，找到了一块保存完好的魂师令牌和几块碎银。令牌上刻着一个你不认识的徽记。', gold:50, exp:30, fate:1 } },
    { text:'这里太邪气了，赶紧走', result:{ text:'你感觉这里阴气太重，快步离开了。走了很远你还觉得背后发凉。', exp:15 } }
  ]},
{ id:'adv_more_13', name:'龙涎草', location:'悬崖绝壁', phase:'master', minLevel:28, weight:2, image:'assets/scenes/mountain_path.jpg',
  text:['你看到对面悬崖上长着一株散发金光的草药——龙涎草！传说中能大幅提升魂力的天材地宝！但中间是万丈深渊。'],
  choices:[
    { text:'冒险爬过去采！', cond:{speed:28}, result:{ text:'你屏住呼吸，像壁虎一样攀过悬崖，成功采到了龙涎草！服下后魂力暴涨。', spiritPowerGain:8, exp:100, damage:20 } },
    { text:'用工具尝试', result:{ text:'你用绳索和飞爪尝试，但草的位置太刁钻，绳索够不到。你放弃了，至少没受伤。', exp:20 } },
    { text:'太危险了，命比草重要', result:{ text:'你看了看深渊，明智地选择了放弃。总有其他机缘。', fate:1, exp:15 } }
  ]},
{ id:'adv_more_14', name:'被下毒', location:'路边·茶馆', phase:'adventure', weight:2, image:'assets/scenes/tavern.jpg',
  text:['你在路边茶馆喝了一碗茶，没多久就头晕目眩——茶里被下了软筋散！几个蒙面人从暗处走出。'],
  choices:[
    { text:'运功逼毒，反击！', cond:{defense:20}, result:{ text:'你运转魂力逼出毒素，虽然状态大减但依然能战——你打退了蒙面人！', damage:25, exp:80, gold:60 } },
    { text:'假装晕倒，伺机逃跑', result:{ text:'你假装晕倒，被他们拖着走。走到悬崖边时你突然暴起，把他们撞了个措手不及，滚下山坡逃脱了。', damage:20, speed:1, exp:50, fate:1 } },
    { text:'被他们抓走', result:{ text:'你浑身无力被抓走了。他们要把你卖给邪魂师当鼎炉！你在被关押的第三天找到机会打晕看守逃了出来。', damage:40, exp:40, fate:-1 } }
  ]},
{ id:'adv_more_15', name:'武魂分殿的邀请', location:'武魂殿·分殿', phase:'master', minLevel:28, weight:2, image:'assets/scenes/temple.jpg',
  text:['武魂殿分殿的执事找到你，邀请你加入武魂殿："以你的天赋，在武魂殿能得到最好的资源，前途无量。"'],
  choices:[
    { text:'婉拒，我在学院很好', result:{ text:'你礼貌地拒绝了邀请。执事没有勉强，但说如果改变主意随时可以来找他。', fate:1, exp:30 } },
    { text:'答应加入', result:{ text:'你加入了武魂殿。虽然得到了一些资源，但你总觉得那些人看你的眼神不太对。', gold:100, exp:40, fate:-2 } },
    { text:'两边都不得罪，先考虑', result:{ text:'你说需要考虑。执事给了你一块令牌，说想好了拿着令牌来分殿即可。', exp:20 } }
  ]}
);

// ==================== 六、封号篇扩充（高阶战斗/宗门/权谋/奇缘） ====================
EVENTS.push(
{ id:'ma_more_01_sect', name:'宗门大比', location:'上三宗·比武场', phase:'god', minLevel:50, weight:3, image:'assets/scenes/arena.jpg',
  text:['你受邀参加上三宗联合举办的宗门大比。各宗门的天才云集，每一个都是顶尖高手。'],
  choices:[
    { text:'全力争胜！', result:{ text:'你一路过关斩将杀入决赛——', battle:'final_fighter', exp:300, gold:400, fate:2 } },
    { text:'以武会友，点到为止', result:{ text:'你在比赛中展示了实力但不伤人，结交了各宗门的不少朋友。虽然没拿到名次，但人脉比奖杯更重要。', fate:3, exp:200 } },
    { text:'弃权，太危险了', result:{ text:'你觉得这种比赛容易结仇，选择弃权。有人说你胆小，但也有人佩服你的冷静。', exp:50 } }
  ]},
{ id:'ma_more_02_evil', name:'邪魂师巢穴', location:'废弃教堂', phase:'god', minLevel:52, weight:3, image:'assets/scenes/swamp.jpg',
  text:['你追踪邪魂师来到一处废弃教堂，里面阴气森森，地上画着血色符文。十几个邪魂师正在举行邪恶仪式。'],
  choices:[
    { text:'冲进去破坏仪式！', result:{ text:'你大吼一声冲入教堂——', battle:'evil_master', exp:350, gold:300, fate:3 } },
    { text:'先回去叫人', result:{ text:'你悄悄退出，火速通知了武魂殿和附近的魂师。大队人马赶到时邪魂师还在仪式中，被一网打尽。', fate:2, exp:200 } },
    { text:'一个人偷偷观察', result:{ text:'你潜伏在屋顶观察，发现邪魂师背后还有更大的势力！你记下了他们的暗记，事后报告给了大师。', exp:150, fate:1 } }
  ]},
{ id:'ma_more_03_snow', name:'雪帝的召见', location:'极北冰原·核心', phase:'god', minLevel:65, weight:2, image:'assets/scenes/snow_mountain.jpg',
  text:['极北冰原深处，一个冰蓝色的身影出现在你面前——雪帝！极北三大天王之首！她的气息让整片冰原都在颤抖。'],
  choices:[
    { text:'恭敬行礼', result:{ text:'你恭敬地行礼，表达了对极北之地的敬畏。雪帝看了你很久，指尖弹出一点冰蓝色光芒融入你的体内——冰属性亲和力大幅提升！', spiritPowerGain:10, defense:3, exp:400, fate:3 } },
    { text:'请求一战', result:{ text:'你不知天高地厚地请求切磋。雪帝轻轻一挥手，你就被冰封了三个时辰。解冻后她笑了："胆子不小，再练一百年吧。"你虽然狼狈但收获颇丰。', damage:30, defense:2, exp:250 } },
    { text:'转身就跑', result:{ text:'你吓得转身就跑。雪帝的笑声在你身后回荡："有趣的小家伙。"', exp:100 } }
  ]},
{ id:'ma_more_04_mentor', name: '收徒·传承', location:'史莱克学院', phase:'god', minLevel:50, weight:2, image:'assets/scenes/academy_classroom.jpg',
  text:['一个孩子在学院门口跪了三天三夜，要拜你为师。他资质一般，但眼神异常坚定。'],
  choices:[
    { text:'收下他', result:{ text:'你收下了这个徒弟。虽然他天赋不高，但异常勤奋。多年后他成为了你的骄傲。', fate:3, exp:150 } },
    { text:'告诉他修炼的残酷，让他想清楚', result:{ text:'你对他实话实说修炼的艰辛。他依然坚持，你被他的执着打动，最终收他为徒。', fate:2, exp:120 } },
    { text:'我自己还没成气候，不收徒', result:{ text:'你婉拒了。孩子磕了三个头离开了。你有点不忍心，但觉得自己的决定是对的。', exp:50 } }
  ]},
{ id:'ma_more_05', name:'旧友重逢', location:'天斗城·酒楼', phase:'master', weight:2, image:'assets/scenes/tavern.jpg',
  text:['你在酒楼遇到了一个熟悉的身影——是当年学院里和你一起抢红烧肉的胖虎学长！他现在已经是个小有名气的战魂师了。'],
  choices:[
    { text:'坐下来喝一杯叙旧', result:{ text:'你们喝了一晚上酒，回忆学院的趣事。临走时胖虎送给你一块他亲手打造的护心镜。', defense:3, fate:2, exp:100 } },
    { text:'切磋一下，看看彼此进步', result:{ text:'你们找了个比武场切磋了几十回合，不分胜负。两人哈哈大笑，都觉得对方进步很大。', attack:2, exp:120 } },
    { text:'客气两句就走', result:{ text:'你寒暄几句就匆匆离开了。胖虎看着你的背影有点失落。', exp:30 } }
  ]},
{ id:'ma_more_06', name:'九品灵芝', location:'万丈悬崖·顶端', phase:'god', minLevel:55, weight:2, image:'assets/scenes/mountain_path.jpg',
  text:['你得到消息，万丈悬崖顶端长着一株九品灵芝，有活死人肉白骨之效。'],
  choices:[
    { text:'攀上去采！', cond:{speed:50}, result:{ text:'你花了整整一天攀上悬崖，成功采到九品灵芝！', hp:100, spiritPowerGain:8, exp:250, fate:1 } },
    { text:'请人帮忙', result:{ text:'你请了一位飞行系魂师帮忙采摘，分了他半株灵芝作为报酬。', hp:50, exp:150 } },
    { text:'太危险了，不值得', result:{ text:'你放弃了。后来听说另一个魂师为了采它摔下了悬崖，你庆幸自己的选择。', fate:1, exp:50 } }
  ]},
{ id:'ma_more_07', name:'海神岛七圣柱', location:'海神岛', phase:'god', minLevel:60, weight:2, image:'assets/scenes/temple.jpg',
  text:['你登上了海神岛，看到了七根高耸入云的圣柱，每一根都散发着不同属性的神光。'],
  choices:[
    { text:'逐一参拜七圣柱', result:{ text:'你逐一参拜七圣柱，每一根柱子都赐予了你一点神力加持。', spiritPowerGain:12, exp:280, fate:2 } },
    { text:'挑战其中一根圣柱的守护者', result:{ text:'你选择了和你属性最契合的圣柱守护者进行挑战——这是一场艰苦但荣耀的战斗！', battle:'final_fighter', exp:350, attack:3 } },
    { text:'远远看看就好', result:{ text:'你在远处虔诚地鞠了一躬，没有打扰圣柱守护者。', exp:80 } }
  ]},
{ id:'ma_more_08', name:'武魂殿的追杀令', location:'天斗帝国·各地', phase:'god', minLevel:55, weight:2, image:'assets/scenes/wuhun_city.jpg',
  text:['因为你知道了武魂殿的秘密，他们对你下了追杀令！你走到哪里都能感觉到暗处有眼睛盯着你。'],
  choices:[
    { text:'正面硬刚，反杀追兵！', result:{ text:'你设下陷阱等追兵到来，一举击杀了三个武魂殿的魂师！你用他们的令牌给武魂殿传了个信："来多少我杀多少。"', exp:400, gold:300, fate:2 } },
    { text:'隐姓埋名，暂避风头', result:{ text:'你乔装打扮躲了一段时间。等风声过去后你才重新露面。', exp:150 } },
    { text:'寻求宗门/学院庇护', result:{ text:'你回到史莱克学院寻求庇护。大师亲自出面和武魂殿交涉，最终以交换情报的方式解除了追杀令。', fate:2, exp:200 } }
  ]},
{ id:'ma_more_09', name:'弟子遇难', location:'天斗帝国·边境', phase:'god', minLevel:55, weight:2, image:'assets/scenes/border_town.jpg',
  text:['你的弟子在边境执行任务时被邪魂师重伤，生命垂危！'],
  choices:[
    { text:'亲自去救他！', cond:{ item:'回魂丹', itemCount:2 }, result:{ text:'你连夜赶到边境，杀退邪魂师，用珍贵丹药救回弟子一命。弟子跪在你面前痛哭流涕。', damage:20, item:{ name:'回魂丹', type:'heal', value:150, count:-2 }, fate:4, exp:250 } },
    { text:'派人去救', result:{ text:'你派了更有经验的人去救。弟子平安回来了，但看你的眼神里有一丝失望。', gold:-100, exp:100 } },
    { text:'修炼者生死有命', result:{ text:'你没有去救。弟子最终被路过的魂师救了，但他再也不认你这个师父了。', fate:-3, exp:50 } }
  ]},
{ id:'ma_more_10', name:'小药的消息', location:'天斗城·药堂', phase:'god', minLevel:55, weight:2, image:'assets/scenes/border_town.jpg',
  text:['你听说小药的药堂遇到了麻烦——当地权贵要强占她的药堂，她一个人撑得很辛苦。'],
  choices:[
    { text:'立刻赶去帮她！', result:{ text:'你赶到药堂，凭借实力和人脉帮小药解决了麻烦。她看到你的时候眼眶红了。你们聊了一整夜，像从前一样。', fate:3, exp:200 } },
    { text:'写信给她，提供远程帮助', result:{ text:'你写了一封信给她出谋划策，还寄了一些钱。她按照你的方法解决了问题，写信来感谢你。', gold:-50, fate:2, exp:120 } },
    { text:'各自有各自的路', result:{ text:'你没有去。有些人注定只能陪你走一段路。', exp:50 } }
  ]}
);

// ==================== 七、成神篇扩充（神战/秘境/终极/超脱） ====================
EVENTS.push(
{ id:'god_more_01_envoy', name:'神界的使者', location:'苍穹之巅', phase:'god', minLevel:80, weight:3, image:'assets/scenes/abyss_godrealm.jpg',
  text:['一道金光从天而降，一个穿着金甲的神人出现在你面前："凡人，你的实力已经触碰到神的门槛。是否愿意接受神位考核？"'],
  choices:[
    { text:'我愿意！', result:{ text:'金甲神人点头，在你眉心点了一下。你获得了神考印记，成神之路正式开启！', spiritPowerGain:15, exp:500, fate:3 } },
    { text:'我要靠自己成神', result:{ text:'你拒绝了传承，要靠自己的力量破开虚空。神人笑了："有志气。但你会很难。"', attack:5, exp:300, fate:2 } },
    { text:'我还没准备好', result:{ text:'神人点头："等你准备好，到苍穹之巅喊三声"神考"即可。"说完消失在金光中。', exp:200 } }
  ]},
{ id:'god_more_02_evil', name:'邪魂师之神', location:'深渊裂隙', phase:'god', minLevel:85, weight:2, image:'assets/scenes/swamp.jpg',
  text:['深渊中浮现一个巨大的黑影——一位堕落的邪魂师之神！他诱惑你："投入我的门下，我给你无尽的力量，整个大陆都将匍匐在你脚下！"'],
  choices:[
    { text:'我绝不与邪恶为伍！', result:{ text:'你毅然拒绝，亮出{spirit}冲向邪神——', battle:'god_rival', exp:600, fate:3 } },
    { text:'虚与委蛇，趁机偷袭', result:{ text:'你假装投降，等他放松警惕时全力一击！虽然没能杀他，但重创了他。', exp:450, speed:3, fate:2 } },
    { text:'接受力量……', result:{ text:'你接受了邪神的力量，瞬间变得无比强大。但你的眼神开始变得冰冷，你感觉自己正在失去什么重要的东西。', attack:10, fate:-5, exp:200 } }
  ]},
{ id:'god_more_03_rift', name:'空间裂隙', location:'虚空之中', phase:'god', minLevel:88, weight:2, image:'assets/scenes/abyss_godrealm.jpg',
  text:['你在突破时不慎坠入空间裂隙，看到了时光的碎片——你看到了小时候的自己，也看到了斗罗大陆千年后的样子。'],
  choices:[
    { text:'追寻过去的自己', result:{ text:'你想看清过去的细节，但时光之力把你推了回来。你明白了：过去不可改，未来犹可追。', spiritPowerGain:20, exp:400, fate:2 } },
    { text:'窥探未来', result:{ text:'你看到了未来的一场大劫。虽然看不真切，但你记住了那个画面，开始为此做准备。', fate:3, exp:350 } },
    { text:'拼命稳住身形逃出去', result:{ text:'你全力运转{spirit}破开空间裂隙逃了回来。虽然没看到什么秘密，但你对空间之力有了领悟。', speed:4, exp:300 } }
  ]},
{ id:'god_more_04', name:'众神之会', location:'神界·神殿', phase:'god', minLevel:90, weight:2, image:'assets/scenes/temple.jpg',
  text:['你受邀参加众神之会，神界的各位神祇齐聚一堂。海神、修罗神、天使神……每一位都散发着令人窒息的威压。'],
  choices:[
    { text:'向海神请教', result:{ text:'海神和蔼地回答了你的问题，还传授了你一点控水之术。', spiritPowerGain:15, exp:400, fate:2 } },
    { text:'向修罗神请教战斗', result:{ text:'修罗神看了你一眼："你的眼神不错。"他随手一指，你就顿悟了杀戮之气的运用。', attack:5, exp:400 } },
    { text:'默默观察众神', result:{ text:'你安静地观察众神的言行举止，学到了很多关于神位和神力的知识。', exp:300, fate:1 } }
  ]},
{ id:'god_more_05', name:'大陆灾变', location:'斗罗大陆·各地', phase:'god', minLevel:92, weight:5, image:'assets/scenes/abyss_godrealm.jpg',
  text:['天崩地裂！斗罗大陆各地同时出现空间裂缝，无数深渊生物涌出，生灵涂炭！这就是你之前看到的大劫！'],
  choices:[
    { text:'以神之躯，守护大陆！', result:{ text:'你飞向灾情最严重的地方，以一己之力堵住了最大的空间裂缝！你燃烧神力击杀了无数深渊生物——', battle:'abyss_lord', exp:800, fate:5 } },
    { text:'组织众神/魂师联手', result:{ text:'你没有独自蛮干，而是迅速联系了所有能联系的力量，组织起一道防线。在你的指挥下，灾情被控制住了。', fate:4, exp:600 } },
    { text:'先自保再说', result:{ text:'你躲到了安全的地方。大陆损失惨重，但你活了下来。只是每当夜里，你都会想起那些死去的人们。', fate:-5, exp:200 } }
  ]},
{ id:'god_more_06', name:'神位传承者', location:'史莱克学院', phase:'god', minLevel:85, weight:2, image:'assets/scenes/academy_classroom.jpg',
  text:['你回到学院，看到一个和你当年一样青涩的少年/少女，他/她的眼中有和你一样的光芒。你意识到，该找一个传承者了。'],
  choices:[
    { text:'收他/她为亲传弟子', result:{ text:'你把毕生所学倾囊相授。多年后，他/她成为了新的传奇。你终于理解了当年大师的心情。', fate:4, exp:300 } },
    { text:'留下传承，让有缘者得之', result:{ text:'你把一生的武学感悟刻在秘境中，留给后世有缘人。', fate:2, exp:200 } },
    { text:'我还年轻，不急', result:{ text:'你觉得自己还没到要传承的时候。那个少年/少女后来拜了别人为师，成就也不凡。', exp:100 } }
  ]},
{ id:'god_more_07', name:'重返故里', location:'出生的小村庄', phase:'god', weight:2, image:'assets/scenes/forest_outer.jpg',
  text:['你回到了出生的小村庄。这里一切如旧，炊烟袅袅，鸡犬相闻。没有人知道，站在村口的这个年轻人/年轻人，已经是一位神祇。'],
  choices:[
    { text:'去看看小时候的家', result:{ text:'你找到了当年的老房子，现在住着一户新人家。你在门口站了很久，然后悄悄离开。', fate:3, exp:200 } },
    { text:'给村子留下祝福', result:{ text:'你在村子的水井边布下了一道神力守护，此后百年，这个村子风调雨顺，再无魂兽侵扰。', fate:5, exp:300 } },
    { text:'不进去了，在远处看看就好', result:{ text:'你在远处山头坐了很久，看着夕阳下的村庄，然后转身离去。', exp:150 } }
  ]},
{ id:'god_more_08', name:'最终的选择', location:'神界之门', phase:'god', minLevel:95, weight:5, image:'assets/scenes/abyss_godrealm.jpg',
  text:['神界之门在你面前完全打开，成神还是留在人间？这是最后的选择。'],
  choices:[
    { text:'飞升神界，追求更高境界', result:{ text:'你步入神界之门，金光将你笼罩。斗罗大陆的故事告一段落，但你的传说才刚刚开始。', exp:1000, fate:3 } },
    { text:'留在人间，守护这片大陆', result:{ text:'你关闭了神界之门，选择留在斗罗大陆。人间有你在乎的人，有你放不下的羁绊。你成为了大陆的守护神。', fate:5, exp:800 } },
    { text:'逍遥天地间，不拘神与人', result:{ text:'你选择了第三条路——不入神界，也不长留人间，而是逍遥于天地之间，做一个自由自在的神。', fate:4, exp:900 } }
  ]}
);

// ==================== 三、冒险篇扩充（野外/城镇/秘境/战斗/奇遇） ====================
EVENTS.push(
// ---- 森林深处·魂兽遭遇 ----
{
  id: 'adv_beast_01', name: '百年风蝶群', location: '星斗大森林外围·中层',
  phase: 'adventure', minLevel: 15, weight: 3,
  image: 'assets/beasts/wind_butterfly.jpg',
  text: [
    '你闯入了一片花海，无数只巴掌大的风蝶在花丛中翩翩起舞，翅膀闪烁着淡淡青光。',
    '这本是一幅美景，但你注意到——风蝶群的中央，有一只体型大如磨盘的百年风蝶后，它正冷冷地注视着你。'
  ],
  choices: [
    { text: '悄悄退走，不打扰它们', result: { text: '你屏住呼吸缓缓后退，风蝶后似乎感受到你没有敌意，翅膀扇动了几下，继续采蜜。你安全退出了花海。', exp: 30, fate: 1 } },
    { text: '挑战百年风蝶后！', result: { text: '你亮出{spirit}冲向风蝶后！狂风骤起，无数风蝶向你扑来——', battle: 'wind_butterfly', exp: 80, gold: 60 } },
    { text: '抓几只小风蝶带走', result: { text: '你试图抓几只幼蝶，却惊动了整个蝶群，被狂风一路吹到了树林外面，摔了个七荤八素。', damage:20, exp: 20 } }
  ]
},
{
  id: 'adv_beast_02', name: '狡诈的影狐', location: '星斗大森林外围·中层',
  phase: 'adventure', minLevel: 18, weight: 2,
  image: 'assets/beasts/shadow_fox.jpg',
  text: [
    '前方的影子不太对劲——你定睛一看，一只通体漆黑的影狐正趴在树枝上，九条尾巴轻轻摆动，狡黠的眼睛盯着你。',
    '它没有直接攻击，而是制造出三个和你一模一样的幻影，把你围在中间。'
  ],
  choices: [
    { text: '冷静分辨真身！', cond: { speed: 18 }, result: { text: '你闭上眼用心感知，瞬间找到了影狐的真身所在——一剑刺出！影狐惊叫一声化作黑烟逃走，留下一尾黑色的狐毛。', speed: 2, exp: 70, item: { name: '影狐尾', type: 'misc', value: 80, count: 1 } } },
    { text: '不管了，乱打一通！', result: { text: '你对着幻影一阵猛攻，结果被真正的影狐从背后偷袭，后腿受了伤。但你也反手打伤了它，影狐惨叫着逃走了。', damage:25, exp: 50, attack: 1 } },
    { text: '扔出食物示好', result: { text: '你把干粮扔向远处，影狐犹豫了一下，叼起干粮跳进了密林深处。你平安通过了它的领地。', exp: 25, fate: 1 } }
  ]
},
{
  id: 'adv_beast_03', name: '铁甲熊的领地', location: '星斗大森林外围·中层',
  phase: 'master', minLevel: 20, weight: 3,
  image: 'assets/beasts/iron_armor_bear.jpg',
  text: [
    '你误入了一片满是爪痕的区域，一棵三人合抱的大树被硬生生拍断——这是铁甲熊的领地标记！',
    '低沉的咆哮声从身后传来。你缓缓转头，一头两人高的铁甲熊人立而起，熊掌闪着金属般的光泽。'
  ],
  choices: [
    { text: '正面迎战！', result: { text: '铁甲熊的防御恐怖至极，你打了整整半个时辰才找到它腋下的破绽——', battle: 'iron_armor_bear', exp: 100, gold: 80 } },
    { text: '爬树躲避！', cond: { speed: 20 }, result: { text: '你敏捷地爬上一棵最高的树。铁甲熊在树下咆哮拍击了半个时辰，最终悻悻离去。你在树上等到天黑才敢下来。', exp: 40, speed: 1 } },
    { text: '装死！', result: { text: '你屏住呼吸倒在地上一动不动。铁甲熊过来嗅了嗅你，用熊掌拨了你两下，见你没反应就慢悠悠地走了。你吓得浑身冷汗，但活下来了。', exp: 35, fate: 1 } }
  ]
},
{
  id: 'adv_beast_04', name: '毒蜘蛛的陷阱', location: '星斗大森林外围·中层',
  phase: 'master', minLevel: 22, weight: 3,
  image: 'assets/beasts/poison_spider.jpg',
  text: [
    '你没注意到脚下的蛛丝，一脚踏进了一张巨大的蜘蛛网！粘稠的蛛丝瞬间缠住了你的双腿。',
    '八只红色的眼睛在黑暗中亮起——一只磨盘大的毒蜘蛛缓缓爬了过来，毒液从它的毒牙上滴落，地面发出滋滋的腐蚀声。'
  ],
  choices: [
    { text: '运功震开蛛丝，拼死一战！', cond: { attack: 25 }, result: { text: '你大喝一声震开蛛丝，{spirit}全力出击！', battle: 'poison_spider', exp: 120, gold: 100 } },
    { text: '用火（如果你有火属性）烧断蛛丝', result: { text: '你用魂力引燃身边的干草烧断蛛丝，在毒蜘蛛扑来的瞬间滚了出去。虽然狼狈，但你逃出了陷阱。', damage:15, exp: 60, speed: 1 } },
    { text: '放弃挣扎，大喊救命', result: { text: '你大喊救命，就在毒蜘蛛快要咬到你的时候，一道黑影掠过——一位路过的老魂师一剑斩杀了毒蜘蛛。他训了你几句"年轻人不要莽撞"，你连连点头。', fate: 2, exp: 50 } }
  ]
},
{
  id: 'adv_beast_05', name: '冰原狼的嚎叫', location: '北方冰原',
  phase: 'master', minLevel: 25, weight: 2,
  image: 'assets/beasts/ice_wolf.jpg',
  text: [
    '你在北方执行任务时遭遇了暴风雪，躲进一个冰洞暂避。洞外传来阵阵狼嚎，越来越近。',
    '三只冰狼堵在了洞口，白色的毛发和冰雪融为一体，幽蓝的眼睛在黑暗中格外刺眼。它们的头领是百年冰狼，体型比普通冰狼大了一倍。'
  ],
  choices: [
    { text: '守住洞口，杀出去！', result: { text: '你背靠冰壁迎战冰狼群！', battle: 'ice_wolf', exp: 130, gold: 90, damage:20 } },
    { text: '利用暴风雪掩护逃跑', cond: { speed: 25 }, result: { text: '你等暴风雪最大的时候冲了出去，风雪掩盖了你的踪迹。冰狼追了一阵就放弃了。你在风雪中迷了路，但最终找到了补给点。', exp: 70, speed: 2 } },
    { text: '把干粮扔给它们', result: { text: '你把所有干粮都扔了出去。冰狼们争抢食物的时候，你悄悄从冰洞的另一侧溜走了。虽然饿了两天肚子，但保住了命。', exp: 40, fate: 1 } }
  ]
},
{
  id: 'adv_beast_06', name: '大地之熊的咆哮', location: '星斗大森林深处',
  phase: 'master', minLevel: 30, weight: 3,
  image: 'assets/beasts/earth_bear.jpg',
  text: [
    '大地震颤起来，你几乎站不稳——一只比铁甲熊还要庞大的大地之熊从林中走出，每一步都让地面凹陷。',
    '它是千年魂兽，根本不是普通魂师能招惹的存在。它只是随意扫了你一眼，你就感觉身上像压了一座山。'
  ],
  choices: [
    { text: '立刻匍匐在地，表示臣服', result: { text: '你立刻趴在地上一动不动。大地之熊嗅了嗅你，似乎觉得你太小了不值得吃，慢悠悠地从你身边走过。你在地上趴了整整一刻钟才敢起来。', fate: 2, exp: 60 } },
    { text: '缓缓后退，退出它的领地', result: { text: '你盯着地面，用余光盯着它，一步步后退。退出它的领地时你浑身已经被冷汗浸透。', exp: 50, defense: 1 } },
    { text: '不知死活地挑战它', result: { text: '你居然冲了上去——大地之熊一掌拍下来，你像皮球一样飞了出去，撞断三棵树才停下。要不是你命大，这一掌就要了你的命。', damage:60, exp: 30, fate: -1 } }
  ]
},
{
  id: 'adv_beast_07', name: '雷鸟的俯冲', location: '落日山脉·高峰',
  phase: 'master', minLevel: 28, weight: 2,
  image: 'assets/beasts/thunder_bird.jpg',
  text: [
    '你攀上落日山脉的高峰，忽然乌云密布，雷声滚滚——不是天要下雨，是一只翼展三丈的雷鸟在云中盘旋！',
    '它发现了你，一道紫色的闪电劈下，在你脚边炸开一个大坑！'
  ],
  choices: [
    { text: '躲进山洞里避雷！', result: { text: '你连滚带爬地躲进一个山洞。雷鸟在洞外盘旋了半个时辰，发出数道雷电都被岩壁引走，最终不甘地飞走了。', exp: 60, defense: 1 } },
    { text: '拉弓/用武魂反击！', result: { text: '你等它俯冲下来时全力一击！雷鸟惨叫着坠向山谷——', battle: 'thunder_bird', exp: 140, gold: 120 } },
    { text: '往山下狂奔！', result: { text: '你玩命地往山下跑，雷鸟在后面追着你放电。你左躲右闪狼狈不堪，但最终跑出了它的领地范围。', damage:30, speed: 2, exp: 50 } }
  ]
},
{
  id: 'adv_beast_08', name: '蓝蛙的毒液', location: '星斗大森林外围·沼泽边缘',
  phase: 'adventure', minLevel: 16, weight: 2,
  image: 'assets/beasts/blue_frog.jpg',
  text: [
    '你路过一片湿地，看到一只拳头大小、通体碧蓝的青蛙蹲在荷叶上，看起来毫无威胁。',
    '但你刚要迈脚，它猛地鼓起腮帮子——一道蓝色的毒液如箭般射来！'
  ],
  choices: [
    { text: '侧身闪避，然后反击！', cond: { speed: 16 }, result: { text: '你敏捷地躲开毒液，一脚踩住了蓝蛙。它虽然毒性强但防御很低，被你轻松制服。', speed: 1, exp: 60, item: { name: '蓝蛙毒囊', type: 'misc', value: 50, count: 1 } } },
    { text: '用东西挡住毒液', result: { text: '你慌忙用背包一挡，背包瞬间被腐蚀出一个大洞。蓝蛙趁机跳进水里消失了。你损失了一些补给，但没受伤。', exp: 30 } },
    { text: '被毒液射中了！', result: { text: '你躲闪不及，毒液溅到了手臂上，一阵剧烈的灼痛传来。你赶紧运功逼毒，半个时辰后才勉强稳住，但手臂已经肿得像馒头。', damage:30, exp: 25 } }
  ]
},
{
  id: 'adv_beast_09', name: '千足蜈蚣的突袭', location: '星斗大森林外围·腐地',
  phase: 'master', minLevel: 24, weight: 2,
  image: 'assets/beasts/thousand_eye_centipede.jpg',
  text: [
    '你穿越一片腐叶地时，地面突然裂开——一条水桶粗、长满眼睛的千足蜈蚣从地下窜出！它的每一只脚都闪着寒光，千只眼睛同时盯着你。',
    '刺鼻的酸臭味扑面而来。'
  ],
  choices: [
    { text: '斩断它的身子！', result: { text: '你运起{spirit}一刀斩断蜈蚣的半截身子，但它的上半截依然凶猛——', battle: 'thousand_eye_centipede', exp: 110, gold: 80 } },
    { text: '用火攻！', result: { text: '你引燃了随身携带的火油扔向蜈蚣，它最怕火，在火焰中扭曲翻滚，最终烧成了灰烬。', exp: 80, item: { name: '蜈蚣毒牙', type: 'misc', value: 70, count: 1 } } },
    { text: '转身就跑！', result: { text: '你转身飞奔，千足蜈蚣在后面紧追不舍。你绕着大树蛇形跑了好几圈才把它甩掉，但脸被树枝划了好几道口子。', damage:15, speed: 1, exp: 40 } }
  ]
},
{
  id: 'adv_beast_10', name: '火虎的领地', location: '火山山脉·外围',
  phase: 'master', minLevel: 26, weight: 2,
  image: 'assets/beasts/flame_tiger.jpg',
  text: [
    '火山脚下的丛林温度越来越高，树叶都被烤得焦黄。一声虎啸震耳欲聋——一只浑身燃着火焰的千年火虎从岩浆池中跃出！',
    '它的每一步都在地面烧出焦黑的印记，灼热的气浪让你几乎无法呼吸。'
  ],
  choices: [
    { text: '与火虎一战！', result: { text: '热浪滔天中你冲向火虎，{spirit}与火焰碰撞出漫天火星——', battle: 'flame_tiger', exp: 150, gold: 130 } },
    { text: '利用地形周旋', cond: { speed: 26 }, result: { text: '你利用岩浆池周围的岩石和火虎周旋，不断消耗它的魂力。最终火虎因为离开岩浆池太久，火焰渐弱，你趁机给了它最后一击。', speed: 2, exp: 130, gold: 100 } },
    { text: '知难而退', result: { text: '你知道千年火虎不是现在的你能对付的，立刻撤退。火虎咆哮两声但没有追出领地范围。', exp: 40 } }
  ]
},
{
  id: 'adv_beast_11', name: ' Marmot 土拨鼠的宝藏', location: '星斗大森林外围·草原区',
  phase: 'adventure', minLevel: 15, weight: 2,
  image: 'assets/beasts/marmot.jpg',
  text: [
    '你看到一只胖乎乎的土拨鼠从地洞里钻出来，嘴里叼着一块闪闪发光的石头。它看到你，吓得"吱"的一声钻回洞里，但那块石头掉在了地上。',
    '你捡起来一看——居然是一块低品质的魂晶！'
  ],
  choices: [
    { text: '挖开洞看看还有没有', result: { text: '你挖了半个时辰，把土拨鼠的洞翻了个底朝天——又找到了三块魂晶和一些亮晶晶的石头。土拨鼠在旁边急得直叫，你有点不好意思，给它留了点干粮。', gold: 80, exp: 35, fate: 1 } },
    { text: '拿了这块就走', result: { text: '你把魂晶收好，给土拨鼠扔了一颗果子作为交换。土拨鼠探出头看了看果子，吱吱叫了两声，似乎接受了这笔交易。', gold: 30, exp: 25, fate: 1 } },
    { text: '不拿不义之财', result: { text: '你把魂晶放回洞口转身离去。走了几步回头看，土拨鼠正站在洞口歪着脑袋看你，然后叼起魂晶钻回了洞里。', fate: 2, exp: 15 } }
  ]
},
{
  id: 'adv_beast_12', name: '野兔群的骚动', location: '星斗大森林外围·草原区',
  phase: 'adventure', minLevel: 14, weight: 2,
  image: 'assets/beasts/wild_rabbit.jpg',
  text: [
    '前方的草丛忽然炸开，上百只野兔疯了一样向你这边奔来，像是在躲避什么可怕的东西。',
    '兔群后面，一只三眼灵兔（百年魂兽）正不紧不慢地追赶着，它的第三只眼闪烁着诡异的红光。'
  ],
  choices: [
    { text: '拦截三眼灵兔！', result: { text: '你亮开武魂挡住三眼灵兔，它恼怒地向你发动了精神冲击——', battle: 'wild_rabbit', exp: 70, gold: 40 } },
    { text: '让开道路让野兔逃走', result: { text: '你闪到一边让野兔群通过，然后悄悄跟在三眼灵兔后面观察。你发现它的精神攻击有三秒的间隔，这个知识以后会有用。', exp: 40, fate: 1 } },
    { text: '顺手抓两只野兔当晚餐', result: { text: '你随手抓了两只肥兔，当晚在营地烤得油光锃亮。虽然没有和百年魂兽交手，但这顿兔肉真是人间美味。', hp: 40, exp: 20 } }
  ]
},
{
  id: 'adv_beast_13', name: '黑水河的蛟龙', location: '星斗大森林深处·黑水河',
  phase: 'master', minLevel: 35, weight: 2,
  image: 'assets/beasts/black_water_dragon.jpg',
  text: [
    '你来到黑水河渡口，河水漆黑如墨，散发着淡淡的腥味。老船工告诉你，河里有一条黑水蛟龙出没，已经吞了好几艘船了。',
    '你站在岸边，河面忽然翻涌起来，一条黑色的龙形生物的脊背露出水面，像一道移动的堤坝。'
  ],
  choices: [
    { text: '渡河，挑战蛟龙！', result: { text: '你跳上一艘小船向河心划去——黑水蛟龙破水而出！', battle: 'black_water_dragon', exp: 200, gold: 200, fate: 1 } },
    { text: '绕路走桥', result: { text: '你绕了三天的路从上游的石桥过了河。虽然多花了时间，但安全第一。路上你还采到了几株灵药。', item: { name: '回魂丹', type: 'heal', value: 60, count: 2 }, exp: 50 } },
    { text: '帮老船工清理河道', result: { text: '你决定帮老船工解决这个问题。你联合了三个路过的魂师一起设下陷阱，虽然没有杀死蛟龙，但把它赶到了下游。老船工免费摆渡你过河，还送了你一包河鲜。', gold: 50, fate: 2, exp: 100 } }
  ]
},
{
  id: 'adv_beast_14', name: '暗魔邪神虎的幼崽', location: '星斗大森林深处·禁忌区边缘',
  phase: 'master', minLevel: 40, weight: 1,
  image: 'assets/beasts/evil_demon_tiger_shark.jpg',
  text: [
    '你在禁忌区边缘发现了一只幼崽——一只通体漆黑、额头有紫色纹路的小老虎，它的腿被猎人的陷阱夹住了，发出哀鸣。',
    '你认出这是暗魔邪神虎的幼崽！这是顶级邪魂兽，但它现在只是一只无助的小兽。'
  ],
  choices: [
    { text: '放了它，帮它治伤', result: { text: '你打开陷阱，用伤药给它包扎。幼崽舔了舔你的手，然后一瘸一拐地走进了密林。几个月后你再经过这里，发现一只巨大的暗魔邪神虎远远看着你，然后转身离去，没有攻击你。', fate: 3, exp: 80 } },
    { text: '杀了它，以绝后患', result: { text: '你举起武器——但看着它湿漉漉的眼睛，你怎么也下不了手。最终你还是放了它。', fate: 1, exp: 40 } },
    { text: '带走它，驯化为己用', result: { text: '你试图带走幼崽，但远处传来一声震天虎啸——成年邪神虎来了！你吓得魂飞魄散，丢下幼崽狂奔而逃，差点丢了性命。', damage:40, exp: 30, fate: -1 } }
  ]
},
// ---- 城镇与人文 ----
{
  id: 'adv_town_01', name: '天斗城的夜市', location: '天斗城·夜市',
  phase: 'adventure', weight: 2,
  image: 'assets/scenes/wuhun_city.jpg',
  text: [
    '你第一次来到天斗城，夜晚的街市灯火通明，叫卖声、吆喝声、笑声交织成一片。各种小吃的香气让你肚子咕咕叫。',
    '路边有卖糖人的、卖艺的、算命的……热闹非凡。'
  ],
  choices: [
    { text: '敞开了吃！', result: { text: '你一路吃过去，糖葫芦、烤肉串、桂花糕、灵果酿……吃到肚子滚圆才停下。虽然花了不少金币，但这是你吃过最爽的一顿。', hp: 40, gold: -30, exp: 15 } },
    { text: '看看卖艺人的表演', result: { text: '你围观了一个魂师卖艺团的表演，他们的武魂组合技让你大开眼界。你投了几枚金币，还学到了一个小技巧。', gold: -10, attack: 1, exp: 30 } },
    { text: '找个算命先生算算', result: { text: '一个白胡子算命先生看了你的手相，沉吟道："你命格奇特，将来必成大器，但情关难过啊……"你半信半疑地付了钱，他的话让你若有所思。', gold: -20, fate: 1, exp: 20 } }
  ]
},
{
  id: 'adv_town_02', name: '客栈的怪客', location: '天斗城·悦来客栈',
  phase: 'adventure', weight: 2,
  image: 'assets/scenes/tavern.jpg',
  text: [
    '你在客栈投宿，深夜被隔壁的打斗声惊醒。你悄悄捅破窗户纸一看——一个黑衣人正在和一个蒙面人交手，桌上放着一个锦盒。',
    '两人打得激烈，锦盒滑到了你的窗下。'
  ],
  choices: [
    { text: '捡走锦盒', result: { text: '你悄悄伸手把锦盒勾了进来，打开一看是一本残缺的魂技秘籍！你连夜离开客栈，找了个安全的地方研究，学会了一招实用的魂技。', attack: 3, exp: 60 } },
    { text: '出声示警', result: { text: '你大喊"有刺客！"两个黑衣人一惊，双双跳窗逃走。店家上来道谢，免了你三天房钱。', gold: 0, fate: 1, exp: 25 } },
    { text: '装睡不管', result: { text: '你用被子蒙住头假装睡着。打斗声很快消失了，第二天一切如常。你不知道那锦盒里是什么，也不想知道。', exp: 10 } }
  ]
},
{
  id: 'adv_town_03', name: '悬赏榜', location: '天斗城·魂师公会',
  phase: 'adventure', weight: 3,
  image: 'assets/scenes/wuhun_city.jpg',
  text: [
    '魂师公会的悬赏榜前围满了人。榜上贴着各种委托：采药、护送、除害、寻人……报酬从几十到几千金币不等。',
    '你的目光停留在三个委托上。'
  ],
  choices: [
    { text: '接采集灵药的委托（简单）', result: { text: '你去城外采了三株指定的灵药，轻松完成了委托。虽然报酬不高，但胜在安全。', gold: 50, exp: 30 } },
    { text: '接护送商队的委托（中等）', result: { text: '你护送商队走了一趟，路上遇到两波山贼，都被你击退了。商队老板额外给了你赏金。', gold: 150, damage:20, exp: 80, fate: 1 } },
    { text: '接除害的委托（困难）', cond:{level:20}, requirementHint:'等级达到 Lv.20', result: { text: '你接了猎杀祸害村庄的百年魂兽的委托。这是一场苦战——', battle: 'one_eye_wolf', gold: 300, exp: 120, damage:30, fate: 2 } }
  ]
},
{
  id: 'adv_town_04', name: '药师的委托', location: '天斗城·药铺',
  phase: 'adventure', weight: 2,
  image: 'assets/scenes/border_town.jpg',
  text: [
    '药铺的老药师愁眉不展：他急需三味药材来炼一颗紧急的救命丹，但其中一位学徒把药方弄丢了，只记得药材长在三种不同的地方。',
    '"小魂师，你能帮我在日落前采回来吗？报酬是三颗回魂丹！"'
  ],
  choices: [
    { text: '接下委托，争分夺秒！', result: { text: '你跑了三个地方，在太阳落山前的最后一刻把三味药材都送到了。老药师激动得手都在抖，不仅给了你回魂丹，还多给了一瓶解毒散。', item: { name: '回魂丹', type: 'heal', value: 80, count: 3 }, item2: { name: '解毒散', type: 'misc', value: 40, count: 1 }, exp: 70, fate: 2 } },
    { text: '时间太紧了，算了', result: { text: '你觉得时间不够用，婉拒了。后来听说老药师找了别人帮忙，总算赶在 deadline 前炼成了丹药。你松了口气，但也有点遗憾。', exp: 10 } }
  ]
},
{
  id: 'adv_town_05', name: '黑市', location: '天斗城·地下黑市',
  phase: 'adventure', weight: 1,
  image: 'assets/scenes/auction_house.jpg',
  text: [
    '你在一条暗巷里被一个独眼汉子拦住："小兄弟，好东西要不要看看？"他把你领进了一个地下集市——这里是黑市！',
    '各种违禁品、稀有材料、甚至禁术秘籍都在偷偷交易。一个摊位上摆着一颗散发黑气的丹药，老板神秘地说："噬魂丹，吃了涨十年功力，只要500金币！"'
  ],
  choices: [
    { text: '买噬魂丹（500金币）', cond: { gold: 500 }, cost: { gold: 500 }, result: { text: '你买了那颗丹药，回到客栈仔细一看——只是一颗加了颜料的普通补气丹！你气得差点把桌子掀了。黑市果然没好货！', exp: 20, fate: -1 } },
    { text: '买一块稀有魂铁（200金币）', cond: { gold: 200 }, cost: { gold: 200 }, result: { text: '你花200金币买了一块不起眼的黑铁块。后来铁匠看了说这是罕见的寒铁，帮你打造时武器攻击力提升了一大截。', attack: 3, exp: 50 } },
    { text: '不买东西，随便看看', result: { text: '你转了一圈什么都没买。出门时你看到城守的人在搜捕黑市贩子，你悄悄溜了。这种地方还是少来为妙。', exp: 15 } }
  ]
},
// ---- 秘境与遗迹 ----
{
  id: 'adv_ruin_01', name: '剑冢', location: '上古遗迹·剑冢',
  phase: 'master', minLevel: 22, weight: 2,
  image: 'assets/scenes/temple.jpg',
  text: [
    '你在探索一处遗迹时发现了一个地下洞窟——里面插满了各式各样的古剑，锈迹斑斑，断折大半。这是一处古代剑冢！',
    '洞窟最深处的石台上，插着一柄完好的长剑，剑身泛着淡淡青光。'
  ],
  choices: [
    { text: '拔起那柄青剑！', result: { text: '你握住剑柄用力一拔——剑光暴涨，你被震得退了三步，但剑到手了！这是一柄注入了魂师残念的灵剑，攻击力大幅提升！', attack: 4, exp: 90, fate: 1 } },
    { text: '在剑冢中打坐感悟', result: { text: '你在万千古剑中间打坐，感受着残留的剑意。三个时辰后你睁开眼，对剑的理解深了一层。', attack: 2, spiritPowerGain: 3, exp: 70 } },
    { text: '拿走几把好剑出去卖', result: { text: '你挑了三把还算完好的古剑背了出去，在古董店卖了一笔金币。虽然没有得到什么机缘，但实实在在赚了一笔。', gold: 200, exp: 30 } }
  ]
},
{
  id: 'adv_ruin_02', name: '魂骨殿', location: '上古遗迹·魂骨殿',
  phase: 'master', minLevel: 30, weight: 2,
  image: 'assets/scenes/temple.jpg',
  text: [
    '你推开一扇沉重的石门，里面是一个六边形的大殿，六个方向各有一个石台，上面分别放着不同部位的魂骨！',
    '但大殿中央刻着一行古字："只可取一，贪则死。"'
  ],
  choices: [
    { text: '取头部魂骨', result: { text: '你恭敬地向其他石台行礼，取走了头部魂骨。一股暖流涌入头颅，你的精神力大幅增强！', spiritPowerGain: 10, exp: 150, fate: 2 } },
    { text: '取右臂魂骨', result: { text: '你取走右臂魂骨，右臂瞬间充满了爆炸性的力量！', attack: 6, exp: 150, fate: 1 } },
    { text: '取左腿魂骨', result: { text: '你取走左腿魂骨，双腿轻盈得像要飘起来！', speed: 6, exp: 150, fate: 1 } },
    { text: '太贪了，多拿几块', result: { text: '你忍不住拿了两块——大殿剧烈震动，箭矢从四面八方射来！你连滚带爬地逃出去，只带出一块魂骨，还中了两箭。', damage:40, attack: 2, exp: 80, fate: -2 } }
  ]
},
{
  id: 'adv_ruin_03', name: '丹房', location: '上古遗迹·丹房',
  phase: 'master', minLevel: 20, weight: 2,
  image: 'assets/scenes/temple.jpg',
  text: [
    '遗迹中的丹房保存完好，丹炉里还有余温，仿佛炼丹的人才刚刚离开。',
    '药架上摆着几个玉瓶，有的贴着标签，有的标签已经模糊不清了。'
  ],
  choices: [
    { text: '拿标签清晰的丹药', result: { text: '你拿了标签写着"回魂""聚气"的丹药，一共五瓶。这些丹药品质远超市面上的普通货。', item: { name: '回魂丹', type: 'heal', value: 100, count: 5 }, exp: 50 } },
    { text: '试试标签模糊的丹药', result: { text: '你打开一个标签模糊的玉瓶闻了闻——好香！你吃了一颗，感觉魂力暴涨了一截，但也拉了三天肚子。', spiritPowerGain: 5, damage:20, exp: 60 } },
    { text: '不拿东西，研究丹方', result: { text: '你在丹炉边发现了一本《丹经》，上面记载了几种失传丹方。你把丹方抄录下来，以后学炼药时大有用处。', exp: 70, fate: 1 } }
  ]
},
// ---- 奇遇与奇缘 ----
{
  id: 'adv_enc_01', name: '受伤的旅人', location: '天斗帝国·官道',
  phase: 'adventure', weight: 2,
  image: 'assets/scenes/border_town.jpg',
  text: [
    '你在官道上发现一个倒在血泊中的旅人，他胸口有一道深可见骨的刀伤，气息微弱。',
    '他穿着不俗，腰间挂着一个特殊的令牌——似乎是某个大宗门的人。'
  ],
  choices: [
    { text: '救人一命！', cond: { item:'回魂丹', itemCount:1 }, result: { text: '你用伤药和回魂丹救了他的命。他感激涕零，原来是七宝琉璃宗的外门弟子。他送了你一块令牌，说以后到七宝琉璃宗可以找他帮忙。', item: { name: '回魂丹', type: 'heal', value: 80, count: -1 }, fate: 3, exp: 60 } },
    { text: '搜他身上的东西', result: { text: '你趁他昏迷搜走了他的钱袋和令牌。刚要走，他醒了过来，用怨毒的眼神看着你。你心里一寒，匆匆离开了。后来你听说七宝琉璃宗在追查一个抢劫伤员的小贼……', gold: 100, fate: -3, exp: 10 } },
    { text: '没带药，帮他找大夫', result: { text: '你跑到最近的城镇找来大夫，还垫付了医药费。旅人醒来后千恩万谢，虽然你没要他的报酬，但他记住了你的名字。', gold: -30, fate: 2, exp: 40 } }
  ]
},
{
  id: 'adv_enc_02', name: '暴风雨中的破庙', location: '天斗帝国·山神庙',
  phase: 'adventure', weight: 2,
  image: 'assets/scenes/border_town.jpg',
  text: [
    '天降暴雨，你躲进一间破旧的山神庙避雨。庙里已经有一个人了——一个穿着蓑衣的汉子，抱着一把锈迹斑斑的大刀在打瞌睡。',
    '外面的雨越下越大，电闪雷鸣。汉子忽然睁开眼，看着你说了一句："小友，要不要听个故事？"'
  ],
  choices: [
    { text: '洗耳恭听', result: { text: '汉子讲了一个年轻时闯荡江湖的故事，讲到最后他说："记住，刀是用来保护人的，不是用来杀人的。"雨停后他飘然而去，你发现他坐过的地方留下了一本刀谱。', attack: 2, exp: 60, fate: 1 } },
    { text: '婉拒，独自修炼', result: { text: '你礼貌地拒绝了，在角落打坐修炼。汉子也不恼，自顾自地喝酒。雨停后你离开了，总觉得错过了什么。', spiritPowerGain: 2, exp: 25 } },
    { text: '他看起来很厉害，求他指点', result: { text: '你跪下来求他指点几招。汉子愣了一下，哈哈大笑，当场教了你三招基础刀法。这三招看似简单，但实战中非常管用。', attack: 3, exp: 70 } }
  ]
},
{
  id: 'adv_enc_03', name: '江面上的画舫', location: '天斗帝国·大运河',
  phase: 'adventure', weight: 1,
  image: 'assets/scenes/sea_god_island.jpg',
  text: [
    '你乘船渡江时，一艘华丽的画舫从旁边驶过。舫上琴声悠扬，一个白衣女子正临窗抚琴，看到你时冲你微微颔首。',
    '画舫驶过后，你发现船板上多了一支玉笛和一张纸条："笛声三弄，有缘再会。"'
  ],
  choices: [
    { text: '收下玉笛，以后有机会去找她', result: { text: '你收好玉笛，吹了一下，音色清越。虽然不知道她是谁，但你觉得以后一定还会见面。', fate: 2, exp: 30 } },
    { text: '这是邪术，扔了！', result: { text: '你把玉笛扔进了江里。当天晚上你做了个梦，梦见那个白衣女子叹息了一声。醒来后你有点后悔。', fate: -1, exp: 10 } },
    { text: '试着吹奏一曲', result: { text: '你试着吹了一曲家乡的小调。奇怪的是，吹完后你感觉神清气爽，魂力运转更加顺畅了。', spiritPowerGain: 3, exp: 40 } }
  ]
},
{
  id: 'adv_enc_04', name: '猎户的警告', location: '星斗大森林外围·边缘村落',
  phase: 'adventure', weight: 2,
  image: 'assets/scenes/forest_outer.jpg',
  text: [
    '你借宿在一个猎户家。老猎户警告你："最近森林里不太平，晚上千万别出去，尤其是听到有人喊你名字的时候，千万别答应！"',
    '当天深夜，你果然听到门外有个声音在叫你的名字，声音像极了你的母亲。'
  ],
  choices: [
    { text: '不答应，蒙头睡觉', result: { text: '你用被子蒙住头，一声不吭。那个声音在外面转了半个时辰终于消失了。第二天老猎户说那是"人面魔蛛"在模仿人声诱捕猎物。你惊出一身冷汗。', fate: 1, exp: 30 } },
    { text: '开门看看', result: { text: '你忍不住打开了门——一张巨大的蜘蛛脸就在门外！你连滚带爬地退回屋里关上门，人面魔蛛在外面撞了半天门才离开。你吓得腿都软了。', damage:20, exp: 25 } },
    { text: '从窗户偷偷看一眼', result: { text: '你从窗缝往外看，看到了一只巨大的人面魔蛛在模仿人声。你记住了它的模样和习性，以后遇到就知道怎么对付了。', exp: 40, defense: 1 } }
  ]
}
);

// ==================== 八、学院篇补全（季节/夜晚/考试/社交/冒险/特殊） ====================
EVENTS.push(
// ---- 学院·季节与天气类 ----
{
  id: 'ac_season_01', name: '初雪', location: '史莱克学院·校园',
  phase: 'academy', weight: 1,
  image: 'assets/scenes/snow_mountain.jpg',
  text: [
    '今年的第一场雪悄然而至。清晨推开窗，整个学院银装素裹，美得不似人间。',
    '同学们在雪地里打雪仗、堆雪人，欢声笑语一片。'
  ],
  choices: [
    { text: '和大家一起打雪仗！', result: { text: '你和同学们在雪地里疯玩了一上午，虽然被砸了好几个雪球，但笑得肚子都疼了。', hp: 20, exp: 15, fate: 1 } },
    { text: '在雪中修炼，感悟冰之意境', result: { text: '你独自站在雪中运转魂力，雪花落在你身上却不融化。你隐约触摸到了冰属性魂力的门槛。', spiritPowerGain: 4, exp: 30 } },
    { text: '煮一壶热茶赏雪', result: { text: '你在窗边煮了一壶热茶，看着雪花纷纷扬扬落下。宁静祥和，心境平和了许多。', mp: 30, exp: 15 } }
  ]
},
{
  id: 'ac_season_02', name: '春游', location: '史莱克学院·郊外',
  phase: 'academy', weight: 1,
  image: 'assets/scenes/forest_outer.jpg',
  text: [
    '春暖花开，学院组织春游。大家背着干粮来到郊外的草地上，野花遍地，蝴蝶飞舞。',
    '大师破例允许今天不修炼，好好玩一天。'
  ],
  choices: [
    { text: '和同学们一起野餐游戏', result: { text: '你们分享食物、讲故事、比赛跑步，玩得不亦乐乎。这是你入学以来最开心的一天。', hp: 30, fate: 2, exp: 15 } },
    { text: '独自在附近探索', result: { text: '你一个人在附近溜达，发现了一株长在石缝里的罕见草药，带回学院后炼药课老师给了你高分。', item: { name: '回魂丹', type: 'heal', value: 50, count: 1 }, exp: 25 } },
    { text: '躺在草地上晒太阳睡午觉', result: { text: '你找了个舒服的地方躺下，温暖的阳光洒在身上，你一觉睡到了集合时间。神清气爽！', hp: 40, mp: 20, exp: 10 } }
  ]
},
{
  id: 'ac_season_03', name: '盛夏纳凉', location: '学院·清水湖',
  phase: 'academy', weight: 1,
  image: 'assets/scenes/sea_god_island.jpg',
  text: [
    '盛夏的夜晚酷热难耐，你和几个同学偷偷溜到学院后面的清水湖乘凉。',
    '湖水清凉，月光洒在水面上，像撒了一层碎银子。'
  ],
  choices: [
    { text: '下水游泳！', result: { text: '你们在湖里打水仗、比赛游泳，清凉的水洗去了一身暑气。被巡夜的老师发现后集体罚站，但大家都觉得值了。', hp: 25, speed: 1, exp: 15 } },
    { text: '坐在湖边聊天看星星', result: { text: '你们坐在湖边聊理想、聊未来，直到东方泛白。这个夜晚，成了你多年后最珍贵的回忆之一。', fate: 2, exp: 20 } },
    { text: '在湖边打坐修炼', result: { text: '你选了块光滑的大石头坐下修炼。月华如水，你的魂力在清凉的夜气中运转得格外顺畅。', spiritPowerGain: 4, exp: 25 } }
  ]
},
{
  id: 'ac_season_04', name: '秋日落叶', location: '史莱克学院·银杏道',
  phase: 'academy', weight: 1,
  image: 'assets/scenes/mountain_path.jpg',
  text: [
    '秋天来了，学院那条种满银杏树的小路变成了金色的海洋。风吹过，落叶如雨。',
    '你踩着厚厚的落叶走过，心里忽然涌起一种说不出的感动。'
  ],
  choices: [
    { text: '捡一片最美的落叶做书签', result: { text: '你挑了一片最完整的金色银杏叶夹在书里。很多年后翻开这本书，你依然会想起这个秋天。', fate: 1, exp: 10 } },
    { text: '在落叶中修炼掌法', result: { text: '你在落叶中施展掌法，掌风卷起漫天金叶。你忽然悟到了"刚柔并济"的道理。', attack: 2, exp: 30 } },
    { text: '扫落叶攒着烧火', result: { text: '你找来扫帚把落叶扫成一堆，晚上和同学们在篝火边烤红薯。大家的笑脸比篝火还暖。', hp: 20, fate: 1, exp: 15 } }
  ]
},
// ---- 学院·师生互动类 ----
{
  id: 'ac_teacher_01', name: '大师的茶', location: '史莱克学院·大师书房',
  phase: 'academy', weight: 1,
  image: 'assets/scenes/academy_classroom.jpg',
  text: [
    '大师把你叫到书房，给你倒了一杯茶。茶香袅袅中，他问你："{name}，你觉得魂师修炼最重要的是什么？"',
    '这个问题看似简单，却让你一时语塞。'
  ],
  choices: [
    { text: '天赋', result: { text: '大师摇头："天赋决定起点，心性决定终点。"他给你讲了很多天赋平平但成就非凡的魂师故事。你受益匪浅。', exp: 35, spiritPowerGain: 2 } },
    { text: '努力', result: { text: '大师点头又摇头："努力是必须的，但方向错了，越努力离目标越远。"他给你分析了你的武魂特点和适合的发展方向。', exp: 40, attack: 1 } },
    { text: '伙伴', result: { text: '大师笑了："你能这么想，很好。一个人走得快，一群人走得远。"他的眼神有些悠远，似乎想起了什么往事。', fate: 2, exp: 30 } }
  ]
},
{
  id: 'ac_teacher_02', name: '被罚抄书', location: '史莱克学院·教室',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/academy_classroom.jpg',
  text: [
    '你因为上课打瞌睡被大师抓了个正着，罚你抄《魂师基础守则》一百遍。',
    '夜幕降临，教室里只剩你一个人在奋笔疾书。'
  ],
  choices: [
    { text: '认真抄，顺便记住内容', result: { text: '你一边抄一边理解，抄到第五十遍时发现这些基础守则竟然蕴含着很多以前没注意到的道理。抄完一百遍，你对修炼的理解更深了。', exp: 30, spiritPowerGain: 1 } },
    { text: '想办法偷懒，两支笔一起抄', cond: { speed: 10 }, result: { text: '你灵机一动用两支笔同时写，效率翻倍。虽然字丑了点，但总算按时抄完了。', exp: 10, speed: 1 } },
    { text: '抄到睡着', result: { text: '你抄着抄着趴在桌上睡着了，第二天被大师发现，惩罚加倍——两百遍。你欲哭无泪。', exp: 5, damage:5 } }
  ]
},
{
  id: 'ac_teacher_03', name: '代课老师', location: '史莱克学院·教室',
  phase: 'academy', weight: 1,
  image: 'assets/scenes/academy_classroom.jpg',
  text: [
    '大师有事外出，请了一位神秘的代课老师。来的人居然是一位穿着红衣的女子，她笑得像狐狸一样："小家伙们，今天我来教你们点好玩的。"',
    '她的课和大师完全不同，不讲理论，直接实战！'
  ],
  choices: [
    { text: '积极举手第一个上', result: { text: '你第一个站出来和她对练，三招就被放倒了，但她指出了你三个致命的坏习惯。你心服口服。', attack: 2, exp: 40, damage:10 } },
    { text: '先观察别人再上', result: { text: '你仔细观察她和其他同学的对练，总结出她的出招规律。轮到你时居然接了她五招！她惊讶地挑了挑眉。', speed: 2, exp: 35 } },
    { text: '躲在后面不想被点名', result: { text: '你缩在最后一排，可惜她眼光毒辣，还是点到了你。你硬着头皮上，被打得最惨。', damage:15, exp: 20 } }
  ]
},
// ---- 学院·夜晚事件 ----
{
  id: 'ac_night_01', name: '月光下的武魂', location: '史莱克学院·操场',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/training_ground.jpg',
  text: [
    '半夜你睡不着，独自来到操场。月光下，你发现{spirit}似乎和平时不太一样，表面流淌着淡淡的银光。',
    '书上说，武魂在月光下会产生特殊的共鸣，但这种现象只有极少数人能遇到。'
  ],
  choices: [
    { text: '抓住机会，月光下修炼！', result: { text: '你运转魂力与月光呼应，{spirit}的光芒越来越盛。等你收功时，东方已经发白，但魂力足足增长了一截！', spiritPowerGain: 6, exp: 40 } },
    { text: '安静地和{spirit}待一会儿', result: { text: '你没有修炼，只是静静地感受{spirit}的存在。你第一次觉得，它不只是武器，更是你最亲密的伙伴。', fate: 2, exp: 20 } }
  ]
},
{
  id: 'ac_night_02', name: '奇怪的梦境', location: '史莱克学院·宿舍',
  phase: 'academy', weight: 1,
  image: 'assets/scenes/library_night.jpg',
  text: [
    '你做了一个奇怪的梦：梦里你站在一片金色的海洋上，远处有一个模糊的身影在向你招手。',
    '你想走过去，但怎么也动不了。那个身影似乎在说什么，你听不清。'
  ],
  choices: [
    { text: '努力听清他在说什么', result: { text: '你集中精神，隐约听到"……九考……传承……"几个字。醒来后你满头大汗，但感觉{spirit}多了一丝温热的气息。', fate: 2, spiritPowerGain: 2, exp: 25 } },
    { text: '拼命向他跑去', result: { text: '你用尽全身力气向那个身影跑去，就在快要触碰到的时候——你醒了。窗外天刚蒙蒙亮，你觉得身体轻盈了许多。', speed: 2, exp: 20 } },
    { text: '被噩梦惊醒', result: { text: '你挣扎着从梦中醒来，心跳得飞快。喝了杯水平复心情后，你再也睡不着了。', mp: -10, exp: 10 } }
  ]
},
{
  id: 'ac_night_03', name: '流星', location: '学院·宿舍屋顶',
  phase: 'academy', weight: 1,
  image: 'assets/scenes/mountain_path.jpg',
  text: [
    '你在屋顶乘凉时，一颗明亮的流星划过夜空，拖出长长的光尾。',
    '据说对着流星许愿会成真。你来不及多想，双手合十许下心愿。'
  ],
  choices: [
    { text: '许愿成为最强魂师', result: { text: '你许下雄心壮志。流星划过天际的那一刻，你感觉{spirit}微微震动了一下，像是在回应你的决心。', attack: 1, exp: 20, fate: 1 } },
    { text: '许愿家人平安', result: { text: '你许下最朴素的愿望。流星的光芒似乎柔和了几分，你心里暖洋洋的。', fate: 3, exp: 15 } },
    { text: '许愿今天的作业别被检查', result: { text: '你许下了一个"务实"的愿望。第二天大师果然忘了检查作业。你不知道是流星灵验了还是巧合。', exp: 10 } }
  ]
},
// ---- 学院·比赛与考试类 ----
{
  id: 'ac_exam_01', name: '实战考试', location: '史莱克学院·比武场',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/arena.jpg',
  text: [
    '期末实战考试，你的对手是班里最强壮的同学。他的武魂是铁甲熊，防御惊人。',
    '裁判宣布开始，他已经亮出身披铁甲的武魂，像一座小山一样压了过来。'
  ],
  choices: [
    { text: '硬碰硬，正面硬刚！', cond: { attack: 13 }, result: { text: '你毫无畏惧地迎上去，{spirit}和铁甲熊碰撞出耀眼的火花！二十回合后，你以一招险胜。全班欢呼！', attack: 2, exp: 50, fate: 1 } },
    { text: '以柔克刚，游走消耗', cond: { speed: 12 }, result: { text: '你不跟他硬拼，凭借身法绕着他转，等他力竭时一击制胜。大师在记录本上写了什么，冲你点了点头。', speed: 1, exp: 45 } },
    { text: '主动认输，保留实力', result: { text: '你知道打不过，干脆举手认输。虽然输了考试，但保存了体力。大师课后告诉你："知道什么时候该认输，也是智慧。"', defense: 1, exp: 20 } }
  ]
},
{
  id: 'ac_exam_02', name: '野外生存考试', location: '星斗大森林外围',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/forest_outer.jpg',
  text: [
    '野外生存考试要求：一个人在森林外围独自生存三天，不许带食物，只能带一壶水和一把匕首。',
    '你站在森林入口，深吸一口气走了进去。'
  ],
  choices: [
    { text: '先找水源和庇护所', result: { text: '你用课堂上学到的知识搭建了简易庇护所，找到了清泉，还设陷阱抓到了一只山鸡。三天后你精神饱满地走出森林，大师给了你优等评价。', defense: 1, exp: 50, fate: 1 } },
    { text: '边找吃的边修炼', result: { text: '你把生存考试当成了修炼机会，在觅食的同时运转魂力。虽然饿了几顿，但修为意外地精进了。', spiritPowerGain: 3, exp: 40, damage:10 } },
    { text: '迷路了，差点出不来', result: { text: '你第一天就迷了路，在森林里转了两天两夜。第三天被搜救的老师找到时，你浑身是伤但活着出来了。大师说："活着就是满分。"', damage:25, exp: 25 } }
  ]
},
// ---- 学院·社交类 ----
{
  id: 'ac_social_01', name: '被同学请教', location: '史莱克学院·自习室',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/academy_classroom.jpg',
  text: [
    '一个同学红着脸来找你："{name}，这道魂力学的题我怎么都弄不明白，你能给我讲讲吗？"',
    '这道题你也是花了很久才搞懂的。'
  ],
  choices: [
    { text: '耐心给他讲明白', result: { text: '你用最通俗的方式给他讲了两遍，他终于懂了，感激得不行。帮人的过程中你自己对知识点的理解也更深了。', exp: 25, fate: 2 } },
    { text: '给他看你的笔记让他自己抄', result: { text: '你把笔记借给他抄。他道了谢就走了。省了时间，但你总觉得少了点什么。', exp: 10 } },
    { text: '我也不会，你问别人吧', result: { text: '你撒谎说自己也不会。他失望地走了。你有点愧疚，下次他再也没来问过你。', fate: -1, exp: 5 } }
  ]
},
{
  id: 'ac_social_02', name: '同学吵架', location: '史莱克学院·食堂',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/cafeteria.jpg',
  text: [
    '食堂里两个同学因为一点小事吵了起来，越吵越凶，眼看就要动手。周围的人有的起哄，有的躲开。',
    '你正好坐在旁边。'
  ],
  choices: [
    { text: '站出来劝架', result: { text: '你硬着头皮站到两人中间，费尽口舌总算把他们劝开了。虽然被推了好几下，但事后两人都来向你道谢。', fate: 2, exp: 20 } },
    { text: '去找老师来处理', result: { text: '你飞快地跑去叫来了大师。大师赶到时制止了冲突，夸你冷静。', fate: 1, exp: 15 } },
    { text: '看热闹不嫌事大', result: { text: '你和其他人一起起哄。结果两人真打了起来，还误伤了你。大师把起哄的人都批评了一顿。', damage:10, fate: -1, exp: 5 } }
  ]
},
{
  id: 'ac_social_03', name: '被人嫉妒', location: '史莱克学院·走廊',
  phase: 'academy', weight: 1,
  image: 'assets/scenes/academy_classroom.jpg',
  text: [
    '因为你最近进步很快，有几个同学在背后说你坏话，说你"肯定是靠关系"、"武魂也就那样"。',
    '这些话传到了你耳朵里。'
  ],
  choices: [
    { text: '不予理会，用实力说话', result: { text: '你把这些闲言碎语当作耳旁风，更加努力修炼。下次考核你拿了第一，那些议论声自然消失了。', attack: 1, exp: 30, fate: 1 } },
    { text: '当面质问他们', result: { text: '你直接找到他们对质，他们被你的气势吓住了，支支吾吾说不出话来。虽然有点冲动，但再也没人背后说你了。', exp: 15, fate: 1 } },
    { text: '很难过，找大师倾诉', result: { text: '大师告诉你："雄鹰不会因为麻雀的聒噪而停下飞翔。"他的话让你豁然开朗。', spiritPowerGain: 2, exp: 25 } }
  ]
},
// ---- 学院·小冒险类 ----
{
  id: 'ac_adv_01', name: '后山的山洞', location: '史莱克学院·后山',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/forest_outer.jpg',
  text: [
    '你在后山发现了一个隐蔽的山洞，洞口被藤蔓遮住，里面黑漆漆的，传来滴水声。',
    '一股若有若无的灵气从洞口飘出。'
  ],
  choices: [
    { text: '进去一探究竟！', result: { text: '你点亮火把走进山洞，发现洞壁上刻着一套古老的拳法图谱！你照着练了几遍，居然威力不俗。', attack: 2, exp: 40 } },
    { text: '做好准备下次再来', result: { text: '你记住位置，回去准备了绳索、火把和伤药。第二次来探索时虽然没找到宝藏，但安全第一总是对的。', exp: 20, fate: 1 } },
    { text: '太黑了，不去了', result: { text: '你决定不冒险。几天后你再去看，山洞因为下雨塌方了，入口被堵死了。', exp: 5 } }
  ]
},
{
  id: 'ac_adv_02', name: '河边的垂钓老人', location: '学院外·小河边',
  phase: 'academy', weight: 1,
  image: 'assets/scenes/mountain_path.jpg',
  text: [
    '你在学院外的河边散步，看到一个白发老人在钓鱼。他的鱼篓是空的，但他一脸悠闲自得。',
    '"小朋友，要不要来陪老头子我钓会儿鱼？"他笑着招呼你。'
  ],
  choices: [
    { text: '陪他钓鱼聊天', result: { text: '你陪老人钓了一下午鱼，虽然一条都没钓到，但听他讲了很多江湖趣闻和修炼心得。临走时他送了你一枚用鱼骨雕的小挂件。', item: { name: '鱼骨佩', type: 'misc', value: 30, count: 1 }, fate: 2, exp: 35 } },
    { text: '我还要修炼，告辞了', result: { text: '你礼貌地告辞了。老人笑了笑没说话。后来你才听说，那老人是学院退休的某位封号斗罗。', exp: 10 } },
    { text: '钓鱼有什么意思，我帮你抓鱼！', result: { text: '你跳进河里摸了好几条大鱼上来。老人笑得胡子都翘起来了，当场生火烤鱼。那是你吃过最好吃的烤鱼。', hp: 25, exp: 20, fate: 1 } }
  ]
},
{
  id: 'ac_adv_03', name: '走失的小孩', location: '学院旁·小镇',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/border_town.jpg',
  text: [
    '你在镇上买东西时，一个哭哭啼啼的小孩拉住你的衣角："哥哥/姐姐，我找不到娘了……"',
    '孩子太小，说不清楚家住哪里，只知道家门口有一棵大槐树。'
  ],
  choices: [
    { text: '帮他找家人！', result: { text: '你牵着小孩找了大半个镇子，终于在一棵大槐树下找到了焦急的母亲。她千恩万谢，硬塞给你一篮鸡蛋。', hp: 20, fate: 2, exp: 20 } },
    { text: '交给镇上的巡卫', result: { text: '你把孩子交给了巡卫。巡卫夸你懂事，还帮你通知了学院。', fate: 1, exp: 15 } },
    { text: '我还有事，给你颗糖你自己等吧', result: { text: '你给了孩子一颗糖就匆匆走了。后来你一直担心那个小孩有没有找到家人，修炼都心不在焉。', fate: -1, exp: 5 } }
  ]
},
// ---- 学院·特殊事件 ----
{
  id: 'ac_sp_01', name: '武魂轻微进化', location: '史莱克学院·静室',
  phase: 'adventure', unique: true, minLevel: 12, weight: 3,
  image: 'assets/scenes/temple.jpg',
  text: [
    '某次修炼中，你感觉{spirit}忽然剧烈震动起来，周身发出嗡嗡的鸣声！',
    '体内的魂力像沸腾了一样翻涌，你既兴奋又紧张——这难道是……武魂进化的征兆？'
  ],
  choices: [
    { text: '稳住心神，顺势引导！', result: { text: '你沉下心神引导魂力，{spirit}的光芒越来越盛，最后"啵"的一声轻响——虽然没有大的进化，但{spirit}比之前更凝练了，属性也有小幅提升。', attack: 2, defense: 1, spiritPowerGain: 5, exp: 80, fate: 1 } },
    { text: '太惊慌，中断了修炼', result: { text: '你一惊之下中断了修炼，{spirit}的光芒渐渐平复。虽然错失了一次机会，但大师说："能遇到这种征兆，说明你根基打得好，以后还有机会。"', exp: 30 } }
  ]
},
{
  id: 'ac_sp_02', name: '生病', location: '史莱克学院·宿舍',
  phase: 'academy', weight: 2,
  image: 'assets/scenes/dormitory.jpg',
  text: [
    '你发烧了，浑身无力地躺在床上。外面传来同学们训练的喊声，你却连爬起来的力气都没有。',
    '生病的时候人总是特别脆弱，你有点想家。'
  ],
  choices: [
    { text: '硬撑着去训练', result: { text: '你咬牙爬起来去训练，结果训练中差点晕倒，被大师骂了回去："身体是修炼的本钱，不爱惜自己身体的人不配做魂师！"', damage:20, exp: 10 } },
    { text: '好好休息养病', result: { text: '你老老实实地躺在床上休息。同学们给你带饭送药，胖虎学长还把他的棉被给你盖上。在大家的照顾下你很快康复了。', hp: 30, fate: 2, exp: 10 } },
    { text: '自己运功驱寒', result: { text: '你尝试运转魂力驱散寒气，居然成功了！虽然魂力消耗很大，但你发现了魂力疗伤的妙用。', mp: -20, exp: 30 } }
  ]
}
);

// ==================== 十七、武魂进阶专属事件（第二阶段） ====================
EVENTS.push(
// ---- 器武魂进阶 ----
{ id:'sp_wp_04', name:'兵器谱', location:'天斗城·兵器阁', phase:'adventure', minLevel:14, weight:2, tags:['器武魂','武器','战斗','锋利'],
  image:'assets/scenes/blacksmith.jpg',
  text:['天斗城兵器阁张贴了一张"兵器谱"榜单，收录天下有名的器武魂。你的{spirit}虽然还排不上号，但兵器阁主看了你的武魂后，眼中闪过一丝惊讶。'],
  choices:[
    { text:'请兵器阁主点评', result:{ text:'阁主凝视你的{spirit}良久，说："此武魂虽非名器，但潜力不凡。我见过很多器武魂，真正能走到最后的，不是最强的，而是最能沉下心打磨的。"他给了你一张兵器谱，上面标注了各种器武魂的修炼要诀。', attack:3, defense:1, exp:90 } },
    { text:'在兵器阁中修炼一天', result:{ text:'兵器阁中收藏了无数兵器类武魂的修炼心得，你如饥似渴地阅读，一天下来收获巨大。', attack:2, spiritPowerGain:3, exp:70 } }
  ]},
{ id:'sp_wp_05', name:'千锤百炼', location:'铁匠铺', phase:'adventure', minLevel:8, weight:2, tags:['器武魂','刚猛','力量','坚韧'],
  image:'assets/scenes/blacksmith.jpg',
  text:['一个老铁匠对你说："小伙子，你是器武魂吧？器武魂好比一柄剑——不经过千锤百炼，永远成不了神器。"他邀请你体验一次真正的"锻打"。'],
  choices:[
    { text:'接受锻打试炼', result:{ text:'你站在铁砧前，老铁匠用魂力化作大锤，一次次敲打你的{spirit}。每一次敲打都痛彻心扉，但每一次敲打后你的武魂都更加凝练。试炼结束后，你感觉{spirit}变得沉重而有力。', attack:4, defense:2, damage:15, exp:100 } },
    { text:'旁观学习锻造技巧', result:{ text:'你没有直接接受锻打，而是选择旁观学习。老铁匠一边打铁一边给你讲解器武魂与锻造的共通之道，你听得入迷。', attack:2, exp:50, gold:10 } }
  ]},
// ---- 兽武魂进阶 ----
{ id:'sp_bs_04', name:'猎魂森林', location:'猎魂森林', phase:'adventure', minLevel:30, weight:2, tags:['兽武魂','强攻系','狂暴','战斗'],
  image:'assets/scenes/forest_deep.jpg',
  text:['猎魂森林是魂师猎取魂兽的圣地，但也是兽武魂魂师的试炼场。你的兽武魂在这里感受到了前所未有的悸动——空气中弥漫着野兽的气息。'],
  choices:[
    { text:'深入森林，挑战强大的魂兽', cond:{level:30}, requirementHint:'等级达到 Lv.30', result:{ text:'你追踪一只千年魂兽的踪迹，深入密林。经过一番激烈的搏斗，你击败了它，兽武魂在战斗中吸收了它的野性之力，变得更强了。正式魂环需要通过魂环猎取节点获得。', attack:5, defense:1, battle:{ name:'千年魂兽', attack:35, defense:18, hp:180, speed:23, exp:80, gold:25 }, exp:120 } },
    { text:'在森林边缘修炼', result:{ text:'你选择在森林边缘修炼，虽然不如深入刺激，但安全稳定。你的兽武魂在森林气息的滋养下稳步提升。', attack:2, defense:2, exp:60 } }
  ]},
{ id:'sp_bs_05', name:'魂兽语者', location:'星斗大森林外围', phase:'adventure', minLevel:7, weight:2, tags:['兽武魂','感知','自然'],
  image:'assets/scenes/forest_outer.jpg',
  text:['你发现当自己静下心来，似乎能隐约理解魂兽们的"语言"——不是真正的语言，而是一种情绪和意图的感知。这是兽武魂魂师独有的天赋。'],
  choices:[
    { text:'尝试与一只温和的魂兽沟通', result:{ text:'你找到一只温和的十年魂兽，尝试用兽武魂与它沟通。它没有逃跑，反而好奇地靠近你。虽然交流很原始，但你感受到了它的善意——它带你找到了一处魂力充沛的修炼地。', spiritPowerGain:5, fate:2, exp:60 } },
    { text:'锻炼感知能力', result:{ text:'你专门训练自己对魂兽情绪的感知能力，渐渐地，你能在很远的距离就感知到魂兽的存在和大致敌意。这个能力在野外生存中极为实用。', speed:2, exp:40 } }
  ]},
// ---- 生活器物进阶 ----
{ id:'sp_tl_03', name:'匠心独运', location:'天斗城·工坊', phase:'adventure', minLevel:16, weight:2, tags:['生活器物','实用','灵巧','智慧'],
  image:'assets/scenes/blacksmith.jpg',
  text:['天斗城最大的工坊正在举办"工匠大赛"，参赛者要用自己的武魂完成一件作品。虽然你的{spirit}不是战斗型，但在实用方面却有着独特的优势。'],
  choices:[
    { text:'参加大赛，展示武魂的实用价值', result:{ text:'你用心制作了一件精美的实用品，评委们被你的创意惊呆了——他们从没想过武魂还能这样用！你获得了"匠心奖"，也赢得了工坊主的赏识。', gold:50, fate:2, exp:80 } },
    { text:'在工坊中学习新技能', result:{ text:'你没有参赛，而是拜工坊里的老师傅为师，学习各种实用技能。你的{spirit}在这些技能中如鱼得水。', gold:20, item:{ name:'工匠工具包', desc:'一套精良的工匠工具', effect:{ defense:1, speed:1 } }, exp:60 } }
  ]},
// ---- 植物系进阶 ----
{ id:'sp_pl_03', name:'森林之怒', location:'星斗大森林深处', phase:'adventure', minLevel:18, weight:2, tags:['植物系','生长','自然','生命'],
  image:'assets/scenes/forest_deep.jpg',
  text:['你发现了一片被魂兽破坏的森林——树木被连根拔起，花草被践踏得不成样子。你的植物系武魂感受到了森林的"痛苦"，一种愤怒在你心中升起。'],
  choices:[
    { text:'用武魂的力量帮助森林恢复', result:{ text:'你运转魂力，{spirit}散发出柔和的绿光。在光芒的照耀下，被破坏的草木开始重新生长！虽然只是幼苗，但生命的希望重新回到了这片土地。森林似乎记住了你的善意。', hp:30, spiritPowerGain:8, fate:3, exp:100 } },
    { text:'追踪破坏森林的魂兽', result:{ text:'你循着痕迹追踪到了破坏森林的魂兽，一番战斗后击败了它。虽然为森林报了仇，但你觉得真正的胜利不是杀戮，而是守护。', attack:3, defense:1, exp:80 } }
  ]},
// ---- 神器/神兽进阶 ----
{ id:'sp_gd_03', name:'神迹显现', location:'上古遗迹', phase:'god', minLevel:90, weight:1, tags:['神器','神兽','神圣','远古','命运'],
  image:'assets/scenes/abyss_godrealm.jpg',
  text:['你在一处上古遗迹中发现了与你{spirit}相关的图腾壁画。壁画上描绘了远古时代，一位神祇手持与你武魂相似的兵器，在天地间征战的场景。'],
  choices:[
    { text:'触摸壁画，感受远古之力', result:{ text:'当你手指触碰到壁画的瞬间，一缕古老魂力残响掠过你的意识。你仿佛看见远古战场，领悟了神级战斗留下的痕迹，但没有获得神力灌注。', attack:5, defense:3, spiritPowerGain:15, fate:3, exp:200 } },
    { text:'临摹壁画，揣摩神技', result:{ text:'你取出纸笔认真临摹壁画上的每一个细节，揣摩古神的战斗技巧。虽然没有获得神力灌注，但你对神级战斗的理解精进了许多。', attack:3, spiritPowerGain:5, exp:120 } }
  ]},
// ---- 防御系进阶 ----
{ id:'sp_df_02', name:'铜墙铁壁', location:'落日森林', phase:'adventure', minLevel:15, weight:2, tags:['防御系','坚韧','守护','沉稳'],
  image:'assets/scenes/forest_deep.jpg',
  text:['你遇到了一支被魂兽围攻的商队。商队护卫已经力竭，危在旦夕。你的{spirit}在防御方面有着天然的优势——是时候展现真正的价值了。'],
  choices:[
    { text:'挺身而出，用武魂挡下攻击', result:{ text:'你展开{spirit}，化作一道坚不可摧的屏障挡在商队面前。魂兽的攻击打在屏障上，发出沉闷的响声，但无法突破你的防御！商队安全撤离后，商人感激涕零，给了你丰厚的报酬。', defense:4, gold:40, fate:2, exp:100 } },
    { text:'且战且退，掩护商队撤离', result:{ text:'你一边抵挡魂兽的攻击，一边掩护商队撤退。虽然消耗很大，但成功保护了所有人。', defense:2, hp:20, exp:70 } }
  ]},
// ---- 敏攻系进阶 ----
{ id:'sp_sp_02', name:'暗影步', location:'天斗城·暗巷', phase:'adventure', minLevel:15, weight:2, tags:['敏攻系','敏捷','隐匿','灵动'],
  image:'assets/scenes/border_town.jpg',
  text:['你遇到了一个自称"影"的神秘人，他说你的速度虽然快，但不够"轻"——真正的敏攻系魂师，应该让人感觉不到你的存在。'],
  choices:[
    { text:'拜师学艺，学习暗影步', result:{ text:'影传授了你一套名为"暗影步"的身法。你苦练了三天三夜，终于掌握了其中的精髓——现在的你，不仅快，而且无声无息。', speed:5, attack:1, exp:90 } },
    { text:'与影比试速度', result:{ text:'你向影发起速度挑战。虽然输了，但在追逐中你学到了很多，速度又上了一个台阶。影说："你小子有天赋，下次见面再比。"', speed:3, exp:60 } }
  ]},
// ---- 控制系进阶 ----
{ id:'sp_ct_02', name:'领域初现', location:'冥想室', phase:'adventure', minLevel:18, weight:2, tags:['控制系','精神','束缚','智慧'],
  image:'assets/scenes/academy_classroom.jpg',
  text:['你在深度冥想中，突然感受到了一种奇妙的"领域"——以你为中心，周围的一切似乎都在你的掌控之中。这就是控制系魂师梦寐以求的"领域雏形"。'],
  choices:[
    { text:'全力扩张领域', result:{ text:'你尝试将领域扩张到最大范围。虽然很吃力，但领域范围确实扩大了不少——现在你可以在战斗中影响更多敌人了。', spiritPowerGain:12, defense:2, exp:100 } },
    { text:'精细化控制领域', result:{ text:'你没有追求范围，而是精细训练领域内的控制力。现在的你，在领域内能做到精准控制——比如让某个敌人减速而不影响其他人。', spiritPowerGain:8, attack:2, speed:1, exp:100 } }
  ]},
// ---- 辅助系进阶 ----
{ id:'sp_aux_02', name:'圣光洗礼', location:'神圣殿堂', phase:'adventure', minLevel:15, weight:2, tags:['辅助系','治愈','祝福','奉献'],
  image:'assets/scenes/temple.jpg',
  text:['你来到了一座古老的殿堂，传说这里曾是一位辅助系封号斗罗的修炼之地。殿堂中残留的神圣力量与你的{spirit}产生了共鸣。'],
  choices:[
    { text:'在殿堂中接受圣光洗礼', result:{ text:'你跪在殿堂中央，接受圣光的洗礼。温暖的光芒包裹着你，你的{spirit}在圣光中得到了净化与升华。洗礼结束后，你感觉自己的治愈能力有了质的飞跃。', hp:40, spiritPowerGain:10, fate:3, exp:100 } },
    { text:'研究殿堂中的辅助魂技', result:{ text:'你仔细研究殿堂墙壁上刻着的辅助魂技图谱，虽然年代久远，但你从中领悟了好几个实用的辅助技巧。', fate:2, exp:80 } }
  ]}
);

// ==================== 十八、出身专属事件 ====================
EVENTS.push(
// ---- 星斗小村 ----
{ id:'or_village_01', name:'故乡的味道', location:'星斗小村', phase:'academy', minLevel:1, weight:3, tags:['wild','survive','nature'],
  image:'assets/scenes/border_town.jpg',
  text:['你回到了出生的星斗小村。村口的老槐树还在，河里的小鱼还在游，隔壁的王婶一看到你就喊："小{name}回来啦！快来尝尝婶子刚蒸的馒头！"'],
  choices:[
    { text:'在村里住几天，帮乡亲们干活', result:{ text:'你帮村里人干各种活——修屋顶、劈柴、挑水。乡亲们都说你变强了，但没变的是那颗热心肠。离开时，大家给你塞了好多吃的。', hp:30, gold:15, fate:2, exp:30 } },
    { text:'去小时候常去的森林转转', result:{ text:'你来到小时候常玩耍的森林，凭着记忆找到了当年藏宝的树洞——里面居然还有你小时候放的弹弓和弹珠。你还在森林里找到了一些草药。', item:{ name:'药草包', desc:'星斗森林的野生草药', effect:{ hp:15 } }, exp:25 } }
  ]},
{ id:'or_village_02', name:'猎人的传承', location:'星斗小村·猎户家', phase:'adventure', minLevel:10, weight:2, tags:['wild','hunt','survive'],
  image:'assets/scenes/forest_outer.jpg',
  text:['村里的老猎人刘伯找到你，说他的腿不行了，想把祖传的狩猎技巧传给你。他一生猎过上百只魂兽，有着丰富的野外生存经验。'],
  choices:[
    { text:'认真学习狩猎技巧', result:{ text:'刘伯教你如何追踪魂兽的足迹、判断魂兽的强弱、以及如何在森林中生存。这些技巧是书本上学不到的宝贵经验。', speed:2, attack:1, exp:70 } },
    { text:'和刘伯一起进山打猎', result:{ text:'你和刘伯一起进山，在他的指导下成功猎到了一只百年魂兽。虽然不是什么厉害的猎物，但这次经历让你对实战有了更深的理解。', attack:2, gold:20, exp:80 } }
  ]},
{ id:'or_village_03', name:'村子的危机', location:'星斗小村', phase:'master', minLevel:20, weight:2, tags:['wild','fight','protect','justice'],
  image:'assets/scenes/border_town.jpg',
  text:['你回到村子时，发现村民们都躲在家里不敢出来——原来最近有一只魂兽经常在村外徘徊，吓得大家不敢出门干活。村长看到你回来了，眼中燃起了希望。'],
  choices:[
    { text:'主动出击，解决魂兽', result:{ text:'你追踪魂兽的踪迹，在村外五里的山洞里找到了它。一番激战后你击败了它，把它的尸体拖回村里。村民们欢呼雀跃，当晚全村为你庆功。', attack:3, defense:2, fate:3, gold:20, exp:120 } },
    { text:'设陷阱驱赶魂兽', result:{ text:'你利用刘伯教的狩猎技巧，在村外设置了陷阱和驱兽装置。虽然没能彻底解决魂兽，但它被吓跑了，村民们终于可以安心生活了。', defense:2, speed:1, exp:60 } }
  ]},
// ---- 武魂城世家 ----
{ id:'or_noble_01', name:'家族来信', location:'史莱克学院', phase:'academy', minLevel:1, weight:3, tags:['social','sect','noble'],
  image:'assets/scenes/academy_classroom.jpg',
  text:['你收到了家族的家书。父亲在信中说族中长辈们都在关注你的修炼进展，还随信寄来了一个包裹——"这是家族对你的一点心意，好好修炼，莫要辱没了家族的名声。"'],
  choices:[
    { text:'打开包裹', result:{ text:'包裹里是一瓶珍贵的灵药汁和几卷家族收藏的修炼心得。你心里暖暖的，虽然平时父亲很少夸你，但这份关心是实实在在的。', item:{ name:'灵药精华', desc:'武魂城世家特制的灵药', effect:{ hp:20, spiritPowerGain:5 } }, exp:20 } },
    { text:'先修炼再收礼物', result:{ text:'你决定先修炼一番再收礼物，证明自己配得上家族的支持。你加倍努力修炼，一周后打开包裹时，觉得自己确实进步了。', attack:1, spiritPowerGain:2, exp:40 } }
  ]},
{ id:'or_noble_02', name:'家族聚会', location:'武魂城·家族大厅', phase:'adventure', minLevel:15, weight:2, tags:['social','sect','noble','trade'],
  image:'assets/scenes/temple.jpg',
  text:['家族一年一度的聚会到了，所有在外修炼的族中子弟都回来了。大厅里摆满了美味佳肴，长辈们笑呵呵地询问每个人的修炼进展。轮到你汇报时，所有人的目光都集中在你身上。'],
  choices:[
    { text:'展示修炼成果，让长辈们刮目相看', result:{ text:'你亮出{spirit}，展示了一番。长辈们纷纷点头，族长更是说："这孩子有出息，不愧是咱们家的种！"你获得了家族更多的资源支持。', gold:30, attack:2, fate:2, exp:80 } },
    { text:'虚心请教各位长辈', result:{ text:'你没有炫耀，而是虚心向各位长辈请教修炼中的困惑。长辈们非常高兴，纷纷倾囊相授。你从中学到了很多家族秘传的修炼技巧。', spiritPowerGain:8, defense:1, exp:70 } }
  ]},
{ id:'or_noble_03', name:'家族危机', location:'武魂城·家族', phase:'master', minLevel:25, weight:2, tags:['social','sect','fight','justice'],
  image:'assets/scenes/temple.jpg',
  text:['家族传来急报——对头家族联合了几个小势力对家族生意进行打压，族中长辈焦头烂额。父亲虽然没让你回来，但你知道，现在是你回报家族的时候了。'],
  choices:[
    { text:'回去帮助家族', result:{ text:'你连夜赶回武魂城，利用你的实力和智慧帮助家族化解了危机。对头家族没想到家族中还有你这么强的后辈，只能灰溜溜地撤了。族长亲自为你斟酒，你是家族的骄傲。', attack:3, defense:2, gold:50, fate:3, exp:150 } },
    { text:'用你在学院的人脉帮家族', result:{ text:'你联系了在学院认识的朋友和老师，利用他们的资源帮助家族度过了难关。虽然没有亲自出手，但让大家看到了你的智慧和影响力。', fate:2, gold:30, exp:80 } }
  ]},
// ---- 边境小城 ----
{ id:'or_border_01', name:'守城', location:'边境小城', phase:'academy', minLevel:1, weight:3, tags:['fight','guard','military'],
  image:'assets/scenes/border_town.jpg',
  text:['你回到老家边境小城，正赶上守城军换防。守城的叔叔一看到你就乐了："小{name}！回来啦？来来来，正好缺人手，帮叔叔守两天城！"'],
  choices:[
    { text:'认真地守城', result:{ text:'你穿上军装，认真地站岗放哨。虽然只是简单的守城，但你学到了很多军事知识——哨位布置、烽火信号、紧急集合。这些知识在以后的冒险中意外地有用。', defense:2, exp:30, fate:1 } },
    { text:'和守城士兵切磋武艺', result:{ text:'守城士兵们听说你是魂师，都想和你过两招。你和他们切磋了一整天，虽然他们都是普通人，但实战经验丰富，你学到了很多实用的格斗技巧。', attack:2, speed:1, exp:40 } }
  ]},
{ id:'or_border_02', name:'边境冲突', location:'边境小城', phase:'adventure', minLevel:12, weight:2, tags:['fight','guard','military','weapon'],
  image:'assets/scenes/border_town.jpg',
  text:['边境发生了小规模的冲突——一伙流窜的贼寇趁着夜色想洗劫边城。守城军力不足，叔叔急得团团转。看到你回来，他眼睛一亮："好小子，来得正是时候！"'],
  choices:[
    { text:'正面迎击贼寇', result:{ text:'你展开{spirit}，一马当先冲向贼寇。贼寇们看到魂师，吓得魂飞魄散，你三下五除二就解决了领头的几个，剩下的作鸟兽散。守城士兵们把你当英雄，叔叔骄傲地拍着你的肩膀。', attack:4, defense:1, gold:30, fate:2, exp:100 } },
    { text:'智取——设伏击圈', result:{ text:'你没有硬拼，而是利用地形设了一个伏击圈。贼寇一到，四面喊杀声起，吓得他们丢盔弃甲。你不仅保住了边城，还缴获了一批物资。', defense:2, speed:1, gold:40, exp:80 } }
  ]},
{ id:'or_border_03', name:'铁匠的礼物', location:'边境小城·铁匠铺', phase:'adventure', minLevel:18, weight:2, tags:['weapon','fight','trade'],
  image:'assets/scenes/blacksmith.jpg',
  text:['城里的老铁匠是你小时候的邻居，他听说你成了魂师，高兴得不得了。他花了三个月时间，专门为你打造了一件装备——"小子，这是我老铁匠这辈子打得最好的一件东西，送你了！"'],
  choices:[
    { text:'收下礼物，帮老铁匠打一天铁', result:{ text:'你收下了老铁匠的心意，然后帮他打了一天的铁。老铁匠高兴得合不拢嘴，一边打铁一边给你讲他年轻时走南闯北的故事。', item:{ name:'精铁护腕', desc:'老铁匠亲手打造的精品', effect:{ attack:2, defense:1 } }, fate:2, exp:50 } },
    { text:'婉拒，但给他留了一笔钱', result:{ text:'你不好意思收这么贵重的礼物，但给老铁匠留了一笔钱。老铁匠死活不收，你偷偷塞在他枕头下。', gold:-20, fate:2, exp:30 } }
  ]},
// ---- 海神岛渔村 ----
{ id:'or_sea_01', name:'海的味道', location:'海神岛渔村', phase:'academy', minLevel:1, weight:3, tags:['sea','water','nature'],
  image:'assets/scenes/sea_god_island.jpg',
  text:['你回到了海边的渔村，咸咸的海风、沙滩上的贝壳、远处渔船的帆影——一切都是那么熟悉。村里的小伙伴们围着你，叽叽喳喳地让你讲学院的故事。'],
  choices:[
    { text:'下海游泳，重温童年', result:{ text:'你脱掉外衣跳进海里，像小时候一样自由自在地游着。海水似乎对你的{spirit}有着天然的亲和力，你感觉武魂在水中更加活跃了。', speed:2, hp:10, exp:25 } },
    { text:'跟渔民出海打鱼', result:{ text:'你跟着村里的渔民出海，虽然风浪不小，但你一点都不晕船。渔民们说你是"海的儿子"，你把打到的鱼分给了村里的老人。', gold:10, fate:1, exp:30 } }
  ]},
{ id:'or_sea_02', name:'深海奇遇', location:'海神岛·近海', phase:'adventure', minLevel:14, weight:2, tags:['sea','water','explore','secret'],
  image:'assets/scenes/sea_god_island.jpg',
  text:['你独自潜入深海，在海底发现了一个被珊瑚覆盖的洞穴。洞穴中散发着微弱的蓝光，似乎有什么东西在召唤你。'],
  choices:[
    { text:'深入洞穴探索', result:{ text:'你游进洞穴深处，发现了一颗散发着蓝色光芒的珍珠——这是一颗千年海魂珠！珠中蕴含的海洋之力与你的魂力产生了共鸣。', item:{ name:'海魂珠', desc:'蕴含海洋之力的千年珍珠', effect:{ hp:25, speed:3 } }, fate:2, exp:80 } },
    { text:'在洞口修炼', result:{ text:'你没有冒险深入，而是在洞口修炼。海底充沛的水属性魂力让你的修炼事半功倍。', spiritPowerGain:8, speed:1, exp:60 } }
  ]},
{ id:'or_sea_03', name:'海兽来袭', location:'海神岛渔村', phase:'master', minLevel:22, weight:2, tags:['sea','fight','protect','justice'],
  image:'assets/scenes/sea_god_island.jpg',
  text:['一只巨大的海兽袭击了渔村！渔船被掀翻，码头被毁坏，村民们惊慌失措地往高处跑。你从小在这片海长大，决不允许任何东西伤害你的家乡！'],
  choices:[
    { text:'正面迎战海兽', result:{ text:'你跳入海中，与海兽展开了一场惊天动地的战斗！海浪翻涌，水花四溅。经过一番苦战，你终于击败了海兽，拖着它的尸体回到岸边。村民们把你当成了海神的化身。', attack:5, defense:2, fate:3, exp:150 } },
    { text:'利用地形智斗海兽', result:{ text:'你利用对这片海域的熟悉，把海兽引到礁石区。海兽庞大的身躯在礁石间行动不便，你趁机攻击它的要害，最终成功击退。', speed:3, defense:2, exp:100 } }
  ]}
);

// ==================== 十九、命运路线专属事件 ====================
EVENTS.push(
// ---- 独行之路 ----
{ id:'dy_lone_01', name:'独自修炼', location:'深山·无名洞府', phase:'academy', minLevel:3, weight:3, tags:['solo','wild','survive'],
  image:'assets/scenes/mountain_path.jpg',
  text:['你习惯了一个人修炼。没有旁人的干扰，你能更专注地感受{spirit}的每一个细微变化。今天，你来到了深山中的一个无名洞府。'],
  choices:[
    { text:'在洞府中闭关', result:{ text:'你在洞府中闭关修炼，没有人打扰，效率极高。虽然孤独，但这种孤独让你更加清醒地认识了自己的武魂。', attack:2, spiritPowerGain:4, exp:80 } },
    { text:'在附近探索', result:{ text:'你没有急着修炼，而是在洞府附近探索了一番。在山涧中，你找到了一株长在悬崖边的罕见灵草。', item:{ name:'悬崖灵草', desc:'生长在悬崖峭壁上的稀有草药', effect:{ hp:20 } }, exp:40 } }
  ]},
{ id:'dy_lone_02', name:'荒野求生', location:'荒野', phase:'adventure', minLevel:12, weight:2, tags:['solo','wild','survive','hunt'],
  image:'assets/scenes/forest_deep.jpg',
  text:['你独自穿越一片荒无人烟的野地，周围只有风声和野兽的嚎叫。一般人可能会害怕，但你却觉得自在——独行是你选择的道路。'],
  choices:[
    { text:'在荒野中修炼生存技能', result:{ text:'你利用荒野中的一切资源——采集野果、设陷阱捕猎、寻找水源。你的生存能力大幅提升，同时也更加了解了自己的极限。', defense:2, speed:2, hp:15, exp:60 } },
    { text:'在荒野中挑战极限', result:{ text:'你故意不设营帐，在荒野中挑战自己的极限。风餐露宿虽然艰苦，但你对身体和武魂的掌控力都上了一个台阶。', attack:2, defense:1, exp:70 } }
  ]},
{ id:'dy_lone_03', name:'孤独的强者', location:'山顶·日出', phase:'master', minLevel:25, weight:2, tags:['solo','wild','fate'],
  image:'assets/scenes/mountain_path.jpg',
  text:['你独自站在山顶，看着日出。没有人知道你在这里，也没有人知道你经历了什么——但你知道，你比昨天更强了。独行之路虽然孤独，但每一步都踏实。'],
  choices:[
    { text:'在山顶修炼，迎接日出', result:{ text:'当第一缕阳光照在你身上时，你运转魂力，吸收日出的精华。这是一种独特的修炼方式——只有独行者才能体会的宁静与力量。', attack:4, spiritPowerGain:12, fate:1, exp:120 } },
    { text:'写下修炼心得', result:{ text:'你拿出纸笔，把这几个月独自修炼的心得记录下来。你发现，独行不是逃避人群，而是在孤独中找到真正的自己。', fate:3, exp:80 } }
  ]},
// ---- 宗门之路 ----
{ id:'dy_sect_01', name: '收徒·幼年', location:'史莱克学院', phase:'academy', minLevel:5, weight:3, tags:['social','sect','teach'],
  image:'assets/scenes/academy_classroom.jpg',
  text:['一个低年级的学弟找到你，眼睛里满是崇拜："{name}学长！我听说你修炼很厉害，能不能教教我？"这是他第一次主动找人请教，显然鼓起了很大的勇气。'],
  choices:[
    { text:'收下这个小徒弟', result:{ text:'你答应了，从此多了一个跟屁虫。虽然教他花了不少时间，但在教的过程中，你自己对基础知识的理解也更加深刻了。而且，他学得很快，让你很有成就感。', fate:2, exp:50 } },
    { text:'给他推荐几本修炼书籍', result:{ text:'你给他推荐了几本好的修炼书籍，让他自己先看。虽然没有亲自教，但给了他正确的方向。', exp:20 } }
  ]},
{ id:'dy_sect_02', name:'宗门大会', location:'天斗城·宗门会场', phase:'adventure', minLevel:16, weight:2, tags:['social','sect','trade','teach'],
  image:'assets/scenes/temple.jpg',
  text:['天斗城举办了一年一度的宗门大会，各大宗门都派出了代表。你虽然还没有正式开宗立派，但你的实力和声望已经引起了注意。'],
  choices:[
    { text:'参加宗门大会，结交人脉', result:{ text:'你在宗门大会上认识了很多志同道合的魂师，交换了联系方式。大家约定以后互相帮助，共同进步。你感觉自己的宗门之路又近了一步。', fate:3, gold:20, exp:60 } },
    { text:'在大会上展示实力', result:{ text:'你在大会上展示了自己的实力，赢得了一片喝彩。几个小宗门对你抛出了橄榄枝，虽然你暂时没有接受，但你的名声已经传开了。', attack:2, exp:80 } }
  ]},
{ id:'dy_sect_03', name:'开宗立派', location:'天斗城', phase:'master', minLevel:30, weight:2, tags:['social','sect','teach','fate'],
  image:'assets/scenes/temple.jpg',
  text:['时机成熟了。你决定正式建立自己的宗门。虽然规模不大——只有几个弟子和一间院子——但这是属于你的势力。你给它取了一个响亮的名字。'],
  choices:[
    { text:'亲力亲为，从头建设', result:{ text:'你亲自设计了宗门的每一个细节——从院墙的高度到修炼场的布局。虽然很累，但看着宗门一天天成型，你心里充满了成就感。你的弟子们也都干劲十足。', defense:3, fate:4, gold:-30, exp:100 } },
    { text:'广招人才，快速扩张', result:{ text:'你决定先招揽人才，快速扩张。你用自己的声望和实力吸引了好几个有潜力的魂师加入。虽然宗门还简陋，但人才济济。', fate:3, attack:2, exp:80 } }
  ]},
// ---- 冒险之路 ----
{ id:'dy_adventure_01', name:'古墓探险', location:'无名古墓', phase:'academy', minLevel:6, weight:3, tags:['explore','ruin','secret'],
  image:'assets/scenes/ruin.jpg',
  text:['你在野外发现了一个被藤蔓覆盖的古墓入口。入口处刻着模糊的文字，看样子至少有几百年的历史了。一个声音在你心里说：进去看看。'],
  choices:[
    { text:'进入古墓探索', result:{ text:'你举着火把走进古墓，里面阴森森的，但没有什么危险——墓主人似乎是一位和平的隐士。你在墓中发现了一些古老的修炼笔记和几件陪葬品。', item:{ name:'古修炼笔记', desc:'记载了古人的修炼心得', effect:{ spiritPowerGain:5 } }, gold:15, exp:60 } },
    { text:'仔细观察入口的碑文', result:{ text:'你没有贸然进入，而是仔细研究了入口的碑文。碑文上记载了墓主人的生平——他是一位游历大陆的冒险者，碑文末端刻着"冒险之心，永不熄灭"。你受到了鼓舞。', fate:2, exp:40 } }
  ]},
{ id:'dy_adventure_02', name:'神秘地图', location:'天斗城·旧货市场', phase:'adventure', minLevel:14, weight:2, tags:['explore','secret','mystery','ruin'],
  image:'assets/scenes/border_town.jpg',
  text:['你在旧货市场淘到一张泛黄的羊皮地图，上面标注了一个从未听说过的地名——"失落之谷"。旁边的摊主说："那张图啊，我爷爷传下来的，说是藏宝图，但从来没人找到过那个地方。"'],
  choices:[
    { text:'按图索骥，寻找失落之谷', result:{ text:'你按照地图的指引，翻山越岭，终于在一个隐蔽的山谷中找到了失落之谷。谷中有一座废弃的祭坛，祭坛上放着一件古老的宝物。', item:{ name:'古老护符', desc:'失落之谷出土的远古护符', effect:{ defense:3, fate:2 } }, fate:2, exp:100 } },
    { text:'研究地图，推测更多线索', result:{ text:'你花了很多时间研究地图上的每一个细节，发现它可能连接着更大的秘密——地图只是某个藏宝图的四分之一。你决定以后继续寻找其他碎片。', fate:3, exp:50 } }
  ]},
{ id:'dy_adventure_03', name:'秘境入口', location:'未知山脉', phase:'master', minLevel:28, weight:2, tags:['explore','secret','mystery','ruin'],
  image:'assets/scenes/abyss_godrealm.jpg',
  text:['你在一座荒凉的山脉中发现了传说中的"秘境入口"——一个散发着奇异光芒的传送门。没有人知道门后面是什么，但你知道，冒险者的一生就是为了这一刻。'],
  choices:[
    { text:'毫不犹豫地踏入秘境', result:{ text:'你深吸一口气，踏入了秘境。里面是一个完全不同的世界——灵气充沛，奇花异草遍地，还有各种你从未见过的魂兽和宝物。你在秘境中修炼了三天，出来时实力大增。', attack:5, defense:3, spiritPowerGain:15, fate:3, exp:200 } },
    { text:'先做好万全准备再进入', result:{ text:'你没有冲动，而是先准备好了充足的补给和装备，然后才踏入秘境。虽然谨慎，但你的准备让你在秘境中更加从容。', attack:3, defense:2, spiritPowerGain:8, exp:120 } }
  ]},
// ---- 英雄之路 ----
{ id:'dy_hero_01', name:'路见不平', location:'天斗城·街头', phase:'academy', minLevel:4, weight:3, tags:['justice','fight','protect'],
  image:'assets/scenes/border_town.jpg',
  text:['你在街上看到一个地痞正在欺负一个卖菜的老婆婆，把她的菜摊踢翻了，还骂骂咧咧的。周围人敢怒不敢言。'],
  choices:[
    { text:'站出来，教训地痞', result:{ text:'你二话不说，上去就把地痞拎了起来。地痞看到你是魂师，吓得连连求饶。你让他帮老婆婆把菜捡起来，赔了钱，保证以后不再欺负人。老婆婆感激得眼泪都出来了。', attack:1, fate:3, exp:40 } },
    { text:'叫来巡逻的卫兵处理', result:{ text:'你叫来了巡逻的卫兵，卫兵们把地痞抓走了。老婆婆向你道谢，你说："举手之劳。"', fate:1, exp:20 } }
  ]},
{ id:'dy_hero_02', name:'斩妖除魔', location:'山村', phase:'adventure', minLevel:18, weight:2, tags:['justice','fight','evil','protect'],
  image:'assets/scenes/forest_deep.jpg',
  text:['一个偏僻的山村被一只妖魔骚扰，村民苦不堪言。他们听说你是魂师，跪在地上求你帮忙。妖魔盘踞在村后的山洞里，已经伤害了好几个村民。'],
  choices:[
    { text:'深入山洞，斩杀妖魔', result:{ text:'你带着村民们的希望踏入山洞。妖魔虽然凶残，但你的{spirit}更胜一筹！经过一番激战，你成功斩杀了妖魔。村民们欢呼着把你抬起来，称你为"救星"。', attack:5, defense:2, fate:4, gold:20, exp:150 } },
    { text:'设陷阱引诱妖魔，智取', result:{ text:'你没有正面对抗，而是在洞口设下陷阱，引诱妖魔出来。妖魔落入陷阱后，你趁机给予致命一击。虽然不够"英雄气概"，但效果一样好。', attack:3, speed:2, exp:100 } }
  ]},
{ id:'dy_hero_03', name:'英雄之名', location:'天斗城·广场', phase:'master', minLevel:30, weight:2, tags:['justice','hero','protect','fate'],
  image:'assets/scenes/temple.jpg',
  text:['你在天斗城的广场上被授予了"英雄勋章"——这是对你过去无数次见义勇为的认可。广场上站满了你曾经帮助过的人，他们的掌声和欢呼声让你有点不好意思。'],
  choices:[
    { text:'发表感言，鼓励更多人', result:{ text:'你站在台上，没有长篇大论，只说了一句话："英雄不是天生的，是每一次选择挺身而出的人。"广场上掌声雷动。很多年轻人被你的话激励，决定也要成为像你一样的人。', fate:5, exp:100 } },
    { text:'婉拒勋章，低调离开', result:{ text:'你婉拒了勋章，说这些事都是应该做的。你低调地离开了广场，但你的故事已经在天斗城传开了——人们记住了你的名字。', fate:3, exp:60 } }
  ]},
// ---- 命运之路 ----
{ id:'dy_fate_01', name:'命运骰子', location:'路边·算命摊', phase:'academy', minLevel:2, weight:3, tags:['fate','random','lucky'],
  image:'assets/scenes/border_town.jpg',
  text:['路边有个算命先生拦住了你："这位少侠，我看你印堂发亮，近日必有奇遇！来来来，让我给你算一卦，不准不要钱！"说着掏出一个骰子。'],
  choices:[
    { text:'让他算一卦', result:{ text:'算命先生掷出骰子，骰子在地上转了三圈，停在"六"上。他眼睛一亮："大吉！少侠，你命中有大机缘，只要顺着命运的指引前进，必成大器！"虽然半信半疑，但你听了心里还是美滋滋的。', fate:2, exp:25 } },
    { text:'不用了，我相信自己', result:{ text:'你笑着拒绝了，说命运掌握在自己手中。算命先生也不恼，说："信也好，不信也好，命运自有安排。"', fate:1, exp:15 } }
  ]},
{ id:'dy_fate_02', name:'意外的幸运', location:'未知', phase:'adventure', minLevel:10, weight:2, tags:['fate','random','lucky'],
  image:'assets/scenes/forest_outer.jpg',
  text:['你走在路上，突然被一个东西绊了一下——低头一看，竟然是一个鼓鼓囊囊的钱袋！看样子是有人不小心掉的。周围没有其他人。'],
  choices:[
    { text:'捡起钱袋', result:{ text:'你捡起钱袋，里面有不少金币。你没有找到失主，只能先收着了。命运有时候就是这么奇妙——你什么也没做，好运就来了。', gold:30, fate:1, exp:20 } },
    { text:'在原地等失主', result:{ text:'你拿着钱袋在原地等了一个时辰，终于等到了急匆匆跑回来的失主——一个商人。他感激涕零，非要给你酬金。', gold:10, fate:2, exp:30 } }
  ]},
{ id:'dy_fate_03', name:'命运的岔路口', location:'十字路口', phase:'master', minLevel:22, weight:2, tags:['fate','random','unlucky','lucky'],
  image:'assets/scenes/mountain_path.jpg',
  text:['你站在一个十字路口，面前有两条路——左边是平坦的大路，右边是崎岖的小路。你有一种强烈的预感：今天的这个选择，会改变你的一生。'],
  choices:[
    { text:'走大路', result:{ text:'你选择了平坦的大路。路上你遇到了一个商队，他们热情地邀请你同行。一路上相谈甚欢，你还学到了很多经商的知识。', gold:20, fate:2, exp:50 } },
    { text:'走小路', result:{ text:'你选择了崎岖的小路。虽然路不好走，但你在路边发现了一个隐蔽的山洞，洞中有一具前辈的遗骸和一本泛黄的秘籍。', item:{ name:'无名秘籍', desc:'不知名前辈留下的修炼秘籍', effect:{ attack:2, spiritPowerGain:5 } }, fate:3, exp:80 } },
    { text:'哪条都不选，自己开辟一条路', result:{ text:'你说："命运不是选择别人给的路，而是自己走出来的。"你绕开两条路，朝着荒野走去。虽然前途未卜，但你心里充满了力量。', fate:4, attack:1, defense:1, exp:60 } }
  ]}
);

// ==================== 全地图通用事件补充（B-04：adventure/master 全局池过稀） ====================
EVENTS.push(
{
  id: 'gbl_adv_01', name: '风尘旅人', phase: 'adventure', weight: 6, minLevel: 7,
  image: 'assets/scenes/forest_outer.jpg',
  text: [
    '赶路途中，你在驿站遇到一位风尘仆仆的旅人。他腰挎长剑，眼中却有化不开的疲惫。',
    '他请你喝了一碗热汤，讲起大陆各地的见闻：哪里的魂兽最凶，哪座城的酒最烈，哪条路上埋着前人遗骨。'
  ],
  choices: [
    { text: '认真听讲，记下要点', result: { text: '你把这些见闻牢牢记下。旅人赞你是个有心人，临别又给你指了一条通往灵药谷的近路。', exp: 90, gold: 40, fate: 1 } },
    { text: '请教修炼心得', result: { text: '"修炼？"旅人笑了，"无非是熬。别人熬一天，你熬两天；别人怕痛，你把痛当饭吃。"', exp: 120, fate: 1 } },
    { text: '邀他切磋一场', result: { text: '他欣然应战，点到为止。几招下来你学到不少实战技巧，他也说后生可畏。', exp: 100, attack: 1, fate: 1 } },
    { text: '提起你放过的魂兽', effect: G => {
        const spared = G._storyDecisions && G._storyDecisions['event:first_blood'] === 'spare';
        if(spared){ G.fatePoints = (G.fatePoints || 0) + 3; return '旅人听罢，沉默良久："你放它一条生路，它便多了一分善缘。"你感到命运之力涌动。'; }
        return '旅人摇摇头："魂兽无情，该杀便杀。"你想起自己曾经的抉择，若有所思。';
      }, result: { exp: 80, fate: 1 } }
  ]
},
{
  id: 'gbl_adv_02', name: '古道残碑', phase: 'adventure', weight: 5, minLevel: 7,
  image: 'assets/locations/天斗城.jpg',
  text: [
    '古道旁立着一块残破的石碑，字迹被风雨侵蚀得模糊不清。',
    '你辨认出几行古字："魂力如河，心为堤坝。堤溃则河决，心乱则力散。"落款是一个早已失传的宗门。'
  ],
  choices: [
    { text: '打坐感悟碑文', result: { text: '你依言静坐，感受魂力在经脉中的流动。仿佛听见古人低声教导，顿悟了一丝修炼的真意。', exp: 110, defense: 1, fate: 1 } },
    { text: '拓印碑文带走研究', result: { text: '你小心拓下碑文，收进包裹。以后修习时可常拿出来参详。', exp: 60, fate: 1, item: { name: '残碑拓片', desc: '记载着古人修炼心得的拓片', effect: { defense: 1 } } } },
    { text: '在碑前放一束野花', result: { text: '你采来一束野花放在碑前。风过处，仿佛有苍老的声音说了声"谢"。', fate: 3, exp: 40 } }
  ]
},
{
  id: 'gbl_adv_03', name: '流浪艺人', phase: 'adventure', weight: 5, minLevel: 7,
  image: 'assets/scenes/wuhun_city.jpg',
  text: [
    '集市上围了一圈人，一个流浪艺人正在表演傀儡戏，演的是上古魂师降服魂兽的故事。',
    '傀儡做得活灵活现，人群不时爆发出叫好声。'
  ],
  choices: [
    { text: '打赏几个铜板', result: { text: '艺人朝你鞠了一躬，散场后悄悄塞给你一张泛黄的乐谱，说是祖传的。', gold: -20, exp: 60, fate: 2, item: { name: '古旧乐谱', desc: '流浪艺人祖传的乐谱，似乎蕴含着某种韵律', effect: { speed: 1 } } } },
    { text: '留下来看完整场', result: { text: '你看完了整场傀儡戏，故事里的战术给了你不少启发。', exp: 80, fate: 1 } },
    { text: '上前讨教傀儡术', result: { text: '艺人教你操控傀儡的手法，说魂力运用之道与控偶之术殊途同归。', exp: 90, spiritPowerGain: 2, fate: 1 } }
  ]
},
{
  id: 'gbl_adv_04', name: '暴雨夜行', phase: 'adventure', weight: 5, minLevel: 8,
  image: 'assets/scenes/forest_outer.jpg',
  text: [
    '天色突变，暴雨倾盆。你浑身湿透，终于在路边找到一个避雨的山洞。',
    '洞里已经有人生了一堆火，是一位采药的老者。他招呼你："小友，进来烤烤火，别冻坏了。"'
  ],
  choices: [
    { text: '谢过老者，烤火取暖', result: { text: '火堆温暖，老者又分你半壶热茶。雨停时，你精神焕发，还听老者讲了不少药材知识。', hp: 60, exp: 70, fate: 1 } },
    { text: '帮老者整理药材', result: { text: '你手脚麻利地帮老者分拣药材，他高兴地送你几株灵药。', exp: 60, gold: 50, fate: 2 } },
    { text: '冒雨赶路', result: { text: '你谢绝了老者的好意，冒雨前行。虽然狼狈，但你在雨中完成了一次魂力运转的极限训练。', exp: 100, speed: 1, hp: -20 } }
  ]
},
{
  id: 'gbl_adv_05', name: '荒野炊烟', phase: 'adventure', weight: 4, minLevel: 9,
  image: 'assets/scenes/forest_outer.jpg',
  text: [
    '荒野深处升起一缕炊烟。走近一看，是一支小商队在生火做饭，领头的大汉警惕地打量着你。',
    '"哪来的？"他握着刀柄问。'
  ],
  choices: [
    { text: '说明来意，请求搭伙', result: { text: '大汉打量你片刻，松开了刀柄："出门在外都不容易，坐下吃口热乎的。"饭桌上你们相谈甚欢。', hp: 40, exp: 80, fate: 1 } },
    { text: '保持距离，自行休整', result: { text: '你远远地扎营休息，互不打扰。夜里你听到商队传来悠扬的笛声，倒也别有风味。', exp: 70, fate: 1 } },
    { text: '帮忙守夜换食宿', result: { text: '你主动提出帮忙守夜。一夜无事，天亮时商队头领硬塞给你一袋干粮和几枚金币。', exp: 90, gold: 60, fate: 2 } }
  ]
},
{
  id: 'gbl_mas_01', name: '云游剑客', phase: 'master', weight: 5, minLevel: 19,
  image: 'assets/locations/天斗城.jpg',
  text: [
    '一位独臂剑客在酒馆独酌，桌上横着一柄古朴的长剑。',
    '他忽然开口："小友，看得出你也是魂师。陪我喝一杯？"'
  ],
  choices: [
    { text: '举杯相迎', result: { text: '剑客话不多，但句句在理。他说自己年轻时也曾意气风发，如今只求一剑纵横。临别他赠你一句忠告。', exp: 150, fate: 2 } },
    { text: '请教剑法', result: { text: '"剑法？"他轻笑，"剑是手的延伸，手是心的延伸。心不静，剑再快也是虚的。"你似有所悟。', exp: 200, attack: 1 } },
    { text: '与他切磋', result: { text: '他只用单手，你却连他的衣角都摸不到。败北之后，他指点你三处破绽，收益匪浅。', exp: 180, speed: 1, fate: 1 } },
    { text: '说出你一路走来的道路', effect: G => {
        const path = G._storyPath || [];
        if(path.includes('dark')){ G.fatePoints = (G.fatePoints || 0) - 1; return '剑客深深看你一眼："杀伐之气很重。记住，剑是工具，心才是主人。"'; }
        if(path.includes('saint')){ G.fatePoints = (G.fatePoints || 0) + 2; return '剑客赞许地点头："心存善念的人，剑也会走得长远。"'; }
        return '剑客笑了笑："路都是自己走出来的，走下去就是了。"';
      }, result: { exp: 120, fate: 1 } }
  ]
},
{
  id: 'gbl_mas_02', name: '拍卖行来信', phase: 'master', weight: 4, minLevel: 20,
  image: 'assets/scenes/wuhun_city.jpg',
  text: [
    '一封烫金请柬送到你手上：武魂城拍卖行将举办一场稀世拍卖会，据说压轴是一块来历不明的魂骨。',
    '请柬背面写着："凭此柬可携一位同伴入场。"'
  ],
  choices: [
    { text: '独自赴会，低调行事', result: { text: '拍卖会上你见识了各色魂师与珍宝，虽未出手，但眼界大开。', exp: 120, gold: 80, fate: 1 } },
    { text: '邀结识的友人同往', result: { text: '友人欣然同行。拍卖会上你们互相参谋，还低价竞得一件不错的护甲。', exp: 140, gold: 100, defense: 1, fate: 2 } },
    { text: '婉拒赴会，专注修炼', result: { text: '你回信婉拒，闭关苦修数日。比起热闹，你更享受实力一点点增长的感觉。', exp: 220, fate: 1 } }
  ]
},
{
  id: 'gbl_mas_03', name: '天边异象', phase: 'master', weight: 4, minLevel: 22,
  image: 'assets/scenes/sky_city.jpg',
  text: [
    '深夜，天边忽然亮起一道奇异的光柱，直冲云霄，持续了整整一刻钟。',
    '各地魂师议论纷纷：有人说是有神器出世，也有人说是某位大能在渡劫。'
  ],
  choices: [
    { text: '前往光柱方向探查', result: { text: '你赶到时光柱已消散，只在地面留下一片焦痕。你在焦痕中捡到一块温热的奇异石头。', gold: 60, exp: 160, fate: 2, item: { name: '天外奇石', desc: '光柱消散后留下的奇异石头，隐隐散发着魂力波动', effect: { attack: 2 } } } },
    { text: '向老魂师请教异象含义', result: { text: '老魂师说这是天地魂力潮汐的征兆，每逢此时修炼事半功倍。你依言修炼，果然进步神速。', exp: 240, fate: 1 } },
    { text: '记下方位，日后再探', result: { text: '你在心中记下方位。也许等实力更强时，那里还藏着什么秘密。', fate: 1, exp: 100 } }
  ]
}
);

// ==================== 地点专属探索事件 ====================
// 保持统一事件库与地点探索队列共用同一份数据，避免 Vue 与审计看到不同事件集合。
EVENTS.push(...LOCATION_EVENTS);
