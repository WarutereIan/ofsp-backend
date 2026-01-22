# Backend Updates Needed for Frontend UX

This document tracks backend API endpoints and features needed to fully support the frontend UX requirements.

## ✅ Completed Updates

### Authentication
- ✅ **Phone number login support** - Updated `LoginDto` and `AuthService` to accept either email or phone for login

### Marketplace Service - RFQ Lifecycle
- ✅ **Recurring Orders CRUD** - Full implementation of recurring orders endpoints
  - GET /api/v1/marketplace/recurring-orders
  - GET /api/v1/marketplace/recurring-orders/:id
  - POST /api/v1/marketplace/recurring-orders
  - PUT /api/v1/marketplace/recurring-orders/:id
  - DELETE /api/v1/marketplace/recurring-orders/:id

- ✅ **RFQ Lifecycle Completion** - All lifecycle stages from ENTITY_LIFECYCLE_MAPPING.md implemented:
  1. ✅ RFQ Created (draft) - `createRFQ` with notifications
  2. ✅ RFQ Published - `publishRFQ` with notifications to buyer and all suppliers
  3. ✅ RFQ Response Submitted - `submitRFQResponse` with notifications
  4. ✅ RFQ Response Under Review - `updateRFQResponseStatus` with UNDER_REVIEW
  5. ✅ RFQ Response Shortlisted - `updateRFQResponseStatus` with SHORTLISTED + notifications
  6. ✅ RFQ Response Awarded - `awardRFQ` with notifications to buyer, awarded supplier, and other suppliers
  7. ✅ RFQ Response Converted to Order - `convertRFQResponseToOrder` with order creation
  8. ✅ RFQ Closed - `closeRFQ` with notifications to buyer and all suppliers
  9. ✅ RFQ Cancelled - `cancelRFQ` (new) with notifications and response withdrawal
  10. ✅ RFQ Evaluating Status - `setRFQEvaluating` for status transition

- ✅ **Enhanced RFQ Response Status Handling**
  - Proper status transitions: SUBMITTED → UNDER_REVIEW → SHORTLISTED → AWARDED/REJECTED
  - Notifications for shortlisted and rejected responses
  - Activity logs for all status changes

---

## 🔴 Critical Updates Needed

### 1. Profile Service
- ❌ **GET /api/v1/profiles/stats** - Get profile statistics (total, active, verified, byRole breakdown)
  - Frontend expects: `ProfileStats` with counts by role and status
  - Priority: Medium

### 2. Notification Service
- ❌ **PUT /api/v1/notifications/:id/archive** - Archive notification functionality
  - Frontend expects: Ability to archive notifications
  - Priority: Low (currently falls back to marking as read)

- ❌ **GET /api/v1/alerts** - List alerts endpoint
- ❌ **PUT /api/v1/alerts/:id/acknowledge** - Acknowledge alert
  - Frontend expects: Separate alerts system from notifications
  - Priority: Low

### 3. Marketplace Service
- ✅ **PUT /api/v1/marketplace/sourcing-requests/:id** - Update sourcing request
 - Frontend expects: Ability to update sourcing requests
 - Priority: Medium
 - Status: Implemented - Only allows updates when status is DRAFT (per lifecycle requirements)

- ✅ **POST /api/v1/marketplace/negotiations/:id/convert-to-order** - Convert negotiation to order
  - Status: Already implemented via createOrder with negotiationId parameter
  - Note: Frontend service may need to be updated to use this properly

- ✅ **PUT /api/v1/marketplace/rfqs/:id/cancel** - Cancel RFQ endpoint
  - Status: Implemented - cancels RFQ and marks all responses as withdrawn
  - Includes notifications to buyer and all suppliers

- ✅ **POST /api/v1/marketplace/rfqs/:rfqId/responses/:responseId/convert-to-order** - Convert RFQ response to order
  - Status: Implemented - creates marketplace order from awarded RFQ response
  - Includes notifications and activity logs

- ✅ **PUT /api/v1/marketplace/rfqs/:id/evaluating** - Set RFQ to evaluating status
  - Status: Implemented - transitions RFQ from published to evaluating

- ✅ **RFQ Response Status Handling** - Enhanced status transitions
  - Status: Implemented - supports UNDER_REVIEW, SHORTLISTED, AWARDED, REJECTED, WITHDRAWN
  - Includes proper notifications for shortlisted and rejected statuses
  - Note: RFQResponse model has `evaluatedAt` but could benefit from `reviewedAt`, `shortlistedAt`, `rejectedAt` for better tracking (optional enhancement)

- ✅ **Recurring Orders** - Full recurring orders system
  - ✅ GET /api/v1/marketplace/recurring-orders
  - ✅ POST /api/v1/marketplace/recurring-orders
  - ✅ PUT /api/v1/marketplace/recurring-orders/:id
  - ✅ DELETE /api/v1/marketplace/recurring-orders/:id
  - Status: Implemented in marketplace service and controller

### 4. Transport Service
- ✅ **PUT /api/v1/transport/requests/:id/reject** - Reject transport request
  - Frontend expects: Explicit reject endpoint
  - Priority: Low (currently uses status update)
  - Status: Implemented - Wraps existing updateTransportRequestStatus service method

- ✅ **GET /api/v1/transport/deliveries** - List active deliveries
  - Frontend expects: Separate deliveries endpoint
  - Priority: Medium (currently filters transport requests)
  - Status: Implemented - Uses existing getTransportRequests service with active delivery status filter

- ✅ **PUT /api/v1/transport/pickup-schedules/:id/publish** - Publish pickup schedule
  - Frontend expects: Publish schedule functionality
  - Priority: Medium
  - Status: Implemented - Syncs with aggregation center capacity, sends notifications to farmers and provider

- ✅ **PUT /api/v1/transport/pickup-schedules/:id/cancel** - Cancel pickup schedule
  - Frontend expects: Cancel schedule functionality
  - Priority: Medium
  - Status: Implemented - Cancels all bookings, releases capacity, sends notifications

- ✅ **PUT /api/v1/transport/pickup-schedules/:id** - Update pickup schedule
  - Frontend expects: Update schedule functionality
  - Priority: Medium
  - Status: Implemented - Only allows updates when status is DRAFT (per lifecycle requirements)

- ✅ **DELETE /api/v1/transport/pickup-slots/bookings/:id** - Cancel pickup slot booking
  - Frontend expects: Cancel booking functionality
  - Priority: Medium
  - Status: Implemented - Releases capacity, sends notifications to farmer and provider

- ✅ **POST /api/v1/transport/pickup-slots/bookings/:id/confirm** - Confirm pickup and create batch
  - Frontend expects: Confirm pickup with batch creation, QR code generation
  - Priority: High
  - Status: Implemented - Creates batch ID, QR code, receipt, sends notifications to farmer, provider, and aggregation center manager

- ✅ **GET /api/v1/transport/receipts/:id** - Get pickup receipt by ID
- ✅ **GET /api/v1/transport/receipts?bookingId=...** - Get receipt by booking ID
  - Frontend expects: Receipt management system
  - Priority: Medium
  - Status: Implemented - Returns receipt with full booking and schedule details

- ✅ **GET /api/v1/transport/pickup-slots/bookings?farmerId=...** - Get farmer's pickup bookings
  - Frontend expects: List all bookings for a farmer
  - Priority: Medium
  - Status: Implemented - Supports filtering by status and scheduleId

### 5. Aggregation Service
- ❌ **GET /api/v1/aggregation/centers/:id/capacity** - Get aggregation center capacity
  - Frontend expects: Real-time capacity information
  - Priority: Medium

### 6. Payment Service
- ❌ **POST /api/v1/payments/:id/process** - Process payment endpoint
  - Frontend expects: Explicit payment processing
  - Priority: Low (currently uses status update)

---

## 🟡 Nice-to-Have Updates

### Analytics Service
- ❌ **Full analytics module** - Dashboard stats, trends, reports, leaderboards
  - Frontend expects: Comprehensive analytics system
  - Priority: Low (can use existing stats endpoints as fallback)

### Staff Service
- ❌ **Full staff/admin module** - Partners, activity logs, data quality, transaction evidence
  - Frontend expects: Admin management features
  - Priority: Low

### Input Customer Service
- ❌ **Dedicated input customer endpoints** - May be covered by `/api/v1/inputs/customers`
  - Frontend expects: Enhanced customer management
  - Priority: Low

---

## 🔴 Type/Interface Mismatches

These are critical type mismatches between backend responses and frontend expectations. The backend should transform data to match frontend types, or frontend services need transformation logic.

### 1. Notification Service

**Issue**: Backend uses different field names and enum formats than frontend expects.

- ✅ **`isRead` vs `status`**
  - Backend returns: `isRead: boolean`
  - Frontend handles: Frontend will transform `isRead` to `status` field (e.g., `isRead ? "read" : "unread"`)
  - **Resolution**: Frontend will handle the transformation; archived status not needed
  - Status: Resolved - Frontend will map boolean to status string

- ✅ **Notification `type` enum format**
  - Backend returns: `type: "ORDER" | "PAYMENT" | "TRANSPORT" | "RFQ" | "QUALITY_CHECK" | etc.` (UPPER_CASE)
  - Frontend expects: `type: "order" | "payment" | "transport" | "quality_check" | "system" | "alert"` (lowercase)
  - **Resolution**: Frontend transforms backend types to frontend format using `mapNotificationType()` function
  - **Mapping**: 
    - Direct: `ORDER` → `"order"`, `PAYMENT` → `"payment"`, `TRANSPORT` → `"transport"`, `QUALITY_CHECK` → `"quality_check"`
    - Order workflow: `RFQ`, `RFQ_RESPONSE`, `SOURCING_REQUEST`, `SUPPLIER_OFFER`, `NEGOTIATION` → `"order"`
    - Transport workflow: `PICKUP_SCHEDULE`, `PICKUP_BOOKING` → `"transport"`
  - Status: Resolved - Frontend handles transformation
  - See: `NOTIFICATION_TYPES_MAPPING.md` for complete list of 11 backend notification types

- ✅ **Notification `priority` enum format**
  - Backend returns: `priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"` (UPPER_CASE)
  - Frontend expects: `priority: "low" | "medium" | "high" | "urgent"` (lowercase)
  - **Resolution**: Frontend transforms backend priority to frontend format using `mapNotificationPriority()` function
  - Status: Resolved - Frontend handles transformation
  - Priority: **Medium**

### 2. Profile Service

**Issue**: Backend returns nested structure, frontend expects flat structure.

- ✅ **Nested `user` object**
  - Backend returns: `{ id, userId, name, ..., user: { id, email, role, ... } }`
  - Frontend expects: Flat structure with `id`, `userId`, `name`, `email`, `role`, etc. at root level
  - **Resolution**: Frontend flattens nested user object using `transformProfile()` function in profileService.ts
  - Status: Resolved - Frontend handles transformation

- ✅ **Role enum format**
  - Backend returns: `role: "FARMER" | "BUYER" | "INPUT_PROVIDER"` (UPPER_CASE with underscores)
  - Frontend expects: `role: "farmer" | "buyer" | "input_provider"` (lowercase with underscores)
  - **Resolution**: Frontend transforms backend role using `mapUserRole()` function in profileService.ts
  - Status: Resolved - Frontend handles transformation

- ✅ **Profile status format**
  - Backend returns: `status: "ACTIVE" | "INACTIVE" | "SUSPENDED"` (UPPER_CASE)
  - Frontend expects: `status: "active" | "inactive" | "pending" | "suspended"` (lowercase)
  - **Resolution**: Frontend transforms backend status using `mapProfileStatus()` function in profileService.ts (PENDING_VERIFICATION → pending)
  - Status: Resolved - Frontend handles transformation

### 3. Marketplace Service

**Issue**: Multiple enum format mismatches.

- ✅ **Order status enum format**
  - Backend returns: `status: "ORDER_PLACED" | "IN_TRANSIT" | "QUALITY_APPROVED"` (UPPER_CASE with underscores)
  - Frontend expects: `status: "order_placed" | "in_transit" | "quality_approved"` (lowercase with underscores)
  - **Resolution**: Frontend transforms backend status to frontend format using `mapOrderStatus()` function
  - Status: Resolved - Frontend handles transformation

- ✅ **Listing status enum**
  - Backend returns: `status: "ACTIVE" | "SOLD" | "INACTIVE" | "EXPIRED"`
  - Frontend expects: `status: "active" | "sold" | "inactive" | "pending"`
  - **Note**: Backend "EXPIRED" maps to frontend "pending"
  - **Resolution**: Frontend transforms backend status using `mapListingStatus()` function (EXPIRED → pending)
  - Status: Resolved - Frontend handles transformation

- ✅ **Payment status enum format**
  - Backend returns: `paymentStatus: "PENDING" | "SECURED" | "RELEASED"` (UPPER_CASE)
  - Frontend expects: `paymentStatus: "pending" | "secured" | "released"` (lowercase)
  - **Resolution**: Frontend transforms backend status using `mapPaymentStatus()` function
  - Status: Resolved - Frontend handles transformation

- ✅ **OFSP Variety enum format**
  - Backend returns: `variety: "KENYA" | "SPK004" | "KAKAMEGA"` (UPPER_CASE)
  - Frontend expects: `variety: "Kenya" | "SPK004" | "Kakamega"` (Title Case)
  - **Resolution**: Frontend transforms backend variety using `mapOFSPVariety()` function
  - Status: Resolved - Frontend handles transformation

- ✅ **Sourcing Product Type enum**
  - Backend returns: `productType: "FRESH_ROOTS" | "PROCESS_GRADE" | "PLANTING_VINES" | "OFSP"`
  - Frontend expects: `productType: "fresh_roots" | "process_grade" | "planting_vines"` (no "OFSP")
  - **Resolution**: Frontend transforms backend type using `mapSourcingProductType()` function (OFSP → fresh_roots)
  - Status: Resolved - Frontend handles transformation

- ✅ **RFQ Status enum format**
  - Backend returns: `status: "DRAFT" | "PUBLISHED" | "CLOSED" | "AWARDED"` (UPPER_CASE)
  - Frontend expects: `status: "draft" | "published" | "closed" | "awarded"` (lowercase)
  - **Resolution**: Frontend transforms backend status using `mapRFQStatus()` function
  - Status: Resolved - Frontend handles transformation

- ✅ **RFQ Response Status enum format**
  - Backend returns: `status: "SUBMITTED" | "SHORTLISTED" | "AWARDED"` (UPPER_CASE)
  - Frontend expects: `status: "submitted" | "shortlisted" | "awarded"` (lowercase)
  - **Resolution**: Frontend transforms backend status using `mapRFQResponseStatus()` function
  - Status: Resolved - Frontend handles transformation

- ✅ **Negotiation Status enum format**
  - Backend returns: `status: "PENDING" | "ACCEPTED" | "REJECTED"` (UPPER_CASE)
  - Frontend expects: `status: "pending" | "accepted" | "rejected"` (lowercase)
  - **Resolution**: Frontend transforms backend status using `mapNegotiationStatus()` function
  - Status: Resolved - Frontend handles transformation

### 4. Transport Service

**Issue**: Enum format mismatches and field name differences.

- ✅ **Transport Request Status enum format**
  - Backend returns: `status: "PENDING" | "IN_TRANSIT_PICKUP" | "IN_TRANSIT_DELIVERY"` (UPPER_CASE)
  - Frontend expects: `status: "pending" | "in_transit"` (lowercase, simplified)
  - **Note**: Backend has separate pickup/delivery statuses, frontend has single "in_transit"
  - **Resolution**: Frontend transforms backend status using `mapTransportRequestStatus()` function (maps both IN_TRANSIT_PICKUP and IN_TRANSIT_DELIVERY to "in_transit")
  - Status: Resolved - Frontend handles transformation

- ✅ **Transport Type enum format**
  - Backend returns: `type: "PRODUCE_PICKUP" | "PRODUCE_DELIVERY" | "INPUT_DELIVERY"` (UPPER_CASE)
  - Frontend expects: `type: "produce_pickup" | "produce_delivery" | "input_delivery"` (lowercase)
  - **Resolution**: Frontend transforms backend type using `mapTransportRequestType()` function
  - Status: Resolved - Frontend handles transformation

- ✅ **Pickup Schedule Status enum format**
  - Backend returns: `status: "DRAFT" | "PUBLISHED" | "ACTIVE"` (UPPER_CASE)
  - Frontend expects: `status: "draft" | "published" | "active"` (lowercase)
  - **Resolution**: Frontend transforms backend status using `mapPickupScheduleStatus()` function
  - Status: Resolved - Frontend handles transformation

- ✅ **Pickup Slot Status enum format**
  - Backend returns: `status: "AVAILABLE" | "BOOKED" | "FULL"` (UPPER_CASE)
  - Frontend expects: `status: "available" | "booked" | "full"` (lowercase)
  - **Resolution**: Frontend transforms backend status using `mapPickupSlotStatus()` function
  - Status: Resolved - Frontend handles transformation

### 5. Input Service

**Issue**: Enum format mismatches.

- ✅ **Input Status enum format**
  - Backend returns: `status: "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK"` (UPPER_CASE)
  - Frontend expects: `status: "active" | "inactive" | "out_of_stock"` (lowercase)
  - **Resolution**: Frontend transforms backend status using `mapInputStatus()` function in inputService.ts
  - Status: Resolved - Frontend handles transformation

- ✅ **Input Order Status enum format**
  - Backend returns: `status: "PENDING" | "READY_FOR_PICKUP" | "IN_TRANSIT"` (UPPER_CASE)
  - Frontend expects: `status: "pending" | "ready_for_pickup" | "in_transit"` (lowercase)
  - **Resolution**: Frontend transforms backend status using `mapInputOrderStatus()` function in inputService.ts
  - Status: Resolved - Frontend handles transformation

- ✅ **Input Payment Status enum format**
  - Backend returns: `paymentStatus: "PENDING" | "PAID" | "REFUNDED"` (UPPER_CASE)
  - Frontend expects: `paymentStatus: "pending" | "paid" | "refunded"` (lowercase)
  - **Resolution**: Frontend transforms backend status using `mapInputPaymentStatus()` function in inputService.ts
  - Status: Resolved - Frontend handles transformation

### 6. Aggregation Service

**Issue**: Enum format mismatches.

- ✅ **Center Type enum format**
  - Backend returns: `centerType: "MAIN" | "SATELLITE"` (UPPER_CASE)
  - Frontend expects: `centerType: "main" | "satellite"` (lowercase)
  - **Resolution**: Frontend transforms backend type using `mapCenterType()` function in aggregationService.ts
  - Status: Resolved - Frontend handles transformation

- ✅ **Center Status enum format**
  - Backend returns: `status: "OPERATIONAL" | "MAINTENANCE" | "CLOSED"` (UPPER_CASE)
  - Frontend expects: `status: "operational" | "maintenance" | "closed"` (lowercase)
  - **Resolution**: Frontend transforms backend status using `mapCenterStatus()` function in aggregationService.ts
  - Status: Resolved - Frontend handles transformation

- ✅ **Stock Transaction Type enum format**
  - Backend returns: `type: "STOCK_IN" | "STOCK_OUT" | "WASTAGE"` (UPPER_CASE)
  - Frontend expects: `type: "stock_in" | "stock_out" | "wastage"` (lowercase)
  - **Resolution**: Frontend transforms backend type using `mapStockTransactionType()` function in aggregationService.ts
  - Status: Resolved - Frontend handles transformation

### 7. General Data Structure Issues

- ❌ **Date/DateTime format**
  - Backend returns: Prisma `DateTime` objects (may be ISO strings or Date objects)
  - Frontend expects: ISO 8601 strings consistently
  - **Fix**: Ensure all dates are serialized as ISO 8601 strings
  - Priority: **High** (breaks date parsing)

- ❌ **Nested relations**
  - Backend returns: Nested objects (e.g., `order.farmer`, `profile.user`)
  - Frontend expects: Denormalized flat structure with `farmerId`, `farmerName`, etc.
  - **Fix**: Backend should denormalize or frontend should transform
  - Priority: **High** (breaks data access patterns)

---

## 📝 Notes

1. **Response Format**: All endpoints should return data in the format:
   ```json
   {
     "success": true,
     "data": { ... },
     "statusCode": 200,
     "timestamp": "...",
     "message": "..."
   }
   ```

2. **Error Handling**: All endpoints should return consistent error format:
   ```json
   {
     "success": false,
     "message": "Error message",
     "statusCode": 400/401/404/500,
     "error": "Error type"
   }
   ```

3. **Authentication**: All endpoints (except public auth endpoints) require Bearer token in Authorization header.

4. **Pagination**: Consider adding pagination support to list endpoints that may return large datasets.

5. **Filtering**: Ensure query parameters support all frontend filter requirements.

6. **Enum Transformation**: Consider adding a global interceptor or DTO transformation layer to convert all enums from UPPER_CASE to lowercase to match frontend expectations.

7. **Enum Transformation**: Consider adding a global interceptor or DTO transformation layer to convert all enums from UPPER_CASE to lowercase to match frontend expectations.

8. **Data Denormalization**: Consider adding a transformation layer to flatten nested relations and add denormalized fields (e.g., `farmerName`, `buyerName`) for better frontend performance.

---

## 🔧 Recommended Solutions for Type Mismatches

### Option 1: Backend Transformation (Recommended)
Create a global interceptor or transformation layer in NestJS that:
- Converts all enum values from UPPER_CASE to lowercase
- Transforms `isRead` boolean to `status` string for notifications
- Flattens nested relations and adds denormalized fields
- Ensures all dates are ISO 8601 strings

**Pros**: Single source of truth, consistent across all endpoints
**Cons**: Requires backend changes

### Option 2: Frontend Service Transformation
Add transformation functions in each service to:
- Map backend enum values to frontend format
- Transform nested structures to flat structures
- Convert `isRead` to `status` for notifications

**Pros**: No backend changes needed
**Cons**: Duplication across services, maintenance burden

### Option 3: Shared Type Mapping Library
Create a shared library (can be in backend or separate package) that:
- Defines mapping functions for all enum transformations
- Provides DTO classes that automatically transform on serialization
- Can be used by both backend and frontend

**Pros**: Reusable, maintainable, single source of truth
**Cons**: Requires additional setup

### Recommended Approach
**Use Option 1 (Backend Transformation)** with a NestJS interceptor that:
1. Intercepts all responses before sending
2. Recursively transforms enum values (UPPER_CASE → lowercase)
3. Transforms specific fields (isRead → status)
4. Flattens nested relations
5. Ensures date serialization

This ensures consistency and reduces frontend complexity.

---

## 🔄 Migration Status

- ✅ **notificationService** - Migrated to backend API
- ✅ **profileService** - Migrated to backend API (except stats endpoint)
- ✅ **marketplaceService** - Migrated to backend API
  - ✅ Recurring orders CRUD fully implemented
  - ✅ RFQ lifecycle fully implemented (cancel, convert to order, evaluating status)
  - ✅ Enhanced RFQ response status handling with notifications
- ✅ **transportService** - Migrated to backend API (except receipts, confirm pickup, some schedule operations)
- ✅ **aggregationService** - Migrated to backend API (except capacity endpoint)
- ✅ **inputService** - Migrated to backend API
- ✅ **paymentService** - Migrated to backend API (except process endpoint)
- ⏳ **analyticsService** - Still using mocks (no backend module yet)
- ⏳ **staffService** - Still using mocks (no backend module yet)
- ⏳ **inputCustomerService** - Still using mocks (may be covered by inputService)

---

## 🎯 Priority Summary

**High Priority:**
- Confirm pickup with batch creation (transport)
- **Type Mismatches:**
  - Notification `isRead` → `status` transformation
  - Notification `type` enum mapping (ORDER_PLACED → order)
  - Profile nested structure flattening
  - Role enum format (FARMER → farmer)
  - Order status enum format (ORDER_PLACED → order_placed)
  - Listing status enum format
  - Payment status enum format
  - Transport request status enum format
  - Transport type enum format
  - Input order status enum format
  - Date/DateTime serialization consistency
  - Nested relations denormalization

**Medium Priority:**
- Profile stats endpoint
- Update sourcing requests
- Convert negotiation/RFQ response to order
- Recurring orders system
- Pickup schedule publish/cancel/update
- Cancel pickup slot booking
- Pickup receipts system
- Farmer pickup bookings list
- Aggregation center capacity
- **Type Mismatches:**
  - Notification priority enum format
  - Profile status enum format
  - OFSP Variety enum format (Title Case)
  - Sourcing Product Type enum
  - RFQ Status enum format
  - RFQ Response Status enum format
  - Negotiation Status enum format
  - Pickup Schedule Status enum format
  - Pickup Slot Status enum format
  - Input Status enum format
  - Input Payment Status enum format
  - Stock Transaction Type enum format

**Low Priority:**
- Archive notifications
- Alerts system
- Cancel RFQ
- Reject transport request
- Process payment endpoint
- Analytics module
- Staff/admin module
- **Type Mismatches:**
  - Center Type enum format
  - Center Status enum format
