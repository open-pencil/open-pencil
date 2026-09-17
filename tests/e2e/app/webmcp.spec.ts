import { test, expect } from '@playwright/test'
import * as v from 'valibot'

const pageResult = v.object({
  ok: v.literal(true),
  result: v.object({ id: v.string(), name: v.string() })
})

test.use({
  launchOptions: { args: ['--enable-blink-features=WebMCP', '--enable-unsafe-swiftshader'] }
})

test('native WebMCP discovery, editing, validation and undo', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Native WebMCP requires a supporting Chromium build')
  await page.goto('/?test')
  await expect(page.getByRole('button', { name: 'Add page', exact: true })).toBeVisible()
  test.skip(
    !(await page.evaluate(() => Boolean(document.modelContext))),
    'Browser lacks document.modelContext'
  )

  const cdp = await page.context().newCDPSession(page)
  const frames = new Map<string, string>()
  const responses = new Map<string, { status: string; output: unknown }>()
  cdp.on('WebMCP.toolsAdded', ({ tools }) => {
    for (const tool of tools) frames.set(tool.name, tool.frameId)
  })
  cdp.on('WebMCP.toolResponded', (response) => {
    responses.set(response.invocationId, { status: response.status, output: response.output })
  })

  async function invoke(name: string, input: Record<string, string> = {}) {
    await expect.poll(() => frames.has(name)).toBe(true)
    const frameId = frames.get(name)
    if (!frameId) throw new Error(`Missing native WebMCP tool ${name}`)
    const { invocationId } = await cdp.send('WebMCP.invokeTool', { frameId, toolName: name, input })
    await expect.poll(() => responses.has(invocationId)).toBe(true)
    const response = responses.get(invocationId)
    if (!response) throw new Error('Missing tool response')
    return {
      status: response.status,
      output:
        typeof response.output === 'string'
          ? (JSON.parse(response.output) as unknown)
          : response.output
    }
  }

  try {
    await cdp.send('WebMCP.enable')
    expect(frames.size).toBe(0)
    await page.getByTestId('app-settings-trigger').click()
    await page.getByTestId('settings-section-mcp').click()
    const access = page.getByRole('combobox', { name: 'Browser agent access' })
    await expect(access).toHaveText('Off')
    await access.click()
    await page.getByRole('option', { name: 'Edit', exact: true }).click()
    await page.getByTestId('app-settings-done').click()
    await expect.poll(() => frames.has('update_node')).toBe(true)
    expect(frames.has('eval')).toBe(false)
    expect(frames.has('save_file')).toBe(false)
    const current = await invoke('get_current_page')
    expect(current.status).toBe('Completed')
    const original = v.parse(pageResult, current.output).result
    expect(
      (await invoke('update_node', { id: original.id, name: 'Browser agent page' })).status
    ).toBe('Completed')
    await expect(
      page.getByRole('button', { name: 'Browser agent page', exact: true })
    ).toBeVisible()
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
    await page.keyboard.press(`${modifier}+z`)
    expect(v.parse(pageResult, (await invoke('get_current_page')).output).result.name).toBe(
      original.name
    )
    await page.keyboard.press(`${modifier}+Shift+z`)
    expect(v.parse(pageResult, (await invoke('get_current_page')).output).result.name).toBe(
      'Browser agent page'
    )
    expect((await invoke('update_node', { name: 'Missing id' })).status).toBe('Error')
    expect(v.parse(pageResult, (await invoke('get_current_page')).output).result.name).toBe(
      'Browser agent page'
    )
    await page.getByRole('button', { name: 'Add page', exact: true }).click()
    const secondPage = v.parse(pageResult, (await invoke('get_current_page')).output).result
    expect(secondPage.id).not.toBe(original.id)
    expect((await invoke('update_node', { id: original.id, name: 'Other page edit' })).status).toBe(
      'Completed'
    )
    await page.keyboard.press(`${modifier}+z`)
    expect(v.parse(pageResult, (await invoke('get_current_page')).output).result.id).toBe(
      secondPage.id
    )
    expect(
      v.parse(pageResult, (await invoke('get_node', { id: original.id })).output).result.name
    ).toBe('Browser agent page')
  } finally {
    await cdp.detach()
  }
})
