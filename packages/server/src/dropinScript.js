/**
 * Drop-in Client-Side Script Generator
 * Allows publishers to protect static sites, WordPress blogs, or SPAs with a single <script> tag.
 */

export function generateDropinScriptHtml({
  scriptUrl = "https://khank8476.github.io/Agentpay/gate.js",
  siteId,
  priceUsd = 0.05,
  recipientAddress = "0x57EC1494fA41859C3b507365f9E39aB7D28F4c9F",
  currency = "USDC",
  network = "base"
}) {
  return `<!-- AgentPay PPV Protection (Autonomous Agent Pay-Per-Visit Gate) -->
<script
  src="${scriptUrl}"
  data-site-id="${siteId}"
  data-price="${priceUsd}"
  data-currency="${currency}"
  data-network="${network}"
  data-wallet="${recipientAddress}"
  data-mode="agent-only"
  async>
</script>
<noscript>
  <meta http-equiv="refresh" content="0; url=/402-payment-required">
</noscript>
<!-- /AgentPay PPV Protection -->`;
}

