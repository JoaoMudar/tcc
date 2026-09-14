import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "docs/**",
    // Geradores da documentação do TCC: fora do código da aplicação
    "scripts/build-*.mjs",
    "scripts/confere-*.mjs",
    "scripts/leia.mjs",
    "scripts/mede-figuras.mjs",
    "scripts/render-mapas.mjs",
    "scripts/renumerar.mjs",
    "scripts/verifica-rastreabilidade.mjs",
  ]),
]);

export default eslintConfig;
