# Deprecation Notice

## Deprecated Files

The following files have been deprecated and are maintained only for backwards compatibility:

### `index.js` - DEPRECATED
- **Status**: Deprecated
- **Replacement**: Use `core-swap.js` directly
- **Maintained**: Thin wrapper that forwards to `core-swap.js`
- **Original Behavior**: CLI support, detailed balance checking, direct route preference
- **Exports**: `JupiterSwapBot` (default), `CoreSwap` (named export)

### `jupiter-swap.js` - DEPRECATED  
- **Status**: Deprecated
- **Replacement**: Use `core-swap.js` directly
- **Maintained**: Thin wrapper that forwards to `core-swap.js`
- **Original Behavior**: Basic swap functionality, shared accounts, indirect routes
- **Exports**: `JupiterSwapBot` (default), `CoreSpot` (named export)

## Migration Guide

### For Direct Usage
```javascript
// OLD - Using deprecated files
import JupiterSwapBot from './index.js';
import JupiterSwapBot from './jupiter-swap.js';

// NEW - Using the new core module
import CoreSwap from './core-swap.js';
```

### For Library Usage
```javascript
// OLD
import JupiterSwapBot from './jupiter-swap.js';
const bot = new JupiterSwapBot();
await bot.performSwap();

// NEW
import CoreSwap from './core-swap.js';
const swap = new CoreSwap({
  useSharedAccounts: true,  // jupiter-swap.js behavior
  onlyDirectRoutes: false,  // jupiter-swap.js behavior
  includeDetailedBalance: false // jupiter-swap.js behavior
});
const result = await swap.performSwap();
const signature = result.signature;
```

### For CLI Usage
```bash
# OLD - Still works (deprecated wrapper)
node index.js --priority-fee-mode fixed --fixed-priority-fee 1000

# NEW - Recommended approach
node -e "
import CoreSwap from './core-swap.js';
const swap = new CoreSwap({ includeDetailedBalance: true });
await swap.performSwap({ priorityFeeMicroLamports: 1000 });
"
```

## Benefits of Migration

1. **Better Performance**: Direct usage without wrapper overhead
2. **More Flexibility**: Access to all configuration options
3. **Future-Proof**: New features will be added to `core-swap.js`
4. **Cleaner API**: More consistent and modern interface
5. **Better Documentation**: Comprehensive JSDoc comments

## Backwards Compatibility

The deprecated files will continue to work exactly as before, but:
- No new features will be added
- Bug fixes will be applied to `core-swap.js` first
- These files may be removed in a future major version

## Support Timeline

- **Current**: All files work as expected
- **Next Minor**: Deprecation warnings (if any)
- **Next Major**: Deprecated files may be removed

Please migrate to `core-swap.js` at your earliest convenience.
