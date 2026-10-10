import type { CommentThread } from '@open-pencil/scene-graph'

// Dark enough for white initials to read, as in the presence stories' sample room.
const red = { r: 0.75, g: 0.16, b: 0.16, a: 1 }
const blue = { r: 0.13, g: 0.4, b: 0.75, a: 1 }

const HOUR = 3_600_000
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString()

/** A thread with a formatted comment and a reply, as two people leave them. */
export const discussed: CommentThread = {
  id: 'c_1',
  pageId: '0:1',
  pageName: 'Checkout',
  nodeId: '1:2',
  nodeName: 'Order summary',
  x: 120,
  y: 80,
  author: 'Dana Scully',
  authorColor: red,
  text: 'The **total** gets lost here. Could we:\n- make it *bigger*\n- drop the ~~divider~~\n\nSee [the brief](https://openpencil.dev).',
  createdAt: ago(5),
  updatedAt: ago(1),
  resolved: false,
  replies: [
    {
      id: 'r_1',
      author: 'Ben Ortiz',
      authorColor: blue,
      text: 'Done, the total is 20px now.',
      createdAt: ago(1)
    }
  ]
}

export const resolved: CommentThread = {
  ...discussed,
  id: 'c_2',
  text: 'Align the button with the card edge.',
  resolved: true,
  resolvedAt: ago(2),
  replies: []
}

export const long: CommentThread = {
  ...discussed,
  id: 'c_3',
  text: 'A longer note that runs on: the hero image crops the product on small screens, the headline wraps onto three lines at 375px, and the secondary button disappears below the fold, so people never see the free shipping offer that the whole page is built around.',
  replies: Array.from({ length: 6 }, (_, index) => ({
    id: `r_long_${index}`,
    author: index % 2 ? 'Dana Scully' : 'Ben Ortiz',
    authorColor: index % 2 ? red : blue,
    text: index % 2 ? 'Agreed.' : 'Trying a shorter headline now.',
    createdAt: ago(4 - index * 0.5)
  }))
}
