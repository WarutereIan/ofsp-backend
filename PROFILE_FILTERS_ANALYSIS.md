# Profile Filters Analysis

## Current State

### Backend Support (profile.controller.ts)
The backend `/api/v1/profiles` endpoint supports these query parameters:
- `role` - Filter by user role (FARMER, BUYER, etc.)
- `county` - Filter by county
- `subcounty` - Filter by sub-county
- `ward` - Filter by ward

### Frontend Type Definition (profile.ts)
The `ProfileFilters` interface currently defines:
- `role?: UserRole`
- `status?: ProfileStatus`
- `location?: string`
- `searchQuery?: string`
- `verified?: boolean`

### Frontend Service Implementation (profileService.ts)
The service is trying to use:
- `role` ✅ (matches type)
- `county` ❌ (NOT in ProfileFilters type - causes TypeScript error)
- `subcounty` ❌ (NOT in ProfileFilters type - causes TypeScript error)
- `ward` ❌ (NOT in ProfileFilters type - causes TypeScript error)

### Frontend Context (ProfileContext.tsx)
Does client-side filtering for:
- `role` ✅
- `status` ✅ (backend doesn't support - client-side only)
- `searchQuery` ✅ (backend doesn't support - client-side only)
- `verified` ✅ (backend doesn't support - client-side only)

### UX Usage Analysis

#### Users.tsx (Staff Dashboard)
- Uses: `searchQuery` (client-side), `role` filter
- Needs: Search by name/email/phone (client-side), filter by role (backend)

#### Farmers.tsx (Officer Dashboard)
- Uses: `searchQuery` (client-side), `subCountyFilter` (client-side), `statusFilter` (client-side)
- Needs: Search by name/phone/location (client-side), filter by subcounty (backend), filter by status (client-side)
- **Note**: Currently does client-side filtering for subcounty, but should use backend filter

#### PeerLeaderboard.tsx
- Uses: `filterSubCounty` (client-side)
- Needs: Filter by subcounty (backend)

#### StockInForm.tsx
- Uses: `filteredProfiles` from context (client-side filtering)
- Needs: Search/filter farmers (can use backend + client-side)

## Recommendations

### 1. Update ProfileFilters Type
Add backend-supported filters to the type:
```typescript
export interface ProfileFilters {
  // Backend-supported filters
  role?: UserRole;
  county?: string;
  subcounty?: string;  // Note: Backend uses 'subcounty', Prisma uses 'subCounty'
  ward?: string;
  
  // Client-side only filters (not supported by backend)
  status?: ProfileStatus;
  searchQuery?: string;
  verified?: boolean;
  location?: string; // Alias for searchQuery or separate field
}
```

### 2. Update Service Implementation
- Use backend filters (`role`, `county`, `subcounty`, `ward`) for API calls
- Return all results, let context handle client-side filtering for `status`, `searchQuery`, `verified`

### 3. Update Context
- Continue client-side filtering for `status`, `searchQuery`, `verified`
- Pass backend-supported filters (`county`, `subcounty`, `ward`) to service for server-side filtering

### 4. Consider Backend Enhancements
- Add `status` filter support in backend (if needed for performance)
- Add `searchQuery` support in backend (if needed for large datasets)
- Add `verified` filter support in backend (if needed)

## Implementation Plan

1. ✅ Update `ProfileFilters` type to include `county`, `subcounty`, `ward`
2. ✅ Update `profileService.ts` to properly use all backend-supported filters
3. ✅ Keep client-side filtering in context for `status`, `searchQuery`, `verified`
4. ⚠️ **UX Optimization Needed**: Update `Farmers.tsx` to use backend `subcounty` filter instead of client-side filtering

## Current Implementation Status

### ✅ Completed
- `ProfileFilters` type now includes all backend-supported filters (`county`, `subcounty`, `ward`)
- `profileService.ts` correctly uses backend filters for API calls
- Context continues client-side filtering for `status`, `searchQuery`, `verified`

### ⚠️ Recommended Improvements

#### 1. Update Farmers.tsx to use backend subcounty filter
**Current**: Does client-side filtering for `subCountyFilter`
**Recommended**: Pass `subcounty` filter to `fetchProfiles({ role: "farmer", subcounty: subCountyFilter })`

**Benefits**:
- Better performance (server-side filtering)
- Reduced data transfer
- Consistent with backend capabilities

#### 2. Consider adding backend support for common filters
If `status` or `searchQuery` filtering becomes a performance bottleneck:
- Add `status` filter to backend (if needed for large datasets)
- Add `searchQuery` support to backend (full-text search on name/phone/email)

## Filter Usage Summary

| Filter | Backend Support | Client-Side | Recommended Usage |
|--------|----------------|-------------|-------------------|
| `role` | ✅ Yes | ✅ Yes | Use backend filter |
| `county` | ✅ Yes | ❌ No | Use backend filter |
| `subcounty` | ✅ Yes | ⚠️ Currently client-side | **Move to backend filter** |
| `ward` | ✅ Yes | ❌ No | Use backend filter |
| `status` | ❌ No | ✅ Yes | Keep client-side (or add backend support) |
| `searchQuery` | ❌ No | ✅ Yes | Keep client-side (or add backend support) |
| `verified` | ❌ No | ✅ Yes | Keep client-side (or add backend support) |
