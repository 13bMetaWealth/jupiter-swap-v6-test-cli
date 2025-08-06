# JupiterSwap - Solana DEX Trading Suite

A comprehensive Node.js suite for automated SOL to USDC swaps on Solana mainnet using Jupiter V6 API. Features CLI tools, REST API, performance profiling, and advanced fee management.

## 🚀 Features

- ✅ **Core Swap Engine**: Reliable SOL → USDC swaps with configurable fees
- ✅ **CLI Interface**: Simple command-line tool for quick swaps
- ✅ **REST API**: HTTP endpoints for integration with web apps
- ✅ **Performance Profiling**: Advanced monitoring and optimization tools
- ✅ **Priority Fee Management**: Dynamic fee calculation for optimal transaction speed
- ✅ **Comprehensive Error Handling**: Robust error management and retry logic
- ✅ **Security**: Private key validation and secure transaction signing

## 📦 Installation

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd JupiterSwap
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **First-time setup:**

   ```bash
   node setup.js
   ```

   This generates a new Solana wallet and creates a `.env` file with the correct configuration.

4. **Fund your wallet:**
   - After setup, the script displays your wallet address
   - Send at least 0.001 SOL to this address for testing
   - Use exchanges (Binance, Coinbase) or Solana faucets

## 🔧 Configuration

### Environment Variables

Copy the example configuration:

```bash
cp env.example .env
```

Edit `.env` with your settings:

```env
# Required: Solana wallet private key (Base58 encoded)
PRIVATE_KEY=your_base58_encoded_private_key_here

# Required: Fee recipient wallet address
FEE_RECIPIENT=your_fee_recipient_wallet_address_here

# Required: Fee in basis points (e.g., 30 = 0.3%)
FEE_BASIS_POINTS=30

# Optional: Custom RPC endpoint
RPC_ENDPOINT=https://api.mainnet-beta.solana.com
```

### Configuration Options

| Variable           | Required | Description                              | Default           |
| ------------------ | -------- | ---------------------------------------- | ----------------- |
| `PRIVATE_KEY`      | Yes      | Base58-encoded Solana wallet private key | -                 |
| `FEE_RECIPIENT`    | Yes      | Wallet address receiving platform fees   | -                 |
| `FEE_BASIS_POINTS` | Yes      | Fee percentage (0-10000)                 | -                 |
| `RPC_ENDPOINT`     | No       | Custom RPC endpoint                      | Public Solana RPC |

## 🖥️ Usage

### CLI Interface

**Basic swap (recommended):**

```bash
npm start
# or
node index.js
```

**Alternative swap modes:**

```bash
# Simple swap without priority fees
npm run swap

# Swap with dynamic priority fees
npm run swap:priority
```

**Performance profiling:**

```bash
# View performance baseline
npm run profile:report

# Run comprehensive performance tests
npm run profile

# Generate mock baseline data
npm run profile:baseline
```

### REST API

**Start the API server:**

```bash
node server.js
```

Server runs on `http://localhost:3001`

**API Endpoints:**

#### POST `/swap`

Execute a SOL to USDC swap.

**Request Body:**

```json
{
  "privateKey": "your_base58_private_key",
  "feeRecipient": "wallet_address",
  "feeBps": 30,
  "rpcEndpoint": "https://api.mainnet-beta.solana.com"
}
```

**Response:**

```json
{
  "success": true,
  "signature": "transaction_signature",
  "logs": [
    "🚀 Starting Jupiter V6 SOL → USDC swap...",
    "✅ Environment validation passed",
    "💰 Wallet balance: 0.001234 SOL",
    "📊 Getting quote from Jupiter V6...",
    "✅ Quote received:",
    "   📥 Input: 0.0000001 SOL",
    "   📤 Output: 0.000123 USDC",
    "🎉 Swap completed successfully!",
    "🔗 Explorer: https://solscan.io/tx/5J7X..."
  ]
}
```

### Example Output

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

## 📊 Performance Monitoring

The project includes advanced performance profiling tools:

### Current Performance Baseline

- **Total Swap Time**: 12.85 seconds average
- **Success Rate**: 80% (8/10 successful swaps)
- **Compute Units**: 139,782 CU average
- **Transaction Cost**: ~0.000699 SOL (~$0.07 @ $100 SOL)

### Performance Analysis

```bash
# View detailed performance report
npm run profile:report
```

**Key Metrics:**

- Quote API Latency: 1.09s average
- Transaction Build: 1.53s average
- Transaction Confirmation: 12.23s average ⚠️
- RPC Latency: 59.8ms average

### Optimization Recommendations

1. **Transaction Confirmation** (Critical): Implement dynamic priority fees
2. **API Optimization** (Medium): Add quote caching and request batching
3. **Reliability** (Medium-High): Enhanced error handling and retry logic

## 🏗️ Project Architecture

### Core Components

#### `core-swap.js` - Main Swap Engine

- **Status**: ✅ Active (Recommended)
- **Purpose**: Core swap functionality with comprehensive configuration
- **Features**: Priority fee management, detailed logging, error handling

#### `services/` - Modular Services

- `QuoteService.js`: Jupiter API integration
- `PriorityFeeService.js`: Dynamic fee calculation
- `NetworkService.js`: RPC connection management
- `TxService.js`: Transaction processing

#### `server.js` - REST API

- **Purpose**: HTTP endpoints for web integration
- **Features**: CORS support, JSON responses, comprehensive logging

### Deprecated Components

The following files are maintained for backwards compatibility:

- `index.js` - Deprecated wrapper (use `core-swap.js`)
- `jupiter-swap.js` - Deprecated wrapper (use `core-swap.js`)

**Migration Guide:**

```javascript
// OLD
import JupiterSwapBot from "./index.js";

// NEW
import CoreSwap from "./core-swap.js";
const swap = new CoreSwap({
  useSharedAccounts: true,
  onlyDirectRoutes: false,
  includeDetailedBalance: false,
});
```

### Utility Scripts

- `setup.js`: Wallet generation and configuration
- `demo.js`: Jupiter API testing
- `test.js`: Environment validation
- `debug.js`: Quote and transaction debugging

## 🔍 Troubleshooting

### Common Issues

**"Insufficient SOL balance"**

- Fund your wallet with at least 0.001 SOL
- Check balance with: `node check-balance.js`

**"Invalid private key"**

- Ensure private key is Base58 encoded
- Verify key length is 64 bytes
- Use `node setup.js` to generate a new wallet

**"Transaction failed"**

- Check network connectivity
- Verify RPC endpoint is accessible
- Ensure sufficient SOL for transaction fees

**"Quote request failed"**

- Check Jupiter API status
- Verify token addresses are correct
- Ensure slippage tolerance is reasonable

### Performance Issues

**Slow transaction confirmation:**

- Use dynamic priority fees: `npm run swap:priority`
- Consider premium RPC endpoints
- Monitor network congestion

**High failure rate:**

- Increase priority fees
- Use retry logic with exponential backoff
- Check RPC endpoint reliability

## 📁 Project Structure

```
JupiterSwap/
├── core-swap.js              # Main swap engine (recommended)
├── server.js                 # REST API server
├── index.js                  # CLI wrapper (deprecated)
├── services/                 # Modular services
│   ├── QuoteService.js       # Jupiter API integration
│   ├── PriorityFeeService.js # Fee calculation
│   ├── NetworkService.js     # RPC management
│   └── TxService.js          # Transaction processing
├── setup.js                  # Wallet generation
├── demo.js                   # API testing
├── test.js                   # Environment validation
├── debug.js                  # Debugging tools
├── performance-profiler.js   # Performance monitoring
├── baseline-report-generator.js # Baseline generation
├── display-report.js         # Report viewer
├── check-balance.js          # Balance checking
├── check-token-accounts.js   # Token account validation
├── swap-priority.js          # Priority fee swap
├── swap-priority-minimal.js  # Minimal priority swap
├── swap-no-priority.js       # No priority fee swap
├── package.json              # Dependencies and scripts
├── env.example               # Configuration template
├── README.md                 # This file
├── TECHNICAL.md              # Technical documentation
├── UPGRADE_SUMMARY.md        # Recent improvements
├── TASK_COMPLETION_SUMMARY.md # Performance audit results
├── PERFORMANCE_PROFILING.md  # Performance documentation
└── DEPRECATION.md            # Deprecated components
```

## 🛡️ Security

### Best Practices

- **Never share your private key or `.env` file**
- Use dedicated wallets for testing
- Start with small amounts (0.001 SOL)
- Consider using custom RPC endpoints for production
- Regularly update dependencies

### Environment Security

```bash
# Never commit .env file
echo ".env" >> .gitignore

# Use environment-specific configurations
cp env.example .env.production
cp env.example .env.development
```

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Install dependencies: `npm install`
4. Run tests: `npm test`
5. Submit a pull request

### Code Style

- Use ES6+ modules
- Follow JSDoc documentation standards
- Include error handling for all async operations
- Add performance monitoring for new features

### Testing

```bash
# Run all tests
npm test

# Test specific components
node test.js
node demo.js
```

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Links

- **Jupiter API**: https://docs.jup.ag/
- **Solana Explorer**: https://explorer.solana.com/
- **Solscan**: https://solscan.io/
- **Solana Web3.js**: https://docs.solana.com/developing/clients/javascript-api

---

**Status**: ✅ Production Ready  
**Last Updated**: 2024  
**Version**: 1.0.0
