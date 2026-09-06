import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import type { Request } from 'express'
import { DomainError } from '../errors/domain-error'

/**
 * Limitador en memoria por IP+ruta (docs/SECURITY.md §hallazgo #7 de la auditoría del prototipo:
 * login/registro/forgot sin rate limiting). Es un placeholder de un solo proceso — se reemplaza
 * por un limitador respaldado en Redis cuando el servicio corra en más de una instancia.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private static readonly WINDOW_MS = 15 * 60 * 1000
  private static readonly MAX_ATTEMPTS = 10
  private readonly hits = new Map<string, { count: number; resetAt: number }>()

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const key = `${request.ip}:${request.path}`
    const now = Date.now()
    const entry = this.hits.get(key)

    if (!entry || entry.resetAt < now) {
      this.hits.set(key, { count: 1, resetAt: now + RateLimitGuard.WINDOW_MS })
      return true
    }

    if (entry.count >= RateLimitGuard.MAX_ATTEMPTS) {
      throw new DomainError('INVALID_CREDENTIALS', 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.')
    }

    entry.count += 1
    return true
  }
}
