import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { DomainExceptionFilter } from './common/filters/domain-exception.filter'
import { JsonLogger } from './logging/json-logger.service'

async function bootstrap() {
  const logger = new JsonLogger('payment')
  const app = await NestFactory.create(AppModule, { logger })

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  app.useGlobalFilters(new DomainExceptionFilter(logger))

  const allowedOrigins = (process.env.WEB_ORIGIN ?? '').split(',').map((o) => o.trim()).filter(Boolean)
  app.enableCors({ origin: allowedOrigins.length ? allowedOrigins : false, credentials: true })

  const port = Number(process.env.PORT ?? 3103)
  await app.listen(port)
  logger.log(`payment service listening on :${port}`, 'Bootstrap')
}

bootstrap()
