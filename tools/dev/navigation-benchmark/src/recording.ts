import { readFile } from 'node:fs/promises'

import * as v from 'valibot'

import type { NavigationRecordingFile } from './types'

const wheelSampleSchema = v.object({
  timeMs: v.pipe(v.number(), v.minValue(0)),
  deltaX: v.number(),
  deltaY: v.number(),
  deltaMode: v.number(),
  ctrlKey: v.optional(v.boolean(), false),
  metaKey: v.optional(v.boolean(), false),
  shiftKey: v.optional(v.boolean(), false),
  clientX: v.number(),
  clientY: v.number(),
  cancelable: v.optional(v.boolean(), true),
  directionInvertedFromDevice: v.optional(v.boolean())
})

const traceEventSchema = v.object({
  name: v.string(),
  timestamp: v.number(),
  detail: v.record(v.string(), v.union([v.number(), v.string(), v.boolean(), v.null()]))
})

const recordingSchema = v.object({
  schemaVersion: v.literal(1),
  name: v.pipe(v.string(), v.nonEmpty()),
  source: v.picklist(['macos-trackpad', 'synthetic']),
  recordedAt: v.string(),
  environment: v.record(v.string(), v.union([v.string(), v.number()])),
  sceneRenderer: v.optional(v.picklist(['existing', 'retained', 'tiled']), 'retained'),
  initialViewport: v.object({ panX: v.number(), panY: v.number(), zoom: v.number() }),
  wheel: v.array(wheelSampleSchema),
  trace: v.array(traceEventSchema)
})

export function parseRecording(value: unknown): NavigationRecordingFile {
  const data = v.parse(recordingSchema, value)
  const normalized = {
    ...data,
    sceneRenderer: data.sceneRenderer === 'existing' ? ('retained' as const) : data.sceneRenderer
  }
  for (let index = 1; index < data.wheel.length; index++) {
    const current = data.wheel[index]
    const previous = data.wheel[index - 1]
    if (current && previous && current.timeMs < previous.timeMs) {
      throw new Error('Wheel samples must be ordered by timeMs')
    }
  }
  return normalized
}

export async function readRecording(path: string): Promise<NavigationRecordingFile> {
  return parseRecording(JSON.parse(await readFile(path, 'utf8')))
}
