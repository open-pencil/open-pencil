import type { Board, TeamMemberRole } from '@/app/api/client'
import { apiRequest } from '@/app/api/client'

const TEAM_API_ENDPOINTS = {
  teams: '/api/teams',
  team: (teamId: string) => `/api/teams/${teamId}`,
  members: (teamId: string) => `/api/teams/${teamId}/members`,
  member: (teamId: string, userId: string) => `/api/teams/${teamId}/members/${userId}`,
  leave: (teamId: string) => `/api/teams/${teamId}/leave`
} as const

export interface TeamSummary {
  id: string
  name: string
  ownerUserId: string
  createdAt: number
  updatedAt: number
  role: TeamMemberRole
  memberCount: number
  boardCount: number
}

export interface TeamUser {
  id: string
  name: string
  email: string
  image: string | null
}

export interface TeamMember {
  teamId: string
  userId: string
  role: TeamMemberRole
  addedAt: number
  user: TeamUser
}

export interface TeamDetailResponse {
  team: TeamSummary
  members: TeamMember[]
  boards: Board[]
}

export interface CreateTeamInput {
  name: string
}

export interface AddTeamMemberInput {
  email?: string
  userId?: string
  role: Exclude<TeamMemberRole, 'owner'>
}

export function listTeams() {
  return apiRequest<{ teams: TeamSummary[] }>(TEAM_API_ENDPOINTS.teams).then((response) => response.teams)
}

export function createTeam(input: CreateTeamInput) {
  return apiRequest<TeamSummary>(TEAM_API_ENDPOINTS.teams, {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

export function getTeam(teamId: string) {
  return apiRequest<TeamDetailResponse>(TEAM_API_ENDPOINTS.team(teamId))
}

export function updateTeam(teamId: string, input: CreateTeamInput) {
  return apiRequest<TeamSummary>(TEAM_API_ENDPOINTS.team(teamId), {
    method: 'PATCH',
    body: JSON.stringify(input)
  })
}

export function deleteTeam(teamId: string) {
  return apiRequest<{ deleted: boolean; rehomedBoardCount: number }>(TEAM_API_ENDPOINTS.team(teamId), {
    method: 'DELETE'
  })
}

export function addTeamMember(teamId: string, input: AddTeamMemberInput) {
  return apiRequest<{ member: TeamMember }>(TEAM_API_ENDPOINTS.members(teamId), {
    method: 'POST',
    body: JSON.stringify(input)
  }).then((response) => response.member)
}

export function updateTeamMemberRole(
  teamId: string,
  userId: string,
  role: Exclude<TeamMemberRole, 'owner'>
) {
  return apiRequest<{ member: TeamMember }>(TEAM_API_ENDPOINTS.member(teamId, userId), {
    method: 'PATCH',
    body: JSON.stringify({ role })
  }).then((response) => response.member)
}

export function removeTeamMember(teamId: string, userId: string) {
  return apiRequest<{ member: TeamMember }>(TEAM_API_ENDPOINTS.member(teamId, userId), {
    method: 'DELETE'
  }).then((response) => response.member)
}

export function leaveTeam(teamId: string) {
  return apiRequest<{ left: boolean }>(TEAM_API_ENDPOINTS.leave(teamId), {
    method: 'POST'
  })
}
