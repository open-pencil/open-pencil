import { chromium } from '@playwright/test'

const out = process.argv[2]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors: string[] = []
page.on('pageerror', (error) => errors.push(error.message.slice(0, 220)))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text().slice(0, 220))
})
await page.goto('http://localhost:5179/')
await page.waitForTimeout(25000)
await page.getByRole('heading', { name: 'Components that work', exact: true }).scrollIntoViewIfNeeded()
await page.evaluate(() => window.scrollBy(0, 120))
await page.waitForTimeout(7000)
console.log(
  'islands',
  await page.evaluate(() => {
    const layers = document.querySelectorAll('[data-test-id="play-islands"]')
    const hosts = document.querySelectorAll('[data-island]')
    const roots = [...hosts].map((host) => {
      const root = host.shadowRoot ?? host.firstElementChild?.shadowRoot
      return root ? root.querySelectorAll('[role="switch"]').length : -1
    })
    return { layers: layers.length, hosts: hosts.length, switchesPerHost: roots }
  })
)
const toggle = page.locator('[data-island] [role=switch]').first()
console.log('switch before', await toggle.getAttribute('data-state', { timeout: 5000 }).catch((e) => String(e).slice(0, 80)))
await toggle.click({ timeout: 5000 }).catch((e) => console.log('click failed', String(e).slice(0, 120)))
await page.waitForTimeout(500)
console.log('switch after', await toggle.getAttribute('data-state', { timeout: 5000 }).catch(() => 'n/a'))
await page.screenshot({ path: `${out}/b-interactive-toggled.png` })
console.log('errors', [...new Set(errors)].slice(0, 10))
await browser.close()
