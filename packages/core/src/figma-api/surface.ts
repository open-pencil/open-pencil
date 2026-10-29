/**
 * What `figma` and its objects have beyond Figma's Plugin API. `compatibility.ts` checks the
 * types against these lists and `tests/figma-api/surface.test.ts` checks what scripts can reach.
 * A feature Figma has no API for goes on `openpencil`, never on these lists; entries only leave.
 */

/** Members a host or tool wires up on `figma`, which scripts do not write against. */
export const FIGMA_API_HOST_MEMBERS = [
  'graph',
  'wrapNode',
  'currentPageId',
  'groupFitOptions',
  'setRenderer',
  'theme',
  'exportImage',
  'icons',
  'rasterCodec',
  'changeBaseline'
] as const

/**
 * Members named as in Figma whose types do not match Figma's yet, mostly because node proxies do
 * not implement every Figma node type; remove one when it matches.
 */
export const FIGMA_API_INCOMPLETE_MEMBERS = [
  'createComponentFromNode',
  'createPage',
  'currentPage',
  'getNodeById',
  'getNodeByIdAsync',
  'mixed',
  'root',
  'variables',
  'viewport'
] as const

/** The `JSON.stringify` hook hosts use to report what a script returns. */
export const SERIALIZATION_MEMBERS = ['toJSON'] as const
