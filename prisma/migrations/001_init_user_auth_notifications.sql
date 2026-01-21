-- ============================================
-- MIGRATION 001: Core User & Authentication
-- ============================================
-- Description: Foundation models for users, profiles, authentication, notifications, and activity logs
-- Dependencies: None (base migration)
-- ============================================

-- ============================================
-- UUIDv7 Generation Function
-- ============================================
-- Generate UUIDv7 (time-ordered UUID) as TEXT
-- Based on RFC 9562 UUID Version 7 specification
-- Pure SQL implementation for PostgreSQL 13+
-- ============================================

CREATE OR REPLACE FUNCTION gen_uuidv7() RETURNS TEXT AS $$
DECLARE
  unix_ts_ms BIGINT;
  rand_bytes BYTEA;
  uuid_bytes BYTEA;
  uuid_v7 TEXT;
  ts_high_12 BIGINT;
  ts_mid_4 BIGINT;
  ts_low_32 BIGINT;
BEGIN
  -- Get current timestamp in milliseconds since Unix epoch
  unix_ts_ms := FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
  
  -- Generate random bytes for the rest of the UUID
  rand_bytes := gen_random_bytes(10);
  
  -- Split timestamp into parts per UUIDv7 spec:
  -- 48 bits total: 12 bits (high) + 4 bits (mid) + 32 bits (low)
  ts_high_12 := (unix_ts_ms >> 36) & 4095;  -- 12 bits
  ts_mid_4 := (unix_ts_ms >> 32) & 15;      -- 4 bits
  ts_low_32 := unix_ts_ms & 4294967295;     -- 32 bits
  
  -- Build UUIDv7 bytes (RFC 9562):
  -- Bytes 0-3: 32-bit timestamp (low part, big-endian)
  -- Byte 4-5: 16-bit timestamp (mid + high, big-endian)
  -- Byte 6: version (7) in bits 4-7, timestamp high in bits 0-3
  -- Byte 7: variant (10) in bits 6-7, random in bits 0-5
  -- Bytes 8-15: random
  
  uuid_bytes := gen_random_bytes(16);
  
  -- Bytes 0-3: 32-bit timestamp low (big-endian)
  uuid_bytes := set_byte(uuid_bytes, 0, (ts_low_32 >> 24)::int & 255);
  uuid_bytes := set_byte(uuid_bytes, 1, (ts_low_32 >> 16)::int & 255);
  uuid_bytes := set_byte(uuid_bytes, 2, (ts_low_32 >> 8)::int & 255);
  uuid_bytes := set_byte(uuid_bytes, 3, ts_low_32::int & 255);
  
  -- Bytes 4-5: 16-bit timestamp (mid + high, big-endian)
  uuid_bytes := set_byte(uuid_bytes, 4, ((ts_mid_4 << 4) | (ts_high_12 >> 8))::int & 255);
  uuid_bytes := set_byte(uuid_bytes, 5, ts_high_12::int & 255);
  
  -- Byte 6: version 7 (bits 4-7 = 0111) + 4 bits timestamp high
  uuid_bytes := set_byte(uuid_bytes, 6, ((ts_high_12 & 15) << 4) | 7);
  
  -- Byte 7: variant bits (10) in bits 6-7 + 6 random bits
  uuid_bytes := set_byte(uuid_bytes, 7, (get_byte(rand_bytes, 0) & 63) | 128);
  
  -- Bytes 8-15: random
  uuid_bytes := set_byte(uuid_bytes, 8, get_byte(rand_bytes, 1));
  uuid_bytes := set_byte(uuid_bytes, 9, get_byte(rand_bytes, 2));
  uuid_bytes := set_byte(uuid_bytes, 10, get_byte(rand_bytes, 3));
  uuid_bytes := set_byte(uuid_bytes, 11, get_byte(rand_bytes, 4));
  uuid_bytes := set_byte(uuid_bytes, 12, get_byte(rand_bytes, 5));
  uuid_bytes := set_byte(uuid_bytes, 13, get_byte(rand_bytes, 6));
  uuid_bytes := set_byte(uuid_bytes, 14, get_byte(rand_bytes, 7));
  uuid_bytes := set_byte(uuid_bytes, 15, get_byte(rand_bytes, 8));
  
  -- Convert to UUID format string (8-4-4-4-12)
  uuid_v7 := encode(uuid_bytes, 'hex');
  uuid_v7 := 
    substring(uuid_v7, 1, 8) || '-' ||
    substring(uuid_v7, 9, 4) || '-' ||
    substring(uuid_v7, 13, 4) || '-' ||
    substring(uuid_v7, 17, 4) || '-' ||
    substring(uuid_v7, 21, 12);
  
  RETURN LOWER(uuid_v7);
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMENT ON FUNCTION gen_uuidv7() IS 'Generates UUIDv7 (time-ordered UUID) as TEXT following RFC 9562. Returns time-ordered UUIDs for better database indexing.';

-- ============================================
-- Create Enums
-- ============================================
CREATE TYPE "UserRole" AS ENUM (
  'FARMER',
  'BUYER',
  'TRANSPORT_PROVIDER',
  'AGGREGATION_MANAGER',
  'INPUT_PROVIDER',
  'EXTENSION_OFFICER',
  'ADMIN',
  'STAFF'
);

CREATE TYPE "UserStatus" AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'PENDING_VERIFICATION'
);

CREATE TYPE "NotificationPriority" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT'
);

-- Create Users Table
CREATE TABLE "users" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastLogin" TIMESTAMP(3),

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- Create Refresh Tokens Table
CREATE TABLE "refresh_tokens" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "token" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- Create Profiles Table
CREATE TABLE "profiles" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "userId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "nationalId" TEXT,
  "dateOfBirth" TIMESTAMP(3),
  "gender" TEXT,
  "alternatePhone" TEXT,
  "address" TEXT,
  "county" TEXT,
  "subCounty" TEXT,
  "ward" TEXT,
  "village" TEXT,
  "coordinates" TEXT,
  "businessName" TEXT,
  "businessRegNo" TEXT,
  "farmSize" DOUBLE PRECISION,
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt" TIMESTAMP(3),
  "verifiedBy" TEXT,
  "bankName" TEXT,
  "bankAccount" TEXT,
  "mpesaNumber" TEXT,
  "avatar" TEXT,
  "bio" TEXT,
  "rating" DOUBLE PRECISION DEFAULT 0,
  "totalRatings" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- Create Notifications Table
CREATE TABLE "notifications" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "priority" "NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
  "entityType" TEXT,
  "entityId" TEXT,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- Create Activity Logs Table
CREATE TABLE "activity_logs" (
  "id" TEXT NOT NULL DEFAULT gen_uuidv7(),
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- Create Foreign Keys
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create Unique Constraints
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");
CREATE UNIQUE INDEX "profiles_nationalId_key" ON "profiles"("nationalId") WHERE "nationalId" IS NOT NULL;

-- Create Indexes
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_phone_idx" ON "users"("phone");
CREATE INDEX "users_role_idx" ON "users"("role");
CREATE INDEX "users_status_idx" ON "users"("status");
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");
CREATE INDEX "profiles_userId_idx" ON "profiles"("userId");
CREATE INDEX "profiles_county_idx" ON "profiles"("county");
CREATE INDEX "profiles_ward_idx" ON "profiles"("ward");
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");
CREATE INDEX "notifications_type_idx" ON "notifications"("type");
CREATE INDEX "notifications_entityType_entityId_idx" ON "notifications"("entityType", "entityId");
CREATE INDEX "activity_logs_userId_createdAt_idx" ON "activity_logs"("userId", "createdAt");
CREATE INDEX "activity_logs_action_idx" ON "activity_logs"("action");
CREATE INDEX "activity_logs_entityType_entityId_idx" ON "activity_logs"("entityType", "entityId");

-- Create Trigger for updatedAt
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON "profiles"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add Comments
COMMENT ON TABLE "users" IS 'Core user accounts with authentication and role-based access';
COMMENT ON TABLE "profiles" IS 'Extended user profile information including location and business details';
COMMENT ON TABLE "refresh_tokens" IS 'JWT refresh tokens for maintaining user sessions';
COMMENT ON TABLE "notifications" IS 'User notifications with priority levels and entity linking';
COMMENT ON TABLE "activity_logs" IS 'Audit trail for all user actions and system events';
