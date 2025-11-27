# Deployment Guide for TransitDataFeed Contract

## Prerequisites

1. **Node.js** (v16 or higher)
2. **MetaMask** or another Web3 wallet
3. **Sepolia ETH** for gas fees (get from [Sepolia Faucet](https://sepoliafaucet.com/))
4. **Hardhat** (will be installed via npm)

## Setup Steps

### 1. Install Dependencies

```bash
cd contracts
npm install
```

### 2. Configure Environment

Create a `.env` file in the `contracts` directory:

```bash
cp .env.example .env
```

Edit `.env` and add:
- `PRIVATE_KEY`: Your wallet's private key (with Sepolia ETH)
- `SEPOLIA_RPC_URL`: Sepolia RPC endpoint (default: https://rpc.sepolia.org)
- `ETHERSCAN_API_KEY`: For contract verification (optional)

**⚠️ Security Note**: Never commit your `.env` file or share your private key!

### 3. Compile Contract

```bash
npm run compile
```

### 4. Deploy to Sepolia

```bash
npm run deploy:sepolia
```

The script will:
- Deploy the contract to Sepolia testnet
- Display the contract address
- Show the transaction hash
- Provide Etherscan verification link

### 5. Save Deployment Information

After deployment, save:
- **Contract Address**: Use this in the frontend
- **Transaction Hash**: For verification
- **Network**: Sepolia Testnet

## Example Output

```
Deploying TransitDataFeed contract to Sepolia...
TransitDataFeed deployed to: 0x42E257F26C99D54580218f76d63D7f7A2A992A32
Deployment transaction hash: 0x6a2c34d8b9d033f22c608b0a9f5d471e8c9527a20c78a1a3672e8f1929d20c4a

=== Deployment Summary ===
Contract Address: 0x42E257F26C99D54580218f76d63D7f7A2A992A32
Network: Sepolia Testnet
Transaction Hash: 0x6a2c34d8b9d033f22c608b0a9f5d471e8c9527a20c78a1a3672e8f1929d20c4a
```

## Contract ABI

The ABI is automatically generated in `artifacts/contracts/TransitDataFeed.sol/TransitDataFeed.json` after compilation.

## Frontend Integration

Update the contract address in `frontend/src/pages/BlockchainLogsPage.jsx`:

```javascript
const CONTRACT_ADDRESS = 'YOUR_DEPLOYED_CONTRACT_ADDRESS'
```

## Testing the Contract

You can interact with the deployed contract using:
- [Etherscan Sepolia](https://sepolia.etherscan.io/)
- MetaMask
- Hardhat console: `npx hardhat console --network sepolia`

## Troubleshooting

- **Insufficient funds**: Make sure your wallet has Sepolia ETH
- **Network issues**: Check your RPC URL in `.env`
- **Compilation errors**: Ensure Solidity version matches (0.8.20)

