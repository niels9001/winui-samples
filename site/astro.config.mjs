import react from "@astrojs/react";
import { defineConfig } from "astro/config";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const fluentIconModules = [
  "apps",
  "book-open",
  "cart",
  "code",
  "desktop",
  "dismiss",
  "document",
  "filter",
  "globe",
  "location",
  "people-community",
  "search",
  "shield",
  "toolbox",
  "video",
  "weather-moon",
  "weather-sunny",
  "window",
];

const fluentIconAliases = fluentIconModules.map((icon) => ({
  find: new RegExp(`^@fluentui/react-icons/svg/${icon}$`),
  replacement: require.resolve(`@fluentui/react-icons/svg/${icon}`),
}));
export default defineConfig({
  site: "https://niels9001.github.io",
  base: "/winui-samples",
  output: "static",
  trailingSlash: "always",
  integrations: [react()],
  vite: {
    resolve: {
      // The package's ESM chunks use extensionless imports that Node cannot
      // execute during Astro's static render. Its supported CommonJS export is
      // Node-safe. Per-icon entry points keep the browser island compact.
      alias: fluentIconAliases,
    },
  },
});
