import {
  exportHTMLBundle,
  sceneNodeToDesignDocument,
  type DesignDocument
} from '@open-pencil/dom-css/export'
import type { SceneGraph } from '@open-pencil/scene-graph'

import type { ExportAsset, HTMLExportOptions } from '#core/io/types'
import { exportWebFontFaceAssets } from '#core/text/web-font/assets'

function designDocument(graph: SceneGraph, nodeIds: string[]): DesignDocument {
  return {
    type: 'document',
    sourceGraph: graph,
    children: nodeIds.flatMap((id) => sceneNodeToDesignDocument(graph, id).children)
  }
}

/** `card.html` keeps its external files in `card.assets/` next to it, whatever the path style. */
function assetBasePath(fileName: string | undefined): string {
  const name = fileName
    ?.split(/[\\/]/)
    .pop()
    ?.replace(/\.[^.]*$/, '')
  return `${name || 'export'}.assets`
}

export async function renderNodesToHTML(
  graph: SceneGraph,
  nodeIds: string[],
  options: HTMLExportOptions = {},
  fileName?: string
): Promise<{ html: string; assets: ExportAsset[] }> {
  const bundle = await exportHTMLBundle(designDocument(graph, nodeIds), {
    html: options.html,
    style: options.style,
    assets: options.assets,
    fonts:
      options.fonts === 'assets'
        ? async (fonts, basePath) =>
            (await exportWebFontFaceAssets({ fonts, assetBasePath: basePath })).assets
        : 'none',
    assetBasePath: assetBasePath(fileName)
  })
  const page = bundle.files.find((file) => file.path === bundle.entrypoint)
  if (typeof page?.content !== 'string') throw new Error('HTML export produced no page')
  return { html: page.content, assets: bundle.files.filter((file) => file !== page) }
}
