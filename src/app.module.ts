import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProfileModule } from './modules/profile/profile.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { InputModule } from './modules/input/input.module';
import { TransportModule } from './modules/transport/transport.module';
import { AggregationModule } from './modules/aggregation/aggregation.module';
import { PaymentModule } from './modules/payment/payment.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { BadgeModule } from './modules/badge/badge.module';
import { UssdModule } from './modules/ussd/ussd.module';
import { StaffModule } from './modules/staff/staff.module';
import { FarmerGroupsModule } from './modules/farmer-groups/farmer-groups.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000, // 60 seconds
      limit: 100, // 100 requests per TTL
    }]),
    
    // Scheduling (for analytics view refresh)
    ScheduleModule.forRoot(),
    
    // Event emitter (for event-triggered cache invalidation)
    EventEmitterModule.forRoot(),
    
    // Core modules
    PrismaModule,
    AuthModule,
    UsersModule,
    
    // Domain modules
    ProfileModule,
    MarketplaceModule,
    InputModule,
    TransportModule,
    AggregationModule,
    PaymentModule,
    NotificationModule,
    AnalyticsModule,
    BadgeModule,
    UssdModule,
    StaffModule,
    FarmerGroupsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global guards
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global filters (last registered runs first; catch-all must run last)
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_FILTER,
      useClass: PrismaExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    // Global interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
