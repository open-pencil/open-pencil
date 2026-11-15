import * as v from 'valibot'
import { parse } from 'yaml'

const handleSchema = v.pipe(v.string(), v.regex(/^[\w.-]{1,100}$/))
const httpsURLSchema = v.pipe(v.string(), v.url(), v.startsWith('https://'))

/** The platforms `FUNDING.yml` names, as GitHub links each one; others are skipped. */
const PLATFORMS = {
  github: { value: handleSchema, url: (id: string) => `https://github.com/sponsors/${id}` },
  ko_fi: { value: handleSchema, url: (id: string) => `https://ko-fi.com/${id}` },
  open_collective: { value: handleSchema, url: (id: string) => `https://opencollective.com/${id}` },
  liberapay: { value: handleSchema, url: (id: string) => `https://liberapay.com/${id}` },
  patreon: { value: handleSchema, url: (id: string) => `https://www.patreon.com/${id}` },
  polar: { value: handleSchema, url: (id: string) => `https://polar.sh/${id}` },
  buy_me_a_coffee: { value: handleSchema, url: (id: string) => `https://buymeacoffee.com/${id}` },
  custom: { value: httpsURLSchema, url: (url: string) => url }
} as const

const fundingSchema = v.nullable(
  v.pipe(
    v.custom<object>((value) => typeof value === 'object' && !Array.isArray(value)),
    v.record(v.string(), v.nullable(v.union([v.string(), v.array(v.string())])))
  )
)

function isPlatform(name: string): name is keyof typeof PLATFORMS {
  return Object.hasOwn(PLATFORMS, name)
}

/**
 * The donation page a repository's `FUNDING.yml` names first, or `null` when it names none this
 * app can link to. A file that is not a mapping of platforms to names throws, so the build fails
 * rather than dropping the link.
 */
export function fundingURL(text: string): string | null {
  const funding = v.parse(fundingSchema, parse(text)) ?? {}
  for (const [name, entry] of Object.entries(funding)) {
    if (!isPlatform(name)) continue
    const platform = PLATFORMS[name]
    const first = Array.isArray(entry) ? entry[0] : entry
    const value = v.safeParse(platform.value, first)
    if (value.success) return platform.url(value.output)
  }
  return null
}
