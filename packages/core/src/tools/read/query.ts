import { defineTool } from '#core/tools/schema'
import { queryByXPath } from '#core/xpath'

export const queryNodes = defineTool({
  name: 'query_nodes',
  description: `Query nodes using XPath selectors. Node types are element names (FRAME, TEXT, RECTANGLE, ELLIPSE, etc.). Attributes: name, width, height, x, y, visible, opacity, cornerRadius, fontSize, fontFamily, fontWeight, layoutMode, itemSpacing, paddingTop/Right/Bottom/Left, strokeWeight, rotation, locked, blendMode, text, lineHeight, letterSpacing.

Examples:
  //FRAME — all frames
  //FRAME[@width < 300] — frames narrower than 300px
  //COMPONENT[starts-with(@name, 'Button')] — components starting with "Button"
  //SECTION/FRAME — direct frame children of sections
  //SECTION//TEXT — all text nodes inside sections
  //*[@cornerRadius > 0] — any node with corner radius
  //TEXT[contains(@text, 'Hello')] — text nodes containing "Hello"`,
  params: {
    selector: { type: 'string', description: 'XPath selector', required: true },
    page: { type: 'string', description: 'Page name (default: current page)' },
    limit: { type: 'number', description: 'Max results (default: 1000)' }
  },
  execute: async (figma, args) => {
    try {
      const nodes = await queryByXPath(figma.graph, args.selector, {
        page: args.page ?? figma.currentPage.name,
        limit: args.limit
      })
      return {
        count: nodes.length,
        nodes: nodes.map((node) => ({ id: node.id, name: node.name, type: node.type }))
      }
    } catch (err) {
      return { error: `XPath error: ${err instanceof Error ? err.message : String(err)}` }
    }
  }
})
