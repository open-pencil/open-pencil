import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { ChatHarness } from '#tests/helpers/chat/harness'
import {
  CLOUD_AI_MODEL,
  CLOUD_AI_REPLY,
  cloudHomeStorage,
  routeCloudAI
} from '#tests/helpers/cloud/ai'

/** A balance of exactly zero, however the label words it. */
const NO_CREDITS = /^\D*\b0\b\D*$/

test.use({
  storageState: async ({ baseURL }, use) => {
    if (!baseURL) throw new Error('Browser test baseURL is required')
    await use({
      cookies: [],
      origins: [
        {
          origin: new URL(baseURL).origin,
          localStorage: [
            {
              name: 'open-pencil:preferences:v1',
              value: JSON.stringify({ version: 1, onboarding: { aiSetup: 'done' } })
            },
            cloudHomeStorage()
          ]
        }
      ]
    })
  }
})

const closers: (() => Promise<void>)[] = []
test.afterEach(async () => {
  for (const close of closers.splice(0)) await close()
})

/** Sets up a Design model on the signed-in Cloud server, paid for by its workspace. */
async function openCloudChat(
  page: Page,
  baseURL: string | undefined,
  options: Parameters<typeof routeCloudAI>[2]
) {
  const cloud = await routeCloudAI(page, new URL(baseURL ?? '').origin, options)
  closers.push(cloud.close)
  const chat = new ChatHarness(page)
  await chat.open()
  await new CanvasHelper(page).waitForInit()
  await chat.chatTab.click()
  await page.getByTestId('provider-setup-open-settings').click()
  await page.locator('[data-model-id]').first().click()
  await page.getByTestId('settings-model-provider').click()
  await page.getByRole('option', { name: 'OpenPencil Cloud' }).click()
  await expect(page.getByTestId('settings-cloud-ai-workspace')).toContainText('Studio')
  await expect(page.getByTestId('settings-model-editor')).toContainText(CLOUD_AI_MODEL)
  await page.getByLabel('Name').fill('Cloud')
  await page.getByRole('button', { name: 'Save model' }).click()
  await page.getByTestId('app-settings-done').click()
  await chat.input.waitFor()
  return {
    chat,
    cloud,
    credits: page.getByTestId('chat-cloud-credits'),
    toast: page.locator('[data-slot="toast"]')
  }
}

test('a Cloud model answers through the AI service and its credits go down', async ({
  page,
  baseURL
}) => {
  const { chat, cloud, credits } = await openCloudChat(page, baseURL, { allowance: 1000 })
  await expect(credits).toContainText('1,000')

  await chat.submit('Say hello')

  await expect(chat.assistantMessage()).toContainText(CLOUD_AI_REPLY)
  await expect(credits).toContainText('700')
  expect(cloud.unexpected).toEqual([])
})

test('a self-hosted allowance that runs out offers nothing to buy', async ({ page, baseURL }) => {
  const { chat, credits, toast } = await openCloudChat(page, baseURL, { allowance: 300 })
  await chat.submit('Say hello')
  await expect(chat.assistantMessage()).toContainText(CLOUD_AI_REPLY)
  await expect(credits).toHaveText(NO_CREDITS)
  await expect(credits).not.toHaveRole('button')

  await chat.submit('Say hello again')

  await expect(toast).toBeVisible()
  await expect(toast.getByRole('button', { name: 'Manage plan' })).toHaveCount(0)
})

test('a Cloud that bills offers its plan once the credits run out', async ({ page, baseURL }) => {
  const { chat, credits, toast } = await openCloudChat(page, baseURL, {
    allowance: 300,
    billingURL: 'https://billing.example.com/portal'
  })
  await chat.submit('Say hello')
  await expect(chat.assistantMessage()).toContainText(CLOUD_AI_REPLY)
  await expect(credits).toHaveText(NO_CREDITS)
  await expect(credits).toHaveRole('button')

  await chat.submit('Say hello again')

  await expect(toast.getByRole('button', { name: 'Manage plan' })).toBeVisible()
})
