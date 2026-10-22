/**
 * Intelligent Agent & Crawler Detection Engine
 * Distinguishes AI autonomous agents and programmatic scrapers from human browser traffic.
 */

const KNOWN_AI_AGENT_SIGNATURES = [
  "gptbot",
  "chatgpt",
  "oai-searchbot",
  "claudebot",
  "anthropic",
  "claude",
  "perplexity",
  "bytespider",
  "cohere",
  "meta-externalagent",
  "google-extended",
  "amazonbot",
  "diffbot",
  "omgili",
  "youbot",
  "applebot",
  "scapia",
  "crawly",
  "ccbot",
  "agent",
  "bot",
  "crawler",
  "spider"
];

const PROGRAMMATIC_CLIENT_SIGNATURES = [
  "python-requests",
  "python-httpx",
  "aiohttp",
  "curl",
  "wget",
  "go-http-client",
  "node-fetch",
  "undici",
  "axios",
  "postmanruntime",
  "insomnia",
  "httpie",
  "urllib",
  "scrapy",
  "selenium",
  "puppeteer",
  "playwright",
  "headlesschrome"
];

export function detectVisitorType(req) {
  const userAgent = (req.headers["user-agent"] || "").toLowerCase();
  const acceptHeader = (req.headers["accept"] || "").toLowerCase();
  const secChUa = req.headers["sec-ch-ua"];
  const isExplicitAgentHeader = req.headers["x-agent-type"] || req.headers["x-agent-id"];

  // 1. Explicit agent header
  if (isExplicitAgentHeader) {
    return {
      isAgent: true,
      agentType: "explicit-ai-agent",
      confidence: 1.0,
      detectedBy: "header"
    };
  }

  // 2. Known AI search/crawler bot
  for (const bot of KNOWN_AI_AGENT_SIGNATURES) {
    if (userAgent.includes(bot)) {
      return {
        isAgent: true,
        agentType: "ai-crawler-agent",
        botName: bot,
        confidence: 0.99,
        detectedBy: "user-agent-ai"
      };
    }
  }

  // 3. Programmatic scraper / bot framework
  for (const client of PROGRAMMATIC_CLIENT_SIGNATURES) {
    if (userAgent.includes(client)) {
      return {
        isAgent: true,
        agentType: "programmatic-client",
        botName: client,
        confidence: 0.95,
        detectedBy: "user-agent-scraping-lib"
      };
    }
  }

  // 4. Missing standard browser security headers on document navigation
  const isDocumentRequest = acceptHeader.includes("text/html") || acceptHeader.includes("text/markdown") || acceptHeader.includes("application/json");
  const hasBrowserSecHeaders = Boolean(secChUa || req.headers["sec-fetch-mode"]);

  if (isDocumentRequest && !hasBrowserSecHeaders && !userAgent.includes("mozilla")) {
    return {
      isAgent: true,
      agentType: "headless-or-curl-agent",
      confidence: 0.85,
      detectedBy: "missing-browser-telemetry"
    };
  }

  return {
    isAgent: false,
    agentType: "human-browser",
    confidence: 0.90,
    detectedBy: "browser-telemetry-present"
  };
}
