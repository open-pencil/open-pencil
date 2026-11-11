import type { ViteDevServer } from 'vite'

import { serveComponent } from '#tests/helpers/dom-css/component-app'
import {
  disclosureGraph,
  numberFieldGraph,
  radioGroupGraph,
  sectionGraph,
  sliderGraph,
  switchGraph,
  tabsGraph,
  textFieldGraph
} from '#tests/helpers/dom-css/component-graphs'

import { expect, test } from '../fixtures'

for (const framework of ['vue', 'react'] as const) {
  test.describe(`generated ${framework} components in a browser`, () => {
    let server: ViteDevServer | undefined
    test.afterEach(async () => {
      await server?.close()
      server = undefined
    })

    test('a switch toggles on click and its state styles move the thumb', async ({
      page
    }, info) => {
      server = await serveComponent(switchGraph(), framework, info.outputPath('switch'))
      await page.goto(server.resolvedUrls?.local[0] ?? '')
      const control = page.locator('#enabled').getByRole('switch')
      const thumb = page.locator('#enabled [class*="switch__thumb"]')
      await expect(control).toHaveAttribute('data-state', 'unchecked')
      await expect(thumb).toHaveCSS('left', '2px')
      // A caller's class joins the generated one, which still styles the root.
      await expect(control).toHaveClass(/custom/)
      await expect(control).toHaveCSS('width', '40px')

      await control.click()
      await expect(control).toHaveAttribute('data-state', 'checked')
      await expect(thumb).toHaveCSS('left', '20px')
      await expect(control).toHaveCSS('background-color', 'rgb(77, 69, 230)')

      const disabled = page.locator('#disabled').getByRole('switch')
      await disabled.click({ force: true })
      await expect(disabled).toHaveAttribute('data-state', 'unchecked')
    })

    test("the default story's play function turns the switch on", async ({ page }, info) => {
      server = await serveComponent(switchGraph(), framework, info.outputPath('story'))
      await page.goto(server.resolvedUrls?.local[0] ?? '')
      await expect(page.locator('#story')).toHaveAttribute('data-played', 'yes')
      await expect(page.locator('#story').getByRole('switch')).toHaveAttribute(
        'data-state',
        'checked'
      )
    })

    test('a switch in the content of a section is the generated switch, operable', async ({
      page
    }, info) => {
      server = await serveComponent(
        sectionGraph(),
        framework,
        info.outputPath('section'),
        'Section'
      )
      await page.goto(server.resolvedUrls?.local[0] ?? '')
      await page.locator('#enabled').getByRole('button').first().click()
      const nested = page.locator('#enabled').getByRole('switch')
      // It starts as the design draws it and keeps working as a switch.
      await expect(nested).toHaveAttribute('data-state', 'checked')
      await nested.click()
      await expect(nested).toHaveAttribute('data-state', 'unchecked')
      await expect(page.locator('#enabled [class*="switch__thumb"]')).toHaveCSS('left', '2px')
      // The section only places the switch; its own state styles still paint it.
      await expect(nested).toHaveCSS('background-color', 'rgb(204, 214, 224)')
    })

    test('a radio group chooses the radio clicked, starting on the one drawn chosen', async ({
      page
    }, info) => {
      server = await serveComponent(radioGroupGraph(), framework, info.outputPath('plan'), 'Plan')
      await page.goto(server.resolvedUrls?.local[0] ?? '')
      const enabled = page.locator('#enabled')
      await expect(enabled.getByRole('radio', { name: 'Basic' })).toBeChecked()
      await enabled.getByRole('radio', { name: 'Pro' }).click()
      await expect(enabled.getByRole('radio', { name: 'Pro' })).toBeChecked()
      await expect(enabled.getByRole('radio', { name: 'Basic' })).not.toBeChecked()
    })

    test('tabs show the panel of the tab clicked', async ({ page }, info) => {
      server = await serveComponent(tabsGraph(), framework, info.outputPath('tabs'), 'Settings')
      await page.goto(server.resolvedUrls?.local[0] ?? '')
      const enabled = page.locator('#enabled')
      await expect(enabled.getByText('Account settings')).toBeVisible()
      await enabled.getByRole('tab', { name: 'Password' }).click()
      await expect(enabled.getByText('Password settings')).toBeVisible()
      await expect(enabled.getByText('Account settings')).toBeHidden()
    })

    test('a slider moves by its step from the keyboard, within its range', async ({
      page
    }, info) => {
      server = await serveComponent(sliderGraph(), framework, info.outputPath('slider'))
      await page.goto(server.resolvedUrls?.local[0] ?? '')
      const thumb = page.locator('#enabled').getByRole('slider')
      await expect(thumb).toHaveAttribute('aria-valuenow', '60')
      // The root lays out at the size the design draws, though Reka and Radix render a span.
      await expect(page.locator('#enabled > *').first()).toHaveCSS('width', '200px')
      await thumb.focus()
      await page.keyboard.press('ArrowRight')
      await expect(thumb).toHaveAttribute('aria-valuenow', '65')
      await page.keyboard.press('End')
      await page.keyboard.press('ArrowRight')
      await expect(thumb).toHaveAttribute('aria-valuenow', '100')
    })

    test('a number field steps with its buttons and settles within its range', async ({
      page
    }, info) => {
      server = await serveComponent(numberFieldGraph(), framework, info.outputPath('quantity'))
      await page.goto(server.resolvedUrls?.local[0] ?? '')
      const enabled = page.locator('#enabled')
      const field = enabled.getByRole('spinbutton')
      await expect(field).toHaveValue('9')
      await enabled.getByRole('button', { name: 'Increase' }).click()
      await expect(field).toHaveValue('10')
      // A value typed past the maximum settles on it once the field is left.
      await field.fill('42')
      await field.blur()
      await expect(field).toHaveValue('10')
    })

    test('a text field takes its filled look while it has words', async ({ page }, info) => {
      server = await serveComponent(textFieldGraph(), framework, info.outputPath('email'))
      await page.goto(server.resolvedUrls?.local[0] ?? '')
      const field = page.locator('#enabled').getByRole('textbox')
      const root = page.locator('#enabled > *').first()
      await expect(field).toHaveAttribute('placeholder', 'Email')
      await expect(root).toHaveCSS('background-color', 'rgb(255, 255, 255)')
      await field.fill('grace@example.com')
      await expect(root).toHaveCSS('background-color', 'rgb(242, 245, 247)')
      await field.fill('')
      await expect(root).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    })

    test('a collapsible shows its content when its trigger opens it', async ({ page }, info) => {
      server = await serveComponent(disclosureGraph(), framework, info.outputPath('disclosure'))
      await page.goto(server.resolvedUrls?.local[0] ?? '')
      const content = page.locator('#enabled [class*="disclosure__content"]')
      await expect(content).toBeHidden()
      await page.locator('#enabled').getByRole('button').click()
      await expect(page.locator('#enabled > [data-state]').first()).toHaveAttribute(
        'data-state',
        'open'
      )
      await expect(content).toBeVisible()
      await expect(content).toHaveCSS('top', '12px')
    })
  })
}
