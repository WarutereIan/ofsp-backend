# Migration Extraction Map

**Mapping manual SQL migrations to supplementary Prisma migrations**

---

## Overview

This document shows which content from manual SQL migrations (001-009) was extracted into the supplementary Prisma migrations.

---

## Migration 1: Custom Functions
**File:** `20260121120000_custom_functions/migration.sql`

### From 002_marketplace_listings_orders.sql:
- ✅ `generate_order_number()` function
- ✅ `generate_batch_id()` function
- ✅ `order_number_seq` sequence
- ✅ `batch_id_seq` sequence

### From 003_negotiations_rfq.sql:
- ✅ `generate_negotiation_number()` function
- ✅ `generate_rfq_number()` function
- ✅ `generate_sourcing_request_id()` function
- ✅ `negotiation_number_seq` sequence
- ✅ `rfq_number_seq` sequence
- ✅ `sourcing_request_seq` sequence

### From 004_transport_pickup_schedules.sql:
- ✅ `generate_transport_request_number()` function
- ✅ `generate_pickup_schedule_number()` function
- ✅ `generate_pickup_receipt_number()` function
- ✅ `calculate_slot_capacity()` function
- ✅ `calculate_schedule_capacity()` function
- ✅ `transport_request_seq` sequence
- ✅ `pickup_schedule_seq` sequence
- ✅ `pickup_receipt_seq` sequence

### From 005_aggregation_storage.sql:
- ✅ `generate_stock_transaction_number()` function
- ✅ `update_center_stock()` function
- ✅ `calculate_storage_duration()` function
- ✅ `stock_transaction_seq` sequence

### From 006_payments_escrow.sql:
- ✅ `generate_payment_reference()` function
- ✅ `create_escrow_on_payment_secured()` function
- ✅ `payment_reference_seq` sequence

### From 007_input_orders.sql:
- ✅ `generate_input_order_number()` function
- ✅ `update_input_stock()` function
- ✅ `input_order_seq` sequence

### From 009_functions_constraints.sql:
- ✅ `update_status_history()` function
- ✅ `user_has_role()` function
- ✅ `get_user_full_name()` function
- ✅ `create_notification()` function (uses UUIDv4)
- ✅ `update_user_rating()` function

### Skipped:
- ❌ `gen_uuidv7()` from 001 (using Prisma's UUIDv4 instead)

---

## Migration 2: Triggers
**File:** `20260121120001_triggers/migration.sql`

### From 001_init_user_auth_notifications.sql:
- ✅ `update_updated_at_column()` function
- ✅ `update_users_updated_at` trigger
- ✅ `update_profiles_updated_at` trigger

### From 002_marketplace_listings_orders.sql:
- ✅ `update_produce_listings_updated_at` trigger
- ✅ `update_marketplace_orders_updated_at` trigger

### From 003_negotiations_rfq.sql:
- ✅ `update_negotiations_updated_at` trigger
- ✅ `update_rfqs_updated_at` trigger
- ✅ `update_rfq_responses_updated_at` trigger
- ✅ `update_sourcing_requests_updated_at` trigger
- ✅ `update_supplier_offers_updated_at` trigger
- ✅ `update_recurring_orders_updated_at` trigger

### From 004_transport_pickup_schedules.sql:
- ✅ `update_transport_requests_updated_at` trigger
- ✅ `update_farm_pickup_schedules_updated_at` trigger
- ✅ `update_pickup_slots_updated_at` trigger
- ✅ `calculate_pickup_slot_capacity` trigger
- ✅ `calculate_pickup_schedule_capacity` trigger

### From 005_aggregation_storage.sql:
- ✅ `update_aggregation_centers_updated_at` trigger
- ✅ `update_inventory_items_updated_at` trigger
- ✅ `inventory_stock_update` trigger
- ✅ `calculate_inventory_storage_duration` trigger

### From 006_payments_escrow.sql:
- ✅ `update_payments_updated_at` trigger
- ✅ `update_escrow_transactions_updated_at` trigger
- ✅ `payment_escrow_creation` trigger

### From 007_input_orders.sql:
- ✅ `update_inputs_updated_at` trigger
- ✅ `update_input_orders_updated_at` trigger
- ✅ `input_order_stock_update` trigger

### From 008_ratings_advisories.sql:
- ✅ `update_ratings_updated_at` trigger
- ✅ `update_advisories_updated_at` trigger
- ✅ `rating_profile_update` trigger
- ✅ `rating_validation` trigger

### From 009_functions_constraints.sql:
- ✅ `marketplace_order_status_trigger` trigger
- ✅ `order_status_notification` trigger
- ✅ `rfq_response_count_update` trigger
- ✅ `rfq_awarded_to_update` trigger
- ✅ `sourcing_request_suppliers_update` trigger
- ✅ `supplier_offer_converted_update` trigger

---

## Migration 3: Views & Constraints
**File:** `20260121120002_views_constraints/migration.sql`

### From 009_functions_constraints.sql:
- ✅ `order_statistics` view
- ✅ `farmer_performance` view
- ✅ `center_stock_summary` view
- ✅ All check constraints (ratings, quantities, prices, capacities, color intensity)
- ✅ All partial indexes
- ✅ All table comments

### From 001-008 (Comments):
- ✅ All table comments extracted from individual migrations

---

## Summary

### Total Functions: 17
- 11 number generation functions
- 6 utility functions

### Total Triggers: 25+
- 20+ auto-update triggers
- 5+ business logic triggers

### Total Views: 3
- Analytics views

### Total Constraints: 10+
- Data validation constraints

### Total Indexes: 5+
- Performance-optimized partial indexes

---

## Migration Order

```
1. 20260121110648_initial_schema (Prisma-generated)
   ↓ Creates all tables, enums, foreign keys
   
2. 20260121120000_custom_functions
   ↓ Creates all functions needed by triggers
   
3. 20260121120001_triggers
   ↓ Creates all triggers that use functions
   
4. 20260121120002_views_constraints
   ↓ Creates views, constraints, indexes, comments
```

---

**Status:** ✅ All content extracted and organized into supplementary migrations
