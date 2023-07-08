import './utils/dd-tracer';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AllExceptionsFilter } from './shared/filters';
import logger from './utils/logger';
import { MikroORM } from '@mikro-orm/core';
import { RequestContext } from '@mikro-orm/core';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(),
    new FastifyAdapter(),
  );
  const orm = app.get(MikroORM);
  const httpAdapterHost = app.get(HttpAdapterHost);

  app.use((req, res, next) => {
    RequestContext.create(orm.em, next);
  });
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });

  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('FEED_REQUESTS_API_PORT');

  await app.listen(port, '0.0.0.0');

  setInterval(() => {
    tryDbConnection(orm).catch(() => process.exit(1));
  }, 60000);

  logger.info(`Application is running on port ${port}`);
}

async function tryDbConnection(orm: MikroORM, currentTries = 0) {
  if (currentTries >= 10) {
    logger.error('Failed to connect to database after 10 tries. Exiting...');

    process.exit(1);
  }

  await orm.em
    .getDriver()
    .getConnection()
    .execute('SELECT 1')
    .catch((err) => {
      logger.error('Failed to ping database', {
        error: (err as Error).stack,
      });

      return tryDbConnection(orm, currentTries + 1);
    });
}

bootstrap();
