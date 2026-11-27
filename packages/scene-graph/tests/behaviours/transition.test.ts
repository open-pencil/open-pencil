import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import {
  behaviourFromSpec,
  behaviourToSpec,
  mapTransitionVariables,
  resolveTransition,
  transitionVariableIds
} from '@open-pencil/scene-graph/behaviours'
import { easingPreset } from '@open-pencil/scene-graph/variables'

/**
 * A button set and an instance of it, with a Motion collection whose Reduced mode turns the
 * duration to 0 and the easing linear.
 */
function button() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const motion = graph.createCollection('Motion')
  const reduced = graph.createMode(motion.id, 'Reduced') ?? ''
  const fast = graph.createVariable('Duration/Fast', 'TIMING', motion.id, 0.15)
  fast.valuesByMode[reduced] = 0
  const standard = graph.createVariable(
    'Easing/Standard',
    'EASING',
    motion.id,
    easingPreset('INOUT_CUBIC')
  )
  standard.valuesByMode[reduced] = easingPreset('LINEAR')
  const set = graph.createNode('COMPONENT_SET', page.id, { name: 'Button' })
  const variant = graph.createNode('COMPONENT', set.id, { name: 'State=Default' })
  const instance = graph.createInstance(variant.id, page.id)
  if (!instance) throw new Error('No instance')
  return { graph, set, instance, motion, reduced, fast, standard }
}

describe('behaviour transitions', () => {
  test('a spec names variables, which keep their default value beside them', () => {
    const { graph, set, fast, standard } = button()
    const behaviour = behaviourFromSpec(graph, set, {
      kind: 'button',
      transition: { duration: { variable: 'Duration/Fast' }, easing: { variable: standard.id } }
    })
    expect(behaviour.transition).toEqual({
      duration: 0.15,
      easing: easingPreset('INOUT_CUBIC'),
      durationVariableId: fast.id,
      easingVariableId: standard.id
    })
    expect(behaviourToSpec(graph, set, behaviour).transition).toEqual({
      duration: { variable: 'Duration/Fast' },
      easing: { variable: 'Easing/Standard' }
    })
  })

  test('a spec takes seconds and a CSS easing or an easing name, Ease out over 300ms by default', () => {
    const { graph, set } = button()
    const spec = (transition: object) =>
      behaviourFromSpec(graph, set, { kind: 'button', transition }).transition
    expect(spec({})).toEqual({ duration: 0.3, easing: easingPreset('OUT_CUBIC') })
    expect(spec({ duration: 0.2, easing: 'ease-in' })).toEqual({
      duration: 0.2,
      easing: easingPreset('EASE_IN')
    })
    expect(spec({ easing: 'GENTLE_SPRING' })?.easing).toEqual(easingPreset('GENTLE_SPRING'))
    expect(() => spec({ easing: 'wobbly' })).toThrow('"wobbly" is not an easing')
    expect(() => spec({ duration: { variable: 'Easing/Standard' } })).toThrow(
      '"Easing/Standard" holds EASING; this needs a TIMING variable'
    )
  })

  test('an instance plays the variables in the modes it is in', () => {
    const { graph, set, instance, motion, reduced } = button()
    const behaviour = behaviourFromSpec(graph, set, {
      kind: 'button',
      transition: {
        duration: { variable: 'Duration/Fast' },
        easing: { variable: 'Easing/Standard' }
      }
    })
    expect(resolveTransition(graph, behaviour, instance.id)).toEqual({
      duration: 0.15,
      easing: easingPreset('INOUT_CUBIC')
    })
    graph.updateNode(instance.id, { variableModes: { [motion.id]: reduced } })
    expect(resolveTransition(graph, behaviour, instance.id)).toEqual({
      duration: 0,
      easing: easingPreset('LINEAR')
    })
  })

  test('a deleted variable leaves the transition its own value', () => {
    const { graph, set, instance, fast } = button()
    const behaviour = behaviourFromSpec(graph, set, {
      kind: 'button',
      transition: { duration: { variable: 'Duration/Fast' }, easing: 'ease-out' }
    })
    graph.removeVariable(fast.id)
    expect(resolveTransition(graph, behaviour, instance.id)?.duration).toBe(0.15)
    expect(behaviourToSpec(graph, set, behaviour).transition?.duration).toBe(0.15)
  })

  test('a copy maps the variables a transition follows, and lets go of ones it leaves behind', () => {
    const { graph, set, fast, standard } = button()
    const behaviour = behaviourFromSpec(graph, set, {
      kind: 'button',
      transition: { duration: { variable: fast.id }, easing: { variable: standard.id } }
    })
    expect(transitionVariableIds(behaviour)).toEqual([fast.id, standard.id])
    const mapped = mapTransitionVariables(behaviour, (id) => (id === fast.id ? 'copy' : undefined))
    expect(mapped.transition).toEqual({
      duration: 0.15,
      easing: easingPreset('INOUT_CUBIC'),
      durationVariableId: 'copy'
    })
  })
})
