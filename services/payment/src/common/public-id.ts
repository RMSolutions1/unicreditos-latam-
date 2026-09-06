import { randomBytes } from 'node:crypto'

export function publicId(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${randomBytes(3).toString('hex').toUpperCase()}`
}
