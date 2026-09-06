import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { publicId } from './lib.ts'
import { findProduct, findUser, userApplications, userCredits } from './store.ts'

export type StoryStatus = 'pending' | 'approved' | 'rejected'

export type Story = {
  id: string
  userId: string
  displayName: string
  initials: string
  product: string
  body: string
  stars: number
  status: StoryStatus
  createdAt: string
  reviewedAt: string | null
  reviewedBy: string | null
}

const file = resolve(process.cwd(), 'data', 'stories.json')
const stories = new Map<string, Story>()

function load() {
  if (!existsSync(file)) return
  try {
    const rows = JSON.parse(readFileSync(file, 'utf8')) as Story[]
    if (!Array.isArray(rows)) return
    rows.forEach((row) => stories.set(row.id, row))
  } catch {
    /* archivo corrupto: se reescribe en el próximo save */
  }
}

function save() {
  mkdirSync(resolve(process.cwd(), 'data'), { recursive: true })
  writeFileSync(file, JSON.stringify([...stories.values()], null, 2))
}

load()

function publicName(firstName: string, lastName: string) {
  const first = firstName.trim() || 'Cliente'
  const last = lastName.trim()
  return last ? `${first} ${last[0].toUpperCase()}.` : first
}

function initialsOf(firstName: string, lastName: string) {
  const a = (firstName.trim()[0] || 'C').toUpperCase()
  const b = (lastName.trim()[0] || '').toUpperCase()
  return `${a}${b}`
}

function cleanBody(raw: string) {
  const body = String(raw || '').replace(/\s+/g, ' ').trim()
  if (body.length < 40) throw new Error('Contá tu experiencia en al menos 40 caracteres')
  if (body.length > 280) throw new Error('Máximo 280 caracteres')
  if (/https?:\/\/|www\.|\S+@\S+\.\S+/i.test(body)) throw new Error('La historia no puede incluir links ni correos')
  return body
}

export function publicStories() {
  return [...stories.values()]
    .filter((item) => item.status === 'approved')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ id, displayName, initials, product, body, stars }) => ({ id, displayName, initials, product, body, stars }))
}

export function userStories(userId: string) {
  return [...stories.values()]
    .filter((item) => item.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function adminStories() {
  return [...stories.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((item) => {
      const user = findUser(item.userId)
      return { ...item, email: user?.email || '' }
    })
}

export function submitStory(userId: string, input: { body: string; stars?: number }) {
  const user = findUser(userId)
  if (!user || user.role === 'admin') throw new Error('Solo un cliente con cuenta puede enviar una historia')
  const credit = userCredits(userId)[0]
  const application = userApplications(userId).find((item) => item.status === 'approved')
  if (!credit && !application) throw new Error('La historia se publica solo si ya usaste UNICRÉDITOS (crédito o solicitud aprobada)')
  if (userStories(userId).some((item) => item.status === 'pending')) {
    throw new Error('Ya tenés una historia en revisión. Esperá la aprobación de UNICRÉDITOS')
  }
  const product = findProduct(credit?.productId || application?.productId || '')
  const story: Story = {
    id: publicId('ST'),
    userId,
    displayName: publicName(user.firstName, user.lastName),
    initials: initialsOf(user.firstName, user.lastName),
    product: product?.name || 'Crédito UNICRÉDITOS',
    body: cleanBody(input.body),
    stars: Math.min(5, Math.max(1, Math.round(Number(input.stars) || 5))),
    status: 'pending',
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
  }
  stories.set(story.id, story)
  save()
  return story
}

export function reviewStory(adminId: string, storyId: string, action: 'approve' | 'reject') {
  const story = stories.get(storyId)
  if (!story) throw new Error('Historia no encontrada')
  if (story.status !== 'pending') throw new Error('Esa historia ya fue revisada')
  story.status = action === 'approve' ? 'approved' : 'rejected'
  story.reviewedAt = new Date().toISOString()
  story.reviewedBy = adminId
  save()
  return story
}
