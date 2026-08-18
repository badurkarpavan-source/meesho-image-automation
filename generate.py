"""
Meesho product image generator.

Reference photo + basic details -> multiple e-commerce product images using
Google Gemini. Inputs come from environment variables (CI) or input/product.json.
"""
import os
import re
import sys
import json
import mimetypes
import pathlib
import urllib.request

from google import genai
from google.genai import types

MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash-image")


def load_inputs():
    """Read inputs from env vars, else from input/product.json."""
    if os.environ.get("PRODUCT_NAME"):
        return {
            "product_name": os.environ.get("PRODUCT_NAME", "").strip(),
            "colours": [c.strip() for c in os.environ.get("COLOURS", "").split(",") if c.strip()],
            "price": os.environ.get("PRICE", "").strip(),
            "features": os.environ.get("FEATURES", "").strip(),
            "reference_image_url": os.environ.get("REFERENCE_IMAGE_URL", "").strip(),
        }
    path = pathlib.Path("input/product.json")
    if not path.exists():
        print("ERROR: no inputs found (set env vars or create input/product.json)")
        sys.exit(1)
    return json.loads(path.read_text(encoding="utf-8"))


def get_reference_image(raw_url):
    """Download the reference image and return it as a Gemini image Part."""
    if not raw_url:
        return None
    match = re.search(r"https?://[^\s\)\]>]+", raw_url)
    if not match:
        return None
    url = match.group(0)
    headers = {"User-Agent": "Mozilla/5.0"}
    token = os.environ.get("GITHUB_TOKEN", "")
    if token and ("github.com" in url or "githubusercontent.com" in url):
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        data = resp.read()
        mime = resp.headers.get_content_type() or "image/jpeg"
    return types.Part.from_bytes(data=data, mime_type=mime)


def build_prompts(d):
    """Build (filename, prompt) pairs for every image we want."""
    name = d.get("product_name", "product")
    price = d.get("price", "")
    feats = d.get("features", "")
    keep = (
        "Keep the exact same design, shape, texture and details from the "
        "reference image."
    )
    prompts = [
        (
            "01_main_white",
            f"Professional e-commerce catalog photo of this exact product ({name}). "
            f"{keep} Place it on a pure white background, front view, soft studio "
            f"lighting, sharp focus. 1:1 square, 1000x1000px.",
        ),
        (
            "02_inside_usp",
            f"E-commerce photo of this exact product ({name}) shown open / in use to "
            f"highlight how it works and its main benefits. {keep} Clean bright "
            f"background, 3-quarter or top-down view. 1:1 square.",
        ),
        (
            "03_infographic",
            f"Clean modern e-commerce infographic slide for {name}. Product in the "
            f"centre on a soft pastel background with 3-5 short callout labels for "
            f"these features: {feats}. Bold readable text, minimal design. 1:1 square.",
        ),
        (
            "04_lifestyle",
            f"Lifestyle photo of a person holding / using this exact product ({name}) "
            f"in a bright, cozy real-life setting, natural light, e-commerce style. "
            f"1:1 square.",
        ),
    ]
    if price:
        prompts.append(
            (
                "05_offer_cta",
                f"Bold promotional e-commerce sale slide featuring this exact product "
                f"({name}) with large text '{price}' and 'Free Delivery'. Eye-catching "
                f"attractive design. 1:1 square.",
            )
        )
    for i, colour in enumerate(d.get("colours", []), start=1):
        slug = re.sub(r"[^a-zA-Z0-9]+", "_", colour).strip("_").lower() or f"c{i}"
        prompts.append(
            (
                f"colour_{i:02d}_{slug}",
                f"E-commerce catalog photo of this exact product ({name}) in {colour} "
                f"colour. {keep} Only change the colour to {colour}. Pure white "
                f"background, front view, studio lighting. 1:1 square, 1000x1000px.",
            )
        )
    return prompts


def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY is not set. Add it in repo Settings > Secrets.")
        sys.exit(1)

    data = load_inputs()
    out_dir = pathlib.Path(os.environ.get("OUTPUT_DIR", "output"))
    out_dir.mkdir(parents=True, exist_ok=True)

    client = genai.Client(api_key=api_key)
    reference = get_reference_image(data.get("reference_image_url", ""))
    if reference is None:
        print("WARNING: no reference image loaded, generating from text only.")

    saved = []
    for key, prompt in build_prompts(data):
        contents = [prompt]
        if reference is not None:
            contents.append(reference)
        try:
            response = client.models.generate_content(model=MODEL, contents=contents)
        except Exception as exc:
            print(f"[skip] {key}: {exc}")
            continue
        count = 0
        for cand in (response.candidates or []):
            parts = getattr(getattr(cand, "content", None), "parts", None) or []
            for part in parts:
                inline = getattr(part, "inline_data", None)
                if inline and inline.data:
                    ext = mimetypes.guess_extension(inline.mime_type or "image/png") or ".png"
                    file_path = out_dir / f"{key}{ext}"
                    file_path.write_bytes(inline.data)
                    saved.append(str(file_path))
                    count += 1
        print(f"[ok] {key}: {count} image(s)")

    (out_dir / "manifest.json").write_text(
        json.dumps({"product": data, "files": saved}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"\nDone! {len(saved)} image(s) saved to '{out_dir}'.")


if __name__ == "__main__":
    main()
