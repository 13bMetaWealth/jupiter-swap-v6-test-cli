#!/usr/bin/env node

import { config } from 'dotenv';
import { 
    Connection, 
    PublicKey, 
    Keypair, 
    VersionedTransaction,
    LAMPORTS_PER_SOL
} from '@solana/web3.js';
import axios from 'axios';
import bs58 from 'bs58';

config();

const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote';
const JUPITER_SWAP_API = 'https://quote-api.jup.ag/v6/swap';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

async function debug() {
    console.log('🔍 Debug Mode - Testing Jupiter swap issues\n');
    
    // Initialize connection
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    const keypair = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY));
    
    console.log('Wallet:', keypair.publicKey.toString());
    
    // Check balance
    const balance = await connection.getBalance(keypair.publicKey);
    console.log('Balance:', balance / LAMPORTS_PER_SOL, 'SOL\n');
    
    // Test different swap amounts
    const testAmounts = [
        50000,    // 0.00005 SOL
        100000,   // 0.0001 SOL  
        500000,   // 0.0005 SOL
    ];
    
    for (const amount of testAmounts) {
        console.log(`\n--- Testing ${amount / LAMPORTS_PER_SOL} SOL ---`);
        
        try {
            // Test quote without platform fee first
            const paramsNoFee = {
                inputMint: SOL_MINT,
                outputMint: USDC_MINT,
                amount: amount.toString(),
                slippageBps: 50,
                onlyDirectRoutes: false,
                asLegacyTransaction: false
            };
            
            console.log('Getting quote without platform fee...');
            const quoteResponse = await axios.get(JUPITER_QUOTE_API, { 
                params: paramsNoFee,
                timeout: 10000 
            });
            
            const quote = quoteResponse.data;
            console.log('✅ Quote successful');
            console.log(`  Output: ${(parseInt(quote.outAmount) / 1e6).toFixed(6)} USDC`);
            console.log(`  Route: ${quote.routePlan?.map(r => r.swapInfo?.label).join(' → ') || 'Direct'}`);
            
            // Test with platform fee
            console.log('Testing with platform fee...');
            const paramsWithFee = {
                ...paramsNoFee,
                platformFeeBps: 30,
                feeAccount: process.env.FEE_RECIPIENT
            };
            
            const quoteWithFeeResponse = await axios.get(JUPITER_QUOTE_API, { 
                params: paramsWithFee,
                timeout: 10000 
            });
            
            console.log('✅ Quote with fee successful');
            
            // Test creating swap transaction (no fee version first)
            console.log('Testing swap transaction creation (no fee)...');
            const swapPayload = {
                quoteResponse: quote,
                userPublicKey: keypair.publicKey.toString(),
                wrapAndUnwrapSol: true,
                useSharedAccounts: true,
                computeUnitPriceMicroLamports: 'auto',
                asLegacyTransaction: false
            };
            
            const swapResponse = await axios.post(JUPITER_SWAP_API, swapPayload, {
                timeout: 15000,
                headers: { 'Content-Type': 'application/json' }
            });
            
            console.log('✅ Swap transaction created successfully');
            
            // Test transaction simulation
            const transactionBuf = Buffer.from(swapResponse.data.swapTransaction, 'base64');
            const transaction = VersionedTransaction.deserialize(transactionBuf);
            transaction.sign([keypair]);
            
            console.log('Testing simulation...');
            const simulation = await connection.simulateTransaction(transaction);
            
            if (simulation.value.err) {
                console.log('❌ Simulation failed:', JSON.stringify(simulation.value.err));
                if (simulation.value.logs) {
                    console.log('Logs:', simulation.value.logs.slice(-5));
                }
            } else {
                console.log('✅ Simulation successful!');
                break; // Found working amount
            }
            
        } catch (error) {
            console.log('❌ Error:', error.response?.data?.error || error.message);
        }
    }
}

debug().catch(console.error);
