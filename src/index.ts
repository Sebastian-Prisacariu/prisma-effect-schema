/**
 * prisma-effect-schema
 *
 * Prisma generator that creates Effect Schemas from your Prisma models.
 *
 * @example
 * ```prisma
 * generator effectSchema {
 *   provider = "prisma-effect-schema"
 *   output   = "./generated/effect-schemas.ts"
 * }
 * ```
 */

export { GeneratorConfigSchema } from "./config.js";
export type { GeneratorConfig } from "./config.js";
export { UnsupportedTypeError } from "./errors.js";
export { generate } from "./generate.js";
export type { GenerateInput, GenerateOutput } from "./generate.js";

// Resolver exports (for testing and advanced usage)
export {
  BrandedId,
  buildForeignKeyMap,
  collectBrandedIds,
  Enum,
  Primitive,
  Relation,
  ResolvedType,
  SchemaResolver,
} from "./resolver.js";
export type { BaseType, SchemaResolverConfig, Wrapper } from "./resolver.js";

// Emit exports (for custom emission)
export { applyWrapper, emit, emitBaseType } from "./emit.js";

// Template exports (for custom generation)
export {
  DEFAULT_HEADER,
  generateBrandedIdSchema,
  generateBrandedIdSchemas,
  generateEnumSchema,
  generateEnumSchemas,
  generateFieldsCode,
  generateModelSchema,
  generateModelSchemas,
  JSON_VALUE_SCHEMA,
  sectionHeader,
} from "./templates.js";
