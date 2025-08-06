import { Connection } from '@solana/web3.js';

/**
 * NetworkService - Handles RPC connections, caching, and parallel calls
 * Responsible for all network-related operations with the Solana blockchain
 */
export class NetworkService {
    constructor(options = {}) {
        this.rpcEndpoint = options.rpcEndpoint || process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
        this.connection = null;
        this.cache = new Map();
        this.cacheTimeout = options.cacheTimeout || 30000; // 30 seconds default
        this.requestPool = new Map(); // For deduplicating parallel requests
        this.initializeConnection();
    }

    /**
     * Initialize the Solana connection with optimal settings
     */
    initializeConnection() {
        this.connection = new Connection(this.rpcEndpoint, {
            commitment: 'confirmed',
            disableRetryOnRateLimit: false,
            confirmTransactionInitialTimeout: 60000,
            wsEndpoint: this.rpcEndpoint.replace('https://', 'wss://'),
        });
        console.log(`🌐 NetworkService connected to: ${this.rpcEndpoint}`);
    }

    /**
     * Get the current connection instance
     */
    getConnection() {
        return this.connection;
    }

    /**
     * Get balance with caching support
     * @param {PublicKey} publicKey - The wallet address
     * @param {boolean} useCache - Whether to use cached result
     */
    async getBalance(publicKey, useCache = true) {
        const cacheKey = `balance_${publicKey.toString()}`;
        
        if (useCache && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.value;
            }
        }

        try {
            const balance = await this.connection.getBalance(publicKey);
            
            if (useCache) {
                this.cache.set(cacheKey, {
                    value: balance,
                    timestamp: Date.now()
                });
            }
            
            return balance;
        } catch (error) {
            throw new Error(`Failed to get balance: ${error.message}`);
        }
    }

    /**
     * Execute multiple RPC calls in parallel with deduplication
     * @param {Array} calls - Array of call objects with { method, params, cacheKey }
     */
    async executeParallelCalls(calls) {
        const promises = calls.map(async (call) => {
            const { method, params = [], cacheKey } = call;
            
            // Check cache first if cacheKey provided
            if (cacheKey && this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return cached.value;
                }
            }

            // Deduplicate identical requests
            const requestKey = `${method}_${JSON.stringify(params)}`;
            if (this.requestPool.has(requestKey)) {
                return this.requestPool.get(requestKey);
            }

            // Create the request promise
            const requestPromise = (async () => {
                try {
                    const result = await this.connection[method](...params);
                    
                    // Cache result if cacheKey provided
                    if (cacheKey) {
                        this.cache.set(cacheKey, {
                            value: result,
                            timestamp: Date.now()
                        });
                    }
                    
                    return result;
                } finally {
                    // Remove from request pool once completed
                    this.requestPool.delete(requestKey);
                }
            })();

            this.requestPool.set(requestKey, requestPromise);
            return requestPromise;
        });

        return Promise.all(promises);
    }

    /**
     * Simulate transaction with enhanced error handling
     * @param {VersionedTransaction} transaction - The transaction to simulate
     * @param {Object} options - Simulation options
     */
    async simulateTransaction(transaction, options = {}) {
        const defaultOptions = {
            replaceRecentBlockhash: true,
            sigVerify: false,
            commitment: 'confirmed'
        };

        const simulationOptions = { ...defaultOptions, ...options };

        try {
            const result = await this.connection.simulateTransaction(transaction, simulationOptions);
            
            if (result.value.err) {
                const error = new Error('Transaction simulation failed');
                error.simulationResult = result.value;
                throw error;
            }
            
            return result;
        } catch (error) {
            if (error.simulationResult) {
                throw error; // Re-throw simulation errors with context
            }
            throw new Error(`Simulation request failed: ${error.message}`);
        }
    }

    /**
     * Send transaction with retry logic and optimal settings
     * @param {VersionedTransaction} transaction - The transaction to send
     * @param {Object} options - Send options
     */
    async sendTransaction(transaction, options = {}) {
        const defaultOptions = {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
            maxRetries: 3,
            retryDelay: 1000
        };

        const sendOptions = { ...defaultOptions, ...options };
        const { retryDelay, ...connectionOptions } = sendOptions;

        let lastError;
        for (let attempt = 0; attempt < sendOptions.maxRetries; attempt++) {
            try {
                const signature = await this.connection.sendTransaction(transaction, connectionOptions);
                return signature;
            } catch (error) {
                lastError = error;
                
                if (attempt < sendOptions.maxRetries - 1) {
                    console.log(`⚠️  Send attempt ${attempt + 1} failed, retrying in ${retryDelay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }
        }

        throw new Error(`Transaction send failed after ${sendOptions.maxRetries} attempts: ${lastError.message}`);
    }

    /**
     * Confirm transaction with timeout handling
     * @param {string} signature - Transaction signature
     * @param {string} commitment - Confirmation commitment level
     * @param {number} timeout - Timeout in milliseconds
     */
    async confirmTransaction(signature, commitment = 'confirmed', timeout = 60000) {
        try {
            const confirmation = await Promise.race([
                this.connection.confirmTransaction(signature, commitment),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Transaction confirmation timeout')), timeout)
                )
            ]);

            if (confirmation.value.err) {
                const error = new Error('Transaction confirmation failed');
                error.confirmationResult = confirmation.value;
                throw error;
            }

            return confirmation;
        } catch (error) {
            if (error.confirmationResult) {
                throw error; // Re-throw confirmation errors with context
            }
            throw new Error(`Transaction confirmation failed: ${error.message}`);
        }
    }

    /**
     * Get recent prioritization fees with parallel RPC calls
     * @param {Array} accounts - Array of account addresses to check
     */
    async getRecentPrioritizationFees(accounts = []) {
        try {
            const fees = await this.connection.getRecentPrioritizationFees({
                lockedWritableAccounts: accounts
            });
            return fees || [];
        } catch (error) {
            console.warn('Failed to fetch prioritization fees:', error.message);
            return [];
        }
    }

    /**
     * Clear expired cache entries
     */
    clearExpiredCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.cacheTimeout) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Get connection health status
     */
    async getHealthStatus() {
        try {
            const [slot, health] = await Promise.all([
                this.connection.getSlot(),
                this.connection.getHealth ? this.connection.getHealth() : 'ok'
            ]);
            
            return {
                healthy: true,
                slot,
                health,
                endpoint: this.rpcEndpoint
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                endpoint: this.rpcEndpoint
            };
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.cache.clear();
        this.requestPool.clear();
        // Connection cleanup is handled by the Solana library
    }
}

export default NetworkService;
