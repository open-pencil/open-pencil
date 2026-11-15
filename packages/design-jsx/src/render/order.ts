import { compact, isPlainObject, isString, pull, range, uniq } from 'es-toolkit'

import { namesComponent, rekaRole } from '../behaviours'
import { isComponentProperty } from '../components/properties'
import { DESIGN_JSX_SUPPORTED_PROPERTIES } from '../definitions'
import { elementNodeType } from '../elements'
import { isLayerRef, type LayerRef } from '../refs'
import { isTreeNode, type TreeNode } from '../tree'

/** A component as an element names it: by name, or by the `ref()` that marks it. */
type ComponentKey = string | LayerRef

/**
 * The components an element and its descendants define and name. `mayName` holds the text values
 * property props give, an exposed nested instance's included: a swap takes one as a component's name, other properties as plain text,
 * and which is which is known only once the component renders.
 */
interface ComponentUse {
  defines: ComponentKey[]
  names: ComponentKey[]
  mayName: string[]
}

/** Whether an element defines a component: a component, a set, or a Reka root naming none. */
function definesComponent(node: TreeNode): boolean {
  const nodeType = elementNodeType(node.type)
  if (nodeType === 'COMPONENT' || nodeType === 'COMPONENT_SET') return true
  return rekaRole(node.type)?.role === 'root' && !namesComponent(node.props)
}

/** What the element itself defines or names, without its descendants. */
function ownUse(node: TreeNode): ComponentUse {
  const { props } = node
  if (definesComponent(node)) {
    const name = isString(props.name) ? props.name : ''
    return { defines: compact([name, isLayerRef(props.ref) && props.ref]), names: [], mayName: [] }
  }
  const of = props.component ?? props.componentId ?? props.of
  const component = isComponentProperty(of) ? of.defaultValue : of
  const assigned = [
    ...Object.entries(props)
      .filter(([key]) => !DESIGN_JSX_SUPPORTED_PROPERTIES.has(key))
      .map(([, value]) => value),
    ...(isPlainObject(props.properties) ? Object.values(props.properties) : [])
  ]
  // An exposed nested instance's values, as in `Action={{ Icon: 'Arrow' }}`.
  const nested = assigned.filter(isPlainObject).flatMap((values) => Object.values(values))
  return {
    defines: [],
    names: [
      ...(isString(component) || isLayerRef(component) ? [component] : []),
      ...assigned.filter(isLayerRef)
    ],
    mayName: [...assigned, ...nested].filter(isString)
  }
}

/** Reads each element's components once, for every level an order is asked at. */
export class RenderOrder {
  private readonly uses = new WeakMap<TreeNode, ComponentUse>()

  private use(node: TreeNode): ComponentUse {
    const known = this.uses.get(node)
    if (known) return known
    const parts = [
      ownUse(node),
      ...node.children.filter(isTreeNode).map((child) => this.use(child))
    ]
    const use = {
      defines: uniq(parts.flatMap((part) => part.defines)),
      names: uniq(parts.flatMap((part) => part.names)),
      mayName: uniq(parts.flatMap((part) => part.mayName))
    }
    this.uses.set(node, use)
    return use
  }

  /**
   * The indices of `siblings` in render order: those that define a component before those that
   * name it, otherwise as written. When none is ready, what text values may name gives way
   * first, so a text that matches a component's name never holds back a real reference; only
   * components that do name each other keep the written order.
   */
  of(siblings: readonly TreeNode[]): number[] {
    const uses = siblings.map((sibling) => this.use(sibling))
    if (uses.every((use) => use.defines.length === 0)) return range(siblings.length)

    const owners = new Map<ComponentKey, number[]>()
    uses.forEach((use, index) => {
      for (const key of use.defines) owners.set(key, [...(owners.get(key) ?? []), index])
    })
    const siblingsDefining = (keys: ComponentKey[], index: number) =>
      uniq(keys.flatMap((key) => owners.get(key) ?? [])).filter((owner) => owner !== index)
    const needs = uses.map((use, index) => siblingsDefining(use.names, index))
    const mayNeed = uses.map((use, index) => siblingsDefining(use.mayName, index))

    const order: number[] = []
    const pending = range(siblings.length)
    const rendered = (indices: number[]) => indices.every((index) => order.includes(index))
    while (pending.length > 0) {
      const next =
        pending.find((index) => rendered(needs[index]) && rendered(mayNeed[index])) ??
        pending.find((index) => rendered(needs[index])) ??
        pending[0]
      order.push(next)
      pull(pending, [next])
    }
    return order
  }
}
