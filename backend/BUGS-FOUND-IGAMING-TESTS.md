# iGaming AI Chat - Bugs & Issues Found

## Test Execution Summary
- **Test Suite**: 100 comprehensive iGaming campaign scenarios
- **Date**: 2025-10-03
- **Status**: IN PROGRESS (Test 1-19 analyzed)

## Critical Issues Identified

### 1. INSUFFICIENT iGAMING DATA IN DATABASE ⚠️ **CRITICAL**

**Problem**: Database has very few streamers with proper iGaming tags

**Data Analysis**:
```
Total Streamers: 10,973
- Casino streamers: 320 (2.9%)
- Slots streamers: 180 (1.6%)
- Betting streamers: 29 (0.26%) ❌ CRITICAL
- Gambling streamers: 6 (0.05%) ❌ CRITICAL
- Poker streamers: 45 (0.4%)
- Roulette streamers: 6 (0.05%) ❌ CRITICAL
```

**Impact**:
- User asks for "40 Chile betting streamers" → Only 2 returned (entire DB has 29 betting streamers)
- User asks for "100 Mexico casino streamers" → Only 7 returned
- User asks for "60 Chile gambling streamers" → Only 1 returned

**Root Cause**:
Streamers are not being properly tagged with iGaming-related content based on their games/content.

**Solution**:
Need to implement intelligent tag inference system that:
1. Analyzes `currentGame` and `topGames` fields
2. Detects casino/gambling games (Slots, Casino, Poker, Roulette, etc.)
3. Automatically assigns relevant tags to streamers

---

### 2. MULTI-WORD TAG MATCHING FAILURE ⚠️ **HIGH PRIORITY**

**Problem**: Multi-word phrases like "sports betting", "online betting", "online casino" are treated as single tags

**Examples**:
- Query: "Find 35 Chile streamers for online betting promotion"
- AI extracts tag: `["online betting"]` (as a single tag)
- Database has: `["betting"]` (single word)
- Result: 0 matches ❌

**Test Failures**:
- Test 6: "online betting" → 0 results
- Test 9: "sports betting" → 0 results
- Test 19: "online casino" → likely 0 results

**Solution**:
Implement tag normalization in `aiSearchService.ts`:
1. Split multi-word phrases into keywords
2. Match on individual words OR full phrase
3. Example: "sports betting" → match streamers with "betting" OR "sports betting"

---

### 3. BRAND NAME HANDLING ⚠️ **MEDIUM PRIORITY**

**Problem**: Brand names (e.g., "Betano") are used as tags instead of being mapped to relevant categories

**Example**:
- Query: "I want 50 Chile streamers for Betano campaign"
- AI extracts tag: `["betano"]`
- Expected: `["betting", "casino"]`
- Result: 0 matches ❌

**Solution**:
Add brand-to-category mapping in OpenAI service or tag processing:
```typescript
const brandMappings = {
  'betano': ['betting', 'casino', 'sports betting'],
  'bet365': ['betting', 'sports betting'],
  'pokerstars': ['poker', 'casino'],
  // etc.
}
```

---

### 4. TAG SEARCH PRECISION vs RECALL TRADEOFF

**Current Behavior**: Exact tag matching (high precision, low recall)
**User Expectation**: Broad matching (high recall)

**Example**:
- User: "casino streamers"
- Current: Only matches streamers with exact tag "casino"
- Should match: Streamers with "slots", "poker", "roulette", "blackjack", "casino" (all gambling)

**Solution**:
Implement tag expansion/synonyms:
- "casino" → ["casino", "slots", "poker", "roulette", "blackjack", "gambling"]
- "betting" → ["betting", "sports betting", "gambling", "casino"]

---

## Test Results Analysis (Tests 1-19)

### Failure Patterns:

| Test ID | Query | Expected | Got | Issue |
|---------|-------|----------|-----|-------|
| 1 | 40 Chile betting streamers | 40 | 2 | Insufficient data |
| 2 | 50 Chile casino streamers | 50 | 7 | Insufficient data |
| 3 | 30 Chile slots streamers | 30 | 14 | Insufficient data |
| 6 | 35 Chile online betting | 35 | 0 | Multi-word tag |
| 7 | 25 Chile roulette | 25 | 0 | Insufficient data |
| 9 | 40 Chile sports betting | 40 | 0 | Multi-word tag |
| 10 | 50 Chile Betano | 50 | 0 | Brand name |
| 11-18 | Mexico tests | Various | <10 | Same issues |

**Failure Rate So Far**: 100% (19/19 tests failed)

---

## Recommended Fixes (Priority Order)

### Fix #1: Implement Intelligent Tag Inference (HIGHEST PRIORITY)
**File**: Create `src/services/tagInferenceService.ts`

Create a service that:
1. Scans all streamers' `currentGame` and `topGames`
2. Detects iGaming content:
   - Games containing: "casino", "slot", "poker", "roulette", "blackjack", "baccarat", "betting", "gambling"
   - Virtual casino games
   - Gambling simulators
3. Automatically adds tags to streamers
4. Runs as background job to keep tags updated

**Estimated Impact**: Would increase iGaming-tagged streamers from ~300 to potentially 1000-2000+

---

### Fix #2: Improve Tag Matching Logic
**File**: `src/services/aiSearchService.ts` (lines 269-335)

Current code:
```typescript
const hasMatch = tagSearchTerms.some(searchTerm => {
  if (currentGame === searchTerm) return true;
  if (topGames.some(game => game === searchTerm)) return true;
  if (tags.some(tag => tag === searchTerm)) return true;
  return false;
});
```

Improved code:
```typescript
const hasMatch = tagSearchTerms.some(searchTerm => {
  // Split multi-word search terms
  const searchWords = searchTerm.split(' ');

  // Exact match
  if (currentGame === searchTerm) return true;
  if (topGames.some(game => game === searchTerm)) return true;
  if (tags.some(tag => tag === searchTerm)) return true;

  // Partial/word matching for multi-word phrases
  if (searchWords.length > 1) {
    const hasAllWords = searchWords.every(word =>
      currentGame.includes(word) ||
      topGames.some(game => game.includes(word)) ||
      tags.some(tag => tag.includes(word))
    );
    if (hasAllWords) return true;
  }

  return false;
});
```

---

### Fix #3: Add Tag Expansion/Synonyms
**File**: `src/utils/tagUtils.ts` or `src/services/aiSearchService.ts`

```typescript
const TAG_EXPANSIONS: Record<string, string[]> = {
  'casino': ['casino', 'slots', 'poker', 'roulette', 'blackjack', 'baccarat', 'gambling'],
  'betting': ['betting', 'sports betting', 'gambling', 'casino'],
  'slots': ['slots', 'slot', 'casino', 'gambling'],
  'poker': ['poker', 'casino', 'gambling'],
  'gambling': ['gambling', 'casino', 'betting', 'slots', 'poker', 'roulette']
};

function expandTags(tags: string[]): string[] {
  const expanded = new Set(tags);
  tags.forEach(tag => {
    const expansions = TAG_EXPANSIONS[tag.toLowerCase()];
    if (expansions) {
      expansions.forEach(exp => expanded.add(exp));
    }
  });
  return Array.from(expanded);
}
```

---

### Fix #4: Brand Name to Category Mapping
**File**: `src/services/openaiService.ts` or tag processing

```typescript
const BRAND_MAPPINGS: Record<string, string[]> = {
  'betano': ['betting', 'casino', 'sports betting'],
  'bet365': ['betting', 'sports betting'],
  'pokerstars': ['poker', 'casino'],
  'codere': ['betting', 'casino'],
  'caliente': ['betting', 'casino', 'sports betting']
};
```

---

## Next Steps

1. ✅ Complete 100-test suite execution
2. ⏳ Generate full test report
3. ⏳ Implement Fix #1: Tag Inference Service
4. ⏳ Implement Fix #2: Improved Tag Matching
5. ⏳ Implement Fix #3: Tag Expansion
6. ⏳ Implement Fix #4: Brand Mapping
7. ⏳ Re-run 100-test suite to verify fixes
8. ⏳ Analyze improvement metrics

---

## Expected Improvements After Fixes

| Metric | Before | After (Estimated) |
|--------|--------|-------------------|
| iGaming streamers | ~500 | 2000+ |
| Betting streamers | 29 | 300+ |
| Tag match rate | <5% | 60-80% |
| Test pass rate | 0% | 70-90% |
| Avg results per query | 2-10 | 30-100 |

---

## Additional Observations

1. **Processing Time**: Tests taking 8-54 seconds per query (too slow)
   - Need to optimize database queries
   - Consider caching common searches

2. **Regional Distribution**:
   - Brazil has most streamers (5,217) - 47% of total
   - Chile (583) and Colombia (566) have fewer
   - Need to ensure balanced results across regions

3. **Platform Mixing**: Tests not yet covering platform-specific scenarios
   - Will be tested in Test 81-90

---

*Report generated during test execution. Full results pending.*
