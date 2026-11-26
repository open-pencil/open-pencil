import { filename } from 'pathe/utils'

import {
  exportHTMLBundle,
  sceneNodesToDesignDocument,
  type DesignDocument
} from '@open-pencil/dom-css/export'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { withBooleanOutlines } from '#core/io/formats/svg/boolean/combine'
import type { SVGBooleanOutlines } from '#core/io/formats/svg/boolean/outline'
import type { ExportAsset, HTMLExportOptions } from '#core/io/types'
import { exportWebFontFaceAssets } from '#core/text/web-font/assets'

import { vectorElementWith } from './vectors'

/** The layers as one document, which keeps the tokens they reference for its stylesheet. */
function designDocument(
  graph: SceneGraph,
  nodeIds: string[],
  booleanOutlines: SVGBooleanOutlines | undefined
): DesignDocument {
  return sceneNodesToDesignDocument(graph, nodeIds, {
    vectorElement: vectorElementWith(booleanOutlines)
  })
}

/** `card.html` keeps its external files in `card.assets/` next to it, whatever the path style. */
function assetBasePath(fileName: string | undefined): string {
  const name = fileName && filename(fileName)
  return `${name || 'export'}.assets`
}

export async function renderNodesToHTML(
  graph: SceneGraph,
  nodeIds: string[],
  options: HTMLExportOptions = {},
  fileName?: string
): Promise<{ html: string; assets: ExportAsset[] }> {
  const design = await withBooleanOutlines(graph, nodeIds, async (booleanOutlines) =>
    designDocument(graph, nodeIds, booleanOutlines)
  )
  const bundle = await exportHTMLBundle(design, {
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
