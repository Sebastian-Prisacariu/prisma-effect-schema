/**
 * Type Resolution Module
 *
 * Separates the "thinking" (what type should this field be?) from the "writing"
 * (how do we emit it as a string?). Returns structured data that can be tested,
 * logged, and transformed before emission.
 */
import type { DMMF } from "@prisma/generator-helper";
import {
  Array as Arr,
  Data,
  HashMap,
  Option,
  pipe,
  Record,
} from "effect";
import { capitalize } from "effect/String";
import type { GeneratorConfig } from "./config.js";
import { emit } from "./emit.js";
import { UnsupportedTypeError } from "./errors.js";

// ============================================================================
// Resolved Types (Data.TaggedClass for structural equality + pattern matching)
// ============================================================================

/**
 * A primitive scalar type from Prisma mapped to Effect Schema
 */
export class Primitive extends Data.TaggedClass("Primitive")<{
  readonly schema:
    | "Int"
    | "String"
    | "Boolean"
    | "Number"
    | "Date"          // Schema.Date - for Prisma results (Date objects)
    | "DateTimeUtc"   // Schema.DateTimeUtc - for API validation (ISO strings)
    | "BigInt"
    | "Uint8Array"
    | "Json"
    | "Decimal";
}> {}

/**
 * A branded ID type for type-safe IDs
 */
export class BrandedId extends Data.TaggedClass("BrandedId")<{
  readonly name: string;
}> {}

/**
 * An enum type reference
 */
export class Enum extends Data.TaggedClass("Enum")<{
  readonly name: string;
}> {}

/**
 * A relation to another model (uses Schema.suspend for circular refs)
 */
export class Relation extends Data.TaggedClass("Relation")<{
  readonly modelName: string;
}> {}

/**
 * Union of all possible base types a field can resolve to
 */
export type BaseType = Primitive | BrandedId | Enum | Relation;

/**
 * Wrappers that can be applied to a base type
 */
export type Wrapper = "Array" | "NullOr";

/**
 * A fully resolved field type: base type + wrappers to apply
 */
export class ResolvedType extends Data.Class<{
  readonly base: BaseType;
  readonly wrappers: readonly Wrapper[];
}> {}

// ============================================================================
// SchemaResolver Interface
// ============================================================================

export interface SchemaResolver {
  /**
   * Resolve a field to its structured type representation.
   * Use this for testing or when you need to inspect the decision.
   */
  readonly resolve: (field: DMMF.Field) => ResolvedType;

  /**
   * Convenience method: resolve + emit in one call.
   * Use this for the common case where you just need the string.
   */
  readonly fieldToSchema: (field: DMMF.Field) => string;

  /**
   * The computed branded IDs map (modelName -> brandedIdName).
   * Exposed for generating branded ID schema declarations.
   */
  readonly brandedIds: HashMap.HashMap<string, string>;
}

// ============================================================================
// Internal: Scalar Type Mapping
// ============================================================================

type PrimitiveSchema = Primitive["schema"];

/**
 * Maps Prisma scalar types to Primitive schema names.
 * Note: String is handled separately (may become BrandedId).
 * Note: DateTime is handled separately (respects dateTimeHandling config).
 */
const ScalarTypeMap: Record.ReadonlyRecord<string, PrimitiveSchema> = {
  Int: "Int",
  Float: "Number",
  Boolean: "Boolean",
  Json: "Json",
  Bytes: "Uint8Array",
  BigInt: "BigInt",
  Decimal: "Decimal",
};

// ============================================================================
// Branded ID Collection (uses actual PK field name for suffix)
// ============================================================================

/**
 * Collects branded IDs for models with string primary keys.
 * Uses the actual PK field name for the suffix:
 * - User.id (String @id) -> "UserId"
 * - Course.slug (String @id) -> "CourseSlug"
 */
export const collectBrandedIds = (
  models: readonly DMMF.Model[]
): HashMap.HashMap<string, string> =>
  pipe(
    models,
    Arr.filterMap((model) => {
      const pkField = model.fields.find((f) => f.isId && f.type === "String");
      if (!pkField) return Option.none();
      
      // Use the PK field name, capitalized: "id" -> "Id", "slug" -> "Slug"
      const suffix = capitalize(pkField.name);
      return Option.some([model.name, `${model.name}${suffix}`] as const);
    }),
    HashMap.fromIterable
  );

// ============================================================================
// Foreign Key Map (relation-based, not heuristic)
// ============================================================================

/**
 * Builds a map from FK field names to their target model names.
 * Uses DMMF relation metadata (relationFromFields) for accuracy.
 * 
 * Example output:
 * {
 *   "userId": "User",
 *   "authorId": "User",
 *   "courseSlug": "Course",
 *   "avatarId": "File"
 * }
 */
export const buildForeignKeyMap = (
  models: readonly DMMF.Model[]
): HashMap.HashMap<string, string> =>
  pipe(
    models,
    Arr.flatMap((model) =>
      pipe(
        model.fields,
        Arr.filter((field) => field.kind === "object"),
        Arr.flatMap((relationField) => {
          // relationFromFields contains the FK field names for this relation
          const fkFields = relationField.relationFromFields ?? [];
          // The relation's type is the target model name
          const targetModel = relationField.type;
          
          return fkFields.map((fkField) => [fkField, targetModel] as const);
        })
      )
    ),
    HashMap.fromIterable
  );

// ============================================================================
// SchemaResolver Factory
// ============================================================================

export interface SchemaResolverConfig {
  readonly modelName: string;
  readonly brandedIds: HashMap.HashMap<string, string>;
  readonly foreignKeys: HashMap.HashMap<string, string>;
  readonly config: GeneratorConfig;
}

/**
 * Create a SchemaResolver for a specific model.
 * Dependencies are captured at construction time.
 */
export const SchemaResolver = {
  make: (resolverConfig: SchemaResolverConfig): SchemaResolver => {
    const { modelName, brandedIds, foreignKeys, config } = resolverConfig;

    // ========================================================================
    // Branded ID Resolution (relation-based)
    // ========================================================================

    const resolveBrandedId = (field: DMMF.Field): Option.Option<string> => {
      if (!config.useBrandedIds) return Option.none();

      // Primary key uses this model's branded ID
      if (field.isId) {
        return HashMap.get(brandedIds, modelName);
      }

      // Foreign key - look up in FK map, then get target model's branded ID
      return pipe(
        HashMap.get(foreignKeys, field.name),
        Option.flatMap((targetModel) => HashMap.get(brandedIds, targetModel))
      );
    };

    // ========================================================================
    // Base Type Resolution
    // ========================================================================

    const resolveScalarType = (field: DMMF.Field): BaseType => {
      // Handle DateTime with config
      if (field.type === "DateTime") {
        return new Primitive({
          schema: config.dateTimeHandling === "DateTimeString" ? "DateTimeUtc" : "Date",
        });
      }

      // Check non-String scalar types
      const mapping = Record.get(ScalarTypeMap, field.type);
      if (Option.isSome(mapping)) {
        return new Primitive({ schema: mapping.value });
      }

      // String type: try branded ID, fallback to Primitive String
      if (field.type === "String") {
        return pipe(
          resolveBrandedId(field),
          Option.match({
            onNone: () => new Primitive({ schema: "String" }),
            onSome: (name) => new BrandedId({ name }),
          })
        );
      }

      throw new UnsupportedTypeError({
        typeName: field.type,
        fieldName: field.name,
        modelName,
      });
    };

    const resolveBaseType = (field: DMMF.Field): BaseType => {
      switch (field.kind) {
        case "enum":
          return new Enum({ name: field.type });
        case "object":
          return new Relation({ modelName: field.type });
        default:
          return resolveScalarType(field);
      }
    };

    // ========================================================================
    // Full Resolution (base + wrappers)
    // ========================================================================

    const resolve = (field: DMMF.Field): ResolvedType => {
      const wrappers: Wrapper[] = [];

      if (field.isList) {
        wrappers.push("Array");
      }

      if (!field.isRequired) {
        wrappers.push("NullOr");
      }

      return new ResolvedType({
        base: resolveBaseType(field),
        wrappers,
      });
    };

    const fieldToSchema = (field: DMMF.Field): string => emit(resolve(field));

    return {
      resolve,
      fieldToSchema,
      brandedIds,
    };
  },
};
