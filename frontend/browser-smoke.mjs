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

let browser
try {
  const port = server.address().port
  const baseUrl = `http://127.0.0.1:${port}/`
  browser = await chromium.launch({ executablePath, headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const runtimeErrors = []

  // “只写一次”截图：目标文件已存在则跳过写入（绝不覆盖、删除、移动或重命名旧证据）。
  const screenshotOnce = async (pageOrLocator, filePath) => {
    if (fs.existsSync(filePath)) {
      console.log(`截图已存在，跳过写入（只写一次保护）: ${path.basename(filePath)}`)
      return false
    }
    await pageOrLocator.screenshot({ path: filePath, fullPage: false })
    console.log(`截图已保存: ${path.basename(filePath)}`)
    return true
  }

  const assertViewportLocked = async (targetPage, label) => {
    const metrics = await targetPage.evaluate(() => ({
      scrollHeight: document.scrollingElement.scrollHeight,
      clientHeight: document.scrollingElement.clientHeight,
      scrollWidth: document.scrollingElement.scrollWidth,
      clientWidth: document.scrollingElement.clientWidth,
      bodyOverflow: getComputedStyle(document.body).overflow
    }))
    assert.ok(metrics.scrollHeight <= metrics.clientHeight + 1,
      `${label}: 页面不得纵向滚动（${metrics.scrollHeight}/${metrics.clientHeight}）`)
    assert.ok(metrics.scrollWidth <= metrics.clientWidth + 1,
      `${label}: 页面不得横向滚动（${metrics.scrollWidth}/${metrics.clientWidth}）`)
    assert.equal(metrics.bodyOverflow, 'hidden', `${label}: body 应锁定为 overflow:hidden`)
  }

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

  // 云端写入在此测试中使用内存响应，既覆盖认证/保存调用，也不生成仓库数据文件。
  await page.route('**/api/player/auth', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, token: 'browser-smoke-token', expiresIn: 3600000 })
  }))
  await page.route('**/api/player/save', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, version: 1, lastSave: new Date().toISOString() })
  }))

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await assertViewportLocked(page, '标题页')
  await page.getByRole('button', { name: /新的旅程/ }).click()
  await page.waitForURL(url => url.hash === '#/create')
  await assertViewportLocked(page, '创建页')

  await page.getByLabel('魂师名字').fill('浏览验收')
  await page.getByRole('button', { name: /下一步/ }).click()
  await page.locator('.origin-card').first().click()
  await page.getByRole('button', { name: /进行武魂觉醒/ }).click()
  await page.getByRole('button', { name: /开始觉醒/ }).click()
  const confirmSpirit = page.getByRole('button', { name: /就是它了/ })
  await confirmSpirit.waitFor({ state: 'visible' })
  await confirmSpirit.click()

  await page.waitForURL(url => url.hash === '#/game')
  await page.locator('.event-title').filter({ hasText: '序章' }).waitFor()
  await assertViewportLocked(page, '游戏页')
  assert.match(await page.locator('body').innerText(), /浏览验收/, '游戏状态面板应显示新角色名')

  // ============ BUG-DIALOG-001：剧情区流体铺宽布局验收 ============
  const screenshotsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'local', 'bug-dialog-001')
  fs.mkdirSync(screenshotsDir, { recursive: true })

  const layoutViewports = [
    { width: 1920, height: 1080 },
    { width: 1440, height: 1000 },
    { width: 1024, height: 768 },
    { width: 768, height: 900 },
    { width: 390, height: 844 }
  ]
  const eventWidths = new Map()
  const layoutRows = []
  const settleLayout = async () => {
    await page.mouse.move(0, 0)
    await page.evaluate(() => new Promise(resolve => {
      const sceneEvent = document.querySelector('.scene-event')
      if (!sceneEvent) return resolve()
      const t0 = performance.now()
      let last = sceneEvent.getBoundingClientRect().width
      const check = () => {
        const w = sceneEvent.getBoundingClientRect().width
        if (Math.abs(w - last) < 0.5 || performance.now() - t0 > 1500) resolve()
        else { last = w; requestAnimationFrame(check) }
      }
      requestAnimationFrame(check)
    }))
    await page.waitForTimeout(300)
  }
  for (const vp of layoutViewports) {
    await page.setViewportSize(vp)
    await settleLayout()
    const metrics = await page.evaluate(() => {
      const mainArea = document.querySelector('.main-area')
      const sceneArea = document.querySelector('.scene-area')
      const sceneEvent = document.querySelector('.scene-event')
      if (!mainArea || !sceneArea || !sceneEvent) return null
      const mainRect = mainArea.getBoundingClientRect()
      const sceneRect = sceneArea.getBoundingClientRect()
      const eventRect = sceneEvent.getBoundingClientRect()
      const sceneStyle = getComputedStyle(sceneArea)
      const contentWidth = sceneRect.width - parseFloat(sceneStyle.paddingLeft) - parseFloat(sceneStyle.paddingRight)
      const choices = [...sceneEvent.querySelectorAll('.choice-btn')]
      const inside = el => {
        if (!el) return false
        const r = el.getBoundingClientRect()
        return r.left >= eventRect.left - 2 && r.right <= eventRect.right + 2
      }
      const vertical = choices.every((btn, i) => {
        const r = btn.getBoundingClientRect()
        const prev = choices[i - 1]?.getBoundingClientRect()
        return i === 0 || (Math.abs(r.left - prev.left) < 2 && r.top > prev.top)
      })
      const img = sceneEvent.querySelector('img.scene-img')
      const imgInfo = img && img.complete && img.naturalWidth > 0
        ? (() => {
            const r = img.getBoundingClientRect()
            const cs = getComputedStyle(img)
            return {
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
              width: r.width,
              height: r.height,
              objectFit: cs.objectFit
            }
          })()
        : null
      return {
        innerWidth: window.innerWidth,
        mainWidth: mainRect.width,
        sceneWidth: sceneRect.width,
        eventWidth: eventRect.width,
        eventPctOfMain: mainRect.width ? (eventRect.width / mainRect.width) * 100 : 0,
        fillPctOfContent: contentWidth ? (eventRect.width / contentWidth) * 100 : 0,
        leftGap: eventRect.left - sceneRect.left,
        rightGap: sceneRect.right - eventRect.right,
        scrollWidth: document.body.scrollWidth,
        titleInside: inside(sceneEvent.querySelector('.event-title')),
        textInside: inside(sceneEvent.querySelector('.event-text')),
        choicesInside: choices.length > 0 && choices.every(btn => inside(btn)),
        vertical,
        choiceCount: choices.length,
        enabledChoices: choices.filter(btn => !btn.disabled).length,
        img: imgInfo
      }
    })
    assert.ok(metrics, `viewport ${vp.width}: 应处于事件状态并可测量`)
    assert.equal(metrics.innerWidth, vp.width, `viewport ${vp.width}: 视口宽度应生效`)
    if (vp.width === 1920) {
      assert.ok(metrics.eventPctOfMain >= 82 && metrics.eventPctOfMain <= 88,
        `viewport 1920: 剧情容器应占主区域 82%～88%，实际 ${metrics.eventPctOfMain.toFixed(2)}%`)
    } else if (vp.width === 1440) {
      assert.ok(metrics.eventPctOfMain >= 80 && metrics.eventPctOfMain <= 88,
        `viewport 1440: 剧情容器应占主区域 80%～88%，实际 ${metrics.eventPctOfMain.toFixed(2)}%`)
    } else if (vp.width === 1024) {
      assert.ok(metrics.fillPctOfContent >= 98,
        `viewport 1024: 剧情容器应基本占满场景内容区，实际 ${metrics.fillPctOfContent.toFixed(2)}%`)
      assert.ok(metrics.eventWidth >= 646,
        `viewport 1024: 剧情容器宽度不得明显窄于原 680px 实现，实际 ${metrics.eventWidth.toFixed(1)}px`)
    }
    assert.ok(Math.abs(metrics.leftGap - metrics.rightGap) <= 2,
      `viewport ${vp.width}: 左右留白应基本对称（差 ${(metrics.leftGap - metrics.rightGap).toFixed(1)}px）`)
    assert.ok(metrics.scrollWidth <= vp.width + 1,
      `viewport ${vp.width}: body.scrollWidth ${metrics.scrollWidth} 不得超出视口`)
    assert.ok(metrics.titleInside, `viewport ${vp.width}: 标题应在剧情容器内`)
    assert.ok(metrics.textInside, `viewport ${vp.width}: 正文应在剧情容器内`)
    assert.ok(metrics.choicesInside, `viewport ${vp.width}: 所有选项应在剧情容器内`)
    assert.ok(metrics.vertical, `viewport ${vp.width}: 选项应保持纵向排列`)
    assert.ok(metrics.choiceCount >= 1 && metrics.enabledChoices >= 1,
      `viewport ${vp.width}: 至少有一个可点击选项`)
    if (vp.width === 1920) {
      assert.ok(metrics.img, 'viewport 1920: 序章事件图片应成功加载（自然尺寸非零）')
      assert.equal(metrics.img.objectFit, 'cover', '图片必须保持 object-fit: cover（裁剪而非拉伸）')
      assert.ok(metrics.img.width >= metrics.eventWidth * 0.99,
        `图片渲染宽度应跟随剧情容器（${metrics.img.width.toFixed(1)}px vs ${metrics.eventWidth.toFixed(1)}px）`)
      assert.ok(metrics.img.height > 0, '图片渲染高度应为正')
    }
    eventWidths.set(vp.width, metrics.eventWidth)
    layoutRows.push({ viewport: vp.width, ...metrics })
    if ([1920, 1440, 1024, 390].includes(vp.width)) {
      await screenshotOnce(page, path.join(screenshotsDir, `b-${vp.width}-event.png`))
    }
  }

  await page.setViewportSize({ width: 1440, height: 1000 })
  await settleLayout()

  // 结果状态：选择一个选项进入 .scene-continue，其宽度规则必须与 .scene-event 一致。
  await page.locator('.scene-event .choice-btn:not([disabled])').first().click()
  await page.locator('.scene-continue').waitFor()
  await page.setViewportSize({ width: 1920, height: 1080 })
  await settleLayout()
  const continueMetrics = await page.evaluate(() => {
    const mainArea = document.querySelector('.main-area')
    const sceneArea = document.querySelector('.scene-area')
    const cont = document.querySelector('.scene-continue')
    if (!cont) return null
    const contRect = cont.getBoundingClientRect()
    const sceneRect = sceneArea.getBoundingClientRect()
    const buttons = [...cont.querySelectorAll('.choice-btn')]
    return {
      width: contRect.width,
      pctOfMain: mainArea ? (contRect.width / mainArea.getBoundingClientRect().width) * 100 : 0,
      leftGap: contRect.left - sceneRect.left,
      rightGap: sceneRect.right - contRect.right,
      buttons: buttons.map(btn => ({ text: btn.textContent.trim().slice(0, 8), disabled: btn.disabled }))
    }
  })
  assert.ok(continueMetrics, '.scene-continue 应可见')
  assert.ok(Math.abs(continueMetrics.width - eventWidths.get(1920)) <= 2,
    `.scene-continue 宽度（${continueMetrics.width.toFixed(1)}px）应与 .scene-event（${eventWidths.get(1920).toFixed(1)}px）一致`)
  assert.ok(continueMetrics.buttons.some(b => b.text.includes('继续前行') && !b.disabled), '“继续前行”按钮应可用')
  assert.ok(continueMetrics.buttons.some(b => b.text.includes('地图') && !b.disabled), '地图按钮应可用')
  await screenshotOnce(page, path.join(screenshotsDir, 'b-1920-continue.png'))

  // 继续前行必须仍然推进事件流程。
  await page.getByRole('button', { name: /继续前行/ }).click()
  await page.locator('.scene-event .choice-btn:not([disabled])').first().click()
  await page.locator('.scene-continue').waitFor()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await settleLayout()
  const layoutSummary = layoutRows.map(r =>
    `${r.viewport}px event=${r.eventWidth.toFixed(0)}px (${r.eventPctOfMain.toFixed(1)}% of main) fill=${r.fillPctOfContent.toFixed(1)}%`
  ).join(' | ')
  console.log('BUG-DIALOG-001 layout: ' + layoutSummary)

  // 商店必须真实扣费、增添物品并立即持久化。
  await page.locator('summary').filter({ hasText: '常用' }).click()
  await page.getByRole('button', { name: '商店', exact: true }).click()
  await page.locator('.modal-title').filter({ hasText: '魂师商店' }).waitFor()
  await page.locator('.feature-shell .card.row .action').first().click()
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('dldl_text_rpg_save')
    if (!raw) return false
    const save = JSON.parse(raw)
    return save.gold === 70 && save.inventory?.find(item => item.name === '回魂丹')?.count === 3
  })
  await page.locator('.modal-footer button').click()

  // 刷新后仍从正式旧版键恢复，不能被云端或空 store 覆盖。
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForURL(url => url.hash === '#/game')
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('dldl_text_rpg_save')))
  assert.equal(restored.name, '浏览验收')
  assert.equal(restored.gold, 70)

  // Vue 原生地图必须直接接入路由与状态，不再经过旧 iframe 桥。
  const bg007Dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'local', 'bug-dialog-007')
  fs.mkdirSync(bg007Dir, { recursive: true })
  await page.locator('summary').filter({ hasText: '常用' }).click()
  await page.getByRole('button', { name: '地图', exact: true }).click()
  await page.waitForURL(url => url.hash === '#/map')
  await assertViewportLocked(page, '地图页')
  assert.equal(await page.locator('iframe[title="万象地图"]').count(), 0, '生产地图不得继续依赖 iframe')
  const mapFrame = page
  await mapFrame.locator('.location-marker.current').waitFor({ timeout: 10000 })
  assert.match(await mapFrame.locator('#mapStateTip').innerText(), /当前位置：[\s\S]+金币：70/)

  // BUG-DIALOG-009：实际打开秘境传闻，验证进度、下一步、不泄露内部键及移动端布局。
  const bg009Dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'local', 'bug-dialog-009')
  fs.mkdirSync(bg009Dir, { recursive: true })
  const rumorToggle = mapFrame.locator('#rumorToggle')
  await rumorToggle.waitFor({ state: 'visible' })
  assert.match(await rumorToggle.innerText(), /秘境传闻 0\/6/)
  await rumorToggle.click()
  const rumorPanel = mapFrame.locator('#rumorPanel.open')
  await rumorPanel.waitFor({ state: 'visible' })
  await page.waitForTimeout(280)
  const rumorText = await rumorPanel.innerText()
  assert.match(rumorText, /秘境传闻[\s\S]*已发现 0\/6[\s\S]*隐秘洞窟[\s\S]*魂力等级 Lv\.\d+ \/ Lv\.15[\s\S]*下一步/)
  assert.doesNotMatch(rumorText, /_stormAdventure|_bossKilled|dynamicFlags|canReveal/)
  assert.equal(await rumorPanel.locator('.rumor-card').count(), 6, '传闻账本应覆盖全部六个秘境')
  await screenshotOnce(page, path.join(bg009Dir, 'bg009-after-1440-hidden-clue-ledger.png'))
  await screenshotOnce(page, path.join(bg009Dir, 'bg009-after-1440-hidden-clue-ledger-open.png'))

  await page.setViewportSize({ width: 390, height: 844 })
  await settleLayout()
  const rumorMobile = await rumorPanel.evaluate(panel => ({
    panelScrollW: panel.scrollWidth,
    panelClientW: panel.clientWidth,
    pageScrollW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    pageClientW: document.documentElement.clientWidth,
    panelOverflowY: getComputedStyle(panel.querySelector('.rumor-list')).overflowY
  }))
  assert.ok(rumorMobile.panelScrollW <= rumorMobile.panelClientW + 1,
    `390px 传闻面板不得横向裁切（${rumorMobile.panelScrollW}/${rumorMobile.panelClientW}）`)
  assert.ok(rumorMobile.pageScrollW <= rumorMobile.pageClientW + 1,
    `390px 地图不得横向滚动（${rumorMobile.pageScrollW}/${rumorMobile.pageClientW}）`)
  assert.equal(rumorMobile.panelOverflowY, 'auto', '传闻列表应是唯一的面板纵向滚动区')
  await screenshotOnce(page, path.join(bg009Dir, 'bg009-after-390-hidden-clue-ledger.png'))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await mapFrame.locator('#rumorClose').click()
  await settleLayout()

  // 不只验证地图可见：实际选择一个相邻地点并完成旅行结算。
  const previousLocation = restored._currentLocation
  const adjacentMarker = mapFrame.locator('.location-marker.adjacent').first()
  await adjacentMarker.waitFor({ state: 'visible' })
  await adjacentMarker.locator('.marker-hitarea').click({ force: true })
  const travelButton = mapFrame.locator('#panel-travel')
  await travelButton.waitFor({ state: 'visible' })
  assert.equal(await travelButton.isDisabled(), false, '相邻地点应允许旅行')
  const destinationPlan = mapFrame.locator('[data-testid="destination-plan"]')
  await destinationPlan.waitFor({ state: 'visible' })
  const destinationPlanText = await destinationPlan.innerText()
  assert.match(destinationPlanText, /抵达后可做[\s\S]*首要目标[\s\S]*武魂适配[\s\S]*人物线索[\s\S]*区域评估/,
    '可前往地点应在出发前展示结构化抵达计划')
  assert.match(await travelButton.innerText(), /金币 · 约\d+天/, '旅行按钮应明确费用与实际路程')
  assert.match(await mapFrame.locator('.panel-route-meta').innerText(), /遭遇率约32%[\s\S]*抵达后会生成/,
    '首次探索应解释途中风险与抵达收益')
  await destinationPlan.scrollIntoViewIfNeeded()
  await screenshotOnce(page, path.join(bg007Dir, 'bg007-after-1440-destination-plan.png'))
  await travelButton.click()
  await page.waitForURL(url => url.hash === '#/game')
  await page.waitForFunction(oldLocation => {
    const raw = localStorage.getItem('dldl_text_rpg_save')
    if (!raw) return false
    const save = JSON.parse(raw)
    return save._currentLocation !== oldLocation && save.gold < 70
  }, previousLocation)
  await page.waitForFunction(() => sessionStorage.getItem('dldl_pending_travel') === null)
  const travelled = await page.evaluate(() => JSON.parse(localStorage.getItem('dldl_text_rpg_save')))
  assert.notEqual(travelled._currentLocation, previousLocation)
  assert.ok(travelled.gold < 70, '旅行应真实扣除金币')
  await page.waitForFunction(() => /抵达目标：|抵达后的首要目标/.test(document.body.innerText))
  const arrivalContextText = await page.locator('.scene-area').innerText()
  assert.match(arrivalContextText, /抵达目标：|抵达后的首要目标/,
    '无论是否发生途中遭遇，抵达页都应保留目的地行动目标')
  assert.match(arrivalContextText, /区域评估|区域评估为/,
    '抵达页应显示基于等级的区域评估')
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.fx-flash-overlay')).opacity) <= 0.01)
  await page.waitForTimeout(400)
  await screenshotOnce(page, path.join(bg007Dir, 'bg007-after-1440-arrival-context.png'))
  await screenshotOnce(page, path.join(bg007Dir, 'bg007-after-1440-arrival-context-readable.png'))
  await screenshotOnce(page, path.join(bg007Dir, 'bg007-after-1440-arrival-context-r2.png'))

  // 再次进入地图，确认旅行后的当前位置与余额已回写给 Vue 地图。
  await page.locator('summary').filter({ hasText: '常用' }).click()
  await page.getByRole('button', { name: '地图', exact: true }).click()
  await page.waitForURL(url => url.hash === '#/map')
  const returnedMapFrame = page
  await returnedMapFrame.locator('.location-marker.current').waitFor({ timeout: 10000 })
  assert.match(await returnedMapFrame.locator('#mapStateTip').innerText(), new RegExp(`金币：${travelled.gold}`))
  const knownMarkers = returnedMapFrame.locator('.location-marker:not(.current):not(.fogged)')
  let foundFastDestination = false
  for (let i = 0; i < await knownMarkers.count(); i += 1) {
    await knownMarkers.nth(i).click({ force: true })
    const candidateText = await returnedMapFrame.locator('#panel-travel').innerText()
    if (candidateText.includes('快速旅行')) {
      foundFastDestination = true
      break
    }
  }
  assert.equal(foundFastDestination, true, '旅行后应能选择一个已访问地点进行快速旅行')
  const fastButton = returnedMapFrame.locator('#panel-travel')
  await fastButton.waitFor({ state: 'visible' })
  assert.match(await fastButton.innerText(), /快速旅行至.+[\s\S]*\d+金币 · 约\d+天/,
    '重访地点应明确目的地、快速旅行费用和缩短后的路程')
  assert.match(await returnedMapFrame.locator('.panel-route-meta').innerText(), /压缩至约\d+天[\s\S]*遭遇率约8%/,
    '快速旅行必须说明可感知的时间与风险收益')
  await returnedMapFrame.locator('[data-testid="destination-plan"]').scrollIntoViewIfNeeded()
  await screenshotOnce(page, path.join(bg007Dir, 'bg007-after-1440-fast-travel-value.png'))
  await fastButton.scrollIntoViewIfNeeded()
  await screenshotOnce(page, path.join(bg007Dir, 'bg007-after-1440-fast-route.png'))

  await page.setViewportSize({ width: 390, height: 844 })
  await fastButton.scrollIntoViewIfNeeded()
  const bg007Mobile = await returnedMapFrame.locator('.detail-panel').evaluate(panel => ({
    panelScrollW: panel.scrollWidth,
    panelClientW: panel.clientWidth,
    bodyScrollW: document.body.scrollWidth,
    bodyClientW: document.documentElement.clientWidth
  }))
  assert.ok(bg007Mobile.panelScrollW <= bg007Mobile.panelClientW + 1,
    `390px 目的地详情不得横向裁切（${bg007Mobile.panelScrollW}/${bg007Mobile.panelClientW}）`)
  assert.ok(bg007Mobile.bodyScrollW <= bg007Mobile.bodyClientW + 1,
    `390px 地图不得横向滚动（${bg007Mobile.bodyScrollW}/${bg007Mobile.bodyClientW}）`)
  await screenshotOnce(page, path.join(bg007Dir, 'bg007-after-390-fast-route.png'))
  await page.setViewportSize({ width: 1440, height: 1000 })

  await page.getByRole('link', { name: /万象图鉴/ }).click()
  await page.waitForURL(url => url.hash === '#/codex')
  await assertViewportLocked(page, '图鉴页')
  await page.frameLocator('iframe[title="万象图鉴"]').locator('h1.main-title').waitFor()

  // 标题页继续冒险保留明确的本地入口，并可再次加载同一角色。
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '继续冒险', exact: true }).click()
  const localSave = page.locator('.save-item.local').filter({ hasText: '浏览验收' })
  await localSave.waitFor()
  await localSave.click()
  await page.waitForURL(url => url.hash === '#/game')
  assert.match(await page.locator('body').innerText(), /浏览验收/)

  // BUG-DIALOG-010：六条通知只能显示三条，其余排队；主事件坐标不得被浮层推动。
  const bg010Dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'local', 'bug-dialog-010')
  fs.mkdirSync(bg010Dir, { recursive: true })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(1200)
  const sceneTopBeforeNotices = await page.locator('.scene-area').evaluate(element => element.getBoundingClientRect().top)
  await page.evaluate(() => {
    const pinia = document.querySelector('#app').__vue_app__?.config?.globalProperties?.$pinia
    const ui = pinia?._s?.get('ui')
    if (!ui) throw new Error('无法取得 UI store 进行通知队列验收')
    ui.clearNotifications()
  for (let i = 1; i <= 6; i += 1) ui.notify(`队列验收通知 ${i}`, i === 1 ? 'gold' : 'info', 0)
  })
  await page.locator('.toast-item').first().waitFor()
  await page.waitForTimeout(350)
  assert.equal(await page.locator('.toast-item').count(), 3, '同时可见通知必须严格限制为三条')
  assert.match(await page.locator('.toast-queued').innerText(), /另有 3 条通知排队中/)
  const sceneTopWithNotices = await page.locator('.scene-area').evaluate(element => element.getBoundingClientRect().top)
  assert.ok(Math.abs(sceneTopWithNotices - sceneTopBeforeNotices) <= 1,
    `六条通知出现后主事件不得下移（${sceneTopBeforeNotices.toFixed(1)} -> ${sceneTopWithNotices.toFixed(1)}）`)
  await screenshotOnce(page, path.join(bg010Dir, 'bg010-after-1440-three-visible-three-queued.png'))
  await screenshotOnce(page, path.join(bg010Dir, 'bg010-after-1440-three-visible-three-queued-settled.png'))

  await page.locator('.toast-close').first().click()
  await page.waitForTimeout(350)
  assert.equal(await page.locator('.toast-item').count(), 3, '关闭一条后应立即从队列补位')
  assert.match((await page.locator('.toast-item').last().innerText()), /队列验收通知 4/)
  assert.match(await page.locator('.toast-queued').innerText(), /另有 2 条通知排队中/)

  await page.setViewportSize({ width: 390, height: 844 })
  await settleLayout()
  const bg010Mobile = await page.evaluate(() => ({
    pageScrollW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    pageClientW: document.documentElement.clientWidth,
    rail: (() => { const r = document.querySelector('.notification-rail').getBoundingClientRect(); return { left:r.left, right:r.right, width:r.width } })()
  }))
  assert.ok(bg010Mobile.pageScrollW <= bg010Mobile.pageClientW + 1,
    `390px 通知浮层不得造成横向滚动（${bg010Mobile.pageScrollW}/${bg010Mobile.pageClientW}）`)
  assert.ok(bg010Mobile.rail.left >= -1 && bg010Mobile.rail.right <= 391,
    `390px 通知浮层必须完整位于视口内（${JSON.stringify(bg010Mobile.rail)}）`)
  await screenshotOnce(page, path.join(bg010Dir, 'bg010-after-390-queue-overlay.png'))
  await page.evaluate(() => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui').clearNotifications())
  await page.setViewportSize({ width: 1440, height: 1000 })

  // BUG-004 回归：签到面板预览、实际发放与成功提示必须完全一致。
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('dldl_text_rpg_save')))
  await page.locator('summary').filter({ hasText: '常用' }).click()
  await page.getByRole('button', { name: '签到', exact: true }).click()
  await page.locator('.modal-title').filter({ hasText: '每日签到' }).waitFor()
  const panelText = await page.locator('.feature-shell').innerText()
  assert.match(panelText, /第1天 · 初见之礼/, '新角色签到面板应高亮第1天')
  assert.match(panelText, /金币\+100/, '面板应列出第1天奖励为金币+100')
  const baselineToasts = await page.locator('.toast-message').allInnerTexts()

  await page.getByRole('button', { name: '立即签到并领取' }).click()
  await page.waitForFunction(prevGold => {
    const raw = localStorage.getItem('dldl_text_rpg_save')
    if (!raw) return false
    return JSON.parse(raw).gold > prevGold
  }, before.gold)
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('dldl_text_rpg_save')))
  const newToasts = (await page.locator('.toast-message').allInnerTexts()).filter(text => !baselineToasts.includes(text))
  const claimToast = newToasts.find(text => text.includes('签到成功'))
  assert.ok(claimToast, '应有签到成功提示')
  assert.match(claimToast, /领取第1天奖励，金币\+100$/, '签到成功提示必须等于面板预览的第1天奖励')

  const sums = newToasts.reduce((acc, text) => {
    const gold = text.match(/金币\+(\d+)/)
    const exp = text.match(/经验\+(\d+)/)
    if (gold) acc.gold += Number(gold[1])
    if (exp) acc.exp += Number(exp[1])
    return acc
  }, { gold: 0, exp: 0 })
  assert.equal(after.gold - before.gold, sums.gold, '全部提示的金币之和必须等于实际到账')
  assert.equal(after.exp - before.exp, sums.exp, '全部提示的经验之和必须等于实际到账')
  assert.ok(after._dailySign, '签到状态必须持久化')
  const todayLocal = await page.evaluate(() => {
    const d = new Date()
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  })
  assert.equal(after._dailySign.lastDate, todayLocal)
  assert.equal(after._dailySign.cycleDay, 1)
  assert.equal(after._dailySign.totalDays, 1)

  const signedButton = page.getByRole('button', { name: '今日已签到' })
  await signedButton.waitFor()
  assert.equal(await signedButton.isDisabled(), true, '签到后按钮必须禁用')
  await page.locator('.modal-footer button').click()

  // 刷新恢复：签到状态保留，且不能重复领取。
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForURL(url => url.hash === '#/game')
  await page.locator('summary').filter({ hasText: '常用' }).click()
  await page.getByRole('button', { name: '签到', exact: true }).click()
  await page.locator('.modal-title').filter({ hasText: '每日签到' }).waitFor()
  const reopened = await page.locator('.feature-shell').innerText()
  assert.match(reopened, /累计 1 天/, '刷新后应恢复累计签到天数')
  assert.match(reopened, /今日已签到/, '刷新后应保持今日已签到')
  const afterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('dldl_text_rpg_save')))
  assert.equal(afterReload.gold, after.gold, '刷新后不得重复领取金币')
  assert.equal(afterReload._dailySign.totalDays, 1)

  // ============ BUG-DIALOG-002：武魂觉醒页双侧轮播、中心魂印与图片加载验收 ============
  const bg002Dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'local', 'bug-dialog-002')
  fs.mkdirSync(bg002Dir, { recursive: true })

  const spiritRequestUrls = []
  page.on('request', request => {
    if (request.url().includes('/assets/spirits/')) spiritRequestUrls.push(request.url())
  })
  const distinctSpiritRequests = () => new Set(spiritRequestUrls).size

  const stableSlotIds = () => page.evaluate(() =>
    [...document.querySelectorAll('.carousel-group')].map(group =>
      [...group.querySelectorAll('img.carousel-slot')]
        .filter(img => !img.classList.contains('cshift-leave-active'))
        .map(img => img.dataset.spiritId)))

  const assertNoIntersection = (sides, label) => {
    assert.equal(sides.length, 2, `${label}: 应返回左右两组，实际 ${sides.length}`)
    for (const ids of sides) assert.equal(ids.length, 3, `${label}: 每侧应恰好 3 槽，实际 ${ids.join(',')}`)
    const left = new Set(sides[0])
    const right = new Set(sides[1])
    const inter = [...left].filter(id => right.has(id))
    assert.equal(inter.length, 0,
      `${label}: 左右窗口不得相交，交集 [${inter.join(',')}]（左 ${sides[0].join(',')} / 右 ${sides[1].join(',')}）`)
  }

  const waitQuietCarousel = () => page.waitForFunction(() => {
    const stepEl = document.querySelector('.create-step')
    if (!stepEl) return false
    const stepTransform = getComputedStyle(stepEl).transform
    if (stepTransform !== 'none' && stepTransform !== '') return false
    const groups = [...document.querySelectorAll('.carousel-group')]
    if (!groups.length) return false
    return groups.every(group =>
      [...group.querySelectorAll('img.carousel-slot')].filter(img =>
        img.classList.contains('cshift-leave-active') || img.classList.contains('cshift-enter-active')).length === 0)
  }, null, { timeout: 8000 })

  const awakenMetrics = () => page.evaluate(() => {
    const disc = document.querySelector('.awaken-img-wrap')
    const sealSvg = disc?.querySelector('.awaken-seal svg')
    const dr = disc ? disc.getBoundingClientRect() : null
    const discCx = dr ? dr.left + dr.width / 2 : -1
    let glyphErr = -1
    if (sealSvg) {
      const sr = sealSvg.getBoundingClientRect()
      const vb = sealSvg.viewBox.baseVal
      const bbox = sealSvg.getBBox()
      const scaleX = vb.width ? sr.width / vb.width : 0
      const glyphCx = sr.left + (bbox.x + bbox.width / 2) * scaleX
      glyphErr = Math.abs(glyphCx - discCx)
    }
    return {
      innerWidth: window.innerWidth,
      discCenterErr: dr ? Math.abs(discCx - window.innerWidth / 2) : -1,
      glyphErr,
      groups: [...document.querySelectorAll('.carousel-group')].map(group => {
        const slots = [...group.querySelectorAll('img.carousel-slot')]
        return {
          visible: getComputedStyle(group).display !== 'none' && !!group.getClientRects().length,
          stableCount: slots.filter(img => !img.classList.contains('cshift-leave-active')).length,
          tiers: slots.map(img => img.dataset.tier),
          pointerEvents: getComputedStyle(group).pointerEvents
        }
      }),
      scrollWidth: document.body.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }
  })

  const assertCarouselGroups = (metrics, viewport) => {
    assert.ok(metrics.discCenterErr >= 0 && metrics.discCenterErr <= 2,
      `${viewport}: 中央圆盘中心与视口水平中心误差应 ≤2px，实际 ${metrics.discCenterErr.toFixed(2)}px`)
    assert.ok(metrics.glyphErr >= 0 && metrics.glyphErr <= 2,
      `${viewport}: SVG 魂印中心与圆盘中心误差应 ≤2px，实际 ${metrics.glyphErr.toFixed(2)}px`)
    assert.equal(metrics.groups.length, 2, `${viewport}: 应存在左右两个轮播组`)
    for (const [index, group] of metrics.groups.entries()) {
      assert.ok(group.visible, `${viewport}: 轮播组 ${index} 应可见`)
      assert.equal(group.stableCount, 3, `${viewport}: 轮播组 ${index} 应恰好三个可见槽位`)
      assert.ok(group.tiers.every(t => t === 'top' || t === 'god'),
        `${viewport}: 轮播组 ${index} 全部素材应来自 top/god，实际 ${group.tiers.join(',')}`)
      assert.equal(group.pointerEvents, 'none', `${viewport}: 轮播组 ${index} 必须不可点击`)
    }
    assert.ok(metrics.scrollWidth <= metrics.clientWidth + 1,
      `${viewport}: scrollWidth ${metrics.scrollWidth} 不得超出视口 ${metrics.clientWidth}`)
  }

  const spiritBaseline = distinctSpiritRequests()
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /新的旅程/ }).click()
  await page.waitForURL(url => url.hash === '#/create')
  await page.getByLabel('魂师名字').fill('轮播验收')
  await page.getByRole('button', { name: /下一步/ }).click()
  await page.locator('.origin-card').first().click()
  await page.getByRole('button', { name: /进行武魂觉醒/ }).click()
  await page.locator('.carousel-group').first().waitFor({ state: 'visible' })
  await waitQuietCarousel()

  // 图片加载性能：只加载当前可见 6 张 + 左右下一张（不得拉全量素材池）
  const newSpiritRequests = distinctSpiritRequests() - spiritBaseline
  assert.ok(newSpiritRequests >= 6 && newSpiritRequests <= 8,
    `觉醒页初始应只请求约 6+2 张武魂图，实际新增 ${newSpiritRequests} 张`)
  assert.ok(distinctSpiritRequests() < 28, '不得请求全部顶级/神级素材池图片')

  const m1920 = await awakenMetrics()
  assertCarouselGroups(m1920, '1920')
  await screenshotOnce(page, path.join(bg002Dir, 'bg002-1920-carousel.png'))

  // 1440px 下同样可见且保持居中
  await page.setViewportSize({ width: 1440, height: 1000 })
  await waitQuietCarousel()
  const m1440 = await awakenMetrics()
  assertCarouselGroups(m1440, '1440')
  await screenshotOnce(page, path.join(bg002Dir, 'bg002-1440-carousel.png'))

  // 轮换行为：等一个周期至少一侧变化；再等一个错峰周期另一侧变化；左右不齐变
  await page.setViewportSize({ width: 1920, height: 1080 })
  await waitQuietCarousel()
  const initialIds = await stableSlotIds()
  assert.equal(initialIds.length, 2, '轮播应分为左右两组')
  assertNoIntersection(initialIds, '1920 初始')
  await page.waitForFunction(prev => {
    const cur = [...document.querySelectorAll('.carousel-group')].map(group =>
      [...group.querySelectorAll('img.carousel-slot')]
        .filter(img => !img.classList.contains('cshift-leave-active'))
        .map(img => img.dataset.spiritId))
    return JSON.stringify(cur) !== JSON.stringify(prev)
  }, initialIds, { timeout: 6000 })
  await waitQuietCarousel()
  const s1 = await stableSlotIds()
  assertNoIntersection(s1, '首次轮换后')
  await page.waitForTimeout(3600)
  await waitQuietCarousel()
  const s2 = await stableSlotIds()
  assertNoIntersection(s2, '第二次轮换后')
  const changedOnce = s2.map((ids, i) => ids.join() !== s1[i].join())
  assert.equal(changedOnce.filter(Boolean).length, 1,
    `一个轮换周期内应只有一侧变化（错峰），实际 ${changedOnce.join(',')}`)
  await page.waitForTimeout(3600)
  await waitQuietCarousel()
  const s3 = await stableSlotIds()
  assertNoIntersection(s3, '第三次轮换后')
  const changedTwice = s3.map((ids, i) => ids.join() !== s2[i].join())
  assert.equal(changedTwice.filter(Boolean).length, 1,
    `再等一个错峰周期应轮到另一侧变化，实际 ${changedTwice.join(',')}`)
  assert.notEqual(changedOnce[0], changedTwice[0], '左右两侧必须交替轮换')
  await screenshotOnce(page, path.join(bg002Dir, 'bg002-1920-after-rotate.png'))

  // 真实觉醒结果出现后：轮播停止且两侧淡出
  await page.getByRole('button', { name: /开始觉醒/ }).click()
  await page.getByRole('button', { name: /就是它了/ }).waitFor({ state: 'visible' })
  await page.waitForTimeout(1500)
  const revealedMetrics = await page.evaluate(() => ({
    opacities: [...document.querySelectorAll('.carousel-group')].map(group => parseFloat(getComputedStyle(group).opacity))
  }))
  assert.ok(revealedMetrics.opacities.every(o => o >= 0.12 && o <= 0.32),
    `结果出现后两侧应淡出到约 15%~25%，实际 ${revealedMetrics.opacities.join(',')}`)
  const revealedIds = await stableSlotIds()
  assertNoIntersection(revealedIds, '觉醒结果出现后')
  await page.waitForTimeout(5000)
  assert.deepEqual(await stableSlotIds(), revealedIds, '结果出现后轮播必须停止')
  await screenshotOnce(page, path.join(bg002Dir, 'bg002-1920-revealed.png'))

  // 重新觉醒：不得叠加计时器或加速；结果再次出现后必须再次停止
  await page.getByRole('button', { name: /重新觉醒/ }).click()
  await page.getByRole('button', { name: /就是它了/ }).waitFor({ state: 'visible', timeout: 5000 })
  await page.waitForTimeout(1200)
  const reawakenIds = await stableSlotIds()
  assertNoIntersection(reawakenIds, '重新觉醒结果出现后')
  await page.waitForTimeout(5000)
  assert.deepEqual(await stableSlotIds(), reawakenIds, '重新觉醒后轮播必须再次随结果停止（无计时器叠加）')

  // 重新选择出身 → 再次进入觉醒步骤：单套计时器节奏恢复
  await page.getByRole('button', { name: /重新选择出身/ }).click()
  await page.locator('.carousel-group').first().waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: /进行武魂觉醒/ }).click()
  await page.locator('.carousel-group').first().waitFor({ state: 'visible' })
  await waitQuietCarousel()
  const reentry1 = await stableSlotIds()
  assertNoIntersection(reentry1, '重新进入觉醒步骤初始（R2 修复点：长时间轮换后不重叠）')
  await page.waitForFunction(prev => {
    const cur = [...document.querySelectorAll('.carousel-group')].map(group =>
      [...group.querySelectorAll('img.carousel-slot')]
        .filter(img => !img.classList.contains('cshift-leave-active'))
        .map(img => img.dataset.spiritId))
    return JSON.stringify(cur) !== JSON.stringify(prev)
  }, reentry1, { timeout: 6000 })
  await waitQuietCarousel()
  const reentry2 = await stableSlotIds()
  assertNoIntersection(reentry2, '重新进入后首次轮换')
  await page.waitForTimeout(3600)
  await waitQuietCarousel()
  const reentry3 = await stableSlotIds()
  assertNoIntersection(reentry3, '重新进入后第二次轮换')
  const reentryChanged = reentry3.map((ids, i) => ids.join() !== reentry2[i].join())
  assert.equal(reentryChanged.filter(Boolean).length, 1,
    `重新进入觉醒步骤后轮播应以单套节奏恢复，实际 ${reentryChanged.join(',')}`)
  await screenshotOnce(page, path.join(bg002Dir, 'bg002-r2-1920-reentry.png'))
  console.log(`BUG-DIALOG-002 re-entry IDs: 左 ${reentry3[0].join('、')} | 右 ${reentry3[1].join('、')} | 交集 0`)

  // 窄视口：两侧轮播隐藏、无横向滚动、中央圆盘保持居中
  const narrowRows = []
  for (const vp of [{ width: 1024, height: 768 }, { width: 768, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(vp)
    await page.waitForTimeout(500)
    const metrics = await page.evaluate(() => {
      const disc = document.querySelector('.awaken-img-wrap')
      const dr = disc ? disc.getBoundingClientRect() : null
      return {
        innerWidth: window.innerWidth,
        groupVisible: [...document.querySelectorAll('.carousel-group')].map(group =>
          getComputedStyle(group).display !== 'none' && !!group.getClientRects().length),
        discVisible: !!dr && dr.width > 0,
        discCenterErr: dr ? Math.abs(dr.left + dr.width / 2 - window.innerWidth / 2) : -1,
        scrollWidth: document.body.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.scrollingElement.scrollHeight,
        clientHeight: document.scrollingElement.clientHeight,
        actionsInside: [...document.querySelectorAll('.create-actions .btn')].every(button => {
          const rect = button.getBoundingClientRect()
          return rect.top >= -1 && rect.bottom <= window.innerHeight + 1
        })
      }
    })
    assert.equal(metrics.groupVisible.filter(Boolean).length, 0, `${vp.width}px 下两侧轮播应隐藏`)
    assert.ok(metrics.discVisible, `${vp.width}px 下中央圆盘应可见`)
    assert.ok(metrics.discCenterErr <= 2, `${vp.width}px 下中央圆盘应保持居中，实际 ${metrics.discCenterErr.toFixed(2)}px`)
    assert.ok(metrics.scrollWidth <= metrics.clientWidth + 1,
      `${vp.width}px 下不得横向滚动：scrollWidth ${metrics.scrollWidth} vs clientWidth ${metrics.clientWidth}`)
    assert.ok(metrics.scrollHeight <= metrics.clientHeight + 1,
      `${vp.width}px 下页面本身不得纵向滚动：scrollHeight ${metrics.scrollHeight} vs clientHeight ${metrics.clientHeight}`)
    assert.ok(metrics.actionsInside, `${vp.width}px 下核心操作按钮应在首屏内`)
    narrowRows.push({ width: vp.width, ...metrics })
    if (vp.width === 1024) await screenshotOnce(page, path.join(bg002Dir, 'bg002-1024-hidden.png'))
    if (vp.width === 390) await screenshotOnce(page, path.join(bg002Dir, 'bg002-390-mobile.png'))
  }

  // 390×844 出身页：四个选项与底部操作必须同时落在首屏，文档本身不可滚动。
  await page.getByRole('button', { name: /重新选择出身/ }).click()
  await page.locator('.origin-card').first().waitFor({ state: 'visible' })
  const originViewport = await page.evaluate(() => {
    const elements = [...document.querySelectorAll('.origin-card, .create-actions .btn')]
    return {
      count: elements.length,
      allInside: elements.every(element => {
        const rect = element.getBoundingClientRect()
        return rect.top >= -1 && rect.bottom <= window.innerHeight + 1
      }),
      scrollHeight: document.scrollingElement.scrollHeight,
      clientHeight: document.scrollingElement.clientHeight
    }
  })
  assert.ok(originViewport.count >= 6, '移动端出身页应包含四张出身卡与两个操作按钮')
  assert.ok(originViewport.allInside, '390×844 下四张出身卡与操作按钮都应在首屏内')
  assert.ok(originViewport.scrollHeight <= originViewport.clientHeight + 1,
    `390×844 出身页文档不得纵向滚动：${originViewport.scrollHeight}/${originViewport.clientHeight}`)
  await screenshotOnce(page, path.join(bg002Dir, 'bg002-390-origin-fit.png'))
  await page.getByRole('button', { name: /进行武魂觉醒/ }).click()
  await page.setViewportSize({ width: 1920, height: 1080 })

  // prefers-reduced-motion：不启动轮播计时器；左右必须显示不同静态组合且不相交（R2 修复点）
  const rmContext = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' })
  const rmPage = await rmContext.newPage()
  const rmErrors = []
  rmPage.on('pageerror', error => rmErrors.push(`pageerror: ${error.message}`))
  rmPage.on('console', message => {
    if (message.type() === 'error') rmErrors.push(`console: ${message.text()}`)
  })
  await rmPage.goto(baseUrl, { waitUntil: 'networkidle' })
  await rmPage.getByRole('button', { name: /新的旅程/ }).click()
  await rmPage.waitForURL(url => url.hash === '#/create')
  await rmPage.getByLabel('魂师名字').fill('静观验收')
  await rmPage.getByRole('button', { name: /下一步/ }).click()
  await rmPage.locator('.origin-card').first().click()
  await rmPage.getByRole('button', { name: /进行武魂觉醒/ }).click()
  await rmPage.locator('.carousel-group').first().waitFor({ state: 'visible' })
  await rmPage.waitForTimeout(800)
  const rmSlotIds = () => rmPage.evaluate(() =>
    [...document.querySelectorAll('.carousel-group')].map(group =>
      [...group.querySelectorAll('img.carousel-slot')]
        .filter(img => !img.classList.contains('cshift-leave-active'))
        .map(img => img.dataset.spiritId)))
  const rmInitialIds = await rmSlotIds()
  assert.equal(rmInitialIds.length, 2, 'reduced-motion 下应存在左右两组轮播')
  for (const ids of rmInitialIds) assert.equal(ids.length, 3, `reduced-motion 下每侧应恰好 3 槽，实际 ${ids.join(',')}`)
  const rmLeftIds = rmInitialIds[0]
  const rmRightIds = rmInitialIds[1]
  const rmInter = [...new Set(rmLeftIds)].filter(id => rmRightIds.includes(id))
  assert.equal(rmInter.length, 0,
    `reduced-motion 左右不得重复：交集 [${rmInter.join(',')}]（左 ${rmLeftIds.join(',')} / 右 ${rmRightIds.join(',')}）`)
  assert.equal(new Set([...rmLeftIds, ...rmRightIds]).size, 6,
    `reduced-motion 六个槽位 ID 必须全部不同，实际 ${[...new Set([...rmLeftIds, ...rmRightIds])].length} 个不同`)
  console.log(`BUG-DIALOG-002 reduced-motion IDs: 左 ${rmLeftIds.join('、')} | 右 ${rmRightIds.join('、')} | 交集 ${rmInter.length}`)
  await rmPage.waitForTimeout(5200)
  assert.deepEqual(await rmSlotIds(), rmInitialIds, 'prefers-reduced-motion 下轮播必须保持静态（后台不得继续计时）')
  await screenshotOnce(rmPage, path.join(bg002Dir, 'bg002-r2-1920-reduced-motion.png'))
  assert.deepEqual(rmErrors, [], `reduced-motion 页面错误：\n${rmErrors.join('\n')}`)
  await rmContext.close()

  console.log(`BUG-DIALOG-002 metrics: 1920 discErr=${m1920.discCenterErr.toFixed(2)}px glyphErr=${m1920.glyphErr.toFixed(2)}px | 1440 discErr=${m1440.discCenterErr.toFixed(2)}px glyphErr=${m1440.glyphErr.toFixed(2)}px | narrow=${narrowRows.map(r => `${r.width}px scrollW=${r.scrollWidth}/${r.clientWidth}`).join(' | ')} | spiritRequests=${distinctSpiritRequests()}`)

  // ============ BUG-DIALOG-003：创建期神级保底按出身隔离验收 ============
  // 独立上下文，避免与既有验收共享存档/草稿；固定 Math.random（默认 0.5 → 中级非神级）
  // 只在浏览器测试环境注入，生产代码无任何固定随机数。
  const bg003Dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'local', 'bug-dialog-003')
  fs.mkdirSync(bg003Dir, { recursive: true })

  const PITY_KEY = 'dldl_create_spirit_pity_v1'
  const LEGACY_PITY_KEY = 'dldl_god_spirit_pity'

  const bg003Context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  const bg003Page = await bg003Context.newPage()
  const bg003Errors = []
  bg003Page.on('pageerror', error => bg003Errors.push(`pageerror: ${error.message}`))
  bg003Page.on('console', message => {
    if (message.type() === 'error') bg003Errors.push(`console: ${message.text()}`)
  })
  bg003Page.on('requestfailed', request => {
    const type = request.resourceType()
    if (['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(type)) {
      bg003Errors.push(`requestfailed: ${request.url()} (${request.failure()?.errorText || 'unknown'})`)
    }
  })
  bg003Page.on('response', response => {
    const type = response.request().resourceType()
    if (response.status() >= 400 && ['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(type)) {
      bg003Errors.push(`response ${response.status()}: ${response.url()}`)
    }
  })
  await bg003Page.route('**/api/player/auth', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, token: 'browser-smoke-token', expiresIn: 3600000 })
  }))
  await bg003Page.route('**/api/player/save', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, version: 1, lastSave: new Date().toISOString() })
  }))
  await bg003Page.addInitScript(() => {
    window.__smokeRandom = null
    Math.random = function () {
      if (Array.isArray(window.__smokeRandom) && window.__smokeRandom.length) return window.__smokeRandom.shift()
      return 0.5
    }
  })

  const bg003Storage = () => bg003Page.evaluate(() => ({ ...localStorage }))
  const bg003Click = async locator => {
    await bg003Page.mouse.move(0, 0)
    await locator.click()
  }
  const bg003ReadDraft = async () => {
    const raw = (await bg003Storage())[PITY_KEY]
    return raw ? JSON.parse(raw) : null
  }
  const bg003SeedDraft = counts => bg003Page.evaluate(({ key, counts }) => {
    localStorage.setItem(key, JSON.stringify({ version: 1, draftId: 'smoke-seed-' + Date.now().toString(36), counts, updatedAt: Date.now() }))
  }, { key: PITY_KEY, counts })
  const bg003FillName = async name => {
    await bg003Page.getByLabel('魂师名字').fill(name)
    await bg003Click(bg003Page.getByRole('button', { name: /下一步/ }))
  }
  const bg003Card = name => bg003Page.locator('.origin-card').filter({ hasText: name })
  const bg003AssertCardsHidePity = async label => {
    assert.equal(await bg003Page.locator('.origin-card .oc-pity').count(), 0, `${label}: 出身卡不得渲染保底计数节点`)
    for (const card of await bg003Page.locator('.origin-card').allInnerTexts()) {
      assert.doesNotMatch(card, /神级保底\s*\d+\/50/, `${label}: 出身卡文案不得出现神级保底计数`)
    }
  }
  const bg003AwakenText = () => bg003Page.locator('.awaken-left').innerText()
  const bg003WaitPity = text => bg003Page.waitForFunction(
    expected => {
      const el = document.querySelector('.awaken-left')
      return !!el && el.innerText.includes(expected)
    },
    text,
    { timeout: 8000 }
  )

  // R2 截图时序：.awaken-left 必须可见、含预期计数、opacity>=0.95、非零宽高
  // （.awaken-left.is-revealed 有 descReveal 0.8s/1s 延迟动画，仅查 innerText 会拍到不可见状态）。
  const bg003WaitStableAwaken = expectedText => bg003Page.waitForFunction(
    expected => {
      const el = document.querySelector('.awaken-left')
      if (!el) return false
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return false
      if (!el.innerText.includes(expected)) return false
      if (Number.parseFloat(getComputedStyle(el).opacity) < 0.95) return false
      return true
    },
    expectedText,
    { timeout: 10000 }
  )

  // 连续三个动画帧位置与透明度稳定（动画已结束），不修改任何 CSS/动画/DOM。
  const bg003AwakenFrameStable = () => bg003Page.evaluate(() => new Promise(resolve => {
    const el = document.querySelector('.awaken-left')
    const sample = () => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        x: r.x, y: r.y, w: r.width, h: r.height,
        opacity: Number.parseFloat(cs.opacity),
        transform: cs.transform
      }
    }
    let prev = null
    let stableRuns = 0
    const step = () => {
      const cur = sample()
      if (prev !== null) {
        const stable = Math.abs(cur.x - prev.x) < 0.5 && Math.abs(cur.y - prev.y) < 0.5 &&
          Math.abs(cur.w - prev.w) < 0.5 && Math.abs(cur.h - prev.h) < 0.5 &&
          Math.abs(cur.opacity - prev.opacity) < 0.02
        stableRuns = stable ? stableRuns + 1 : 0
        if (stableRuns >= 2) { resolve(true); return }
      }
      prev = cur
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }))

  // R2 截图时刻的实际渲染状态（DOM 级证据，供人工/图像复核对照）。
  const bg003AwakenCaptureState = () => bg003Page.evaluate(() => {
    const el = document.querySelector('.awaken-left')
    if (!el) return null
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      innerText: el.innerText,
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      opacity: cs.opacity
    }
  })
  const bg003Scroll = () => bg003Page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.body.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }))
  const bg003AssertNoHScroll = (m, label) => assert.ok(m.scrollWidth <= m.clientWidth + 1,
    `${label}: scrollWidth ${m.scrollWidth} 不得超出视口 ${m.clientWidth}`)
  const bg003Awaken = async () => {
    const reawaken = bg003Page.getByRole('button', { name: /重新觉醒/ })
    if (await reawaken.isVisible().catch(() => false)) await bg003Click(reawaken)
    else await bg003Click(bg003Page.getByRole('button', { name: /开始觉醒/ }))
  }
  let bg003AwakenClicks = 0
  const bg003AwakenOnce = async () => {
    await bg003Awaken()
    bg003AwakenClicks += 1
    await bg003Page.getByRole('button', { name: /就是它了/ }).waitFor({ state: 'visible', timeout: 5000 })
  }

  // ---------- 阶段 A：新的旅程 → 四出身 0/50；旧全局键 49 不迁移 ----------
  await bg003Page.goto(baseUrl, { waitUntil: 'networkidle' })
  await bg003Page.evaluate(key => localStorage.setItem(key, '49'), LEGACY_PITY_KEY)
  await bg003Click(bg003Page.getByRole('button', { name: /新的旅程/ }))
  await bg003Page.waitForURL(url => url.hash === '#/create')
  let draft = await bg003ReadDraft()
  assert.ok(draft, '新的旅程后应存在创建草稿')
  assert.equal(draft.version, 1)
  assert.ok(typeof draft.draftId === 'string' && draft.draftId.length > 0, '草稿应带唯一 draftId')
  assert.deepEqual(draft.counts, { star_forest: 0, spirit_city: 0, border_town: 0, sea_island: 0 },
    `新草稿四出身应全部为 0，实际 ${JSON.stringify(draft.counts)}`)
  assert.equal(await bg003Page.evaluate(key => localStorage.getItem(key), LEGACY_PITY_KEY), null,
    '旧全局键 dldl_god_spirit_pity=49 必须被删除且不得迁移')

  await bg003FillName('神级验收')
  await bg003AssertCardsHidePity('新旅程')

  // 出身选择步骤：五档视口无横向滚动；390 移动端截图
  for (const vp of [{ width: 1920, height: 1080 }, { width: 1440, height: 1000 }, { width: 1024, height: 768 }, { width: 768, height: 900 }, { width: 390, height: 844 }]) {
    await bg003Page.setViewportSize(vp)
    await bg003Page.waitForTimeout(350)
    const m = await bg003Scroll()
    assert.equal(m.innerWidth, vp.width, `viewport ${vp.width}: 视口宽度应生效`)
    bg003AssertNoHScroll(m, `出身选择 ${vp.width}px`)
  }
  await screenshotOnce(bg003Page, path.join(bg003Dir, 'bg003-b-390-origin-cards.png'))

  // ---------- 阶段 B：星斗小村连续非神级觉醒至 17/50 ----------
  await bg003Page.setViewportSize({ width: 1920, height: 1080 })
  await bg003Click(bg003Card('星斗小村'))
  await bg003Click(bg003Page.getByRole('button', { name: /进行武魂觉醒/ }))
  await bg003AwakenOnce()
  await bg003WaitPity('星斗小村神级保底：1 / 50')
  assert.match(await bg003AwakenText(), /星斗小村神级保底：1 \/ 50/, '首次觉醒后星斗小村应为 1/50')
  assert.notEqual((await bg003Page.locator('.awaken-tier').innerText()).trim(), '神级武魂',
    '固定随机数下觉醒结果必须稳定为非神级')
  for (let i = 0; i < 16; i++) {
    await bg003AwakenOnce()
  }
  await bg003WaitPity('星斗小村神级保底：17 / 50')
  assert.match(await bg003AwakenText(), /星斗小村神级保底：17 \/ 50/, '17 次非神级觉醒后星斗小村应为 17/50')
  draft = await bg003ReadDraft()
  assert.equal(draft.counts.star_forest, 17, '草稿中星斗小村计数应为 17')
  assert.equal(draft.counts.spirit_city, 0, '武魂城世家计数不得被星斗小村累计影响')

  // ---------- 阶段 C：切换出身 → 各自独立计数；截图 per-origin ----------
  await bg003Click(bg003Page.getByRole('button', { name: /重新选择出身/ }))
  await bg003AssertCardsHidePity('切换出身')
  await bg003Click(bg003Card('武魂城世家'))
  await bg003Click(bg003Page.getByRole('button', { name: /进行武魂觉醒/ }))
  await bg003AwakenOnce()
  await bg003WaitPity('武魂城世家神级保底：1 / 50')
  const cityAwakenText = await bg003AwakenText()
  assert.match(cityAwakenText, /武魂城世家神级保底：1 \/ 50/, '武魂城世家觉醒 1 次应显示 1/50')
  assert.match(cityAwakenText, /其他出身：星斗小村 17\/50/, '应显示其他出身星斗小村 17/50 保持不变')
  await screenshotOnce(bg003Page, path.join(bg003Dir, 'bg003-b-1920-per-origin.png'))
  // R2 证据：等待 descReveal 动画结束（opacity>=0.95 + 帧稳定）后再拍摄全新文件名截图
  await bg003WaitStableAwaken('武魂城世家神级保底：1 / 50')
  await bg003AwakenFrameStable()
  const r2PerOriginState = await bg003AwakenCaptureState()
  assert.ok(r2PerOriginState, 'R2 per-origin 截图前应能读取 .awaken-left 状态')
  assert.ok(r2PerOriginState.opacity >= 0.95 && r2PerOriginState.rect.w > 0 && r2PerOriginState.rect.h > 0,
    `R2 per-origin 截图前 .awaken-left 必须完全可见（opacity=${r2PerOriginState.opacity}，尺寸=${r2PerOriginState.rect.w}x${r2PerOriginState.rect.h}）`)
  assert.match(r2PerOriginState.innerText, /武魂城世家神级保底：1 \/ 50/, 'R2 per-origin 截图内容必须含 武魂城世家神级保底：1 / 50')
  assert.match(r2PerOriginState.innerText, /其他出身：星斗小村 17\/50/, 'R2 per-origin 截图内容必须含 其他出身：星斗小村 17/50')
  console.log(`BUG-DIALOG-003-R2 capture state (per-origin): opacity=${r2PerOriginState.opacity} rect=${r2PerOriginState.rect.w}x${r2PerOriginState.rect.h}@${r2PerOriginState.rect.x},${r2PerOriginState.rect.y} text=${JSON.stringify(r2PerOriginState.innerText)}`)
  await screenshotOnce(bg003Page, path.join(bg003Dir, 'bg003-r2-b-1920-per-origin.png'))
  draft = await bg003ReadDraft()
  assert.equal(draft.counts.spirit_city, 1)
  assert.equal(draft.counts.star_forest, 17, '切到武魂城世家觉醒不得影响星斗小村的 17')

  // 切回星斗小村：草稿与出身卡都恢复 17/50
  await bg003Click(bg003Page.getByRole('button', { name: /重新选择出身/ }))
  await bg003AssertCardsHidePity('切回出身选择')
  draft = await bg003ReadDraft()
  assert.deepEqual(draft.counts, { star_forest: 17, spirit_city: 1, border_town: 0, sea_island: 0 },
    `切换出身前后草稿计数应各自独立，实际 ${JSON.stringify(draft.counts)}`)

  // ---------- 阶段 D：刷新页面后两个出身计数分别保留 ----------
  await bg003Page.reload({ waitUntil: 'networkidle' })
  await bg003Page.waitForURL(url => url.hash === '#/create')
  await bg003FillName('神级验收')
  await bg003AssertCardsHidePity('刷新创建页')
  draft = await bg003ReadDraft()
  assert.deepEqual(draft.counts, { star_forest: 17, spirit_city: 1, border_town: 0, sea_island: 0 }, '刷新后草稿计数原样保留')
  await screenshotOnce(bg003Page, path.join(bg003Dir, 'bg003-b-1920-refresh.png'))

  // ---------- 阶段 E：返回标题页再点“新的旅程”→ 四出身全部归零 ----------
  await bg003Page.goto(baseUrl, { waitUntil: 'networkidle' })
  await bg003Click(bg003Page.getByRole('button', { name: /新的旅程/ }))
  await bg003Page.waitForURL(url => url.hash === '#/create')
  draft = await bg003ReadDraft()
  assert.deepEqual(draft.counts, { star_forest: 0, spirit_city: 0, border_town: 0, sea_island: 0 },
    `再次“新的旅程”后四出身应全部归零，实际 ${JSON.stringify(draft.counts)}`)
  await bg003FillName('神级验收')
  await bg003AssertCardsHidePity('再次开始新旅程')

  // ---------- 阶段 F：49→50 解锁；50 封顶；觉醒步五档视口无横向滚动 ----------
  await bg003SeedDraft({ star_forest: 48, spirit_city: 0, border_town: 0, sea_island: 0 })
  await bg003Page.reload({ waitUntil: 'networkidle' })
  await bg003Page.waitForURL(url => url.hash === '#/create')
  draft = await bg003ReadDraft()
  assert.equal(draft.counts.star_forest, 48, '预置 48/50 草稿应被读取')
  await bg003FillName('封顶验收')
  await bg003Click(bg003Card('星斗小村'))
  await bg003Click(bg003Page.getByRole('button', { name: /进行武魂觉醒/ }))
  await bg003AwakenOnce()
  await bg003WaitPity('星斗小村神级保底：49 / 50')
  assert.match(await bg003AwakenText(), /星斗小村神级保底：49 \/ 50/, '48→49 应正确累计')
  assert.equal(await bg003Page.getByRole('button', { name: /自选神级武魂/ }).isVisible().catch(() => false), false, '49/50 时自选神级按钮不得解锁')
  await bg003AwakenOnce()
  await bg003WaitPity('星斗小村神级保底：50 / 50')
  assert.match(await bg003AwakenText(), /星斗小村神级保底：50 \/ 50/, '49→50 应正确累计')
  await bg003Page.getByRole('button', { name: /自选神级武魂/ }).waitFor({ state: 'visible', timeout: 5000 })
  await screenshotOnce(bg003Page, path.join(bg003Dir, 'bg003-b-1920-limit-50.png'))
  // R2 证据：等待 descReveal 动画结束 + 解锁提示与自选按钮可见后再拍摄全新文件名截图
  await bg003WaitStableAwaken('星斗小村神级保底：50 / 50')
  await bg003AwakenFrameStable()
  await bg003Page.getByRole('button', { name: /自选神级武魂/ }).waitFor({ state: 'visible', timeout: 5000 })
  const r2LimitState = await bg003AwakenCaptureState()
  assert.ok(r2LimitState, 'R2 limit 截图前应能读取 .awaken-left 状态')
  assert.ok(r2LimitState.opacity >= 0.95 && r2LimitState.rect.w > 0 && r2LimitState.rect.h > 0,
    `R2 limit 截图前 .awaken-left 必须完全可见（opacity=${r2LimitState.opacity}，尺寸=${r2LimitState.rect.w}x${r2LimitState.rect.h}）`)
  assert.match(r2LimitState.innerText, /星斗小村神级保底：50 \/ 50/, 'R2 limit 截图内容必须含 星斗小村神级保底：50 / 50')
  assert.match(r2LimitState.innerText, /神级保底已解锁/, 'R2 limit 截图内容必须含 神级保底已解锁提示')
  assert.doesNotMatch(r2LimitState.innerText, /51 \/ 50/, 'R2 limit 截图内容不得出现 51/50')
  console.log(`BUG-DIALOG-003-R2 capture state (limit-50): opacity=${r2LimitState.opacity} rect=${r2LimitState.rect.w}x${r2LimitState.rect.h}@${r2LimitState.rect.x},${r2LimitState.rect.y} text=${JSON.stringify(r2LimitState.innerText)}`)
  await screenshotOnce(bg003Page, path.join(bg003Dir, 'bg003-r2-b-1920-limit-50.png'))
  await bg003AwakenOnce()
  await bg003WaitPity('星斗小村神级保底：50 / 50')
  assert.doesNotMatch(await bg003AwakenText(), /51 \/ 50/, '50 后继续非神级觉醒必须保持 50/50，绝不出现 51/50')
  draft = await bg003ReadDraft()
  assert.equal(draft.counts.star_forest, 50, '草稿中星斗小村计数应封顶在 50')

  // 觉醒步骤五档视口无横向滚动（当前已揭示 50/50 状态）
  for (const vp of [{ width: 1920, height: 1080 }, { width: 1440, height: 1000 }, { width: 1024, height: 768 }, { width: 768, height: 900 }, { width: 390, height: 844 }]) {
    await bg003Page.setViewportSize(vp)
    await bg003Page.waitForTimeout(350)
    const m = await bg003Scroll()
    assert.equal(m.innerWidth, vp.width, `viewport ${vp.width}: 视口宽度应生效`)
    bg003AssertNoHScroll(m, `觉醒步骤 ${vp.width}px`)
  }
  await bg003Page.setViewportSize({ width: 1920, height: 1080 })
  await bg003Page.waitForTimeout(300)

  // ---------- 阶段 G：自然神级 / 手动自选只清零当前出身 ----------
  // G1：先给武魂城世家累计 1/50
  await bg003Click(bg003Page.getByRole('button', { name: /重新选择出身/ }))
  await bg003AssertCardsHidePity('神级保底跨出身验证')
  await bg003Click(bg003Card('武魂城世家'))
  await bg003Click(bg003Page.getByRole('button', { name: /进行武魂觉醒/ }))
  await bg003AwakenOnce()
  await bg003WaitPity('武魂城世家神级保底：1 / 50')

  // G2：自然抽到神级 → 只清零星斗小村，武魂城世家 1/50 保持不变
  await bg003Click(bg003Page.getByRole('button', { name: /重新选择出身/ }))
  await bg003Click(bg003Card('星斗小村'))
  await bg003Click(bg003Page.getByRole('button', { name: /进行武魂觉醒/ }))
  await bg003Page.evaluate(() => { window.__smokeRandom = [0.995] })
  await bg003AwakenOnce()
  await bg003WaitPity('星斗小村神级保底：0 / 50')
  const godAwakenText = await bg003AwakenText()
  assert.match(godAwakenText, /星斗小村神级保底：0 \/ 50/, '自然神级后星斗小村应清零')
  assert.equal((await bg003Page.locator('.awaken-tier').innerText()).trim(), '神级武魂', '本次觉醒结果应为神级武魂')
  assert.match(godAwakenText, /其他出身：武魂城世家 1\/50/, '自然神级不得影响其他出身计数')
  draft = await bg003ReadDraft()
  assert.deepEqual(draft.counts, { star_forest: 0, spirit_city: 1, border_town: 0, sea_island: 0 },
    `自然神级只清零当前出身，实际 ${JSON.stringify(draft.counts)}`)

  // G3：手动自选神级 → 只清零武魂城世家，星斗小村 2/50 保持不变
  await bg003SeedDraft({ star_forest: 2, spirit_city: 49, border_town: 0, sea_island: 0 })
  await bg003Page.reload({ waitUntil: 'networkidle' })
  await bg003Page.waitForURL(url => url.hash === '#/create')
  await bg003FillName('自选验收')
  await bg003Click(bg003Card('武魂城世家'))
  await bg003Click(bg003Page.getByRole('button', { name: /进行武魂觉醒/ }))
  await bg003AwakenOnce()
  await bg003WaitPity('武魂城世家神级保底：50 / 50')
  await bg003Click(bg003Page.getByRole('button', { name: /自选神级武魂/ }))
  // BUG-DIALOG-004 方案C后：卡片点击只进入独立详情，选择发生在详情层“确认选择”按钮上；
  // 下方断言（自选后仅清当前出身）保持 BUG-DIALOG-003 原样，仅交互路径随新方案推进。
  await bg003Click(bg003Page.locator('.god-pick-card').first())
  await bg003Click(bg003Page.getByRole('button', { name: /确认选择/ }))
  await bg003WaitPity('武魂城世家神级保底：0 / 50')
  const pickedText = await bg003AwakenText()
  assert.match(pickedText, /武魂城世家神级保底：0 \/ 50/, '手动自选神级后武魂城世家应清零')
  assert.match(pickedText, /其他出身：星斗小村 2\/50/, '手动自选不得影响其他出身计数')
  draft = await bg003ReadDraft()
  assert.deepEqual(draft.counts, { star_forest: 2, spirit_city: 0, border_town: 0, sea_island: 0 },
    `手动自选神级只清零当前出身，实际 ${JSON.stringify(draft.counts)}`)

  // ---------- 阶段 H：确认角色成功落盘后清除创建草稿；正式存档不含保底表 ----------
  await bg003Click(bg003Page.getByRole('button', { name: /就是它了/ }))
  await bg003Page.waitForURL(url => url.hash === '#/game', { timeout: 15000 })
  await bg003Page.locator('.event-title').filter({ hasText: '序章' }).waitFor({ timeout: 15000 })
  const bg003FinalStorage = await bg003Storage()
  assert.equal(bg003FinalStorage[PITY_KEY], undefined, '角色确认成功并落盘后，创建草稿键必须被清除')
  assert.equal(bg003FinalStorage[LEGACY_PITY_KEY], undefined, '旧全局键保持删除状态')
  const bg003SaveRaw = bg003FinalStorage['dldl_text_rpg_save']
  assert.ok(bg003SaveRaw, '正式存档应已写入本地')
  const bg003Save = JSON.parse(bg003SaveRaw)
  assert.equal(bg003Save.name, '自选验收')
  const pityFieldLeaks = Object.keys(bg003Save).filter(k => /pity|spirit_pity/i.test(k))
  assert.deepEqual(pityFieldLeaks, [], `正式存档 JSON 不得包含创建期保底表，发现 ${pityFieldLeaks.join(',')}`)

  console.log(`BUG-DIALOG-003 metrics: UI觉醒次数=${bg003AwakenClicks} | 阶段计数: 新旅程全0 -> 星斗17/城1 -> 刷新保留17/1 -> 新旅程归零 -> 49->50解锁->50封顶 -> 自然神级清零星斗(城1不变) -> 手动自选清零城(星2不变) -> 确认后草稿清除 | 正式存档无保底字段`)

  assert.deepEqual(bg003Errors, [], `BUG-DIALOG-003 页面错误：\n${bg003Errors.join('\n')}`)
  await bg003Context.close()

  // ============ BUG-DIALOG-004：神级武魂独立详情 + 觉醒结果全文展示验收 ============
  const bg004Dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'local', 'bug-dialog-004')
  fs.mkdirSync(bg004Dir, { recursive: true })
  const bg004Codex = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/data/spirit-codex.json'), 'utf8'))
  const bg004GodBook = bg004Codex.spirits.find(s => s.id === '创世之书')
  const bg004Longest = bg004Codex.spirits.find(s => s.id === '邪眸白虎')
  const bg004DossierRows = []
  const bg004ResultRows = []

  const bg004Context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  const bg004Page = await bg004Context.newPage()
  const bg004Errors = []
  bg004Page.on('pageerror', error => bg004Errors.push(`pageerror: ${error.message}`))
  bg004Page.on('console', message => {
    if (message.type() === 'error') bg004Errors.push(`console: ${message.text()}`)
  })
  bg004Page.on('requestfailed', request => {
    const type = request.resourceType()
    if (['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(type)) {
      bg004Errors.push(`requestfailed: ${request.url()} (${request.failure()?.errorText || 'unknown'})`)
    }
  })
  bg004Page.on('response', response => {
    const type = response.request().resourceType()
    if (response.status() >= 400 && ['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(type)) {
      bg004Errors.push(`response ${response.status()}: ${response.url()}`)
    }
  })
  await bg004Page.route('**/api/player/auth', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, token: 'browser-smoke-token', expiresIn: 3600000 })
  }))
  await bg004Page.route('**/api/player/save', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, version: 1, lastSave: new Date().toISOString() })
  }))
  await bg004Page.addInitScript(() => {
    window.__smokeRandom = null
    Math.random = function () {
      if (Array.isArray(window.__smokeRandom) && window.__smokeRandom.length) return window.__smokeRandom.shift()
      return 0.5
    }
  })

  const bg004Storage = () => bg004Page.evaluate(() => ({ ...localStorage }))
  const bg004Click = async locator => {
    await bg004Page.mouse.move(0, 0)
    await locator.click()
  }
  const bg004ReadDraft = async () => {
    const raw = (await bg004Storage())[PITY_KEY]
    return raw ? JSON.parse(raw) : null
  }
  const bg004SeedDraft = counts => bg004Page.evaluate(({ key, counts }) => {
    localStorage.setItem(key, JSON.stringify({ version: 1, draftId: 'bg004-seed-' + Date.now().toString(36), counts, updatedAt: Date.now() }))
  }, { key: PITY_KEY, counts })
  const bg004FillName = async name => {
    await bg004Page.getByLabel('魂师名字').fill(name)
    await bg004Click(bg004Page.getByRole('button', { name: /下一步/ }))
  }
  const bg004Card = name => bg004Page.locator('.origin-card').filter({ hasText: name })
  const bg004FrameStable = selector => bg004Page.evaluate(sel => new Promise(resolve => {
    const el = document.querySelector(sel)
    if (!el) { resolve(false); return }
    const sample = () => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return { x: r.x, y: r.y, w: r.width, h: r.height, opacity: Number.parseFloat(cs.opacity) }
    }
    let prev = null
    let stableRuns = 0
    const step = () => {
      const cur = sample()
      if (prev !== null) {
        const stable = Math.abs(cur.x - prev.x) < 0.5 && Math.abs(cur.y - prev.y) < 0.5 &&
          Math.abs(cur.w - prev.w) < 0.5 && Math.abs(cur.h - prev.h) < 0.5 &&
          Math.abs(cur.opacity - prev.opacity) < 0.02
        stableRuns = stable ? stableRuns + 1 : 0
        if (stableRuns >= 2) { resolve(true); return }
      }
      prev = cur
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }), selector)

  // 结果页 .awaken-desc：正文完整出现、可见、无动画残留后再截图/测量。
  const bg004WaitStableResult = () => bg004Page.waitForFunction(() => {
    const el = document.querySelector('.awaken-desc')
    if (!el) return false
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return false
    if (![...el.querySelectorAll('.awaken-desc-p')].length) return false
    if (Number.parseFloat(getComputedStyle(el).opacity) < 0.95) return false
    return true
  }, null, { timeout: 10000 }).then(() => bg004FrameStable('.awaken-desc'))

  const bg004DescMetrics = () => bg004Page.evaluate(() => {
    const el = document.querySelector('.awaken-desc')
    if (!el) return null
    const cs = getComputedStyle(el)
    return {
      text: [...el.querySelectorAll('.awaken-desc-p')].map(p => p.textContent).join(''),
      paragraphCount: el.querySelectorAll('.awaken-desc-p').length,
      head: el.querySelector('.awaken-desc-head')?.textContent.trim() || '',
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      overflowY: cs.overflowY,
      maxHeight: cs.maxHeight
    }
  })

  // ---------- 阶段 A：预置 50/50 草稿，进入觉醒步骤 ----------
  await bg004Page.goto(baseUrl, { waitUntil: 'networkidle' })
  await bg004Click(bg004Page.getByRole('button', { name: /新的旅程/ }))
  await bg004Page.waitForURL(url => url.hash === '#/create')
  await bg004SeedDraft({ star_forest: 50, spirit_city: 7, border_town: 0, sea_island: 0 })
  await bg004Page.reload({ waitUntil: 'networkidle' })
  await bg004Page.waitForURL(url => url.hash === '#/create')
  await bg004FillName('详情验收')
  await bg004Click(bg004Card('星斗小村'))
  await bg004Click(bg004Page.getByRole('button', { name: /进行武魂觉醒/ }))
  await bg004Click(bg004Page.getByRole('button', { name: /开始觉醒/ }))
  await bg004Page.getByRole('button', { name: /就是它了/ }).waitFor({ state: 'visible', timeout: 5000 })
  await bg004Page.waitForFunction(() => {
    const el = document.querySelector('.awaken-left')
    return !!el && el.innerText.includes('星斗小村神级保底：50 / 50')
  }, null, { timeout: 8000 })
  const beforeName = (await bg004Page.locator('.awaken-name').innerText()).trim()
  assert.notEqual(beforeName, '创世之书', '预览前觉醒结果必须是其他武魂（用于证明查看详情不改变结果）')
  let bg004Draft = await bg004ReadDraft()
  assert.equal(bg004Draft.counts.star_forest, 50, '预置草稿当前出身应为 50/50')

  // ---------- 阶段 B：打开神级弹窗 → 12 种武魂列表 ----------
  await bg004Click(bg004Page.getByRole('button', { name: /自选神级武魂/ }))
  await bg004Page.locator('.god-picker-grid').waitFor({ state: 'visible' })
  assert.equal(await bg004Page.locator('.god-pick-card').count(), 12, '神级武魂列表应展示全部 12 种武魂')
  assert.equal(await bg004Page.locator('.god-dossier').count(), 0, '打开弹窗默认应为列表层')

  // ---------- 阶段 C：点击“创世之书”卡片 → 只进入独立详情，不选中、不清零 ----------
  await bg004Click(bg004Page.locator('.god-pick-card[data-spirit-id="创世之书"]'))
  await bg004Page.locator('.god-dossier').waitFor({ state: 'visible' })
  assert.equal(await bg004Page.locator('.modal-box').count(), 1, '详情预览时弹窗必须仍打开')
  assert.equal(await bg004Page.locator('.god-picker-grid').count(), 0, '进入详情后列表层应隐藏')
  assert.equal((await bg004Page.locator('.god-dossier-name').innerText()).trim(), '创世之书', '详情标题应为创世之书')
  const dossierText = await bg004Page.evaluate(() => [...document.querySelectorAll('.god-dossier-p')].map(p => p.textContent).join(''))
  assert.equal(dossierText, bg004GodBook.desc.trim(), '详情介绍必须与 spirit-codex.json 原文严格相等')
  assert.equal(dossierText.length, 198, '创世之书介绍长度应为 198')
  assert.equal((await bg004Page.locator('.awaken-name').innerText()).trim(), beforeName, '查看详情不得改变背后的觉醒结果')
  assert.match(await bg004Page.locator('.awaken-left').innerText(), /星斗小村神级保底：50 \/ 50/, '预览不得清零当前出身保底')
  bg004Draft = await bg004ReadDraft()
  assert.equal(bg004Draft.counts.star_forest, 50, '预览后草稿当前出身仍为 50/50')
  assert.equal(bg004Draft.counts.spirit_city, 7, '预览不得影响其他出身计数')

  // ---------- 阶段 D：1920 详情截图（等待渲染稳定、图片加载完成）----------
  await bg004Page.waitForFunction(() => {
    const img = document.querySelector('.god-dossier-image img')
    return !!img && img.complete && img.naturalWidth > 0
  }, null, { timeout: 10000 })
  await bg004FrameStable('.modal-box')
  await screenshotOnce(bg004Page, path.join(bg004Dir, 'bg004-c-1920-god-dossier.png'))

  // ---------- 阶段 E：详情层五档视口（无横向滚动、图片/按钮不溢出、单层滚动）----------
  const bg004Viewports = [
    { width: 1920, height: 1080 },
    { width: 1440, height: 1000 },
    { width: 1024, height: 768 },
    { width: 768, height: 900 },
    { width: 390, height: 844 }
  ]
  for (const vp of bg004Viewports) {
    await bg004Page.setViewportSize(vp)
    await bg004Page.waitForTimeout(350)
    const m = await bg004Page.evaluate(() => {
      const box = document.querySelector('.modal-box')
      const body = document.querySelector('.modal-body')
      const desc = document.querySelector('.god-dossier-desc')
      const img = document.querySelector('.god-dossier-image')
      const confirmBtn = document.querySelector('.god-dossier-confirm')
      if (!box || !body || !desc || !img || !confirmBtn) return null
      const br = box.getBoundingClientRect()
      const ir = img.getBoundingClientRect()
      const cr = confirmBtn.getBoundingClientRect()
      const scrollChain = []
      for (let el = desc; el; el = el.parentElement) {
        const oy = getComputedStyle(el).overflowY
        scrollChain.push({
          cls: typeof el.className === 'string' ? el.className.split(/\s+/)[0] || el.tagName.toLowerCase() : el.tagName.toLowerCase(),
          overflowY: oy,
          canScroll: (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1
        })
        if (el.classList && el.classList.contains('modal-box')) break
      }
      return {
        innerWidth: window.innerWidth,
        pageScrollW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        pageClientW: document.documentElement.clientWidth,
        modalWidth: br.width,
        modalScrollW: box.scrollWidth,
        modalClientW: box.clientWidth,
        modalBoxOverflowY: getComputedStyle(box).overflowY,
        modalBodyScrollW: body.scrollWidth,
        modalBodyClientW: body.clientWidth,
        bodyOverflowY: getComputedStyle(body).overflowY,
        descOverflowY: getComputedStyle(desc).overflowY,
        descScrollH: desc.scrollHeight,
        descClientH: desc.clientHeight,
        imgInside: ir.left >= br.left - 1 && ir.right <= br.right + 1,
        confirmInside: cr.left >= br.left - 1 && cr.right <= br.right + 1,
        scrollChain
      }
    })
    assert.ok(m, `viewport ${vp.width}: 详情层应可测量`)
    assert.equal(m.innerWidth, vp.width, `viewport ${vp.width}: 视口宽度应生效`)
    assert.ok(m.pageScrollW <= m.pageClientW + 1,
      `viewport ${vp.width}: 页面不得横向滚动（pageScrollW=${m.pageScrollW} vs pageClientW=${m.pageClientW}）`)
    assert.ok(m.modalWidth <= vp.width + 1, `viewport ${vp.width}: 弹窗宽度不得超出视口`)
    assert.ok(m.modalScrollW <= m.modalClientW + 1,
      `viewport ${vp.width}: 弹窗内部不得横向溢出（modalScrollW=${m.modalScrollW} vs modalClientW=${m.modalClientW}）`)
    assert.ok(m.modalBodyScrollW <= m.modalBodyClientW + 1,
      `viewport ${vp.width}: modal-body 内容不得横向溢出（modalBodyScrollW=${m.modalBodyScrollW} vs modalBodyClientW=${m.modalBodyClientW}）`)
    assert.ok(m.imgInside, `viewport ${vp.width}: 详情图片不得溢出弹窗`)
    assert.ok(m.confirmInside, `viewport ${vp.width}: 确认按钮不得横向溢出`)
    assert.equal(m.descOverflowY, 'visible', `viewport ${vp.width}: 详情正文区不得内部滚动`)
    assert.ok(m.descScrollH <= m.descClientH + 1, `viewport ${vp.width}: 详情正文不得裁切（${m.descScrollH} vs ${m.descClientH}）`)
    if (vp.width <= 768) {
      assert.ok(m.bodyOverflowY === 'auto' || m.bodyOverflowY === 'scroll',
        `viewport ${vp.width}: 窄屏只允许 modal-body 单层纵向滚动，实际 ${m.bodyOverflowY}`)
      assert.equal(m.modalBoxOverflowY, 'hidden',
        `viewport ${vp.width}: modal-box 为 overflow:hidden，不得被误判为可滚动容器`)
      const scrollables = m.scrollChain.filter(s => s.canScroll).map(s => s.cls)
      assert.deepEqual(scrollables.filter(s => s !== 'modal-body'), [],
        `viewport ${vp.width}: 详情内部除 modal-body 外不得有任何实际可纵向滚动容器（desc/正文容器禁止独立滚动），实际 ${JSON.stringify(scrollables)}`)
      if (scrollables.length > 0) {
        assert.deepEqual(scrollables, ['modal-body'],
          `viewport ${vp.width}: 详情内部实际纵向滚动时唯一滚动容器必须是 modal-body，实际 ${JSON.stringify(scrollables)}`)
      }
    }
    bg004DossierRows.push({ width: vp.width, ...m })
    if (vp.width === 390) {
      await bg004FrameStable('.modal-box')
      await screenshotOnce(bg004Page, path.join(bg004Dir, 'bg004-c-390-god-dossier.png'))
    }
  }
  await bg004Page.setViewportSize({ width: 1920, height: 1080 })
  await bg004Page.waitForTimeout(300)

  // ---------- 阶段 F：返回列表 → 焦点恢复到刚查看的卡片 ----------
  await bg004Click(bg004Page.getByRole('button', { name: /返回神级武魂列表/ }))
  await bg004Page.locator('.god-picker-grid').waitFor({ state: 'visible' })
  assert.equal(await bg004Page.locator('.god-dossier').count(), 0, '返回后应回到列表层')
  assert.equal(await bg004Page.locator('.modal-box').count(), 1, '返回后弹窗必须仍打开')
  const focusedCardId = await bg004Page.evaluate(() => document.activeElement?.getAttribute('data-spirit-id') || null)
  assert.equal(focusedCardId, '创世之书', '返回列表后焦点应恢复到刚查看的卡片')
  assert.equal((await bg004Page.locator('.awaken-name').innerText()).trim(), beforeName, '返回列表不得改变觉醒结果')

  // ---------- 阶段 G：关闭并重新打开 → 默认回到列表层 ----------
  await bg004Click(bg004Page.getByRole('button', { name: '关闭', exact: true }))
  await bg004Page.locator('.modal-box').waitFor({ state: 'hidden' })
  await bg004Click(bg004Page.getByRole('button', { name: /自选神级武魂/ }))
  await bg004Page.locator('.god-picker-grid').waitFor({ state: 'visible' })
  assert.equal(await bg004Page.locator('.god-dossier').count(), 0, '重新打开弹窗必须默认回到列表层')

  // ---------- 阶段 H：再次进入详情并点击“确认选择” → 既有选择逻辑生效 ----------
  await bg004Click(bg004Page.locator('.god-pick-card[data-spirit-id="创世之书"]'))
  await bg004Page.locator('.god-dossier').waitFor({ state: 'visible' })
  await bg004Click(bg004Page.getByRole('button', { name: /确认选择/ }))
  await bg004Page.locator('.modal-box').waitFor({ state: 'hidden' })
  await bg004Page.waitForFunction(() => (document.querySelector('.awaken-name')?.innerText || '').trim() === '创世之书',
    null, { timeout: 8000 })
  assert.equal((await bg004Page.locator('.awaken-name').innerText()).trim(), '创世之书', '确认选择后觉醒结果应为创世之书')
  await bg004Page.waitForFunction(() => {
    const el = document.querySelector('.awaken-left')
    return !!el && el.innerText.includes('星斗小村神级保底：0 / 50')
  }, null, { timeout: 8000 })
  const confirmedText = await bg004Page.locator('.awaken-left').innerText()
  assert.match(confirmedText, /星斗小村神级保底：0 \/ 50/, '确认神级后当前出身保底应清零')
  assert.match(confirmedText, /其他出身：武魂城世家 7\/50/, '确认神级不得影响其他出身保底')
  bg004Draft = await bg004ReadDraft()
  assert.deepEqual(bg004Draft.counts, { star_forest: 0, spirit_city: 7, border_town: 0, sea_island: 0 },
    `确认选择只清零当前出身，实际 ${JSON.stringify(bg004Draft.counts)}`)

  // ---------- BUG-DIALOG-008：满魂力结果必须明确换算为 Lv.10，且只解锁资格 ----------
  const bg008Dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'local', 'bug-dialog-008')
  fs.mkdirSync(bg008Dir, { recursive: true })
  const bg008StatsText = await bg004Page.locator('.awaken-stats').innerText()
  assert.match(bg008StatsText, /先天魂力\s*100（满魂力！）/,
    '神级自选结果应保持先天满魂力 100')
  assert.match(bg008StatsText, /起始等级\s*Lv\.10/,
    '先天满魂力必须在结果页明确换算为起始 Lv.10')
  const bg008ReadyText = await bg004Page.locator('.awaken-ring-ready').innerText()
  assert.match(bg008ReadyText, /第一魂环猎取资格已解锁[\s\S]*尚未获得魂环/,
    'Lv.10 只解锁第一魂环猎取资格，不得暗示已经获得魂环')
  await bg004WaitStableResult()
  await screenshotOnce(bg004Page, path.join(bg008Dir, 'bg008-after-1920-full-power-level-10.png'))

  // ---------- 阶段 I：结果页全文展示（创世之书 198 字）----------
  await bg004WaitStableResult()
  const r198 = await bg004DescMetrics()
  assert.ok(r198, '结果页应存在 .awaken-desc')
  assert.equal(r198.head, '武魂志 · 完整记载', '结果正文应带武魂志弱标题')
  assert.equal(r198.text, bg004GodBook.desc.trim(), '结果页正文必须与数据原文严格一致')
  assert.equal(r198.text.length, 198, '创世之书正文长度应为 198')
  assert.equal(r198.paragraphCount, 2, '创世之书应分段为两段且拼接等于原文')
  assert.ok(r198.scrollHeight <= r198.clientHeight + 1,
    `结果正文不得内部滚动（scrollHeight ${r198.scrollHeight} > clientHeight ${r198.clientHeight}）`)
  assert.ok(r198.overflowY !== 'auto' && r198.overflowY !== 'scroll',
    `.awaken-desc 不得 overflow-y auto/scroll，实际 ${r198.overflowY}`)
  assert.equal(await bg004Page.getByRole('button', { name: /重新觉醒/ }).isVisible(), true, '重新觉醒按钮应可见')
  assert.equal(await bg004Page.getByRole('button', { name: /就是它了/ }).isVisible(), true, '确认按钮应可见')
  assert.equal(await bg004Page.getByRole('button', { name: /就是它了/ }).isEnabled(), true, '确认按钮应可点击')
  await screenshotOnce(bg004Page, path.join(bg004Dir, 'bg004-b-1920-result-full.png'))
  await screenshotOnce(bg004Page, path.join(bg004Dir, 'oral-r3-1920-full-intro-actions.png'))

  // ---------- 阶段 J：最长介绍（邪眸白虎 201 字）结果页再验证 ----------
  await bg004Page.evaluate(() => { window.__smokeRandom = [0.94, 0.782] })
  await bg004Click(bg004Page.getByRole('button', { name: /重新觉醒/ }))
  await bg004Page.waitForFunction(() => (document.querySelector('.awaken-name')?.innerText || '').trim() === '邪眸白虎',
    null, { timeout: 8000 })
  await bg004WaitStableResult()
  const r201 = await bg004DescMetrics()
  assert.ok(r201, '最长介绍结果页应可测量')
  assert.equal(r201.text, bg004Longest.desc.trim(), '最长介绍必须与数据原文严格一致')
  assert.equal(r201.text.length, 201, '当前最长介绍长度应为 201')
  assert.equal(r201.paragraphCount, 2, '最长介绍应分段为两段且拼接等于原文')
  assert.ok(r201.scrollHeight <= r201.clientHeight + 1,
    `最长介绍不得内部滚动（scrollHeight ${r201.scrollHeight} > clientHeight ${r201.clientHeight}）`)
  assert.ok(r201.overflowY !== 'auto' && r201.overflowY !== 'scroll',
    `最长介绍 .awaken-desc 不得 overflow-y auto/scroll，实际 ${r201.overflowY}`)

  // ---------- 阶段 K：结果页五档视口（无横向滚动、正文不裁切、按钮可见）----------
  for (const vp of bg004Viewports) {
    await bg004Page.setViewportSize(vp)
    await bg004Page.waitForTimeout(350)
    const m = await bg004Page.evaluate(() => {
      const desc = document.querySelector('.awaken-desc')
      const actions = document.querySelector('.awaken-actions')
      const step = document.querySelector('.create-step')
      const btn = [...(actions ? actions.querySelectorAll('button') : [])].find(b => b.textContent.includes('就是它了'))
      if (!desc || !actions || !step || !btn) return null
      const br = btn.getBoundingClientRect()
      const dr = desc.getBoundingClientRect()
      const actionButtons = [...actions.querySelectorAll('button')]
      return {
        innerWidth: window.innerWidth,
        pageScrollW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        pageClientW: document.documentElement.clientWidth,
        pageScrollH: document.scrollingElement.scrollHeight,
        pageClientH: document.scrollingElement.clientHeight,
        stepScrollH: step.scrollHeight,
        stepClientH: step.clientHeight,
        stepOverflowY: getComputedStyle(step).overflowY,
        descScrollH: desc.scrollHeight,
        descClientH: desc.clientHeight,
        descOverflowY: getComputedStyle(desc).overflowY,
        descInside: dr.top >= -1 && dr.bottom <= window.innerHeight + 1,
        btnVisible: br.width > 0 && br.height > 0 && br.left >= -1 && br.right <= window.innerWidth + 1 && br.top >= -1 && br.bottom <= window.innerHeight + 1,
        allActionsInside: actionButtons.every(button => {
          const rect = button.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0 && rect.left >= -1 && rect.right <= window.innerWidth + 1 && rect.top >= -1 && rect.bottom <= window.innerHeight + 1
        })
      }
    })
    assert.ok(m, `viewport ${vp.width}: 结果页应可测量`)
    assert.equal(m.innerWidth, vp.width, `viewport ${vp.width}: 视口宽度应生效`)
    assert.ok(m.pageScrollW <= m.pageClientW + 1,
      `viewport ${vp.width}: 结果页不得横向滚动（pageScrollW=${m.pageScrollW} vs pageClientW=${m.pageClientW}）`)
    assert.ok(m.pageScrollH <= m.pageClientH + 1,
      `viewport ${vp.width}: 结果页不得纵向滚动（pageScrollH=${m.pageScrollH} vs pageClientH=${m.pageClientH}）`)
    assert.ok(m.stepScrollH <= m.stepClientH + 1,
      `viewport ${vp.width}: 觉醒内容必须完整落在固定首屏（step=${m.stepScrollH}/${m.stepClientH}）`)
    assert.equal(m.stepOverflowY, 'hidden', `viewport ${vp.width}: 创建内容不得提供内部上下滚动`)
    assert.ok(m.descScrollH <= m.descClientH + 1,
      `viewport ${vp.width}: 正文不裁切、不内部滚动（${m.descScrollH} vs ${m.descClientH}）`)
    assert.ok(m.descOverflowY !== 'auto' && m.descOverflowY !== 'scroll',
      `viewport ${vp.width}: .awaken-desc 不得内部滚动，实际 ${m.descOverflowY}`)
    assert.ok(m.descInside, `viewport ${vp.width}: 武魂完整介绍区域必须在首屏内`)
    assert.ok(m.btnVisible, `viewport ${vp.width}: 确认按钮应完整位于当前屏幕内`)
    assert.ok(m.allActionsInside, `viewport ${vp.width}: 重新选择、重新觉醒和确认按钮都必须在当前屏幕内`)
    bg004ResultRows.push({ width: vp.width, ...m })
    if (vp.width === 390) {
      await bg004FrameStable('.awaken-desc')
      await screenshotOnce(bg004Page, path.join(bg004Dir, 'bg004-b-390-result-full.png'))
      await screenshotOnce(bg004Page, path.join(bg004Dir, 'oral-r3-390-full-intro-actions.png'))
    }
  }
  await bg004Page.setViewportSize({ width: 1920, height: 1080 })
  await bg004Page.waitForTimeout(300)

  assert.deepEqual(bg004Errors, [], `BUG-DIALOG-004 页面错误：\n${bg004Errors.join('\n')}`)
  console.log(`BUG-DIALOG-004 metrics: 神级12卡 | 创世之书详情=原文198字(预览不选中/不清零) | 返回焦点恢复=${focusedCardId} | 确认后仅清当前出身(城7不变) | 结果页: 创世之书len=${r198.text.length} par=${r198.paragraphCount} | 邪眸白虎len=${r201.text.length} par=${r201.paragraphCount} | dossierRows=${bg004DossierRows.map(r => `${r.width}px page=${r.pageScrollW}/${r.pageClientW} modal=${r.modalScrollW}/${r.modalClientW} mBody=${r.modalBodyScrollW}/${r.modalBodyClientW} desc=${r.descScrollH}/${r.descClientH} bodyOY=${r.bodyOverflowY}`).join(' | ')} | resultRows=${bg004ResultRows.map(r => `${r.width}px page=${r.pageScrollW}/${r.pageClientW} desc=${r.descScrollH}/${r.descClientH} descOY=${r.descOverflowY}`).join(' | ')}`)
  await bg004Context.close()

  // ============ BUG-DIALOG-005：重新觉醒按钮闪断（方案 B+ 快速重抽）R2 验收（真实鼠标） ============
  // R2 主验收全部使用真实鼠标：滚动“重新觉醒”到可见区域 → 捕获 boundingBox 与中心坐标一次 →
  // page.mouse.click(x, y) 固定坐标连点。明确禁止 HTMLElement.click() / dispatchEvent /
  // page.evaluate 内点击按钮 / 生产调试接口 / 直接调用 Vue 组件函数。
  // page.evaluate 仅用于：DOM 读取、矩形读取、注入固定随机序列（window.__smokeRandom）、写 localStorage 草稿。
  // 固定 Math.random（默认 0.5 → 中级；0.995 → 神级；0.94 → 顶级；0.3 → 低级）；只注入浏览器测试环境。
  // 随机数消耗模型（已实测验证，含 tierPower 对象字面量 eager 求值的 4 个随机数）：
  //   星斗小村（无 qualityBoost）：品质 r + 池选择 r + tierPower 4 r = 6；顶级另 +1 满魂力判定 = 7；
  //   武魂城世家（qualityBoost=true）：再加升级判定 r 与品质加成 r = 8；顶级 = 9；神级无升级判定 = 7。
  const bg005Dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'local', 'bug-dialog-005')
  fs.mkdirSync(bg005Dir, { recursive: true })

  const bg005Context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  const bg005Page = await bg005Context.newPage()
  const bg005Errors = []
  bg005Page.on('pageerror', error => bg005Errors.push(`pageerror: ${error.message}`))
  bg005Page.on('console', message => {
    if (message.type() === 'error') bg005Errors.push(`console: ${message.text()}`)
  })
  bg005Page.on('requestfailed', request => {
    const type = request.resourceType()
    if (['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(type)) {
      bg005Errors.push(`requestfailed: ${request.url()} (${request.failure()?.errorText || 'unknown'})`)
    }
  })
  bg005Page.on('response', response => {
    const type = response.request().resourceType()
    if (response.status() >= 400 && ['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(type)) {
      bg005Errors.push(`response ${response.status()}: ${response.url()}`)
    }
  })
  await bg005Page.route('**/api/player/auth', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, token: 'browser-smoke-token', expiresIn: 3600000 })
  }))
  await bg005Page.route('**/api/player/save', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, version: 1, lastSave: new Date().toISOString() })
  }))
  await bg005Page.addInitScript(() => {
    window.__smokeRandom = null
    Math.random = function () {
      if (Array.isArray(window.__smokeRandom) && window.__smokeRandom.length) return window.__smokeRandom.shift()
      return 0.5
    }
  })

  const bg005Click = async locator => {
    await bg005Page.mouse.move(0, 0)
    await locator.scrollIntoViewIfNeeded()
    const box = await locator.boundingBox()
    assert.ok(box, `应能定位按钮并读取矩形: ${await locator.innerText().catch(() => '?')}`)
    await bg005Page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  }
  const bg005SeedDraft = counts => bg005Page.evaluate(({ key, counts }) => {
    localStorage.setItem(key, JSON.stringify({ version: 1, draftId: 'bg005-seed-' + Date.now().toString(36), counts, updatedAt: Date.now() }))
  }, { key: PITY_KEY, counts })
  const bg005FillName = async name => {
    await bg005Page.getByLabel('魂师名字').fill(name)
    await bg005Click(bg005Page.getByRole('button', { name: /下一步/ }))
  }
  const bg005Card = name => bg005Page.locator('.origin-card').filter({ hasText: name })
  const bg005SeedRandom = values => bg005Page.evaluate(vals => { window.__smokeRandom = vals }, values)

  // 随机序列（每元素数 = 实测单次抽取消耗）：
  // 星斗小村（无 qualityBoost）：非神级 6 / 顶级 7；武魂城世家（qualityBoost）：非神级 8 / 顶级 9 / 神级 7。
  const D5 = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
  const D5_LOW = [0.3, 0.5, 0.5, 0.5, 0.5, 0.5]
  const D5_TOP = [0.94, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
  const SC_MID = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
  const SC_LOW = [0.3, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
  const SC_GOD = [0.995, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]

  // 真实鼠标助手：滚动“重新觉醒”到可见区域 → 捕获 boundingBox 与中心坐标一次 → 之后固定坐标 page.mouse.click。
  // 注意：页面全局 CSS 有 html { scroll-behavior: smooth }，必须显式 behavior:'instant' 禁用平滑滚动，
  // 否则瞄点滚动动画会持续 ~100ms，连点期间视口仍在漂移导致点击落空。
  const bg005AimReroll = async (page, tag) => {
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.awaken-actions button')].find(b => b.textContent.includes('重新觉醒'))
      if (btn) btn.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
    })
    await page.waitForTimeout(50)
    const box = await page.getByRole('button', { name: /重新觉醒/ }).boundingBox()
    assert.ok(box, `${tag}: 重新觉醒按钮应可见可定位`)
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }

  // .btn 悬停 lift 是 transform（transition all 0.25s，连点会不断重置过渡）。比较“布局矩形”=
  // 视觉矩形减去 transform 位移，才能证明按钮布局零移动（悬停视觉效果不算布局跳动）。
  const bg005TransformOffset = transform => {
    if (!transform || transform === 'none') return { tx: 0, ty: 0 }
    const m = transform.match(/matrix\(([^)]+)\)/)
    if (!m) return { tx: 0, ty: 0 }
    const parts = m[1].split(',').map(v => parseFloat(v))
    return { tx: parts[4] || 0, ty: parts[5] || 0 }
  }
  // 视口矩形转文档坐标（容忍浏览器滚动锚定在连点期间引起的视口滚动，只比较内容真实位移）。
  const bg005DocRect = rect => {
    if (!rect) return null
    return { x: rect.x + (rect.scrollX || 0), y: rect.y + (rect.scrollY || 0), w: rect.w, h: rect.h }
  }
  const bg005LayoutRect = rect => {
    if (!rect) return null
    const { tx, ty } = bg005TransformOffset(rect.transform)
    const doc = bg005DocRect(rect)
    return { x: doc.x - tx, y: doc.y - ty, w: doc.w, h: doc.h }
  }

  // 每次真实鼠标点击后记录：焦点按钮文字、重新觉醒矩形、存在/可见/未禁用、名字、保底、busy、随机残留。
  const bg005ClickRecord = page => page.evaluate(() => {
    const stage = document.querySelector('.awaken-stage')
    const reroll = [...document.querySelectorAll('.awaken-actions button')].find(b => b.textContent.includes('重新觉醒'))
    const rr = reroll ? reroll.getBoundingClientRect() : null
    const active = document.activeElement
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    return {
      focusedText: active && active.tagName === 'BUTTON' ? active.textContent.trim() : (active ? active.tagName : ''),
      rerollExists: !!reroll,
      rerollVisible: !!reroll && rr.width > 0 && rr.height > 0,
      rerollDisabled: !!reroll && reroll.disabled,
      rerollRect: rr ? { x: rr.x, y: rr.y, w: rr.width, h: rr.height, transform: reroll ? getComputedStyle(reroll).transform : '', scrollX, scrollY } : null,
      name: (document.querySelector('.awaken-name') || { innerText: '' }).innerText.trim(),
      pityText: (document.querySelector('.awaken-left') || { innerText: '' }).innerText.trim(),
      isRerolling: !!stage && stage.classList.contains('is-rerolling'),
      ariaBusy: stage ? stage.getAttribute('aria-busy') : null,
      residual: Array.isArray(window.__smokeRandom) ? window.__smokeRandom.length : -1
    }
  })

  // 阶段指标：stage+aria-busy、操作条矩形、每个可见按钮（id/文字/x/y/w/h/disabled）、当前焦点按钮、
  // 提示条矩形、页面 scroll/clientW、武魂名/品质/保底文字/压暗 filter。
  const bg005StageMetrics = page => page.evaluate(() => {
    const stage = document.querySelector('.awaken-stage')
    const actions = document.querySelector('.awaken-actions')
    if (!stage || !actions) return null
    const ar = actions.getBoundingClientRect()
    const hint = document.querySelector('.reroll-hint')
    const nameEl = document.querySelector('.awaken-name')
    const tierEl = document.querySelector('.awaken-tier')
    const leftEl = document.querySelector('.awaken-left')
    const imgWrap = document.querySelector('.awaken-img-wrap')
    const active = document.activeElement
    const hr = hint ? hint.getBoundingClientRect() : null
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    const buttons = [...actions.querySelectorAll('button')].map((b, i) => {
      const r = b.getBoundingClientRect()
      const cs = getComputedStyle(b)
      return { id: `btn${i}`, text: b.textContent.trim(), x: r.x, y: r.y, w: r.width, h: r.height, disabled: b.disabled, transform: cs.transform, scrollX, scrollY }
    })
    return {
      isRerolling: stage.classList.contains('is-rerolling'),
      ariaBusy: stage.getAttribute('aria-busy'),
      actions: { x: ar.x, y: ar.y, w: ar.width, h: ar.height, scrollX, scrollY },
      buttons,
      focusedText: active && active.tagName === 'BUTTON' ? active.textContent.trim() : (active ? active.tagName : ''),
      hintVisible: !!hint && hr.width > 0 && hr.height > 0,
      hintText: hint ? hint.innerText : '',
      hintRect: hr ? { x: hr.x, y: hr.y, w: hr.width, h: hr.height } : null,
      name: nameEl ? nameEl.innerText.trim() : '',
      tier: tierEl ? tierEl.innerText.trim() : '',
      pityText: leftEl ? leftEl.textContent : '',
      filter: imgWrap ? getComputedStyle(imgWrap).filter : '',
      innerWidth: window.innerWidth,
      pageScrollW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      pageClientW: document.documentElement.clientWidth
    }
  })

  // 处理中 vs 收敛后：逐按钮（按文字配对）布局矩形（视觉矩形减 transform 位移）x/y/w/h 全部 ≤1px，且数量与顺序一致。
  const bg005ButtonsDiff = (active, settled) => {
    if (!active || !settled) return ['状态缺失']
    const issues = []
    if (active.buttons.length !== settled.buttons.length) issues.push(`按钮数量 ${active.buttons.length} vs ${settled.buttons.length}`)
    const byText = {}
    for (const btn of settled.buttons) byText[btn.text] = btn
    for (const btn of active.buttons) {
      const other = byText[btn.text]
      if (!other) { issues.push(`${btn.text}: 收敛后缺失`); continue }
      const a = bg005LayoutRect(btn)
      const b = bg005LayoutRect(other)
      const dx = Math.abs(a.x - b.x)
      const dy = Math.abs(a.y - b.y)
      const dw = Math.abs(a.w - b.w)
      const dh = Math.abs(a.h - b.h)
      if (dx > 1 || dy > 1 || dw > 1 || dh > 1) issues.push(`${btn.text}: 布局Δ(${dx.toFixed(2)},${dy.toFixed(2)},${dw.toFixed(2)},${dh.toFixed(2)}) 视觉Δ(${Math.abs(btn.y - other.y).toFixed(2)})`)
    }
    return issues
  }

  // 固定坐标真实鼠标连点 n 次（相邻间隔 <250ms、不等收敛；每次点击后记录焦点/矩形/存在/可见/未禁用）。
  const bg005MouseBurst = async (page, aim, n, { expectPityFn, expectName, tag }) => {
    const log = []
    let lastClickAt = 0
    for (let i = 1; i <= n; i++) {
      const t0 = Date.now()
      await page.mouse.click(aim.x, aim.y)
      if (i > 1) {
        const gap = t0 - lastClickAt
        assert.ok(gap < 250, `${tag}: 第 ${i} 次点击与上次间隔应 <250ms（不得等待收敛），实际 ${gap}ms`)
      }
      lastClickAt = t0
      const rec = await bg005ClickRecord(page)
      log.push({ i, rec, t0 })
      assert.equal(rec.rerollExists, true, `${tag}: 第 ${i} 次点击后重新觉醒按钮应存在`)
      assert.equal(rec.rerollVisible, true, `${tag}: 第 ${i} 次点击后重新觉醒按钮应可见`)
      assert.equal(rec.rerollDisabled, false, `${tag}: 第 ${i} 次点击后重新觉醒按钮应未被禁用`)
      assert.equal(rec.focusedText, '重新觉醒', `${tag}: 第 ${i} 次点击后焦点应落在重新觉醒按钮，实际「${rec.focusedText}」`)
      assert.equal(rec.name, expectName, `${tag}: 第 ${i} 次点击期间应保留旧结果「${expectName}」，实际「${rec.name}」`)
      assert.equal(rec.isRerolling, true, `${tag}: 第 ${i} 次点击期间应处于快速重抽状态`)
      if (expectPityFn) expectPityFn(i, rec)
      if (i === 1) {
        assert.ok(rec.rerollRect, `${tag}: 第 1 次点击后应能取到重新觉醒矩形`)
      } else {
        const first = bg005LayoutRect(log[0].rec.rerollRect)
        const cur = bg005LayoutRect(rec.rerollRect)
        const bdx = Math.abs(cur.x - first.x)
        const bdy = Math.abs(cur.y - first.y)
        const bdw = Math.abs(cur.w - first.w)
        const bdh = Math.abs(cur.h - first.h)
        assert.ok(bdx <= 1 && bdy <= 1 && bdw <= 1 && bdh <= 1,
          `${tag}: 第 ${i} 次点击后按钮布局矩形应与第 1 次一致（≤1px），实际 Δ(${bdx.toFixed(2)},${bdy.toFixed(2)},${bdw.toFixed(2)},${bdh.toFixed(2)}) 第1次=(${first.x.toFixed(2)},${first.y.toFixed(2)},${first.w.toFixed(2)},${first.h.toFixed(2)}) 本次=(${cur.x.toFixed(2)},${cur.y.toFixed(2)},${cur.w.toFixed(2)},${cur.h.toFixed(2)})`)
      }
    }
    return log
  }

  // ---------- 阶段 A：首次觉醒建立旧结果（星斗小村 1/50，中级武魂）----------
  await bg005Page.goto(baseUrl, { waitUntil: 'networkidle' })
  await bg005Click(bg005Page.getByRole('button', { name: /新的旅程/ }))
  await bg005Page.waitForURL(url => url.hash === '#/create')
  await bg005FillName('快速重抽验收')
  await bg005Click(bg005Card('星斗小村'))
  await bg005Click(bg005Page.getByRole('button', { name: /进行武魂觉醒/ }))
  await bg005SeedRandom([...D5])
  await bg005Click(bg005Page.getByRole('button', { name: /开始觉醒/ }))
  await bg005Page.waitForFunction(() => {
    const el = document.querySelector('.awaken-left')
    return !!el && el.innerText.includes('星斗小村神级保底：1 / 50')
  }, null, { timeout: 8000 })
  await bg005Page.waitForTimeout(700)
  const bg005OldName = (await bg005Page.locator('.awaken-name').innerText()).trim()
  assert.ok(bg005OldName, '首次觉醒后应展示旧结果武魂名')

  // ---------- 阶段 B：主场景同一坐标真实鼠标 10 连击（短间隔、不等收敛）→ 旧结果保留、逐次累计保底 ----------
  await bg005SeedRandom([...D5_LOW, ...D5_LOW, ...D5_LOW, ...D5_LOW, ...D5_LOW,
    ...D5_LOW, ...D5_LOW, ...D5_LOW, ...D5_LOW, ...D5_LOW])
  const bAim = await bg005AimReroll(bg005Page, '阶段B')
  const settleT0 = Date.now()
  const bLog = await bg005MouseBurst(bg005Page, bAim, 10, {
    expectPityFn: (i, rec) => assert.match(rec.pityText,
      new RegExp(`星斗小村神级保底：${1 + i} / 50`),
      `阶段B: 第 ${i} 次点击后保底应严格累计到 ${1 + i}/50，实际「${rec.pityText}」`),
    expectName: bg005OldName,
    tag: '阶段B'
  })
  assert.equal(bLog[9].rec.residual, 0, '阶段B: 10 次抽取应恰好消耗完注入的 60 个随机值（每抽 6 个）')
  await screenshotOnce(bg005Page, path.join(bg005Dir, 'bg005-bplus-1920-rapid-active.png'))
  const active = await bg005StageMetrics(bg005Page)
  assert.ok(active, '阶段B: 快速重抽期间应可测量阶段状态')
  assert.equal(active.isRerolling, true, '阶段B: 快速重抽期间 awaken-stage 应带 is-rerolling 类')
  assert.equal(active.ariaBusy, 'true', '阶段B: 快速重抽期间 aria-busy 应为 true')
  assert.equal(active.name, bg005OldName, '阶段B: 10 连击期间必须保留旧结果（不得闪断、清空或切走）')
  assert.ok(active.hintVisible, '阶段B: 快速重抽期间应显示“连续重抽中”提示')
  assert.match(active.hintText, /连续重抽中/, '阶段B: 提示应说明正在连续重抽')
  assert.match(active.filter, /brightness\(0\.55\)/, '阶段B: 快速重抽期间旧结果应压暗')
  assert.equal(await bg005Page.getByRole('button', { name: /就是它了/ }).isDisabled(), true, '阶段B: 快速重抽期间确认按钮应禁用')
  assert.ok(active.pageScrollW <= active.pageClientW + 1, '阶段B: 快速重抽期间页面不得横向滚动')
  await bg005Page.waitForFunction(() => {
    const stage = document.querySelector('.awaken-stage')
    return !!stage && !stage.classList.contains('is-rerolling')
  }, null, { timeout: 3000 })
  const settleElapsed = Date.now() - settleT0
  assert.ok(settleElapsed >= 150, `阶段B: 收敛应等待约 250ms 后展示最新结果（不得立即替换），实际 ${settleElapsed}ms`)
  const settled = await bg005StageMetrics(bg005Page)
  assert.ok(settled, '阶段B: 收敛后应可测量阶段状态')
  assert.equal(settled.isRerolling, false, '阶段B: 收敛后应退出快速重抽状态')
  assert.equal(settled.ariaBusy, 'false', '阶段B: 收敛后 aria-busy 应为 false')
  assert.equal(settled.name, '木碗', `阶段B: 收敛后应展示注入序列最后结果（低级池），实际「${settled.name}」`)
  assert.ok(!settled.hintVisible, '阶段B: 收敛后提示应消失')
  assert.equal(settled.filter, 'none', '阶段B: 收敛后结果区应恢复全亮')
  assert.match(settled.pityText, /星斗小村神级保底：11 \/ 50/, '阶段B: 10 次快速重抽必须严格累计 10 次保底（1→11）')
  assert.equal(settled.focusedText, '重新觉醒', `阶段B: 收敛后焦点应保留在重新觉醒按钮，实际「${settled.focusedText}」`)
  const diffB = bg005ButtonsDiff(active, settled)
  assert.deepEqual(diffB, [], `阶段B: 处理中 vs 收敛后逐按钮矩形必须 ≤1px：\n${diffB.join('\n')}`)
  const bA = bg005DocRect(active.actions)
  const bS = bg005DocRect(settled.actions)
  assert.ok(Math.abs(bS.x - bA.x) <= 1 &&
    Math.abs(bS.y - bA.y) <= 1 &&
    Math.abs(bS.w - bA.w) <= 1 &&
    Math.abs(bS.h - bA.h) <= 1,
    `阶段B: 操作条固定槽位不得跳动：active ${JSON.stringify(active.actions)} vs settled ${JSON.stringify(settled.actions)}`)
  assert.equal(await bg005Page.getByRole('button', { name: /就是它了/ }).isDisabled(), false, '阶段B: 收敛后确认按钮应恢复可点击')
  await screenshotOnce(bg005Page, path.join(bg005Dir, 'bg005-bplus-1920-settled.png'))

  // ---------- 阶段 C：顶级不得自动停止，继续重抽并严格累计（星斗小村）----------
  await bg005SeedRandom([...D5_TOP, ...D5_LOW, ...D5])
  const cAim = await bg005AimReroll(bg005Page, '阶段C')
  const cLog = await bg005MouseBurst(bg005Page, cAim, 3, {
    expectPityFn: (i, rec) => assert.match(rec.pityText,
      new RegExp(`星斗小村神级保底：${11 + i} / 50`),
      `阶段C: 第 ${i} 次点击后保底应继续严格累计到 ${11 + i}/50，实际「${rec.pityText}」`),
    expectName: '木碗',
    tag: '阶段C'
  })
  assert.equal(cLog[0].rec.residual, 12, '阶段C: 顶级抽取应消耗 7 个随机值（4+1+1+1）')
  assert.equal(cLog[2].rec.residual, 0, '阶段C: 3 次抽取应恰好消耗 19 个随机值')
  await bg005Page.waitForFunction(() => {
    const stage = document.querySelector('.awaken-stage')
    return !!stage && !stage.classList.contains('is-rerolling')
  }, null, { timeout: 3000 })
  await bg005Page.waitForTimeout(150)
  const settledC = await bg005StageMetrics(bg005Page)
  assert.ok(settledC, '阶段C: 收敛后应可测量阶段状态')
  assert.equal(settledC.name, '石斧', `阶段C: 顶级不得自动停止，收敛后应展示最后抽中的中级武魂，实际「${settledC.name}」`)
  assert.match(settledC.pityText, /星斗小村神级保底：14 \/ 50/, '阶段C: 顶级不停止且保底应累计到 14/50')
  assert.equal(await bg005Page.getByRole('button', { name: /重新觉醒/ }).isDisabled(), false, '阶段C: 顶级不得触发安全锁')

  // ---------- 阶段 D：神级应立即停止展示 + 650ms 安全锁（尾随点击 ≥3 次不得执行抽取）----------
  // 重新选择出身不清零当前出身计数（按出身隔离），故选武魂城世家（全新 0/50 起点）做神级验收。
  await bg005Click(bg005Page.getByRole('button', { name: /重新选择出身/ }))
  await bg005Click(bg005Card('武魂城世家'))
  await bg005Click(bg005Page.getByRole('button', { name: /进行武魂觉醒/ }))
  await bg005SeedRandom([...SC_MID])
  await bg005Click(bg005Page.getByRole('button', { name: /开始觉醒/ }))
  await bg005Page.waitForFunction(() => {
    const el = document.querySelector('.awaken-left')
    return !!el && el.innerText.includes('武魂城世家神级保底：1 / 50')
  }, null, { timeout: 8000 })
  await bg005Page.waitForTimeout(700)
  await bg005SeedRandom([...SC_GOD, ...SC_MID, ...SC_MID])
  const dAim = await bg005AimReroll(bg005Page, '阶段D')
  const godT0 = Date.now()
  await bg005Page.mouse.click(dAim.x, dAim.y)
  await bg005Page.waitForFunction(() => {
    const tier = document.querySelector('.awaken-tier')
    return !!tier && tier.innerText.trim() === '神级武魂'
  }, null, { timeout: 2000 })
  const godElapsed = Date.now() - godT0
  assert.ok(godElapsed < 250, `阶段D: 神级应立即停止并展示（不得等待 250ms 收敛），实际 ${godElapsed}ms`)
  const godRec = await bg005ClickRecord(bg005Page)
  assert.equal(godRec.rerollDisabled, true, '阶段D: 神级停止后应进入安全锁（重新觉醒禁用）')
  assert.equal(godRec.residual, 16, '阶段D: 神级抽取应消耗 7 个随机值')
  const godName = godRec.name
  assert.ok(godName, '阶段D: 神级停止后应展示神级武魂名')
  const godState = await bg005StageMetrics(bg005Page)
  assert.ok(godState, '阶段D: 神级停止后应可测量阶段状态')
  assert.equal(godState.isRerolling, false, '阶段D: 神级停止后应退出快速重抽状态')
  assert.match(godState.pityText, /武魂城世家神级保底：0 \/ 50/, '阶段D: 神级应立即清零当前出身保底')
  assert.match(godState.pityText, /其他出身：星斗小村 14\/50/, '阶段D: 神级不得影响其他出身计数')
  assert.equal(await bg005Page.getByRole('button', { name: /就是它了/ }).isDisabled(), false, '阶段D: 神级停止后确认按钮应可用')
  await screenshotOnce(bg005Page, path.join(bg005Dir, 'bg005-bplus-1920-god-stop.png'))
  let dTailT0 = 0
  for (let i = 1; i <= 3; i++) {
    const t0 = Date.now()
    await bg005Page.mouse.click(dAim.x, dAim.y)
    if (i > 1) assert.ok(t0 - dTailT0 < 250, `阶段D: 安全锁尾随点击间隔应 <250ms，实际 ${t0 - dTailT0}ms`)
    dTailT0 = t0
    const tail = await bg005ClickRecord(bg005Page)
    assert.equal(tail.rerollExists, true, `阶段D: 安全锁尾随点击 ${i} 次后重新觉醒按钮不得消失`)
    assert.equal(tail.rerollDisabled, true, `阶段D: 安全锁尾随点击 ${i} 次期间重新觉醒必须保持禁用`)
    assert.equal(tail.name, godName, `阶段D: 安全锁尾随点击 ${i} 次后武魂结果不得改变`)
    assert.match(tail.pityText, /武魂城世家神级保底：0 \/ 50/, `阶段D: 安全锁尾随点击 ${i} 次后保底必须保持 0/50`)
    assert.equal(tail.residual, 16, `阶段D: 安全锁尾随点击 ${i} 次期间不得执行任何新抽取（随机数残留不得减少）`)
    assert.equal(await bg005Page.evaluate(() => !!document.querySelector('.modal-mask')), false, `阶段D: 安全锁尾随点击 ${i} 次后不得误开任何弹窗`)
  }
  const unlockT0 = Date.now()
  await bg005Page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll('.awaken-actions button')]
    const reroll = buttons.find(b => b.textContent.includes('重新觉醒'))
    return !!reroll && !reroll.disabled
  }, null, { timeout: 3000 })
  const dUnlockMs = Date.now() - godT0
  assert.ok(dUnlockMs >= 600, `阶段D: 安全锁应持续约 650ms 后恢复，实际 ${dUnlockMs}ms`)

  // ---------- 阶段 E：首次 49→50 应立即停止展示 + 解锁自选神级 + 安全锁尾随点击 ----------
  await bg005SeedDraft({ star_forest: 48, spirit_city: 0, border_town: 0, sea_island: 0 })
  await bg005Page.reload({ waitUntil: 'networkidle' })
  await bg005Page.waitForURL(url => url.hash === '#/create')
  await bg005FillName('封顶停止验收')
  await bg005Click(bg005Card('星斗小村'))
  await bg005Click(bg005Page.getByRole('button', { name: /进行武魂觉醒/ }))
  await bg005SeedRandom([...D5])
  await bg005Click(bg005Page.getByRole('button', { name: /开始觉醒/ }))
  await bg005Page.waitForFunction(() => {
    const el = document.querySelector('.awaken-left')
    return !!el && el.innerText.includes('星斗小村神级保底：49 / 50')
  }, null, { timeout: 8000 })
  await bg005Page.waitForTimeout(700)
  await bg005SeedRandom([...D5, ...D5_LOW, ...D5_LOW, ...D5_LOW])
  const eAim = await bg005AimReroll(bg005Page, '阶段E')
  const capT0 = Date.now()
  await bg005Page.mouse.click(eAim.x, eAim.y)
  await bg005Page.waitForFunction(() => {
    const el = document.querySelector('.awaken-left')
    return !!el && el.innerText.includes('星斗小村神级保底：50 / 50')
  }, null, { timeout: 2000 })
  const capElapsed = Date.now() - capT0
  assert.ok(capElapsed < 250, `阶段E: 首次达到 50 应立即停止并展示（不得等待 250ms 收敛），实际 ${capElapsed}ms`)
  const capRec = await bg005ClickRecord(bg005Page)
  assert.equal(capRec.rerollDisabled, true, '阶段E: 49→50 停止后应进入安全锁（重新觉醒禁用）')
  assert.equal(capRec.residual, 18, '阶段E: 封顶抽取应消耗 6 个随机值')
  assert.equal(await bg005Page.getByRole('button', { name: /自选神级武魂/ }).isVisible(), true, '阶段E: 50/50 应解锁自选神级按钮')
  const capState = await bg005StageMetrics(bg005Page)
  assert.ok(capState, '阶段E: 封顶停止后应可测量阶段状态')
  assert.match(capState.pityText, /星斗小村神级保底：50 \/ 50/, '阶段E: 应为 50/50')
  assert.doesNotMatch(capState.pityText, /51 \/ 50/, '阶段E: 绝不允许出现 51/50')
  await screenshotOnce(bg005Page, path.join(bg005Dir, 'bg005-bplus-1920-pity-50-stop.png'))
  const eTailAim = await bg005AimReroll(bg005Page, '阶段E-锁尾随')
  let eTailT0 = 0
  for (let i = 1; i <= 3; i++) {
    const t0 = Date.now()
    await bg005Page.mouse.click(eTailAim.x, eTailAim.y)
    if (i > 1) assert.ok(t0 - eTailT0 < 250, `阶段E: 安全锁尾随点击间隔应 <250ms，实际 ${t0 - eTailT0}ms`)
    eTailT0 = t0
    const tail = await bg005ClickRecord(bg005Page)
    assert.equal(tail.rerollExists, true, `阶段E: 安全锁尾随点击 ${i} 次后重新觉醒按钮不得消失`)
    assert.equal(tail.rerollDisabled, true, `阶段E: 安全锁尾随点击 ${i} 次期间重新觉醒必须保持禁用`)
    assert.equal(tail.name, capRec.name, `阶段E: 安全锁尾随点击 ${i} 次后武魂结果不得改变`)
    assert.match(tail.pityText, /星斗小村神级保底：50 \/ 50/, `阶段E: 安全锁尾随点击 ${i} 次后保底必须保持 50/50`)
    assert.doesNotMatch(tail.pityText, /51 \/ 50/, `阶段E: 安全锁尾随点击 ${i} 次期间不得出现 51/50`)
    assert.equal(tail.residual, 18, `阶段E: 安全锁尾随点击 ${i} 次期间不得执行任何新抽取（随机数残留不得减少）`)
    assert.equal(await bg005Page.evaluate(() => !!document.querySelector('.modal-mask')), false, `阶段E: 安全锁尾随点击 ${i} 次后不得误开任何弹窗`)
  }
  const eUnlockT0 = Date.now()
  await bg005Page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll('.awaken-actions button')]
    const reroll = buttons.find(b => b.textContent.includes('重新觉醒'))
    return !!reroll && !reroll.disabled
  }, null, { timeout: 3000 })
  const eUnlockMs = Date.now() - capT0
  assert.ok(eUnlockMs >= 600, `阶段E: 安全锁应持续约 650ms 后恢复，实际 ${eUnlockMs}ms`)

  // ---------- 阶段 F：已 50/50 后的普通点击不得重复“首次达到 50”停止，永不 51/50 ----------
  await bg005SeedRandom([...D5_LOW, ...D5_LOW, ...D5_LOW])
  const fAim = await bg005AimReroll(bg005Page, '阶段F')
  const fLog = await bg005MouseBurst(bg005Page, fAim, 3, {
    expectPityFn: (i, rec) => assert.match(rec.pityText,
      /星斗小村神级保底：50 \/ 50/,
      `阶段F: 已封顶后第 ${i} 次点击保底必须保持 50/50，实际「${rec.pityText}」`),
    expectName: capRec.name,
    tag: '阶段F'
  })
  for (const entry of fLog) assert.doesNotMatch(entry.rec.pityText, /51 \/ 50/, '阶段F: 任何点击期间不得出现 51/50')
  const fActive = await bg005StageMetrics(bg005Page)
  assert.ok(fActive, '阶段F: 快速重抽期间应可测量阶段状态')
  assert.equal(fActive.buttons.length, 4, '阶段F: 50/50 期间操作条应保持 4 个按钮（含自选神级武魂）')
  assert.equal(fActive.buttons.some(b => b.text.includes('自选神级武魂')), true, '阶段F: 操作条应包含自选神级武魂按钮')
  await bg005Page.waitForFunction(() => {
    const stage = document.querySelector('.awaken-stage')
    return !!stage && !stage.classList.contains('is-rerolling')
  }, null, { timeout: 3000 })
  await bg005Page.waitForTimeout(150)
  const settledF = await bg005StageMetrics(bg005Page)
  assert.ok(settledF && !settledF.isRerolling, '阶段F: 已封顶普通点击应照常按 250ms 收敛')
  assert.equal(settledF.name, '木碗', `阶段F: 收敛后应展示最后抽中结果，实际「${settledF.name}」`)
  assert.match(settledF.pityText, /星斗小村神级保底：50 \/ 50/, '阶段F: 已封顶后保底必须保持 50/50')
  assert.doesNotMatch(settledF.pityText, /51 \/ 50/, '阶段F: 收敛后不得出现 51/50')
  const diffF = bg005ButtonsDiff(fActive, settledF)
  assert.deepEqual(diffF, [], `阶段F: 4 按钮形态处理中 vs 收敛后逐按钮矩形必须 ≤1px：\n${diffF.join('\n')}`)

  // ---------- 阶段 G：快速重抽 250ms 内离开 → 陈旧回调不得改写出身页，已执行抽取与保底保留 ----------
  await bg005Click(bg005Page.getByRole('button', { name: /重新选择出身/ }))
  await bg005Click(bg005Card('武魂城世家'))
  await bg005Click(bg005Page.getByRole('button', { name: /进行武魂觉醒/ }))
  await bg005SeedRandom([...SC_MID])
  await bg005Click(bg005Page.getByRole('button', { name: /开始觉醒/ }))
  await bg005Page.waitForFunction(() => {
    const el = document.querySelector('.awaken-left')
    return !!el && el.innerText.includes('武魂城世家神级保底：1 / 50')
  }, null, { timeout: 8000 })
  await bg005Page.waitForTimeout(700)
  await bg005SeedRandom([...SC_LOW])
  const gRerollAim = await bg005AimReroll(bg005Page, '阶段G-重抽')
  const gLeaveBtn = bg005Page.getByRole('button', { name: /重新选择出身/ })
  await gLeaveBtn.scrollIntoViewIfNeeded()
  const gLeaveBox = await gLeaveBtn.boundingBox()
  assert.ok(gLeaveBox, '阶段G: 重新选择出身按钮应可定位')
  const gClickT0 = Date.now()
  await bg005Page.mouse.click(gRerollAim.x, gRerollAim.y)
  const gAfterClick = await bg005ClickRecord(bg005Page)
  assert.equal(gAfterClick.isRerolling, true, '阶段G: 快速重抽点击后应进入处理中状态')
  assert.match(gAfterClick.pityText, /武魂城世家神级保底：2 \/ 50/, '阶段G: 快速重抽点击必须立即执行抽取并累计保底（1→2）')
  const gLeaveBox2 = await gLeaveBtn.boundingBox()
  assert.ok(gLeaveBox2, '阶段G: 重新选择出身按钮应仍可定位')
  const gLeaveAim = { x: gLeaveBox2.x + gLeaveBox2.width / 2, y: gLeaveBox2.y + gLeaveBox2.height / 2 }
  await bg005Page.mouse.click(gLeaveAim.x, gLeaveAim.y)
  const gLeaveGap = Date.now() - gClickT0
  assert.ok(gLeaveGap < 250, `阶段G: 应在 250ms 收敛前离开，实际 ${gLeaveGap}ms`)
  await bg005Page.waitForTimeout(400)
  const gOriginState = await bg005Page.evaluate(() => ({
    originCards: document.querySelectorAll('.origin-card').length,
    hasStage: !!document.querySelector('.awaken-stage'),
    hasHint: !!document.querySelector('.reroll-hint')
  }))
  assert.ok(gOriginState.originCards > 0, '阶段G: 应回到出身选择页')
  assert.equal(gOriginState.hasStage, false, '阶段G: 离开后不得残留觉醒阶段')
  assert.equal(gOriginState.hasHint, false, '阶段G: 离开后不得残留重抽提示')
  await bg005Click(bg005Card('武魂城世家'))
  await bg005Click(bg005Page.getByRole('button', { name: /进行武魂觉醒/ }))
  await bg005Page.waitForTimeout(900)
  const gReentry = await bg005Page.evaluate(key => {
    const stage = document.querySelector('.awaken-stage')
    const nameEl = document.querySelector('.awaken-name')
    const startBtn = [...document.querySelectorAll('.awaken-actions button')].find(b => b.textContent.includes('开始觉醒'))
    const draft = JSON.parse(localStorage.getItem(key) || 'null')
    return {
      stage: !!stage,
      isRerolling: !!stage && stage.classList.contains('is-rerolling'),
      hasResult: !!stage && stage.classList.contains('has-result'),
      ariaBusy: stage ? stage.getAttribute('aria-busy') : null,
      hasHint: !!document.querySelector('.reroll-hint'),
      nameShown: nameEl ? nameEl.innerText.trim() : '',
      startVisible: !!startBtn && startBtn.getBoundingClientRect().width > 0,
      startDisabled: !!startBtn && startBtn.disabled,
      spiritCityCount: draft && draft.counts ? draft.counts.spirit_city : -1
    }
  }, PITY_KEY)
  assert.equal(gReentry.stage, true, '阶段G: 重进后应回到觉醒页')
  assert.equal(gReentry.isRerolling, false, '阶段G: 重进后不得残留快速重抽状态')
  assert.equal(gReentry.hasResult, false, '阶段G: 重进后不得展示旧抽取结果')
  assert.equal(gReentry.ariaBusy, 'false', '阶段G: 重进后 aria-busy 应为 false')
  assert.equal(gReentry.hasHint, false, '阶段G: 重进后不得残留重抽提示')
  assert.equal(gReentry.nameShown, '', '阶段G: 重进后不得展示任何武魂名')
  assert.equal(gReentry.startVisible, true, '阶段G: 重进后应显示开始觉醒按钮')
  assert.equal(gReentry.startDisabled, false, '阶段G: 开始觉醒按钮应可点击（无安全锁残留）')
  assert.equal(gReentry.spiritCityCount, 2, '阶段G: 离开前已执行的抽取必须保留在保底草稿中（武魂城世家=2）')
  await bg005SeedRandom([...SC_MID])
  await bg005Click(bg005Page.getByRole('button', { name: /开始觉醒/ }))
  await bg005Page.waitForFunction(() => {
    const el = document.querySelector('.awaken-left')
    return !!el && el.innerText.includes('武魂城世家神级保底：3 / 50')
  }, null, { timeout: 8000 })
  await bg005Page.waitForTimeout(700)
  assert.equal(await bg005Page.getByRole('button', { name: /重新觉醒/ }).isDisabled(), false, '阶段G: 重进后首次觉醒完成，重新觉醒应无锁残留')

  // ---------- 阶段 H：五档视口 × 三/四按钮形态（真实鼠标快速重抽 + 逐按钮矩形 ≤1px）----------
  const bg005Viewports = [
    { width: 1920, height: 1080 },
    { width: 1440, height: 1000 },
    { width: 1024, height: 900 },
    { width: 768, height: 900 },
    { width: 390, height: 844 }
  ]
  const bg005VpRows = []
  let vpIndex = 0
  for (const vp of bg005Viewports) {
    await bg005Page.setViewportSize(vp)
    await bg005Page.waitForTimeout(350)
    const revealPity = 4 + vpIndex * 4
    const settledPity = revealPity + 3
    await bg005Click(bg005Page.getByRole('button', { name: /重新选择出身/ }))
    await bg005Click(bg005Card('武魂城世家'))
    await bg005Click(bg005Page.getByRole('button', { name: /进行武魂觉醒/ }))
    await bg005SeedRandom([...SC_MID])
    await bg005Click(bg005Page.getByRole('button', { name: /开始觉醒/ }))
    await bg005Page.waitForFunction(target => {
      const el = document.querySelector('.awaken-left')
      return !!el && el.innerText.includes(target)
    }, `武魂城世家神级保底：${revealPity} / 50`, { timeout: 8000 })
    await bg005Page.waitForTimeout(700)
    await bg005SeedRandom([...SC_LOW, ...SC_LOW, ...SC_LOW])
    const aim = await bg005AimReroll(bg005Page, `viewport ${vp.width} 三按钮`)
    const burst = await bg005MouseBurst(bg005Page, aim, 3, {
      expectPityFn: (i, rec) => assert.match(rec.pityText,
        new RegExp(`武魂城世家神级保底：${revealPity + i} / 50`),
        `viewport ${vp.width}: 第 ${i} 次点击后保底应严格累计到 ${revealPity + i}/50，实际「${rec.pityText}」`),
      expectName: '石斧',
      tag: `viewport ${vp.width} 三按钮`
    })
    assert.equal(burst[2].rec.residual, 0, `viewport ${vp.width}: 3 次抽取应恰好消耗 24 个随机值`)
    const active = await bg005StageMetrics(bg005Page)
    assert.ok(active, `viewport ${vp.width}: 应可测量快速重抽状态`)
    assert.equal(active.isRerolling, true, `viewport ${vp.width}: 快速重抽期间应带 is-rerolling 类`)
    assert.equal(active.ariaBusy, 'true', `viewport ${vp.width}: aria-busy 应为 true`)
    assert.equal(active.buttons.length, 3, `viewport ${vp.width}: 未封顶应为 3 按钮形态`)
    assert.ok(active.hintVisible, `viewport ${vp.width}: 提示应可见`)
    assert.match(active.hintText, /连续重抽中/, `viewport ${vp.width}: 提示应说明连续重抽中`)
    assert.equal(active.innerWidth, vp.width, `viewport ${vp.width}: 视口宽度应生效`)
    assert.ok(active.pageScrollW <= active.pageClientW + 1,
      `viewport ${vp.width}: 快速重抽期间不得横向滚动（${active.pageScrollW}/${active.pageClientW}）`)
    assert.ok(active.hintRect.x >= -1 && active.hintRect.x + active.hintRect.w <= active.innerWidth + 1,
      `viewport ${vp.width}: 提示不得横向溢出视口（${JSON.stringify(active.hintRect)}）`)
    if (vp.width === 1920) assert.ok(active.hintRect.y >= -1, 'viewport 1920: 提示应在视口内')
    if (vp.width === 1024) {
      await screenshotOnce(bg005Page, path.join(bg005Dir, 'bg005-r2-bplus-1024-rapid-active.png'))
    }
    if (vp.width === 768) {
      await screenshotOnce(bg005Page, path.join(bg005Dir, 'bg005-r2-bplus-768-rapid-active.png'))
    }
    if (vp.width === 390) {
      await screenshotOnce(bg005Page, path.join(bg005Dir, 'bg005-bplus-390-rapid-active.png'))
    }
    await bg005Page.waitForFunction(() => {
      const stage = document.querySelector('.awaken-stage')
      return !!stage && !stage.classList.contains('is-rerolling')
    }, null, { timeout: 3000 })
    await bg005Page.waitForTimeout(150)
    const settled = await bg005StageMetrics(bg005Page)
    assert.ok(settled && !settled.isRerolling, `viewport ${vp.width}: 收敛后应退出快速重抽`)
    assert.equal(settled.name, '木碗', `viewport ${vp.width}: 收敛后应展示最后抽中结果，实际「${settled.name}」`)
    assert.match(settled.pityText, new RegExp(`武魂城世家神级保底：${settledPity} / 50`),
      `viewport ${vp.width}: 3 次快速重抽应严格累计到 ${settledPity}/50`)
    const diff = bg005ButtonsDiff(active, settled)
    assert.deepEqual(diff, [], `viewport ${vp.width} 三按钮: 处理中 vs 收敛后逐按钮矩形必须 ≤1px：\n${diff.join('\n')}`)
    assert.equal(settled.focusedText, '重新觉醒', `viewport ${vp.width}: 收敛后焦点应保留在重新觉醒按钮，实际「${settled.focusedText}」`)
    const hA = bg005DocRect(active.actions)
    const hS = bg005DocRect(settled.actions)
    assert.ok(Math.abs(hS.x - hA.x) <= 1 &&
      Math.abs(hS.y - hA.y) <= 1 &&
      Math.abs(hS.w - hA.w) <= 1 &&
      Math.abs(hS.h - hA.h) <= 1,
      `viewport ${vp.width}: 操作条固定槽位不得跳动`)
    bg005VpRows.push({
      width: vp.width,
      form: '三按钮',
      activeButtons: active.buttons.map(b => `${b.text}(${b.x.toFixed(1)},${b.y.toFixed(1)},${b.w.toFixed(1)},${b.h.toFixed(1)}${b.disabled ? '!disabled' : ''})`).join('; '),
      settledButtons: settled.buttons.map(b => `${b.text}(${b.x.toFixed(1)},${b.y.toFixed(1)},${b.w.toFixed(1)},${b.h.toFixed(1)}${b.disabled ? '!disabled' : ''})`).join('; ')
    })
    vpIndex++
  }
  for (const vp of bg005Viewports) {
    await bg005Page.setViewportSize(vp)
    await bg005Page.waitForTimeout(350)
    await bg005Click(bg005Page.getByRole('button', { name: /重新选择出身/ }))
    await bg005Click(bg005Card('星斗小村'))
    await bg005Click(bg005Page.getByRole('button', { name: /进行武魂觉醒/ }))
    await bg005SeedRandom([...D5])
    await bg005Click(bg005Page.getByRole('button', { name: /开始觉醒/ }))
    await bg005Page.waitForFunction(() => {
      const stage = document.querySelector('.awaken-stage')
      return !!stage && stage.classList.contains('has-result')
    }, null, { timeout: 8000 })
    await bg005Page.waitForTimeout(700)
    const aim = await bg005AimReroll(bg005Page, `viewport ${vp.width} 四按钮`)
    await bg005SeedRandom([...D5_LOW, ...D5_LOW, ...D5_LOW])
    const burst = await bg005MouseBurst(bg005Page, aim, 3, {
      expectPityFn: (i, rec) => assert.match(rec.pityText,
        /星斗小村神级保底：50 \/ 50/,
        `viewport ${vp.width} 四按钮: 第 ${i} 次点击后保底必须保持 50/50，实际「${rec.pityText}」`),
      expectName: '石斧',
      tag: `viewport ${vp.width} 四按钮`
    })
    assert.equal(burst[2].rec.residual, 0, `viewport ${vp.width} 四按钮: 3 次抽取应恰好消耗 18 个随机值`)
    const active = await bg005StageMetrics(bg005Page)
    assert.ok(active, `viewport ${vp.width} 四按钮: 应可测量快速重抽状态`)
    assert.equal(active.isRerolling, true, `viewport ${vp.width} 四按钮: 快速重抽期间应带 is-rerolling 类`)
    assert.equal(active.ariaBusy, 'true', `viewport ${vp.width} 四按钮: aria-busy 应为 true`)
    assert.equal(active.buttons.length, 4, `viewport ${vp.width}: 已封顶应为 4 按钮形态（含自选神级武魂）`)
    assert.equal(active.buttons.some(b => b.text.includes('自选神级武魂')), true, `viewport ${vp.width}: 操作条应包含自选神级武魂`)
    assert.ok(active.hintVisible, `viewport ${vp.width} 四按钮: 提示应可见`)
    assert.ok(active.pageScrollW <= active.pageClientW + 1,
      `viewport ${vp.width} 四按钮: 快速重抽期间不得横向滚动（${active.pageScrollW}/${active.pageClientW}）`)
    assert.ok(active.hintRect.x >= -1 && active.hintRect.x + active.hintRect.w <= active.innerWidth + 1,
      `viewport ${vp.width} 四按钮: 提示不得横向溢出视口（${JSON.stringify(active.hintRect)}）`)
    if (vp.width === 390) {
      await screenshotOnce(bg005Page, path.join(bg005Dir, 'bg005-r2-bplus-390-actions-active.png'))
    }
    await bg005Page.waitForFunction(() => {
      const stage = document.querySelector('.awaken-stage')
      return !!stage && !stage.classList.contains('is-rerolling')
    }, null, { timeout: 3000 })
    await bg005Page.waitForTimeout(150)
    const settled = await bg005StageMetrics(bg005Page)
    assert.ok(settled && !settled.isRerolling, `viewport ${vp.width} 四按钮: 收敛后应退出快速重抽`)
    assert.equal(settled.name, '木碗', `viewport ${vp.width} 四按钮: 收敛后应展示最后抽中结果，实际「${settled.name}」`)
    assert.match(settled.pityText, /星斗小村神级保底：50 \/ 50/, `viewport ${vp.width} 四按钮: 保底必须保持 50/50`)
    assert.doesNotMatch(settled.pityText, /51 \/ 50/, `viewport ${vp.width} 四按钮: 不得出现 51/50`)
    const diff = bg005ButtonsDiff(active, settled)
    assert.deepEqual(diff, [], `viewport ${vp.width} 四按钮: 处理中 vs 收敛后逐按钮矩形必须 ≤1px：\n${diff.join('\n')}`)
    assert.equal(settled.focusedText, '重新觉醒', `viewport ${vp.width} 四按钮: 收敛后焦点应保留在重新觉醒按钮，实际「${settled.focusedText}」`)
    const hA4 = bg005DocRect(active.actions)
    const hS4 = bg005DocRect(settled.actions)
    assert.ok(Math.abs(hS4.x - hA4.x) <= 1 &&
      Math.abs(hS4.y - hA4.y) <= 1 &&
      Math.abs(hS4.w - hA4.w) <= 1 &&
      Math.abs(hS4.h - hA4.h) <= 1,
      `viewport ${vp.width} 四按钮: 操作条固定槽位不得跳动`)
    bg005VpRows.push({
      width: vp.width,
      form: '四按钮',
      activeButtons: active.buttons.map(b => `${b.text}(${b.x.toFixed(1)},${b.y.toFixed(1)},${b.w.toFixed(1)},${b.h.toFixed(1)}${b.disabled ? '!disabled' : ''})`).join('; '),
      settledButtons: settled.buttons.map(b => `${b.text}(${b.x.toFixed(1)},${b.y.toFixed(1)},${b.w.toFixed(1)},${b.h.toFixed(1)}${b.disabled ? '!disabled' : ''})`).join('; ')
    })
  }
  await bg005Page.setViewportSize({ width: 1920, height: 1080 })
  await bg005Page.waitForTimeout(300)

  // ---------- 阶段 I：prefers-reduced-motion 下快速重抽同样收敛且不报错（真实鼠标）----------
  const bg005RmContext = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' })
  await bg005RmContext.route('**/api/player/auth', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, token: 'browser-smoke-token', expiresIn: 3600000 })
  }))
  await bg005RmContext.route('**/api/player/save', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, version: 1, lastSave: new Date().toISOString() })
  }))
  const bg005RmPage = await bg005RmContext.newPage()
  const bg005RmErrors = []
  bg005RmPage.on('pageerror', error => bg005RmErrors.push(`pageerror: ${error.message}`))
  bg005RmPage.on('console', message => {
    if (message.type() === 'error') bg005RmErrors.push(`console: ${message.text()}`)
  })
  await bg005RmPage.addInitScript(() => {
    window.__smokeRandom = null
    Math.random = function () {
      if (Array.isArray(window.__smokeRandom) && window.__smokeRandom.length) return window.__smokeRandom.shift()
      return 0.5
    }
  })
  const bg005RmClick = async locator => {
    await bg005RmPage.mouse.move(0, 0)
    await locator.scrollIntoViewIfNeeded()
    const box = await locator.boundingBox()
    assert.ok(box, 'reduced-motion: 应能定位按钮')
    await bg005RmPage.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  }
  await bg005RmPage.goto(baseUrl, { waitUntil: 'networkidle' })
  await bg005RmClick(bg005RmPage.getByRole('button', { name: /新的旅程/ }))
  await bg005RmPage.waitForURL(url => url.hash === '#/create')
  await bg005RmPage.getByLabel('魂师名字').fill('静观重抽')
  await bg005RmClick(bg005RmPage.getByRole('button', { name: /下一步/ }))
  await bg005RmClick(bg005RmPage.locator('.origin-card').first())
  await bg005RmClick(bg005RmPage.getByRole('button', { name: /进行武魂觉醒/ }))
  await bg005RmPage.evaluate(vals => { window.__smokeRandom = vals }, [...D5])
  await bg005RmClick(bg005RmPage.getByRole('button', { name: /开始觉醒/ }))
  await bg005RmPage.waitForFunction(() => {
    const el = document.querySelector('.awaken-left')
    return !!el && el.innerText.includes('星斗小村神级保底：1 / 50')
  }, null, { timeout: 8000 })
  await bg005RmPage.waitForTimeout(700)
  const rmOldName = (await bg005RmPage.locator('.awaken-name').innerText()).trim()
  assert.ok(rmOldName, 'reduced-motion 下首次觉醒应展示旧结果')
  await bg005RmPage.evaluate(vals => { window.__smokeRandom = vals }, [...D5_LOW, ...D5_LOW, ...D5_LOW])
  const rmAim = await bg005AimReroll(bg005RmPage, 'reduced-motion')
  const rmBurst = await bg005MouseBurst(bg005RmPage, rmAim, 3, {
    expectPityFn: (i, rec) => assert.match(rec.pityText,
      new RegExp(`星斗小村神级保底：${1 + i} / 50`),
      `reduced-motion: 第 ${i} 次点击后保底应严格累计到 ${1 + i}/50，实际「${rec.pityText}」`),
    expectName: rmOldName,
    tag: 'reduced-motion'
  })
  assert.equal(rmBurst[2].rec.residual, 0, 'reduced-motion: 3 次抽取应恰好消耗 18 个随机值')
  await bg005RmPage.waitForFunction(() => {
    const stage = document.querySelector('.awaken-stage')
    return !!stage && !stage.classList.contains('is-rerolling')
  }, null, { timeout: 3000 })
  await bg005RmPage.waitForTimeout(150)
  const rmNewName = (await bg005RmPage.locator('.awaken-name').innerText()).trim()
  assert.ok(rmNewName && rmNewName !== rmOldName, 'reduced-motion 下收敛后应展示最新结果')
  assert.match(await bg005RmPage.locator('.awaken-left').innerText(), /星斗小村神级保底：4 \/ 50/, 'reduced-motion 下 3 次重抽应严格累计 3 次保底')
  assert.equal(await bg005RmPage.evaluate(() => document.activeElement.textContent.trim()), '重新觉醒', 'reduced-motion 下收敛后焦点应保留在重新觉醒按钮')
  assert.deepEqual(bg005RmErrors, [], `reduced-motion 页面错误：\n${bg005RmErrors.join('\n')}`)
  await bg005RmContext.close()

  assert.deepEqual(bg005Errors, [], `BUG-DIALOG-005 页面错误：\n${bg005Errors.join('\n')}`)
  console.log(`BUG-DIALOG-005 metrics(R2 真实鼠标): 10连击${settleElapsed}ms收敛 保底1->11 旧=${bg005OldName} 新=${settled.name} | 顶级不停止保底14/50 | 神级${godElapsed}ms立即清零 | 49->50 ${capElapsed}ms立即+自选+无51/50 | 安全锁尾随3次0消耗+${dUnlockMs}ms/${eUnlockMs}ms解锁 | 已50普通点击不重复停止 | 离开重进${gLeaveGap}ms后保底保留2/50 | 五档x三/四按钮逐按钮≤1px ${bg005VpRows.map(r => `${r.width}px${r.form === '四按钮' ? '4' : '3'}btn`).join('|')} | reduced-motion ${rmOldName}->${rmNewName} 保底1->4`)
  await bg005Context.close()

  // ============ BUG-DIALOG-006：地图地点单一影响区（无根节点缩放/无常驻脉动旋转）============
  const bg006Dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'local', 'bug-dialog-006')
  fs.mkdirSync(bg006Dir, { recursive: true })
  const bg006Context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const bg006Page = await bg006Context.newPage()
  const bg006Errors = []
  bg006Page.on('pageerror', error => bg006Errors.push(`pageerror: ${error.message}`))
  bg006Page.on('console', message => {
    const location = message.location()
    // 直开 legacy map.html 时 Chrome 会自行请求未配置的 favicon；它不是地图产品资源。
    if (message.type() === 'error' && !location.url?.endsWith('/favicon.ico')) {
      bg006Errors.push(`console: ${message.text()} @ ${location.url || 'unknown'}`)
    }
  })
  bg006Page.on('requestfailed', request => {
    if (['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(request.resourceType())) {
      bg006Errors.push(`requestfailed: ${request.url()} (${request.failure()?.errorText || 'unknown'})`)
    }
  })
  await bg006Page.goto(`${baseUrl}legacy/map.html`, { waitUntil: 'networkidle' })
  await bg006Page.waitForSelector('.location-marker')
  const bg007DeepMarker = bg006Page.locator('.location-marker').filter({ hasText: '星斗大森林深处' }).first()
  await bg007DeepMarker.locator('.marker-hitarea').click({ force: true })
  await bg006Page.locator('#detailPanel.open').waitFor({ state: 'visible' })
  assert.equal(await bg006Page.locator('#panelTitle').innerText(), '星斗大森林深处')
  assert.match(await bg006Page.locator('#panelBody').innerText(), /重大事件[\s\S]*泰坦巨猿与天青牛蟒/,
    '字符串形式的 famousEvents 应正常显示，不能中断地点详情')
  await bg006Page.locator('#panelClose').click()
  const bg006Marker = bg006Page.locator('.location-marker').filter({ hasText: '史莱克学院' }).first()
  const bg006Other = bg006Page.locator('.location-marker').filter({ hasText: '星斗大森林外围' }).first()
  const bg006Metrics = locator => locator.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const focus = element.querySelector('.marker-focus')
    const focusStyle = focus ? getComputedStyle(focus) : null
    return {
      rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      transform: getComputedStyle(element).transform,
      children: [...element.children].map(child => child.className),
      animations: [...element.children].map(child => getComputedStyle(child).animationName),
      focusOpacity: focusStyle ? Number(focusStyle.opacity) : -1,
      focusTransform: focusStyle ? focusStyle.transform : '',
      activeLabel: document.activeElement?.getAttribute('aria-label') || '',
      pageScrollW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      pageClientW: document.documentElement.clientWidth
    }
  })
  const bg006RectStable = (before, after, tag) => {
    for (const key of ['x', 'y', 'w', 'h']) {
      assert.ok(Math.abs(before[key] - after[key]) <= 1,
        `${tag}: 根命中盒 ${key} 不得因 hover/focus 改变（${before[key]} vs ${after[key]}）`)
    }
  }

  const bg006Before = await bg006Metrics(bg006Marker)
  assert.deepEqual(bg006Before.children,
    ['marker-hitarea', 'marker-focus', 'marker-dot', 'marker-icon', 'marker-label'],
    '地点标记只应保留命中区、单一影响区、点、图标和文字')
  assert.ok(bg006Before.animations.every(name => name === 'none'),
    `地点标记所有子层不得存在常驻动画，实际 ${bg006Before.animations.join(',')}`)
  assert.ok(bg006Before.focusOpacity <= 0.05, '未交互时单一影响区应隐藏')
  await bg006Marker.hover()
  await bg006Page.waitForTimeout(240)
  const bg006Hover = await bg006Metrics(bg006Marker)
  bg006RectStable(bg006Before.rect, bg006Hover.rect, '1440 hover')
  assert.ok(bg006Hover.focusOpacity >= 0.85, `hover 应淡入单一影响区，实际 opacity=${bg006Hover.focusOpacity}`)
  assert.ok(bg006Hover.pageScrollW <= bg006Hover.pageClientW + 1, '地图 hover 不得产生页面横向滚动')
  await screenshotOnce(bg006Page, path.join(bg006Dir, 'bg006-after-1440-hover.png'))

  // 在两个相邻地点间快速移动，根命中盒必须始终稳定，避免 hover 边界反复进出造成颤动。
  const bg006OtherBefore = await bg006Metrics(bg006Other)
  for (let i = 0; i < 12; i += 1) {
    const target = i % 2 === 0 ? bg006Other : bg006Marker
    const baseline = i % 2 === 0 ? bg006OtherBefore.rect : bg006Before.rect
    await target.hover()
    const current = await bg006Metrics(target)
    bg006RectStable(baseline, current.rect, `快速移入第 ${i + 1} 次`)
    assert.ok(current.animations.every(name => name === 'none'), `快速移入第 ${i + 1} 次不得启动动画`)
  }

  const bg006ViewportRows = []
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 900 },
    { width: 768, height: 900 },
    { width: 390, height: 844 }
  ]) {
    await bg006Page.setViewportSize(viewport)
    await bg006Page.waitForTimeout(160)
    await bg006Marker.focus()
    await bg006Page.waitForTimeout(220)
    const focused = await bg006Metrics(bg006Marker)
    assert.ok(focused.focusOpacity >= 0.85, `viewport ${viewport.width}: 键盘焦点应显示同一影响区`)
    assert.match(focused.activeLabel, /史莱克学院/, `viewport ${viewport.width}: 焦点应位于可读地点按钮`)
    assert.ok(focused.pageScrollW <= focused.pageClientW + 1,
      `viewport ${viewport.width}: 页面不得横向滚动（${focused.pageScrollW}/${focused.pageClientW}）`)
    assert.ok(focused.animations.every(name => name === 'none'), `viewport ${viewport.width}: 地点层不得运行常驻动画`)
    bg006ViewportRows.push({ width: viewport.width, opacity: focused.focusOpacity, rect: focused.rect })
    if (viewport.width === 390) {
      await screenshotOnce(bg006Page, path.join(bg006Dir, 'bg006-after-390-keyboard-focus.png'))
    }
  }

  const bg006ReducedContext = await browser.newContext({ viewport: { width: 1024, height: 900 }, reducedMotion: 'reduce' })
  const bg006ReducedPage = await bg006ReducedContext.newPage()
  await bg006ReducedPage.goto(`${baseUrl}legacy/map.html`, { waitUntil: 'networkidle' })
  const bg006ReducedMarker = bg006ReducedPage.locator('.location-marker').filter({ hasText: '史莱克学院' }).first()
  await bg006ReducedMarker.focus()
  const bg006ReducedAnimations = await bg006ReducedMarker.evaluate(element =>
    [...element.children].map(child => getComputedStyle(child).animationName))
  assert.ok(bg006ReducedAnimations.every(name => name === 'none'),
    `reduced-motion 下地点层不得运行动画，实际 ${bg006ReducedAnimations.join(',')}`)
  await bg006ReducedContext.close()
  assert.deepEqual(bg006Errors, [], `BUG-DIALOG-006 页面错误：\n${bg006Errors.join('\n')}`)
  console.log(`BUG-DIALOG-006 metrics: children=${bg006Before.children.join('/')} animations=${bg006Before.animations.join('/')} | hover rootRect Δ<=1px focusOpacity=${bg006Hover.focusOpacity} | 快速交替12次无颤动 | viewports=${bg006ViewportRows.map(row => `${row.width}px opacity=${row.opacity}`).join(' | ')} | reduced-motion animations=none`)
  await bg006Context.close()

  // ============ BUG-DIALOG-011：第一魂环年限/风险/收益是真选择 ============
  const bg011Dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'local', 'bug-dialog-011')
  fs.mkdirSync(bg011Dir, { recursive: true })
  const bg011BaseSave = await page.evaluate(() => JSON.parse(localStorage.getItem('dldl_text_rpg_save')))
  const bg011Save = {
    ...bg011BaseSave,
    playerId: 'browser-bug-011', name: '百年猎环验收', level: 10, exp: 0, overflowExp: 0,
    innatePower: 90, hp: 999999, rings: [], skills: [], finished: false,
    bonus: { ...(bg011BaseSave.bonus || {}), attack: 500 },
    pendingRingLv: 10, _ringHuntDeferredUntil: 0,
    _prologueDone: true, _earlyLifeDone: true, _enrollmentComplete: true, _firstClassDone: true,
    doneEvents: (bg011BaseSave.doneEvents || []).filter(id => id !== 'ring_hunt_10'),
    _currentLocation: 'star_duo_outer',
    _visitedLocations: [...new Set([...(bg011BaseSave._visitedLocations || []), 'star_duo_outer'])]
  }
  const bg011Context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await bg011Context.addInitScript(save => {
    if (!localStorage.getItem('dldl_text_rpg_save')) localStorage.setItem('dldl_text_rpg_save', JSON.stringify(save))
  }, bg011Save)
  const bg011Page = await bg011Context.newPage()
  const bg011Errors = []
  bg011Page.on('pageerror', error => bg011Errors.push(`pageerror: ${error.message}`))
  bg011Page.on('console', message => { if (message.type() === 'error') bg011Errors.push(`console: ${message.text()}`) })
  await bg011Page.goto(`${baseUrl}#/game`, { waitUntil: 'networkidle' })
  await bg011Page.locator('.scene-location-action').waitFor()
  const bg011RingPriority = bg011Page.locator('[data-testid="ring-hunt-priority"]')
  await bg011RingPriority.waitFor()
  assert.match(await bg011RingPriority.innerText(), /当前任务 · 第1魂环[\s\S]*星斗大森林·外围[\s\S]*不需要等待随机事件/)
  await bg011RingPriority.locator('.ring-priority-btn').click()
  await bg011Page.locator('.event-title').filter({ hasText: '第一魂环·年限抉择' }).waitFor()
  const bg011MaxHp = Number((await bg011Page.locator('.bar-row').filter({ hasText: /^生命/ }).locator('.bar-label span').last().innerText()).split('/').at(-1).trim())
  await bg011Page.evaluate(maxHp => {
    const player = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
    player.setHp(maxHp)
  }, bg011MaxHp)
  await bg011Page.locator('.bar-row').filter({ hasText: /^生命/ }).getByText(`${bg011MaxHp} / ${bg011MaxHp}`, { exact: true }).waitFor()
  const bg011ChoiceText = await bg011Page.locator('.event-choices').innerText()
  assert.match(bg011ChoiceText, /十年灵鹿[\s\S]*十年白环[\s\S]*低风险[\s\S]*百年疾风兔[\s\S]*百年黄环[\s\S]*中风险[\s\S]*百年毒蛛[\s\S]*高风险/)
  assert.equal(await bg011Page.locator('.choice-btn').count(), 3)
  assert.equal(await bg011Page.locator('.choice-btn:disabled').count(), 0, '三条第一魂环路线都应由玩家自行承担风险选择')
  assert.match(await bg011Page.locator('.event-text').innerText(), /先天魂力 90[\s\S]*生命状态 100%[\s\S]*战败不会获得魂环/)
  await screenshotOnce(bg011Page, path.join(bg011Dir, 'bg011-after-1440-first-ring-strategy.png'))
  await screenshotOnce(bg011Page, path.join(bg011Dir, 'bg011-r2-after-1440-first-ring-strategy.png'))
  await screenshotOnce(bg011Page, path.join(bg011Dir, 'bg011-final-after-1440-first-ring-strategy.png'))
  await screenshotOnce(bg011Page, path.join(bg011Dir, 'bg011-final-r2-after-1440-first-ring-strategy.png'))
  await screenshotOnce(bg011Page, path.join(bg011Dir, 'bg011-final-r3-after-1440-first-ring-strategy.png'))

  await bg011Page.setViewportSize({ width: 390, height: 844 })
  await bg011Page.locator('.choice-btn').nth(2).scrollIntoViewIfNeeded()
  const bg011Mobile = await bg011Page.evaluate(() => ({
    scrollW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    clientW: document.documentElement.clientWidth
  }))
  assert.ok(bg011Mobile.scrollW <= bg011Mobile.clientW + 1, `390px 第一魂环策略卡不得横向溢出（${bg011Mobile.scrollW}/${bg011Mobile.clientW}）`)
  await screenshotOnce(bg011Page, path.join(bg011Dir, 'bg011-after-390-first-ring-strategy.png'))
  await bg011Page.setViewportSize({ width: 1440, height: 1000 })

  await bg011Page.getByRole('button', { name: /百年疾风兔/ }).click()
  await bg011Page.locator('.battle-shell').waitFor()
  assert.match(await bg011Page.locator('.battle-shell').innerText(), /百年野兔/, '百年路线必须实际生成百年魂兽而非十年换皮')
  await screenshotOnce(bg011Page, path.join(bg011Dir, 'bg011-after-1440-hundred-year-battle.png'))
  await screenshotOnce(bg011Page, path.join(bg011Dir, 'bg011-r2-after-1440-hundred-year-battle.png'))
  await bg011Page.getByRole('button', { name: '普通攻击', exact: true }).click()
  await bg011Page.locator('.scene-continue').waitFor({ timeout: 10000 })
  await bg011Page.waitForFunction(() => {
    const save = JSON.parse(localStorage.getItem('dldl_text_rpg_save') || 'null')
    return save?.rings?.[0]?.ringId === 'yellow_ring' && save.rings[0].year === 100
  })
  const bg011Result = await bg011Page.evaluate(() => JSON.parse(localStorage.getItem('dldl_text_rpg_save')).rings[0])
  assert.equal(bg011Result.source, '疾风兔')
  assert.equal(bg011Result.ringId, 'yellow_ring')
  assert.equal(bg011Result.year, 100)
  assert.match(await bg011Page.locator('.ring-card').first().innerText(), /疾风兔魂技[\s\S]*疾风兔[\s\S]*100年/)
  await screenshotOnce(bg011Page, path.join(bg011Dir, 'bg011-after-1440-hundred-year-result.png'))
  assert.deepEqual(bg011Errors, [], `BUG-DIALOG-011 页面错误：\n${bg011Errors.join('\n')}`)
  await bg011Context.close()

  // ============ BUG-DIALOG-012：猎环目标持久挂起、跨刷新恢复并可立即继续 ============
  const bg012Dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'local', 'bug-dialog-012')
  fs.mkdirSync(bg012Dir, { recursive: true })
  const bg012Save = {
    ...bg011BaseSave,
    playerId: 'browser-bug-012', name: '猎环目标验收', level: 10, exp: 0, overflowExp: 0,
    innatePower: 90, hp: 230, rings: [], skills: [], finished: false,
    bonus: { ...(bg011BaseSave.bonus || {}), attack: 500 },
    pendingRingLv: 10, _eventCount: 5, _ringHuntDeferredUntil: 8,
    _prologueDone: true, _earlyLifeDone: true, _enrollmentComplete: true, _firstClassDone: true,
    doneEvents: [...new Set([...(bg011BaseSave.doneEvents || []), 'first_hunt', 'reach_lv10'])].filter(id => id !== 'ring_hunt_10'),
    _currentLocation: 'holy_soul_village',
    _visitedLocations: [...new Set([...(bg011BaseSave._visitedLocations || []), 'holy_soul_village'])]
  }
  const bg012Context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await bg012Context.addInitScript(save => {
    if (!localStorage.getItem('dldl_text_rpg_save')) localStorage.setItem('dldl_text_rpg_save', JSON.stringify(save))
    sessionStorage.setItem('dldl_pending_travel', JSON.stringify({
      playerId: save.playerId,
      targetId: save._currentLocation,
      targetName: '圣魂村',
      fromName: '村外小路',
      travelDays: 1,
      cost: 0,
      encounter: false
    }))
  }, bg012Save)
  const bg012Page = await bg012Context.newPage()
  const bg012Errors = []
  bg012Page.on('pageerror', error => bg012Errors.push(`pageerror: ${error.message}`))
  bg012Page.on('console', message => {
    const location = message.location()
    if (message.type() === 'error' && !location.url?.endsWith('/favicon.ico')) {
      bg012Errors.push(`console: ${message.text()} @ ${location.url || 'unknown'}`)
    }
  })
  await bg012Page.goto(`${baseUrl}#/game`, { waitUntil: 'networkidle' })
  const bg012Objective = bg012Page.getByTestId('ring-objective')
  await bg012Objective.waitFor()
  const bg012SetFullHp = async targetPage => {
    const maxHp = Number((await targetPage.locator('.bar-row').filter({ hasText: /^生命/ }).locator('.bar-label span').last().innerText()).split('/').at(-1).trim())
    await targetPage.evaluate(value => {
      document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player').setHp(value)
    }, maxHp)
    await targetPage.locator('.bar-row').filter({ hasText: /^生命/ }).getByText(`${maxHp} / ${maxHp}`, { exact: true }).waitFor()
  }
  await bg012SetFullHp(bg012Page)
  let bg012Text = await bg012Objective.innerText()
  assert.match(bg012Text, /猎环目标[\s\S]*Lv\.10 已解锁[\s\S]*第1魂环[\s\S]*星斗大森林·外围[\s\S]*已挂起 · 3 次行动后自动提醒/)
  assert.equal(await bg012Page.getByRole('button', { name: '查看地图', exact: true }).count(), 1)
  assert.equal(await bg012Page.getByRole('button', { name: '立即继续', exact: true }).count(), 1)
  await screenshotOnce(bg012Page, path.join(bg012Dir, 'bg012-after-1440-objective-deferred.png'))
  await screenshotOnce(bg012Page, path.join(bg012Dir, 'bg012-final-r2-after-1440-objective-deferred.png'))

  await bg012Page.reload({ waitUntil: 'networkidle' })
  await bg012Page.getByTestId('ring-objective').waitFor()
  await bg012SetFullHp(bg012Page)
  bg012Text = await bg012Page.getByTestId('ring-objective').innerText()
  assert.match(bg012Text, /已挂起 · 3 次行动后自动提醒/, '刷新后挂起状态与剩余行动必须保留')
  await bg012Page.getByRole('button', { name: '立即继续', exact: true }).click()
  await bg012Page.locator('.event-title').filter({ hasText: '猎环前置' }).waitFor()
  assert.match(await bg012Page.locator('.scene-continue').innerText(), /星斗大森林(?:·)?外围[\s\S]*打开万象地图/)
  bg012Text = await bg012Page.getByTestId('ring-objective').innerText()
  assert.match(bg012Text, /待出发 · 前往星斗大森林·外围/)
  await screenshotOnce(bg012Page, path.join(bg012Dir, 'bg012-after-1440-objective-travel-ready.png'))
  await screenshotOnce(bg012Page, path.join(bg012Dir, 'bg012-final-r2-after-1440-objective-travel-ready.png'))
  await bg012Page.getByRole('button', { name: '暂缓提醒', exact: true }).click()
  await bg012Page.getByTestId('ring-objective').getByText(/已挂起 · 3 次行动后自动提醒/).waitFor()
  const bg012DeferredSave = await bg012Page.evaluate(() => JSON.parse(localStorage.getItem('dldl_text_rpg_save')))
  assert.equal(bg012DeferredSave.pendingRingLv, 10, '暂缓只能挂起，不能清除猎环目标')
  assert.equal(bg012DeferredSave._ringHuntDeferredUntil - bg012DeferredSave._eventCount, 3, '暂缓应持久保存三次行动窗口')
  await bg012Context.close()

  const bg012ReadySave = {
    ...bg012Save,
    playerId: 'browser-bug-012-ready', name: '猎环继续验收',
    _currentLocation: 'star_duo_outer',
    _visitedLocations: [...new Set([...(bg012Save._visitedLocations || []), 'star_duo_outer'])],
    _ringHuntDeferredUntil: 0,
    huntingKnowledge: {
      experience: 20,
      beasts: {
        野兔: {
          id: '野兔', name: '野兔', knowledge: 20, encounters: 1,
          victories: 1, defeats: 0, escapes: 0, highestTier: 'hundred',
          lastOutcome: 'victory', lastSeen: 1000
        }
      },
      history: [{
        beastId: '野兔', name: '野兔', outcome: 'victory', tier: 'hundred',
        ringHunt: true, eventName: '先前猎魂记录', time: 1000
      }]
    }
  }
  const bg013Dir = path.resolve('../docs/local/bug-dialog-013')
  fs.mkdirSync(bg013Dir, { recursive: true })
  const bg012ReadyContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await bg012ReadyContext.addInitScript(save => {
    if (!localStorage.getItem('dldl_text_rpg_save')) localStorage.setItem('dldl_text_rpg_save', JSON.stringify(save))
  }, bg012ReadySave)
  const bg012ReadyPage = await bg012ReadyContext.newPage()
  const bg012ReadyErrors = []
  bg012ReadyPage.on('pageerror', error => bg012ReadyErrors.push(`pageerror: ${error.message}`))
  bg012ReadyPage.on('console', message => {
    const location = message.location()
    if (message.type() === 'error' && !location.url?.endsWith('/favicon.ico')) {
      bg012ReadyErrors.push(`console: ${message.text()} @ ${location.url || 'unknown'}`)
    }
  })
  await bg012ReadyPage.goto(`${baseUrl}#/game`, { waitUntil: 'networkidle' })
  await bg012ReadyPage.locator('.scene-location-action').waitFor()
  const bg012ReadyRingPriority = bg012ReadyPage.locator('[data-testid="ring-hunt-priority"]')
  await bg012ReadyRingPriority.waitFor()
  assert.match(await bg012ReadyRingPriority.innerText(), /当前任务 · 第1魂环[\s\S]*星斗大森林·外围[\s\S]*不需要等待随机事件/)
  await bg012ReadyRingPriority.locator('.ring-priority-btn').click()
  await bg012ReadyPage.locator('.event-title').filter({ hasText: '第一魂环·年限抉择' }).waitFor()
  await bg012SetFullHp(bg012ReadyPage)
  const bg013RabbitChoice = bg012ReadyPage.getByRole('button', { name: /百年疾风兔/ })
  assert.match(await bg013RabbitChoice.innerText(), /猎魂简记：初识 20\/100 · 1战1胜/)
  const bg012ReadyObjective = bg012ReadyPage.getByTestId('ring-objective')
  assert.match(await bg012ReadyObjective.innerText(), /已抵达猎环区域 · 可以继续[\s\S]*继续猎环[\s\S]*暂缓提醒/)
  const bg012Mobile = await bg012ReadyPage.evaluate(() => ({
    scrollW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    clientW: document.documentElement.clientWidth
  }))
  assert.ok(bg012Mobile.scrollW <= bg012Mobile.clientW + 1, `390px 猎环目标不得横向溢出（${bg012Mobile.scrollW}/${bg012Mobile.clientW}）`)
  await screenshotOnce(bg012ReadyPage, path.join(bg012Dir, 'bg012-after-390-objective-at-destination.png'))
  await screenshotOnce(bg012ReadyPage, path.join(bg012Dir, 'bg012-final-r2-after-390-objective-at-destination.png'))
  await bg012ReadyPage.setViewportSize({ width: 1440, height: 1000 })
  await screenshotOnce(bg012ReadyPage, path.join(bg013Dir, 'bg013-after-1440-choice-prior-knowledge.png'))
  await bg013RabbitChoice.click()
  await bg012ReadyPage.getByRole('button', { name: '普通攻击', exact: true }).click()
  await bg012ReadyPage.locator('.scene-continue').waitFor({ timeout: 10000 })
  await bg012ReadyPage.waitForFunction(() => !document.querySelector('[data-testid="ring-objective"]'))
  const bg012DoneSave = await bg012ReadyPage.evaluate(() => JSON.parse(localStorage.getItem('dldl_text_rpg_save')))
  assert.equal(bg012DoneSave.pendingRingLv, null, '成功获得魂环后应清除持久目标')
  assert.equal(bg012DoneSave._ringHuntDeferredUntil, 0, '成功获得魂环后应清除挂起计数')
  assert.equal(bg012DoneSave.huntingKnowledge.experience, 40, '首环胜利应累计独立猎魂历练')
  assert.deepEqual(
    {
      knowledge: bg012DoneSave.huntingKnowledge.beasts['野兔'].knowledge,
      encounters: bg012DoneSave.huntingKnowledge.beasts['野兔'].encounters,
      victories: bg012DoneSave.huntingKnowledge.beasts['野兔'].victories,
      highestTier: bg012DoneSave.huntingKnowledge.beasts['野兔'].highestTier
    },
    { knowledge: 40, encounters: 2, victories: 2, highestTier: 'hundred' },
    '同种魂兽应累计了解度、实战和最高年限'
  )
  assert.equal(bg012DoneSave.huntingKnowledge.history.length, 2, '猎魂历史应保留旧记录并追加本次结果')
  assert.deepEqual(
    {
      beastId: bg012DoneSave.huntingKnowledge.history[0].beastId,
      outcome: bg012DoneSave.huntingKnowledge.history[0].outcome,
      ringHunt: bg012DoneSave.huntingKnowledge.history[0].ringHunt
    },
    { beastId: '野兔', outcome: 'victory', ringHunt: true }
  )
  assert.match(await bg012ReadyPage.locator('.scene-continue').innerText(), /猎魂历练\+20/)
  const bg013Journal = bg012ReadyPage.getByTestId('hunter-journal')
  assert.match(await bg013Journal.locator('summary').innerText(), /历练 40 · 已识 1 种/)
  await bg013Journal.locator('summary').click()
  const bg013JournalText = await bg013Journal.innerText()
  assert.match(bg013JournalText, /野兔[\s\S]*百年[\s\S]*熟悉 40\/100[\s\S]*2战 2胜/)
  assert.match(bg013JournalText, /最近记录[\s\S]*猎环 · 野兔 · 胜利/)
  await screenshotOnce(bg012ReadyPage, path.join(bg013Dir, 'bg013-after-1440-hunter-journal-expanded.png'))
  await bg012ReadyPage.setViewportSize({ width: 390, height: 844 })
  const bg013Mobile = await bg012ReadyPage.evaluate(() => ({
    scrollW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    clientW: document.documentElement.clientWidth
  }))
  assert.ok(bg013Mobile.scrollW <= bg013Mobile.clientW + 1, `390px 猎魂简记不得横向溢出（${bg013Mobile.scrollW}/${bg013Mobile.clientW}）`)
  await screenshotOnce(bg012ReadyPage, path.join(bg013Dir, 'bg013-after-390-hunter-journal-expanded.png'))
  assert.deepEqual(bg012Errors, [], `BUG-DIALOG-012 挂起页面错误：\n${bg012Errors.join('\n')}`)
  assert.deepEqual(bg012ReadyErrors, [], `BUG-DIALOG-012 继续页面错误：\n${bg012ReadyErrors.join('\n')}`)
  await bg012ReadyContext.close()

  // ============ BUG-DIALOG-014：旧档魂环内部键迁移为玩家可读中文 ============
  const bg014Dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'local', 'bug-dialog-014')
  fs.mkdirSync(bg014Dir, { recursive: true })
  const bg014OldSave = {
    ...bg012ReadySave,
    playerId: 'browser-bug-014-old-ring', name: '旧档中文化验收', level: 12, hp: 173,
    pendingRingLv: null, _ringHuntDeferredUntil: 0,
    rings: [{
      ringId: 'white_ring', skillId: 'ring:white_ring:1', name: '十年魂环',
      tier: 'white', color: 'white', year: 10, source: 'spirit_deer_ten',
      skill: 'spirit_deer_ten魂技', beastId: 'spirit_deer_ten', skillType: '攻击',
      skillDesc: '旧档第一魂技。', skillAnim: 'burst',
      skillDef: { damage: 42, cost: 15, cooldown: 3 }, bonus: { attack: 1, defense: 1, hp: 5 }
    }],
    skills: [{
      skillId: 'ring:white_ring:1', name: 'spirit_deer_ten魂技', source: 'spirit_deer_ten',
      beastId: 'spirit_deer_ten', type: '攻击', desc: '旧档第一魂技。', anim: 'burst',
      damage: 42, cost: 15, cooldown: 3, ring: 1
    }],
    doneEvents: [...new Set([...(bg012ReadySave.doneEvents || []), 'ring_hunt_10'])],
    completedEvents: [...new Set([...(bg012ReadySave.completedEvents || []), 'ring_hunt_10'])]
  }
  const bg014Context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await bg014Context.addInitScript(save => {
    localStorage.setItem('dldl_text_rpg_save', JSON.stringify(save))
  }, bg014OldSave)
  const bg014Page = await bg014Context.newPage()
  const bg014Errors = []
  bg014Page.on('pageerror', error => bg014Errors.push(`pageerror: ${error.message}`))
  bg014Page.on('console', message => {
    const location = message.location()
    if (message.type() === 'error' && !location.url?.endsWith('/favicon.ico')) {
      bg014Errors.push(`console: ${message.text()} @ ${location.url || 'unknown'}`)
    }
  })
  await bg014Page.goto(`${baseUrl}#/game`, { waitUntil: 'networkidle' })
  const bg014RingText = await bg014Page.locator('.ring-card').first().innerText()
  assert.match(bg014RingText, /灵鹿魂技[\s\S]*灵鹿[\s\S]*10年/)
  assert.doesNotMatch(await bg014Page.locator('body').innerText(), /spirit_deer_ten/)
  const bg014State = await bg014Page.evaluate(() => {
    const player = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('player')
    return { ring: player.rings[0], skill: player.skills[0] }
  })
  assert.deepEqual(
    {
      source: bg014State.ring.source, skill: bg014State.ring.skill, beastId: bg014State.ring.beastId,
      skillName: bg014State.skill.name, skillSource: bg014State.skill.source,
      damage: bg014State.skill.damage, cost: bg014State.skill.cost, cooldown: bg014State.skill.cooldown
    },
    {
      source: '灵鹿', skill: '灵鹿魂技', beastId: '灵鹿',
      skillName: '灵鹿魂技', skillSource: '灵鹿', damage: 42, cost: 15, cooldown: 3
    },
    '旧档迁移只能中文化显示字段，必须保留魂技数值与魂环归属'
  )
  await screenshotOnce(bg014Page, path.join(bg014Dir, 'bg014-after-1440-old-save-chinese-ring.png'))
  await screenshotOnce(bg014Page, path.join(bg014Dir, 'bg014-final-after-1440-old-save-chinese-ring.png'))
  await bg014Page.setViewportSize({ width: 390, height: 844 })
  const bg014Mobile = await bg014Page.evaluate(() => ({
    scrollW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    clientW: document.documentElement.clientWidth
  }))
  assert.ok(bg014Mobile.scrollW <= bg014Mobile.clientW + 1, `390px 中文魂环卡不得横向溢出（${bg014Mobile.scrollW}/${bg014Mobile.clientW}）`)
  assert.doesNotMatch(await bg014Page.locator('body').innerText(), /spirit_deer_ten/)
  await screenshotOnce(bg014Page, path.join(bg014Dir, 'bg014-after-390-old-save-chinese-ring.png'))
  await screenshotOnce(bg014Page, path.join(bg014Dir, 'bg014-final-after-390-old-save-chinese-ring.png'))
  assert.deepEqual(bg014Errors, [], `BUG-DIALOG-014 页面错误：\n${bg014Errors.join('\n')}`)
  await bg014Context.close()

  // ============ BUG-DIALOG-015：训练文案与真实等级/魂环状态同步 ============
  const bg015Dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'local', 'bug-dialog-015')
  fs.mkdirSync(bg015Dir, { recursive: true })
  const openBg015Page = async (save, viewport = { width: 1440, height: 1000 }) => {
    const context = await browser.newContext({ viewport })
    await context.addInitScript(initialSave => {
      localStorage.setItem('dldl_text_rpg_save', JSON.stringify(initialSave))
    }, save)
    const targetPage = await context.newPage()
    const errors = []
    targetPage.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
    targetPage.on('console', message => {
      const location = message.location()
      if (message.type() === 'error' &&
          !location.url?.endsWith('/favicon.ico') &&
          !location.url?.endsWith('/assets/beasts/one_eye_wolf.jpg')) {
        errors.push(`console: ${message.text()} @ ${location.url || 'unknown'}`)
      }
    })
    await targetPage.goto(`${baseUrl}#/game`, { waitUntil: 'networkidle' })
    return { context, page: targetPage, errors }
  }
  const bg015StoryBase = {
    ...bg012ReadySave,
    finished: false, hp: 100, pendingRingLv: null, _ringHuntDeferredUntil: 0,
    _storyMilestoneDeferredUntil: 0, _currentLocation: 'star_duo_outer',
    _visitedLocations: [...new Set([...(bg012ReadySave._visitedLocations || []), 'star_duo_outer'])],
    doneEvents: (bg012ReadySave.doneEvents || []).filter(id => !['first_hunt', 'reach_lv10', 'ring_hunt_10'].includes(id)),
    completedEvents: (bg012ReadySave.completedEvents || []).filter(id => !['first_hunt', 'reach_lv10', 'ring_hunt_10'].includes(id))
  }

  const bg015Lv9 = await openBg015Page({
    ...bg015StoryBase, playerId: 'browser-bug-015-lv9', name: '九级训练验收',
    level: 9, exp: 0, rings: [], skills: []
  })
  await bg015Lv9.page.locator('.event-title').filter({ hasText: '第一次魂兽实战' }).waitFor()
  const bg015Lv9EventText = await bg015Lv9.page.locator('.event-text').innerText()
  assert.match(bg015Lv9EventText, /当前 Lv\.9[\s\S]*距离第一魂环资格 Lv\.10 还差 1 级[\s\S]*只积累实战经验，不会授予魂环/)
  assert.doesNotMatch(bg015Lv9EventText, /还远未达到|当前等级未达到 Lv\.10/)
  await screenshotOnce(bg015Lv9.page, path.join(bg015Dir, 'bg015-after-1440-lv9-training-status.png'))
  await screenshotOnce(bg015Lv9.page, path.join(bg015Dir, 'bg015-final-after-1440-lv9-training-status.png'))
  await bg015Lv9.page.getByRole('button', { name: /和队友配合，稳扎稳打/ }).click()
  await bg015Lv9.page.locator('.scene-continue').waitFor()
  assert.match(await bg015Lv9.page.locator('.scene-continue').innerText(), /实战训练完成[\s\S]*当前 Lv\.9[\s\S]*还差 1 级/)
  await screenshotOnce(bg015Lv9.page, path.join(bg015Dir, 'bg015-after-1440-lv9-training-result.png'))
  await screenshotOnce(bg015Lv9.page, path.join(bg015Dir, 'bg015-final-after-1440-lv9-training-result.png'))
  assert.deepEqual(bg015Lv9.errors, [], `BUG-DIALOG-015 Lv.9 页面错误：\n${bg015Lv9.errors.join('\n')}`)
  await bg015Lv9.context.close()

  const bg015OwnedRingSave = {
    ...bg015StoryBase,
    playerId: 'browser-bug-015-owned-ring', name: '十二级补课验收', level: 12, hp: 173,
    rings: bg014OldSave.rings, skills: bg014OldSave.skills,
    doneEvents: [...new Set([...(bg015StoryBase.doneEvents || []), 'ring_hunt_10'])],
    completedEvents: [...new Set([...(bg015StoryBase.completedEvents || []), 'ring_hunt_10'])]
  }
  const bg015Owned = await openBg015Page(bg015OwnedRingSave)
  await bg015Owned.page.locator('.event-title').filter({ hasText: '第一次魂兽实战' }).waitFor()
  assert.match(await bg015Owned.page.locator('.event-text').innerText(), /当前 Lv\.12[\s\S]*已经拥有第1魂环[\s\S]*不会重复授予魂环/)
  await bg015Owned.page.getByRole('button', { name: /和队友配合，稳扎稳打/ }).click()
  await bg015Owned.page.locator('.scene-continue').waitFor()
  const bg015OwnedResult = await bg015Owned.page.locator('.scene-continue').innerText()
  assert.match(bg015OwnedResult, /实战训练完成[\s\S]*不会重复授环[\s\S]*第2魂环将在 Lv\.20 解锁/)
  assert.doesNotMatch(bg015OwnedResult, /未达到 Lv\.10|暂不能吸收魂环/)
  await screenshotOnce(bg015Owned.page, path.join(bg015Dir, 'bg015-after-1440-lv12-owned-ring-training.png'))
  assert.deepEqual(bg015Owned.errors, [], `BUG-DIALOG-015 已有魂环页面错误：\n${bg015Owned.errors.join('\n')}`)
  await bg015Owned.context.close()

  const bg015Lv10 = await openBg015Page({
    ...bg015StoryBase, playerId: 'browser-bug-015-lv10', name: '十级资格验收',
    level: 10, exp: 0, rings: [], skills: []
  })
  await bg015Lv10.page.locator('.scene-location-action').waitFor()
  await bg015Lv10.page.locator('[data-testid="ring-hunt-priority"] .ring-priority-btn').click()
  await bg015Lv10.page.locator('.event-title').filter({ hasText: '第一魂环·年限抉择' }).waitFor()
  assert.match(await bg015Lv10.page.getByTestId('ring-objective').innerText(), /Lv\.10 已解锁[\s\S]*已抵达猎环区域 · 可以继续/)
  const bg015Lv10State = await bg015Lv10.page.evaluate(() => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    return { level: pinia._s.get('player').level, rings: pinia._s.get('player').rings.length, pending: pinia._s.get('event').pendingRingLv }
  })
  assert.deepEqual(bg015Lv10State, { level: 10, rings: 0, pending: 10 })
  assert.doesNotMatch(await bg015Lv10.page.locator('body').innerText(), /当前等级未达到 Lv\.10|暂不能吸收魂环/)
  await screenshotOnce(bg015Lv10.page, path.join(bg015Dir, 'bg015-after-1440-lv10-formal-ring-ready.png'))
  assert.deepEqual(bg015Lv10.errors, [], `BUG-DIALOG-015 Lv.10 页面错误：\n${bg015Lv10.errors.join('\n')}`)
  await bg015Lv10.context.close()

  const bg015Lv12 = await openBg015Page({
    ...bg015StoryBase, playerId: 'browser-bug-015-lv12', name: '十二级资格验收',
    level: 12, exp: 0, rings: [], skills: []
  }, { width: 390, height: 844 })
  await bg015Lv12.page.locator('.scene-location-action').waitFor()
  await bg015Lv12.page.locator('[data-testid="ring-hunt-priority"] .ring-priority-btn').click()
  await bg015Lv12.page.locator('.event-title').filter({ hasText: '第一魂环·年限抉择' }).waitFor()
  const bg015Lv12State = await bg015Lv12.page.evaluate(() => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    return {
      level: pinia._s.get('player').level,
      rings: pinia._s.get('player').rings.length,
      pending: pinia._s.get('event').pendingRingLv,
      scrollW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      clientW: document.documentElement.clientWidth
    }
  })
  assert.deepEqual(
    { level: bg015Lv12State.level, rings: bg015Lv12State.rings, pending: bg015Lv12State.pending },
    { level: 12, rings: 0, pending: 10 }
  )
  assert.ok(bg015Lv12State.scrollW <= bg015Lv12State.clientW + 1, `390px Lv.12 猎环准备页不得横向溢出（${bg015Lv12State.scrollW}/${bg015Lv12State.clientW}）`)
  assert.doesNotMatch(await bg015Lv12.page.locator('body').innerText(), /当前等级未达到 Lv\.10|暂不能吸收魂环/)
  await screenshotOnce(bg015Lv12.page, path.join(bg015Dir, 'bg015-after-390-lv12-formal-ring-ready.png'))
  assert.deepEqual(bg015Lv12.errors, [], `BUG-DIALOG-015 Lv.12 页面错误：\n${bg015Lv12.errors.join('\n')}`)
  await bg015Lv12.context.close()

  assert.deepEqual(runtimeErrors, [], `浏览器运行时错误：\n${runtimeErrors.join('\n')}`)
  console.log('Browser smoke passed: create -> awaken -> events -> shop -> reload -> map travel + BUG-DIALOG-007/009 -> codex -> continue -> checkin + BUG-DIALOG-010 queue -> reload restore -> BUG-DIALOG-002/003/004/008 -> BUG-DIALOG-005 -> BUG-DIALOG-006 -> BUG-DIALOG-011 first-ring strategy + BUG-DIALOG-012 persistent ring objective + BUG-DIALOG-013 hunter journal + BUG-DIALOG-014 Chinese ring names + BUG-DIALOG-015 synchronized hunt status')
} finally {
  if (browser) await browser.close()
  await new Promise(resolve => server.close(resolve))
}
