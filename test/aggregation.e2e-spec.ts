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

describe('AggregationController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const apiPrefix = process.env.API_PREFIX || 'api/v1';
  let managerUser: any;
  let managerToken: string;
  let farmerUser: any;
  let buyerUser: any;
  let aggregationCenter: any;
  let testOrder: any;

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

    // Create aggregation manager
    managerUser = await createTestUser(prisma, {
      email: 'aggregation-manager@example.com',
      role: UserRole.AGGREGATION_MANAGER,
      status: UserStatus.ACTIVE,
    });
    managerToken = await getAuthToken(app, managerUser.email, 'password123');

    // Create farmer
    farmerUser = await createTestUser(prisma, {
      email: 'farmer-aggregation@example.com',
      role: UserRole.FARMER,
      status: UserStatus.ACTIVE,
    });

    // Create buyer
    buyerUser = await createTestUser(prisma, {
      email: 'buyer-aggregation@example.com',
      role: UserRole.BUYER,
      status: UserStatus.ACTIVE,
    });

    // Create aggregation center
    aggregationCenter = await prisma.aggregationCenter.create({
      data: {
        name: 'Test Aggregation Center',
        code: 'AC-TEST-001',
        location: 'Nairobi',
        county: 'Nairobi',
        centerType: 'MAIN',
        totalCapacity: 1000,
        currentStock: 0,
        managerId: managerUser.id,
        managerName: 'Test Manager',
        managerPhone: managerUser.phone || '+254712345678',
        status: 'OPERATIONAL',
      },
    });

    // Create test order
    testOrder = await prisma.marketplaceOrder.create({
      data: {
        orderNumber: 'ORD-AGG-TEST-001',
        buyerId: buyerUser.id,
        farmerId: farmerUser.id,
        variety: 'KENYA',
        quantity: 100,
        pricePerKg: 50,
        totalAmount: 5000,
        status: 'ORDER_ACCEPTED',
        deliveryAddress: 'Test Address',
        deliveryCounty: 'Nairobi',
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    if (testOrder) {
      await prisma.marketplaceOrder.delete({ where: { id: testOrder.id } });
    }
    if (aggregationCenter) {
      await prisma.aggregationCenter.delete({ where: { id: aggregationCenter.id } });
    }
    if (managerUser) {
      await prisma.user.delete({ where: { id: managerUser.id } });
    }
    if (farmerUser) {
      await prisma.user.delete({ where: { id: farmerUser.id } });
    }
    if (buyerUser) {
      await prisma.user.delete({ where: { id: buyerUser.id } });
    }
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await prisma.stockTransaction.deleteMany({
      where: {
        centerId: aggregationCenter.id,
      },
    });
    await prisma.qualityCheck.deleteMany({
      where: {
        centerId: aggregationCenter.id,
      },
    });
    await prisma.wastageEntry.deleteMany({
      where: {
        centerId: aggregationCenter.id,
      },
    });
    await prisma.inventoryItem.deleteMany({
      where: {
        centerId: aggregationCenter.id,
      },
    });
  });

  describe('Aggregation Centers', () => {
    it('should create aggregation center', async () => {
      const createDto = {
        name: 'New Test Center',
        location: 'Mombasa',
        county: 'Mombasa',
        coordinates: '-4.0435,39.6682',
        centerType: 'SATELLITE',
        totalCapacity: 500,
        managerId: managerUser.id,
      };

      const response = await request(app.getHttpServer())
        .post(`/${apiPrefix}/aggregation/centers`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe(createDto.name);
      expect(response.body.data.code).toBeDefined();
      expect(response.body.data.code).toMatch(/^AC-\d{8}-\d{6}$/);

      // Cleanup
      await prisma.aggregationCenter.delete({ where: { id: response.body.data.id } });
    });

    it('should get aggregation center by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/${apiPrefix}/aggregation/centers/${aggregationCenter.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(aggregationCenter.id);
      expect(response.body.data.name).toBe(aggregationCenter.name);
    });

    it('should get all aggregation centers', async () => {
      const response = await request(app.getHttpServer())
        .get(`/${apiPrefix}/aggregation/centers`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      // Response might be wrapped or direct array
      const centers = Array.isArray(response.body) ? response.body : response.body.data || response.body;
      expect(Array.isArray(centers)).toBe(true);
      expect(centers.length).toBeGreaterThan(0);
    });
  });

  describe('Stock Transactions', () => {
    it('should create stock in → order status AT_AGGREGATION', async () => {
      const createDto = {
        centerId: aggregationCenter.id,
        variety: 'KENYA',
        quantity: 100,
        qualityGrade: 'A',
        pricePerKg: 50,
        orderId: testOrder.id,
      };

      const response = await request(app.getHttpServer())
        .post(`/${apiPrefix}/aggregation/stock-in`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.type).toBe('STOCK_IN');
      expect(response.body.data.transactionNumber).toBeDefined();
      expect(response.body.data.farmerId).toBe(farmerUser.id);
      expect(response.body.data.farmerName).toBeDefined();

      // Verify order status updated
      const updatedOrder = await prisma.marketplaceOrder.findUnique({
        where: { id: testOrder.id },
      });
      expect(updatedOrder?.status).toBe('AT_AGGREGATION');

      // Verify activity log created
      const activityLogs = await prisma.activityLog.findMany({
        where: {
          entityType: 'STOCK_TRANSACTION',
          entityId: response.body.data.id,
        },
      });
      expect(activityLogs.length).toBeGreaterThan(0);
    });

    it('should create stock out → order status OUT_FOR_DELIVERY', async () => {
      // First create stock in
      await prisma.aggregationCenter.update({
        where: { id: aggregationCenter.id },
        data: { currentStock: 100 },
      });

      const createDto = {
        centerId: aggregationCenter.id,
        variety: 'KENYA',
        quantity: 50,
        qualityGrade: 'A',
        pricePerKg: 50,
        orderId: testOrder.id,
      };

      const response = await request(app.getHttpServer())
        .post(`/${apiPrefix}/aggregation/stock-out`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.type).toBe('STOCK_OUT');

      // Verify order status updated
      const updatedOrder = await prisma.marketplaceOrder.findUnique({
        where: { id: testOrder.id },
      });
      expect(updatedOrder?.status).toBe('OUT_FOR_DELIVERY');
    });

    it('should reject stock out with insufficient stock', async () => {
      await prisma.aggregationCenter.update({
        where: { id: aggregationCenter.id },
        data: { currentStock: 10 },
      });

      const createDto = {
        centerId: aggregationCenter.id,
        variety: 'KENYA',
        quantity: 100,
        qualityGrade: 'A',
        pricePerKg: 50,
      };

      await request(app.getHttpServer())
        .post(`/${apiPrefix}/aggregation/stock-out`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(createDto)
        .expect(400);
    });

    it('should maintain farmer traceability in stock transactions', async () => {
      const createDto = {
        centerId: aggregationCenter.id,
        variety: 'KENYA',
        quantity: 50,
        qualityGrade: 'A',
        pricePerKg: 50,
        orderId: testOrder.id,
      };

      const response = await request(app.getHttpServer())
        .post(`/${apiPrefix}/aggregation/stock-in`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.data.farmerId).toBe(farmerUser.id);
      expect(response.body.data.farmerName).toBeDefined();

      // Verify farmer relation
      const transaction = await prisma.stockTransaction.findUnique({
        where: { id: response.body.data.id },
        include: { farmer: true },
      });
      expect(transaction?.farmer).toBeDefined();
      expect(transaction?.farmer?.id).toBe(farmerUser.id);
    });
  });

  describe('Quality Checks', () => {
    let stockTransaction: any;

    beforeEach(async () => {
      // Create a stock transaction for quality check
      const transactionNumber = await prisma.$queryRaw<Array<{ generate_stock_transaction_number: string }>>`
        SELECT generate_stock_transaction_number() as generate_stock_transaction_number
      `;

      stockTransaction = await prisma.stockTransaction.create({
        data: {
          centerId: aggregationCenter.id,
          transactionNumber: transactionNumber[0].generate_stock_transaction_number,
          type: 'STOCK_IN',
          variety: 'KENYA',
          quantity: 100,
          qualityGrade: 'A',
          orderId: testOrder.id,
          farmerId: farmerUser.id,
          farmerName: 'Test Farmer',
          batchId: 'BATCH-TEST-001',
          createdBy: managerUser.id,
        },
      });
    });

    it('should create quality check → order QUALITY_CHECKED → QUALITY_APPROVED', async () => {
      const createDto = {
        centerId: aggregationCenter.id,
        orderId: testOrder.id,
        transactionId: stockTransaction.id,
        variety: 'KENYA',
        quantity: 100,
        qualityScore: 85,
        qualityGrade: 'A',
        physicalCondition: 'GOOD',
        freshness: 'FRESH',
      };

      const response = await request(app.getHttpServer())
        .post(`/${apiPrefix}/aggregation/quality-checks`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.approved).toBe(true);
      expect(response.body.data.qualityScore).toBe(85);
      expect(response.body.data.farmerId).toBe(farmerUser.id);
      expect(response.body.data.batchId).toBe('BATCH-TEST-001');

      // Verify order status updated
      const updatedOrder = await prisma.marketplaceOrder.findUnique({
        where: { id: testOrder.id },
      });
      expect(updatedOrder?.status).toBe('QUALITY_APPROVED');
      expect(updatedOrder?.qualityScore).toBe(85);
      expect(updatedOrder?.qualityFeedback).toBe('Quality approved');

      // Verify notifications created
      const notifications = await prisma.notification.findMany({
        where: {
          entityType: 'ORDER',
          entityId: testOrder.id,
          type: 'QUALITY_CHECK',
        },
      });
      expect(notifications.length).toBeGreaterThan(0);
    });

    it('should create quality check → order QUALITY_REJECTED when score < 70', async () => {
      const createDto = {
        centerId: aggregationCenter.id,
        orderId: testOrder.id,
        transactionId: stockTransaction.id,
        variety: 'KENYA',
        quantity: 100,
        qualityScore: 65,
        qualityGrade: 'C',
        physicalCondition: 'POOR',
        freshness: 'STALE',
      };

      const response = await request(app.getHttpServer())
        .post(`/${apiPrefix}/aggregation/quality-checks`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.data.approved).toBe(false);
      expect(response.body.data.rejectionReason).toBeDefined();

      // Verify order status updated
      const updatedOrder = await prisma.marketplaceOrder.findUnique({
        where: { id: testOrder.id },
      });
      expect(updatedOrder?.status).toBe('QUALITY_REJECTED');
      expect(updatedOrder?.qualityScore).toBe(65);
    });

    it('should derive farmer info from order', async () => {
      const createDto = {
        centerId: aggregationCenter.id,
        orderId: testOrder.id,
        variety: 'KENYA',
        quantity: 100,
        qualityScore: 80,
        qualityGrade: 'A',
        physicalCondition: 'GOOD',
        freshness: 'FRESH',
      };

      const response = await request(app.getHttpServer())
        .post(`/${apiPrefix}/aggregation/quality-checks`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.data.farmerId).toBe(farmerUser.id);
      expect(response.body.data.farmerName).toBeDefined();
    });

    it('should derive batchId from transaction', async () => {
      const createDto = {
        centerId: aggregationCenter.id,
        orderId: testOrder.id,
        transactionId: stockTransaction.id,
        variety: 'KENYA',
        quantity: 100,
        qualityScore: 80,
        qualityGrade: 'A',
        physicalCondition: 'GOOD',
        freshness: 'FRESH',
      };

      const response = await request(app.getHttpServer())
        .post(`/${apiPrefix}/aggregation/quality-checks`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.data.batchId).toBe('BATCH-TEST-001');
    });
  });

  describe('Wastage', () => {
    let inventoryItem: any;

    beforeEach(async () => {
      // Create inventory item for wastage
      inventoryItem = await prisma.inventoryItem.create({
        data: {
          centerId: aggregationCenter.id,
          variety: 'KENYA',
          quantity: 100,
          qualityGrade: 'A',
          stockInDate: new Date(),
          farmerId: farmerUser.id,
          farmerName: 'Test Farmer',
          batchId: 'BATCH-WASTE-001',
        },
      });
    });

    it('should create wastage entry with farmer info from inventory', async () => {
      const createDto = {
        centerId: aggregationCenter.id,
        variety: 'KENYA',
        quantity: 10,
        qualityGrade: 'B',
        category: 'SPOILAGE',
        reason: 'Damaged during storage',
        inventoryItemId: inventoryItem.id,
      };

      const response = await request(app.getHttpServer())
        .post(`/${apiPrefix}/aggregation/wastage`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.farmerId).toBe(farmerUser.id);
      expect(response.body.data.farmerName).toBe('Test Farmer');
      expect(response.body.data.batchId).toBe('BATCH-WASTE-001');
      expect(response.body.data.recordedByName).toBeDefined();
    });

    it('should derive batchId from inventory', async () => {
      const createDto = {
        centerId: aggregationCenter.id,
        variety: 'KENYA',
        quantity: 5,
        qualityGrade: 'B',
        category: 'SPOILAGE',
        reason: 'Test',
        inventoryItemId: inventoryItem.id,
      };

      const response = await request(app.getHttpServer())
        .post(`/${apiPrefix}/aggregation/wastage`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.data.batchId).toBe('BATCH-WASTE-001');
    });
  });

  describe('Inventory', () => {
    it('should return inventory with farmer relation', async () => {
      // Create inventory item
      await prisma.inventoryItem.create({
        data: {
          centerId: aggregationCenter.id,
          variety: 'KENYA',
          quantity: 100,
          qualityGrade: 'A',
          stockInDate: new Date(),
          farmerId: farmerUser.id,
          farmerName: 'Test Farmer',
          batchId: 'BATCH-INVENTORY-TEST-001',
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/${apiPrefix}/aggregation/inventory?centerId=${aggregationCenter.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      // Response might be wrapped or direct array
      const inventory = Array.isArray(response.body) ? response.body : response.body.data || response.body;
      expect(Array.isArray(inventory)).toBe(true);
      if (inventory.length > 0) {
        expect(inventory[0].farmer).toBeDefined();
      }
    });
  });

  describe('Statistics', () => {
    it('should return aggregation statistics', async () => {
      const response = await request(app.getHttpServer())
        .get(`/${apiPrefix}/aggregation/stats`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.totalCenters).toBeDefined();
      expect(response.body.data.mainCenters).toBeDefined();
      expect(response.body.data.satelliteCenters).toBeDefined();
      expect(response.body.data.totalStock).toBeDefined();
      expect(response.body.data.totalCapacity).toBeDefined();
      expect(response.body.data.utilizationRate).toBeDefined();
    });
  });
});
