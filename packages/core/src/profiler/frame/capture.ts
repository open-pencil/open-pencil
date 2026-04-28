const hasPerformance = typeof performance !== 'undefined'

export interface NodeProfile {
  nodeId: string
  name: string
  type: string
  depth: number
  startTime: number
  endTime: number
  selfTime: number
  drawCalls: number
  culled: boolean
  children: NodeProfile[]
}

export interface FrameCapture {
  timestamp: number
  totalTimeMs: number
  cpuTimeMs: number
  gpuTimeMs: number
  totalNodes: number
  culledNodes: number
  drawCalls: number
  scenePictureCacheHit: boolean
  rootProfiles: NodeProfile[]
}

export class CaptureStack {
  private stack: NodeProfile[] = []
  private roots: NodeProfile[] = []
  private frameStart = 0

  begin(nodeId: string, name: string, type: string, culled: boolean): void {
    const profile: NodeProfile = {
      nodeId,
      name,
      type,
      depth: this.stack.length,
      startTime: hasPerformance ? performance.now() - this.frameStart : 0,
      endTime: 0,
      selfTime: 0,
      drawCalls: 0,
      culled,
      children: []
    }
    this.stack.push(profile)
  }

  end(drawCallsDelta: number): void {
    const profile = this.stack.pop()
    if (!profile) return

    profile.endTime = hasPerformance ? performance.now() - this.frameStart : 0
    profile.drawCalls = drawCallsDelta

    let childrenTime = 0
    for (const child of profile.children) {
      childrenTime += child.endTime - child.startTime
    }
    profile.selfTime = profile.endTime - profile.startTime - childrenTime

    const parent = this.stack[this.stack.length - 1]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (parent) {
      parent.children.push(profile)
    } else {
      this.roots.push(profile)
    }
  }

  reset(frameStart: number): void {
    this.stack.length = 0
    this.roots.length = 0
    this.frameStart = frameStart
  }

  getRootProfiles(): NodeProfile[] {
    return this.roots
  }
}

interface SpeedscopeFrame {
  name: string
}

interface SpeedscopeEvent {
  type: 'O' | 'C'
  at: number
  frame: number
}

export function toSpeedscopeJSON(capture: FrameCapture): string {
  const frames: SpeedscopeFrame[] = []
  const frameIndex = new Map<string, number>()
  const events: SpeedscopeEvent[] = []

  function getFrameIdx(nodeId: string, name: string): number {
    const key = `${nodeId}\0${name}`
    let idx = frameIndex.get(key)
    if (idx === undefined) {
      idx = frames.length
      frames.push({ name: `${name} (${nodeId})` })
      frameIndex.set(key, idx)
    }
    return idx
  }

  function walk(profile: NodeProfile): void {
    const idx = getFrameIdx(profile.nodeId, profile.name)
    events.push({ type: 'O', at: profile.startTime, frame: idx })
    for (const child of profile.children) {
      walk(child)
    }
    events.push({ type: 'C', at: profile.endTime, frame: idx })
  }

  for (const root of capture.rootProfiles) {
    walk(root)
  }

  return JSON.stringify(
    {
      $schema: 'https://www.speedscope.app/file-format-schema.json',
      shared: { frames },
      profiles: [
        {
          type: 'evented',
          name: 'Frame Render',
          unit: 'milliseconds',
          startValue: 0,
          endValue: capture.totalTimeMs,
          events
        }
      ]
    },
    null,
    2
  )
}
