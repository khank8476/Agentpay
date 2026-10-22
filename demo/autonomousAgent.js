import { PPVAgentClient } from "../packages/agent-sdk/src/index.js";

async function runAutonomousAgent() {
  console.log("===============================================================");
  console.log("🤖 RUNNING AUTONOMOUS AI RESEARCH AGENT (x402-ENABLED) 🤖");
  console.log("===============================================================\n");

  const agent = new PPVAgentClient({
    maxBudgetPerTaskUsd: 5.0,
    maxPricePerActionUsd: 0.10,
    agentName: "Perplexity-DeepResearch-Agent/2.4"
  });

  console.log(`Agent Initialized: ${agent.wallet.address}`);
  console.log(`Task Budget Cap:   $5.00 USDC`);
  console.log(`Max Price/Action:  $0.10 USDC\n`);

  const baseUrl = "http://localhost:3000";

  console.log("1. Fetching available articles index...");
  const indexRes = await fetch(`${baseUrl}/api/articles`);
  const indexData = await indexRes.json();
  console.log(`Found ${indexData.articles.length} articles to research:\n`);

  indexData.articles.forEach((art, idx) => {
    console.log(`  [${idx + 1}] ${art.title} (${art.url})`);
  });
  console.log("\n---------------------------------------------------------------");
  console.log("2. Autonomous Agent crawling and paying for premium content...");
  console.log("---------------------------------------------------------------\n");

  for (const art of indexData.articles) {
    const targetUrl = `${baseUrl}${art.url}`;
    console.log(`Visiting: ${targetUrl}...`);

    const tStart = performance.now();
    const response = await agent.fetch(targetUrl);
    const duration = performance.now() - tStart;

    if (response.status === 200) {
      const data = await response.json();
      console.log(`  ✅ Success (Status 200 OK)`);
      if (response.x402Meta) {
        console.log(`  💸 Payment Settled:     $${response.x402Meta.pricePaidUsd} ${response.x402Meta.currency}`);
        console.log(`  ⚡ Server Verify Time:  ${response.x402Meta.serverVerifiedIn}`);
        console.log(`  ⏱️ Client Signing Time: ${response.x402Meta.signDurationMs.toFixed(3)} ms`);
        console.log(`  🚀 Total Roundtrip:     ${duration.toFixed(2)} ms`);
      }
      console.log(`  📄 Unlocked Content:   "${data.article.title}" by ${data.article.author}\n`);
    } else {
      console.error(`  ❌ Failed with status: ${response.status}`);
    }
  }

  console.log("===============================================================");
  console.log("📊 AGENT SESSION SUMMARY:");
  console.log("===============================================================");
  const summary = agent.wallet.getSummary();
  console.log(`• Agent Wallet:     ${summary.agentAddress}`);
  console.log(`• Total Spent:      $${summary.totalSpentUsd} USDC`);
  console.log(`• Active Channels:  ${summary.activeChannels}`);
  console.log("===============================================================\n");
}

runAutonomousAgent().catch(console.error);

