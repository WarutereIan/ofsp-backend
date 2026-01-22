# Analytics Materialized Views - Type Safety

**Date:** January 2025  
**Status:** ✅ **Types Added to Prisma Schema**

---

## Overview

Materialized views have been added to the Prisma schema with the `views` preview feature enabled. This provides full type safety when querying the analytics views.

---

## Prisma Schema Updates

### Generator Configuration
```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["views"]
}
```

### Views Added

1. **`DailyOrderSummary`** - Maps to `daily_order_summary` materialized view
2. **`MonthlyFarmerStatistics`** - Maps to `monthly_farmer_statistics` materialized view
3. **`CenterUtilizationSummary`** - Maps to `center_utilization_summary` materialized view
4. **`WeeklyBuyerSourcing`** - Maps to `weekly_buyer_sourcing` materialized view

---

## Type Definitions

### DailyOrderSummary
```typescript
{
  date: Date;
  totalOrders: number;
  uniqueFarmers: number;
  uniqueBuyers: number;
  revenue: number | null;
  volume: number | null;
  completedOrders: number;
  averageOrderValue: number | null;
}
```

### MonthlyFarmerStatistics
```typescript
{
  month: Date;
  farmerId: string;
  userId: string;
  farmerName: string | null;
  subCounty: string | null;
  county: string | null;
  orderCount: number;
  revenue: number | null;
  volume: number | null;
  completedOrders: number;
  averageRating: number;
  ratingCount: number;
}
```

### CenterUtilizationSummary
```typescript
{
  centerId: string;
  centerName: string | null;
  centerCode: string | null;
  county: string | null;
  subCounty: string | null;
  totalCapacity: number | null;
  currentStock: number | null;
  availableCapacity: number | null;
  utilizationRate: number | null;
  totalBatches: number;
  freshBatches: number;
  agingBatches: number;
  criticalBatches: number;
  totalTransactions: number;
  totalStockIn: number | null;
  totalStockOut: number | null;
}
```

### WeeklyBuyerSourcing
```typescript
{
  week: Date;
  buyerId: string;
  userId: string;
  buyerName: string | null;
  orderCount: number;
  uniqueSuppliers: number;
  procurementValue: number | null;
  volumeSourced: number | null;
  directOrders: number;
  rfqOrders: number;
  sourcingRequestOrders: number;
}
```

---

## Service Methods (Updated)

All service methods now use typed Prisma queries instead of raw SQL:

### `getDailyOrderSummary(startDate?, endDate?)`
```typescript
// Returns: Promise<DailyOrderSummary[]>
// Fully typed with Prisma client
```

### `getMonthlyFarmerStatistics(month?, subCounty?)`
```typescript
// Returns: Promise<MonthlyFarmerStatistics[]>
// Fully typed with Prisma client
```

### `getCenterUtilizationSummary(county?)`
```typescript
// Returns: Promise<CenterUtilizationSummary[]>
// Fully typed with Prisma client
```

### `getWeeklyBuyerSourcing(week?, buyerId?)`
```typescript
// Returns: Promise<WeeklyBuyerSourcing[]>
// Fully typed with Prisma client
```

---

## Usage Examples

### Before (Raw SQL - No Types)
```typescript
const results = await this.prisma.$queryRawUnsafe(
  'SELECT * FROM daily_order_summary WHERE date >= $1',
  startDate
);
// results: any - No type safety
```

### After (Typed Prisma Client)
```typescript
const results = await this.prisma.dailyOrderSummary.findMany({
  where: {
    date: { gte: startDate, lte: endDate }
  },
  orderBy: { date: 'asc' }
});
// results: DailyOrderSummary[] - Full type safety
```

---

## Benefits

1. **Type Safety**: Full TypeScript autocomplete and type checking
2. **IntelliSense**: IDE support for all view fields
3. **Refactoring**: Safe renaming and field changes
4. **Documentation**: Types serve as inline documentation
5. **Error Prevention**: Compile-time errors for invalid queries

---

## Migration Status

- ✅ Views added to Prisma schema
- ✅ `views` preview feature enabled
- ✅ Prisma client regenerated
- ✅ Service methods updated to use typed queries
- ✅ Type definitions available in `@prisma/client`

---

## Next Steps

1. **Use Typed Queries**: Replace any remaining `$queryRawUnsafe` calls with typed Prisma queries
2. **Leverage Types**: Use the generated types in DTOs and response interfaces
3. **Type Guards**: Add runtime validation if needed for external data

---

**Document Version:** 1.0  
**Last Updated:** January 2025
