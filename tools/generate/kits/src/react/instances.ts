import { join } from 'node:path'

import type { Plugin } from 'vite'

import type { InstanceAttributes } from './instance'

const PREFIX = '\0kit-instance:'

/**
 * Serves the kit's modules to the modules that import them, such as its examples, with the
 * components `exports` names wrapped to mark their instances; the page, which loads the modules
 * itself to draw their sets, gets them as they are.
 */
export function kitInstancesPlugin(options: {
  /** The kit's modules, by name, as files. */
  modules: Record<string, string>
  /** The components to wrap, by module name. */
  exports: Record<string, string[]>
  /** The module whose `INSTANCES` export maps each use to its instance. */
  instances: string
  attributes: InstanceAttributes
}): Plugin {
  const byPath = new Map(Object.entries(options.modules).map(([name, path]) => [path, name]))
  return {
    name: 'open-pencil:kit-instances',
    enforce: 'pre',
    async resolveId(id, importer, resolveOptions) {
      if (!importer || importer.startsWith(PREFIX)) return undefined
      const resolved = await this.resolve(id, importer, { ...resolveOptions, skipSelf: true })
      const name = resolved ? byPath.get(resolved.id) : undefined
      return name && options.exports[name]?.length ? `${PREFIX}${name}` : undefined
    },
    load(id) {
      if (!id.startsWith(PREFIX)) return undefined
      const name = id.slice(PREFIX.length)
      const path = JSON.stringify(options.modules[name])
      return [
        `import * as kit from ${path}`,
        `import { INSTANCES } from ${JSON.stringify(options.instances)}`,
        `import { markInstance } from ${JSON.stringify(join(import.meta.dir, 'instance.ts'))}`,
        `export * from ${path}`,
        ...(options.exports[name] ?? []).map(
          (component) =>
            `export const ${component} = markInstance(kit.${component}, INSTANCES[${JSON.stringify(name)}].${component}, ${JSON.stringify(options.attributes)})`
        )
      ].join('\n')
    }
  }
}
