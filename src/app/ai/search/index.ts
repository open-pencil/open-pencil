import { IS_TAURI } from '@open-pencil/core/constants'

import type { AIModelConnection } from '@/app/ai/models/types'
import { cloudWebSearch } from '@/app/ai/providers/openpencil/search'
import type { WebSearch } from '@/app/ai/tools/web-search'
import { resolveExaKey } from '@/app/settings/credentials/media'

import { exaWebSearch } from './exa'

/**
 * How a chat searches the web: with the person's own Exa key when one is saved, on the desktop
 * app, whatever the model; otherwise on Cloud's services for a chat whose model runs there.
 */
export async function chatWebSearch(
  connection: Pick<AIModelConnection, 'providerID' | 'cloudWorkspaceId'>
): Promise<WebSearch | undefined> {
  if (IS_TAURI && (await resolveExaKey())) return exaWebSearch(resolveExaKey)
  return cloudWebSearch(connection)
}
