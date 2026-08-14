/**
 * BUG-001 / BUG-003 回归验证（真实浏览器，生产构建）
 *
 * 验证项：
 *  1) 原地休息（真实 UI 按钮）：恢复量 = 实际缺口、提示真实、生命不超过上限（BUG-003 修复路径）
 *  2) 低血量存档重入后连续“继续前行”，每次 nextEvent 都会求值 dyn_low_hp 条件，
 *     不再抛 finalStats ReferenceError（BUG-001 崩溃点）
 *  3) 地图旅行 → 随机遭遇 → 战斗 → 继续前行 全链路无新 ReferenceError（审查复现步骤）
 *
 * 已知限制（写入验证结论）：
 *  - 修复后 nextEvent 总是直接进入事件/继续场景，“旅途尚待展开”空闲态只在数据加载
 *    窗口短暂出现（此时 store 尚未反序列化，生命为初始值 0）。满血休息（157/157 → 恢复 0）
 *    的精确断言由 frontend/tests/bug-regressions.test.js 覆盖。
 *  - “探索四周”按钮与“原地休息”同属空闲态；按钮级点击用加载窗口验证，探索推进逻辑
 *    等价于“继续前行”（explore() 即 nextEvent()），由低血量继续前行链路覆盖。
 *
 * 运行：node frontend/browser-verify.mjs（先 npm run build）
 */
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { chromium } from 'playwright-core'

const require = createRequire(import.meta.url)
const { app } = require('../server.js')

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
].filter(Boolean)
const executablePath = chromeCandidates.find(candidate => fs.existsSync(candidate))
if (!executablePath) throw new Error('未找到 Chrome；可通过 CHROME_PATH 指定浏览器路径')

const SAVE_KEY = 'dldl_text_rpg_save'
const results = []
const findings = []
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const server = await new Promise((resolve, reject) => {
  const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  instance.once('error', reject)
})

let browser
try {
  const port = server.address().port
  const baseUrl = `http://127.0.0.1:${port}/`
  browser = await chromium.launch({ executablePath, headless: true })
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const page = await context.newPage()
  const runtimeErrors = []

  page.on('pageerror', error => runtimeErrors.push(`pageerror: ${error.message}`))
  page.on('console', message => {
    if (message.type() === 'error') {
      const location = message.location()
      runtimeErrors.push(`console: ${message.text()}${location.url ? ` @ ${location.url}:${location.lineNumber || 0}` : ''}`)
    }
  })
  page.on('requestfailed', request => {
    const type = request.resourceType()
    if (['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(type)) {
      runtimeErrors.push(`requestfailed: ${request.method()} ${request.url()} (${request.failure()?.errorText || 'unknown'})`)
    }
  })
  page.on('response', response => {
    const type = response.request().resourceType()
    if (response.status() >= 400 && ['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(type)) {
      runtimeErrors.push(`response ${response.status()}: ${response.url()}`)
    }
  })

  // 云存档 API 走内存响应，验证过程不写入真实服务器存档。
  await page.route('**/api/player/auth', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, token: 'bugfix-verify-token', expiresIn: 3600000 })
  }))
  await page.route('**/api/player/save', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, version: 1, lastSave: new Date().toISOString() })
  }))
  // 延迟数据加载，稳定捕捉加载窗口内的空闲态（原地休息按钮所在场景）。
  await page.route('**/data/*.json', async route => {
    await new Promise(resolve => setTimeout(resolve, 1200))
    await route.continue()
  })

  // ---------- 工具函数 ----------

  async function readHpBar() {
    return page.evaluate(() => {
      const rows = [...document.querySelectorAll('.bar-row')]
      const row = rows.find(r => r.querySelector('.bar-label span')?.textContent.trim() === '生命')
      if (!row) return null
      const text = row.querySelector('.bar-label span:last-child')?.textContent.trim() || ''
      const m = text.match(/(\d+)\s*\/\s*(\d+)/)
      return m ? { current: Number(m[1]), max: Number(m[2]) } : null
    })
  }

  async function waitToast(pattern, timeout = 8000) {
    const toast = page.locator('.toast-item', { hasText: pattern }).last()
    await toast.waitFor({ timeout })
    return (await toast.innerText()).trim()
  }

  async function clickContinue() {
    await page.getByRole('button', { name: /继续前行/ }).click()
  }

  // 事件链推进：事件→选项→继续，直到场景稳定（上限保护）
  async function clickThrough(maxSteps = 12) {
    for (let i = 0; i < maxSteps; i++) {
      if (await page.locator('.scene-battle').count() > 0) {
        await fightBattle()
        continue
      }
      if (await page.locator('.scene-event').count() > 0) {
        const btn = page.locator('.scene-event .choice-btn:not([disabled])').first()
        await btn.waitFor({ timeout: 4000 })
        await btn.click()
        if (await page.locator('.scene-battle').count() > 0) {
          await fightBattle()
          continue
        }
        await page.locator('.scene-continue').waitFor({ timeout: 4000 })
        await clickContinue()
        continue
      }
      if (await page.locator('.scene-continue').count() > 0) {
        await clickContinue()
        continue
      }
      break
    }
  }

  async function seedHp(hp) {
    await page.evaluate(([key, value]) => {
      const save = JSON.parse(localStorage.getItem(key))
      save.hp = value
      localStorage.setItem(key, JSON.stringify(save))
    }, [SAVE_KEY, hp])
  }

  async function injectTravelRandomSequence() {
    await page.evaluate(() => {
      const rolls = [0.5, 0]
      const originalRandom = Math.random
      window.__browserVerifyRandomRestore = originalRandom
      Math.random = () => (rolls.length ? rolls.shift() : 0.5)
    })
  }

  async function restoreTravelRandomSequence() {
    await page.evaluate(() => {
      if (window.__browserVerifyRandomRestore) {
        Math.random = window.__browserVerifyRandomRestore
        delete window.__browserVerifyRandomRestore
      }
    })
  }

  async function injectDeterministicGameplayRandom() {
    await page.evaluate(() => {
      window.__browserVerifyGameplayRandomRestore = Math.random
      Math.random = () => 0.99
    })
  }

  // 战斗：先防御掉血，再普通攻击至战斗结束
  async function fightBattle() {
    for (let i = 0; i < 3; i++) {
      const def = page.getByRole('button', { name: '防御', exact: true })
      if (await def.count() === 0) break
      await def.click()
      await page.waitForTimeout(400)
    }
    for (let i = 0; i < 25; i++) {
      if (await page.locator('.scene-battle').count() === 0) break
      const atk = page.getByRole('button', { name: '普通攻击' })
      if (await atk.count() === 0) { await page.waitForTimeout(400); continue }
      await atk.click()
      await page.waitForTimeout(400)
    }
  }

  // 旅行遭遇使用一次注入的确定性序列：0.5 跳过天气骰，0 触发生产代码的 32% 遭遇骰。
  async function travelUntilEncounter() {
    let seen = false
    await page.locator('summary').filter({ hasText: '常用' }).click()
    await page.getByRole('button', { name: '地图', exact: true }).click()
    await page.waitForURL(url => url.hash === '#/map')
    const frame = page
    const marker = frame.locator('.location-marker.adjacent:not(.visited)').first()
    await marker.waitFor({ state: 'visible', timeout: 10000 })
    await marker.click({ force: true })
    const routeMeta = await frame.locator('.panel-route-meta').innerText()
    const encounterPercent = Number((routeMeta.match(/遭遇率约(\d+)%/) || [])[1] || NaN)
    const travelButton = frame.locator('#panel-travel')
    await travelButton.waitFor({ state: 'visible' })

    await injectTravelRandomSequence()
    try {
      await travelButton.click()
      await page.waitForURL(url => url.hash === '#/game')
      await page.waitForFunction(() => sessionStorage.getItem('dldl_pending_travel') === null)
      await page.waitForTimeout(400)

      if (await page.locator('.scene-battle').count() > 0) {
        seen = true
        await fightBattle()
      } else if (await page.locator('.scene-event').count() > 0) {
        seen = true
        const btn = page.locator('.scene-event .choice-btn:not([disabled])').first()
        await btn.waitFor({ timeout: 4000 })
        await btn.click()
      }
      if (await page.locator('.scene-continue').count() > 0) {
        await clickContinue()
        await page.waitForTimeout(400)
      }
    } finally {
      await restoreTravelRandomSequence()
    }
    return { seen, encounterPercent }
  }

  // ---------- 建角 ----------

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /新的旅程/ }).click()
  await page.waitForURL(url => url.hash === '#/create')
  await page.getByLabel('魂师名字').fill(`回归${Date.now().toString(36).slice(-4)}`)
  await page.getByRole('button', { name: /下一步/ }).click()
  await page.locator('.origin-card').first().click()
  await page.getByRole('button', { name: /进行武魂觉醒/ }).click()
  await page.getByRole('button', { name: /开始觉醒/ }).click()
  const confirmSpirit = page.getByRole('button', { name: /就是它了/ })
  await confirmSpirit.waitFor({ state: 'visible' })
  await confirmSpirit.click()
  await page.waitForURL(url => url.hash === '#/game')
  await page.locator('.scene-idle, .scene-event').first().waitFor({ timeout: 10000 })
  record('建角进入 /game', true)
  await injectDeterministicGameplayRandom()

  // ---------- BUG-003：原地休息（加载窗口内真实 UI 按钮） ----------

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('.scene-idle').waitFor({ timeout: 8000 })
  const restBefore = await readHpBar()
  await page.getByRole('button', { name: '原地休息', exact: true }).click()
  const restToast = await waitToast(/恢复 \d+ 点生命/, 3000)
  const restAfter = await readHpBar()
  const expected = restBefore ? Math.min(50, restBefore.max - restBefore.current) : -1
  const toastDelta = Number((restToast.match(/恢复 (\d+) 点生命/) || [])[1] || -1)
  const restOk = restBefore && restAfter &&
    toastDelta === expected &&
    restAfter.current === restBefore.current + expected &&
    restAfter.current <= restAfter.max
  record('BUG-003 原地休息：恢复量=实际缺口、提示真实、生命不超过上限', restOk,
    `休息前 ${restBefore?.current}/${restBefore?.max}，提示「${restToast}」，休息后 ${restAfter?.current}/${restAfter?.max}`)

  // ---------- BUG-001：低血量重入后连续继续前行 ----------

  await seedHp(1)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForURL(url => url.hash === '#/game')
  await page.locator('.scene-event, .scene-continue').first().waitFor({ timeout: 8000 })
  await clickThrough(6)
  const lowHpState = await readHpBar()
  record('BUG-001 低血量重入并连续继续前行推进正常', lowHpState !== null,
    `推进后生命 ${lowHpState?.current}/${lowHpState?.max}`)
  record('BUG-001 推进过程中生命不超过上限', lowHpState && lowHpState.current <= lowHpState.max,
    `${lowHpState?.current}/${lowHpState?.max}`)

  for (let i = 0; i < 2; i++) {
    await seedHp(1)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForURL(url => url.hash === '#/game')
    await page.locator('.scene-event, .scene-continue').first().waitFor({ timeout: 8000 })
    await clickThrough(6)
  }
  const afterLoopHp = await readHpBar()
  record('BUG-001 多轮低血量继续/探索无异常', afterLoopHp && afterLoopHp.current <= afterLoopHp.max,
    `${afterLoopHp?.current}/${afterLoopHp?.max}`)

  // ---------- BUG-001：旅行 → 随机遭遇 → 战斗 → 继续前行 ----------

  const travelResult = await travelUntilEncounter()
  record('BUG-001 旅行→遭遇→结算→继续前行全链路', travelResult.seen,
    travelResult.seen
      ? `已触发确定性遭遇并完成推进（生产提示概率 ${travelResult.encounterPercent}%）`
      : `未触发遭遇（生产提示概率 ${travelResult.encounterPercent}%）`)
  const travelHp = await readHpBar()
  record('BUG-001 旅行结算后生命不超过上限', travelHp && travelHp.current <= travelHp.max,
    `${travelHp?.current}/${travelHp?.max}`)

  // ---------- 最终错误核对 ----------

  const fatalErrors = runtimeErrors.filter(e => /finalStats|not defined/.test(e))
  const otherErrors = runtimeErrors.filter(e => !/finalStats|not defined/.test(e))
  record('控制台无 finalStats/未定义错误', fatalErrors.length === 0,
    fatalErrors.length ? fatalErrors.join(' | ') : '未发现')
  if (otherErrors.length) {
    findings.push(`非本次修复范围的控制台错误（${otherErrors.length} 条）:\n${otherErrors.join('\n')}`)
  }

  console.log('\n===== 验证汇总 =====')
  const failed = results.filter(r => !r.ok)
  console.log(`通过 ${results.length - failed.length}/${results.length}`)
  if (failed.length) {
    console.log('失败项:')
    failed.forEach(f => console.log(`  - ${f.name}: ${f.detail}`))
    process.exitCode = 1
  }
  if (findings.length) {
    console.log('\n发现（非本次修复范围）:')
    findings.forEach(f => console.log(f))
  }
} finally {
  if (browser) await browser.close()
  await new Promise(resolve => server.close(resolve))
}
