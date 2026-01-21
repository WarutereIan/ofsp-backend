import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { setupTestApp, createTestUser, getAuthToken } from '../src/test/e2e-helpers';

describe('NotificationController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await setupTestApp(app);

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
        .get('/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('notifications');
      expect(response.body.notifications).toEqual([]);
      expect(response.body.total).toBe(0);
      expect(response.body.unreadCount).toBe(0);
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
        .get('/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.notifications).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.unreadCount).toBe(1);
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
        .get('/notifications?type=ORDER')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.notifications).toHaveLength(1);
      expect(response.body.notifications[0].type).toBe('ORDER');
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
        .get('/notifications?isRead=false')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.notifications).toHaveLength(1);
      expect(response.body.notifications[0].isRead).toBe(false);
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
        .get('/notifications/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.total).toBe(3);
      expect(response.body.unread).toBe(2);
      expect(response.body.read).toBe(1);
      expect(response.body.byType.ORDER).toBe(2);
      expect(response.body.byType.PAYMENT).toBe(1);
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
        .get(`/notifications/${notification.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(notification.id);
      expect(response.body.title).toBe('Test Notification');
    });

    it('should return 404 if notification not found', async () => {
      await request(app.getHttpServer())
        .get('/notifications/non-existent-id')
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
        .put(`/notifications/${notification.id}/read`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.isRead).toBe(true);
      expect(response.body.readAt).toBeDefined();
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
        .put('/notifications/read-all')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.count).toBe(2);

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
        .delete(`/notifications/${notification.id}`)
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
        .delete('/notifications/read/all')
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
