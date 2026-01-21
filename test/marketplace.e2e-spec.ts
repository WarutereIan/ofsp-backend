import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { createTestApp, getAuthToken } from '../src/test/e2e-helpers';

describe('MarketplaceController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let farmerToken: string;
  let buyerToken: string;
  let farmerId: string;
  let buyerId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Create test users
    const farmer = await prisma.user.create({
      data: {
        email: 'farmer-test@example.com',
        phone: '+254712345678',
        password: 'hashed-password',
        role: 'FARMER',
        status: 'ACTIVE',
        profile: {
          create: {
            firstName: 'Farmer',
            lastName: 'Test',
            county: 'Nairobi',
          },
        },
      },
    });

    const buyer = await prisma.user.create({
      data: {
        email: 'buyer-test@example.com',
        phone: '+254712345679',
        password: 'hashed-password',
        role: 'BUYER',
        status: 'ACTIVE',
        profile: {
          create: {
            firstName: 'Buyer',
            lastName: 'Test',
            county: 'Nairobi',
          },
        },
      },
    });

    farmerId = farmer.id;
    buyerId = buyer.id;
    // In real test, get actual tokens from login
    // farmerToken = await getAuthToken(app, farmer.email, 'password');
    // buyerToken = await getAuthToken(app, buyer.email, 'password');
  });

  afterAll(async () => {
    // Cleanup
    if (farmerId) await prisma.user.delete({ where: { id: farmerId } });
    if (buyerId) await prisma.user.delete({ where: { id: buyerId } });
    await app.close();
  });

  describe('/marketplace/listings (GET)', () => {
    it('should return all listings', () => {
      return request(app.getHttpServer())
        .get('/api/v1/marketplace/listings')
        .set('Authorization', `Bearer ${farmerToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('/marketplace/listings (POST)', () => {
    it('should create a listing', () => {
      const listingData = {
        variety: 'Kenya',
        quantity: 100,
        qualityGrade: 'A',
        pricePerKg: 50,
        county: 'Nairobi',
        harvestDate: new Date().toISOString(),
      };

      return request(app.getHttpServer())
        .post('/api/v1/marketplace/listings')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send(listingData)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.variety).toBe(listingData.variety);
        });
    });
  });

  describe('/marketplace/orders (POST)', () => {
    it('should create an order', async () => {
      // First create a listing
      const listing = await prisma.produceListing.create({
        data: {
          farmerId,
          variety: 'Kenya',
          quantity: 100,
          availableQuantity: 100,
          pricePerKg: 50,
          qualityGrade: 'A',
          harvestDate: new Date(),
          county: 'Nairobi',
          subCounty: 'Westlands',
          location: 'Parklands',
          photos: [],
          status: 'ACTIVE',
        },
      });

      const orderData = {
        farmerId,
        variety: 'Kenya',
        quantity: 50,
        qualityGrade: 'A',
        pricePerKg: 50,
        deliveryAddress: '123 Main St',
        deliveryCounty: 'Nairobi',
      };

      return request(app.getHttpServer())
        .post('/api/v1/marketplace/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send(orderData)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('orderNumber');
        });
    });
  });

  describe('/marketplace/rfqs (POST)', () => {
    it('should create an RFQ', () => {
      const rfqData = {
        variety: 'Kenya',
        quantity: 100,
        qualityGrade: 'A',
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        deliveryLocation: 'Nairobi',
        description: 'Need fresh OFSP',
        quoteDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      };

      return request(app.getHttpServer())
        .post('/api/v1/marketplace/rfqs')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send(rfqData)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('rfqNumber');
        });
    });
  });

  describe('/marketplace/stats (GET)', () => {
    it('should return marketplace statistics', () => {
      return request(app.getHttpServer())
        .get('/api/v1/marketplace/stats')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalListings');
          expect(res.body).toHaveProperty('totalOrders');
          expect(res.body).toHaveProperty('totalRFQs');
        });
    });
  });
});
