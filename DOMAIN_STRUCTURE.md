# Domain-Based Backend Structure

**NestJS backend organized by domain boundaries from frontend contexts and services**

---

## Overview

The backend is organized into **domain modules** that align with the frontend's context and service structure. Each domain module contains:
- **Module** - NestJS module definition
- **Controller** - REST API endpoints
- **Service** - Business logic and database operations
- **DTOs** - Data Transfer Objects for validation

---

## Domain Modules

### ✅ Completed Modules

#### 1. **Auth Module** (`modules/auth/`)
- Authentication and authorization
- JWT strategy
- Local strategy
- Login, register, refresh token

#### 2. **Users Module** (`modules/users/`)
- User management
- Basic CRUD operations

#### 3. **Profile Module** (`modules/profile/`)
- User profiles
- Profile CRUD
- Ratings and reviews
- Rating summaries
- **Endpoints:**
  - `GET /profiles` - List profiles
  - `GET /profiles/:id` - Get profile
  - `GET /profiles/farmers` - List farmers
  - `GET /profiles/buyers` - List buyers
  - `PUT /profiles/:id` - Update profile
  - `GET /profiles/:id/ratings` - Get ratings
  - `GET /profiles/:id/ratings/summary` - Get rating summary
  - `POST /profiles/:id/ratings` - Create rating

#### 4. **Marketplace Module** (`modules/marketplace/`)
- Produce listings
- Marketplace orders
- RFQs (Request for Quotations)
- RFQ responses
- Sourcing requests
- Supplier offers
- Negotiations
- Negotiation messages
- **Endpoints:**
  - **Listings:**
    - `GET /marketplace/listings` - List produce listings
    - `GET /marketplace/listings/:id` - Get listing
    - `POST /marketplace/listings` - Create listing
    - `PUT /marketplace/listings/:id` - Update listing
    - `DELETE /marketplace/listings/:id` - Delete listing
  - **Orders:**
    - `GET /marketplace/orders` - List orders
    - `GET /marketplace/orders/:id` - Get order
    - `POST /marketplace/orders` - Create order
    - `PUT /marketplace/orders/:id/status` - Update order status
  - **RFQs:**
    - `GET /marketplace/rfqs` - List RFQs
    - `GET /marketplace/rfqs/:id` - Get RFQ
    - `POST /marketplace/rfqs` - Create RFQ
    - `PUT /marketplace/rfqs/:id` - Update RFQ
    - `PUT /marketplace/rfqs/:id/publish` - Publish RFQ
    - `PUT /marketplace/rfqs/:id/close` - Close RFQ
  - **RFQ Responses:**
    - `GET /marketplace/rfqs/:rfqId/responses` - List responses
    - `GET /marketplace/rfq-responses/:id` - Get response
    - `POST /marketplace/rfqs/:rfqId/responses` - Submit response
    - `PUT /marketplace/rfq-responses/:id/status` - Update response status
    - `PUT /marketplace/rfqs/:rfqId/award/:responseId` - Award RFQ
  - **Sourcing Requests:**
    - `GET /marketplace/sourcing-requests` - List requests
    - `GET /marketplace/sourcing-requests/:id` - Get request
    - `POST /marketplace/sourcing-requests` - Create request
    - `POST /marketplace/sourcing-requests/:requestId/offers` - Submit offer
    - `PUT /marketplace/supplier-offers/:id/accept` - Accept offer
  - **Negotiations:**
    - `GET /marketplace/negotiations` - List negotiations
    - `GET /marketplace/negotiations/:id` - Get negotiation
    - `POST /marketplace/negotiations` - Initiate negotiation
    - `POST /marketplace/negotiations/:id/messages` - Send message
    - `PUT /marketplace/negotiations/:id/accept` - Accept negotiation
    - `PUT /marketplace/negotiations/:id/reject` - Reject negotiation
  - **Statistics:**
    - `GET /marketplace/stats` - Get marketplace statistics

---

### 🚧 Pending Modules

#### 5. **Input Module** (`modules/input/`)
**Frontend Context:** `InputContext`
**Frontend Service:** `inputService.ts`

**Features:**
- Input products catalog
- Input orders
- Stock management

**Endpoints to implement:**
- `GET /inputs` - List input products
- `GET /inputs/:id` - Get input product
- `POST /inputs` - Create input product
- `PUT /inputs/:id` - Update input product
- `DELETE /inputs/:id` - Delete input product
- `GET /inputs/orders` - List input orders
- `GET /inputs/orders/:id` - Get input order
- `POST /inputs/orders` - Create input order
- `PUT /inputs/orders/:id/status` - Update order status
- `GET /inputs/stats` - Get input statistics

---

#### 6. **Input Customer Module** (`modules/input-customer/`)
**Frontend Context:** `InputCustomerContext`
**Frontend Service:** `inputCustomerService.ts`

**Features:**
- Input customer management
- Customer order history

**Endpoints to implement:**
- `GET /input-customers` - List customers
- `GET /input-customers/:id` - Get customer
- `POST /input-customers` - Create customer
- `PUT /input-customers/:id` - Update customer
- `GET /input-customers/:id/orders` - Get customer order history
- `GET /input-customers/stats` - Get customer statistics

---

#### 7. **Transport Module** (`modules/transport/`)
**Frontend Context:** `TransportContext`
**Frontend Service:** `transportService.ts`

**Features:**
- Transport requests
- Pickup schedules
- Pickup slots
- Pickup bookings
- Tracking updates

**Endpoints to implement:**
- `GET /transport/requests` - List transport requests
- `GET /transport/requests/:id` - Get transport request
- `POST /transport/requests` - Create transport request
- `PUT /transport/requests/:id/status` - Update request status
- `GET /transport/pickup-schedules` - List pickup schedules
- `GET /transport/pickup-schedules/:id` - Get schedule
- `POST /transport/pickup-schedules` - Create schedule
- `GET /transport/pickup-slots` - List pickup slots
- `POST /transport/pickup-slots/:id/book` - Book slot
- `GET /transport/tracking/:requestId` - Get tracking updates
- `POST /transport/tracking/:requestId` - Add tracking update

---

#### 8. **Aggregation Module** (`modules/aggregation/`)
**Frontend Context:** `AggregationContext`
**Frontend Service:** `aggregationService.ts`

**Features:**
- Aggregation centers
- Stock transactions
- Inventory management
- Quality checks
- Wastage tracking

**Endpoints to implement:**
- `GET /aggregation/centers` - List centers
- `GET /aggregation/centers/:id` - Get center
- `POST /aggregation/centers` - Create center
- `PUT /aggregation/centers/:id` - Update center
- `GET /aggregation/centers/:id/inventory` - Get center inventory
- `GET /aggregation/transactions` - List stock transactions
- `POST /aggregation/transactions/stock-in` - Record stock in
- `POST /aggregation/transactions/stock-out` - Record stock out
- `GET /aggregation/quality-checks` - List quality checks
- `POST /aggregation/quality-checks` - Create quality check
- `GET /aggregation/wastage` - List wastage entries
- `POST /aggregation/wastage` - Record wastage
- `GET /aggregation/stats` - Get aggregation statistics

---

#### 9. **Payment Module** (`modules/payment/`)
**Frontend Context:** `PaymentContext`
**Frontend Service:** `paymentService.ts`

**Features:**
- Payment processing
- Escrow management
- Payment history

**Endpoints to implement:**
- `GET /payments` - List payments
- `GET /payments/:id` - Get payment
- `POST /payments` - Create payment
- `PUT /payments/:id/status` - Update payment status
- `GET /payments/escrow` - List escrow transactions
- `GET /payments/escrow/:id` - Get escrow transaction
- `PUT /payments/escrow/:id/release` - Release escrow
- `PUT /payments/escrow/:id/dispute` - Dispute escrow
- `GET /payments/history` - Get payment history

---

#### 10. **Notification Module** (`modules/notification/`)
**Frontend Context:** `NotificationContext`
**Frontend Service:** `notificationService.ts`

**Features:**
- User notifications
- Notification preferences
- Mark as read/unread

**Endpoints to implement:**
- `GET /notifications` - List notifications
- `GET /notifications/:id` - Get notification
- `PUT /notifications/:id/read` - Mark as read
- `PUT /notifications/:id/unread` - Mark as unread
- `PUT /notifications/read-all` - Mark all as read
- `DELETE /notifications/:id` - Delete notification
- `GET /notifications/unread/count` - Get unread count

---

#### 11. **Analytics Module** (`modules/analytics/`)
**Frontend Context:** `AnalyticsContext`
**Frontend Service:** `analyticsService.ts`

**Features:**
- Dashboard statistics
- Performance metrics
- Reports

**Endpoints to implement:**
- `GET /analytics/dashboard` - Get dashboard stats
- `GET /analytics/farmer-performance` - Get farmer performance
- `GET /analytics/buyer-performance` - Get buyer performance
- `GET /analytics/center-stock-summary` - Get center stock summary
- `GET /analytics/reports` - Generate reports

---

#### 12. **Staff Module** (`modules/staff/`)
**Frontend Context:** `StaffContext`
**Frontend Service:** `staffService.ts`

**Features:**
- Staff user management
- Activity logs
- Data quality monitoring
- Partner management
- System settings

**Endpoints to implement:**
- `GET /staff/users` - List staff users
- `POST /staff/users` - Create staff user
- `PUT /staff/users/:id` - Update staff user
- `GET /staff/activity-logs` - List activity logs
- `GET /staff/data-quality` - Get data quality metrics
- `GET /staff/partners` - List partners
- `POST /staff/partners` - Create partner
- `GET /staff/settings` - Get system settings
- `PUT /staff/settings` - Update system settings

---

## Module Structure

Each domain module follows this structure:

```
modules/
└── {domain}/
    ├── {domain}.module.ts       # Module definition
    ├── {domain}.controller.ts   # REST API endpoints
    ├── {domain}.service.ts      # Business logic
    └── dto/
        ├── index.ts             # DTO exports
        ├── create-*.dto.ts      # Create DTOs
        ├── update-*.dto.ts      # Update DTOs
        └── ...                  # Other DTOs
```

---

## Common/Shared Modules

### Prisma Module (`modules/prisma/`)
- Database connection
- Prisma service
- Used by all domain modules

### Common Utilities (`common/`)
- **Guards:**
  - `jwt-auth.guard.ts` - JWT authentication
  - `roles.guard.ts` - Role-based access control
- **Decorators:**
  - `current-user.decorator.ts` - Get current user
  - `roles.decorator.ts` - Role requirements
  - `public.decorator.ts` - Public endpoints
- **Filters:**
  - `http-exception.filter.ts` - HTTP exception handling
  - `prisma-exception.filter.ts` - Prisma exception handling
- **Interceptors:**
  - `transform.interceptor.ts` - Response transformation

---

## API Structure

### Base URL
- Development: `http://localhost:3000/api/v1`
- Production: Configured via `API_PREFIX` env variable

### Authentication
- All endpoints (except auth endpoints) require JWT Bearer token
- Token format: `Authorization: Bearer <token>`

### Response Format
All responses follow this structure:
```json
{
  "data": {...},
  "message": "Success message",
  "error": null
}
```

### Error Format
```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "Bad Request"
}
```

---

## Next Steps

1. ✅ **Profile Module** - Complete
2. ✅ **Marketplace Module** - Complete
3. 🚧 **Input Module** - To be implemented
4. 🚧 **Input Customer Module** - To be implemented
5. 🚧 **Transport Module** - To be implemented
6. 🚧 **Aggregation Module** - To be implemented
7. 🚧 **Payment Module** - To be implemented
8. 🚧 **Notification Module** - To be implemented
9. 🚧 **Analytics Module** - To be implemented
10. 🚧 **Staff Module** - To be implemented

---

## Implementation Guidelines

### 1. Follow Domain Boundaries
- Each module should be self-contained
- Dependencies should be explicit via module imports
- Services should not directly access other domain's Prisma models

### 2. Use DTOs for Validation
- All inputs should use DTOs with `class-validator`
- Use `@ApiProperty` for Swagger documentation
- Validate enums, numbers, strings, dates

### 3. Error Handling
- Use NestJS exceptions (`NotFoundException`, `BadRequestException`, etc.)
- Let global filters handle error formatting
- Return meaningful error messages

### 4. Authorization
- Use `@UseGuards(JwtAuthGuard)` on controllers
- Use `@Roles()` decorator for role-based access
- Check ownership in service methods

### 5. Database Functions
- Use Prisma's `$queryRaw` for custom SQL functions
- Example: `generate_order_number()`, `generate_rfq_number()`

### 6. Include Relations
- Use Prisma's `include` to fetch related data
- Avoid N+1 queries by including relations upfront

---

**Status:** 2 of 12 domain modules completed (Profile, Marketplace)
