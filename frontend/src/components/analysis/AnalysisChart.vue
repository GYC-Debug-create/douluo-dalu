<template>
  <figure class="analysis-chart">
    <figcaption><strong>{{ title }}</strong><span>{{ unit }}</span></figcaption>
    <svg v-if="rows.length" viewBox="0 0 720 280" role="img" :aria-label="`${title}，单位${unit}。${description}`">
      <g v-for="tick in [0, .5, 1]" :key="tick" class="grid"><line x1="58" :y1="235-tick*205" x2="700" :y2="235-tick*205"/><text x="48" :y="239-tick*205" text-anchor="end">{{ number(maximum*tick) }}</text></g>
      <template v-for="(field,si) in series" :key="field.key">
        <polyline v-if="kind==='line'" :points="points(field.key)" fill="none" :stroke="field.color || colors[si % colors.length]" stroke-width="3" />
        <template v-else><rect v-for="(row,i) in rows" :key="i" :x="58+i*slot+si*barWidth+3" :y="235-height(row[field.key])" :width="barWidth-4" :height="height(row[field.key])" :fill="field.color || colors[si % colors.length]" rx="2"><title>{{ label(row) }} · {{ field.name }}：{{ number(row[field.key]) }} {{ unit }}</title></rect></template>
      </template>
      <g v-for="i in labelIndices" :key="i" class="axis"><text :x="kind==='line'?x(i):58+(i+.5)*slot" y="261" text-anchor="middle">{{ label(rows[i]) }}</text></g>
    </svg>
    <p v-else>此快照没有符合条件的数据。</p>
    <div class="legend"><span v-for="(field,i) in series" :key="field.key"><i :style="{background:field.color || colors[i % colors.length]}"/>{{ field.name }}</span></div>
    <p v-if="description" class="chart-description">{{ description }}</p>
    <details v-if="rows.length" class="chart-data"><summary>查看图表数据（{{ rows.length }}项）</summary><div><table><thead><tr><th>条目</th><th v-for="field in series" :key="field.key">{{ field.name }}</th></tr></thead><tbody><tr v-for="(row,i) in rows" :key="i"><td>{{ label(row) }}</td><td v-for="field in series" :key="field.key">{{ number(row[field.key]) }}</td></tr></tbody></table></div><p>单位：{{ unit }}</p></details>
  </figure>
</template>
<script setup>
import { computed } from 'vue'
const props=defineProps({title:String,unit:{type:String,default:''},description:String,rows:{type:Array,default:()=>[]},series:{type:Array,default:()=>[]},labelKey:{type:String,default:'name'},kind:{type:String,default:'bar'}})
const colors=['#d9ba72','#6dc7be','#a49ad4','#a2b377']
const maximum=computed(()=>Math.max(1,...props.rows.flatMap(r=>props.series.map(s=>Number(r[s.key])||0)))*1.08)
const slot=computed(()=>642/Math.max(1,props.rows.length))
const barWidth=computed(()=>slot.value/Math.max(1,props.series.length))
const height=v=>Math.max(0,(Number(v)||0)/maximum.value*205)
const x=i=>58+i/Math.max(1,props.rows.length-1)*642
const points=key=>props.rows.map((r,i)=>`${x(i)},${235-height(r[key])}`).join(' ')
const label=r=>String(r?.[props.labelKey]??'')
const number=v=>Number(v||0).toLocaleString('zh-CN',{maximumFractionDigits:1})
const labelIndices=computed(()=>props.rows.map((_,i)=>i).filter(i=>props.rows.length<=10 || i===props.rows.length-1 || i%Math.ceil(props.rows.length/7)===0))
</script>
<style scoped>
.analysis-chart{margin:0;padding:22px;background:#211f1a;border:1px solid #494330;border-radius:8px;min-width:0}figcaption{display:flex;justify-content:space-between;gap:12px;font-size:14px}figcaption span,.chart-description{color:#b9b2a2;font-size:12px}svg{display:block;width:100%;margin:14px 0 0}.grid line{stroke:#494435;stroke-dasharray:3 5}.grid text,.axis text{fill:#c6beac;font-size:13px}.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:#d4ccba}.legend i{display:inline-block;width:12px;height:3px;vertical-align:middle;margin-right:6px}.chart-description{line-height:1.8;margin-bottom:0}
.chart-data{font-size:12px;color:#bfb49a;margin-top:10px}.chart-data summary{cursor:pointer;min-height:35px;padding-top:5px}.chart-data>div{max-height:310px;overflow:auto}.chart-data table{border-collapse:collapse;width:100%}.chart-data th,.chart-data td{border:1px solid #4a4333;text-align:left;padding:7px 10px;min-width:70px}.chart-data th{color:#e0cb94;font-weight:400}.chart-data summary:focus-visible{outline:2px solid #dfbf78;outline-offset:3px}
</style>
