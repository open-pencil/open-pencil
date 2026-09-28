import { Frame, Text, renderTree } from '@open-pencil/core/design-jsx'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'

import { ARTICLE, FEATURE_COMPARISONS } from './content'
import { createTypographySample } from './samples'

export async function createTypographySection(graph: SceneGraph, parentId: string) {
  const text = { font: 'Inter', color: '#172554' }
  const label = { ...text, size: 12, color: '#536487' }
  const root = await renderTree(
    graph,
    Frame({
      name: 'Typography workbench',
      flex: 'col',
      w: 1056,
      h: 'hug',
      gap: 32,
      p: 32,
      bg: '#FFFFFF',
      children: [
        Text({ ...text, size: 20, weight: 600, children: 'Type that holds together.' }),
        Frame({
          name: 'Hierarchy in context',
          flex: 'row',
          w: 'fill',
          h: 'hug',
          gap: 32,
          children: [
            Frame({
              name: 'Editable article',
              flex: 'col',
              w: 600,
              h: 'hug',
              gap: 16,
              p: 24,
              rounded: 16,
              bg: '#EEF2FF',
              children: [
                Text({ ...label, size: 10, children: ARTICLE.eyebrow }),
                Text({
                  ...text,
                  name: 'Article headline',
                  w: 'fill',
                  size: 36,
                  lineHeight: 42,
                  weight: 600,
                  children: ARTICLE.title
                }),
                Text({
                  ...text,
                  name: 'Article introduction',
                  w: 'fill',
                  size: 18,
                  lineHeight: 26,
                  children: ARTICLE.introduction
                }),
                Text({
                  ...text,
                  name: 'Article body',
                  w: 'fill',
                  size: 14,
                  lineHeight: 22,
                  children: ARTICLE.body
                }),
                Text({ ...label, size: 10, children: ARTICLE.detail })
              ]
            }),
            Frame({
              name: 'Type hierarchy guide',
              flex: 'col',
              w: 'fill',
              h: 'hug',
              gap: 24,
              children: [
                Text({ ...label, children: '01 / HIERARCHY' }),
                ...[
                  {
                    title: 'Headline · 36 / 42',
                    description: 'The first thing to read. Keep its rhythm when the words change.'
                  },
                  {
                    title: 'Introduction · 18 / 26',
                    description: 'A second voice, not a second headline.'
                  },
                  {
                    title: 'Body · 14 / 22',
                    description: 'Readable lines, generous leading, and a content-sized frame.'
                  },
                  {
                    title: 'Details · 10',
                    description: 'Supporting information with enough contrast to stay useful.'
                  }
                ].map((item) =>
                  Frame({
                    flex: 'col',
                    w: 'fill',
                    h: 'hug',
                    gap: 6,
                    children: [
                      Text({ ...text, size: 14, weight: 600, children: item.title }),
                      Text({ ...label, w: 'fill', lineHeight: 18, children: item.description })
                    ]
                  })
                )
              ]
            })
          ]
        })
      ]
    }),
    { parentId }
  )
  const features = await renderTree(
    graph,
    Frame({
      name: 'OpenType comparisons',
      flex: 'col',
      w: 'fill',
      h: 'hug',
      gap: 16,
      children: Text({ ...label, children: '02 / OPENTYPE · THE SAME TEXT, DIFFERENT FEATURES' })
    }),
    { parentId: root.id }
  )
  const comparisonRow = await renderTree(
    graph,
    Frame({ name: 'Feature pairs', flex: 'row', w: 'fill', h: 'hug', gap: 24 }),
    { parentId: features.id }
  )
  for (const comparison of FEATURE_COMPARISONS) {
    const column = await renderTree(
      graph,
      Frame({
        name: comparison.title,
        flex: 'col',
        w: 'fill',
        h: 'hug',
        gap: 8,
        children: Text({ ...text, size: 14, weight: 600, children: comparison.title })
      }),
      { parentId: comparisonRow.id }
    )
    for (const [index, settings] of [comparison.enabled, comparison.disabled].entries()) {
      await renderTree(graph, Text({ ...label, size: 10, children: comparison.labels[index] }), {
        parentId: column.id
      })
      await createTypographySample(graph, column.id, {
        name: `${comparison.title} / ${comparison.labels[index]}`,
        text: comparison.text,
        font: comparison.font,
        fontFeatures: settings
      })
    }
  }
  await renderTree(
    graph,
    Text({
      ...label,
      w: 'fill',
      lineHeight: 18,
      children:
        'Feature support depends on the font. Raw tags are preserved even when a typeface has no matching alternate.'
    }),
    { parentId: features.id }
  )
  const decorations = await renderTree(
    graph,
    Frame({
      name: 'Text decorations',
      flex: 'col',
      w: 'fill',
      h: 'hug',
      gap: 16,
      children: Text({ ...label, children: '03 / DECORATION · NATIVE TEXT, NOT DRAWN LINES' })
    }),
    { parentId: root.id }
  )
  const decorationRow = await renderTree(
    graph,
    Frame({ name: 'Decoration samples', flex: 'row', w: 'fill', h: 'hug', gap: 24 }),
    { parentId: decorations.id }
  )
  for (const sample of [
    { name: 'Wavy underline', style: 'WAVY', color: '#E5484D', thickness: 1.6 },
    { name: 'Dotted underline', style: 'DOTTED', color: '#4F46E5', thickness: 2 }
  ] as const) {
    const column = await renderTree(
      graph,
      Frame({ name: sample.name, flex: 'col', w: 'fill', h: 'hug', gap: 8 }),
      { parentId: decorationRow.id }
    )
    await createTypographySample(graph, column.id, {
      name: sample.name,
      text: 'Keep this thought.',
      decoration: {
        textDecoration: 'UNDERLINE',
        textDecorationStyle: sample.style,
        textDecorationFills: [
          { type: 'SOLID', color: parseColor(sample.color), opacity: 1, visible: true }
        ],
        textDecorationThickness: sample.thickness
      }
    })
    await renderTree(
      graph,
      Text({ ...label, children: `${sample.name} · ${sample.thickness}px` }),
      { parentId: column.id }
    )
  }
  return { rootId: root.id }
}
