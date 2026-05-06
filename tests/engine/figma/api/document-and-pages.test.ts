import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#tests/helpers/assert'

import { createAPI } from './helpers'

describe('document & pages', () => {
  test('root has pages as children', () => {
    const api = createAPI()
    expect(api.root.children.length).toBeGreaterThan(0)
    expect(api.root.children[0].type).toBe('CANVAS')
  })

  test('currentPage is first page', () => {
    const api = createAPI()
    expect(api.currentPage.type).toBe('CANVAS')
    expect(api.currentPage.name).toBe('Page 1')
  })

  test('createPage adds a new page', () => {
    const api = createAPI()
    const page = api.createPage()
    expect(page.type).toBe('CANVAS')
    expect(api.root.children.length).toBe(2)
  })

  test('currentPage can be switched', () => {
    const api = createAPI()
    const page2 = api.createPage()
    page2.name = 'Page 2'
    api.currentPage = page2
    expect(api.currentPage.name).toBe('Page 2')
  })

  test('getNodeById returns proxy', () => {
    const api = createAPI()
    const frame = api.createFrame()
    const found = api.getNodeById(frame.id)
    expect(expectDefined(found, 'found frame').id).toBe(frame.id)
  })

  test('getNodeById returns null for unknown id', () => {
    const api = createAPI()
    expect(api.getNodeById('nonexistent')).toBeNull()
  })
})
