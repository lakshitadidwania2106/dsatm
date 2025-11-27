# TransitDataFeed Smart Contract

Smart contract for BusBuddy transit data logging on Sepolia testnet.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Add your private key and API keys to `.env`:
   - `PRIVATE_KEY`: Your wallet private key (with Sepolia ETH for gas)
   - `SEPOLIA_RPC_URL`: Sepolia RPC endpoint (default provided)
   - `ETHERSCAN_API_KEY`: For contract verification (optional)

## Deployment

1. Compile the contract:
```bash
npm run compile
```

2. Deploy to Sepolia:
```bash
npm run deploy:sepolia
```

3. Save the deployment address and transaction hash from the output.

## Contract Details

- **Contract Name**: TransitDataFeed
- **Network**: Sepolia Testnet
- **Functions**:
  - `submitReport()`: Submit a new transit report
  - `getReportCount()`: Get total number of reports
  - `getReport(uint256)`: Get a specific report by index
  - `getRecentReports(uint256)`: Get latest N reports

## Usage

After deployment, use the contract address and ABI in the frontend to display blockchain logs.

