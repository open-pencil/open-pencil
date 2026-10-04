import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const collaborationMessageDefaults = {
  inThisRoom: 'In this room',
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
  share: 'Share',
  follow: params('Follow {name}'),
  stopFollowing: params('Stop following {name}'),
  followingPerson: params('Following {name}'),
  followingAgent: params('Following {agent} ({owner})'),
  stopFollowingShort: 'Stop following',
  leaveRoom: 'Leave room',
  morePeople: params('{count} more'),
  renameAgent: params('Rename {name}'),
  agentName: 'Agent name',
  agentThinking: 'Thinking',
  agentEditing: 'Editing',
  agentIdle: 'Idle'
} as const

export const collaborationMessages = i18n('collaboration', collaborationMessageDefaults)
