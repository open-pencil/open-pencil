import { createImportRule } from './support.ts'

/** The embed's own code: its services and its view. */
const EMBED_SOURCES = ['src/app/embed/', 'src/views/embed/']

/**
 * Why an import in the embed is not allowed, or null when it is. An embed is a host of the public
 * packages, as any SDK consumer is: it imports `@open-pencil/*`, the libraries they build on, and
 * its own modules, never other app code, so whatever it needs from the editor moves into a package.
 */
export function embedImportViolation(
  sourceRel: string,
  specifier: string,
  resolved: string | null
): string | null {
  if (!EMBED_SOURCES.some((prefix) => sourceRel.startsWith(prefix))) return null
  // Vite resolves `/src/...` against the project root, as it does `@/`.
  const appCode = ['@/', '.', '/'].some((prefix) => specifier.startsWith(prefix))
  if (!appCode) return null
  if (resolved && EMBED_SOURCES.some((prefix) => resolved.startsWith(prefix))) return null
  return 'An embed builds only on the public packages and its own modules (src/app/embed, src/views/embed); move what it needs from the app into the owning package.'
}

export const sdkOnlyImportsInEmbed = createImportRule(
  'open-pencil/sdk-only-imports-in-embed',
  embedImportViolation
)
