import argon2 from 'argon2'
import { prisma } from './client.ts'

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!email || !password) {
    console.log('[seed] SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD no definidos — omito la creación del super admin.')
    return
  }
  if (password.length < 12) {
    throw new Error('[seed] SEED_ADMIN_PASSWORD debe tener al menos 12 caracteres.')
  }

  const passwordHash = await argon2.hash(password)
  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      firstName: 'Super',
      lastName: 'Admin',
    },
  })
  console.log(`[seed] SUPER_ADMIN listo: ${admin.email}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
