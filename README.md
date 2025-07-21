# Jupiter Swap CLI

A simple Node.js CLI tool to swap exactly `0.0000001 SOL` to `USDC` on Solana mainnet using the Jupiter Aggregator V6 API.

## Features

- ✅ Swaps exactly 0.0000001 SOL to USDC (safe for testing)
- ✅ Configurable platform fee via environment variables
- ✅ Jupiter V6 API integration
- ✅ Automatic transaction signing and sending
- ✅ Comprehensive error handling
- ✅ No interactive prompts

## Installation

1. Clone or download the project
2. Install dependencies:

```bash
npm install
```

## First-time setup (Wallet & Configuration)

Before you can use the swap bot, you need a funded Solana wallet and a valid configuration file.

1. **Generate a wallet and .env file automatically:**

   ```bash
   node setup.js
   ```

   - This will create a new Solana wallet and generate a `.env` file with the correct format.
   - **Important:** The private key is stored in `.env`. **Never share this file!**

2. **Fund your wallet:**

   - After running the setup, the script will display your new wallet address (public key).
   - Send some SOL to this address (at least 0.001 SOL for testing).
   - You can use exchanges (Binance, Coinbase, etc.) or a Solana faucet for devnet (for mainnet, use real SOL).

3. **Check your .env file:**

   - Make sure the fields `PRIVATE_KEY`, `FEE_RECIPIENT`, and `FEE_BASIS_POINTS` are filled in.
   - You can edit the fee recipient and fee percentage if needed.

4. **Security reminder:**
   - **Never share your private key or .env file.**
   - Use a dedicated wallet for testing and small amounts.

## Configuration

1. Copy the example environment file:

```bash
cp env.example .env
```

2. Edit `.env` with your configuration:

```env
# Solana wallet private key (Base58 encoded)
PRIVATE_KEY=your_base58_encoded_private_key_here

# Fee recipient wallet address
FEE_RECIPIENT=your_fee_recipient_wallet_address_here

# Fee in basis points (e.g., 30 = 0.3%)
FEE_BASIS_POINTS=30

# Optional: RPC endpoint (defaults to public endpoint)
# RPC_ENDPOINT=https://api.mainnet-beta.solana.com
```

## Usage

Run the swap:

```bash
npm start
```

Or directly:

```bash
node index.js
```

## Environment Variables

| Variable           | Required | Description                                        |
| ------------------ | -------- | -------------------------------------------------- |
| `PRIVATE_KEY`      | Yes      | Base58-encoded Solana wallet private key           |
| `FEE_RECIPIENT`    | Yes      | Wallet address that will receive the platform fee  |
| `FEE_BASIS_POINTS` | Yes      | Integer representing fee in basis points (0-10000) |
| `RPC_ENDPOINT`     | No       | Custom RPC endpoint (defaults to public)           |

## Example Output

```
🚀 Starting Jupiter V6 SOL → USDC swap...
✅ Environment validation passed
💰 Wallet balance: 0.001234 SOL
📊 Getting quote from Jupiter V6...
✅ Quote received:
   📥 Input: 0.0000001 SOL
   📤 Output: 0.000123 USDC
   💥 Price Impact: 0.0001%
   🛤️  Route: Raydium
   💸 Platform Fee: 30 bps to 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM
🔨 Creating swap transaction...
📨 Transaction sent: 5J7X...
⏳ Waiting for confirmation...
🎉 Swap completed successfully!
🔗 Explorer: https://solscan.io/tx/5J7X...
📊 Swapped: 0.0000001 SOL → 0.000123 USDC
💰 Platform fee: 30 bps paid to 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM
```

## Error Handling

The CLI will exit with clear error messages for:

- Missing environment variables
- Invalid private key format
- Invalid wallet addresses
- Insufficient SOL balance
- Network errors
- Transaction failures

## Dependencies

- `dotenv` - Environment variable management
- `@solana/web3.js` - Solana blockchain interaction
- `axios` - HTTP requests to Jupiter API
- `bs58` - Base58 encoding/decoding

## Security Notes

- Never commit your `.env` file
- Keep your private key secure
- Use a dedicated wallet for testing
- Consider using a custom RPC endpoint for production

## License

MIT
