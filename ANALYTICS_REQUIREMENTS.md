# Analytics Service Requirements

**Date:** January 2025  
**Purpose:** Comprehensive analytics requirements for the OFSP platform backend, derived from frontend dashboards, entity lifecycles, and user role needs.

---

## Table of Contents

1. [Overview](#overview)
2. [Data Sources](#data-sources)
3. [Analytics by User Role](#analytics-by-user-role)
4. [Core Analytics Endpoints](#core-analytics-endpoints)
5. [Metrics & Calculations](#metrics--calculations)
6. [Time Series & Trends](#time-series--trends)
7. [Leaderboards](#leaderboards)
8. [Reports](#reports)
9. [Advisories](#advisories)
10. [Implementation Priority](#implementation-priority)

---

## Overview

The Analytics Service provides:
- **Dashboard Statistics**: Aggregated metrics for role-specific dashboards
- **Trend Analysis**: Time-series data for charts and visualizations
- **Performance Metrics**: KPIs and performance indicators
- **Leaderboards**: Rankings and comparisons
- **Reports**: Generated reports in multiple formats
- **Advisories**: Advisory/guidance system for farmers and officers

### Key Principles

1. **Role-Based Analytics**: Each user role has specific analytics needs
2. **Time-Based Filtering**: Support for day/week/month/quarter/year/custom ranges
3. **Real-Time Updates**: Analytics should reflect current data state
4. **Performance**: Optimized queries with proper indexing
5. **Caching**: Cache frequently accessed analytics for performance

---

## Data Sources

### Primary Data Entities

Based on `ENTITY_LIFECYCLE_MAPPING.md`, the following entities generate analytics data:

#### Marketplace Domain
- **MarketplaceOrder**: Orders, revenue, quantities, status transitions
- **ProduceListing**: Listings, prices, availability
- **Negotiation**: Negotiation success rates, conversion rates
- **RFQ**: RFQ response rates, award rates
- **SourcingRequest**: Sourcing request fulfillment
- **Payment**: Payment transactions, escrow data
- **Rating**: Quality ratings, farmer/buyer ratings

#### Transport Domain
- **TransportRequest**: Transport requests, deliveries, distances, costs
- **PickupSchedule**: Pickup schedules, bookings, utilization
- **PickupSlot**: Slot bookings, capacity utilization

#### Input Domain
- **InputOrder**: Input orders, revenue, quantities
- **Input**: Input catalog, stock levels, sales

#### Aggregation Domain
- **AggregationCenter**: Center capacity, utilization
- **StockTransaction**: Stock in/out, inventory levels
- **InventoryItem**: Current stock, varieties, quality grades
- **QualityCheck**: Quality scores, grade distributions
- **StorageBatch**: Batch traceability, storage duration

#### Profile Domain
- **Profile**: User profiles, farmer/buyer statistics
- **User**: User registration, growth, activity

#### Notification Domain
- **Notification**: Notification delivery, read rates, engagement

---

## Analytics by User Role

### 1. Farmer Analytics

**Dashboard Metrics:**
- Total revenue (all-time, monthly, weekly)
- Earnings this month vs last month (with trend %)
- Quantity delivered (kg) this month vs last month
- Quality score (average rating converted to percentage)
- Peer ranking (percentile, rank, total farmers)
- Order count (total, pending, completed)
- Active listings count
- Average order value
- Completion rate (completed/total orders)

**Trends:**
- Monthly earnings (6 months)
- Quality history (monthly ratings)
- Order volume over time
- Revenue trends

**Leaderboard:**
- Revenue leaderboard (monthly, quarterly, yearly)
- Sales volume leaderboard (kg)
- Order count leaderboard
- Average rating leaderboard
- Filterable by sub-county

**Performance Metrics:**
- Growth potential (revenue needed to reach next tier)
- Sub-county ranking
- Achievement badges progress
- Sales growth vs peer average

**Data Sources:**
- `MarketplaceOrder` (farmer's orders)
- `ProduceListing` (farmer's listings)
- `Rating` (farmer ratings)
- `Profile` (farmer profile data)

---

### 2. Buyer Analytics

**Dashboard Metrics:**
- Volume sourced (tons) vs quarterly target
- Volume trend (% change)
- Average price per kg vs market average
- Price trend (% change)
- Quality acceptance rate (% Grade A orders)
- Active suppliers count
- Deliveries this week
- Total procurement value

**Trends:**
- Price trends (your price vs market average)
- Volume trends over time
- Quality trends
- Supplier performance trends

**Sourcing Mix:**
- Sourcing by method (Direct orders, RFQ, Negotiations, Sourcing Requests)
- Sourcing by region (volume by sub-county/county)
- Supplier distribution

**Data Sources:**
- `MarketplaceOrder` (buyer's orders)
- `RFQ` (buyer's RFQs)
- `Negotiation` (buyer's negotiations)
- `SourcingRequest` (buyer's sourcing requests)
- `Payment` (payment history)

---

### 3. Staff Analytics (M&E Dashboard)

**Dashboard Metrics:**
- Total users (farmers + buyers + others)
- Total farmers
- Total buyers
- Total orders
- Total revenue
- Platform fee (2% of revenue)
- Average order value
- Growth rates (users, orders, revenue)

**Program Indicators:**
- Beneficiaries (farmers) vs target (e.g., 2000)
- Volume (tonnes) vs target (e.g., 100 tons)
- Quality (Grade A %) vs target (e.g., 80%)
- Income increase (%) vs target (e.g., 50%)

**Trends:**
- User growth (farmers, buyers over time)
- Orders and revenue trends
- Quality trends
- Volume trends
- Income increase trends
- Transaction trends

**Geographic Analytics:**
- Geographic reach (centers by location)
- Coverage (active vs target)
- Farmer distribution by sub-county

**Value Chain Flow:**
- Flow from farmers → centers → buyers
- Sankey diagram data

**Outcome Comparison:**
- Before/after program metrics
- Income increase
- Quality improvement

**Data Quality:**
- Data quality score
- Transaction evidence count
- Activity logs

**Data Sources:**
- `Profile` (all users)
- `MarketplaceOrder` (all orders)
- `Payment` (all payments)
- `AggregationCenter` (all centers)
- `StockTransaction` (all transactions)
- `QualityCheck` (all quality checks)

---

### 4. County Officer Analytics

**Dashboard Metrics:**
- Total farmers
- Active farmers
- Total production volume (tons)
- Aggregation centers count
- Quality score (% Grade A)
- Total value (KES)
- Pending advisories count

**Production Analytics:**
- Monthly production trend (12 months)
- Farmer growth (cumulative registration)
- Production by sub-county
- Average production per farmer

**Center Performance:**
- Center utilization rates
- Top performing centers
- Center capacity utilization

**Farmer Participation:**
- Active farmers vs total farmers
- Participation rate
- Farmer activity (recent activity list)
- Production volumes by location

**Advisory System:**
- Pending advisories
- Advisory read rates
- Advisory impact metrics

**Data Sources:**
- `Profile` (farmers in officer's jurisdiction)
- `MarketplaceOrder` (orders from farmers)
- `AggregationCenter` (centers in jurisdiction)
- `StockTransaction` (transactions)
- `InventoryItem` (inventory)
- `Advisory` (advisories)

---

### 5. Input Provider Analytics

**Dashboard Metrics:**
- Total inputs (products)
- Active orders count
- Total revenue (this month vs last month)
- Total customers
- New customers (this month)
- Pending orders
- Low stock products count

**Sales Analytics:**
- Sales by category
- Top selling products
- Revenue trends (weekly/monthly)
- Customer growth trends

**Data Sources:**
- `Input` (input catalog)
- `InputOrder` (input orders)
- `InputCustomer` (customers)
- `Payment` (payments for input orders)

---

### 6. Transport Provider Analytics

**Dashboard Metrics:**
- Active deliveries count
- Pending requests count
- Completed today count
- Total earnings (all-time)
- Weekly earnings
- Average rating
- Total reviews

**Trends:**
- Weekly earnings trend
- Delivery completion rates
- Distance traveled trends

**Performance:**
- On-time delivery rate
- Average delivery time
- Customer satisfaction (ratings)

**Data Sources:**
- `TransportRequest` (transport requests)
- `PickupSchedule` (pickup schedules)
- `Rating` (transport provider ratings)
- `Payment` (transport payments)

---

### 7. Aggregation Manager Analytics

**Dashboard Metrics:**
- Current stock (kg)
- Stock in today (kg)
- Stock out today (kg)
- Quality checks today
- Pending quality checks
- Capacity utilization (%)
- Max capacity (kg)

**Stock Analytics:**
- Stock by variety (distribution)
- Stock movement (in/out trends)
- Stock aging (freshness distribution)
- Quality distribution (Grade A/B/C)

**Performance:**
- Center utilization
- Stock turnover rate
- Wastage rate
- Quality acceptance rate

**Data Sources:**
- `InventoryItem` (inventory)
- `StockTransaction` (transactions)
- `QualityCheck` (quality checks)
- `AggregationCenter` (center data)
- `StorageBatch` (batch data)

---

## Core Analytics Endpoints

### 1. Dashboard Statistics

**Endpoint:** `GET /api/v1/analytics/dashboard-stats`

**Query Parameters:**
- `timeRange`: `day` | `week` | `month` | `quarter` | `year` | `all`
- `startDate`: ISO 8601 date (for custom range)
- `endDate`: ISO 8601 date (for custom range)
- `entityId`: Filter by specific entity (farmer, buyer, center, etc.)
- `entityType`: `farmer` | `buyer` | `center` | `transport_provider` | `input_provider`

**Response:** `DashboardStats`
```typescript
{
  totalRevenue: number;
  totalOrders: number;
  totalFarmers: number;
  totalBuyers: number;
  totalUsers?: number;
  totalStock: number; // kg
  averageOrderValue: number;
  growthRate: number; // percentage
  userGrowthRate?: number;
  orderGrowthRate?: number;
  revenueGrowthRate?: number;
  averagePrice?: number; // KES per kg
  period: TimePeriod;
  dateRange: {
    start: string; // ISO 8601
    end: string; // ISO 8601
  };
}
```

**Role-Specific Variations:**
- **Farmer**: Include farmer-specific metrics (earnings, quantity delivered, quality score, ranking)
- **Buyer**: Include buyer-specific metrics (volume sourced, price comparisons, quality acceptance)
- **Staff**: Include platform-wide metrics (platform fee, all users)
- **Officer**: Include jurisdiction-specific metrics (farmers in area, production volume)
- **Input Provider**: Include input-specific metrics (products, customers, revenue)
- **Transport Provider**: Include transport-specific metrics (deliveries, earnings, ratings)
- **Aggregation Manager**: Include center-specific metrics (stock, capacity, quality)

---

### 2. Trends

**Endpoint:** `GET /api/v1/analytics/trends`

**Query Parameters:**
- `timeRange`: `day` | `week` | `month` | `quarter` | `year` | `all`
- `startDate`: ISO 8601 date
- `endDate`: ISO 8601 date
- `entityId`: Filter by specific entity
- `entityType`: Entity type filter
- `granularity`: `daily` | `weekly` | `monthly` | `quarterly` | `yearly` (default: based on timeRange)

**Response:** `TrendData[]`
```typescript
[
  {
    date: string; // ISO 8601
    revenue?: number;
    orders?: number;
    farmers?: number;
    buyers?: number;
    users?: number;
    volume?: number; // kg or tonnes
    qualityScore?: number; // percentage
    averagePrice?: number;
    centers?: number;
    incomeIncrease?: number; // percentage
    transactions?: number;
    stockIn?: number; // kg
    stockOut?: number; // kg
  },
  ...
]
```

**Use Cases:**
- Line charts for revenue, orders, users over time
- Area charts for production volume
- Multi-metric comparisons (revenue vs orders)
- Growth trends

---

### 3. Performance Metrics

**Endpoint:** `GET /api/v1/analytics/performance-metrics`

**Query Parameters:**
- `timeRange`: Time range filter
- `entityId`: Filter by entity
- `entityType`: Entity type filter

**Response:** `PerformanceMetric[]`
```typescript
[
  {
    id: string;
    name: string;
    metric: string; // e.g., "income_increase", "quality_score"
    value: number;
    baseline?: number;
    target?: number;
    unit?: string;
    trend?: "up" | "down" | "stable";
    trendPercentage?: number;
    period: TimePeriod;
  },
  ...
]
```

**Metrics:**
- Income increase (%)
- Quality score (%)
- Volume (tonnes)
- Beneficiaries (count)
- Center utilization (%)
- Stock turnover rate
- Wastage rate
- On-time delivery rate

---

### 4. Leaderboards

**Endpoint:** `GET /api/v1/analytics/leaderboards/:metric/:period`

**Path Parameters:**
- `metric`: `revenue` | `sales` | `orders` | `rating` | `quality`
- `period`: `daily` | `weekly` | `monthly` | `quarterly` | `yearly`

**Query Parameters:**
- `limit`: Number of entries (default: 50)
- `subcounty`: Filter by sub-county
- `county`: Filter by county
- `userId`: Include user's rank even if not in top N

**Response:** `Leaderboard`
```typescript
{
  id: string;
  title: string;
  metric: string;
  period: TimePeriod;
  entries: LeaderboardEntry[];
  generatedAt: string; // ISO 8601
}

// LeaderboardEntry
{
  id: string; // User ID
  name: string;
  rank: number;
  score: number;
  metric: string;
  change?: number; // Rank change from previous period
  avatar?: string;
  metadata?: Record<string, unknown>;
  // Extended properties
  totalRevenue?: number;
  totalSales?: number; // kg
  orderCount?: number;
  avgRating?: number;
  subCounty?: string;
  isCurrentUser?: boolean;
  farmerName?: string;
  userId?: string;
}
```

**Calculations:**
- **Revenue Leaderboard**: Sum of `MarketplaceOrder.totalAmount` for completed orders
- **Sales Leaderboard**: Sum of `MarketplaceOrder.totalQuantity` for completed orders
- **Orders Leaderboard**: Count of completed `MarketplaceOrder`
- **Rating Leaderboard**: Average of `Rating.overallRating` for farmer
- **Quality Leaderboard**: Average quality score from `QualityCheck`

---

### 5. Reports

**Endpoint:** `GET /api/v1/analytics/reports`

**Query Parameters:**
- `type`: `sales` | `stock` | `performance` | `financial` | `quality` | `farmer` | `buyer`
- `status`: `generating` | `ready` | `failed`
- `generatedBy`: User ID

**Response:** `Report[]`

**Generate Report:**
**Endpoint:** `POST /api/v1/analytics/reports/generate`

**Body:**
```typescript
{
  templateId: string;
  parameters: {
    dateRange?: { start: string; end: string };
    entityId?: string;
    entityType?: string;
    format?: "pdf" | "excel" | "csv" | "json";
    [key: string]: unknown;
  };
}
```

**Response:** `Report`

**Download Report:**
**Endpoint:** `GET /api/v1/analytics/reports/:id/download`

**Response:** File download (PDF, Excel, CSV, or JSON)

**Report Templates:**
**Endpoint:** `GET /api/v1/analytics/report-templates`

**Response:** `ReportTemplate[]`

---

### 6. Advisories

**Endpoints:**
- `GET /api/v1/analytics/advisories` - List advisories
- `GET /api/v1/analytics/advisories/:id` - Get advisory by ID
- `POST /api/v1/analytics/advisories` - Create advisory
- `PUT /api/v1/analytics/advisories/:id` - Update advisory
- `DELETE /api/v1/analytics/advisories/:id` - Delete advisory

**Query Parameters (for list):**
- `type`: `best_practice` | `warning` | `alert` | `information` | `training`
- `targetAudience`: User role or `all`
- `category`: Advisory category
- `priority`: `low` | `medium` | `high`
- `isActive`: boolean
- `searchQuery`: Search in title/content

**Response:** `Advisory[]`

---

## Metrics & Calculations

### Revenue Metrics

**Total Revenue:**
```sql
SELECT SUM(total_amount) 
FROM marketplace_order 
WHERE status IN ('completed', 'delivered')
  AND created_at BETWEEN :start_date AND :end_date
  [AND farmer_id = :farmer_id] -- For farmer-specific
  [AND buyer_id = :buyer_id] -- For buyer-specific
```

**Average Order Value:**
```sql
SELECT AVG(total_amount)
FROM marketplace_order
WHERE status IN ('completed', 'delivered')
  AND created_at BETWEEN :start_date AND :end_date
```

**Platform Fee:**
```sql
SELECT SUM(total_amount) * 0.02 AS platform_fee
FROM marketplace_order
WHERE status IN ('completed', 'delivered')
  AND created_at BETWEEN :start_date AND :end_date
```

### Volume Metrics

**Total Volume (kg):**
```sql
SELECT SUM(total_quantity)
FROM marketplace_order
WHERE status IN ('completed', 'delivered')
  AND created_at BETWEEN :start_date AND :end_date
```

**Volume by Variety:**
```sql
SELECT 
  variety,
  SUM(total_quantity) AS total_volume
FROM marketplace_order
WHERE status IN ('completed', 'delivered')
  AND created_at BETWEEN :start_date AND :end_date
GROUP BY variety
```

### Quality Metrics

**Quality Score (%):**
```sql
SELECT 
  AVG(quality_score) * 20 AS quality_score_percentage
FROM quality_check
WHERE created_at BETWEEN :start_date AND :end_date
  [AND farmer_id = :farmer_id]
```

**Grade Distribution:**
```sql
SELECT 
  quality_grade,
  COUNT(*) AS count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () AS percentage
FROM quality_check
WHERE created_at BETWEEN :start_date AND :end_date
GROUP BY quality_grade
```

### Growth Rates

**Revenue Growth Rate:**
```sql
WITH current_period AS (
  SELECT SUM(total_amount) AS revenue
  FROM marketplace_order
  WHERE status IN ('completed', 'delivered')
    AND created_at BETWEEN :current_start AND :current_end
),
previous_period AS (
  SELECT SUM(total_amount) AS revenue
  FROM marketplace_order
  WHERE status IN ('completed', 'delivered')
    AND created_at BETWEEN :previous_start AND :previous_end
)
SELECT 
  ((current_period.revenue - previous_period.revenue) / previous_period.revenue) * 100 AS growth_rate
FROM current_period, previous_period
```

**User Growth Rate:**
```sql
WITH current_period AS (
  SELECT COUNT(*) AS user_count
  FROM profile
  WHERE created_at <= :current_end
),
previous_period AS (
  SELECT COUNT(*) AS user_count
  FROM profile
  WHERE created_at <= :previous_end
)
SELECT 
  ((current_period.user_count - previous_period.user_count) / previous_period.user_count) * 100 AS growth_rate
FROM current_period, previous_period
```

### Order Metrics

**Order Count:**
```sql
SELECT COUNT(*)
FROM marketplace_order
WHERE created_at BETWEEN :start_date AND :end_date
  [AND farmer_id = :farmer_id]
  [AND buyer_id = :buyer_id]
```

**Order Status Distribution:**
```sql
SELECT 
  status,
  COUNT(*) AS count
FROM marketplace_order
WHERE created_at BETWEEN :start_date AND :end_date
GROUP BY status
```

**Completion Rate:**
```sql
SELECT 
  COUNT(CASE WHEN status IN ('completed', 'delivered') THEN 1 END) * 100.0 / COUNT(*) AS completion_rate
FROM marketplace_order
WHERE created_at BETWEEN :start_date AND :end_date
```

### Stock Metrics

**Current Stock:**
```sql
SELECT SUM(quantity)
FROM inventory_item
WHERE center_id = :center_id
  AND status = 'active'
```

**Stock In/Out:**
```sql
SELECT 
  type,
  SUM(quantity) AS total_quantity
FROM stock_transaction
WHERE center_id = :center_id
  AND created_at BETWEEN :start_date AND :end_date
GROUP BY type
```

**Capacity Utilization:**
```sql
SELECT 
  (SUM(inventory_item.quantity) / aggregation_center.capacity) * 100 AS utilization_percentage
FROM inventory_item
JOIN aggregation_center ON inventory_item.center_id = aggregation_center.id
WHERE inventory_item.center_id = :center_id
  AND inventory_item.status = 'active'
```

---

## Time Series & Trends

### Daily Aggregation

```sql
SELECT 
  DATE(created_at) AS date,
  COUNT(*) AS orders,
  SUM(total_amount) AS revenue,
  SUM(total_quantity) AS volume
FROM marketplace_order
WHERE created_at BETWEEN :start_date AND :end_date
  AND status IN ('completed', 'delivered')
GROUP BY DATE(created_at)
ORDER BY date
```

### Weekly Aggregation

```sql
SELECT 
  DATE_TRUNC('week', created_at) AS week,
  COUNT(*) AS orders,
  SUM(total_amount) AS revenue,
  SUM(total_quantity) AS volume
FROM marketplace_order
WHERE created_at BETWEEN :start_date AND :end_date
  AND status IN ('completed', 'delivered')
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week
```

### Monthly Aggregation

```sql
SELECT 
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS orders,
  SUM(total_amount) AS revenue,
  SUM(total_quantity) AS volume
FROM marketplace_order
WHERE created_at BETWEEN :start_date AND :end_date
  AND status IN ('completed', 'delivered')
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month
```

---

## Leaderboards

### Revenue Leaderboard

```sql
SELECT 
  p.user_id AS id,
  p.name,
  ROW_NUMBER() OVER (ORDER BY SUM(o.total_amount) DESC) AS rank,
  SUM(o.total_amount) AS total_revenue,
  COUNT(o.id) AS order_count,
  SUM(o.total_quantity) AS total_sales,
  p.sub_county
FROM profile p
JOIN marketplace_order o ON o.farmer_id = p.user_id
WHERE o.status IN ('completed', 'delivered')
  AND o.created_at BETWEEN :start_date AND :end_date
  [AND p.sub_county = :subcounty]
GROUP BY p.user_id, p.name, p.sub_county
ORDER BY total_revenue DESC
LIMIT :limit
```

### Rating Leaderboard

```sql
SELECT 
  p.user_id AS id,
  p.name,
  ROW_NUMBER() OVER (ORDER BY AVG(r.overall_rating) DESC) AS rank,
  AVG(r.overall_rating) AS avg_rating,
  COUNT(r.id) AS rating_count
FROM profile p
JOIN rating r ON r.rated_user_id = p.user_id
WHERE r.created_at BETWEEN :start_date AND :end_date
  [AND p.sub_county = :subcounty]
GROUP BY p.user_id, p.name
HAVING COUNT(r.id) >= 3 -- Minimum ratings for ranking
ORDER BY avg_rating DESC
LIMIT :limit
```

---

## Reports

### Report Types

1. **Sales Report**
   - Revenue by period
   - Orders by status
   - Top products/varieties
   - Sales by region
   - Customer analysis

2. **Stock Report**
   - Current inventory
   - Stock movements
   - Stock aging
   - Quality distribution
   - Wastage analysis

3. **Performance Report**
   - KPIs and metrics
   - Trends over time
   - Comparison with targets
   - Performance by region

4. **Financial Report**
   - Revenue breakdown
   - Payment status
   - Escrow transactions
   - Platform fees
   - Outstanding payments

5. **Quality Report**
   - Quality scores
   - Grade distribution
   - Quality trends
   - Quality by region/farmer

6. **Farmer Report**
   - Farmer statistics
   - Production volumes
   - Revenue per farmer
   - Farmer activity
   - Registration trends

7. **Buyer Report**
   - Buyer statistics
   - Procurement volumes
   - Supplier relationships
   - Purchase patterns

---

## Advisories

### Advisory Types

1. **Best Practice**: Farming best practices, quality tips
2. **Warning**: Quality issues, market warnings
3. **Alert**: Urgent notifications, deadlines
4. **Information**: General information, updates
5. **Training**: Training opportunities, workshops

### Advisory Delivery

- Target by role (farmer, buyer, etc.)
- Target by location (sub-county, county)
- Target by farmer group
- Individual targeting

### Advisory Metrics

- Delivery count
- Read count
- Views
- Impact metrics (orders increase, engagement increase)

---

## Implementation Priority

### Phase 1: Core Analytics (High Priority)
1. ✅ Dashboard statistics endpoint
2. ✅ Trends endpoint
3. ✅ Leaderboards endpoint
4. ✅ Basic performance metrics

### Phase 2: Role-Specific Analytics (High Priority)
1. ✅ Farmer analytics
2. ✅ Buyer analytics
3. ✅ Staff analytics
4. ✅ Officer analytics

### Phase 3: Advanced Analytics (Medium Priority)
1. ⚠️ Reports generation
2. ⚠️ Advisories system
3. ⚠️ Advanced performance metrics
4. ⚠️ Geographic analytics

### Phase 4: Optimization (Low Priority)
1. ⚠️ Analytics caching
2. ⚠️ Real-time updates
3. ⚠️ Predictive analytics
4. ⚠️ Export functionality

---

## Database Considerations

### Indexes Required

```sql
-- Marketplace Order indexes
CREATE INDEX idx_marketplace_order_farmer_id ON marketplace_order(farmer_id);
CREATE INDEX idx_marketplace_order_buyer_id ON marketplace_order(buyer_id);
CREATE INDEX idx_marketplace_order_status ON marketplace_order(status);
CREATE INDEX idx_marketplace_order_created_at ON marketplace_order(created_at);
CREATE INDEX idx_marketplace_order_status_created_at ON marketplace_order(status, created_at);

-- Profile indexes
CREATE INDEX idx_profile_role ON profile(role);
CREATE INDEX idx_profile_sub_county ON profile(sub_county);
CREATE INDEX idx_profile_county ON profile(county);

-- Rating indexes
CREATE INDEX idx_rating_rated_user_id ON rating(rated_user_id);
CREATE INDEX idx_rating_created_at ON rating(created_at);

-- Stock Transaction indexes
CREATE INDEX idx_stock_transaction_center_id ON stock_transaction(center_id);
CREATE INDEX idx_stock_transaction_type ON stock_transaction(type);
CREATE INDEX idx_stock_transaction_created_at ON stock_transaction(created_at);

-- Quality Check indexes
CREATE INDEX idx_quality_check_farmer_id ON quality_check(farmer_id);
CREATE INDEX idx_quality_check_created_at ON quality_check(created_at);
```

### Materialized Views (Optional)

For frequently accessed aggregations:
- Daily revenue/orders summary
- Monthly farmer statistics
- Center utilization summary

---

## API Response Examples

### Dashboard Stats Response

```json
{
  "totalRevenue": 1250000,
  "totalOrders": 450,
  "totalFarmers": 1200,
  "totalBuyers": 85,
  "totalUsers": 1285,
  "totalStock": 15000,
  "averageOrderValue": 2777.78,
  "growthRate": 15.5,
  "userGrowthRate": 12.3,
  "orderGrowthRate": 18.7,
  "revenueGrowthRate": 22.1,
  "averagePrice": 125,
  "period": "monthly",
  "dateRange": {
    "start": "2025-01-01T00:00:00Z",
    "end": "2025-01-31T23:59:59Z"
  }
}
```

### Trends Response

```json
[
  {
    "date": "2025-01-01",
    "revenue": 45000,
    "orders": 15,
    "farmers": 1200,
    "buyers": 85,
    "volume": 360
  },
  {
    "date": "2025-01-02",
    "revenue": 52000,
    "orders": 18,
    "farmers": 1205,
    "buyers": 86,
    "volume": 416
  }
]
```

### Leaderboard Response

```json
{
  "id": "leaderboard-revenue-monthly-2025-01",
  "title": "Revenue Leaderboard - January 2025",
  "metric": "revenue",
  "period": "monthly",
  "entries": [
    {
      "id": "user-123",
      "name": "John Doe",
      "rank": 1,
      "score": 125000,
      "metric": "revenue",
      "totalRevenue": 125000,
      "totalSales": 1000,
      "orderCount": 25,
      "avgRating": 4.8,
      "subCounty": "Kangundo",
      "isCurrentUser": false
    }
  ],
  "generatedAt": "2025-01-31T23:59:59Z"
}
```

---

## Next Steps

1. **Create Analytics Module Structure**
   - `analytics.module.ts`
   - `analytics.controller.ts`
   - `analytics.service.ts`
   - `analytics.dto.ts`

2. **Implement Core Endpoints**
   - Dashboard stats
   - Trends
   - Leaderboards

3. **Add Database Queries**
   - Optimize queries with proper indexes
   - Add aggregation queries
   - Implement caching where appropriate

4. **Add Role-Based Filtering**
   - Filter by user role
   - Filter by entity ownership
   - Add permission checks

5. **Testing**
   - Unit tests for calculations
   - Integration tests for endpoints
   - Performance tests for large datasets

---

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Maintained By:** Development Team
