type DevToolsColor =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'tertiary-dark'
  | 'secondary-dark'
  | 'secondary-light'

function colorForPhase(name: string): DevToolsColor {
  if (name === 'frame') return 'primary'
  if (name === 'render:flush') return 'tertiary-dark'
  if (name === 'render:recordPicture') return 'tertiary'
  if (name.startsWith('render:')) return 'secondary'
  if (name.startsWith('layout:')) return 'secondary-dark'
  return 'secondary-light'
}

const SMOOTH = 0.05

export class PhaseTimer {
  enabled = false
  readonly averages = new Map<string, number>()

  private starts = new Map<string, number>()

  beginPhase(name: string): void {
    if (!this.enabled || typeof performance === 'undefined') return
    this.starts.set(name, performance.now())
  }

  endPhase(name: string): void {
    if (!this.enabled || typeof performance === 'undefined') return

    const startTime = this.starts.get(name)
    if (startTime === undefined) return
    this.starts.delete(name)

    const duration = performance.now() - startTime
    const prev = this.averages.get(name)
    this.averages.set(name, prev === undefined ? duration : prev + (duration - prev) * SMOOTH)

    performance.measure(name, {
      start: startTime,
      detail: {
        devtools: {
          dataType: 'track-entry',
          track: 'Renderer',
          trackGroup: 'Inkly',
          color: colorForPhase(name)
        }
      }
    })
  }

  clearPhases(): void {
    this.starts.clear()
    this.averages.clear()
  }
}
