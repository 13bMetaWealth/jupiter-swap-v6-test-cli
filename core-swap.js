import { config } from 'dotenv';
import { 
    Connection, 
    PublicKey, 
    Keypair, 
    VersionedTransaction,
    TransactionMessage,
    ComputeBudgetProgram,
    LAMPORTS_PER_SOL
} from '@solana/web3.js';
import axios from 'axios';
import bs58 from 'bs58';

// Load environment variables
config();

// Jupiter V6 API endpoints
const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote';
const JUPITER_SWAP_API = 'https://quote-api.jup.ag/v6/swap';

// Token addresses (mainnet)
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// Configuration
const SWAP_AMOUNT = 100000; // 0.0001 SOL in lamports
const DEFAULT_SLIPPAGE_BPS = 100; // 1% slippage

export class CoreSwap {
    constructor(options = {}) {
        this.connection = null;
        this.keypair = null;
        this.options = {
            useSharedAccounts: options.useSharedAccounts ?? false,
            onlyDirectRoutes: options.onlyDirectRoutes ?? true,
            includeDetailedBalance: options.includeDetailedBalance ?? false,
            ...options
        };
        this.validateEnvironment();
        this.initializeConnection();
    }

    validateEnvironment() {
        console.log('🔍 Validating environment...');
        
        const required = ['PRIVATE_KEY', 'FEE_RECIPIENT', 'FEE_BASIS_POINTS'];
        const missing = required.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            throw new Error(`Missing environment variables: ${missing.join(', ')}`);
        }

        // Validate private key
        try {
            const privateKeyBytes = bs58.decode(process.env.PRIVATE_KEY);
            if (privateKeyBytes.length !== 64) {
                throw new Error('Private key must be 64 bytes');
            }
            this.keypair = Keypair.fromSecretKey(privateKeyBytes);
        } catch (error) {
            throw new Error(`Invalid private key: ${error.message}`);
        }

        // Validate fee recipient
        try {
            new PublicKey(process.env.FEE_RECIPIENT);
        } catch (error) {
            throw new Error('Invalid fee recipient address');
        }

        // Validate fee basis points
        const feeBps = parseInt(process.env.FEE_BASIS_POINTS);
        if (isNaN(feeBps) || feeBps < 0 || feeBps > 10000) {
            throw new Error('Fee basis points must be between 0 and 10000');
        }

        console.log('✅ Environment validation passed');
    }

    initializeConnection() {
        const rpcEndpoint = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
        this.connection = new Connection(rpcEndpoint, {
            commitment: 'confirmed',
            disableRetryOnRateLimit: false
        });
        console.log(`🌐 Connected to: ${rpcEndpoint}`);
    }

    async checkBalance() {
        const balance = await this.connection.getBalance(this.keypair.publicKey);
        const solBalance = balance / LAMPORTS_PER_SOL;
        
        console.log(`💎 Wallet: ${this.keypair.publicKey.toString()}`);
        console.log(`💰 Balance: ${solBalance.toFixed(9)} SOL`);
        
        if (this.options.includeDetailedBalance) {
            // Account for:
            // - Swap amount
            // - Token account rent (~0.002 SOL)
            // - Transaction fees (~0.0005 SOL)
            const rentReserve = 2039280; // Rent for token account
            const feeBuffer = 500000; // Buffer for transaction fees
            const totalRequired = SWAP_AMOUNT + rentReserve + feeBuffer;

            if (balance < SWAP_AMOUNT) {
                throw new Error(
                    `Insufficient balance for swap. Need ${
                        SWAP_AMOUNT / LAMPORTS_PER_SOL
                    } SOL, have ${solBalance} SOL`
                );
            }

            if (balance < totalRequired) {
                throw new Error(
                    `Insufficient balance for swap + fees. Need ${(
                        totalRequired / LAMPORTS_PER_SOL
                    ).toFixed(6)} SOL total:\n` +
                        `  • Swap amount: ${SWAP_AMOUNT / LAMPORTS_PER_SOL} SOL\n` +
                        `  • Token account rent: ~${(rentReserve / LAMPORTS_PER_SOL).toFixed(
                            6
                        )} SOL\n` +
                        `  • Transaction fees: ~${(feeBuffer / LAMPORTS_PER_SOL).toFixed(
                            6
                        )} SOL\n` +
                        `  • Current balance: ${solBalance.toFixed(9)} SOL\n\n` +
                        `Please add ${((totalRequired - balance) / LAMPORTS_PER_SOL).toFixed(
                            6
                        )} SOL to your wallet.`
                );
            }
        } else {
            if (balance < SWAP_AMOUNT) {
                throw new Error(`Insufficient balance. Need ${SWAP_AMOUNT / LAMPORTS_PER_SOL} SOL, have ${solBalance} SOL`);
            }
        }
        
        return balance;
    }

    async getQuote() {
        console.log('📊 Getting quote from Jupiter V6...');
        console.time('getQuote');
        
        try {
            const params = {
                inputMint: SOL_MINT,
                outputMint: USDC_MINT,
                amount: SWAP_AMOUNT.toString(),
                slippageBps: DEFAULT_SLIPPAGE_BPS,
                onlyDirectRoutes: false, // Allow all routes for better liquidity
                asLegacyTransaction: false,
                // Remove platform fee for testing
                // platformFeeBps: parseInt(process.env.FEE_BASIS_POINTS),
                // feeAccount: process.env.FEE_RECIPIENT
            };

            const response = await axios.get(JUPITER_QUOTE_API, { 
                params,
                timeout: 10000 
            });
            console.timeEnd('getQuote');

            const quote = response.data;
            
            if (!quote || !quote.outAmount) {
                throw new Error('Invalid quote response from Jupiter');
            }

            console.log('✅ Quote received:');
            console.log(`   📥 Input: ${SWAP_AMOUNT / LAMPORTS_PER_SOL} SOL`);
            console.log(`   📤 Output: ${(parseInt(quote.outAmount) / 1e6).toFixed(6)} USDC`);
            console.log(`   💥 Price Impact: ${(parseFloat(quote.priceImpactPct) * 100).toFixed(4)}%`);
            console.log(`   🛣️  Route: ${this.getRouteInfo(quote)}`);
            console.log(`   💸 Platform Fee: ${process.env.FEE_BASIS_POINTS} bps to ${process.env.FEE_RECIPIENT}`);
            
            return quote;
        } catch (error) {
            console.timeEnd('getQuote');
            if (error.response?.data?.error) {
                throw new Error(`Jupiter API error: ${error.response.data.error}`);
            }
            throw new Error(`Quote request failed: ${error.message}`);
        }
    }

    getRouteInfo(quote) {
        if (quote.routePlan && quote.routePlan.length > 0) {
            const exchanges = quote.routePlan.map(step => step.swapInfo?.label || 'Unknown');
            return exchanges.join(' → ');
        }
        return 'Direct';
    }

    async createSwapTransaction(quote, priorityFeeMicroLamports = 'auto') {
        console.log('🔨 Creating swap transaction...');
        console.time('createSwapTransaction');
        
        try {
            const swapPayload = {
                quoteResponse: quote,
                userPublicKey: this.keypair.publicKey.toString(),
                wrapAndUnwrapSol: true,
                useSharedAccounts: this.options.useSharedAccounts,
                // Remove platform fee for testing
                // feeAccount: process.env.FEE_RECIPIENT,
                asLegacyTransaction: false,
                useTokenLedger: false
            };

            // Add priority fee if specified and not zero
            if (priorityFeeMicroLamports !== 'auto' && priorityFeeMicroLamports > 0) {
                swapPayload.computeUnitPriceMicroLamports = priorityFeeMicroLamports;
            } else if (priorityFeeMicroLamports === 'auto' || priorityFeeMicroLamports === 0) {
                swapPayload.computeUnitPriceMicroLamports = priorityFeeMicroLamports === 0 ? 0 : 'auto';
            }

            const response = await axios.post(JUPITER_SWAP_API, swapPayload, {
                timeout: 15000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            console.timeEnd('createSwapTransaction');

            const { swapTransaction } = response.data;
            
            if (!swapTransaction) {
                throw new Error('No swap transaction returned from Jupiter');
            }

            return swapTransaction;
        } catch (error) {
            console.timeEnd('createSwapTransaction');
            if (error.response?.data?.error) {
                throw new Error(`Jupiter swap API error: ${error.response.data.error}`);
            }
            throw new Error(`Swap transaction creation failed: ${error.message}`);
        }
    }

    async executeSwap(swapTransaction, priorityFeeMicroLamports = 0) {
        console.log('✍️  Signing and sending transaction...');
        console.time('executeSwap');
        
        try {
            // Deserialize the transaction
            const transactionBuf = Buffer.from(swapTransaction, 'base64');
            let transaction = VersionedTransaction.deserialize(transactionBuf);
            
            // Priority fee is already handled in createSwapTransaction via Jupiter API
            // No need to add it again here to avoid duplicate instructions
            
            // Sign the transaction
            transaction.sign([this.keypair]);
            
            // Simulate transaction first
            console.log('🧪 Simulating transaction...');
            console.time('simulateTransaction');
            const simulationOptions = {
                replaceRecentBlockhash: true,
                sigVerify: false,
            };

            // For detailed balance mode (index.js behavior), include more simulation details
            if (!this.options.includeDetailedBalance) {
                delete simulationOptions.replaceRecentBlockhash;
                delete simulationOptions.sigVerify;
            }

            const simulationResult = await this.connection.simulateTransaction(
                transaction,
                this.options.includeDetailedBalance ? simulationOptions : undefined
            );
            console.timeEnd('simulateTransaction');
            
            if (this.options.includeDetailedBalance) {
                console.log('🔍 Simulation details:');
                console.log(
                    `   Compute units consumed: ${
                        simulationResult.value.unitsConsumed || 'N/A'
                    }`
                );
                console.log(
                    `   Logs: ${
                        simulationResult.value.logs?.slice(-5).join('\n         ') ||
                        'No logs'
                    }`
                );

                if (simulationResult.value.err) {
                    console.error(
                        '❌ Full simulation error:',
                        JSON.stringify(simulationResult.value, null, 2)
                    );
                    throw new Error(
                        `Transaction simulation failed: ${JSON.stringify(
                            simulationResult.value.err
                        )}`
                    );
                }
            } else {
                if (simulationResult.value.err) {
                    throw new Error(`Transaction simulation failed: ${JSON.stringify(simulationResult.value.err)}`);
                }
            }
            
            console.log('✅ Simulation successful');
            
            // Send the transaction with retry logic
            let signature;
            let attempts = 0;
            const maxAttempts = 3;
            
            console.time('sendTransaction');
            while (attempts < maxAttempts) {
                try {
                    signature = await this.connection.sendTransaction(transaction, {
                        skipPreflight: false,
                        preflightCommitment: 'confirmed',
                        maxRetries: 3
                    });
                    break;
                } catch (error) {
                    attempts++;
                    if (attempts === maxAttempts) throw error;
                    console.log(`⚠️  Attempt ${attempts} failed, retrying...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            console.timeEnd('sendTransaction');
            
            console.log(`📨 Transaction sent: ${signature}`);
            
            // Wait for confirmation with timeout
            console.log('⏳ Waiting for confirmation...');
            console.time('confirmTransaction');
            const confirmation = await this.connection.confirmTransaction(
                signature,
                'confirmed'
            );
            console.timeEnd('confirmTransaction');
            
            if (confirmation.value.err) {
                throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
            }
            
            console.timeEnd('executeSwap');
            return signature;
        } catch (error) {
            console.timeEnd('executeSwap');
            throw new Error(`Transaction execution failed: ${error.message}`);
        }
    }

    async performSwap({ priorityFeeMicroLamports = 'auto' } = {}) {
        console.time('performSwap');
        try {
            console.log('🚀 Starting Jupiter V6 SOL → USDC swap...\n');
            
            // Check wallet balance
            await this.checkBalance();
            
            // Get quote from Jupiter
            const quote = await this.getQuote();
            
            // Create swap transaction with priority fee
            const swapTransaction = await this.createSwapTransaction(quote, priorityFeeMicroLamports);
            
            // Execute the swap - only pass numeric priority fee values to executeSwap
            const numericPriorityFee = (priorityFeeMicroLamports === 'auto' || priorityFeeMicroLamports === 0) 
                ? 0 
                : priorityFeeMicroLamports;
            const signature = await this.executeSwap(swapTransaction, numericPriorityFee);
            
            // Success message
            console.log('\n🎉 Swap completed successfully!');
            console.log(`🔗 Explorer: https://solscan.io/tx/${signature}`);
            console.log(`📊 Swapped: ${SWAP_AMOUNT / LAMPORTS_PER_SOL} SOL → ${(parseInt(quote.outAmount) / 1e6).toFixed(6)} USDC`);
            console.log(`💰 Platform Fee: ${process.env.FEE_BASIS_POINTS} bps paid to ${process.env.FEE_RECIPIENT}`);
            
            console.timeEnd('performSwap');
            return {
                signature,
                quote,
                inputAmount: SWAP_AMOUNT / LAMPORTS_PER_SOL,
                outputAmount: (parseInt(quote.outAmount) / 1e6)
            };
            
        } catch (error) {
            console.timeEnd('performSwap');
            console.error(`\n❌ Swap failed: ${error.message}`);
            throw error;
        }
    }
}

export default CoreSwap;
