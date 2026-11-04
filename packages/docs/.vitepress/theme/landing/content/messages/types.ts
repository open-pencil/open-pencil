import type { FileFormat } from '#docs/theme/landing/download/releases'

import type { FeatureKind } from '../features'

export interface TitledDetail {
  title: string
  detail: string
}

export interface RoadmapEntryMessages {
  title: string
  detail?: string
}

/**
 * Everything the landing page says. English (`en.ts`) is the source; every other catalog is
 * typed against this interface, so a missing or extra string fails type-checking.
 */
export interface LandingMessages {
  hero: {
    title: string
    lede: string
    open: string
    download: string
    github: string
  }
  /** Accessible label of the placeholder shown before the editor code arrives. */
  loading: string
  features: Record<FeatureKind, TitledDetail & { hint: string }>
  agents: {
    heading: string
    /** Closes the list of named agents. */
    rest: string
  }
  commands: {
    /** `{count}` is replaced with the number of CLI commands. */
    cli: string
    /** `{count}` is replaced with the number of MCP tools. */
    mcp: string
    mcpDetail: string
  }
  ownership: {
    title: string
    items: TitledDetail[]
  }
  roadmap: {
    title: string
    more: string
    shipped: { label: string; entries: RoadmapEntryMessages[] }
    now: { label: string; entries: RoadmapEntryMessages[] }
    next: {
      label: string
      /** The entry presented as a feature block of its own. */
      lead: TitledDetail & { features: TitledDetail[] }
      entries: RoadmapEntryMessages[]
      /** OpenPencil Cloud, after self-hosting, with the waitlist form under it. */
      cloud: TitledDetail
    }
    later: { label: string; entries: RoadmapEntryMessages[] }
  }
  /** The hosted product, with its waitlist. */
  cloud: {
    badge: string
    title: string
    lede: string
    features: TitledDetail[]
  }
  /** The OpenPencil Cloud waitlist form, in the Cloud section and the roadmap. */
  waitlist: {
    /** Accessible name of the email field. */
    label: string
    placeholder: string
    submit: string
    /** The button while a sign-up waits on the visitor to tick Turnstile's check. */
    confirmHuman: string
    invalid: string
    joined: string
    joinedDetail: string
    /** The service could not be reached, or failed. */
    failed: string
    privacy: string
    /** Turnstile did not confirm a person. */
    refused: string
    /** Too many sign-ups from one place in a minute. */
    limited: string
    /** Turnstile cannot run on this page, such as a preview or local build. */
    unavailable: string
  }
  closing: {
    title: string
    download: string
    docs: string
    /** Links to the Cloud section's waitlist. */
    cloud: string
  }
  /** A copy button's label, and what it says once it copied. */
  clipboard: {
    copy: string
    copied: string
  }
  /** Strings shown inside the live stages, next to the app's own translated panels. */
  stage: {
    /** Starts a stage from its still on a touch screen, where stages wait to be asked. */
    activate: string
    terminal: Record<'tree' | 'restyle' | 'addPlayer' | 'selection' | 'export', string>
    ai: {
      recorded: string
      play: string
      replay: string
      request: string
      reasoning: string
      reply: string
    }
    collab: {
      /** How the visitor appears on the other screen. */
      you: string
      yourScreen: string
      /** The other screen, belonging to the teammate named Sam. */
      theirScreen: string
      askAgent: string
    }
    sdk: {
      /** Heads the install command under the snippet. */
      install: string
    }
  }
  /** The download page, which shares the landing's look and catalog. */
  download: {
    title: string
    lede: string
    /** `{version}` and `{date}` are replaced. */
    version: string
    /** The main button for the visitor's system; `{platform}` is replaced. */
    forPlatform: string
    /** Opens the menu of every installer for the platform; `{platform}` is replaced. */
    moreFiles: string
    releaseNotes: string
    /** Marks the visitor's platform in the list of downloads. */
    yourSystem: string
    arch: Record<'appleSilicon' | 'intel' | 'x64' | 'arm', string>
    /** What each kind of file is for. */
    formats: Record<FileFormat, string>
    requirements: string
    allTitle: string
    checksums: string
    onGitHub: string
    /** Shown when the site was built without the release list. */
    unavailable: string
    others: {
      title: string
      homebrew: TitledDetail
      web: TitledDetail & { action: string }
      cli: TitledDetail
      source: TitledDetail & { action: string }
    }
    beta: {
      badge: string
      title: string
      lede: string
      /** What to know before installing a beta. */
      caveats: string[]
      notes: string
    }
  }
}
