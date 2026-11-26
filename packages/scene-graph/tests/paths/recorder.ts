import type { PathSink } from '@open-pencil/scene-graph/paths'

/** A path sink that keeps what it is told as command strings, for a test to compare. */
export interface PathRecorder extends PathSink {
  commands: string[]
}
