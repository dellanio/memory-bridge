// Gera dist/memory-bridge-<versão>.zip com o manifest.json na raiz.
// Só entra no pacote o que a extensão usa em tempo de execução:
// manifest.json, icons/, _locales/ e src/. Nada de testes, store, docs ou node_modules.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync, crc32 } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INCLUDE = ["manifest.json", "icons", "_locales", "src"];
const SKIP = new Set(["node_modules", ".git", "dist", "tests", "store", "docs"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// ---------- escritor de ZIP (deflate, sem dependência externa) ----------
function zip(files) {
  const chunks = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = f.name.replace(/\\/g, "/");
    const data = f.data;
    const deflated = deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data) >>> 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);          // versão necessária
    local.writeUInt16LE(0, 6);           // flags
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);          // hora
    local.writeUInt16LE(0x21, 12);       // data (1 jan 1980)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, body);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);             // versão de criação
    cd.writeUInt16LE(20, 6);             // versão necessária
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0x21, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(body.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);             // extra
    cd.writeUInt16LE(0, 32);             // comentário
    cd.writeUInt16LE(0, 34);             // disco
    cd.writeUInt16LE(0, 36);             // atributos internos
    cd.writeUInt32LE(0, 38);             // atributos externos
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, centralBuf, end]);
}

// ---------- empacota ----------
const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));
const version = manifest.version;
const paths = INCLUDE.flatMap((r) => {
  const p = join(ROOT, r);
  try { return statSync(p).isDirectory() ? walk(p) : [p]; } catch { return []; }
});
const files = paths.map((p) => ({ name: relative(ROOT, p), data: readFileSync(p) }));
const out = join(ROOT, "dist", `memory-bridge-${version}.zip`);
mkdirSync(join(ROOT, "dist"), { recursive: true });
try { rmSync(out); } catch { /* não existia */ }
writeFileSync(out, zip(files));

const kb = (statSync(out).size / 1024).toFixed(1);
console.log(`pacote: ${relative(ROOT, out)}  (${kb} KB, ${files.length} arquivos, versão ${version})`);
const top = new Set(files.map((f) => f.name.split(/[\\/]/)[0]));
console.log("raízes incluídas:", [...top].join(", "));
if (!files.some((f) => f.name === "manifest.json")) throw new Error("manifest.json não está na raiz do zip");
