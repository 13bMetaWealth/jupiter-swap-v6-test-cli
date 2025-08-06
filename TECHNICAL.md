# Technical Documentation - Jupiter Swap CLI

## Architecture Overview

The Jupiter Swap CLI is a Node.js application that performs automated SOL to USDC swaps using Jupiter V6 API. It follows a modular architecture with clear separation of concerns.

## Core Components

### 1. Environment Management (`validateEnv()`)
- Validates all required environment variables
- Ensures proper format for private keys and addresses
- Validates fee basis points range (0-10000)
- Exits with clear error messages if validation fails

### 2. Solana Connection (`getConnection()`)
- Establishes connection to Solana mainnet
- Supports custom RPC endpoints via `RPC_ENDPOINT`
- Uses 'confirmed' commitment level for reliability

### 3. Jupiter API Integration

#### Quote API (`getQuote()`)
```javascript
GET https://quote-api.jup.ag/v6/quote
```
Parameters:
- `inputMint`: SOL token address
- `outputMint`: USDC token address  
- `amount`: Amount in lamports (100000 = 0.0000001 SOL)
- `slippageBps`: 50 (0.5% slippage tolerance)
- `feeBps`: Configurable fee in basis points
- `feeRecipient`: Wallet receiving the fee
- `onlyDirectRoutes`: false (allow complex routes)
- `asLegacyTransaction`: false (use versioned transactions)

#### Swap API (`executeSwap()`)
```javascript
POST https://quote-api.jup.ag/v6/swap
```
- Converts quote response to executable transaction
- Handles SOL wrapping/unwrapping automatically
- Returns base64-encoded transaction

### 4. Transaction Processing (`signAndSendTransaction()`)
- Deserializes base64 transaction
- Signs with provided private key
- Sends to Solana network
- Waits for confirmation
- Returns transaction signature

## Key Features

### Fixed Amount Swap
- Always swaps exactly 0.0000001 SOL (100,000 lamports)
- Prevents accidental large transactions
- Suitable for testing and small transactions

### Configurable Fees
- Fee recipient specified via `FEE_RECIPIENT`
- Fee amount via `FEE_BASIS_POINTS` (0-10000)
- Example: 30 basis points = 0.3% fee

### Error Handling
- Comprehensive validation at each step
- Clear error messages with specific failure reasons
- Graceful exit on any failure

### Security Features
- Private key validation (Base58 format)
- Address validation (Solana public key format)
- No interactive prompts (prevents phishing)
- Environment-based configuration

## API Endpoints Used

### Jupiter V6 Quote API
```
GET https://quote-api.jup.ag/v6/quote
```

### Jupiter V6 Swap API  
```
POST https://quote-api.jup.ag/v6/swap
```

### Solana RPC
```
POST https://api.mainnet-beta.solana.com
```

## Token Addresses

- **SOL**: `So11111111111111111111111111111111111111112`
- **USDC**: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`

## Transaction Flow

1. **Environment Validation** → Check all required variables
2. **Connection Setup** → Initialize Solana connection
3. **Balance Check** → Verify sufficient SOL balance
4. **Quote Request** → Get swap quote from Jupiter
5. **Swap Execution** → Convert quote to transaction
6. **Transaction Signing** → Sign with private key
7. **Network Submission** → Send to Solana network
8. **Confirmation** → Wait for transaction confirmation
9. **Success Output** → Display results and transaction URL

## Error Scenarios

| Error Type | Cause | Resolution |
|------------|-------|------------|
| `ENV INCOMPLETE` | Missing environment variables | Add required variables to `.env` |
| `INVALID PRIVATE KEY` | Wrong format | Use Base58 encoded private key |
| `INVALID FEE_RECIPIENT` | Invalid address | Use valid Solana public key |
| `INSUFFICIENT BALANCE` | Not enough SOL | Add SOL to wallet |
| `Transaction failed` | Network/RPC issues | Check connection and retry |

## Performance Considerations

- **Timeout**: 5 seconds for API calls
- **Slippage**: 0.5% tolerance
- **Commitment**: 'confirmed' level
- **Preflight**: Enabled for safety

## Security Best Practices

1. **Environment Variables**: Never commit `.env` files
2. **Private Keys**: Use dedicated test wallets
3. **RPC Endpoints**: Consider private RPC for production
4. **Fee Validation**: Verify fee calculations
5. **Error Logging**: Monitor for suspicious activity

## Dependencies

```json
{
  "dotenv": "^16.3.1",           // Environment management
  "@solana/web3.js": "^1.87.6",  // Solana blockchain interaction
  "axios": "^1.6.2",             // HTTP requests
  "bs58": "^5.0.0",              // Base58 encoding
  "commander": "^11.1.0"         // CLI argument parsing
}
```

## Testing

The `test.js` script validates:
- Environment variable presence
- Private key format
- Address format
- Fee basis points range
- Jupiter API connectivity

Run with: `node test.js` 