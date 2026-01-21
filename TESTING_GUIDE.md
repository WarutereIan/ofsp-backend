# Testing Guide

**Comprehensive testing strategy for the OFSP Platform backend**

---

## Overview

The backend uses **Jest** for unit and integration tests, and **Supertest** for E2E tests. Tests are organized by module, following NestJS testing best practices.

---

## Test Structure

```
src/
├── modules/
│   ├── profile/
│   │   ├── profile.controller.spec.ts    # Controller unit tests
│   │   └── profile.service.spec.ts        # Service unit tests
│   └── marketplace/
│       ├── marketplace.controller.spec.ts
│       └── marketplace.service.spec.ts
├── test/
│   └── test-utils.ts                       # Shared test utilities and mocks
└── test/
    ├── profile.e2e-spec.ts                 # E2E tests
    └── marketplace.e2e-spec.ts
```

---

## Test Types

### 1. Unit Tests (`.spec.ts`)

**Location:** Same directory as the file being tested

**Purpose:**
- Test individual methods in isolation
- Mock all dependencies
- Fast execution
- High coverage

**Example:**
```typescript
describe('ProfileService', () => {
  let service: ProfileService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
    prisma = module.get(PrismaService);
  });

  it('should return a profile when found', async () => {
    prisma.profile.findUnique.mockResolvedValue(mockProfile);
    const result = await service.findById('user-1');
    expect(result).toEqual(mockProfile);
  });
});
```

---

### 2. E2E Tests (`.e2e-spec.ts`)

**Location:** `test/` directory

**Purpose:**
- Test complete request/response cycle
- Test authentication and authorization
- Test database interactions
- Test API contracts

**Example:**
```typescript
describe('ProfileController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
  });

  it('/profiles (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/profiles')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
```

---

## Test Utilities

### Mock Prisma Service

Located in `src/test/test-utils.ts`:

```typescript
export const mockPrismaService = {
  profile: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  // ... other models
} as unknown as jest.Mocked<PrismaService>;
```

### Mock Data

Pre-defined mock objects for consistent testing:

- `mockUser` - Sample user
- `mockProfile` - Sample profile
- `mockRating` - Sample rating
- `mockListing` - Sample produce listing
- `mockOrder` - Sample marketplace order
- `mockRFQ` - Sample RFQ
- etc.

---

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage
```bash
npm run test:cov
```

### Run E2E Tests
```bash
npm run test:e2e
```

### Run Specific Test File
```bash
npm test -- profile.service.spec.ts
```

---

## Test Coverage Goals

- **Unit Tests:** 80%+ coverage
- **Service Methods:** 100% coverage
- **Controller Endpoints:** All endpoints tested
- **E2E Tests:** Critical user flows

---

## Testing Best Practices

### 1. Arrange-Act-Assert Pattern

```typescript
it('should create a listing', async () => {
  // Arrange
  const listingData = { variety: 'Kenya', quantity: 100, ... };
  prisma.produceListing.create.mockResolvedValue(mockListing);

  // Act
  const result = await service.createListing(listingData, 'user-1');

  // Assert
  expect(result).toEqual(mockListing);
  expect(prisma.produceListing.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ variety: 'Kenya' }),
  });
});
```

### 2. Test Error Cases

```typescript
it('should throw NotFoundException when profile not found', async () => {
  prisma.profile.findUnique.mockResolvedValue(null);
  await expect(service.findById('non-existent')).rejects.toThrow(
    NotFoundException,
  );
});
```

### 3. Test Authorization

```typescript
it('should throw error when user tries to update another profile', async () => {
  await expect(
    service.updateListing('listing-1', {}, 'unauthorized-user'),
  ).rejects.toThrow(BadRequestException);
});
```

### 4. Mock External Dependencies

Always mock:
- Database (Prisma)
- External APIs
- File system operations
- HTTP requests

### 5. Clean Up After Tests

```typescript
afterEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: testUserId } });
  await app.close();
});
```

---

## Test Checklist for Each Module

When creating tests for a new module, ensure:

- [ ] Service unit tests cover all methods
- [ ] Controller unit tests cover all endpoints
- [ ] Error cases are tested (404, 400, 401, 403)
- [ ] Authorization is tested
- [ ] Validation is tested
- [ ] E2E tests for critical flows
- [ ] Mock data is realistic
- [ ] Tests are independent (no shared state)
- [ ] Tests clean up after themselves

---

## Current Test Status

### ✅ Completed

- **Profile Module:**
  - ✅ `profile.service.spec.ts` - Service unit tests
  - ✅ `profile.controller.spec.ts` - Controller unit tests
  - ✅ `profile.e2e-spec.ts` - E2E tests

- **Marketplace Module:**
  - ✅ `marketplace.service.spec.ts` - Service unit tests
  - ✅ `marketplace.controller.spec.ts` - Controller unit tests
  - ✅ `marketplace.e2e-spec.ts` - E2E tests

### 🚧 Pending

- Auth module tests
- Input module tests
- Transport module tests
- Aggregation module tests
- Payment module tests
- Notification module tests
- Analytics module tests
- Staff module tests

---

## Test Utilities Created

1. **`test-utils.ts`** - Mock Prisma service and mock data objects
2. **`e2e-helpers.ts`** - E2E test helpers (createTestApp, getAuthToken, etc.)

---

## Example Test Scenarios

### Profile Service Tests

- ✅ Find profile by ID (success)
- ✅ Find profile by ID (not found)
- ✅ Find all profiles (no filters)
- ✅ Find all profiles (with filters)
- ✅ Update profile (success)
- ✅ Get rating summary
- ✅ Get ratings with filters
- ✅ Create rating

### Marketplace Service Tests

- ✅ Get listings (all, filtered)
- ✅ Get listing by ID
- ✅ Create listing
- ✅ Update listing (authorized)
- ✅ Update listing (unauthorized)
- ✅ Delete listing
- ✅ Create order
- ✅ Update order status
- ✅ Create RFQ
- ✅ Submit RFQ response
- ✅ Award RFQ
- ✅ Create sourcing request
- ✅ Submit supplier offer
- ✅ Initiate negotiation
- ✅ Send negotiation message
- ✅ Get marketplace stats

---

## Running Tests in CI/CD

Add to your CI pipeline:

```yaml
- name: Run tests
  run: npm test

- name: Run E2E tests
  run: npm run test:e2e

- name: Generate coverage
  run: npm run test:cov
```

---

**Status:** ✅ Test infrastructure set up. Profile and Marketplace modules have comprehensive tests.
