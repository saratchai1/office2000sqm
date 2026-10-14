import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const cfg = JSON.parse(await readFile('model-config.json', 'utf8'));
await mkdir('dist/assets', { recursive: true });
for (const f of ['index.html', 'styles.css', 'viewer.css', 'viewer.js', 'model-config.json']) await copyFile(f, `dist/${f}`);
for (const [src, dest] of [['build/three.module.js','three.module.js'],['examples/jsm/controls/OrbitControls.js','addons/controls/OrbitControls.js'],['examples/jsm/loaders/GLTFLoader.js','addons/loaders/GLTFLoader.js'],['examples/jsm/utils/BufferGeometryUtils.js','addons/utils/BufferGeometryUtils.js']]) { const target = `dist/vendor/${dest}`; await mkdir(target.slice(0, target.lastIndexOf('/')), { recursive: true }); await copyFile(`node_modules/three/${src}`, target); }
let data;
try { data = await readFile(cfg.asset); } catch (e) { if (e.code !== 'ENOENT') throw e; const url = process.env.MODEL_ASSET_SOURCE || cfg.assetSource; if (!url.startsWith('https://')) throw new Error('Asset source must use HTTPS'); const r = await fetch(url, { signal: AbortSignal.timeout(180000) }); if (!r.ok) throw new Error(`Model download failed: ${r.status}`); data = Buffer.from(await r.arrayBuffer()); }
if (data.length !== cfg.gzipBytes || createHash('sha256').update(data).digest('hex') !== cfg.gzipSHA256) throw new Error('Model integrity check failed. Refusing to publish incomplete or changed geometry.');
await writeFile(`dist/${cfg.asset}`, data);
console.log(`Model verified: ${data.length} compressed bytes; ${cfg.triangles} triangles; ${cfg.meshGroups} groups.`);
