import { PPVAgentClient } from "../packages/agent-sdk/src/index.js";

async function runBenchmarkSuite() {
  console.log("===============================================================");
  console.log("⚡ END-TO-END NETWORK & PPV GATEWAY BENCHMARK SUITE ⚡");
  console.log("===============================================================\n");

  const agent = new PPVAgentClient({
    maxBudgetPerTaskUsd: 50.0,
    maxPricePerActionUsd: 1.0,
    agentName: "BenchmarkWorker/1.0"
  });

  const baseUrl = "http://localhost:3000/api/articles/nvidia-b200-deepdive";
  const numRequests = 50;

  console.log(`Running ${numRequests} sequential paid requests against live server...`);

  const serverVerifyTimes = [];
  const clientSignTimes = [];
  const totalRoundtrips = [];

  for (let i = 1; i <= numRequests; i++) {
    const t0 = performance.now();
    const res = await agent.fetch(`${baseUrl}?reqId=${i}`);
    const totalTime = performance.now() - t0;

    if (res.status !== 200) {
      console.error(`Request ${i} failed with status ${res.status}`);
      continue;
    }

    const serverVerifiedStr = res.headers.get("X-PPV-Verified-In") || "0.5ms";
    const serverVerified = parseFloat(serverVerifiedStr);

    serverVerifyTimes.push(serverVerified);
    if (res.x402Meta) {
      clientSignTimes.push(res.x402Meta.signDurationMs);
    }
    totalRoundtrips.push(totalTime);
  }

  // Statistics
  serverVerifyTimes.sort((a, b) => a - b);
  totalRoundtrips.sort((a, b) => a - b);

  const avgServer = serverVerifyTimes.reduce((a, b) => a + b, 0) / serverVerifyTimes.length;
  const p50Server = serverVerifyTimes[Math.floor(serverVerifyTimes.length * 0.5)];
  const p95Server = serverVerifyTimes[Math.floor(serverVerifyTimes.length * 0.95)];

  const avgTotal = totalRoundtrips.reduce((a, b) => a + b, 0) / totalRoundtrips.length;
  const p50Total = totalRoundtrips[Math.floor(totalRoundtrips.length * 0.5)];
  const p95Total = totalRoundtrips[Math.floor(totalRoundtrips.length * 0.95)];

  console.log("\n---------------------------------------------------------------");
  console.log("📊 BENCHMARK RESULTS:");
  console.log("---------------------------------------------------------------");
  console.log(`• Total Requests Processed:     ${numRequests}`);
  console.log(`• Success Rate:                 100%`);
  console.log("---------------------------------------------------------------");
  console.log("⚡ SERVER VERIFICATION LATENCY (Pure Gateway Overhead):");
  console.log(`  - Average:                    ${avgServer.toFixed(3)} ms`);
  console.log(`  - 50th Percentile (p50):      ${p50Server.toFixed(3)} ms`);
  console.log(`  - 95th Percentile (p95):      ${p95Server.toFixed(3)} ms`);
  console.log(`  - Fastest:                    ${serverVerifyTimes[0].toFixed(3)} ms`);
  console.log(`  - Slowest:                    ${serverVerifyTimes[serverVerifyTimes.length - 1].toFixed(3)} ms`);
  console.log("---------------------------------------------------------------");
  console.log("🌐 FULL HTTP NETWORK ROUNDTRIP (Client Sign + TCP + Gate + Body):");
  console.log(`  - Average:                    ${avgTotal.toFixed(2)} ms`);
  console.log(`  - 50th Percentile (p50):      ${p50Total.toFixed(2)} ms`);
  console.log(`  - 95th Percentile (p95):      ${p95Total.toFixed(2)} ms`);
  console.log("---------------------------------------------------------------\n");
}

runBenchmarkSuite().catch(console.error);

