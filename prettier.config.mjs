/** @type {import("prettier").Config} */
const config = {
  printWidth: 120,
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindStylesheet: "./apps/web/app/globals.css",
  tailwindFunctions: ["cn", "cva"],
};

export default config;
