import { describe, expect, test } from 'bun:test'

import { parseFlowchart, type FlowEdge, type Flowchart } from '@open-pencil/mermaid'

function node(chart: Flowchart, id: string) {
  const found = chart.nodes.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`No node ${id}`)
  return found
}

function link(edge: FlowEdge) {
  return [edge.from, edge.to, edge.startArrow, edge.endArrow, edge.stroke, edge.length]
}

// Cases follow Mermaid's own parser specs (`diagrams/flowchart/parser/flow-*.spec.js`), read
// through our model instead of Mermaid's `FlowDB`.
describe('parseFlowchart', () => {
  test('reads the direction in each spelling', () => {
    expect(parseFlowchart('graph TD;A-->B').direction).toBe('TB')
    expect(parseFlowchart('graph >;A-->B').direction).toBe('LR')
    expect(parseFlowchart('graph <;A-->B').direction).toBe('RL')
    expect(parseFlowchart('graph ^;A-->B').direction).toBe('BT')
    expect(parseFlowchart('graph v;A-->B').direction).toBe('TB')
    expect(parseFlowchart('flowchart LR\nA-->B').direction).toBe('LR')
    expect(parseFlowchart('flowchart\nA-->B').direction).toBe('TB')
  })

  test('gives each bracket form its shape and label', () => {
    const chart = parseFlowchart(`flowchart TD
      a[square] --> b(round) --> c([stadium]) --> d[[subroutine]] --> e[(cylinder)]
      f((circle)) --> g{diamond} --> h{{hexagon}} --> i>odd] --> j(((double)))
      k[/lean right/] --> l[\\lean left\\] --> m[/trapezoid\\] --> n[\\inverted/]
      o(-ellipse-) --> p`)
    const shapes = Object.fromEntries(chart.nodes.map((n) => [n.id, n.shape]))
    expect(shapes).toEqual({
      a: 'rect',
      b: 'rounded',
      c: 'stadium',
      d: 'fr-rect',
      e: 'cyl',
      f: 'circle',
      g: 'diam',
      h: 'hex',
      i: 'odd',
      j: 'dbl-circ',
      k: 'lean-r',
      l: 'lean-l',
      m: 'trap-b',
      n: 'trap-t',
      o: 'ellipse',
      p: 'rect'
    })
    expect(node(chart, 'g').label).toEqual({ text: 'diamond', format: 'text' })
    // A node written without brackets is labelled with its id.
    expect(node(chart, 'p').label).toEqual({ text: 'p', format: 'text' })
  })

  test('takes the shape and label from `@{ … }` data, aliases included', () => {
    const chart = parseFlowchart(`flowchart TD
      a@{ shape: doc, label: "Spec" }
      b@{ shape: database }
      c@{
        shape: diamond
        label: Choose
      }
      a --> b`)
    expect(node(chart, 'a').shape).toBe('doc')
    expect(node(chart, 'a').label.text).toBe('Spec')
    expect(node(chart, 'b').shape).toBe('cyl')
    expect(node(chart, 'c').shape).toBe('diam')
    expect(node(chart, 'c').label.text).toBe('Choose')
    expect(() => parseFlowchart('flowchart TD\na@{ shape: blob }')).toThrow('No such shape: blob')
  })

  test('reads arrowheads, strokes, and lengths', () => {
    const edges = parseFlowchart(`graph TD
      A-->B
      A---B
      A-.->B
      A==>B
      A~~~B
      A--oB
      A--xB
      A<-->B
      A o--o B
      A x==x B
      A---->B
      A-...->B`).edges
    expect(edges.map(link)).toEqual([
      ['A', 'B', 'none', 'arrow', 'normal', 1],
      ['A', 'B', 'none', 'none', 'normal', 1],
      ['A', 'B', 'none', 'arrow', 'dotted', 1],
      ['A', 'B', 'none', 'arrow', 'thick', 1],
      ['A', 'B', 'none', 'none', 'invisible', 1],
      ['A', 'B', 'none', 'circle', 'normal', 1],
      ['A', 'B', 'none', 'cross', 'normal', 1],
      ['A', 'B', 'arrow', 'arrow', 'normal', 1],
      ['A', 'B', 'circle', 'circle', 'normal', 1],
      ['A', 'B', 'cross', 'cross', 'thick', 1],
      ['A', 'B', 'none', 'arrow', 'normal', 3],
      ['A', 'B', 'none', 'arrow', 'dotted', 3]
    ])
  })

  test('reads edge labels in both forms and fans `&` out', () => {
    const chart = parseFlowchart(`graph LR
      A -- yes --> B
      A -->|no| C
      A & B --> D & E`)
    expect(chart.edges.map((edge) => [edge.from, edge.to, edge.label?.text])).toEqual([
      ['A', 'B', 'yes'],
      ['A', 'C', 'no'],
      ['A', 'D', undefined],
      ['A', 'E', undefined],
      ['B', 'D', undefined],
      ['B', 'E', undefined]
    ])
  })

  test('names an edge by its id, and the id never becomes a node', () => {
    const chart = parseFlowchart(`flowchart LR
      A e1@--> B & C
      e1@{ animate: true }`)
    expect(chart.edges.map((edge) => [edge.id, edge.to])).toEqual([
      ['e1', 'B'],
      ['L_A_C_0', 'C']
    ])
    expect(chart.nodes.map((n) => n.id)).toEqual(['A', 'B', 'C'])
  })

  test('nests subgraphs, gives each node to its innermost one, and keeps their directions', () => {
    const chart = parseFlowchart(`flowchart TB
      c1-->a2
      subgraph one
        a1-->a2
      end
      subgraph two [Second]
        direction LR
        b1-->b2
        subgraph three
          b2-->b3
        end
      end
      subgraph Title with spaces
        x
      end
      one --> two`)
    const subgraphs = chart.subgraphs.map((s) => [s.id, s.title.text, s.members, s.direction])
    expect(subgraphs).toEqual([
      ['one', 'one', ['a2', 'a1'], undefined],
      ['three', 'three', ['b3', 'b2'], undefined],
      ['two', 'Second', ['b1', 'three'], 'LR'],
      ['subGraph3', 'Title with spaces', ['x'], undefined]
    ])
    // Edges may join subgraphs, which are not nodes.
    expect(chart.edges.at(-1)).toMatchObject({ from: 'one', to: 'two' })
    expect(chart.nodes.map((n) => n.id)).not.toContain('one')
  })

  test('collects classes and styles for nodes, subgraphs, and edges', () => {
    const chart = parseFlowchart(`flowchart LR
      A:::hot --> B
      subgraph S
        C
      end
      classDef hot fill:#f96,stroke:#333
      classDef cold,frozen fill:#9cf
      class B cold
      style A stroke-width:4px
      style S fill:#eee
      class S frozen
      linkStyle default stroke:#999
      linkStyle 0 stroke:#f00`)
    expect(node(chart, 'A')).toMatchObject({ classes: ['hot'], styles: ['stroke-width:4px'] })
    expect(node(chart, 'B').classes).toEqual(['cold'])
    expect(chart.classDefs.get('hot')).toEqual(['fill:#f96', 'stroke:#333'])
    expect(chart.classDefs.get('frozen')).toEqual(['fill:#9cf'])
    expect(chart.subgraphs[0]).toMatchObject({ styles: ['fill:#eee'], classes: ['frozen'] })
    expect(chart.edges[0]?.styles).toEqual(['stroke:#999', 'stroke:#f00'])
    expect(() => parseFlowchart('flowchart LR\nA-->B\nlinkStyle 3 stroke:#f00')).toThrow(
      'out of bounds'
    )
  })

  test('keeps links and tooltips, and ignores callbacks', () => {
    const chart = parseFlowchart(`flowchart LR
      A-->B-->C
      click A "https://example.com" "Docs" _blank
      click B href "https://example.org"
      click C callback "Runs a script"`)
    expect(node(chart, 'A')).toMatchObject({
      link: { href: 'https://example.com', target: '_blank' },
      tooltip: 'Docs'
    })
    expect(node(chart, 'B').link).toEqual({ href: 'https://example.org' })
    expect(node(chart, 'C').link).toBeUndefined()
    expect(node(chart, 'C').tooltip).toBe('Runs a script')
  })

  test('reads text labels as Mermaid draws them, and markdown as written', () => {
    const chart = parseFlowchart(`flowchart LR
      A["Quoted (with) brackets"] --> B[Line<br>break<br/>again]
      B --> C["<b>Bold</b> #quot;text#quot; #9829;"]
      C --> D["\`**Markdown** text\`"]`)
    expect(node(chart, 'A').label.text).toBe('Quoted (with) brackets')
    expect(node(chart, 'B').label.text).toBe('Line\nbreak\nagain')
    expect(node(chart, 'C').label.text).toBe('Bold "text" ♥')
    expect(node(chart, 'D').label).toEqual({ text: '**Markdown** text', format: 'markdown' })
  })

  test('reads the title from front matter and skips directives and comments', () => {
    const chart = parseFlowchart(`---
title: Checkout
config:
  theme: dark
---
%%{init: {"flowchart": {"curve": "basis"}}}%%
flowchart LR
  %% a comment
  A --> B
  accTitle: Steps
  accDescr: The checkout steps`)
    expect(chart.title).toBe('Checkout')
    expect(chart.direction).toBe('LR')
    expect(chart.accessibleTitle).toBe('Steps')
    expect(chart.accessibleDescription).toBe('The checkout steps')
    expect(chart.nodes.map((n) => n.id)).toContain('A')
  })

  test('throws Mermaid’s parse error for text it cannot read', () => {
    expect(() => parseFlowchart('flowchart LR\nA --> ')).toThrow(/^Parse error on line \d+:/)
    expect(() => parseFlowchart('sequenceDiagram\nA->>B: hi')).toThrow()
  })
})
