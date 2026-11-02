import { expect, test } from 'bun:test'

import { guid } from '#fig-tests/helpers/guid'
import { materializeDocument } from '#fig/document/materialize'

import type { NodeChange } from '@lawha/kiwi/fig/codec'

const mode = guid(10)
const collection = guid(11)
const variable = guid(12)
const page = guid(1)
const component = guid(2)
const label = guid(3)
const placed = guid(4)

/** A string variable named by an alias, the way Figma records a bound text layer. */
function textBinding(): NodeChange['variableConsumptionMap'] {
  return {
    entries: [
      {
        variableField: 'TEXT_DATA',
        variableData: {
          dataType: 'ALIAS',
          resolvedDataType: 'STRING',
          value: { alias: { guid: variable } }
        }
      }
    ]
  }
}

function resources(value: string): NodeChange[] {
  return [
    { guid: collection, type: 'VARIABLE_SET', variableSetModes: [{ id: mode, name: 'Default' }] },
    {
      guid: variable,
      type: 'VARIABLE',
      variableResolvedType: 'STRING',
      variableSetID: { guid: collection },
      variableDataValues: {
        entries: [
          { modeID: mode, variableData: { dataType: 'STRING', value: { textValue: value } } }
        ]
      }
    }
  ] as NodeChange[]
}

function textOf(graph: ReturnType<typeof materializeDocument>['graph'], name: string): string {
  const node = [...graph.getAllNodes()].find((candidate) => candidate.name === name)
  if (!node) throw new Error(`Missing ${name}`)
  return node.text
}

test('reads a layer whose text is bound to a string variable', () => {
  const changes = [
    ...resources('Bound'),
    { guid: page, type: 'CANVAS' },
    {
      guid: label,
      type: 'TEXT',
      name: 'Label',
      parentIndex: { guid: page, position: '!' },
      textData: { characters: 'Stale' },
      variableConsumptionMap: textBinding()
    }
  ] as NodeChange[]
  const { graph } = materializeDocument(changes)
  expect(textOf(graph, 'Label')).toBe('Bound')
})

/**
 * Figma retires a literal override of a bound layer rather than applying it, so the
 * binding decides what the instance reads.
 */
test('a bound layer keeps its variable value over an owner’s literal override', () => {
  const changes = [
    ...resources('Bound'),
    { guid: page, type: 'CANVAS' },
    { guid: component, type: 'SYMBOL', parentIndex: { guid: page, position: '!' } },
    {
      guid: label,
      type: 'TEXT',
      name: 'Label',
      parentIndex: { guid: component, position: '!' },
      textData: { characters: 'Bound' },
      variableConsumptionMap: textBinding()
    },
    {
      guid: placed,
      type: 'INSTANCE',
      name: 'Placed',
      parentIndex: { guid: page, position: '"' },
      symbolData: {
        symbolID: component,
        symbolOverrides: [{ guidPath: { guids: [label] }, textData: { characters: 'Override' } }]
      }
    }
  ] as NodeChange[]
  const { graph } = materializeDocument(changes)
  const instance = [...graph.getAllNodes()].find((node) => node.name === 'Placed')
  if (!instance) throw new Error('Missing instance')
  const child = graph.getChildren(instance.id)[0]
  expect(child.boundVariables.text).toBe('1:12')
  expect(child.text).toBe('Bound')
})

/** An override may carry the binding alone, with no literal text to fall back on. */
test('an override that only binds a variable supplies the text', () => {
  const changes = [
    ...resources('9+'),
    { guid: page, type: 'CANVAS' },
    { guid: component, type: 'SYMBOL', parentIndex: { guid: page, position: '!' } },
    {
      guid: label,
      type: 'TEXT',
      name: 'Label',
      parentIndex: { guid: component, position: '!' },
      textData: { characters: 'Default' }
    },
    {
      guid: placed,
      type: 'INSTANCE',
      name: 'Placed',
      parentIndex: { guid: page, position: '"' },
      symbolData: {
        symbolID: component,
        symbolOverrides: [{ guidPath: { guids: [label] }, variableConsumptionMap: textBinding() }]
      }
    }
  ] as NodeChange[]
  const { graph } = materializeDocument(changes)
  const instance = [...graph.getAllNodes()].find((node) => node.name === 'Placed')
  if (!instance) throw new Error('Missing instance')
  expect(graph.getChildren(instance.id)[0].text).toBe('9+')
})

test('reads a layer whose text is a number variable, as Figma binds one through STRINGIFY', () => {
  // As the ChatGPT 5 Web UI kit binds its size labels (#1110).
  const changes = [
    { guid: collection, type: 'VARIABLE_SET', variableSetModes: [{ id: mode, name: 'Default' }] },
    {
      guid: variable,
      type: 'VARIABLE',
      variableResolvedType: 'FLOAT',
      variableSetID: { guid: collection },
      variableDataValues: {
        entries: [
          { modeID: mode, variableData: { dataType: 'FLOAT', value: { floatValue: 12.5 } } }
        ]
      }
    },
    { guid: page, type: 'CANVAS' },
    {
      guid: label,
      type: 'TEXT',
      name: 'Size',
      parentIndex: { guid: page, position: '!' },
      textData: { characters: '16' },
      variableConsumptionMap: {
        entries: [
          {
            variableField: 'TEXT_DATA',
            variableData: {
              dataType: 'EXPRESSION',
              resolvedDataType: 'STRING',
              value: {
                expressionValue: {
                  expressionFunction: 'STRINGIFY',
                  expressionArguments: [
                    {
                      dataType: 'ALIAS',
                      resolvedDataType: 'FLOAT',
                      value: { alias: { guid: variable } }
                    }
                  ]
                }
              }
            }
          }
        ]
      }
    }
  ] as NodeChange[]
  const { graph } = materializeDocument(changes)
  const node = [...graph.getAllNodes()].find((candidate) => candidate.name === 'Size')
  expect([node?.text, node?.boundVariables.text]).toEqual(['12.50', '1:12'])
})
