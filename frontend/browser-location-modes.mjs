import assert from 'node:assert/strict'
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

const server = await new Promise((resolve, reject) => {
  const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  instance.once('error', reject)
})

function visible(locator) {
  return locator.isVisible().catch(() => false)
}

function fixedModeSave(base) {
  const rings = Array.from({ length: 8 }, (_, index) => ({
    ringId: 'yellow_ring',
    name: `固定测试魂环${index + 1}`,
    tier: 'yellow',
    year: (index + 1) * 100,
    source: '地点模式 Chrome 验收',
    skill: `固定测试魂技${index + 1}`
  }))
  const done = [...new Set([...(base.doneEvents || []), 'first_hunt', 'reach_lv10', 'soul_master_prelim', 'spirit_hall_exam', 'soul_master_final', 'god_trial_sea', 'final_evil'])]
  return {
    ...base,
    playerId: 'browser-location-modes',
    name: '地点模式验收',
    level: 80,
    exp: 0,
    overflowExp: 0,
    rings,
    skills: rings.map((ring, index) => ({ skillId: `fixed:${index}`, name: ring.skill, source: ring.source, ring: index + 1 })),
    finished: false,
    gold: 20000,
    hp: 10000,
    spiritPower: 10000,
    bonus: { ...(base.bonus || {}), attack: 5000, defense: 5000, speed: 5000, hp: 5000 },
    pendingRingLv: null,
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
    _currentLocation: 'tian_dou_city',
    _visitedLocations: [...new Set([...(base._visitedLocations || []), 'shrek_academy', 'tian_dou_city'])],
    locationExploration: null,
    _locationProgress: {},
    doneEvents: done,
    completedEvents: done.slice(),
    _recentEvents: [],
    _saveVersion: 10
  }
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
  for (let step = 0; step < 100; step += 1) {
    if (await visible(page.locator('.scene-location-action'))) return
    if (await visible(page.locator('.battle-shell'))) {
      await finishBattle(page)
      continue
    }
    if (await visible(page.locator('.scene-event'))) {
      const choice = page.locator('.scene-event .choice-btn:not([disabled])').first()
      await choice.waitFor({ state: 'visible', timeout: 10000 })
      await choice.click()
      continue
    }
    if (await visible(page.locator('.scene-continue'))) {
      await page.getByRole('button', { name: /继续前行/ }).click()
      continue
    }
    await page.waitForTimeout(100)
  }
  throw new Error('旅行后未进入地点行动界面')
}

async function assertPageLocked(page, label) {
  const metrics = await page.evaluate(() => ({
    scrollHeight: document.scrollingElement.scrollHeight,
    clientHeight: document.scrollingElement.clientHeight,
    scrollWidth: document.scrollingElement.scrollWidth,
    clientWidth: document.scrollingElement.clientWidth,
    bodyOverflow: getComputedStyle(document.body).overflow
  }))
  assert.ok(metrics.scrollHeight <= metrics.clientHeight + 1, `${label}纵向溢出：${metrics.scrollHeight}/${metrics.clientHeight}`)
  assert.ok(metrics.scrollWidth <= metrics.clientWidth + 1, `${label}横向溢出：${metrics.scrollWidth}/${metrics.clientWidth}`)
  assert.equal(metrics.bodyOverflow, 'hidden', `${label} body 未锁定`) 
  return metrics
}

async function completeMode(page, mode, expectedStageCount = 4) {
  await page.getByRole('button', { name: mode.button }).click()
  const titles = []
  for (let stage = 0; stage < expectedStageCount; stage += 1) {
    const event = page.locator('.scene-event')
    await event.waitFor({ timeout: 10000 })
    const locationText = await event.locator('.scene-location').innerText()
    const title = await event.locator('.event-title').innerText()
    assert.match(locationText, /东海港口/, `${mode.id} 事件跨地区：${locationText}`)
    assert.match(title, new RegExp(mode.label), `${mode.id} 标题未体现行动模式：${title}`)
    titles.push(title)
    await event.locator('.choice-btn:not([disabled])').first().click()
    if (await visible(page.locator('.battle-shell'))) await finishBattle(page)
    await page.getByRole('button', { name: /继续前行/ }).click()
  }
  await page.locator('.scene-location-action').waitFor({ timeout: 10000 })
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('dldl_text_rpg_save') || 'null'))
  assert.equal(save.locationExploration.active, false, `${mode.id} 完成后应结束探索`) 
  assert.equal(save.locationExploration.objectiveType, mode.id)
  return titles
}

let browser
try {
  const port = server.address().port
  const baseUrl = `http://127.0.0.1:${port}/`
  browser = await chromium.launch({ executablePath, headless: true })

  const bootstrapContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const bootstrapPage = await bootstrapContext.newPage()
  await bootstrapPage.goto(baseUrl, { waitUntil: 'networkidle' })
  await bootstrapPage.getByRole('button', { name: /新的旅程/ }).click()
  await bootstrapPage.waitForURL(url => url.hash === '#/create')
  await bootstrapPage.getByLabel('魂师名字').fill('地点模式验收')
  await bootstrapPage.getByRole('button', { name: /下一步/ }).click()
  await bootstrapPage.locator('.origin-card').first().click()
  await bootstrapPage.getByRole('button', { name: /进行武魂觉醒/ }).click()
  await bootstrapPage.getByRole('button', { name: /开始觉醒/ }).click()
  await bootstrapPage.getByRole('button', { name: /就是它了/ }).waitFor({ state: 'visible' })
  await bootstrapPage.getByRole('button', { name: /就是它了/ }).click()
  await bootstrapPage.waitForURL(url => url.hash === '#/game')
  const baseSave = await bootstrapPage.evaluate(() => JSON.parse(localStorage.getItem('dldl_text_rpg_save') || 'null'))
  assert.ok(baseSave?.playerId, '无法建立地点模式基础存档')
  await bootstrapContext.close()

  const save = fixedModeSave(baseSave)
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(initialSave => {
    if (!localStorage.getItem('dldl_text_rpg_save')) localStorage.setItem('dldl_text_rpg_save', JSON.stringify(initialSave))
    Math.random = () => 0.001
  }, save)
  const page = await context.newPage()
  const errors = []
  const badResponses = []
  const image404s = []
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
  page.on('console', message => {
    if (message.type() === 'error' && !message.location().url?.endsWith('/favicon.ico')) errors.push(`console: ${message.text()}`)
  })
  page.on('requestfailed', request => {
    if (!request.url().endsWith('/favicon.ico')) errors.push(`requestfailed: ${request.url()} (${request.failure()?.errorText || 'unknown'})`)
  })
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) {
      const line = `response ${response.status()}: ${response.url()}`
      badResponses.push(line)
      if (response.request().resourceType() === 'image') image404s.push(line)
    }
  })

  await page.goto(`${baseUrl}#/game`, { waitUntil: 'networkidle' })
  await page.locator('.event-title').waitFor({ timeout: 15000 })
  await page.getByText('常用', { exact: true }).click()
  await page.getByRole('button', { name: '地图', exact: true }).click()
  await page.waitForURL(url => url.hash === '#/map')
  assert.equal(await page.locator('iframe[title="万象地图"]').count(), 0, '生产地图不应使用 iframe')
  const map = page
  await map.locator('.location-marker[title="东海港口"]').waitFor({ state: 'visible', timeout: 15000 })
  const eastMarker = map.locator('.location-marker[title="东海港口"]')
  await eastMarker.locator('.marker-hitarea').click({ force: true })
  const travel = map.locator('#panel-travel')
  await travel.waitFor({ state: 'visible' })
  assert.match(await map.locator('.detail-panel').innerText(), /东海港口/, '点击东海港口后地点面板必须同步')
  assert.equal(await travel.isDisabled(), false, '已访问路网相邻的东海港口必须可前往')
  await travel.click()
  await page.waitForURL(url => url.hash === '#/game', { timeout: 15000 })
  await resolveArrival(page)
  const arrivalState = await page.evaluate(() => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    return {
      location: pinia._s.get('game')._currentLocation,
      sceneLocation: document.querySelector('.scene-location')?.innerText || '',
      body: document.querySelector('.scene-location-action')?.innerText?.slice(0, 100) || ''
    }
  })
  assert.equal(arrivalState.location, 'east_sea_port', '地点模式验收必须抵达东海港口')

  const exploreTitles = await completeMode(page, { id: 'local_exploration', button: '探索当地', label: '当地探索' })
  assert.equal(exploreTitles.length, 4)
  const explorationProgress = await page.evaluate(() => JSON.parse(localStorage.getItem('dldl_text_rpg_save'))._locationProgress.east_sea_port)
  assert.equal(explorationProgress.lastObjectiveType, 'local_exploration')

  await page.getByRole('button', { name: '接取当地委托' }).click()
  const commissionFirst = page.locator('.scene-event')
  await commissionFirst.waitFor()
  const commissionTitle = await commissionFirst.locator('.event-title').innerText()
  await commissionFirst.locator('.choice-btn:not([disabled])').first().click()
  await page.getByRole('button', { name: /继续前行/ }).click()
  const midSave = await page.evaluate(() => JSON.parse(localStorage.getItem('dldl_text_rpg_save')))
  assert.equal(midSave.locationExploration.active, true, '委托第一阶段后应保留活动状态')
  assert.equal(midSave.locationExploration.objectiveType, 'local_commission')
  assert.equal(midSave.locationExploration.stage, 1)
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.scene-location-action').waitFor({ timeout: 15000 })
  assert.match(await page.locator('.exploration-mode-copy').innerText(), /当地人的委托/)
  await page.getByRole('button', { name: /继续深入/ }).click()
  const commissionTitles = [commissionTitle]
  for (let stage = 1; stage < 4; stage += 1) {
    const event = page.locator('.scene-event')
    await event.waitFor()
    const title = await event.locator('.event-title').innerText()
    assert.match(await event.locator('.scene-location').innerText(), /东海港口/)
    assert.match(title, /当地委托/)
    commissionTitles.push(title)
    await event.locator('.choice-btn:not([disabled])').first().click()
    await page.getByRole('button', { name: /继续前行/ }).click()
  }
  await page.locator('.scene-location-action').waitFor()
  const commissionSave = await page.evaluate(() => JSON.parse(localStorage.getItem('dldl_text_rpg_save')))
  assert.equal(commissionSave.locationExploration.active, false)
  assert.equal(commissionSave.locationExploration.objectiveType, 'local_commission')
  assert.ok(commissionSave._locationProgress.east_sea_port.commissions >= 1)
  assert.notDeepEqual(commissionTitles, exploreTitles, '当地委托不得复用当地探索队列')

  const contactTitles = await completeMode(page, { id: 'local_contact', button: '拜访当地人物', label: '人物拜访' })
  assert.equal(contactTitles.length, 4)
  assert.ok(new Set(contactTitles).size >= 3, '人物拜访事件标题应有实际差异')
  const finalSave = await page.evaluate(() => JSON.parse(localStorage.getItem('dldl_text_rpg_save')))
  assert.equal(finalSave.locationExploration.objectiveType, 'local_contact')
  assert.equal(finalSave.locationExploration.active, false)
  assert.ok(finalSave._locationProgress.east_sea_port.contacts >= 1)
  assert.ok(finalSave._locationProgress.east_sea_port.relationships >= 1)
  const metrics = await assertPageLocked(page, '东海港口三种地点行动')
  assert.deepEqual(image404s, [], `图片 404：\n${image404s.join('\n')}`)
  assert.deepEqual(badResponses, [], `HTTP 4xx/5xx：\n${badResponses.join('\n')}`)
  assert.deepEqual(errors, [], `控制台/pageerror/网络失败：\n${errors.join('\n')}`)
  console.log(`Chrome 地点模式验收通过：探索 ${exploreTitles.length} 阶段；委托 ${commissionTitles.length} 阶段（刷新后恢复）；拜访 ${contactTitles.length} 阶段；scroll=${metrics.scrollHeight}/${metrics.clientHeight}；image404=0`)
  await context.close()
} finally {
  if (browser) await browser.close()
  await new Promise(resolve => server.close(resolve))
}
