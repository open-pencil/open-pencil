import { rangeControl } from './range'

/**
 * Progress: the indicator fills the track up to the value. Reka's progress only displays a
 * value; preview lets the pointer and arrows change it so the fill can be tried.
 */
export const progress = rangeControl(({ session, target }, ratio) => {
  session.edit(target, (graph, copy) => {
    const track = session.partFrame(target, copy, 'track')
    const indicator = session.partFrame(target, copy, 'indicator')
    if (!track || !indicator) return
    graph.updateNode(indicator.id, {
      x: indicator.parentId === track.id ? 0 : track.x,
      width: ratio * track.width
    })
  })
})
