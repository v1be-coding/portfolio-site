// App lint (Q65). frozen/ has its own lint, run from main's commit in the PR's merge (Q64).
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores(["dist/", "frozen/", "infra/", "drizzle/", "coverage/"]),
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  { files: ["**/*.{js,mjs,cjs}"], extends: [tseslint.configs.disableTypeChecked] },
  {
    files: ["src/web/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // The prerender writes a style prop into the HTML as a style attribute,
          // which the CSP's style-src 'self' blocks (react-prerender-hydration.md, R8).
          selector: "JSXAttribute[name.name='style']",
          message: "No style props: the CSP blocks style attributes. Use a class and CSS.",
        },
        {
          selector: "JSXAttribute[name.name='suppressHydrationWarning']",
          message: "Fix the hydration mismatch instead (react-prerender-hydration.md, R13).",
        },
      ],
    },
  },
  // Runs in Node at build time, not in the browser.
  { files: ["src/web/prerender.tsx"], languageOptions: { globals: globals.node } },
  {
    files: [
      "src/{ai,api,db,limits,resume}/**/*.ts",
      "*.config.{ts,js}",
      ".claude/**/*.mjs",
      "scripts/**/*.mjs",
    ],
    languageOptions: { globals: globals.node },
  },
  // Vitest's asymmetric matchers, such as expect.any(), are typed any.
  { files: ["**/*.test.ts"], rules: { "@typescript-eslint/no-unsafe-assignment": "off" } },
  prettier,
);
