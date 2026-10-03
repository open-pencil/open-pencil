import interBold from '@open-pencil/core/assets/Inter-Bold.ttf?url'
import interExtraBold from '@open-pencil/core/assets/Inter-ExtraBold.ttf?url'
import interMedium from '@open-pencil/core/assets/Inter-Medium.ttf?url'
import interRegular from '@open-pencil/core/assets/Inter-Regular.ttf?url'
import interSemiBold from '@open-pencil/core/assets/Inter-SemiBold.ttf?url'
import notoNaskhArabic from '@open-pencil/core/assets/NotoNaskhArabic-Regular.ttf?url'
import { fontManager } from '@open-pencil/core/text'

/**
 * Core ships its bundled fonts in `@open-pencil/core/assets`. Importing them as assets lets
 * Vite serve them in development and emit hashed copies with the build, so no host keeps a
 * second copy in `public/`. Kept apart from `index.ts` because `?url` imports only resolve
 * in a Vite build, not in the Bun test runner.
 */
const BUNDLED_FONT_URLS: Record<string, string> = {
  'Inter-Regular.ttf': interRegular,
  'Inter-Medium.ttf': interMedium,
  'Inter-SemiBold.ttf': interSemiBold,
  'Inter-Bold.ttf': interBold,
  'Inter-ExtraBold.ttf': interExtraBold,
  'NotoNaskhArabic-Regular.ttf': notoNaskhArabic
}

/** Points core at the emitted font files. Call before any font loads. */
export function installBundledFonts(): void {
  fontManager.setBundledFontLocator((file) => BUNDLED_FONT_URLS[file] ?? `/${file}`)
}
