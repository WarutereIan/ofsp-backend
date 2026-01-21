# Schema & Migration Workflow Guide

**Understanding the relationship between `schema.prisma` and SQL migrations**

---

## Two Approaches to Schema Management

### Approach 1: Schema-First (Standard Prisma Workflow) ✅ Recommended

**Flow:** `schema.prisma` → Generate Migrations → Apply to Database

```
schema.prisma (source of truth)
    ↓
prisma migrate dev
    ↓
SQL migrations generated automatically
    ↓
Database updated
```

**When to use:**
- Starting a new project
- Making schema changes
- Want Prisma to manage migrations automatically

**Commands:**
```bash
# 1. Edit schema.prisma
# 2. Generate and apply migration
npx prisma migrate dev --name your_migration_name

# 3. Generate Prisma Client
npx prisma generate
```

---

### Approach 2: Migration-First (Your Current Approach)

**Flow:** SQL Migrations → Sync `schema.prisma` → Generate Client

```
SQL migrations (source of truth)
    ↓
Sync schema.prisma manually OR
    ↓
prisma db pull (introspect database)
    ↓
schema.prisma updated
    ↓
prisma generate
```

**When to use:**
- You have custom SQL (functions, triggers, views)
- You need fine-grained control over migrations
- You're working with existing database

**Commands:**
```bash
# 1. Apply SQL migrations manually
psql -d your_database -f migrations/001_init.sql
psql -d your_database -f migrations/002_marketplace.sql
# ... etc

# 2. Option A: Introspect database to update schema.prisma
npx prisma db pull

# 2. Option B: Manually update schema.prisma to match migrations
# (Edit schema.prisma file)

# 3. Generate Prisma Client
npx prisma generate
```

---

## Your Current Situation

You've created **SQL migrations manually** with:
- Custom functions (`gen_uuidv7()`, `generate_order_number()`, etc.)
- Triggers (`update_updated_at_column()`, etc.)
- Views (`order_statistics`, etc.)
- Complex constraints

**Your schema.prisma is already manually synced** ✅

---

## Recommended Workflow Going Forward

### Option A: Continue with Manual SQL Migrations (Current Approach)

**Pros:**
- ✅ Full control over SQL
- ✅ Can include custom functions/triggers
- ✅ Better for complex database logic

**Cons:**
- ⚠️ Must manually keep schema.prisma in sync
- ⚠️ More maintenance overhead

**Workflow:**
1. Create/edit SQL migration file
2. Apply migration to database
3. **Manually update schema.prisma** to match
4. Run `npx prisma generate` to update client

**Example:**
```bash
# 1. Create migration
# Edit: prisma/migrations/010_new_feature.sql

# 2. Apply to database
psql -d $DATABASE_URL -f prisma/migrations/010_new_feature.sql

# 3. Update schema.prisma manually
# Add new model/field to schema.prisma

# 4. Generate client
npx prisma generate
```

---

### Option B: Hybrid Approach (Recommended for Future)

**Use Prisma Migrate for simple changes, SQL for complex ones**

**Workflow:**
1. **Simple schema changes** → Use `prisma migrate dev`
2. **Complex SQL (functions, triggers)** → Create SQL migration manually
3. **After SQL migration** → Run `prisma db pull` to sync schema.prisma
4. **Review and adjust** schema.prisma if needed
5. Run `npx prisma generate`

**Example:**
```bash
# Simple change: Add a field
# 1. Edit schema.prisma
model User {
  newField String?
}

# 2. Generate migration
npx prisma migrate dev --name add_new_field

# Complex change: Add custom function
# 1. Create SQL migration manually
# Edit: prisma/migrations/011_custom_function.sql
CREATE FUNCTION my_custom_function() ...

# 2. Apply SQL migration
psql -d $DATABASE_URL -f prisma/migrations/011_custom_function.sql

# 3. Sync schema.prisma (won't capture function, but will sync tables)
npx prisma db pull

# 4. Generate client
npx prisma generate
```

---

## Using `prisma db pull` (Database Introspection)

**What it does:**
- Reads your database structure
- Generates/updates `schema.prisma` to match database
- Captures: tables, columns, indexes, foreign keys, enums

**What it DOESN'T capture:**
- ❌ Custom SQL functions
- ❌ Triggers
- ❌ Views
- ❌ Custom constraints (check constraints, etc.)
- ❌ Database-level defaults (like `gen_uuidv7()`)

**When to use:**
- After applying SQL migrations
- To sync schema.prisma with database
- When schema.prisma is out of sync

**Command:**
```bash
# Pull schema from database
npx prisma db pull

# Review changes
# Edit schema.prisma if needed (add comments, adjust types)

# Generate client
npx prisma generate
```

**Important Notes:**
- `db pull` will **overwrite** your schema.prisma
- Always commit your schema.prisma before running `db pull`
- Review the generated schema carefully
- You may need to manually add:
  - Comments/documentation
  - Custom default values
  - Relation names
  - Field mappings

---

## Complete Workflow Example

### Scenario: Adding a New Feature

**Step 1: Create SQL Migration**
```sql
-- prisma/migrations/010_add_notifications.sql
CREATE TABLE "push_notifications" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "deviceType" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "push_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "push_notifications_userId_idx" ON "push_notifications"("userId");
```

**Step 2: Apply Migration**
```bash
psql -d $DATABASE_URL -f prisma/migrations/010_add_notifications.sql
```

**Step 3: Sync Schema (Option A - Introspection)**
```bash
# Pull from database
npx prisma db pull

# Review generated schema.prisma
# May need to add:
# - Relation to User model
# - Comments
# - Adjust field types
```

**Step 3: Sync Schema (Option B - Manual)**
```prisma
// Manually add to schema.prisma
model PushNotification {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  token     String
  deviceType String?
  createdAt DateTime @default(now())
  
  @@index([userId])
  @@map("push_notifications")
}

// Add relation to User model
model User {
  // ... existing fields
  pushNotifications PushNotification[]
}
```

**Step 4: Generate Client**
```bash
npx prisma generate
```

**Step 5: Verify**
```bash
# Check that schema matches database
npx prisma validate

# Test in your code
# import { PrismaClient } from '@prisma/client'
# const prisma = new PrismaClient()
# await prisma.pushNotification.findMany()
```

---

## Best Practices

### 1. Keep Schema and Migrations in Sync

**Always:**
- ✅ Update schema.prisma after applying SQL migrations
- ✅ Review schema.prisma matches your database structure
- ✅ Run `prisma validate` to check for errors

### 2. Version Control

**Commit both:**
- ✅ SQL migration files
- ✅ Updated schema.prisma
- ✅ Generated Prisma Client (optional, can be in .gitignore)

### 3. Documentation

**Document in schema.prisma:**
- ✅ Custom functions (as comments)
- ✅ Business logic (as comments)
- ✅ Complex relationships

**Example:**
```prisma
model MarketplaceOrder {
  // Custom function generates order number
  // See: migrations/002_marketplace_listings_orders.sql
  orderNumber String @unique
  
  // Denormalized field - auto-maintained by trigger
  // See: migrations/009_functions_constraints.sql
  // Trigger: update_rfq_response_count()
  totalResponses Int @default(0)
}
```

### 4. Testing Workflow

**Before deploying:**
```bash
# 1. Validate schema
npx prisma validate

# 2. Generate client
npx prisma generate

# 3. Test database connection
npx prisma db execute --stdin < migrations/001_init.sql

# 4. Run your tests
npm test
```

---

## Troubleshooting

### Schema Out of Sync

**Symptoms:**
- Prisma Client doesn't match database
- Errors when querying
- Missing fields/models

**Solution:**
```bash
# 1. Pull from database
npx prisma db pull

# 2. Review and adjust
# 3. Generate client
npx prisma generate
```

### Migration Conflicts

**Symptoms:**
- Migration already applied
- Schema mismatch errors

**Solution:**
```bash
# 1. Check migration status
npx prisma migrate status

# 2. If using manual SQL, mark as applied
# (Prisma doesn't track manual SQL migrations)

# 3. Sync schema
npx prisma db pull
```

### Custom Functions Not in Schema

**This is expected!** Prisma schema doesn't capture:
- SQL functions
- Triggers
- Views
- Stored procedures

**Solution:**
- Document in comments
- Keep SQL migrations as source of truth
- Use raw SQL queries when needed:
  ```typescript
  await prisma.$executeRaw`
    SELECT gen_uuidv7()
  `
  ```

---

## Summary

**Your Current Setup:**
- ✅ SQL migrations (source of truth for database structure)
- ✅ schema.prisma (manually synced, source of truth for Prisma Client)

**Going Forward:**
1. **Create SQL migration** → Apply to database
2. **Update schema.prisma** (manually or via `db pull`)
3. **Generate Prisma Client** → `npx prisma generate`
4. **Use in code** → Import from `@prisma/client`

**Key Commands:**
```bash
# Sync schema from database
npx prisma db pull

# Generate Prisma Client
npx prisma generate

# Validate schema
npx prisma validate

# Format schema
npx prisma format
```

---

**Your schema.prisma is already up to date!** ✅

You can now:
1. Apply your SQL migrations to the database
2. Run `npx prisma generate` to create the client
3. Start using Prisma in your NestJS application
