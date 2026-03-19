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
export { generate, makeUnsupportedTypeError } from "./generate.js";
export type { GenerateInput, GenerateOutput } from "./generate.js";

