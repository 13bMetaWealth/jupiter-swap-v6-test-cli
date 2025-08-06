#!/usr/bin/env node

// DEPRECATED: This file is deprecated. Please use core-swap.js directly.
// This thin wrapper is maintained for backwards compatibility.

import CoreSwap from './core-swap.js';

// Legacy wrapper class for backwards compatibility
class JupiterSwapBot extends CoreSwap {
  constructor() {
    // Use the original jupiter-swap.js behavior (less detailed balance, shared accounts)
    super({ includeDetailedBalance: false, onlyDirectRoutes: false, useSharedAccounts: true });
  }

  // For backwards compatibility, we keep the original method name
  async performSwap() {
    const result = await super.performSwap({ priorityFeeMicroLamports: 'auto' });
    return result.signature; // Return signature for backwards compatibility
  }
}

// Main execution (preserved for backwards compatibility)
async function main() {
  try {
    const bot = new JupiterSwapBot();
    await bot.performSwap();
    process.exit(0);
  } catch (error) {
    console.error(`\n💥 Fatal error: ${error.message}`);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Terminated');
  process.exit(1);
});

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// Export for external imports
export default JupiterSwapBot;
export { CoreSwap };
