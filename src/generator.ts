/**
 * Prisma Generator Handler
 *
 * This module registers the generator with Prisma and handles the generation lifecycle.
 */
import { FileSystem } from "@effect/platform";
import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { Path } from "@effect/platform/Path";
import type { GeneratorOptions } from "@prisma/generator-helper";
import { generatorHandler } from "@prisma/generator-helper";
import { Effect, Layer, Option } from "effect";
import { parseConfig } from "./config.js";
import { NoOutputConfiguredError } from "./errors.js";
import { generate } from "./generate.js";



const program = Effect.fnUntraced(function* (options: GeneratorOptions) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path;

  const outputPath = yield* Effect.fromNullable(
    options.generator.output?.value
  ).pipe(
    Effect.mapError(
      ({ cause, message, ...rest }) =>
        new NoOutputConfiguredError({
          cause,
          details: message,
          ...rest,
        })
    )
  );

  const config = yield* parseConfig(options);

  const { content, stats } = generate({
    dmmf: options.dmmf,
    config,
  });

  // Ensure output directory exists
  yield* fs.makeDirectory(path.dirname(outputPath), { recursive: true });

  // Write the generated file
  yield* fs.writeFileString(outputPath, content);

  yield* Effect.logInfo(`✅ prisma-effect-schema: Generated Effect Schemas`);
  yield* Effect.logInfo(`   Output: ${outputPath}`);
  yield* Effect.logInfo(
    `   Stats: ${stats.enumCount} enums, ${stats.modelCount} models, ${stats.brandedIdCount} branded IDs`
  );
})
const PlatformLive = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);



// Register as Prisma generator
generatorHandler({
  onManifest() {
    return {
      defaultOutput: "./generated/effect-schemas.ts",
      prettyName: "Effect Schema Generator",
      // No requiresGenerators - we only need the DMMF which is always available
      // ?? explain
    };
  },
  onGenerate: (options: GeneratorOptions) => program(options).pipe(
    Effect.provide(PlatformLive),
    Effect.runPromise
  ),
});
