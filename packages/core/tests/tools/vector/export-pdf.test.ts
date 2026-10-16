import { describe, expect, test } from 'bun:test'

import * as v from 'valibot'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { ALL_TOOLS } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

const exportPDF = ALL_TOOLS.find((tool) => tool.name === 'export_pdf')
if (!exportPDF) throw new Error('export_pdf tool missing')

describe('export_pdf', () => {
  test('mode defaults to single and accepts frames and pages', () => {
    expect(v.parse(exportPDF.input, {}).mode).toBe('single')
    for (const mode of ['frames', 'pages']) {
      expect(v.parse(exportPDF.input, { mode, page_ids: ['0:1'] }).mode).toBe(mode)
    }
    expect(v.safeParse(exportPDF.input, { mode: 'spread' }).success).toBe(false)
  })

  test('embeds fonts only on request', () => {
    expect(v.parse(exportPDF.input, {}).embed_fonts).toBe(false)
    expect(v.parse(exportPDF.input, { embed_fonts: true }).embed_fonts).toBe(true)
    expect(v.safeParse(exportPDF.input, { embed_fonts: 'yes' }).success).toBe(false)
  })

  test('reports a problem with the request as an error result', async () => {
    const figma = new FigmaAPI(new SceneGraph())
    expect(await exportPDF.execute(figma, { mode: 'single' })).toEqual({
      error: 'No visible nodes to export'
    })
    expect(await exportPDF.execute(figma, { mode: 'pages', page_ids: ['9:9'] })).toEqual({
      error: 'Page "9:9" not found'
    })
  })
})
