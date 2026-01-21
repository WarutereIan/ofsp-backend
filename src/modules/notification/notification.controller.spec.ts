import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

describe('NotificationController', () => {
  let controller: NotificationController;
  let service: NotificationService;

  const mockNotificationService = {
    getNotifications: jest.fn(),
    getNotificationById: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    deleteNotification: jest.fn(),
    deleteAllRead: jest.fn(),
    getNotificationStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    controller = module.get<NotificationController>(NotificationController);
    service = module.get<NotificationService>(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getNotifications', () => {
    it('should return notifications', async () => {
      const mockResult = {
        notifications: [],
        total: 0,
        unreadCount: 0,
      };

      mockNotificationService.getNotifications.mockResolvedValue(mockResult);

      const result = await controller.getNotifications(
        { id: 'user-1' },
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );

      expect(result).toEqual(mockResult);
      expect(service.getNotifications).toHaveBeenCalledWith({
        userId: 'user-1',
        type: undefined,
        isRead: undefined,
        entityType: undefined,
        entityId: undefined,
        limit: undefined,
        offset: undefined,
      });
    });
  });

  describe('getNotificationStats', () => {
    it('should return notification statistics', async () => {
      const mockStats = {
        total: 10,
        unread: 3,
        read: 7,
        byType: {},
        byPriority: {},
      };

      mockNotificationService.getNotificationStats.mockResolvedValue(mockStats);

      const result = await controller.getNotificationStats({ id: 'user-1' });

      expect(result).toEqual(mockStats);
      expect(service.getNotificationStats).toHaveBeenCalledWith('user-1');
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const mockNotification = { id: '1', isRead: true };

      mockNotificationService.markAsRead.mockResolvedValue(mockNotification);

      const result = await controller.markAsRead('1', { id: 'user-1' });

      expect(result).toEqual(mockNotification);
      expect(service.markAsRead).toHaveBeenCalledWith('1', 'user-1');
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      mockNotificationService.markAllAsRead.mockResolvedValue({ count: 5 });

      const result = await controller.markAllAsRead({ id: 'user-1' });

      expect(result.count).toBe(5);
      expect(service.markAllAsRead).toHaveBeenCalledWith('user-1');
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification', async () => {
      const mockNotification = { id: '1' };

      mockNotificationService.deleteNotification.mockResolvedValue(mockNotification);

      await controller.deleteNotification('1', { id: 'user-1' });

      expect(service.deleteNotification).toHaveBeenCalledWith('1', 'user-1');
    });
  });
});
