import { describe, expect, test } from 'bun:test'

import { detectMermaidDiagram } from '@open-pencil/mermaid'

describe('detectMermaidDiagram', () => {
  test('recognises flowcharts after front matter, directives, and comments', () => {
    expect(detectMermaidDiagram('flowchart LR\nA-->B')).toBe('flowchart')
    expect(detectMermaidDiagram('  graph TD;A-->B')).toBe('flowchart')
    expect(detectMermaidDiagram('---\ntitle: T\n---\n%%{init: {}}%%\n%% note\ngraph TD\nA')).toBe(
      'flowchart'
    )
  })

  test('returns null for other diagrams and for text that is not Mermaid', () => {
    expect(detectMermaidDiagram('sequenceDiagram\nA->>B: hi')).toBeNull()
    expect(detectMermaidDiagram('graphical user interfaces')).toBeNull()
    expect(detectMermaidDiagram('Hello')).toBeNull()
  })
})
