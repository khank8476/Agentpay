/**
 * AgentPay Client-Side Drop-in Gate (v1.0.0)
 * Hosted on GitHub Pages CDN: https://khank8476.github.io/Agentpay/gate.js
 * 
 * Usage:
 * <script 
 *   src="https://khank8476.github.io/Agentpay/gate.js" 
 *   data-price="0.05" 
 *   data-wallet="0x57EC1494fA41859C3b507365f9E39aB7D28F4c9F"
 *   data-currency="USDC"
 *   data-mode="agent-only"
 *   async>
 * </script>
 */

(function () {
  const currentScript = document.currentScript || document.querySelector('script[src*="gate.js"]');
  if (!currentScript) return;

  const config = {
    price: currentScript.getAttribute("data-price") || "0.05",
    currency: currentScript.getAttribute("data-currency") || "USDC",
    wallet: currentScript.getAttribute("data-wallet"),
    mode: currentScript.getAttribute("data-mode") || "agent-only",
    network: currentScript.getAttribute("data-network") || "base"
  };

  // Bot detection signatures
  const userAgent = (navigator.userAgent || "").toLowerCase();
  const botSignatures = [
    "gptbot", "chatgpt", "claudebot", "anthropic", "perplexity",
    "bytespider", "cohere", "ccbot", "diffbot", "crawly",
    "headlesschrome", "phantomjs", "selenium", "puppeteer", "playwright"
  ];

  const isAutomatedBot = botSignatures.some(bot => userAgent.includes(bot)) ||
                         navigator.webdriver === true ||
                         window.navigator.languages?.length === 0;

  if (config.mode === "agent-only" && !isAutomatedBot) {
    // Normal human visitor -> Allow free view
    return;
  }

  // Inject x402 Meta Tags into head for crawlers
  const meta402 = document.createElement("meta");
  meta402.name = "x402:payment";
  meta402.content = JSON.stringify({
    version: "x402-v1.1",
    priceUsd: config.price,
    currency: config.currency,
    recipient: config.wallet,
    network: config.network,
    schemes: ["ed25519-stream", "eip712-voucher"]
  });
  document.head.appendChild(meta402);

  // If accessed by a headless scraper without payment
  if (isAutomatedBot && !sessionStorage.getItem("agentpay_paid")) {
    window.addEventListener("DOMContentLoaded", function () {
      const banner = document.createElement("div");
      banner.id = "agentpay-gate-barrier";
      banner.style.cssText = "position:fixed;top:0;left:0;right:0;padding:12px;background:#0f172a;color:#f8fafc;font-family:sans-serif;text-align:center;font-size:13px;border-bottom:2px solid #3b82f6;z-index:999999;";
      banner.innerHTML = `<strong>AgentPay x402 Protected:</strong> This resource charges autonomous agents $${config.price} ${config.currency} per read. Include <code>PAYMENT-SIGNATURE</code> header to unlock.`;
      document.body.prepend(banner);
    });
  }
})();
