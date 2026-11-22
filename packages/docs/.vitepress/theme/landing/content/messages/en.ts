import type { LandingMessages } from './types'

export const en: LandingMessages = {
  hero: {
    title: 'Design without the lock‑in.',
    lede: 'An open-source design editor that opens your Figma files, runs on your machine, and lets you or your AI agent drive every layer.',
    open: 'Take the tour',
    download: 'Download',
    github: 'GitHub'
  },
  loading: 'Loading editor',
  features: {
    figma: {
      title: 'Open what you already have',
      detail:
        'OpenPencil reads .fig files directly: pages, components, instances, variables, and auto layout arrive as editable layers, and you can save back to .fig. Paste SVG or open HTML and CSS, and they become layers too, laid out as a browser lays them out.',
      hint: 'This is the app’s own tour, a real .fig file. Open a chapter in the layers and click around.'
    },
    design: {
      title: 'Design with real tools',
      detail:
        'Auto layout, constraints, fills, strokes, effects, and typography, with the controls where you expect them. Components take slots, so an instance keeps the design and brings its own content. Everything is undoable, and nothing waits on a server.',
      hint: 'Hover the selected cover and drag a corner to round it. The other players bring their own covers through the Artwork slot.'
    },
    interactive: {
      title: 'Components that work',
      detail:
        'Give a component a behaviour, such as a switch, checkbox, slider, tabs, or text field, and preview runs it as a real Reka UI control. Variants become its states, and the same components export to Storybook with controls you can click.',
      hint: 'This canvas is in preview: press play, drag the progress bar, toggle shuffle. Leave preview to edit.'
    },
    tokens: {
      title: 'Variables are design tokens',
      detail:
        'Colours, spacing, and type live in collections with modes and are edited as tokens. Exported code writes bound values as CSS custom properties, so the code uses the same names as the design.',
      hint: 'Each player reads the Theme collection in its own mode. Change a token’s value and both follow.'
    },
    shaders: {
      title: 'Fills that move',
      detail:
        'A shader is a fill like any other: pick one in the fill picker, stack effects, tune their sliders, or paste a preset from shaders.com. Files keep a still of it, so they open anywhere, and preview plays it.',
      hint: 'This canvas is in preview, so the shaders move. Leave preview, select a square, and open its fill.'
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
    collab: {
      title: 'Work together, with people and agents',
      detail:
        'Share a link and everyone edits the same document, peer to peer, with live cursors, follow mode, comments pinned to layers, and voice calls. AI agents join the same way: everyone in the room watches them build as they stream.',
      hint: 'Both screens are yours to use. Drag a layer on one and watch it move on the other, then ask the agent.'
    },
    code: {
      title: 'From design to code',
      detail:
        'Every selection is a Vue or React component, with variants as props and Reka UI or Radix behind the interactive ones, or HTML, Tailwind, and design JSX with variables written as tokens. Components export as Storybook stories, and design JSX stays linked to the canvas: edit it and the canvas follows.',
      hint: 'Switch to React, HTML, or design JSX, or select another layer.'
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
    shipped: {
      label: 'Shipped',
      entries: [
        { title: 'OpenPencil Cloud, also self-hosted' },
        { title: 'FigJam-style boards' },
        { title: 'Web pages from a URL as layers' },
        { title: 'Agent Skills and subagents' },
        { title: 'Variable formulas' },
        { title: 'Variable fonts, Material Symbols, and SF Symbols' },
        { title: 'Glass, progressive blur, noise, and texture' },
        { title: 'Image adjustments' },
        { title: 'The Scale tool' },
        { title: 'A faster canvas' },
        { title: 'Comments and voice calls in shared rooms' },
        { title: 'Interactive components and preview' },
        { title: 'Linting with one-click fixes' }
      ]
    },
    now: {
      label: 'Now',
      entries: [
        {
          title: 'Display P3 color',
          detail: 'Documents drawn and exported in their color profile, as in Figma.'
        },
        {
          title: 'Website import',
          detail: 'Pages from a URL drawn closer to the browser, at several window sizes.'
        },
        {
          title: 'OpenPencil on Android',
          detail: 'The editor on Android phones, tablets, and foldables.'
        }
      ]
    },
    next: {
      label: 'Next',
      leads: [
        {
          title: 'OpenPencil on your phone',
          detail:
            'A companion app for iOS and Android, and the editor itself on phones and tablets.',
          features: [
            {
              title: 'Companion app',
              detail: 'Open Cloud files, follow a room live, and answer comments and agents.'
            },
            {
              title: 'Device preview',
              detail: 'Mirror a frame from your desktop onto your phone while you design.'
            },
            {
              title: 'Design on tablets',
              detail: 'Touch and pencil input, with panels laid out for small screens.'
            },
            {
              title: 'Same documents',
              detail: 'The editor and Cloud you already use, not a separate app.'
            }
          ]
        },
        {
          title: 'Presentations',
          detail: 'Slide decks beside designs and boards, built from your design system.',
          features: [
            {
              title: 'Your components',
              detail: 'Decks use the same components, variables, and libraries as your designs.'
            },
            {
              title: 'Presenter view',
              detail: 'Speaker notes, full-screen presenting, and an audience that follows live.'
            },
            {
              title: 'Figma Slides files',
              detail: 'Open and save .deck files, and export to PDF and PowerPoint.'
            },
            {
              title: 'Decks from AI',
              detail: 'Draft a deck from an outline or a document, in the deck’s theme.'
            }
          ]
        }
      ],
      entries: [
        {
          title: 'Single sign-on',
          detail: 'OIDC and SSO for teams, with service accounts and webhooks.'
        },
        {
          title: 'Projects and folders',
          detail: 'Organize Cloud workspaces, with templates and search.'
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
        },
        { title: 'Prototyping', detail: 'Connections, transitions, and overlays between frames.' }
      ]
    }
  },
  cloud: {
    badge: 'Now open',
    title: 'OpenPencil Cloud',
    lede: 'Your team’s design workspace, hosted for you. Everyone edits the same files live, shares them with a link, and designs with AI paid from the plan’s credits, with nothing to install or run. Start free with 300 MB, and export your files as .fig whenever you like.',
    signUp: 'Try OpenPencil Cloud',
    plans: 'See plans',
    features: [
      {
        title: 'Real-time team sync',
        detail: 'Every change reaches every teammate as it happens, on any device.'
      },
      {
        title: 'Share links and comments',
        detail: 'Send a link to review a design and discuss it right on the canvas.'
      },
      {
        title: 'Version history',
        detail: 'Named versions and autosaves to look at, restore, or copy.'
      },
      {
        title: 'AI from your plan',
        detail:
          'Agents that design with you, paid from your plan’s credits, with no API keys to manage.'
      },
      {
        title: 'Self-host it',
        detail: 'Run the same server on your own infrastructure, under the Apache License 2.0.'
      }
    ]
  },
  closing: {
    title: 'Take your designs with you.',
    download: 'Download OpenPencil',
    docs: 'Read the docs',
    cloud: 'Try OpenPencil Cloud'
  },
  clipboard: {
    copy: 'Copy',
    copied: 'Copied'
  },
  stage: {
    activate: 'Try it live',
    terminal: {
      tree: 'Layer tree',
      restyle: 'Recolor the accent',
      addPlayer: 'Add a player',
      selection: 'Selection',
      export: 'Tailwind export'
    },
    ai: {
      recorded: 'Recorded turn',
      play: 'Play',
      replay: 'Replay',
      request: 'Add an Up next queue beside the player.',
      reasoning:
        'The player sits alone in the hero frame, which lays its children out in a row, so a card added there lands right beside it. I’ll bind the card’s background, radius, and text colors to the Theme variables the player uses, so it switches between dark and light with it, and list three tracks, each with a small cover, a title, and an artist.',
      reply:
        'Added an **Up next** card beside the player with three tracks. Its colors and radius come from the Theme variables, so it follows the player between dark and light.'
    },
    collab: {
      you: 'You',
      yourScreen: 'Your screen',
      theirScreen: 'Sam’s screen',
      askAgent: 'Ask the agent'
    },
    sdk: {
      install: 'Install'
    }
  },
  download: {
    title: 'Download OpenPencil',
    lede: 'The desktop app for macOS, Windows, and Linux. Free and open source, with nothing to sign up for.',
    version: 'Version {version}, released {date}',
    forPlatform: 'Download for {platform}',
    moreFiles: 'More downloads for {platform}',
    releaseNotes: 'Release notes',
    yourSystem: 'Your system',
    arch: {
      appleSilicon: 'Apple Silicon',
      intel: 'Intel',
      x64: 'x64',
      arm: 'ARM'
    },
    formats: {
      dmg: 'Disk image',
      exe: 'Installer',
      msi: 'For managed installs',
      appimage: 'Runs on most distributions',
      deb: 'Debian, Ubuntu',
      rpm: 'Fedora, openSUSE'
    },
    requirements: 'System requirements',
    allTitle: 'All downloads',
    checksums: 'SHA-256 checksums',
    onGitHub: 'Release on GitHub',
    unavailable:
      'The list of downloads could not be loaded. Every file is on the releases page on GitHub.',
    others: {
      title: 'Other ways to get it',
      homebrew: {
        title: 'Homebrew',
        detail:
          'The signed macOS app from the official cask. Homebrew reviews each update, so it can arrive a little later than here.'
      },
      web: {
        title: 'In the browser',
        detail: 'The same editor at app.openpencil.dev, with nothing to install.',
        action: 'Open the web app'
      },
      cli: {
        title: 'Command line',
        detail: 'Inspect, export, lint, and script .fig files without opening the app.'
      },
      source: {
        title: 'From source',
        detail: 'Build the app yourself with Bun and Rust.',
        action: 'Build instructions'
      }
    },
    beta: {
      badge: 'Beta',
      title: 'Try what’s next',
      lede: 'Betas bring the next version’s features early, before they reach everyone.',
      caveats: [
        'An app on the stable release does not update to a beta; install the beta to try it.',
        'On Linux, remove a beta installed with .deb or .rpm before installing the final release.',
        'The CLI and SDK betas are on npm under the next tag.'
      ],
      notes: 'What’s new'
    }
  }
}
