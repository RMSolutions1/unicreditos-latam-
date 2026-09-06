import type { Request } from 'express'
import type { Role } from '@unicreditos/database'

export type AuthenticatedUser = {
  id: string
  email: string
  role: Role
}

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser }
