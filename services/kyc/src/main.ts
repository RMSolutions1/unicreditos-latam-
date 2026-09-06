import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import * as express from 'express'
import { AppModule } from './app.module'
import { DomainExceptionFilter } from './common/filters/domain-exception.filter'
import { JsonLogger } from './logging/json-logger.service'

async function bootstrap() {
  const logger = new JsonLogger('kyc')
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger, bodyParser: false })

  // Captura el body crudo para poder verificar la firma HMAC del webhook de Didit.
  app.use(
    express.json({
      verify: (request, _response, buffer) => {
        ;(request as express.Request & { rawBody?: string }).rawBody = buffer.toString('utf8')
      },
    }),
  )

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  app.useGlobalFilters(new DomainExceptionFilter(logger))

  const allowedOrigins = (process.env.WEB_ORIGIN ?? '').split(',').map((o) => o.trim()).filter(Boolean)
  app.enableCors({ origin: allowedOrigins.length ? allowedOrigins : false, credentials: true })

  const port = Number(process.env.PORT ?? 3101)
  await app.listen(port)
  logger.log(`kyc service listening on :${port}`, 'Bootstrap')
}

bootstrap()
