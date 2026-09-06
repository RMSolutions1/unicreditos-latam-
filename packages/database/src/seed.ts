import argon2 from 'argon2'
import { prisma } from './client.ts'

const CREDIT_PRODUCTS = [
  { id: 'personal', name: 'Préstamo personal', monthlyRate: 7.5, minAmount: 50000, maxAmount: 3000000, minTermMonths: 3, maxTermMonths: 48 },
  { id: 'express', name: 'Crédito de consumo', monthlyRate: 8.2, minAmount: 10000, maxAmount: 1000000, minTermMonths: 3, maxTermMonths: 24 },
  { id: 'linea', name: 'Línea Unicréditos', monthlyRate: 7.5, minAmount: 30000, maxAmount: 1500000, minTermMonths: 3, maxTermMonths: 24 },
  { id: 'cuotas', name: 'Cuotas sin tarjeta', monthlyRate: 8.2, minAmount: 15000, maxAmount: 800000, minTermMonths: 3, maxTermMonths: 24 },
]

async function seedAdmin() {
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

async function seedCreditProducts() {
  for (const product of CREDIT_PRODUCTS) {
    await prisma.creditProduct.upsert({ where: { id: product.id }, update: product, create: product })
  }
  console.log(`[seed] ${CREDIT_PRODUCTS.length} productos de crédito listos.`)
}

async function main() {
  await seedCreditProducts()
  await seedAdmin()
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
