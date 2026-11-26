import { APP_VERSION } from '@/app/runtime/version'

/** Where updates come from: stable releases, or a build of master every night. */
export const UPDATE_CHANNELS = ['stable', 'nightly'] as const
export type UpdateChannel = (typeof UPDATE_CHANNELS)[number]

/**
 * The channel preference: one of the channels, or `build`, the channel of the installed build.
 * Preferences are saved whole, so a stored channel would follow someone from a stable install to
 * a nightly they downloaded and move it back; only a channel they chose does.
 */
export const UPDATE_CHANNEL_PREFERENCES = ['build', ...UPDATE_CHANNELS] as const
export type UpdateChannelPreference = (typeof UPDATE_CHANNEL_PREFERENCES)[number]

/** The channel a build belongs to: nightlies are versioned `X.Y.Z-nightly.YYYYMMDD`. */
export function buildUpdateChannel(version: string = APP_VERSION): UpdateChannel {
  return /^\d+\.\d+\.\d+-nightly(\.|$)/.test(version) ? 'nightly' : 'stable'
}

export function resolveUpdateChannel(
  preference: UpdateChannelPreference,
  version: string = APP_VERSION
): UpdateChannel {
  return preference === 'build' ? buildUpdateChannel(version) : preference
}
