#!/usr/bin/env node

import { config } from 'dotenv';
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

config();

async function checkBalance() {
    try {
        const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        const keypair = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY));

        console.log('🔍 Checking wallet balance...');
        console.log('📍 Wallet Address:', keypair.publicKey.toString());

        const balance = await connection.getBalance(keypair.publicKey);
        const solBalance = balance / LAMPORTS_PER_SOL;

        console.log('💰 Balance:', solBalance.toFixed(9), 'SOL');
        console.log('💰 Balance in lamports:', balance.toLocaleString());

        const swapAmount = 100000; // 0.0001 SOL for testing
        const minRequired = swapAmount + 5000000; // Swap + buffer for fees/rent

        if (balance < swapAmount) {
            console.log('❌ Error: Balance is too low. Need at least', (swapAmount / LAMPORTS_PER_SOL), 'SOL for swap');
            return false;
        } else if (balance < minRequired) {
            console.log('⚠️  Warning: Balance is low. Recommended at least', (minRequired / LAMPORTS_PER_SOL), 'SOL for swap + fees/rent');
            return true;
        } else {
            console.log('✅ Sufficient balance for testing');
            return true;
        }
    } catch (error) {
        console.error('❌ Error checking balance:', error.message);
        return false;
    }
}

checkBalance();
