import { expect, test, type BrowserContext, type Page } from '@playwright/test'

import {
  configureCloudBrowserStorage,
  readCloudBrowserStorage
} from '#tests/helpers/cloud/browser-storage'
import { toolbarToolTestId } from '#tests/helpers/test-ids'

const cloudURL = process.env.OPENPENCIL_CLOUD_E2E_URL
const workspaceId = process.env.OPENPENCIL_CLOUD_E2E_WORKSPACE_ID
const documentId = process.env.OPENPENCIL_CLOUD_E2E_DOCUMENT_ID
const collaborationURL = process.env.OPENPENCIL_CLOUD_E2E_COLLABORATION_URL
const enabled = process.env.OPENPENCIL_CLOUD_E2E === '1'

async function configureCloudContext(
  context: BrowserContext,
  session: 'owner' | 'recipient' | null = null
): Promise<void> {
  if (!cloudURL || !workspaceId) throw new Error('Cloud browser E2E fixture is unavailable')
  await context.addInitScript(configureCloudBrowserStorage, {
    serverURL: cloudURL,
    workspaceId
  })
  if (session) {
    await context.addCookies([
      {
        name: 'openpencil-cloud-e2e-session',
        value: session,
        url: cloudURL,
        httpOnly: true,
        sameSite: 'Lax'
      }
    ])
  }
}

async function openOwnerDocument(page: Page): Promise<void> {
  if (!documentId) throw new Error('Cloud browser E2E document is unavailable')
  await page.goto('/storage?test')
  const preferences = await page.evaluate(readCloudBrowserStorage)
  expect(preferences.provider).toBe('openpencil-cloud')
  expect(preferences.preferences).toContain(workspaceId ?? '')
  const browserCloud = await page.evaluate(
    async ({ serverURL, selectedWorkspaceId }) => {
      const discovery = await fetch(`${serverURL}/.well-known/openpencil`).then(
        async (response) => ({
          status: response.status,
          body: await response.text()
        })
      )
      const session = await fetch(`${serverURL}/api/session`, { credentials: 'include' }).then(
        async (response) => ({ status: response.status, body: await response.text() })
      )
      const documents = await fetch(
        `${serverURL}/api/workspaces/${selectedWorkspaceId}/documents`,
        { credentials: 'include' }
      ).then(async (response) => ({ status: response.status, body: await response.text() }))
      return { discovery, session, documents }
    },
    { serverURL: cloudURL, selectedWorkspaceId: workspaceId }
  )
  expect(browserCloud.discovery.status).toBe(200)
  expect(browserCloud.session.status).toBe(200)
  expect(browserCloud.documents.status).toBe(200)
  await expect(page.getByText('Cloud sharing fixture')).toBeVisible({ timeout: 15_000 })
  await page.locator(`[data-document-id="${documentId}"]`).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText('Cloud sharing fixture').first()).toBeVisible()
}

test.describe('Cloud sharing browser journey', () => {
  test.skip(!enabled, 'Run through `bun run --filter @open-pencil/cloud test:e2e:browser`')
  test.describe.configure({ mode: 'serial' })

  test('owner creates a viewer link and recipient opens it without retaining the fragment', async ({
    browser
  }) => {
    test.setTimeout(150_000)
    const ownerContext = await browser.newContext({
      permissions: ['clipboard-read', 'clipboard-write']
    })
    await configureCloudContext(ownerContext, 'owner')
    const owner = await ownerContext.newPage()
    await openOwnerDocument(owner)

    await expect
      .poll(
        () =>
          owner.evaluate(() => {
            const store = window.openPencil?.getStore?.()
            return {
              binding: store?.getStorageBinding(),
              accessMode: store?.state.accessMode
            }
          }),
        { timeout: 15_000 }
      )
      .toEqual({
        binding: { providerId: 'openpencil-cloud', documentId },
        accessMode: 'owner'
      })
    const initialOwnerTicket = await owner.evaluate(
      async ({ serverURL, id }) =>
        fetch(`${serverURL}/api/documents/${id}/collaboration-ticket`, {
          method: 'POST',
          credentials: 'include'
        }).then((response) => response.json()),
      { serverURL: cloudURL, id: documentId }
    )
    expect(initialOwnerTicket.ticket).toMatchObject({
      provider: 'hocuspocus',
      serverURL: collaborationURL,
      serverEnforcedWrites: true
    })
    await expect(owner.getByTestId('cloud-share-button')).toBeVisible({ timeout: 15_000 })
    await owner.getByTestId('cloud-share-button').click()
    const dialog = owner.getByRole('dialog', { name: /Share “Cloud sharing fixture”/ })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Create and copy link' }).click()
    await expect(dialog.getByText('This link is shown once.')).toBeVisible()
    const shareURL = await owner.evaluate(() => navigator.clipboard.readText())
    expect(shareURL).toContain('/cloud/share/')
    expect(shareURL).toContain('#')

    const recipientContext = await browser.newContext()
    await configureCloudContext(recipientContext)
    const recipient = await recipientContext.newPage()
    const errors: string[] = []
    recipient.on('console', (message) => {
      if (message.type() === 'error' && !message.text().includes('401 (Unauthorized)')) {
        errors.push(message.text())
      }
    })
    recipient.on('pageerror', (error) => errors.push(error.message))
    await recipient.goto(shareURL)
    await expect(recipient.getByTestId('editor-root')).toBeVisible()
    await expect(recipient).toHaveURL(/\/cloud\/share\/[^#?]+\?server=/)
    expect(recipient.url()).not.toContain('#')
    await expect(recipient.getByText('Cloud sharing fixture').first()).toBeVisible({
      timeout: 15_000
    })

    await expect
      .poll(
        () =>
          recipient.evaluate(() => {
            const store = window.openPencil?.getStore?.()
            return {
              mode: store?.state.accessMode,
              canMutate: store?.canMutate()
            }
          }),
        { timeout: 15_000 }
      )
      .toEqual({ mode: 'view', canMutate: false })
    expect(errors).toEqual([])

    await recipient.getByTestId(toolbarToolTestId('RECTANGLE')).click()
    expect(await recipient.evaluate(() => window.openPencil?.getStore?.().state.activeTool)).toBe(
      'SELECT'
    )

    const viewerSyncedNodeId = await owner.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('Editor store is unavailable')
      return store.createShape('RECTANGLE', 20, 20, 40, 30, undefined, 'Viewer relay check')
    })
    await expect
      .poll(
        () =>
          recipient.evaluate(
            (nodeId) => window.openPencil?.getStore?.().graph.getNode(nodeId)?.name,
            viewerSyncedNodeId
          ),
        { timeout: 15_000 }
      )
      .toBe('Viewer relay check')
    await expect(
      recipient.evaluate(() =>
        window.openPencil?.getStore?.().createShape('RECTANGLE', 0, 0, 10, 10)
      )
    ).rejects.toThrow('Document is read-only')

    await dialog.getByRole('button', { name: 'Share settings' }).click()
    const settingsDialog = owner.getByRole('dialog', { name: 'Share settings' })
    await settingsDialog.getByLabel('Link permission').click()
    await owner.getByRole('option', { name: 'Can edit', exact: true }).click()
    await settingsDialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog.getByText('Can edit', { exact: true })).toHaveCount(2)

    await recipientContext.close()

    const editorContext = await browser.newContext()
    await configureCloudContext(editorContext)
    const editorRecipient = await editorContext.newPage()
    await editorRecipient.goto(shareURL)
    await expect(editorRecipient.getByText('Cloud sharing fixture').first()).toBeVisible({
      timeout: 15_000
    })
    await expect
      .poll(
        () =>
          editorRecipient.evaluate(() => {
            const store = window.openPencil?.getStore?.()
            return {
              mode: store?.state.accessMode,
              canMutate: store?.canMutate()
            }
          }),
        { timeout: 15_000 }
      )
      .toEqual({ mode: 'edit', canMutate: true })

    const syncedNodeId = await owner.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('Editor store is unavailable')
      return store.createShape('RECTANGLE', 40, 40, 80, 60)
    })
    await expect
      .poll(
        () =>
          editorRecipient.evaluate(
            (nodeId) => window.openPencil?.getStore?.().graph.getNode(nodeId)?.type,
            syncedNodeId
          ),
        { timeout: 15_000 }
      )
      .toBe('RECTANGLE')

    const shareId = new URL(shareURL).pathname.split('/').at(-1)
    if (!shareId) throw new Error('Share URL does not contain a share ID')
    const oldSecret = new URL(shareURL).hash.slice(1)
    const originalTicket = await owner.evaluate(
      async ({ serverURL, id, secret }) =>
        fetch(`${serverURL}/api/shares/${id}/collaboration-ticket`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret, guestId: 'browser-e2e-original-epoch' })
        }).then((response) => response.json()),
      { serverURL: cloudURL, id: shareId, secret: oldSecret }
    )

    await dialog.getByRole('button', { name: 'Regenerate link' }).click()
    await expect.poll(() => owner.evaluate(() => navigator.clipboard.readText())).not.toBe(shareURL)
    const regeneratedURL = await owner.evaluate(() => navigator.clipboard.readText())
    const regeneratedSecret = new URL(regeneratedURL).hash.slice(1)
    const oldResolutionStatus = await owner.evaluate(
      async ({ serverURL, id, secret }) =>
        fetch(`${serverURL}/api/shares/${id}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret })
        }).then((response) => response.status),
      { serverURL: cloudURL, id: shareId, secret: oldSecret }
    )
    expect(oldResolutionStatus).toBe(404)
    const regeneratedTicket = await owner.evaluate(
      async ({ serverURL, id, secret }) =>
        fetch(`${serverURL}/api/shares/${id}/collaboration-ticket`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret, guestId: 'browser-e2e-epoch-check' })
        }).then((response) => response.json()),
      { serverURL: cloudURL, id: shareId, secret: regeneratedSecret }
    )
    expect(regeneratedTicket.ticket.roomEpoch).toBe(originalTicket.ticket.roomEpoch)

    const oldLinkContext = await browser.newContext()
    await configureCloudContext(oldLinkContext)
    const oldLink = await oldLinkContext.newPage()
    const oldResponse = await oldLink.goto(shareURL)
    expect(oldResponse?.ok()).toBe(true)
    await expect(oldLink.getByText('Cloud sharing fixture').first()).toHaveCount(0, {
      timeout: 5_000
    })
    await oldLinkContext.close()

    const regeneratedContext = await browser.newContext()
    await configureCloudContext(regeneratedContext)
    const regeneratedRecipient = await regeneratedContext.newPage()
    await regeneratedRecipient.goto(regeneratedURL)
    await expect(regeneratedRecipient.getByText('Cloud sharing fixture').first()).toBeVisible({
      timeout: 15_000
    })

    await dialog.getByRole('button', { name: 'Disable link' }).click()
    await expect(dialog.getByText('Restricted', { exact: true })).toBeVisible()
    const revokedResolutionStatus = await owner.evaluate(
      async ({ serverURL, id, secret }) =>
        fetch(`${serverURL}/api/shares/${id}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret })
        }).then((response) => response.status),
      { serverURL: cloudURL, id: shareId, secret: regeneratedSecret }
    )
    expect(revokedResolutionStatus).toBe(404)
    const ownerTicketStatus = await owner.evaluate(
      async ({ serverURL, id }) =>
        fetch(`${serverURL}/api/documents/${id}/collaboration-ticket`, {
          method: 'POST',
          credentials: 'include'
        }).then((response) => response.status),
      { serverURL: cloudURL, id: documentId }
    )
    expect(ownerTicketStatus).toBe(200)
    const revokedContext = await browser.newContext()
    await configureCloudContext(revokedContext)
    const revokedRecipient = await revokedContext.newPage()
    await revokedRecipient.goto(regeneratedURL)
    await expect(revokedRecipient.getByText('Cloud sharing fixture').first()).toHaveCount(0, {
      timeout: 5_000
    })

    await revokedContext.close()
    await regeneratedContext.close()
    await editorContext.close()

    const authenticatedContext = await browser.newContext()
    await configureCloudContext(authenticatedContext, 'recipient')
    const authenticatedRecipient = await authenticatedContext.newPage()
    const invitationResponse = await owner.evaluate(
      async ({ serverURL, id }) => {
        const response = await fetch(`${serverURL}/api/documents/${id}/invitations`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'recipient@cloud-e2e.test', permission: 'view' })
        })
        if (!response.ok) throw new Error(`Invitation creation failed with HTTP ${response.status}`)
        return response.json()
      },
      { serverURL: cloudURL, id: documentId }
    )
    const invitationCapability = invitationResponse
    const invitationURL = new URL(
      `/cloud/invitations/${invitationCapability.invitation.id}?server=${encodeURIComponent(cloudURL ?? '')}#${invitationCapability.token}`,
      process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:1420'
    ).href
    await authenticatedRecipient.goto(invitationURL)
    await expect(authenticatedRecipient).toHaveURL(/\/cloud\/invitations\/[^#?]+\?server=/)
    expect(authenticatedRecipient.url()).not.toContain('#')
    await expect(authenticatedRecipient.getByText('Cloud sharing fixture')).toBeVisible()
    await authenticatedRecipient.getByRole('button', { name: 'Accept invitation' }).click()
    await expect(authenticatedRecipient).toHaveURL(/\/storage$/)
    expect(
      await authenticatedRecipient.evaluate(
        async ({ serverURL, invitationId, token }) =>
          fetch(`${serverURL}/api/invitations/${invitationId}/accept`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
          }).then((response) => response.status),
        {
          serverURL: cloudURL,
          invitationId: invitationCapability.invitation.id,
          token: invitationCapability.token
        }
      )
    ).toBe(404)
    const authenticatedTicket = await authenticatedRecipient.evaluate(
      async ({ serverURL, id }) =>
        fetch(`${serverURL}/api/documents/${id}/collaboration-ticket`, {
          method: 'POST',
          credentials: 'include'
        }).then((response) => response.json()),
      { serverURL: cloudURL, id: documentId }
    )
    expect(authenticatedTicket.ticket.principal).toEqual({
      kind: 'user',
      userId: '22222222-2222-4222-8222-222222222222',
      email: 'recipient@cloud-e2e.test',
      name: 'Cloud Recipient'
    })
    expect(authenticatedTicket.ticket.permission).toBe('view')

    await owner.evaluate(
      async ({ serverURL, id, userId }) => {
        const response = await fetch(`${serverURL}/api/documents/${id}/grants/${userId}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permission: 'edit' })
        })
        if (!response.ok) throw new Error(`Grant update failed with HTTP ${response.status}`)
      },
      { serverURL: cloudURL, id: documentId, userId: authenticatedTicket.ticket.principal.userId }
    )
    const editTicket = await authenticatedRecipient.evaluate(
      async ({ serverURL, id }) =>
        fetch(`${serverURL}/api/documents/${id}/collaboration-ticket`, {
          method: 'POST',
          credentials: 'include'
        }).then((response) => response.json()),
      { serverURL: cloudURL, id: documentId }
    )
    expect(editTicket.ticket.permission).toBe('edit')

    await owner.evaluate(
      async ({ serverURL, id, userId }) => {
        const response = await fetch(`${serverURL}/api/documents/${id}/grants/${userId}`, {
          method: 'DELETE',
          credentials: 'include'
        })
        if (!response.ok) throw new Error(`Grant revocation failed with HTTP ${response.status}`)
      },
      { serverURL: cloudURL, id: documentId, userId: authenticatedTicket.ticket.principal.userId }
    )
    const revokedGrantTicketStatus = await authenticatedRecipient.evaluate(
      async ({ serverURL, id }) =>
        fetch(`${serverURL}/api/documents/${id}/collaboration-ticket`, {
          method: 'POST',
          credentials: 'include'
        }).then((response) => response.status),
      { serverURL: cloudURL, id: documentId }
    )
    expect(revokedGrantTicketStatus).toBe(404)

    await authenticatedContext.close()
    await ownerContext.close()
  })
})
