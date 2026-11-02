import type { FunctionalComponent } from 'vue'

import { outlineSVGPath, type PolygonOutlineCommand } from '@open-pencil/scene-graph/polygon'
import {
  SHAPE_WITH_TEXT_TYPES,
  shapeWithTextGeometry,
  type ShapeWithTextType
} from '@open-pencil/scene-graph/shape-with-text'

import { maskIcon } from './mask'

/** The icon box, and the outline inside it, as lucide draws its icons. */
const BOX = 24
const INSET = 3
const STROKE = 1.5

function inset(commands: PolygonOutlineCommand[]): PolygonOutlineCommand[] {
  return commands.map((command) => {
    if (command.type === 'Z') return command
    if (command.type === 'C') {
      return {
        ...command,
        x1: command.x1 + INSET,
        y1: command.y1 + INSET,
        x2: command.x2 + INSET,
        y2: command.y2 + INSET,
        x: command.x + INSET,
        y: command.y + INSET
      }
    }
    return { ...command, x: command.x + INSET, y: command.y + INSET }
  })
}

/** A kind's outline as icon markup, drawn from the same geometry the canvas draws it from. */
export function shapeKindIconSVG(kind: ShapeWithTextType): string {
  const size = BOX - INSET * 2
  const { outline, details } = shapeWithTextGeometry(kind, size, size, 1)
  const paths = [outline, details]
    .filter((commands) => commands.length > 0)
    .map((commands) => `<path d="${outlineSVGPath(inset(commands))}"/>`)
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOX} ${BOX}" fill="none" stroke="black" stroke-width="${STROKE}" stroke-linejoin="round">${paths}</svg>`
}

/** Each kind's outline as an icon component. */
export const SHAPE_KIND_ICONS = Object.fromEntries(
  SHAPE_WITH_TEXT_TYPES.map((kind): [ShapeWithTextType, FunctionalComponent] => [
    kind,
    maskIcon(shapeKindIconSVG(kind))
  ])
) as Record<ShapeWithTextType, FunctionalComponent>
