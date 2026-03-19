# prisma-effect-schema

[![npm version](https://img.shields.io/npm/v/prisma-effect-schema.svg)](https://www.npmjs.com/package/prisma-effect-schema)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A Prisma generator that creates type-safe [Effect Schema](https://effect.website/docs/schema/introduction) definitions from your Prisma models.

> **Disclaimer:** This is a community project and is **not maintained by the Effect team**. It may contain bugs or have incomplete coverage of edge cases. Use at your own discretion and please report any issues you encounter.

## Why prisma-effect-schema?

When using Prisma with Effect, you need runtime validation schemas that match your database models. Writing these by hand is tedious and error-prone. This generator:

- **Keeps schemas in sync** with your Prisma models automatically
- **Provides type-safe IDs** through branded types (no more mixing up `UserId` and `PostId`)
- **Handles complex types** like JSON, enums, and relations out of the box
- **Produces deterministic output** to minimize git diffs

## Features

- Generates Effect Schemas for all Prisma models and enums
- Creates branded ID types for type-safe entity references
- Handles all Prisma scalar types (String, Int, Float, Boolean, DateTime, Json, Bytes, BigInt, Decimal)
- Intelligent foreign key resolution using Prisma relation metadata
- Optional relation schemas with `Schema.suspend()` for circular references
- Deterministic output (sorted fields/models) to minimize git diffs
- No timestamps in generated files to avoid unnecessary churn
- Fully configurable via Prisma schema

## Installation

```bash
npm install prisma-effect-schema effect
# or
pnpm add prisma-effect-schema effect
# or
yarn add prisma-effect-schema effect
```

> **Note:** `effect` is a peer dependency and must be installed separately.

## Quick Start

### 1. Add the generator to your `schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

generator effectSchema {
  provider = "prisma-effect-schema"
  output   = "./generated/schemas.ts"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
}
```

### 2. Run the generator

```bash
npx prisma generate
```

### 3. Use the generated schemas

```typescript
import { Schema } from "effect";
import { User, UserId, Post, PostId } from "./generated/schemas";

// Validate data
const parseUser = Schema.decodeUnknownSync(User);
const user = parseUser({
  id: "clx123...",
  email: "alice@example.com",
  name: "Alice",
  createdAt: new Date(),
});

// Type-safe IDs prevent mixing up different entity IDs
const getUserById = (id: UserId) => { /* ... */ };
const postId: PostId = "post_123" as PostId;
// getUserById(postId); // Type error! Can't use PostId where UserId is expected
```

## Generated Output

The generator produces clean, readable TypeScript:

```typescript
import { Schema } from "effect"

// ============================================================================
// Branded IDs
// ============================================================================
export const UserId = Schema.String.pipe(Schema.brand("UserId"))
export type UserId = typeof UserId.Type

export const PostId = Schema.String.pipe(Schema.brand("PostId"))
export type PostId = typeof PostId.Type

// ============================================================================
// Models (scalar fields only)
// ============================================================================
export const User = Schema.Struct({
  createdAt: Schema.Date,
  email: Schema.String,
  id: UserId,
  name: Schema.NullOr(Schema.String),
})
export type User = typeof User.Type

export const Post = Schema.Struct({
  authorId: UserId,  // Automatically references User's branded ID
  content: Schema.NullOr(Schema.String),
  id: PostId,
  published: Schema.Boolean,
  title: Schema.String,
})
export type Post = typeof Post.Type
```

## Configuration Options

All options are configured in your `schema.prisma`:

```prisma
generator effectSchema {
  provider = "prisma-effect-schema"
  output   = "./generated/schemas.ts"

  // Generate branded ID types (UserId, PostId, etc.)
  // Default: true
  useBrandedIds = "true"

  // Include relation fields (uses Schema.suspend for circular refs)
  // When true, generates both `Model` and `ModelWithRelations` schemas
  // Default: false
  includeRelations = "true"

  // How to handle DateTime fields
  // - "Date": Schema.Date (for Prisma results - Date objects)
  // - "DateTimeString": Schema.DateTimeUtc (for API validation - ISO strings)
  // Default: "Date"
  dateTimeHandling = "Date"

  // Sort fields alphabetically for deterministic output
  // Default: true
  sortFields = "true"

  // Custom header for the generated file (replaces default header)
  // customHeader = "// My custom header\nimport { Schema } from 'effect'"
}
```

### Option Details

#### `useBrandedIds`

When enabled (default), generates branded ID types for models with String primary keys:

```typescript
// With useBrandedIds = true
export const UserId = Schema.String.pipe(Schema.brand("UserId"))
export const User = Schema.Struct({
  id: UserId,  // Branded type
  // ...
})

// With useBrandedIds = false
export const User = Schema.Struct({
  id: Schema.String,  // Plain string
  // ...
})
```

The branded ID name uses the primary key field name:
- `User.id` (String @id) -> `UserId`
- `Course.slug` (String @id) -> `CourseSlug`

Foreign keys automatically reference their target model's branded ID:

```typescript
export const Post = Schema.Struct({
  authorId: UserId,  // Automatically uses UserId, not plain String
  // ...
})
```

#### `includeRelations`

When enabled, generates additional `*WithRelations` schemas:

```typescript
// Base schema (always generated)
export const Post = Schema.Struct({
  id: PostId,
  title: Schema.String,
  authorId: UserId,
})

// With relations (only when includeRelations = true)
export const PostWithRelations = Schema.Struct({
  id: PostId,
  title: Schema.String,
  authorId: UserId,
  author: Schema.suspend(() => User),  // Handles circular refs
})
```

#### `dateTimeHandling`

Choose how DateTime fields are handled:

```typescript
// dateTimeHandling = "Date" (default)
// For validating Prisma query results (Date objects)
createdAt: Schema.Date

// dateTimeHandling = "DateTimeString"
// For validating API input (ISO 8601 strings)
createdAt: Schema.DateTimeUtc
```

## Type Mapping

| Prisma Type    | Effect Schema                 | Notes                           |
| -------------- | ----------------------------- | ------------------------------- |
| `String`       | `Schema.String`               | Or branded ID if PK/FK          |
| `Int`          | `Schema.Int`                  |                                 |
| `Float`        | `Schema.Number`               |                                 |
| `Boolean`      | `Schema.Boolean`              |                                 |
| `DateTime`     | `Schema.Date`                 | Or `Schema.DateTimeUtc`         |
| `Json`         | `JsonValueSchema`             | Recursive schema for JSON       |
| `Bytes`        | `Schema.Uint8Array`           |                                 |
| `BigInt`       | `Schema.BigInt`               |                                 |
| `Decimal`      | `Schema.Decimal`              |                                 |
| `Enum`         | `Schema.Literal(...)`         | All values as union             |
| Optional (`?`) | `Schema.NullOr(...)`          | Wraps the inner type            |
| List (`[]`)    | `Schema.Array(...)`           | Wraps the inner type            |

## Advanced Usage

### Enums

Prisma enums are converted to `Schema.Literal` unions:

```prisma
enum PostStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}
```

Generates:

```typescript
export const PostStatus = Schema.Literal("ARCHIVED", "DRAFT", "PUBLISHED")
export type PostStatus = typeof PostStatus.Type
```

### JSON Fields

JSON fields use a recursive schema that matches Prisma's `JsonValue` type:

```typescript
type JsonValue = string | number | boolean | null | JsonArray | JsonObject
type JsonArray = ReadonlyArray<JsonValue>
type JsonObject = { readonly [key: string]: JsonValue }

const JsonValueSchema: Schema.Schema<JsonValue> = Schema.suspend(
  (): Schema.Schema<JsonValue> =>
    Schema.Union(
      Schema.Null,
      Schema.Boolean,
      Schema.Number,
      Schema.String,
      Schema.Array(JsonValueSchema),
      Schema.Record({ key: Schema.String, value: JsonValueSchema })
    )
)
```

### Transforming for API Input

The generated schemas use `Schema.Date` by default, matching Prisma's output. For API input validation where dates come as ISO strings, you can either:

1. **Use `dateTimeHandling = "DateTimeString"`** to generate schemas that expect ISO strings

2. **Transform at the boundary**:

```typescript
import { Schema } from "effect";
import { User } from "./generated/schemas";

// For API input validation (dates as ISO strings)
const UserInput = Schema.Struct({
  ...User.fields,
  createdAt: Schema.DateFromString,  // Accepts ISO string, returns Date
});
```

### Programmatic API

Use the generator programmatically for custom workflows:

```typescript
import { generate } from "prisma-effect-schema";
import { getDMMF } from "@prisma/internals";

const dmmf = await getDMMF({ datamodelPath: "./prisma/schema.prisma" });

const { content, stats } = generate({
  dmmf,
  config: {
    useBrandedIds: true,
    includeRelations: false,
    dateTimeHandling: "Date",
    sortFields: true,
    customHeader: null,
  },
});

console.log(`Generated ${stats.modelCount} models, ${stats.enumCount} enums`);
```

## Requirements

- Node.js >= 18
- Prisma >= 6.0
- Effect >= 3.0

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

```bash
# Clone the repository
git clone https://github.com/frontcore/prisma-effect-schema.git

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build
```

## License

[MIT](LICENSE) - Frontcore
