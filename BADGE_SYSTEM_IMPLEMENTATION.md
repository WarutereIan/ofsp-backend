# Badge System Implementation

**Date:** January 2025  
**Status:** ✅ **Implemented**

---

## Overview

Achievement badge system for farmers based on milestones for orders, deliveries, revenue, and quality metrics. Badges are automatically checked and awarded when orders are completed.

---

## Database Schema

### Badge Model
- `id` - Unique identifier
- `type` - Badge type (unique, e.g., "first_sale", "hundred_kg")
- `name` - Display name
- `description` - Badge description
- `category` - Category (sales, quality, performance)
- `targetValue` - Target value for milestone badges (optional)
- `icon` - Icon identifier
- `color` - Color code
- `bgColor` - Background color code
- `isActive` - Whether badge is active

### BadgeProgress Model
- `id` - Unique identifier
- `userId` - User who owns this progress
- `badgeId` - Badge reference
- `currentValue` - Current progress value
- `isEarned` - Whether badge has been earned
- `earnedAt` - When badge was earned
- Unique constraint on `[userId, badgeId]`

---

## Badge Types

### Sales Badges
1. **First Sale** (`first_sale`)
   - Description: Made your first sale
   - Target: 1 completed order

2. **100kg Milestone** (`hundred_kg`)
   - Description: Sold 100kg of OFSP
   - Target: 100kg total quantity

3. **500kg Milestone** (`five_hundred_kg`)
   - Description: Sold 500kg of OFSP
   - Target: 500kg total quantity

4. **1000kg Milestone** (`thousand_kg`)
   - Description: Sold 1000kg of OFSP
   - Target: 1000kg total quantity

### Quality Badges
5. **5-Star Rating** (`five_star`)
   - Description: Achieved 5-star average rating
   - Target: 5.0 average rating

6. **Quality Champion** (`quality_champion`)
   - Description: 90%+ of orders rated Grade A
   - Target: 90% Grade A orders

### Performance Badges
7. **Fast Responder** (`fast_responder`)
   - Description: Average response time under 15 minutes
   - Target: 15 minutes (not yet implemented - requires response time tracking)

8. **Top Performer (Monthly)** (`top_performer_monthly`)
   - Description: Top seller in your sub-county this month
   - Awarded via analytics service or scheduled job

9. **Top Performer (Quarterly)** (`top_performer_quarterly`)
   - Description: Top seller in your sub-county this quarter
   - Awarded via analytics service or scheduled job

10. **Consistent Seller** (`consistent_seller`)
    - Description: Active seller for 3 consecutive months
    - Target: 3 consecutive months with sales

---

## API Endpoints

### `GET /badges/my-badges`
Get all badges with progress for the current authenticated user.

**Response:**
```json
[
  {
    "id": "uuid",
    "type": "first_sale",
    "name": "First Sale",
    "description": "Made your first sale",
    "category": "sales",
    "icon": "star",
    "color": "text-yellow-600",
    "bgColor": "bg-yellow-100",
    "earned": true,
    "earnedDate": "2025-01-15T10:30:00Z",
    "progress": 100,
    "current": 1,
    "target": undefined
  },
  {
    "id": "uuid",
    "type": "hundred_kg",
    "name": "100kg Milestone",
    "description": "Sold 100kg of OFSP",
    "category": "sales",
    "icon": "package",
    "color": "text-blue-600",
    "bgColor": "bg-blue-100",
    "earned": false,
    "earnedDate": null,
    "progress": 75,
    "current": 75,
    "target": 100
  }
]
```

### `GET /badges/farmer/:farmerId`
Get badges for a specific farmer (requires admin/staff role or be the farmer).

---

## Automatic Badge Checking

Badges are automatically checked when:
- **Order Completion**: When an order status changes to `COMPLETED` or `DELIVERED`
- **Hook Location**: `MarketplaceService.updateOrderStatus()`

### Checked Badges on Order Completion:
1. ✅ Sales volume badges (100kg, 500kg, 1000kg)
2. ✅ First sale badge
3. ✅ Quality badges (5-star rating, quality champion)
4. ✅ Performance badges (consistent seller)

### Badges Requiring Scheduled Jobs:
- **Top Performer (Monthly/Quarterly)**: Requires peer comparison, best done via scheduled job or analytics service
- **Fast Responder**: Requires response time tracking (not yet implemented)

---

## Service Methods

### `BadgeService.getUserBadges(userId: string)`
Returns all badges with progress for a user.

### `BadgeService.checkBadgesOnOrderCompletion(farmerId: string, orderId: string)`
Checks and updates badges after order completion. Called automatically from marketplace service.

### `BadgeService.awardTopPerformerBadges(farmerId: string, period: 'monthly' | 'quarterly')`
Awards top performer badges. Should be called from analytics service or scheduled job.

---

## Integration Points

### Marketplace Service
- ✅ Badge checking hook added to `updateOrderStatus()` method
- ✅ Checks badges asynchronously (non-blocking)
- ✅ Uses `forwardRef` to handle circular dependency

### Analytics Service (Future)
- Can call `awardTopPerformerBadges()` when calculating leaderboards
- Can check badges periodically via scheduled jobs

---

## Database Migration

Migration file: `prisma/migrations/add_badge_tables.sql`

To apply:
```bash
psql -d $DATABASE_URL -f prisma/migrations/add_badge_tables.sql
```

Or use Prisma migrate:
```bash
npx prisma migrate dev --name add_badge_tables
```

---

## Badge Initialization

Badges are automatically initialized when the `BadgeService` is instantiated. The `initializeBadges()` method:
- Creates badge definitions in the database
- Uses `upsert` to handle updates
- Logs initialization status

---

## Progress Tracking

- Progress is tracked in `BadgeProgress` table
- `currentValue` is updated when badges are checked
- Badge is automatically awarded when `currentValue >= targetValue`
- `earnedAt` timestamp is set when badge is awarded
- Progress percentage is calculated as: `(currentValue / targetValue) * 100`

---

## Frontend Integration

The frontend already has badge components (`AchievementBadges.tsx`) that expect:
- `type` - Badge type
- `earned` - Boolean
- `earnedDate` - ISO string
- `progress` - 0-100 percentage
- `current` - Current value
- `target` - Target value

The API response format matches these expectations.

---

## Future Enhancements

1. **Scheduled Jobs**: Add cron jobs for top performer badge checking
2. **Response Time Tracking**: Implement fast responder badge
3. **Notification**: Send notifications when badges are earned
4. **Badge History**: Track badge earning history
5. **Badge Categories UI**: Group badges by category in frontend

---

## Files Created/Modified

### Created:
- `src/modules/badge/badge.service.ts` - Badge service with milestone logic
- `src/modules/badge/badge.module.ts` - Badge module
- `src/modules/badge/badge.controller.ts` - Badge API endpoints
- `prisma/migrations/add_badge_tables.sql` - Database migration
- `BADGE_SYSTEM_IMPLEMENTATION.md` - This document

### Modified:
- `prisma/schema.prisma` - Added Badge and BadgeProgress models
- `src/app.module.ts` - Added BadgeModule import
- `src/modules/marketplace/marketplace.module.ts` - Added BadgeModule import (forwardRef)
- `src/modules/marketplace/marketplace.service.ts` - Added badge checking hook

---

**Document Version:** 1.0  
**Last Updated:** January 2025
