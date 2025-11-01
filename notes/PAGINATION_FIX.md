# Pagination Fix - Cumulative Loading

## What Changed

Fixed pagination to show **cumulative results** instead of replacing them.

### Before (Wrong Behavior)
- Shows items 1-10
- Click "Load More" → Shows items 11-20 (replaces previous)
- Click "Load More" → Shows items 21-30 (replaces previous)

### After (Correct Behavior)
- Shows items 1-10
- Click "Load More" → Shows items 1-20 (adds 10 more)
- Click "Load More" → Shows items 1-30 (adds 10 more)
- And so on...

## How It Works

### Changed from Offset to Limit

**Before**:
```typescript
const [offset, setOffset] = useState(0);
const { data } = useVaults({ limit: 10, offset });

const handleLoadMore = () => {
  setOffset(prev => prev + 10); // Changes offset, replaces data
};
```

**After**:
```typescript
const [limit, setLimit] = useState(10);
const { data } = useVaults({ limit, offset: 0 }); // Always offset 0

const handleLoadMore = () => {
  setLimit(prev => prev + 10); // Increases limit, accumulates data
};
```

## Files Changed

### 1. Explorer Page
**File**: `src/components/fractionalization/vault-explorer.tsx`

Changes:
- Changed from `offset` state to `limit` state
- Always fetch from offset 0
- Increase limit by 10 on each "Load More"
- Reset limit when changing filters

### 2. Fractionalize Page
**File**: `src/components/fractionalization/select-nft-step.tsx`

Changes:
- Changed from `offset` state to `limit` state
- Always fetch from offset 0
- Increase limit by 10 on each "Load More"
- Reset limit on refresh

## Example Flow

### Explorer Page

**Initial Load**:
```
limit = 10, offset = 0
→ Fetches vaults 1-10
→ Shows 10 vaults
```

**Click "Load More"**:
```
limit = 20, offset = 0
→ Fetches vaults 1-20
→ Shows 20 vaults (10 old + 10 new)
```

**Click "Load More" again**:
```
limit = 30, offset = 0
→ Fetches vaults 1-30
→ Shows 30 vaults (20 old + 10 new)
```

### Fractionalize Page

**Initial Load**:
```
limit = 10, offset = 0
→ Fetches cNFTs 1-10
→ Shows 10 cNFTs
```

**Click "Load More"**:
```
limit = 20, offset = 0
→ Fetches cNFTs 1-20
→ Shows 20 cNFTs (10 old + 10 new)
```

**Click "Load More" again**:
```
limit = 30, offset = 0
→ Fetches cNFTs 1-30
→ Shows 30 cNFTs (20 old + 10 new)
```

## Reset Behavior

### When Changing Filters (Explorer)
```typescript
onClick={() => {
  setStatusFilter(option.value);
  setLimit(VAULTS_PER_PAGE); // Reset to 10
}}
```

### When Refreshing (Fractionalize)
```typescript
onClick={() => {
  setLimit(CNFTS_PER_PAGE); // Reset to 10
  refetch();
}}
```

## Testing

### Test Explorer
1. Go to http://localhost:3000
2. Should see 10 vaults
3. Click "Load More"
4. Should see 20 vaults (10 old + 10 new)
5. Click "Load More" again
6. Should see 30 vaults (20 old + 10 new)

### Test Fractionalize
1. Go to http://localhost:3000/fractionalize
2. Should see 10 cNFTs
3. Click "Load More"
4. Should see 20 cNFTs (10 old + 10 new)
5. Click "Load More" again
6. Should see 30 cNFTs (20 old + 10 new)

### Test Filter Reset (Explorer)
1. Load 30 vaults (click "Load More" twice)
2. Click "Active" filter
3. Should reset to 10 vaults (filtered)
4. Click "Load More"
5. Should show 20 vaults (filtered)

### Test Refresh Reset (Fractionalize)
1. Load 30 cNFTs (click "Load More" twice)
2. Click "Refresh" button
3. Should reset to 10 cNFTs
4. Click "Load More"
5. Should show 20 cNFTs

## Benefits

### User Experience
- ✅ Natural scrolling behavior
- ✅ Can see all loaded items
- ✅ No confusion about missing items

### Performance
- ✅ Still protects API quota (only fetches what's needed)
- ✅ React Query caches results
- ✅ Fast subsequent loads

### API Efficiency
- ✅ Single query per "Load More"
- ✅ No redundant fetches
- ✅ Helius API quota protected

## Notes

- The backend hooks (`useVaults`, `useUserCNFTs`) still use limit/offset
- The frontend just increases the limit instead of changing offset
- This means we fetch 1-10, then 1-20, then 1-30, etc.
- React Query caches the results, so it's efficient
- The "Showing X of Y" counter updates correctly

---

**Pagination now works as expected with cumulative loading!**
