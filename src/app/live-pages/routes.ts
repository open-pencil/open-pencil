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
const PAGES_DIRECTORY = /(?:^|\/)(?:app\/)?pages\/(?<relative>.+)$/
const PARAM_SEGMENT = /\[+\.{0,3}([^[\]]+)\]+/g
/** A parameter a route serves without: `[[slug]]`, and `[[...path]]` for a catch-all. */
const OPTIONAL_PARAM_SEGMENT = /\[\[\.{0,3}([^[\]]+)\]\]/g
/** A segment that is nothing but one optional parameter, which goes entirely when left empty. */
const OPTIONAL_ONLY_SEGMENT = /^\[\[\.{0,3}([^[\]]+)\]\]$/

/** Where a Nuxt application keeps its pages, beside `app/pages` for Nuxt 4. */
const PAGE_ROOTS = ['pages', 'app/pages']

/**
 * The pathspecs a project's page files sit at: the repository root, or the application directory
 * a monorepo keeps them under, since `git ls-files` matches from the root it runs in.
 */
export function pagePaths(appDirectory: string): string[] {
  const directory = appDirectory
    .trim()
    .replaceAll('\\', '/')
    .replaceAll(/^\/+|\/+$/g, '')
  if (directory === '' || directory === '.') return [...PAGE_ROOTS]
  return PAGE_ROOTS.map((root) => `${directory}/${root}`)
}

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
    const relative = found?.groups?.relative
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
  return compact([...route.matchAll(PARAM_SEGMENT)].map((match) => match[1]))
}

/** The parameter names a route serves without, which `[[name]]` spells. */
export function optionalParamNames(route: string): string[] {
  return compact([...route.matchAll(OPTIONAL_PARAM_SEGMENT)].map((match) => match[1]))
}

/**
 * The route a set of parameter values makes, or null while one the route needs is missing. An
 * optional parameter may stay empty: a segment that is only that parameter leaves the path, so
 * `[[slug]]` on `/blog` serves `/blog`, and no slash is left doubled. Values are encoded, so a
 * value never becomes another path segment.
 */
export function fillRoute(route: string, values: Readonly<Record<string, string>>): string | null {
  const optional = new Set(optionalParamNames(route))
  const given = (name: string): string | undefined => {
    const value = (values[name] ?? '').trim()
    return value === '' ? undefined : encodeURIComponent(values[name] ?? '')
  }
  const segments: string[] = []
  for (const segment of route.split('/')) {
    const names = paramNames(segment)
    const missing = names.filter((name) => given(name) === undefined)
    if (missing.some((name) => !optional.has(name))) return null
    const only = OPTIONAL_ONLY_SEGMENT.exec(segment)?.[1]
    if (only !== undefined && missing.includes(only)) continue
    segments.push(segment.replace(PARAM_SEGMENT, (_, name: string) => given(name) ?? ''))
  }
  return segments.join('/')
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
