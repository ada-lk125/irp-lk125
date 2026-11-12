import { sql } from "drizzle-orm";
import { boolean, index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isAdmin: boolean("is_admin").notNull().default(false),
  adminRole: varchar("admin_role"),
  role: varchar("role").notNull().default("founder"),
  // Additive EIR permission — independent of the base role. A user can be
  // both an admin/superadmin/founder AND an EIR. Toggling this flag does not
  // change the user's base role.
  isEir: boolean("is_eir").notNull().default(false),
  termsAcceptedAt: timestamp("terms_accepted_at"),
  privacyAcceptedAt: timestamp("privacy_accepted_at"),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
  // Set when the founder chooses "Skip for now" at the EIR booking step
  // instead of requesting a 1:1 session. Used so we don't keep nudging them
  // toward the booking CTA after they've explicitly declined once.
  onboardingSkippedBookingAt: timestamp("onboarding_skipped_booking_at"),
  onboardingState: jsonb("onboarding_state").$type<{
    step: "welcome" | "intro" | "walkthrough" | "results";
    moduleId?: number;
    levelNumber?: number;
    coachmarkDismissed?: boolean;
    // moduleIds for which we've already auto-expanded the first inline-tool
    // item on level 1. Subsequent visits to that level render it collapsed.
    toolExpandedModuleIds?: number[];
  } | null>(),
  // EIR profile fields (only meaningful when isEir === true)
  eirPhotoUrl: varchar("eir_photo_url"),
  eirBio: varchar("eir_bio"),
  eirCalendarUrl: varchar("eir_calendar_url"),
  // Records whether the user has seen the "Foundation → Mastermind" celebration
  // on the My Journey page (string of last seen sprintId per startup), kept
  // simple as jsonb so we don't add yet another table for a one-off modal.
  journeyState: jsonb("journey_state").$type<{
    foundationCelebrationSeenForStartupIds?: number[];
  } | null>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
