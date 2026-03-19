import type { DMMF } from "@prisma/generator-helper";
import { HashMap, Option } from "effect";
import { describe, expect, it } from "vitest";
import type { GeneratorConfig } from "./config.js";
import {
  BrandedId,
  buildForeignKeyMap,
  collectBrandedIds,
  Enum,
  Primitive,
  Relation,
  SchemaResolver,
} from "./resolver.js";

// ============================================================================
// Test Fixtures
// ============================================================================

const defaultConfig: GeneratorConfig = {
  includeRelations: false,
  useBrandedIds: true,
  dateTimeHandling: "Date",
  sortFields: true,
  customHeader: null,
};

const makeField = (overrides: Partial<DMMF.Field>): DMMF.Field =>
  ({
    name: "testField",
    kind: "scalar",
    isList: false,
    isRequired: true,
    isUnique: false,
    isId: false,
    isReadOnly: false,
    isGenerated: false,
    isUpdatedAt: false,
    type: "String",
    hasDefaultValue: false,
    ...overrides,
  }) as DMMF.Field;

const makeRelationField = (
  name: string,
  type: string,
  relationFromFields: string[]
): DMMF.Field =>
  makeField({
    name,
    kind: "object",
    type,
    relationFromFields,
    relationToFields: ["id"],
  });

const makeModel = (
  name: string,
  fields: Partial<DMMF.Field>[]
): DMMF.Model =>
  ({
    name,
    fields: fields.map((f) => makeField({ ...f })),
    primaryKey: null,
    uniqueFields: [],
    uniqueIndexes: [],
    dbName: null,
    schema: null,
    isGenerated: false,
  }) as DMMF.Model;

const makeModelWithRelations = (
  name: string,
  scalarFields: Partial<DMMF.Field>[],
  relationFields: Array<{ name: string; type: string; fkFields: string[] }>
): DMMF.Model => {
  const scalars = scalarFields.map((f) => makeField({ ...f }));
  const relations = relationFields.map((r) =>
    makeRelationField(r.name, r.type, r.fkFields)
  );
  return {
    name,
    fields: [...scalars, ...relations],
    primaryKey: null,
    uniqueFields: [],
    uniqueIndexes: [],
    dbName: null,
    schema: null,
    isGenerated: false,
  } as DMMF.Model;
};

// ============================================================================
// collectBrandedIds (uses PK field name for suffix)
// ============================================================================

describe("collectBrandedIds", () => {
  it("uses 'Id' suffix for models with 'id' PK", () => {
    const models = [
      makeModel("User", [{ name: "id", type: "String", isId: true }]),
    ];

    const result = collectBrandedIds(models);

    expect(Option.getOrThrow(HashMap.get(result, "User"))).toBe("UserId");
  });

  it("uses 'Slug' suffix for models with 'slug' PK", () => {
    const models = [
      makeModel("Course", [{ name: "slug", type: "String", isId: true }]),
    ];

    const result = collectBrandedIds(models);

    expect(Option.getOrThrow(HashMap.get(result, "Course"))).toBe("CourseSlug");
  });

  it("handles mixed PK names", () => {
    const models = [
      makeModel("User", [{ name: "id", type: "String", isId: true }]),
      makeModel("Course", [{ name: "slug", type: "String", isId: true }]),
      makeModel("Organization", [{ name: "slug", type: "String", isId: true }]),
    ];

    const result = collectBrandedIds(models);

    expect(Option.getOrThrow(HashMap.get(result, "User"))).toBe("UserId");
    expect(Option.getOrThrow(HashMap.get(result, "Course"))).toBe("CourseSlug");
    expect(Option.getOrThrow(HashMap.get(result, "Organization"))).toBe("OrganizationSlug");
  });

  it("excludes models with non-string primary keys", () => {
    const models = [
      makeModel("User", [{ name: "id", type: "String", isId: true }]),
      makeModel("Counter", [{ name: "id", type: "Int", isId: true }]),
    ];

    const result = collectBrandedIds(models);

    expect(Option.getOrThrow(HashMap.get(result, "User"))).toBe("UserId");
    expect(Option.isNone(HashMap.get(result, "Counter"))).toBe(true);
  });

  it("returns empty HashMap when no models have string IDs", () => {
    const models = [
      makeModel("Counter", [{ name: "id", type: "Int", isId: true }]),
    ];

    const result = collectBrandedIds(models);

    expect(HashMap.size(result)).toBe(0);
  });
});

// ============================================================================
// buildForeignKeyMap
// ============================================================================

describe("buildForeignKeyMap", () => {
  it("builds FK map from relation fields", () => {
    const models = [
      makeModelWithRelations(
        "Post",
        [{ name: "id", type: "String", isId: true }, { name: "authorId", type: "String" }],
        [{ name: "author", type: "User", fkFields: ["authorId"] }]
      ),
    ];

    const result = buildForeignKeyMap(models);

    expect(Option.getOrThrow(HashMap.get(result, "authorId"))).toBe("User");
  });

  it("handles multiple FKs in same model", () => {
    const models = [
      makeModelWithRelations(
        "Post",
        [
          { name: "id", type: "String", isId: true },
          { name: "authorId", type: "String" },
          { name: "courseSlug", type: "String" },
        ],
        [
          { name: "author", type: "User", fkFields: ["authorId"] },
          { name: "course", type: "Course", fkFields: ["courseSlug"] },
        ]
      ),
    ];

    const result = buildForeignKeyMap(models);

    expect(Option.getOrThrow(HashMap.get(result, "authorId"))).toBe("User");
    expect(Option.getOrThrow(HashMap.get(result, "courseSlug"))).toBe("Course");
  });

  it("handles non-standard FK names like avatarId -> File", () => {
    const models = [
      makeModelWithRelations(
        "User",
        [{ name: "id", type: "String", isId: true }, { name: "avatarId", type: "String" }],
        [{ name: "avatarFile", type: "File", fkFields: ["avatarId"] }]
      ),
    ];

    const result = buildForeignKeyMap(models);

    expect(Option.getOrThrow(HashMap.get(result, "avatarId"))).toBe("File");
  });

  it("handles multiple FKs to same model (requestedByUserId, performedByUserId)", () => {
    const models = [
      makeModelWithRelations(
        "MaxioCustomerMerge",
        [
          { name: "id", type: "String", isId: true },
          { name: "requestedByUserId", type: "String" },
          { name: "performedByUserId", type: "String" },
        ],
        [
          { name: "requestedBy", type: "User", fkFields: ["requestedByUserId"] },
          { name: "performedBy", type: "User", fkFields: ["performedByUserId"] },
        ]
      ),
    ];

    const result = buildForeignKeyMap(models);

    expect(Option.getOrThrow(HashMap.get(result, "requestedByUserId"))).toBe("User");
    expect(Option.getOrThrow(HashMap.get(result, "performedByUserId"))).toBe("User");
  });

  it("aggregates FKs from all models", () => {
    const models = [
      makeModelWithRelations(
        "Post",
        [{ name: "authorId", type: "String" }],
        [{ name: "author", type: "User", fkFields: ["authorId"] }]
      ),
      makeModelWithRelations(
        "Comment",
        [{ name: "postId", type: "String" }],
        [{ name: "post", type: "Post", fkFields: ["postId"] }]
      ),
    ];

    const result = buildForeignKeyMap(models);

    expect(Option.getOrThrow(HashMap.get(result, "authorId"))).toBe("User");
    expect(Option.getOrThrow(HashMap.get(result, "postId"))).toBe("Post");
  });
});

// ============================================================================
// SchemaResolver.resolve - Scalar Types
// ============================================================================

describe("SchemaResolver.resolve", () => {
  describe("scalar types", () => {
    it("resolves Int to Primitive", () => {
      const resolver = SchemaResolver.make({
        modelName: "Test",
        brandedIds: HashMap.empty(),
        foreignKeys: HashMap.empty(),
        config: defaultConfig,
      });
      const field = makeField({ name: "count", type: "Int" });

      const result = resolver.resolve(field);

      expect(result.base).toEqual(new Primitive({ schema: "Int" }));
      expect(result.wrappers).toEqual([]);
    });

    it("resolves Float to Number", () => {
      const resolver = SchemaResolver.make({
        modelName: "Test",
        brandedIds: HashMap.empty(),
        foreignKeys: HashMap.empty(),
        config: defaultConfig,
      });
      const field = makeField({ name: "price", type: "Float" });

      const result = resolver.resolve(field);

      expect(result.base).toEqual(new Primitive({ schema: "Number" }));
    });

    it("resolves Boolean to Boolean", () => {
      const resolver = SchemaResolver.make({
        modelName: "Test",
        brandedIds: HashMap.empty(),
        foreignKeys: HashMap.empty(),
        config: defaultConfig,
      });
      const field = makeField({ name: "active", type: "Boolean" });

      const result = resolver.resolve(field);

      expect(result.base).toEqual(new Primitive({ schema: "Boolean" }));
    });

    it("resolves String to Primitive String when no branded ID", () => {
      const resolver = SchemaResolver.make({
        modelName: "Test",
        brandedIds: HashMap.empty(),
        foreignKeys: HashMap.empty(),
        config: defaultConfig,
      });
      const field = makeField({ name: "email", type: "String" });

      const result = resolver.resolve(field);

      expect(result.base).toEqual(new Primitive({ schema: "String" }));
    });

    it("resolves Json to Primitive Json", () => {
      const resolver = SchemaResolver.make({
        modelName: "Test",
        brandedIds: HashMap.empty(),
        foreignKeys: HashMap.empty(),
        config: defaultConfig,
      });
      const field = makeField({ name: "metadata", type: "Json" });

      const result = resolver.resolve(field);

      expect(result.base).toEqual(new Primitive({ schema: "Json" }));
    });

    it("resolves BigInt to Primitive BigInt", () => {
      const resolver = SchemaResolver.make({
        modelName: "Test",
        brandedIds: HashMap.empty(),
        foreignKeys: HashMap.empty(),
        config: defaultConfig,
      });
      const field = makeField({ name: "bigNumber", type: "BigInt" });

      const result = resolver.resolve(field);

      expect(result.base).toEqual(new Primitive({ schema: "BigInt" }));
    });

    it("resolves Bytes to Primitive Uint8Array", () => {
      const resolver = SchemaResolver.make({
        modelName: "Test",
        brandedIds: HashMap.empty(),
        foreignKeys: HashMap.empty(),
        config: defaultConfig,
      });
      const field = makeField({ name: "data", type: "Bytes" });

      const result = resolver.resolve(field);

      expect(result.base).toEqual(new Primitive({ schema: "Uint8Array" }));
    });

    it("resolves Decimal to Primitive Decimal", () => {
      const resolver = SchemaResolver.make({
        modelName: "Test",
        brandedIds: HashMap.empty(),
        foreignKeys: HashMap.empty(),
        config: defaultConfig,
      });
      const field = makeField({ name: "amount", type: "Decimal" });

      const result = resolver.resolve(field);

      expect(result.base).toEqual(new Primitive({ schema: "Decimal" }));
    });
  });

  describe("DateTime handling", () => {
    it("resolves DateTime to Date by default", () => {
      const resolver = SchemaResolver.make({
        modelName: "Test",
        brandedIds: HashMap.empty(),
        foreignKeys: HashMap.empty(),
        config: { ...defaultConfig, dateTimeHandling: "Date" },
      });
      const field = makeField({ name: "createdAt", type: "DateTime" });

      const result = resolver.resolve(field);

      expect(result.base).toEqual(new Primitive({ schema: "Date" }));
    });

    it("resolves DateTime to DateTimeUtc when configured for string handling", () => {
      const resolver = SchemaResolver.make({
        modelName: "Test",
        brandedIds: HashMap.empty(),
        foreignKeys: HashMap.empty(),
        config: { ...defaultConfig, dateTimeHandling: "DateTimeString" },
      });
      const field = makeField({ name: "createdAt", type: "DateTime" });

      const result = resolver.resolve(field);

      expect(result.base).toEqual(new Primitive({ schema: "DateTimeUtc" }));
    });
  });

  describe("branded IDs", () => {
    it("resolves primary key String to BrandedId", () => {
      const brandedIds = HashMap.make(["User", "UserId"]);
      const resolver = SchemaResolver.make({
        modelName: "User",
        brandedIds,
        foreignKeys: HashMap.empty(),
        config: defaultConfig,
      });
      const field = makeField({ name: "id", type: "String", isId: true });

      const result = resolver.resolve(field);

      expect(result.base).toEqual(new BrandedId({ name: "UserId" }));
    });

    it("resolves foreign key to referenced model BrandedId using FK map", () => {
      const brandedIds = HashMap.make(["User", "UserId"]);
      const foreignKeys = HashMap.make(["authorId", "User"]);
      const resolver = SchemaResolver.make({
        modelName: "Post",
        brandedIds,
        foreignKeys,
        config: defaultConfig,
      });
      const field = makeField({ name: "authorId", type: "String" });

      const result = resolver.resolve(field);

      expect(result.base).toEqual(new BrandedId({ name: "UserId" }));
    });

    it("resolves non-standard FK name (avatarId -> File) using FK map", () => {
      const brandedIds = HashMap.make(["File", "FileId"]);
      const foreignKeys = HashMap.make(["avatarId", "File"]);
      const resolver = SchemaResolver.make({
        modelName: "User",
        brandedIds,
        foreignKeys,
        config: defaultConfig,
      });
      const field = makeField({ name: "avatarId", type: "String" });

      const result = resolver.resolve(field);

      expect(result.base).toEqual(new BrandedId({ name: "FileId" }));
    });

    it("resolves slug-based FK (courseSlug -> Course) using FK map", () => {
      const brandedIds = HashMap.make(["Course", "CourseSlug"]);
      const foreignKeys = HashMap.make(["courseSlug", "Course"]);
      const resolver = SchemaResolver.make({
        modelName: "Post",
        brandedIds,
        foreignKeys,
        config: defaultConfig,
      });
      const field = makeField({ name: "courseSlug", type: "String" });

      const result = resolver.resolve(field);

      expect(result.base).toEqual(new BrandedId({ name: "CourseSlug" }));
    });

    it("falls back to String when FK not in map", () => {
      const brandedIds = HashMap.make(["User", "UserId"]);
      const foreignKeys = HashMap.empty<string, string>();
      const resolver = SchemaResolver.make({
        modelName: "Post",
        brandedIds,
        foreignKeys,
        config: defaultConfig,
      });
      const field = makeField({ name: "unknownId", type: "String" });

      const result = resolver.resolve(field);

      expect(result.base).toEqual(new Primitive({ schema: "String" }));
    });

    it("falls back to String when FK target model has no branded ID", () => {
      const brandedIds = HashMap.empty<string, string>(); // User has Int PK, no branded ID
      const foreignKeys = HashMap.make(["authorId", "User"]);
      const resolver = SchemaResolver.make({
        modelName: "Post",
        brandedIds,
        foreignKeys,
        config: defaultConfig,
      });
      const field = makeField({ name: "authorId", type: "String" });

      const result = resolver.resolve(field);

      expect(result.base).toEqual(new Primitive({ schema: "String" }));
    });

    it("respects useBrandedIds=false config", () => {
      const brandedIds = HashMap.make(["User", "UserId"]);
      const foreignKeys = HashMap.make(["authorId", "User"]);
      const resolver = SchemaResolver.make({
        modelName: "User",
        brandedIds,
        foreignKeys,
        config: { ...defaultConfig, useBrandedIds: false },
      });
      const field = makeField({ name: "id", type: "String", isId: true });

      const result = resolver.resolve(field);

      expect(result.base).toEqual(new Primitive({ schema: "String" }));
    });
  });

  describe("enums", () => {
    it("resolves enum fields to Enum type", () => {
      const resolver = SchemaResolver.make({
        modelName: "Post",
        brandedIds: HashMap.empty(),
        foreignKeys: HashMap.empty(),
        config: defaultConfig,
      });
      const field = makeField({ name: "status", kind: "enum", type: "PostStatus" });

      const result = resolver.resolve(field);

      expect(result.base).toEqual(new Enum({ name: "PostStatus" }));
    });
  });

  describe("relations", () => {
    it("resolves object fields to Relation type", () => {
      const resolver = SchemaResolver.make({
        modelName: "Post",
        brandedIds: HashMap.empty(),
        foreignKeys: HashMap.empty(),
        config: defaultConfig,
      });
      const field = makeField({ name: "author", kind: "object", type: "User" });

      const result = resolver.resolve(field);

      expect(result.base).toEqual(new Relation({ modelName: "User" }));
    });
  });

  describe("wrappers", () => {
    it("adds Array wrapper for list fields", () => {
      const resolver = SchemaResolver.make({
        modelName: "Test",
        brandedIds: HashMap.empty(),
        foreignKeys: HashMap.empty(),
        config: defaultConfig,
      });
      const field = makeField({ name: "tags", type: "String", isList: true });

      const result = resolver.resolve(field);

      expect(result.wrappers).toEqual(["Array"]);
    });

    it("adds NullOr wrapper for optional fields", () => {
      const resolver = SchemaResolver.make({
        modelName: "Test",
        brandedIds: HashMap.empty(),
        foreignKeys: HashMap.empty(),
        config: defaultConfig,
      });
      const field = makeField({ name: "bio", type: "String", isRequired: false });

      const result = resolver.resolve(field);

      expect(result.wrappers).toEqual(["NullOr"]);
    });

    it("adds both wrappers for optional list fields", () => {
      const resolver = SchemaResolver.make({
        modelName: "Test",
        brandedIds: HashMap.empty(),
        foreignKeys: HashMap.empty(),
        config: defaultConfig,
      });
      const field = makeField({
        name: "tags",
        type: "String",
        isList: true,
        isRequired: false,
      });

      const result = resolver.resolve(field);

      expect(result.wrappers).toEqual(["Array", "NullOr"]);
    });

    it("has no wrappers for required non-list fields", () => {
      const resolver = SchemaResolver.make({
        modelName: "Test",
        brandedIds: HashMap.empty(),
        foreignKeys: HashMap.empty(),
        config: defaultConfig,
      });
      const field = makeField({ name: "name", type: "String" });

      const result = resolver.resolve(field);

      expect(result.wrappers).toEqual([]);
    });
  });
});

// ============================================================================
// SchemaResolver.fieldToSchema
// ============================================================================

describe("SchemaResolver.fieldToSchema", () => {
  it("returns complete schema string for simple field", () => {
    const resolver = SchemaResolver.make({
      modelName: "Test",
      brandedIds: HashMap.empty(),
      foreignKeys: HashMap.empty(),
      config: defaultConfig,
    });
    const field = makeField({ name: "count", type: "Int" });

    const result = resolver.fieldToSchema(field);

    expect(result).toBe("Schema.Int");
  });

  it("returns wrapped schema for optional list", () => {
    const resolver = SchemaResolver.make({
      modelName: "Test",
      brandedIds: HashMap.empty(),
      foreignKeys: HashMap.empty(),
      config: defaultConfig,
    });
    const field = makeField({
      name: "tags",
      type: "String",
      isList: true,
      isRequired: false,
    });

    const result = resolver.fieldToSchema(field);

    expect(result).toBe("Schema.NullOr(Schema.Array(Schema.String))");
  });

  it("returns branded ID name directly", () => {
    const brandedIds = HashMap.make(["User", "UserId"]);
    const resolver = SchemaResolver.make({
      modelName: "User",
      brandedIds,
      foreignKeys: HashMap.empty(),
      config: defaultConfig,
    });
    const field = makeField({ name: "id", type: "String", isId: true });

    const result = resolver.fieldToSchema(field);

    expect(result).toBe("UserId");
  });

  it("returns JsonValueSchema for Json type", () => {
    const resolver = SchemaResolver.make({
      modelName: "Test",
      brandedIds: HashMap.empty(),
      foreignKeys: HashMap.empty(),
      config: defaultConfig,
    });
    const field = makeField({ name: "data", type: "Json" });

    const result = resolver.fieldToSchema(field);

    expect(result).toBe("JsonValueSchema");
  });

  it("returns suspended schema for relations", () => {
    const resolver = SchemaResolver.make({
      modelName: "Post",
      brandedIds: HashMap.empty(),
      foreignKeys: HashMap.empty(),
      config: defaultConfig,
    });
    const field = makeField({ name: "author", kind: "object", type: "User" });

    const result = resolver.fieldToSchema(field);

    expect(result).toBe("Schema.suspend(() => User)");
  });
});
