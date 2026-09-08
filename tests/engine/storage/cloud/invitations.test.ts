import { afterEach, expect, test } from 'bun:test'

import { createInvitationAcceptance } from '@/app/cloud/documents/acceptance'
import { resolveInvitedCloudDocument } from '@/app/cloud/documents/invitations'
import { connectCloudProfile, useCloudConnectionProfiles } from '@/app/cloud/instances/profiles'
import {
  readStoragePreferences,
  writeStoragePreference
} from '@/app/integrations/storage/preferences'

const profiles = useCloudConnectionProfiles()
const originalProfiles = [...profiles.profiles.value]
const originalActive = profiles.activeProfileId.value
const originalPreferences = { ...readStoragePreferences('openpencil-cloud') }
afterEach(() => {
  profiles.profiles.value = originalProfiles
  profiles.activeProfileId.value = originalActive
  for (const field of ['server-url', 'workspace-id'])
    writeStoragePreference('openpencil-cloud', field, originalPreferences[field] ?? '')
})

test('invited document retains the issuing instance and workspace without switching selection', async () => {
  const selected = await connectCloudProfile({
    kind: 'self-hosted',
    serverURL: 'https://selected.example'
  })
  const documentId = crypto.randomUUID()
  const workspaceId = crypto.randomUUID()
  const target = await resolveInvitedCloudDocument('https://inviter.example', documentId, {
    async getDocument(id) {
      expect(id).toBe(documentId)
      return {
        document: {
          id,
          workspaceId,
          name: 'Invited design',
          currentRevisionId: null,
          version: 1,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01'
        },
        revisionId: crypto.randomUUID(),
        byteSize: 1,
        checksum: '',
        contentType: 'application/octet-stream',
        download: {
          url: 'https://objects.example/document',
          method: 'GET',
          headers: {},
          expiresAt: '2026-01-01'
        }
      }
    }
  })
  expect(profiles.activeProfileId.value).toBe(selected.id)
  expect(readStoragePreferences('openpencil-cloud')['server-url']).toBe(selected.serverURL)
  const owner = profiles.profiles.value.find(
    (profile) => profile.serverURL === 'https://inviter.example'
  )
  expect(owner).toBeDefined()
  expect(target.binding).toEqual({
    providerId: 'openpencil-cloud',
    connectionId: owner?.id,
    workspaceId,
    documentId
  })
  expect(target.document).toMatchObject({ id: documentId, name: 'Invited design' })
})

test('accepted invitation retries document resolution without consuming the token again', async () => {
  let accepted = 0
  let downloaded = 0
  const workflow = createInvitationAcceptance('https://inviter.example', 'invitation', 'secret')
  const client = {
    async acceptDocumentInvitation() {
      accepted++
      return {
        id: 'grant',
        documentId: 'document',
        userId: 'user',
        permission: 'view' as const,
        createdBy: 'owner',
        createdAt: '',
        updatedAt: ''
      }
    },
    async getDocument(): Promise<never> {
      downloaded++
      throw new Error('Offline')
    }
  }
  await expect(workflow.open(client)).rejects.toThrow('Offline')
  expect(workflow.accepted).toBe(true)
  await expect(workflow.open(client)).rejects.toThrow('Offline')
  expect(accepted).toBe(1)
  expect(downloaded).toBe(2)
})

test('failed document access does not add an instance', async () => {
  const before = profiles.profiles.value.length
  await expect(
    resolveInvitedCloudDocument('https://unavailable.example', crypto.randomUUID(), {
      async getDocument() {
        throw new Error('Access denied')
      }
    })
  ).rejects.toThrow('Access denied')
  expect(profiles.profiles.value).toHaveLength(before)
})
