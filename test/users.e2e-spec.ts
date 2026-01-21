import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRole, UserStatus } from '@prisma/client';
import { createTestUser, getAuthToken } from '../src/test/e2e-helpers';

// Set up environment variables for tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret';
process.env.JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || '30d';
process.env.JWT_EXPIRATION = process.env.JWT_EXPIRATION || '7d';
process.env.API_PREFIX = process.env.API_PREFIX || 'api/v1';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const apiPrefix = process.env.API_PREFIX || 'api/v1';
  let testUser: any;
  let authToken: string;
  let adminUser: any;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Apply global validation pipe
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
    
    // Set global prefix
    app.setGlobalPrefix(apiPrefix);
    
    await app.init();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Create test user
    testUser = await createTestUser(prisma, {
      email: 'user-test@example.com',
      role: UserRole.FARMER,
      status: UserStatus.ACTIVE,
    });
    authToken = await getAuthToken(app, testUser.email, 'password123');

    // Create admin user
    const adminPassword = await bcrypt.hash('password123', 10);
    adminUser = await prisma.user.create({
      data: {
        email: 'admin-test@example.com',
        phone: '+254799999999',
        password: adminPassword,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        profile: {
          create: {
            firstName: 'Admin',
            lastName: 'User',
            county: 'Nairobi',
          },
        },
      },
    });
    adminToken = await getAuthToken(app, adminUser.email, 'password123');
  });

  afterAll(async () => {
    // Cleanup
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } });
    }
    if (adminUser) {
      await prisma.user.delete({ where: { id: adminUser.id } });
    }
    await app.close();
  });

  describe('GET /users/me', () => {
    it('should return user details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/${apiPrefix}/users/me`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(testUser.id);
      expect(response.body.data.email).toBe(testUser.email);
      expect(response.body.data.password).toBeUndefined();
      expect(response.body.data.profile).toBeDefined();
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get(`/${apiPrefix}/users/me`)
        .expect(401);
    });
  });

  describe('PATCH /users/me', () => {
    it('should update user profile', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        county: 'Mombasa',
      };

      const response = await request(app.getHttpServer())
        .patch(`/${apiPrefix}/users/me`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.firstName).toBe(updateData.firstName);
      expect(response.body.data.lastName).toBe(updateData.lastName);
      expect(response.body.data.county).toBe(updateData.county);

      // Verify in database
      const updatedProfile = await prisma.profile.findUnique({
        where: { userId: testUser.id },
      });
      expect(updatedProfile?.firstName).toBe(updateData.firstName);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .patch(`/${apiPrefix}/users/me`)
        .send({ firstName: 'Test' })
        .expect(401);
    });
  });

  describe('GET /users/:id', () => {
    it('should return user by ID for admin', async () => {
      const response = await request(app.getHttpServer())
        .get(`/${apiPrefix}/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(testUser.id);
      expect(response.body.data.email).toBe(testUser.email);
      expect(response.body.data.password).toBeUndefined();
    });

    it('should return 404 for non-existent user', async () => {
      await request(app.getHttpServer())
        .get(`/${apiPrefix}/users/non-existent-id`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should require admin role', async () => {
      await request(app.getHttpServer())
        .get(`/${apiPrefix}/users/${testUser.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get(`/${apiPrefix}/users/${testUser.id}`)
        .expect(401);
    });
  });
});
