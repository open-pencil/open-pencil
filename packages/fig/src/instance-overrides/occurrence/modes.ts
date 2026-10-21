import { extractVariableModes } from '#fig/node-change/convert'

import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import type { PropertyLayer } from '../layers'
import { parentIdOf, recordMatches, sameGuid, type InterpreterIndex } from '../source-index'
import { createBoundCollections } from './bound-collections'
import type { InstanceOccurrence } from './types'

type ModesByCollection = ReadonlyMap<string, string>
type Sources = InterpreterIndex['sources']

interface ModeClaim {
  readonly path: readonly GUID[]
  readonly modes: ModesByCollection
}

export interface ModeScope {
  readonly placed: ModesByCollection
  readonly descendantClaims: readonly ModeClaim[]
  readonly expandedComponent?: NodeChange
}

const NO_MODES: ModesByCollection = new Map()
const NO_CLAIMS: readonly ModeClaim[] = []
const extractedModes = new WeakMap<object, ModesByCollection>()
const documentModes = new WeakMap<Sources, Map<string, ModesByCollection>>()

function modesSetBy(holder: NodeChange | undefined): ModesByCollection | undefined {
  const map = holder?.variableModeBySetMap
  if (!holder || typeof map !== 'object' || map === null) {
    return undefined
  }
  const known = extractedModes.get(map)
  if (known) {
    return known
  }
  const modes: ModesByCollection = new Map(Object.entries(extractVariableModes(holder)))
  extractedModes.set(map, modes)
  return modes
}

function layered(
  base: ModesByCollection,
  ...layers: (ModesByCollection | undefined)[]
): ModesByCollection {
  const present = layers.filter((layer): layer is ModesByCollection => !!layer?.size)
  if (present.length === 0) {
    return base
  }
  return new Map([...base, ...present.flatMap((layer) => [...layer])])
}

function documentOf(sources: Sources): Map<string, ModesByCollection> {
  const known = documentModes.get(sources)
  if (known) {
    return known
  }
  const created = new Map<string, ModesByCollection>()
  documentModes.set(sources, created)
  return created
}

function claimsOfOwner(claims: readonly PropertyLayer[]): ModeClaim[] {
  return claims.flatMap(({ path, props }) => {
    const modes = modesSetBy(props)
    return modes && path.length ? [{ path, modes }] : []
  })
}

function insideComponent(
  claims: readonly ModeClaim[],
  isComponentRoot: (segment: GUID) => boolean
): ModeClaim[] {
  return claims.flatMap((claim) => {
    const path = isComponentRoot(claim.path[0]) ? claim.path.slice(1) : claim.path
    return path.length ? [{ path, modes: claim.modes }] : []
  })
}

interface ClaimRouting {
  readonly ending: ModesByCollection | undefined
  readonly continuing: readonly ModeClaim[]
  readonly elsewhere: readonly ModeClaim[]
}

function routeClaims(claims: readonly ModeClaim[], record: NodeChange): ClaimRouting | undefined {
  const matching = claims.filter(({ path }) => recordMatches(record, path[0]))
  if (matching.length === 0) {
    return undefined
  }
  return {
    ending: matching.find(({ path }) => path.length === 1)?.modes,
    continuing: matching
      .filter(({ path }) => path.length > 1)
      .map(({ path, modes }) => ({ path: path.slice(1), modes })),
    elsewhere: claims.filter((claim) => !matching.includes(claim))
  }
}

export function createModeScopes(index: InterpreterIndex) {
  const { sources, variables } = index
  const byRecord = documentOf(sources)
  const collectionsUnder = createBoundCollections(index)

  const recordOf = (component: GUID | undefined): NodeChange | undefined =>
    component ? sources.get(guidToString(component)) : undefined

  const modesInDocument = (id: string): ModesByCollection => {
    const known = byRecord.get(id)
    if (known) {
      return known
    }
    const record = sources.get(id)
    const parentId = record ? parentIdOf(record) : undefined
    const inherited = parentId ? modesInDocument(parentId) : NO_MODES
    const component =
      record?.type === 'INSTANCE' ? recordOf(record.symbolData?.symbolID) : undefined
    const modes = layered(inherited, modesSetBy(component), modesSetBy(record))
    byRecord.set(id, modes)
    return modes
  }

  const modeIn = (modes: ModesByCollection, collection: string): string | undefined =>
    modes.get(collection) ?? variables.defaultModes.get(collection)

  const differsFromDocument = (scope: ModeScope, source: NodeChange, id: string): boolean => {
    const laidOut = modesInDocument(id)
    if (scope.placed === laidOut) {
      return false
    }
    const bound = collectionsUnder(source)
    const swappedIn = scope.expandedComponent ? collectionsUnder(scope.expandedComponent) : bound
    const differsAt = (collection: string): boolean =>
      (bound.has(collection) || swappedIn.has(collection)) &&
      modeIn(scope.placed, collection) !== modeIn(laidOut, collection)
    return [...scope.placed.keys(), ...laidOut.keys()].some(differsAt)
  }

  const expansionClaims = (
    record: NodeChange,
    component: GUID,
    claims: readonly ModeClaim[]
  ): readonly ModeClaim[] => {
    if (claims.length === 0) {
      return NO_CLAIMS
    }
    const savedComponent = record.symbolData?.symbolID
    const roots = [recordOf(component), recordOf(savedComponent)]
    const isComponentRoot = (segment: GUID): boolean =>
      sameGuid(segment, component) ||
      sameGuid(savedComponent, segment) ||
      roots.some((root) => root !== undefined && recordMatches(root, segment))
    return insideComponent(claims, isComponentRoot)
  }

  return {
    atParentOf(id: string): ModeScope {
      const record = sources.get(id)
      const parentId = record ? parentIdOf(record) : undefined
      const placed = parentId ? modesInDocument(parentId) : NO_MODES
      return { placed, descendantClaims: NO_CLAIMS }
    },
    enter(
      scope: ModeScope,
      record: NodeChange,
      component: GUID | undefined,
      ownClaims: readonly PropertyLayer[]
    ): ModeScope {
      if (scope.expandedComponent === record) {
        return scope
      }
      const routing = scope.descendantClaims.length
        ? routeClaims(scope.descendantClaims, record)
        : undefined
      const own = routing?.ending ?? modesSetBy(record)
      if (!component) {
        if (!own && !routing) {
          return scope
        }
        return {
          placed: layered(scope.placed, own),
          descendantClaims: routing?.elsewhere ?? scope.descendantClaims
        }
      }
      const expandedComponent = recordOf(component)
      const claims = [...(routing?.continuing ?? NO_CLAIMS), ...claimsOfOwner(ownClaims)]
      return {
        placed: layered(scope.placed, modesSetBy(expandedComponent), own),
        descendantClaims: expansionClaims(record, component, claims),
        expandedComponent
      }
    },
    applySavedSize(occurrence: InstanceOccurrence, source: NodeChange, scope: ModeScope): void {
      if (source.type !== 'INSTANCE' || !source.size) {
        return
      }
      occurrence.properties.size = structuredClone(source.size)
      // The size the file keeps for the instance is its own content laid out, such as a hug
      // frame around longer text than its component's, which a sync with the component must
      // not replace.
      if (!differsFromDocument(scope, source, occurrence.sourceId)) {
        occurrence.derivedSize = structuredClone(source.size)
      }
    }
  }
}
