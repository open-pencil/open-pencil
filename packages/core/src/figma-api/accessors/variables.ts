import { omit } from 'es-toolkit/object'

import type { SceneGraph, Variable } from '@open-pencil/scene-graph'

import {
  assertProxyEditable,
  graph,
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import {
  type FigmaBindableField,
  assertBindableField,
  bindingVariable,
  figmaBoundVariables,
  hasBindableField,
  isTextBindableField,
  setEmptyTextBinding,
  setLayerBinding
} from '#core/figma-api/variables/bindings'
import type { FigmaVariableAlias } from '#core/figma-api/variables/values'
import { reconcileVariableLayouts } from '#core/layout/variables'

type CollectionRef = { readonly id: string } | string

/** The variable members every node proxy has, as Figma's `SceneNodeMixin` names them. */
export interface VariableNodeMembers {
  readonly explicitVariableModes: Readonly<Record<string, string>>
  readonly resolvedVariableModes: Readonly<Record<string, string>>
  setExplicitVariableModeForCollection(collection: CollectionRef, modeId: string): void
  clearExplicitVariableModeForCollection(collection: CollectionRef): void
  readonly boundVariables: Readonly<
    Record<string, FigmaVariableAlias | readonly FigmaVariableAlias[]>
  >
  setBoundVariable(
    field: FigmaBindableField,
    variable: { readonly id: string } | string | null
  ): void
}

function collectionId(collection: CollectionRef): string {
  return typeof collection === 'string' ? collection : collection.id
}

function setVariableModes(
  target: ProxyThis,
  internals: NodeProxyInternals,
  variableModes: Record<string, string>
): void {
  const node = raw(target, internals)
  updateNode(target, internals, { variableModes })
  reconcileVariableLayouts(graph(target, internals), { subtrees: [node.id] })
}

type RangeBinder = (start: number, end: number, field: string, variable: Variable | null) => void

export function installVariableModeNodeProxyAccessors(
  prototype: object,
  internals: NodeProxyInternals
): void {
  Object.defineProperties(prototype, {
    explicitVariableModes: {
      get(this: ProxyThis): Readonly<Record<string, string>> {
        return Object.freeze({ ...raw(this, internals).variableModes })
      }
    },
    resolvedVariableModes: {
      get(this: ProxyThis): Readonly<Record<string, string>> {
        const sceneGraph: SceneGraph = graph(this, internals)
        const node = raw(this, internals)
        const modes: Record<string, string> = {}
        for (const collectionId of sceneGraph.variableCollections.keys()) {
          const modeId = sceneGraph.getNodeVariableModeId(node.id, collectionId)
          if (modeId) modes[collectionId] = modeId
        }
        return Object.freeze(modes)
      }
    },
    setExplicitVariableModeForCollection: {
      value(this: ProxyThis, collection: CollectionRef, modeId: string): void {
        const id = collectionId(collection)
        const found = graph(this, internals).variableCollections.get(id)
        // Figma's message names the two ids the other way round.
        if (!found?.modes.some((mode) => mode.modeId === modeId)) {
          throw new Error(
            `in setExplicitVariableModeForCollection: Could not find modeId ${id} in variable ` +
              `set with variableCollectionId: '${modeId}'`
          )
        }
        setVariableModes(this, internals, { ...raw(this, internals).variableModes, [id]: modeId })
      }
    },
    clearExplicitVariableModeForCollection: {
      value(this: ProxyThis, collection: CollectionRef): void {
        const modes = raw(this, internals).variableModes
        const id = collectionId(collection)
        if (id in modes) setVariableModes(this, internals, omit(modes, [id]))
      }
    },
    boundVariables: {
      get(this: ProxyThis) {
        return Object.freeze(figmaBoundVariables(raw(this, internals)))
      }
    },
    setBoundVariable: {
      /**
       * Binds a field to a variable, by object or id, or unbinds it for `null`, with Figma's field
       * names and type rules; a field the layer lacks is ignored.
       */
      value(
        this: ProxyThis & { setRangeBoundVariable: RangeBinder },
        field: string,
        variable: { readonly id: string } | string | null
      ): void {
        const name = assertBindableField(field)
        const sceneGraph = graph(this, internals)
        const bound =
          variable === null ? null : bindingVariable(sceneGraph, 'setBoundVariable', name, variable)
        const node = raw(this, internals)
        if (!hasBindableField(node, name)) return
        assertProxyEditable(this, internals)
        if (isTextBindableField(name)) {
          // A text style field binds every character, as setting it on the whole text does;
          // text with none yet keeps it on the layer, which its characters then take.
          if (node.text === '') setEmptyTextBinding(sceneGraph, node, name, bound)
          else this.setRangeBoundVariable(0, node.text.length, name, bound)
          return
        }
        setLayerBinding(sceneGraph, node, name, bound)
      }
    }
  })
}
