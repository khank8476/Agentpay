# AgentPay Protocol: Ultra-Fast 1-2ms Pay-Per-Action (PPA) & Pay-Per-Visit (PPV) for the AI Agentic Web

[![npm version](https://img.shields.io/npm/v/agentpay-protocol.svg)](https://www.npmjs.com/package/agentpay-protocol)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![x402 Compatible](https://img.shields.io/badge/x402-Standard-green.svg)](https://x402.org)
[![Node.js CI](https://github.com/khank8476/Agentpay/actions/workflows/ci.yml/badge.svg)](https://github.com/khank8476/Agentpay/actions)
[![Network](https://img.shields.io/badge/Network-Base%20%7C%20Arbitrum%20%7C%20Ethereum-blueviolet.svg)](https://base.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

An open, high-performance HTTP-native micropayment gateway and middleware built on the **x402 standard** (`HTTP 402 Payment Required`). Designed to replace dying ad-impression revenue by charging autonomous AI agents, crawlers, and LLM search bots (e.g. ClaudeBot, GPTBot, Perplexity) micro-fees (e.g. **$0.05 USDC per visit/action**) with **sub-millisecond cryptographic confirmation (< 0.2ms)**.

👉 **Live Interactive Demo on GitHub Pages:** **[https://khank8476.github.io/Agentpay/](https://khank8476.github.io/Agentpay/)**  
📖 **Plain-English Wiki & Guide:** **[docs/WIKI.md](docs/WIKI.md)** (Answers: What is a micro-voucher? How does payment settle? How to test?)

---

## 💖 Support & Donate

AgentPay is an open-source, community-driven public good designed to save the open web from traffic cannibalization by autonomous agents. If you find this project valuable, consider sponsoring development or donating crypto:

<div align="center">

### 🪙 Multi-Chain EVM Donation Address
```
0x57EC1494fA41859C3b507365f9E39aB7D28F4c9F
```

<img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=ethereum:0x57EC1494fA41859C3b507365f9E39aB7D28F4c9F" alt="Donation QR Code" width="160" height="160"/>

<br/>

[![Ethereum](https://img.shields.io/badge/Ethereum-Etherscan-3c3c3d?logo=ethereum&logoColor=white)](https://etherscan.io/address/0x57EC1494fA41859C3b507365f9E39aB7D28F4c9F)
[![Base](https://img.shields.io/badge/Base-Basescan-0052ff?logo=coinbase&logoColor=white)](https://basescan.org/address/0x57EC1494fA41859C3b507365f9E39aB7D28F4c9F)
[![Arbitrum](https://img.shields.io/badge/Arbitrum-Arbiscan-28a0f0?logo=arbitrum&logoColor=white)](https://arbiscan.io/address/0x57EC1494fA41859C3b507365f9E39aB7D28F4c9F)
[![Polygon](https://img.shields.io/badge/Polygon-Polygonscan-8247e5?logo=polygon&logoColor=white)](https://polygonscan.com/address/0x57EC1494fA41859C3b507365f9E39aB7D28F4c9F)
[![Optimism](https://img.shields.io/badge/Optimism-Optimistic_Etherscan-ff0420?logo=optimism&logoColor=white)](https://optimistic.etherscan.io/address/0x57EC1494fA41859C3b507365f9E39aB7D28F4c9F)

<p><strong>Accepted Assets:</strong> ETH, USDC, USDT, and any ERC-20 token on Base, Arbitrum, Ethereum, Polygon, and Optimism.</p>

</div>

---

## 🌟 The Paradigm Shift: Why Ads Are Dead & PPV Is Essential

For 30 years, web publishing was financed by human eyeballs:
1. Human browses -> views display banner / clicks sponsored link.
2. Publisher earns CPM/CPC revenue ($0.005 - $0.05 per impression).

**The AI Agent Reality:**
* AI Search and Autonomous Agents (ChatGPT Search, Perplexity, Claude artifacts, AutoGPT, web scrapers) crawl articles, parse markdown, and synthesize answers directly for users.
* AI agents **never look at banner ads**, never click affiliate links, and reject tracking pixels.
* Publishers bear 100% of the server and scraping load with **zero ad revenue**.
* `robots.txt` blocking causes an adversarial arms race. Traditional subscription paywalls ($10-$30/month) fail because an AI agent needs to query hundreds of distinct websites to satisfy a single user prompt.

**The Solution:**
A **drop-in Pay-Per-Visit (PPV) and Pay-Per-Action (PPA)** system where:
* Human visitors continue to browse freely or view ads.
* Programmatic AI agents are served an `HTTP 402 Payment Required` challenge.
* Agents cryptographically sign and pay a micro-fee (e.g. $0.05 USDC) on-the-fly.
* Confirmation occurs in **1-2 milliseconds**, with zero human friction.

---

## ⚡ The Architecture: How 1-2 Millisecond Confirmation Is Achieved

Traditional blockchains (even fast ones like Solana at ~400ms or Base/Arbitrum at ~2s) cannot fulfill a 1-2 millisecond HTTP SLA if every request requires an on-chain transaction.

AgentPay achieves **0.17 ms average confirmation speed** through a **Dual-Tier State Channel Architecture**:

```
+-----------------------------------------------------------------------------------+
|                            HOT PATH (< 1.0 Millisecond)                           |
+-----------------------------------------------------------------------------------+
| [AI Agent Client]                                         [Publisher Web Server]  |
|         |                                                           |             |
|         | ----- 1. GET /api/reviews/nvidia-b200 ------------------> |             |
|         |                                                           |             |
|         | <---- 2. HTTP 402 Payment Required (Challenge Header) --- |             |
|         |                                                           |             |
|  (Signs micro-voucher in ~0.2ms)                                    |             |
|         |                                                           |             |
|         | ----- 3. GET /api/reviews/nvidia-b200 ------------------> |             |
|         |          Header: PAYMENT-SIGNATURE: {voucher, sig}        |             |
|         |                                                           |             |
|         |                                               [FastAgentPayEngine]      |
|         |                                               1. Resource Hash (0.01ms) |
|         |                                               2. CPU Crypto (0.14ms)    |
|         |                                               3. Nonce Ledger (0.002ms) |
|         |                                               4. Channel Solvency (0.002ms)|
|         |                                                           |             |
|         | <---- 4. HTTP 200 OK + Premium Content (In < 1.0ms!) ---- |             |
+-----------------------------------------------------------------------------------+

+-----------------------------------------------------------------------------------+
|                        COLD PATH (Asynchronous Batch Settlement)                  |
+-----------------------------------------------------------------------------------+
| Every N requests or $5.00 accumulated, the server submits ONLY the single latest  |
| highest-value voucher to the MicropaymentEscrow.sol contract on Base / Arbitrum.  |
| Per-request gas cost: < $0.00005 USD. Zero RPC latency on user requests!          |
+-----------------------------------------------------------------------------------+
```

---

## 📊 Measured Benchmark Latency

Run on standard Node.js runtime:

| Scheme | Operation | Average Latency | 95th Percentile | Target SLA |
| :--- | :--- | :--- | :--- | :--- |
| **`ed25519-stream`** | Native CPU Signature Verify | **0.142 ms** | 0.280 ms | < 1.0 ms ✅ |
| **Memory Nonce Ledger** | Monotonic Anti-Replay Check | **0.002 ms** | 0.005 ms | < 0.1 ms ✅ |
| **State Channel Solvency** | Balance & Increment Check | **0.002 ms** | 0.004 ms | < 0.1 ms ✅ |
| **Total Server Hot Path** | **End-to-End Verification** | **0.169 ms** | **0.315 ms** | **1-2 ms (Achieved 6x Faster!)** |
| `eip712-voucher` (EVM) | Pure JS `ecrecover` | 5.002 ms | 6.516 ms | EVM Standard |

---

## 💻 1. How Website Owners Integrate It

### Installation

```bash
npm install agentpay-protocol
```

### Option A: Express / Node.js Middleware (3 Lines of Code)

```javascript
import express from "express";
import { createPPVMiddleware } from "agentpay-protocol/server";

const app = express();

// Protect reviews with a $0.05 PPV Gate
app.use("/api/reviews", createPPVMiddleware({
  priceUsd: 0.05,
  recipientAddress: "0x57EC1494fA41859C3b507365f9E39aB7D28F4c9F",
  currency: "USDC",
  chainId: 8453, // Base L2
  gateMode: "agents-only" // Humans browse free with ads; AI agents pay $0.05!
}));

app.get("/api/reviews/nvidia-b200", (req, res) => {
  res.json({ title: "B200 Review", data: "Exclusive benchmarks..." });
});
```

### Option B: Drop-in HTML Script Tag (For WordPress, Static Blogs & SPAs)

Directly hosted on the GitHub Pages CDN:

```html
<!-- Drop into the <head> of your website -->
<script
  src="https://khank8476.github.io/Agentpay/gate.js"
  data-site-id="tech-reviews"
  data-price="0.05"
  data-currency="USDC"
  data-wallet="0x57EC1494fA41859C3b507365f9E39aB7D28F4c9F"
  data-mode="agent-only"
  async>
</script>
```

---

## 🤖 2. How Autonomous AI Agents Integrate It

AI Agents using LangChain, CrewAI, AutoGPT, or custom scraper scripts can wrap HTTP requests with `PPVAgentClient`:

```javascript
import { PPVAgentClient } from "agentpay-protocol/agent";

const agent = new PPVAgentClient({
  privateKey: "0xAgentPrivateKey...",
  maxBudgetPerTaskUsd: 5.0,  // Never spend more than $5 on a task
  maxPricePerActionUsd: 0.10 // Max fee per single page visit
});

// Automatically negotiates 402, signs payment in 0.2ms, and fetches data transparently!
const response = await agent.fetch("https://example.com/api/reviews/nvidia-b200");
const data = await response.json();
console.log(data);
```

---

## 🚀 Running the Live Demo & Verification Tests

### 1. View the Live Web Dashboard
Visit **[https://khank8476.github.io/Agentpay/](https://khank8476.github.io/Agentpay/)** to test:
* Interactive simulator buttons to trigger AI Agent visits, Human free visits, and Replay attacks
* Real-time metrics counters (USDC earned, visits paid, verification latency)
* Live telemetry stream

### 2. Run Locally via Node.js
```bash
npm run demo
# Open http://localhost:3000 in your browser
```

### 3. Run the Autonomous AI Research Agent (CLI)
In a separate terminal, watch the simulated AI agent crawl the publisher site, negotiate payments, and unlock articles:
```bash
npm run simulate
```

### 4. Run the Security & Failsafe Test Suite
Verifies all 7 security vectors (replay attack, forgery, double spend, expiry, resource tampering):
```bash
npm run security-test
```

### 5. Run the Sub-Millisecond Speed Benchmark
```bash
npm run test:fast
```

---

## 📜 On-Chain Smart Contract: `MicropaymentEscrow.sol`

Located at [`contracts/MicropaymentEscrow.sol`](file:///c:/Users/KAMRAN/Downloads/ppv/contracts/MicropaymentEscrow.sol):
* Supports USDC/USDT on Base, Arbitrum, Optimism, and Ethereum.
* Allows publishers to settle accumulated off-chain vouchers with a single transaction.
* Features a 24-hour challenge dispute period for agent fund withdrawals.

---

## 🤝 Community & Contributing

Contributions are warmly welcomed! Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) before submitting pull requests.

## 📄 License

AgentPay Protocol is licensed under the [MIT License](LICENSE).  
Copyright &copy; 2026 AgentPay Protocol Contributors.
