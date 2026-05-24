import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  doublePrecision,
  integer,
  jsonb,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

// ── Better Auth core tables ──

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Application tables ──

export const savedLocations = pgTable(
  "saved_locations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    // Reverse-geocoded locality stamped at create-time; nullable for legacy
    // rows and for failures of the geocoding upstream.
    region: varchar("region", { length: 100 }),
    // home | work | school | cottage | family | hobby | other (null for legacy).
    // Allowed-value enforcement lives in the service layer.
    category: varchar("category", { length: 32 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Each user can have at most one row each for home and work; other
    // categories are unconstrained. Partial index keeps storage minimal
    // and allows null/other categories to repeat freely.
    uniqueIndex("saved_locations_user_category_home_work_idx")
      .on(t.userId, t.category)
      .where(sql`${t.category} IN ('home', 'work')`),
  ],
);

export const recentPlaces = pgTable("recent_places", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  displayName: text("display_name").notNull(),
  visitCount: integer("visit_count").notNull().default(1),
  lastVisitedAt: timestamp("last_visited_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const preferences = pgTable("preferences", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  temperatureUnit: varchar("temperature_unit", { length: 20 })
    .notNull()
    .default("celsius"),
  distanceUnit: varchar("distance_unit", { length: 20 })
    .notNull()
    .default("metric"),
  language: varchar("language", { length: 10 }).notNull().default("en"),
  timeFormat: varchar("time_format", { length: 10 }).notNull().default("24h"),
  transitRegion: varchar("transit_region", { length: 20 })
    .notNull()
    .default("all"),
  theme: varchar("theme", { length: 20 }).notNull().default("system"),
  reduceMotion: varchar("reduce_motion", { length: 20 })
    .notNull()
    .default("system"),
  highContrast: boolean("high_contrast").notNull().default(false),
  // Percent — 100 = browser default; 200 = doubled. Decoupled from
  // browser zoom so users can scale text independently.
  fontScale: integer("font_scale").notNull().default(100),
  srOptimised: boolean("sr_optimised").notNull().default(false),
  // jsonb bag for shape-evolving extras: { persona?, layerDefaults? }.
  // Drizzle types this as `unknown`; the preferences repo wraps reads and
  // writes through parseExtra/serializeExtra so callers see a typed
  // PreferencesExtra.
  extra: jsonb("extra"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
