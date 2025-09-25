diff --git a//dev/null b/scripts/config.js
index 0000000000000000000000000000000000000000..1a83afdc99c45e5d22ecf956373707cc5256bd27 100644
--- a//dev/null
+++ b/scripts/config.js
@@ -0,0 +1,19 @@
+// Minimal runtime config loader. Update window.EASEPICK_CONFIG before app.js runs.
+// Example usage in your project entry point:
+// window.EASEPICK_CONFIG = {
+//   API_HOST: 'https://v3.football.api-sports.io',
+//   API_KEY: 'your_api_sports_key',
+//   RAPID_API_KEY: 'optional_rapidapi_key'
+// };
+// Never commit real keys – use the placeholders above.
+
+if (!window.EASEPICK_CONFIG) {
+  window.EASEPICK_CONFIG = {
+    API_HOST: 'https://v3.football.api-sports.io',
+    API_KEY: '4253ea306614b724fd69bf093e2c5daa',
+    RAPID_API_KEY: '',
+    DEMO: false,
+  };
+}
+
+export const CONFIG = window.EASEPICK_CONFIG;
