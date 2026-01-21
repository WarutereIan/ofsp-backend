# Jirani OFSP Platform - Backend API

**NestJS-based backend API for the Orange Fleshed Sweet Potato (OFSP) Value Chain Platform**

## 📋 Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Database Setup](#database-setup)
- [Authentication & Authorization](#authentication--authorization)
- [API Documentation](#api-documentation)
- [Module Overview](#module-overview)
- [Development](#development)

---

## 🛠 Tech Stack

- **Framework**: NestJS (v11.x)
- **ORM**: Prisma (v6.x)
- **Database**: PostgreSQL
- **Authentication**: Passport + JWT
- **Authorization**: RBAC (Role-Based Access Control)
- **Validation**: class-validator + class-transformer
- **Documentation**: Swagger/OpenAPI
- **Security**: Helmet, Rate Limiting (Throttler)

---

## 📁 Project Structure

```
src/
├── common/                    # Shared utilities
│   ├── decorators/           # Custom decorators (@Roles, @CurrentUser, @Public)
│   ├── filters/              # Exception filters (HTTP, Prisma)
│   ├── guards/               # Auth guards (JWT, Roles)
│   ├── interceptors/         # Response transformation
│   └── pipes/                # Validation pipes
│
├── modules/
│   ├── prisma/               # Database module (Global)
│   ├── auth/                 # Authentication module
│   │   ├── strategies/       # Passport strategies (JWT, Local)
│   │   ├── dto/              # DTOs (Register, Login)
│   │   ├── auth.service.ts
│   │   └── auth.controller.ts
│   │
│   ├── users/                # User management
│   ├── marketplace/          # Marketplace & orders
│   ├── transport/            # Transport & logistics
│   ├── aggregation/          # Aggregation centers & storage
│   ├── payments/             # Payments & escrow
│   └── notifications/        # Notifications
│
├── app.module.ts             # Root module
└── main.ts                   # Application bootstrap
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn
- PostgreSQL (v14+)

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configurations
```

### Environment Variables

Create a `.env` file in the backend root:

```env
# Application
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/jirani_ofsp?schema=public"

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRATION=7d
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
JWT_REFRESH_EXPIRATION=30d

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

---

## 🗄️ Database Setup

### 1. Initialize Prisma

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Seed database
npm run prisma:seed

# (Optional) Open Prisma Studio
npm run prisma:studio
```

### 2. Database Schema Overview

**Core Entities:**
- `User` + `Profile` - User accounts and profiles
- `RefreshToken` - JWT refresh tokens
- `ProduceListing` - Farmer produce listings
- `MarketplaceOrder` - Buyer orders
- `TransportRequest` - Transport requests
- `AggregationCenter` - Storage centers
- `StockTransaction` - Stock in/out transactions
- `InventoryItem` - Storage inventory
- `QualityCheck` - Quality assessments (with grading matrix)
- `Payment` + `EscrowTransaction` - Payment processing
- `Notification` + `ActivityLog` - System notifications & audit logs

**User Roles:**
- `FARMER` - Produce sellers
- `BUYER` - Produce buyers
- `TRANSPORT_PROVIDER` - Logistics providers
- `AGGREGATION_MANAGER` - Storage managers
- `INPUT_PROVIDER` - Input suppliers
- `EXTENSION_OFFICER` - Agricultural extension officers
- `ADMIN` / `STAFF` - System administrators

---

## 🔐 Authentication & Authorization

### Authentication Flow

1. **Register**: `POST /api/v1/auth/register`
   - Creates user with hashed password
   - Returns access + refresh tokens

2. **Login**: `POST /api/v1/auth/login`
   - Validates credentials
   - Returns access + refresh tokens

3. **Refresh**: `POST /api/v1/auth/refresh`
   - Exchanges refresh token for new tokens

4. **Logout**: `POST /api/v1/auth/logout`
   - Invalidates refresh tokens

### Authorization (RBAC)

**Protecting Routes:**

```typescript
// Public route (no auth required)
@Public()
@Get('public-endpoint')
async publicEndpoint() {}

// Protected route (auth required)
@Get('protected-endpoint')
async protectedEndpoint(@CurrentUser() user) {}

// Role-based protection
@Roles(UserRole.FARMER, UserRole.ADMIN)
@Get('farmer-only')
async farmerOnlyEndpoint() {}
```

**Decorators:**
- `@Public()` - Bypass JWT auth
- `@Roles(...roles)` - Require specific roles
- `@CurrentUser()` - Inject authenticated user

---

## 📚 API Documentation

### Swagger UI

After starting the server, access interactive API docs:

```
http://localhost:3000/api/docs
```

Features:
- Interactive API testing
- Request/response schemas
- Authentication (Bearer token)
- Auto-generated from decorators

### Example Requests

**Register a Farmer:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "farmer@example.com",
    "phone": "+254712345678",
    "password": "SecurePass123!",
    "role": "FARMER",
    "profile": {
      "firstName": "John",
      "lastName": "Doe",
      "county": "Nairobi",
      "ward": "Dagoretti North"
    }
  }'
```

**Login:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "farmer@example.com",
    "password": "SecurePass123!"
  }'
```

**Get Profile (Authenticated):**
```bash
curl -X GET http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer <your-access-token>"
```

---

## 🧩 Module Overview

### Current Modules

1. **Auth Module** (`/auth`)
   - User registration & login
   - JWT token management
   - Refresh token handling

2. **Users Module** (`/users`)
   - Profile management
   - User lookup (admin)

### Planned Modules

3. **Marketplace Module** (`/marketplace`)
   - Produce listings (CRUD)
   - Orders (create, accept, track)
   - RFQs & sourcing requests
   - Negotiations

4. **Transport Module** (`/transport`)
   - Transport requests (create, accept)
   - Delivery tracking
   - Route optimization
   - Pickup schedules

5. **Aggregation Module** (`/aggregation`)
   - Stock in/out operations
   - Quality checks (with grading matrix)
   - Inventory management
   - Wastage tracking

6. **Payments Module** (`/payments`)
   - Payment processing
   - Escrow management
   - Transaction history

7. **Notifications Module** (`/notifications`)
   - Push notifications
   - Email notifications
   - SMS notifications
   - Activity logs

---

## 👨‍💻 Development

### Running the App

```bash
# Development (with hot-reload)
npm run start:dev

# Production
npm run start:prod

# Debug mode
npm run start:debug
```

### Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

### Code Quality

```bash
# Linting
npm run lint

# Format code
npm run format
```

---

## 🔒 Security Features

1. **Password Hashing**: bcrypt (10 rounds)
2. **JWT Tokens**: Access (7d) + Refresh (30d) tokens
3. **Rate Limiting**: 100 requests per minute
4. **Helmet**: Security headers
5. **CORS**: Configurable origins
6. **Validation**: Input sanitization
7. **RBAC**: Role-based access control

---

## 📖 Next Steps

1. **Complete Feature Modules:**
   - Marketplace module (listings, orders)
   - Transport module (requests, tracking)
   - Aggregation module (stock, quality)
   - Payments module (escrow, transactions)
   - Notifications module

2. **Advanced Features:**
   - File upload (photos, documents)
   - Real-time updates (WebSockets)
   - Batch operations
   - Advanced filtering & pagination
   - Audit logging
   - Email/SMS notifications

3. **Testing & Deployment:**
   - Unit tests for all services
   - E2E tests for critical flows
   - Docker configuration
   - CI/CD pipeline
   - Production deployment

---

## 📝 API Response Format

**Success Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "data": { ... },
  "timestamp": "2025-01-21T12:00:00.000Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Error message",
  "timestamp": "2025-01-21T12:00:00.000Z"
}
```

---

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Submit a pull request

---

## 📄 License

UNLICENSED - Private Project

---

**For questions or support, contact the development team.**
