# Batch Search Feature - Setup Verification

## ✅ Completed Steps

1. **Database Migration** - ✅ RUN
   - Migration file: `20260123130000_add_batch_fulltext_search/migration.sql`
   - Creates GIN index for full-text search on `batchId` and `qrCode`
   - Status: Migration has been run

2. **Backend Implementation** - ✅ COMPLETE
   - Service method: `aggregation.service.ts` → `searchBatches()`
   - Controller endpoint: `aggregation.controller.ts` → `GET /aggregation/batches/search`
   - Uses PostgreSQL full-text search with `tsvector` and `tsquery`
   - Properly parameterized queries using `Prisma.sql`

3. **Frontend Implementation** - ✅ COMPLETE
   - Service function: `aggregationService.ts` → `searchBatches()`
   - Form integration: `StockInForm.tsx` uses the search function
   - Debounced search (500ms delay)
   - Minimum query length: 2 characters

## 🔍 Verification Checklist

### Backend
- [x] Migration has been run
- [x] `searchBatches()` method exists in `aggregation.service.ts`
- [x] Controller endpoint `GET /aggregation/batches/search` exists
- [x] Prisma import added: `import { Prisma } from '@prisma/client'`
- [x] BadRequestException import added to controller

### Frontend
- [x] `searchBatches()` function exported from `aggregationService.ts`
- [x] Function imported in `StockInForm.tsx`
- [x] Search is triggered on input change (debounced)
- [x] Results are displayed when found

## 🧪 Testing the Feature

### Test the Backend Endpoint Directly

```bash
# Test with curl (replace with your auth token)
curl -X GET "http://localhost:3000/api/v1/aggregation/batches/search?q=BATCH-123&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test from Frontend

1. Navigate to the Stock In form
2. Type at least 2 characters in the "Batch ID" search field
3. Wait 500ms (debounce delay)
4. Should see search results if batches exist

## 🐛 Troubleshooting

### If search returns no results:

1. **Check if batches exist in database:**
   ```sql
   SELECT "batchId", "qrCode", "createdAt" 
   FROM stock_transactions 
   WHERE "batchId" IS NOT NULL 
   LIMIT 10;
   ```

2. **Verify the index was created:**
   ```sql
   SELECT indexname, indexdef 
   FROM pg_indexes 
   WHERE tablename = 'stock_transactions' 
   AND indexname = 'idx_stock_transactions_batch_fulltext';
   ```

3. **Test the full-text search directly:**
   ```sql
   SELECT 
     st.id,
     st."batchId",
     ts_rank(
       to_tsvector('simple', COALESCE(st."batchId", '') || ' ' || COALESCE(st."qrCode", '')),
       plainto_tsquery('simple', 'BATCH')
     ) as rank
   FROM stock_transactions st
   WHERE 
     st."batchId" IS NOT NULL
     AND to_tsvector('simple', COALESCE(st."batchId", '') || ' ' || COALESCE(st."qrCode", '')) 
         @@ plainto_tsquery('simple', 'BATCH')
   ORDER BY rank DESC
   LIMIT 10;
   ```

### If you get TypeScript errors:

1. Ensure Prisma client is generated:
   ```bash
   npx prisma generate
   ```

2. Restart the TypeScript server in your IDE

### If the endpoint returns 404:

1. Check that the route is registered in the controller
2. Verify the API prefix matches: `/api/v1/aggregation/batches/search`
3. Check backend server logs for routing errors

## 📝 API Documentation

### Endpoint
```
GET /api/v1/aggregation/batches/search
```

### Query Parameters
- `q` (required): Search query string (min 2 characters)
- `limit` (optional): Maximum number of results (default: 10, max: 50)

### Response
Returns an array of `StockTransaction` objects sorted by relevance (rank) and date.

### Example Request
```
GET /api/v1/aggregation/batches/search?q=BATCH-1234567890&limit=10
```

### Example Response
```json
[
  {
    "id": "uuid",
    "batchId": "BATCH-1234567890-123",
    "qrCode": "QR-BATCH-1234567890-123",
    "variety": "kenya",
    "quantity": 100,
    "qualityGrade": "A",
    "farmerId": "uuid",
    "farmerName": "John Doe",
    "centerId": "uuid",
    "centerName": "Main Center",
    "createdAt": "2026-01-23T12:00:00Z",
    "type": "stock_in",
    "transactionNumber": "ST-20260123-001",
    "center": { ... },
    "farmer": { ... },
    "order": { ... }
  }
]
```

## ✨ Next Steps

The feature should be fully functional. If you encounter any issues:

1. Check backend logs for SQL errors
2. Verify the migration was applied successfully
3. Test the endpoint directly with curl/Postman
4. Check browser console for frontend errors
5. Verify API authentication is working
