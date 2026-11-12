import { CANVAS_TOOLS, type CanvasToolContext, type CanvasToolPointer } from './registry'

/** Starts what a press does: the middle button pans with any tool, others go to the active tool. */
export function pressCanvasTool(pointer: CanvasToolPointer, context: CanvasToolContext) {
  const tool =
    pointer.event.button === 1 ? CANVAS_TOOLS.HAND : CANVAS_TOOLS[context.editor.state.activeTool]
  tool.press(pointer, context)
}

/** Lets the active tool show what the pointer is over while no drag is held. */
export function hoverCanvasTool(pointer: CanvasToolPointer, context: CanvasToolContext) {
  CANVAS_TOOLS[context.editor.state.activeTool].hover?.(pointer, context)
}
