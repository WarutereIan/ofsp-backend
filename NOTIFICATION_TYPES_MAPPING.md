# Notification Types Mapping

## Backend Notification Types (Current)

Based on comprehensive codebase analysis, the following notification types are used in the backend:

### Core Types

1. **`ORDER`** - Marketplace order notifications
   - Used in: `marketplace.service.ts`, `notification.service.ts`, `aggregation.service.ts`, `input.service.ts`
   - Examples: Order placed, order accepted, order status changes, recurring orders
   - Count: ~50+ occurrences

2. **`PAYMENT`** - Payment-related notifications
   - Used in: `payment.service.ts`
   - Examples: Payment secured, payment received, payment status updates
   - Count: ~10+ occurrences

3. **`TRANSPORT`** - Transport request notifications
   - Used in: `transport.service.ts`
   - Examples: Transport request accepted, transport status updated, transport tracking
   - Count: ~10+ occurrences

4. **`QUALITY_CHECK`** - Quality check notifications
   - Used in: `aggregation.service.ts`
   - Examples: Quality check completed, quality approved/rejected
   - Count: ~5+ occurrences

### Marketplace Workflow Types

5. **`RFQ`** - Request for Quotation notifications
   - Used in: `marketplace.service.ts`
   - Examples: RFQ published, RFQ closed, RFQ awarded, RFQ cancelled
   - Count: ~15+ occurrences

6. **`RFQ_RESPONSE`** - RFQ response notifications
   - Used in: `marketplace.service.ts`
   - Examples: RFQ response submitted, RFQ response shortlisted, RFQ response awarded
   - Count: ~10+ occurrences

7. **`SOURCING_REQUEST`** - Sourcing request notifications
   - Used in: `marketplace.service.ts`
   - Examples: Sourcing request created, sourcing request updated, sourcing request closed
   - Count: ~10+ occurrences

8. **`SUPPLIER_OFFER`** - Supplier offer notifications
   - Used in: `marketplace.service.ts`
   - Examples: Supplier offer received, supplier offer accepted, supplier offer rejected
   - Count: ~8+ occurrences

9. **`NEGOTIATION`** - Negotiation notifications
   - Used in: `marketplace.service.ts`
   - Examples: Negotiation started, negotiation message received, negotiation completed
   - Count: ~15+ occurrences

### Transport/Pickup Types

10. **`PICKUP_SCHEDULE`** - Pickup schedule notifications
    - Used in: `transport.service.ts`
    - Examples: Pickup schedule published, pickup schedule cancelled
    - Count: ~5+ occurrences

11. **`PICKUP_BOOKING`** - Pickup booking notifications
    - Used in: `transport.service.ts`
    - Examples: Booking confirmed, booking cancelled, pickup confirmed
    - Count: ~8+ occurrences

### Summary

**Total Backend Notification Types: 11**
- Core: ORDER, PAYMENT, TRANSPORT, QUALITY_CHECK (4 types)
- Marketplace: RFQ, RFQ_RESPONSE, SOURCING_REQUEST, SUPPLIER_OFFER, NEGOTIATION (5 types)
- Transport: PICKUP_SCHEDULE, PICKUP_BOOKING (2 types)

## Frontend Notification Types (Expected)

The frontend expects these types (lowercase):
- `"order"`
- `"payment"`
- `"transport"`
- `"quality_check"`
- `"system"`
- `"alert"`

## Mapping Strategy

Backend types should be mapped to frontend types as follows:

| Backend Type | Frontend Type | Notes |
|-------------|---------------|-------|
| `ORDER` | `"order"` | Direct mapping |
| `PAYMENT` | `"payment"` | Direct mapping |
| `TRANSPORT` | `"transport"` | Direct mapping |
| `QUALITY_CHECK` | `"quality_check"` | Direct mapping |
| `RFQ` | `"order"` | RFQ is part of order workflow |
| `RFQ_RESPONSE` | `"order"` | RFQ response is part of order workflow |
| `SOURCING_REQUEST` | `"order"` | Sourcing request leads to orders |
| `SUPPLIER_OFFER` | `"order"` | Supplier offers lead to orders |
| `NEGOTIATION` | `"order"` | Negotiations are part of order process |
| `PICKUP_SCHEDULE` | `"transport"` | Pickup schedules are transport-related |
| `PICKUP_BOOKING` | `"transport"` | Pickup bookings are transport-related |
| `SYSTEM` | `"system"` | System notifications (if any) |
| `ALERT` | `"alert"` | Alert notifications (if any) |

## Implementation

The frontend should transform backend notification types to frontend types in the `transformNotification` function in `notificationService.ts`.
