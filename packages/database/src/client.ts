import { PrismaClient } from '@prisma/client'

declare global {
  var __unicreditosPrisma: PrismaClient | undefined
}

export const prisma = global.__unicreditosPrisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  global.__unicreditosPrisma = prisma
}

export * from '@prisma/client'
