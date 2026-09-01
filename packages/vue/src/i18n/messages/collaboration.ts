import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const collaborationMessageDefaults = {
  inThisRoom: 'In this room',
  followingPeerStop: params('Following {name} (click to stop)'),
  clickToFollowPeer: params('Click to follow {name}'),
  yourName: 'Your name',
  enterYourName: 'Enter your name',
  shareThisFile: 'Share this file',
  joinRoom: 'Join room',
  join: 'Join',
  roomLink: 'Room link',
  joinCollaboration: 'Join collaboration',
  orJoinRoom: 'or join a room',
  pasteRoomLinkOrId: 'Paste room link or ID',
  connected: 'Connected',
  disconnect: 'Disconnect',
  share: 'Share'
} as const

export const collaborationMessages = i18n('collaboration', collaborationMessageDefaults)
