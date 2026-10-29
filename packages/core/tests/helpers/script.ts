import { FigmaAPI } from '@open-pencil/core/figma-api'
import { compileScript } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

/** What `code` gives back when run as a script: its result, or the message it stopped with. */
export function scriptResult(code: string, figma = new FigmaAPI(new SceneGraph())): Promise<unknown> {
  return compileScript(code)(figma).catch((error: unknown) =>
    error instanceof Error ? error.message : error
  )
}
