/** Up to two initials for an avatar, or `?` when the name has none. */
export function initials(name: string): string {
  return (
    name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'
  )
}
