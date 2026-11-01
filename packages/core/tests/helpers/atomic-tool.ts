import { EDIT_VIEW, type DocumentChange, type EditorProfileInputs } from '@open-pencil/core'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { ALL_TOOLS, type ToolDef } from '@open-pencil/core/tools'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { UndoManager } from '@open-pencil/scene-graph/undo'

/** The tool definition named `name`. */
export function tool(name: string): ToolDef {
  const def = ALL_TOOLS.find((candidate) => candidate.name === name)
  if (!def) throw new Error(`Missing ${name}`)
  return def
}

/** An editor stub over a new graph that records the layers it lays out, and a rectangle. */
export function setup() {
  const graph = new SceneGraph()
  const undo = new UndoManager()
  const figma = new FigmaAPI(graph)
  const state: EditorProfileInputs = {
    documentKind: 'design',
    canvasView: EDIT_VIEW,
    hostRestrictions: { readOnly: false }
  }
  const laidOut: string[] = []
  const editor = {
    graph,
    state,
    runLayoutForNode: (id: string) => {
      laidOut.push(id)
    },
    requestRender: () => undefined,
    pushUndoStep: undo.pushStep.bind(undo)
  }
  const rectangle = figma.createRectangle()
  const recorded: DocumentChange[] = []
  const onRecorded = (change: DocumentChange) => {
    recorded.push(change)
  }
  return { graph, figma, editor, undo, rectangle, tool, laidOut, recorded, onRecorded }
}

/** A second page with a rectangle, while the first page stays current. */
export function withOtherPage(graph: SceneGraph) {
  const page = graph.addPage('Other')
  const rect = graph.createNode('RECTANGLE', page.id)
  return { page, rect }
}

export function node(graph: SceneGraph, id: string): SceneNode {
  const found = graph.getNode(id)
  if (!found) throw new Error(`Missing ${id}`)
  return found
}
