import { PrismaService } from '../modules/prisma/prisma.service';

/**
 * Test utilities for mocking Prisma and common test helpers
 */

export const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  profile: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  rating: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  produceListing: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  marketplaceOrder: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  rFQ: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  rFQResponse: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  sourcingRequest: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  supplierOffer: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  negotiation: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  negotiationMessage: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
} as unknown as jest.Mocked<PrismaService>;

export const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'FARMER',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockProfile = {
  id: 'profile-1',
  userId: 'user-1',
  firstName: 'John',
  lastName: 'Doe',
  county: 'Nairobi',
  subCounty: 'Westlands',
  ward: 'Parklands',
  rating: 4.5,
  totalRatings: 10,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: mockUser,
};

export const mockRating = {
  id: 'rating-1',
  raterId: 'user-2',
  ratedUserId: 'user-1',
  rating: 5,
  review: 'Great farmer!',
  orderId: null,
  createdAt: new Date(),
  rater: {
    id: 'user-2',
    email: 'buyer@example.com',
    profile: {
      firstName: 'Jane',
      lastName: 'Buyer',
    },
  },
  ratedUser: {
    id: 'user-1',
    email: 'test@example.com',
    profile: {
      firstName: 'John',
      lastName: 'Doe',
    },
  },
};

export const mockListing = {
  id: 'listing-1',
  farmerId: 'user-1',
  variety: 'Kenya',
  quantity: 100,
  availableQuantity: 80,
  pricePerKg: 50,
  qualityGrade: 'A',
  harvestDate: new Date(),
  county: 'Nairobi',
  subCounty: 'Westlands',
  location: 'Parklands',
  description: 'Fresh OFSP',
  photos: [],
  status: 'ACTIVE',
  batchId: 'BATCH-001',
  createdAt: new Date(),
  updatedAt: new Date(),
  farmer: {
    ...mockUser,
    profile: mockProfile,
  },
};

export const mockOrder = {
  id: 'order-1',
  orderNumber: 'ORD-20250121-000001',
  buyerId: 'user-2',
  farmerId: 'user-1',
  listingId: 'listing-1',
  variety: 'Kenya',
  quantity: 50,
  pricePerKg: 50,
  totalAmount: 2500,
  status: 'ORDER_PLACED',
  paymentStatus: 'PENDING',
  deliveryAddress: '123 Main St',
  deliveryCounty: 'Nairobi',
  deliveryNotes: 'Please deliver in the morning',
  photos: [],
  notes: null,
  placedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  buyer: {
    id: 'user-2',
    email: 'buyer@example.com',
    profile: {
      firstName: 'Jane',
      lastName: 'Buyer',
    },
  },
  farmer: {
    ...mockUser,
    profile: mockProfile,
  },
  listing: mockListing,
};

export const mockRFQ = {
  id: 'rfq-1',
  rfqNumber: 'RFQ-20250121-000001',
  buyerId: 'user-2',
  title: 'RFQ for OFSP',
  productType: 'OFSP',
  variety: 'Kenya',
  quantity: 100,
  unit: 'kg',
  qualityGrade: 'A',
  deadline: new Date(),
  quoteDeadline: new Date(),
  deliveryLocation: 'Nairobi',
  status: 'PUBLISHED',
  totalResponses: 0,
  awardedTo: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  buyer: {
    id: 'user-2',
    email: 'buyer@example.com',
    profile: {
      firstName: 'Jane',
      lastName: 'Buyer',
    },
  },
};

export const mockRFQResponse = {
  id: 'rfq-response-1',
  rfqId: 'rfq-1',
  supplierId: 'user-1',
  quantity: 100,
  quantityUnit: 'kg',
  pricePerUnit: 50,
  priceUnit: 'kg',
  totalAmount: 5000,
  qualityGrade: 'A',
  status: 'DRAFT',
  createdAt: new Date(),
  updatedAt: new Date(),
  rfq: mockRFQ,
  supplier: {
    ...mockUser,
    profile: mockProfile,
  },
};

export const mockSourcingRequest = {
  id: 'sourcing-1',
  requestId: 'SR-20250121-000001',
  buyerId: 'user-2',
  title: 'Sourcing Request for OFSP',
  productType: 'OFSP',
  variety: 'Kenya',
  quantity: 200,
  unit: 'kg',
  qualityGrade: 'A',
  deadline: new Date(),
  deliveryRegion: 'Nairobi',
  status: 'DRAFT',
  suppliers: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  buyer: {
    id: 'user-2',
    email: 'buyer@example.com',
    profile: {
      firstName: 'Jane',
      lastName: 'Buyer',
    },
  },
};

export const mockSupplierOffer = {
  id: 'offer-1',
  sourcingRequestId: 'sourcing-1',
  farmerId: 'user-1',
  quantity: 200,
  quantityUnit: 'kg',
  pricePerKg: 50,
  qualityGrade: 'A',
  status: 'pending',
  createdAt: new Date(),
  updatedAt: new Date(),
  sourcingRequest: mockSourcingRequest,
  farmer: {
    ...mockUser,
    profile: mockProfile,
  },
};

export const mockNegotiation = {
  id: 'negotiation-1',
  negotiationNumber: 'NEG-20250121-000001',
  listingId: 'listing-1',
  buyerId: 'user-2',
  farmerId: 'user-1',
  originalPricePerKg: 50,
  originalQuantity: 100,
  negotiatedPricePerKg: 45,
  negotiatedQuantity: 80,
  status: 'PENDING',
  createdAt: new Date(),
  updatedAt: new Date(),
  listing: mockListing,
  buyer: {
    id: 'user-2',
    email: 'buyer@example.com',
    profile: {
      firstName: 'Jane',
      lastName: 'Buyer',
    },
  },
  messages: [],
};

export const mockNegotiationMessage = {
  id: 'message-1',
  negotiationId: 'negotiation-1',
  senderId: 'user-2',
  senderType: 'buyer',
  message: 'Can we negotiate the price?',
  pricePerKg: 45,
  quantity: 80,
  isCounterOffer: true,
  createdAt: new Date(),
};
