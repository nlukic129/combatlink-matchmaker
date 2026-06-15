import { z } from "zod";
import {
  coercedOptionalBoolean,
  coercedOptionalNumber,
  coercedOptionalNumberArray,
  coercedOptionalStringArray,
  coercedPage,
} from "@/lib/search-params";

export const searchSchema = z.object({
  sport: z.string().optional(),
  gender: z.enum(["male", "female"]).optional(),
  weightClasses: coercedOptionalNumberArray,
  catchweightKg: coercedOptionalNumber,
  fighter: z.string().uuid().optional(),
  readyToFightOn: z.string().optional(),
  purseMin: coercedOptionalNumber,
  purseMax: coercedOptionalNumber,
  shortNotice: coercedOptionalBoolean,
  promotionalStatus: z.string().optional(),
  maxPrepWeeks: coercedOptionalNumber,
  level: z.enum(["amateur", "pro"]).optional(),
  minWins: coercedOptionalNumber,
  maxLosses: coercedOptionalNumber,
  maxTotalFights: coercedOptionalNumber,
  cityLat: coercedOptionalNumber,
  cityLng: coercedOptionalNumber,
  cityName: z.string().optional(),
  radiusKm: coercedOptionalNumber,
  countries: coercedOptionalStringArray,
  continent: z
    .enum(["africa", "asia", "europe", "north-america", "south-america", "oceania"])
    .optional(),
  fightStyles: coercedOptionalStringArray,
  stance: z.string().optional(),
  heightMinCm: coercedOptionalNumber,
  heightMaxCm: coercedOptionalNumber,
  reachMinCm: coercedOptionalNumber,
  reachMaxCm: coercedOptionalNumber,
  minInstagramFollowers: coercedOptionalNumber,
  nationalities: coercedOptionalStringArray,
  view: z.enum(["list", "map"]).optional().default("list"),
  page: coercedPage,
});

export type SearchFilters = z.infer<typeof searchSchema>;

export const searchSetupSchema = searchSchema.pick({
  sport: true,
  gender: true,
  weightClasses: true,
});

export type SearchSetupParams = z.infer<typeof searchSetupSchema>;
