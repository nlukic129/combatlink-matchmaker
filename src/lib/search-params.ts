import { z } from "zod";

export const coercedOptionalNumber = z.coerce.number().optional();

export const coercedPage = z.coerce.number().default(1);

export const coercedOptionalNumberArray = z
  .union([z.array(z.coerce.number()), z.coerce.number()])
  .transform((value): number[] => (Array.isArray(value) ? value : [value]))
  .optional();

export const coercedOptionalStringArray = z
  .union([z.array(z.string()), z.string()])
  .transform((value): string[] => (Array.isArray(value) ? value : [value]))
  .optional();

/** Accepts repeated URL params, arrays, or comma-separated strings. */
export const coercedStringArray = z
  .union([z.array(z.string()), z.string()])
  .optional()
  .transform((value): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  });

export const coercedOptionalBoolean = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((value) => value === true || value === "true")
  .optional();
