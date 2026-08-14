import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { chromium } from 'playwright-core'

const require = createRequire(import.meta.url)
const { app } = require('../server.js')
const executablePath = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
].filter(Boolean).find(candidate => fs.existsSync(candidate))
if (!executablePath) throw new Error('未找到 Chrome；可通过 CHROME_PATH 指定浏览器路径')

const activeExploration = {
  locationId: 'shrek_academy',
  status: 'active',
  active: true,
  stage: 1,
  queuedEventIds: ['oral012-a', 'oral012-b', 'oral012-c', 'oral012-d'],
  sourceEventIds: [null, null, null, null],
  completedEventIds: ['oral012-a'],
  startedAtEventCount: 4,
  objectiveType: 'local_exploration',
  modeLabel: '当地探索',
  lastUpdatedAtEventCount: 4
}

function seedSave() {
  const rings = Array.from({ length: 8 }, (_, index) => ({ name: `测试魂环${index + 1}`, year: 100 }))
  return {
    playerId: 'browser-oral-012',
    name: '跨地点闭环验收',
    origin: 'border_town',
    originName: '边境小镇',
    spirit: { id: 'test_spirit', name: '昊天锤', type: '器武魂', subtype: '武器', tier: 'top' },
    level: 80,
    exp: 0,
    overflowExp: 0,
    hp: 9999,
    spiritPower: 9999,
    spiritPowerMax: 9999,
    gold: 20000,
    rings,
    skills: [],
    inventory: [],
    bonus: { attack: 5000, defense: 5000, hp: 5000, speed: 5000 },
    finished: false,
    createdAt: Date.now(),
    _currentLocation: 'shrek_academy',
    _visitedLocations: ['shrek_academy', 'tian_dou_city'],
    _prologueDone: true,
    _spiritAwakeningStoryDone: true,
    _earlyLifeDone: true,
    _registeredAtHall: true,
    _enrollmentComplete: true,
    _firstClassDone: true,
    _mainStoryVersion: 1,
    _eventCount: 4,
    _gameTime: 4,
    doneEvents: ['first_hunt'],
    completedEvents: ['first_hunt'],
    _recentEvents: [],
    _dynamicFlags: {},
    locationExplorationsByLocation: { shrek_academy: activeExploration },
    locationExploration: activeExploration,
    _locationProgress: {}
  }
}

const server = await new Promise((resolve, reject) => {
  const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  instance.once('error', reject)
})
const browser = await chromium.launch({ executablePath, headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
await context.addInitScript(save => {
  if (!localStorage.getItem('dldl_text_rpg_save')) {
    localStorage.setItem('dldl_text_rpg_save', JSON.stringify(save))
  }
  Math.random = () => 0.99
}, seedSave())
const page = await context.newPage()

try {
  const baseUrl = `http://127.0.0.1:${server.address().port}/`
  await page.goto(`${baseUrl}#/game`, { waitUntil: 'networkidle' })
  await page.locator('.scene-location-action').waitFor({ timeout: 15000 })

  await page.getByText('常用', { exact: true }).click()
  await page.getByRole('button', { name: '地图', exact: true }).click()
  await page.waitForURL(url => url.hash === '#/map')
  assert.equal(await page.locator('iframe[title="万象地图"]').count(), 0, '生产地图不应继续使用 iframe')
  const map = page
  const tianDou = map.locator('.location-marker[title="天斗城"]')
  await tianDou.waitFor({ state: 'visible', timeout: 15000 })
  await tianDou.locator('.marker-hitarea').click({ force: true })
  await map.locator('#panel-travel').click()

  await page.waitForURL(url => url.hash === '#/game', { timeout: 15000 })
  await page.locator('.scene-location-action').waitFor({ timeout: 15000 })
  const away = page.locator('[data-testid="exploration-away"]')
  assert.match(await away.innerText(), /史莱克学院.*当地探索/s, '跨地点提示必须说明原地点和行动模式')
  assert.equal(await page.getByRole('button', { name: '探索当地', exact: true }).isDisabled(), false, '当前地点的探索入口不得被跨地点队列禁用')
  assert.equal(await page.getByRole('button', { name: '接取当地委托', exact: true }).isDisabled(), false, '当前地点的委托入口不得被跨地点队列禁用')
  assert.equal(await page.getByRole('button', { name: '拜访当地人物', exact: true }).isDisabled(), false, '当前地点的人物入口不得被跨地点队列禁用')
  await page.screenshot({ path: 'C:\\Temp\\douluo-oral-012-013.png', fullPage: true })

  await page.getByRole('button', { name: '探索当地', exact: true }).click()
  await page.locator('.scene-event').waitFor({ timeout: 10000 })
  await page.locator('.scene-event .choice-btn:not([disabled])').first().click()
  await page.getByRole('button', { name: /继续前行/ }).click()
  await page.getByText('常用', { exact: true }).click()
  await page.getByRole('button', { name: '地图', exact: true }).click()
  await page.waitForURL(url => url.hash.startsWith('#/map'), { timeout: 15000 })
  await page.getByRole('button', { name: /返回游戏/ }).click()
  await page.waitForURL(url => url.hash === '#/game', { timeout: 15000 })
  await page.locator('.scene-location-action').waitFor({ timeout: 15000 })
  const dualSave = await page.evaluate(() => JSON.parse(localStorage.getItem('dldl_text_rpg_save')))
  assert.equal(dualSave.locationExplorationsByLocation.shrek_academy.status, 'suspended')
  assert.equal(dualSave.locationExplorationsByLocation.tian_dou_city.status, 'active')

  await page.locator('[data-testid="exploration-away"] .btn-action-link').filter({ hasText: '返回并继续' }).click()
  await page.waitForURL(url => url.hash.startsWith('#/map'), { timeout: 15000 })
  const focusedMap = page
  await focusedMap.locator('#detailPanel.open').waitFor({ timeout: 15000 })
  assert.equal(await focusedMap.locator('#panelTitle').innerText(), '史莱克学院', '返回并继续必须把地图定位到原地点')
  await focusedMap.locator('#panel-travel').click()
  await page.waitForURL(url => url.hash === '#/game', { timeout: 15000 })
  await page.locator('.scene-location-action').waitFor({ timeout: 15000 })
  assert.equal(await page.getByRole('button', { name: '继续深入', exact: true }).isVisible(), true, '返回原地点后应直接提供继续深入')

  const abandonSeed = await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('dldl_text_rpg_save'))
    save.locationExplorationsByLocation.tian_dou_city.status = 'suspended'
    save.locationExplorationsByLocation.tian_dou_city.active = false
    save.locationExplorationsByLocation.tian_dou_city.stage = 1
    save.locationExploration = save.locationExplorationsByLocation.tian_dou_city
    return save
  })
  await page.evaluate(save => localStorage.setItem('dldl_text_rpg_save', JSON.stringify(save)), abandonSeed)
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('[data-testid="exploration-away"]').waitFor({ timeout: 15000 })
  await page.locator('[data-testid="exploration-away"] .danger-link').filter({ hasText: '放弃上一轮并留在此处' }).click()
  const abandonDialog = page.locator('[data-testid="abandon-exploration-dialog"]')
  await abandonDialog.waitFor({ state: 'visible' })
  assert.match(await abandonDialog.innerText(), /当前进度：1\/4 阶段[\s\S]*最终奖励均不会结算/)
  await page.getByRole('button', { name: '保留进度', exact: true }).click()
  const retained = await page.evaluate(() => JSON.parse(localStorage.getItem('dldl_text_rpg_save')))
  assert.equal(retained.locationExplorationsByLocation.tian_dou_city.status, 'suspended', '取消放弃不得改写探索状态')
  await page.locator('[data-testid="exploration-away"] .danger-link').filter({ hasText: '放弃上一轮并留在此处' }).click()
  await abandonDialog.waitFor({ state: 'visible' })
  await page.locator('[data-testid="confirm-abandon-exploration"]').click()
  await page.waitForTimeout(120)
  const abandoned = await page.evaluate(() => JSON.parse(localStorage.getItem('dldl_text_rpg_save')))
  assert.equal(abandoned.locationExplorationsByLocation.tian_dou_city.status, 'abandoned')
  assert.equal(await page.locator('[data-testid="exploration-away"]').count(), 0, '放弃后不应继续显示跨地点未完成提示')
  console.log('Chrome BUG-ORAL-012/013 验收通过：跨地点提示、当前地点操作、返回定位继续和放弃闭环；地点行动暗金视觉截图已写入 C:\\Temp\\douluo-oral-012-013.png')
} finally {
  await context.close()
  await browser.close()
  await new Promise(resolve => server.close(resolve))
}
