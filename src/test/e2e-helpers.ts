import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../app.module';
import { PrismaService } from '../modules/prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';

/**
 * E2E test helpers for setting up test application and making authenticated requests
 */

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}

export async function setupTestApp(app: INestApplication): Promise<void> {
  // Apply global pipes, filters, interceptors if needed
  // This is a placeholder for any app-level setup
}

export async function createTestUser(
  prisma: PrismaService,
  options?: {
    email?: string;
    phone?: string;
    password?: string;
    role?: UserRole;
    status?: UserStatus;
  },
): Promise<any> {
  const email = options?.email || `test-${Date.now()}@example.com`;
  const phone = options?.phone || `+2547${Math.floor(Math.random() * 100000000)}`;
  const password = options?.password || 'password123';
  const role = options?.role || UserRole.FARMER;
  const status = options?.status || UserStatus.ACTIVE;

  const hashedPassword = await bcrypt.hash(password, 10);

  return prisma.user.create({
    data: {
      email,
      phone,
      password: hashedPassword,
      role,
      status,
      profile: {
        create: {
          firstName: 'Test',
          lastName: 'User',
          county: 'Nairobi',
          ward: 'Dagoretti North',
        },
      },
    },
    include: {
      profile: true,
    },
  });
}

export async function getAuthToken(
  app: INestApplication,
  email: string = 'test@example.com',
  password: string = 'password123',
): Promise<string> {
  const apiPrefix = process.env.API_PREFIX || 'api/v1';
  const response = await request(app.getHttpServer())
    .post(`/${apiPrefix}/auth/login`)
    .send({ email, password });

  if (response.status !== 200) {
    throw new Error(`Failed to get auth token: ${response.body.message || response.status}`);
  }

  return response.body.data.accessToken;
}

export function createAuthenticatedRequest(
  app: INestApplication,
  token: string,
) {
  return request(app.getHttpServer()).set('Authorization', `Bearer ${token}`);
}
