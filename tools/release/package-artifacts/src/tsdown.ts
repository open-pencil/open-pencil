import type { UserConfig } from 'tsdown'

/**
 * Names a chunk after the source file it holds, under `chunks/`, so a package's `dist` mirrors
 * `src` and an entry's declarations never share a name with a chunk. Declaration files keep the
 * names tsdown gives them.
 */
const CHUNKS_BY_SOURCE = {
  test: /(?<!\.d\.c?ts)$/,
  name: (id: string) => {
    const parts = id.split('?')[0].split(/[\\/]/g)
    const srcIndex = parts.lastIndexOf('src')
    const file = srcIndex !== -1 ? parts.slice(srcIndex + 1).join('/') : (parts.at(-1) ?? 'chunk')
    return `chunks/${file.replace(/\.(ts|tsx)$/, '')}`
  }
}

type Deps = NonNullable<UserConfig['deps']>

/** Output options in their object form, which the preset merges into its own. */
type OutputOptions = Exclude<UserConfig['outputOptions'], (...args: never[]) => unknown>

export interface LibraryConfig extends Omit<UserConfig, 'deps' | 'outputOptions'> {
  /**
   * Modules left out of the bundle besides `node:` built-ins; tsdown already leaves out the
   * package's dependencies and peer dependencies.
   */
  neverBundle?: (string | RegExp)[]
  /** Dependencies bundled in all the same, such as a private workspace package. */
  alwaysBundle?: Deps['alwaysBundle']
  /**
   * How chunks are laid out: one per source file under `chunks/` (the default), every module
   * kept at its source path (`unbundle`), or rolldown's own grouping.
   */
  chunks?: 'by-source' | 'unbundle' | 'default'
  outputOptions?: OutputOptions
}

/**
 * The build every published package shares: ES modules with declarations and source maps in
 * `dist`, without hashes in file names, side-effect-free tree shaking, and `node:` built-ins
 * left external. A package passes its entries and what it does differently.
 */
export function libraryConfig({
  neverBundle = [],
  alwaysBundle,
  chunks = 'by-source',
  outputOptions,
  ...config
}: LibraryConfig): UserConfig {
  return {
    platform: 'neutral',
    format: ['esm'],
    dts: true,
    sourcemap: true,
    hash: false,
    clean: true,
    outDir: './dist',
    treeshake: { moduleSideEffects: false },
    unbundle: chunks === 'unbundle',
    ...config,
    deps: { neverBundle: [/^node:/, ...neverBundle], alwaysBundle, onlyBundle: false },
    outputOptions: {
      minifyInternalExports: false,
      ...(chunks === 'by-source' ? { codeSplitting: { groups: [CHUNKS_BY_SOURCE] } } : {}),
      ...outputOptions
    }
  }
}
