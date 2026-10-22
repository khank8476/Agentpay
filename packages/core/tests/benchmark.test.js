import { ethers } from "ethers";
import { FastAgentPayEngine, signVoucher } from "../src/index.js";

async function runBenchmark() {
  console.log("===============================================================");
  console.log("⚡ AGENTPAY PROTOCOL: ULTRA-FAST 1-2ms VERIFICATION BENCHMARK ⚡");
  console.log("===============================================================\n");

  const recipientWallet = ethers.Wallet.createRandom();
  const agentWallet = ethers.Wallet.createRandom();

  const recipientAddress = recipientWallet.address;
  const agentAddress = agentWallet.address;
  const channelId = `chn_${agentAddress.slice(2, 8)}_${Date.now()}`;
  const priceAtomic = 50000n; // 0.05 USDC (6 decimals)
  const depositAtomic = 10000000n; // 10.00 USDC

  console.log(`Agent Address:     ${agentAddress}`);
  console.log(`Publisher Address: ${recipientAddress}`);
  console.log(`Channel ID:        ${channelId}`);
  console.log(`Price per visit:   $0.05 USDC (50,000 atomic units)`);
  console.log(`Channel Deposit:   $10.00 USDC (10,000,000 atomic units)\n`);

  const engine = new FastAgentPayEngine({
    recipientAddress,
    priceAtomic
  });

  // Register channel deposit
  engine.channelManager.registerChannel({
    channelId,
    agentAddress,
    recipientAddress,
    depositAmount: depositAtomic
  });

  console.log("Warming up JIT compiler (10 runs)...");
  for (let i = 1; i <= 10; i++) {
    const resourceUri = `/api/articles/test-${i}`;
    const { voucher, signature } = await signVoucher(agentWallet, {
      channelId,
      recipient: recipientAddress,
      cumulativeAmount: priceAtomic * BigInt(i),
      nonce: i,
      resourceUri
    });
    engine.verifyPayment({ voucher, signature, resourceUri });
  }

  console.log("Running high-precision benchmark (100 sequential micro-payments)...\n");

  const latencies = [];
  const cryptoTimes = [];
  const nonceTimes = [];
  const channelTimes = [];

  let cumulativeAmount = priceAtomic * 10n; // continuing after warmup
  let nonce = 10;

  for (let i = 1; i <= 100; i++) {
    nonce++;
    cumulativeAmount += priceAtomic;
    const resourceUri = `/reviews/gadget-review-${i}`;

    const { voucher, signature } = await signVoucher(agentWallet, {
      channelId,
      recipient: recipientAddress,
      cumulativeAmount,
      nonce,
      resourceUri
    });

    const result = engine.verifyPayment({ voucher, signature, resourceUri });

    if (!result.verified) {
      console.error(`Verification failed at run ${i}:`, result.error);
      process.exit(1);
    }

    latencies.push(result.latencyBreakdown.totalLatencyMs);
    cryptoTimes.push(result.latencyBreakdown.cryptoMs);
    nonceTimes.push(result.latencyBreakdown.nonceMs);
    channelTimes.push(result.latencyBreakdown.channelMs);
  }

  // Calculate statistics
  latencies.sort((a, b) => a - b);
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p50 = latencies[Math.floor(latencies.length * 0.50)];
  const p90 = latencies[Math.floor(latencies.length * 0.90)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const min = latencies[0];
  const max = latencies[latencies.length - 1];

  const avgCrypto = cryptoTimes.reduce((a, b) => a + b, 0) / cryptoTimes.length;
  const avgNonce = nonceTimes.reduce((a, b) => a + b, 0) / nonceTimes.length;
  const avgChannel = channelTimes.reduce((a, b) => a + b, 0) / channelTimes.length;

  console.log("---------------------------------------------------------------");
  console.log("📊 LATENCY BENCHMARK RESULTS (Server Verification Hot Path):");
  console.log("---------------------------------------------------------------");
  console.log(`• Total Requests Tested:     100`);
  console.log(`• Average Latency:           ${avg.toFixed(3)} ms`);
  console.log(`• Median (p50):              ${p50.toFixed(3)} ms`);
  console.log(`• 90th Percentile (p90):     ${p90.toFixed(3)} ms`);
  console.log(`• 95th Percentile (p95):     ${p95.toFixed(3)} ms`);
  console.log(`• 99th Percentile (p99):     ${p99.toFixed(3)} ms`);
  console.log(`• Fastest (Min):             ${min.toFixed(3)} ms`);
  console.log(`• Slowest (Max):             ${max.toFixed(3)} ms`);
  console.log("---------------------------------------------------------------");
  console.log("🔍 LATENCY BREAKDOWN (Average per operation):");
  console.log(`• Cryptographic ECDSA Recover: ${avgCrypto.toFixed(3)} ms  (~${((avgCrypto / avg) * 100).toFixed(1)}%)`);
  console.log(`• Monotonic Nonce Replay Check: ${avgNonce.toFixed(3)} ms   (~${((avgNonce / avg) * 100).toFixed(1)}%)`);
  console.log(`• State Channel Solvency Check: ${avgChannel.toFixed(3)} ms (~${((avgChannel / avg) * 100).toFixed(1)}%)`);
  console.log("---------------------------------------------------------------");

  if (p95 < 2.0) {
    console.log(`\n✅ TARGET ACHIEVED: 95th percentile is ${p95.toFixed(3)}ms (< 2.0 ms target!). Instant confirmation verified!`);
  } else {
    console.log(`\n⚠️ Notice: 95th percentile is ${p95.toFixed(3)}ms.`);
  }
}

runBenchmark().catch(console.error);

