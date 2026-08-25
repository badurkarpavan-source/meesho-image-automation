// Meesho Trending Research robot ka dimaag
// Roz 10 trending products dhoondhta hai (sirf 5 categories) aur trending.json me likhta hai.
// Gemini me Google Search grounding ON hai taaki wo sach me web pe dekhe, guess na kare.
// 429/503 aane par thoda ruk ke dobara koshish karta hai. Error ho to trending.json me likh deta hai.
const fs = require("fs");

function writeOut(obj) {
  fs.writeFileSync("trending.json", JSON.stringify(obj, null, 2));
}
function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  writeOut({ updated: new Date().toISOString(), status: "FAILED", errors: ["GEMINI_API_KEY missing in GitHub secrets"], products: [] });
  console.error("GEMINI_API_KEY missing");
  process.exit(0);
}

const ATTEMPTS = [
  { model: "gemini-3.6-flash", tool: { google_search: {} } },
  { model: "gemini-3.6-flash", tool: null },
];

const PROMPT = [
  "You are a Meesho reselling research assistant for a small Indian reseller (Shree Hari Export).",
  "Use Google Search to do REAL, current research. Find EXACTLY 10 products that are trending / best-selling RIGHT NOW on Meesho (also cross-check Amazon India and Flipkart).",
  "",
  "STRICT RULES:",
  "- Only real products you actually found via search. Never invent products, numbers, or links.",
  "- Every product MUST include at least one real listing URL as proof (prefer meesho.com links).",
  "- Only pick products in these 5 categories (the reseller's wholesalers only stock these):",
  "  1) Kitchen tools & gadgets (peeler, grater, chopper, chilni)",
  "  2) Storage / organizers (containers, bags, racks)",
  "  3) Home utility (clothes-drying rope, cleaning, hooks)",
  "  4) Home decor (wall stickers, fairy lights, festive)",
  "  5) Fashion accessories / clothing (small items)",
  "- Lightweight, low wholesale cost, must allow Rs 30-100 net profit.",
  "",
  "For EACH product return these fields:",
  "- name",
  "- category (one of the 5 above)",
  "- trending_on (e.g. 'Meesho, Amazon')",
  "- proof (real signal: star rating, number of ratings/reviews, 'sold' etc.)",
  "- listing_link (a real URL)",
  "- est_wholesale (approx Surat wholesale price, like 'Rs 60')",
  "- suggested_price (Meesho selling price)",
  "- est_profit (net in hand, Rs 30-100)",
  "- title (full keyword-rich English Meesho title)",
  "- description (2-3 line English description)",
  "- keywords (array of SHORT desi/hinglish words real buyers type, e.g. 'chilni','kaddukas')",
  "- specs (material, size, weight, whats in box)",
  "- hsn (HSN code + GST% if known, else '')",
  "",
  "Output ONLY a valid JSON array of 10 objects. No markdown, no explanation, no code fences.",
].join("\n");

async function callGemini(model, tool) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + KEY;
  const body = {
    contents: [{ role: "user", parts: [{ text: PROMPT }] }],
    generationConfig: { temperature: 0.4 },
  };
  if (tool) body.tools = [tool];
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    const err = new Error(model + (tool ? " (search)" : " (no-search)") + " -> HTTP " + res.status + ": " + t.slice(0, 300));
    err.httpStatus = res.status;
    throw err;
  }
  const data = await res.json();
  const parts = (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  return parts.map(function (p) { return p.text; }).filter(Boolean).join("\n");
}

// 429 (quota) / 503 (busy) aaye to thoda ruk ke dobara koshish.
async function callWithRetry(model, tool) {
  const waits = [15000, 30000, 45000];
  let lastErr = null;
  for (let i = 0; i <= waits.length; i++) {
    try {
      return await callGemini(model, tool);
    } catch (e) {
      lastErr = e;
      if ((e.httpStatus === 429 || e.httpStatus === 503) && i < waits.length) {
        console.log("Retry in", waits[i] / 1000, "s ->", (e.message || "").slice(0, 70));
        await sleep(waits[i]);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

function parseProducts(text) {
  let t = (text || "").trim();
  t = t.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(t); } catch (e) {}
  const m = t.match(/\[[\s\S]*\]/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return [];
}

async function main() {
  const errors = [];
  for (const a of ATTEMPTS) {
    try {
      console.log("Trying model:", a.model, a.tool ? "with search" : "no search");
      const text = await callWithRetry(a.model, a.tool);
      const products = parseProducts(text);
      if (products && products.length) {
        writeOut({ updated: new Date().toISOString(), model: a.model, grounded: !!a.tool, count: products.length, products: products });
        console.log("SUCCESS: wrote", products.length, "products via", a.model);
        return;
      }
      errors.push(a.model + ": call ok but no products parsed. Raw start: " + (text || "").slice(0, 200));
    } catch (e) {
      errors.push(e.message);
      console.error("Failed:", e.message);
    }
  }
  writeOut({ updated: new Date().toISOString(), status: "FAILED", errors: errors, products: [] });
  console.error("All attempts failed.");
}

main();
