<template>
  <ModalDialog :model-value="modelValue" :title="title" @update:model-value="$emit('update:modelValue', $event)">
    <div class="feature-shell">
      <template v-if="feature === 'bag'">
        <p v-if="!features.player.inventory.length" class="empty">背包空空如也。</p>
        <div v-for="(item, index) in features.player.inventory" :key="item.id || item.name" class="card row">
          <div><strong>{{ item.name }} ×{{ item.count }}</strong><small>{{ item.desc || typeName(item.type) }}</small></div>
          <button class="action" @click="features.useInventoryItem(index)">使用</button>
        </div>
      </template>

      <template v-else-if="feature === 'shop'">
        <div class="summary">金币：{{ features.player.gold }}</div>
        <div v-for="item in shopItems" :key="item.id" class="card row">
          <div><strong>{{ item.icon }} {{ item.name }}</strong><small>{{ item.desc }} · 已有 {{ ownedCount(item) }}<template v-if="!features.canBuyItem(item).ok"> · {{ features.canBuyItem(item).reason }}</template></small></div>
          <button class="action" :disabled="!features.canBuyItem(item).ok" :title="features.canBuyItem(item).reason" @click="features.buyItem(item.id)">{{ item.price }} 金</button>
        </div>
      </template>

      <template v-else-if="feature === 'signin'">
        <div class="summary">连续 {{ signPreview.nextStreak }} 天 · 累计 {{ features.gameStore._dailySign.totalDays || 0 }} 天</div>
        <div class="grid">
          <div v-for="reward in features.DAILY_REWARDS" :key="reward.day" class="card" :class="{ selected: reward.day === signPreview.rewardDay }">
            <strong>第{{ reward.day }}天 · {{ reward.name }}</strong>
            <small>{{ rewardText(reward.reward) }}</small>
          </div>
        </div>
        <button class="action wide" :disabled="signPreview.signedToday" @click="onSignIn">{{ signPreview.signedToday ? '今日已签到' : '立即签到并领取' }}</button>
      </template>

      <template v-else-if="feature === 'skilltree'">
        <div class="summary">可用技能点：{{ features.totalSkillPoints() - features.usedSkillPoints() }} / {{ features.totalSkillPoints() }}</div>
        <section v-for="(branch, key) in features.SKILL_TREE" :key="key">
          <h3 :style="{ color: branch.color }">{{ branch.icon }} {{ branch.name }}</h3>
          <div v-for="node in branch.nodes" :key="node.id" class="card row" :class="{ selected: features.player._skillTree[node.id] }">
            <div><strong>{{ node.name }}</strong><small>{{ node.desc }} · 消耗{{ node.cost}}点</small></div>
            <button class="action" :disabled="features.player._skillTree[node.id] || !canLearn(node)" @click="features.learnSkill(node)">{{ features.player._skillTree[node.id] ? '已习得' : '学习' }}</button>
          </div>
        </section>
        <button class="action danger wide" :disabled="features.usedSkillPoints() === 0" @click="confirmReset">重置技能树</button>
      </template>

      <template v-else-if="feature === 'achievement'">
        <div class="summary">已获得 {{ features.player._achievementList.length }} / {{ features.ACHIEVEMENTS.length }} 枚徽章 · 每枚首次获得奖励 50 金币和 20 经验</div>
        <div class="grid">
          <div v-for="achievement in features.ACHIEVEMENTS" :key="achievement.id" class="card" :class="{ selected: achievementUnlocked(achievement.id) }">
            <strong>{{ achievementUnlocked(achievement.id) ? achievement.icon : '🔒' }} {{ achievementUnlocked(achievement.id) ? achievement.name : '未解锁' }}</strong>
            <small>{{ achievement.desc }}</small>
          </div>
        </div>
      </template>

      <template v-else-if="feature === 'diary'">
        <div class="summary">共 {{ diaryEntries.length }} 条记录 · 最新的在最上面</div>
        <p v-if="!diaryEntries.length" class="empty">还没有记录。去经历一些故事吧！</p>
        <div v-for="(entry, index) in diaryEntries" :key="index" class="card diary-entry" :class="entry.type">
          <small v-if="entry.level || entry.phase" class="diary-meta">{{ entry.level ? `Lv.${entry.level}` : '' }}{{ entry.phase ? ` · ${entry.phase}` : '' }}</small>
          <p>{{ entry.text }}</p>
        </div>
      </template>

      <template v-else-if="feature === 'npc' || feature === 'relation'">
        <p class="summary">在故事里遇到的人都会出现在这里。和他们一起经历事件、聊天、切磋，关系就会越来越好。</p>
        <p v-if="!metNpcs.length" class="empty">还没有认识的伙伴，去故事里结识他们吧。</p>
        <div v-for="npc in metNpcs" :key="npc.id" class="card">
          <button class="npc-head" @click="selectedNpc = selectedNpc === npc.id ? '' : npc.id">
            <span><strong>{{ npc.name }}</strong><small>{{ npc.title || npc.faction }}</small></span>
            <b :style="{ color: relationLevel(npc.id).color }">♥ {{ relationValue(npc.id) }} · {{ relationLevel(npc.id).name }}</b>
          </button>
          <div v-if="selectedNpc === npc.id" class="npc-detail">
            <p>{{ npc.desc }}</p>
            <div class="actions">
              <button v-for="interaction in features.NPC_INTERACTIONS" :key="interaction.id" class="action" :disabled="!features.canInteract(npc.id, interaction).ok" :title="features.canInteract(npc.id, interaction).reason" @click="onNpcInteraction(npc.id, interaction)">{{ interaction.name }}<small>{{ interaction.cost ? interaction.cost + '金' : '免费' }}</small></button>
            </div>
            <p class="hint">切磋会关闭关系面板并进入正式回合制战斗，胜负都会影响关系。</p>
          </div>
        </div>
      </template>

      <template v-else-if="feature === 'tower'">
        <div class="summary">已通关 {{ features.gameStore._towerFloor }} / {{ features.CHALLENGE_TOWER.floors.length }} 层</div>
        <div v-for="floor in features.CHALLENGE_TOWER.floors" :key="floor.floor" class="card row" :class="{ selected: floor.floor <= features.gameStore._towerFloor }">
          <div><strong>第{{ floor.floor }}层 · {{ floor.name }}</strong><small>{{ floor.enemy.name }} · 需Lv.{{ floor.minLv }} · 奖励{{ floor.reward.gold }}金/{{ floor.reward.exp }}经验</small></div>
          <button v-if="floor.floor === features.gameStore._towerFloor + 1" class="action" :disabled="features.player.level < floor.minLv" @click="$emit('challenge-tower', floor.floor)">正式挑战</button>
          <span v-else class="status">{{ floor.floor <= features.gameStore._towerFloor ? '✓ 已通关' : '未解锁' }}</span>
        </div>
      </template>
    </div>
    <template #footer><button class="action" @click="$emit('update:modelValue', false)">关闭</button></template>
  </ModalDialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import ModalDialog from '@/components/ModalDialog.vue'
import { useGameFeatures } from '@/composables/useGameFeatures'

const props = defineProps({ modelValue: Boolean, feature: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue', 'challenge-tower', 'npc-spar'])
const features = useGameFeatures()
const selectedNpc = ref('')

const titles = { bag: '背包', shop: '魂师商店', signin: '每日签到', skilltree: '技能树', achievement: '成就徽章', npc: '伙伴', relation: '伙伴', tower: '挑战塔', diary: '冒险日记' }
const title = computed(() => titles[props.feature] || '游戏功能')
const shopItems = computed(() => features.SHOP_ITEMS.filter(item => !item.reqLevel || features.player.level >= item.reqLevel))
const signPreview = computed(() => features.signPreview())
const metNpcs = computed(() => features.gameStore._metNpcs.map(id => features.data.value.npcData.find(npc => npc.id === id)).filter(Boolean))
// 冒险日记：最新的放最上面；文本在写入时已替换占位符并去掉标签。
const diaryEntries = computed(() => [...(features.eventStore._diary || [])].reverse())

watch(() => props.feature, feature => { if (feature === 'achievement') features.checkAchievements() })
function onSignIn() {
  // 点击时重新计算当天日期与预览，保证发放、提示与面板高亮使用同一个 rewardDay。
  features.dailySign(features.signPreview().today)
}
function onNpcInteraction(npcId, interaction) {
  if (interaction.type === 'battle') emit('npc-spar', npcId)
  else features.interactNpc(npcId, interaction.id)
}
function ownedCount(item) { return features.player.inventory.find(entry => entry.id === item.id || entry.name === item.name)?.count || 0 }
function canLearn(node) { return node.req.every(id => features.player._skillTree[id]) && features.totalSkillPoints() - features.usedSkillPoints() >= node.cost }
function confirmReset() { if (window.confirm('确定重置技能树并退还全部技能点？')) features.resetSkills() }
function achievementUnlocked(id) { return features.player._achievementList.includes(id) }
function relationValue(id) { return features.gameStore._npcRelations[id] || 0 }
function relationLevel(id) { return features.relationLevel(relationValue(id)) }
function rewardText(reward) { return Object.entries(reward).map(([key, value]) => `${{ gold: '金币', exp: '经验', fatePoint: '命运值' }[key] || key}+${value}`).join(' · ') }
function typeName(type) { return ({ heal: '恢复生命', healFull: '完全恢复', mp: '恢复魂力', buffAtk: '攻击增益', buffDef: '防御增益', buffSpd: '速度增益', cure: '解毒', cureAll: '净化' })[type] || type }
</script>

<style scoped>
.feature-shell { display:flex; flex-direction:column; gap:9px; }
.summary { position:sticky; top:-20px; z-index:2; padding:9px 12px; color:var(--gold-hi); background:var(--bg2); border-bottom:1px solid var(--line); }
.card { padding:11px 12px; border:1px solid var(--line); border-radius:6px; background:rgba(20,16,10,.5); }
.card.selected { border-color:var(--gold); background:rgba(201,168,76,.09); }
.row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.card strong,.card small { display:block; }
.card small { color:var(--ink-dim); font-size:12px; line-height:1.55; margin-top:3px; }
.grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:8px; }
.action { padding:7px 13px; border:1px solid var(--gold); border-radius:4px; background:#2b2316; color:var(--gold-hi); cursor:pointer; flex-shrink:0; }
.action:disabled { opacity:.4; cursor:not-allowed; border-color:var(--line); }
.action.wide { width:100%; min-height:42px; margin-top:6px; }
.action.danger { border-color:var(--danger); color:#ffb0a5; }
.action small { margin:0; }
.empty,.hint { color:var(--ink-dim); text-align:center; }
.status { color:var(--ink-dim); font-size:12px; }
section h3 { margin:12px 0 6px; }
.npc-head { display:flex; width:100%; align-items:center; justify-content:space-between; gap:10px; border:0; background:transparent; color:inherit; text-align:left; cursor:pointer; }
.npc-detail { margin-top:10px; padding-top:10px; border-top:1px solid var(--line); }
.actions { display:flex; flex-wrap:wrap; gap:6px; }
.hint { font-size:12px; margin:10px 0 0; }
.diary-entry p { margin:0; line-height:1.7; }
.diary-meta { color:var(--gold) !important; margin:0 0 4px !important; }
.diary-entry.discovery { border-color:rgba(26,188,156,.55); }
@media(max-width:600px){ .row,.npc-head{ align-items:flex-start; } .grid{ grid-template-columns:1fr; } }
</style>
