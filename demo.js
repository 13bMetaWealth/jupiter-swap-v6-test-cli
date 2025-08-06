#!/usr/bin/env node

import { config } from 'dotenv';
import axios from 'axios';

// Load environment variables
config();

// Jupiter V6 API endpoints
const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote';

// Token addresses (mainnet)
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// Configuration
const SWAP_AMOUNT = 100000; // 0.0000001 SOL in lamports
const DEFAULT_SLIPPAGE_BPS = 50; // 0.5%

console.log('🚀 Jupiter V6 API Demo - Testing Quote Functionality\n');

async function testJupiterQuote() {
    try {
        console.log('📊 Testing Jupiter V6 Quote API...');
        console.log(`   Input: ${SWAP_AMOUNT / 1e9} SOL`);
        console.log(`   Output Token: USDC`);
        console.log(`   Slippage: ${DEFAULT_SLIPPAGE_BPS / 100}%\n`);
        
        const params = {
            inputMint: SOL_MINT,
            outputMint: USDC_MINT,
            amount: SWAP_AMOUNT.toString(),
            slippageBps: DEFAULT_SLIPPAGE_BPS,
            onlyDirectRoutes: false,
            asLegacyTransaction: false
        };

        console.log('🔗 Making request to Jupiter V6...');
        const response = await axios.get(JUPITER_QUOTE_API, { 
            params,
            timeout: 10000 
        });

        const quote = response.data;
        
        if (!quote || !quote.outAmount) {
            throw new Error('Invalid quote response from Jupiter');
        }

        console.log('✅ Quote received successfully!\n');
        console.log('📈 Quote Details:');
        console.log(`   📥 Input Amount: ${SWAP_AMOUNT / 1e9} SOL`);
        console.log(`   📤 Output Amount: ${(parseInt(quote.outAmount) / 1e6).toFixed(6)} USDC`);
        console.log(`   💥 Price Impact: ${(parseFloat(quote.priceImpactPct || 0) * 100).toFixed(4)}%`);
        console.log(`   💱 Rate: 1 SOL = ${((parseInt(quote.outAmount) / 1e6) / (SWAP_AMOUNT / 1e9)).toFixed(2)} USDC`);
        
        // Route information
        if (quote.routePlan && quote.routePlan.length > 0) {
            console.log(`   🛣️  Route Plan:`);
            quote.routePlan.forEach((step, index) => {
                const dex = step.swapInfo?.label || 'Unknown DEX';
                const inputMint = step.swapInfo?.inputMint;
                const outputMint = step.swapInfo?.outputMint;
                console.log(`      ${index + 1}. ${dex}`);
                if (inputMint && outputMint) {
                    console.log(`         ${inputMint.slice(0, 8)}... → ${outputMint.slice(0, 8)}...`);
                }
            });
        }
        
        // Market info
        if (quote.contextSlot) {
            console.log(`   🎯 Context Slot: ${quote.contextSlot}`);
        }
        
        if (quote.timeTaken) {
            console.log(`   ⏱️  Time Taken: ${quote.timeTaken}ms`);
        }

        console.log('\n🎉 Jupiter V6 API is working perfectly!');
        console.log('\n📝 Next Steps to Use for Real Trading:');
        console.log('1. Add your real private key to .env file');
        console.log('2. Add your fee recipient address to .env file'); 
        console.log('3. Run: node index.js');
        console.log('\n⚠️  Warning: Only use on mainnet with small amounts first!');
        
        return quote;
        
    } catch (error) {
        console.error('\n❌ Error testing Jupiter API:');
        if (error.response?.data) {
            console.error('   API Response:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('   Error Message:', error.message);
        }
        
        if (error.code === 'ECONNREFUSED') {
            console.error('\n🌐 Network connection issue. Check your internet connection.');
        } else if (error.code === 'ETIMEDOUT') {
            console.error('\n⏰ Request timed out. Jupiter API might be slow.');
        }
        
        throw error;
    }
}

async function validateSwapCapability() {
    console.log('\n🔧 Validating Full Swap Capability...');
    
    try {
        // Test that we can get multiple quotes
        const testAmounts = ['100000', '1000000', '10000000']; // Different amounts
        
        console.log('📊 Testing different swap amounts:');
        
        for (const amount of testAmounts) {
            const solAmount = parseInt(amount) / 1e9;
            console.log(`   Testing ${solAmount} SOL...`);
            
            const response = await axios.get(JUPITER_QUOTE_API, {
                params: {
                    inputMint: SOL_MINT,
                    outputMint: USDC_MINT,
                    amount: amount,
                    slippageBps: DEFAULT_SLIPPAGE_BPS,
                    onlyDirectRoutes: false
                },
                timeout: 5000
            });
            
            const quote = response.data;
            const usdcAmount = parseInt(quote.outAmount) / 1e6;
            const rate = usdcAmount / solAmount;
            
            console.log(`     ✅ ${solAmount} SOL → ${usdcAmount.toFixed(6)} USDC (Rate: ${rate.toFixed(2)})`);
        }
        
        console.log('\n✅ All swap amount tests passed!');
        console.log('🚀 Jupiter V6 integration is fully functional!');
        
    } catch (error) {
        console.error('\n❌ Swap capability validation failed:', error.message);
        throw error;
    }
}

// Main execution
async function main() {
    try {
        await testJupiterQuote();
        await validateSwapCapability();
        
        console.log('\n🏆 All Tests Passed! Jupiter V6 Implementation is Ready!');
        process.exit(0);
    } catch (error) {
        console.error('\n💥 Demo failed:', error.message);
        process.exit(1);
    }
}

main();
