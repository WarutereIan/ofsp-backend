import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { createTestUser, getAuthToken } from '../src/test/e2e-helpers';
import { UserRole, UserStatus } from '@prisma/client';

// Set up environment variables for tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret';
process.env.JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || '30d';
process.env.JWT_EXPIRATION = process.env.JWT_EXPIRATION || '7d';
process.env.API_PREFIX = process.env.API_PREFIX || 'api/v1';

describe('InputController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const apiPrefix = process.env.API_PREFIX || 'api/v1';
  let providerToken: string;
  let farmerToken: string;
  let providerUser: any;
  let farmerUser: any;

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

    // Clean up any existing test users and related data first
    const existingProvider = await prisma.user.findUnique({
      where: { email: 'provider-input@example.com' },
    });
    const existingFarmer = await prisma.user.findUnique({
      where: { email: 'farmer-input@example.com' },
    });

    if (existingProvider) {
      // Delete related data first (order matters due to foreign keys)
      await prisma.inputOrder.deleteMany({ where: { OR: [{ farmerId: existingProvider.id }, { input: { providerId: existingProvider.id } }] } });
      await prisma.input.deleteMany({ where: { providerId: existingProvider.id } });
      await prisma.user.delete({ where: { id: existingProvider.id } });
    }

    if (existingFarmer) {
      // Delete related data first (order matters due to foreign keys)
      await prisma.inputOrder.deleteMany({ where: { farmerId: existingFarmer.id } });
      await prisma.user.delete({ where: { id: existingFarmer.id } });
    }

    // Create test users
    providerUser = await createTestUser(prisma, {
      email: 'provider-input@example.com',
      role: UserRole.INPUT_PROVIDER,
      status: UserStatus.ACTIVE,
    });

    farmerUser = await createTestUser(prisma, {
      email: 'farmer-input@example.com',
      role: UserRole.FARMER,
      status: UserStatus.ACTIVE,
    });

    providerToken = await getAuthToken(app, providerUser.email, 'password123');
    farmerToken = await getAuthToken(app, farmerUser.email, 'password123');
  });

  afterAll(async () => {
    // Cleanup: Delete all related data before deleting users (order matters due to foreign keys)
    if (providerUser || farmerUser) {
      // Stage 1: Delete orders
      await prisma.inputOrder.deleteMany({
        where: {
          OR: [
            { farmerId: farmerUser?.id },
            { input: { providerId: providerUser?.id } },
          ].filter(Boolean),
        },
      });
      
      // Stage 2: Delete inputs
      await prisma.input.deleteMany({
        where: {
          OR: [
            { providerId: providerUser?.id },
          ].filter(Boolean),
        },
      });
      
      // Stage 3: Delete users
      if (providerUser) await prisma.user.delete({ where: { id: providerUser.id } });
      if (farmerUser) await prisma.user.delete({ where: { id: farmerUser.id } });
    }
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data before each test (order matters due to foreign keys)
    // Stage 1: Delete orders first
    await prisma.inputOrder.deleteMany({
      where: {
        OR: [
          { farmerId: farmerUser.id },
          { input: { providerId: providerUser.id } },
        ],
      },
    });
    
    // Stage 2: Delete inputs
    await prisma.input.deleteMany({
      where: { providerId: providerUser.id },
    });
  });

  describe('Input Products CRUD', () => {
    it('should return all inputs', async () => {
      const response = await request(app.getHttpServer())
        .get(`/${apiPrefix}/inputs`)
        .set('Authorization', `Bearer ${providerToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      const inputs = Array.isArray(response.body) ? response.body : response.body.data || response.body;
      expect(Array.isArray(inputs)).toBe(true);
    });

    it('should create an input product', async () => {
      const inputData = {
        name: 'OFSP Cuttings',
        category: 'Planting Material', // DTO accepts this format
        description: 'High quality OFSP cuttings',
        price: 50,
        unit: 'cutting',
        stock: 100,
        location: 'Nairobi',
      };

      const response = await request(app.getHttpServer())
        .post(`/${apiPrefix}/inputs`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send(inputData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe(inputData.name);
      expect(response.body.data.stock).toBe(inputData.stock);
    });

    it('should get input by ID', async () => {
      const testInput = await prisma.input.create({
        data: {
          providerId: providerUser.id,
          name: 'Test Input',
          category: 'FERTILIZER', // Prisma enum uses uppercase
          description: 'Test fertilizer product',
          price: 100,
          unit: 'kg',
          stock: 50,
          location: 'Nairobi',
          status: 'ACTIVE',
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/${apiPrefix}/inputs/${testInput.id}`)
        .set('Authorization', `Bearer ${providerToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      const input = response.body.data || response.body;
      expect(input.id).toBe(testInput.id);
      expect(input.name).toBe('Test Input');
    });

    it('should update an input product', async () => {
      const testInput = await prisma.input.create({
        data: {
          providerId: providerUser.id,
          name: 'Original Input',
          category: 'FERTILIZER', // Prisma enum uses uppercase
          description: 'Original fertilizer product',
          price: 100,
          unit: 'kg',
          stock: 50,
          location: 'Nairobi',
          status: 'ACTIVE',
        },
      });

      const updateData = {
        price: 120,
        stock: 75,
      };
      const response = await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/${testInput.id}`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.price).toBe(120);
      expect(response.body.data.stock).toBe(75);
    });
  });

  describe('Input Orders Lifecycle', () => {
    let testInput: any;
    let testOrder: any;

    beforeEach(async () => {
      // Create a test input
      testInput = await prisma.input.create({
        data: {
          providerId: providerUser.id,
          name: 'OFSP Cuttings',
          category: 'PLANTING_MATERIAL', // Prisma enum uses uppercase with underscores
          description: 'High quality OFSP cuttings',
          price: 50,
          unit: 'cutting',
          stock: 100,
          location: 'Nairobi',
          status: 'ACTIVE',
        },
      });
    });

    it('should create order → notifications sent → activity logs created', async () => {
      const orderData = {
        inputId: testInput.id,
        quantity: 10,
        requiresTransport: false,
      };

      const response = await request(app.getHttpServer())
        .post(`/${apiPrefix}/inputs/orders`)
        .set('Authorization', `Bearer ${farmerToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.orderNumber).toBeDefined();
      expect(response.body.data.status).toBe('PENDING');

      testOrder = response.body.data;

      const notifications = await prisma.notification.findMany({
        where: {
          OR: [
            { userId: providerUser.id, entityId: testOrder.id },
            { userId: farmerUser.id, entityId: testOrder.id },
          ],
        },
      });
      expect(notifications.length).toBeGreaterThanOrEqual(2);

      const activityLogs = await prisma.activityLog.findMany({
        where: {
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
          action: 'INPUT_ORDER_CREATED',
        },
      });
      expect(activityLogs.length).toBeGreaterThanOrEqual(1);
    });

    it('should update order status → notifications sent → activity logs created → stock reduced', async () => {
      testOrder = await prisma.inputOrder.create({
        data: {
          farmerId: farmerUser.id,
          inputId: testInput.id,
          orderNumber: 'INP-TEST-001',
          quantity: 10,
          unit: testInput.unit,
          pricePerUnit: testInput.price,
          subtotal: 500,
          transportFee: 0,
          totalAmount: 500,
          status: 'PENDING',
          paymentStatus: 'PENDING',
        },
      });

      const response = await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'ACCEPTED' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ACCEPTED');

      const updatedInput = await prisma.input.findUnique({
        where: { id: testInput.id },
      });
      expect(updatedInput?.stock).toBe(90); // 100 - 10

      const notifications = await prisma.notification.findMany({
        where: {
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
          type: 'ORDER',
        },
      });
      expect(notifications.length).toBeGreaterThan(0);

      const activityLogs = await prisma.activityLog.findMany({
        where: {
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
          action: 'INPUT_ORDER_STATUS_CHANGED',
        },
      });
      expect(activityLogs.length).toBeGreaterThan(0);
      expect(activityLogs[0].metadata).toMatchObject({
        oldStatus: 'PENDING',
        newStatus: 'ACCEPTED',
      });
    });

    it('should accept order → status ACCEPTED → stock reduced → notifications sent → activity logs created', async () => {
      testOrder = await prisma.inputOrder.create({
        data: {
          farmerId: farmerUser.id,
          inputId: testInput.id,
          orderNumber: 'INP-ACCEPT-001',
          quantity: 10,
          unit: testInput.unit,
          pricePerUnit: testInput.price,
          subtotal: 500,
          transportFee: 0,
          totalAmount: 500,
          status: 'PENDING',
          paymentStatus: 'PENDING',
        },
      });

      const response = await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'ACCEPTED' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ACCEPTED');

      const updatedInput = await prisma.input.findUnique({
        where: { id: testInput.id },
      });
      expect(updatedInput?.stock).toBe(90); // 100 - 10

      const notifications = await prisma.notification.findMany({
        where: {
          OR: [
            { userId: farmerUser.id, entityType: 'INPUT_ORDER', entityId: testOrder.id },
            { userId: providerUser.id, entityType: 'INPUT_ORDER', entityId: testOrder.id },
          ],
        },
      });
      expect(notifications.length).toBeGreaterThanOrEqual(2);

      const activityLogs = await prisma.activityLog.findMany({
        where: {
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
          action: 'INPUT_ORDER_STATUS_CHANGED',
        },
      });
      expect(activityLogs.length).toBeGreaterThan(0);
      expect(activityLogs[0].metadata).toMatchObject({
        oldStatus: 'PENDING',
        newStatus: 'ACCEPTED',
      });
    });

    it('should process order → status PROCESSING → notifications sent → activity logs created', async () => {
      testOrder = await prisma.inputOrder.create({
        data: {
          farmerId: farmerUser.id,
          inputId: testInput.id,
          orderNumber: 'INP-PROCESS-001',
          quantity: 10,
          unit: testInput.unit,
          pricePerUnit: testInput.price,
          subtotal: 500,
          transportFee: 0,
          totalAmount: 500,
          status: 'ACCEPTED',
          paymentStatus: 'PENDING',
        },
      });

      const response = await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'PROCESSING' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('PROCESSING');

      const notifications = await prisma.notification.findMany({
        where: {
          userId: farmerUser.id,
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });
      expect(notifications.length).toBeGreaterThan(0);

      const activityLogs = await prisma.activityLog.findMany({
        where: {
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
          action: 'INPUT_ORDER_STATUS_CHANGED',
        },
      });
      expect(activityLogs.length).toBeGreaterThan(0);
    });

    it('should mark order ready for pickup → status READY_FOR_PICKUP → notifications sent → activity logs created', async () => {
      testOrder = await prisma.inputOrder.create({
        data: {
          farmerId: farmerUser.id,
          inputId: testInput.id,
          orderNumber: 'INP-READY-001',
          quantity: 10,
          unit: testInput.unit,
          pricePerUnit: testInput.price,
          subtotal: 500,
          transportFee: 0,
          totalAmount: 500,
          status: 'PROCESSING',
          paymentStatus: 'PENDING',
          requiresTransport: false,
        },
      });

      const response = await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'READY_FOR_PICKUP' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('READY_FOR_PICKUP');

      const notifications = await prisma.notification.findMany({
        where: {
          userId: farmerUser.id,
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });
      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].message).toContain('ready for pickup');

      const activityLogs = await prisma.activityLog.findMany({
        where: {
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
          action: 'INPUT_ORDER_STATUS_CHANGED',
        },
      });
      expect(activityLogs.length).toBeGreaterThan(0);
    });

    it('should mark order ready for pickup with transport → status READY_FOR_PICKUP → transport request created → notifications sent', async () => {
      testOrder = await prisma.inputOrder.create({
        data: {
          farmerId: farmerUser.id,
          inputId: testInput.id,
          orderNumber: 'INP-READY-TRANSPORT-001',
          quantity: 10,
          unit: testInput.unit,
          pricePerUnit: testInput.price,
          subtotal: 500,
          transportFee: 100,
          totalAmount: 600,
          status: 'PROCESSING',
          paymentStatus: 'PENDING',
          requiresTransport: true,
        },
      });

      const response = await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'READY_FOR_PICKUP' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('READY_FOR_PICKUP');

      const notifications = await prisma.notification.findMany({
        where: {
          userId: farmerUser.id,
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });
      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].message).toContain('Delivery arranged');
    });

    it('should update order to IN_TRANSIT → notifications sent → activity logs created', async () => {
      testOrder = await prisma.inputOrder.create({
        data: {
          farmerId: farmerUser.id,
          inputId: testInput.id,
          orderNumber: 'INP-TRANSIT-001',
          quantity: 10,
          unit: testInput.unit,
          pricePerUnit: testInput.price,
          subtotal: 500,
          transportFee: 0,
          totalAmount: 500,
          status: 'READY_FOR_PICKUP',
          paymentStatus: 'PENDING',
        },
      });

      const response = await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'IN_TRANSIT' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('IN_TRANSIT');

      const notifications = await prisma.notification.findMany({
        where: {
          userId: farmerUser.id,
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });
      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].message).toContain('in transit');

      const activityLogs = await prisma.activityLog.findMany({
        where: {
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
          action: 'INPUT_ORDER_STATUS_CHANGED',
        },
      });
      expect(activityLogs.length).toBeGreaterThan(0);
    });

    it('should deliver order → status DELIVERED → notifications sent → activity logs created', async () => {
      testOrder = await prisma.inputOrder.create({
        data: {
          farmerId: farmerUser.id,
          inputId: testInput.id,
          orderNumber: 'INP-DELIVERED-001',
          quantity: 10,
          unit: testInput.unit,
          pricePerUnit: testInput.price,
          subtotal: 500,
          transportFee: 0,
          totalAmount: 500,
          status: 'IN_TRANSIT',
          paymentStatus: 'PENDING',
        },
      });

      const response = await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'DELIVERED' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('DELIVERED');

      const notifications = await prisma.notification.findMany({
        where: {
          OR: [
            { userId: farmerUser.id, entityType: 'INPUT_ORDER', entityId: testOrder.id },
            { userId: providerUser.id, entityType: 'INPUT_ORDER', entityId: testOrder.id },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 2,
      });
      expect(notifications.length).toBeGreaterThanOrEqual(2);

      const activityLogs = await prisma.activityLog.findMany({
        where: {
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
          action: 'INPUT_ORDER_STATUS_CHANGED',
        },
      });
      expect(activityLogs.length).toBeGreaterThan(0);
    });

    it('should complete order → status COMPLETED → payment status PAID → notifications sent → activity logs created', async () => {
      testOrder = await prisma.inputOrder.create({
        data: {
          farmerId: farmerUser.id,
          inputId: testInput.id,
          orderNumber: 'INP-COMPLETED-001',
          quantity: 10,
          unit: testInput.unit,
          pricePerUnit: testInput.price,
          subtotal: 500,
          transportFee: 0,
          totalAmount: 500,
          status: 'DELIVERED',
          paymentStatus: 'PENDING',
        },
      });

      const response = await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'COMPLETED', paymentStatus: 'PAID' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('COMPLETED');
      expect(response.body.data.paymentStatus).toBe('PAID');

      const notifications = await prisma.notification.findMany({
        where: {
          OR: [
            { userId: farmerUser.id, entityType: 'INPUT_ORDER', entityId: testOrder.id },
            { userId: providerUser.id, entityType: 'INPUT_ORDER', entityId: testOrder.id },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 2,
      });
      expect(notifications.length).toBeGreaterThanOrEqual(2);

      const activityLogs = await prisma.activityLog.findMany({
        where: {
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
          action: 'INPUT_ORDER_STATUS_CHANGED',
        },
      });
      expect(activityLogs.length).toBeGreaterThan(0);
    });

    it('should reject order → status REJECTED → notifications sent → activity logs created', async () => {
      testOrder = await prisma.inputOrder.create({
        data: {
          farmerId: farmerUser.id,
          inputId: testInput.id,
          orderNumber: 'INP-REJECTED-001',
          quantity: 10,
          unit: testInput.unit,
          pricePerUnit: testInput.price,
          subtotal: 500,
          transportFee: 0,
          totalAmount: 500,
          status: 'PENDING',
          paymentStatus: 'PENDING',
        },
      });

      const response = await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'REJECTED' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('REJECTED');

      const notifications = await prisma.notification.findMany({
        where: {
          OR: [
            { userId: farmerUser.id, entityType: 'INPUT_ORDER', entityId: testOrder.id },
            { userId: providerUser.id, entityType: 'INPUT_ORDER', entityId: testOrder.id },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 2,
      });
      expect(notifications.length).toBeGreaterThanOrEqual(1);

      const activityLogs = await prisma.activityLog.findMany({
        where: {
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
          action: 'INPUT_ORDER_STATUS_CHANGED',
        },
      });
      expect(activityLogs.length).toBeGreaterThan(0);
    });

    it('should cancel order → status CANCELLED → notifications sent → activity logs created', async () => {
      testOrder = await prisma.inputOrder.create({
        data: {
          farmerId: farmerUser.id,
          inputId: testInput.id,
          orderNumber: 'INP-CANCELLED-001',
          quantity: 10,
          unit: testInput.unit,
          pricePerUnit: testInput.price,
          subtotal: 500,
          transportFee: 0,
          totalAmount: 500,
          status: 'PENDING',
          paymentStatus: 'PENDING',
        },
      });

      const response = await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({ status: 'CANCELLED' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('CANCELLED');

      const notifications = await prisma.notification.findMany({
        where: {
          OR: [
            { userId: farmerUser.id, entityType: 'INPUT_ORDER', entityId: testOrder.id },
            { userId: providerUser.id, entityType: 'INPUT_ORDER', entityId: testOrder.id },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 2,
      });
      expect(notifications.length).toBeGreaterThanOrEqual(1);

      const activityLogs = await prisma.activityLog.findMany({
        where: {
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
          action: 'INPUT_ORDER_STATUS_CHANGED',
        },
      });
      expect(activityLogs.length).toBeGreaterThan(0);
    });

    it('should complete full order lifecycle: PENDING → ACCEPTED → PROCESSING → READY_FOR_PICKUP → IN_TRANSIT → DELIVERED → COMPLETED', async () => {
      testOrder = await prisma.inputOrder.create({
        data: {
          farmerId: farmerUser.id,
          inputId: testInput.id,
          orderNumber: 'INP-LIFECYCLE-001',
          quantity: 10,
          unit: testInput.unit,
          pricePerUnit: testInput.price,
          subtotal: 500,
          transportFee: 0,
          totalAmount: 500,
          status: 'PENDING',
          paymentStatus: 'PENDING',
        },
      });

      await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'ACCEPTED' })
        .expect(200);

      await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'PROCESSING' })
        .expect(200);

      await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'READY_FOR_PICKUP' })
        .expect(200);

      await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'IN_TRANSIT' })
        .expect(200);

      await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'DELIVERED' })
        .expect(200);

      await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'COMPLETED', paymentStatus: 'PAID' })
        .expect(200);

      const finalOrder = await prisma.inputOrder.findUnique({
        where: { id: testOrder.id },
      });
      expect(finalOrder?.status).toBe('COMPLETED');
      expect(finalOrder?.paymentStatus).toBe('PAID');

      const notifications = await prisma.notification.findMany({
        where: {
          OR: [
            { userId: farmerUser.id, entityType: 'INPUT_ORDER', entityId: testOrder.id },
            { userId: providerUser.id, entityType: 'INPUT_ORDER', entityId: testOrder.id },
          ],
        },
      });
      expect(notifications.length).toBeGreaterThanOrEqual(6); // At least one per stage

      const activityLogs = await prisma.activityLog.findMany({
        where: {
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
          action: 'INPUT_ORDER_STATUS_CHANGED',
        },
      });
      expect(activityLogs.length).toBe(6); // One for each status transition
    });
  });

  describe('Customer Management', () => {
    let testInput: any;
    let testOrder: any;

    beforeEach(async () => {
      // Create a test input
      testInput = await prisma.input.create({
        data: {
          providerId: providerUser.id,
          name: 'OFSP Cuttings',
          category: 'PLANTING_MATERIAL', // Prisma enum uses uppercase with underscores
          description: 'High quality OFSP cuttings',
          price: 50,
          unit: 'cutting',
          stock: 100,
          location: 'Nairobi',
          status: 'ACTIVE',
        },
      });

      // Create a test order
      testOrder = await prisma.inputOrder.create({
        data: {
          farmerId: farmerUser.id,
          inputId: testInput.id,
          orderNumber: 'INP-CUSTOMER-001',
          quantity: 10,
          unit: testInput.unit,
          pricePerUnit: testInput.price,
          subtotal: 500,
          transportFee: 0,
          totalAmount: 500,
          status: 'COMPLETED',
          paymentStatus: 'PAID',
        },
      });
    });

    it('should return all customers', async () => {
      const response = await request(app.getHttpServer())
        .get(`/${apiPrefix}/inputs/customers`)
        .set('Authorization', `Bearer ${providerToken}`);
      
      if (response.status !== 200) {
        console.error('❌ Customers endpoint failed:', response.status, response.body);
      }
      expect(response.status).toBe(200);

      expect(response.body).toBeDefined();
      const customers = Array.isArray(response.body) ? response.body : response.body.data || response.body;
      expect(Array.isArray(customers)).toBe(true);
    });

    it('should get customer by ID with order history', async () => {
      const response = await request(app.getHttpServer())
        .get(`/${apiPrefix}/inputs/customers/${farmerUser.id}`)
        .set('Authorization', `Bearer ${providerToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      const customer = response.body.data || response.body;
      expect(customer.id).toBe(farmerUser.id);

      const historyResponse = await request(app.getHttpServer())
        .get(`/${apiPrefix}/inputs/customers/${farmerUser.id}/orders`)
        .set('Authorization', `Bearer ${providerToken}`)
        .expect(200);

      expect(historyResponse.body).toBeDefined();
      const orders = Array.isArray(historyResponse.body) ? historyResponse.body : historyResponse.body.data || historyResponse.body;
      expect(Array.isArray(orders)).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should return input statistics', async () => {
      const response = await request(app.getHttpServer())
        .get(`/${apiPrefix}/inputs/stats`)
        .set('Authorization', `Bearer ${providerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.totalInputs).toBeDefined();
      expect(response.body.data.totalOrders).toBeDefined();
    });
  });
});
