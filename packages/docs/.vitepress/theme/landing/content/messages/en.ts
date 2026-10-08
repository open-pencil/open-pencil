import type { LandingMessages } from './types'

export const en: LandingMessages = {
  hero: {
    title: 'Design without the lock‑in.',
    lede: 'An open-source design editor that opens your Figma files, runs on your machine, and lets you or your AI agent drive every layer.',
    open: 'Open the editor',
    download: 'Download',
    github: 'GitHub'
  },
  loading: 'Loading editor',
  features: {
    figma: {
      title: 'Open your Figma files',
      detail:
        'OpenPencil reads .fig files directly: pages, components, instances, variables, and auto layout arrive as editable layers. Copy and paste works in both directions, and you can save back to .fig.',
      hint: 'This is a real .fig file. Expand the layers and click around.'
    },
    design: {
      title: 'Design with real tools',
      detail:
        'Auto layout, constraints, fills, strokes, effects, and typography, with the controls where you expect them. Everything is undoable, and nothing waits on a server.',
      hint: 'Select a layer and change its fill, radius, or padding.'
    },
    interactive: {
      title: 'Components that work',
      detail:
        'Give a component a behaviour, such as a switch, checkbox, slider, tabs, or text field, and preview runs it as a real Reka UI control. Variants become its states, and the same components export to Storybook with controls you can click.',
      hint: 'This canvas is in preview: flip the switch, drag the slider. Leave preview to edit.'
    },
    tokens: {
      title: 'Variables are design tokens',
      detail:
        'Colours, spacing, and type live in collections with modes and are edited as tokens. Exported code writes bound values as CSS custom properties, so the code uses the same names as the design.',
      hint: 'Change a token’s value or switch a mode, and every layer bound to it follows.'
    },
    linting: {
      title: 'Linting',
      detail:
        'OpenPencil checks the design as you work: contrast, text too small to read, default names, hidden and empty layers, stray groups. Problems are marked on the canvas, many come with a fix you apply in one click, and the same rules run in the CLI and for agents.',
      hint: 'Click a marker on the canvas, or apply a fix from the list.'
    },
    ai: {
      title: 'Design with AI, on your keys',
      detail:
        'Ask in plain language and the agent edits the document with the same tools you use, previewing its work on the canvas as it streams. Connect any provider with your own key, or bring the coding agent you already use.',
      hint: 'A recorded turn plays through the real agent loop. Watch the canvas build as it streams.'
    },
    code: {
      title: 'From design to code',
      detail:
        'Every selection is available as Tailwind JSX, HTML, or design JSX, with variables written as tokens, and components export as Storybook stories. Code and canvas stay linked: select a line and its layer is selected, edit the JSX and the canvas follows.',
      hint: 'Select another layer and watch the code follow.'
    },
    script: {
      title: 'Script everything',
      detail:
        'The openpencil CLI works on a file with no app running, or drives the app you have open. Inspect a document, query it with XPath, lint it, export it, or run Figma plugin code against it with eval. The MCP server gives agents the same reach over stdio or HTTP.',
      hint: 'Run a command and watch the canvas.'
    },
    sdk: {
      title: 'Build it into your own product',
      detail:
        'OpenPencil is a toolkit as much as an app: a framework-neutral engine, a headless Vue SDK, and separate packages for the scene graph and file formats. Embed a canvas in your product, render and check designs in CI, or build a different editor on the same engine. Every canvas on this page is that SDK running inside a documentation site.',
      hint: 'The code beside the canvas is all it takes to mount one.'
    }
  },
  agents: {
    heading: 'Works with',
    rest: 'and any MCP client'
  },
  commands: {
    cli: '{count} commands',
    mcp: '{count} MCP tools',
    mcpDetail:
      'Create, style, lay out, inspect, and export, each one also available to the built-in agent.'
  },
  ownership: {
    title: 'Your files stay yours',
    items: [
      {
        title: 'Local first',
        detail: 'Documents are files on your disk. No account, no server, no internet required.'
      },
      {
        title: 'Your storage',
        detail: 'Sync through your own S3-compatible bucket when you want it.'
      },
      {
        title: 'Open formats',
        detail: 'Export to .fig, PDF, PPTX, SVG, HTML, and JSX. Leaving is always possible.'
      },
      {
        title: 'MIT licensed',
        detail: 'The editor, the rendering engine, the .fig codec, and the CLI.'
      }
    ]
  },
  roadmap: {
    title: 'Roadmap',
    more: 'Full roadmap',
    now: {
      label: 'Now',
      entries: [
        {
          title: 'AI agents as collaborators',
          detail: 'See agents on the canvas like any other participant, and follow what they do.'
        },
        {
          title: 'Revert, regenerate, and edit AI turns',
          detail: 'With each tool call showing what it changed.'
        },
        { title: 'Live design checks', detail: 'A Lint panel with canvas markers and fixes.' },
        { title: 'Code linked to canvas layers', detail: 'Selection and edits sync both ways.' },
        {
          title: 'Visual diff and patch',
          detail: 'In the app, for agents, and as openpencil diff.'
        }
      ]
    },
    next: {
      label: 'Next',
      lead: {
        title: 'Self-hosted OpenPencil',
        detail:
          'The whole workspace inside your own network: sync, sharing, comments, and team libraries without sending a file to anyone else.',
        features: [
          { title: 'Your storage', detail: 'Documents stay in your bucket, in your region.' },
          {
            title: 'Your identity',
            detail: 'Sign-in through your OIDC or SSO provider, with roles.'
          },
          {
            title: 'Your network',
            detail: 'A collaboration relay that works behind your firewall.'
          },
          {
            title: 'Your operations',
            detail: 'Guided deployment, upgrades, backups, and retention.'
          }
        ]
      },
      entries: [
        {
          title: 'Version history',
          detail: 'Automatic snapshots, named checkpoints, and restore.'
        },
        {
          title: 'Optional OpenPencil Cloud',
          detail: 'Hosted sync and sharing for teams that want it. Never required.'
        }
      ]
    },
    later: {
      label: 'Later',
      entries: [
        { title: 'Governed design systems', detail: 'Propose, review, publish, and migrate.' },
        {
          title: 'Embeddable editor',
          detail: 'Put the editor on this page into your own product.'
        }
      ]
    }
  },
  closing: {
    title: 'Take your designs with you.',
    download: 'Download OpenPencil',
    docs: 'Read the docs'
  },
  stage: {
    terminal: {
      tree: 'Layer tree',
      restyle: 'Restyle buttons',
      addPlan: 'Add a plan',
      selection: 'Selection',
      export: 'Tailwind export'
    },
    ai: {
      recorded: 'Recorded turn',
      play: 'Play',
      replay: 'Replay',
      request: 'Add three guarantees under the plans.',
      reasoning:
        'The plans sit in an auto-layout column, so a row of three cards can go right below them.',
      reply:
        'Added a **Guarantees** row under the plans: three cards that share the plan cards’ background and radius.'
    },
    sdk: {
      copy: 'Copy',
      copied: 'Copied'
    }
  }
}
