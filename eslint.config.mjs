import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/** Layer boundaries — see docs/architecture/02-repository-structure.md. */
const noApp = { group: ["@/*"], message: "Packages and modules must not import from apps/web." };
const noNext = { group: ["next", "next/*"], message: "Must not depend on Next.js." };
const noReact = { group: ["react", "react-dom", "react/*"], message: "Must not depend on React." };
const noSupabase = { group: ["@supabase/*"], message: "Must not depend on Supabase." };
const noUi = { group: ["@bahayplus/ui", "@bahayplus/ui/*"], message: "Must not depend on UI code." };
const appRestricted = [
  { group: ["@/lib/preview/*"], message: "Sample data may only be used by /preview routes." },
  {
    group: ["@/lib/supabase/admin"],
    message: "The service-role client is restricted to jobs, admin services and tests.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    settings: { next: { rootDir: "apps/web/" } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  {
    files: ["apps/web/**"],
    rules: { "no-restricted-imports": ["error", { patterns: appRestricted }] },
  },
  {
    files: ["apps/web/app/preview/**", "apps/web/lib/jobs/**", "apps/web/app/api/internal/**", "apps/web/lib/admin/**"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // Pure layers: shared kernel + validation contracts + module domain code.
    files: ["packages/types/**", "packages/validation/**", "modules/*/domain/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [noApp, noNext, noReact, noSupabase, noUi] }] },
  },
  {
    // Modules are framework-independent: no Next.js, React or app imports. Supabase only in infrastructure.
    files: ["modules/*/application/**", "modules/*/index.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [noApp, noNext, noReact, noUi] }] },
  },
  {
    files: ["modules/*/infrastructure/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [noApp, noNext, noReact, noUi] }] },
  },
  {
    files: ["packages/ui/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [noApp, noSupabase] }] },
  },
  globalIgnores([
    "**/.next/**",
    "**/node_modules/**",
    "out/**",
    "build/**",
    "**/next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "supabase/.temp/**",
  ]),
]);

export default eslintConfig;
