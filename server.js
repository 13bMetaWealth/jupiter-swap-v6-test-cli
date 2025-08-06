import express from "express";
import cors from "cors";
import {
  Connection,
  PublicKey,
  Keypair,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import axios from "axios";
import bs58 from "bs58";

const app = express();
app.use(cors());
app.use(express.json());

const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_API = "https://quote-api.jup.ag/v6/swap";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SWAP_AMOUNT = 100000; // 0.0000001 SOL
const DEFAULT_SLIPPAGE_BPS = 50;

app.post("/swap", async (req, res) => {
  const logs = [];
  function log(msg) {
    logs.push(msg);
  }
  try {
    const { privateKey, feeRecipient, feeBps, rpcEndpoint } = req.body;
    if (!privateKey || !feeRecipient || !feeBps) {
      return res.status(400).json({ error: "Missing required fields", logs });
    }
    // Validate and create keypair
    let keypair;
    try {
      const privateKeyBytes = bs58.decode(privateKey);
      if (privateKeyBytes.length !== 64)
        throw new Error("Private key must be 64 bytes");
      keypair = Keypair.fromSecretKey(privateKeyBytes);
    } catch (e) {
      return res
        .status(400)
        .json({ error: "Invalid private key: " + e.message, logs });
    }
    // Validate fee recipient
    try {
      new PublicKey(feeRecipient);
    } catch (e) {
      return res
        .status(400)
        .json({ error: "Invalid fee recipient address", logs });
    }
    // Validate fee bps
    const feeBpsInt = parseInt(feeBps);
    if (isNaN(feeBpsInt) || feeBpsInt < 0 || feeBpsInt > 10000) {
      return res
        .status(400)
        .json({ error: "Fee basis points must be between 0 and 10000", logs });
    }
    // Connect
    const endpoint = rpcEndpoint || "https://api.mainnet-beta.solana.com";
    const connection = new Connection(endpoint, {
      commitment: "confirmed",
      disableRetryOnRateLimit: false,
    });
    log(`🌐 Connected to: ${endpoint}`);
    // Check balance
    const balance = await connection.getBalance(keypair.publicKey);
    const sol = balance / LAMPORTS_PER_SOL;
    log(`💰 Wallet balance: ${sol} SOL`);
    if (sol < 0.001) {
      return res
        .status(400)
        .json({
          error: "Insufficient SOL balance. Please fund your wallet.",
          logs,
        });
    }
    // Get quote
    log("📊 Getting quote from Jupiter V6...");
    const params = {
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      amount: SWAP_AMOUNT.toString(),
      slippageBps: DEFAULT_SLIPPAGE_BPS,
      onlyDirectRoutes: true,
      asLegacyTransaction: false,
      platformFeeBps: feeBpsInt,
      feeAccount: feeRecipient,
    };
    let quote;
    try {
      const response = await axios.get(JUPITER_QUOTE_API, {
        params,
        timeout: 10000,
      });
      quote = response.data;
      if (!quote || !quote.outAmount)
        throw new Error("Invalid quote response from Jupiter");
    } catch (e) {
      return res
        .status(500)
        .json({ error: "Quote request failed: " + e.message, logs });
    }
    log("✅ Quote received:");
    log(`   📥 Input: ${SWAP_AMOUNT / LAMPORTS_PER_SOL} SOL`);
    log(`   📤 Output: ${(parseInt(quote.outAmount) / 1e6).toFixed(6)} USDC`);
    log(
      `   💥 Price Impact: ${(parseFloat(quote.priceImpactPct) * 100).toFixed(
        4
      )}%`
    );
    log(
      `   🛤️  Route: ${
        quote.routePlan?.map((r) => r.swapInfo?.label).join(" → ") || "Direct"
      }`
    );
    log(`   💸 Platform Fee: ${feeBpsInt} bps to ${feeRecipient}`);
    // Create swap transaction
    log("🔨 Creating swap transaction...");
    let swapTransaction;
    try {
      const swapPayload = {
        quoteResponse: quote,
        userPublicKey: keypair.publicKey.toString(),
        wrapAndUnwrapSol: true,
        useSharedAccounts: false,
        feeAccount: feeRecipient,
        asLegacyTransaction: false,
        useTokenLedger: false,
      };
      const response = await axios.post(JUPITER_SWAP_API, swapPayload, {
        timeout: 15000,
        headers: { "Content-Type": "application/json" },
      });
      swapTransaction = response.data.swapTransaction;
      if (!swapTransaction)
        throw new Error("No swap transaction returned from Jupiter");
    } catch (e) {
      return res
        .status(500)
        .json({
          error: "Swap transaction creation failed: " + e.message,
          logs,
        });
    }
    // Sign and send
    let signature;
    try {
      const transaction = VersionedTransaction.deserialize(
        Buffer.from(swapTransaction, "base64")
      );
      transaction.sign([keypair]);
      log("📨 Sending transaction...");
      signature = await connection.sendTransaction(transaction, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3,
      });
      log(`📨 Transaction sent: ${signature}`);
      log("⏳ Waiting for confirmation...");
      const confirmation = await connection.confirmTransaction(
        signature,
        "confirmed"
      );
      if (confirmation.value.err)
        throw new Error(
          `Transaction failed: ${JSON.stringify(confirmation.value.err)}`
        );
    } catch (e) {
      return res
        .status(500)
        .json({ error: "Transaction execution failed: " + e.message, logs });
    }
    log("🎉 Swap completed successfully!");
    log(`🔗 Explorer: https://solscan.io/tx/${signature}`);
    res.json({ success: true, signature, logs });
  } catch (error) {
    res.status(500).json({ error: error.message, logs });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`JupiterSwap backend listening on port ${PORT}`);
});
