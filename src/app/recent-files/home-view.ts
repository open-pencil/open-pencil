import { useLocalStorage } from '@vueuse/core'

/** The start page's lists, as Figma's Recents tabs: files opened lately, and storage. */
export type HomeSection = 'recent' | 'storage'

/** The file types the start page's All files filter offers. */
export type HomeFileType = 'figma' | 'pencil' | 'other'
export type HomeFileFilter = 'all' | HomeFileType

const HOME_SECTIONS: readonly HomeSection[] = ['recent', 'storage']
const HOME_FILE_FILTERS: readonly HomeFileFilter[] = ['all', 'figma', 'pencil', 'other']

/** A stored value read back only when it is still one of the choices, else the default. */
function storedChoice<T extends string>(choices: readonly T[], fallback: T) {
  const isChoice = (value: string): value is T => choices.some((choice) => choice === value)
  return {
    read: (value: string): T => (isChoice(value) ? value : fallback),
    write: (value: T) => value
  }
}

/** The list the start page shows; Open Storage Workspace… switches it to storage. */
export const homeSection = useLocalStorage<HomeSection>('open-pencil:home-section', 'recent', {
  serializer: storedChoice(HOME_SECTIONS, 'recent')
})
export const homeFileFilter = useLocalStorage<HomeFileFilter>(
  'open-pencil:home-file-filter',
  'all',
  {
    serializer: storedChoice(HOME_FILE_FILTERS, 'all')
  }
)

const FILE_TYPES: Partial<Record<string, HomeFileType>> = { fig: 'figma', pen: 'pencil' }

/** A file's type from its name or path; storage documents are always `.fig` files. */
export function homeFileType(nameOrPath: string): HomeFileType {
  const extension = nameOrPath.split('.').pop()?.toLowerCase() ?? ''
  return FILE_TYPES[extension] ?? 'other'
}

export function matchesHomeFileFilter(type: HomeFileType, filter: HomeFileFilter): boolean {
  return filter === 'all' || type === filter
}
