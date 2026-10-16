import * as v from 'valibot'

/** A portable path anchored at the mapping file's directory. */
function repositoryPath(path: string): boolean {
  return (
    path.length > 0 &&
    !/^[~/$]|[\\:]|\$\{?HOME\}?/.test(path) &&
    Array.from(path).every((character) => character.charCodeAt(0) >= 32) &&
    path.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
  )
}

const Path = v.pipe(v.string(), v.check(repositoryPath, 'Use a repository-relative POSIX path.'))
const Key = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]*$/, 'Use a stable lowercase key.'))
const Guid = v.pipe(v.string(), v.regex(/^\d+:\d+$/, 'Use the saved FIG GUID from source.id.'))
const Revision = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/, 'Expected a lowercase SHA-256 hash.'))
const StoryId = v.pipe(
  v.string(),
  v.regex(/^[a-z0-9][a-z0-9-]*--[a-z0-9-]+$/, 'Expected a Storybook story ID.')
)
const Identifier = v.pipe(
  v.string(),
  v.regex(/^[A-Za-z_$][\w$]*$/, 'Expected a JavaScript identifier.'),
  v.check((name) => name !== '__proto__', 'The __proto__ key is not supported.')
)
const Scalar = v.union([v.string(), v.boolean(), v.pipe(v.number(), v.finite()), v.null()])
const Args = v.record(Identifier, Scalar)
const Property = v.strictObject({
  prop: Identifier,
  values: v.optional(v.record(v.string(), Scalar))
})
const State = v.strictObject({
  key: v.pipe(
    Key,
    v.check((key) => key !== 'default', 'The state key default is reserved.')
  ),
  designId: Guid,
  storyId: StoryId,
  args: v.optional(Args)
})

const Component = v.strictObject({
  key: Key,
  design: v.strictObject({
    file: v.pipe(
      Path,
      v.endsWith('.fig', 'Durable mappings currently require a saved .fig document.')
    ),
    id: Guid,
    revision: v.optional(Revision)
  }),
  implementation: v.strictObject({ import: Path, export: Identifier }),
  story: v.strictObject({ id: StoryId }),
  props: v.optional(v.record(Guid, Property), {}),
  states: v.optional(v.array(State), [])
})

const BaseURL = v.pipe(
  v.string(),
  v.url(),
  v.check((text) => {
    const url = new URL(text)
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    )
  }, 'Use an HTTP(S) Storybook base URL without credentials, query or fragment.')
)

const Config = v.strictObject({
  version: v.literal(1),
  storybook: v.strictObject({ baseUrl: BaseURL }),
  components: v.pipe(v.array(Component), v.minLength(1))
})

export type ComponentMappings = v.InferOutput<typeof Config>
export type ComponentMapping = ComponentMappings['components'][number]
export type ComponentMappingState = ComponentMapping['states'][number]
export type ComponentMappingArgs = v.InferOutput<typeof Args>

/** Parse the shared browser/CLI contract and reject ambiguous associations before use. */
export function parseComponentMappings(text: string): ComponentMappings {
  const result = v.safeParse(v.pipe(v.string(), v.parseJson(), Config), text)
  if (!result.success) throw new Error(`Invalid component mapping: ${v.summarize(result.issues)}`)
  const seen = new Map<string, string>()
  const claim = (kind: string, key: string, owner: string) => {
    const previous = seen.get(`${kind}:${key}`)
    if (previous) throw new Error(`Duplicate ${kind} ${key} in mappings ${previous} and ${owner}.`)
    seen.set(`${kind}:${key}`, owner)
  }
  for (const component of result.output.components) {
    claim('key', component.key, component.key)
    claim('design identity', `${component.design.file}:${component.design.id}`, component.key)
    claim('story ID', component.story.id, component.key)
    const props = new Set<string>()
    for (const property of Object.values(component.props)) {
      if (props.has(property.prop))
        throw new Error(`Mapping ${component.key} maps more than one property to ${property.prop}.`)
      props.add(property.prop)
    }
    for (const state of component.states) {
      claim('state key', `${component.key}:${state.key}`, component.key)
      claim('design identity', `${component.design.file}:${state.designId}`, component.key)
      claim('story ID', state.storyId, component.key)
    }
  }
  return result.output
}

/** Resolve a saved component or explicitly mapped state, never a mutable display name. */
export function findComponentMapping(
  config: ComponentMappings,
  file: string,
  id: string
): ComponentMapping {
  const found = config.components.filter(
    (mapping) =>
      mapping.design.file === file &&
      (mapping.design.id === id || mapping.states.some((state) => state.designId === id))
  )
  if (found.length !== 1)
    throw new Error(
      `Expected one implementation mapping for ${file}, saved FIG ID ${id}; found ${found.length}.`
    )
  return found[0]
}

export function implementationStoryURL(
  config: ComponentMappings,
  mapping: ComponentMapping,
  state?: ComponentMappingState
): string {
  const url = new URL(config.storybook.baseUrl)
  url.searchParams.set('path', `/story/${state?.storyId ?? mapping.story.id}`)
  return url.href
}
