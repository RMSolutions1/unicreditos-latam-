import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import type { Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { JsonLogger } from '../../logging/json-logger.service'
import { DomainError } from '../errors/domain-error'

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
      const message = Array.isArray(body.message) ? body.message.join(', ') : body.message || exception.message
      response.status(status).json({ code: body.code ?? 'VALIDATION_ERROR', message, requestId })
      return
    }

    this.logger.error(exception instanceof Error ? exception.message : 'unknown error', exception instanceof Error ? exception.stack : undefined, 'DomainExceptionFilter')
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.', requestId })
  }
}
