const hre = require("hardhat");

async function main() {
  console.log("Deploying TransitDataFeed contract to Sepolia...");

  const TransitDataFeed = await hre.ethers.getContractFactory("TransitDataFeed");
  const transitDataFeed = await TransitDataFeed.deploy();

  await transitDataFeed.waitForDeployment();

  const address = await transitDataFeed.getAddress();
  console.log("TransitDataFeed deployed to:", address);

  // Get deployment transaction
  const deploymentTx = transitDataFeed.deploymentTransaction();
  if (deploymentTx) {
    console.log("Deployment transaction hash:", deploymentTx.hash);
  }

  // Wait for a few block confirmations
  console.log("Waiting for block confirmations...");
  await transitDataFeed.deploymentTransaction()?.wait(3);

  console.log("\n=== Deployment Summary ===");
  console.log("Contract Address:", address);
  console.log("Network: Sepolia Testnet");
  console.log("Transaction Hash:", deploymentTx?.hash);
  console.log("\nYou can verify the contract on Etherscan:");
  console.log(`https://sepolia.etherscan.io/address/${address}`);

  // Save deployment info
  const deploymentInfo = {
    network: "sepolia",
    contractAddress: address,
    transactionHash: deploymentTx?.hash,
    deployer: (await hre.ethers.getSigners())[0].address,
    timestamp: new Date().toISOString(),
  };

  console.log("\n=== Deployment Info (save this) ===");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

