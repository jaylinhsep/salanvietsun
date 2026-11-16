import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  app.enableCors({
    origin: (origin, callback) => {
      const envOrigins = (process.env.CORS_ORIGIN || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (
        !origin ||
        envOrigins.includes('*') ||
        envOrigins.includes(origin) ||
        origin.endsWith('.pages.dev') ||
        origin.endsWith('.vietsun.site') ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const config = new DocumentBuilder()
    .setTitle('VietSun Barge TMS API')
    .setDescription('Hệ thống Quản lý Vận tải Sà lan (NestJS + PostgreSQL + PostGIS)')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`VietSun TMS API running on http://localhost:${port}/api`);
  console.log(`Swagger Docs available at http://localhost:${port}/api/docs`);
}
bootstrap();
