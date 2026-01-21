# Prisma Migration Guide - Stage by Stage

**How to create and apply migrations for the OFSP Platform database schema**

---

## Prerequisites

1. **PostgreSQL Database** - Running and accessible
2. **Environment File** - `.env` with `DATABASE_URL`
3. **Prisma Installed** - `npm install -D prisma @prisma/client`

---

## Migration Strategy

### Option A: Single Comprehensive Migration (Recommended for New Projects)

Create one migration with the complete schema:

```bash
# 1. Ensure .env file exists with DATABASE_URL
# 2. Create migration
npm run prisma:migrate -- --name init_complete_schema

# 3. Generate Prisma Client
npm run prisma:generate

# 4. Seed database
npm run prisma:seed
```

### Option B: Staged Migrations (For Incremental Development)

Create migrations stage by stage:

#### Stage 1: Core Foundation
```bash
# Edit schema.prisma to include only Stage 1 models
# Then run:
npm run prisma:migrate -- --name 001_init_user_auth_notifications
```

#### Stage 2: Marketplace
```bash
# Add Stage 2 models to schema.prisma
npm run prisma:migrate -- --name 002_marketplace_listings_orders
```

#### Stage 3: Negotiations & RFQ
```bash
# Add Stage 3 models
npm run prisma:migrate -- --name 003_negotiations_rfq
```

#### Stage 4: Transport
```bash
# Add Stage 4 models
npm run prisma:migrate -- --name 004_transport_pickup_schedules
```

#### Stage 5: Aggregation
```bash
# Add Stage 5 models
npm run prisma:migrate -- --name 005_aggregation_storage
```

#### Stage 6: Payments
```bash
# Add Stage 6 models
npm run prisma:migrate -- --name 006_payments_escrow
```

#### Stage 7: Inputs
```bash
# Add Stage 7 models
npm run prisma:migrate -- --name 007_input_orders
```

#### Stage 8: Ratings & Advisories
```bash
# Add Stage 8 models
npm run prisma:migrate -- --name 008_ratings_advisories
```

---

## Current Schema Status

✅ **Complete Schema Ready** - All 8 stages included in `schema.prisma`

**Total Models:** 32
- User & Auth: 5 models
- Marketplace: 2 models
- Negotiations & RFQ: 7 models
- Transport: 7 models
- Aggregation: 5 models
- Payments: 2 models
- Inputs: 2 models
- Ratings: 2 models

---

## Next Steps

1. **Create `.env` file:**
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/jirani_ofsp?schema=public"
   ```

2. **Create initial migration:**
   ```bash
   cd C:\Users\nmwan\projects\jirani-f\ospf\backend\backend
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

5. **Verify:**
   ```bash
   npm run prisma:studio
   ```

---

## Migration Customization

If you want to add custom SQL functions or constraints, edit the migration SQL file after creation:

```bash
# Create migration (don't apply yet)
npm run prisma:migrate -- --name init_with_functions --create-only

# Edit the generated SQL file in prisma/migrations/XXX_init_with_functions/migration.sql
# Add custom functions, triggers, etc.

# Apply the migration
npm run prisma:migrate deploy
```

---

## Example Custom SQL Functions

### Order Number Generation
```sql
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('order_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;
```

### Batch ID Generation
```sql
CREATE OR REPLACE FUNCTION generate_batch_id(variety TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN UPPER(SUBSTRING(variety, 1, 3)) || '-' || 
         TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
         LPAD(NEXTVAL('batch_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;
```

### Capacity Calculation Trigger
```sql
CREATE OR REPLACE FUNCTION update_center_capacity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE aggregation_centers
  SET current_stock = (
    SELECT COALESCE(SUM(quantity), 0)
    FROM inventory_items
    WHERE center_id = NEW.center_id
  )
  WHERE id = NEW.center_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_capacity_update
AFTER INSERT OR UPDATE OR DELETE ON inventory_items
FOR EACH ROW EXECUTE FUNCTION update_center_capacity();
```

---

## Troubleshooting

### "Environment variable not found: DATABASE_URL"
- Create `.env` file in backend root
- Add `DATABASE_URL` with your PostgreSQL connection string

### "Migration failed"
- Check database connection
- Verify PostgreSQL is running
- Check user permissions
- Review migration SQL for errors

### "Model not found" errors
- Ensure all models are defined in schema.prisma
- Run `npm run prisma:generate` after schema changes
- Check for typos in model names

---

## Schema Validation

Before creating migrations, validate the schema:

```bash
npx prisma validate
```

This will catch:
- Missing required fields
- Invalid relationships
- Type mismatches
- Enum issues

---

**Ready to proceed with migrations!**
