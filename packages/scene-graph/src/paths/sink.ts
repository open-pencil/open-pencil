import type { PolygonOutlineCommand } from '../polygon'

/** Anything path commands can be written into: a CanvasKit path, SVG path data, a blob encoder. */
export interface PathSink {
  moveTo(x: number, y: number): unknown
  lineTo(x: number, y: number): unknown
  cubicTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): unknown
  close(): unknown
}

/** A coordinate rounded to two decimals, as exported path data writes it. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100
}

/** Path commands written as SVG path data into `parts`, each coordinate written by `format`. */
export function svgPathSink(
  parts: string[],
  format: (value: number) => number = roundCoordinate
): PathSink {
  const point = (x: number, y: number) => `${format(x)} ${format(y)}`
  return {
    moveTo: (x, y) => parts.push(`M${point(x, y)}`),
    lineTo: (x, y) => parts.push(`L${point(x, y)}`),
    cubicTo: (x1, y1, x2, y2, x, y) =>
      parts.push(`C${point(x1, y1)} ${point(x2, y2)} ${point(x, y)}`),
    close: () => parts.push('Z')
  }
}

/** Outline commands written into `sink`. */
export function replayOutline(commands: readonly PolygonOutlineCommand[], sink: PathSink): void {
  for (const command of commands) {
    if (command.type === 'M') sink.moveTo(command.x, command.y)
    else if (command.type === 'L') sink.lineTo(command.x, command.y)
    else if (command.type === 'C')
      sink.cubicTo(command.x1, command.y1, command.x2, command.y2, command.x, command.y)
    else sink.close()
  }
}

/** Outline commands as SVG path data, each coordinate written by `format`. */
export function outlineSVGPath(
  commands: readonly PolygonOutlineCommand[],
  format: (value: number) => number = roundCoordinate
): string {
  const parts: string[] = []
  replayOutline(commands, svgPathSink(parts, format))
  return parts.join('')
}
