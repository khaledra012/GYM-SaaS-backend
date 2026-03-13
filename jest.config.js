/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.spec.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  clearMocks: true,
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.spec.json" }],
  },
  collectCoverageFrom: [
    "src/modules/debts/**/*.ts",
    "!src/modules/debts/**/*.spec.ts",
    "!src/modules/debts/**/*.routes.ts",
    "!src/modules/debts/**/*.controller.ts",
    "!src/modules/debts/index.ts",
  ],
};
