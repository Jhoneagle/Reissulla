import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import formatjs from "eslint-plugin-formatjs";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  { ignores: ["**/dist/", "**/node_modules/", "**/.turbo/"] },

  // Base config for all TS files
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Node.js environment for backend
  {
    files: ["apps/api/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },

  // React config for web frontend
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "jsx-a11y": jsxA11y,
      formatjs,
    },
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Flag hard-coded user-facing JSX text. Set to "warn" so migration
      // can happen incrementally — once every component is migrated, bump
      // to "error". Bypass per occurrence with
      // `// eslint-disable-next-line formatjs/no-literal-string-in-jsx`.
      "formatjs/no-literal-string-in-jsx": "warn",
    },
  },

  // Prettier must be last to override formatting rules
  eslintConfigPrettier,
);
