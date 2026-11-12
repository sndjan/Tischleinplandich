import coreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...coreWebVitals,
  {
    // New with eslint-plugin-react-hooks 6 (React Compiler checks). They flag
    // patterns that predate the upgrade and work; shown as warnings until those
    // components are reworked one by one.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/static-components": "warn",
    },
  },
];

export default config;
