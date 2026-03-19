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

export {
  generate,
  UnsupportedTypeError,
  makeUnsupportedTypeError,
} from "./generate.js";
export type { GenerateInput, GenerateOutput } from "./generate.js";
export { resolveConfig, DEFAULT_CONFIG } from "./types.js";
export type { GeneratorConfig, ResolvedConfig } from "./types.js";
