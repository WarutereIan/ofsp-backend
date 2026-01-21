# Prisma Schema - OFSP Platform

**Complete database schema for the Orange Fleshed Sweet Potato Value Chain Platform**

---

## 📋 Quick Start

1. **Set up environment:**
   ```bash
   # Create .env file with DATABASE_URL
   DATABASE_URL="postgresql://user:password@localhost:5432/jirani_ofsp?schema=public"
   ```

2. **Create and apply migration:**
   ```bash
   npm run prisma:migrate -- --name init_complete_schema
   ```

3. **Generate Prisma Client:**
   ```bash
   npm run prisma:generate
   ```

4. **Seed database:**
   ```bash
   npm run prisma:seed
   ```

---

## 📊 Schema Statistics

- **Total Models:** 32
- **Total Enums:** 20+
- **Database:** PostgreSQL
- **ORM:** Prisma 6.x

---

## 🗂️ Model Organization

### Core (5 models)
- User, Profile, RefreshToken, Notification, ActivityLog

### Marketplace (2 models)
- ProduceListing, MarketplaceOrder

### Negotiations & RFQ (7 models)
- Negotiation, NegotiationMessage, RFQ, RFQResponse
- SourcingRequest, SupplierOffer, RecurringOrder

### Transport (7 models)
- TransportRequest, FarmPickupSchedule, PickupLocation
- PickupSlot, PickupSlotBooking, PickupReceipt, TrackingUpdate

### Aggregation (5 models)
- AggregationCenter, StockTransaction, InventoryItem
- QualityCheck, WastageEntry

### Payments (2 models)
- Payment, EscrowTransaction

### Inputs (2 models)
- Input, InputOrder

### Ratings (2 models)
- Rating, Advisory

---

## 🔑 Key Features

### Traceability
- Batch IDs and QR codes throughout
- Full lifecycle tracking
- Status history (JSON arrays)

### Relationships
- Comprehensive foreign keys
- Cascade deletes
- Denormalized fields for performance

### Indexes
- Strategic indexes on:
  - Foreign keys
  - Status fields
  - Search fields
  - Composite indexes

### Grading Matrix
- QualityCheck includes 4 criteria:
  - Weight Range
  - Color Intensity (1-10)
  - Physical Condition
  - Freshness
- Automatic grade calculation support

---

## 📚 Documentation

- `SCHEMA_STAGES.md` - Stage-by-stage breakdown
- `MIGRATION_PLAN.md` - Migration planning
- `MIGRATION_GUIDE.md` - How to create migrations
- `SCHEMA_SUMMARY.md` - Complete schema overview

---

## 🛠️ Common Commands

```bash
# Generate Prisma Client
npm run prisma:generate

# Create migration
npm run prisma:migrate

# Apply migrations
npx prisma migrate deploy

# Open Prisma Studio
npm run prisma:studio

# Seed database
npm run prisma:seed

# Validate schema
npx prisma validate

# Format schema
npx prisma format
```

---

## 📝 Notes

- Schema is based on `ENTITY_LIFECYCLE_MAPPING.md` documentation
- All entity types from frontend TypeScript types are included
- Relationships match the documented workflows
- Status enums match frontend type definitions
- Batch traceability is built-in throughout

---

**Schema is ready for migration!** 🚀
