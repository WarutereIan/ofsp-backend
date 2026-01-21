import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';

describe('PaymentController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let testUserId: string;
  let testOrderId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Create test user
    const testUser = await prisma.user.create({
      data: {
        email: 'payment-test@example.com',
        phone: '+254712345680',
        password: 'hashedpassword',
        role: 'FARMER',
        status: 'ACTIVE',
      },
    });

    testUserId = testUser.id;
    
    // Get auth token (simplified for test - in real scenario would use auth service)
    // For now, we'll skip auth in tests or use a mock token
    authToken = 'test-token';

    // Create test order
    const testOrder = await prisma.marketplaceOrder.create({
      data: {
        orderNumber: 'ORD-TEST-001',
        buyerId: testUserId,
        farmerId: testUserId,
        listingId: 'listing-1',
        quantity: 10,
        pricePerKg: 100,
        totalAmount: 1000,
        status: 'ORDER_PLACED',
        deliveryAddress: 'Test Address',
        deliveryCounty: 'Nairobi',
      },
    });

    testOrderId = testOrder.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.payment.deleteMany({ where: { payerId: testUserId } });
    await prisma.escrowTransaction.deleteMany({ where: { orderId: testOrderId } });
    await prisma.marketplaceOrder.deleteMany({ where: { id: testOrderId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await app.close();
  });

  describe('/payments (POST)', () => {
    it('should create a payment', () => {
      return request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: testOrderId,
          amount: 1000,
          method: 'MPESA',
          payerId: testUserId,
          payeeId: testUserId,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.amount).toBe(1000);
          expect(res.body.method).toBe('MPESA');
        });
    });
  });

  describe('/payments (GET)', () => {
    it('should return payments', () => {
      return request(app.getHttpServer())
        .get('/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('/payments/escrow (GET)', () => {
    it('should return escrow transactions', () => {
      return request(app.getHttpServer())
        .get('/payments/escrow')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('/payments/stats (GET)', () => {
    it('should return payment statistics', () => {
      return request(app.getHttpServer())
        .get('/payments/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalPayments');
          expect(res.body).toHaveProperty('totalAmount');
          expect(res.body).toHaveProperty('escrowStats');
        });
    });
  });
});
