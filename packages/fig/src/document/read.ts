import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import {
  createOccurrenceInterpreter,
  type InterpretInstanceOptions
} from '../instance-overrides/interpret'
import {
  resolveDocumentBindingReferences,
  type BindingReferenceDiagnostic
} from './binding-references'
import { planComponentConstruction } from './components'

/** Indexed source document. Resources remain separate from scene occurrences. */
export function createDocumentReader(source: readonly NodeChange[]) {
  const bindingDiagnostics: BindingReferenceDiagnostic[] = []
  const changes = resolveDocumentBindingReferences(source, (diagnostic) =>
    bindingDiagnostics.push(diagnostic)
  )
  const resources = changes.filter(
    (change) => change.type === 'VARIABLE' || change.type === 'VARIABLE_SET'
  )
  const sceneChanges = changes.filter(
    (change) => change.type !== 'VARIABLE' && change.type !== 'VARIABLE_SET'
  )
  const interpreter = createOccurrenceInterpreter(sceneChanges)
  const pages = changes
    .filter((change) => change.type === 'CANVAS')
    .toSorted((a, b) => {
      const left = a.parentIndex?.position ?? ''
      const right = b.parentIndex?.position ?? ''
      if (left === right) return 0
      return left < right ? -1 : 1
    })
    .map((page) => {
      if (!page.guid) throw new Error('Page has no GUID')
      return { id: guidToString(page.guid), name: page.name ?? '' }
    })
  const pageIds = new Set(pages.map((page) => page.id))
  return {
    pages,
    resources,
    bindingDiagnostics,
    readPage(id: string, options: InterpretInstanceOptions = {}) {
      if (!pageIds.has(id)) throw new Error(`Unknown page ${id}`)
      return interpreter.page(id, options)
    },
    planComponents(
      roots: readonly ReturnType<typeof interpreter.page>[],
      options: InterpretInstanceOptions = {}
    ) {
      return planComponentConstruction(changes, roots, (id) => interpreter.component(id, options))
    },
    readComponent: interpreter.component
  }
}
