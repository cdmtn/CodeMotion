import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["tests/**/*.test.ts", "tests/**/*.test.js"],
        coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            include: ["app/sandbox/tools.js", "app/main/helpers/requests.js"],
        },
    },
})
