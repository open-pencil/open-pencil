import type { DesignIssueHighlight, DesignIssueMarker } from '#core/canvas/issues/types'

import type { EditorContext } from './types'

/**
 * Canvas presentation of design check results. The check itself runs outside the editor; these
 * actions only publish what the canvas marks and highlights.
 */
function sameHighlight(a: DesignIssueHighlight | null, b: DesignIssueHighlight | null): boolean {
  if (!a || !b) return a === b
  return (
    a.nodeId === b.nodeId &&
    a.severity === b.severity &&
    a.minSize?.width === b.minSize?.width &&
    a.minSize?.height === b.minSize?.height
  )
}

export function createDesignIssueActions(ctx: EditorContext) {
  function current() {
    return ctx.state.designIssues ?? { markers: [], highlight: null, hoveredMarkerKey: null }
  }

  function setDesignIssueMarkers(markers: readonly DesignIssueMarker[]) {
    const overlay = current()
    if (overlay.markers.length === 0 && markers.length === 0) return
    ctx.state.designIssues = { ...overlay, markers }
    ctx.requestRepaint()
  }

  function setDesignIssueHighlight(highlight: DesignIssueHighlight | null) {
    const overlay = current()
    if (sameHighlight(overlay.highlight, highlight)) return
    ctx.state.designIssues = { ...overlay, highlight }
    ctx.requestRepaint()
  }

  function setHoveredIssueMarker(key: string | null) {
    const overlay = current()
    if (overlay.hoveredMarkerKey === key) return
    ctx.state.designIssues = { ...overlay, hoveredMarkerKey: key }
    ctx.requestRepaint()
  }

  function clearDesignIssues() {
    if (!ctx.state.designIssues) return
    ctx.state.designIssues = null
    ctx.requestRepaint()
  }

  return {
    setDesignIssueMarkers,
    setDesignIssueHighlight,
    setHoveredIssueMarker,
    clearDesignIssues
  }
}
