/**
 * Effect Schema Code Generation
 *
 * Orchestrates generation of Effect Schema source code from Prisma DMMF.
 */
import type { DMMF } from "@prisma/generator-helper";
import { HashMap } from "effect";
import type { GeneratorConfig } from "./config.js";
import { buildForeignKeyMap, collectBrandedIds } from "./resolver.js";
import {
  DEFAULT_HEADER,
  generateBrandedIdSchemas,
  generateEnumSchemas,
  generateModelSchemas,
  JSON_VALUE_SCHEMA,
  sectionHeader,
} from "./templates.js";

// ============================================================================
// Types
// ============================================================================

export interface GenerateInput {
  dmmf: DMMF.Document;
  config: GeneratorConfig;
}

export interface GenerateOutput {
  content: string;
  stats: {
    enumCount: number;
    modelCount: number;
    brandedIdCount: number;
  };
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Generates Effect Schema source code from Prisma DMMF.
 */
export const generate = (input: GenerateInput): GenerateOutput => {
  const { dmmf, config } = input;
  const { models, enums } = dmmf.datamodel;

  // Collect branded IDs from models with string primary keys
  const brandedIds = config.useBrandedIds
    ? collectBrandedIds(models)
    : HashMap.empty<string, string>();

  // Build FK map from relation metadata
  const foreignKeys = buildForeignKeyMap(models);

  const brandedIdCount = HashMap.size(brandedIds);

  // Check if any model has Json fields (to conditionally include JsonValueSchema)
  const hasJsonFields = models.some((model) =>
    model.fields.some((field) => field.type === "Json")
  );

  // Assemble sections
  const sections = [
    // Header
    config.customHeader ?? DEFAULT_HEADER,

    // JSON schema (only if needed)
    ...(hasJsonFields ? ["\n" + JSON_VALUE_SCHEMA] : []),

    // Enums
    ...(enums.length > 0
      ? [sectionHeader("Enums"), generateEnumSchemas(enums)]
      : []),

    // Branded IDs
    ...(brandedIdCount > 0
      ? [sectionHeader("Branded IDs"), generateBrandedIdSchemas(brandedIds), ""]
      : []),

    // Models
    sectionHeader("Models (scalar fields only)"),
    generateModelSchemas(models, brandedIds, foreignKeys, config),
  ];

  return {
    content: sections.join(""),
    stats: {
      enumCount: enums.length,
      modelCount: models.length,
      brandedIdCount,
    },
  };
};
