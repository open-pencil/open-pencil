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

/**
 * Where the font providers the editor fetches from serve their font files, by host, with the path
 * a host shares with other files: the same families a page loading a font from one of them uses.
 */
const PROVIDER_FONT_FILES: ReadonlyMap<string, string> = new Map([
  ['fonts.gstatic.com', '/'],
  ['fonts.bunny.net', '/'],
  ['cdn.fontshare.com', '/'],
  ['cdn.jsdelivr.net', '/fontsource/']
])

/** Whether a font file comes from a provider the editor fetches fonts from itself. */
export function isProviderFontFile(url: string): boolean {
  if (!URL.canParse(url)) return false
  const { protocol, hostname, pathname } = new URL(url)
  const path = PROVIDER_FONT_FILES.get(hostname)
  return protocol === 'https:' && path !== undefined && pathname.startsWith(path)
}
