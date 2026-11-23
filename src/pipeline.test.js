import { describe, it, expect } from "vitest";
import { parseProducts, mergeProducts, TEMPLATE } from "./pipeline.js";

const product = (over = {}) => ({ name: "Acme Widget", assessment: { score: 80 }, ...over });
const parse = (v) => parseProducts(JSON.stringify(v));

describe("parseProducts", () => {
  it("accepts a single product object", () => {
    const r = parse(product());
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.products).toHaveLength(1);
    expect(r.products[0].name).toBe("Acme Widget");
  });

  it("accepts an array of products", () => {
    const r = parse([product({ name: "One" }), product({ name: "Two" })]);
    expect(r.ok).toBe(true);
    expect(r.products.map((p) => p.name)).toEqual(["One", "Two"]);
  });

  it("accepts a {products: [...]} wrapper (exported file format)", () => {
    const r = parse({ products: [product({ name: "One" }), product({ name: "Two" })] });
    expect(r.ok).toBe(true);
    expect(r.products).toHaveLength(2);
  });

  it("accepts an empty {products: []} wrapper", () => {
    const r = parse({ products: [] });
    expect(r).toEqual({ ok: true, products: [], errors: [] });
  });

  it("parses the built-in TEMPLATE", () => {
    const r = parseProducts(TEMPLATE);
    expect(r.ok).toBe(true);
    expect(r.products[0].id).toBe("product-name");
  });

  it("rejects invalid JSON", () => {
    const r = parseProducts("{not json");
    expect(r.ok).toBe(false);
    expect(r.products).toEqual([]);
    expect(r.errors[0]).toMatch(/^Invalid JSON/);
  });

  it("reports a non-object entry", () => {
    const r = parse([product(), 42]);
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(["#2: not an object"]);
  });

  it("reports a missing name and skips that entry", () => {
    const r = parse([product({ name: "Good" }), { assessment: { score: 50 } }]);
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(['#2: missing "name"']);
    // valid entries are still returned; the UI refuses the whole batch when ok is false
    expect(r.products.map((p) => p.name)).toEqual(["Good"]);
  });

  it("reports a missing assessment", () => {
    const r = parse({ name: "No Assessment" });
    expect(r.ok).toBe(false);
    expect(r.products).toEqual([]);
    expect(r.errors).toEqual(["No Assessment: missing assessment.score (number)"]);
  });

  it("reports a missing or non-numeric score", () => {
    expect(parse(product({ assessment: {} })).errors).toEqual(["Acme Widget: missing assessment.score (number)"]);
    expect(parse(product({ assessment: { score: "80" } })).ok).toBe(false);
  });

  it("generates a slug id from the name", () => {
    const r = parse([
      product({ name: "Acme Widget" }),
      product({ name: "  Hello, World!! 2.0 " }),
      product({ name: "Ünïcode Café" }),
    ]);
    expect(r.products.map((p) => p.id)).toEqual(["acme-widget", "hello-world-2-0", "n-code-caf"]);
  });

  it("keeps an explicit id", () => {
    expect(parse(product({ id: "custom-id" })).products[0].id).toBe("custom-id");
  });

  it("fills defaults without overriding provided values", () => {
    const [p] = parse(product({ upvotes: 12, assessment: { score: 50, replyToolkit: { theyreQuiet: "ping" } } })).products;
    expect(p).toMatchObject({ upvotes: 12, tagline: "", category: "", phUrl: "", url: "" });
    expect(p.assessment).toMatchObject({ score: 50, founderPlay: false, messageTarget: "founder", linkedInMessage: "" });
    expect(p.assessment.replyToolkit).toEqual({ theyreInterested: "", theyreQuiet: "ping", theyreTheRightPerson: "", phCommentAngle: "" });
  });

  it("derives worthMessaging from score >= 65 unless provided", () => {
    const r = parse([
      product({ name: "A", assessment: { score: 65 } }),
      product({ name: "B", assessment: { score: 64 } }),
      product({ name: "C", assessment: { score: 10, worthMessaging: true } }),
    ]);
    expect(r.products.map((p) => p.assessment.worthMessaging)).toEqual([true, false, true]);
  });
});

describe("mergeProducts", () => {
  const a = { id: "a", name: "A", v: 1 };
  const b = { id: "b", name: "B", v: 1 };

  it("appends new products", () => {
    expect(mergeProducts([a], [b])).toEqual([a, b]);
  });

  it("overwrites existing products by id, keeping original position", () => {
    const a2 = { id: "a", name: "A", v: 2 };
    const out = mergeProducts([a, b], [a2]);
    expect(out).toEqual([a2, b]);
    expect(out).toHaveLength(2);
  });

  it("does not mutate inputs", () => {
    const existing = [a];
    mergeProducts(existing, [b]);
    expect(existing).toEqual([a]);
  });

  it("works end-to-end with parseProducts output", () => {
    const first = parse(product({ name: "Acme Widget", assessment: { score: 40 } })).products;
    const second = parse(product({ name: "Acme Widget", assessment: { score: 90 } })).products;
    const out = mergeProducts(first, second);
    expect(out).toHaveLength(1);
    expect(out[0].assessment.score).toBe(90);
  });
});

describe("parseProducts: bad names and id collisions", () => {
  it("rejects a numeric name with a clear error instead of throwing", () => {
    const r = parse(product({ name: 123 }));
    expect(r.ok).toBe(false);
    expect(r.products).toEqual([]);
    expect(r.errors).toEqual(['#1: "name" must be text, got number (123)']);
  });

  it("rejects whitespace-only and non-string names", () => {
    expect(parse(product({ name: "   " })).errors).toEqual(['#1: "name" is empty']);
    expect(parse(product({ name: { x: 1 } })).errors[0]).toMatch(/^#1: "name" must be text, got object/);
    expect(parse(product({ name: true })).errors[0]).toMatch(/^#1: "name" must be text, got boolean/);
  });

  it('gives a name with no slug characters ("!!!") a non-empty fallback id', () => {
    const r = parse(product({ name: "!!!" }));
    expect(r.ok).toBe(true);
    expect(r.products[0].id).toMatch(/^target-[0-9a-z]{1,6}-1$/);
    expect(r.products[0].name).toBe("!!!");
  });

  it('keeps two "!!!" products in one import as two separate targets', () => {
    const r = parse([product({ name: "!!!", tagline: "first" }), product({ name: "!!!", tagline: "second" })]);
    expect(r.ok).toBe(true);
    const ids = r.products.map((p) => p.id);
    expect(new Set(ids).size).toBe(2);
    const out = mergeProducts([], r.products);
    expect(out.map((p) => p.tagline)).toEqual(["first", "second"]);
  });

  it("de-duplicates ids within one import, even for normal names", () => {
    const r = parse([product({ name: "Acme" }), product({ name: "Acme" }), product({ name: "acme!" })]);
    expect(r.products.map((p) => p.id)).toEqual(["acme", "acme-2", "acme-3"]);
    expect(mergeProducts([], r.products)).toHaveLength(3);
  });

  it("gives different unsluggable names different ids", () => {
    const a = parse(product({ name: "!!!" })).products[0].id;
    const b = parse(product({ name: "???" })).products[0].id;
    expect(a).not.toBe(b);
  });

  it("never throws, whatever the input", () => {
    for (const input of ["null", "123", '"str"', "[[1]]", '{"products": null}', '[{"name":"x","assessment":null}]', '[{"name":"x","assessment":{"score":1,"replyToolkit":"nope"}}]', "", undefined]) {
      expect(() => parseProducts(input)).not.toThrow();
      expect(parseProducts(input)).toHaveProperty("errors");
    }
  });
});
