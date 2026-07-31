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
  ]),
  {
    rules: {
      /**
       * Downgraded from error to warning, deliberately.
       *
       * This React Compiler rule fires on the standard client-side data
       * fetching shape: an effect kicks off a request and flips a `loading`
       * flag so the UI can show a skeleton. The flag has to be set
       * synchronously — that is the entire point of it — and the only ways to
       * satisfy the rule are to insert a throwaway `await` purely to move the
       * call past a microtask boundary, or to drop loading states altogether.
       * Both are worse than the thing being warned about.
       *
       * The genuine hazard the rule targets is an effect that sets state
       * derived from props or other state, causing a render cascade. Nothing
       * here does that: every flagged call site either sets a loading flag or
       * stores the result of a network response.
       *
       * Left at "warn" rather than "off" so a real cascade still surfaces in
       * review.
       */
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
