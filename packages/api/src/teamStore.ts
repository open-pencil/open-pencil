import { and, asc, eq } from 'drizzle-orm'

import type { ApiDatabase } from './db/client.js'
import { createMigratedApiDatabase } from './db/migrate.js'
import { teamMembers, teams, users } from './db/schema.js'
import type {
  AddTeamMemberInput,
  TeamMemberRecord,
  TeamMembershipRecord,
  TeamRecord,
  TeamStore,
  TeamUserRecord,
  UpdateTeamInput
} from './types.js'

export interface CreateTeamStoreOptions {
  database?: ApiDatabase
  now?: () => number
}

async function createInMemoryDatabase() {
  return await createMigratedApiDatabase({ mode: 'memory' })
}

function cloneTeam(record: TeamRecord): TeamRecord {
  return structuredClone(record)
}

function cloneMembership(record: TeamMembershipRecord): TeamMembershipRecord {
  return structuredClone(record)
}

function cloneMember(record: TeamMemberRecord): TeamMemberRecord {
  return structuredClone(record)
}

function mapTeam(row: typeof teams.$inferSelect): TeamRecord {
  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.ownerUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

function mapUser(row: typeof users.$inferSelect): TeamUserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image ?? null
  }
}

export async function createTeamStore(
  options: CreateTeamStoreOptions = {}
): Promise<TeamStore> {
  const database = options.database ?? (await createInMemoryDatabase())
  const now = options.now ?? Date.now

  const store: TeamStore = {
    async createTeam(input) {
      const id = crypto.randomUUID()
      const createdAt = now()
      const name = input.name.trim()

      await database.db.transaction(async (tx) => {
        await tx
          .insert(teams)
          .values({
            id,
            name,
            ownerUserId: input.ownerUserId,
            createdAt,
            updatedAt: createdAt
          })
          .run()

        await tx
          .insert(teamMembers)
          .values({
            teamId: id,
            userId: input.ownerUserId,
            role: 'owner',
            addedAt: createdAt
          })
          .run()
      })

      const team = await store.findTeam(id)
      if (!team) throw new Error(`Failed to create team ${id}`)
      return team
    },
    async findTeam(id) {
      const row = await database.db.select().from(teams).where(eq(teams.id, id)).get()
      return row ? cloneTeam(mapTeam(row)) : null
    },
    async listTeamsForUser(userId) {
      const rows = await database.db
        .select({
          id: teams.id,
          name: teams.name,
          ownerUserId: teams.ownerUserId,
          createdAt: teams.createdAt,
          updatedAt: teams.updatedAt,
          role: teamMembers.role
        })
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .where(eq(teamMembers.userId, userId))
        .orderBy(asc(teams.name))
        .all()

      return rows.map((row) =>
        cloneMembership({
          team: {
            id: row.id,
            name: row.name,
            ownerUserId: row.ownerUserId,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
          },
          role: row.role
        })
      )
    },
    async listMembers(teamId) {
      const rows = await database.db
        .select({
          teamId: teamMembers.teamId,
          userId: teamMembers.userId,
          role: teamMembers.role,
          addedAt: teamMembers.addedAt,
          userIdValue: users.id,
          userName: users.name,
          userEmail: users.email,
          userImage: users.image
        })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.userId, users.id))
        .where(eq(teamMembers.teamId, teamId))
        .orderBy(asc(teamMembers.addedAt))
        .all()

      return rows.map((row) =>
        cloneMember({
          teamId: row.teamId,
          userId: row.userId,
          role: row.role,
          addedAt: row.addedAt,
          user: {
            id: row.userIdValue,
            name: row.userName,
            email: row.userEmail,
            image: row.userImage ?? null
          }
        })
      )
    },
    async findMembership(teamId, userId) {
      return (await store.listMembers(teamId)).find((member) => member.userId === userId) ?? null
    },
    async findUserById(userId) {
      const row = await database.db.select().from(users).where(eq(users.id, userId)).get()
      return row ? structuredClone(mapUser(row)) : null
    },
    async findUserByEmail(email) {
      const normalizedEmail = email.trim().toLowerCase()
      if (!normalizedEmail) return null
      const row = await database.db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .get()
      return row ? structuredClone(mapUser(row)) : null
    },
    async addMember(input: AddTeamMemberInput) {
      const team = await store.findTeam(input.teamId)
      const user = await store.findUserById(input.userId)
      if (!team || !user) return null

      const addedAt = now()
      await database.db.transaction(async (tx) => {
        await tx
          .insert(teamMembers)
          .values({
            teamId: input.teamId,
            userId: input.userId,
            role: input.role,
            addedAt
          })
          .onConflictDoUpdate({
            target: [teamMembers.teamId, teamMembers.userId],
            set: { role: input.role }
          })
          .run()

        await tx
          .update(teams)
          .set({ updatedAt: addedAt })
          .where(eq(teams.id, input.teamId))
          .run()
      })

      return await store.findMembership(input.teamId, input.userId)
    },
    async updateMemberRole(teamId, userId, role) {
      const membership = await store.findMembership(teamId, userId)
      if (!membership) return null

      await database.db.transaction(async (tx) => {
        await tx
          .update(teamMembers)
          .set({ role })
          .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
          .run()

        await tx
          .update(teams)
          .set({ updatedAt: now() })
          .where(eq(teams.id, teamId))
          .run()
      })

      const updated = await store.findMembership(teamId, userId)
      return updated ? cloneMember(updated) : null
    },
    async removeMember(teamId, userId) {
      const membership = await store.findMembership(teamId, userId)
      if (!membership) return null

      await database.db.transaction(async (tx) => {
        await tx
          .delete(teamMembers)
          .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
          .run()
        await tx.update(teams).set({ updatedAt: now() }).where(eq(teams.id, teamId)).run()
      })

      return cloneMember(membership)
    },
    async updateTeam(id, input: UpdateTeamInput) {
      const team = await store.findTeam(id)
      if (!team) return null
      const name = input.name.trim()

      await database.db
        .update(teams)
        .set({
          name,
          updatedAt: now()
        })
        .where(eq(teams.id, id))
        .run()

      const updated = await store.findTeam(id)
      return updated ? cloneTeam(updated) : null
    },
    async deleteTeam(id) {
      const team = await store.findTeam(id)
      if (!team) return null
      await database.db.delete(teams).where(eq(teams.id, id)).run()
      return cloneTeam(team)
    }
  }

  return store
}
