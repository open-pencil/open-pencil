import type { EditorContext } from '#core/editor/types'
import { randomHex } from '#core/random'
import type {
  ComponentPropertyDefinition,
  ComponentPropertyType,
  SceneNode
} from '#core/scene-graph'

export function createVariantActions(ctx: EditorContext) {
  function getComponentSetPropertyDefs(componentSetId: string): ComponentPropertyDefinition[] {
    const node = ctx.graph.getNode(componentSetId)
    if (node?.type !== 'COMPONENT_SET') return []
    return node.componentPropertyDefinitions
  }

  function addPropertyDefinition(
    componentSetId: string,
    name: string,
    type: ComponentPropertyType = 'VARIANT',
    defaultValue = ''
  ): string | undefined {
    const node = ctx.graph.getNode(componentSetId)
    if (node?.type !== 'COMPONENT_SET') return undefined
    const id = `prop:${randomHex(8)}`
    const def: ComponentPropertyDefinition = {
      id,
      name,
      type,
      defaultValue,
      variantOptions: type === 'VARIANT' ? [defaultValue] : undefined
    }
    const prevDefs = [...node.componentPropertyDefinitions]
    ctx.graph.updateNode(componentSetId, {
      componentPropertyDefinitions: [...prevDefs, def]
    })
    ctx.undo.push({
      label: 'Add property',
      forward: () => {
        const n = ctx.graph.getNode(componentSetId)
        if (n) {
          ctx.graph.updateNode(componentSetId, {
            componentPropertyDefinitions: [...n.componentPropertyDefinitions, def]
          })
        }
        ctx.requestRender()
      },
      inverse: () => {
        ctx.graph.updateNode(componentSetId, {
          componentPropertyDefinitions: prevDefs
        })
        ctx.requestRender()
      }
    })
    ctx.requestRender()
    return id
  }

  function removePropertyDefinition(componentSetId: string, propertyId: string) {
    const node = ctx.graph.getNode(componentSetId)
    if (node?.type !== 'COMPONENT_SET') return
    const prevDefs = [...node.componentPropertyDefinitions]
    const def = prevDefs.find((d) => d.id === propertyId)
    if (!def) return
    ctx.graph.updateNode(componentSetId, {
      componentPropertyDefinitions: prevDefs.filter((d) => d.id !== propertyId)
    })
    for (const childId of node.childIds) {
      const child = ctx.graph.getNode(childId)
      if (!child) continue
      const values = { ...child.componentPropertyValues }
      delete values[def.name]
      ctx.graph.updateNode(childId, { componentPropertyValues: values })
    }
    ctx.undo.push({
      label: 'Remove property',
      forward: () => {
        const n = ctx.graph.getNode(componentSetId)
        if (n) {
          ctx.graph.updateNode(componentSetId, {
            componentPropertyDefinitions: n.componentPropertyDefinitions.filter(
              (d) => d.id !== propertyId
            )
          })
          for (const cid of n.childIds) {
            const c = ctx.graph.getNode(cid)
            if (!c) continue
            const v = { ...c.componentPropertyValues }
            delete v[def.name]
            ctx.graph.updateNode(cid, { componentPropertyValues: v })
          }
        }
        ctx.requestRender()
      },
      inverse: () => {
        ctx.graph.updateNode(componentSetId, {
          componentPropertyDefinitions: prevDefs
        })
        ctx.requestRender()
      }
    })
    ctx.requestRender()
  }

  function renamePropertyDefinition(componentSetId: string, propertyId: string, newName: string) {
    const node = ctx.graph.getNode(componentSetId)
    if (node?.type !== 'COMPONENT_SET') return
    const def = node.componentPropertyDefinitions.find((d) => d.id === propertyId)
    if (!def) return
    const prevName = def.name
    const newDefs = node.componentPropertyDefinitions.map((d) =>
      d.id === propertyId ? { ...d, name: newName } : d
    )
    ctx.graph.updateNode(componentSetId, { componentPropertyDefinitions: newDefs })
    for (const childId of node.childIds) {
      const child = ctx.graph.getNode(childId)
      if (!child) continue
      const values = { ...child.componentPropertyValues }
      if (prevName in values) {
        values[newName] = values[prevName]
        delete values[prevName]
        ctx.graph.updateNode(childId, { componentPropertyValues: values })
      }
    }
    ctx.undo.push({
      label: 'Rename property',
      forward: () => {
        const n = ctx.graph.getNode(componentSetId)
        if (n) {
          ctx.graph.updateNode(componentSetId, {
            componentPropertyDefinitions: n.componentPropertyDefinitions.map((d) =>
              d.id === propertyId ? { ...d, name: newName } : d
            )
          })
        }
        ctx.requestRender()
      },
      inverse: () => {
        const n = ctx.graph.getNode(componentSetId)
        if (n) {
          ctx.graph.updateNode(componentSetId, {
            componentPropertyDefinitions: n.componentPropertyDefinitions.map((d) =>
              d.id === propertyId ? { ...d, name: prevName } : d
            )
          })
        }
        ctx.requestRender()
      }
    })
    ctx.requestRender()
  }

  function parseVariantName(name: string): Record<string, string> {
    const values: Record<string, string> = {}
    for (const part of name.split(',').map((s) => s.trim())) {
      const eqIdx = part.indexOf('=')
      if (eqIdx === -1) continue
      values[part.slice(0, eqIdx).trim()] = part.slice(eqIdx + 1).trim()
    }
    return values
  }

  function buildVariantName(values: Record<string, string>): string {
    return Object.entries(values)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')
  }

  function collectVariantOptions(componentSetId: string): Map<string, Set<string>> {
    const node = ctx.graph.getNode(componentSetId)
    if (node?.type !== 'COMPONENT_SET') return new Map()
    const options = new Map<string, Set<string>>()
    for (const childId of node.childIds) {
      const child = ctx.graph.getNode(childId)
      if (child?.type !== 'COMPONENT') continue
      for (const [key, value] of Object.entries(child.componentPropertyValues)) {
        const set = options.get(key) ?? new Set()
        set.add(value)
        options.set(key, set)
      }
    }
    return options
  }

  function findVariantByValues(
    componentSetId: string,
    values: Record<string, string>
  ): SceneNode | undefined {
    const node = ctx.graph.getNode(componentSetId)
    if (node?.type !== 'COMPONENT_SET') return undefined
    for (const childId of node.childIds) {
      const child = ctx.graph.getNode(childId)
      if (child?.type !== 'COMPONENT') continue
      const childValues = child.componentPropertyValues
      const matches = Object.entries(values).every(([k, v]) => childValues[k] === v)
      if (matches) return child
    }
    return undefined
  }

  function switchInstanceVariant(instanceId: string, propertyName: string, newValue: string) {
    const instance = ctx.graph.getNode(instanceId)
    if (instance?.type !== 'INSTANCE' || !instance.componentId) return

    const component = ctx.graph.getNode(instance.componentId)
    if (!component) return
    const componentSetId = component.parentId
    if (!componentSetId) return
    const componentSet = ctx.graph.getNode(componentSetId)
    if (componentSet?.type !== 'COMPONENT_SET') return

    const currentValues = { ...component.componentPropertyValues }
    currentValues[propertyName] = newValue
    const target = findVariantByValues(componentSetId, currentValues)
    if (!target || target.id === instance.componentId) return

    const prevComponentId = instance.componentId
    ctx.graph.updateNode(instanceId, { componentId: target.id })
    ctx.undo.push({
      label: 'Switch variant',
      forward: () => {
        ctx.graph.updateNode(instanceId, { componentId: target.id })
        ctx.requestRender()
      },
      inverse: () => {
        ctx.graph.updateNode(instanceId, { componentId: prevComponentId })
        ctx.requestRender()
      }
    })
    ctx.requestRender()
  }

  return {
    getComponentSetPropertyDefs,
    addPropertyDefinition,
    removePropertyDefinition,
    renamePropertyDefinition,
    parseVariantName,
    buildVariantName,
    collectVariantOptions,
    findVariantByValues,
    switchInstanceVariant
  }
}
