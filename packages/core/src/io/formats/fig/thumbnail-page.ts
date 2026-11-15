type ThumbnailPage = {
  id: string
  name: string
}

const COVER_PAGE_NAME = 'cover'

/**
 * The page a `.fig` thumbnail shows: the conventional Cover page, or the first page when there is
 * none, as Figma's own thumbnail does.
 */
export function figThumbnailPageId(pages: readonly ThumbnailPage[]): string | undefined {
  const normalizedNames = pages.map((page) => ({
    page,
    name: page.name.trim().toLocaleLowerCase()
  }))
  return (
    normalizedNames.find(({ name }) => name === COVER_PAGE_NAME)?.page.id ??
    normalizedNames.find(({ name }) => name.includes(COVER_PAGE_NAME))?.page.id ??
    pages.at(0)?.id
  )
}
