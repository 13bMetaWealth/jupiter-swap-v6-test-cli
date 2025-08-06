import axios from 'axios';

/**
 * QuoteService - Handles Jupiter API interactions and adaptive slippage
 * Responsible for getting quotes, managing slippage, and route optimization
 */
export class QuoteService {
    constructor(options = {}) {
        this.jupiterQuoteApi = options.jupiterQuoteApi || 'https://quote-api.jup.ag/v6/quote';
        this.jupiterSwapApi = options.jupiterSwapApi || 'https://quote-api.jup.ag/v6/swap';
        this.timeout = options.timeout || 10000;
        this.retries = options.retries || 3;
        this.cache = new Map();
        this.cacheTimeout = options.cacheTimeout || 15000; // 15 seconds for quotes
        
        // Adaptive slippage configuration
        this.slippageConfig = {
            base: options.baseSlippage || 100, // 1% in bps
            min: options.minSlippage || 50,    // 0.5% in bps
            max: options.maxSlippage || 500,   // 5% in bps
            priceImpactMultiplier: options.priceImpactMultiplier || 2,
            volatilityFactor: options.volatilityFactor || 1.5
        };
    }

    /**
     * Get quote from Jupiter with adaptive slippage and caching
     * @param {Object} params - Quote parameters
     */
    async getQuote(params) {
        const {
            inputMint,
            outputMint,
            amount,
            slippageBps = this.slippageConfig.base,
            onlyDirectRoutes = false,
            platformFeeBps,
            feeAccount,
            excludeDexes = [],
            maxAccounts = 64
        } = params;

        // Create cache key
        const cacheKey = `quote_${inputMint}_${outputMint}_${amount}_${slippageBps}_${onlyDirectRoutes}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log('📋 Using cached quote');
                return cached.value;
            }
        }

        console.log('📊 Fetching quote from Jupiter V6...');
        console.time('getQuote');

        const requestParams = {
            inputMint,
            outputMint,
            amount: amount.toString(),
            slippageBps,
            onlyDirectRoutes,
            asLegacyTransaction: false,
            maxAccounts
        };

        // Add optional parameters
        if (platformFeeBps && feeAccount) {
            requestParams.platformFeeBps = platformFeeBps;
            requestParams.feeAccount = feeAccount;
        }

        if (excludeDexes.length > 0) {
            requestParams.excludeDexes = excludeDexes.join(',');
        }

        try {
            let lastError;
            let quote;

            // Retry logic with exponential backoff
            for (let attempt = 0; attempt < this.retries; attempt++) {
                try {
                    const response = await axios.get(this.jupiterQuoteApi, {
                        params: requestParams,
                        timeout: this.timeout * (attempt + 1), // Increase timeout with each retry
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'CoreSwap/1.0'
                        }
                    });

                    quote = response.data;
                    break;
                } catch (error) {
                    lastError = error;
                    
                    if (attempt < this.retries - 1) {
                        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                        console.log(`⚠️  Quote attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            }

            if (!quote) {
                throw lastError || new Error('Failed to get quote after retries');
            }

            console.timeEnd('getQuote');

            if (!quote || !quote.outAmount) {
                throw new Error('Invalid quote response from Jupiter');
            }

            // Process and enhance the quote
            const enhancedQuote = this.enhanceQuote(quote, params);

            // Cache the result
            this.cache.set(cacheKey, {
                value: enhancedQuote,
                timestamp: Date.now()
            });

            this.logQuoteDetails(enhancedQuote, params);
            return enhancedQuote;

        } catch (error) {
            console.timeEnd('getQuote');
            
            if (error.response?.data?.error) {
                throw new Error(`Jupiter API error: ${error.response.data.error}`);\n            }\n            throw new Error(`Quote request failed: ${error.message}`);\n        }\n    }\n\n    /**\n     * Enhance quote with additional metadata and calculations\n     * @param {Object} quote - Raw quote from Jupiter\n     * @param {Object} params - Original quote parameters\n     */\n    enhanceQuote(quote, params) {\n        const enhancedQuote = {\n            ...quote,\n            metadata: {\n                timestamp: Date.now(),\n                inputAmount: parseInt(params.amount),\n                outputAmount: parseInt(quote.outAmount),\n                routeInfo: this.getRouteInfo(quote),\n                priceImpact: parseFloat(quote.priceImpactPct || 0),\n                slippageUsed: params.slippageBps || this.slippageConfig.base,\n                estimatedFees: this.estimateFees(quote)\n            }\n        };\n\n        // Add adaptive slippage recommendation\n        enhancedQuote.recommendedSlippage = this.calculateAdaptiveSlippage(\n            enhancedQuote.metadata.priceImpact,\n            enhancedQuote.metadata.routeInfo\n        );\n\n        return enhancedQuote;\n    }\n\n    /**\n     * Calculate adaptive slippage based on market conditions\n     * @param {number} priceImpact - Price impact percentage\n     * @param {Object} routeInfo - Route information\n     */\n    calculateAdaptiveSlippage(priceImpact, routeInfo) {\n        let adaptiveSlippage = this.slippageConfig.base;\n\n        // Increase slippage for high price impact trades\n        if (priceImpact > 0.5) { // More than 0.5% price impact\n            adaptiveSlippage += Math.floor(priceImpact * this.slippageConfig.priceImpactMultiplier * 100);\n        }\n\n        // Increase slippage for complex routes (more hops = more volatility)\n        if (routeInfo.hops > 1) {\n            adaptiveSlippage += (routeInfo.hops - 1) * 25; // +0.25% per additional hop\n        }\n\n        // Apply volatility factor for certain DEXes known to be more volatile\n        const volatileDexes = ['Serum', 'OpenBook', 'Raydium CLMM'];\n        if (routeInfo.exchanges.some(exchange => volatileDexes.includes(exchange))) {\n            adaptiveSlippage = Math.floor(adaptiveSlippage * this.slippageConfig.volatilityFactor);\n        }\n\n        // Clamp to min/max bounds\n        return Math.max(\n            this.slippageConfig.min,\n            Math.min(this.slippageConfig.max, adaptiveSlippage)\n        );\n    }\n\n    /**\n     * Get detailed route information\n     * @param {Object} quote - Jupiter quote\n     */\n    getRouteInfo(quote) {\n        if (!quote.routePlan || quote.routePlan.length === 0) {\n            return {\n                exchanges: ['Direct'],\n                hops: 1,\n                complexity: 'Simple'\n            };\n        }\n\n        const exchanges = quote.routePlan.map(step => \n            step.swapInfo?.label || step.swapInfo?.dexLabel || 'Unknown'\n        );\n\n        const hops = quote.routePlan.length;\n        let complexity = 'Simple';\n        \n        if (hops > 2) complexity = 'Complex';\n        else if (hops > 1) complexity = 'Moderate';\n\n        return {\n            exchanges,\n            hops,\n            complexity,\n            route: exchanges.join(' → ')\n        };\n    }\n\n    /**\n     * Estimate various fees for the swap\n     * @param {Object} quote - Jupiter quote\n     */\n    estimateFees(quote) {\n        const fees = {\n            platformFee: 0,\n            jupiterFee: 0,\n            totalFeeAmount: 0\n        };\n\n        // Calculate platform fee if present\n        if (quote.platformFee) {\n            fees.platformFee = parseInt(quote.platformFee.amount || 0);\n        }\n\n        // Estimate Jupiter fee (they typically take a small fee)\n        // This is an estimation as Jupiter doesn't always explicitly show their fee\n        const outputAmount = parseInt(quote.outAmount);\n        fees.jupiterFee = Math.floor(outputAmount * 0.0001); // Estimate 0.01%\n\n        fees.totalFeeAmount = fees.platformFee + fees.jupiterFee;\n\n        return fees;\n    }\n\n    /**\n     * Create swap transaction via Jupiter API\n     * @param {Object} params - Swap transaction parameters\n     */\n    async createSwapTransaction(params) {\n        const {\n            quote,\n            userPublicKey,\n            wrapAndUnwrapSol = true,\n            useSharedAccounts = false,\n            feeAccount,\n            computeUnitPriceMicroLamports = 'auto',\n            asLegacyTransaction = false,\n            useTokenLedger = false\n        } = params;\n\n        console.log('🔨 Creating swap transaction via Jupiter...');\n        console.time('createSwapTransaction');\n\n        const swapPayload = {\n            quoteResponse: quote,\n            userPublicKey: userPublicKey.toString(),\n            wrapAndUnwrapSol,\n            useSharedAccounts,\n            asLegacyTransaction,\n            useTokenLedger\n        };\n\n        // Add optional parameters\n        if (feeAccount) {\n            swapPayload.feeAccount = feeAccount;\n        }\n\n        if (computeUnitPriceMicroLamports !== undefined) {\n            swapPayload.computeUnitPriceMicroLamports = computeUnitPriceMicroLamports;\n        }\n\n        try {\n            let lastError;\n            let swapTransaction;\n\n            // Retry logic for swap transaction creation\n            for (let attempt = 0; attempt < this.retries; attempt++) {\n                try {\n                    const response = await axios.post(this.jupiterSwapApi, swapPayload, {\n                        timeout: this.timeout * 2, // Double timeout for swap requests\n                        headers: {\n                            'Content-Type': 'application/json',\n                            'Accept': 'application/json',\n                            'User-Agent': 'CoreSwap/1.0'\n                        }\n                    });\n\n                    swapTransaction = response.data.swapTransaction;\n                    break;\n                } catch (error) {\n                    lastError = error;\n                    \n                    if (attempt < this.retries - 1) {\n                        const delay = Math.pow(2, attempt) * 1000;\n                        console.log(`⚠️  Swap creation attempt ${attempt + 1} failed, retrying in ${delay}ms...`);\n                        await new Promise(resolve => setTimeout(resolve, delay));\n                    }\n                }\n            }\n\n            if (!swapTransaction) {\n                throw lastError || new Error('Failed to create swap transaction');\n            }\n\n            console.timeEnd('createSwapTransaction');\n\n            if (!swapTransaction) {\n                throw new Error('No swap transaction returned from Jupiter');\n            }\n\n            return swapTransaction;\n        } catch (error) {\n            console.timeEnd('createSwapTransaction');\n            \n            if (error.response?.data?.error) {\n                throw new Error(`Jupiter swap API error: ${error.response.data.error}`);\n            }\n            throw new Error(`Swap transaction creation failed: ${error.message}`);\n        }\n    }\n\n    /**\n     * Compare multiple quotes to find the best one\n     * @param {Array} quotes - Array of quotes to compare\n     * @param {Object} criteria - Comparison criteria\n     */\n    findBestQuote(quotes, criteria = {}) {\n        const {\n            prioritizeOutput = true,\n            maxPriceImpact = 5.0,\n            maxSlippage = 500,\n            preferDirectRoutes = false\n        } = criteria;\n\n        let validQuotes = quotes.filter(quote => {\n            const priceImpact = quote.metadata?.priceImpact || parseFloat(quote.priceImpactPct || 0);\n            return priceImpact <= maxPriceImpact;\n        });\n\n        if (validQuotes.length === 0) {\n            throw new Error('No valid quotes found within price impact constraints');\n        }\n\n        // Sort by priority criteria\n        validQuotes.sort((a, b) => {\n            if (prioritizeOutput) {\n                const outputA = parseInt(a.outAmount);\n                const outputB = parseInt(b.outAmount);\n                return outputB - outputA; // Higher output first\n            } else {\n                const impactA = a.metadata?.priceImpact || parseFloat(a.priceImpactPct || 0);\n                const impactB = b.metadata?.priceImpact || parseFloat(b.priceImpactPct || 0);\n                return impactA - impactB; // Lower impact first\n            }\n        });\n\n        // Apply preference for direct routes if specified\n        if (preferDirectRoutes) {\n            const directQuotes = validQuotes.filter(quote => \n                quote.metadata?.routeInfo?.hops === 1 || \n                !quote.routePlan || \n                quote.routePlan.length <= 1\n            );\n            \n            if (directQuotes.length > 0) {\n                return directQuotes[0];\n            }\n        }\n\n        return validQuotes[0];\n    }\n\n    /**\n     * Log detailed quote information\n     * @param {Object} quote - Enhanced quote object\n     * @param {Object} params - Original request parameters\n     */\n    logQuoteDetails(quote, params) {\n        const { metadata } = quote;\n        \n        console.log('✅ Quote received:');\n        console.log(`   📥 Input: ${(metadata.inputAmount / 1e9).toFixed(6)} ${params.inputMint === 'So11111111111111111111111111111111111111112' ? 'SOL' : 'tokens'}`);\n        console.log(`   📤 Output: ${(metadata.outputAmount / 1e6).toFixed(6)} ${params.outputMint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' ? 'USDC' : 'tokens'}`);\n        console.log(`   💥 Price Impact: ${(metadata.priceImpact * 100).toFixed(4)}%`);\n        console.log(`   🛣️  Route: ${metadata.routeInfo.route} (${metadata.routeInfo.complexity})`);\n        console.log(`   📊 Slippage Used: ${metadata.slippageUsed / 100}%`);\n        console.log(`   🎯 Recommended: ${quote.recommendedSlippage / 100}%`);\n        \n        if (metadata.estimatedFees.totalFeeAmount > 0) {\n            console.log(`   💰 Estimated Fees: ${metadata.estimatedFees.totalFeeAmount} tokens`);\n        }\n    }\n\n    /**\n     * Clear expired cache entries\n     */\n    clearExpiredCache() {\n        const now = Date.now();\n        for (const [key, value] of this.cache.entries()) {\n            if (now - value.timestamp > this.cacheTimeout) {\n                this.cache.delete(key);\n            }\n        }\n    }\n\n    /**\n     * Get quote age in milliseconds\n     * @param {Object} quote - Quote object with metadata\n     */\n    getQuoteAge(quote) {\n        if (!quote.metadata?.timestamp) return null;\n        return Date.now() - quote.metadata.timestamp;\n    }\n\n    /**\n     * Check if quote is still fresh\n     * @param {Object} quote - Quote object with metadata\n     * @param {number} maxAge - Maximum age in milliseconds\n     */\n    isQuoteFresh(quote, maxAge = this.cacheTimeout) {\n        const age = this.getQuoteAge(quote);\n        return age !== null && age < maxAge;\n    }\n\n    /**\n     * Cleanup resources\n     */\n    destroy() {\n        this.cache.clear();\n    }\n}\n\nexport default QuoteService;
