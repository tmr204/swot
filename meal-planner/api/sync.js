import { compact, docEquals, mergeDocs } from '../public/js/sync.js';
import { loadDoc, pathForCode, saveDoc, validCode, validDoc } from '../lib/household.js';

// POST { code, doc } -> merges this phone's changes into the family's copy
// and returns the merged result.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { code, doc } = req.body || {};
  if (!validCode(code)) return res.status(400).json({ error: 'Bad sync code' });
  if (!validDoc(doc)) return res.status(400).json({ error: 'Bad data' });
  if (JSON.stringify(doc).length > 3_000_000) return res.status(413).json({ error: 'Too big' });

  const path = pathForCode(code);
  const current = await loadDoc(path);
  const merged = compact(mergeDocs(current, doc), Date.now());
  if (!docEquals(merged, current)) await saveDoc(path, merged);
  res.setHeader('cache-control', 'no-store');
  return res.status(200).json({ doc: merged });
}
