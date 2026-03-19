/**
 * Prisma Generator Handler
 *
 * This module registers the generator with Prisma and handles the generation lifecycle.
 */
import pkg from "@prisma/generator-helper";
import type { GeneratorOptions } from "@prisma/generator-helper";
import fs from "node:fs/promises";
import path from "node:path";
import { generate } from "./generate.js";
import { resolveConfig, type GeneratorConfig } from "./types.js";

const { generatorHandler } = pkg;

/**
 * Get a single string value from a config field (handles arrays)
 */
function getConfigValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Parse generator config from Prisma schema
 */
function parseConfig(options: GeneratorOptions): GeneratorConfig {
  const config = options.generator.config;

  return {
    includeRelations: getConfigValue(config.includeRelations) === "true",
    useBrandedIds: getConfigValue(config.useBrandedIds) !== "false", // default true
    dateTimeHandling:
      getConfigValue(config.dateTimeHandling) === "DateTimeString"
        ? "DateTimeString"
        : "Date",
    sortFields: getConfigValue(config.sortFields) !== "false", // default true
    customHeader: getConfigValue(config.customHeader),
  };
}

/**
 * Main generation handler called by Prisma
 */
async function onGenerate(options: GeneratorOptions): Promise<void> {
  const outputPath = options.generator.output?.value;

  if (!outputPath) {
    throw new Error(
      "prisma-effect-schema: No output path specified in generator config",
    );
  }

  const config = resolveConfig(parseConfig(options));

  const { content, stats } = generate({
    dmmf: options.dmmf,
    config,
  });

  // Ensure output directory exists
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  // Write the generated file
  await fs.writeFile(outputPath, content, "utf-8");

  console.log(`✅ prisma-effect-schema: Generated Effect Schemas`);
  console.log(`   Output: ${outputPath}`);
  console.log(
    `   Stats: ${stats.enumCount} enums, ${stats.modelCount} models, ${stats.brandedIdCount} branded IDs`,
  );
}

// Register as Prisma generator
generatorHandler({
  onManifest() {
    return {
      defaultOutput: "./generated/effect-schemas.ts",
      prettyName: "Effect Schema Generator",
      requiresGenerators: ["prisma-client-js"],
    };
  },
  onGenerate,
});
