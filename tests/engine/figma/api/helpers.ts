import { FigmaAPI, SceneGraph } from '@inkly/core'
export function createAPI(): FigmaAPI {
  return new FigmaAPI(new SceneGraph())
}
