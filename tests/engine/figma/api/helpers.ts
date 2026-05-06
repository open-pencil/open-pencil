import { FigmaAPI, SceneGraph } from '@open-pencil/core'
export function createAPI(): FigmaAPI {
  return new FigmaAPI(new SceneGraph())
}
