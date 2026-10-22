# Contributing to AgentPay

Thank you for your interest in contributing to **AgentPay Protocol**! We welcome contributions from developers, researchers, and agentic AI engineers worldwide.

---

## 🛠️ Development Setup

1. **Fork and Clone the Repository:**
   ```bash
   git clone https://github.com/khank8476/Agentpay.git
   cd Agentpay
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Run the Test Suite:**
   ```bash
   # Run the 7-vector security test suite
   npm run security-test

   # Run the sub-millisecond CPU speed benchmark
   npm run test:fast
   ```

4. **Run the Live Demo Server:**
   ```bash
   npm run demo
   # Open http://localhost:3000 to view the telemetry dashboard
   ```

---

## 📐 Guidelines & Rules

* **Preserve Sub-Millisecond SLA:** Any modifications to the hot path (`packages/core/src/index.js` or `packages/core/src/channel/nonceLedger.js`) must strictly maintain a server verification latency of `< 1.0 ms`. Always run `npm run test:fast` before opening a pull request.
* **Preserve Cryptographic Integrity:** All new schemes must include complete replay-attack defenses, resource bindings, and nonces.
* **Code Style:** Standard ES Modules (`"type": "module"`), modern clean JavaScript.

---

## 🚀 Submitting a Pull Request

1. Create a descriptive branch:
   ```bash
   git checkout -b feature/solana-spl-support
   # or
   git checkout -b fix/nonce-window-cleanup
   ```
2. Commit your changes with clear semantic commit messages (`feat:`, `fix:`, `docs:`, `perf:`).
3. Ensure CI passes locally:
   ```bash
   npm run security-test && npm run test:fast
   ```
4. Push to your fork and submit a PR against `main`.
