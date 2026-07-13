import "dotenv/config";
import { defineConfig, env } from "@prisma/config";

// Prisma 7 config: connection URL + migration seed command live here instead
// of in schema.prisma / package.json#prisma (both are no longer supported).
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
