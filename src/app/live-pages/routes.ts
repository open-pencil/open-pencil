import { compact } from 'es-toolkit/array'

/** A route a Nuxt application answers, and the file that declares it. */
export type RouteInfo = {
  /** The path the application serves, from the pages root: `/` for the index page. */
  route: string
  /** The file the route comes from, relative to the repository root. */
  file: string
  /** The parameters the path takes, in order: `['slug']` for `/blog/[slug]`. */
  params: string[]
}

const PAGE_EXTENSION = /\.(?:vue|md|mdx)$/i
const PAGES_DIRECTORY = /(?:^|\/)(?:app\/)?pages\/(.+)$/
const PARAM_SEGMENT = /\[+\.{0,3}([^[\]]+)\]+/g

/**
 * The routes a Nuxt application's page files declare. `pages/index.vue` serves `/`, a segment
 * in parentheses is a layout group and takes no part in the path, and a leading underscore marks
 * a file Nuxt leaves out of the routes.
 */
export function routesFromFiles(files: readonly string[]): RouteInfo[] {
  const routes = new Map<string, RouteInfo>()
  for (const file of files) {
    const normalized = file.replaceAll('\\', '/')
    const found = PAGES_DIRECTORY.exec(normalized)
    if (!found) continue
    const relative = found[1]
    if (relative === undefined || !PAGE_EXTENSION.test(relative)) continue
    const segments = relative
      .replace(PAGE_EXTENSION, '')
      .split('/')
      .filter((segment) => segment !== '')
      .flatMap((segment) => {
        if (segment.startsWith('(') && segment.endsWith(')')) return []
        return [segment]
      })
    // Nuxt keeps files that start with an underscore out of the routes, and a group may leave none.
    if (segments.length === 0 || segments.some((segment) => segment.startsWith('_'))) continue
    if (segments.at(-1) === 'index') segments.pop()
    const route = `/${segments.join('/')}`
    if (routes.has(route)) continue
    routes.set(route, { route, file: normalized, params: paramNames(route) })
  }
  return [...routes.values()].sort((left, right) => left.route.localeCompare(right.route))
}

/** The parameter names a route spells, in order, from `[slug]`, `[...path]`, and `[[optional]]`. */
export function paramNames(route: string): string[] {
  return compact([...route.matchAll(PARAM_SEGMENT)].map((match) => match[1] ?? ''))
}

/**
 * The route a set of parameter values makes, or null while one the route needs is missing. Values
 * are encoded, so a value never becomes another path segment.
 */
export function fillRoute(route: string, values: Readonly<Record<string, string>>): string | null {
  const names = paramNames(route)
  if (names.some((name) => (values[name] ?? '').trim() === '')) return null
  return route.replace(PARAM_SEGMENT, (_, name: string) => encodeURIComponent(values[name] ?? ''))
}

/**
 * Parameter values written the way a person types them: `slug=hello, id=42`, one per line or
 * between commas. A pair without a name or a value is ignored rather than guessed.
 */
export function parseRouteParams(text: string): Record<string, string> {
  const values: Record<string, string> = {}
  for (const pair of text.split(/[,\n]/)) {
    const separator = pair.indexOf('=')
    if (separator === -1) continue
    const name = pair.slice(0, separator).trim()
    const value = pair.slice(separator + 1).trim()
    if (name !== '' && value !== '') values[name] = value
  }
  return values
}

/**
 * A route on the address the application answers on. The address is the dev server's own, so a
 * page opens on the port it was started with, not on one the app guesses.
 */
export function routeURL(base: string, route: string): string {
  const origin = base.trim().replace(/\/+$/, '')
  if (origin === '') return ''
  const path = route.startsWith('/') ? route : `/${route}`
  return path === '/' ? origin : `${origin}${path}`
}
