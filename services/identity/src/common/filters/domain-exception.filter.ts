import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import type { Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { JsonLogger } from '../../logging/json-logger.service'
import { DomainError } from '../errors/domain-error'

/**
 * Nunca deja pasar un stack trace al cliente (docs/SECURITY.md §9).
 * Todo error responde { code, message, requestId } para correlacionar con logs.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: JsonLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()
    const requestId = (request.headers['x-request-id'] as string) || randomUUID()

    if (exception instanceof DomainError) {
      response.status(exception.getStatus()).json({ code: exception.code, message: exception.message, requestId })
      return
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse() as { code?: string; message?: string | string[] }
      const message =
        typeof body === 'string' ? body : Array.isArray(body.message) ? body.message.join(', ') : body.message || exception.message
      // Preserva el `code` de errores lanzados fuera de este servicio (ej. AUTH_ERROR de
      // @unicreditos/auth, que usan su propia clase DomainError y no la de este archivo) —
      // antes se perdía y un 401/403 real volvía como "INTERNAL_ERROR" (bug encontrado en
      // auditoría, presente solo acá porque los demás servicios ya seguían este patrón).
      const code = body.code ?? (status === HttpStatus.BAD_REQUEST ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR')
      response.status(status).json({ code, message, requestId })
      return
    }

    this.logger.error(exception instanceof Error ? exception.message : 'unknown error', exception instanceof Error ? exception.stack : undefined, 'DomainExceptionFilter')
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL_ERROR',
      message: 'Ocurrió un error inesperado. Reintentá en unos minutos.',
      requestId,
    })
  }
}
