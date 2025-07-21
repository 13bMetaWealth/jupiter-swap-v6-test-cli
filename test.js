#!/usr/bin/env node

import { config } from 'dotenv';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

// Load environment variables
config();

console.log('🧪 Testing Jupiter Swap CLI...\n');

// Test 1: Environment validation
console.log('1️⃣ Testing environment validation...');
const required = ['PRIVATE_KEY', 'FEE_RECIPIENT', 'FEE_BASIS_POINTS'];
const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
    console.log(`❌ Missing variables: ${missing.join(', ')}`);
} else {
    console.log('✅ All required environment variables present');
}

// Test 2: Private key validation
console.log('\n2️⃣ Testing private key validation...');
try {
    if (process.env.PRIVATE_KEY) {
        bs58.decode(process.env.PRIVATE_KEY);
        console.log('✅ Private key format is valid');
    } else {
        console.log('❌ No private key provided');
    }
} catch (error) {
    console.log('❌ Invalid private key format');
}

// Test 3: Fee recipient validation
console.log('\n3️⃣ Testing fee recipient validation...');
try {
    if (process.env.FEE_RECIPIENT) {
        new PublicKey(process.env.FEE_RECIPIENT);
        console.log('✅ Fee recipient address is valid');
    } else {
        console.log('❌ No fee recipient provided');
    }
} catch (error) {
    console.log('❌ Invalid fee recipient address');
}

// Test 4: Fee basis points validation
console.log('\n4️⃣ Testing fee basis points validation...');
const feeBps = parseInt(process.env.FEE_BASIS_POINTS);
if (isNaN(feeBps) || feeBps < 0 || feeBps > 10000) {
    console.log('❌ Invalid fee basis points');
} else {
    console.log(`✅ Fee basis points: ${feeBps} (${(feeBps / 100).toFixed(2)}%)`);
}

// Test 5: Jupiter API connectivity
console.log('\n5️⃣ Testing Jupiter API connectivity...');
import axios from 'axios';

try {
    const response = await axios.get('https://quote-api.jup.ag/v6/quote', {
        params: {
            inputMint: 'So11111111111111111111111111111111111111112',
            outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            amount: '100000',
            slippageBps: 50,
            onlyDirectRoutes: false,
            asLegacyTransaction: false
        },
        timeout: 5000
    });
    
    if (response.status === 200) {
        console.log('✅ Jupiter API is accessible');
        console.log(`   Quote received: ${response.data.outAmount} USDC`);
    } else {
        console.log('❌ Jupiter API returned error');
    }
} catch (error) {
    console.log('❌ Cannot connect to Jupiter API:', error.message);
}

console.log('\n🎉 Test completed!');
console.log('\n📝 To use the bot:');
console.log('1. Copy env.example to .env');
console.log('2. Fill in your real private key and fee recipient');
console.log('3. Run: node index.js'); 