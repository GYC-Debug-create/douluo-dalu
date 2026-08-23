/**
 * 生成《游戏全文字手册》—— 把全部游戏数据 + 规则展开为一份纯文字 MD。
 * 数据 100% 来自游戏源（事件库/图鉴 JSON/引擎公式），因此与游戏行为一致；
 * 数据变更后重跑本脚本即可：node scripts/generate-text-manual.mjs
 */
import { EVENTS, DYNAMIC_EVENTS, CHAINED_EVENTS, ENDINGS, ORIGINS, SKILL_TREE,
         ACHIEVEMENTS, TITLES, QUESTS, SHOP_ITEMS, TRAINING_OPTIONS, FORGE_RECIPES,
         DAILY_REWARDS, CHALLENGE_TOWER, NPC_RELATION_LEVELS, TIME_PERIODS, WEATHER_TYPES
       } from '../frontend/src/data/game-data.js';
import '../frontend/src/data/events-expanded.js';
import { experienceNeededForLevel, RING_LEVELS } from '../frontend/src/engine/rules.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(readFileSync(resolve(root, 'public/data', p), 'utf8'));
const beastCodex = J('beast-codex.json').beasts ?? [];
const spiritCodex = J('spirit-codex.json').spirits ?? [];
const spiritEvents = J('spirit-events.json').spirit_events ?? {};
const spiritMap = J('spirit-event-map.json').mappings ?? [];
const mapData = J('map-data.json').locations ?? [];
const npcCodexRaw = J('npc-codex.json');
const npcCodex = Array.isArray(npcCodexRaw) ? npcCodexRaw : Object.values(npcCodexRaw).flat();
const ringCodex = J('ring-codex.json').rings ?? [];

const TIER_NAMES = { low: '低级武魂', mid: '中级武魂', high: '高级武魂', top: '顶级武魂', god: '神级武魂' };
const PHASE_NAMES = { academy: '学院期(Lv.1-10)', adventure: '历练期(Lv.11-40)', master: '大师期(Lv.41-70)', god: '封神期(Lv.71-100)', any: '任意阶段' };
const RING_TIERS = { ten: '十年白', hundred: '百年黄', thousand: '千年紫', ten_thousand: '万年黑', hundred_thousand: '十万年红' };
const STAT_NAMES = { attack: '攻击', defense: '防御', hp: '生命', speed: '速度', fate: '命运', spiritPowerGain: '魂力上限', gold: '金币' };

const BATTLE_ALIASES = {
  one_eye_wolf: '独眼狼', flower_snake: '花蛇', rock_python: '岩蟒', nether_wolf_king: '幽冥狼王',
  titan_giant_ape: '泰坦巨猿', titan_giant_ape_king: '泰坦巨猿王', spirit_deer_ten: '灵鹿',
  poison_spider_ten: '毒蛛', poison_spider_hundred: '毒蛛', poison_spider: '毒蛛',
  wind_rabbit_ten: '野兔', wind_rabbit_hundred: '野兔', wild_rabbit: '野兔',
  black_water_dragon: '黑水蛟龙', dark_gold_terrorclaw_bear: '暗金恐爪熊',
  deep_sea_demon_whale_king: '深海魔鲸王', flame_tiger: '烈焰虎', human_faced_spider: '人面魔蛛',
  ice_emperor_scorpion: '冰帝蝎', ice_wolf: '冰狼', iron_armor_bear: '铁甲熊', iron_horn_sheep: '铁角羊',
  thousand_eye_centipede: '千眼蜈蚣', thunder_bird: '雷鸟', wind_butterfly: '风蝶', wind_spirit_swallow: '风灵燕'
};
const NPC_BATTLES = {
  academy_rival: '天斗学院·小霸王（实力约为玩家的85%）',
  prelim_fighter: '预赛对手·疾风剑士（约92%）',
  final_fighter: '决赛对手·武魂殿天才（约108%）',
  arena_fighter: '竞技场·双刀客（约98%）',
  evil_master: '邪魂师·黑袍人（约103%）',
  god_rival: '神位传承者·宿敌（约115%）',
  holy_lord: '武魂殿圣殿大供奉（旧版最终Boss，血量约210%）',
  bibi_dong: '教皇比比东【最终Boss】（攻防约为玩家95%/90%，血量230%）'
};
function battleName(key) {
  if (key && typeof key === 'object') return key.name || '指定对手（见事件说明）';
  if (NPC_BATTLES[key]) return NPC_BATTLES[key];
  const target = BATTLE_ALIASES[key] || key;
  return `${target}（数值见第四章敌人图鉴）`;
}

const idToName = new Map();
for (const e of EVENTS) if (e.id) idToName.set(e.id, e.name);
for (const e of DYNAMIC_EVENTS) if (e.id) idToName.set(e.id, e.name);
for (const c of Object.values(CHAINED_EVENTS)) if (c.id) idToName.set(c.id, c.name);

function fmtCond(c) {
  if (!c) return '';
  const parts = [];
  if (c.level) parts.push(`等级≥${c.level}`);
  if (c.attack) parts.push(`攻击≥${c.attack}`);
  if (c.defense) parts.push(`防御≥${c.defense}`);
  if (c.speed) parts.push(`速度≥${c.speed}`);
  if (c.gold) parts.push(`金币≥${c.gold}`);
  if (c.fate) parts.push(`命运值≥${c.fate}`);
  if (c.item) parts.push(`背包持有「${c.item}」${c.itemCount ? `×${c.itemCount}` : '×1'}`);
  return parts.join('、');
}
function itemText(it) {
  if (!it || !it.name) return '';
  const count = Number.isFinite(Number(it.count)) && Number(it.count) !== 0 ? Math.abs(Number(it.count)) : 1;
  const eff = it.effect ? `（效果：${Object.entries(it.effect).map(([k, v]) => `${STAT_NAMES[k] || k}+${v}`).join('、')}）` : '';
  return `获得「${it.name}」×${count}${Number(it.count) < 0 ? '（消耗）' : ''}${it.desc ? '——' + it.desc : ''}${eff}`;
}
function fmtResult(r) {
  if (!r) return [];
  const out = [];
  const gain = [];
  if (r.exp) gain.push(`经验+${r.exp}`);
  if (r.gold) gain.push(`金币${r.gold > 0 ? '+' : ''}${r.gold}`);
  if (r.attack) gain.push(`攻击${r.attack > 0 ? '+' : ''}${r.attack}（永久）`);
  if (r.defense) gain.push(`防御${r.defense > 0 ? '+' : ''}${r.defense}（永久）`);
  if (r.speed) gain.push(`速度${r.speed > 0 ? '+' : ''}${r.speed}（永久）`);
  if (r.maxHp) gain.push(`生命上限+${r.maxHp}（并恢复等量生命）`);
  if (r.heal) gain.push(`恢复生命${r.heal}`);
  if (r.damage) gain.push(`受到${r.damage}点伤害`);
  if (r.hp !== undefined) { const n = Number(r.hp); gain.push(n >= 0 ? `恢复生命${n}` : `受到${-n}点伤害`); }
  if (r.mp) gain.push(`魂力${r.mp > 0 ? '+' : ''}${r.mp}`);
  if (r.spiritPowerGain) gain.push(`魂力上限${r.spiritPowerGain > 0 ? '+' : ''}${r.spiritPowerGain * 2}`);
  if (r.fate) gain.push(`命运值${r.fate > 0 ? '+' : ''}${r.fate}`);
  if (gain.length) out.push('效果：' + gain.join('、'));
  if (r.item) { const t = itemText(r.item); if (t) out.push(t); }
  if (r.item2) { const t = itemText(r.item2); if (t) out.push(t); }
  if (r.evolve) out.push('★ 武魂进化条件达成');
  if (r.battle) out.push(`⚔ 进入战斗：${battleName(r.battle)}`);
  if (r.next) out.push(`→ 跳转事件「${idToName.get(String(r.next)) || r.next}」`);
  return out;
}
function endingReqText(e) {
  if (!e.req) return '无';
  const src = e.req.toString();
  const hits = [];
  if (src.includes('_bossKilled')) hits.push('击败最终Boss比比东');
  if (src.includes('_towerFloor')) hits.push('挑战塔达到20层');
  if (src.includes('_skillTree')) hits.push('技能树学满20节点');
  if (src.includes('_craftedBones')) hits.push('锻造魂骨≥5块');
  if (src.includes('_dynSurvived')) hits.push('触发过濒死顿悟');
  if (src.includes('_fusionUsed')) hits.push('使用过武魂融合');
  return hits.length ? hits.join('、') : `隐藏条件（${src.replace(/\s+/g, ' ').slice(0, 80)}）`;
}
const fill = s => String(s).replace(/\{name\}/g, '你').replace(/\{spirit\}/g, '你的武魂');

const L = [];
const push = (...lines) => L.push(...lines);

/* ================= 文档头 ================= */
const now = new Date();
push('# 斗罗大陆·武魂觉醒 —— 全文字手册');
push('');
push(`> 由 \`scripts/generate-text-manual.mjs\` 从游戏源数据自动生成（${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}）。`);
push(`> 覆盖：常规事件 ${EVENTS.length} 个、动态事件 ${DYNAMIC_EVENTS.length} 个、连锁事件 ${Object.keys(CHAINED_EVENTS).length} 组、武魂专属事件 ${Object.values(spiritEvents).flat().length} 个、结局 ${ENDINGS.length} 个、魂兽 ${beastCodex.length} 种、武魂 ${spiritCodex.length} 个、地图地点 ${mapData.length} 个。`);
push('> 游戏数据更新后重跑脚本即可重新生成，保证与游戏一致。');
push('');
push('## 使用说明（如何只用这份文件"玩"这个游戏）');
push('');
push('- 本手册 = 游戏本身的文字化。按章节查阅即可在没有程序的情况下还原每一次点击与判定。');
push('- 占位符：`{name}`=主角名、`{spirit}`=武魂名，文中已尽量替换为"你/你的武魂"。');
push('- 随机判定：凡标注概率/权重/常见度处用骰子按比例判定；未标注即为必然结果。');
push('- 事件单元读法：先看"出现"行判断是否遇得到 → 读正文 → 玩家从选项中挑一个 → 按"结果/效果"结算。');
push('');
push('---');
push('');

/* ================= 第一章 ================= */
push('# 第一章 开局流程');
push('');
push('## 1.1 标题页按钮');
push('');
push('| 按钮 | 点击后果 |');
push('|---|---|');
push('| 注册 | 用户名2-20位（字母/数字/中文）+密码4-128位 → 建号并登录；每账号独立云端存档 |');
push('| 登录 | 输入账号密码 → 继续/新开冒险；登录后可改密码 |');
push('| 不登录直接玩 | 本地存档模式，进度仅存本机 |');
push('| 继续冒险 | 读最近存档回到现场 |');
push('');
push('## 1.2 第一步：选出身（四选一）');
push('');
push('| 出身 | 描述 | 加成 | 初始属性(攻/防/血/速) | 初始魂力 |');
push('|---|---|---|---|---|');
for (const o of ORIGINS) {
  const w = o.weapon ? `；开局武器「${o.weapon.name}」攻击+${o.weapon.attack}` : '';
  push(`| ${o.name} | ${o.desc} | ${o.bonus}${w} | ${o.stats.attack}/${o.stats.defense}/${o.stats.hp}/${o.stats.speed} | ${o.spiritPower} |`);
}
push('');
push('出身决定初始属性差与少量出身专属事件（第八章标注"限定出身"）。');
push('');
push('## 1.3 第二步：武魂觉醒（抽卡，可重掷）');
push('');
push('| 品质 | 概率 |');
push('|---|---|');
push('| 低级武魂 | 40% |');
push('| 中级武魂 | 35% |');
push('| 高级武魂 | 18% |');
push('| 顶级武魂 | 6% |');
push('| 神级武魂 | 1% |');
push('');
push('- 武魂城世家出身：非神级结果有10%概率升一档。');
push('- 武魂决定初始四维、特质（决定事件奖励"武魂共鸣"倍率）与专属事件线（第十章）。全清单见附录A。');
push('');
push('## 1.4 简单模式 / 完整模式');
push('');
push('- 默认**简单模式**：顶栏只有 背包/地图/旅行/签到 + 存档/帮助/模式切换/返回主页；战斗默认自动（点技能即接管为手动）；不显示命运值。');
push('- 「系统→完整模式」恢复全部功能入口（商店/任务/技能树/魂骨/锻造/修炼/挑战塔/阵法/成就/称号/人物/关系/图鉴），选择随存档保存。');
push('');

/* ================= 第二章 ================= */
push('# 第二章 界面与按钮（每一项点了会怎样）');
push('');
push('## 2.1 场景区核心按钮（主循环）');
push('');
push('| 按钮 | 何时可点 | 点击后果 |');
push('|---|---|---|');
push('| 探索四周 | 非战斗中 | 推进一次世界行动，按第三章顺序产出事件/战斗/休整；时间+1 |');
push('| 原地休息 | 非战斗中 | 恢复少量生命与魂力 |');
push('| 猎杀魂兽 | 等级到10/20/…/90且缺环 | 进入魂环猎取（第六章），吸收后才能继续升级 |');
push('| 继续前行 | 事件结算后 | 回到可探索状态 |');
push('| 查看地图 | 随时 | 大地图页：点相邻地点移动一次；去过的地方可快速旅行 |');
push('');
push('## 2.2 顶栏菜单全表');
push('');
push('| 菜单 | 模式 | 内容与后果 |');
push('|---|---|---|');
push('| 背包 | 两种 | 查看/使用物品（回魂丹+60生命、聚魂丹+40魂力等），即时结算 |');
push('| 商店 | 完整 | 金币购买道具（价目见11.1）；简单模式下隐藏，金币照常累积 |');
push('| 地图/旅行 | 两种 | 移动与探索地图 |');
push('| 任务 | 完整 | 支线任务进度与领奖（11.5） |');
push('| 签到 | 两种 | 每日一次按连续天数领奖（11.6），断签重置 |');
push('| 技能树 | 完整 | 每5级+2技能点学被动（11.7） |');
push('| 魂骨 | 完整 | 查看魂骨与加成 |');
push('| 锻造 | 完整 | 材料+金币合成高级魂骨（11.3） |');
push('| 修炼 | 完整 | 金币换经验（11.2） |');
push('| 挑战塔 | 完整 | 逐层挑战固定Boss（11.4） |');
push('| 阵法 | 完整 | 换战斗阵型：冲锋阵攻+15%防-10%、铁桶阵防+20%攻-5%、疾风阵速+25%、聚灵阵魂力+30% |');
push('| 成就/称号 | 完整 | 查看成就；佩戴称号得金币/魂力加成（11.8/11.9） |');
push('| 人物/关系 | 完整 | NPC图鉴与好感等级（11.10/11.11） |');
push('| 万象图鉴 | 完整 | 武魂/魂兽/魂环图鉴 |');
push('| 存档 | 两种 | 手动保存（登录=云端多档位） |');
push('| 帮助 | 两种 | 玩法说明（简单模式为三句话版） |');
push('| 完整/简单模式 | 两种 | 即时切换界面，不动存档数据 |');
push('| 返回主页 | 两种 | 回标题页（自动保存） |');
push('');
push('## 2.3 状态面板各项');
push('');
push('- 头像/等级/称号（如"Lv.23·大魂师"）、武魂名与品质。');
push('- 三条资源：生命、魂力（放魂技用）、经验（到顶升级）。');
push('- 魂环九宫格：已获魂环的技能名/来源/年限；下方"猎环目标"卡告诉你下一步去哪、点哪个按钮。');
push('- 四维属性：攻击/防御/生命上限/速度（成长公式见3.6）。');
push('- 金币（完整模式另有：命运值、猎魂简记）。');
push('');

/* ================= 第三章 ================= */
push('# 第三章 核心规则引擎');
push('');
push('## 3.1 "探索四周"的判定顺序（每次按此执行）');
push('');
push('1. 主线强制：有等级已到、未完成的主线里程碑（第七章），且人在指定地点 → 直接触发主线。');
push('2. 猎环门槛：等级到10/20/…/90但缺环 → 引导去猎场。');
push('3. 连锁待续：上一事件挂了链条 → 25%概率立即触发下一环（第九章）。');
push('4. 动态事件：满足特殊状态（濒死/连胜等）→ 35%概率插入（第九章）。');
push('5. 随机池：从"阶段匹配+地点匹配+等级达标+非一次性已用"的事件中按常见度加权抽取。');
push('6. 空池休整：恢复生命魂力+25经验。');
push('');
push('## 3.2 阶段与称号');
push('');
push('| 等级段 | 阶段（事件池） | 称号 |');
push('|---|---|---|');
push('| Lv.1-10 | 学院期 | 魂士 |');
push('| Lv.11-20 | 历练期 | 魂师 |');
push('| Lv.21-30 | 历练期 | 大魂师 |');
push('| Lv.31-40 | 历练期 | 魂尊 |');
push('| Lv.41-50 | 大师期 | 魂宗 |');
push('| Lv.51-60 | 大师期 | 魂王 |');
push('| Lv.61-70 | 大师期 | 魂帝 |');
push('| Lv.71-80 | 封神期 | 魂圣 |');
push('| Lv.81-90 | 封神期 | 魂斗罗 |');
push('| Lv.91-99 | 封神期 | 封号斗罗 |');
push('| Lv.100 | 封神期 | 神级魂师（结局判定） |');
push('');
push('## 3.3 魂环硬门槛');
push('');
push(`- 猎环等级：${RING_LEVELS.join(' / ')}，共9环。没有第N环时等级最高停在N×10级，经验暂存。`);
push('- 猎环失败受反噬：伤害约为最大生命的20%+（风险系数/200），生命最多剩1点不会死。');
push('');
push('## 3.4 经验表（升下一级所需 = 40×等级^1.15 四舍五入）');
push('');
push('| 等级 | 经验 | 等级 | 经验 | 等级 | 经验 |');
push('|---|---|---|---|---|---|');
for (let i = 1; i <= 99; i += 3) {
  const a = Math.min(i + 1, 99), b = Math.min(i + 2, 99);
  push(`| ${i} | ${experienceNeededForLevel(i)} | ${a} | ${experienceNeededForLevel(a)} | ${b} | ${experienceNeededForLevel(b)} |`);
}
push('');
push('## 3.5 时间与天气（后台循环，每行动+1）');
push('');
push('- 时段：' + TIME_PERIODS.map(t => `${t.name}（${t.desc}${t.mod && t.mod.expMult ? `，经验×${t.mod.expMult}` : ''}）`).join(' → '));
push('- 天气：' + WEATHER_TYPES.map(w => w.name).join('、') + '。标注"仅白天/夜晚"的事件在时段不符时抽不到。');
push('');
push('## 3.6 属性成长与武魂共鸣');
push('');
push('- 四维 = 武魂基础×(1+等级×0.05) + 出身加成 + 武器攻击，取整，再加上事件/魂骨/技能树的永久加成。');
push('- 事件奖励按武魂特质放大（武魂共鸣）：如治愈系回血×1.5、实用系金币×1.5，结算文本会标注。');
push('');

/* ================= 第四章 ================= */
push('# 第四章 战斗系统全规则');
push('');
push('## 4.1 回合流程');
push('');
push('1. 速度高者先手（相同则玩家先手）。');
push('2. 轮到一方时选择：攻击/魂技/防御【完整】/道具【完整】/武魂融合【完整】/逃跑。');
push('3. 交替行动至一方生命归零或逃跑成功。');
push('');
push('## 4.2 伤害与暴击');
push('');
push('- 基础伤害 = 攻击×(0.88~1.12随机) − 对方防御×0.48，最低1。');
push('- 最终 = 基础 × 连击 × 元素克制 × 暴击 × 状态增减。');
push('- 暴击率 = 5% +（速度差）×0.2% + 连击数×0.5% + 技能树加成，上限65%；暴击伤害150%+技能树加成。');
push('- 连击：连续命中累积，触发"连携终结"追加伤害。');
push('');
push('## 4.3 元素克制表（克制×1.35 / 被克×0.8）');
push('');
push('| 属性 | 克制 |');
push('|---|---|');
push('| 火 | 冰、金、木 |');
push('| 冰 | 雷、水 |');
push('| 雷 | 水、风 |');
push('| 水 | 火、土 |');
push('| 木 | 土、水 |');
push('| 土 | 雷、水 |');
push('| 金 | 木、风 |');
push('| 风 | 土 |');
push('| 光/暗 | 互克 |');
push('');
push('## 4.4 状态效果');
push('');
push('| 状态 | 效果 |');
push('|---|---|');
push('| 燃烧/中毒 | 每回合掉血 |');
push('| 冻结/眩晕 | 无法行动 |');
push('| 虚弱 | 造成的伤害×0.75 |');
push('| 破甲 | 受到的伤害×1.2 |');
push('| 再生 | 每回合回血 |');
push('| 狂暴 | 造成的伤害×1.3 |');
push('| 护盾/疾风 | 防御/速度增益 |');
push('');
push('## 4.5 指令说明');
push('');
push('| 指令 | 说明 |');
push('|---|---|');
push('| 攻击 | 无消耗普攻 |');
push('| 魂技 | 耗魂力、有冷却；技能由武魂决定（附录A）。简单模式按钮常显，点它自动切手动 |');
push('| 武魂融合【完整】 | ≥3环、40魂力、每场1次：高伤+护盾 |');
push('| 防御【完整】 | 受伤减半 |');
push('| 道具【完整】 | 战斗中用消耗品 |');
push('| 逃跑 | Boss战/最终决战不可逃；失败挨一下 |');
push('| 自动 | AI优先放第一个"魂力够+不在冷却"的魂技，否则普攻；玩家点攻击/技能即接管手动 |');
push('| 1×/2×/3× | 战斗节奏 |');
push('');
push('## 4.6 胜负结算');
push('');
push('- 胜利：得事件/敌人标注的经验金币；魂兽按掉率掉魂骨（Boss更高概率品质），加成自动生效。');
push('- 失败：生命保留1点不丢档；主线战败给该里程碑2次行动冷却后可再试。');
push('');
push('## 4.7 敌人图鉴（30种魂兽×5年限档）');
push('');
push('> 年限档按玩家等级定：Lv.1-9十年、10-27百年、28-49千年、50-74万年、75+十万年（事件指定优先）。名字带"王/皇/帝"=Boss不可逃。');
push('');
for (const b of beastCodex) {
  const vs = b.variants || {};
  const tiers = Object.entries(vs).map(([k, v]) => `${RING_TIERS[k] || k}:攻${v.attack}/防${v.defense}/血${v.hp}/速${v.speed}(${v.ringColor}环·掉率${Math.round((v.dropRate || 0) * 100)}%)`).join(' ｜ ');
  push(`- **${b.name}**${b.specialAbility ? '（特技：' + b.specialAbility + '）' : ''} ${tiers}`);
}
push('');
push('**人形对手**（按当时玩家面板折算）：');
for (const v of Object.values(NPC_BATTLES)) push(`- ${v}`);
push('');

/* ================= 第五章 ================= */
push('# 第五章 世界地图');
push('');
push('| 地点 | 解锁 | 相邻（可互达） | 简介 |');
push('|---|---|---|---|');
for (const l of mapData) {
  const conn = (l.connectedTo || []).map(id => (mapData.find(x => x.id === id) || {}).name || id).join('、') || '—';
  push(`| ${l.name} | Lv.${l.unlockedLevel ?? 1} | ${conn} | ${String(l.description || '').slice(0, 50)} |`);
}
push('');

/* ================= 第六章 ================= */
push('# 第六章 魂环猎取（9次关键抉择）');
push('');
push('> 到10/20/…/90级触发。选猎物→战斗→胜利吸收魂环并解锁魂技；失败受反噬可再试。颜色：白十年/黄百年/紫千年/黑万年/红十万年。');
push('');
for (const ev of EVENTS.filter(e => /^ring_hunt_\d+$/.test(e.id || ''))) {
  const n = ev.id.replace('ring_hunt_', '');
  push(`## Lv.${n} 猎取第${n}魂环「${ev.name}」`);
  push('');
  for (const t of ev.text || []) push(fill(t));
  push('');
  (ev.choices || []).forEach((c, i) => {
    push(`- **选项${i + 1}：${c.text}**${c.cond ? `（需要：${fmtCond(c.cond)}）` : ''}`);
    const r = c.result || {};
    if (r.text) push(`  - ${fill(r.text)}`);
    const fx = fmtResult(r); if (fx.length) push(`  - ${fx.join('；')}`);
  });
  push('');
}
if (ringCodex.length) {
  push('## 魂环体系图鉴');
  push('');
  for (const r of ringCodex) {
    const name = r.name || r.tier || r.id || '';
    const desc = r.desc || r.description || '';
    if (name) push(`- **${name}**${desc ? '：' + String(desc).slice(0, 90) : ''}`);
  }
  push('');
}

/* ================= 第七章 ================= */
push('# 第七章 主线里程碑（顺序强制触发）');
push('');
push('| # | 里程碑 | 触发等级 | 指定地点 | 前置 |');
push('|---|---|---|---|---|');
const MAIN_STORY = [
  ['first_hunt', '第一次魂兽实战', 5, '星斗大森林外围', '—'],
  ['reach_lv10', '修炼之途', 10, '任意', '第一次魂兽实战'],
  ['soul_master_prelim', '魂师大赛·预赛', 30, '天斗城', '修炼之途'],
  ['spirit_hall_exam', '武魂殿考核', 30, '武魂城', '魂师大赛·预赛'],
  ['soul_master_final', '魂师大赛·决赛', 40, '天斗城', '魂师大赛·预赛'],
  ['god_trial_sea', '神位传承·海神九考', 50, '海神岛', '魂师大赛·决赛'],
  ['ml_bibi_omen', '教皇的影子', 60, '武魂城', '神位传承'],
  ['ml_bibi_hunt', '猎魂封锁线', 72, '星斗大森林深处', '教皇的影子'],
  ['final_evil', '最终决战·讨伐武魂殿', 95, '武魂城', '神位传承+猎魂封锁线'],
];
MAIN_STORY.forEach(([id, name, lv, loc, req], i) => push(`| ${i + 1} | ${name} | Lv.${lv} | ${loc} | ${req} |`));
push('');
push('主线不进随机池；等级到了去指定地点点"探索四周"即触发。事件明细在第八章对应阶段内（标★）。');
push('');

/* ================= 第八章 ================= */
push('# 第八章 事件全库（每个事件一个小单元）');
push('');
push('> 读法：**出现**行判断是否遇得到 → 正文 → 选项（含条件）→ 结果与效果。');
push('> 常见度=同池内相对权重（大=更容易）；"一次性"=全程仅1次；战斗对手查第四章；跳转查本库。');
push('');
function renderEvent(ev, level) {
  const h = '#'.repeat(level);
  push(`${h} ${ev.id}｜${ev.name}`);
  const meta = [];
  meta.push(ev.location ? `地点「${ev.location}」` : '任意地点');
  meta.push(PHASE_NAMES[ev.phase] || ev.phase || '任意阶段');
  if (ev.minLevel) meta.push(`等级≥${ev.minLevel}`);
  if (ev.maxLevel) meta.push(`等级≤${ev.maxLevel}`);
  if (ev.unique) meta.push('一次性');
  if (ev.weight === 0) meta.push('仅主线触发（不进随机池）');
  else if (ev.weight !== undefined) meta.push(`常见度${ev.weight}`);
  if (ev.timeOfDay) meta.push(ev.timeOfDay === 'day' ? '仅白天' : '仅夜晚');
  if (ev.origin) meta.push(`限定出身「${ev.origin}」`);
  if (ev.spiritId) meta.push('限定武魂');
  if (ev.tags && ev.tags.length) meta.push(`标签:${ev.tags.join('/')}`);
  if (ev.npcIds && ev.npcIds.length) meta.push(`人物:${ev.npcIds.join('、')}`);
  push(`- **出现**：${meta.join(' ｜ ')}`);
  for (const t of ev.text || []) push(`- ${fill(t)}`);
  (ev.choices || []).forEach((c, i) => {
    const cond = fmtCond(c.cond || c.condition);
    push(`- **选项${i + 1}：${c.text}**${cond ? `（需要：${cond}）` : ''}${c.requirementHint ? `（动态条件：${c.requirementHint}）` : ''}`);
    const r = c.result;
    if (r && r.text) push(`  - ${fill(r.text)}`);
    const fx = fmtResult(r); if (fx.length) push(`  - ${fx.join('；')}`);
    if (!r && c.next) push(`  - → 跳转「${idToName.get(String(c.next)) || c.next}」`);
    if (!r && !c.next) push('  - （仅推进剧情，无数值变化）');
  });
  push('');
}
const MAIN_IDS = new Set(MAIN_STORY.map(x => x[0]));
const RING_IDS = new Set(EVENTS.filter(e => /^ring_hunt_\d+$/.test(e.id || '')).map(e => e.id));
const byPhase = { academy: [], adventure: [], master: [], god: [], any: [] };
for (const ev of EVENTS) {
  if (RING_IDS.has(ev.id)) continue;
  const p = ev.phase && byPhase[ev.phase] !== undefined ? ev.phase : 'any';
  byPhase[p].push(ev);
}
const sorter = (a, b) => (a.minLevel || 1) - (b.minLevel || 1) || String(a.id).localeCompare(String(b.id));
for (const p of ['academy', 'adventure', 'master', 'god']) {
  push('---');
  push(`## ${PHASE_NAMES[p]}（${byPhase[p].length}个事件）`);
  push('');
  const main = byPhase[p].filter(e => MAIN_IDS.has(e.id)).sort(sorter);
  if (main.length) {
    push('### ★ 本阶段主线事件');
    push('');
    main.forEach(e => renderEvent(e, 4));
  }
  push('### 常规事件');
  push('');
  byPhase[p].filter(e => !MAIN_IDS.has(e.id)).sort(sorter).forEach(e => renderEvent(e, 4));
}

/* ================= 第九章 ================= */
push('# 第九章 动态事件与连锁事件');
push('');
push('## 9.1 动态事件（特殊状态下35%概率插入）');
push('');
for (const ev of DYNAMIC_EVENTS) {
  push(`- **${ev.name}**（${ev.once ? '仅一次' : '可重复'}${ev.cooldown ? `，冷却${ev.cooldown}次行动` : ''}）：${fill((ev.text || [])[0] || '')}`);
  (ev.choices || []).forEach(c => {
    let tail = c.requirementHint ? `（${c.requirementHint}）` : '';
    if (c.result) {
      const parts = [c.result.text, ...fmtResult(c.result).filter(x => x.startsWith('效果'))].filter(Boolean);
      tail += '：' + fill(parts.join('；'));
    } else tail += '：效果由当时的动态规则结算';
    push(`  - 「${c.text}」${tail}`);
  });
}
push('');
push('## 9.2 连锁事件（前情→后续）');
push('');
for (const chain of Object.values(CHAINED_EVENTS)) renderEvent(chain, 3);

/* ================= 第十章 ================= */
push('# 第十章 武魂专属事件（按武魂分组）');
push('');
const spiritNameById = new Map(spiritCodex.map(s => [s.id, s.name]));
for (const [key, arr] of Object.entries(spiritEvents)) {
  const owners = spiritMap.filter(m => m.eventKey === key).map(m => spiritNameById.get(m.spiritId) || m.spiritId);
  push(`## 专属线「${key}」——属于：${owners.join('、') || '待定'}`);
  push('');
  for (const ev of arr) {
    push(`### ${ev.id}｜${ev.title || ev.name || ''}`);
    push(`- **出现**：等级≥${ev.minLevel || 1}${ev.phase ? ` ｜ ${PHASE_NAMES[ev.phase] || ev.phase}` : ''}${ev.maxLevel ? ` ｜ 等级≤${ev.maxLevel}` : ''}`);
    for (const t of [].concat(ev.text || [])) push(`- ${fill(t)}`);
    (ev.choices || []).forEach((c, i) => {
      push(`- **选项${i + 1}：${c.text}**`);
      const r = c.result;
      if (r && r.text) push(`  - ${fill(r.text)}`);
      const fx = fmtResult(r); if (fx.length) push(`  - ${fx.join('；')}`);
    });
    push('');
  }
}

/* ================= 第十一章 ================= */
push('# 第十一章 周边系统全表【完整模式】');
push('');
push('## 11.1 商店价目');
push('');
push('| 商品 | 效果 | 价格 |');
push('|---|---|---|');
for (const s of SHOP_ITEMS) push(`| ${s.name} | ${s.desc} | ${s.price}金币 |`);
push('');
push('## 11.2 修炼档位');
push('');
push('| 方式 | 花费 | 收益 |');
push('|---|---|---|');
for (const t of TRAINING_OPTIONS) push(`| ${t.name} | ${t.goldCost}金币 | ${t.expGain}经验${t.time ? `（${t.time}）` : ''} |`);
push('');
push('## 11.3 锻造配方');
push('');
for (const f of FORGE_RECIPES) {
  const mats = (f.materials || []).map(m => `${m.type === 'any' ? '任意魂骨' : m.type}×${m.count}${m.minTier ? `（≥${m.minTier}阶）` : ''}`).join('、');
  const r = f.result || {};
  push(`- **${f.name}**：${f.desc}。材料 ${mats} + ${f.goldCost}金币 → ${r.name}（攻+${r.attack || 0} 防+${r.defense || 0} 血+${r.hp || 0} 速+${r.speed || 0}）`);
}
push('');
push('## 11.4 挑战塔');
push('');
push(`**${CHALLENGE_TOWER.name}**：${CHALLENGE_TOWER.desc || ''}`);
push('');
push('| 层 | 名称 | 需等级 | 守护者（血/攻/防/速/属性） | 奖励 |');
push('|---|---|---|---|---|');
for (const f of CHALLENGE_TOWER.floors || []) {
  const e = f.enemy || {};
  push(`| ${f.floor} | ${f.name} | Lv.${f.minLv} | ${e.name}（${e.hp}/${e.attack}/${e.defense}/${e.speed}/${e.element || '无'}） | ${(f.reward && f.reward.gold) || 0}金币+${(f.reward && f.reward.exp) || 0}经验 |`);
}
push('');
push('## 11.5 支线任务');
push('');
for (const q of QUESTS) {
  const r = q.reward || {};
  const rw = [r.gold ? r.gold + '金币' : '', r.exp ? r.exp + '经验' : '', r.item ? '「' + (r.item.name || '道具') + '」' : ''].filter(Boolean).join('、');
  push(`- **${q.name}**：${q.desc} → ${rw || '见游戏内'}`);
}
push('');
push('## 11.6 每日签到（连续天数，断签重置）');
push('');
for (const d of DAILY_REWARDS) {
  const r = d.reward || {};
  const rw = [r.gold ? r.gold + '金币' : '', r.exp ? r.exp + '经验' : '', r.item ? '「' + (r.item.name || '道具') + '」' : '', r.fatePoint ? '命运值+' + r.fatePoint : ''].filter(Boolean).join('、');
  push(`- 第${d.day}天「${d.name}」：${rw || '见游戏内'}`);
}
push('');
push('## 11.7 技能树（每5级+2点）');
push('');
for (const branch of Object.values(SKILL_TREE)) {
  push(`### ${branch.icon} ${branch.name}`);
  push('');
  push('| 节点 | 效果 | 消耗 | 前置 |');
  push('|---|---|---|---|');
  for (const n of branch.nodes) push(`| ${n.name} | ${n.desc} | ${n.cost}点 | ${(n.req && n.req.length) ? n.req.join('→') : '无'} |`);
  push('');
}
push('## 11.8 成就（自动判定）');
push('');
for (const a of ACHIEVEMENTS) push(`- ${a.icon || '🏆'} **${a.name}**：${a.desc}`);
push('');
push('## 11.9 称号（佩戴生效）');
push('');
for (const t of TITLES) {
  const b = Object.entries(t.bonus || {}).map(([k, v]) => `${STAT_NAMES[k] || k}+${v}`).join('、');
  push(`- **${t.name}**：${t.desc}${b ? `（加成：${b}）` : ''}`);
}
push('');
push('## 11.10 好感等级');
push('');
for (const r of NPC_RELATION_LEVELS) push(`- 好感≥${r.min}：${r.name}`);
push('');
push('## 11.11 NPC 图鉴');
push('');
for (const n of npcCodex) {
  if (!n || !n.name) continue;
  push(`- **${n.name}**${n.identity || n.title ? `（${n.identity || n.title}）` : ''}${n.desc ? '：' + String(n.desc).slice(0, 70) : ''}`);
}
push('');

/* ================= 第十二章 ================= */
push('# 第十二章 结局（Lv.100+完成最终决战后判定）');
push('');
push('规则：先按顺序匹配带特殊条件的结局（第一个满足即中）；否则按命运值门槛从高到低取第一个达标者；全不达标落入「暗影传说」。');
push('');
for (const e of ENDINGS) {
  push(`## ${e.title}`);
  push('');
  push(`条件：命运值≥${e.minFate}${e.req ? `；且${endingReqText(e)}` : ''}`);
  push('');
  for (const t of e.text || []) push(fill(t));
  push('');
}

/* ================= 附录 ================= */
push('# 附录A 武魂全清单（觉醒池）');
push('');
for (const tier of ['low', 'mid', 'high', 'top', 'god']) {
  const list = spiritCodex.filter(s => s.tier === tier);
  push(`## ${TIER_NAMES[tier]}（${list.length}个）`);
  push('');
  push('| 武魂 | 系别 | 初始攻/防/血/速 | 稀有度 | 特质 |');
  push('|---|---|---|---|---|');
  for (const s of list) push(`| ${s.name} | ${s.type}·${s.subtype || ''} | ${s.attack}/${s.defense}/${s.hp}/${s.speed} | ${s.rarity || ''} | ${(s.traits || []).join('、')} |`);
  push('');
}
push('# 附录B 事件产出物品汇总');
push('');
const items = new Map();
const collectItem = it => {
  if (!it || !it.name || items.has(it.name)) return;
  const eff = it.effect ? `（${Object.entries(it.effect).map(([k, v]) => `${STAT_NAMES[k] || k}+${v}`).join('、')}）` : '';
  items.set(it.name, `${it.desc || ''}${eff}`);
};
for (const ev of EVENTS) for (const c of ev.choices || []) { collectItem(c.result && c.result.item); collectItem(c.result && c.result.item2); }
for (const arr of Object.values(spiritEvents)) for (const ev of arr) for (const c of ev.choices || []) collectItem(c.result && c.result.item);
for (const [name, desc] of items) push(`- **${name}**${desc ? '：' + desc : ''}`);
push('');
push('---');
push('');
push(`*手册完：常规${EVENTS.length} / 动态${DYNAMIC_EVENTS.length} / 连锁${Object.keys(CHAINED_EVENTS).length}组 / 武魂专属${Object.values(spiritEvents).flat().length} / 结局${ENDINGS.length}。*`);

const out = L.join('\n');
mkdirSync(resolve(root, 'docs'), { recursive: true });
const outFile = resolve(root, 'docs', '游戏全文字手册.md');
writeFileSync(outFile, out, 'utf8');
console.log(`已生成 ${outFile}`);
console.log(`规模：${(out.length / 10000).toFixed(1)}万字符 / ${L.length}行`);
