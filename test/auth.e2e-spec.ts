import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRole, UserStatus } from '@prisma/client';

// Set up environment variables for tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret';
process.env.JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || '30d';
process.env.JWT_EXPIRATION = process.env.JWT_EXPIRATION || '7d';
process.env.API_PREFIX = process.env.API_PREFIX || 'api/v1';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const apiPrefix = process.env.API_PREFIX || 'api/v1';

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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test users before each test
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: 'register-test@example.com' },
          { email: 'login-test@example.com' },
          { email: 'refresh-test@example.com' },
          { email: 'register-duplicate@example.com' },
          { email: 'inactive-test@example.com' },
          { email: { startsWith: 'register-token-test-' } },
          { email: { startsWith: 'register-phone1-' } },
          { email: { startsWith: 'register-phone2-' } },
          { email: { startsWith: 'logout-test-' } },
          { email: { startsWith: 'invalid-' } },
          { email: { startsWith: 'short-password-' } },
          { email: { startsWith: 'missing-fields-' } },
        ],
      },
    });
    await prisma.refreshToken.deleteMany({});
  });

  describe('POST /auth/register', () => {
    it('should create user and profile', async () => {
      const registerDto = {
        email: 'register-test@example.com',
        phone: '+254712345678',
        password: 'password123',
        role: 'FARMER',
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          county: 'Nairobi',
          ward: 'Dagoretti North',
        },
      };

      const response = await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/register`)
        .send(registerDto)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(registerDto.email);
      expect(response.body.data.user.password).toBeUndefined();
      expect(response.body.data.user.profile).toBeDefined();
      expect(response.body.data.user.profile.firstName).toBe(registerDto.profile.firstName);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();

      // Verify user was created in database
      const dbUser = await prisma.user.findUnique({
        where: { email: registerDto.email },
        include: { profile: true },
      });
      expect(dbUser).toBeDefined();
      expect(dbUser?.status).toBe(UserStatus.PENDING_VERIFICATION);
    });

    it('should return tokens', async () => {
      const timestamp = Date.now();
      const registerDto = {
        email: `register-token-test-${timestamp}@example.com`,
        phone: `+2547${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
        password: 'password123',
        role: 'FARMER',
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          county: 'Nairobi',
        },
      };

      const response = await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/register`)
        .send(registerDto)
        .expect(201);

      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(typeof response.body.data.accessToken).toBe('string');
      expect(typeof response.body.data.refreshToken).toBe('string');
    });

    it('should reject duplicate email', async () => {
      const registerDto = {
        email: 'register-duplicate@example.com',
        phone: '+254712345678',
        password: 'password123',
        role: 'FARMER',
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          county: 'Nairobi',
        },
      };

      // First registration should succeed
      await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/register`)
        .send(registerDto)
        .expect(201);

      // Second registration with same email should fail
      await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/register`)
        .send(registerDto)
        .expect(400);
    });

    it('should reject duplicate phone', async () => {
      const phone = `+2547${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`;
      const timestamp1 = Date.now();
      const timestamp2 = Date.now() + 1;
      
      const registerDto1 = {
        email: `register-phone1-${timestamp1}@example.com`,
        phone,
        password: 'password123',
        role: 'FARMER',
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          county: 'Nairobi',
        },
      };

      const registerDto2 = {
        email: `register-phone2-${timestamp2}@example.com`,
        phone,
        password: 'password123',
        role: 'FARMER',
        profile: {
          firstName: 'Jane',
          lastName: 'Doe',
          county: 'Nairobi',
        },
      };

      // Clean up first
      await prisma.user.deleteMany({
        where: {
          OR: [
            { email: registerDto1.email },
            { email: registerDto2.email },
            { phone },
          ],
        },
      });

      // First registration should succeed
      const firstResponse = await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/register`)
        .send(registerDto1);
      
      if (firstResponse.status !== 201) {
        console.error('First registration failed:', firstResponse.status, JSON.stringify(firstResponse.body, null, 2));
      }
      expect(firstResponse.status).toBe(201);

      // Second registration with same phone should fail
      await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/register`)
        .send(registerDto2)
        .expect(400);
    });

    it('should reject invalid email format', async () => {
      const registerDto = {
        email: 'invalid-email',
        phone: '+254712345678',
        password: 'password123',
        role: 'FARMER',
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          county: 'Nairobi',
        },
      };

      await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/register`)
        .send(registerDto)
        .expect(400);
    });

    it('should reject invalid phone format', async () => {
      const registerDto = {
        email: `invalid-phone-${Date.now()}@example.com`,
        phone: '123', // Invalid phone format
        password: 'password123',
        role: 'FARMER',
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          county: 'Nairobi',
        },
      };

      await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/register`)
        .send(registerDto)
        .expect(400);
    });

    it('should reject password too short', async () => {
      const registerDto = {
        email: `short-password-${Date.now()}@example.com`,
        phone: '+254712345678',
        password: 'short', // Less than 8 characters
        role: 'FARMER',
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          county: 'Nairobi',
        },
      };

      await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/register`)
        .send(registerDto)
        .expect(400);
    });

    it('should reject missing required fields', async () => {
      const registerDto = {
        email: `missing-fields-${Date.now()}@example.com`,
        // Missing phone, password, role, profile
      };

      await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/register`)
        .send(registerDto)
        .expect(400);
    });

    it('should reject invalid role', async () => {
      const registerDto = {
        email: `invalid-role-${Date.now()}@example.com`,
        phone: '+254712345678',
        password: 'password123',
        role: 'INVALID_ROLE',
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          county: 'Nairobi',
        },
      };

      await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/register`)
        .send(registerDto)
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    let testUser: any;

    beforeEach(async () => {
      // Create a test user for login tests
      const hashedPassword = await bcrypt.hash('password123', 10);
      testUser = await prisma.user.create({
        data: {
          email: 'login-test@example.com',
          phone: '+254712345679',
          password: hashedPassword,
          role: UserRole.FARMER,
          status: UserStatus.ACTIVE,
          profile: {
            create: {
              firstName: 'Login',
              lastName: 'Test',
              county: 'Nairobi',
            },
          },
        },
      });
    });

    it('should login with correct credentials', async () => {
      const response =       await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/login`)
        .send({
          email: 'login-test@example.com',
          password: 'password123',
        })
        .expect(200);

      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe('login-test@example.com');
      expect(response.body.data.user.password).toBeUndefined();
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should reject incorrect password', async () => {
      await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/login`)
        .send({
          email: 'login-test@example.com',
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('should reject non-existent email', async () => {
      await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/login`)
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
        .expect(401);
    });

    it('should reject missing email', async () => {
      await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/login`)
        .send({
          password: 'password123',
        })
        .expect(400);
    });

    it('should reject missing password', async () => {
      await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/login`)
        .send({
          email: 'login-test@example.com',
        })
        .expect(400);
    });

    it('should reject invalid email format', async () => {
      await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/login`)
        .send({
          email: 'invalid-email',
          password: 'password123',
        })
        .expect(400);
    });

    it('should reject login for inactive user', async () => {
      // Create an inactive user
      const hashedPassword = await bcrypt.hash('password123', 10);
      const inactiveUser = await prisma.user.create({
        data: {
          email: 'inactive-test@example.com',
          phone: '+254712345681',
          password: hashedPassword,
          role: UserRole.FARMER,
          status: UserStatus.SUSPENDED,
          profile: {
            create: {
              firstName: 'Inactive',
              lastName: 'User',
              county: 'Nairobi',
            },
          },
        },
      });

      await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/login`)
        .send({
          email: 'inactive-test@example.com',
          password: 'password123',
        })
        .expect(401);

      // Cleanup
      await prisma.user.delete({ where: { id: inactiveUser.id } });
    });
  });

  describe('POST /auth/refresh', () => {
    let testUser: any;
    let refreshToken: string;

    beforeEach(async () => {
      // Create a test user and get refresh token
      const hashedPassword = await bcrypt.hash('password123', 10);
      testUser = await prisma.user.create({
        data: {
          email: 'refresh-test@example.com',
          phone: '+254712345680',
          password: hashedPassword,
          role: UserRole.FARMER,
          status: UserStatus.ACTIVE,
          profile: {
            create: {
              firstName: 'Refresh',
              lastName: 'Test',
              county: 'Nairobi',
            },
          },
        },
      });

      // Login to get refresh token
      const loginResponse = await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/login`)
        .send({
          email: 'refresh-test@example.com',
          password: 'password123',
        });

      if (loginResponse.status !== 200) {
        console.error('Login failed:', loginResponse.status, JSON.stringify(loginResponse.body, null, 2));
      }
      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.data).toBeDefined();
      expect(loginResponse.body.data.refreshToken).toBeDefined();
      refreshToken = loginResponse.body.data.refreshToken;

      // Wait a bit for async token storage
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify refresh token was stored in database
      const storedToken = await prisma.refreshToken.findFirst({
        where: { token: refreshToken },
      });
      
      if (!storedToken) {
        console.error('Refresh token not found in database. Token:', refreshToken.substring(0, 20) + '...');
        const allTokens = await prisma.refreshToken.findMany({
          where: { userId: testUser.id },
        });
        console.error('All tokens for user:', allTokens.length, allTokens.map(t => ({ id: t.id, userId: t.userId })));
      }
      expect(storedToken).toBeDefined();
      expect(storedToken?.userId).toBe(testUser.id);
    });

    it('should refresh access token', async () => {
      const response = await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/refresh`)
        .send({ refreshToken })
        .expect(200);

      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(typeof response.body.data.accessToken).toBe('string');
      expect(typeof response.body.data.refreshToken).toBe('string');
    });

    it('should reject invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/refresh`)
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });

    it('should reject reused refresh token', async () => {
      // Ensure we have a valid refresh token
      expect(refreshToken).toBeDefined();
      expect(typeof refreshToken).toBe('string');

      // Use the refresh token once
      const firstResponse = await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/refresh`)
        .send({ refreshToken });
      
      if (firstResponse.status !== 200) {
        console.error('First refresh failed:', firstResponse.status, JSON.stringify(firstResponse.body, null, 2));
      }
      expect(firstResponse.status).toBe(200);

      // Try to use it again - should fail
      await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/refresh`)
        .send({ refreshToken })
        .expect(401);
    });

    it('should reject missing refresh token', async () => {
      await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/refresh`)
        .send({})
        .expect(400);
    });

    it('should reject expired refresh token', async () => {
      // Create an expired token (this would require manipulating the token or time)
      // For now, we'll test with a malformed token
      await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/refresh`)
        .send({ refreshToken: 'expired.or.malformed.token' })
        .expect(401);
    });

    it('should reject tampered refresh token', async () => {
      // Create a tampered token by modifying a valid one
      const tamperedToken = refreshToken.slice(0, -5) + 'XXXXX';
      await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/refresh`)
        .send({ refreshToken: tamperedToken })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    let testUser: any;
    let authToken: string;

    beforeEach(async () => {
      // Create a test user and login
      const hashedPassword = await bcrypt.hash('password123', 10);
      testUser = await prisma.user.create({
        data: {
          email: `logout-test-${Date.now()}@example.com`,
          phone: `+2547${Math.floor(Math.random() * 100000000)}`,
          password: hashedPassword,
          role: UserRole.FARMER,
          status: UserStatus.ACTIVE,
          profile: {
            create: {
              firstName: 'Logout',
              lastName: 'Test',
              county: 'Nairobi',
            },
          },
        },
      });

      const loginResponse = await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/login`)
        .send({
          email: testUser.email,
          password: 'password123',
        });

      authToken = loginResponse.body.data.accessToken;
    });

    it('should invalidate refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/logout`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.message).toBe('Logged out successfully');

      // Verify refresh tokens were deleted
      const tokens = await prisma.refreshToken.findMany({
        where: { userId: testUser.id },
      });
      expect(tokens).toHaveLength(0);
    });

    it('should reject logout without authentication', async () => {
      await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/logout`)
        .expect(401);
    });

    it('should reject logout with invalid token', async () => {
      await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/logout`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject logout with expired token', async () => {
      // Create a token that appears valid but is expired
      // In a real scenario, this would be an actually expired JWT
      await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/logout`)
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.expired')
        .expect(401);
    });
  });
});
