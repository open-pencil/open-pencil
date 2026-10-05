import type { SceneNode } from '@open-pencil/scene-graph'

import { rangeControl } from './range'

/** Slider: the thumb moves along the track and the range fills up to it. */
export const slider = rangeControl(({ session, target }, ratio) => {
  session.edit(target, (graph, copy) => {
    const track = session.partFrame(target, copy, 'track')
    const thumb = session.partFrame(target, copy, 'thumb')
    const range = session.partFrame(target, copy, 'range')
    if (!track || !thumb) return
    // The thumb and range sit either inside the track or beside it in the same parent.
    const originOf = (node: SceneNode) => (node.parentId === track.id ? 0 : track.x)
    const travel = Math.max(0, track.width - thumb.width)
    graph.updateNode(thumb.id, { x: originOf(thumb) + ratio * travel })
    if (range)
      graph.updateNode(range.id, {
        x: originOf(range),
        width: Math.max(0, ratio * travel + thumb.width / 2)
      })
  })
}, 'thumb')
