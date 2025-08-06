#!/usr/bin/env node

<<<<<<< HEAD
// DEPRECATED: This file is deprecated. Please use core-swap.js directly.
// This thin wrapper is maintained for backwards compatibility.

import CoreSwap from "./core-swap.js";

// Legacy wrapper class for backwards compatibility
class JupiterSwapBot extends CoreSwap {
  constructor() {
    // Use the enhanced options for detailed balance checking (original index.js behavior)
    super({
      includeDetailedBalance: true,
      onlyDirectRoutes: true,
      useSharedAccounts: false,
    });
  }

  // For backwards compatibility, we keep the original method name
  async performSwap() {
    const result = await super.performSwap();
    return result.signature; // Return signature for backwards compatibility
  }
}

// Main execution (preserved for backwards compatibility)
=======
import { config } from "dotenv";
import {
  Connection,
  PublicKey,
  Keypair,
  VersionedTransaction,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import axios from "axios";
import bs58 from "bs58";
import { Command } from "commander";

// Load environment variables
config();

// CLI argument parsing
const program = new Command();
program
  .option(
    "--priority-fee-mode <mode>",
    "Set priority fee mode (auto, fixed, dynamic, helius, none)"
  )
  .option(
    "--fixed-priority-fee <microLamports>",
    "Set fixed priority fee in micro-lamports (if mode=fixed)"
  )
  .option(
    "--dynamic-priority-fee-multiplier <multiplier>",
    "Set dynamic priority fee multiplier (if mode=dynamic)"
  )
  .option(
    "--max-priority-fee <microLamports>",
    "Set max priority fee in micro-lamports"
  )
  .helpOption("-h, --help", "Show help")
  .addHelpText(
    "after",
    "\n\nExamples:\n  $ node index.js --priority-fee-mode none\n  $ node index.js --priority-fee-mode fixed --fixed-priority-fee 1000\n  $ node index.js --priority-fee-mode dynamic --dynamic-priority-fee-multiplier 1.5\n"
  );
program.parse(process.argv);
const options = program.opts();

// Override env vars with CLI options if provided
if (options.priorityFeeMode) {
  if (options.priorityFeeMode === "none") {
    process.env.PRIORITY_FEE_MODE = "auto";
    process.env.FIXED_PRIORITY_FEE_MICRO_LAMPORTS = "0";
    process.env.DYNAMIC_PRIORITY_FEE_MULTIPLIER = "0";
    process.env.MAX_PRIORITY_FEE_MICRO_LAMPORTS = "0";
  } else {
    process.env.PRIORITY_FEE_MODE = options.priorityFeeMode;
  }
}
if (options.fixedPriorityFee) {
  process.env.FIXED_PRIORITY_FEE_MICRO_LAMPORTS = options.fixedPriorityFee;
}
if (options.dynamicPriorityFeeMultiplier) {
  process.env.DYNAMIC_PRIORITY_FEE_MULTIPLIER =
    options.dynamicPriorityFeeMultiplier;
}
if (options.maxPriorityFee) {
  process.env.MAX_PRIORITY_FEE_MICRO_LAMPORTS = options.maxPriorityFee;
}

// Jupiter V6 API endpoints
const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_API = "https://quote-api.jup.ag/v6/swap";

// Token addresses (mainnet)
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Configuration
const SWAP_AMOUNT = 100000; // 0.0001 SOL in lamports
const DEFAULT_SLIPPAGE_BPS = 50; // 0.5%

class JupiterSwapBot {
  constructor() {
    this.connection = null;
    this.keypair = null;
    this.validateEnvironment();
    this.initializeConnection();
  }

  validateEnvironment() {
    console.log("🔍 Validating environment...");

    const required = ["PRIVATE_KEY", "FEE_RECIPIENT", "FEE_BASIS_POINTS"];
    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing environment variables: ${missing.join(", ")}`);
    }

    // Validate private key
    try {
      const privateKeyBytes = bs58.decode(process.env.PRIVATE_KEY);
      if (privateKeyBytes.length !== 64) {
        throw new Error("Private key must be 64 bytes");
      }
      this.keypair = Keypair.fromSecretKey(privateKeyBytes);
    } catch (error) {
      throw new Error(`Invalid private key: ${error.message}`);
    }

    // Validate fee recipient
    try {
      new PublicKey(process.env.FEE_RECIPIENT);
    } catch (error) {
      throw new Error("Invalid fee recipient address");
    }

    // Validate fee basis points
    const feeBps = parseInt(process.env.FEE_BASIS_POINTS);
    if (isNaN(feeBps) || feeBps < 0 || feeBps > 10000) {
      throw new Error("Fee basis points must be between 0 and 10000");
    }

    console.log("✅ Environment validation passed");
  }

  initializeConnection() {
    const rpcEndpoint =
      process.env.RPC_ENDPOINT || "https://api.mainnet-beta.solana.com";
    this.connection = new Connection(rpcEndpoint, {
      commitment: "confirmed",
      disableRetryOnRateLimit: false,
    });
    console.log(`🌐 Connected to: ${rpcEndpoint}`);
  }

  async checkBalance() {
    const balance = await this.connection.getBalance(this.keypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;

    console.log(`💎 Wallet: ${this.keypair.publicKey.toString()}`);
    console.log(`💰 Balance: ${solBalance.toFixed(9)} SOL`);

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

    return balance;
  }

  async getQuote() {
    console.log("📊 Getting quote from Jupiter V6...");

    try {
      const params = {
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        amount: SWAP_AMOUNT.toString(),
        slippageBps: DEFAULT_SLIPPAGE_BPS,
        onlyDirectRoutes: true,
        asLegacyTransaction: false,
        platformFeeBps: parseInt(process.env.FEE_BASIS_POINTS),
        feeAccount: process.env.FEE_RECIPIENT,
      };

      const response = await axios.get(JUPITER_QUOTE_API, {
        params,
        timeout: 10000,
      });

      const quote = response.data;

      if (!quote || !quote.outAmount) {
        throw new Error("Invalid quote response from Jupiter");
      }

      console.log("✅ Quote received:");
      console.log(`   📥 Input: ${SWAP_AMOUNT / LAMPORTS_PER_SOL} SOL`);
      console.log(
        `   📤 Output: ${(parseInt(quote.outAmount) / 1e6).toFixed(6)} USDC`
      );
      console.log(
        `   💥 Price Impact: ${(parseFloat(quote.priceImpactPct) * 100).toFixed(
          4
        )}%`
      );
      console.log(`   🛣️  Route: ${this.getRouteInfo(quote)}`);
      console.log(
        `   💸 Platform Fee: ${process.env.FEE_BASIS_POINTS} bps to ${process.env.FEE_RECIPIENT}`
      );

      return quote;
    } catch (error) {
      if (error.response?.data?.error) {
        throw new Error(`Jupiter API error: ${error.response.data.error}`);
      }
      throw new Error(`Quote request failed: ${error.message}`);
    }
  }

  getRouteInfo(quote) {
    if (quote.routePlan && quote.routePlan.length > 0) {
      const exchanges = quote.routePlan.map(
        (step) => step.swapInfo?.label || "Unknown"
      );
      return exchanges.join(" → ");
    }
    return "Direct";
  }

  async createSwapTransaction(quote) {
    console.log("🔨 Creating swap transaction...");

    try {
      const swapPayload = {
        quoteResponse: quote,
        userPublicKey: this.keypair.publicKey.toString(),
        wrapAndUnwrapSol: true,
        useSharedAccounts: false,
        feeAccount: process.env.FEE_RECIPIENT,
        asLegacyTransaction: false,
        useTokenLedger: false,
      };

      const response = await axios.post(JUPITER_SWAP_API, swapPayload, {
        timeout: 15000,
        headers: {
          "Content-Type": "application/json",
        },
      });

      const { swapTransaction } = response.data;

      if (!swapTransaction) {
        throw new Error("No swap transaction returned from Jupiter");
      }

      return swapTransaction;
    } catch (error) {
      if (error.response?.data?.error) {
        throw new Error(`Jupiter swap API error: ${error.response.data.error}`);
      }
      throw new Error(`Swap transaction creation failed: ${error.message}`);
    }
  }

  async executeSwap(swapTransaction) {
    console.log("✍️  Signing and sending transaction...");

    try {
      // Deserialize the transaction
      const transactionBuf = Buffer.from(swapTransaction, "base64");
      const transaction = VersionedTransaction.deserialize(transactionBuf);

      // Sign the transaction
      transaction.sign([this.keypair]);

      // Simulate transaction first
      console.log("🧪 Simulating transaction...");
      const simulationResult = await this.connection.simulateTransaction(
        transaction,
        {
          replaceRecentBlockhash: true,
          sigVerify: false,
        }
      );

      console.log("🔍 Simulation details:");
      console.log(
        `   Compute units consumed: ${
          simulationResult.value.unitsConsumed || "N/A"
        }`
      );
      console.log(
        `   Logs: ${
          simulationResult.value.logs?.slice(-5).join("\n         ") ||
          "No logs"
        }`
      );

      if (simulationResult.value.err) {
        console.error(
          "❌ Full simulation error:",
          JSON.stringify(simulationResult.value, null, 2)
        );
        throw new Error(
          `Transaction simulation failed: ${JSON.stringify(
            simulationResult.value.err
          )}`
        );
      }

      console.log("✅ Simulation successful");

      // Send the transaction with retry logic
      let signature;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          signature = await this.connection.sendTransaction(transaction, {
            skipPreflight: false,
            preflightCommitment: "confirmed",
            maxRetries: 3,
          });
          break;
        } catch (error) {
          attempts++;
          if (attempts === maxAttempts) throw error;
          console.log(`⚠️  Attempt ${attempts} failed, retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      console.log(`📨 Transaction sent: ${signature}`);

      // Wait for confirmation with timeout
      console.log("⏳ Waiting for confirmation...");
      const confirmation = await this.connection.confirmTransaction(
        signature,
        "confirmed"
      );

      if (confirmation.value.err) {
        throw new Error(
          `Transaction failed: ${JSON.stringify(confirmation.value.err)}`
        );
      }

      return signature;
    } catch (error) {
      throw new Error(`Transaction execution failed: ${error.message}`);
    }
  }

  async performSwap() {
    try {
      console.log("🚀 Starting Jupiter V6 SOL → USDC swap...\n");

      // Check wallet balance
      await this.checkBalance();

      // Get quote from Jupiter
      const quote = await this.getQuote();

      // Create swap transaction
      const swapTransaction = await this.createSwapTransaction(quote);

      // Execute the swap
      const signature = await this.executeSwap(swapTransaction);

      // Success message
      console.log("\n🎉 Swap completed successfully!");
      console.log(`🔗 Explorer: https://solscan.io/tx/${signature}`);
      console.log(
        `📊 Swapped: ${SWAP_AMOUNT / LAMPORTS_PER_SOL} SOL → ${(
          parseInt(quote.outAmount) / 1e6
        ).toFixed(6)} USDC`
      );
      console.log(
        `💰 Platform fee: ${process.env.FEE_BASIS_POINTS} bps paid to ${process.env.FEE_RECIPIENT}`
      );

      return signature;
    } catch (error) {
      console.error(`\n❌ Swap failed: ${error.message}`);
      throw error;
    }
  }
}

// Main execution
>>>>>>> 7acc588eb1356aa72443dadabda33980939b50b9
async function main() {
  try {
    const bot = new JupiterSwapBot();
    await bot.performSwap();
    process.exit(0);
  } catch (error) {
    console.error(`\n💥 Fatal error: ${error.message}`);
    process.exit(1);
  }
}

// Handle process termination
process.on("SIGINT", () => {
  console.log("\n👋 Interrupted by user");
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log("\n👋 Terminated");
  process.exit(1);
});

// Run if this file is executed directly
main();
