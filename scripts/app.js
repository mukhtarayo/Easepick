diff --git a//dev/null b/scripts/app.js
index 0000000000000000000000000000000000000000..e5138c9950e1e2a3892bb12ec448025180211da5 100644
--- a//dev/null
+++ b/scripts/app.js
@@ -0,0 +1,170 @@
+import { CONFIG } from './config.js';
+import { getFixturesWithOdds, fetchLeagueLogo } from './api.js';
+import { analyzeFixtures } from './analysis.js';
+import { renderStatus, setLoading, renderMatches, renderAnalysis, renderLeagueBadge, updateSummaryBanner, exportAnalysisCSV, copyAnalysisSummary } from './ui.js';
+import { debounce, parseAnalyzeCommand } from './utils.js';
+
+const state = {
+  fixtures: [],
+  analysis: { B: [], C: [], D: [], picks: 0, flags: 0 },
+  selectedMarkets: new Set(['1X2', 'BTTS', 'OU25', 'DC', 'CS', 'DNB']),
+  selectedMode: 'B',
+  timezone: 'utc',
+  filters: [],
+};
+
+function updateButtonState() {
+  const form = document.getElementById('query-form');
+  const button = document.getElementById('get-matches');
+  if (!form || !button) return;
+  const date = form.querySelector('#query-date').value;
+  const league = form.querySelector('#query-league').value;
+  const season = form.querySelector('#query-season').value;
+  button.disabled = !(date && league && season);
+}
+
+async function handleFormSubmit(event) {
+  event.preventDefault();
+  const form = event.currentTarget;
+  const date = form.querySelector('#query-date').value;
+  const league = form.querySelector('#query-league').value;
+  const season = form.querySelector('#query-season').value;
+  const analyzeCommand = form.querySelector('#analyze-command').value;
+
+  state.filters = parseAnalyzeCommand(analyzeCommand);
+
+  if (!date || !league || !season) return;
+
+  renderStatus('Fetching fixtures…');
+  setLoading(true);
+
+  try {
+    const entries = await getFixturesWithOdds({ date, league, season }, (message) => renderStatus(message));
+    state.fixtures = entries;
+    if (!entries.length) {
+      renderStatus('No fixtures found for the selected filters.', 'warning');
+    } else {
+      renderStatus(`Loaded ${entries.length} fixtures. Running analysis…`, 'success');
+      const primaryLeague = entries[0]?.fixture?.league;
+      if (primaryLeague) {
+        if (!primaryLeague.logo) {
+          const logo = await fetchLeagueLogo(primaryLeague);
+          if (logo) primaryLeague.logo = logo;
+        }
+        renderLeagueBadge(primaryLeague);
+      }
+    }
+    refreshMatches();
+    runAnalysis();
+  } catch (error) {
+    console.error(error);
+    renderStatus(`Error: ${error.message}`, 'error');
+  } finally {
+    setLoading(false);
+  }
+}
+
+function refreshMatches() {
+  renderMatches(state.fixtures, state.selectedMarkets, state.timezone);
+}
+
+function runAnalysis() {
+  const analysis = analyzeFixtures(state.fixtures, state.filters);
+  state.analysis = analysis;
+  renderAnalysis(analysis, state.selectedMode);
+  updateSummaryBanner(analysis);
+}
+
+function handleMarketChange(event) {
+  const checkbox = event.target;
+  if (checkbox.name !== 'markets') return;
+  if (checkbox.checked) state.selectedMarkets.add(checkbox.value);
+  else state.selectedMarkets.delete(checkbox.value);
+  refreshMatches();
+}
+
+function handleTimezoneChange(event) {
+  state.timezone = event.target.value;
+  refreshMatches();
+  renderAnalysis(state.analysis, state.selectedMode);
+}
+
+function handleModeSwitch(event) {
+  const button = event.target.closest('.mode-tab');
+  if (!button) return;
+  document.querySelectorAll('.mode-tab').forEach((tab) => {
+    tab.classList.toggle('active', tab === button);
+    tab.setAttribute('aria-selected', tab === button ? 'true' : 'false');
+  });
+  state.selectedMode = button.dataset.mode;
+  renderAnalysis(state.analysis, state.selectedMode);
+}
+
+function handleExport() {
+  exportAnalysisCSV(state.analysis, state.selectedMode);
+}
+
+function handleCopy() {
+  copyAnalysisSummary(state.analysis, state.selectedMode);
+  renderStatus('Analysis summary copied to clipboard.', 'success');
+}
+
+function initFormDefaults() {
+  const dateInput = document.getElementById('query-date');
+  if (dateInput) {
+    const today = new Date().toISOString().slice(0, 10);
+    dateInput.value = today;
+  }
+  const seasonInput = document.getElementById('query-season');
+  if (seasonInput) {
+    const year = new Date().getFullYear();
+    seasonInput.value = year;
+  }
+  updateButtonState();
+}
+
+function initDemoBanner() {
+  if (CONFIG.API_KEY) return;
+  renderStatus('Demo mode loaded – provide API keys via window.EASEPICK_CONFIG for live data.', 'warning');
+}
+
+function registerEvents() {
+  const form = document.getElementById('query-form');
+  if (form) {
+    form.addEventListener('submit', handleFormSubmit);
+    form.addEventListener('input', () => {
+      updateButtonState();
+    });
+    form.addEventListener('change', handleMarketChange);
+  }
+  const timezoneSelect = document.getElementById('timezone-select');
+  if (timezoneSelect) {
+    timezoneSelect.addEventListener('change', handleTimezoneChange);
+  }
+  document.querySelectorAll('.mode-tab').forEach((tab) => {
+    tab.addEventListener('click', handleModeSwitch);
+  });
+  const exportButton = document.getElementById('export-csv');
+  if (exportButton) exportButton.addEventListener('click', handleExport);
+  const copyButton = document.getElementById('copy-analysis');
+  if (copyButton) copyButton.addEventListener('click', handleCopy);
+
+  const analyzeInput = document.getElementById('analyze-command');
+  if (analyzeInput) {
+    analyzeInput.addEventListener(
+      'input',
+      debounce((event) => {
+        state.filters = parseAnalyzeCommand(event.target.value);
+        runAnalysis();
+      }, 400)
+    );
+  }
+}
+
+function bootstrap() {
+  initFormDefaults();
+  initDemoBanner();
+  registerEvents();
+}
+
+document.addEventListener('DOMContentLoaded', bootstrap);
