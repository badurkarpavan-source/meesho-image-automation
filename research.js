// Meesho Trending Research robot ka dimaag
// Roz 10 trending products dhoondhta hai (sirf 5 categories) aur trending.json me likhta hai.
// Gemini me Google Search grounding ON hai taaki wo sach me web pe dekhe, guess na kare.
// Agar koi error aaye to wo error bhi trending.json me likh deta hai taaki diagnose ho sake.
const fs = require("fs");

function writeOut(obj) {
  fs.writeFileSync("trending.json", JSON.stringify(obj, null, 2));
}

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  writeOut({ updated: new Date().toISOString(), status: "FAILED", errors: ["GEMINI_API_KEY missing in GitHub secrets"], products: [] });
  console.error("GEMINI_API_KEY missing");
  process.exit(0);
}

// Alag-alag models try karega jab tak ek kaam na kar jaye.
const ATTEMPTS = [
  { model: "gemini-2.5-flash", tool: { google_search: {} } },
  { model: "gemini-2.0-flash", tool: { google_search: {} } },
  { model: "gemini-1.5-flash", tool: { google_search_retrieval: {} } },
  { model: "gemini-2.0-flash", tool: null },
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
    throw new Error(model + (tool ? " (search)" : " (no-search)") + " -> HTTP " + res.status + ": " + t.slice(0, 400));
  }
  const data = await res.json();
  const parts = (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  return parts.map(function (p) { return p.text; }).filter(Boolean).join("\n");
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
      const text = await callGemini(a.model, a.tool);
      const products = parseProducts(text);
      if (products && products.length) {
        writeOut({ updated: new Date().toISOString(), model: a.model, count: products.length, products: products });
        console.log("SUCCESS: wrote", products.length, "products via", a.model);
        return;
      }
      errors.push(a.model + ": call ok but no products parsed. Raw start: " + (text || "").slice(0, 200));
    } catch (e) {
      errors.push(e.message);
      console.error("Failed:", e.message);
    }
  }
  // Sab attempts fail — error ko file me likh do taaki diagnose ho sake.
  writeOut({ updated: new Date().toISOString(), status: "FAILED", errors: errors, products: [] });
  console.error("All attempts failed.");
}

main();
