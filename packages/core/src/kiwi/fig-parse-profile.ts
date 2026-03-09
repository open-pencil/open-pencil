/**
 * Lightweight profiling for .fig parse pipeline.
 * Enable with: globalThis.__FIG_PARSE_PROFILE__ = true
 * Then open a .fig file and call logFigParseProfile() or getFigParseProfile() after parse.
 */

export interface FigParseStage {
  stage: string
  ms: number
}

declare global {
  // eslint-disable-next-line no-var
  var __FIG_PARSE_PROFILE__: boolean | undefined
}

function isEnabled(): boolean {
  try {
    return Boolean(globalThis.__FIG_PARSE_PROFILE__)
  } catch {
    return false
  }
}

const stages: FigParseStage[] = []

export function profileStart(): number {
  return performance.now()
}

export function profileStage(name: string, start: number): void {
  if (!isEnabled()) return
  stages.push({ stage: name, ms: performance.now() - start })
}

export function profileStageFn<T>(name: string, fn: () => T): T {
  if (!isEnabled()) return fn()
  const start = performance.now()
  try {
    return fn()
  } finally {
    stages.push({ stage: name, ms: performance.now() - start })
  }
}

export function getFigParseProfile(): FigParseStage[] {
  return [...stages]
}

export function addFigParseStage(name: string, ms: number): void {
  stages.push({ stage: name, ms })
}

export function clearFigParseProfile(): void {
  stages.length = 0
}

export function logFigParseProfile(): void {
  if (stages.length === 0) return
  const total = stages.reduce((s, x) => s + x.ms, 0)
  const lines = [
    '[fig-parse profile]',
    ...stages.map((s) => `  ${s.stage}: ${s.ms.toFixed(1)}ms (${((100 * s.ms) / total).toFixed(1)}%)`),
    `  total: ${total.toFixed(1)}ms`
  ]
  console.log(lines.join('\n'))
}
