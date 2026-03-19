/**
 * Code Emission Module
 *
 * Pure functions for transforming resolved types into Effect Schema strings.
 * Separated from resolution logic for testability and reusability.
 */
import { Match } from "effect";
import type { BaseType, ResolvedType, Wrapper } from "./resolver.js";

/**
 * Emit a base type to its Effect Schema string representation
 */
export const emitBaseType = (base: BaseType): string =>
  Match.value(base).pipe(
    Match.tag("Primitive", ({ schema }) =>
      schema === "Json" ? "JsonValueSchema" : `Schema.${schema}`
    ),
    Match.tag("BrandedId", ({ name }) => name),
    Match.tag("Enum", ({ name }) => name),
    Match.tag("Relation", ({ modelName }) => `Schema.suspend(() => ${modelName})`),
    Match.exhaustive
  );

/**
 * Apply a single wrapper to a schema string
 */
export const applyWrapper = (inner: string, wrapper: Wrapper): string => {
  switch (wrapper) {
    case "Array":
      return `Schema.Array(${inner})`;
    case "NullOr":
      return `Schema.NullOr(${inner})`;
  }
};

/**
 * Emit a fully resolved type (base + wrappers) to Effect Schema string.
 * Wrappers are applied left-to-right (innermost first).
 */
export const emit = (type: ResolvedType): string =>
  type.wrappers.reduce(applyWrapper, emitBaseType(type.base));
