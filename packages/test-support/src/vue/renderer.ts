import { createRenderer } from 'vue'

export type HostNode = {
  children: HostNode[]
  parent: HostNode | null
  text: string
}

export function hostNode(text = ''): HostNode {
  return { children: [], parent: null, text }
}

function remove(child: HostNode): void {
  const parent = child.parent
  if (!parent) return
  const index = parent.children.indexOf(child)
  if (index !== -1) parent.children.splice(index, 1)
  child.parent = null
}

function insert(child: HostNode, parent: HostNode, anchor?: HostNode | null): void {
  remove(child)
  child.parent = parent
  const index = anchor ? parent.children.indexOf(anchor) : -1
  if (index < 0) parent.children.push(child)
  else parent.children.splice(index, 0, child)
}

export function createTestRenderer() {
  return createRenderer<HostNode, HostNode>({
    patchProp: () => undefined,
    insert,
    remove,
    createElement: () => hostNode(),
    createText: hostNode,
    createComment: hostNode,
    setText(node, text) {
      node.text = text
    },
    setElementText(node, text) {
      node.text = text
    },
    parentNode: (node) => node.parent,
    nextSibling(node) {
      const parent = node.parent
      return parent?.children[parent.children.indexOf(node) + 1] ?? null
    },
    querySelector: () => null,
    setScopeId: () => undefined,
    insertStaticContent(content, parent, anchor) {
      const node = hostNode(content)
      insert(node, parent, anchor)
      return [node, node]
    }
  })
}
