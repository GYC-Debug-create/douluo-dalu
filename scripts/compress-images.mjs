#!/usr/bin/env node
/**
 * 图片资产压缩脚本（sharp）
 *
 * 背景：public/assets 共 266 张图约 34MB，单张最大 571KB；事件图每次切换都要
 * 拉取+解码，是"显示慢"的主因之一。本脚本对超过阈值的图片原地重编码：
 *   - jpg/jpeg → mozjpeg（quality 74，progressive，4:2:0）
 *   - webp     → quality 72
 *   - png      → compressionLevel 9（有透明通道时保留 alpha）
 * 安全策略：不改尺寸、只在新体积比原文件至少小 MIN_SAVING 时覆盖；
 * 已足够小的文件直接跳过。重复执行幂等。
 *
 * 用法：node scripts/compress-images.mjs [--check]
 *   默认应用写入；--check 只报告可省空间，不写盘。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ASSETS = path.join(ROOT, 'public', 'assets')
const CHECK = process.argv.includes('--check')
// --max-edge N：把长边降到 N px（fit inside、只缩不放）。显示端 .scene-img 实际
// 渲染宽 ≤900 CSS px（移动端高度被压到 180px），1024 对 DPR1 完全够用；
// 不传则保持原尺寸只做质量阶梯。
const maxEdgeArg = process.argv.find(a => a.startsWith('--max-edge'))
const MAX_EDGE = maxEdgeArg ? Number(maxEdgeArg.split('=')[1] || process.argv[process.argv.indexOf(maxEdgeArg) + 1]) || 0 : 0
const THRESHOLD = 100 * 1024      // 小于 100KB 不值得动
const MIN_SAVING_RATIO = 0.08     // 至少省 8% 才覆盖，避免无意义重编码
// 质量阶梯：存量图已压过一轮（≈q70），单档位常打不到 8% 红线；
// 逐档下探取首个达标结果，58 为画质保底，宁可跳过也不毁美术资源。
const JPEG_LADDER = [74, 66, 58]
const WEBP_LADDER = [72, 64, 56]

const sharp = (await import('sharp')).default

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) yield p
  }
}

async function bestEncode(input) {
  const ext = path.extname(input).toLowerCase()
  const before = fs.statSync(input).size
  // 关键：以 Buffer 喂给 sharp。libvips 在 Windows 上对含非 ASCII 字符的
  // 路径会抛 "UNKNOWN: unknown error, open ..."；Node 自身 fs 读文件无此问题。
  const raw = fs.readFileSync(input)
  const makePipe = () => {
    const pipe = sharp(raw)
    if (MAX_EDGE) return pipe.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    return pipe
  }
  if (ext === '.png') {
    // PNG 单档：palette 化通常无损观感且大幅缩体积；不达标即跳过
    const buf = await makePipe().png({ compressionLevel: 9, palette: true }).toBuffer()
    return buf.length < before * (1 - MIN_SAVING_RATIO) ? { buf, q: 'palette' } : null
  }
  const ladder = ext === '.webp' ? WEBP_LADDER : JPEG_LADDER
  for (const q of ladder) {
    const pipe = makePipe()
    const buf = ext === '.webp'
      ? await pipe.webp({ quality: q }).toBuffer()
      : await pipe.jpeg({ quality: q, progressive: true, mozjpeg: true, chromaSubsampling: '4:2:0' }).toBuffer()
    if (buf.length < before * (1 - MIN_SAVING_RATIO)) return { buf, q }
  }
  return null // 全阶梯都不达标：跳过，不做无意义重编码
}

const rows = []
let totalBefore = 0, totalAfter = 0, changed = 0
for (const file of walk(ASSETS)) {
  const before = fs.statSync(file).size
  if (before < THRESHOLD) continue
  totalBefore += before
  try {
    const hit = await bestEncode(file)
    if (hit) {
      rows.push({ file: path.relative(ROOT, file), kb: Math.round(before / 1024), toKb: Math.round(hit.buf.length / 1024), q: hit.q })
      totalAfter += hit.buf.length
      if (!CHECK) fs.writeFileSync(file, hit.buf)
      changed++
    } else {
      totalAfter += before // 全阶梯不达标，保持原样
    }
  } catch (err) {
    console.error('FAIL', path.relative(ROOT, file), err.message)
    totalAfter += before
  }
}

rows.sort((a, b) => (b.kb - b.toKb) - (a.kb - a.toKb))
for (const r of rows) console.log(`${r.kb}KB → ${r.toKb}KB (q${r.q})  ${r.file}`)
console.log(`\n扫描(≥${THRESHOLD / 1024}KB) ${rows.length + '?'} 张，可压缩 ${changed} 张`)
console.log(`合计 ${(totalBefore / 1048576).toFixed(2)}MB → ${(totalAfter / 1048576).toFixed(2)}MB（省 ${((1 - totalAfter / Math.max(1, totalBefore)) * 100).toFixed(0)}%）${CHECK ? '【--check 未写入】' : '已写入'}`)
