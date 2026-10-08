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
    now: { label: string; entries: RoadmapEntryMessages[] }
    next: {
      label: string
      /** The entry presented as a feature block of its own. */
      lead: TitledDetail & { features: TitledDetail[] }
      entries: RoadmapEntryMessages[]
    }
    later: { label: string; entries: RoadmapEntryMessages[] }
  }
  closing: {
    title: string
    download: string
    docs: string
  }
  /** Strings shown inside the live stages, next to the app's own translated panels. */
  stage: {
    terminal: Record<'tree' | 'restyle' | 'addPlan' | 'selection' | 'export', string>
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
      copy: string
      copied: string
    }
  }
}
