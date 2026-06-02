// Copy every CSS file from src/ to dist/ preserving the directory structure, so
// the relative `import "./x.css"` statements left in the transpiled JS resolve.
import { readdirSync, statSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".css")) out.push(p);
  }
  return out;
}

let n = 0;
for (const file of walk("src")) {
  const dest = file.replace(/^src/, "dist");
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(file, dest);
  n++;
}
console.log(`copy-css: copied ${n} stylesheet(s) to dist/`);
