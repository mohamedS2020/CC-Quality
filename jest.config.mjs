import nextJest from "next/jest.js";

// next/jest loads next.config and .env files and wires up the SWC transform
// so TypeScript/TSX test files run without extra Babel config.
const createJestConfig = nextJest({
  dir: "./",
});

/** @type {import('jest').Config} */
const config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    // Mirror the tsconfig "@/*" -> "src/*" path alias for Jest.
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.next/"],
};

// createJestConfig is exported this way to ensure next/jest can load the
// Next.js config (which is async) before the Jest config is finalized.
export default createJestConfig(config);
