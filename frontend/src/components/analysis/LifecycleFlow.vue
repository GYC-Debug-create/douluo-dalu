<template>
  <div class="lifecycle-scroll" tabindex="0" role="region" aria-label="全生命周期数据流程图，可横向滚动">
    <div class="lifecycle-canvas">
      <svg viewBox="0 0 1080 590" role="img" aria-label="觉醒进入成长，等级开启探索，战斗后结算魂环和资源，构筑反馈战斗，故事分支到终局，存档贯穿全程">
        <defs><marker id="flow-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8" fill="#ad9860"/></marker><marker id="feedback-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8" fill="#6dbdaf"/></marker></defs>
        <g v-for="edge in edges" :key="edge.label" :class="edge.loop?'feedback':'forward'"><path :d="edge.path" fill="none" :marker-end="edge.loop?'url(#feedback-arrow)':'url(#flow-arrow)'"/><text :x="edge.x" :y="edge.y" text-anchor="middle">{{ edge.label }}</text></g>
      </svg>
      <button v-for="node in nodes" :key="node.id" :style="{left:node.x+'px',top:node.y+'px'}" :class="{chosen:active===node.id}" :aria-pressed="active===node.id" @click="$emit('select',node.id)"><small>{{ node.tag }}</small><strong>{{ node.title }}</strong><span>{{ node.metric }}</span></button>
    </div>
  </div>
  <div class="mobile-flow" aria-label="手机生命周期流程">
    <button v-for="node in mobileNodes" :key="node.id" :class="{chosen:active===node.id}" :aria-pressed="active===node.id" @click="$emit('select',node.id)"><small>{{ node.tag }}</small><strong>{{ node.title }}</strong><span>{{ node.metric }}</span><b aria-hidden="true">↓</b></button>
  </div>
</template>
<script setup>
defineProps({active:String,metrics:{type:Object,default:()=>({})}})
defineEmits(['select'])
const nodes=[
 {id:'creation',x:20,y:25,title:'觉醒与入场',tag:'起点',metric:'5档品质 · 50次保底'},
 {id:'growth',x:300,y:25,title:'等级与主线',tag:'进程',metric:'1—100级 · 15里程碑'},
 {id:'content',x:580,y:25,title:'探索与事件',tag:'投放',metric:'地点 / 等级 / 剧情闸门'},
 {id:'combat',x:860,y:25,title:'战斗与损耗',tag:'检验',metric:'4档遭遇 · 元素 / 状态'},
 {id:'rings',x:860,y:230,title:'猎环与突破',tag:'风险',metric:'9环 · 胜后20%—100%吸收'},
 {id:'economy',x:580,y:230,title:'资源与恢复',tag:'循环',metric:'金币 / 经验 / 行动'},
 {id:'build',x:300,y:230,title:'构筑与伙伴',tag:'能力',metric:'36技能点 · 关系叠加'},
 {id:'map',x:20,y:230,title:'地图与时间',tag:'空间',metric:'8时段 / 天 · 旅行成本'},
 {id:'ending',x:300,y:450,title:'分支与终局',tag:'收束',metric:'92级决战 · 4条主结局'},
 {id:'persistence',x:660,y:450,title:'保存与继续',tag:'全程',metric:'本地 / 云端 · 一次性结算'}
]
const mobileNodes=['creation','growth','map','content','combat','rings','economy','build','ending','persistence'].map(id=>nodes.find(node=>node.id===id))
const edges=[
 {path:'M220 80 H300',label:'资质 → 等级',x:260,y:59},
 {path:'M500 80 H580',label:'目标 / 门槛',x:540,y:59},
 {path:'M780 80 H860',label:'选项 → 遭遇',x:820,y:59},
 {path:'M960 135 V230',label:'胜利后吸收',x:1006,y:190},
 {path:'M860 285 H780',label:'奖励结算',x:820,y:267},
 {path:'M580 285 H500',label:'投入构筑',x:540,y:267},
 {path:'M220 285 H300',label:'可达内容',x:260,y:267},
 {path:'M400 135 V230',label:'技能点',x:439,y:189},
 {path:'M120 135 V230',label:'出身地点',x:161,y:189},
 {path:'M880 345 V380 H400 V345',label:'魂环释放暂存经验 → 成长 / 下一次突破',x:675,y:374,loop:true},
 {path:'M475 230 V172 H920 V135',label:'最终属性 → 下一场战斗',x:702,y:167,loop:true},
 {path:'M620 230 V196 H655 V135',label:'补给再探索',x:707,y:209,loop:true},
 {path:'M350 345 V450',label:'剧情完成',x:310,y:414},
 {path:'M500 505 H660',label:'记录 / 归档',x:580,y:487},
 {path:'M860 505 H1040 V160',label:'全程保存',x:996,y:424,loop:true}
]
</script>
<style scoped>
.lifecycle-scroll{overflow:auto;max-width:100%;border:1px solid #494330;border-radius:9px;background:#1d2018}.lifecycle-scroll:focus-visible{outline:2px solid #dfbf78;outline-offset:4px}.lifecycle-canvas{width:1080px;height:590px;position:relative;margin:auto}.lifecycle-canvas svg{position:absolute;inset:0;width:100%;height:100%}.forward path{stroke:#ad9860;stroke-width:1.5}.feedback path{stroke:#6dbdaf;stroke-width:1.5;stroke-dasharray:5 5}text{fill:#c5b78c;font:11px 'Microsoft YaHei',sans-serif}.feedback text{fill:#95bca9}button{position:absolute;box-sizing:border-box;width:200px;height:110px;display:flex;flex-direction:column;align-items:start;justify-content:center;padding:14px 17px;text-align:left;border:1px solid #585238;border-radius:6px;background:#2a2b1f;color:#e7dfca;font-family:inherit;cursor:pointer}button.chosen,button:hover{border-color:#dfbf78;background:#3c3521}button:focus-visible{outline:2px solid #dfbf78;outline-offset:3px}button small{font-size:10px;letter-spacing:2px;color:#9fba9f}button strong{font-size:16px;font-weight:500;margin:4px 0}button span{font-size:11px;color:#bfb69b}.mobile-flow{display:none}
@media(max-width:700px){.lifecycle-scroll{display:none}.mobile-flow{display:grid;grid-template-columns:1fr 1fr;gap:9px}.mobile-flow button{position:relative;width:auto;height:130px;padding:12px}.mobile-flow button strong{font-size:14px}.mobile-flow button span{font-size:10px}.mobile-flow b{position:absolute;bottom:7px;right:12px;color:#84b5a4;font-size:14px}}
</style>
