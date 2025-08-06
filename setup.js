#!/usr/bin/env node

import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import fs from 'fs';

console.log('🔧 Jupiter Swap Setup Tool\n');

function generateTestWallet() {
    console.log('🔐 Generating test wallet...');
    
    // Generate a new keypair
    const keypair = Keypair.generate();
    const privateKey = bs58.encode(keypair.secretKey);
    const publicKey = keypair.publicKey.toString();
    
    console.log('✅ Test wallet generated:');
    console.log(`   Public Key: ${publicKey}`);
    console.log(`   Private Key: ${privateKey.slice(0, 20)}...${privateKey.slice(-10)}`);
    console.log(`   Full Private Key: ${privateKey}`);
    
    return { privateKey, publicKey };
}

function createEnvFile(wallet) {
    console.log('\n📝 Creating .env file...');
    
    const envContent = `# Solana wallet private key (Base58 encoded)
PRIVATE_KEY=${wallet.privateKey}

# Fee recipient wallet address (using same wallet for demo)
FEE_RECIPIENT=${wallet.publicKey}

# Fee in basis points (e.g., 30 = 0.3%)
FEE_BASIS_POINTS=30

# Optional: RPC endpoint (defaults to public endpoint)
# RPC_ENDPOINT=https://api.mainnet-beta.solana.com

# Generated on: ${new Date().toISOString()}
# Wallet Address: ${wallet.publicKey}
# WARNING: This is for testing only! Fund with small amounts only!
`;

    try {
        fs.writeFileSync('.env', envContent);
        console.log('✅ .env file created successfully');
        console.log('   Location: .env');
        console.log(`   Wallet: ${wallet.publicKey}`);
        console.log(`   Fee Recipient: ${wallet.publicKey} (same wallet)`);
        console.log('   Fee: 30 basis points (0.3%)');
    } catch (error) {
        console.error('❌ Failed to create .env file:', error.message);
        throw error;
    }
}

function displayInstructions(wallet) {
    console.log('\n🎯 Setup Complete! Here\'s what to do next:\n');
    
    console.log('1️⃣  FUND YOUR WALLET:');
    console.log(`   Address: ${wallet.publicKey}`);
    console.log('   Send some SOL (start with 0.001 SOL for testing)');
    console.log('   You can get SOL from exchanges like Coinbase, Binance, etc.\n');
    
    console.log('2️⃣  TEST THE BOT:');
    console.log('   Run: node demo.js     # Test API connectivity');
    console.log('   Run: node index.js    # Execute real swap (needs funded wallet)\n');
    
    console.log('3️⃣  SAFETY REMINDERS:');
    console.log('   ⚠️  Start with small amounts (0.001 SOL)');
    console.log('   ⚠️  This is mainnet - real money!');
    console.log('   ⚠️  Keep your private key secure');
    console.log('   ⚠️  Test thoroughly before larger amounts\n');
    
    console.log('4️⃣  CUSTOMIZATION:');
    console.log('   Edit .env file to:');
    console.log('   - Change fee recipient address');
    console.log('   - Adjust fee basis points');
    console.log('   - Use custom RPC endpoint\n');
    
    console.log('🔗 Useful Links:');
    console.log(`   Solscan: https://solscan.io/account/${wallet.publicKey}`);
    console.log('   Jupiter: https://jup.ag');
    console.log('   Solana Explorer: https://explorer.solana.com\n');
}

// Main execution
async function main() {
    try {
        console.log('This will generate a new test wallet and set up your .env file.');
        console.log('⚠️  WARNING: This creates a real mainnet wallet!\n');
        
        // Generate test wallet
        const wallet = generateTestWallet();
        
        // Create .env file
        createEnvFile(wallet);
        
        // Show instructions
        displayInstructions(wallet);
        
        console.log('🎉 Setup completed successfully!');
        console.log('\n💡 Run "node demo.js" to test Jupiter API integration');
        
    } catch (error) {
        console.error('\n💥 Setup failed:', error.message);
        process.exit(1);
    }
}

main();
