import { Hono } from 'hono'
import { z } from 'zod'

import { getAuthSession, type InklyAuth } from '../auth/index.js'
import type { BoardStore, NotificationStore, TeamMembershipRecord, TeamStore } from '../types.js'

const createTeamSchema = z.object({
  name: z.string().trim().min(1).max(120)
})

const updateTeamSchema = createTeamSchema

const addMemberSchema = z
  .object({
    email: z.string().trim().email().optional(),
    userId: z.string().trim().min(1).optional(),
    role: z.enum(['editor', 'viewer']).default('editor')
  })
  .refine((value) => !!value.email || !!value.userId, {
    message: 'Provide email or userId'
  })

const updateMemberSchema = z.object({
  role: z.enum(['editor', 'viewer'])
})

export interface TeamRoutesOptions {
  auth: InklyAuth
  boardStore: BoardStore
  teamStore: TeamStore
  notificationStore?: NotificationStore
}

function errorResponse(
  status: number,
  code: string,
  message: string
) {
  return Response.json(
    {
      error: {
        code,
        message
      }
    },
    { status }
  )
}

async function requireSession(options: TeamRoutesOptions, request: Request) {
  return getAuthSession(options.auth, request)
}

async function mapTeamForList(
  teamStore: TeamStore,
  boardStore: BoardStore,
  membership: TeamMembershipRecord
) {
  return {
    ...membership.team,
    role: membership.role,
    memberCount: (await teamStore.listMembers(membership.team.id)).length,
    boardCount: (await boardStore.listBoardsForTeam(membership.team.id)).length
  }
}

export function createTeamRoutes(options: TeamRoutesOptions): Hono {
  const app = new Hono()

  app.get('/teams', async (c) => {
    const session = await requireSession(options, c.req.raw)
    if (!session) return errorResponse(401, 'unauthorized', 'Login required')

    const memberships = await options.teamStore.listTeamsForUser(session.user.id)
    const teams = await Promise.all(
      memberships.map((membership) => mapTeamForList(options.teamStore, options.boardStore, membership))
    )

    return c.json({ teams })
  })

  app.post('/teams', async (c) => {
    const session = await requireSession(options, c.req.raw)
    if (!session) return errorResponse(401, 'unauthorized', 'Login required')

    const body = await c.req.json().catch(() => ({}))
    const parsed = createTeamSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? 'Invalid request body'
      return errorResponse(400, 'invalid_request_body', issue)
    }

    const team = await options.teamStore.createTeam({
      name: parsed.data.name,
      ownerUserId: session.user.id
    })

    return c.json(
      {
        ...team,
        role: 'owner',
        memberCount: 1,
        boardCount: 0
      },
      201
    )
  })

  app.get('/teams/:id', async (c) => {
    const session = await requireSession(options, c.req.raw)
    if (!session) return errorResponse(401, 'unauthorized', 'Login required')

    const team = await options.teamStore.findTeam(c.req.param('id'))
    if (!team) return errorResponse(404, 'team_not_found', 'Team not found')

    const membership = await options.teamStore.findMembership(team.id, session.user.id)
    if (!membership) return errorResponse(403, 'forbidden', 'Only team members can view this team')

    const members = await options.teamStore.listMembers(team.id)
    const boards = (await options.boardStore.listBoardsForTeam(team.id)).map((board) => ({
      ...board,
      team: { id: team.id, name: team.name }
    }))

    return c.json({
      team: {
        ...team,
        role: membership.role,
        memberCount: members.length,
        boardCount: boards.length
      },
      members,
      boards
    })
  })

  app.patch('/teams/:id', async (c) => {
    const session = await requireSession(options, c.req.raw)
    if (!session) return errorResponse(401, 'unauthorized', 'Login required')

    const team = await options.teamStore.findTeam(c.req.param('id'))
    if (!team) return errorResponse(404, 'team_not_found', 'Team not found')
    if (team.ownerUserId !== session.user.id) {
      return errorResponse(403, 'forbidden', 'Only the owner can update this team')
    }

    const body = await c.req.json().catch(() => ({}))
    const parsed = updateTeamSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? 'Invalid request body'
      return errorResponse(400, 'invalid_request_body', issue)
    }

    const updated = await options.teamStore.updateTeam(team.id, { name: parsed.data.name })
    if (!updated) return errorResponse(404, 'team_not_found', 'Team not found')

    return c.json({
      ...updated,
      role: 'owner',
      memberCount: (await options.teamStore.listMembers(updated.id)).length,
      boardCount: (await options.boardStore.listBoardsForTeam(updated.id)).length
    })
  })

  app.post('/teams/:id/members', async (c) => {
    const session = await requireSession(options, c.req.raw)
    if (!session) return errorResponse(401, 'unauthorized', 'Login required')

    const team = await options.teamStore.findTeam(c.req.param('id'))
    if (!team) return errorResponse(404, 'team_not_found', 'Team not found')
    if (team.ownerUserId !== session.user.id) {
      return errorResponse(403, 'forbidden', 'Only the owner can invite members')
    }

    const body = await c.req.json().catch(() => ({}))
    const parsed = addMemberSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? 'Invalid request body'
      return errorResponse(400, 'invalid_request_body', issue)
    }

    const targetUser =
      (parsed.data.userId ? await options.teamStore.findUserById(parsed.data.userId) : null) ??
      (parsed.data.email ? await options.teamStore.findUserByEmail(parsed.data.email) : null)
    if (!targetUser) return errorResponse(404, 'user_not_found', 'User not found')
    if (targetUser.id === team.ownerUserId) {
      return errorResponse(400, 'invalid_member', 'Owner membership cannot be modified')
    }

    const currentMembers = await options.teamStore.listMembers(team.id)
    const existingMembership = currentMembers.find((member) => member.userId === targetUser.id) ?? null
    if (!existingMembership && currentMembers.length >= 100) {
      return errorResponse(400, 'team_member_limit_reached', 'Team member limit reached')
    }

    const member = await options.teamStore.addMember({
      teamId: team.id,
      userId: targetUser.id,
      role: parsed.data.role
    })
    if (!member) return errorResponse(404, 'user_not_found', 'User not found')

    if (!existingMembership && options.notificationStore) {
      await options.notificationStore.createNotification({
        userId: targetUser.id,
        type: 'team_invite',
        payload: {
          teamId: team.id,
          teamName: team.name,
          role: parsed.data.role,
          inviterDisplayName: session.user.name.trim() || session.user.email,
          inviteeEmail: targetUser.email,
          url: `/team/${team.id}`
        }
      })
    }

    return c.json({ member }, existingMembership ? 200 : 201)
  })

  app.patch('/teams/:id/members/:userId', async (c) => {
    const session = await requireSession(options, c.req.raw)
    if (!session) return errorResponse(401, 'unauthorized', 'Login required')

    const team = await options.teamStore.findTeam(c.req.param('id'))
    if (!team) return errorResponse(404, 'team_not_found', 'Team not found')
    if (team.ownerUserId !== session.user.id) {
      return errorResponse(403, 'forbidden', 'Only the owner can update member roles')
    }

    const userId = c.req.param('userId')
    if (userId === team.ownerUserId) {
      return errorResponse(400, 'invalid_member', 'Owner role cannot be changed')
    }

    const body = await c.req.json().catch(() => ({}))
    const parsed = updateMemberSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? 'Invalid request body'
      return errorResponse(400, 'invalid_request_body', issue)
    }

    const member = await options.teamStore.updateMemberRole(team.id, userId, parsed.data.role)
    if (!member) return errorResponse(404, 'team_member_not_found', 'Team member not found')
    return c.json({ member })
  })

  app.delete('/teams/:id/members/:userId', async (c) => {
    const session = await requireSession(options, c.req.raw)
    if (!session) return errorResponse(401, 'unauthorized', 'Login required')

    const team = await options.teamStore.findTeam(c.req.param('id'))
    if (!team) return errorResponse(404, 'team_not_found', 'Team not found')
    if (team.ownerUserId !== session.user.id) {
      return errorResponse(403, 'forbidden', 'Only the owner can remove members')
    }

    const userId = c.req.param('userId')
    if (userId === team.ownerUserId) {
      return errorResponse(400, 'invalid_member', 'Owner cannot be removed')
    }

    const member = await options.teamStore.removeMember(team.id, userId)
    if (!member) return errorResponse(404, 'team_member_not_found', 'Team member not found')
    return c.json({ member })
  })

  app.post('/teams/:id/leave', async (c) => {
    const session = await requireSession(options, c.req.raw)
    if (!session) return errorResponse(401, 'unauthorized', 'Login required')

    const team = await options.teamStore.findTeam(c.req.param('id'))
    if (!team) return errorResponse(404, 'team_not_found', 'Team not found')
    if (team.ownerUserId === session.user.id) {
      return errorResponse(400, 'invalid_member', 'Owner cannot leave the team')
    }

    const member = await options.teamStore.removeMember(team.id, session.user.id)
    if (!member) return errorResponse(404, 'team_member_not_found', 'Team member not found')
    return c.json({ left: true })
  })

  app.delete('/teams/:id', async (c) => {
    const session = await requireSession(options, c.req.raw)
    if (!session) return errorResponse(401, 'unauthorized', 'Login required')

    const team = await options.teamStore.findTeam(c.req.param('id'))
    if (!team) return errorResponse(404, 'team_not_found', 'Team not found')
    if (team.ownerUserId !== session.user.id) {
      return errorResponse(403, 'forbidden', 'Only the owner can delete this team')
    }

    const rehomedBoardCount = await options.boardStore.clearTeamForBoards(team.id)
    await options.teamStore.deleteTeam(team.id)
    return c.json({ deleted: true, rehomedBoardCount })
  })

  return app
}
