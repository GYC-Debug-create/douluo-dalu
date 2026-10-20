<template><div class="table-wrap" tabindex="0" role="region" :aria-label="`${caption}，可横向滚动`"><table><caption>{{ caption }}</caption><thead><tr><th v-for="col in columns" :key="col.key" scope="col">{{ col.label }}</th></tr></thead><tbody><tr v-for="(row,i) in rows" :key="row.id || i"><td v-for="(col,j) in columns" :key="col.key" :class="{first:j===0}">{{ col.format ? col.format(row[col.key],row) : display(row[col.key]) }}</td></tr></tbody></table><p v-if="!rows.length">当前无符合条件的数据。</p></div></template>
<script setup>
defineProps({caption:String,columns:{type:Array,default:()=>[]},rows:{type:Array,default:()=>[]}})
const display=v=>v===null||v===undefined?'—':typeof v==='number'?v.toLocaleString('zh-CN',{maximumFractionDigits:2}):Array.isArray(v)?v.join(' / '):typeof v==='object'?Object.entries(v).map(([k,n])=>`${k} ${n}`).join('，'):String(v)
</script>
<style scoped>
.table-wrap{max-width:100%;overflow:auto;border:1px solid #494330;border-radius:8px;margin:22px 0;background:#1c1b16}table{width:100%;border-collapse:collapse;font-size:13px;line-height:1.8}caption{text-align:left;padding:16px 18px;color:#e8d39e;font-weight:600;caption-side:top}th,td{padding:12px 18px;text-align:left;border-top:1px solid #3d392c;min-width:90px;vertical-align:top}th{color:#b6ad98;font-weight:400;white-space:nowrap}.first{color:#e5d8b9}td{color:#cbc5b7}tbody tr:hover{background:#27241c}.table-wrap p{padding:16px}table:focus-visible,.table-wrap:focus-visible{outline:2px solid #dfbf72;outline-offset:3px}
</style>
