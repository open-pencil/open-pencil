export function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : ''
}

export function setCookie(name: string, value: string, days = 30): void {
  if (typeof document === 'undefined') return
  const maxAge = value ? days * 24 * 60 * 60 : 0
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`
}
