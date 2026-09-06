import { ConsoleLogger, Injectable, Scope } from '@nestjs/common'

/**
 * Logger estructurado en JSON (docs/SECURITY.md §9 / ARCHITECTURE.md — logs JSON, sin stack traces al cliente).
 * Nunca recibe passwords/tokens/API keys como argumento: los callers deben redactarlos antes.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class JsonLogger extends ConsoleLogger {
  private write(level: string, message: unknown, context?: string, extra?: Record<string, unknown>) {
    const entry = {
      level,
      time: new Date().toISOString(),
      service: 'identity',
      context: context ?? this.context,
      message,
      ...extra,
    }
    process.stdout.write(`${JSON.stringify(entry)}\n`)
  }

  log(message: unknown, context?: string) {
    this.write('info', message, context)
  }

  error(message: unknown, trace?: string, context?: string) {
    this.write('error', message, context, trace ? { trace } : undefined)
  }

  warn(message: unknown, context?: string) {
    this.write('warn', message, context)
  }

  debug(message: unknown, context?: string) {
    this.write('debug', message, context)
  }
}
