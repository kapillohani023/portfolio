import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const matterOnlyInCanvas = {
  name: "matter-js",
  message: "Import matter-js only from src/components/physics-canvas.tsx.",
};

const physicsOnlyInCanvas = {
  group: ["@/physics", "@/physics/**"],
  message: "Import @/physics only from src/components/physics-canvas.tsx.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    ignores: ["src/components/physics-canvas.tsx"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [matterOnlyInCanvas],
        patterns: [physicsOnlyInCanvas],
      }],
    },
  },
  {
    files: ["src/physics/**/*.{ts,tsx}", "src/content/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { paths: [matterOnlyInCanvas] }],
    },
  },
  {
    files: ["src/components/physics-canvas.tsx"],
    rules: {},
  },
]);

export default eslintConfig;
