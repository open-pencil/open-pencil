import { fill } from '../content/messages/fill'
import type { LandingMessages } from '../content/messages/types'
import type { Arch, FileFormat, Platform, Release } from './releases'

type DownloadMessages = LandingMessages['download']

/** Platform names are product names, the same in every language. */
export const PLATFORM_NAMES: Record<Platform, string> = {
  mac: 'macOS',
  windows: 'Windows',
  linux: 'Linux'
}

/** Apple calls its processors Apple Silicon and Intel; elsewhere the architecture is named. */
export function archLabel(messages: DownloadMessages, platform: Platform, arch: Arch): string {
  if (platform === 'mac') return arch === 'arm64' ? messages.arch.appleSilicon : messages.arch.intel
  return arch === 'arm64' ? messages.arch.arm : messages.arch.x64
}

/** The extension as people write it, AppImage in its own capitals. */
export function extension(format: FileFormat): string {
  return format === 'appimage' ? '.AppImage' : `.${format}`
}

/** A file size in megabytes, with the unit as the visitor's language writes it. */
export function formatSize(bytes: number, lang: string): string {
  const megabytes = bytes / 1_000_000
  return new Intl.NumberFormat(lang, {
    style: 'unit',
    unit: 'megabyte',
    maximumFractionDigits: megabytes < 10 ? 1 : 0
  }).format(megabytes)
}

export function formatDate(iso: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(iso))
}

export function versionLine(messages: DownloadMessages, release: Release, lang: string): string {
  return fill(messages.version, { version: release.version, date: formatDate(release.date, lang) })
}
