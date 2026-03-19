/**
 * Configuration options for the Effect Schema generator
 */
export interface GeneratorConfig {
  /**
   * Whether to include relation fields in the generated schemas.
   * Relations use Schema.suspend() for lazy evaluation to handle circular deps.
   * @default false
   */
  includeRelations?: boolean;

  /**
   * Whether to generate branded ID types for models with string IDs.
   * When true, generates `UserId`, `PostId`, etc. and uses them in model schemas.
   * @default true
   */
  useBrandedIds?: boolean;

  /**
   * How to handle DateTime fields.
   * - 'Date': Use Schema.Date (expects Date objects, for Prisma results)
   * - 'DateTimeString': Use Schema.Date with dateTime annotation (for API validation)
   * @default 'Date'
   */
  dateTimeHandling?: "Date" | "DateTimeString";

  /**
   * Whether to sort fields alphabetically for deterministic output.
   * @default true
   */
  sortFields?: boolean;

  /**
   * Custom header to prepend to the generated file.
   * If not provided, uses a default header without timestamps.
   */
  customHeader?: string;
}

/**
 * Resolved configuration with defaults applied
 */
export interface ResolvedConfig {
  includeRelations: boolean;
  useBrandedIds: boolean;
  dateTimeHandling: "Date" | "DateTimeString";
  sortFields: boolean;
  customHeader: string | null;
}

export const DEFAULT_CONFIG: ResolvedConfig = {
  includeRelations: false,
  useBrandedIds: true,
  dateTimeHandling: "Date",
  sortFields: true,
  customHeader: null,
};

export function resolveConfig(config: GeneratorConfig = {}): ResolvedConfig {
  return {
    includeRelations:
      config.includeRelations ?? DEFAULT_CONFIG.includeRelations,
    useBrandedIds: config.useBrandedIds ?? DEFAULT_CONFIG.useBrandedIds,
    dateTimeHandling:
      config.dateTimeHandling ?? DEFAULT_CONFIG.dateTimeHandling,
    sortFields: config.sortFields ?? DEFAULT_CONFIG.sortFields,
    customHeader: config.customHeader ?? DEFAULT_CONFIG.customHeader,
  };
}
