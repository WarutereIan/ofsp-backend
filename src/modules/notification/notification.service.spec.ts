import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: PrismaService;

  const mockPrismaService = {
    notification: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      groupBy: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getNotifications', () => {
    it('should return notifications with pagination', async () => {
      const mockNotifications = [
        { id: '1', userId: 'user-1', type: 'ORDER', title: 'Test', message: 'Test message', isRead: false },
        { id: '2', userId: 'user-1', type: 'PAYMENT', title: 'Test 2', message: 'Test message 2', isRead: true },
      ];

      mockPrismaService.notification.findMany.mockResolvedValue(mockNotifications);
      mockPrismaService.notification.count.mockResolvedValue(2);
      mockPrismaService.notification.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

      const result = await service.getNotifications({
        userId: 'user-1',
        limit: 10,
        offset: 0,
      });

      expect(result.notifications).toEqual(mockNotifications);
      expect(result.total).toBe(2);
      expect(result.unreadCount).toBe(1);
    });

    it('should filter by type', async () => {
      const mockNotifications = [
        { id: '1', userId: 'user-1', type: 'ORDER', title: 'Test', message: 'Test message', isRead: false },
      ];

      mockPrismaService.notification.findMany.mockResolvedValue(mockNotifications);
      mockPrismaService.notification.count.mockResolvedValue(1);

      await service.getNotifications({
        userId: 'user-1',
        type: 'ORDER',
      });

      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', type: 'ORDER' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });
  });

  describe('getNotificationById', () => {
    it('should return notification if found and user owns it', async () => {
      const mockNotification = {
        id: '1',
        userId: 'user-1',
        type: 'ORDER',
        title: 'Test',
        message: 'Test message',
      };

      mockPrismaService.notification.findUnique.mockResolvedValue(mockNotification);

      const result = await service.getNotificationById('1', 'user-1');

      expect(result).toEqual(mockNotification);
    });

    it('should throw NotFoundException if notification not found', async () => {
      mockPrismaService.notification.findUnique.mockResolvedValue(null);

      await expect(service.getNotificationById('1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user does not own notification', async () => {
      const mockNotification = {
        id: '1',
        userId: 'user-2',
        type: 'ORDER',
        title: 'Test',
        message: 'Test message',
      };

      mockPrismaService.notification.findUnique.mockResolvedValue(mockNotification);

      await expect(service.getNotificationById('1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const mockNotification = {
        id: '1',
        userId: 'user-1',
        isRead: false,
      };

      const updatedNotification = {
        ...mockNotification,
        isRead: true,
        readAt: new Date(),
      };

      mockPrismaService.notification.findUnique.mockResolvedValue(mockNotification);
      mockPrismaService.notification.update.mockResolvedValue(updatedNotification);

      const result = await service.markAsRead('1', 'user-1');

      expect(result.isRead).toBe(true);
      expect(result.readAt).toBeDefined();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      mockPrismaService.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllAsRead('user-1');

      expect(mockPrismaService.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
        data: { isRead: true, readAt: expect.any(Date) },
      });
      expect(result.count).toBe(5);
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification if user owns it', async () => {
      const mockNotification = {
        id: '1',
        userId: 'user-1',
      };

      mockPrismaService.notification.findUnique.mockResolvedValue(mockNotification);
      mockPrismaService.notification.delete.mockResolvedValue(mockNotification);

      await service.deleteNotification('1', 'user-1');

      expect(mockPrismaService.notification.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });

  describe('getNotificationStats', () => {
    it('should return notification statistics', async () => {
      mockPrismaService.notification.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(3); // unread

      mockPrismaService.notification.groupBy
        .mockResolvedValueOnce([
          { type: 'ORDER', _count: 5 },
          { type: 'PAYMENT', _count: 3 },
        ])
        .mockResolvedValueOnce([
          { priority: 'HIGH', _count: 2 },
          { priority: 'MEDIUM', _count: 6 },
        ]);

      const result = await service.getNotificationStats('user-1');

      expect(result.total).toBe(10);
      expect(result.unread).toBe(3);
      expect(result.read).toBe(7);
      expect(result.byType.ORDER).toBe(5);
      expect(result.byType.PAYMENT).toBe(3);
      expect(result.byPriority.HIGH).toBe(2);
      expect(result.byPriority.MEDIUM).toBe(6);
    });
  });
});
