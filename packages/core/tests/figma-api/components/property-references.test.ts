import { expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

// Recorded with the same script in Figma desktop 126.
test('componentPropertyReferences is an object on any layer in a component or instance', () => {
  const figma = new FigmaAPI(new SceneGraph())
  const component = figma.createComponent()
  const inside = figma.createRectangle()
  component.appendChild(inside)
  const ellipse = figma.createEllipse()
  component.appendChild(ellipse)
  const show = component.addComponentProperty('Show', 'BOOLEAN', true)
  ellipse.componentPropertyReferences = { visible: show }
  const loose = figma.createRectangle()
  const instance = component.createInstance()

  expect({
    sublayerWithout: inside.componentPropertyReferences,
    ellipseBound: ellipse.componentPropertyReferences,
    loose: loose.componentPropertyReferences,
    component: component.componentPropertyReferences,
    instanceSublayer: instance.children[1]?.componentPropertyReferences,
    instanceTopLevel: instance.componentPropertyReferences
  }).toEqual({
    sublayerWithout: {},
    ellipseBound: { visible: show },
    loose: null,
    component: {},
    instanceSublayer: { visible: show },
    instanceTopLevel: null
  })
})
