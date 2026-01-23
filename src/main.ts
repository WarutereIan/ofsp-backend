import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Get config service
  const configService = app.get(ConfigService);
  
  // Enable cookie parsing
  app.use(cookieParser());
  
  // Global prefix
  const apiPrefix = configService.get('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix);
  
  // CORS - Must be configured before other middleware
  const corsOrigins = configService.get('CORS_ORIGIN', 'http://localhost:5173,http://localhost:3000');
  const allowedOrigins = corsOrigins.split(',').map(origin => origin.trim());
  
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // In development, allow all localhost origins
        if (process.env.NODE_ENV !== 'production' && origin?.startsWith('http://localhost:')) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Authorization'],
  });
  
  // Security - Configure helmet to work with CORS
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false, // Allow embedding for development
  }));
  
  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  
  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Jirani OFSP Platform API')
    .setDescription('API documentation for the OFSP Value Chain Platform')
    .setVersion('1.0')
    .addTag('Authentication', 'User authentication and authorization endpoints')
    .addTag('Users', 'User profile management')
    .addTag('Marketplace', 'Marketplace and produce listings')
    .addTag('Transport', 'Transport and logistics management')
    .addTag('Aggregation', 'Aggregation center and storage management')
    .addTag('Payments', 'Payment and escrow management')
    .addTag('Notifications', 'User notifications')
    .addBearerAuth()
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
  
  // Start server
  const port = configService.get('PORT', 3000);
  await app.listen(port);
  
  console.log(`
    🚀 Application is running on: http://localhost:${port}/${apiPrefix}
    📚 API Documentation: http://localhost:${port}/api/docs
    🗄️  Database: ${configService.get('DATABASE_URL')?.split('@')[1] || 'Not configured'}
  `);
}

bootstrap();
