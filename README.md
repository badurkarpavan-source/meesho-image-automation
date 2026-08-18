# 🛍️ Meesho Image Automation

Reference photo + basic details daalo → AI (Google Gemini) apne aap **multiple product images** bana dega: white-background main image, inside/USP, feature infographic, lifestyle, colour variants aur ₹offer/CTA slide.

---

## 🔧 Ek baar ka setup (sirf pehli baar)

### 1. Google Gemini API key lo (free)
- Jao 👉 https://aistudio.google.com/app/apikey
- **Create API key** dabao → key copy karo.

### 2. Key ko repo mein secret ke roop mein daalo
- Is repo mein: **Settings → Secrets and variables → Actions → New repository secret**
- **Name:** `GEMINI_API_KEY`
- **Secret:** apni copy ki hui key paste karo → **Add secret**

Bas! Setup ho gaya. ✅

---

## ▶️ Har product ke liye (image banana)

### Tarika A — Issue form (sabse easy)
1. Upar **Issues** tab → **New issue** → *New Product Images* template.
2. Form bharo: Product name, Colours, Price, Features, aur Reference photo (photo drag-drop karo ya public URL paste karo).
3. **Submit new issue** dabao.
4. 1-2 min mein automation chal jayega. Issue pe comment aayega aur images **output/<issue-number>/** folder mein aa jayengi. **Actions** tab se ZIP bhi download kar sakte ho.

### Tarika B — Button se (workflow_dispatch)
- **Actions → Generate Meesho Images → Run workflow** → details bharo → **Run workflow**.

---

## 📸 Kaunsi images banti hain
| File | Kya hoti hai |
| --- | --- |
| `01_main_white` | White background main catalog image |
| `02_inside_usp` | Product use / inside dikhata hua |
| `03_infographic` | Features wali infographic slide |
| `04_lifestyle` | Real-life use wali photo |
| `05_offer_cta` | Price / offer wali slide |
| `colour_XX_*` | Har colour ka variant |

---

## ⚙️ Customize (optional)
- Model badalna ho to workflow ke env mein `GEMINI_MODEL` set karo (default `gemini-2.5-flash-image`).
- Prompts change karne ho to `generate.py` ke `build_prompts()` function ko edit karo.
- Local test ke liye `input/product.json` bhar ke `python generate.py` chala sakte ho.

---

## ⚠️ Notes
- Reference photo agar **URL** ho to woh publicly open honi chahiye.
- Gemini free tier ki daily limit hoti hai — bahut saare products ek saath mat karo.
- AI se bani images ko Meesho pe upload karne se pehle ek baar check zaroor kar lena.
