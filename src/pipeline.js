import { SEED as SAMPLE, FEED_DATE as SAMPLE_DATE } from "./data/sample.js";

export const PIPE_KEY = "be_pipeline_v1";

export function loadPipeline() {
  try {
    const raw = localStorage.getItem(PIPE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p.products)) return { products: p.products, feedDate: p.feedDate || SAMPLE_DATE, custom: true };
    }
  } catch {}
  return { products: SAMPLE, feedDate: SAMPLE_DATE, custom: false };
}

export function savePipeline(products, feedDate) {
  localStorage.setItem(PIPE_KEY, JSON.stringify({ products, feedDate }));
}
export function resetPipeline() { try { localStorage.removeItem(PIPE_KEY); } catch {} }

const EMPTY_TOOLKIT = { theyreInterested: "", theyreQuiet: "", theyreTheRightPerson: "", phCommentAngle: "" };

// Short, stable, non-cryptographic hash (FNV-1a, base36) used for fallback ids.
function shortHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36).slice(0, 6);
}

export function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Accepts one product, an array, or {products:[...]}. Returns {ok, products, errors}.
// Never throws: every problem ends up in errors[].
export function parseProducts(text) {
  try {
    return parseProductsUnsafe(text);
  } catch (e) {
    return { ok: false, products: [], errors: ["Could not read this data: " + (e && e.message ? e.message : String(e))] };
  }
}

function parseProductsUnsafe(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { return { ok: false, products: [], errors: ["Invalid JSON: " + e.message] }; }
  if (data && Array.isArray(data.products)) data = data.products;
  if (!Array.isArray(data)) data = [data];
  const errors = [], products = [], used = new Set();
  data.forEach((p, i) => {
    const at = `#${i + 1}`;
    if (!p || typeof p !== "object" || Array.isArray(p)) return errors.push(`${at}: not an object`);
    if (p.name === undefined || p.name === null || p.name === "") return errors.push(`${at}: missing "name"`);
    if (typeof p.name !== "string") return errors.push(`${at}: "name" must be text, got ${typeof p.name} (${String(p.name)})`);
    const name = String(p.name).trim();
    if (!name) return errors.push(`${at}: "name" is empty`);
    const a = p.assessment;
    if (!a || typeof a !== "object" || typeof a.score !== "number" || !Number.isFinite(a.score)) return errors.push(`${name}: missing assessment.score (number)`);
    let id = typeof p.id === "string" && p.id.trim() ? p.id.trim() : slugify(name);
    if (!id) id = `target-${shortHash(name)}-${i + 1}`;
    // never let two products in one import share an id (merge would silently drop one)
    if (used.has(id)) { let n = 2; while (used.has(`${id}-${n}`)) n++; id = `${id}-${n}`; }
    used.add(id);
    products.push({
      upvotes: 0, tagline: "", category: "", phUrl: "", url: "", ...p, id,
      assessment: {
        worthMessaging: a.score >= 65, founderPlay: false, messageTarget: "founder",
        linkedInMessage: "", connectionNote: "", reasoning: "", ...a,
        replyToolkit: { ...EMPTY_TOOLKIT, ...(a.replyToolkit && typeof a.replyToolkit === "object" ? a.replyToolkit : {}) },
      },
    });
  });
  return { ok: errors.length === 0, products, errors };
}

export function mergeProducts(existing, incoming) {
  const map = new Map(existing.map((p) => [p.id, p]));
  incoming.forEach((p) => map.set(p.id, p));
  return [...map.values()];
}

export const TEMPLATE = JSON.stringify({
  name: "Product Name", tagline: "What it does", upvotes: 0, category: "Category",
  phUrl: "https://www.producthunt.com/products/slug", url: "https://example.com",
  assessment: {
    score: 70, worthMessaging: true, founderPlay: false,
    positioning: "", claimsToChallenge: "", architecturalObservation: "", opportunityAngle: "",
    linkedInMessage: "", connectionNote: "", messageTarget: "founder",
    replyToolkit: { theyreInterested: "", theyreQuiet: "", theyreTheRightPerson: "", phCommentAngle: "" },
    reasoning: "",
  },
}, null, 2);
