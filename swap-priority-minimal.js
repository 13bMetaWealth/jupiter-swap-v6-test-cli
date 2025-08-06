#!/usr/bin/env node

import { CoreSwap } from './core-swap.js';

// Attempt to fetch priority fee
async function fetchPriorityFee(connection) {
    try {
        const fees = await connection.getRecentPrioritizationFees();
        if (fees && fees.length > 0) {
            // Calculate median priority fee from recent fees
            const sortedFees = fees
                .map(fee => fee.prioritizationFee)
                .filter(fee => fee > 0)
                .sort((a, b) => a - b);
            
            if (sortedFees.length > 0) {
                const median = sortedFees[Math.floor(sortedFees.length / 2)];
                return median;
            }
        }
    } catch (error) {
        console.error('Failed to fetch prioritization fees:', error.message);
    }
    return 5000; // Fallback value
}

// Main execution
async function main() {
    try {
        console.log('🚀 Starting Jupiter V6 SOL → USDC priority swap...\n');
        
        // Use minimal configuration without detailed balance checks
        const swapper = new CoreSwap({ includeDetailedBalance: false });
        const priorityFeeMicroLamports = await fetchPriorityFee(swapper.connection);
        console.log(`⚡ Using priority fee ${priorityFeeMicroLamports.toLocaleString()} µLAM`);
        
        await swapper.performSwap({ priorityFeeMicroLamports });
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

// Run the main function
main().catch(error => {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
});
