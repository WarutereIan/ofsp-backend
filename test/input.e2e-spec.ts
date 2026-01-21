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
      console.log('📦 Stage 1: Fetching all inputs via API...');
      const response = await request(app.getHttpServer())
        .get(`/${apiPrefix}/inputs`)
        .set('Authorization', `Bearer ${providerToken}`)
        .expect(200);

      console.log('📦 Stage 2: Verifying inputs response structure...');
      expect(response.body).toBeDefined();
      const inputs = Array.isArray(response.body) ? response.body : response.body.data || response.body;
      expect(Array.isArray(inputs)).toBe(true);
      console.log(`✅ Retrieved ${inputs.length} inputs`);
      console.log('✅ Test completed: Inputs retrieval');
    });

    it('should create an input product', async () => {
      console.log('📦 Stage 1: Preparing input product data...');
      const inputData = {
        name: 'OFSP Cuttings',
        category: 'Planting Material', // DTO accepts this format
        description: 'High quality OFSP cuttings',
        price: 50,
        unit: 'cutting',
        stock: 100,
        location: 'Nairobi',
      };
      console.log(`✅ Input data prepared: ${inputData.name}, ${inputData.stock} ${inputData.unit}s`);

      console.log('📦 Stage 2: Creating input product via API...');
      const response = await request(app.getHttpServer())
        .post(`/${apiPrefix}/inputs`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send(inputData)
        .expect(201);

      console.log('📦 Stage 3: Verifying input creation response...');
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe(inputData.name);
      expect(response.body.data.stock).toBe(inputData.stock);
      console.log(`✅ Input created: ${response.body.data.name} with ID: ${response.body.data.id}`);
      console.log('✅ Test completed: Input product creation');
    });

    it('should get input by ID', async () => {
      console.log('📦 Stage 1: Creating test input product...');
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
      console.log(`✅ Test input created: ${testInput.id}`);

      console.log('📦 Stage 2: Fetching input by ID via API...');
      const response = await request(app.getHttpServer())
        .get(`/${apiPrefix}/inputs/${testInput.id}`)
        .set('Authorization', `Bearer ${providerToken}`)
        .expect(200);

      console.log('📦 Stage 3: Verifying input response...');
      expect(response.body).toBeDefined();
      const input = response.body.data || response.body;
      expect(input.id).toBe(testInput.id);
      expect(input.name).toBe('Test Input');
      console.log(`✅ Input retrieved: ${input.name}`);
      console.log('✅ Test completed: Get input by ID');
    });

    it('should update an input product', async () => {
      console.log('📦 Stage 1: Creating test input product...');
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
      console.log(`✅ Test input created: ${testInput.id}`);

      console.log('📦 Stage 2: Updating input product via API...');
      const updateData = {
        price: 120,
        stock: 75,
      };
      const response = await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/${testInput.id}`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send(updateData)
        .expect(200);

      console.log('📦 Stage 3: Verifying input update response...');
      expect(response.body.success).toBe(true);
      expect(response.body.data.price).toBe(120);
      expect(response.body.data.stock).toBe(75);
      console.log(`✅ Input updated: price=${response.body.data.price}, stock=${response.body.data.stock}`);
      console.log('✅ Test completed: Input product update');
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
      console.log('📦 Stage 1: Preparing order data...');
      const orderData = {
        inputId: testInput.id,
        quantity: 10,
        requiresTransport: false,
      };
      console.log(`✅ Order data prepared: ${orderData.quantity} ${testInput.unit}s`);

      console.log('📦 Stage 2: Creating input order via API...');
      const response = await request(app.getHttpServer())
        .post(`/${apiPrefix}/inputs/orders`)
        .set('Authorization', `Bearer ${farmerToken}`)
        .send(orderData)
        .expect(201);

      console.log('📦 Stage 3: Verifying order creation response...');
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.orderNumber).toBeDefined();
      expect(response.body.data.status).toBe('PENDING');
      console.log(`✅ Order created: ${response.body.data.orderNumber}`);

      testOrder = response.body.data;

      console.log('📦 Stage 4: Verifying notifications were created...');
      const notifications = await prisma.notification.findMany({
        where: {
          OR: [
            { userId: providerUser.id, entityId: testOrder.id },
            { userId: farmerUser.id, entityId: testOrder.id },
          ],
        },
      });
      expect(notifications.length).toBeGreaterThanOrEqual(2);
      console.log(`✅ ${notifications.length} notifications created for order`);

      console.log('📦 Stage 5: Verifying activity logs were created...');
      const activityLogs = await prisma.activityLog.findMany({
        where: {
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
          action: 'INPUT_ORDER_CREATED',
        },
      });
      expect(activityLogs.length).toBeGreaterThanOrEqual(1);
      console.log(`✅ ${activityLogs.length} activity logs created for order`);
      console.log('✅ Test completed: Order creation with notifications and activity logs');
    });

    it('should update order status → notifications sent → activity logs created → stock reduced', async () => {
      console.log('📦 Stage 1: Creating initial order...');
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
      console.log(`✅ Order created: ${testOrder.orderNumber} with status: ${testOrder.status}`);

      console.log('📦 Stage 2: Updating order status to ACCEPTED via API...');
      const response = await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'ACCEPTED' })
        .expect(200);

      console.log('📦 Stage 3: Verifying status update response...');
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ACCEPTED');
      console.log(`✅ Order status updated to: ${response.body.data.status}`);

      console.log('📦 Stage 4: Verifying stock was reduced...');
      const updatedInput = await prisma.input.findUnique({
        where: { id: testInput.id },
      });
      expect(updatedInput?.stock).toBe(90); // 100 - 10
      console.log(`✅ Stock reduced from 100 to ${updatedInput?.stock}`);

      console.log('📦 Stage 5: Verifying notifications were created...');
      const notifications = await prisma.notification.findMany({
        where: {
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
          type: 'ORDER',
        },
      });
      expect(notifications.length).toBeGreaterThan(0);
      console.log(`✅ ${notifications.length} notifications created for status change`);

      console.log('📦 Stage 6: Verifying activity log was created...');
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
      console.log(`✅ Activity log created with oldStatus: PENDING, newStatus: ACCEPTED`);
      console.log('✅ Test completed: Order status update with notifications, activity logs, and stock reduction');
    });

    it('should accept order → status ACCEPTED → stock reduced → notifications sent → activity logs created', async () => {
      console.log('📦 Stage 1: Creating initial order...');
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
      console.log(`✅ Order created: ${testOrder.orderNumber} with status: ${testOrder.status}`);

      console.log('📦 Stage 2: Accepting order via API...');
      const response = await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'ACCEPTED' })
        .expect(200);

      console.log('📦 Stage 3: Verifying order status updated to ACCEPTED...');
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ACCEPTED');
      console.log(`✅ Order status updated to: ${response.body.data.status}`);

      console.log('📦 Stage 4: Verifying stock was reduced...');
      const updatedInput = await prisma.input.findUnique({
        where: { id: testInput.id },
      });
      expect(updatedInput?.stock).toBe(90); // 100 - 10
      console.log(`✅ Stock reduced from 100 to ${updatedInput?.stock}`);

      console.log('📦 Stage 5: Verifying notifications (to farmer and provider)...');
      const notifications = await prisma.notification.findMany({
        where: {
          OR: [
            { userId: farmerUser.id, entityType: 'INPUT_ORDER', entityId: testOrder.id },
            { userId: providerUser.id, entityType: 'INPUT_ORDER', entityId: testOrder.id },
          ],
        },
      });
      expect(notifications.length).toBeGreaterThanOrEqual(2);
      console.log(`✅ Notifications sent: ${notifications.length} notification(s)`);

      console.log('📦 Stage 6: Verifying activity logs...');
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
      console.log(`✅ Activity logs created: ${activityLogs.length} log(s)`);
      console.log('✅ Test completed: Order acceptance with stock reduction, notifications, and activity logs');
    });

    it('should process order → status PROCESSING → notifications sent → activity logs created', async () => {
      console.log('📦 Stage 1: Creating accepted order...');
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
      console.log(`✅ Order created: ${testOrder.orderNumber} with status: ${testOrder.status}`);

      console.log('📦 Stage 2: Updating order status to PROCESSING via API...');
      const response = await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'PROCESSING' })
        .expect(200);

      console.log('📦 Stage 3: Verifying order status updated to PROCESSING...');
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('PROCESSING');
      console.log(`✅ Order status updated to: ${response.body.data.status}`);

      console.log('📦 Stage 4: Verifying notifications (to farmer)...');
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
      console.log(`✅ Notifications sent: ${notifications.length} notification(s)`);

      console.log('📦 Stage 5: Verifying activity logs...');
      const activityLogs = await prisma.activityLog.findMany({
        where: {
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
          action: 'INPUT_ORDER_STATUS_CHANGED',
        },
      });
      expect(activityLogs.length).toBeGreaterThan(0);
      console.log(`✅ Activity logs created: ${activityLogs.length} log(s)`);
      console.log('✅ Test completed: Order processing with notifications and activity logs');
    });

    it('should mark order ready for pickup → status READY_FOR_PICKUP → notifications sent → activity logs created', async () => {
      console.log('📦 Stage 1: Creating processing order...');
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
      console.log(`✅ Order created: ${testOrder.orderNumber} with status: ${testOrder.status}`);

      console.log('📦 Stage 2: Updating order status to READY_FOR_PICKUP via API...');
      const response = await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'READY_FOR_PICKUP' })
        .expect(200);

      console.log('📦 Stage 3: Verifying order status updated to READY_FOR_PICKUP...');
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('READY_FOR_PICKUP');
      console.log(`✅ Order status updated to: ${response.body.data.status}`);

      console.log('📦 Stage 4: Verifying notifications (to farmer)...');
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
      console.log(`✅ Notifications sent: ${notifications.length} notification(s)`);

      console.log('📦 Stage 5: Verifying activity logs...');
      const activityLogs = await prisma.activityLog.findMany({
        where: {
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
          action: 'INPUT_ORDER_STATUS_CHANGED',
        },
      });
      expect(activityLogs.length).toBeGreaterThan(0);
      console.log(`✅ Activity logs created: ${activityLogs.length} log(s)`);
      console.log('✅ Test completed: Order ready for pickup with notifications and activity logs');
    });

    it('should mark order ready for pickup with transport → status READY_FOR_PICKUP → transport request created → notifications sent', async () => {
      console.log('📦 Stage 1: Creating processing order with transport required...');
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
      console.log(`✅ Order created: ${testOrder.orderNumber} with requiresTransport: true`);

      console.log('📦 Stage 2: Updating order status to READY_FOR_PICKUP via API...');
      const response = await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'READY_FOR_PICKUP' })
        .expect(200);

      console.log('📦 Stage 3: Verifying order status updated to READY_FOR_PICKUP...');
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('READY_FOR_PICKUP');
      console.log(`✅ Order status updated to: ${response.body.data.status}`);

      console.log('📦 Stage 4: Verifying notifications (to farmer)...');
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
      console.log(`✅ Notifications sent: ${notifications.length} notification(s)`);
      console.log('⚠️  Note: Transport request creation would be handled by transport service integration');
      console.log('✅ Test completed: Order ready for pickup with transport requirement');
    });

    it('should update order to IN_TRANSIT → notifications sent → activity logs created', async () => {
      console.log('📦 Stage 1: Creating order ready for pickup...');
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
      console.log(`✅ Order created: ${testOrder.orderNumber} with status: ${testOrder.status}`);

      console.log('📦 Stage 2: Updating order status to IN_TRANSIT via API...');
      const response = await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'IN_TRANSIT' })
        .expect(200);

      console.log('📦 Stage 3: Verifying order status updated to IN_TRANSIT...');
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('IN_TRANSIT');
      console.log(`✅ Order status updated to: ${response.body.data.status}`);

      console.log('📦 Stage 4: Verifying notifications (to farmer)...');
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
      console.log(`✅ Notifications sent: ${notifications.length} notification(s)`);

      console.log('📦 Stage 5: Verifying activity logs...');
      const activityLogs = await prisma.activityLog.findMany({
        where: {
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
          action: 'INPUT_ORDER_STATUS_CHANGED',
        },
      });
      expect(activityLogs.length).toBeGreaterThan(0);
      console.log(`✅ Activity logs created: ${activityLogs.length} log(s)`);
      console.log('✅ Test completed: Order in transit with notifications and activity logs');
    });

    it('should deliver order → status DELIVERED → notifications sent → activity logs created', async () => {
      console.log('📦 Stage 1: Creating order in transit...');
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
      console.log(`✅ Order created: ${testOrder.orderNumber} with status: ${testOrder.status}`);

      console.log('📦 Stage 2: Updating order status to DELIVERED via API...');
      const response = await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'DELIVERED' })
        .expect(200);

      console.log('📦 Stage 3: Verifying order status updated to DELIVERED...');
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('DELIVERED');
      console.log(`✅ Order status updated to: ${response.body.data.status}`);

      console.log('📦 Stage 4: Verifying notifications (to farmer and provider)...');
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
      console.log(`✅ Notifications sent: ${notifications.length} notification(s)`);

      console.log('📦 Stage 5: Verifying activity logs...');
      const activityLogs = await prisma.activityLog.findMany({
        where: {
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
          action: 'INPUT_ORDER_STATUS_CHANGED',
        },
      });
      expect(activityLogs.length).toBeGreaterThan(0);
      console.log(`✅ Activity logs created: ${activityLogs.length} log(s)`);
      console.log('✅ Test completed: Order delivered with notifications and activity logs');
    });

    it('should complete order → status COMPLETED → payment status PAID → notifications sent → activity logs created', async () => {
      console.log('📦 Stage 1: Creating delivered order...');
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
      console.log(`✅ Order created: ${testOrder.orderNumber} with status: ${testOrder.status}`);

      console.log('📦 Stage 2: Updating order status to COMPLETED with payment status PAID via API...');
      const response = await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'COMPLETED', paymentStatus: 'PAID' })
        .expect(200);

      console.log('📦 Stage 3: Verifying order status updated to COMPLETED...');
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('COMPLETED');
      expect(response.body.data.paymentStatus).toBe('PAID');
      console.log(`✅ Order status updated to: ${response.body.data.status}`);
      console.log(`✅ Payment status updated to: ${response.body.data.paymentStatus}`);

      console.log('📦 Stage 4: Verifying notifications (to farmer and provider)...');
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
      console.log(`✅ Notifications sent: ${notifications.length} notification(s)`);

      console.log('📦 Stage 5: Verifying activity logs...');
      const activityLogs = await prisma.activityLog.findMany({
        where: {
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
          action: 'INPUT_ORDER_STATUS_CHANGED',
        },
      });
      expect(activityLogs.length).toBeGreaterThan(0);
      console.log(`✅ Activity logs created: ${activityLogs.length} log(s)`);
      console.log('✅ Test completed: Order completed with payment status, notifications, and activity logs');
    });

    it('should reject order → status REJECTED → notifications sent → activity logs created', async () => {
      console.log('📦 Stage 1: Creating pending order...');
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
      console.log(`✅ Order created: ${testOrder.orderNumber} with status: ${testOrder.status}`);

      console.log('📦 Stage 2: Rejecting order via API...');
      const response = await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'REJECTED' })
        .expect(200);

      console.log('📦 Stage 3: Verifying order status updated to REJECTED...');
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('REJECTED');
      console.log(`✅ Order status updated to: ${response.body.data.status}`);

      console.log('📦 Stage 4: Verifying notifications (to farmer and provider)...');
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
      console.log(`✅ Notifications sent: ${notifications.length} notification(s)`);

      console.log('📦 Stage 5: Verifying activity logs...');
      const activityLogs = await prisma.activityLog.findMany({
        where: {
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
          action: 'INPUT_ORDER_STATUS_CHANGED',
        },
      });
      expect(activityLogs.length).toBeGreaterThan(0);
      console.log(`✅ Activity logs created: ${activityLogs.length} log(s)`);
      console.log('✅ Test completed: Order rejection with notifications and activity logs');
    });

    it('should cancel order → status CANCELLED → notifications sent → activity logs created', async () => {
      console.log('📦 Stage 1: Creating pending order...');
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
      console.log(`✅ Order created: ${testOrder.orderNumber} with status: ${testOrder.status}`);

      console.log('📦 Stage 2: Cancelling order via API (by farmer)...');
      const response = await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({ status: 'CANCELLED' })
        .expect(200);

      console.log('📦 Stage 3: Verifying order status updated to CANCELLED...');
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('CANCELLED');
      console.log(`✅ Order status updated to: ${response.body.data.status}`);

      console.log('📦 Stage 4: Verifying notifications (to farmer and provider)...');
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
      console.log(`✅ Notifications sent: ${notifications.length} notification(s)`);

      console.log('📦 Stage 5: Verifying activity logs...');
      const activityLogs = await prisma.activityLog.findMany({
        where: {
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
          action: 'INPUT_ORDER_STATUS_CHANGED',
        },
      });
      expect(activityLogs.length).toBeGreaterThan(0);
      console.log(`✅ Activity logs created: ${activityLogs.length} log(s)`);
      console.log('✅ Test completed: Order cancellation with notifications and activity logs');
    });

    it('should complete full order lifecycle: PENDING → ACCEPTED → PROCESSING → READY_FOR_PICKUP → IN_TRANSIT → DELIVERED → COMPLETED', async () => {
      console.log('📦 Stage 1: Creating initial order...');
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
      console.log(`✅ Order created: ${testOrder.orderNumber} with status: ${testOrder.status}`);

      console.log('📦 Stage 2: Transitioning order to ACCEPTED...');
      await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'ACCEPTED' })
        .expect(200);
      console.log('✅ Order status updated to: ACCEPTED');

      console.log('📦 Stage 3: Transitioning order to PROCESSING...');
      await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'PROCESSING' })
        .expect(200);
      console.log('✅ Order status updated to: PROCESSING');

      console.log('📦 Stage 4: Transitioning order to READY_FOR_PICKUP...');
      await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'READY_FOR_PICKUP' })
        .expect(200);
      console.log('✅ Order status updated to: READY_FOR_PICKUP');

      console.log('📦 Stage 5: Transitioning order to IN_TRANSIT...');
      await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'IN_TRANSIT' })
        .expect(200);
      console.log('✅ Order status updated to: IN_TRANSIT');

      console.log('📦 Stage 6: Transitioning order to DELIVERED...');
      await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'DELIVERED' })
        .expect(200);
      console.log('✅ Order status updated to: DELIVERED');

      console.log('📦 Stage 7: Transitioning order to COMPLETED...');
      await request(app.getHttpServer())
        .put(`/${apiPrefix}/inputs/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ status: 'COMPLETED', paymentStatus: 'PAID' })
        .expect(200);
      console.log('✅ Order status updated to: COMPLETED');

      console.log('📦 Stage 8: Verifying final order state...');
      const finalOrder = await prisma.inputOrder.findUnique({
        where: { id: testOrder.id },
      });
      expect(finalOrder?.status).toBe('COMPLETED');
      expect(finalOrder?.paymentStatus).toBe('PAID');
      console.log(`✅ Final order status: ${finalOrder?.status}`);
      console.log(`✅ Final payment status: ${finalOrder?.paymentStatus}`);

      console.log('📦 Stage 9: Verifying all notifications were created...');
      const notifications = await prisma.notification.findMany({
        where: {
          OR: [
            { userId: farmerUser.id, entityType: 'INPUT_ORDER', entityId: testOrder.id },
            { userId: providerUser.id, entityType: 'INPUT_ORDER', entityId: testOrder.id },
          ],
        },
      });
      expect(notifications.length).toBeGreaterThanOrEqual(6); // At least one per stage
      console.log(`✅ Total notifications created: ${notifications.length}`);

      console.log('📦 Stage 10: Verifying all activity logs were created...');
      const activityLogs = await prisma.activityLog.findMany({
        where: {
          entityType: 'INPUT_ORDER',
          entityId: testOrder.id,
          action: 'INPUT_ORDER_STATUS_CHANGED',
        },
      });
      expect(activityLogs.length).toBe(6); // One for each status transition
      console.log(`✅ Total activity logs created: ${activityLogs.length}`);
      console.log('✅ Test completed: Full order lifecycle with all stages, notifications, and activity logs');
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
      console.log('📦 Stage 1: Fetching all customers via API...');
      const response = await request(app.getHttpServer())
        .get(`/${apiPrefix}/inputs/customers`)
        .set('Authorization', `Bearer ${providerToken}`);
      
      if (response.status !== 200) {
        console.error('❌ Customers endpoint failed:', response.status, response.body);
      }
      expect(response.status).toBe(200);

      console.log('📦 Stage 2: Verifying customers response structure...');
      expect(response.body).toBeDefined();
      const customers = Array.isArray(response.body) ? response.body : response.body.data || response.body;
      expect(Array.isArray(customers)).toBe(true);
      console.log(`✅ Retrieved ${customers.length} customers`);
      console.log('✅ Test completed: Customers retrieval');
    });

    it('should get customer by ID with order history', async () => {
      console.log('📦 Stage 1: Fetching customer by ID via API...');
      const response = await request(app.getHttpServer())
        .get(`/${apiPrefix}/inputs/customers/${farmerUser.id}`)
        .set('Authorization', `Bearer ${providerToken}`)
        .expect(200);

      console.log('📦 Stage 2: Verifying customer response...');
      expect(response.body).toBeDefined();
      const customer = response.body.data || response.body;
      expect(customer.id).toBe(farmerUser.id);
      console.log(`✅ Customer retrieved: ${customer.id}`);

      console.log('📦 Stage 3: Fetching customer order history...');
      const historyResponse = await request(app.getHttpServer())
        .get(`/${apiPrefix}/inputs/customers/${farmerUser.id}/orders`)
        .set('Authorization', `Bearer ${providerToken}`)
        .expect(200);

      console.log('📦 Stage 4: Verifying order history response...');
      expect(historyResponse.body).toBeDefined();
      const orders = Array.isArray(historyResponse.body) ? historyResponse.body : historyResponse.body.data || historyResponse.body;
      expect(Array.isArray(orders)).toBe(true);
      console.log(`✅ Retrieved ${orders.length} orders for customer`);
      console.log('✅ Test completed: Customer details and order history');
    });
  });

  describe('Statistics', () => {
    it('should return input statistics', async () => {
      console.log('📊 Stage 1: Fetching input statistics via API...');
      const response = await request(app.getHttpServer())
        .get(`/${apiPrefix}/inputs/stats`)
        .set('Authorization', `Bearer ${providerToken}`)
        .expect(200);

      console.log('📊 Stage 2: Verifying statistics response structure...');
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.totalInputs).toBeDefined();
      expect(response.body.data.totalOrders).toBeDefined();
      console.log(`✅ Statistics retrieved:`);
      console.log(`   - Total Inputs: ${response.body.data.totalInputs}`);
      console.log(`   - Total Orders: ${response.body.data.totalOrders}`);
      console.log('✅ Test completed: Input statistics retrieval');
    });
  });
});
