# Analytics E2E Tests Implementation

**Date:** January 2025  
**Status:** ✅ Implemented  
**Test File:** `test/analytics.e2e-spec.ts`

---

## Overview

Comprehensive end-to-end tests for the Analytics module covering all endpoints, query parameters, role-based access, edge cases, and cache behavior.

---

## Test Coverage

### 1. Dashboard Statistics (`GET /analytics/dashboard-stats`)

**Test Cases:**
- ✅ Returns dashboard statistics with all required fields
- ✅ Filters by timeRange (day, week, month, quarter, year)
- ✅ Filters by custom date range
- ✅ Filters by entityType (FARMER, BUYER)
- ✅ Role-based filtering (farmer sees own data, staff sees platform-wide)
- ✅ Authentication required
- ✅ Handles empty data gracefully
- ✅ Handles invalid date formats

**Fields Validated:**
- `totalRevenue`, `totalOrders`, `totalFarmers`, `totalBuyers`, `totalUsers`
- `totalStock`, `averageOrderValue`, `averagePrice`
- `growthRate`, `revenueGrowthRate`, `orderGrowthRate`, `userGrowthRate`
- `period`, `dateRange` (start, end)

---

### 2. Trends (`GET /analytics/trends`)

**Test Cases:**
- ✅ Returns trend data as array
- ✅ Returns trend data with required fields
- ✅ Filters by period (daily, weekly, monthly)
- ✅ Filters by custom date range
- ✅ Filters by entityType
- ✅ Authentication required

**Fields Validated:**
- `date`, `revenue`, `orders`, `volume`
- `farmers`, `buyers`, `users`

---

### 3. Performance Metrics (`GET /analytics/performance-metrics`)

**Test Cases:**
- ✅ Returns performance metrics array
- ✅ Returns metrics with required fields
- ✅ Filters by timeRange
- ✅ Authentication required

**Fields Validated:**
- `id`, `name`, `value`, `unit`, `trend`
- `baseline`, `trendPercentage`

---

### 4. Leaderboards (`GET /analytics/leaderboards/:metric/:period`)

**Test Cases:**
- ✅ All metrics: revenue, sales, orders, rating, quality
- ✅ All periods: daily, weekly, monthly, quarterly, yearly
- ✅ Filters by subcounty
- ✅ Filters by county
- ✅ Limits entries
- ✅ Includes user entry when userId provided
- ✅ Authentication required
- ✅ Rejects invalid metric
- ✅ Rejects invalid period

**Fields Validated:**
- `entries` array with: `id`, `name`, `score`, `rank`, `totalRevenue`, `totalSales`, `orderCount`, `subCounty`
- `metric`, `period`, `title`, `generatedAt`

---

### 5. Market Info (`GET /analytics/market-info`)

**Test Cases:**
- ✅ Returns market information
- ✅ Returns market prices with correct structure
- ✅ Returns price trends with correct structure
- ✅ Returns buyer demand with correct structure
- ✅ Filters by location
- ✅ Filters by variety
- ✅ Filters by timeRange
- ✅ Filters by custom date range
- ✅ Authentication required

**Fields Validated:**
- `prices`: `variety`, `grade`, `location`, `averagePrice`, `minPrice`, `maxPrice`
- `priceTrends`: `variety`, `grade`, `location`, `currentPrice`, `previousPrice`, `percentChange`
- `buyerDemand`: `variety`, `grade`, `location`, `buyerCount`, `totalQuantityNeeded`, `demandLevel`

---

### 6. Role-Specific Analytics

#### 6.1 Farmer Analytics (`GET /analytics/farmer`)

**Test Cases:**
- ✅ Returns farmer-specific analytics
- ✅ Returns peer comparison data
- ✅ Filters by timeRange
- ✅ Filters by custom date range
- ✅ Only returns data for authenticated farmer
- ✅ Authentication required
- ✅ Rejects non-farmer access (gracefully)

**Fields Validated:**
- `revenue`, `volume`, `orderCount`, `qualityScore`, `activeListings`, `completionRate`
- `peerComparison`: `countyRanking`, `subCountyRanking`, `salesGrowthVsPeer`
- `period`

#### 6.2 Buyer Analytics (`GET /analytics/buyer`)

**Test Cases:**
- ✅ Returns buyer-specific analytics
- ✅ Returns supplier performance details
- ✅ Returns sourcing by method breakdown
- ✅ Returns sourcing by region
- ✅ Filters by timeRange
- ✅ Filters by custom date range
- ✅ Authentication required

**Fields Validated:**
- `volumeSourced`, `totalProcurementValue`, `averagePrice`, `qualityAcceptanceRate`
- `activeSuppliers`, `supplierPerformance`, `sourcingByRegion`, `sourcingByMethod`
- `supplierDistribution`, `period`

#### 6.3 Staff Analytics (`GET /analytics/staff`)

**Test Cases:**
- ✅ Returns staff-specific analytics (M&E Dashboard)
- ✅ Returns program indicators
- ✅ Returns geographic analytics
- ✅ Filters by timeRange
- ✅ Authentication required
- ✅ Accessible to admin users

**Fields Validated:**
- `platformFee`, `qualityGradeAPercentage`, `totalVolume`
- `geographicAnalytics`, `period`

#### 6.4 County Officer Analytics (`GET /analytics/county-officer`)

**Test Cases:**
- ✅ Returns county officer-specific analytics

**Fields Validated:**
- `farmerMetrics`, `productionMetrics`

#### 6.5 Input Provider Analytics (`GET /analytics/input-provider`)

**Test Cases:**
- ✅ Returns input provider-specific analytics
- ✅ Filters by timeRange
- ✅ Authentication required

**Fields Validated:**
- `dashboardMetrics`: `totalInputs`, `activeOrders`, `totalRevenue`, `totalCustomers`, `lowStockProducts`
- `salesAnalytics`: `salesByCategory`, `topSellingProducts`
- `period`

#### 6.6 Transport Provider Analytics (`GET /analytics/transport-provider`)

**Test Cases:**
- ✅ Returns transport provider-specific analytics
- ✅ Filters by timeRange
- ✅ Authentication required

**Fields Validated:**
- `dashboardMetrics`: `totalRequests`, `completedRequests`, `totalEarnings`
- `deliveryMetrics`: `onTimeDeliveryRate`, `averageDeliveryTime`
- `earningsMetrics`: `totalEarnings`, `earningsGrowthRate`
- `performanceMetrics`, `weeklyTrend`, `period`

#### 6.7 Aggregation Manager Analytics (`GET /analytics/aggregation-manager`)

**Test Cases:**
- ✅ Returns aggregation manager-specific analytics
- ✅ Filters by timeRange
- ✅ Authentication required

**Fields Validated:**
- `dashboardMetrics`: `totalCenters`, `totalStock`, `utilizationRate`
- `stockAnalytics`: `totalStock`, `stockByStatus`
- `centerPerformance`: `centerUtilization`, `topPerformingCenters`
- `period`

---

### 7. Materialized Views Refresh (`GET /analytics/refresh-views`)

**Test Cases:**
- ✅ Refreshes views for admin users
- ✅ Refreshes views for staff users
- ✅ Rejects refresh for farmer users
- ✅ Rejects refresh for buyer users
- ✅ Authentication required

**Fields Validated:**
- `success`, `message`, `timestamp`

---

### 8. Edge Cases and Error Handling

**Test Cases:**
- ✅ Handles empty results gracefully
- ✅ Handles invalid date formats (400 error)
- ✅ Handles date range where start > end
- ✅ Handles very large date ranges
- ✅ Handles concurrent requests
- ✅ Handles missing optional query parameters

---

### 9. Cache Behavior

**Test Cases:**
- ✅ Returns consistent results for same query
- ✅ Returns different results for different time ranges

---

## Test Data Setup

The E2E tests create comprehensive test data:

1. **Test Users:**
   - Farmer user
   - Buyer user
   - Staff user
   - Admin user
   - Role-specific users (county officer, input provider, transport provider, aggregation manager)

2. **Test Data:**
   - Produce listings (2 listings with different varieties)
   - Marketplace orders (3 orders: 2 completed, 1 pending)
   - Ratings (2 ratings for quality testing)
   - User profiles with location data

3. **Cleanup:**
   - All test data is cleaned up in `afterAll`
   - Test users and related data are deleted

---

## Running the Tests

### Prerequisites
1. Database connection configured (`DATABASE_URL` in `.env`)
2. Database migrations applied
3. Test database available

### Run Command
```bash
npm run test:e2e -- analytics.e2e-spec.ts
```

### Expected Behavior
- Tests require a live database connection
- Tests create and clean up test data
- Tests validate response structures and data integrity
- Tests verify role-based access control

---

## Test Statistics

- **Total Test Cases:** 70+
- **Endpoints Covered:** 13
- **Query Parameters Tested:** All supported filters
- **Role-Based Tests:** 7 roles
- **Edge Cases:** 6 scenarios
- **Cache Tests:** 2 scenarios

---

## Notes

1. **Database Required:** E2E tests require a live database connection. Set `DATABASE_URL` in your `.env` file.

2. **Test Isolation:** Each test run cleans up previous test data and creates fresh test users.

3. **Test Data:** Tests create realistic data (orders, listings, ratings) to validate analytics calculations.

4. **Cache Testing:** Cache behavior tests verify consistency but don't validate cache TTL expiration (requires time-based testing).

5. **Materialized Views:** Refresh endpoint tests may fail if views don't exist - ensure migrations are applied.

---

**Document Version:** 1.0  
**Last Updated:** January 2025
