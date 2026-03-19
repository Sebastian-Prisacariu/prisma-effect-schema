import { Schema } from "effect";

export const AppTag = "[prisma-effect-schema]";

/**
 * Error thrown when an unsupported Prisma type is encountered
 */
export class UnsupportedTypeError extends Schema.TaggedError<UnsupportedTypeError>()(
  "UnsupportedTypeError",
  {
    typeName: Schema.String,
    fieldName: Schema.String,
    modelName: Schema.String,
  },
) {
  override get message(): string {
    return `${AppTag} Unsupported Prisma type "${this.typeName}" for field "${this.fieldName}" in model "${this.modelName}". Please open an issue at https://github.com/frontcore/prisma-effect-schema/issues`;
  }
}

export class NoOutputConfiguredError extends Schema.TaggedError<NoOutputConfiguredError>()(
  "NoOutputConfiguredError",
  {
    cause: Schema.Unknown,
    details: Schema.String,
  },
) {
  public static message = `${AppTag} No output path specified in generator config`;
}

export const ConfigError = NoOutputConfiguredError;
