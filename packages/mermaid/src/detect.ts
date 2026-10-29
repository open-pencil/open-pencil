import { prepareSource } from './source'

/** The Mermaid diagrams OpenPencil reads. */
export type MermaidDiagramType = 'flowchart'

/**
 * The kind of Mermaid diagram `text` holds, by its first keyword after any front matter,
 * directives, and comments, as Mermaid's detectors decide; null for a kind OpenPencil does not
 * read, or text that is not Mermaid.
 */
export function detectMermaidDiagram(text: string): MermaidDiagramType | null {
  const { code } = prepareSource(text)
  return /^\s*(?:graph|flowchart)\b/.test(code) ? 'flowchart' : null
}
