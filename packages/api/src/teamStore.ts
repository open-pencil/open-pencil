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

function createInMemoryDatabase() {
  return createMigratedApiDatabase({ mode: 'memory' })
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

export function createTeamStore(options: CreateTeamStoreOptions = {}): TeamStore {
  const database = options.database ?? createInMemoryDatabase()
  const now = options.now ?? Date.now

  return {
    createTeam(input) {
      const id = crypto.randomUUID()
      const createdAt = now()
      const name = input.name.trim()

      database.db.transaction((tx) => {
        tx
          .insert(teams)
          .values({
            id,
            name,
            ownerUserId: input.ownerUserId,
            createdAt,
            updatedAt: createdAt
          })
          .run()

        tx
          .insert(teamMembers)
          .values({
            teamId: id,
            userId: input.ownerUserId,
            role: 'owner',
            addedAt: createdAt
          })
          .run()
      })

      const team = this.findTeam(id)
      if (!team) throw new Error(`Failed to create team ${id}`)
      return team
    },
    findTeam(id) {
      const row = database.db.select().from(teams).where(eq(teams.id, id)).get()
      return row ? cloneTeam(mapTeam(row)) : null
    },
    listTeamsForUser(userId) {
      const rows = database.db
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
    listMembers(teamId) {
      const rows = database.db
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
    findMembership(teamId, userId) {
      return this.listMembers(teamId).find((member) => member.userId === userId) ?? null
    },
    findUserById(userId) {
      const row = database.db.select().from(users).where(eq(users.id, userId)).get()
      return row ? structuredClone(mapUser(row)) : null
    },
    findUserByEmail(email) {
      const normalizedEmail = email.trim().toLowerCase()
      if (!normalizedEmail) return null
      const row = database.db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .get()
      return row ? structuredClone(mapUser(row)) : null
    },
    addMember(input: AddTeamMemberInput) {
      const team = this.findTeam(input.teamId)
      const user = this.findUserById(input.userId)
      if (!team || !user) return null

      const addedAt = now()
      database.db.transaction((tx) => {
        tx
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

        tx
          .update(teams)
          .set({ updatedAt: addedAt })
          .where(eq(teams.id, input.teamId))
          .run()
      })

      return this.findMembership(input.teamId, input.userId)
    },
    updateMemberRole(teamId, userId, role) {
      const membership = this.findMembership(teamId, userId)
      if (!membership) return null

      database.db.transaction((tx) => {
        tx
          .update(teamMembers)
          .set({ role })
          .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
          .run()

        tx
          .update(teams)
          .set({ updatedAt: now() })
          .where(eq(teams.id, teamId))
          .run()
      })

      const updated = this.findMembership(teamId, userId)
      return updated ? cloneMember(updated) : null
    },
    removeMember(teamId, userId) {
      const membership = this.findMembership(teamId, userId)
      if (!membership) return null

      database.db.transaction((tx) => {
        tx
          .delete(teamMembers)
          .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
          .run()
        tx.update(teams).set({ updatedAt: now() }).where(eq(teams.id, teamId)).run()
      })

      return cloneMember(membership)
    },
    updateTeam(id, input: UpdateTeamInput) {
      const team = this.findTeam(id)
      if (!team) return null
      const name = input.name.trim()

      database.db
        .update(teams)
        .set({
          name,
          updatedAt: now()
        })
        .where(eq(teams.id, id))
        .run()

      const updated = this.findTeam(id)
      return updated ? cloneTeam(updated) : null
    },
    deleteTeam(id) {
      const team = this.findTeam(id)
      if (!team) return null
      database.db.delete(teams).where(eq(teams.id, id)).run()
      return cloneTeam(team)
    }
  }
}
