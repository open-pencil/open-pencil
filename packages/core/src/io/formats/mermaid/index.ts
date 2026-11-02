import { parseFlowchart } from '@open-pencil/mermaid'
import { SceneGraph } from '@open-pencil/scene-graph'

import { addFlowchart } from './layers'

export { addFlowchart, type FlowchartLayers } from './layers'

/**
 * A Mermaid flowchart as a FigJam board: one page named after the chart's title, with the chart's
 * nodes, subgraphs, and edges laid out on it.
 */
export async function mermaidToSceneGraph(text: string): Promise<SceneGraph> {
  const chart = parseFlowchart(text)
  const graph = new SceneGraph()
  const page = graph.getPages().at(0)
  if (!page) throw new Error('A new document has no page')
  if (chart.title) graph.updateNode(page.id, { name: chart.title })
  await addFlowchart(graph, page.id, chart)
  return graph
}
