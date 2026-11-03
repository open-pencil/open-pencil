import { AI_PROVIDERS } from '@open-pencil/core/constants'

import { aiModelSettings, modelConnectionCredentialRef } from '@/app/ai/models'
import { VECTORIZE_CREDENTIAL_REFS } from '@/app/editor/vectorize/credentials'
import { mcpConnectionSettings, mcpConnectionCredentialRef } from '@/app/integrations/mcp'
import { storageCredentialRefs, storageProviderRegistry } from '@/app/integrations/storage'
import {
  PEXELS_CREDENTIAL,
  UNSPLASH_CREDENTIAL,
  providerCredentialRef
} from '@/app/settings/credentials/migration'
import { credentialKey } from '@/app/settings/credentials/reference'

import { setBrowserCredentialPersistence } from './app'
import type { CredentialRef } from './types'

function uniqueCredentialRefs(references: CredentialRef[]): CredentialRef[] {
  return [...new Map(references.map((reference) => [credentialKey(reference), reference])).values()]
}

export function appCredentialRefs(): CredentialRef[] {
  const legacyAIRefs = AI_PROVIDERS.filter((provider) => !provider.id.startsWith('acp:')).map(
    (provider) => providerCredentialRef(provider.id)
  )
  const modelConnectionRefs = aiModelSettings.value.connections
    .filter((connection) => !connection.providerID.startsWith('acp:'))
    .map(modelConnectionCredentialRef)
  const storageCredentials = storageProviderRegistry
    .list()
    .flatMap((provider) => storageCredentialRefs(provider.id))
  return uniqueCredentialRefs([
    ...legacyAIRefs,
    ...modelConnectionRefs,
    PEXELS_CREDENTIAL,
    UNSPLASH_CREDENTIAL,
    ...VECTORIZE_CREDENTIAL_REFS,
    ...mcpConnectionSettings.value.connections.map((connection) =>
      mcpConnectionCredentialRef(connection.id)
    ),
    ...storageCredentials
  ])
}

export function setAppCredentialPersistence(remembered: boolean): Promise<void> {
  return setBrowserCredentialPersistence(remembered, appCredentialRefs())
}
