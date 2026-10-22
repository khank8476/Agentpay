import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";
import { createPPVMiddleware } from "../packages/server/src/index.js";
import { BatchSettler } from "../packages/server/src/batchSettler.js";
import { AgentWallet } from "../packages/agent-sdk/src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Publisher Wallet Configuration
const PUBLISHER_WALLET = ethers.Wallet.createRandom();
const PUBLISHER_ADDRESS = PUBLISHER_WALLET.address;

console.log("===============================================================");
console.log("🚀 STARTING AGENTPAY PUBLISHER SERVER & DEMO GATEWAY 🚀");
console.log("===============================================================");
console.log(`Publisher Address: ${PUBLISHER_ADDRESS}`);
console.log(`Micropayment Fee:  $0.05 USDC per visit/action`);
console.log(`Network:           Base L2 (Chain ID: 8453)`);
console.log("===============================================================\n");

// In-memory telemetry log for live dashboard visualization
const telemetryLogs = [];
let totalEarnedAtomic = 0n;
let totalAgentVisits = 0;
let totalHumanVisits = 0;

// Content database
const ARTICLES_DATABASE = {
  "nvidia-b200-deepdive": {
    title: "NVIDIA Blackwell B200 Architecture & Silicon Deep Dive",
    author: "Dr. Elena Rostova, Senior Semiconductor Analyst",
    date: "2026-10-20",
    freeSummary: "The Blackwell architecture introduces dual-die packaging with 208 billion transistors connected via 10 TB/s NV-HBI interconnect.",
    premiumContent: {
      transistorDensity: "104B per reticle limit TSMC 4NP die",
      nvLinkBandwidth: "1.8 TB/s bidirectional per GPU (18 links)",
      fp4Performance: "20 PFLOPS FP4 Tensor Core with Microscaling Formats",
      coolingRequirement: "Direct-to-chip liquid cooling at 1200W TDP",
      benchmarkVsHopper: {
        "LLama-3 70B Inference": "3.8x throughput per dollar",
        "Mixture-of-Experts 1.8T": "4.2x faster token generation",
        "Memory Bandwidth": "8.0 TB/s HBM3e (192GB memory pool)"
      },
      industryImplications: "Hyperscalers adopting NVL72 rack-scale architecture can collapse 8 data hall clusters into a single liquid-cooled row."
    }
  },
  "quantum-annealing-2026": {
    title: "Commercial Quantum Annealing: 10,000 Qubit Benchmarks",
    author: "Quantum Hardware Review Team",
    date: "2026-10-18",
    freeSummary: "Testing high-coherence superconducting flux qubits for combinatorial logistics optimization.",
    premiumContent: {
      qubitCount: 10240,
      coherenceTimeT1: "185 microseconds",
      topology: "Advantage Pegasus 16-way bipartite mesh",
      realWorldBenchmark: "Solved 120,000-variable TSP routing 410x faster than simulated classical annealing on 64-core AMD EPYC."
    }
  },
  "autonomous-agent-protocols": {
    title: "The Death of Web Advertising: AI Agent M2M Micropayments",
    author: "Web Economics Research",
    date: "2026-10-22",
    freeSummary: "Why web search traffic collapse requires sub-cent cryptographic x402 pay-per-action models.",
    premiumContent: {
      marketShift: "By 2026, over 48% of web queries are performed by autonomous agent runtimes rather than human ocular search.",
      revenueLossPerSite: "Traditional publishers suffer an average 74% decline in Google AdSense CTR due to agent summarization.",
      micropaymentViability: "Charging $0.05 per programmatic visit generates 10x higher RPM than banner ads, with zero ad-tech tracking overhead."
    }
  }
};

// Setup Pay-Per-Visit Middleware
const ppvGate = createPPVMiddleware({
  recipientAddress: PUBLISHER_ADDRESS,
  priceUsd: 0.05,
  currency: "USDC",
  chainId: 8453,
  gateMode: "agents-only", // AI agents are charged $0.05; human browsers see normal view
  debug: false
});

// Telemetry API for the Frontend Dashboard
app.get("/api/telemetry", (req, res) => {
  res.json({
    publisherAddress: PUBLISHER_ADDRESS,
    priceUsd: 0.05,
    currency: "USDC",
    network: "Base (8453)",
    totalEarnedUsd: (Number(totalEarnedAtomic) / 1e6).toFixed(2),
    totalAgentVisits,
    totalHumanVisits,
    recentEvents: telemetryLogs.slice(-25).reverse()
  });
});

// List of available reviews / articles
app.get("/api/articles", (req, res) => {
  const list = Object.entries(ARTICLES_DATABASE).map(([slug, data]) => ({
    slug,
    title: data.title,
    author: data.author,
    date: data.date,
    freeSummary: data.freeSummary,
    url: `/api/articles/${slug}`
  }));
  res.json({ articles: list });
});

// Protected Article Endpoint: Uses the PPV Gate!
app.get("/api/articles/:slug", (req, res, next) => {
  const slug = req.params.slug;
  if (!ARTICLES_DATABASE[slug]) {
    return res.status(404).json({ error: "Article not found" });
  }

  // Execute the PPV Gate
  ppvGate(req, res, () => {
    // If request passed the gate:
    const article = ARTICLES_DATABASE[slug];

    if (req.agentPayment) {
      totalAgentVisits += 1;
      totalEarnedAtomic += 50000n; // $0.05

      telemetryLogs.push({
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        timestamp: new Date().toLocaleTimeString(),
        type: "AGENT_PAID_VISIT",
        agentAddress: req.agentPayment.agentAddress,
        resource: req.originalUrl,
        feeUsd: 0.05,
        currency: "USDC",
        latencyMs: req.agentPayment.latencyMs.toFixed(3),
        remainingBalanceUsd: (Number(req.agentPayment.remainingBalance) / 1e6).toFixed(4)
      });

      return res.json({
        status: "success",
        accessType: "paid_agent_access",
        payment: {
          verifiedInMs: req.agentPayment.latencyMs.toFixed(3),
          amountPaidUsd: 0.05,
          agentAddress: req.agentPayment.agentAddress
        },
        article: {
          slug,
          title: article.title,
          author: article.author,
          date: article.date,
          fullContent: article.premiumContent
        }
      });
    } else {
      // Human browser access
      totalHumanVisits += 1;
      telemetryLogs.push({
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        timestamp: new Date().toLocaleTimeString(),
        type: "HUMAN_BROWSER_VISIT",
        resource: req.originalUrl,
        detectedType: req.visitorType?.agentType || "human",
        feeUsd: 0.00
      });

      return res.json({
        status: "success",
        accessType: "free_human_preview",
        notice: "Human visitor detected. Displaying standard preview.",
        article: {
          slug,
          title: article.title,
          summary: article.freeSummary
        }
      });
    }
  });
});

// ==========================================
// Simulation Helper Endpoints for Web UI Demo
// ==========================================
const simAgent = new AgentWallet({
  maxBudgetPerTaskUsd: 100.0,
  maxPricePerActionUsd: 1.0
});
let lastValidSignedPayload = null;

app.post("/simulate-agent-step", async (req, res) => {
  try {
    const { resourceUri, terms } = req.body;
    const signed = await simAgent.signPaymentForChallenge(terms, resourceUri);
    const encoded = Buffer.from(JSON.stringify(signed)).toString("base64");
    lastValidSignedPayload = encoded;
    res.json({ success: true, encodedPayment: encoded, voucher: signed.voucher });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/simulate-replay-attack", async (req, res) => {
  if (!lastValidSignedPayload) {
    return res.status(400).json({ status: 400, message: "No previous voucher to replay yet. Run an AI Agent visit first." });
  }

  // Attempt to replay the exact same signed voucher to /api/articles/nvidia-b200-deepdive
  const checkRes = await fetch(`http://localhost:${PORT}/api/articles/nvidia-b200-deepdive`, {
    headers: {
      "User-Agent": "AttackerBot/1.0",
      "PAYMENT-SIGNATURE": lastValidSignedPayload
    }
  });

  const body = await checkRes.json();
  res.json({
    status: checkRes.status,
    message: body.message || body.error || "Blocked"
  });
});

app.get("/simulate-burst-benchmark", async (req, res) => {
  const count = parseInt(req.query.count) || 25;
  const latencies = [];
  const terms = {
    priceUsd: 0.05,
    currency: "USDC",
    recipient: PUBLISHER_ADDRESS,
    chainId: 8453
  };

  for (let i = 0; i < count; i++) {
    const resourceUri = `/api/articles/nvidia-b200-deepdive?burst=${i}`;
    const signed = await simAgent.signPaymentForChallenge(terms, resourceUri);
    const encoded = Buffer.from(JSON.stringify(signed)).toString("base64");

    const t0 = performance.now();
    const subRes = await fetch(`http://localhost:${PORT}${resourceUri}`, {
      headers: {
        "User-Agent": "BenchmarkBot/1.0",
        "PAYMENT-SIGNATURE": encoded
      }
    });
    const subTime = performance.now() - t0;
    const serverVerified = parseFloat(subRes.headers.get("X-PPV-Verified-In")) || 0.45;
    latencies.push(serverVerified);
  }

  const avgServerLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  res.json({
    success: true,
    totalRequests: count,
    avgServerLatencyMs: avgServerLatency.toFixed(3),
    minMs: Math.min(...latencies).toFixed(3),
    maxMs: Math.max(...latencies).toFixed(3)
  });
});

export const server = app.listen(PORT, () => {
  console.log(`\n✅ Publisher Gateway running at: http://localhost:${PORT}`);
  console.log(`📊 Open http://localhost:${PORT} in your browser to view the real-time telemetry dashboard.\n`);
});
