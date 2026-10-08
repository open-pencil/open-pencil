import {
  Ellipse,
  Frame,
  Rectangle,
  Text,
  backgroundBlur,
  dropShadow,
  innerShadow,
  layerBlur,
  linearGradient,
  radialGradient,
  solid
} from '@open-pencil/design-jsx'
import type { TreeNode } from '@open-pencil/design-jsx'

export interface PaintExample {
  title: string
  caption: string
  artwork: TreeNode
}

export interface PaintGroup {
  title: string
  examples: PaintExample[]
}

/** Only specimen artwork has fixed geometry; labels and section placement use layout. */
export function createPaintGroups(): PaintGroup[] {
  const tile = { w: 72, h: 72, rounded: 16, bg: '#4F46E5' }
  const pair = (children: TreeNode[]) =>
    Frame({ flex: 'row', w: 232, h: 104, gap: 32, justify: 'center', items: 'center', children })
  const stops = [
    ['#4F46E5', 0],
    ['#38BDF8', 1]
  ] as const
  const gradientStops = [...stops]
  return [
    {
      title: '01 / PAINT · THE SAME PALETTE, DIFFERENT FILLS',
      examples: [
        {
          title: 'Linear gradient',
          caption: 'Indigo to sky, across a flat surface.',
          artwork: Rectangle({
            w: 232,
            h: 104,
            rounded: 12,
            fills: [linearGradient(gradientStops)]
          })
        },
        {
          title: 'Radial gradient',
          caption: 'The same stops, radiating from the center.',
          artwork: Rectangle({
            w: 232,
            h: 104,
            rounded: 12,
            fills: [radialGradient(gradientStops)]
          })
        },
        {
          title: 'Layered fills',
          caption: 'A warm Overlay fill above the gradient.',
          artwork: Rectangle({
            w: 232,
            h: 104,
            rounded: 12,
            fills: [
              linearGradient(gradientStops),
              solid('#FBBF24', { blendMode: 'OVERLAY', opacity: 0.65 })
            ]
          })
        }
      ]
    },
    {
      title: '02 / DEPTH · UNCHANGED GEOMETRY, DIFFERENT SHADOWS',
      examples: [
        {
          title: 'Drop shadow',
          caption: 'Flat on the left; an outer shadow on the right.',
          artwork: pair([
            Rectangle(tile),
            Rectangle({ ...tile, effects: [dropShadow({ y: 6, radius: 10, color: '#17255440' })] })
          ])
        },
        {
          title: 'Inner shadow',
          caption: 'The shadow stays inside the second shape.',
          artwork: pair([
            Rectangle(tile),
            Rectangle({ ...tile, effects: [innerShadow({ y: 5, radius: 10, color: '#172554AA' })] })
          ])
        },
        {
          title: 'Combined depth',
          caption: 'Outer and inner shadows on the same shape.',
          artwork: pair([
            Rectangle(tile),
            Rectangle({
              ...tile,
              effects: [
                dropShadow({ y: 6, radius: 10, color: '#17255440' }),
                innerShadow({ y: 3, radius: 6, color: '#FFFFFF77' })
              ]
            })
          ])
        }
      ]
    },
    {
      title: '03 / BLUR · KNOW WHAT IS BEING SOFTENED',
      examples: [
        {
          title: 'Layer blur',
          caption: 'Only the right-hand shape is blurred.',
          artwork: pair([Rectangle(tile), Rectangle({ ...tile, effects: [layerBlur(6)] })])
        },
        {
          title: 'Background blur',
          caption: 'A translucent pane softens the stripes behind it.',
          artwork: Frame({
            w: 232,
            h: 104,
            overflow: 'hidden',
            rounded: 12,
            children: [
              ...['#4F46E5', '#38BDF8', '#4F46E5', '#38BDF8'].map((bg, index) =>
                Rectangle({ x: index * 58, y: 0, w: 58, h: 104, bg })
              ),
              Rectangle({
                name: 'Frosted pane',
                x: 40,
                y: 16,
                w: 152,
                h: 72,
                rounded: 10,
                bg: '#FFFFFF55',
                effects: [backgroundBlur(10)]
              })
            ]
          })
        },
        {
          title: 'Text shadow',
          caption: 'An effect on live glyphs, not a raster image.',
          artwork: Frame({
            flex: 'col',
            w: 232,
            h: 104,
            justify: 'center',
            children: Text({
              font: 'Inter',
              size: 32,
              weight: 600,
              color: '#4F46E5',
              children: 'Still editable',
              effects: [dropShadow({ y: 4, radius: 5, color: '#17255466' })]
            })
          })
        }
      ]
    },
    {
      title: '04 / COMPOSITION · BLENDING, MASKING, AND CORNERS',
      examples: [
        {
          title: 'Multiply + Screen',
          caption: 'Overlapping layers retain their blend modes.',
          artwork: Frame({
            w: 232,
            h: 104,
            children: [
              Ellipse({ x: 24, y: 12, w: 80, h: 80, bg: '#3B82F6', blendMode: 'MULTIPLY' }),
              Ellipse({ x: 76, y: 12, w: 80, h: 80, bg: '#F43F5E', blendMode: 'MULTIPLY' }),
              Ellipse({ x: 128, y: 12, w: 80, h: 80, bg: '#FBBF24', blendMode: 'SCREEN' })
            ]
          })
        },
        {
          title: 'Alpha mask',
          caption: 'The ellipse masks the following stripe layers.',
          artwork: Frame({
            w: 232,
            h: 104,
            children: [
              Ellipse({
                name: 'Editable mask',
                x: 64,
                y: 4,
                w: 104,
                h: 96,
                bg: '#FFFFFF',
                mask: 'alpha'
              }),
              ...['#4F46E5', '#38BDF8', '#FBBF24'].map((bg, index) =>
                Rectangle({ x: 44, y: 4 + index * 32, w: 144, h: 32, bg })
              )
            ]
          })
        },
        {
          title: 'Independent corners',
          caption: 'Equal corners versus alternating corner radii.',
          artwork: pair([
            Rectangle(tile),
            Rectangle({ ...tile, roundedTL: 28, roundedTR: 4, roundedBR: 28, roundedBL: 4 })
          ])
        }
      ]
    }
  ]
}
