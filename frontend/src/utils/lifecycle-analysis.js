import { ORIGINS, SKILL_TREE, ACHIEVEMENTS, CHALLENGE_TOWER, DAILY_REWARDS, SHOP_ITEMS, NPC_RELATION_LEVELS, ENDINGS, EVENTS, DYNAMIC_EVENTS, CHAINED_EVENTS } from '@/data/game-data'
import { LOCATION_EVENTS } from '@/data/location-events'
import '@/data/events-expanded'
import { MAIN_STORY_EVENTS } from '@/data/main-story'
import { experienceNeededForLevel, phaseForLevel, RING_LEVELS, OVERFLOW_LEVEL_LIMIT, classifyEventLocation, GLOBAL_LOCATION_PREFIX, levelCapForRings } from '@/engine/rules'
import { adaptEvent, isEventEligible, PHASE_RANGES, MAIN_STORY_MILESTONES } from '@/engine/event-rules'
import { ringAbsorbChance, ringYearValueFor, buildRingReward } from '@/engine/settlement'
import { encounterDifficulty } from '@/engine/battle-contract'
import { travelCost, travelDays, findShortestRoute, buildHiddenLocationClues, TRAVEL_ENCOUNTER_RATES } from '@/utils/mapBridge'
import { TRAVEL_ENCOUNTERS } from '@/utils/travel-encounters'
import { ringDefinitionIdForChoice } from '@/utils/ring-hunt'
import { itemPurchaseAvailability, ACHIEVEMENT_REWARD } from '@/engine/economy-rules'
import { SPIRIT_TRAITS, TRAIT_BONUS } from '@/engine/traits'
import { NPC_INTERACTIONS, NPC_RELATION_REWARDS } from '@/engine/relationship-rules'
import spiritPayload from '../../../public/data/spirit-codex.json'
import beastPayload from '../../../public/data/beast-codex.json'
import ringPayload from '../../../public/data/ring-codex.json'
import mapPayload from '../../../public/data/map-data.json'
import spiritEventsPayload from '../../../public/data/spirit-events.json'
import spiritEventMapPayload from '../../../public/data/spirit-event-map.json'

const spirits = spiritPayload.spirits || []
const beasts = beastPayload.beasts || []
const locations = mapPayload.locations || []
const pct = value => `${(value * 100).toFixed(4)}%`
const spiritIdsByKey = new Map((spiritEventMapPayload.mappings || []).map(entry => [entry.eventKey, entry.spiritId]))
const jsonSpiritEvents = Object.entries(spiritEventsPayload.spirit_events || {}).flatMap(([key, rows]) => {
  const spiritId=spiritIdsByKey.get(key), spirit=spirits.find(row=>row.id===spiritId)
  return (rows||[]).map(source=>adaptEvent({...source,name:source.name||source.title||'武魂专属事件',location:source.location||'斗罗大陆',text:Array.isArray(source.text)?source.text:[String(source.text||'')],choices:Array.isArray(source.choices)?source.choices:[],spiritId,spiritType:spirit?.type,spiritSubtype:spirit?.subtype,spiritTier:spirit?.tier,spiritEventKey:key,unique:source.unique!==false,phase:(Number(source.minLevel)||1)<=6?'academy':Number(source.minLevel)<=18?'adventure':Number(source.minLevel)<=40?'master':'god'}, {spiritMeta:spirit||{}}))
})
const eventPool = [...new Map([...EVENTS, ...MAIN_STORY_EVENTS, ...jsonSpiritEvents].map(event => [event.id, event])).values()]
const meta = (domain, title, explanation, source) => ({ domain, title, explanation, source })

export function creationAnalysis() {
  const baseWeights = { low: 40, mid: 35, high: 18, top: 6, god: 1 }
  // Each non-god result has an independent 10% chance to advance exactly one tier.
  const recommendedWeights = { low: 36, mid: 35.5, high: 19.7, top: 7.2, god: 1.6 }
  const distribution = weights => Object.entries(weights).map(([tier, weight]) => ({ tier, weight, probability: weight / 100, percent: pct(weight / 100) }))
  const quality = ['god', 'top', 'high', 'mid', 'low'].map(tier => {
        const pool = spirits.filter(spirit => spirit.tier === tier)
    const ranges={god:[100,100],top:[85,99],high:[70,84],mid:[40,64],low:[10,34]}
    const [minTalent,maxTalent]=ranges[tier]
    const recommendedMin=tier==='god'?100:Math.min(100,minTalent+10)
    const recommendedMax=tier==='god'?100:Math.min(100,maxTalent+19)
    return { tier, count: pool.length, generatedTalentRange:{min:minTalent,max:maxTalent}, recommendedOriginGeneratedRange:{min:recommendedMin,max:recommendedMax}, talentBasis: 'CreatePage.vue rollSpiritDraw 的 tierPower 和 qualityBoost 加值区间；top另有10%概率直接定为100；不是武魂 JSON 固有属性' }
  })
  const baseNatural=1-Math.pow(0.99,49), recommendedNatural=1-Math.pow(0.984,49)
  return { ...meta('creation', '创建与觉醒', '品质先按档位概率抽取，再从该档武魂池等概率抽取。推荐出身每次对非神级结果有独立10%概率上调一个档位，保底按该出身独立累计。', 'CreatePage.vue rollSpiritTier/rollSpiritDraw；creation-pity.js；public/data/spirit-codex.json'), origins: ORIGINS.map(o => ({ id:o.id, name:o.name, bonus:o.bonus, qualityBoost:Boolean(o.qualityBoost), stats:o.stats, spiritPower:o.spiritPower })), tierWeights: { base: distribution(baseWeights), recommended: distribution(recommendedWeights), recommendedRule: '武魂城世家：对每次非神级初始结果，各自有10%概率升一档（低→中→高→顶→神）；不是把10个百分点整体加给神级。' }, pity: { cap:50, denominator:'50次未自然神级的连续非神级抽取；第50次仍非神级则手动自选神级。', naturalGodBeforePity:{baseProbability:baseNatural,basePercent:pct(baseNatural),recommendedProbability:recommendedNatural,recommendedPercent:pct(recommendedNatural)}, overallGodBy50Guaranteed:true, pityGuaranteedAt50:true, note:'自然概率只算前49次；第50次非自然触发保底时仍保证神级。' }, quality }
}

export function progressionAnalysis() {
  let cumulative = 0
  const levels = Array.from({length:99},(_,i)=>{ const level=i+1, required=experienceNeededForLevel(level); cumulative+=required; return {level,required,cumulative,phase:phaseForLevel(level),ringGate: RING_LEVELS.includes(level) ? `${level}级需要第${level/10}魂环` : null} })
  return { ...meta('progression','成长、主线与结局','升级经验引用引擎逐级函数；累计值为从1级升至对应下一级的总经验。魂环门槛按九环等级数组标示。主线和结局以当前内容配置统计。','engine/rules.js；engine/event-rules.js；game-data.js；main-story.js'), levels, gates:RING_LEVELS.map((level,i)=>({ring:i+1,level,capBeforeRing:level,afterRingCap:level+10})), mainStory:MAIN_STORY_MILESTONES.map((m,i)=>({order:i+1,id:m.id,name:m.name,minLevel:m.minLevel,targetId:m.targetId,requires:m.requires})), endings:ENDINGS.map(e=>({id:e.id,title:e.title,minFate:e.minFate,condition:e.req?'条件函数门槛（见来源）':'命运值门槛',tendency:e.tendency||null})), overflowLevelLimit:OVERFLOW_LEVEL_LIMIT }
}

export function contentAnalysis(level=30) {
  const lv=Math.max(1,Math.min(100,Math.floor(Number(level)||30))), phase=phaseForLevel(lv)
  const candidates=eventPool.map(e=>adaptEvent(e))
  const places=locations.map(l=>({id:l.id,name:l.name,match:e=>{
    if(!e.location || GLOBAL_LOCATION_PREFIX.test(e.location)) return true
    if(e.location.includes(l.id)||l.id.includes(e.location)) return true
    const classified=classifyEventLocation(e.location,locations)
    if(classified.scope==='global') return true
    if(classified.scope==='mapped'&&classified.id==='shrek_academy'&&!String(e.location).includes('史莱克')) return l.id==='nuoding_city' // first-time story scenario, before joined_shrek
    return classified.scope==='mapped'&&classified.id===l.id
  }}))
  const stages=Object.entries(PHASE_RANGES).map(([key,[min,max]])=>({phase:key,min,max,available:lv>=min&&lv<=max}))
  const ctx={level:lv,phase,ringCount:Math.max(0,Math.floor((lv-1)/10)),doneEvents:[],storyMarks:[],season:'spring',timeOfDay:'day',isRingHunt:false,isMainStory:false,ascended:false,spirit:{}}
  const byPlace=places.map(place=>{const eligible=candidates.filter(e=>isEventEligible(e,{...ctx,spirit:{},locationMatches:place.match(e)})); return {locationId:place.id,location:place.name,count:eligible.length,weightedSlots:eligible.reduce((n,e)=>n+Math.max(0,Number(e.weight)||0),0),eventIds:eligible.map(e=>e.id)}}).filter(p=>p.count)
  const rewardEvents=candidates.filter(e=>isEventEligible(e,{...ctx,locationMatches:true}))
  const jsonSpiritSpecific=spirits.map(spirit=>{const own=jsonSpiritEvents.filter(e=>isEventEligible(e,{...ctx,spirit:{id:spirit.id,type:spirit.type,subtype:spirit.subtype,tier:spirit.tier},locationMatches:true}));const rewards=own.flatMap(event=>(event.choices||[]).map(choice=>({exp:Number(choice.result?.exp)||0,gold:Number(choice.result?.gold)||0})));return {spiritId:spirit.id,spiritName:spirit.name,count:own.length,eventIds:own.map(e=>e.id),rewardDistribution:{experience:{min:Math.min(0,...rewards.map(x=>x.exp)),max:Math.max(0,...rewards.map(x=>x.exp)),choiceCount:rewards.length},gold:{min:Math.min(0,...rewards.map(x=>x.gold)),max:Math.max(0,...rewards.map(x=>x.gold)),choiceCount:rewards.length}}}}).filter(row=>row.count)
  const rewardValues=rewardEvents.flatMap(e=>(e.choices||[]).map(c=>({id:e.id,name:e.name,exp:Number(c.result?.exp)||0,gold:Number(c.result?.gold)||0})))
  const stats=key=>{const a=rewardValues.map(x=>x[key]);return {min:Math.min(0,...a),max:Math.max(0,...a),average:a.length?a.reduce((s,n)=>s+n,0)/a.length:0,choiceCount:a.length,positiveCount:a.filter(n=>n>0).length}}
  const phaseRewards=Object.entries(PHASE_RANGES).map(([phaseName,[minLevel,maxLevel]])=>{
    const rewards=[]
    for(let stageLevel=minLevel;stageLevel<=maxLevel;stageLevel++){
      const stageContext={...ctx,level:stageLevel,phase:phaseName,ringCount:Math.max(0,Math.floor((stageLevel-1)/10)),spirit:{},locationMatches:true}
      for(const event of candidates.filter(item=>isEventEligible(item,stageContext))) for(const choice of event.choices||[]) rewards.push({exp:Number(choice.result?.exp)||0,gold:Number(choice.result?.gold)||0})
    }
    const measure=key=>{const values=rewards.map(item=>item[key]);return {min:Math.min(0,...values),max:Math.max(0,...values),average:values.length?values.reduce((s,n)=>s+n,0)/values.length:0,choiceSamples:values.length,positiveSamples:values.filter(n=>n>0).length}}
    return {phase:phaseName,minLevel,maxLevel,experience:measure('exp'),gold:measure('gold'),interpretation:'每个等级×合格选项等权重复采样，非唯一事件并集；春季白天、无故事标记，不代表玩家收益。'}
  })
  return {...meta('content','可触发内容与奖励','指定等级、最低魂环数、无主线记录/故事标记、春季白天、未成神、通用武魂的静态快照。地点与中央资格判定按引擎规则处理。部分角色条件函数、去重和冷却未在此重放；这是静态文本/门槛推演，不是实际抽取概率或玩家收益。','engine/event-rules.js；game-data.js、events-expanded.js、main-story.js；public/data/spirit-events.json、spirit-event-map.json、map-data.json'),level:lv,phase,stageAvailability:stages,scenario:{ringCount:ctx.ringCount,ringCountBasis:'到达该等级所需的最少魂环数（level 1-10为0，11-20为1……）；不是每个角色的实存环数。',doneEvents:[],storyMarks:[],season:'spring',timeOfDay:'day',ascended:false,spirit:{type:'通用武魂快照'}},catalog:{configuredEvents:eventPool.length,mainStory:MAIN_STORY_MILESTONES.length,ringHunts:RING_LEVELS.length,spiritJson:jsonSpiritEvents.length,local:LOCATION_EVENTS.length,dynamic:DYNAMIC_EVENTS.length,chained:Object.keys(CHAINED_EVENTS).length},localEvents:LOCATION_EVENTS.map(e=>({id:e.id,name:e.name,location:e.location,mode:e.locationActionType,minLevel:e.minLevel,maxLevel:e.maxLevel,choices:(e.choices||[]).length,maxExp:Math.max(0,...e.choices.map(c=>Number(c.result?.exp)||0))})),dynamicEvents:DYNAMIC_EVENTS.map(e=>({id:e.id,name:e.name,once:!!e.once,cooldown:e.cooldown||0,weight:e.weight||1,condition:String(e.condition||'独立条件'),choices:e.choices.length})),chainedEvents:Object.values(CHAINED_EVENTS).map(e=>({id:e.id,name:e.name,minLevel:e.minLevel||1,phase:e.phase||'any',requires:e.requires?String(e.requires):'选项next或随机入口',next:e.choices.map(c=>c.next).filter(Boolean).join(' / '),choices:e.choices.length})),locationDensity:byPlace,spiritSpecificJsonEvents:{total:jsonSpiritEvents.length,bySpirit:jsonSpiritSpecific},rewardDistribution:{allChoices:stats('exp'),experience:stats('exp'),gold:stats('gold'),byPhase:phaseRewards},zeroRewardChoices:rewardValues.filter(r=>!r.exp&&!r.gold).length,method:'主线、环数与已知故事门槛按引擎规则处理。动态和链式事件独立列示，不伪装成同一随机池。'}
}

export function mapAnalysis() {
  const encounterWeight = TRAVEL_ENCOUNTERS.reduce((sum,row)=>sum+row.weight,0)
  const encounters = TRAVEL_ENCOUNTERS.map(row=>({...row,conditionalProbability:row.weight/encounterWeight,normalProbability:TRAVEL_ENCOUNTER_RATES.normal*row.weight/encounterWeight,fastProbability:TRAVEL_ENCOUNTER_RATES.fast*row.weight/encounterWeight}))
  return {...meta('map','地图与旅行','地点、解锁等级、连接和旅行费用/天数来自地图 JSON；快速旅行仅对已访问地点可用，快速/普通遇敌率引用当前地图状态规则。','public/data/map-data.json；utils/mapBridge.js；地图普通32% / 快速8%'),locations:locations.map(l=>({id:l.id,name:l.name,region:l.region,unlockedLevel:l.unlockedLevel,connectedTo:l.connectedTo||[],travelTime:l.travelTime,normalDays:travelDays(l,false),fastDays:travelDays(l,true),normalCost:travelCost(l,false),fastCost:travelCost(l,true),normalEncounterRisk:TRAVEL_ENCOUNTER_RATES.normal,fastEncounterRisk:TRAVEL_ENCOUNTER_RATES.fast,fastTravelRequiresVisited:true})),travelEncounters:encounters,hiddenClues:buildHiddenLocationClues(locations,{level:1},{_npcRelations:{},_visitedLocations:[]},{_dynamicFlags:{},_storyMarks:[]}),routeExample:locations.length>1?{from:locations[0].id,to:locations.at(-1).id,path:findShortestRoute(locations,locations[0].id,locations.at(-1).id)}:null}
}

export function buildAnalysis() {
 const skills=Object.entries(SKILL_TREE).flatMap(([branch,b])=>b.nodes.map(n=>({branch,branchName:b.name,...n})))
 return {...meta('build','技能、挑战塔、成就与伙伴','展示完整静态配置；技能节点效果描述来自数据，运行时生效细节需看战斗/技能实现。伙伴互动档位与互动成本来自运行时配置。','game-data.js；useGameFeatures.js；engine/traits.js'),skills,traitMappings:Object.entries(SPIRIT_TRAITS).map(([subtype,traits])=>({subtype,traits})),traitBonuses:Object.entries(TRAIT_BONUS).map(([trait,bonus])=>({trait,...bonus})),skillTotals:Object.fromEntries(Object.entries(SKILL_TREE).map(([k,b])=>[k,{name:b.name,count:b.nodes.length,cost:b.nodes.reduce((s,n)=>s+n.cost,0)}])),tower:CHALLENGE_TOWER.floors.map(f=>({floor:f.floor,name:f.name,minLevel:f.minLv,enemy:f.enemy,reward:{gold:f.reward.gold||0,exp:f.reward.exp||0},legacyTitleLabel:f.reward.title||null})),achievements:ACHIEVEMENTS.map(a=>({id:a.id,name:a.name,description:a.desc,condition:'描述/门槛来自配置；部分动态条件在 cond(G) 函数中',reward:ACHIEVEMENT_REWARD})),relationTiers:NPC_RELATION_LEVELS,interactions:NPC_INTERACTIONS,relationRewards:NPC_RELATION_REWARDS, limitations:['伙伴互动与累计奖励直接引用共享纯规则；当前未修改原有关系奖励强度。']}
}

export function ringAnalysis() {
 const hunts = EVENTS.filter(event => /^ring_hunt_/.test(event.id))
 const rings = hunts.map((event, index) => ({
   ordinal: index + 1,
   eventId: event.id,
   requiredLevel: Number(event.id.match(/(\d+)$/)?.[1]) || null,
   choices: event.choices.map((choice, choiceIndex) => {
     const definitionId = ringDefinitionIdForChoice(event, choice, choiceIndex)
     const definition = (ringPayload.rings || []).find(row => row.id === definitionId)
     const resolvedYear = ringYearValueFor(choice, definitionId) || null
     const reward = definition ? buildRingReward({definition,ordinal:index+1,ringCountBefore:index,playerLevel:event.minLevel,choice,source:'年限示例'}) : null
     return {
       index: choiceIndex, name: choice.text, year: choice.ringYear ?? null, resolvedYear,
       tier: choice.ringTier ?? event.ring ?? null, definitionId,
       definitionName: definition?.name || null,
       beastId: choice.beastId ?? choice.result?.battle ?? null,
       difficulty: encounterDifficulty({ event, choice, ringOrdinal: index + 1 }),
       grantsRing: Boolean(definitionId),
       absorbChance: definitionId ? ringAbsorbChance(resolvedYear) : null, result: choice.result || {},
       requirement: choice.requirementHint || '满足本阶段猎环条件',
       skillPreview: reward ? { damage:reward.skill.damage,cost:reward.skill.cost,cooldown:reward.skill.cooldown } : null,
       skillRewardBasis: definition?.statBonus || null
     }
   })
 }))
 return {
   ...meta('rings','九环猎取','猎环选项年限与结果直接来自事件配置；魂环定义使用正式奖励解析 ringDefinitionIdForChoice；战斗档位由 encounterDifficulty 计算，胜后概率使用 ringDefinitionId 与 settlement 的实际查表流程。','game-data.js；utils/ring-hunt.js；engine/battle-contract.js；engine/settlement.js；public/data/beast-codex.json、ring-codex.json'),
   beastCount: beasts.length, codexTiers: ringPayload.meta?.tiers || {}, rings
 }
}

export function economyAnalysis() {
 return {...meta('economy','商店、签到与恢复效率','商店和签到均按当前配置逐项列出。购物可用性按 itemPurchaseAvailability 真实检查等级、经验丹魂环上限和金币；经验丹在100级或当前魂环等级上限处不能购买。','game-data.js；engine/rules.js；engine/economy-rules.js；engine/settlement.js'),shop:SHOP_ITEMS.map(i=>({ ...i,efficiency:['heal','healFull','mp'].includes(i.type)&&i.type!=='healFull'&&i.price?Number(i.value)/i.price:null,efficiencyUnit:i.type==='mp'?'魂力/金币':i.type==='heal'?'生命/金币':null,unlockLevel:i.reqLevel||1,availabilityExamples:{belowRequirement:itemPurchaseAvailability(i,{level:Math.max(1,(i.reqLevel||1)-1),rings:[],gold:1e9}),eligibleLevelButNoGold:itemPurchaseAvailability(i,{level:i.reqLevel||1,rings:[],gold:0}),expAtRingCap:i.type==='exp'?itemPurchaseAvailability(i,{level:10,rings:[],gold:1e9}):null,expAtMaxLevel:i.type==='exp'?itemPurchaseAvailability(i,{level:100,rings:Array(9).fill({}),gold:1e9}):null}})),dailyRewards:DAILY_REWARDS.map(d=>({day:d.day,...d.reward})),dailyTotals:DAILY_REWARDS.reduce((a,d)=>({gold:a.gold+(Number(d.reward.gold)||0),exp:a.exp+(Number(d.reward.exp)||0)}),{gold:0,exp:0}),healingEfficiency:SHOP_ITEMS.filter(i=>['heal','healFull','mp'].includes(i.type)).map(i=>({name:i.name,type:i.type,price:i.price,value:i.value,efficiency:i.type==='healFull'?null:(i.price?i.value/i.price:null),note:i.type==='healFull'?'恢复到满生命，随缺失生命变化':null})),constraints:{levelCap:'九环前等级上限由 levelCapForRings(ringCount) 得出；九环后允许升至100级，100级停止升级。',purchase:'逐件详情见 availabilityExamples；真实购买仍会同时检查商品等级、经验丹魂环门槛和金币余额。'}}
}

export function exportLifecycleCsv() {
 const domains=[creationAnalysis(),progressionAnalysis(),contentAnalysis(),mapAnalysis(),buildAnalysis(),ringAnalysis(),economyAnalysis()]
 const rows=[['系统','条目','指标','值','单位','证据与来源']]
 const unitFor=(key,value,domain)=>{
   if(typeof value==='boolean') return '布尔值'
   if(typeof value!=='number') return '文本/标识'
   if(/efficiency/i.test(key)) return '恢复点/金币'
   if(/percent/i.test(key)||/tierWeights.*\.weight$/.test(key)) return '%'
   if(/Probability|probability|Chance|Risk|multiplier|overflowLevelLimit/i.test(key)||/\.effect\./.test(key)&&!/mpRecovery|cdReduction/.test(key)||/traitBonuses/.test(key)) return '比例/倍率'
   if(/choiceCount|choiceSamples|positiveCount|positiveSamples|zeroRewardChoices|\.count$|\.ordinal$|ringCount|\.choices$/.test(key)) return '个'
   if(/cumulative|\.required$|\.exp$|experience\.(min|max|average)$/.test(key)) return '经验'
   if(/\.gold$|gold\.(min|max|average)$|\.price$|Cost$|interactions.*\.cost$/.test(key)) return '金币'
   if(/skillTotals.*\.cost$|skills.*\.cost$/.test(key)) return '技能点'
   if(/skillPreview\.cost$/.test(key)) return '魂力'
   if(/skillPreview\.cooldown$/.test(key)) return '回合'
   if(/interactions.*\.cooldown$/.test(key)) return '游戏时段'
   if(/\.cooldown$/.test(key)) return '行动次数'
   if(/\.affinity$|relationTiers.*\.min$/.test(key)) return '好感点'
   if(/minTalent|maxTalent|TalentRange|GeneratedRange/.test(key)) return '资质/100'
   if(/\.level$|minLevel|maxLevel|reqLevel|unlockLevel|unlockedLevel|capBeforeRing|afterRingCap|requiredLevel/.test(key)) return '等级'
   if(/normalDays|fastDays/.test(key)) return '游戏日'
   if(/\.day$/.test(key)) return '签到日序号'
   if(/\.travelTime$/.test(key)) return '地图原始时长参数'
   if(/\.year$|resolvedYear$/.test(key)) return '年'
   if(/attack|defense|speed|hp|mp|damage|spiritPower/i.test(key)) return '属性点'
   if(/\.weight$|weightedSlots/.test(key)) return '权重份数'
   if(/pity.*\.cap$/.test(key)) return '觉醒次数'
   if(/\.floor$|\.order$/.test(key)) return '序号'
   if(/\.minFate$|\.fate$|\.fatePoint$/.test(key)) return '命运点'
   if(domain==='economy'&&/shop\[(\d+)\]\.value$/.test(key)) { const index=Number(key.match(/shop\[(\d+)\]/)[1]),type=SHOP_ITEMS[index]?.type;return ['buffAtk','buffDef','buffSpd'].includes(type)?'比例':['heal','healFull','mp','exp'].includes(type)?'恢复/经验点':'效果值' }
   return '数值'
 }
 const add=(d,item,k,v,unit)=>rows.push([d,item,k,v??'',unit||unitFor(`${item}.${k}`,v,d),domains.find(x=>x.domain===d)?.source||'当前分析模块'])
 const walk=(domain,obj,prefix='')=>{if(Array.isArray(obj)){obj.forEach((v,i)=>walk(domain,v,`${prefix}[${i}]`));return}if(obj&&typeof obj==='object'){Object.entries(obj).forEach(([k,v])=>{if(v&&typeof v==='object')walk(domain,v,prefix?`${prefix}.${k}`:k);else add(domain,prefix||domain,k,v)});return}add(domain,prefix,'值',obj)}
 for(const d of domains) walk(d.domain,Object.fromEntries(Object.entries(d).filter(([k])=>!['domain','title','explanation','source'].includes(k))))
 return rows.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\r\n')
}
