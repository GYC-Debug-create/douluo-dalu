import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { buildCarouselPool, carouselOffset, carouselSlots, alignedCarouselStarts, splitSpiritDescription, SHORT_DESC_LIMIT, RAPID_REVEAL_DELAY_MS, RARE_STOP_HOLD_MS, PITY_CAP, shouldStopRapidReroll } from '@/pages/CreatePage.vue'
import { PITY_LIMIT } from '@/utils/creation-pity'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const codexPath = path.resolve(__dirname, '../../public/data/spirit-codex.json')
const codex = JSON.parse(readFileSync(codexPath, 'utf8'))

const createPagePath = path.resolve(__dirname, '../src/pages/CreatePage.vue')
// 阶段三 3.2：CreatePage 的样式拆分到同名外部 CSS（<style scoped src> 引入），
// 源码断言仍需覆盖样式规则，故把三片 CSS 拼进 createPageSource。
const createStyleSources = ['create-page.base.css', 'create-page.awaken.css', 'create-page.result.css']
  .map(file => readFileSync(path.resolve(__dirname, '../src/pages', file), 'utf8'))
const createPageSource = [readFileSync(createPagePath, 'utf8'), ...createStyleSources].join('\n')
const modalDialogPath = path.resolve(__dirname, '../src/components/ModalDialog.vue')
const modalDialogSource = readFileSync(modalDialogPath, 'utf8')

describe('本轮创建页口述问题回归', () => {
  it('出身卡不再展示神级保底计数', () => {
    expect(createPageSource).not.toContain('class="oc-pity"')
  })

  it('待觉醒中心使用魂印而不是问号，并为轮播保留固定槽位', () => {
    expect(createPageSource).toContain('class="awaken-seal"')
    expect(createPageSource).toContain('魂印待启')
    expect(createPageSource).not.toContain('class="awaken-q"')
    expect(createPageSource).toContain('class="carousel-cell"')
    expect(createPageSource).toContain('<Transition name="cshift" mode="out-in">')
  })

  it('觉醒创建内容不再撑破首屏（步骤容器内部滚动且不向页面传播），并对已揭示结果启用紧凑首屏布局', () => {
    const createStepBlock = createPageSource.match(/\.create-step\s*\{[^}]*\}/)?.[0] || ''
    // no-scroll 改造：原 overflow:hidden 在小屏溢出时静默裁切内容；
    // 现改为 overflow-y:auto + overscroll-behavior:contain——页面级滚动仍为 0（根容器
    // .create-screen 已 overflow:hidden），溢出时由步骤容器内部消化。
    expect(createStepBlock).toMatch(/overflow-y:\s*auto/)
    expect(createStepBlock).toMatch(/overscroll-behavior:\s*contain/)
    expect(createStepBlock).toMatch(/min-height:\s*0/)
    expect(createPageSource).toContain('.awaken-stage.has-result')
  })
})

describe('BUG-DIALOG-002 轮播素材池（纯展示，不参与抽取）', () => {
  it('素材池只含 top/god 且有 image，按数据稳定顺序', () => {
    const pool = buildCarouselPool(codex.spirits)
    expect(pool.length).toBeGreaterThanOrEqual(6)
    expect(pool.every(s => (s.tier === 'top' || s.tier === 'god') && typeof s.image === 'string' && s.image.length > 0)).toBe(true)
    const srcOrder = codex.spirits.filter(s => s.tier === 'top' || s.tier === 'god').map(s => s.id)
    expect(pool.map(s => s.id)).toEqual(srcOrder)
  })

  it('当前数据全部符合条件的武魂都有机会进入轮播（未硬编码六张）', () => {
    const pool = buildCarouselPool(codex.spirits)
    const covered = new Set()
    for (let i = 0; i < pool.length; i++) {
      carouselSlots(pool, i).forEach(s => covered.add(s.id))
    }
    expect(covered.size).toBe(pool.length)
  })

  it('buildCarouselPool 不修改原始数组', () => {
    const spirits = [...codex.spirits]
    const snapshot = JSON.stringify(spirits)
    buildCarouselPool(spirits)
    expect(JSON.stringify(spirits)).toBe(snapshot)
  })

  it('carouselSlots 固定 3 槽且正确环绕', () => {
    const pool = buildCarouselPool(codex.spirits)
    expect(carouselSlots(pool, 0).map(s => s.id)).toEqual([pool[0].id, pool[1].id, pool[2].id])
    expect(carouselSlots(pool, pool.length - 1).map(s => s.id)).toEqual([pool[pool.length - 1].id, pool[0].id, pool[1].id])
  })

  it('素材池不足六张时安全降级，不抛错、不无限循环', () => {
    expect(carouselSlots([], 0)).toEqual([null, null, null])
    expect(carouselSlots(null, 0)).toEqual([null, null, null])
    expect(carouselSlots([{ id: 'x', image: 'x.jpg', tier: 'top' }], 0).map(s => s.id)).toEqual(['x', 'x', 'x'])
    expect(carouselSlots([1, 2, 3, 4, 5], 4).map(s => s)).toEqual([5, 1, 2])
    expect(() => carouselSlots([1, 2, 3, 4, 5], 0)).not.toThrow()
  })

  it('左右窗口错峰不重叠（真实数据 28 张）', () => {
    const pool = buildCarouselPool(codex.spirits)
    const off = carouselOffset(pool.length)
    expect(off).toBe(14)
    const left = new Set(carouselSlots(pool, 0).map(s => s.id))
    const right = new Set(carouselSlots(pool, off).map(s => s.id))
    expect(left.size).toBe(3)
    expect(right.size).toBe(3)
    for (const id of left) expect(right.has(id)).toBe(false)
    // 左右交替推进时相对位移只在 off 与 off±1 间摆动，3 槽窗口仍不相交
    for (const r of [off, (off + 1) % pool.length, (off - 1 + pool.length) % pool.length]) {
      const l = new Set(carouselSlots(pool, 0).map(s => s.id))
      const rr = new Set(carouselSlots(pool, r).map(s => s.id))
      const inter = [...l].filter(id => rr.has(id))
      expect(inter.length).toBe(0)
    }
  })

  it('当前素材池数量与 tier 分布', () => {
    const pool = buildCarouselPool(codex.spirits)
    expect(pool.filter(s => s.tier === 'top').length).toBe(16)
    expect(pool.filter(s => s.tier === 'god').length).toBe(12)
  })

  describe('R2：alignedCarouselStarts 左右起始位置对齐（修复 R1 两个失败）', () => {
    it('reduced-motion 初始对齐位置：left=0、right=14（当前 28 张数据）', () => {
      const pool = buildCarouselPool(codex.spirits)
      const aligned = alignedCarouselStarts(pool.length, 0)
      expect(aligned).toEqual({ left: 0, right: 14 })
      expect(aligned.right).toBe(carouselOffset(pool.length))
    })

    it('遍历当前素材池全部 leftStart，左右三槽交集恒为 0', () => {
      const pool = buildCarouselPool(codex.spirits)
      const n = pool.length
      for (let l = 0; l < n; l++) {
        const { left, right } = alignedCarouselStarts(n, l)
        expect(left).toBe(l)
        const lw = new Set(carouselSlots(pool, left).map(s => s.id))
        const rw = new Set(carouselSlots(pool, right).map(s => s.id))
        expect(lw.size).toBe(3)
        expect(rw.size).toBe(3)
        expect([...lw].filter(id => rw.has(id)).length).toBe(0)
      }
    })

    it('leftStart=13（R1 失败位置）：left=13，right 必须由 left+offset 计算而非固定 14', () => {
      const pool = buildCarouselPool(codex.spirits)
      const { left, right } = alignedCarouselStarts(pool.length, 13)
      expect(left).toBe(13)
      expect(right).toBe((13 + carouselOffset(pool.length)) % pool.length)
      expect(right).not.toBe(carouselOffset(pool.length))
      expect(carouselSlots(pool, left).map(s => s.id)).toEqual([pool[13].id, pool[14].id, pool[15].id])
      const lw = new Set(carouselSlots(pool, left).map(s => s.id))
      const rw = new Set(carouselSlots(pool, right).map(s => s.id))
      expect([...lw].filter(id => rw.has(id)).length).toBe(0)
    })

    it('负数、超范围 leftStart 规范化；空池/非法数量安全降级，且不抛错、无随机', () => {
      expect(alignedCarouselStarts(28, -1)).toEqual({ left: 27, right: 13 })
      expect(alignedCarouselStarts(28, 29)).toEqual({ left: 1, right: 15 })
      expect(alignedCarouselStarts(28, 100)).toEqual({ left: (100 % 28), right: ((100 % 28) + 14) % 28 })
      expect(alignedCarouselStarts(28, null)).toEqual({ left: 0, right: 14 })
      expect(alignedCarouselStarts(0, 5)).toEqual({ left: 0, right: 0 })
      expect(alignedCarouselStarts(0, -3)).toEqual({ left: 0, right: 0 })
      expect(alignedCarouselStarts(-1, 3)).toEqual({ left: 0, right: 0 })
      expect(alignedCarouselStarts(1.5, 3)).toEqual({ left: 0, right: 0 })
      expect(() => alignedCarouselStarts(null, 3)).not.toThrow()
      expect(() => alignedCarouselStarts(28, 3)).not.toThrow()
      const a = alignedCarouselStarts(28, 3)
      const b = alignedCarouselStarts(28, 3)
      expect(a).toEqual(b)
    })
  })
})

describe('BUG-DIALOG-004 方案B：长介绍分段纯函数 splitSpiritDescription', () => {
  const godBook = codex.spirits.find(s => s.id === '创世之书')
  const longest = codex.spirits.find(s => s.id === '邪眸白虎')

  it('长介绍分段后按顺序 join 严格等于原文（去除首尾空白后）', () => {
    for (const spirit of [godBook, longest]) {
      const paragraphs = splitSpiritDescription(spirit.desc)
      expect(paragraphs.length).toBeGreaterThan(1)
      expect(paragraphs.join('')).toBe(spirit.desc.trim())
      expect(paragraphs.join('').length).toBe(spirit.desc.length)
    }
  })

  it('分段不删除中文标点：句号/叹号/问号/分号逐字符保留', () => {
    const countPunct = s => [...s].filter(ch => '。！？；'.includes(ch)).length
    for (const spirit of [godBook, longest]) {
      const paragraphs = splitSpiritDescription(spirit.desc)
      const total = paragraphs.reduce((sum, p) => sum + countPunct(p), 0)
      expect(total).toBe(countPunct(spirit.desc))
      expect(paragraphs.join('')).toBe(spirit.desc.trim())
    }
  })

  it('短介绍保持单段', () => {
    const short = codex.spirits.find(s => s.id === '水壶')
    expect(short.desc.length).toBeLessThanOrEqual(SHORT_DESC_LIMIT)
    expect(splitSpiritDescription(short.desc)).toEqual([short.desc.trim()])
  })

  it('空值、null、undefined 和纯空白安全返回空数组', () => {
    expect(splitSpiritDescription('')).toEqual([])
    expect(splitSpiritDescription('   ')).toEqual([])
    expect(splitSpiritDescription('\t \n ')).toEqual([])
    expect(splitSpiritDescription(null)).toEqual([])
    expect(splitSpiritDescription(undefined)).toEqual([])
    expect(() => splitSpiritDescription()).not.toThrow()
  })

  it('找不到可靠边界时保持单段，不从词语中间强拆', () => {
    const noBoundary = '无标点长文'.repeat(30)
    expect(noBoundary.length).toBeGreaterThan(SHORT_DESC_LIMIT)
    expect(splitSpiritDescription(noBoundary)).toEqual([noBoundary])
  })

  it('创世之书 201 字完整保留并形成 1～2 个可读段落', () => {
    // 2026-08-15 T1 解耦后 desc 改写为传说化表述，长度 198→201。
    // 本测试锁定的是分段函数不丢字，长度断言随文案同步更新。
    expect(godBook.desc.length).toBe(201)
    const paragraphs = splitSpiritDescription(godBook.desc)
    expect(paragraphs.length).toBeGreaterThanOrEqual(1)
    expect(paragraphs.length).toBeLessThanOrEqual(2)
    expect(paragraphs.join('')).toBe(godBook.desc.trim())
    expect(paragraphs.join('').length).toBe(201)
    for (const p of paragraphs) expect(p.length).toBeGreaterThan(0)
  })

  it('最长介绍（约201字）同样完整保留', () => {
    expect(longest.desc.length).toBe(201)
    const paragraphs = splitSpiritDescription(longest.desc)
    expect(paragraphs.join('')).toBe(longest.desc.trim())
    expect(paragraphs.join('').length).toBe(201)
  })

  it('不产生过短段落：每段长度不小于原文 20%（读取质量）', () => {
    for (const spirit of [godBook, longest]) {
      const paragraphs = splitSpiritDescription(spirit.desc)
      for (const p of paragraphs) {
        expect(p.length).toBeGreaterThanOrEqual(Math.floor(spirit.desc.length * 0.2))
      }
    }
  })
})

describe('BUG-DIALOG-004 方案B：结果模板不再截断介绍', () => {
  it('结果模板不再对 awakenedSpirit.desc 执行 slice，并整体渲染分段正文', () => {
    expect(createPageSource).not.toMatch(/awakenedSpirit\.desc\s*\?\.\s*slice/)
    expect(createPageSource).not.toMatch(/awakenedSpirit\.desc\.slice/)
    expect(createPageSource).toMatch(/{{ paragraph }}/)
    expect(createPageSource).toContain('awakenDescParagraphs')
  })

  it('结果正文带“武魂志 · 完整记载”弱标题层级', () => {
    expect(createPageSource).toContain('武魂志 · 完整记载')
    expect(createPageSource).toContain('awaken-desc-head')
  })

  it('.awaken-desc 不再存在固定 80px / max-height / overflow-y:auto', () => {
    const block = createPageSource.match(/\.awaken-desc\s*\{[^}]*\}/)?.[0] || ''
    expect(block).not.toMatch(/height\s*:\s*80px/)
    expect(block).not.toMatch(/max-height/)
    expect(block).not.toMatch(/overflow-y\s*:\s*auto/)
    expect(block).not.toMatch(/overflow-y\s*:\s*scroll/)
  })

  it('所有品质武魂正文均走同一分段函数（不按品质分支隐藏）', () => {
    expect(createPageSource).toContain('splitSpiritDescription(awakenedSpirit.value?.desc)')
  })
})

describe('BUG-DIALOG-004 方案C：神级武魂独立详情交互接线', () => {
  it('列表卡点击只打开详情视图，不直接调用 pickGodSpirit', () => {
    expect(createPageSource).toMatch(/@click="openGodDetail\(spirit\)"/)
    expect(createPageSource).not.toMatch(/@click="pickGodSpirit\(spirit\)"/)
  })

  it('只有详情层的确认按钮调用既有 pickGodSpirit', () => {
    expect(createPageSource).toMatch(/@click="pickGodSpirit\(previewedGodSpirit\)"/)
    expect(createPageSource).toContain('确认选择「{{ previewedGodSpirit.name }}」')
  })

  it('卡片保留清晰“查看详情”意图', () => {
    expect(createPageSource).toContain('查看详情')
    expect(createPageSource).toContain('gpc-action')
  })

  it('详情视图展示完整、未经截断的 previewedGodSpirit.desc', () => {
    expect(createPageSource).toMatch(/splitSpiritDescription\(previewedGodSpirit\?\.desc\)/)
    expect(createPageSource).not.toMatch(/previewedGodSpirit\.desc\s*\?\.\s*slice/)
    expect(createPageSource).not.toMatch(/previewedGodSpirit\.desc\.slice/)
  })

  it('详情视图含返回列表、真实图片降级、神级标识、名称与确认按钮', () => {
    expect(createPageSource).toContain('← 返回神级武魂列表')
    expect(createPageSource).toMatch(/v-if="previewedGodSpirit\.image"/)
    expect(createPageSource).toMatch(/v-else class="god-dossier-icon"/)
    expect(createPageSource).toContain('神级武魂')
    expect(createPageSource).toMatch(/data-spirit-id="/)
  })

  it('弹窗关闭后重置回列表层（watch showGodPicker）', () => {
    expect(createPageSource).toMatch(/watch\(showGodPicker,\s*open\s*=>/)
    expect(createPageSource).toMatch(/godPickerView\.value = 'list'/)
    expect(createPageSource).toMatch(/previewedGodSpirit\.value = null/)
  })

  it('详情/返回路径保持焦点：打开聚焦返回按钮，返回聚焦原卡片', () => {
    expect(createPageSource).toContain('godDetailBackBtn.value?.focus()')
    expect(createPageSource).toContain('CSS.escape(targetId)')
    expect(createPageSource).toContain('card?.focus()')
  })

  it('神级弹窗启用显式宽版面板，列表仍展示全部神级武魂（不新增数据源）', () => {
    expect(createPageSource).toContain('panel-class="is-wide"')
    expect(createPageSource).toContain('godSpirits')
    const godCount = codex.spirits.filter(s => s.tier === 'god').length
    expect(godCount).toBe(12)
    expect(createPageSource).toMatch(/v-for="spirit in godSpirits"/)
  })
})

describe('BUG-DIALOG-004：ModalDialog 宽版为显式可选配置，默认行为不变', () => {
  it('默认面板样式保持 520px 行为', () => {
    expect(modalDialogSource).toMatch(/width:\s*min\(520px,\s*92vw\)/)
  })

  it('宽版通过显式 panelClass / is-wide 启用，不全局放大所有弹窗', () => {
    expect(modalDialogSource).toContain('panelClass')
    expect(modalDialogSource).toMatch(/class="modal-box"\s*:class="panelClass"/)
    expect(modalDialogSource).toMatch(/\.modal-box\.is-wide\s*\{/)
    expect(modalDialogSource).toMatch(/min\(1100px,\s*94vw\)/)
  })

  it('panelClass 默认值为空串，其他调用方视觉不变', () => {
    expect(modalDialogSource).toMatch(/panelClass:\s*\{\s*type:\s*\[String,\s*Array,\s*Object\]/)
    expect(modalDialogSource).toMatch(/default:\s*''/)
  })
})

describe('BUG-DIALOG-005 方案B+：重新觉醒按钮闪断 → 快速重抽', () => {
  it('RAPID_REVEAL_DELAY_MS=250 / RARE_STOP_HOLD_MS=650 / PITY_CAP 与 PITY_LIMIT 一致', () => {
    expect(RAPID_REVEAL_DELAY_MS).toBe(250)
    expect(RARE_STOP_HOLD_MS).toBe(650)
    expect(PITY_CAP).toBe(PITY_LIMIT)
    expect(PITY_CAP).toBe(50)
  })

  it('普通非神级（未到 50 封顶）不自动停止', () => {
    expect(shouldStopRapidReroll(0, 1, 'low')).toBe(false)
    expect(shouldStopRapidReroll(3, 4, 'high')).toBe(false)
    expect(shouldStopRapidReroll(17, 18, 'mid')).toBe(false)
    expect(shouldStopRapidReroll(48, 49, 'mid')).toBe(false)
  })

  it('顶级武魂不自动停止（仅凭品质不触发停止）', () => {
    expect(shouldStopRapidReroll(20, 21, 'top')).toBe(false)
    expect(shouldStopRapidReroll(0, 1, 'top')).toBe(false)
    expect(shouldStopRapidReroll(49, 49, 'top')).toBe(false)
  })

  it('神级武魂任何情况下都自动停止', () => {
    expect(shouldStopRapidReroll(0, 1, 'god')).toBe(true)
    expect(shouldStopRapidReroll(12, 13, 'god')).toBe(true)
    expect(shouldStopRapidReroll(49, 50, 'god')).toBe(true)
    expect(shouldStopRapidReroll(50, 0, 'god')).toBe(true)
    expect(shouldStopRapidReroll(50, 50, 'god')).toBe(true)
  })

  it('首次达到 50 封顶（49→50）自动停止一次（任意非神级品质都触发）', () => {
    expect(shouldStopRapidReroll(49, 50, 'low')).toBe(true)
    expect(shouldStopRapidReroll(49, 50, 'mid')).toBe(true)
    expect(shouldStopRapidReroll(49, 50, 'high')).toBe(true)
    expect(shouldStopRapidReroll(49, 50, 'top')).toBe(true)
  })

  it('已 50/50 后继续抽不重复触发“首次达到”停止', () => {
    expect(shouldStopRapidReroll(50, 50, 'low')).toBe(false)
    expect(shouldStopRapidReroll(50, 50, 'mid')).toBe(false)
    expect(shouldStopRapidReroll(50, 50, 'top')).toBe(false)
  })

  it('非法 / 缺失 / 边界计数一律安全按“不停止”处理且不抛错', () => {
    expect(shouldStopRapidReroll(null, 1, 'mid')).toBe(false)
    expect(shouldStopRapidReroll(49, null, 'mid')).toBe(false)
    expect(shouldStopRapidReroll(undefined, 50, 'low')).toBe(false)
    expect(shouldStopRapidReroll('49', 50, 'mid')).toBe(false)
    expect(shouldStopRapidReroll(49.7, 50, 'mid')).toBe(false)
    expect(shouldStopRapidReroll(-1, 0, 'mid')).toBe(false)
    expect(shouldStopRapidReroll(Infinity, 50, 'top')).toBe(false)
    expect(shouldStopRapidReroll(NaN, 50, 'mid')).toBe(false)
    expect(() => shouldStopRapidReroll()).not.toThrow()
  })

  it('纯函数无副作用：重复调用结果一致，非法入参不抛错', () => {
    expect(shouldStopRapidReroll(49, 50, 'mid')).toBe(shouldStopRapidReroll(49, 50, 'mid'))
    expect(shouldStopRapidReroll(0, 1, 'low')).toBe(shouldStopRapidReroll(0, 1, 'low'))
  })

  it('快速重抽期间结果区与操作条保留：不切回问号、不切回“开始觉醒”、三个按钮原位保留', () => {
    expect(createPageSource).toMatch(/v-if="!spiritRevealed"/)
    expect(createPageSource).toMatch(/@click="rerollAwaken\(\)">重新觉醒/)
    expect(createPageSource).toMatch(/:disabled="stopLocked" @click="rerollAwaken\(\)"/)
    expect(createPageSource).toMatch(/@click="step = 2">← 重新选择出身/)
    expect(createPageSource).not.toMatch(/@click="doAwaken\(\)">重新觉醒/)
    const rerollBlock = createPageSource.slice(createPageSource.indexOf('function rerollAwaken'), createPageSource.indexOf('async function doAwaken'))
    expect(rerollBlock).not.toContain('spiritRevealed.value = false')
    expect(rerollBlock).not.toContain('awakenRevealed.value = false')
  })

  it('快速重抽期间“就是它了”保留槽位但禁用；50/50“自选神级武魂”保留槽位但禁用', () => {
    expect(createPageSource).toMatch(/<button class="btn btn-gold" :disabled="rerollActive" @click="confirmSpirit">就是它了！→<\/button>/)
    expect(createPageSource).toMatch(/v-if="currentPity >= PITY_LIMIT && !showGodPicker" class="btn btn-gold" :disabled="rerollActive" @click="openGodPicker"/)
  })

  it('每次有效“重新觉醒”点击 = 一次真实抽取 + 一次保底：非神级走 increment（50 封顶）、神级只 reset 当前出身', () => {
    const rerollBlock = createPageSource.slice(createPageSource.indexOf('function rerollAwaken'), createPageSource.indexOf('async function doAwaken'))
    expect(rerollBlock).toContain('updatePity(resetOriginCount)')
    expect(rerollBlock).toContain('updatePity(incrementOriginCount)')
    expect(rerollBlock).toContain('shouldStopRapidReroll(previousPity, nextPity, draw.tier)')
    expect(rerollBlock).not.toMatch(/nextPity\s*\+ 1|previousPity\s*\+ 1/)
  })

  it('单一揭示计时器 + 单一安全锁计时器：新点击先取消旧计时器，锁期间拒绝尾随点击', () => {
    const setupBlock = createPageSource.slice(createPageSource.indexOf('const rerollActive'))
    expect(setupBlock).toContain('clearTimeout(revealTimer)')
    expect(setupBlock).toContain('clearTimeout(safetyTimer)')
    expect(setupBlock).toContain('setTimeout(commitPendingResult, RAPID_REVEAL_DELAY_MS)')
    expect(setupBlock).toContain('RARE_STOP_HOLD_MS')
    expect(createPageSource).toContain('if (stopLocked.value) return')
  })

  it('离开觉醒步骤 / 重新进入 / 卸载时清理全部计时器，重进为干净首次觉醒状态', () => {
    expect(createPageSource).toMatch(/if \(newStep !== 3\) clearRapidState\(\)/)
    expect(createPageSource).toMatch(/clearRapidState\(\)[\s\S]*?onBeforeUnmount|onBeforeUnmount[\s\S]*?clearRapidState\(\)/)
    expect(createPageSource).toContain('stopCarousel()')
    expect(createPageSource).toContain('clearRapidState()')
    const goStep3Block = createPageSource.slice(createPageSource.indexOf('function goStep3'))
    expect(goStep3Block).toContain('clearRapidState()')
    expect(goStep3Block).toContain('spiritRevealed.value = false')
    expect(goStep3Block).toContain('awakenedSpirit.value = null')
  })

  it('步骤动画使用 watch 提供的 oldStep 判断前进或后退', () => {
    expect(createPageSource).toMatch(/watch\(step,\s*\(newStep,\s*oldStep\)\s*=>[\s\S]*?newStep\s*<\s*oldStep/)
    expect(createPageSource).not.toContain('newStep < step.value')
  })

  it('快速重抽不依赖 prefersReducedMotion 分支：抽取 / 保底 / 收敛计时完全一致，仅关闭过渡动画', () => {
    const rerollBlock = createPageSource.slice(createPageSource.indexOf('function rerollAwaken'), createPageSource.indexOf('async function doAwaken'))
    expect(rerollBlock).not.toContain('prefersReducedMotion')
    expect(rerollBlock).not.toContain('matchMedia')
    expect(createPageSource).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.awaken-stage\.is-rerolling[\s\S]*?transition: none/)
  })

  it('结果替换为直接替换：快速重抽不重放仪式动画、不重置法阵/轮播状态', () => {
    expect(createPageSource).toMatch(/:class="\{ 'has-result': spiritRevealed, 'is-rerolling': rerollActive \}"/)
    const commitBlock = createPageSource.slice(createPageSource.indexOf('function commitPendingResult'), createPageSource.indexOf('function startStopLock'))
    expect(commitBlock).not.toContain('awakenRevealed.value = false')
    expect(commitBlock).not.toContain('spiritRevealed.value = false')
    expect(commitBlock).toContain('awakenedSpirit.value = pendingResult.value.spirit')
    expect(commitBlock).toContain('innatePower.value = pendingResult.value.power')
  })
})
