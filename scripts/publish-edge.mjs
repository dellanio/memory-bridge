// Publica uma nova versão da extensão na Microsoft Edge Add-ons sem passar pelo
// Partner Center, usando a API oficial de update (REST v1.1).
//
// Credenciais (Partner Center > Microsoft Edge > Publish API > Enable > Create API credentials):
//   EDGE_PRODUCT_ID  id do produto (Partner Center > Microsoft Edge > Overview)
//   EDGE_CLIENT_ID   Client ID
//   EDGE_API_KEY     API key
//
// Uso:
//   node scripts/publish-edge.mjs            (empacota, sobe e publica)
//   node scripts/publish-edge.mjs --dry-run  (só mostra o que seria feito)
//   node scripts/publish-edge.mjs --notes "texto para a certificação"
//
// A publicação é uma ação pública: sem --yes o script para antes de publicar.
import { readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://api.addons.microsoftedge.microsoft.com";
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const yes = args.includes("--yes");
const notesIdx = args.indexOf("--notes");
const notes = notesIdx >= 0 ? args[notesIdx + 1]
  : process.env.EDGE_NOTES || "Atualizacao automatica: correcao de autenticacao (auto-recuperacao do login) e novo modo de autenticacao por chave de API.";

// credenciais: variaveis de ambiente ou store/edge-credentials.local.json (fora do git)
const CREDS_FILE = join(ROOT, "store", "edge-credentials.local.json");
const creds = (() => {
  try { return JSON.parse(readFileSync(CREDS_FILE, "utf8")); } catch { return {}; }
})();
const cred = (name) => process.env[name] || creds[name];
const need = (n) => { const v = cred(n); if (!v) { console.error(`falta a variavel de ambiente ${n} (ou o arquivo store/edge-credentials.local.json)`); process.exit(2); } return v; };

const productId = need("EDGE_PRODUCT_ID");
const clientId = need("EDGE_CLIENT_ID");
const apiKey = need("EDGE_API_KEY");

const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));
const zipPath = join(ROOT, "dist", `memory-bridge-${manifest.version}.zip`);
if (!statSync(zipPath, { throwIfNoEntry: false })) {
  console.error(`pacote ausente: ${zipPath} (rode: node scripts/package.mjs)`);
  process.exit(2);
}

const headers = { Authorization: `ApiKey ${apiKey}`, "X-ClientID": clientId };
const product = `${BASE}/v1/products/${encodeURIComponent(productId)}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function poll(url, label) {
  for (let i = 0; i < 40; i++) {
    const r = await fetch(url, { headers });
    const body = await r.text();
    if (!r.ok) throw new Error(`${label}: HTTP ${r.status} ${body.slice(0, 300)}`);
    let j = {}; try { j = JSON.parse(body); } catch { /* corpo livre */ }
    const st = String(j.status || j.state || "").toLowerCase();
    console.log(`  ${label}: ${st || body.slice(0, 120)}`);
    if (st && !["inprogress", "in progress", "pending", "processing"].includes(st)) return j;
    await sleep(4000);
  }
  throw new Error(`${label}: tempo esgotado`);
}

const operationId = (loc) => String(loc || "").split("?")[0].split("/").filter(Boolean).pop();

console.log(`pacote:  ${zipPath} (versão ${manifest.version})`);
console.log(`produto: ${productId}`);
console.log(`notas:   ${notes}`);

if (dryRun) { console.log("\n[dry-run] nada foi enviado."); process.exit(0); }

// 1) sobe o pacote para o rascunho da submissão
const zip = readFileSync(zipPath);
const up = await fetch(`${product}/submissions/draft/package`, {
  method: "POST", headers: { ...headers, "Content-Type": "application/zip" }, body: zip,
});
if (up.status !== 202 && !up.ok) {
  console.error(`upload: HTTP ${up.status} ${(await up.text()).slice(0, 400)}`);
  process.exit(1);
}
const upId = operationId(up.headers.get("location"));
console.log(`upload aceito (HTTP ${up.status}), operação ${upId}`);
await poll(`${product}/submissions/draft/package/operations/${upId}`, "upload");

// 2) publica
if (!yes) {
  console.log("\nPacote no rascunho. Para publicar de verdade, rode de novo com --yes.");
  process.exit(0);
}
const noteBody = JSON.stringify({ notes });
let pub = await fetch(`${product}/submissions`, {
  method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: noteBody,
});
if (!pub.ok && pub.status === 400) {
  // a documentação pede texto puro nas notas: tenta esse formato antes de desistir
  pub = await fetch(`${product}/submissions`, {
    method: "POST", headers: { ...headers, "Content-Type": "text/plain" }, body: noteBody,
  });
}
if (!pub.ok) {
  console.error(`publicação: HTTP ${pub.status} ${(await pub.text()).slice(0, 400)}`);
  process.exit(1);
}
const pubId = operationId(pub.headers.get("location"));
console.log(`publicação enviada (HTTP ${pub.status}), operação ${pubId}`);
await poll(`${product}/submissions/operations/${pubId}`, "publicação");
console.log("\nEnviado ao Microsoft Edge Add-ons. O crivo ainda passa pela revisão da loja.");
