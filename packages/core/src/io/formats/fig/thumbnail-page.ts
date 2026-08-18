type ThumbnailPage = {
  id: string
  name: string
}

const COVER_PAGE_NAME = 'cover'

/** Resolve the conventional Figma cover page without falling back to unrelated content. */
export function findFigThumbnailPageId(pages: readonly ThumbnailPage[]): string | undefined {
  const normalizedNames = pages.map((page) => ({
    page,
    name: page.name.trim().toLocaleLowerCase()
  }))
  return (
    normalizedNames.find(({ name }) => name === COVER_PAGE_NAME)?.page.id ??
    normalizedNames.find(({ name }) => name.includes(COVER_PAGE_NAME))?.page.id
  )
}
