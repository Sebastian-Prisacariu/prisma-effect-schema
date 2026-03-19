import { describe, expect, it } from "vitest";
import { applyWrapper, emit, emitBaseType } from "./emit.js";
import {
  BrandedId,
  Enum,
  Primitive,
  Relation,
  ResolvedType,
} from "./resolver.js";

// ============================================================================
// emitBaseType
// ============================================================================

describe("emitBaseType", () => {
  describe("Primitive types", () => {
    it("emits Int as Schema.Int", () => {
      expect(emitBaseType(new Primitive({ schema: "Int" }))).toBe("Schema.Int");
    });

    it("emits String as Schema.String", () => {
      expect(emitBaseType(new Primitive({ schema: "String" }))).toBe("Schema.String");
    });

    it("emits Boolean as Schema.Boolean", () => {
      expect(emitBaseType(new Primitive({ schema: "Boolean" }))).toBe("Schema.Boolean");
    });

    it("emits Number as Schema.Number", () => {
      expect(emitBaseType(new Primitive({ schema: "Number" }))).toBe("Schema.Number");
    });

    it("emits Date as Schema.Date", () => {
      expect(emitBaseType(new Primitive({ schema: "Date" }))).toBe("Schema.Date");
    });

    it("emits DateTimeUtc as Schema.DateTimeUtc", () => {
      expect(emitBaseType(new Primitive({ schema: "DateTimeUtc" }))).toBe(
        "Schema.DateTimeUtc"
      );
    });

    it("emits BigInt as Schema.BigInt", () => {
      expect(emitBaseType(new Primitive({ schema: "BigInt" }))).toBe("Schema.BigInt");
    });

    it("emits Uint8Array as Schema.Uint8Array", () => {
      expect(emitBaseType(new Primitive({ schema: "Uint8Array" }))).toBe(
        "Schema.Uint8Array"
      );
    });

    it("emits Json as JsonValueSchema (special case)", () => {
      expect(emitBaseType(new Primitive({ schema: "Json" }))).toBe("JsonValueSchema");
    });

    it("emits Decimal as Schema.Decimal", () => {
      expect(emitBaseType(new Primitive({ schema: "Decimal" }))).toBe("Schema.Decimal");
    });
  });

  describe("BrandedId", () => {
    it("emits branded ID name directly", () => {
      expect(emitBaseType(new BrandedId({ name: "UserId" }))).toBe("UserId");
    });

    it("emits any branded ID name", () => {
      expect(emitBaseType(new BrandedId({ name: "PostId" }))).toBe("PostId");
    });
  });

  describe("Enum", () => {
    it("emits enum name directly", () => {
      expect(emitBaseType(new Enum({ name: "PostStatus" }))).toBe("PostStatus");
    });
  });

  describe("Relation", () => {
    it("emits suspended schema reference", () => {
      expect(emitBaseType(new Relation({ modelName: "User" }))).toBe(
        "Schema.suspend(() => User)"
      );
    });

    it("emits any model name in suspend", () => {
      expect(emitBaseType(new Relation({ modelName: "Comment" }))).toBe(
        "Schema.suspend(() => Comment)"
      );
    });
  });
});

// ============================================================================
// applyWrapper
// ============================================================================

describe("applyWrapper", () => {
  it("wraps with Schema.Array for Array wrapper", () => {
    expect(applyWrapper("Schema.String", "Array")).toBe(
      "Schema.Array(Schema.String)"
    );
  });

  it("wraps with Schema.NullOr for NullOr wrapper", () => {
    expect(applyWrapper("Schema.String", "NullOr")).toBe(
      "Schema.NullOr(Schema.String)"
    );
  });

  it("can be chained for nested wrappers", () => {
    const arrayWrapped = applyWrapper("Schema.String", "Array");
    const nullOrWrapped = applyWrapper(arrayWrapped, "NullOr");
    
    expect(nullOrWrapped).toBe("Schema.NullOr(Schema.Array(Schema.String))");
  });
});

// ============================================================================
// emit
// ============================================================================

describe("emit", () => {
  it("emits base type with no wrappers", () => {
    const type = new ResolvedType({
      base: new Primitive({ schema: "Int" }),
      wrappers: [],
    });

    expect(emit(type)).toBe("Schema.Int");
  });

  it("emits with Array wrapper", () => {
    const type = new ResolvedType({
      base: new Primitive({ schema: "String" }),
      wrappers: ["Array"],
    });

    expect(emit(type)).toBe("Schema.Array(Schema.String)");
  });

  it("emits with NullOr wrapper", () => {
    const type = new ResolvedType({
      base: new Primitive({ schema: "String" }),
      wrappers: ["NullOr"],
    });

    expect(emit(type)).toBe("Schema.NullOr(Schema.String)");
  });

  it("emits with both wrappers (Array inside NullOr)", () => {
    const type = new ResolvedType({
      base: new Primitive({ schema: "String" }),
      wrappers: ["Array", "NullOr"],
    });

    expect(emit(type)).toBe("Schema.NullOr(Schema.Array(Schema.String))");
  });

  it("emits BrandedId with wrappers", () => {
    const type = new ResolvedType({
      base: new BrandedId({ name: "UserId" }),
      wrappers: ["NullOr"],
    });

    expect(emit(type)).toBe("Schema.NullOr(UserId)");
  });

  it("emits Enum with wrappers", () => {
    const type = new ResolvedType({
      base: new Enum({ name: "Status" }),
      wrappers: ["Array"],
    });

    expect(emit(type)).toBe("Schema.Array(Status)");
  });

  it("emits Relation with wrappers", () => {
    const type = new ResolvedType({
      base: new Relation({ modelName: "Post" }),
      wrappers: ["Array"],
    });

    expect(emit(type)).toBe("Schema.Array(Schema.suspend(() => Post))");
  });
});
