module.exports = {
  env: {
    browser: true,
    es6: true,
    jest: true,
    node: true,
  },
  extends: [
    // https://github.com/eslint/eslint
    "eslint:recommended",

    // https://github.com/evcohen/eslint-plugin-jsx-a11y
    "plugin:jsx-a11y/recommended",

    // https://github.com/yannickcr/eslint-plugin-react
    "plugin:react/recommended",

    // https://github.com/facebook/react/tree/master/packages/eslint-plugin-react-hooks
    "plugin:react-hooks/recommended",

    // https://github.com/typescript-eslint/typescript-eslint/tree/master/packages/eslint-plugin
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",

    // https://github.com/prettier/eslint-config-prettier
    "prettier",
    "prettier/@typescript-eslint",
  ],
  ignorePatterns: ["jest", "webpack.config.js"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2019,
    sourceType: "module",
    project: "./tsconfig.json",
  },
  plugins: ["jsx-a11y", "react", "react-hooks", "@typescript-eslint", "@clever"],
  rules: {
    "max-len": [
      "error",
      {
        code: 100,
        ignorePattern: "^import",
        ignoreRegExpLiterals: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreUrls: true,
      },
    ],
    // Rely on @typescript-eslint/no-unused-vars instead
    "no-unused-vars": ["off"],
    "@clever/no-app-listen-without-localhost": "error",
    "@clever/no-send-status-error": "error",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/naming-convention": [
      "error",
      { format: ["camelCase", "PascalCase", "UPPER_CASE"], selector: "default" },
      { format: null, selector: "property" },
    ],
    "@typescript-eslint/no-empty-interface": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
    "@typescript-eslint/no-use-before-define": "off",
  },
  settings: {
    react: {
      version: "detect",
    },
  },
};
