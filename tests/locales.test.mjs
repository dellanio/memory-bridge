// Paridade dos locales: todas as traduções precisam ter as mesmas chaves do en-US,
// sem mensagem vazia e preservando os placeholders ($1) do original.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const LOCALES_DIR = join(ROOT, "_locales");
const read = (loc) => JSON.parse(readFileSync(join(LOCALES_DIR, loc, "messages.json"), "utf8"));

const locales = readdirSync(LOCALES_DIR).filter((d) => readdirSync(join(LOCALES_DIR, d)).includes("messages.json")).sort();
const base = read("en");
const baseKeys = Object.keys(base).sort();

test("toda pasta em _locales tem messages.json", () => {
  assert.deepEqual(locales, ["en", "fr", "pt_BR", "zh_CN"]);
});

for (const loc of locales) {
  test(`${loc}: mesmas chaves que en-US`, () => {
    const d = read(loc);
    assert.deepEqual(Object.keys(d).sort(), baseKeys);
  });

  test(`${loc}: nenhuma mensagem vazia`, () => {
    for (const [k, v] of Object.entries(read(loc))) {
      assert.equal(typeof v.message, "string", `${loc}.${k} não é texto`);
      assert.ok(v.message.trim().length > 0, `${loc}.${k} está vazio`);
    }
  });

  test(`${loc}: preserva os placeholders do en-US`, () => {
    const d = read(loc);
    for (const k of baseKeys) {
      const ph = (base[k].message.match(/\$\d/g) || []).sort();
      const ph2 = (d[k].message.match(/\$\d/g) || []).sort();
      assert.deepEqual(ph2, ph, `${loc}.${k} trocou os placeholders`);
    }
  });
}

test("background.js conhece todos os locales", () => {
  const bg = readFileSync(join(ROOT, "src", "background.js"), "utf8");
  const m = bg.match(/const LANGS = \[([^\]]+)\]/);
  assert.ok(m, "LANGS não encontrado em background.js");
  const list = m[1].split(",").map((s) => s.trim().replace(/"/g, ""));
  for (const loc of locales) assert.ok(list.includes(loc), `background.js não lista ${loc}`);
});

test("options.html oferece todos os idiomas", () => {
  const html = readFileSync(join(ROOT, "src", "options.html"), "utf8");
  for (const loc of locales) {
    assert.ok(html.includes(`value="${loc}"`), `options.html não tem a opção ${loc}`);
  }
});
