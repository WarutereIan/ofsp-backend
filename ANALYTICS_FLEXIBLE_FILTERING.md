# Analytics Flexible Time Filtering

**Date:** January 2025  
**Purpose:** Document how to use flexible time filtering for analytics instead of hardcoded periods

---

## Overview

All analytics endpoints now support flexible time filtering through the `timeRange` and `dateRange` parameters. This means features like "Monthly earnings (6 months)" or "Weekly trends (8 weeks)" can be achieved by simply passing the appropriate time range parameters, rather than having hardcoded periods.

---

## Time Filtering Parameters

### Available Parameters

1. **`timeRange`** - Quick time range selector
   - `day` - Today
   - `week` - Last 7 days
   - `month` - Current month
   - `quarter` - Current quarter
   - `year` - Current year
   - `all` - All time (defaults to last 30 days)

2. **`dateRange`** - Custom date range
   - `startDate` - ISO 8601 date string
   - `endDate` - ISO 8601 date string

3. **`period`** - Time period granularity (for trends)
   - `daily` - Group by day
   - `weekly` - Group by week
   - `monthly` - Group by month
   - `quarterly` - Group by quarter
   - `yearly` - Group by year

---

## Examples

### Monthly Earnings (6 Months)

**Before (Hardcoded):** Would require a specific endpoint for "6 months"

**Now (Flexible):**
```http
GET /analytics/trends?startDate=2024-07-01&endDate=2024-12-31&period=monthly
```

Or using time range:
```http
GET /analytics/trends?timeRange=month&period=monthly
# Then adjust startDate/endDate for exactly 6 months
```

### Weekly Earnings Trend (8 Weeks)

**Before (Hardcoded):** Would require a specific endpoint for "8 weeks"

**Now (Flexible):**
```http
GET /analytics/transport-provider?startDate=2024-11-01&endDate=2024-12-31&period=weekly
```

### Monthly Production Trend (12 Months)

**Before (Hardcoded):** County officer analytics had hardcoded 12 months

**Now (Flexible):**
```http
GET /analytics/county-officer?timeRange=year&period=monthly
```

Or custom:
```http
GET /analytics/county-officer?startDate=2024-01-01&endDate=2024-12-31&period=monthly
```

### Price Trends (30 Days)

**Before (Hardcoded):** Market info had hardcoded 30 days

**Now (Flexible):**
```http
GET /analytics/market-info?timeRange=month
```

Or custom:
```http
GET /analytics/market-info?startDate=2024-12-01&endDate=2024-12-31
```

---

## Updated Endpoints

### Market Info
- ✅ Now accepts `timeRange` and `dateRange` parameters
- ✅ Price trends use flexible time range instead of hardcoded 30 days
- ✅ Previous period comparison uses calculated period instead of fixed 30 days

### County Officer Analytics
- ✅ Monthly production trend now uses flexible time range from filters
- ✅ Automatically calculates number of months based on date range
- ✅ Capped at 24 months for performance

### Transport Provider Analytics
- ✅ Weekly earnings trend now uses flexible time range from filters
- ✅ Automatically calculates number of weeks based on date range
- ✅ Capped at 52 weeks for performance

### All Trend Endpoints
- ✅ All support flexible time filtering via `timeRange` and `dateRange`
- ✅ All support flexible granularity via `period` parameter

---

## Benefits

1. **Flexibility** - Users can request any time period, not just predefined ones
2. **Consistency** - All endpoints use the same filtering mechanism
3. **Maintainability** - No hardcoded periods to update
4. **Performance** - Can optimize queries based on requested range
5. **User Experience** - Frontend can provide any time range selector

---

## Migration Notes

### For Frontend Developers

Instead of calling specific endpoints for "6 months" or "8 weeks", use:

```typescript
// Monthly earnings for 6 months
const sixMonthsAgo = new Date();
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

const response = await fetch(
  `/api/v1/analytics/trends?startDate=${sixMonthsAgo.toISOString()}&endDate=${new Date().toISOString()}&period=monthly`
);

// Weekly earnings for 8 weeks
const eightWeeksAgo = new Date();
eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

const response = await fetch(
  `/api/v1/analytics/transport-provider?startDate=${eightWeeksAgo.toISOString()}&endDate=${new Date().toISOString()}&period=weekly`
);
```

---

## Performance Considerations

1. **Automatic Capping** - Long periods are automatically capped:
   - Monthly trends: Max 24 months
   - Weekly trends: Max 52 weeks
   - Daily trends: No cap (but consider performance)

2. **Query Optimization** - Indexes are optimized for date range queries

3. **Caching** - Consider caching results for frequently requested ranges

---

## Testing

Test flexible filtering with various combinations:

```bash
# 6 months monthly
curl "http://localhost:3000/api/v1/analytics/trends?startDate=2024-07-01&endDate=2024-12-31&period=monthly"

# 8 weeks weekly
curl "http://localhost:3000/api/v1/analytics/transport-provider?startDate=2024-11-01&endDate=2024-12-31&period=weekly"

# Custom 3 months
curl "http://localhost:3000/api/v1/analytics/farmer?startDate=2024-10-01&endDate=2024-12-31"
```

---

**Document Version:** 1.0  
**Last Updated:** January 2025
