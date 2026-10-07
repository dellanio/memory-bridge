// Gera o pacote para a loja (dist/memory-bridge-<versão>.zip) só com os arquivos da extensão.
// Uso: node tools/build-zip.mjs   (sem dependências: monta o ZIP na mão, método "store" + deflate do zlib)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { deflateRawSync, crc32 } from "node:zlib";

const ROOT = resolve(import.meta.dirname, "..");
const INCLUDE = ["manifest.json", "_locales", "icons", "src", "LICENSE"];
const SKIP = (p) => p.endsWith(".svg") || p.includes("content.prev");
const version = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8")).version;

function walk(p) {
  const st = statSync(p);
  if (st.isFile()) return [p];
  return readdirSync(p).flatMap((n) => walk(join(p, n)));
}
const files = INCLUDE.flatMap((p) => walk(join(ROOT, p))).filter((f) => !SKIP(f)).sort();

const chunks = [], central = [];
let offset = 0;
const dosTime = 0, dosDate = (2026 - 1980) << 9 | 10 << 5 | 7; // data fixa: zip reprodutível
for (const f of files) {
  const name = Buffer.from(relative(ROOT, f).split("\\").join("/"));
  const data = readFileSync(f);
  const comp = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
  local.writeUInt16LE(dosTime, 10); local.writeUInt16LE(dosDate, 12); local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
  chunks.push(local, name, comp);
  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
  cen.writeUInt16LE(dosTime, 12); cen.writeUInt16LE(dosDate, 14); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20);
  cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(name.length, 28); cen.writeUInt32LE(offset, 42);
  central.push(cen, name);
  offset += 30 + name.length + comp.length;
}
const cenBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cenBuf.length, 12); end.writeUInt32LE(offset, 16);
mkdirSync(join(ROOT, "dist"), { recursive: true });
const out = join(ROOT, "dist", `memory-bridge-${version}.zip`);
writeFileSync(out, Buffer.concat([...chunks, cenBuf, end]));
console.log(out, `${files.length} arquivos`);
for (const f of files) console.log("  " + relative(ROOT, f));
