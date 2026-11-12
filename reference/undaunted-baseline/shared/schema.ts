import { pgTable, text, serial, integer, boolean, timestamp, jsonb, uuid, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export * from "./models/auth";
export * from "./models/chat";

// --- CMS / Content Tables ---

export const modules = pgTable("modules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kthDimension: text("kth_dimension").notNull(), // e.g., "CRL", "TRL"
  description: text("description").notNull(),
  icon: text("icon").notNull(), // Lucide icon name
  color: text("color").notNull(), // Hex or tailwind class
  displayOrder: integer("display_order").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const levels = pgTable("levels", {
  id: serial("id").primaryKey(),
  moduleId: integer("module_id").notNull(),
  levelNumber: integer("level_number").notNull(), // 1-9
  title: text("title").notNull(),
  description: text("description").notNull(),
  phaseLabel: text("phase_label").notNull(), // Idea, Discovery, etc.
  videoUrl: text("video_url"),
  learningContent: text("learning_content"),
  furtherReadingLinks: jsonb("further_reading_links").$type<Array<{ title: string; url: string }>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const toolTemplates = pgTable("tool_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  toolType: text("tool_type").notNull(), // canvas, card, matrix, text
  fieldDefinitions: jsonb("field_definitions").notNull(), // Array of field configs
  layoutConfig: jsonb("layout_config"), // Grid/layout settings
  isHidden: boolean("is_hidden").notNull().default(false),
  visibilityOverride: boolean("visibility_override").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const checklistItems = pgTable("checklist_items", {
  id: serial("id").primaryKey(),
  levelId: integer("level_id").notNull(),
  label: text("label").notNull(),
  explanatoryContent: text("explanatory_content"), // Markdown/HTML
  displayOrder: integer("display_order").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Join table for tools attached to checklist items
export const checklistItemTools = pgTable("checklist_item_tools", {
  checklistItemId: integer("checklist_item_id").notNull(),
  toolTemplateId: integer("tool_template_id").notNull(),
}, (t) => [
  primaryKey({ columns: [t.checklistItemId, t.toolTemplateId] })
]);

// Join table for tools relevant to a level (shown on all items in that level)
export const levelTools = pgTable("level_tools", {
  levelId: integer("level_id").notNull(),
  toolTemplateId: integer("tool_template_id").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
}, (t) => [
  primaryKey({ columns: [t.levelId, t.toolTemplateId] })
]);

// --- User Data Tables ---

export const startups = pgTable("startups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  logoUrl: text("logo_url"),
  activeMilestoneId: text("active_goal_id"),
  enablingMilestoneIds: jsonb("enabling_milestone_ids").notNull().default([]),
  climateProblem: text("climate_problem"),
  solutionDescription: text("solution_description"),
  climateType: text("climate_type"),
  productType: text("product_type"),
  businessModel: text("business_model"),
  targetMarket: text("target_market"),
  competitors: text("competitors"),
  websiteUrl: text("website_url"),
  createdById: text("created_by_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  status: text("status").notNull().default("draft"),
  oneSentenceDescription: text("one_sentence_description"),
  ventureStatus: text("venture_status"),
  revenue: text("revenue"),
  climateSectors: jsonb("climate_sectors").default([]),
  impactMetrics: jsonb("impact_metrics").default({}),
  technologyCategories: jsonb("technology_categories").default([]),
  technologyDescription: text("technology_description"),
  trl: text("trl"),
  ipStatus: text("ip_status"),
  teamStrengths: text("team_strengths"),
  capTable: jsonb("cap_table").default([]),
  otherTeamMembers: jsonb("other_team_members").default([]),
  founderFirstName: text("founder_first_name"),
  founderLastName: text("founder_last_name"),
  founderEmail: text("founder_email"),
  founderPhone: text("founder_phone"),
  founderCommitment: text("founder_commitment"),
  foundersDream: text("founders_dream"),
  programmeFocus: text("programme_focus"),
  programmeGoals: text("programme_goals"),
  totalFundingRaised: text("total_funding_raised"),
  nonDilutiveFunding: text("non_dilutive_funding"),
  referralSource: text("referral_source"),
  submittedAt: text("submitted_at"),
  ukBased: text("uk_based"),
  country: text("country"),
  incorporated: text("incorporated"),
  crn: text("crn"),
  incorporationDate: text("incorporation_date"),
  incorporationPlans: text("incorporation_plans"),
  universitySpinout: text("university_spinout"),
  imperialConnection: text("imperial_connection"),
  imperialConnectionType: text("imperial_connection_type"),
  diversityInfo: jsonb("diversity_info").default({}),
  slideDeckUrl: text("slide_deck_url"),
  onlineDemoUrl: text("online_demo_url"),
  marketDemandEvidence: text("market_demand_evidence"),
  customerProblem: text("customer_problem"),
  problemImpact: text("problem_impact"),
  commercialAvailabilityPlan: text("commercial_availability_plan"),
  supportReceived: text("support_received"),
  previousProgrammes: text("previous_programmes"),
  greenhouseSupportBenefits: text("greenhouse_support_benefits"),
  programmeAppliedTo: text("programme_applied_to"),
  airtableRecordId: text("airtable_record_id"),
});

export const startupMembers = pgTable("startup_members", {
  id: serial("id").primaryKey(),
  startupId: integer("startup_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role").notNull().default("member"), // owner, member
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const checklistProgress = pgTable("checklist_progress", {
  id: serial("id").primaryKey(),
  startupId: integer("startup_id").notNull(),
  checklistItemId: integer("checklist_item_id").notNull(),
  completed: boolean("completed").default(false).notNull(),
  completedBy: text("completed_by").notNull(), // userId
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const toolEntries = pgTable("tool_entries", {
  id: serial("id").primaryKey(),
  startupId: integer("startup_id").notNull(),
  toolTemplateId: integer("tool_template_id").notNull(),
  currentData: jsonb("current_data").notNull(), // Filled-in values
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const toolEntryVersions = pgTable("tool_entry_versions", {
  id: serial("id").primaryKey(),
  toolEntryId: integer("tool_entry_id").notNull(),
  dataSnapshot: jsonb("data_snapshot").notNull(),
  savedBy: text("saved_by").notNull(),
  contextLevelId: integer("context_level_id"), // Which level they were on
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const startupTargets = pgTable("startup_targets", {
  id: serial("id").primaryKey(),
  startupId: integer("startup_id").notNull(),
  moduleId: integer("module_id").notNull(),
  targetLevel: integer("target_level").notNull(),
  setBy: text("set_by").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const milestoneGroups = pgTable("milestone_groups", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  stage: text("stage").notNull(), // "early", "validation", "growth", "ongoing"
  displayOrder: integer("display_order").notNull().default(0),
  accentColor: text("accent_color").notNull().default("purple"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const milestones = pgTable("milestones", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  tagline: text("tagline"),
  stage: text("stage").notNull(), // "early", "validation", "growth", "ongoing"
  icon: text("icon").notNull(),
  gradient: text("gradient").notNull(),
  accentColor: text("accent_color").notNull(),
  requirements: jsonb("requirements").notNull(), // Record<string, number> — dimension name to required level
  category: text("category").default("general"),
  dependencies: jsonb("dependencies").default([]), // number[] — IDs of prerequisite milestones
  groupId: integer("group_id"), // FK to milestone_groups.id
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const milestoneCategories = pgTable("milestone_categories", {
  id: serial("id").primaryKey(),
  value: text("value").notNull().unique(),
  label: text("label").notNull(),
  gradient: text("gradient").notNull(),
  accentColor: text("accent_color").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const milestoneStages = pgTable("milestone_stages", {
  id: serial("id").primaryKey(),
  value: text("value").notNull().unique(),
  label: text("label").notNull(),
  description: text("description").notNull().default(""),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const rewards = pgTable("rewards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull().default("custom"),
  icon: text("icon").notNull().default("Gift"),
  significance: text("significance").notNull().default("low"),
  accentColor: text("accent_color").notNull().default("purple"),
  requiredMissionIds: jsonb("required_mission_ids").notNull().default([]),
  requiredGroupIds: jsonb("required_group_ids").notNull().default([]),
  metadata: jsonb("metadata").default({}),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const missionCompletions = pgTable("mission_completions", {
  id: serial("id").primaryKey(),
  milestoneId: integer("milestone_id").notNull(),
  startupId: integer("startup_id").notNull(),
  status: text("status").notNull().default("incomplete"),
  scoresMetAt: timestamp("scores_met_at"),
  adminConfirmedAt: timestamp("admin_confirmed_at"),
  adminConfirmedBy: text("admin_confirmed_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const rewardUnlocks = pgTable("reward_unlocks", {
  id: serial("id").primaryKey(),
  rewardId: integer("reward_id").notNull(),
  startupId: integer("startup_id").notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
  submittedAt: timestamp("submitted_at"),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: text("reviewed_by"),
  reviewStatus: text("review_status").notNull().default("pending"),
  reviewNotes: text("review_notes"),
});

export const startupMissions = pgTable("startup_missions", {
  id: serial("id").primaryKey(),
  startupId: integer("startup_id").notNull(),
  milestoneId: integer("milestone_id").notNull(),
  assignedBy: text("assigned_by"),
  assignedAt: timestamp("assigned_at").defaultNow(),
});

export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const startupModuleAccess = pgTable("startup_module_access", {
  id: serial("id").primaryKey(),
  startupId: integer("startup_id").notNull(),
  moduleId: integer("module_id").notNull(),
  grantedAt: timestamp("granted_at").defaultNow(),
  grantedBy: text("granted_by"),
});

export const matchFeedback = pgTable("match_feedback", {
  id: serial("id").primaryKey(),
  investorAirtableId: text("investor_airtable_id").notNull(),
  investorName: text("investor_name"),
  fundingRoundAirtableId: text("funding_round_airtable_id").notNull(),
  startupName: text("startup_name"),
  startupId: integer("startup_id"),
  rating: text("rating").notNull(),
  reason: text("reason"),
  totalScore: integer("total_score"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const feedbackInsights = pgTable("feedback_insights", {
  id: serial("id").primaryKey(),
  generatedAt: timestamp("generated_at").defaultNow(),
  insights: jsonb("insights").notNull(),
  feedbackCount: integer("feedback_count").notNull(),
  generatedBy: text("generated_by"),
});

export const matchResults = pgTable("match_results", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  startupId: integer("startup_id"),
  fundingRoundAirtableId: text("funding_round_airtable_id"),
  formValues: jsonb("form_values").notNull(),
  matches: jsonb("matches").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const introductionRequests = pgTable("introduction_requests", {
  id: serial("id").primaryKey(),
  startupId: integer("startup_id"),
  userId: text("user_id").notNull(),
  fundingRoundData: jsonb("funding_round_data").notNull(),
  startupData: jsonb("startup_data").notNull(),
  status: text("status").notNull().default("pending_review"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const introductionItems = pgTable("introduction_items", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  investorAirtableId: text("investor_airtable_id").notNull(),
  investorName: text("investor_name").notNull(),
  investorEmail: text("investor_email"),
  status: text("status").notNull().default("pending"),
  adminNote: text("admin_note"),
  adminUserId: text("admin_user_id"),
  responseToken: text("response_token"),
  matchScore: integer("match_score"),
  contactPersonId: text("contact_person_id"),
  contactPersonName: text("contact_person_name"),
  airtableRecordId: text("airtable_record_id"),
  deckViewToken: text("deck_view_token"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const deckViews = pgTable("deck_views", {
  id: serial("id").primaryKey(),
  introductionItemId: integer("introduction_item_id").notNull().references(() => introductionItems.id, { onDelete: "cascade" }),
  viewedAt: timestamp("viewed_at").defaultNow(),
  viewerIp: text("viewer_ip"),
  userAgent: text("user_agent"),
});

export const introductionItemVotes = pgTable("introduction_item_votes", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => introductionItems.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  vote: text("vote").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("introduction_item_votes_item_user_idx").on(table.itemId, table.userId),
]);

// --- Programme / Multi-tenancy Tables ---

export const programmes = pgTable("programmes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdById: text("created_by_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const programmeFeatures = pgTable("programme_features", {
  id: serial("id").primaryKey(),
  programmeId: integer("programme_id").notNull(),
  featureKey: text("feature_key").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  grantedAt: timestamp("granted_at").defaultNow(),
});

export const programmeStartups = pgTable("programme_startups", {
  id: serial("id").primaryKey(),
  programmeId: integer("programme_id").notNull(),
  startupId: integer("startup_id").notNull(),
  addedAt: timestamp("added_at").defaultNow(),
});

export const programmeAdmins = pgTable("programme_admins", {
  id: serial("id").primaryKey(),
  programmeId: integer("programme_id").notNull(),
  userId: text("user_id").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
});

export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  // startupId/programmeId are nullable to support role-only invitations
  // (e.g. EIRs, who don't belong to a specific startup or programme).
  startupId: integer("startup_id"),
  programmeId: integer("programme_id"),
  token: text("token").notNull().unique(),
  invitedById: text("invited_by_id").notNull(),
  status: text("status").notNull().default("pending"),
  // Optional role to assign on acceptance (e.g. "eir"). Defaults to founder
  // behaviour (no role change beyond the existing upsert default).
  role: text("role"),
  pendingProfile: jsonb("pending_profile"),
  // For role: "eir" invitations, an admin can pre-assign the invitee to one
  // or more groups. These are materialised into `eir_group_assignments` rows
  // when the user accepts the invitation (see handleInvitationOnLogin).
  pendingEirGroupIds: jsonb("pending_eir_group_ids").$type<number[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
});

// --- Cohorts, Groups & EIR Tables ---

export const cohorts = pgTable("cohorts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  programmeId: integer("programme_id").notNull(),
  description: text("description"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: text("created_by"),
});

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cohortId: integer("cohort_id").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: text("created_by"),
});

export const startupCohorts = pgTable("startup_cohorts", {
  id: serial("id").primaryKey(),
  startupId: integer("startup_id").notNull(),
  cohortId: integer("cohort_id").notNull(),
  addedAt: timestamp("added_at").defaultNow(),
});

export const startupGroups = pgTable("startup_groups", {
  id: serial("id").primaryKey(),
  startupId: integer("startup_id").notNull(),
  groupId: integer("group_id").notNull(),
  addedAt: timestamp("added_at").defaultNow(),
});

export const eirGroupAssignments = pgTable("eir_group_assignments", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  groupId: integer("group_id").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: text("assigned_by"),
});

// EIR 1:1 session requests, created when a founder taps "Book my session"
// at the end of onboarding (or, in future, from anywhere in the app). We
// don't run our own slot picker — the founder is handed off to the EIR's
// existing calendar URL — but persisting the request gives admins and the
// EIR visibility, lets us close the loop later, and powers the
// "session_requested" Hook Model investment event.
export const eirSessionRequests = pgTable("eir_session_requests", {
  id: serial("id").primaryKey(),
  founderUserId: text("founder_user_id").notNull(),
  startupId: integer("startup_id"),
  // Nullable — if no EIR is currently assigned to any of the founder's
  // groups, we still record the request so an admin can pick it up.
  eirUserId: text("eir_user_id"),
  // pending | scheduled | cancelled | completed
  status: text("status").notNull().default("pending"),
  // Where the request was triggered from (e.g. "onboarding"). Useful for
  // attribution but not load-bearing.
  source: text("source").notNull().default("onboarding"),
  notes: text("notes"),
  scheduledFor: timestamp("scheduled_for"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const assumptions = pgTable("assumptions", {
  id: serial("id").primaryKey(),
  startupId: integer("startup_id").notNull(),
  hypothesis: text("hypothesis").notNull(),
  source: text("source"),
  dimension: text("dimension"),
  confidence: integer("confidence").notNull().default(50),
  impactIfWrong: integer("impact_if_wrong").notNull().default(5),
  stage: text("stage").notNull().default("belief"),
  turnDecision: text("turn_decision"),
  suggestedDecision: text("suggested_decision"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const experiments = pgTable("experiments", {
  id: serial("id").primaryKey(),
  assumptionId: integer("assumption_id").notNull(),
  name: text("name").notNull(),
  technique: text("technique").notNull(),
  hypothesisIf: text("hypothesis_if"),
  hypothesisThen: text("hypothesis_then"),
  hypothesisBecause: text("hypothesis_because"),
  successMetric: text("success_metric"),
  estimatedCost: text("estimated_cost"),
  duration: text("duration"),
  sampleSize: text("sample_size"),
  preCommitAnswer: text("pre_commit_answer"),
  actualMetricValue: text("actual_metric_value"),
  actualOutcomeNotes: text("actual_outcome_notes"),
  deadline: timestamp("deadline").notNull(),
  launchedAt: timestamp("launched_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const readinessSnapshots = pgTable("readiness_snapshots", {
  id: serial("id").primaryKey(),
  startupId: integer("startup_id").notNull(),
  levels: jsonb("levels").notNull(), // Record<string, number> — dimension name to achieved level
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Sprints (My Journey) ---
// A sprint is a programme-defined time-boxed unit, ordered within a phase.
// Foundation sprints carry a `dimension` (one of CRL/TRL/BRL/IPRL/TMRL/FRL/CIRL);
// Mastermind sprints leave `dimension` null and share an icon/colour.
export const sprints = pgTable("sprints", {
  id: serial("id").primaryKey(),
  programmeId: integer("programme_id").notNull(),
  phaseKey: text("phase_key").notNull(), // 'foundation' | 'mastermind'
  orderIndex: integer("order_index").notNull(),
  dimension: text("dimension"), // KTH dimension key, nullable for mastermind
  label: text("label").notNull(),
  durationWeeks: integer("duration_weeks").notNull().default(2),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("sprints_programme_phase_order_idx").on(table.programmeId, table.phaseKey, table.orderIndex),
]);

// One active mission per startup per sprint. The same milestone can be chosen
// across sprints (e.g. carried over), but only one row may exist for any
// (startupId, sprintId) pair.
export const sprintMissions = pgTable("sprint_missions", {
  id: serial("id").primaryKey(),
  startupId: integer("startup_id").notNull(),
  sprintId: integer("sprint_id").notNull(),
  missionId: integer("mission_id").notNull(),
  chosenAt: timestamp("chosen_at").defaultNow(),
  chosenBy: text("chosen_by").notNull(),
  confidence: integer("confidence").notNull().default(5),
  rationale: text("rationale"),
  status: text("status").notNull().default("proposed"), // proposed | confirmed | completed | missed | carried_over
  confirmedAt: timestamp("confirmed_at"),
  confirmedBy: text("confirmed_by"),
}, (table) => [
  uniqueIndex("sprint_missions_startup_sprint_idx").on(table.startupId, table.sprintId),
]);

// KPIs are an always-on layer separate from the historic `impact_metrics`
// jsonb blob on startups. Three default commercial KPIs are seeded on first
// visit to `/journey`.
export const kpis = pgTable("kpis", {
  id: serial("id").primaryKey(),
  startupId: integer("startup_id").notNull(),
  name: text("name").notNull(),
  unit: text("unit").notNull().default(""),
  target: text("target"),
  currentValue: text("current_value").notNull().default("0"),
  isDefault: boolean("is_default").notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tracks completion of the built-in "Review {dimension} readiness level" default
// mission for each foundation sprint. Synthesised by the server when serving
// sprint data; no row in `missions` is created. Unique on (startupId, sprintId).
export const sprintDefaultMissionCompletions = pgTable("sprint_default_mission_completions", {
  id: serial("id").primaryKey(),
  startupId: integer("startup_id").notNull(),
  sprintId: integer("sprint_id").notNull(),
  completedBy: text("completed_by").notNull(),
  completedAt: timestamp("completed_at").defaultNow(),
}, (table) => [
  uniqueIndex("sdmc_startup_sprint_idx").on(table.startupId, table.sprintId),
]);

export type SprintDefaultMissionCompletion = typeof sprintDefaultMissionCompletions.$inferSelect;

export const kpiSnapshots = pgTable("kpi_snapshots", {
  id: serial("id").primaryKey(),
  kpiId: integer("kpi_id").notNull(),
  value: text("value").notNull(),
  recordedAt: timestamp("recorded_at").defaultNow(),
  recordedAtMilestone: text("recorded_at_milestone").notNull().default("manual"), // sprint_start | sprint_end | monthly | manual
  sprintId: integer("sprint_id"),
});

export const sprintsRelations = relations(sprints, ({ one, many }) => ({
  programme: one(programmes, {
    fields: [sprints.programmeId],
    references: [programmes.id],
  }),
  missions: many(sprintMissions),
}));

export const sprintMissionsRelations = relations(sprintMissions, ({ one }) => ({
  sprint: one(sprints, {
    fields: [sprintMissions.sprintId],
    references: [sprints.id],
  }),
  startup: one(startups, {
    fields: [sprintMissions.startupId],
    references: [startups.id],
  }),
}));

export const kpisRelations = relations(kpis, ({ one, many }) => ({
  startup: one(startups, {
    fields: [kpis.startupId],
    references: [startups.id],
  }),
  snapshots: many(kpiSnapshots),
}));

export const kpiSnapshotsRelations = relations(kpiSnapshots, ({ one }) => ({
  kpi: one(kpis, {
    fields: [kpiSnapshots.kpiId],
    references: [kpis.id],
  }),
}));

export const changelogEntries = pgTable("changelog_entries", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  reason: text("reason"),
  category: text("category").notNull().default("new_feature"),
  publishedAt: timestamp("published_at").notNull().defaultNow(),
  isPublished: boolean("is_published").notNull().default(true),
  source: jsonb("source").$type<{ type: "auto" | "manual"; commitSha?: string; taskRef?: string }>().notNull().default({ type: "manual" }),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertChangelogEntrySchema = createInsertSchema(changelogEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertChangelogEntry = z.infer<typeof insertChangelogEntrySchema>;
export type ChangelogEntry = typeof changelogEntries.$inferSelect;

export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  startupId: integer("startup_id").notNull(),
  userId: text("user_id").notNull(),
  actionType: text("action_type").notNull(), // checklist_completed, tool_updated, etc.
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Relations ---

export const modulesRelations = relations(modules, ({ many }) => ({
  levels: many(levels),
}));

export const levelsRelations = relations(levels, ({ one, many }) => ({
  module: one(modules, {
    fields: [levels.moduleId],
    references: [modules.id],
  }),
  checklistItems: many(checklistItems),
  tools: many(levelTools),
}));

export const levelToolsRelations = relations(levelTools, ({ one }) => ({
  level: one(levels, {
    fields: [levelTools.levelId],
    references: [levels.id],
  }),
  toolTemplate: one(toolTemplates, {
    fields: [levelTools.toolTemplateId],
    references: [toolTemplates.id],
  }),
}));

export const checklistItemsRelations = relations(checklistItems, ({ one, many }) => ({
  level: one(levels, {
    fields: [checklistItems.levelId],
    references: [levels.id],
  }),
  tools: many(checklistItemTools),
}));

export const checklistItemToolsRelations = relations(checklistItemTools, ({ one }) => ({
  checklistItem: one(checklistItems, {
    fields: [checklistItemTools.checklistItemId],
    references: [checklistItems.id],
  }),
  toolTemplate: one(toolTemplates, {
    fields: [checklistItemTools.toolTemplateId],
    references: [toolTemplates.id],
  }),
}));

export const startupTargetsRelations = relations(startupTargets, ({ one }) => ({
  startup: one(startups, {
    fields: [startupTargets.startupId],
    references: [startups.id],
  }),
  module: one(modules, {
    fields: [startupTargets.moduleId],
    references: [modules.id],
  }),
}));

export const startupModuleAccessRelations = relations(startupModuleAccess, ({ one }) => ({
  startup: one(startups, {
    fields: [startupModuleAccess.startupId],
    references: [startups.id],
  }),
  module: one(modules, {
    fields: [startupModuleAccess.moduleId],
    references: [modules.id],
  }),
}));

export const introductionRequestsRelations = relations(introductionRequests, ({ many }) => ({
  items: many(introductionItems),
}));

export const introductionItemsRelations = relations(introductionItems, ({ one }) => ({
  request: one(introductionRequests, {
    fields: [introductionItems.requestId],
    references: [introductionRequests.id],
  }),
}));

export const matchFeedbackRelations = relations(matchFeedback, ({ one }) => ({
  startup: one(startups, {
    fields: [matchFeedback.startupId],
    references: [startups.id],
  }),
}));

export const programmesRelations = relations(programmes, ({ many }) => ({
  features: many(programmeFeatures),
  startups: many(programmeStartups),
  admins: many(programmeAdmins),
  invitations: many(invitations),
}));

export const programmeFeaturesRelations = relations(programmeFeatures, ({ one }) => ({
  programme: one(programmes, {
    fields: [programmeFeatures.programmeId],
    references: [programmes.id],
  }),
}));

export const programmeStartupsRelations = relations(programmeStartups, ({ one }) => ({
  programme: one(programmes, {
    fields: [programmeStartups.programmeId],
    references: [programmes.id],
  }),
  startup: one(startups, {
    fields: [programmeStartups.startupId],
    references: [startups.id],
  }),
}));

export const programmeAdminsRelations = relations(programmeAdmins, ({ one }) => ({
  programme: one(programmes, {
    fields: [programmeAdmins.programmeId],
    references: [programmes.id],
  }),
  user: one(users, {
    fields: [programmeAdmins.userId],
    references: [users.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  startup: one(startups, {
    fields: [invitations.startupId],
    references: [startups.id],
  }),
  programme: one(programmes, {
    fields: [invitations.programmeId],
    references: [programmes.id],
  }),
}));

export const cohortsRelations = relations(cohorts, ({ one, many }) => ({
  programme: one(programmes, {
    fields: [cohorts.programmeId],
    references: [programmes.id],
  }),
  groups: many(groups),
  startupCohorts: many(startupCohorts),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  cohort: one(cohorts, {
    fields: [groups.cohortId],
    references: [cohorts.id],
  }),
  startupGroups: many(startupGroups),
  eirAssignments: many(eirGroupAssignments),
}));

export const startupCohortsRelations = relations(startupCohorts, ({ one }) => ({
  startup: one(startups, {
    fields: [startupCohorts.startupId],
    references: [startups.id],
  }),
  cohort: one(cohorts, {
    fields: [startupCohorts.cohortId],
    references: [cohorts.id],
  }),
}));

export const startupGroupsRelations = relations(startupGroups, ({ one }) => ({
  startup: one(startups, {
    fields: [startupGroups.startupId],
    references: [startups.id],
  }),
  group: one(groups, {
    fields: [startupGroups.groupId],
    references: [groups.id],
  }),
}));

export const eirGroupAssignmentsRelations = relations(eirGroupAssignments, ({ one }) => ({
  user: one(users, {
    fields: [eirGroupAssignments.userId],
    references: [users.id],
  }),
  group: one(groups, {
    fields: [eirGroupAssignments.groupId],
    references: [groups.id],
  }),
}));

// --- Inline Tool Configs (data-driven inline tools) ---

export const inlineToolConfigs = pgTable("inline_tool_configs", {
  id: serial("id").primaryKey(),
  checklistItemId: integer("checklist_item_id").notNull(),
  stableKey: text("stable_key").notNull(),
  layoutType: text("layout_type").notNull(),
  title: text("title").notNull(),
  icon: text("icon").notNull(),
  fieldDefinitions: jsonb("field_definitions").notNull().$type<Array<{
    key: string;
    label: string;
    type: string;
    placeholder?: string;
    options?: string[];
    optionsFromTool?: { toolTemplateId: number; dataKey: string; field: string };
    optionsFromApi?: string;
    allowCustom?: boolean;
    widthHint?: string;
    required?: boolean;
    formula?: string;
    readOnly?: boolean;
    ref?: string;
    displayLabel?: string;
    quickAdd?: boolean;
  }>>(),
  templateSentence: text("template_sentence"),
  isKeyAssumption: boolean("is_key_assumption").default(false),
  defaultRows: jsonb("default_rows").$type<Array<Record<string, any> & { _fixed?: boolean }>>(),
  toolTemplateId: integer("tool_template_id").notNull(),
  dataKey: text("data_key").notNull(),
  completenessType: text("completeness_type").notNull().default("list"),
  completenessFields: jsonb("completeness_fields").$type<string[]>(),
  minimumSubmissions: jsonb("minimum_submissions").$type<{ count: number; warningMessage: string } | null>(),
  runningTotals: jsonb("running_totals").$type<{ field: string; label: string; target?: number; formula?: string } | null>(),
  syncsToToolTemplateId: integer("syncs_to_tool_template_id"),
  syncsToLabel: text("syncs_to_label"),
  prePopulateFrom: jsonb("pre_populate_from").$type<{ toolTemplateId: number; dataKey: string; fieldMap: Record<string, string>; flattenKey?: string } | { toolTemplateId: number; dataKey: string; fieldMap: Record<string, string>; flattenKey?: string }[] | null>(),
  toolLevelFields: jsonb("tool_level_fields").$type<Array<{
    key: string;
    label: string;
    type: string;
    placeholder?: string;
    options?: string[];
    displayLabel?: string;
  }> | null>(),
  dataSyncRules: jsonb("data_sync_rules").$type<Array<{ targetField: string; sourceField: string; targetToolTemplateId: number; syncMode?: string }> | null>(),
  requiresPreviousComplete: boolean("requires_previous_complete").default(false),
  revisionOf: jsonb("revision_of").$type<{ dataKey: string; level: number } | null>(),
  revisionMode: text("revision_mode").$type<"revise" | "extend" | null>(),
  extensionFields: jsonb("extension_fields").$type<Array<{
    key: string;
    label: string;
    type: string;
    placeholder?: string;
    options?: string[];
    widthHint?: string;
    required?: boolean;
  }> | null>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const exampleCompanies = pgTable("example_companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  websiteUrl: text("website_url"),
  tagline: text("tagline"),
  displayColor: text("display_color").notNull().default("#10b981"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export function getLogoUrl(websiteUrl: string | null | undefined): string | null {
  if (!websiteUrl) return null;
  const domain = websiteUrl.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/[/?#].*$/, "");
  if (!domain) return null;
  const token = import.meta.env.VITE_LOGO_DEV_TOKEN;
  if (!token) return null;
  return `https://img.logo.dev/${domain}?token=${token}`;
}

export const toolExampleData = pgTable("tool_example_data", {
  id: serial("id").primaryKey(),
  inlineToolConfigId: integer("inline_tool_config_id").notNull(),
  exampleCompanyId: integer("example_company_id").notNull(),
  exampleData: jsonb("example_data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const inlineToolConfigsRelations = relations(inlineToolConfigs, ({ one, many }) => ({
  checklistItem: one(checklistItems, {
    fields: [inlineToolConfigs.checklistItemId],
    references: [checklistItems.id],
  }),
  toolTemplate: one(toolTemplates, {
    fields: [inlineToolConfigs.toolTemplateId],
    references: [toolTemplates.id],
  }),
  exampleData: many(toolExampleData),
}));

export const toolExampleDataRelations = relations(toolExampleData, ({ one }) => ({
  inlineToolConfig: one(inlineToolConfigs, {
    fields: [toolExampleData.inlineToolConfigId],
    references: [inlineToolConfigs.id],
  }),
  exampleCompany: one(exampleCompanies, {
    fields: [toolExampleData.exampleCompanyId],
    references: [exampleCompanies.id],
  }),
}));

export const startupsRelations = relations(startups, ({ many }) => ({
  members: many(startupMembers),
  checklistProgress: many(checklistProgress),
  toolEntries: many(toolEntries),
  activityLog: many(activityLog),
  targets: many(startupTargets),
  moduleAccess: many(startupModuleAccess),
  programmes: many(programmeStartups),
  cohorts: many(startupCohorts),
  groups: many(startupGroups),
}));

export const startupMembersRelations = relations(startupMembers, ({ one }) => ({
  startup: one(startups, {
    fields: [startupMembers.startupId],
    references: [startups.id],
  }),
  user: one(users, {
    fields: [startupMembers.userId],
    references: [users.id],
  }),
}));

export const checklistProgressRelations = relations(checklistProgress, ({ one }) => ({
  startup: one(startups, {
    fields: [checklistProgress.startupId],
    references: [startups.id],
  }),
  checklistItem: one(checklistItems, {
    fields: [checklistProgress.checklistItemId],
    references: [checklistItems.id],
  }),
  user: one(users, {
    fields: [checklistProgress.completedBy],
    references: [users.id],
  }),
}));

export const toolEntriesRelations = relations(toolEntries, ({ one, many }) => ({
  startup: one(startups, {
    fields: [toolEntries.startupId],
    references: [startups.id],
  }),
  toolTemplate: one(toolTemplates, {
    fields: [toolEntries.toolTemplateId],
    references: [toolTemplates.id],
  }),
  versions: many(toolEntryVersions),
}));

export const toolEntryVersionsRelations = relations(toolEntryVersions, ({ one }) => ({
  toolEntry: one(toolEntries, {
    fields: [toolEntryVersions.toolEntryId],
    references: [toolEntries.id],
  }),
  user: one(users, {
    fields: [toolEntryVersions.savedBy],
    references: [users.id],
  }),
  level: one(levels, {
    fields: [toolEntryVersions.contextLevelId],
    references: [levels.id],
  }),
}));

// --- Events ---

export const eventSeries = pgTable("event_series", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  organizerId: text("organizer_id").notNull(),
  locationType: text("location_type").notNull().default("virtual"), // "virtual" | "in_person"
  locationDetails: text("location_details"),
  wherebyEnabled: boolean("whereby_enabled").notNull().default(true),
  recordingEnabled: boolean("recording_enabled").notNull().default(true),
  transcriptionEnabled: boolean("transcription_enabled").notNull().default(true),
  rrule: text("rrule"), // RFC 5545 RRULE string, null = single event
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  status: text("status").notNull().default("scheduled"), // scheduled | cancelled
  coverImageUrl: text("cover_image_url"),
  // RFC 5545 SEQUENCE on the master series VEVENT — bumped on every series-level
  // edit/cancellation so calendar clients reconcile the latest version.
  sequence: integer("sequence").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  seriesId: integer("series_id").notNull(),
  // Original recurrence anchor (for RRULE RECURRENCE-ID); null for single-event series
  recurrenceAnchor: timestamp("recurrence_anchor"),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  // Per-occurrence overrides (null = inherit from series)
  titleOverride: text("title_override"),
  descriptionOverride: text("description_override"),
  locationTypeOverride: text("location_type_override"),
  locationDetailsOverride: text("location_details_override"),
  // Whereby
  wherebyMeetingId: text("whereby_meeting_id"),
  wherebyHostRoomUrl: text("whereby_host_room_url"),
  wherebyRoomUrl: text("whereby_room_url"),
  status: text("status").notNull().default("scheduled"), // scheduled | cancelled | completed
  isException: boolean("is_exception").notNull().default(false),
  // Per-occurrence SEQUENCE — bumped whenever this occurrence is edited or
  // cancelled, so RECURRENCE-ID exception VEVENTs reconcile correctly.
  sequence: integer("sequence").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Audience targeting on the series (resolved to users at send time)
export const eventAudiences = pgTable("event_audiences", {
  id: serial("id").primaryKey(),
  seriesId: integer("series_id").notNull(),
  audienceType: text("audience_type").notNull(), // "all" | "programme" | "cohort" | "group" | "startup" | "user"
  audienceId: text("audience_id"), // numeric for programme/cohort/group/startup, userId text for "user", null for "all"
});

export const eventRsvps = pgTable("event_rsvps", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  userId: text("user_id").notNull(),
  status: text("status").notNull(), // going | maybe | not_going
  respondedAt: timestamp("responded_at").defaultNow(),
}, (table) => [
  uniqueIndex("event_rsvps_event_user_idx").on(table.eventId, table.userId),
]);

export const eventRecordings = pgTable("event_recordings", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  wherebyRecordingId: text("whereby_recording_id"),
  recordingUrl: text("recording_url"),
  transcriptText: text("transcript_text"),
  summaryText: text("summary_text"),
  status: text("status").notNull().default("pending"), // pending | recording_ready | transcribed | summarized | failed
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Optional explicit link between an event series and one or more sprints.
// Sprint-linked events surface under the sprint in My Journey even when they
// fall outside the sprint's computed date window.
export const eventSeriesSprints = pgTable("event_series_sprints", {
  id: serial("id").primaryKey(),
  seriesId: integer("series_id").notNull(),
  sprintId: integer("sprint_id").notNull(),
}, (table) => [
  uniqueIndex("event_series_sprints_unique_idx").on(table.seriesId, table.sprintId),
]);

export const eventSeriesRelations = relations(eventSeries, ({ many }) => ({
  events: many(events),
  audiences: many(eventAudiences),
  sprints: many(eventSeriesSprints),
}));

export const eventSeriesSprintsRelations = relations(eventSeriesSprints, ({ one }) => ({
  series: one(eventSeries, { fields: [eventSeriesSprints.seriesId], references: [eventSeries.id] }),
  sprint: one(sprints, { fields: [eventSeriesSprints.sprintId], references: [sprints.id] }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  series: one(eventSeries, { fields: [events.seriesId], references: [eventSeries.id] }),
  rsvps: many(eventRsvps),
  recordings: many(eventRecordings),
}));

// --- Schemas ---

export const insertStartupSchema = createInsertSchema(startups).omit({ id: true, createdAt: true, updatedAt: true, createdById: true });
export const insertModuleSchema = createInsertSchema(modules).omit({ id: true, createdAt: true });
export const insertLevelSchema = createInsertSchema(levels).omit({ id: true, createdAt: true });
export const insertChecklistItemSchema = createInsertSchema(checklistItems).omit({ id: true, createdAt: true });
export const insertToolTemplateSchema = createInsertSchema(toolTemplates).omit({ id: true, createdAt: true });
export const insertMilestoneGroupSchema = createInsertSchema(milestoneGroups).omit({ id: true, createdAt: true });
export const insertMilestoneSchema = createInsertSchema(milestones).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMilestoneCategorySchema = createInsertSchema(milestoneCategories).omit({ id: true, createdAt: true });
export const insertMilestoneStageSchema = createInsertSchema(milestoneStages).omit({ id: true, createdAt: true });
export const insertRewardSchema = createInsertSchema(rewards).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMissionCompletionSchema = createInsertSchema(missionCompletions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRewardUnlockSchema = createInsertSchema(rewardUnlocks).omit({ id: true });
export const insertFeedbackInsightsSchema = createInsertSchema(feedbackInsights).omit({ id: true, generatedAt: true });
export const insertStartupModuleAccessSchema = createInsertSchema(startupModuleAccess).omit({ id: true, grantedAt: true });
export const insertMatchFeedbackSchema = createInsertSchema(matchFeedback).omit({ id: true, createdAt: true });
export const insertIntroductionRequestSchema = createInsertSchema(introductionRequests).omit({ id: true, createdAt: true });
export const insertIntroductionItemSchema = createInsertSchema(introductionItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIntroductionItemVoteSchema = createInsertSchema(introductionItemVotes).omit({ id: true, createdAt: true });
export const insertStartupMissionSchema = createInsertSchema(startupMissions).omit({ id: true, assignedAt: true });
export const insertProgrammeSchema = createInsertSchema(programmes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProgrammeFeatureSchema = createInsertSchema(programmeFeatures).omit({ id: true, grantedAt: true });
export const insertProgrammeStartupSchema = createInsertSchema(programmeStartups).omit({ id: true, addedAt: true });
export const insertProgrammeAdminSchema = createInsertSchema(programmeAdmins).omit({ id: true, assignedAt: true });
export const insertInvitationSchema = createInsertSchema(invitations).omit({ id: true, createdAt: true, acceptedAt: true });
export const insertCohortSchema = createInsertSchema(cohorts).omit({ id: true, createdAt: true });
export const insertGroupSchema = createInsertSchema(groups).omit({ id: true, createdAt: true });
export const insertStartupCohortSchema = createInsertSchema(startupCohorts).omit({ id: true, addedAt: true });
export const insertStartupGroupSchema = createInsertSchema(startupGroups).omit({ id: true, addedAt: true });
export const insertEirGroupAssignmentSchema = createInsertSchema(eirGroupAssignments).omit({ id: true, assignedAt: true });
export const insertEirSessionRequestSchema = createInsertSchema(eirSessionRequests).omit({ id: true, createdAt: true });
export const insertInlineToolConfigSchema = createInsertSchema(inlineToolConfigs).omit({ id: true, createdAt: true });
export const insertExampleCompanySchema = createInsertSchema(exampleCompanies).omit({ id: true, createdAt: true });
export const insertToolExampleDataSchema = createInsertSchema(toolExampleData).omit({ id: true, createdAt: true });
export const insertAssumptionSchema = createInsertSchema(assumptions).omit({ id: true, createdAt: true });
export const insertExperimentSchema = createInsertSchema(experiments).omit({ id: true, createdAt: true, launchedAt: true });
export const insertEventSeriesSchema = createInsertSchema(eventSeries).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEventAudienceSchema = createInsertSchema(eventAudiences).omit({ id: true });
export const insertEventRsvpSchema = createInsertSchema(eventRsvps).omit({ id: true, respondedAt: true });
export const insertEventRecordingSchema = createInsertSchema(eventRecordings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEventSeriesSprintSchema = createInsertSchema(eventSeriesSprints).omit({ id: true });
export const insertSprintSchema = createInsertSchema(sprints).omit({ id: true, createdAt: true });
export const insertSprintMissionSchema = createInsertSchema(sprintMissions).omit({ id: true, chosenAt: true });
export const insertKpiSchema = createInsertSchema(kpis).omit({ id: true, createdAt: true, updatedAt: true });
export const insertKpiSnapshotSchema = createInsertSchema(kpiSnapshots).omit({ id: true, recordedAt: true });

export type Module = typeof modules.$inferSelect;
export type Level = typeof levels.$inferSelect;
export type ChecklistItem = typeof checklistItems.$inferSelect;
export type ToolTemplate = typeof toolTemplates.$inferSelect;
export type Startup = typeof startups.$inferSelect;
export type ChecklistProgress = typeof checklistProgress.$inferSelect;
export type ToolEntry = typeof toolEntries.$inferSelect;
export type ToolEntryVersion = typeof toolEntryVersions.$inferSelect;
export type ActivityLog = typeof activityLog.$inferSelect;
export type StartupTarget = typeof startupTargets.$inferSelect;
export type ReadinessSnapshot = typeof readinessSnapshots.$inferSelect;
export type MilestoneGroup = typeof milestoneGroups.$inferSelect;
export type InsertMilestoneGroup = z.infer<typeof insertMilestoneGroupSchema>;
export type Milestone = typeof milestones.$inferSelect;
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type MilestoneCategory = typeof milestoneCategories.$inferSelect;
export type InsertMilestoneCategory = z.infer<typeof insertMilestoneCategorySchema>;
export type MilestoneStage = typeof milestoneStages.$inferSelect;
export type InsertMilestoneStage = z.infer<typeof insertMilestoneStageSchema>;
export type Reward = typeof rewards.$inferSelect;
export type InsertReward = z.infer<typeof insertRewardSchema>;
export type MissionCompletion = typeof missionCompletions.$inferSelect;
export type InsertMissionCompletion = z.infer<typeof insertMissionCompletionSchema>;
export type RewardUnlock = typeof rewardUnlocks.$inferSelect;
export type InsertRewardUnlock = z.infer<typeof insertRewardUnlockSchema>;

export type StartupMission = typeof startupMissions.$inferSelect;
export type InsertStartupMission = z.infer<typeof insertStartupMissionSchema>;
export type FeedbackInsight = typeof feedbackInsights.$inferSelect;
export type InsertFeedbackInsight = z.infer<typeof insertFeedbackInsightsSchema>;
export type StartupModuleAccess = typeof startupModuleAccess.$inferSelect;
export type InsertStartupModuleAccess = z.infer<typeof insertStartupModuleAccessSchema>;
export type MatchFeedback = typeof matchFeedback.$inferSelect;
export type InsertMatchFeedback = z.infer<typeof insertMatchFeedbackSchema>;
export type InsertStartup = z.infer<typeof insertStartupSchema>;
export type IntroductionRequest = typeof introductionRequests.$inferSelect;
export type InsertIntroductionRequest = z.infer<typeof insertIntroductionRequestSchema>;
export type IntroductionItem = typeof introductionItems.$inferSelect;
export type InsertIntroductionItem = z.infer<typeof insertIntroductionItemSchema>;
export type IntroductionItemVote = typeof introductionItemVotes.$inferSelect;
export type DeckView = typeof deckViews.$inferSelect;
export type InsertIntroductionItemVote = z.infer<typeof insertIntroductionItemVoteSchema>;
export type Programme = typeof programmes.$inferSelect;
export type InsertProgramme = z.infer<typeof insertProgrammeSchema>;
export type ProgrammeFeature = typeof programmeFeatures.$inferSelect;
export type InsertProgrammeFeature = z.infer<typeof insertProgrammeFeatureSchema>;
export type ProgrammeStartup = typeof programmeStartups.$inferSelect;
export type InsertProgrammeStartup = z.infer<typeof insertProgrammeStartupSchema>;
export type ProgrammeAdmin = typeof programmeAdmins.$inferSelect;
export type InsertProgrammeAdmin = z.infer<typeof insertProgrammeAdminSchema>;
export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Cohort = typeof cohorts.$inferSelect;
export type InsertCohort = z.infer<typeof insertCohortSchema>;
export type Group = typeof groups.$inferSelect;
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type StartupCohort = typeof startupCohorts.$inferSelect;
export type InsertStartupCohort = z.infer<typeof insertStartupCohortSchema>;
export type StartupGroup = typeof startupGroups.$inferSelect;
export type InsertStartupGroup = z.infer<typeof insertStartupGroupSchema>;
export type EirGroupAssignment = typeof eirGroupAssignments.$inferSelect;
export type EirSessionRequest = typeof eirSessionRequests.$inferSelect;
export type InsertEirSessionRequest = z.infer<typeof insertEirSessionRequestSchema>;
export type InsertEirGroupAssignment = z.infer<typeof insertEirGroupAssignmentSchema>;
export type InlineToolConfig = typeof inlineToolConfigs.$inferSelect;
export type InsertInlineToolConfig = z.infer<typeof insertInlineToolConfigSchema>;
export type ExampleCompany = typeof exampleCompanies.$inferSelect;
export type InsertExampleCompany = z.infer<typeof insertExampleCompanySchema>;
export type ToolExampleData = typeof toolExampleData.$inferSelect;
export type InsertToolExampleData = z.infer<typeof insertToolExampleDataSchema>;
export type Assumption = typeof assumptions.$inferSelect;
export type InsertAssumption = z.infer<typeof insertAssumptionSchema>;
export type Experiment = typeof experiments.$inferSelect;
export type InsertExperiment = z.infer<typeof insertExperimentSchema>;
export type EventSeries = typeof eventSeries.$inferSelect;
export type InsertEventSeries = z.infer<typeof insertEventSeriesSchema>;
export type EventOccurrence = typeof events.$inferSelect;
export type InsertEventOccurrence = z.infer<typeof insertEventSchema>;
export type EventAudience = typeof eventAudiences.$inferSelect;
export type InsertEventAudience = z.infer<typeof insertEventAudienceSchema>;
export type EventRsvp = typeof eventRsvps.$inferSelect;
export type InsertEventRsvp = z.infer<typeof insertEventRsvpSchema>;
export type EventRecording = typeof eventRecordings.$inferSelect;
export type InsertEventRecording = z.infer<typeof insertEventRecordingSchema>;
export type EventSeriesSprint = typeof eventSeriesSprints.$inferSelect;
export type InsertEventSeriesSprint = z.infer<typeof insertEventSeriesSprintSchema>;
export type Sprint = typeof sprints.$inferSelect;
export type InsertSprint = z.infer<typeof insertSprintSchema>;
export type SprintMission = typeof sprintMissions.$inferSelect;
export type InsertSprintMission = z.infer<typeof insertSprintMissionSchema>;
export type Kpi = typeof kpis.$inferSelect;
export type InsertKpi = z.infer<typeof insertKpiSchema>;
export type KpiSnapshot = typeof kpiSnapshots.$inferSelect;
export type InsertKpiSnapshot = z.infer<typeof insertKpiSnapshotSchema>;

export type EventWithSeries = EventOccurrence & {
  series: EventSeries;
  resolvedTitle: string;
  resolvedDescription: string | null;
  resolvedLocationType: string;
  resolvedLocationDetails: string | null;
};

export type AssumptionWithExperiments = Assumption & {
  experiments: Experiment[];
  computedStage: "belief" | "experiment" | "turn";
};

// API Types
export type ChecklistItemWithProgress = ChecklistItem & {
  completed: boolean;
};

export type LevelWithProgress = Level & {
  progress: number; // Percentage or count
  totalItems: number;
  completedItems: number;
};

export type ModuleWithProgress = Module & {
  currentLevel: number;
  completedLevels: number;
  progress: number;
};
