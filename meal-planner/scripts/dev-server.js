// Local development server: serves public/ and a stand-in for /api/sync that
// keeps households in memory, so two browser windows can sync without Vercel.
//   npm run dev   ->  http://localhost:3000

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { compact, mergeDocs } from '../public/js/sync.js';
import { validCode, validDoc } from '../lib/household.js';

const root = new URL('../public/', import.meta.url).pathname;
const port = Number(process.env.PORT || 3000);
const households = new Map();
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
};

async function body(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString() || '{}');
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname === '/api/config') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ vapidPublicKey: process.env.VAPID_PUBLIC_KEY || null, sync: true }));
  }
  if (url.pathname === '/api/sync' && req.method === 'POST') {
    const { code, doc } = await body(req);
    if (!validCode(code) || !validDoc(doc)) {
      res.writeHead(400);
      return res.end('bad request');
    }
    const merged = compact(mergeDocs(households.get(code) || {}, doc), Date.now());
    households.set(code, merged);
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ doc: merged }));
  }
  const path = normalize(join(root, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!path.startsWith(root)) {
    res.writeHead(403);
    return res.end();
  }
  try {
    const data = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(port, () => console.log(`Meal planner on http://localhost:${port}`));
