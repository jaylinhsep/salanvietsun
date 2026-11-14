import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  app.enableCors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
    credentials: true,
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
