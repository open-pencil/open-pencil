import {
  createUnifont,
  providers,
  type GoogleFamilyOptions,
  type RemoteFontSource,
  type ResolveFontOptions,
  type Unifont
} from 'unifont'

import type { WebFontProviderId } from '#core/text/web-font/resolver'

export type WebFontProvider =
  | ReturnType<typeof providers.google>
  | ReturnType<typeof providers.googleicons>
  | ReturnType<typeof providers.fontsource>
  | ReturnType<typeof providers.bunny>
  | ReturnType<typeof providers.fontshare>
/** One or more providers behind a provider setting. */
export type WebFontProviders = [WebFontProvider, ...WebFontProvider[]]
export type WebUnifont = Unifont<WebFontProviders>
export type WebFontResolveOptions = Pick<
  ResolveFontOptions<{ google?: GoogleFamilyOptions }>,
  'weights' | 'styles' | 'formats' | 'subsets' | 'variableAxis' | 'options'
>

/**
 * The unifont providers behind each provider setting. Google serves its Material Symbols from
 * its icon catalogue, as variable fonts with every axis, so its setting covers both.
 */
export const providerFactories = {
  google: (): WebFontProviders => [providers.google(), providers.googleicons()],
  fontsource: (): WebFontProviders => [providers.fontsource()],
  bunny: (): WebFontProviders => [providers.bunny()],
  fontshare: (): WebFontProviders => [providers.fontshare()]
} satisfies Record<WebFontProviderId, () => WebFontProviders>

export async function createProviderUnifont(provider: WebFontProviderId): Promise<WebUnifont> {
  // In a page unifont sends provider requests to its hosted proxy; ours go through the host's
  // fetch, which reaches the providers itself.
  return createUnifont(providerFactories[provider](), { throwOnError: false, apiBase: false })
}

export function isRemoteFontSource(
  source: RemoteFontSource | { name: string }
): source is RemoteFontSource {
  return 'url' in source
}
