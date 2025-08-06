#!/usr/bin/env node

import { CoreSwap } from './core-swap.js';

// Main execution
async function main() {
    try {
        console.log('🚀 Starting Jupiter V6 SOL → USDC swap...\n');
        
        const swapper = new CoreSwap();
        await swapper.performSwap({ priorityFeeMicroLamports: 0 });
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

export default main;
