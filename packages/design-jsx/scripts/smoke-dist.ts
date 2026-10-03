export {}

const mod = await import('../dist/index.js')

const tree = mod.Frame({ name: 'Card', w: 100, h: 50 })
if (!mod.isTreeNode(tree) || !mod.JSX_REFERENCE.includes('Frame')) {
  throw new Error('Expected built Design JSX package to build trees and ship its reference')
}
