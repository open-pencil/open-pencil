import { emptyBehaviour } from '@open-pencil/scene-graph/behaviours'

import { COLORS, componentSet, slot, solid, standalone, withTextProperty } from './sets'

/** A slider at 60 of 0 to 100 in steps of 5: a track holding its range, and a thumb. */
export function sliderComponent() {
  return standalone(
    'Volume',
    {
      ...emptyBehaviour('slider'),
      parts: { track: 'track-slot', range: 'range-slot', thumb: 'thumb-slot' },
      numbers: { value: { min: 0, max: 100, step: 5, default: 60 } }
    },
    (graph, slider) => {
      const track = graph.createNode('FRAME', slider.id, {
        name: 'Track',
        componentPropertyReferences: slot('track-slot'),
        y: 8,
        width: 200,
        height: 4,
        fills: COLORS.off
      })
      graph.createNode('FRAME', track.id, {
        name: 'Range',
        componentPropertyReferences: slot('range-slot'),
        width: 120,
        height: 4,
        fills: COLORS.on
      })
      graph.createNode('FRAME', slider.id, {
        name: 'Thumb',
        componentPropertyReferences: slot('thumb-slot'),
        x: 110,
        width: 20,
        height: 20,
        fills: COLORS.white
      })
    },
    { width: 200, height: 20 }
  )
}

/** A progress bar at 50 of 0 to 200, its indicator inside its track. */
export function progressComponent() {
  return standalone(
    'Upload',
    {
      ...emptyBehaviour('progress'),
      parts: { track: 'track-slot', indicator: 'indicator-slot' },
      numbers: { value: { min: 0, max: 200, step: 1, default: 50 } }
    },
    (graph, progress) => {
      const track = graph.createNode('FRAME', progress.id, {
        name: 'Track',
        componentPropertyReferences: slot('track-slot'),
        width: 200,
        height: 8,
        fills: COLORS.off
      })
      graph.createNode('FRAME', track.id, {
        name: 'Indicator',
        componentPropertyReferences: slot('indicator-slot'),
        width: 50,
        height: 8,
        fills: COLORS.on
      })
    },
    { width: 200, height: 8 }
  )
}

/** A number field at 2 of 1 to 10 between its decrement and increment, hugging them. */
export function numberFieldComponent() {
  const fixture = standalone(
    'Quantity',
    {
      ...emptyBehaviour('numberField'),
      texts: { text: { propertyId: 'count' } },
      parts: { decrement: 'decrement-slot', increment: 'increment-slot' },
      numbers: { value: { min: 1, max: 10, step: 1, default: 2 } }
    },
    (graph, field) => {
      graph.updateNode(field.id, {
        layoutMode: 'HORIZONTAL',
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG',
        itemSpacing: 8
      })
      const stepper = (name: string, property: string) =>
        graph.createNode('FRAME', field.id, {
          name,
          componentPropertyReferences: slot(property),
          width: 24,
          height: 24,
          fills: COLORS.off
        })
      stepper('Decrement', 'decrement-slot')
      graph.createNode('TEXT', field.id, {
        name: 'Count',
        text: '2',
        componentPropertyReferences: [{ propertyId: 'count', field: 'TEXT' }]
      })
      stepper('Increment', 'increment-slot')
    },
    { width: 80, height: 24 }
  )
  return withTextProperty(fixture.graph, fixture.set, {
    id: 'count',
    name: 'Count',
    defaultValue: '2'
  })
}

const INK = solid(0.07, 0.09, 0.15)
const MUTED = solid(0.61, 0.64, 0.69)

/**
 * A text field drawn empty, its placeholder in a muted color, and filled, its words in ink, its
 * text bound to an Email property whose words are the placeholder. With `invalid`, an Invalid
 * property draws it with a red border.
 */
export function textFieldSet({ invalid = false } = {}) {
  const fixture = componentSet(
    'Email',
    { Filled: ['No', 'Yes'], ...(invalid ? { Invalid: ['No', 'Yes'] } : {}) },
    {
      ...emptyBehaviour('textField'),
      texts: { value: { propertyId: 'email' } },
      booleans: {
        filled: { propertyId: 'filled', on: 'Yes', off: 'No' },
        ...(invalid ? { invalid: { propertyId: 'invalid', on: 'Yes', off: 'No' } } : {})
      }
    },
    (graph, variant, { Filled, Invalid }) => {
      const strokes =
        Invalid === 'Yes'
          ? COLORS.error.map((paint) => ({ ...paint, weight: 1, align: 'INSIDE' as const }))
          : []
      graph.updateNode(variant, { width: 240, height: 36, strokes })
      graph.createNode('TEXT', variant, {
        name: 'Value',
        text: Filled === 'Yes' ? 'ada@example.com' : 'Email',
        fills: Filled === 'Yes' ? INK : MUTED,
        componentPropertyReferences: [{ propertyId: 'email', field: 'TEXT' }]
      })
    }
  )
  return withTextProperty(fixture.graph, fixture.set, {
    id: 'email',
    name: 'Email',
    defaultValue: 'Email'
  })
}

/** A textarea starting with its words, with nothing drawn empty. */
export function textareaComponent() {
  const fixture = standalone(
    'Message',
    { ...emptyBehaviour('textarea'), texts: { value: { propertyId: 'message' } } },
    (graph, field) => {
      graph.createNode('TEXT', field.id, {
        name: 'Value',
        text: 'Tell us more',
        componentPropertyReferences: [{ propertyId: 'message', field: 'TEXT' }]
      })
    },
    { width: 240, height: 80 }
  )
  return withTextProperty(fixture.graph, fixture.set, {
    id: 'message',
    name: 'Message',
    defaultValue: 'Tell us more'
  })
}
