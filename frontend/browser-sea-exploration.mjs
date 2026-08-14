import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
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

const server = await new Promise((resolve, reject) => {
  const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  instance.once('error', reject)
})

const screenshotDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'local', 'bug-oral-010-011')
fs.mkdirSync(screenshotDir, { recursive: true })
const screenshotOnce = async (page, fileName) => {
  const target = path.join(screenshotDir, fileName)
  if (fs.existsSync(target)) return
  await page.screenshot({ path: target, fullPage: false })
}

function strongLv80Save(base) {
  const rings = Array.from({ length: 7 }, (_, index) => ({
    ringId: 'yellow_ring',
    name: '测试魂环' + (index + 1),
    tier: 'yellow',
    year: (index + 1) * 100,
    source: 'Chrome 固定随机验收',
    skill: '测试魂技' + (index + 1)
  }))
  const done = [...new Set([...(base.doneEvents || []), 'first_hunt', 'reach_lv10', 'soul_master_prelim', 'spirit_hall_exam', 'soul_master_final', 'god_trial_sea'])]
  return {
    ...base,
    playerId: 'browser-oral-010-011',
    name: '海神路线验收',
    level: 80,
    exp: 0,
    overflowExp: 0,
    rings,
    skills: rings.map((ring, index) => ({ skillId: ring.ringId + ':' + index, name: ring.skill, source: ring.source, ring: index + 1 })),
    finished: false,
    gold: 20000,
    hp: 10000,
    spiritPower: 10000,
    bonus: { ...(base.bonus || {}), attack: 5000, defense: 5000, speed: 5000, hp: 5000 },
    pendingRingLv: 80,
    _ringHuntDeferredUntil: 0,
    _eventCount: 0,
    _gameTime: 0,
    _prologueDone: true,
    _spiritAwakeningStoryDone: true,
    _earlyLifeDone: true,
    _registeredAtHall: true,
    _enrollmentComplete: true,
    _firstClassDone: true,
    _mainStoryVersion: 1,
    _currentLocation: 'shrek_academy',
    _visitedLocations: ['shrek_academy'],
    locationExploration: null,
    _locationProgress: {},
    doneEvents: done,
    completedEvents: done.slice(),
    _recentEvents: [],
    _saveVersion: 9
  }
}

async function visible(locator) {
  return locator.isVisible().catch(() => false)
}

async function finishBattle(page) {
  const battle = page.locator('.battle-shell')
  for (let turn = 0; turn < 80; turn += 1) {
    if (!(await visible(battle))) break
    const attack = page.getByRole('button', { name: '普通攻击', exact: true })
    if (await visible(attack)) await attack.click({ timeout: 1500 }).catch(() => {})
    await page.waitForTimeout(60)
  }
  await page.locator('.scene-continue').waitFor({ timeout: 15000 })
}

async function resolveArrival(page) {
  let sawTravelEncounter = false
  for (let step = 0; step < 100; step += 1) {
    if (await visible(page.locator('.scene-location-action'))) return sawTravelEncounter
    if (await visible(page.locator('.battle-shell'))) {
      await finishBattle(page)
      continue
    }
    const event = page.locator('.scene-event')
    if (await visible(event)) {
      if ((await event.innerText()).includes('旅途遭遇')) sawTravelEncounter = true
      const choice = event.locator('.choice-btn:not([disabled])').first()
      await choice.waitFor({ state: 'visible', timeout: 10000 })
      await choice.click()
      continue
    }
    const result = page.locator('.scene-continue')
    if (await visible(result)) {
      await page.getByRole('button', { name: /继续前行/ }).click()
      continue
    }
    await page.waitForTimeout(100)
  }
  throw new Error('旅行抵达后没有进入地点行动界面')
}

async function travelFromMap(page, targetName) {
  await page.waitForURL(url => url.hash === '#/map', { timeout: 15000 })
  const frame = page
  const marker = frame.locator('.location-marker[title="' + targetName + '"]')
  await marker.waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(500)
  await marker.click({ force: true })
  const travelButton = frame.locator('#panel-travel')
  await travelButton.waitFor({ state: 'visible', timeout: 10000 })
  assert.equal(await travelButton.isDisabled(), false, targetName + ' 应允许旅行')
  await travelButton.click()
  await page.waitForURL(url => url.hash === '#/game', { timeout: 15000 })
  return resolveArrival(page)
}

async function assertPageLocked(page, label) {
  const metrics = await page.evaluate(() => ({
    scrollHeight: document.scrollingElement.scrollHeight,
    clientHeight: document.scrollingElement.clientHeight,
    scrollWidth: document.scrollingElement.scrollWidth,
    clientWidth: document.scrollingElement.clientWidth
  }))
  console.log('page-metrics ' + label + ': ' + JSON.stringify(metrics))
  assert.ok(metrics.scrollHeight <= metrics.clientHeight + 1, label + ' 页面纵向溢出')
  assert.ok(metrics.scrollWidth <= metrics.clientWidth + 1, label + ' 页面横向溢出')
}

let browser
try {
  const port = server.address().port
  const baseUrl = 'http://127.0.0.1:' + port + '/'
  browser = await chromium.launch({ executablePath, headless: true })

  // 第一次只用真实 Chrome 建立一个完整默认存档，再将其升级为固定的 Lv.80/七环验收档。
  const bootstrapContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const bootstrapPage = await bootstrapContext.newPage()
  await bootstrapPage.goto(baseUrl, { waitUntil: 'networkidle' })
  await bootstrapPage.getByRole('button', { name: /新的旅程/ }).click()
  await bootstrapPage.waitForURL(url => url.hash === '#/create')
  await bootstrapPage.getByLabel('魂师名字').fill('海神路线验收')
  await bootstrapPage.getByRole('button', { name: /下一步/ }).click()
  await bootstrapPage.locator('.origin-card').first().click()
  await bootstrapPage.getByRole('button', { name: /进行武魂觉醒/ }).click()
  await bootstrapPage.getByRole('button', { name: /开始觉醒/ }).click()
  await bootstrapPage.getByRole('button', { name: /就是它了/ }).waitFor({ state: 'visible' })
  await bootstrapPage.getByRole('button', { name: /就是它了/ }).click()
  await bootstrapPage.waitForURL(url => url.hash === '#/game')
  const baseSave = await bootstrapPage.evaluate(() => JSON.parse(localStorage.getItem('dldl_text_rpg_save') || 'null'))
  assert.ok(baseSave?.playerId, '无法建立 Chrome 验收基础存档')
  const acceptanceSave = strongLv80Save(baseSave)
  await bootstrapContext.close()

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(save => {
    localStorage.setItem('dldl_text_rpg_save', JSON.stringify(save))
  }, acceptanceSave)
  await context.addInitScript(() => {
    // 固定旅行遭遇为必有一次，且固定为第一种可预测的战斗遭遇。
    Math.random = () => 0.001
  })
  const page = await context.newPage()
  const errors = []
  const image404s = []
  page.on('pageerror', error => errors.push('pageerror: ' + error.message))
  page.on('console', message => {
    if (message.type() === 'error' && !message.location().url?.endsWith('/favicon.ico')) {
      errors.push('console: ' + message.text())
    }
  })
  page.on('requestfailed', request => {
    if (!request.url().endsWith('/favicon.ico')) errors.push('requestfailed: ' + request.url())
  })
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) {
      const line = 'response ' + response.status() + ': ' + response.url()
      errors.push(line)
      if (response.request().resourceType() === 'image') image404s.push(line)
    }
  })

  await page.goto(baseUrl + '#/game', { waitUntil: 'networkidle' })
  await page.locator('.event-title').waitFor({ timeout: 15000 })
  await assertPageLocked(page, 'Lv.80 初始游戏页')

  // 1-4：从游戏打开地图，查看海神岛目标、路线和下一站。
  await page.getByText('常用', { exact: true }).click()
  await page.getByRole('button', { name: '地图', exact: true }).click()
  await page.waitForURL(url => url.hash === '#/map')
  assert.equal(await page.locator('iframe[title="万象地图"]').count(), 0, '生产地图不应继续使用 iframe')
  const mapFrame = page
  const objectiveBanner = mapFrame.locator('#objectiveBanner')
  await objectiveBanner.waitFor({ state: 'visible', timeout: 15000 })
  const objectiveText = await objectiveBanner.innerText()
  assert.match(objectiveText, /第8魂环目标：海神岛/)
  assert.match(objectiveText, /史莱克学院 → 天斗城 → 东海港口 → 海神岛/)
  assert.match(objectiveText, /下一站：天斗城/)
  assert.equal(await mapFrame.locator('.location-marker.objective[title="海神岛"]').count(), 1)
  assert.equal(await mapFrame.locator('.location-marker.fogged[title="海神岛"]').count(), 0)
  await screenshotOnce(page, 'oral-010-map-objective.png')
  await page.screenshot({ path: 'C:\\Temp\\douluo-map-oral-014.png', fullPage: true })

  let travelEncounterCount = 0
  if (await travelFromMap(page, '天斗城')) travelEncounterCount += 1
  await page.getByRole('button', { name: /返回万象地图/ }).click()
  if (await travelFromMap(page, '东海港口')) travelEncounterCount += 1
  await page.getByRole('button', { name: /返回万象地图/ }).click()
  if (await travelFromMap(page, '海神岛')) travelEncounterCount += 1
  assert.ok(travelEncounterCount >= 1, '途中至少应完成一次固定随机遭遇')

  // 8-10：抵达海神岛后，正式猎环入口必须在地点行动界面首位。
  const ringPriority = page.locator('[data-testid="ring-hunt-priority"]')
  await ringPriority.waitFor({ state: 'visible', timeout: 15000 })
  assert.match(await ringPriority.innerText(), /当前任务 · 第8魂环[\s\S]*不需要等待随机事件/)
  await page.setViewportSize({ width: 390, height: 844 })
  await assertPageLocked(page, '海神岛地点行动移动端')
  const ringButton = page.locator('[data-testid="ring-hunt-priority"] .ring-priority-btn')
  const ringButtonBox = await ringButton.evaluate(node => {
    const rect = node.getBoundingClientRect()
    return { top: rect.top, bottom: rect.bottom, height: rect.height }
  })
  assert.ok(ringButtonBox && ringButtonBox.bottom <= 844, '第八魂环核心按钮不应被挤出移动端视口')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await ringButton.click()
  await page.locator('.scene-event').waitFor({ timeout: 10000 })
  await page.locator('.scene-event .choice-btn:not([disabled])').first().click()
  await finishBattle(page)
  await page.getByRole('button', { name: /继续前行/ }).click()
  await page.locator('.scene-location-action').waitFor({ timeout: 10000 })
  const ringSave = await page.evaluate(() => JSON.parse(localStorage.getItem('dldl_text_rpg_save') || 'null'))
  assert.equal(ringSave.rings.length, 8, '第八魂环正式流程应新增一枚魂环')
  assert.equal(ringSave.pendingRingLv, null, '第八魂环完成后应清除猎魂目标')
  await screenshotOnce(page, 'oral-010-sea-god-island-action.png')

  // 11：返回已访问的东海港口，确认快速旅行后只进入当地探索链。
  await page.getByRole('button', { name: /返回万象地图/ }).click()
  const portFrame = page
  await portFrame.locator('.location-marker[title="东海港口"]').waitFor({ state: 'visible', timeout: 15000 })
  await portFrame.locator('.location-marker[title="东海港口"] .marker-hitarea').click({ force: true })
  const fastButton = portFrame.locator('#panel-travel')
  await fastButton.waitFor({ state: 'visible' })
  assert.match(await fastButton.innerText(), /快速旅行/)
  await fastButton.click()
  await page.waitForURL(url => url.hash === '#/game', { timeout: 15000 })
  await resolveArrival(page)
  await page.getByRole('button', { name: /探索当地/ }).click()

  const localEvents = []
  for (let stage = 0; stage < 4; stage += 1) {
    const event = page.locator('.scene-event')
    await event.waitFor({ timeout: 10000 })
    const eventText = await event.innerText()
    const eventLocation = await event.locator('.scene-location').innerText()
    localEvents.push(eventText)
    assert.match(eventLocation, /东海港口/, '地点探索事件必须属于当前地点')
    await event.locator('.choice-btn:not([disabled])').first().click()
    if (await visible(page.locator('.battle-shell'))) await finishBattle(page)
    await page.getByRole('button', { name: /继续前行/ }).click()
  }
  await page.locator('.scene-location-action').waitFor({ timeout: 10000 })
  const explorationSave = await page.evaluate(() => JSON.parse(localStorage.getItem('dldl_text_rpg_save') || 'null'))
  assert.equal(localEvents.length, 4)
  assert.equal(explorationSave.locationExploration.active, false, '完成一轮后地点探索应结束并返回地点行动')
  assert.equal(explorationSave._locationProgress.east_sea_port.rounds, 1)
  await assertPageLocked(page, '东海港口地点行动')
  await screenshotOnce(page, 'oral-011-east-sea-port-exploration-complete.png')

  assert.deepEqual(image404s, [], '浏览器不应产生图片 404')
  assert.deepEqual(errors, [], 'Chrome 流程不应产生控制台/pageerror/网络错误')
  console.log('Chrome BUG-ORAL-010/011 验收通过：固定随机完成海神岛路线、途中遭遇、第八魂环和东海港口 4 阶段地点探索。')
  console.log('旅行遭遇次数：' + travelEncounterCount + '；地点探索阶段：' + localEvents.length)
  await context.close()
} finally {
  if (browser) await browser.close()
  await new Promise(resolve => server.close(resolve))
}
