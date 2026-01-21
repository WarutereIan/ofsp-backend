# Migration Execution Guide

**Step-by-step guide to execute SQL migrations for the OFSP Platform**

---

## Prerequisites

1. **PostgreSQL Database** - Version 12 or higher
2. **Database User** - With CREATE, ALTER, and DROP privileges
3. **Connection String** - Ready in `.env` file

---

## Execution Methods

### Method 1: Using psql (Command Line)

```bash
# Set environment variable
export DATABASE_URL="postgresql://user:password@localhost:5432/jirani_ofsp"

# Run migrations in order
psql $DATABASE_URL -f prisma/migrations/001_init_user_auth_notifications.sql
psql $DATABASE_URL -f prisma/migrations/002_marketplace_listings_orders.sql
psql $DATABASE_URL -f prisma/migrations/003_negotiations_rfq.sql
psql $DATABASE_URL -f prisma/migrations/005_aggregation_storage.sql
psql $DATABASE_URL -f prisma/migrations/004_transport_pickup_schedules.sql
psql $DATABASE_URL -f prisma/migrations/006_payments_escrow.sql
psql $DATABASE_URL -f prisma/migrations/007_input_orders.sql
psql $DATABASE_URL -f prisma/migrations/008_ratings_advisories.sql
psql $DATABASE_URL -f prisma/migrations/009_functions_constraints.sql
```

### Method 2: Using pgAdmin or DBeaver

1. Open SQL editor
2. Load each migration file in order
3. Execute each file sequentially
4. Verify no errors

### Method 3: Using Prisma Migrate (Recommended)

```bash
# Prisma will detect and apply migrations
npm run prisma:migrate deploy
```

### Method 4: Using a Migration Tool Script

Create a script to run all migrations:

```bash
#!/bin/bash
# run-migrations.sh

DB_URL="${DATABASE_URL:-postgresql://user:password@localhost:5432/jirani_ofsp}"

for migration in prisma/migrations/*.sql; do
  echo "Running $(basename $migration)..."
  psql $DB_URL -f "$migration"
  if [ $? -ne 0 ]; then
    echo "Error running $migration"
    exit 1
  fi
done

echo "All migrations completed successfully!"
```

---

## Migration Order

**Important:** Run migrations in this exact order:

1. ✅ `001_init_user_auth_notifications.sql` - Base foundation
2. ✅ `002_marketplace_listings_orders.sql` - Requires users
3. ✅ `003_negotiations_rfq.sql` - Requires marketplace
4. ✅ `005_aggregation_storage.sql` - Requires marketplace (run before 004)
5. ✅ `004_transport_pickup_schedules.sql` - Requires marketplace and aggregation
6. ✅ `006_payments_escrow.sql` - Requires marketplace and transport
7. ✅ `007_input_orders.sql` - Requires users and transport
8. ✅ `008_ratings_advisories.sql` - Requires users and marketplace
9. ✅ `009_functions_constraints.sql` - Requires all tables

**Note:** Migration 005 should run before 004 because 004 references AggregationCenter.

---

## Verification Steps

After running all migrations, verify:

### 1. Check All Tables Exist

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

**Expected:** 32 tables

### 2. Check All Enums Exist

```sql
SELECT typname 
FROM pg_type 
WHERE typtype = 'e' 
ORDER BY typname;
```

**Expected:** 20+ enums

### 3. Check All Functions Exist

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;
```

**Expected:** 15+ functions

### 4. Check All Indexes

```sql
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### 5. Test Key Functions

```sql
-- Test order number generation
SELECT generate_order_number();

-- Test batch ID generation
SELECT generate_batch_id('KENYA');

-- Test payment reference
SELECT generate_payment_reference();
```

---

## Troubleshooting

### Error: "relation already exists"
- Table/enum already exists from previous migration attempt
- Solution: Drop and recreate, or use `IF NOT EXISTS` clauses

### Error: "foreign key constraint violation"
- Migration order incorrect
- Solution: Check migration dependencies and run in correct order

### Error: "type does not exist"
- Enum not created in previous migration
- Solution: Ensure migrations run in order

### Error: "function already exists"
- Function created in previous migration
- Solution: Use `CREATE OR REPLACE FUNCTION`

### Error: "permission denied"
- Database user lacks privileges
- Solution: Grant necessary permissions:
  ```sql
  GRANT CREATE ON DATABASE jirani_ofsp TO your_user;
  GRANT ALL PRIVILEGES ON SCHEMA public TO your_user;
  ```

---

## Rollback Strategy

If you need to rollback:

1. **Create rollback scripts** for each migration
2. **Run in reverse order** (009 → 001)
3. **Backup database** before rollback
4. **Test rollback** on development first

Example rollback script structure:
```sql
-- 001_init_user_auth_notifications.rollback.sql
DROP TRIGGER IF EXISTS update_users_updated_at ON "users";
DROP TRIGGER IF EXISTS update_profiles_updated_at ON "profiles";
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP TABLE IF EXISTS "activity_logs" CASCADE;
-- ... continue for all objects
```

---

## Post-Migration Steps

1. **Generate Prisma Client:**
   ```bash
   npm run prisma:generate
   ```

2. **Seed Database:**
   ```bash
   npm run prisma:seed
   ```

3. **Verify Data:**
   ```bash
   npm run prisma:studio
   ```

4. **Run Tests:**
   ```bash
   npm test
   ```

---

## Production Deployment

For production:

1. **Backup database** before migration
2. **Run migrations in transaction** (if possible)
3. **Monitor for errors** during execution
4. **Verify all objects** created successfully
5. **Test application** after migration
6. **Keep rollback scripts** ready

---

**Migrations are ready for execution!** 🚀
