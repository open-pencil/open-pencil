import { expect, test } from 'bun:test'

import {
  fillRoute,
  pagePaths,
  parseRouteParams,
  routeURL,
  routesFromFiles
} from '@/app/live-pages/routes'

test('page files are looked for under the project application directory', () => {
  expect(pagePaths('')).toEqual(['pages', 'app/pages'])
  expect(pagePaths('.')).toEqual(['pages', 'app/pages'])
  expect(pagePaths('code')).toEqual(['code/pages', 'code/app/pages'])
  expect(pagePaths('/code/')).toEqual(['code/pages', 'code/app/pages'])
  expect(pagePaths('apps\\web')).toEqual(['apps/web/pages', 'apps/web/app/pages'])
})

test('a page file becomes the path the application serves', () => {
  expect(routesFromFiles(['pages/index.vue'])).toEqual([
    { route: '/', file: 'pages/index.vue', params: [] }
  ])
  expect(routesFromFiles(['pages/pricing.vue'])[0]?.route).toBe('/pricing')
  expect(routesFromFiles(['pages/blog/index.vue'])[0]?.route).toBe('/blog')
})

test('Nuxt 4 page files under app/ are found as well', () => {
  expect(routesFromFiles(['app/pages/settings.vue'])[0]?.route).toBe('/settings')
})

test('a layout group and an underscore file take no part in the path', () => {
  const routes = routesFromFiles([
    'pages/(auth)/sign-in.vue',
    'pages/_partial.vue',
    'pages/blog/(posts)/[slug].vue'
  ])
  expect(routes.map((route) => route.route)).toEqual(['/blog/[slug]', '/sign-in'])
})

test('a parameter is named by the route that takes it', () => {
  const [route] = routesFromFiles(['pages/blog/[slug].vue'])
  expect(route?.params).toEqual(['slug'])
  const [catchAll] = routesFromFiles(['pages/docs/[...path].vue'])
  expect(catchAll?.params).toEqual(['path'])
  const [optional] = routesFromFiles(['pages/users/[[id]].vue'])
  expect(optional?.params).toEqual(['id'])
})

test('files that are not pages are left out, and one path is listed once', () => {
  const routes = routesFromFiles([
    'pages/index.vue',
    'app/pages/index.vue',
    'components/Button.vue',
    'pages/notes.md'
  ])
  expect(routes.map((route) => route.route)).toEqual(['/', '/notes'])
})

test('a route takes the values it needs, encoded', () => {
  expect(fillRoute('/blog/[slug]', { slug: 'hello world' })).toBe('/blog/hello%20world')
  expect(fillRoute('/docs/[...path]', { path: 'a/b' })).toBe('/docs/a%2Fb')
  expect(fillRoute('/blog/[slug]', {})).toBeNull()
  expect(fillRoute('/blog/[slug]/[id]', { slug: 'a' })).toBeNull()
  expect(fillRoute('/about', {})).toBe('/about')
})

test('an optional parameter left empty takes its segment with it', () => {
  expect(fillRoute('/blog/[[slug]]', {})).toBe('/blog')
  expect(fillRoute('/blog/[[slug]]', { slug: 'hi' })).toBe('/blog/hi')
  expect(fillRoute('/docs/[[...path]]', {})).toBe('/docs')
  // A required parameter is still required, however the other one is written.
  expect(fillRoute('/blog/[slug]/[[page]]', { slug: 'a' })).toBe('/blog/a')
  expect(fillRoute('/blog/[[slug]]/[page]', {})).toBeNull()
})

test('parameter values are read as a person types them', () => {
  expect(parseRouteParams('slug=hello, id=42')).toEqual({ slug: 'hello', id: '42' })
  expect(parseRouteParams('slug=hello\nid=42')).toEqual({ slug: 'hello', id: '42' })
  expect(parseRouteParams('nonsense, =x, y=')).toEqual({})
})

test('a route is placed on the address the application answers on', () => {
  expect(routeURL('http://localhost:3000', '/pricing')).toBe('http://localhost:3000/pricing')
  expect(routeURL('http://localhost:3000/', '/')).toBe('http://localhost:3000')
  expect(routeURL('', '/pricing')).toBe('')
})
