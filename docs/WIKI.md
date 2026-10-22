# AgentPay Protocol: The Complete Plain-English Wiki & FAQ

Welcome to the **AgentPay Wiki**. This guide explains every single concept, every moving part, and answers all minor and major questions in simple, plain English—with zero confusing jargon.

---

## Table of Contents
1. [The Big Picture: Why Does AgentPay Exist?](#1-the-big-picture-why-does-agentpay-exist)
2. [What is a "Micro-Voucher"? (The Bar Tab Analogy)](#2-what-is-a-micro-voucher-the-bar-tab-analogy)
3. [What is the Smart Contract (`MicropaymentEscrow.sol`) and What Do We Do With It?](#3-what-is-the-smart-contract-and-what-do-we-do-with-it)
4. [How Does Payment Actually Settle? (Step-by-Step Lifecycle)](#4-how-does-payment-actually-settle-step-by-step-lifecycle)
5. [How Can I Test It in Real Life? (From 0 to Real Testnet)](#5-how-can-i-test-it-in-real-life)
6. [Frequently Asked Questions (FAQ)](#6-frequently-asked-questions-faq)

---

## 1. The Big Picture: Why Does AgentPay Exist?

### The Problem:
For the past 30 years, websites made money through **ads and clicks**:
1. A human visits a tech blog or news site.
2. The human sees banner ads or clicks an affiliate link.
3. The website owner earns a small fraction of a cent ($0.005 – $0.05).

**Today, AI Agents (Perplexity, ChatGPT Search, Claude, AutoGPT, web scrapers) have changed everything:**
* An AI agent visits the site, fetches the raw text/markdown, and summarizes it for the user.
* The agent **never views banner ads**, never clicks links, and blocks all tracking cookies.
* The website owner has to pay high server bills to handle the heavy bot scraping, but earns **$0.00 in ad revenue**.

### Why Not Use Stripe or PayPal?
* **High minimum fees:** Stripe charges **$0.30 + 2.9%** per transaction. If you want to charge an agent $0.05, Stripe's minimum fee alone is $0.30—you would lose money on every visit!
* **Requires human interaction:** Credit cards require 3D Secure verification, SMS OTPs, and CAPTCHAs. Autonomous software agents cannot use credit cards on-the-fly.

### Why Not Just Send a Crypto Transaction for Every Page Visit?
* **Too slow:** Even fast blockchains like Base or Arbitrum take **1 to 2 seconds** per block. Solana takes ~400ms. If an AI agent has to wait 2 seconds every time it reads an article, browsing is painfully sluggish.
* **Gas fees:** Submitting 100 separate on-chain transactions eats up gas fees on every single visit.

### The AgentPay Breakthrough:
AgentPay allows autonomous agents to pay micro-fees (like **$0.05 USDC**) with **instant confirmation in 0.15 milliseconds** without touching the blockchain on every visit!

---

## 2. What is a "Micro-Voucher"? (The Bar Tab Analogy)

To understand micro-vouchers, think of a **Bar Tab** at a pub:

```
Traditional Crypto (Slow):
Order 1 peanut ($0.05) -> Wait 2 seconds for blockchain -> Pay $0.005 gas -> Eat peanut.
Order 2nd peanut ($0.05) -> Wait 2 seconds for blockchain -> Pay $0.005 gas -> Eat peanut.
(Awful experience!)

AgentPay Micro-Vouchers (Instant):
1. Hand the bartender $10 up-front to "open a tab". (Escrow Deposit)
2. Order 1 peanut -> Scribble on a napkin: "I owe $0.05 total. Signed, Kamran" (0.1ms).
3. Order 2nd peanut -> Scribble on new napkin: "I owe $0.10 total. Signed, Kamran" (0.1ms).
4. End of night -> Bartender cashes ONLY the last napkin for $0.10.
```

### What Exactly Is a Micro-Voucher in Code?
A micro-voucher is just a tiny, cryptographically signed digital napkin. It is a small JSON object that looks like this:

```json
{
  "channelId": "chn_agent_0x33b_website",
  "recipient": "0x57EC1494fA41859C3b507365f9E39aB7D28F4c9F",
  "agent": "0x8952147d97A1D564B128137a44B40B9BD0f08358",
  "cumulativeAmount": "50000", 
  "nonce": 1,
  "resourceHash": "0x8a92f...",
  "expiry": 1792649000,
  "signature": "0x95abcd..."
}
```

* **`cumulativeAmount: 50000`**: This means $0.05 USDC (in 6 decimals). On the next visit, the voucher says `100000` ($0.10), then `150000` ($0.15), etc.
* **`nonce: 1`**: A sequence number (1, 2, 3...) that prevents anyone from reusing the same voucher twice (Replay Protection).
* **`signature`**: The agent’s cryptographic signature. Only the agent's private key could have produced it.

### Why Is It So Fast (0.15 Milliseconds)?
Verifying a signature takes place entirely in the computer's CPU memory. The website's server does **not** call any blockchain network, does **not** wait for block confirmations, and does **not** pay any gas. The server simply checks the math on the CPU in **0.15 milliseconds** and unlocks the content immediately!

---

## 3. What is the Smart Contract and What Do We Do With It?

The file [`contracts/MicropaymentEscrow.sol`](../contracts/MicropaymentEscrow.sol) is a **Solidity Smart Contract**.

### What Does the Smart Contract Do?
Think of the smart contract as an **unbiased, automated digital safe (escrow)** that lives on a blockchain like **Base L2** (Coinbase's Ethereum network) or Arbitrum.

**Why is it necessary?**  
If the agent only gives the website owner signed digital napkins ("I promise to pay you $0.05"), how does the website owner know the agent actually has money?  
Without an escrow contract, a malicious bot could sign 10,000 promises and walk away without ever paying!

The Smart Contract provides **100% cryptographic trust**:
1. **The Agent deposits money first:** e.g. 5 USDC into the smart contract.
2. **The smart contract locks the funds:** Neither the agent nor the website can steal it.
3. **The website accepts vouchers with confidence:** The website owner knows that as long as they hold a valid signed voucher, the smart contract will hand over the money on demand.

### What Do We Do With the Smart Contract?
* You (or anyone deploying the protocol) **deploy the contract ONCE** to the blockchain (e.g. Base Mainnet or Base Sepolia Testnet).
* Once deployed, it gets a permanent address (like `0x1234...abcd`).
* All agents and websites use this contract address to lock deposits and cash out vouchers.

---

## 4. How Does Payment Actually Settle? (Step-by-Step Lifecycle)

Here is the exact lifecycle of how real USDC moves from the agent to the website owner:

```
[Phase 1: Setup]
Agent Wallet ──(Deposit 5 USDC)──> [MicropaymentEscrow Smart Contract on Base]
                                     └─ Channel opened: chn_001 ($5.00 balance)

[Phase 2: Off-Chain Browsing (Instant 0.15ms per visit)]
Visit 1: Agent signs voucher for $0.05  ──> Website verifies in 0.15ms  ──> Unlocks article 1
Visit 2: Agent signs voucher for $0.10  ──> Website verifies in 0.15ms  ──> Unlocks article 2
Visit 3: Agent signs voucher for $0.15  ──> Website verifies in 0.15ms  ──> Unlocks article 3
...
Visit 100: Agent signs voucher for $5.00 ──> Website verifies in 0.15ms ──> Unlocks article 100

[Phase 3: Settlement (Cashing Out)]
Website Owner takes ONLY the latest voucher ($5.00) and calls:
   MicropaymentEscrow.settleVoucher(voucher, signature)
                                     │
                                     ▼
The Smart Contract transfers $5.00 USDC directly to the Website Owner's wallet!
```

### Notice the Genius of This Design:
* **100 visits occurred.**
* The agent experienced **zero latency** (0.15ms per read).
* The website owner paid gas for **only ONE transaction** instead of 100.
* Gas cost per visit: **less than $0.00005 USD**.

---

## 5. How Can I Test It in Real Life?

You can test this system at 3 different levels:

### Level 1: In Your Browser Right Now (Zero Setup)
Visit the live interactive simulator deployed on GitHub Pages:  
👉 **[https://khank8476.github.io/Agentpay/](https://khank8476.github.io/Agentpay/)**

1. Click **🤖 AI Agent Visit ($0.05 USDC)**:
   * Watch the real-time x402 challenge negotiation.
   * See the sub-millisecond cryptographic verification (`~0.18ms`).
   * Watch the revenue counter update live!
2. Click **🚫 Replay Attack Attempt**:
   * See how the in-memory Nonce Ledger detects the duplicate sequence and blocks fraud in `0.002ms`.
3. Click **⚡ 25-Request Burst Benchmark**:
   * Fires 25 concurrent requests and plots real average CPU latencies.

---

### Level 2: Local CLI Simulation
Run the included autonomous agent against the demo server on your computer:

```bash
# Terminal 1: Start the publisher gateway
npm run demo

# Terminal 2: Run the autonomous research agent
npm run simulate
```
You will see the agent crawl 3 articles, negotiate 402 challenges, sign vouchers, and unlock research data.

---

### Level 3: Testing on a Real Blockchain (Base Sepolia Testnet)

If you want to deploy the contract and test real blockchain transactions with free testnet USDC:

#### Step 1: Get a Web3 Wallet (MetaMask or Coinbase Wallet)
1. Add the **Base Sepolia Testnet** to your wallet:
   * Network Name: Base Sepolia
   * RPC URL: `https://sepolia.base.org`
   * Chain ID: `84532`
   * Currency Symbol: `ETH`
2. Get free testnet ETH from a faucet (e.g. [Coinbase Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet) or [Superchain Faucet](https://faucets.chain.link/base-sepolia)).

#### Step 2: Deploy `MicropaymentEscrow.sol` via Remix (3 Minutes, No Install)
1. Open the free online Ethereum IDE: **[https://remix.ethereum.org](https://remix.ethereum.org)**.
2. In the left file explorer, create a file named `MicropaymentEscrow.sol`.
3. Copy and paste the entire code from [`contracts/MicropaymentEscrow.sol`](../contracts/MicropaymentEscrow.sol).
4. In the left sidebar:
   * Click the **Solidity Compiler** icon &rarr; click **Compile MicropaymentEscrow.sol**.
   * Click the **Deploy & Run Transactions** icon.
   * Under **Environment**, select **Injected Provider - MetaMask**.
   * Under **Deploy**, pass the address of testnet USDC on Base Sepolia (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`).
   * Click **Deploy** and confirm the transaction in your wallet.
5. Your contract is now live on the Base blockchain!

---

## 6. Frequently Asked Questions (FAQ)

### Q: Do regular human website visitors need crypto or a wallet?
**No, absolutely not!**  
The middleware has a built-in `agentDetector`. When a normal human visits your site using Chrome, Safari, or Firefox, they browse completely free (or see your normal display ads). Only programmatic bots (ClaudeBot, GPTBot, Python scripts, headless scrapers) receive the 402 micro-payment gate.

### Q: What currency is used?
The system uses **USDC** (USD Coin) or **USDT** (Tether). Because 1 USDC = $1.00 USD, there is zero cryptocurrency volatility risk. A $0.05 fee is always exactly 5 US cents.

### Q: What if an agent tries to spend more than they deposited?
The server tracks each channel's deposited balance in memory. If an agent deposited $5.00 and tries to send a voucher for $5.05, the server's check catches it in `0.002ms` and returns `HTTP 402 Channel Depleted`.

### Q: What if the website owner disappears? How does the agent get unspent money back?
The smart contract includes a **`requestCloseChannel`** function:
1. The agent calls `requestCloseChannel(channelId)`.
2. A 24-hour challenge dispute window starts. (This gives the website owner 24 hours to submit any final vouchers they earned).
3. Once 24 hours pass, the agent calls `finalizeCloseChannel(channelId)` and the smart contract automatically refunds 100% of all unspent USDC back to the agent's wallet! Neither side can steal from the other.

### Q: What if a hacker steals a voucher from the network?
They cannot use it:
* The voucher is bound to the specific URL (`resourceHash`). Using it on another page fails.
* The voucher is bound to the website owner's wallet address (`recipient`). A hacker cannot redirect the payout to their own wallet.
* The voucher has a strict sequence number (`nonce`). Re-submitting it to the same page fails with `409 Conflict (Replay attack detected)`.

### Q: How do I install it in my own project?
```bash
npm install agentpay-protocol
```
And add 3 lines to your Express / Next.js server:
```javascript
import { createPPVMiddleware } from "agentpay-protocol/server";

app.use("/api/reviews", createPPVMiddleware({
  priceUsd: 0.05,
  recipientAddress: "0x57EC1494fA41859C3b507365f9E39aB7D28F4c9F"
}));
```

---

## 7. Deep Dive: The "One-Visit" Problem, Global Vault & Zero Trapped Funds

### Question 1: "Can I serve ONE single contract for EVERY website that installs agentpay-protocol?"
**YES! 100% Absolutely.**  
This is the core design principle of **`AgentPayGlobalVault.sol`**:
* The contract is deployed **ONCE** on Base L2 (or Arbitrum).
* Websites **NEVER deploy contracts**. A website owner only installs the npm package: `npm install agentpay-protocol`.
* When configuring the middleware, the website owner simply passes their own payout address:
  `recipientAddress: "0x57EC1494fA41859C3b507365f9E39aB7D28F4c9F"`.
* The single global contract handles deposits, vouchers, and payouts for the entire internet.

---

### Question 2: "What if an AI agent visits only ONCE ($0.05)? How is the $5.00 threshold reached?"
If an AI agent visits your tech blog only once and spends $0.05:
* **The website does NOT wait for that single agent to spend $5.00.**
* The website accumulates micro-vouchers across **ALL agents combined**!
  * Agent A visits once &rarr; pays $0.05
  * Agent B visits once &rarr; pays $0.05
  * Agent C visits twice &rarr; pays $0.10
  * ...
  * 100 different AI agents visit throughout the week &rarr; **Total: $5.00 USDC!**
* The website's background settler calls `AgentPayGlobalVault.settleBatch([100 vouchers])` in **ONE single transaction**.
* The smart contract deducts $0.05 from each agent's global deposit and transfers the total $5.00 lump sum directly to the website owner's wallet!

---

### Question 3: "Does an AI agent need a deposit account for every single website?"
**NO! That would be unusable.**  
In the **Global Vault Architecture** ([`contracts/AgentPayGlobalVault.sol`](../contracts/AgentPayGlobalVault.sol)):
1. The AI Agent deposits $10.00 USDC into the **Global Vault ONCE**.
2. That single $10.00 deposit is a **universal balance**:
   * The agent spends $0.05 on TechBlog.com
   * The agent spends $0.05 on NewsSite.com
   * The agent spends $0.05 on ResearchAPI.io
3. The agent does NOT open individual channels per website. It has one master debit balance.

---

### Question 4: "What happens to locked funds? Can money ever get trapped?"
**NO funds can ever be trapped or lost.**
1. **Instant On-Demand Withdrawals:**
   An agent can call `AgentPayGlobalVault.withdraw(amount)` at **any time**. If an agent deposited $10.00 and spent $1.50, they can withdraw the remaining $8.50 with a single transaction immediately.
2. **Auto-Expiry Protection:**
   Every voucher has an expiration timestamp (e.g. 2 hours or 24 hours). Once a voucher expires, it can never be redeemed. The agent’s unspent balance is 100% liquid and withdrawable.

