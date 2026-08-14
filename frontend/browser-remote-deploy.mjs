import fs from 'node:fs'
import { chromium } from 'playwright-core'

const targetUrl = process.env.TARGET_URL || 'http://49.233.157.164/'
const screenshotPath = process.env.SCREENSHOT_PATH
const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
].filter(Boolean)
const executablePath = chromeCandidates.find(candidate => fs.existsSync(candidate))

if (!executablePath) throw new Error('未找到 Chrome')

const browser = await chromium.launch({ executablePath, headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
const consoleErrors = []
const failedRequests = []
const badResponses = []

page.on('pageerror', error => consoleErrors.push(`pageerror: ${error.message}`))
page.on('console', message => {
  if (message.type() === 'error') consoleErrors.push(`console: ${message.text()}`)
})
page.on('requestfailed', request => {
  failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`.trim())
})
page.on('response', response => {
  if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`)
})

try {
  const response = await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 })
  const newJourney = page.getByRole('button', { name: /新的旅程/ })
  const newJourneyCount = await newJourney.count()
  const title = await page.title()
  const viewport = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    height: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight
  }))

  if (newJourneyCount !== 1) throw new Error(`“新的旅程”按钮数量异常: ${newJourneyCount}`)
  await newJourney.click()
  await page.waitForURL(url => url.hash === '#/create', { timeout: 10000 })
  await page.locator('.create-screen').waitFor({ state: 'visible', timeout: 10000 })
  await page.waitForTimeout(800)
  const creationHeadingCount = await page.getByText('写下你的名字', { exact: true }).count()

  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true })

  const result = {
    targetUrl,
    status: response?.status(),
    title,
    routeAfterClick: new URL(page.url()).hash,
    creationHeadingCount,
    viewport,
    consoleErrors,
    failedRequests,
    badResponses
  }
  console.log(JSON.stringify(result, null, 2))

  if (response?.status() !== 200 || creationHeadingCount < 1 || consoleErrors.length || failedRequests.length || badResponses.length) {
    process.exitCode = 1
  }
} finally {
  await browser.close()
}
