import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { createTestUser, getAuthToken } from '../src/test/e2e-helpers';

// Set up environment variables for tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret';
process.env.JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || '30d';
process.env.JWT_EXPIRATION = process.env.JWT_EXPIRATION || '7d';
process.env.API_PREFIX = process.env.API_PREFIX || 'api/v1';

describe('NotificationController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  const apiPrefix = process.env.API_PREFIX || 'api/v1';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    
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

    // Create test user and get auth token
    const user = await createTestUser(prisma);
    userId = user.id;
    authToken = await getAuthToken(app, user.email, 'password123');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up notifications before each test
    await prisma.notification.deleteMany({ where: { userId } });
  });

  describe('GET /notifications', () => {
    it('should return empty list when no notifications exist', async () => {
      const response = await request(app.getHttpServer())
        .get(`/${apiPrefix}/notifications`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('notifications');
      expect(response.body.data.notifications).toEqual([]);
      expect(response.body.data.total).toBe(0);
      expect(response.body.data.unreadCount).toBe(0);
    });

    it('should return notifications for user', async () => {
      // Create test notifications
      await prisma.notification.createMany({
        data: [
          {
            userId,
            type: 'ORDER',
            title: 'Test Notification 1',
            message: 'Test message 1',
            priority: 'HIGH',
            isRead: false,
          },
          {
            userId,
            type: 'PAYMENT',
            title: 'Test Notification 2',
            message: 'Test message 2',
            priority: 'MEDIUM',
            isRead: true,
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get(`/${apiPrefix}/notifications`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.notifications).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.unreadCount).toBe(1);
    });

    it('should filter by type', async () => {
      await prisma.notification.createMany({
        data: [
          {
            userId,
            type: 'ORDER',
            title: 'Order Notification',
            message: 'Order message',
            priority: 'HIGH',
          },
          {
            userId,
            type: 'PAYMENT',
            title: 'Payment Notification',
            message: 'Payment message',
            priority: 'MEDIUM',
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get(`/${apiPrefix}/notifications?type=ORDER`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.notifications).toHaveLength(1);
      expect(response.body.data.notifications[0].type).toBe('ORDER');
    });

    it('should filter by isRead status', async () => {
      await prisma.notification.createMany({
        data: [
          {
            userId,
            type: 'ORDER',
            title: 'Unread',
            message: 'Unread message',
            isRead: false,
          },
          {
            userId,
            type: 'ORDER',
            title: 'Read',
            message: 'Read message',
            isRead: true,
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get(`/${apiPrefix}/notifications?isRead=false`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.notifications).toHaveLength(1);
      expect(response.body.data.notifications[0].isRead).toBe(false);
    });
  });

  describe('GET /notifications/stats', () => {
    it('should return notification statistics', async () => {
      await prisma.notification.createMany({
        data: [
          {
            userId,
            type: 'ORDER',
            title: 'Order 1',
            message: 'Message 1',
            priority: 'HIGH',
            isRead: false,
          },
          {
            userId,
            type: 'ORDER',
            title: 'Order 2',
            message: 'Message 2',
            priority: 'MEDIUM',
            isRead: true,
          },
          {
            userId,
            type: 'PAYMENT',
            title: 'Payment 1',
            message: 'Payment message',
            priority: 'HIGH',
            isRead: false,
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get(`/${apiPrefix}/notifications/stats`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.total).toBe(3);
      expect(response.body.data.unread).toBe(2);
      expect(response.body.data.read).toBe(1);
      expect(response.body.data.byType.ORDER).toBe(2);
      expect(response.body.data.byType.PAYMENT).toBe(1);
    });
  });

  describe('GET /notifications/:id', () => {
    it('should return notification by ID', async () => {
      const notification = await prisma.notification.create({
        data: {
          userId,
          type: 'ORDER',
          title: 'Test Notification',
          message: 'Test message',
          priority: 'HIGH',
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/${apiPrefix}/notifications/${notification.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.id).toBe(notification.id);
      expect(response.body.data.title).toBe('Test Notification');
    });

    it('should return 404 if notification not found', async () => {
      await request(app.getHttpServer())
        .get(`/${apiPrefix}/notifications/non-existent-id`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PUT /notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      const notification = await prisma.notification.create({
        data: {
          userId,
          type: 'ORDER',
          title: 'Test Notification',
          message: 'Test message',
          isRead: false,
        },
      });

      const response = await request(app.getHttpServer())
        .put(`/${apiPrefix}/notifications/${notification.id}/read`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.isRead).toBe(true);
      expect(response.body.data.readAt).toBeDefined();
    });
  });

  describe('PUT /notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      await prisma.notification.createMany({
        data: [
          {
            userId,
            type: 'ORDER',
            title: 'Notification 1',
            message: 'Message 1',
            isRead: false,
          },
          {
            userId,
            type: 'ORDER',
            title: 'Notification 2',
            message: 'Message 2',
            isRead: false,
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .put(`/${apiPrefix}/notifications/read-all`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.count).toBe(2);

      // Verify all are marked as read
      const notifications = await prisma.notification.findMany({
        where: { userId },
      });
      expect(notifications.every((n) => n.isRead)).toBe(true);
    });
  });

  describe('DELETE /notifications/:id', () => {
    it('should delete notification', async () => {
      const notification = await prisma.notification.create({
        data: {
          userId,
          type: 'ORDER',
          title: 'Test Notification',
          message: 'Test message',
        },
      });

      await request(app.getHttpServer())
        .delete(`/${apiPrefix}/notifications/${notification.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const deleted = await prisma.notification.findUnique({
        where: { id: notification.id },
      });
      expect(deleted).toBeNull();
    });
  });

  describe('DELETE /notifications/read/all', () => {
    it('should delete all read notifications', async () => {
      await prisma.notification.createMany({
        data: [
          {
            userId,
            type: 'ORDER',
            title: 'Read Notification',
            message: 'Read message',
            isRead: true,
          },
          {
            userId,
            type: 'ORDER',
            title: 'Unread Notification',
            message: 'Unread message',
            isRead: false,
          },
        ],
      });

      await request(app.getHttpServer())
        .delete(`/${apiPrefix}/notifications/read/all`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const remaining = await prisma.notification.findMany({
        where: { userId },
      });
      expect(remaining).toHaveLength(1);
      expect(remaining[0].isRead).toBe(false);
    });
  });
});
