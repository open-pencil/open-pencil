import { IS_TAURI } from '@open-pencil/core/constants'
import { setWebSearchProvider, type WebSearchProvider } from '@open-pencil/core/tools'

import type { AIModelConnection } from '@/app/ai/models/types'
import { cloudWebSearch } from '@/app/ai/providers/openpencil/search'
import { resolveExaKey } from '@/app/settings/credentials/media'

import { exaWebSearch } from './exa'

/**
 * Where `web_search` goes, for the built-in chat and for agents reaching OpenPencil's tools
 * alike: the person's own Exa key when one is saved, in the desktop app; otherwise Cloud's
 * services when the Design model runs there; otherwise nowhere.
 */
export async function webSearchProvider(
  connection: Pick<AIModelConnection, 'providerID' | 'cloudWorkspaceId'> | null
): Promise<WebSearchProvider | null> {
  if (IS_TAURI) {
    let saved: string | null
    try {
      saved = await resolveExaKey()
    } catch (error) {
      // No search rather than Cloud's: a key may be saved, and Cloud would bill someone else.
      console.warn('Could not read the Exa key', error)
      return null
    }
    if (saved) return exaWebSearch(resolveExaKey)
  }
  return connection ? cloudWebSearch(connection) : null
}

let refresh = 0

/** Points `web_search` at the provider for the current key and Design model. */
export async function refreshWebSearchProvider(
  connection: Pick<AIModelConnection, 'providerID' | 'cloudWorkspaceId'> | null
): Promise<void> {
  const current = ++refresh
  const provider = await webSearchProvider(connection)
  // A later change may have finished first; its provider stands.
  if (current === refresh) setWebSearchProvider(provider)
}
