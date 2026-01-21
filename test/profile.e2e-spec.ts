import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { createTestApp, getAuthToken } from '../src/test/e2e-helpers';

describe('ProfileController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Create test user and get auth token
    const testUser = await prisma.user.create({
      data: {
        email: 'profile-test@example.com',
        phone: '+254712345678',
        password: 'hashed-password', // In real test, hash this
        role: 'FARMER',
        status: 'ACTIVE',
        profile: {
          create: {
            firstName: 'Test',
            lastName: 'User',
            county: 'Nairobi',
            subCounty: 'Westlands',
          },
        },
      },
      include: { profile: true },
    });

    testUserId = testUser.id;
    // Note: In real e2e test, you'd login to get actual token
    // authToken = await getAuthToken(app, testUser.email, 'password');
  });

  afterAll(async () => {
    // Cleanup test data
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } });
    }
    await app.close();
  });

  describe('/profiles (GET)', () => {
    it('should return all profiles', () => {
      return request(app.getHttpServer())
        .get('/api/v1/profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should filter profiles by role', () => {
      return request(app.getHttpServer())
        .get('/api/v1/profiles')
        .query({ role: 'FARMER' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });

  describe('/profiles/:id (GET)', () => {
    it('should return a profile by ID', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/profiles/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.userId).toBe(testUserId);
        });
    });

    it('should return 404 for non-existent profile', () => {
      return request(app.getHttpServer())
        .get('/api/v1/profiles/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('/profiles/:id/ratings (GET)', () => {
    it('should return ratings for a user', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/profiles/${testUserId}/ratings`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('/profiles/:id/ratings/summary (GET)', () => {
    it('should return rating summary', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/profiles/${testUserId}/ratings/summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('userId');
          expect(res.body).toHaveProperty('totalRatings');
          expect(res.body).toHaveProperty('averageRating');
        });
    });
  });
});
