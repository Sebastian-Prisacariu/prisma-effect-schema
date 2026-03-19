import type { GeneratorOptions } from "@prisma/generator-helper";
import { Array as Arr, Option, pipe, Schema } from "effect";

/**
 * Prisma config values can be string | string[] - normalize to first string
 */
const firstString = (value: string | readonly string[]): Option.Option<string> =>
  pipe(value, Arr.ensure, Arr.head);

/**
 * Schema for parsing "true"/"false" strings to booleans (handles string | string[])
 */
const BooleanFromString = Schema.transform(
  Schema.Union(Schema.String, Schema.Array(Schema.String)),
  Schema.Boolean,
  {
    decode: (value) => pipe(value, firstString, Option.map((s) => s === "true"), Option.getOrElse(() => false)),
    encode: (b) => (b ? "true" : "false"),
  }
);

/**
 * Schema for DateTime handling mode (handles string | string[])
 */
const DateTimeHandling = Schema.transform(
  Schema.Union(Schema.String, Schema.Array(Schema.String)),
  Schema.Literal("Date", "DateTimeString"),
  {
    decode: (value) =>
      pipe(
        value,
        firstString,
        Option.filter((s) => s === "DateTimeString"),
        Option.map(() => "DateTimeString" as const),
        Option.getOrElse(() => "Date" as const)
      ),
    encode: (s) => s,
  }
);

/**
 * Generator configuration schema with defaults.
 * Parses Prisma generator config and applies defaults in one step.
 */
export const GeneratorConfigSchema = Schema.Struct({
  /**
   * Whether to include relation fields in the generated schemas.
   * Relations use Schema.suspend() for lazy evaluation to handle circular deps.
   * @default false
   */
  includeRelations: Schema.optionalWith(BooleanFromString, {
    default: () => false,
  }),

  /**
   * Whether to generate branded ID types for models with string IDs.
   * When true, generates `UserId`, `PostId`, etc. and uses them in model schemas.
   * @default true
   */
  useBrandedIds: Schema.optionalWith(BooleanFromString, {
    default: () => true,
  }),

  /**
   * How to handle DateTime fields.
   * - 'Date': Use Schema.Date (expects Date objects, for Prisma results)
   * - 'DateTimeString': Use Schema.Date with dateTime annotation (for API validation)
   * @default 'Date'
   */
  dateTimeHandling: Schema.optionalWith(DateTimeHandling, {
    default: () => "Date" as const,
  }),

  /**
   * Whether to sort fields alphabetically for deterministic output.
   * @default true
   */
  sortFields: Schema.optionalWith(BooleanFromString, {
    default: () => true,
  }),

  /**
   * Custom header to prepend to the generated file.
   * If not provided, uses a default header without timestamps.
   */
  customHeader: Schema.optionalWith(
    Schema.transform(
      Schema.Union(Schema.String, Schema.Array(Schema.String)),
      Schema.NullOr(Schema.String),
      {
        decode: (value) => pipe(value, firstString, Option.getOrElse(() => null as string | null)),
        encode: (s) => s ?? "",
      }
    ),
    { default: () => null }
  ),
});

/**
 * Resolved configuration type (derived from schema)
 */
export type GeneratorConfig = typeof GeneratorConfigSchema.Type;



/**
 * Parse generator config from Prisma schema using Effect Schema
 */
export const parseConfig = (options: GeneratorOptions) =>
  Schema.decodeUnknown(GeneratorConfigSchema)(options.generator.config);
