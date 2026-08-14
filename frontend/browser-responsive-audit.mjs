import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { chromium } from 'playwright-core'

let localServer
let baseUrl = process.env.TARGET_URL
if (!baseUrl) {
  const require = createRequire(import.meta.url)
  const { app } = require('../server.js')
  localServer = await new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server))
    server.once('error', reject)
  })
  baseUrl = `http://127.0.0.1:${localServer.address().port}/`
}
const outputDir = process.env.OUTPUT_DIR || path.resolve('../docs/responsive-audit')
const executablePath = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
].filter(Boolean).find(fs.existsSync)
if (!executablePath) throw new Error('未找到 Chrome')
fs.mkdirSync(outputDir, { recursive: true })

const browser = await chromium.launch({ executablePath, headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const page = await context.newPage()
const runtimeErrors = []
page.on('pageerror', error => runtimeErrors.push(`pageerror: ${error.message}`))
page.on('console', message => { if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`) })
page.on('requestfailed', request => runtimeErrors.push(`request: ${request.url()} ${request.failure()?.errorText || ''}`))
page.on('response', response => { if (response.status() >= 400) runtimeErrors.push(`response ${response.status()}: ${response.url()}`) })

async function metrics(label) {
  const result = await page.evaluate(() => {
    const doc = document.documentElement
    const visible = [...document.querySelectorAll('button, summary, input, [role="button"]')]
      .filter(element => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0
      })
    const smallTargets = visible.map(element => {
      const rect = element.getBoundingClientRect()
      return { text: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 36), width: Math.round(rect.width), height: Math.round(rect.height) }
    }).filter(item => item.width < 44 || item.height < 44)
    const outside = [...document.querySelectorAll('body *')].filter(element => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1)
    }).slice(0, 20).map(element => ({ tag: element.tagName, className: String(element.className || '').slice(0, 80) }))
    const readRect = selector => {
      const element = document.querySelector(selector)
      if (!element) return null
      const rect = element.getBoundingClientRect()
      return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), width: Math.round(rect.width), height: Math.round(rect.height), scrollHeight: element.scrollHeight }
    }
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, scrollHeight: doc.scrollHeight, clientHeight: doc.clientHeight },
      smallTargets,
      outside,
      status: readRect('.status-panel'),
      topbar: readRect('.game-topbar'),
      scene: readRect('.scene-area'),
      map: readRect('.map-page')
    }
  })
  console.log(JSON.stringify({ label, ...result }, null, 2))
  return result
}

async function snap(name) {
  await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: false })
  return metrics(name)
}

async function waitForVisuals() {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForFunction(() => {
    const visibleImages = [...document.images].filter(image => {
      const rect = image.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })
    return visibleImages.every(image => image.complete && image.naturalWidth > 0)
  }, undefined, { timeout: 15000 })
  await page.waitForTimeout(300)
}

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await snap('390x844-title')
  await page.getByRole('button', { name: /新的旅程/ }).click()
  await page.getByLabel('魂师名字').fill('小风')
  await page.getByRole('button', { name: /下一步/ }).click()
  await page.locator('.origin-card').first().click()
  await page.getByRole('button', { name: /进行武魂觉醒/ }).click()
  await page.getByRole('button', { name: /开始觉醒/ }).click()
  const confirm = page.getByRole('button', { name: /就是它了/ })
  await confirm.waitFor({ state: 'visible', timeout: 10000 })
  await confirm.click()
  await page.waitForURL(url => url.hash === '#/game', { timeout: 10000 })
  await page.locator('.scene-area').waitFor({ state: 'visible' })
  await waitForVisuals()
  await snap('390x844-game')
  const statusToggle = page.locator('.mobile-status-toggle')
  await statusToggle.click()
  await snap('390x844-game-expanded')
  await statusToggle.click()
  const commonMenu = page.getByText('常用', { exact: true })
  await commonMenu.click()
  await page.getByRole('button', { name: '地图', exact: true }).waitFor({ state: 'visible' })
  await snap('390x844-game-menu')
  await commonMenu.click()

  await page.setViewportSize({ width: 768, height: 1024 })
  await page.waitForTimeout(200)
  await snap('768x1024-game')

  await page.setViewportSize({ width: 1180, height: 820 })
  await page.waitForTimeout(200)
  await snap('1180x820-game')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${baseUrl}#/map`, { waitUntil: 'networkidle' })
  await page.locator('.map-page').waitFor({ state: 'visible' })
  await page.locator('.world-map').waitFor({ state: 'visible', timeout: 20000 })
  await waitForVisuals()
  await snap('390x844-map')

  console.log(JSON.stringify({ runtimeErrors }, null, 2))
  if (runtimeErrors.length) process.exitCode = 1
} finally {
  await browser.close()
  if (localServer) await new Promise(resolve => localServer.close(resolve))
}
