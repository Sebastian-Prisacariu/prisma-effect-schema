# prisma-effect-schema

A Prisma generator that creates [Effect Schema](https://effect.website/docs/schema/introduction) definitions from your Prisma models.

## Features

- Generates Effect Schemas for all Prisma models and enums
- Creates branded ID types for type-safe entity references
- Handles all Prisma scalar types (String, Int, Float, Boolean, DateTime, Json, Bytes, BigInt, Decimal)
- Deterministic output (sorted fields/models) to minimize git diffs
- No timestamps in generated files to avoid unnecessary churn
- Configurable via Prisma schema

## Installation

```bash
npm install prisma-effect-schema
# or
pnpm add prisma-effect-schema
```

## Usage

Add the generator to your `schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

generator effectSchema {
  provider = "prisma-effect-schema"
  output   = "./generated/effect-schemas.ts"
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

Then run:

```bash
npx prisma generate
```

This will generate `effect-schemas.ts` with:

```typescript
import { Schema } from "effect";

// Branded IDs
export const UserId = Schema.String.pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;

export const PostId = Schema.String.pipe(Schema.brand("PostId"));
export type PostId = typeof PostId.Type;

// Models
export const User = Schema.Struct({
  id: UserId,
  email: Schema.String,
  name: Schema.NullOr(Schema.String),
  createdAt: Schema.Date,
});
export type User = typeof User.Type;

export const Post = Schema.Struct({
  id: PostId,
  title: Schema.String,
  content: Schema.NullOr(Schema.String),
  published: Schema.Boolean,
  authorId: UserId, // References User's branded ID
});
export type Post = typeof Post.Type;
```

## Configuration Options

```prisma
generator effectSchema {
  provider         = "prisma-effect-schema"
  output           = "./generated/effect-schemas.ts"

  // Include relation fields (uses Schema.suspend for circular refs)
  // Default: false
  includeRelations = "true"

  // Generate branded ID types (UserId, PostId, etc.)
  // Default: true
  useBrandedIds    = "true"

  // Sort fields alphabetically for deterministic output
  // Default: true
  sortFields       = "true"
}
```

## Type Mapping

| Prisma Type    | Effect Schema                 |
| -------------- | ----------------------------- |
| `String`       | `Schema.String`               |
| `Int`          | `Schema.Int`                  |
| `Float`        | `Schema.Number`               |
| `Boolean`      | `Schema.Boolean`              |
| `DateTime`     | `Schema.Date`                 |
| `Json`         | `JsonValueSchema` (recursive) |
| `Bytes`        | `Schema.Uint8Array`           |
| `BigInt`       | `Schema.BigInt`               |
| `Decimal`      | `Schema.String`               |
| `Enum`         | `Schema.Literal(...)`         |
| Optional (`?`) | `Schema.NullOr(...)`          |
| List (`[]`)    | `Schema.Array(...)`           |

## Date Handling

By default, the generator uses `Schema.Date` which expects JavaScript `Date` objects. This matches what Prisma returns from database queries.

If you're validating API input where dates come as ISO strings, you can compose the schema:

```typescript
import { Schema } from "effect";
import { User } from "./generated/effect-schemas";

// For API input validation
const UserInput = User.pipe(
  Schema.transform(User, {
    decode: (input) => ({
      ...input,
      createdAt: new Date(input.createdAt),
    }),
    encode: (user) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
    }),
  }),
);
```

## Programmatic API

You can also use the generator programmatically:

```typescript
import { generate, resolveConfig } from "prisma-effect-schema";
import { getDMMF } from "@prisma/sdk";

const dmmf = await getDMMF({ datamodelPath: "./prisma/schema.prisma" });
const config = resolveConfig({ useBrandedIds: true });

const { content, stats } = generate({ dmmf, config });
console.log(`Generated ${stats.modelCount} models`);
```

## License

MIT
