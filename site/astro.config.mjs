import react from "@astrojs/react";
import { defineConfig } from "astro/config";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const useDevelopmentIconModules = process.argv.includes("dev");
const previewingStaticOutput = process.argv.includes("preview");
const fluentIconModules = [
  "apps",
  "book-open",
  "cart",
  "checkmark",
  "chevron-down",
  "code",
  "copy",
  "desktop",
  "dismiss",
  "document",
  "filter",
  "globe",
  "location",
  "more-horizontal",
  "open",
  "people-community",
  "search",
  "shield",
  "toolbox",
  "video",
  "weather-moon",
  "weather-sunny",
  "window",
  "arrow-right",
];

const fluentIconAliases = fluentIconModules.map((icon) => ({
  find: new RegExp(`^@fluentui/react-icons/svg/${icon}$`),
  replacement: (() => {
    const commonJsPath = require.resolve(
      `@fluentui/react-icons/svg/${icon}`,
    );
    return useDevelopmentIconModules
      ? commonJsPath.replace(
          `${path.sep}lib-cjs${path.sep}`,
          `${path.sep}lib${path.sep}`,
        )
      : commonJsPath;
  })(),
}));
export default defineConfig({
  site: "https://niels9001.github.io",
  base: "/winui-samples",
  output: "static",
  // Preview serves generated endpoint files directly; Pages keeps canonical
  // trailing slashes for document routes.
  trailingSlash: previewingStaticOutput ? "ignore" : "always",
  integrations: [react()],
  vite: {
    resolve: {
      // Vite resolves the package's ESM chunks in development; static rendering
      // uses its Node-safe CommonJS export. Per-icon entries keep islands small.
      alias: fluentIconAliases,
    },
  },
});
