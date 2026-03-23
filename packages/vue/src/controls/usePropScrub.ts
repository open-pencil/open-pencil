import type { Editor, SceneNode } from '@open-pencil/core'

export function usePropScrub(editor: Editor) {
  const previousValues = new Map<string, Record<string, number | string>>()

  function storePreviousValues(nodes: SceneNode[], key: string) {
    for (const n of nodes) {
      let rec = previousValues.get(n.id)
      if (!rec) {
        rec = {}
        previousValues.set(n.id, rec)
      }
      if (!(key in rec)) {
        rec[key] = n[key as keyof SceneNode] as number | string
      }
    }
  }

  function updateProp(nodes: SceneNode[], key: string, value: number | string) {
    if (nodes.length > 1) {
      storePreviousValues(nodes, key)
    }
    for (const n of nodes) {
      editor.updateNode(n.id, { [key]: value })
    }
  }

  function commitProp(
    nodes: SceneNode[],
    key: string,
    _value: number | string,
    previous: number | string
  ) {
    if (nodes.length > 1) {
      for (const n of nodes) {
        const prev = previousValues.get(n.id)?.[key] ?? previous
        editor.commitNodeUpdate(n.id, { [key]: prev } as Partial<SceneNode>, `Change ${key}`)
      }
      previousValues.clear()
    } else {
      const n = nodes[0]
      if (n)
        editor.commitNodeUpdate(n.id, { [key]: previous } as Partial<SceneNode>, `Change ${key}`)
    }
  }

  return { updateProp, commitProp }
}
