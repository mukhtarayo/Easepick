diff --git a//dev/null b/scripts/utils.js
index 0000000000000000000000000000000000000000..f80df10f1838f7186eba36aa11ad48cb634a2c2b 100644
--- a//dev/null
+++ b/scripts/utils.js
@@ -0,0 +1,91 @@
+export const EDGE_THRESHOLD = 4.89;
+
+export function toNumber(value) {
+  const num = Number(value);
+  return Number.isFinite(num) ? num : null;
+}
+
+export function impliedProbability(odd) {
+  const n = toNumber(odd);
+  if (!n || n <= 1) return null;
+  return 1 / n;
+}
+
+export function normalizeProbabilities(probMap) {
+  const sum = Object.values(probMap)
+    .filter((v) => typeof v === 'number')
+    .reduce((acc, val) => acc + val, 0);
+  if (!sum) return probMap;
+  return Object.fromEntries(
+    Object.entries(probMap).map(([key, val]) => [key, typeof val === 'number' ? val / sum : val])
+  );
+}
+
+export function percentage(value) {
+  if (value === null || value === undefined) return '—';
+  return `${(value * 100).toFixed(2)}%`;
+}
+
+export function formatOdd(value) {
+  if (value === null || value === undefined) return '—';
+  return Number(value).toFixed(2);
+}
+
+export function formatDateTime(dateStr, timezone) {
+  try {
+    const date = new Date(dateStr);
+    if (timezone === 'local') {
+      return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
+    }
+    const utcDate = new Date(date.toISOString());
+    return `${utcDate.toISOString().slice(0, 10)} ${utcDate.toISOString().slice(11, 16)} UTC`;
+  } catch (err) {
+    return dateStr;
+  }
+}
+
+export function computeEdge(factorProb, marketProb) {
+  if (typeof factorProb !== 'number' || typeof marketProb !== 'number') {
+    return null;
+  }
+  return (factorProb - marketProb) * 100;
+}
+
+export function csvFromRows(rows, headers) {
+  const clean = (value) => {
+    if (value === null || value === undefined) return '';
+    const str = String(value).replace(/"/g, '""');
+    return `"${str}"`;
+  };
+  const csvRows = [headers.map(clean).join(',')];
+  rows.forEach((row) => {
+    csvRows.push(headers.map((header) => clean(row[header])).join(','));
+  });
+  return csvRows.join('\n');
+}
+
+export function debounce(fn, wait = 250) {
+  let timeout;
+  return (...args) => {
+    clearTimeout(timeout);
+    timeout = setTimeout(() => fn(...args), wait);
+  };
+}
+
+export function parseAnalyzeCommand(command) {
+  if (!command) return [];
+  const normalized = command.trim().toLowerCase();
+  if (!normalized.startsWith('analyze:')) return [];
+  return normalized
+    .replace('analyze:', '')
+    .split(',')
+    .map((item) => item.trim())
+    .filter(Boolean)
+    .map((pair) => pair.replace(/\s+/g, ' '));
+}
+
+export function isDerby(fixture) {
+  const derbyKeywords = ['derby', 'clasico', 'classic', 'rivalry'];
+  const venue = fixture?.fixture?.venue?.name?.toLowerCase() || '';
+  return derbyKeywords.some((word) => venue.includes(word));
+}
