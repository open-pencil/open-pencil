import {
  createUnifont,
  providers,
  type RemoteFontSource,
  type ResolveFontOptions,
  type Unifont
} from 'unifont'

import type { WebFontProviderId } from '#core/text/web-fonts'

export type WebFontProvider =
  | ReturnType<typeof providers.google>
  | ReturnType<typeof providers.fontsource>
  | ReturnType<typeof providers.bunny>
  | ReturnType<typeof providers.fontshare>
export type WebUnifont = Unifont<[WebFontProvider]>
export type WebFontResolveOptions = Pick<
  ResolveFontOptions,
  'weights' | 'styles' | 'formats' | 'subsets'
>

export const providerFactories = {
  google: providers.google,
  fontsource: providers.fontsource,
  bunny: providers.bunny,
  fontshare: providers.fontshare
} satisfies Record<WebFontProviderId, () => WebFontProvider>

export async function createProviderUnifont(provider: WebFontProviderId): Promise<WebUnifont> {
  return createUnifont([providerFactories[provider]()], { throwOnError: false })
}

export function isRemoteFontSource(
  source: RemoteFontSource | { name: string }
): source is RemoteFontSource {
  return 'url' in source
}
