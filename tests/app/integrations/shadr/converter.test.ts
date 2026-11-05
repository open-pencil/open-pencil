import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { EditorStore } from '@/app/editor/active-store'
import {
  colorToShadrHex,
  parseCoordinate,
  shadrConverter,
  shadrHexToColor
} from '@/app/integrations/shadr/converter'
import type { ShadrPage } from '@/app/integrations/shadr/types'

describe('Shadr Converter', () => {
  test('parseCoordinate handles numbers and expressions', () => {
    expect(parseCoordinate(100)).toBe(100)
    expect(parseCoordinate('200')).toBe(200)
    expect(parseCoordinate('1920/2')).toBe(960)
    expect(parseCoordinate('1920/2 - 130')).toBe(830)
    expect(parseCoordinate('halfWidth - 250')).toBe(710)
    expect(parseCoordinate('1080 - 60')).toBe(1020)
  })

  test('color conversion round-trips correctly', () => {
    const hex = '4cc9f0'
    const { color } = shadrHexToColor(hex)
    expect(colorToShadrHex(color)).toBe(hex)
  })

  test('imports main_menu.json into SceneGraph and exports back', () => {
    const fixturePath = resolve(process.cwd(), 'docs/shadr/pages/main_menu.json')
    const raw = readFileSync(fixturePath, 'utf-8')
    const page: ShadrPage = JSON.parse(raw)

    const graph = shadrConverter.importPage(page)
    const pages = graph.getPages()
    expect(pages.length).toBeGreaterThan(0)

    const rootNodes = graph.getChildren(pages[0].id)
    expect(rootNodes.length).toBe(1)
    const screenFrame = rootNodes[0]
    expect(screenFrame.name).toBe('main_menu')
    expect(screenFrame.width).toBe(1920)
    expect(screenFrame.height).toBe(1080)

    // Check children imported
    const blocks = graph.getChildren(screenFrame.id)
    expect(blocks.length).toBeGreaterThan(3)

    // Fake an EditorStore for exportPageFromCanvas
    const mockEditor = {
      graph,
      state: {
        currentPageId: pages[0].id
      }
    } as unknown as EditorStore

    const exported = shadrConverter.exportPage(mockEditor, 'main_menu')
    expect(exported.name).toBe('main_menu')
    expect(exported.screen.width).toBe(1920)
    expect(exported.screen.height).toBe(1080)
    expect(exported.blocks.length).toBe(blocks.length)
  })
})
