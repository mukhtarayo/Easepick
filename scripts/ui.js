diff --git a//dev/null b/scripts/ui.js
index 0000000000000000000000000000000000000000..48e9232645ef36b4d38495bc0a36bd39c6b294b3 100644
--- a//dev/null
+++ b/scripts/ui.js
@@ -0,0 +1,234 @@
+import { formatOdd, formatDateTime, csvFromRows, percentage } from './utils.js';
+
+const MARKET_LABELS = {
+  '1X2': 'Match Result',
+  BTTS: 'Both Teams To Score',
+  OU25: 'Total Goals 2.5',
+  DC: 'Double Chance',
+  CS: 'Correct Score',
+  DNB: 'Draw No Bet',
+};
+
+export function renderStatus(message, type = 'info') {
+  const status = document.getElementById('status-message');
+  if (!status) return;
+  status.textContent = message;
+  status.dataset.type = type;
+}
+
+export function setLoading(loading) {
+  const button = document.getElementById('get-matches');
+  if (!button) return;
+  button.disabled = loading;
+  button.textContent = loading ? 'Loading…' : 'Get Matches';
+}
+
+export function renderLeagueBadge(league) {
+  const logoEl = document.getElementById('league-logo');
+  const nameEl = document.getElementById('league-name');
+  if (!logoEl || !nameEl) return;
+  if (!league) {
+    nameEl.textContent = '—';
+    return;
+  }
+  if (league.logo) {
+    logoEl.src = league.logo;
+  }
+  nameEl.textContent = league.name || 'League';
+}
+
+export function renderMatches(entries, selectedMarkets, timezone) {
+  const container = document.getElementById('matches-container');
+  if (!container) return;
+  container.innerHTML = '';
+  if (!entries.length) {
+    container.innerHTML = '<p class="empty">No fixtures for this query.</p>';
+    return;
+  }
+  entries.forEach((entry) => {
+    const card = document.createElement('article');
+    card.className = 'match-card';
+
+    const header = document.createElement('div');
+    header.className = 'match-header';
+
+    const teams = document.createElement('div');
+    teams.className = 'match-teams';
+    const home = entry.fixture.teams?.home?.name || 'Home';
+    const away = entry.fixture.teams?.away?.name || 'Away';
+    teams.textContent = `${home} vs ${away}`;
+
+    const info = document.createElement('div');
+    info.className = 'match-info';
+    const leagueName = entry.fixture.league?.name || 'League';
+    const time = formatDateTime(entry.fixture.fixture?.date, timezone);
+    info.innerHTML = `<span>${leagueName}</span><span>${time}</span>`;
+
+    header.appendChild(teams);
+    header.appendChild(info);
+
+    const marketsWrapper = document.createElement('div');
+    marketsWrapper.className = 'market-odds';
+
+    if (entry.error) {
+      const warning = document.createElement('p');
+      warning.className = 'empty';
+      warning.textContent = `Odds unavailable: ${entry.error}`;
+      marketsWrapper.appendChild(warning);
+    }
+
+    Object.entries(entry.markets || {}).forEach(([key, values]) => {
+      if (!selectedMarkets.has(key)) return;
+      const block = document.createElement('div');
+      block.className = 'market-chip';
+      const title = document.createElement('h4');
+      title.textContent = MARKET_LABELS[key] || key;
+      block.appendChild(title);
+      const odds = document.createElement('div');
+      odds.className = 'market-values';
+      values.forEach((value) => {
+        const span = document.createElement('span');
+        span.className = 'market-value';
+        span.textContent = `${value.label}: ${formatOdd(value.odd)}`;
+        odds.appendChild(span);
+      });
+      block.appendChild(odds);
+      marketsWrapper.appendChild(block);
+    });
+
+    if (!marketsWrapper.children.length) {
+      const empty = document.createElement('p');
+      empty.className = 'empty';
+      empty.textContent = 'Selected markets not available for this fixture.';
+      marketsWrapper.appendChild(empty);
+    }
+
+    card.appendChild(header);
+    card.appendChild(marketsWrapper);
+    container.appendChild(card);
+  });
+}
+
+function createTable(headers, rows, mode) {
+  const table = document.createElement('table');
+  table.className = 'analysis-table';
+  const thead = document.createElement('thead');
+  const tr = document.createElement('tr');
+  headers.forEach((header) => {
+    const th = document.createElement('th');
+    th.scope = 'col';
+    th.textContent = header;
+    tr.appendChild(th);
+  });
+  thead.appendChild(tr);
+  table.appendChild(thead);
+
+  const tbody = document.createElement('tbody');
+  rows.forEach((row) => {
+    const rowElement = document.createElement('tr');
+    if (row.outcome?.status === 'PICK') rowElement.classList.add('pick');
+    if (row.outcome?.status === 'FLAG') rowElement.classList.add('flag');
+    headers.forEach((header) => {
+      const td = document.createElement('td');
+      let value = row[header];
+      if (header.toLowerCase().includes('confidence')) {
+        if (value === null || value === undefined) {
+          value = '—';
+        } else if (typeof value === 'string') {
+          value = value;
+        } else {
+          value = percentage(Number(value) / 100);
+        }
+      }
+      if (header.toLowerCase().includes('edge')) {
+        if (value === null || value === undefined) value = '—';
+        else if (typeof value === 'string') value = value;
+        else value = `${Number(value).toFixed(2)}%`;
+      }
+      if (header === 'UTC/Local Time' && row.fixture?.date) {
+        const timezoneSelect = document.getElementById('timezone-select');
+        value = formatDateTime(row.fixture.date, timezoneSelect?.value || 'utc');
+      }
+      td.textContent = value ?? '—';
+      rowElement.appendChild(td);
+    });
+    tbody.appendChild(rowElement);
+  });
+  table.appendChild(tbody);
+  table.dataset.mode = mode;
+  return table;
+}
+
+const MODE_HEADERS = {
+  B: ['Leagues', 'UTC/Local Time', 'Market pick', 'Factor pick', 'Reason for factor pick', 'Team Favour side', 'Factor confidence %', 'Flag threshold', 'Edge margin', 'Checklist tag'],
+  C: ['Winner mode %', 'Value mode %', 'Remark', 'Reason'],
+  D: ['Leagues', 'UTC/Local Time', 'Market pick', 'Factor pick', 'Reason for factor pick', 'Team Favour side', 'Factor confidence %', 'Flag threshold', 'Edge margin'],
+};
+
+export function renderAnalysis(analysis, mode) {
+  const container = document.getElementById('analysis-content');
+  if (!container) return;
+  container.innerHTML = '';
+  const rows = analysis[mode] || [];
+  if (!rows.length) {
+    container.innerHTML = '<p class="empty">No analysis ready. Fetch fixtures first.</p>';
+    return;
+  }
+  const table = createTable(MODE_HEADERS[mode], rows, mode);
+  container.appendChild(table);
+}
+
+export function updateSummaryBanner(analysis) {
+  const pickCount = document.getElementById('pick-count');
+  const flagCount = document.getElementById('flag-count');
+  if (pickCount) pickCount.textContent = analysis.picks ?? 0;
+  if (flagCount) flagCount.textContent = analysis.flags ?? 0;
+}
+
+export function exportAnalysisCSV(analysis, mode) {
+  const rows = analysis[mode] || [];
+  if (!rows.length) return;
+  const headers = MODE_HEADERS[mode];
+  const sanitizedRows = rows.map((row) => {
+    const copy = {};
+    headers.forEach((header) => {
+      if (header === 'UTC/Local Time' && row.fixture?.date) {
+        const timezone = document.getElementById('timezone-select')?.value || 'utc';
+        copy[header] = formatDateTime(row.fixture.date, timezone);
+      } else {
+        copy[header] = row[header];
+      }
+    });
+    return copy;
+  });
+  const csv = csvFromRows(sanitizedRows, headers);
+  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
+  const url = URL.createObjectURL(blob);
+  const a = document.createElement('a');
+  a.href = url;
+  a.download = `easepick-${mode}-mode.csv`;
+  a.click();
+  URL.revokeObjectURL(url);
+}
+
+export function copyAnalysisSummary(analysis, mode) {
+  const rows = analysis[mode] || [];
+  if (!rows.length) return;
+  const headers = MODE_HEADERS[mode];
+  const summary = rows
+    .map((row) => {
+      const parts = headers.map((header) => {
+        if (header === 'UTC/Local Time' && row.fixture?.date) {
+          const timezone = document.getElementById('timezone-select')?.value || 'utc';
+          return `${header}: ${formatDateTime(row.fixture.date, timezone)}`;
+        }
+        const value = row[header] ?? '—';
+        return `${header}: ${value}`;
+      });
+      return parts.join(' | ');
+    })
+    .join('\n');
+  if (navigator.clipboard?.writeText) {
+    navigator.clipboard.writeText(summary);
+  }
+}
