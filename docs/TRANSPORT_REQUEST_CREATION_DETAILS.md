# Transport Request Creation Details

## Overview
When an order is marked as **PROCESSING** (which happens before **READY_FOR_COLLECTION**), if the order has `fulfillmentType === 'request_transport'`, a transport request is automatically created.

## Trigger Point
**Location:** `marketplace.service.ts` - `updateOrderStatus()` method  
**Status Transition:** Order status changes to `PROCESSING`  
**Condition:** `order.fulfillmentType === 'request_transport'` AND `order.deliveryAddress` AND `order.deliveryCounty` exist

## Details Passed to `createTransportRequest()`

### Method Call
```typescript
await this.transportService.createTransportRequest(
  {
    type: 'ORDER_DELIVERY',
    description: `Delivery for order #${order.orderNumber}`,
    requesterType: 'buyer',
    pickupLocation,
    pickupCounty,
    deliveryLocation: order.deliveryAddress,
    deliveryCounty: order.deliveryCounty,
    deliveryCoordinates: order.deliveryCoordinates || undefined,
    weight: order.quantity,
    orderId: order.id,
  },
  order.buyerId, // requesterId
);
```

### Data Object Breakdown

| Field | Source | Description |
|-------|--------|-------------|
| `type` | Hardcoded | Always `'ORDER_DELIVERY'` |
| `description` | Generated | `"Delivery for order #${order.orderNumber}"` |
| `requesterType` | Hardcoded | Always `'buyer'` |
| `pickupLocation` | Derived | Aggregation center location (see lookup logic below) |
| `pickupCounty` | Derived | Aggregation center county (see lookup logic below) |
| `deliveryLocation` | Order field | `order.deliveryAddress` |
| `deliveryCounty` | Order field | `order.deliveryCounty` |
| `deliveryCoordinates` | Order field | `order.deliveryCoordinates` (optional) |
| `weight` | Order field | `order.quantity` (in kg) |
| `orderId` | Order field | `order.id` |

### Requester ID
- **Parameter:** `order.buyerId` (passed as second argument)

## Pickup Location Lookup Logic

The system attempts to find the aggregation center location in the following order:

### 1. From Listing's Batch (Primary)
```typescript
if (order.listingId) {
  const listing = await this.prisma.produceListing.findUnique({
    where: { id: order.listingId },
    select: { batchId: true },
  });

  if (listing?.batchId) {
    const stockTx = await this.prisma.stockTransaction.findFirst({
      where: {
        batchId: listing.batchId,
        type: 'STOCK_IN',
      },
      include: { center: true },
      orderBy: { createdAt: 'desc' },
    });

    if (stockTx?.center) {
      pickupLocation = stockTx.center.location || stockTx.center.name;
      pickupCounty = stockTx.center.county;
    }
  }
}
```

### 2. From Order's Stock Transactions (Fallback)
```typescript
if (pickupLocation === 'Aggregation Center') {
  const stockTx = await this.prisma.stockTransaction.findFirst({
    where: {
      orderId: id,
      type: 'STOCK_IN',
    },
    include: { center: true },
    orderBy: { createdAt: 'desc' },
  });

  if (stockTx?.center) {
    pickupLocation = stockTx.center.location || stockTx.center.name;
    pickupCounty = stockTx.center.county;
  }
}
```

### 3. Default (Final Fallback)
- `pickupLocation = 'Aggregation Center'`
- `pickupCounty = order.deliveryCounty` (uses delivery county as fallback)

## Duplicate Prevention

Before creating the transport request, the system checks for existing requests:

```typescript
const existingRequest = await this.prisma.transportRequest.findFirst({
  where: { 
    orderId: id,
    status: {
      not: 'CANCELLED',
    },
  },
});

if (existingRequest) {
  // Skip creation - request already exists
}
```

## What Happens After Creation

1. **Transport Request Created:**
   - Status: `PENDING`
   - Type: `ORDER_DELIVERY`
   - Linked to order via `orderId`
   - Requester set to buyer (`requesterId = order.buyerId`)

2. **Order Updated:**
   - `fulfillmentType` set to `'request_transport'` (if not already set)
   - `deliveryAddress` updated from `deliveryLocation` (if provided)
   - `deliveryCounty` updated from `deliveryCounty` (if provided)
   - `deliveryCoordinates` updated from `deliveryCoordinates` (if provided)

3. **Activity Log Created:**
   - Action: `ORDER_DELIVERY_TRANSPORT_CREATED`
   - Entity Type: `TRANSPORT`
   - Metadata includes: `requestNumber`, `orderId`, `orderNumber`, `type`, `triggeredBy: 'ORDER_PROCESSING_STARTED'`

4. **Notification Sent:**
   - To Buyer: "Delivery Arranged - Transport request #XXX created for order #YYY. Waiting for provider assignment."
   - Priority: `MEDIUM`
   - Action URL: `/transport/${request.id}`

## Important Notes

1. **Timing:** Transport request is created when order status changes to `PROCESSING`, NOT when it's marked as `READY_FOR_COLLECTION`.

2. **Prerequisites:**
   - Order must have `fulfillmentType === 'request_transport'`
   - Order must have `deliveryAddress` and `deliveryCounty`
   - Order must NOT already have a non-cancelled transport request

3. **Error Handling:**
   - If transport request creation fails, the error is logged but does NOT block the order status update
   - This ensures order processing can continue even if transport setup fails

4. **Order Status Flow:**
   ```
   PROCESSING → (transport request created here) → READY_FOR_COLLECTION → RELEASED → COLLECTED
   ```

## Code Locations

- **Transport Request Creation:** `marketplace.service.ts` lines 705-806
- **Transport Service Method:** `transport.service.ts` lines 118-266
- **DTO Definition:** `dto/create-transport-request.dto.ts`
