#!/usr/bin/env node

import { config } from 'dotenv';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import bs58 from 'bs58';

config();

// Token addresses
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

async function checkTokenAccounts() {
    try {
        console.log('🔍 Checking token accounts...\n');
        
        // Initialize connection and keypair
        const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        const keypair = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY));
        
        console.log(`💎 Wallet: ${keypair.publicKey.toString()}`);
        
        // Check SOL balance
        const solBalance = await connection.getBalance(keypair.publicKey);
        console.log(`💰 SOL Balance: ${(solBalance / 1e9).toFixed(9)} SOL`);
        
        // Check USDC token account
        try {
            const usdcTokenAccount = await getAssociatedTokenAddress(
                new PublicKey(USDC_MINT),
                keypair.publicKey
            );
            
            console.log(`🪙 USDC Token Account: ${usdcTokenAccount.toString()}`);
            
            try {
                const accountInfo = await getAccount(connection, usdcTokenAccount);
                console.log(`✅ USDC Account exists with balance: ${(Number(accountInfo.amount) / 1e6).toFixed(6)} USDC`);
            } catch (error) {
                console.log(`❌ USDC Account doesn't exist yet (needs ~0.002 SOL rent)`);
            }
            
        } catch (error) {
            console.error('Error checking USDC account:', error.message);
        }
        
        // Check all token accounts
        console.log('\n🔍 All token accounts:');
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            keypair.publicKey,
            { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
        );
        
        if (tokenAccounts.value.length === 0) {
            console.log('📭 No token accounts found');
        } else {
            tokenAccounts.value.forEach((account, index) => {
                const accountData = account.account.data.parsed.info;
                console.log(`${index + 1}. ${accountData.mint} - Balance: ${accountData.tokenAmount.uiAmountString}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkTokenAccounts();
