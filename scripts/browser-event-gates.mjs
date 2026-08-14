import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const ROOT = process.cwd()
const require = createRequire(path.join(ROOT, 'frontend', 'package.json'))
const { chromium: chromiumFromRequire } = require('playwright-core')
const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
].filter(Boolean)
const executablePath = chromeCandidates.find(candidate => fs.existsSync(candidate))
if (!executablePath) throw new Error('未找到 Chrome；可通过 CHROME_PATH 指定浏览器路径')

const baseUrl = process.env.EVENT_GATE_BASE_URL || 'http://127.0.0.1:3000'
const mainDone = ['first_hunt', 'reach_lv10', 'soul_master_prelim', 'spirit_hall_exam', 'soul_master_final', 'god_trial_sea', 'final_evil']

async function bootstrapSave(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /新的旅程/ }).click()
  await page.waitForURL(url => url.hash === '#/create')
  await page.getByLabel('魂师名字').fill('事件门槛验收')
  await page.getByRole('button', { name: /下一步/ }).click()
  await page.locator('.origin-card').first().click()
  await page.getByRole('button', { name: /进行武魂觉醒/ }).click()
  await page.getByRole('button', { name: /开始觉醒/ }).click()
  await page.getByRole('button', { name: /就是它了/ }).waitFor({ state: 'visible' })
  await page.getByRole('button', { name: /就是它了/ }).click()
  await page.waitForURL(url => url.hash === '#/game')
  await page.locator('.event-title').waitFor()
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('dldl_text_rpg_save')))
  await context.close()
  return save
}

function makeSave(base, level) {
  const ringCount = level <= 5 ? 0 : level >= 90 ? 9 : 8
  const rings = Array.from({ length: ringCount }, (_, index) => ({
    ringId: `gate_ring_${index + 1}`,
    name: `${(index + 1) * 10}年测试魂环`,
    tier: 'yellow',
    year: (index + 1) * 10,
    source: '门槛验收',
    skill: `测试魂技${index + 1}`
  }))
  return {
    ...base,
    playerId: `browser-event-gate-${level}`,
    name: `事件门槛 Lv.${level}`,
    level,
    exp: 0,
    overflowExp: 0,
    rings,
    skills: rings.map((ring, index) => ({ skillId: ring.ringId, name: ring.skill, source: ring.source, ring: index + 1 })),
    finished: false,
    pendingRingLv: null,
    _ringHuntDeferredUntil: 0,
    _storyMilestoneDeferredUntil: 0,
    _prologueDone: true,
    _earlyLifeDone: true,
    _enrollmentComplete: true,
    _firstClassDone: true,
    _currentLocation: 'star_duo_outer',
    _visitedLocations: [...new Set([...(base._visitedLocations || []), 'star_duo_outer'])],
    doneEvents: level <= 5 ? (base.doneEvents || []).filter(id => !mainDone.includes(id)) : [...new Set([...(base.doneEvents || []), ...mainDone])],
    completedEvents: level <= 5 ? (base.completedEvents || []).filter(id => !mainDone.includes(id)) : [...new Set([...(base.completedEvents || []), ...mainDone])],
    bonus: { ...(base.bonus || {}), attack: 500, defense: 500, speed: 500 }
  }
}

const browser = await chromiumFromRequire.launch({ executablePath, headless: true })
try {
  const baseSave = await bootstrapSave(browser)
  const results = []
  for (const level of [5, 70, 90, 99]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    await context.addInitScript(save => {
      localStorage.setItem('dldl_text_rpg_save', JSON.stringify(save))
    }, makeSave(baseSave, level))
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
    page.on('console', message => {
      if (message.type() === 'error') {
        const location = message.location()
        if (!location.url?.endsWith('/favicon.ico')) errors.push(`console: ${message.text()} @ ${location.url || 'unknown'}`)
      }
    })
    page.on('requestfailed', request => {
      if (['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(request.resourceType())) errors.push(`requestfailed: ${request.url()}`)
    })
    page.on('response', response => {
      const type = response.request().resourceType()
      if (response.status() >= 400 && ['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(type)) errors.push(`response ${response.status()}: ${response.url()}`)
    })
    await page.goto(`${baseUrl}#/game`, { waitUntil: 'networkidle' })
    await page.locator('.event-title').waitFor({ timeout: 15000 })
    const title = await page.locator('.event-title').innerText()
    const enabledChoice = page.locator('.scene-event .choice-btn:not([disabled])').first()
    await enabledChoice.waitFor({ state: 'visible', timeout: 10000 })
    await enabledChoice.click()
    const battle = page.locator('.battle-shell')
    if (await battle.isVisible({ timeout: 1500 }).catch(() => false)) {
      for (let turn = 0; turn < 8 && await battle.isVisible().catch(() => false); turn++) {
        // 战斗结算会替换整个动作区；直接在当前 DOM 快照触发按钮，避免 Playwright
        // actionability 重试期间节点被替换而产生偶发的 detached/intercepts 超时。
        const clicked = await page.evaluate(() => {
          const attack = [...document.querySelectorAll('button')]
            .find(button => button.textContent?.trim() === '普通攻击' && !button.disabled)
          if (!attack) return false
          attack.click()
          return true
        })
        if (!clicked) break
        await page.waitForTimeout(150)
      }
    }
    await page.locator('.scene-continue').waitFor({ timeout: 10000 })
    await page.getByRole('button', { name: /继续前行/ }).click()
    await page.locator('.scene-event .choice-btn:not([disabled])').first().waitFor({ timeout: 10000 })
    assert.deepEqual(errors, [], `Lv.${level} 浏览器错误：\n${errors.join('\n')}`)
    results.push({ level, title })
    await context.close()
  }
  console.log(`Chrome 事件门槛存档验收通过：${results.map(result => `Lv.${result.level}「${result.title}」`).join('；')}`)
} finally {
  await browser.close()
}
