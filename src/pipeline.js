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

// Accepts one product, an array, or {products:[...]}. Returns {ok, products, errors}.
export function parseProducts(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { return { ok: false, products: [], errors: ["Invalid JSON: " + e.message] }; }
  if (data && Array.isArray(data.products)) data = data.products;
  if (!Array.isArray(data)) data = [data];
  const errors = [], products = [];
  data.forEach((p, i) => {
    if (!p || typeof p !== "object") return errors.push(`#${i + 1}: not an object`);
    if (!p.name) return errors.push(`#${i + 1}: missing "name"`);
    const a = p.assessment;
    if (!a || typeof a.score !== "number") return errors.push(`${p.name}: missing assessment.score (number)`);
    const id = p.id || p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    products.push({
      upvotes: 0, tagline: "", category: "", phUrl: "", url: "", ...p, id,
      assessment: {
        worthMessaging: a.score >= 65, founderPlay: false, messageTarget: "founder",
        linkedInMessage: "", connectionNote: "", reasoning: "", ...a,
        replyToolkit: { ...EMPTY_TOOLKIT, ...(a.replyToolkit || {}) },
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
