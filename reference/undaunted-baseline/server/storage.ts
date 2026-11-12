import { db } from "./db";
import { eq, and, or, gte, lte, desc, inArray, sql } from "drizzle-orm";
import { resolveLatestData } from "@shared/dataResolver";
import type { InlineToolConfigRef } from "@shared/dataResolver";
import {
  users,
  startups,
  startupMembers,
  modules,
  levels,
  checklistItems,
  checklistItemTools,
  levelTools,
  toolTemplates,
  checklistProgress,
  toolEntries,
  toolEntryVersions,
  startupTargets,
  knowledgeArticles,
  chatMessages,
  milestones,
  milestoneGroups,
  type MilestoneGroup,
  type InsertMilestoneGroup,
  type Startup,
  type InsertStartup,
  type Module,
  type Level,
  type ChecklistItem,
  type ToolTemplate,
  type ChecklistProgress,
  type ToolEntry,
  type ToolEntryVersion,
  type StartupTarget,
  type User,
  type KnowledgeArticle,
  type InsertKnowledgeArticle,
  type ChatMessage,
  type InsertChatMessage,
  type Milestone,
  type InsertMilestone,
  readinessSnapshots,
  type ReadinessSnapshot,
  milestoneCategories,
  type MilestoneCategory,
  type InsertMilestoneCategory,
  milestoneStages,
  type MilestoneStage,
  type InsertMilestoneStage,
  startupModuleAccess,
  type StartupModuleAccess,
  type InsertStartupModuleAccess,
  matchFeedback,
  type MatchFeedback,
  type InsertMatchFeedback,
  matchResults,
  introductionRequests,
  introductionItems,
  introductionItemVotes,
  deckViews,
  type IntroductionRequest,
  type IntroductionItem,
  programmes,
  programmeFeatures,
  programmeStartups,
  programmeAdmins,
  invitations,
  systemSettings,
  rewards,
  missionCompletions,
  rewardUnlocks,
  feedbackInsights,
  type FeedbackInsight,
  type Programme,
  type InsertProgramme,
  type ProgrammeFeature,
  type ProgrammeStartup,
  type ProgrammeAdmin,
  type Invitation,
  type Reward,
  type InsertReward,
  type MissionCompletion,
  type RewardUnlock,
  startupMissions,
  type StartupMission,
  cohorts,
  groups,
  startupCohorts,
  startupGroups,
  eirGroupAssignments,
  eirSessionRequests,
  type Cohort,
  type InsertCohort,
  type Group,
  type InsertGroup,
  type StartupCohort,
  type StartupGroup,
  type EirGroupAssignment,
  type EirSessionRequest,
  type InsertEirSessionRequest,
  activityLog,
  assumptions,
  experiments,
  type Assumption,
  type InsertAssumption,
  type Experiment,
  type InsertExperiment,
  type AssumptionWithExperiments,
  inlineToolConfigs,
  exampleCompanies,
  toolExampleData,
  sprints,
  sprintMissions,
  kpis,
  kpiSnapshots,
  type Sprint,
  type InsertSprint,
  type SprintMission,
  type InsertSprintMission,
  type Kpi,
  type InsertKpi,
  type KpiSnapshot,
  type InsertKpiSnapshot,
  type InlineToolConfig,
  type InsertInlineToolConfig,
  type ExampleCompany,
  type InsertExampleCompany,
  type ToolExampleData,
  type InsertToolExampleData,
  eventSeries,
  events as eventOccurrences,
  eventAudiences,
  eventRsvps,
  eventRecordings,
  eventSeriesSprints,
  sprintDefaultMissionCompletions,
  type SprintDefaultMissionCompletion,
  changelogEntries,
  type ChangelogEntry,
  type InsertChangelogEntry,
  type EventSeries,
  type InsertEventSeries,
  type EventOccurrence,
  type InsertEventOccurrence,
  type EventAudience,
  type InsertEventAudience,
  type EventRsvp,
  type InsertEventRsvp,
  type EventRecording,
  type InsertEventRecording,
} from "@shared/schema";
import { authStorage } from "./replit_integrations/auth/storage";

export interface IStorage {
  // Auth (delegated to authStorage but exposed here for convenience)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUserRole(id: string, role: string): Promise<void>;

  // Startups
  getStartups(userId: string): Promise<Startup[]>;
  getStartup(id: number): Promise<Startup | undefined>;
  createStartup(userId: string, startup: InsertStartup, skipDefaultProgramme?: boolean): Promise<Startup>;
  updateStartup(id: number, data: Partial<InsertStartup>): Promise<Startup | undefined>;
  isStartupMember(userId: string, startupId: number): Promise<boolean>;

  // CMS / Static Content
  getModules(includeCirl?: boolean): Promise<Module[]>;
  getLevels(moduleId: number): Promise<Level[]>;
  getAllLevels(): Promise<Level[]>;
  updateLevelContent(levelId: number, data: { description?: string; videoUrl?: string | null; learningContent?: string | null; furtherReadingLinks?: Array<{ title: string; url: string }> | null }): Promise<Level>;
  getChecklistItems(levelId: number): Promise<ChecklistItem[]>;
  updateChecklistItem(id: number, data: { label?: string; explanatoryContent?: string | null }): Promise<ChecklistItem | undefined>;
  getToolTemplates(): Promise<ToolTemplate[]>;
  getVisibleToolTemplates(): Promise<ToolTemplate[]>;
  getAllToolTemplatesAdmin(): Promise<ToolTemplate[]>;
  getToolTemplatesWithLinkage(): Promise<Array<ToolTemplate & { linkage: { levels: Array<{ moduleName: string; levelNumber: number; levelTitle: string }>; checklistItems: Array<{ moduleName: string; levelNumber: number; itemLabel: string }>; inlineConfigs: Array<{ moduleName: string; levelNumber: number; itemLabel: string; configTitle: string }>; isLinked: boolean; effectiveHidden: boolean } }>>;
  updateToolTemplateVisibility(id: number, isHidden: boolean): Promise<ToolTemplate | undefined>;
  backfillUnlinkedToolVisibility(): Promise<{ hidden: number }>;
  getToolCategories(): Promise<{ toolTemplateId: number; dimensions: string[] }[]>;
  
  // Full Structure Fetcher (for optimization)
  getFullModuleStructure(): Promise<any[]>;

  // Progress & Tools
  getChecklistProgress(startupId: number): Promise<ChecklistProgress[]>;
  toggleChecklistProgress(startupId: number, checklistItemId: number, completed: boolean, userId: string): Promise<ChecklistProgress>;
  
  getToolEntry(startupId: number, toolTemplateId: number): Promise<ToolEntry | undefined>;
  saveToolEntry(startupId: number, toolTemplateId: number, data: any, userId: string, contextLevelId?: number): Promise<ToolEntry>;
  getToolEntryVersions(toolEntryId: number): Promise<ToolEntryVersion[]>;

  // Targets
  getStartupTargets(startupId: number): Promise<StartupTarget[]>;
  setStartupTarget(startupId: number, moduleId: number, targetLevel: number, userId: string): Promise<StartupTarget>;

  // Activity
  getRecentActivity(startupId: number, limit: number): Promise<any[]>;

  // Knowledge Articles
  getKnowledgeArticles(): Promise<KnowledgeArticle[]>;
  getKnowledgeArticle(id: number): Promise<KnowledgeArticle | undefined>;
  createKnowledgeArticle(data: InsertKnowledgeArticle): Promise<KnowledgeArticle>;
  updateKnowledgeArticle(id: number, data: Partial<InsertKnowledgeArticle>): Promise<KnowledgeArticle | undefined>;
  deleteKnowledgeArticle(id: number): Promise<void>;
  getKnowledgeArticlesForLevel(moduleId: number, level: number): Promise<KnowledgeArticle[]>;
  getFoundationalArticles(): Promise<KnowledgeArticle[]>;

  // Chat Messages
  getChatMessages(startupId: number, userId: string, limit?: number): Promise<ChatMessage[]>;
  saveChatMessage(data: InsertChatMessage): Promise<ChatMessage>;
  clearChatHistory(startupId: number, userId: string): Promise<void>;

  // Admin / Seeding
  seedContent(): Promise<void>;

  // Admin
  isUserAdmin(userId: string): Promise<boolean>;
  isInvestorAdmin(userId: string): Promise<boolean>;
  getAllStartupsWithMembers(): Promise<any[]>;
  getProgressSnapshotForAllStartups(): Promise<any[]>;
  getDashboardStats(): Promise<{
    totalCompanies: number;
    totalUsers: number;
    totalProgrammes: number;
    totalFounders: number;
    totalAdmins: number;
    averageReadiness: number;
    dimensionAverages: Record<string, number>;
    highestReadiness: { name: string; level: number } | null;
    recentActivity: number;
    totalIntroductionRequests: number;
    totalIntroductionsPending: number;
    totalIntroductionsApproved: number;
  }>;

  // Milestone Groups
  getMilestoneGroups(): Promise<MilestoneGroup[]>;
  createMilestoneGroup(data: InsertMilestoneGroup): Promise<MilestoneGroup>;
  updateMilestoneGroup(id: number, data: Partial<InsertMilestoneGroup>): Promise<MilestoneGroup | undefined>;
  deleteMilestoneGroup(id: number): Promise<void>;

  // Milestones
  getMilestones(): Promise<Milestone[]>;
  getMilestone(id: number): Promise<Milestone | undefined>;
  createMilestone(data: InsertMilestone): Promise<Milestone>;
  updateMilestone(id: number, data: Partial<InsertMilestone>): Promise<Milestone | undefined>;
  deleteMilestone(id: number): Promise<void>;

  // Readiness Snapshots
  recordReadinessSnapshot(startupId: number, levelsMap: Record<string, number>): Promise<ReadinessSnapshot>;
  getReadinessTimeline(): Promise<ReadinessSnapshot[]>;
  getReadinessTimelineForStartups(startupIds: number[]): Promise<ReadinessSnapshot[]>;
  computeReadinessLevels(startupId: number): Promise<Record<string, number>>;

  // Milestone Categories
  getMilestoneCategories(): Promise<MilestoneCategory[]>;
  createMilestoneCategory(data: InsertMilestoneCategory): Promise<MilestoneCategory>;
  updateMilestoneCategory(id: number, data: Partial<InsertMilestoneCategory>): Promise<MilestoneCategory | undefined>;
  deleteMilestoneCategory(id: number): Promise<void>;

  // Milestone Stages
  getMilestoneStages(): Promise<MilestoneStage[]>;
  createMilestoneStage(data: InsertMilestoneStage): Promise<MilestoneStage>;
  updateMilestoneStage(id: number, data: Partial<InsertMilestoneStage>): Promise<MilestoneStage | undefined>;
  deleteMilestoneStage(id: number): Promise<void>;

  // Rewards
  getRewards(): Promise<Reward[]>;
  getReward(id: number): Promise<Reward | undefined>;
  createReward(data: InsertReward): Promise<Reward>;
  updateReward(id: number, data: Partial<InsertReward>): Promise<Reward | undefined>;
  deleteReward(id: number): Promise<void>;

  // Mission Completions
  getMissionCompletions(startupId: number): Promise<MissionCompletion[]>;
  setMissionCompletion(milestoneId: number, startupId: number, status: string, adminId?: string): Promise<MissionCompletion>;
  getCompletionQueue(): Promise<(MissionCompletion & { startupName: string; milestoneTitle: string; requirements: any })[]>;
  getMissionReviewData(milestoneId: number, startupId: number): Promise<any>;

  // Reward Unlocks
  getRewardUnlocks(startupId: number): Promise<RewardUnlock[]>;
  getAllRewardUnlocks(): Promise<(RewardUnlock & { startupName: string; rewardName: string; rewardType: string })[]>;
  createRewardUnlock(rewardId: number, startupId: number): Promise<RewardUnlock>;
  updateRewardUnlock(id: number, data: Partial<{ submittedAt: Date; reviewedAt: Date; reviewedBy: string; reviewStatus: string; reviewNotes: string }>): Promise<RewardUnlock | undefined>;
  getGrantQueue(): Promise<(RewardUnlock & { startupName: string; rewardName: string; rewardMetadata: any })[]>;
  checkAndUnlockRewards(startupId: number): Promise<RewardUnlock[]>;
  autoDetectScoresMet(startupId: number): Promise<MissionCompletion[]>;

  // Module Access Control
  getStartupModuleAccess(startupId: number): Promise<StartupModuleAccess[]>;
  grantModuleAccess(startupId: number, moduleId: number, grantedBy: string): Promise<StartupModuleAccess>;
  revokeModuleAccess(startupId: number, moduleId: number): Promise<void>;
  hasModuleAccess(startupId: number, moduleId: number): Promise<boolean>;

  // Match Feedback
  getMatchFeedback(fundingRoundAirtableId: string): Promise<MatchFeedback[]>;
  getAllMatchFeedback(): Promise<MatchFeedback[]>;
  saveMatchResults(userId: string, startupId: number | null, fundingRoundAirtableId: string, formValues: any, matches: any): Promise<void>;
  getLatestMatchResults(userId: string, startupId: number | null): Promise<any | null>;
  upsertMatchFeedback(data: InsertMatchFeedback): Promise<MatchFeedback>;

  // Introduction Requests
  createIntroductionRequest(data: { userId: string; startupId?: number; fundingRoundData: any; startupData: any; items: { investorAirtableId: string; investorName: string; investorEmail?: string; matchScore?: number }[] }): Promise<IntroductionRequest & { items: IntroductionItem[] }>;
  getIntroductionRequest(id: number): Promise<(IntroductionRequest & { items: IntroductionItem[] }) | undefined>;
  getIntroductionRequestsByUser(userId: string, startupId?: number | null): Promise<(IntroductionRequest & { items: IntroductionItem[] })[]>;
  getAllIntroductionRequests(): Promise<(IntroductionRequest & { items: IntroductionItem[] })[]>;
  updateIntroductionItemStatus(itemId: number, status: string, adminNote?: string, adminUserId?: string, responseToken?: string): Promise<IntroductionItem | undefined>;
  getIntroductionItemByToken(token: string): Promise<(IntroductionItem & { request: IntroductionRequest }) | undefined>;
  updateIntroductionItemByToken(token: string, status: string): Promise<IntroductionItem | undefined>;
  addIntroductionItemVote(itemId: number, userId: string, vote: string): Promise<any>;
  getIntroductionItemVotes(itemId: number): Promise<any[]>;
  countInvestorAdmins(): Promise<number>;
  getAdminsByRole(role: string): Promise<User[]>;
  updateUserAdminRole(userId: string, role: string | null): Promise<User | undefined>;
  getAdminUsers(): Promise<User[]>;

  // Deck Views
  recordDeckView(introductionItemId: number, viewerIp?: string, userAgent?: string): Promise<void>;
  getDeckViewStats(introductionItemId: number): Promise<{ viewCount: number; lastViewedAt: Date | null }>;
  getDeckViewStatsBatch(itemIds: number[]): Promise<Map<number, { viewCount: number; lastViewedAt: Date | null }>>;

  // Programmes
  createProgramme(data: InsertProgramme): Promise<Programme>;
  updateProgramme(id: number, data: Partial<InsertProgramme>): Promise<Programme | undefined>;
  deleteProgramme(id: number): Promise<void>;
  getProgramme(id: number): Promise<Programme | undefined>;
  getProgrammeByName(name: string): Promise<Programme | undefined>;
  getAllProgrammes(): Promise<Programme[]>;
  getProgrammesForAdmin(userId: string): Promise<Programme[]>;
  getProgrammesForStartup(startupId: number): Promise<Programme[]>;

  // Programme Features
  setProgrammeFeature(programmeId: number, featureKey: string, enabled: boolean): Promise<ProgrammeFeature>;
  getProgrammeFeatures(programmeId: number): Promise<ProgrammeFeature[]>;
  getStartupFeatures(startupId: number): Promise<{ featureKey: string; enabled: boolean }[]>;

  // Programme-Startup
  addStartupToProgramme(programmeId: number, startupId: number): Promise<ProgrammeStartup>;
  removeStartupFromProgramme(programmeId: number, startupId: number): Promise<void>;
  getStartupsInProgramme(programmeId: number): Promise<(Startup & { members: any[] })[]>;

  // Programme-Admin
  assignAdminToProgramme(programmeId: number, userId: string): Promise<ProgrammeAdmin>;
  removeAdminFromProgramme(programmeId: number, userId: string): Promise<void>;
  getProgrammeAdmins(programmeId: number): Promise<(ProgrammeAdmin & { user: User })[]>;

  // Invitations
  createInvitation(data: { email: string; startupId: number | null; programmeId: number | null; token: string; invitedById: string; role?: string | null; pendingProfile?: any; pendingEirGroupIds?: number[] }): Promise<Invitation>;
  getInvitationByToken(token: string): Promise<Invitation | undefined>;
  getInvitationById(id: number): Promise<Invitation | undefined>;
  acceptInvitation(id: number): Promise<Invitation | undefined>;
  setInvitationPendingEirGroups(invitationId: number, groupIds: number[]): Promise<Invitation | undefined>;
  getPendingEirInvitations(): Promise<Invitation[]>;
  getPendingEirInvitationsForGroup(groupId: number): Promise<Invitation[]>;
  getInvitationsForProgramme(programmeId: number): Promise<(Invitation & { startup: Startup })[]>;
  getPendingInvitationsForStartup(startupId: number): Promise<Invitation[]>;
  getInvitationByStartupAndEmail(startupId: number, email: string): Promise<Invitation | undefined>;
  getPendingInvitationsByEmail(email: string): Promise<Invitation[]>;
  getInvitationsByEmail(email: string): Promise<Invitation[]>;
  addStartupMember(userId: string, startupId: number): Promise<void>;

  // User role management
  setUserRole(userId: string, role: string): Promise<User | undefined>;
  isSuperAdmin(userId: string): Promise<boolean>;
  isAdminForProgramme(userId: string, programmeId: number): Promise<boolean>;
  getAllUsers(): Promise<User[]>;

  // Deletion
  deleteStartup(id: number): Promise<void>;
  deleteUser(id: string): Promise<void>;

  // Events (see IEventStorage below)

  // System settings
  getSystemSetting(key: string): Promise<string | null>;
  setSystemSetting(key: string, value: string): Promise<void>;

  // Matching Config
  getMatchingConfig(): Promise<any>;
  updateMatchingConfig(config: any): Promise<void>;

  // Feedback Insights
  getFeedbackInsights(): Promise<FeedbackInsight | null>;
  saveFeedbackInsights(insights: any[], feedbackCount: number, generatedBy: string): Promise<FeedbackInsight>;

  // Startup Missions
  getStartupMissions(startupId: number): Promise<StartupMission[]>;
  assignMissionToStartup(startupId: number, milestoneId: number, assignedBy: string): Promise<StartupMission>;
  removeMissionFromStartup(startupId: number, milestoneId: number): Promise<void>;

  // Cohorts
  getCohortsByProgramme(programmeId: number): Promise<Cohort[]>;
  getCohort(id: number): Promise<Cohort | undefined>;
  createCohort(data: InsertCohort): Promise<Cohort>;
  updateCohort(id: number, data: Partial<InsertCohort>): Promise<Cohort | undefined>;
  deleteCohort(id: number): Promise<void>;

  // Groups
  getGroupsByCohort(cohortId: number): Promise<Group[]>;
  getGroupsByProgramme(programmeId: number): Promise<Group[]>;
  getGroup(id: number): Promise<Group | undefined>;
  createGroup(data: InsertGroup): Promise<Group>;
  updateGroup(id: number, data: Partial<InsertGroup>): Promise<Group | undefined>;
  deleteGroup(id: number): Promise<void>;

  // Startup-Cohort assignments
  addStartupToCohort(startupId: number, cohortId: number): Promise<StartupCohort>;
  removeStartupFromCohort(startupId: number, cohortId: number): Promise<void>;
  getStartupCohorts(startupId: number): Promise<Cohort[]>;
  getStartupsInCohort(cohortId: number): Promise<Startup[]>;

  // Startup-Group assignments
  addStartupToGroup(startupId: number, groupId: number): Promise<StartupGroup>;
  removeStartupFromGroup(startupId: number, groupId: number): Promise<void>;
  getStartupGroups(startupId: number): Promise<Group[]>;
  getStartupsInGroup(groupId: number): Promise<Startup[]>;

  // EIR Group assignments
  assignEirToGroup(userId: string, groupId: number, assignedBy: string): Promise<EirGroupAssignment>;
  removeEirFromGroup(userId: string, groupId: number): Promise<void>;
  getEirGroups(userId: string): Promise<(Group & { cohortName: string; programmeName: string; programmeId: number })[]>;
  getGroupEirs(groupId: number): Promise<(EirGroupAssignment & { user: User })[]>;
  isEir(userId: string): Promise<boolean>;
  setUserIsEir(userId: string, isEir: boolean): Promise<User | undefined>;
  // Resolve the EIR(s) currently supporting a given startup, via the
  // startup's group memberships. Returns the user rows of EIRs whose
  // isEir flag is still true.
  getEirsForStartup(startupId: number): Promise<User[]>;
  // Same, but for a founder user — looks up all their startups and unions
  // the EIRs. The first entry (if any) is treated as the "primary" EIR.
  getEirsForFounder(userId: string): Promise<User[]>;

  // EIR session requests (Hook Model "investment" event at end of onboarding)
  createEirSessionRequest(data: InsertEirSessionRequest): Promise<EirSessionRequest>;
  getEirSessionRequestsForFounder(userId: string): Promise<EirSessionRequest[]>;

  // Filtered stats
  getProgressSnapshotForStartups(startupIds: number[]): Promise<any[]>;
  getDashboardStatsFiltered(options?: { cohortId?: number; groupId?: number }): Promise<any>;

  // Inline Tool Configs
  getInlineToolConfigs(): Promise<InlineToolConfig[]>;
  getInlineToolConfig(id: number): Promise<InlineToolConfig | undefined>;
  getInlineToolConfigsByLevel(levelId: number): Promise<InlineToolConfig[]>;
  getInlineToolConfigByChecklistItem(checklistItemId: number): Promise<InlineToolConfig | undefined>;
  getInlineToolConfigByStableKey(stableKey: string): Promise<InlineToolConfig | undefined>;
  createInlineToolConfig(data: InsertInlineToolConfig): Promise<InlineToolConfig>;
  updateInlineToolConfig(id: number, data: Partial<InsertInlineToolConfig>): Promise<InlineToolConfig | undefined>;
  deleteInlineToolConfig(id: number): Promise<void>;

  // Example Companies
  getExampleCompanies(): Promise<ExampleCompany[]>;
  createExampleCompany(data: InsertExampleCompany): Promise<ExampleCompany>;
  updateExampleCompany(id: number, data: Partial<InsertExampleCompany>): Promise<ExampleCompany | undefined>;
  deleteExampleCompany(id: number): Promise<void>;

  // Tool Example Data
  getToolExampleData(inlineToolConfigId: number): Promise<ToolExampleData[]>;
  upsertToolExampleData(inlineToolConfigId: number, exampleCompanyId: number, exampleData: any): Promise<ToolExampleData>;
  deleteToolExampleData(id: number): Promise<void>;

  // Assumptions & Experiments
  getAssumptionById(id: number): Promise<Assumption | undefined>;
  getAssumptionsWithExperiments(startupId: number): Promise<AssumptionWithExperiments[]>;
  createAssumption(startupId: number, data: { hypothesis: string; source?: string; dimension?: string; confidence?: number; impactIfWrong?: number }): Promise<Assumption>;
  updateAssumption(id: number, data: Partial<{ turnDecision: string; stage: string; suggestedDecision: string }>): Promise<Assumption | undefined>;
  deleteAssumption(id: number): Promise<void>;
  getExperimentsByAssumption(assumptionId: number): Promise<Experiment[]>;
  getExperimentById(id: number): Promise<Experiment | undefined>;
  createExperiment(assumptionId: number, data: InsertExperiment): Promise<Experiment>;
  updateExperiment(id: number, data: Partial<InsertExperiment>): Promise<Experiment>;
  syncKeyAssumptions(startupId: number, toolTemplateId: number, data: Record<string, unknown>): Promise<void>;
  retroSyncKeyAssumptionsForConfig(configId: number): Promise<void>;

  // Changelog
  listChangelogEntries(opts?: { onlyPublished?: boolean }): Promise<ChangelogEntry[]>;
  getChangelogEntry(id: number): Promise<ChangelogEntry | undefined>;
  getChangelogEntryBySource(taskRef: string): Promise<ChangelogEntry | undefined>;
  createChangelogEntry(data: InsertChangelogEntry): Promise<ChangelogEntry>;
  updateChangelogEntry(id: number, data: Partial<InsertChangelogEntry>): Promise<ChangelogEntry | undefined>;
  deleteChangelogEntry(id: number): Promise<void>;

  // --- My Journey: sprints, sprint missions, KPIs ---
  getSprintsForProgramme(programmeId: number): Promise<Sprint[]>;
  createSprint(data: InsertSprint): Promise<Sprint>;
  updateSprint(id: number, data: Partial<InsertSprint>): Promise<Sprint | undefined>;
  deleteSprint(id: number): Promise<void>;
  getSprint(id: number): Promise<Sprint | undefined>;
  getSprintMissionsForStartup(startupId: number): Promise<SprintMission[]>;
  getSprintMission(startupId: number, sprintId: number): Promise<SprintMission | undefined>;
  upsertSprintMission(data: InsertSprintMission): Promise<SprintMission>;
  updateSprintMission(id: number, data: Partial<InsertSprintMission>): Promise<SprintMission | undefined>;
  getRecentSprintMissionsForGroup(groupId: number, limit?: number): Promise<(SprintMission & { startupName: string; sprintLabel: string })[]>;
  getSprintDefaultMissionCompletions(startupId: number): Promise<SprintDefaultMissionCompletion[]>;
  markSprintDefaultMissionComplete(startupId: number, sprintId: number, userId: string): Promise<SprintDefaultMissionCompletion>;
  getSprintMissionById(id: number): Promise<SprintMission | undefined>;
  getStartupCohortsWithDates(startupId: number): Promise<Cohort[]>;
  getRecentSprintActivityForGroup(groupId: number, limit?: number): Promise<Array<{ type: "mission" | "kpi"; sprintId: number | null; sprintTitle: string | null; phase: string; startupId: number; startupName: string; title: string; value: string | null; recordedAt: Date | null; }>>;
  getKpisForStartup(startupId: number): Promise<Kpi[]>;
  createKpi(data: InsertKpi): Promise<Kpi>;
  updateKpi(id: number, data: Partial<InsertKpi>): Promise<Kpi | undefined>;
  deleteKpi(id: number): Promise<void>;
  getKpi(id: number): Promise<Kpi | undefined>;
  getKpiSnapshots(kpiId: number, limit?: number): Promise<KpiSnapshot[]>;
  createKpiSnapshot(data: InsertKpiSnapshot): Promise<KpiSnapshot>;
  ensureDefaultKpis(startupId: number): Promise<void>;
  seedDefaultPhasePlan(): Promise<void>;
  updateUserEirProfile(userId: string, data: { firstName?: string | null; lastName?: string | null; profileImageUrl?: string | null; eirPhotoUrl?: string | null; eirBio?: string | null; eirCalendarUrl?: string | null }): Promise<User | undefined>;
  updateUserJourneyState(userId: string, state: { foundationCelebrationSeenForStartupIds?: number[] }): Promise<void>;
  listEirs(): Promise<User[]>;
  updateCohortDates(cohortId: number, data: { startDate?: Date | null; endDate?: Date | null }): Promise<Cohort | undefined>;

  // Seeding
  seedContent(): Promise<void>;
  seedMilestoneData(): Promise<void>;
  upgradeGenericContent(): Promise<void>;
  upgradeMilestoneNames(): Promise<void>;
  normalizeModuleNames(): Promise<void>;
  backfillProgrammeFeatures(): Promise<void>;
  seedInlineToolConfigs(): Promise<void>;
  backfillCirlModule(): Promise<void>;
}

function isLevelDone(moduleId: number, levelNumber: number, itemIds: number[], completedItemIds: Set<number>): boolean {
  if (itemIds.length === 0) return false;
  if (moduleId === 1 && levelNumber === 1) {
    return itemIds.some(id => completedItemIds.has(id));
  }
  return itemIds.every(id => completedItemIds.has(id));
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    return authStorage.getUser(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async updateUserRole(id: string, role: string): Promise<void> {
    await db.update(users).set({ role, isAdmin: true, updatedAt: new Date() }).where(eq(users.id, id));
  }

  async getStartups(userId: string): Promise<Startup[]> {
    const results = await db
      .select({ startup: startups })
      .from(startups)
      .innerJoin(startupMembers, eq(startups.id, startupMembers.startupId))
      .where(eq(startupMembers.userId, userId))
      .orderBy(startups.id);
    
    return results.map(r => r.startup);
  }

  async getStartup(id: number): Promise<Startup | undefined> {
    const [startup] = await db.select().from(startups).where(eq(startups.id, id));
    return startup;
  }

  async createStartup(userId: string, startup: InsertStartup, skipDefaultProgramme = false): Promise<Startup> {
    const [newStartup] = await db.insert(startups).values({
      ...startup,
      createdById: userId,
    }).returning();

    await db.insert(startupMembers).values({
      startupId: newStartup.id,
      userId: userId,
      role: "owner"
    });

    const cirlEnabled = await this.getSystemSetting('cirl_enabled');
    const dimensionList = cirlEnabled === 'false'
      ? ['CRL', 'TRL', 'BRL', 'IPRL', 'TMRL', 'FRL']
      : ['CRL', 'TRL', 'BRL', 'IPRL', 'TMRL', 'FRL', 'CIRL'];
    const coreModules = await db.select().from(modules).where(
      inArray(modules.kthDimension, dimensionList)
    );
    if (coreModules.length > 0) {
      for (const mod of coreModules) {
        try {
          await db.insert(startupModuleAccess).values({
            startupId: newStartup.id,
            moduleId: mod.id,
            grantedBy: userId,
          });
        } catch (e: any) {
          if (!e.message?.includes('duplicate')) throw e;
        }
      }
    }

    if (!skipDefaultProgramme) {
      const defaultProgramme = await db.select().from(programmes).where(eq(programmes.name, "General")).limit(1);
      if (defaultProgramme.length > 0) {
        try {
          await db.insert(programmeStartups).values({
            programmeId: defaultProgramme[0].id,
            startupId: newStartup.id,
          });
        } catch (e: any) {
          if (!e.message?.includes('duplicate')) throw e;
        }
      }
    }

    return newStartup;
  }

  async updateStartup(id: number, data: Partial<InsertStartup>): Promise<Startup | undefined> {
    const [updated] = await db.update(startups).set(data).where(eq(startups.id, id)).returning();
    return updated;
  }

  async isStartupMember(userId: string, startupId: number): Promise<boolean> {
    const sa = await this.isSuperAdmin(userId);
    if (sa) return true;
    const [member] = await db
      .select()
      .from(startupMembers)
      .where(and(eq(startupMembers.userId, userId), eq(startupMembers.startupId, startupId)));
    return !!member;
  }

  async getModules(includeCirl?: boolean): Promise<Module[]> {
    const allModules = await db.select().from(modules).orderBy(modules.displayOrder);
    if (includeCirl === false) {
      return allModules.filter(m => m.kthDimension !== 'CIRL');
    }
    if (includeCirl === true) {
      return allModules;
    }
    const cirlEnabled = await this.getSystemSetting('cirl_enabled');
    if (cirlEnabled === 'false') {
      return allModules.filter(m => m.kthDimension !== 'CIRL');
    }
    return allModules;
  }

  async getLevels(moduleId: number): Promise<Level[]> {
    return await db.select().from(levels).where(eq(levels.moduleId, moduleId)).orderBy(levels.levelNumber);
  }

  async getAllLevels(): Promise<Level[]> {
    return await db.select().from(levels).orderBy(levels.moduleId, levels.levelNumber);
  }

  async updateLevelContent(levelId: number, data: { description?: string; videoUrl?: string | null; learningContent?: string | null; furtherReadingLinks?: Array<{ title: string; url: string }> | null }): Promise<Level> {
    const [updated] = await db.update(levels).set(data).where(eq(levels.id, levelId)).returning();
    return updated;
  }

  async getChecklistItems(levelId: number): Promise<ChecklistItem[]> {
    return await db.select().from(checklistItems).where(eq(checklistItems.levelId, levelId)).orderBy(checklistItems.displayOrder);
  }

  async updateChecklistItem(id: number, data: { label?: string; explanatoryContent?: string | null }): Promise<ChecklistItem | undefined> {
    const [updated] = await db.update(checklistItems).set(data).where(eq(checklistItems.id, id)).returning();
    return updated;
  }

  async getToolTemplates(): Promise<ToolTemplate[]> {
    return await db.select().from(toolTemplates);
  }

  async getVisibleToolTemplates(): Promise<ToolTemplate[]> {
    const all = await db.select().from(toolTemplates);
    const linked = await this.computeToolLinkedIds();
    return all.filter(t => t.visibilityOverride ? !t.isHidden : linked.has(t.id));
  }

  async getAllToolTemplatesAdmin(): Promise<ToolTemplate[]> {
    return await db.select().from(toolTemplates);
  }

  private async computeToolLinkedIds(): Promise<Set<number>> {
    const linked = new Set<number>();
    const lts = await db.select({ id: levelTools.toolTemplateId }).from(levelTools);
    lts.forEach(r => linked.add(r.id));
    const cits = await db.select({ id: checklistItemTools.toolTemplateId }).from(checklistItemTools);
    cits.forEach(r => linked.add(r.id));
    const inlines = await db.select({ id: inlineToolConfigs.toolTemplateId }).from(inlineToolConfigs);
    inlines.forEach(r => linked.add(r.id));
    return linked;
  }

  async getToolTemplatesWithLinkage(): Promise<Array<ToolTemplate & { linkage: { levels: Array<{ moduleName: string; levelNumber: number; levelTitle: string }>; checklistItems: Array<{ moduleName: string; levelNumber: number; itemLabel: string }>; inlineConfigs: Array<{ moduleName: string; levelNumber: number; itemLabel: string; configTitle: string }>; isLinked: boolean } }>> {
    const all = await db.select().from(toolTemplates);
    const allLevels = await db.select().from(levels);
    const allModules = await db.select().from(modules);
    const allItems = await db.select().from(checklistItems);
    const lts = await db.select().from(levelTools);
    const cits = await db.select().from(checklistItemTools);
    const inlines = await db.select().from(inlineToolConfigs);

    const levelMap = new Map(allLevels.map(l => [l.id, l]));
    const moduleMap = new Map(allModules.map(m => [m.id, m]));
    const itemMap = new Map(allItems.map(i => [i.id, i]));

    const lvlLink = new Map<number, Array<{ moduleName: string; levelNumber: number; levelTitle: string }>>();
    for (const r of lts) {
      const lv = levelMap.get(r.levelId);
      if (!lv) continue;
      const mod = moduleMap.get(lv.moduleId);
      if (!mod) continue;
      const arr = lvlLink.get(r.toolTemplateId) || [];
      arr.push({ moduleName: mod.name, levelNumber: lv.levelNumber, levelTitle: lv.title });
      lvlLink.set(r.toolTemplateId, arr);
    }

    const itemLink = new Map<number, Array<{ moduleName: string; levelNumber: number; itemLabel: string }>>();
    for (const r of cits) {
      const item = itemMap.get(r.checklistItemId);
      if (!item) continue;
      const lv = levelMap.get(item.levelId);
      if (!lv) continue;
      const mod = moduleMap.get(lv.moduleId);
      if (!mod) continue;
      const arr = itemLink.get(r.toolTemplateId) || [];
      arr.push({ moduleName: mod.name, levelNumber: lv.levelNumber, itemLabel: item.label });
      itemLink.set(r.toolTemplateId, arr);
    }

    const inlineLink = new Map<number, Array<{ moduleName: string; levelNumber: number; itemLabel: string; configTitle: string }>>();
    for (const r of inlines) {
      const item = itemMap.get(r.checklistItemId);
      if (!item) continue;
      const lv = levelMap.get(item.levelId);
      if (!lv) continue;
      const mod = moduleMap.get(lv.moduleId);
      if (!mod) continue;
      const arr = inlineLink.get(r.toolTemplateId) || [];
      arr.push({ moduleName: mod.name, levelNumber: lv.levelNumber, itemLabel: item.label, configTitle: r.title });
      inlineLink.set(r.toolTemplateId, arr);
    }

    return all.map(t => {
      const lvls = lvlLink.get(t.id) || [];
      const items = itemLink.get(t.id) || [];
      const inls = inlineLink.get(t.id) || [];
      const isLinked = lvls.length + items.length + inls.length > 0;
      const effectiveHidden = t.visibilityOverride ? !!t.isHidden : !isLinked;
      return {
        ...t,
        linkage: {
          levels: lvls,
          checklistItems: items,
          inlineConfigs: inls,
          isLinked,
          effectiveHidden,
        },
      };
    });
  }

  async updateToolTemplateVisibility(id: number, isHidden: boolean): Promise<ToolTemplate | undefined> {
    const [updated] = await db
      .update(toolTemplates)
      .set({ isHidden, visibilityOverride: true })
      .where(eq(toolTemplates.id, id))
      .returning();
    return updated;
  }

  async backfillUnlinkedToolVisibility(): Promise<{ hidden: number }> {
    const all = await db.select().from(toolTemplates);
    const linked = await this.computeToolLinkedIds();
    let hidden = 0;
    for (const t of all) {
      if (t.visibilityOverride) continue;
      const shouldBeHidden = !linked.has(t.id);
      if (shouldBeHidden && !t.isHidden) {
        await db.update(toolTemplates).set({ isHidden: true }).where(eq(toolTemplates.id, t.id));
        hidden++;
      }
    }
    return { hidden };
  }

  async getToolCategories(): Promise<{ toolTemplateId: number; dimensions: string[] }[]> {
    const allLevelToolRows = await db.select().from(levelTools);
    const allLevels = await db.select().from(levels);
    const allModules = await db.select().from(modules);
    const visibleTemplates = await this.getVisibleToolTemplates();
    const visibleIds = new Set(visibleTemplates.map(t => t.id));

    const levelMap = new Map(allLevels.map(l => [l.id, l]));
    const moduleMap = new Map(allModules.map(m => [m.id, m]));

    const toolDimensions = new Map<number, Set<string>>();
    for (const lt of allLevelToolRows) {
      if (!visibleIds.has(lt.toolTemplateId)) continue;
      const level = levelMap.get(lt.levelId);
      if (!level) continue;
      const mod = moduleMap.get(level.moduleId);
      if (!mod) continue;
      if (!toolDimensions.has(lt.toolTemplateId)) {
        toolDimensions.set(lt.toolTemplateId, new Set());
      }
      toolDimensions.get(lt.toolTemplateId)!.add(mod.name);
    }

    return Array.from(toolDimensions.entries()).map(([toolTemplateId, dims]) => ({
      toolTemplateId,
      dimensions: Array.from(dims),
    }));
  }

  async getFullModuleStructure(): Promise<any[]> {
    const allModules = await this.getModules();
    const allLevels = await db.select().from(levels).orderBy(levels.levelNumber);
    const allItems = await db.select().from(checklistItems).orderBy(checklistItems.displayOrder);
    const allTools = await db.select().from(toolTemplates);
    const itemTools = await db.select().from(checklistItemTools);
    const allLevelTools = await db.select().from(levelTools).orderBy(levelTools.displayOrder);

    return allModules.map(mod => {
        const modLevels = allLevels.filter(l => l.moduleId === mod.id);
        return {
            ...mod,
            levels: modLevels.map(lvl => {
                const lvlItems = allItems.filter(i => i.levelId === lvl.id);
                const lvlTools = allLevelTools
                    .filter(lt => lt.levelId === lvl.id)
                    .map(lt => allTools.find(t => t.id === lt.toolTemplateId))
                    .filter(Boolean);

                return {
                    ...lvl,
                    tools: lvlTools,
                    items: lvlItems.map(item => {
                        const linkedTools = itemTools
                            .filter(it => it.checklistItemId === item.id)
                            .map(it => allTools.find(t => t.id === it.toolTemplateId))
                            .filter(Boolean);
                        
                        return {
                            ...item,
                            linkedTools
                        };
                    })
                };
            })
        };
    });
  }

  async getChecklistProgress(startupId: number): Promise<ChecklistProgress[]> {
    return await db.select().from(checklistProgress).where(eq(checklistProgress.startupId, startupId));
  }

  async toggleChecklistProgress(startupId: number, checklistItemId: number, completed: boolean, userId: string): Promise<ChecklistProgress> {
    const [existing] = await db
        .select()
        .from(checklistProgress)
        .where(and(eq(checklistProgress.startupId, startupId), eq(checklistProgress.checklistItemId, checklistItemId)));

    if (existing) {
        const [updated] = await db
            .update(checklistProgress)
            .set({ completed, completedBy: userId, completedAt: new Date(), updatedAt: new Date() })
            .where(eq(checklistProgress.id, existing.id))
            .returning();
        return updated;
    } else {
        const [inserted] = await db
            .insert(checklistProgress)
            .values({
                startupId,
                checklistItemId,
                completed,
                completedBy: userId,
                completedAt: new Date()
            })
            .returning();
        return inserted;
    }
  }

  async getToolEntry(startupId: number, toolTemplateId: number): Promise<ToolEntry | undefined> {
    const [entry] = await db
        .select()
        .from(toolEntries)
        .where(and(eq(toolEntries.startupId, startupId), eq(toolEntries.toolTemplateId, toolTemplateId)));
    return entry;
  }

  async saveToolEntry(startupId: number, toolTemplateId: number, data: any, userId: string, contextLevelId?: number): Promise<ToolEntry> {
    let entry = await this.getToolEntry(startupId, toolTemplateId);
    let entryId: number;

    if (entry) {
        const [updated] = await db
            .update(toolEntries)
            .set({ currentData: data, updatedAt: new Date() })
            .where(eq(toolEntries.id, entry.id))
            .returning();
        entry = updated;
        entryId = entry.id;
    } else {
        const [inserted] = await db
            .insert(toolEntries)
            .values({
                startupId,
                toolTemplateId,
                currentData: data
            })
            .returning();
        entry = inserted;
        entryId = inserted.id;
    }

    // Create version snapshot
    await db.insert(toolEntryVersions).values({
        toolEntryId: entryId,
        dataSnapshot: data,
        savedBy: userId,
        contextLevelId,
    });

    return entry;
  }

  async getToolEntryVersions(toolEntryId: number): Promise<ToolEntryVersion[]> {
    return await db.select().from(toolEntryVersions).where(eq(toolEntryVersions.toolEntryId, toolEntryId)).orderBy(toolEntryVersions.createdAt);
  }

  async getStartupTargets(startupId: number): Promise<StartupTarget[]> {
    return await db.select().from(startupTargets).where(eq(startupTargets.startupId, startupId));
  }

  async setStartupTarget(startupId: number, moduleId: number, targetLevel: number, userId: string): Promise<StartupTarget> {
    const [existing] = await db
      .select()
      .from(startupTargets)
      .where(and(eq(startupTargets.startupId, startupId), eq(startupTargets.moduleId, moduleId)));

    if (existing) {
      const [updated] = await db
        .update(startupTargets)
        .set({ targetLevel, setBy: userId, updatedAt: new Date() })
        .where(eq(startupTargets.id, existing.id))
        .returning();
      return updated;
    } else {
      const [inserted] = await db
        .insert(startupTargets)
        .values({ startupId, moduleId, targetLevel, setBy: userId })
        .returning();
      return inserted;
    }
  }

  async getRecentActivity(startupId: number, limit: number): Promise<any[]> {
    const completedItems = await db
      .select({
        checklistItemId: checklistProgress.checklistItemId,
        completedAt: checklistProgress.completedAt,
        levelId: checklistItems.levelId,
        levelNumber: levels.levelNumber,
        moduleName: modules.name,
      })
      .from(checklistProgress)
      .innerJoin(checklistItems, eq(checklistProgress.checklistItemId, checklistItems.id))
      .innerJoin(levels, eq(checklistItems.levelId, levels.id))
      .innerJoin(modules, eq(levels.moduleId, modules.id))
      .where(and(eq(checklistProgress.startupId, startupId), eq(checklistProgress.completed, true)));

    const toolUpdates = await db
      .select({
        toolTemplateName: toolTemplates.name,
        toolTemplateId: toolEntries.toolTemplateId,
        updatedAt: toolEntries.updatedAt,
      })
      .from(toolEntries)
      .innerJoin(toolTemplates, eq(toolEntries.toolTemplateId, toolTemplates.id))
      .where(eq(toolEntries.startupId, startupId));

    const activities: any[] = [];

    for (const item of completedItems) {
      if (item.completedAt) {
        activities.push({
          type: 'completed' as const,
          moduleName: item.moduleName,
          levelNumber: item.levelNumber,
          timestamp: item.completedAt.toISOString(),
        });
      }
    }

    for (const tool of toolUpdates) {
      if (tool.updatedAt) {
        activities.push({
          type: 'updated' as const,
          moduleName: tool.toolTemplateName,
          levelNumber: 0,
          toolName: tool.toolTemplateName,
          timestamp: tool.updatedAt.toISOString(),
        });
      }
    }

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const seen = new Set<string>();
    const deduped: any[] = [];
    for (const act of activities) {
      const key = act.type === 'completed'
        ? `completed-${act.moduleName}-${act.levelNumber}`
        : `updated-${act.toolName}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(act);
      }
      if (deduped.length >= limit) break;
    }

    return deduped;
  }

  async getKnowledgeArticles(): Promise<KnowledgeArticle[]> {
    return await db.select().from(knowledgeArticles);
  }

  async getKnowledgeArticle(id: number): Promise<KnowledgeArticle | undefined> {
    const [article] = await db.select().from(knowledgeArticles).where(eq(knowledgeArticles.id, id));
    return article;
  }

  async createKnowledgeArticle(data: InsertKnowledgeArticle): Promise<KnowledgeArticle> {
    const [article] = await db.insert(knowledgeArticles).values(data).returning();
    return article;
  }

  async updateKnowledgeArticle(id: number, data: Partial<InsertKnowledgeArticle>): Promise<KnowledgeArticle | undefined> {
    const [updated] = await db.update(knowledgeArticles).set({ ...data, updatedAt: new Date() }).where(eq(knowledgeArticles.id, id)).returning();
    return updated;
  }

  async deleteKnowledgeArticle(id: number): Promise<void> {
    await db.delete(knowledgeArticles).where(eq(knowledgeArticles.id, id));
  }

  async getKnowledgeArticlesForLevel(moduleId: number, level: number): Promise<KnowledgeArticle[]> {
    return await db.select().from(knowledgeArticles).where(
      and(
        eq(knowledgeArticles.moduleId, moduleId),
        lte(knowledgeArticles.levelMin, level),
        gte(knowledgeArticles.levelMax, level),
        eq(knowledgeArticles.isActive, true)
      )
    );
  }

  async getFoundationalArticles(): Promise<KnowledgeArticle[]> {
    return await db.select().from(knowledgeArticles).where(
      and(
        eq(knowledgeArticles.isFoundational, true),
        eq(knowledgeArticles.isActive, true)
      )
    );
  }

  async getChatMessages(startupId: number, userId: string, limit: number = 50): Promise<ChatMessage[]> {
    return await db.select().from(chatMessages).where(
      and(
        eq(chatMessages.startupId, startupId),
        eq(chatMessages.userId, userId)
      )
    ).orderBy(desc(chatMessages.createdAt)).limit(limit);
  }

  async saveChatMessage(data: InsertChatMessage): Promise<ChatMessage> {
    const [message] = await db.insert(chatMessages).values(data).returning();
    return message;
  }

  async clearChatHistory(startupId: number, userId: string): Promise<void> {
    await db.delete(chatMessages).where(
      and(
        eq(chatMessages.startupId, startupId),
        eq(chatMessages.userId, userId)
      )
    );
  }

  async getAssumptionById(id: number): Promise<Assumption | undefined> {
    const [result] = await db.select().from(assumptions).where(eq(assumptions.id, id));
    return result;
  }

  async getAssumptionsWithExperiments(startupId: number): Promise<AssumptionWithExperiments[]> {
    const allAssumptions = await db.select().from(assumptions)
      .where(eq(assumptions.startupId, startupId))
      .orderBy(assumptions.createdAt);
    
    if (allAssumptions.length === 0) return [];

    const assumptionIds = allAssumptions.map(a => a.id);
    const allExperiments = await db.select().from(experiments)
      .where(inArray(experiments.assumptionId, assumptionIds))
      .orderBy(experiments.createdAt);

    const expByAssumption = new Map<number, Experiment[]>();
    for (const exp of allExperiments) {
      const list = expByAssumption.get(exp.assumptionId) || [];
      list.push(exp);
      expByAssumption.set(exp.assumptionId, list);
    }

    const todayStr = new Date().toISOString().split("T")[0];
    return allAssumptions.map(a => {
      const exps = expByAssumption.get(a.id) || [];
      let computedStage: "belief" | "experiment" | "turn" = "belief";
      
      if (a.turnDecision) {
        computedStage = "turn";
      } else if (exps.length > 0) {
        const hasExpiredExperiment = exps.some(e => {
          if (!e.deadline) return false;
          const deadlineStr = new Date(e.deadline).toISOString().split("T")[0];
          return todayStr > deadlineStr;
        });
        computedStage = hasExpiredExperiment ? "turn" : "experiment";
      }

      return { ...a, experiments: exps, computedStage };
    });
  }

  async createAssumption(startupId: number, data: { hypothesis: string; source?: string; dimension?: string; confidence?: number; impactIfWrong?: number }): Promise<Assumption> {
    const [assumption] = await db.insert(assumptions).values({
      startupId,
      hypothesis: data.hypothesis,
      source: data.source || null,
      dimension: data.dimension || null,
      confidence: data.confidence ?? 50,
      impactIfWrong: data.impactIfWrong ?? 5,
      stage: "belief",
    }).returning();
    return assumption;
  }

  async updateAssumption(id: number, data: Partial<{ turnDecision: string; stage: string; suggestedDecision: string }>): Promise<Assumption | undefined> {
    const [updated] = await db.update(assumptions).set(data).where(eq(assumptions.id, id)).returning();
    return updated;
  }

  async deleteAssumption(id: number): Promise<void> {
    await db.delete(experiments).where(eq(experiments.assumptionId, id));
    await db.delete(assumptions).where(eq(assumptions.id, id));
  }

  async getExperimentsByAssumption(assumptionId: number): Promise<Experiment[]> {
    return db.select().from(experiments)
      .where(eq(experiments.assumptionId, assumptionId))
      .orderBy(experiments.createdAt);
  }

  async getExperimentById(id: number): Promise<Experiment | undefined> {
    const [row] = await db.select().from(experiments).where(eq(experiments.id, id));
    return row;
  }

  async updateExperiment(id: number, data: Partial<InsertExperiment>): Promise<Experiment> {
    const updates: Record<string, unknown> = {};
    if (data.technique !== undefined) updates.technique = data.technique;
    if (data.hypothesisIf !== undefined) updates.hypothesisIf = data.hypothesisIf;
    if (data.hypothesisThen !== undefined) updates.hypothesisThen = data.hypothesisThen;
    if (data.hypothesisBecause !== undefined) updates.hypothesisBecause = data.hypothesisBecause;
    if (data.successMetric !== undefined) updates.successMetric = data.successMetric;
    if (data.estimatedCost !== undefined) updates.estimatedCost = data.estimatedCost;
    if (data.duration !== undefined) updates.duration = data.duration;
    if (data.sampleSize !== undefined) updates.sampleSize = data.sampleSize;
    if (data.preCommitAnswer !== undefined) updates.preCommitAnswer = data.preCommitAnswer;
    if (data.actualMetricValue !== undefined) updates.actualMetricValue = data.actualMetricValue;
    if (data.actualOutcomeNotes !== undefined) updates.actualOutcomeNotes = data.actualOutcomeNotes;
    if (data.deadline !== undefined) updates.deadline = data.deadline;
    if (data.name !== undefined) updates.name = data.name;
    const [updated] = await db.update(experiments).set(updates).where(eq(experiments.id, id)).returning();
    return updated;
  }

  async createExperiment(assumptionId: number, data: InsertExperiment): Promise<Experiment> {
    const [experiment] = await db.insert(experiments).values({
      ...data,
      assumptionId,
    }).returning();
    await db.update(assumptions).set({ stage: "experiment" }).where(eq(assumptions.id, assumptionId));
    return experiment;
  }

  async syncKeyAssumptions(startupId: number, toolTemplateId: number, data: Record<string, unknown>): Promise<void> {
    const configs = await db.select().from(inlineToolConfigs)
      .where(
        and(
          eq(inlineToolConfigs.toolTemplateId, toolTemplateId),
          eq(inlineToolConfigs.isKeyAssumption, true),
          eq(inlineToolConfigs.layoutType, "fill_in_gaps"),
        )
      );

    if (configs.length === 0) return;

    const allConfigs = await db.select().from(inlineToolConfigs)
      .where(eq(inlineToolConfigs.toolTemplateId, toolTemplateId));
    const configRefs: InlineToolConfigRef[] = allConfigs.map(c => ({
      dataKey: c.dataKey,
      revisionOf: c.revisionOf as { dataKey: string; level: number } | null,
      toolTemplateId: c.toolTemplateId,
    }));

    for (const config of configs) {
      const dataKey = config.dataKey;
      const { data: resolvedData } = resolveLatestData(data, dataKey, configRefs);
      const rawEntries = resolvedData;
      if (!rawEntries || !Array.isArray(rawEntries)) continue;

      const templateSentence = config.templateSentence || "";
      const sourceTag = `inline_tool:${config.id}`;

      const existingAssumptions = await db.select().from(assumptions)
        .where(
          and(
            eq(assumptions.startupId, startupId),
            sql`${assumptions.source} LIKE ${sourceTag + ':%'}`,
          )
        );

      const existingByRowId = new Map<string, typeof existingAssumptions[0]>();
      for (const a of existingAssumptions) {
        if (a.source) {
          const parts = a.source.split(":");
          const rowId = parts.slice(2).join(":");
          existingByRowId.set(rowId, a);
        }
      }

      const seenRowIds = new Set<string>();

      for (const row of rawEntries) {
        if (!row || typeof row !== "object") continue;

        const rowId = row.id;
        if (!rowId || typeof rowId !== "string") continue;
        seenRowIds.add(rowId);

        const allFieldsFilled = Object.entries(row).every(([key, val]) => {
          if (key === "id" || key.startsWith("_")) return true;
          if (Array.isArray(val)) return val.length > 0;
          return val !== undefined && val !== null && String(val).trim() !== "";
        });
        if (!allFieldsFilled) continue;

        const formatValue = (val: unknown): string => {
          if (Array.isArray(val)) {
            const items = val.filter(v => v != null && String(v).trim() !== "").map(v => String(v).toLowerCase());
            if (items.length === 0) return "";
            if (items.length === 1) return items[0];
            return items.slice(0, -1).join(", ") + " & " + items[items.length - 1];
          }
          return String(val);
        };

        let hypothesis = templateSentence;
        const unmatchedParts: string[] = [];
        for (const [key, val] of Object.entries(row)) {
          if (key === "id" || key.startsWith("_")) continue;
          const formatted = formatValue(val);
          if (hypothesis.includes(`{${key}}`)) {
            hypothesis = hypothesis.replace(new RegExp(`\\{${key}\\}`, "g"), formatted);
          } else if (formatted) {
            unmatchedParts.push(formatted);
          }
        }
        if (unmatchedParts.length > 0) {
          const trailing = hypothesis.endsWith(":") ? " " : " — ";
          hypothesis = hypothesis.replace(/:$/, "") + trailing + unmatchedParts.join("; ");
        }
        hypothesis = hypothesis.trim();
        if (!hypothesis) continue;

        const fullSource = `${sourceTag}:${rowId}`;
        const existing = existingByRowId.get(rowId);

        if (existing) {
          const dimensionCode = config.stableKey ? config.stableKey.split(":")[0] : null;
          const needsUpdate = existing.hypothesis !== hypothesis || (!existing.dimension && dimensionCode);
          if (needsUpdate) {
            const updates: Record<string, unknown> = {};
            if (existing.hypothesis !== hypothesis) updates.hypothesis = hypothesis;
            if (!existing.dimension && dimensionCode) updates.dimension = dimensionCode;
            await db.update(assumptions)
              .set(updates)
              .where(eq(assumptions.id, existing.id));
          }
          existingByRowId.delete(rowId);
        } else {
          const dimensionCode = config.stableKey ? config.stableKey.split(":")[0] : null;
          await db.insert(assumptions).values({
            startupId,
            hypothesis,
            source: fullSource,
            dimension: dimensionCode,
            confidence: 50,
            impactIfWrong: 5,
            stage: "belief",
          });
        }
      }

      for (const [rowId, orphan] of existingByRowId) {
        if (seenRowIds.has(rowId)) continue;
        const hasExperiments = await db.select({ id: experiments.id })
          .from(experiments)
          .where(eq(experiments.assumptionId, orphan.id))
          .limit(1);
        if (hasExperiments.length === 0) {
          await db.delete(assumptions).where(eq(assumptions.id, orphan.id));
        }
      }
    }
  }

  async retroSyncKeyAssumptionsForConfig(configId: number): Promise<void> {
    const [config] = await db.select().from(inlineToolConfigs)
      .where(eq(inlineToolConfigs.id, configId));
    if (!config || !config.isKeyAssumption || config.layoutType !== "fill_in_gaps") return;

    const entries = await db.select().from(toolEntries)
      .where(eq(toolEntries.toolTemplateId, config.toolTemplateId));

    for (const entry of entries) {
      const data = entry.currentData as Record<string, unknown>;
      await this.syncKeyAssumptions(entry.startupId, config.toolTemplateId, data);
    }
  }

  async seedContent(): Promise<void> {
    const existingModules = await this.getModules();
    if (existingModules.length > 0) return;

    console.log("Seeding initial KTH content...");

    // 1. Modules
    const modulesData = [
        { name: "Customer", kthDimension: "CRL", description: "Confirm customer needs and market interest", icon: "Users", color: "hsl(var(--chart-1))", displayOrder: 1 },
        { name: "Technology", kthDimension: "TRL", description: "Develop and validate the product/service/technology", icon: "Cpu", color: "hsl(var(--chart-2))", displayOrder: 2 },
        { name: "Commercial Model", kthDimension: "BRL", description: "Establish financial, environmental, and social viability", icon: "Briefcase", color: "hsl(var(--chart-3))", displayOrder: 3 },
        { name: "Defensibility & Differentiation", kthDimension: "IPRL", description: "Clarify legal/IP landscape and secure protection", icon: "Shield", color: "hsl(var(--chart-4))", displayOrder: 4 },
        { name: "Team & Resources", kthDimension: "TMRL", description: "Secure competencies and align the founding team", icon: "Users2", color: "hsl(var(--chart-5))", displayOrder: 5 },
        { name: "Climate Impact", kthDimension: "CIRL", description: "Assess, quantify, and validate climate impact", icon: "Leaf", color: "hsl(var(--chart-7))", displayOrder: 6 },
        { name: "Funding", kthDimension: "FRL", description: "Secure necessary funding for market entry", icon: "DollarSign", color: "hsl(var(--primary))", displayOrder: 7 },
    ];

    const insertedModules = await db.insert(modules).values(modulesData).returning();

    const phases = ["Idea", "Idea", "Discovery", "Discovery", "Validation", "Validation", "Testing", "Testing", "Scaling"];

    const cirlContent = [
      { lvl: 1, title: "Climate impact thesis articulated", items: ["We have articulated a high-level climate impact thesis describing the environmental problem we address.","We have stated our motivation for pursuing climate impact (mission-driven, market opportunity, regulatory)."] },
      { lvl: 2, title: "Solution classified and lifecycle emissions scoped", items: ["We have classified our solution type (mitigation, adaptation, measurement, removal, enabling).","We have created an initial life-cycle emissions overview identifying key emission sources and sinks."] },
      { lvl: 3, title: "Effects inventory and incumbent baseline established", items: ["We have inventoried the direct and indirect effects of our solution on GHG emissions.","We have profiled the incumbent/baseline emissions our solution displaces or reduces.","We have a conceptual description of net unit impact (emission reduction or avoidance per unit of solution)."] },
      { lvl: 4, title: "Effects analysis and materiality assessment completed", items: ["We have analysed each solution effect with supporting data or engineering estimates.","We have completed a materiality assessment ranking effects by significance.","We have produced an initial quantitative estimate of net unit impact."] },
      { lvl: 5, title: "Net unit impact quantified and potential impact estimated", items: ["We have a rigorous quantification of net unit impact using primary data or validated models.","We have estimated potential impact by combining net unit impact with market size projections.","We have segmented impact by customer segment or use-case."] },
      { lvl: 6, title: "Impact projected and additionality assessed", items: ["We have projected net unit impact over time incorporating adoption curves and market dynamics.","We have assessed additionality — demonstrating impact would not occur without our solution.","We have crafted an impact narrative suitable for investor communications."] },
      { lvl: 7, title: "Planned impact model with validation evidence", items: ["We have a planned impact model integrating engineering data, market projections, and adoption assumptions.","We have gathered validation evidence (pilot data, third-party review, customer measurements).","We have identified adjustment factors and risks that could affect realised impact."] },
      { lvl: 8, title: "Impact assessment and KPI framework in place", items: ["We have completed a comprehensive impact assessment summary with methodology documentation.","We have selected impact metrics and KPIs aligned with recognised frameworks (GHG Protocol, IRIS+, SDGs).","We have an impact data collection plan defining sources, frequency, and responsibility."] },
      { lvl: 9, title: "Realised impact tracked and continuously improved", items: ["We have a realised impact dashboard showing actual measured impact against projections.","We have an impact reporting system producing investor-grade reports.","We have a verification and continuous improvement process including third-party review.","We maintain an impact model recalibration log updating assumptions based on real data."] },
    ];

    const kthContent: Record<string, { lvl: number; title: string; items: string[] }[]> = {
      "CRL": [
        { lvl: 1, title: "Hypothesis of possible market needs", items: ["We have a high-level assumptions about target customers and their needs (not yet specific or validated).","We have begun building basic knowledge of the market and customers/users (We have done some desk research on the market and problems faced by customers/users, but we have not yet talked to customers/users directly)"] },
        { lvl: 2, title: "Identified specific market needs", items: ["We have some market research (typically from secondary sources) showing evidence of a large addressable market.","We have brief familiarity with the market—possible customers and needs, and current alternatives.","We have an initial quantified description of the problem hypothesis for our target customer."] },
        { lvl: 3, title: "Market/Industry research & first direct market feedback", items: ["We have received feedback from initial primary market research (possible users/customers or experts with industry/market knowledge).","We have conducted systematic industry research from secondary sources to understand the sector, incumbents, and potential competitors.","We have conducted systematic market research from secondary sources showing an understanding of the potential market, including estimates of market/segment sizes.","We have a more developed understanding of possible customers and segments.","The problem/need hypothesis has been iterated using customer/user/expert feedback."] },
        { lvl: 4, title: "Confirmed problem/needs from primary research & understanding of the value chain", items: ["The problem/need and its importance is confirmed by multiple customers/users (≈30).","We understand the current value chain and the proposed location of our product/service within the chain.","We have market/customer segmentation with initial basic customer profiles in place.","We have identified the user, the paying customer, and the decision maker","We have defined a product/service hypothesis with clear positioning against market alternatives, based on customer/user feedback."] },
        { lvl: 5, title: "Established interest and relations with customers", items: ["Customers/users have expressed interest for the product/service and confirmed initial problem–solution fit.","We have developed a first sales pitch articulating the value proposition for the target market.","We have established relationships with potential target customers/users who provide input.","We have defined a value proposition adapted to the target customer/segment.","We have identified initial target market segments/customers."] },
        { lvl: 6, title: "Benefits confirmed by first customer testing", items: ["Customer/user testing has confirmed the value and benefits of our product/service.","We have iterated our value proposition and sales pitch based on customer/user feedback.","We have defined a first sales/user-acquisition process and initiated structured sales activities.","We have identified a hypothetical route to market and key partners/stakeholders relevant to reach customers/users."] },
        { lvl: 7, title: "Customers in extended testing, first test sales or small number of active users", items: ["We have customer agreements in place for first sales/test sales of early versions, with customers/users engaged in product/service qualification or extended testing.","We have a small number of active users of early versions who provide user feedback.","We have iterated our route to market and initiated discussions with partners to reach customers/users."] },
        { lvl: 8, title: "First commercial sales and implemented sales process - evidence of intial traction", items: ["We have sold a market-ready product/service to customers at or near the target market price.","We have a substantial number of active users of the market-ready product/service and evidence of repeat customers.","We have implemented a sales/user-acquisition process with dedicated people and supporting systems (e.g., CRM).","We have agreements in place with first partners to reach customers."] },
        { lvl: 9, title: "Widespread sales and scaling - significant customer traction", items: ["We have widespread product deployment with scalable, repeatable sales to several customers.","We have a large and substantially growing number of active users.","We are focused on business development: customer acquisition, growth of sales, and building user/customer demand."] },
      ],
      "TRL": [
        { lvl: 1, title: "Initial research results or initial technology idea identified", items: ["We have identified potential benefits or useful applications of the technology.","We have at least a vague idea of a technology to be developed."] },
        { lvl: 2, title: "Formulation of technology concept and/or application", items: ["We have defined and described the concept of the potential technology.","We have defined speculative practical applications (no proof or detailed analysis yet that the technology will work)."] },
        { lvl: 3, title: "Successful laboratory proof-of-concept of critical functions and/or characteristics", items: ["Laboratory tests of important parameters/features/functions show a feasible technology concept.","We have initiated active R&D to develop the technology.","We have an initial concept for end-user requirements/specifications and/or use cases."] },
        { lvl: 4, title: "Technology validation in laboratory", items: ["We have integrated basic components and shown them working together to produce desired results in the laboratory.","Our test results provide initial evidence validating the technology and show a significant improvement in key commercial KPI(s)."] },
        { lvl: 5, title: "Technology validation in a relevant environment", items: ["We have integrated and tested basic components in a more realistic form in a relevant environment.","Our test results validate the technology, and key commercial KPI(s) are on target.","We have more defined end-user requirements/specifications and/or use cases based on user feedback."] },
        { lvl: 6, title: "Technology prototype demonstration in relevant environment", items: ["We have shown a representative model or prototype that meets most important performance requirements in a relevant environment."] },
        { lvl: 7, title: "Technology prototype demonstration in operational environment", items: ["We have shown a prototype or the complete technology working in an operational environment.","We have complete end-user requirements/specifications and/or use cases in place."] },
        { lvl: 8, title: "Technology complete and proven to work in actual operations", items: ["We have a complete technology proven to work in actual operations by first users."] },
        { lvl: 9, title: "Technology complete and proven in actual operations over time", items: ["We have a complete, scalable technology proven to work in actual operations by several users over time.","We are conducting ongoing, continuous development to improve and optimise the technology and production."] },
      ],
      "BRL": [
        { lvl: 1, title: "Unclear hypothesis of possible business idea, market potential, and competition", items: ["We can state a preliminary business idea/value proposition or commercial model (not yet specific).","We have basic awareness of the market's potential/size and possible applications.","We have basic awareness of competition/industry and alternative solutions."] },
        { lvl: 2, title: "First hypothesis of possible business concept and identified overall market potential and competition", items: ["We have a structured description of the proposed business concept and value proposition.","We have brief familiarity (from secondary sources) with market size, segments, and the competitive landscape."] },
        { lvl: 3, title: "Description of sustainable business model and target market(s) (including competition)", items: ["We have a description of the proposed commercial model.","We describe relevant factors in the model that drive positive and negative environmental/sustainability contributions.","We have an estimate of market size and defined hypothesised target markets (TAM/SAM).","We have defined the competition and identified relevant inputs from the competitive landscape (positioning, business models, prices, etc.) to inform the model."] },
        { lvl: 4, title: "Economically viable business model Initial assessment of environmental and social sustainability", items: ["We have initial P&L projections for the proposed commercial model that indicate economic viability.","We have completed an initial assessment that indicates environmental and social sustainability."] },
        { lvl: 5, title: "Key assumptions of commercial model tested on market", items: ["We have received initial feedback on the revenue model from potential customers or experts with market knowledge.","We have received initial cost feedback from external partners/suppliers/experts.","We have specified key measures to increase environmental and social positive impact in the business model.","We have updated the P&L projection based on market feedback, and it indicates economic viability.","We have updated the target-market description (segments, TAM/SAM/SOM, competitive analysis) based on market feedback."] },
        { lvl: 6, title: "Commercial model shows economic viability (includes data from test sales)", items: ["We have tested the full commercial model in one or more realistic business scenarios.","We have full financial projections, based on feedback from realistic business cases, that show economic viability."] },
        { lvl: 7, title: "Viability of commercial model validated by initial commercial sales", items: ["Initial commercial sales/revenue on commercial terms demonstrate willingness to pay from a significant number of customers.","We have complete financial projections validated by first sales/revenue and associated data.","We have agreements in place with key suppliers, partners, and channel partners to execute the commercial model."] },
        { lvl: 8, title: "Sales and metrics confirm a viable commercial model with reliable margin estimates", items: ["We have metrics from initial business operations (1–3 years) that show a viable commercial model that can meet margin, scalability, and environmental & social impact expectations.","We have sales channels, revenue streams, and a supply chain in place and operational.","We iterate our commercial model to optimise margins and environmental & social performance."] },
        { lvl: 9, title: "Commercial model proven to meet expectations on profit, scalability and impact over time", items: ["Our commercial model is operational and the business meets or exceeds expectations on profit, growth, scalability, and environmental & social impact.","We operate credible systems and metrics that track economic, environmental, and social performance.","Historic data demonstrates the business is viable, profitable, and sustainable over time."] },
      ],
      "IPRL": [
        { lvl: 1, title: "Hypothesis of possible Defensibility/IPR & Differentiation", items: ["Hypothesis that results or ideas contain some form of IPR/defensibility Hypothesis on areas of differentiation","We recognise potential IPR/defensibility in our results or ideas and potential areas of differentiation.","We can provide a basic description of possible Intellectual Property Rights (IPR) and other aspects of defensibility.","We have at least limited awareness of relevant legal aspects (e.g., ownership, use-rights).","We have at least limited knowledge of the technical field, state of the art, and relevant publications."] },
        { lvl: 2, title: "Identified forms of Defensibility/IPR with ownership Identified target areas of Differentiation", items: ["We have mapped different forms of defensibility/IPR and differentiation that exist or could arise.","We have specific ideas for defensibility/IPR, even if not yet fully described.","We have identified IP-related agreements, clarified ownership/inventors/contributors, and understand applicable IP policies and legal requirements."] },
        { lvl: 3, title: "Detailed description of potential Defensibility/IPR & evaluation potential protection Detailed description of potential areas of differentiation", items: ["We have considered which forms of IPR are key and could/should be protected.","We have a sufficiently detailed description of defensibility/IPR to evaluate protectability, and a detailed description and mapping of differentiation areas.","We have evaluated protection possibilities based on initial searches and analysed differentiation areas.","We have conducted initial searches/analysis of relevant prior art or conflicting IPR and analysed potential differentiation based on current offerings/substitutes."] },
        { lvl: 4, title: "Confirmation & description of IPR protection Confirmation & description differentation and commercial relevance", items: ["Professional searches/analysis confirm possibilities for protecting key IPR.","We have developed an IPR strategy (priorities set) and a differentiation strategy with evidenced commercial relevance.","We have made an initial simple IPR filing (e.g., a provisional patent). (If applicable) We have an initial estimate of the scale required for network effects to provide defensibility."] },
        { lvl: 5, title: "Draft of IPR/Defensibility and Differentiation strategies Filed first formal application/registration of IPR", items: ["We have draft IPR/defensibility and differentiation strategies in place.","We have filed the first formal application/registration for key IPR.","We have basic agreements in place to secure control of key IPR."] },
        { lvl: 6, title: "First complete IPR/Definsibility and Differentiation strategies Positive response on filed IPR applications/registrations", items: ["We have complete IPR and differentiation strategies elaborated and validated.","We have identified potential complementary or additional IPR to protect.","We have completed an initial freedom-to-operate (FTO) assessment and understand the IPR landscape and potential barriers.","We have received at least one positive response on a filed IPR application/registration and analysed the response.","Where an IPR response was not positive, we have analysed it and prepared a response with good prospects of success."] },
        { lvl: 7, title: "Implementation of IPR/Defensibility Strategy Implementation of Differentiation strategy", items: ["We have entered the national/regional phase (patents) with completed key IPR applications/registrations.","We are implementing the differentiation strategy, including communications and supporting materials.","We have performed a deeper freedom-to-operate (FTO) assessment and understand dependencies on/restrictions by third-party IPR."] },
        { lvl: 8, title: "Defensibility/IPR strategy and management practices implemented Filed formal applications/registrations of complementary/additional IPR Differentiation strategy reviewed and updated", items: ["We have an IPR/defensibility strategy and management practices implemented and supporting the business, IPR-related agreements are professionally managed, with a process to secure new IPR in place.","Key IPR is granted in the first country/region with relevant scope for the business.","We have filed complementary or additional IPR applications/registrations.","We have reviewed and updated our differentiation strategy."] },
        { lvl: 9, title: "Strong IPR/Defensibility support and protection for business Differentiation strategy implelented with review/update process", items: ["Our IPR/defensibility and differentiation strategies support the business and create commercial value.","Key and complementary IPR is granted and maintained in several countries/regions.","We have agreements in place to access all necessary external IPR/defensibility."] },
      ],
      "TMRL": [
        { lvl: 1, title: "Lack of necessary competencies/resources to verify idea Little insight into team requirements", items: ["We can name the key competency gaps that remain unfilled in the team.","We can describe, at a basic level, the competencies and resources that will be required to verify and develop the idea."] },
        { lvl: 2, title: "Limited competencies/resources for idea verification Initial assessment of additional necessary competencies/resources", items: ["We have begun to assemble competencies and capacity/resources, though they are still limited.","We have completed an initial assessment of additional team competencies/resources required to verify/develop the idea.","We have an initial formulation of project goals/objectives."] },
        { lvl: 3, title: "Some necessary competencies/resources to verify/develop idea Defined required near-term competencies/resources", items: ["We have some of the necessary competencies/capacity and resources to verify/develop the idea.","Requirements for competencies, capacity and resources are identified.","An initial (<1 year) plan exists to secure the prioritised competencies and resources."] },
        { lvl: 4, title: "Business Lead present - clear direction of travel Several needed competencies/resources in place and plan to complement", items: ["The team shows clear commitment to the start-up.","At least one Business Lead is present.","Some necessary competencies/capacity and resources are in place.","A plan has been developed and initiated to obtain necessary additional competencies/capacity and resources.","The team has started discussions on roles, commitment, ownership, etc."] },
        { lvl: 5, title: "Initial founding team with main required competencies, capacity and resources. Team agrees on ownership, roles, goals and vision", items: ["We have an initial founding team with the required competencies and capacity, all contributing significant time, and the near-term minimum resources are in place.","The team is aligned: roles are clarified; goals and vision are shared; commitment is clear.","The team has agreed respective shareholdings (signed); ownership is balanced and incentivising, reflecting past and future contributions.","Activities are in progress to obtain additional competencies, capacity and resources.","Initial systems/processes/tools are in place to share knowledge and information within the team."] },
        { lvl: 6, title: "Complementary, diverse, and committed founding team with all necessary competencies, capacity and resources to begin building the business.", items: ["A complementary and diverse founding team is in place with minimum resources, capable of starting to build the business.","We have all key near-term competencies and capacity in place, including a clearly designated CEO, and the minimum required resources are present.","The team is committed; everyone feels responsibility and accountability.","We have initiated recruitment of advisors and/or board members.","We are aware of risks to team performance from resource constraints.","We are aware of internal risks to team performance (e.g., conflicts, politics, conflicting priorities)."] },
        { lvl: 7, title: "Well-functioning management team and positive culture Medium term growth plan for expanding team, building organisation and acquiring resources", items: ["We have a well-functioning management team with clear roles.","Goals, vision, purpose, and culture are clearly articulated and documented to support team and organisational development.","We have a medium-term (~2 years) plan in place to build the organisation, acquire resources, and grow the team.","Processes/systems and a plan for continuous learning and staff development are implemented.","The board and advisors are operational and support business and organisational development."] },
        { lvl: 8, title: "Professional organisation - Board, CEO, management & staff - with required utilised resources", items: ["We have clear leadership and a management team with relevant professional experience, and our business-critical resources are in place and well utilised.","A competent, diverse board and relevant advisors are in place and used professionally.","HR policies/processes (and an HR owner) are in place to assure good HR practices and team diversity.","We have a medium-term recruitment and resource plan to acquire the required competencies, capacity, and other critical resources.","All levels of the organisation are properly trained and motivated."] },
        { lvl: 9, title: "High performing, well-structured organisation at all levels that is maintained, develops and performs over time", items: ["We operate a high-performing, well-functioning organisation and achieve a high level of resource utilisation that contributes to business success.","All levels of the organisation are actively engaged in continuous learning and development.","Our culture, structure, processes and resources are continuously improved and developed.","Incentives and rewards are aligned to motivate the whole organisation to reach goals and perform well.","The management team is maintained, developed, and performs over time."] },
      ],
      "FRL": [
        { lvl: 1, title: "No clear description of initial verification activities No clear view of initial funding needs and funding options", items: ["We recognise the core activities we must verify and that funding will be required to do so.","We are aware, at a basic level, that multiple funding options exist and that we need to explore them further."] },
        { lvl: 2, title: "Description of initial verification activities Defined funding need and sources for initial milestones", items: ["We have identified initial activities and costs to verify the potential/feasibility of the idea (1–6 months).","We have a basic plan with funding options for initial milestones (1–6 months)."] },
        { lvl: 3, title: "Funding secured for initial verification plan", items: ["We have secured sufficient funding for initial verification/feasibility activities (1–6 months).","We understand the pros and cons of different funding types."] },
        { lvl: 4, title: "Funding secured for commercial verification plan", items: ["We have a commercial-potential verification plan (3–12 months).","We have identified relevant funding sources for this plan.","We have secured funding to implement a substantial portion of the verification plan."] },
        { lvl: 5, title: "First pitch tested on relevant audience Defined near term funding requirement and developed funding strategy", items: ["We have iterated our funding pitch after testing it with a relevant audience.","We have an initial 12-month P&L budget and cash-flow forecast, and we have tested the initial pitch deck with a relevant audience.","We have a funding strategy with identified sources consistent with a viable commercial model.","We understand the requirements and consequences of external funding for our commercial model, control, and ownership."] },
        { lvl: 6, title: "Iterated pitch by testing on relevant audience Initiated contacts with relevant external funders", items: ["We have iterated our pitch with a relevant audience and initiated contacts with relevant funders.","We have a 3–5 year P&L budget and cash-flow model that clarifies near- and medium-term funding requirements."] },
        { lvl: 7, title: "Initial discussions with potential external funders Full pitch and supporting material ready", items: ["We are in term-sheet discussions with potential external funders.","We have a fully tested pitch and business plan with financial projections, milestones, and deliverables, and our data room contains all documents required for initial due diligence.","Basic accounting systems and documentation are in place, and the data room meets the minimum documentation standard."] },
        { lvl: 8, title: "Concrete negotiations with one or more external funders who show clear interest", items: ["We are in concrete negotiations (beyond term-sheet stage) with one or more external funders who show clear interest.","All required supporting materials/documents for external funding are in place.","Our legal entity is correctly established with a clear cap table and ownership structure suitable for the planned funding source.","All key legal, IPR, financial, and operational documents and agreements are organised in a data room and available for due diligence (DD)."] },
        { lvl: 9, title: "Secured funding for nest stage of Operations Financial monitoring and forecasting system fully implemented.", items: ["We have secured funding for the next stage of development with a defined runway aligned to the current business plan.","We have a fully implemented financial monitoring/bookkeeping system for real-time control, budgeting, and forecasting."] },
      ],
      "CIRL": cirlContent,
    };

    for (const mod of insertedModules) {
        const dimContent = kthContent[mod.kthDimension!] || [];
        for (let i = 1; i <= 9; i++) {
            const content = dimContent.find(c => c.lvl === i);
            const [level] = await db.insert(levels).values({
                moduleId: mod.id,
                levelNumber: i,
                title: content?.title || `${mod.kthDimension} Level ${i}`,
                description: `Focus on moving from ${phases[i-1]} phase.`,
                phaseLabel: phases[i-1],
            }).returning();

            const itemLabels = content?.items || [`Confirm hypothesis for Level ${i}`, `Validate assumptions for Level ${i}`, `Document findings for Level ${i}`];
            await db.insert(checklistItems).values(
                itemLabels.map((label, idx) => ({ levelId: level.id, label, displayOrder: idx + 1 }))
            );
        }
    }

    // 4. Tools
    const insertedTools = await db.insert(toolTemplates).values([
        { name: "Lean Canvas", description: "A one-page business model framework to help you deconstruct your idea into key assumptions.", toolType: "canvas", fieldDefinitions: [], layoutConfig: {} },
        {
          name: "Customer profiles",
          description: "Customer profile from the Value Proposition Canvas. Define customer jobs, pains, and gains for each customer segment.",
          toolType: "card",
          fieldDefinitions: [
            { id: "customerJobs", type: "textarea", label: "Customer Jobs", helpText: "What tasks are your customers trying to get done? What functional, social, or emotional jobs are they trying to perform?", placeholder: "List the jobs your customer is trying to accomplish..." },
            { id: "pains", type: "textarea", label: "Pains", helpText: "What annoys your customers? What risks do they fear? What obstacles stand in their way?", placeholder: "What frustrations, risks, or obstacles do they face?" },
            { id: "gains", type: "textarea", label: "Gains", helpText: "What outcomes and benefits do your customers want? What would delight them? What would make their job easier?", placeholder: "What results and benefits do they desire?" },
          ],
          layoutConfig: {},
        },
        {
          name: "Pitch Deck Builder",
          description: "Build your investor pitch deck using the Sequoia Capital template. Auto-populates from your Lean Canvas and Customer Profile data.",
          toolType: "pitchdeck",
          fieldDefinitions: [
            { id: "companyPurpose", type: "textarea", label: "Company Purpose", helpText: "Define the company in a single declarative sentence. What do you do?", placeholder: "We help [target customer] to [solve problem] by [solution]..." },
            { id: "problem", type: "textarea", label: "Problem", helpText: "Describe the pain of the customer. How is the problem addressed today, and what are the shortcomings of current solutions?", placeholder: "What pain point are you solving? How do customers deal with it today?" },
            { id: "solution", type: "textarea", label: "Solution", helpText: "Demonstrate your value proposition. Show the before/after. Describe the qualitative improvement.", placeholder: "How does your product/service solve the problem? What makes it compelling?" },
            { id: "whyNow", type: "textarea", label: "Why Now", helpText: "Why is now the right time? What recent changes (technology, regulation, market) create this opportunity?", placeholder: "What has changed to make this possible and urgent now?" },
            { id: "marketSize", type: "textarea", label: "Market Size", helpText: "Identify your TAM, SAM and SOM. Show bottom-up analysis.", placeholder: "TAM: ...\nSAM: ...\nSOM: ..." },
            { id: "product", type: "textarea", label: "Product", helpText: "Describe your product/service in detail. Include features, functionality and a development roadmap.", placeholder: "Describe your product. Key features, tech stack, roadmap..." },
            { id: "businessModel", type: "textarea", label: "Business Model", helpText: "Describe your revenue model and pricing strategy. How do you make money?", placeholder: "How do you charge? Subscription, licensing, transaction fees?" },
            { id: "competition", type: "textarea", label: "Competition", helpText: "List your competitors and show your competitive advantages. What makes you different and defensible?", placeholder: "Who are your competitors? What is your unfair advantage?" },
            { id: "team", type: "textarea", label: "Team", helpText: "Key team members, their relevant experience, and why this is the team to win.", placeholder: "Founders, key hires, relevant experience, advisors..." },
            { id: "financials", type: "textarea", label: "Financials", helpText: "Key financial projections: revenue, costs, margins, and key assumptions.", placeholder: "Revenue projections, burn rate, unit economics..." },
            { id: "askFunding", type: "textarea", label: "The Ask", helpText: "How much are you raising, what will you use it for, and what milestones will it achieve?", placeholder: "Raising amount, use of funds, key milestones..." },
          ],
          layoutConfig: {},
        },
        {
          name: "Value Proposition Canvas",
          description: "Map your value proposition against customer needs. Connect your products, pain relievers, and gain creators to customer jobs, pains, and gains.",
          toolType: "vpc",
          fieldDefinitions: [],
          layoutConfig: {},
        },
        {
          name: "Techno-Economic Assessment",
          description: "A simplified techno-economic model for early-stage DeepTech startups. Define your unit economics, estimate costs at scale, and identify your top cost drivers — all in one interactive tool.",
          toolType: "tea",
          fieldDefinitions: [
            { id: "productName", type: "text", label: "Product / Output Name", section: "product", helpText: "What is the main product or output of your technology?", placeholder: "e.g. Green hydrogen, Bio-based polymer, Carbon-negative cement..." },
            { id: "functionalUnit", type: "text", label: "Functional Unit", section: "product", helpText: "The unit you measure your product in (cost will be calculated per this unit).", placeholder: "e.g. kg, kWh, ton, litre, unit..." },
            { id: "annualVolume", type: "number", label: "Target Annual Production Volume", section: "product", helpText: "How many units do you aim to produce per year at commercial scale?", placeholder: "e.g. 1000" },
            { id: "rawMaterials", type: "items", label: "Raw Materials & Feedstock", section: "rawMaterials", columns: ["name", "costPerUnit", "unitsPerOutput"], helpText: "List each raw material input, its cost per unit, and quantity needed per functional unit of output." },
            { id: "energy", type: "items", label: "Energy & Utilities", section: "energy", columns: ["name", "costPerUnit", "unitsPerOutput"], helpText: "List energy and utility inputs (electricity, heat, water, etc.)." },
            { id: "laborCount", type: "number", label: "Number of Operators / Staff", section: "labor", helpText: "How many people are needed to run operations at target scale?", placeholder: "e.g. 5" },
            { id: "avgSalary", type: "number", label: "Average Annual Salary", section: "labor", helpText: "Average fully-loaded annual salary per person (including benefits).", placeholder: "e.g. 45000" },
            { id: "equipment", type: "items", label: "Key Equipment", section: "capex", columns: ["name", "cost", "lifetimeYears"], helpText: "List your major equipment items with estimated purchase cost and useful lifetime." },
            { id: "installationFactor", type: "number", label: "Installation Factor", section: "capex", helpText: "Multiplier for installation, piping, instrumentation (typically 2-6x for DeepTech). Applied to total equipment cost.", placeholder: "e.g. 3" },
            { id: "maintenancePct", type: "number", label: "Annual Maintenance (% of CapEx)", section: "otherOpex", helpText: "Typical range: 3-8% of total installed CapEx per year.", placeholder: "e.g. 5" },
            { id: "otherAnnualCosts", type: "number", label: "Other Annual Costs", section: "otherOpex", helpText: "Rent, insurance, waste disposal, consumables, etc. combined.", placeholder: "e.g. 50000" },
            { id: "marketPrice", type: "number", label: "Current Market Price (per unit)", section: "market", helpText: "What does the incumbent or alternative product sell for per unit today?", placeholder: "e.g. 5.00" },
            { id: "targetPrice", type: "number", label: "Your Target Selling Price (per unit)", section: "market", helpText: "The price you plan to sell at. Should be competitive with or below market price.", placeholder: "e.g. 4.50" },
            { id: "assumptions", type: "textarea", label: "Key Assumptions & Notes", section: "notes", helpText: "Record the basis for your estimates so you can refine them later.", placeholder: "Document your key assumptions, data sources, and any caveats about this analysis..." },
          ],
          layoutConfig: {},
        },
        {
          name: "Competitor Analysis Matrix",
          description: "Map your competitive landscape with an interactive matrix. Track competitors' technology approach, funding, IP status, and positioning — tailored for DeepTech/ClimateTech markets.",
          toolType: "competitor",
          fieldDefinitions: [],
          layoutConfig: null,
        },
        {
          name: "TAM/SAM/SOM Calculator",
          description: "Calculate your Total Addressable Market using both top-down and bottom-up methods. Visualise market sizing with concentric circles — built for DeepTech/ClimateTech market analysis.",
          toolType: "tamsam",
          fieldDefinitions: [],
          layoutConfig: null,
        },
        {
          name: "SWOT Analysis",
          description: "Structured strengths, weaknesses, opportunities, and threats analysis with ClimateTech-specific prompts. Includes a strategy matrix mapping SO/ST/WO/WT actions.",
          toolType: "swot",
          fieldDefinitions: [],
          layoutConfig: null,
        },
        {
          name: "IP Strategy Canvas",
          description: "Plan your intellectual property strategy with an asset inventory, patent vs trade secret decision matrix, protection timeline, and freedom-to-operate assessment.",
          toolType: "ipstrategy",
          fieldDefinitions: [],
          layoutConfig: null,
        },
        {
          name: "Team Competency Matrix",
          description: "Assess your team's skills across technical and commercial competencies. Identify gaps, plan hires, and visualise team readiness with a colour-coded skills grid.",
          toolType: "teammatrix",
          fieldDefinitions: [],
          layoutConfig: null,
        },
        {
          name: "Financial Projections",
          description: "Build your P&L and cash flow projections with multi-year revenue, cost, and CapEx modelling. Auto-calculates burn rate, runway, gross margin, and break-even point.",
          toolType: "financial",
          fieldDefinitions: [],
          layoutConfig: null,
        },
        {
          name: "Funding Strategy Planner",
          description: "Plan your fundraising with a capital needs timeline, funding sources matrix, round planning, and investor tracker — designed for the complex ClimateTech capital stack.",
          toolType: "fundingstrategy",
          fieldDefinitions: [],
          layoutConfig: null,
        },
        {
          name: "Sales Deck Builder",
          description: "Build a compelling sales deck to pitch your product/service to potential customers. Different from the fundraising Pitch Deck — this focuses on the customer buying journey.",
          toolType: "salesdeck",
          fieldDefinitions: [],
          layoutConfig: null,
        },
    ]).returning();

    // 5. Link tools to levels
    const leanCanvasTool = insertedTools.find(t => t.name === "Lean Canvas");
    const customerProfileTool = insertedTools.find(t => t.name === "Customer profiles");
    const pitchDeckTool = insertedTools.find(t => t.name === "Pitch Deck Builder");
    const teaTool = insertedTools.find(t => t.name === "Techno-Economic Assessment");
    const competitorTool = insertedTools.find(t => t.name === "Competitor Analysis Matrix");
    const tamTool = insertedTools.find(t => t.name === "TAM/SAM/SOM Calculator");
    const swotTool = insertedTools.find(t => t.name === "SWOT Analysis");
    const ipTool = insertedTools.find(t => t.name === "IP Strategy Canvas");
    const teamTool = insertedTools.find(t => t.name === "Team Competency Matrix");
    const financialTool = insertedTools.find(t => t.name === "Financial Projections");
    const fundingTool = insertedTools.find(t => t.name === "Funding Strategy Planner");
    const salesDeckTool = insertedTools.find(t => t.name === "Sales Deck Builder");

    const customerModule = insertedModules.find(m => m.kthDimension === "CRL");
    const technologyModule = insertedModules.find(m => m.kthDimension === "TRL");
    const commercialModule = insertedModules.find(m => m.kthDimension === "BRL");
    const iprModule = insertedModules.find(m => m.kthDimension === "IPRL");
    const teamModule = insertedModules.find(m => m.kthDimension === "TMRL");
    const fundingModule = insertedModules.find(m => m.kthDimension === "FRL");

    const allSeededLevels = await db.select().from(levels);
    const levelToolInserts: { levelId: number; toolTemplateId: number; displayOrder: number }[] = [];

    for (const lvl of allSeededLevels) {
      if (customerModule && lvl.moduleId === customerModule.id && lvl.levelNumber <= 6) {
        if (leanCanvasTool) levelToolInserts.push({ levelId: lvl.id, toolTemplateId: leanCanvasTool.id, displayOrder: 1 });
        if (customerProfileTool) levelToolInserts.push({ levelId: lvl.id, toolTemplateId: customerProfileTool.id, displayOrder: 2 });
      }
      if (customerModule && lvl.moduleId === customerModule.id && lvl.levelNumber >= 3 && lvl.levelNumber <= 7) {
        if (competitorTool) levelToolInserts.push({ levelId: lvl.id, toolTemplateId: competitorTool.id, displayOrder: 5 });
        if (tamTool) levelToolInserts.push({ levelId: lvl.id, toolTemplateId: tamTool.id, displayOrder: 6 });
      }
      if (commercialModule && lvl.moduleId === commercialModule.id && lvl.levelNumber >= 3) {
        if (swotTool) levelToolInserts.push({ levelId: lvl.id, toolTemplateId: swotTool.id, displayOrder: 5 });
      }
      if (commercialModule && lvl.moduleId === commercialModule.id && lvl.levelNumber >= 5) {
        if (pitchDeckTool) levelToolInserts.push({ levelId: lvl.id, toolTemplateId: pitchDeckTool.id, displayOrder: 3 });
      }
      if (commercialModule && lvl.moduleId === commercialModule.id && lvl.levelNumber >= 4 && lvl.levelNumber <= 7) {
        if (teaTool) levelToolInserts.push({ levelId: lvl.id, toolTemplateId: teaTool.id, displayOrder: 4 });
      }
      if (iprModule && lvl.moduleId === iprModule.id && lvl.levelNumber >= 2) {
        if (ipTool) levelToolInserts.push({ levelId: lvl.id, toolTemplateId: ipTool.id, displayOrder: 1 });
      }
      if (teamModule && lvl.moduleId === teamModule.id && lvl.levelNumber >= 2) {
        if (teamTool) levelToolInserts.push({ levelId: lvl.id, toolTemplateId: teamTool.id, displayOrder: 1 });
      }
      if (fundingModule && lvl.moduleId === fundingModule.id && lvl.levelNumber >= 3) {
        if (fundingTool) levelToolInserts.push({ levelId: lvl.id, toolTemplateId: fundingTool.id, displayOrder: 1 });
      }
      if (fundingModule && lvl.moduleId === fundingModule.id && lvl.levelNumber >= 4) {
        if (pitchDeckTool) levelToolInserts.push({ levelId: lvl.id, toolTemplateId: pitchDeckTool.id, displayOrder: 3 });
        if (financialTool) levelToolInserts.push({ levelId: lvl.id, toolTemplateId: financialTool.id, displayOrder: 2 });
      }
      if (technologyModule && lvl.moduleId === technologyModule.id && lvl.levelNumber >= 4 && lvl.levelNumber <= 7) {
        if (teaTool) levelToolInserts.push({ levelId: lvl.id, toolTemplateId: teaTool.id, displayOrder: 4 });
      }
      if (customerModule && lvl.moduleId === customerModule.id && lvl.levelNumber >= 5) {
        if (salesDeckTool) levelToolInserts.push({ levelId: lvl.id, toolTemplateId: salesDeckTool.id, displayOrder: 7 });
      }
    }

    if (levelToolInserts.length > 0) {
      await db.insert(levelTools).values(levelToolInserts);
    }

    // 6. Learning resources (videos)
    if (customerModule) {
      const customerLevels = await db.select().from(levels).where(eq(levels.moduleId, customerModule.id));
      const custLevel1 = customerLevels.find(l => l.levelNumber === 1);
      if (custLevel1) {
        await db.update(levels).set({
          videoUrl: "https://www.youtube.com/watch?v=xr2zFXblSRM",
          learningContent: `• Start with your Business Model Canvas — write out your hypotheses using sticky notes (not pens!) because most will change
• There are no facts inside the building — get out and talk to real customers, partners, and vendors
• Customer development is not random; design experiments, run tests, collect data, and extract insights
• The process has four steps:
  1. Customer Discovery — form your hypotheses and test whether others share the problem you think exists
  2. Customer Validation — check if your proposed solution actually matches the real customer problem (this is "product-market fit")
  3. Customer Creation — once you have a repeatable model, drive end-user demand and scale
  4. Company Building — transition from discovery mode into a functional organisation built for execution
• The "pivot" is your safety net — when your hypothesis is wrong, pivot to a new direction based on what you learned
• The goal of discovery and validation is to search for a repeatable, scalable business model before scaling up
• Move away from guessing and instead test your core assumptions as early as possible`,
        }).where(eq(levels.id, custLevel1.id));
      }
    }

    console.log("Seeding complete.");
  }

  async seedMilestoneData(): Promise<void> {
    const existingCategories = await db.select().from(milestoneCategories);
    if (existingCategories.length === 0) {
      console.log("Seeding milestone categories...");
      await db.insert(milestoneCategories).values([
        { value: "general", label: "General", gradient: "from-violet-500 to-purple-600", accentColor: "purple", displayOrder: 0 },
        { value: "technical", label: "Technical", gradient: "from-blue-500 to-indigo-600", accentColor: "blue", displayOrder: 1 },
        { value: "commercial", label: "Commercial", gradient: "from-emerald-500 to-teal-600", accentColor: "emerald", displayOrder: 2 },
        { value: "funding", label: "Funding", gradient: "from-amber-500 to-orange-600", accentColor: "amber", displayOrder: 3 },
        { value: "team", label: "Team", gradient: "from-rose-500 to-pink-600", accentColor: "rose", displayOrder: 4 },
        { value: "ip", label: "IP & Defensibility", gradient: "from-cyan-500 to-blue-600", accentColor: "cyan", displayOrder: 5 },
      ]);
    }

    const existingStages = await db.select().from(milestoneStages);
    if (existingStages.length === 0) {
      console.log("Seeding milestone stages...");
      await db.insert(milestoneStages).values([
        { value: "early", label: "Discovery", description: "Explore and define your opportunity", displayOrder: 0 },
        { value: "validation", label: "Validation", description: "Test assumptions and prove value", displayOrder: 1 },
        { value: "growth", label: "Growth", description: "Scale what works", displayOrder: 2 },
        { value: "ongoing", label: "Ongoing", description: "Complete at any stage", displayOrder: 3 },
      ]);
    } else if (!existingStages.find(s => s.value === "ongoing")) {
      await db.insert(milestoneStages).values({ value: "ongoing", label: "Ongoing", description: "Complete at any stage", displayOrder: 3 });
    }

    const existingGroups = await db.select().from(milestoneGroups);
    if (existingGroups.length === 0) {
      console.log("Seeding milestone groups...");
      await db.insert(milestoneGroups).values([
        { title: "Technology Discovery", description: "Initial discovery of the technology in the lab", stage: "early", displayOrder: 1, accentColor: "purple" },
        { title: "Customer Discovery", description: null, stage: "early", displayOrder: 2, accentColor: "violet" },
        { title: "Proof of Concept", description: null, stage: "validation", displayOrder: 3, accentColor: "blue" },
        { title: "Commercial Pilots", description: null, stage: "validation", displayOrder: 4, accentColor: "teal" },
        { title: "Scale-up", description: null, stage: "growth", displayOrder: 5, accentColor: "emerald" },
      ]);
    }

    const existingMilestones = await db.select().from(milestones);
    if (existingMilestones.length === 0) {
      console.log("Seeding milestones...");
      const allGroups = await db.select().from(milestoneGroups);
      const techDiscoveryGroup = allGroups.find(g => g.title === "Technology Discovery");
      const customerDiscoveryGroup = allGroups.find(g => g.title === "Customer Discovery");
      const commercialPilotsGroup = allGroups.find(g => g.title === "Commercial Pilots");

      await db.insert(milestones).values([
        {
          title: "Technical research",
          description: "",
          tagline: "Do basic technology research",
          stage: "early",
          icon: "Cpu",
          gradient: "from-violet-500 to-purple-600",
          accentColor: "purple",
          category: "general",
          requirements: { "Funding": 0, "Customer": 0, "Technology": 1, "Commercial Model": 0, "Team & Resources": 0, "Defensibility & Differentiation": 0 },
          dependencies: [],
          groupId: techDiscoveryGroup?.id || null,
          displayOrder: 1,
        },
        {
          title: "Validate basic technology in the lab",
          description: "",
          tagline: "Run at least one experiment to show that the technology can work in a lab environment",
          stage: "early",
          icon: "Cpu",
          gradient: "from-violet-500 to-purple-600",
          accentColor: "purple",
          category: "general",
          requirements: { "Funding": 0, "Customer": 0, "Technology": 2, "Commercial Model": 0, "Team & Resources": 0, "Defensibility & Differentiation": 0 },
          dependencies: [],
          groupId: techDiscoveryGroup?.id || null,
          displayOrder: 2,
        },
        {
          title: "Initial Customer Interview",
          description: "",
          tagline: null,
          stage: "early",
          icon: "UserCheck",
          gradient: "from-violet-500 to-purple-600",
          accentColor: "violet",
          category: "general",
          requirements: { "Funding": 0, "Customer": 3, "Technology": 0, "Commercial Model": 0, "Team & Resources": 0, "Defensibility & Differentiation": 0 },
          dependencies: [],
          groupId: customerDiscoveryGroup?.id || null,
          displayOrder: 0,
        },
        {
          title: "Validate Customer Demand",
          description: "",
          tagline: "Demonstrate that you understand your market and customers.",
          stage: "early",
          icon: "UserCheck",
          gradient: "from-emerald-500 to-teal-600",
          accentColor: "violet",
          category: "commercial",
          requirements: { "Funding": 0, "Customer": 4, "Technology": 0, "Commercial Model": 0, "Team & Resources": 0, "Defensibility & Differentiation": 0 },
          dependencies: [],
          groupId: customerDiscoveryGroup?.id || null,
          displayOrder: 0,
        },
        {
          title: "Investor Readiness (Pre-seed)",
          description: "Demonstrate sufficient readiness across all dimensions to raise pre-seed funding from investors.",
          tagline: "Prove you're ready across all dimensions — then we'll connect you with investors.",
          stage: "ongoing",
          icon: "Banknote",
          gradient: "from-violet-500 to-purple-600",
          accentColor: "violet",
          category: "general",
          requirements: { "Funding": 6, "Customer": 5, "Technology": 3, "Commercial Model": 4, "Team & Resources": 4, "Defensibility & Differentiation": 4 },
          dependencies: [],
          groupId: null,
          displayOrder: 6,
        },
        {
          title: "Secure First Pilot",
          description: "Sign a formal pilot agreement with a customer willing to test your product in a real environment.",
          tagline: "Show you're prepared to deliver value to a real customer.",
          stage: "validation",
          icon: "Cpu",
          gradient: "from-teal-500 to-cyan-600",
          accentColor: "teal",
          category: "general",
          requirements: { "Funding": 0, "Customer": 5, "Technology": 5, "Commercial Model": 4, "Team & Resources": 4, "Defensibility & Differentiation": 3 },
          dependencies: [],
          groupId: commercialPilotsGroup?.id || null,
          displayOrder: 7,
        },
        {
          title: "Build your investor network",
          description: "",
          tagline: "Start building connections with potential investors for your next round",
          stage: "ongoing",
          icon: "Banknote",
          gradient: "from-violet-500 to-purple-600",
          accentColor: "purple",
          category: "general",
          requirements: { "Funding": 0, "Customer": 0, "Technology": 0, "Commercial Model": 0, "Team & Resources": 0, "Defensibility & Differentiation": 0 },
          dependencies: [],
          groupId: null,
          displayOrder: 0,
        },
      ]);
    }

    const existingRewards = await db.select().from(rewards);
    if (existingRewards.length === 0) {
      console.log("Seeding rewards...");
      const allMilestones = await db.select().from(milestones);
      const allGroups = await db.select().from(milestoneGroups);

      const validateMilestone = allMilestones.find(m => m.title === "Validate Customer Demand");
      const investorReadiness = allMilestones.find(m => m.title === "Investor Readiness (Pre-seed)");
      const techDiscoveryGroup = allGroups.find(g => g.title === "Technology Discovery");
      const customerDiscoveryGroup = allGroups.find(g => g.title === "Customer Discovery");

      const rewardValues: any[] = [];
      if (validateMilestone) {
        rewardValues.push({
          name: "Get matched to a mentor",
          description: "Get matched to a mentor to support you for 6 months",
          type: "custom",
          icon: "Star",
          significance: "medium",
          accentColor: "teal",
          requiredMissionIds: [validateMilestone.id],
          requiredGroupIds: [],
          metadata: { actionDescription: "You will receive an email with booking instructions." },
          createdBy: "system",
        });
      }
      if (investorReadiness) {
        rewardValues.push({
          name: "Access to Investor Introductions",
          description: "Get matched with relevant investors from our network based on your readiness profile.",
          type: "investor_intro",
          icon: "Handshake",
          significance: "medium",
          accentColor: "purple",
          requiredMissionIds: [investorReadiness.id],
          requiredGroupIds: [],
          metadata: { tier: "Silver" },
          createdBy: "system",
        });
      }
      if (customerDiscoveryGroup) {
        rewardValues.push({
          name: "£10k grant",
          description: "Unlock a £10k validation grant after proving initial customer demand and securing your first pilot.",
          type: "grant_payment",
          icon: "Banknote",
          significance: "high",
          accentColor: "amber",
          requiredMissionIds: [],
          requiredGroupIds: [customerDiscoveryGroup.id],
          metadata: { amount: 10000, currency: "GBP" },
          createdBy: "system",
        });
      }
      if (techDiscoveryGroup) {
        rewardValues.push({
          name: "Qualify for Greenhouse Bootcamp",
          description: "",
          type: "custom",
          icon: "Gift",
          significance: "low",
          accentColor: "purple",
          requiredMissionIds: [],
          requiredGroupIds: [techDiscoveryGroup.id],
          metadata: {},
          createdBy: "system",
        });
      }
      if (rewardValues.length > 0) {
        await db.insert(rewards).values(rewardValues);
      }
    }

    await this.seedDefaultProgrammes();
    await this.backfillModuleAccess();
    await this.backfillLevelTools();

    console.log("Milestone and programme seeding complete.");
  }

  private async seedDefaultProgrammes(): Promise<void> {
    const programmeConfigs = [
      { name: "General", description: "Default programme for all existing startups", features: ["readiness_dimensions", "investor_matching", "ai_coach"], assignAllStartups: true },
      { name: "The Greenhouse", description: null, features: ["readiness_dimensions", "investor_matching", "ai_coach"], assignAllStartups: false },
      { name: "Undaunted Alumni", description: null, features: ["investor_matching"], assignAllStartups: false },
    ];

    for (const config of programmeConfigs) {
      let [programme] = await db.select().from(programmes).where(eq(programmes.name, config.name)).limit(1);

      if (!programme) {
        console.log(`Creating programme: ${config.name}...`);
        [programme] = await db.insert(programmes).values({
          name: config.name,
          description: config.description,
          createdById: "system",
        }).returning();
      }

      const existingFeatures = await db.select().from(programmeFeatures)
        .where(eq(programmeFeatures.programmeId, programme.id));
      const existingKeys = new Set(existingFeatures.map(f => f.featureKey));
      for (const key of config.features) {
        if (!existingKeys.has(key)) {
          await db.insert(programmeFeatures).values({
            programmeId: programme.id,
            featureKey: key,
            enabled: true,
          });
        }
      }

      if (config.assignAllStartups) {
        const allStartups = await db.select().from(startups);
        const assignedStartups = await db.select().from(programmeStartups)
          .where(eq(programmeStartups.programmeId, programme.id));
        const assignedIds = new Set(assignedStartups.map(ps => ps.startupId));

        for (const startup of allStartups) {
          if (!assignedIds.has(startup.id)) {
            try {
              await db.insert(programmeStartups).values({
                programmeId: programme.id,
                startupId: startup.id,
              });
            } catch (e: any) {
              if (!e.message?.includes('duplicate')) throw e;
            }
          }
        }
      }
    }

    await this.seedCohortAndGroup();
    await this.normalizeSprintLabels();
  }

  private async seedCohortAndGroup(): Promise<void> {
    const [greenhouse] = await db.select().from(programmes).where(eq(programmes.name, "The Greenhouse")).limit(1);
    if (!greenhouse) return;

    const cohort10StartDate = new Date("2026-06-17T00:00:00Z");
    const existingCohorts = await db.select().from(cohorts).where(eq(cohorts.programmeId, greenhouse.id));
    let cohort10 = existingCohorts.find(c => c.name === "Cohort 10");

    if (!cohort10) {
      console.log("Seeding cohort and group for The Greenhouse...");
      const [created] = await db.insert(cohorts).values({
        name: "Cohort 10",
        programmeId: greenhouse.id,
        description: null,
        startDate: cohort10StartDate,
        createdBy: "system",
      }).returning();
      cohort10 = created;
      await db.insert(groups).values({
        name: "Coaching Group 1",
        cohortId: cohort10.id,
        description: null,
        createdBy: "system",
      });
    } else if (!cohort10.startDate) {
      await db.update(cohorts).set({ startDate: cohort10StartDate }).where(eq(cohorts.id, cohort10.id));
      console.log("Backfilled Cohort 10 start date for The Greenhouse");
    }
  }

  // One-off: strip trailing " foundation" suffix from sprint labels so existing
  // rows display the cleaner dimension name. Idempotent.
  private async normalizeSprintLabels(): Promise<void> {
    const rows = await db.select().from(sprints).where(eq(sprints.phaseKey, "foundation"));
    for (const row of rows) {
      const cleaned = row.label.replace(/\s+foundation$/i, "");
      if (cleaned !== row.label) {
        await db.update(sprints).set({ label: cleaned }).where(eq(sprints.id, row.id));
      }
    }
  }

  private async backfillModuleAccess(): Promise<void> {
    const allStartups = await db.select().from(startups);
    const coreModules = await db.select().from(modules).where(
      sql`${modules.kthDimension} IN ('CRL', 'TRL', 'BRL', 'IPRL', 'TMRL', 'FRL')`
    );

    if (coreModules.length === 0 || allStartups.length === 0) return;

    for (const startup of allStartups) {
      const existingAccess = await db.select().from(startupModuleAccess)
        .where(eq(startupModuleAccess.startupId, startup.id));
      if (existingAccess.length >= coreModules.length) continue;

      const existingModuleIds = new Set(existingAccess.map(a => a.moduleId));
      for (const mod of coreModules) {
        if (!existingModuleIds.has(mod.id)) {
          try {
            await db.insert(startupModuleAccess).values({
              startupId: startup.id,
              moduleId: mod.id,
              grantedBy: "system",
            });
          } catch (e: any) {
            if (!e.message?.includes('duplicate')) throw e;
          }
        }
      }
      console.log(`Backfilled module access for startup ${startup.id} (${startup.name})`);
    }
  }

  private async backfillLevelTools(): Promise<void> {
    const allTools = await db.select().from(toolTemplates);
    const allModules = await db.select().from(modules);
    const allLevels = await db.select().from(levels);
    const existingLevelTools = await db.select().from(levelTools);

    const toolByType = new Map(allTools.map(t => [t.toolType, t]));
    const moduleByDim = new Map(allModules.map(m => [m.kthDimension, m]));
    const levelLookup = (dim: string, levelNum: number) => {
      const mod = moduleByDim.get(dim);
      if (!mod) return null;
      return allLevels.find(l => l.moduleId === mod.id && l.levelNumber === levelNum) || null;
    };

    const existingSet = new Set(
      existingLevelTools.map(lt => `${lt.levelId}-${lt.toolTemplateId}`)
    );

    type LevelToolSpec = { dim: string; level: number; toolType: string; order: number };
    const specs: LevelToolSpec[] = [
      // BRL (Commercial Model / Business Model)
      { dim: "BRL", level: 1, toolType: "canvas", order: 0 },
      { dim: "BRL", level: 2, toolType: "canvas", order: 0 },
      { dim: "BRL", level: 2, toolType: "competitor", order: 2 },
      { dim: "BRL", level: 3, toolType: "canvas", order: 0 },
      { dim: "BRL", level: 3, toolType: "competitor", order: 2 },
      { dim: "BRL", level: 3, toolType: "tamsam", order: 3 },
      { dim: "BRL", level: 3, toolType: "swot", order: 4 },
      { dim: "BRL", level: 4, toolType: "canvas", order: 0 },
      { dim: "BRL", level: 4, toolType: "competitor", order: 2 },
      { dim: "BRL", level: 4, toolType: "tea", order: 2 },
      { dim: "BRL", level: 4, toolType: "tamsam", order: 3 },
      { dim: "BRL", level: 4, toolType: "swot", order: 4 },
      { dim: "BRL", level: 4, toolType: "financial", order: 5 },
      { dim: "BRL", level: 5, toolType: "canvas", order: 0 },
      { dim: "BRL", level: 5, toolType: "tea", order: 2 },
      { dim: "BRL", level: 5, toolType: "tamsam", order: 3 },
      { dim: "BRL", level: 5, toolType: "pitchdeck", order: 3 },
      { dim: "BRL", level: 5, toolType: "swot", order: 4 },
      { dim: "BRL", level: 5, toolType: "financial", order: 5 },
      { dim: "BRL", level: 6, toolType: "canvas", order: 0 },
      { dim: "BRL", level: 6, toolType: "tea", order: 2 },
      { dim: "BRL", level: 6, toolType: "financial", order: 2 },
      { dim: "BRL", level: 6, toolType: "pitchdeck", order: 3 },
      { dim: "BRL", level: 7, toolType: "canvas", order: 0 },
      { dim: "BRL", level: 7, toolType: "tea", order: 2 },
      { dim: "BRL", level: 7, toolType: "financial", order: 2 },
      { dim: "BRL", level: 7, toolType: "pitchdeck", order: 3 },
      { dim: "BRL", level: 8, toolType: "canvas", order: 0 },
      { dim: "BRL", level: 8, toolType: "pitchdeck", order: 3 },
      { dim: "BRL", level: 9, toolType: "canvas", order: 0 },
      { dim: "BRL", level: 9, toolType: "pitchdeck", order: 3 },
      // CRL (Customer)
      { dim: "CRL", level: 1, toolType: "canvas", order: 0 },
      { dim: "CRL", level: 1, toolType: "card", order: 1 },
      { dim: "CRL", level: 2, toolType: "canvas", order: 0 },
      { dim: "CRL", level: 2, toolType: "card", order: 1 },
      { dim: "CRL", level: 2, toolType: "vpc", order: 1 },
      { dim: "CRL", level: 2, toolType: "competitor", order: 3 },
      { dim: "CRL", level: 2, toolType: "tamsam", order: 4 },
      { dim: "CRL", level: 3, toolType: "canvas", order: 0 },
      { dim: "CRL", level: 3, toolType: "vpc", order: 1 },
      { dim: "CRL", level: 3, toolType: "card", order: 1 },
      { dim: "CRL", level: 3, toolType: "competitor", order: 3 },
      { dim: "CRL", level: 3, toolType: "tamsam", order: 4 },
      { dim: "CRL", level: 3, toolType: "swot", order: 5 },
      { dim: "CRL", level: 4, toolType: "canvas", order: 0 },
      { dim: "CRL", level: 4, toolType: "vpc", order: 1 },
      { dim: "CRL", level: 4, toolType: "card", order: 1 },
      { dim: "CRL", level: 4, toolType: "competitor", order: 3 },
      { dim: "CRL", level: 4, toolType: "tamsam", order: 4 },
      { dim: "CRL", level: 4, toolType: "swot", order: 5 },
      { dim: "CRL", level: 5, toolType: "canvas", order: 0 },
      { dim: "CRL", level: 5, toolType: "card", order: 1 },
      { dim: "CRL", level: 5, toolType: "vpc", order: 1 },
      { dim: "CRL", level: 5, toolType: "swot", order: 5 },
      { dim: "CRL", level: 6, toolType: "canvas", order: 0 },
      { dim: "CRL", level: 6, toolType: "card", order: 1 },
      { dim: "CRL", level: 7, toolType: "canvas", order: 0 },
      { dim: "CRL", level: 8, toolType: "canvas", order: 0 },
      { dim: "CRL", level: 9, toolType: "canvas", order: 0 },
      // FRL (Funding)
      { dim: "FRL", level: 2, toolType: "fundingstrategy", order: 2 },
      { dim: "FRL", level: 3, toolType: "fundingstrategy", order: 2 },
      { dim: "FRL", level: 4, toolType: "fundingstrategy", order: 2 },
      { dim: "FRL", level: 4, toolType: "pitchdeck", order: 3 },
      { dim: "FRL", level: 5, toolType: "financial", order: 2 },
      { dim: "FRL", level: 5, toolType: "fundingstrategy", order: 3 },
      { dim: "FRL", level: 5, toolType: "pitchdeck", order: 3 },
      { dim: "FRL", level: 6, toolType: "financial", order: 2 },
      { dim: "FRL", level: 6, toolType: "pitchdeck", order: 3 },
      { dim: "FRL", level: 6, toolType: "fundingstrategy", order: 3 },
      { dim: "FRL", level: 7, toolType: "financial", order: 2 },
      { dim: "FRL", level: 7, toolType: "fundingstrategy", order: 3 },
      { dim: "FRL", level: 7, toolType: "pitchdeck", order: 3 },
      { dim: "FRL", level: 8, toolType: "pitchdeck", order: 3 },
      { dim: "FRL", level: 9, toolType: "pitchdeck", order: 3 },
      // IPRL (Defensibility & Differentiation / IPR)
      ...Array.from({ length: 9 }, (_, i) => ({ dim: "IPRL", level: i + 1, toolType: "ipstrategy", order: 1 })),
      // TMRL (Team & Resources / Team)
      ...Array.from({ length: 7 }, (_, i) => ({ dim: "TMRL", level: i + 1, toolType: "teammatrix", order: 1 })),
      // TRL (Technology)
      { dim: "TRL", level: 3, toolType: "swot", order: 2 },
      { dim: "TRL", level: 4, toolType: "tea", order: 1 },
      { dim: "TRL", level: 4, toolType: "swot", order: 2 },
      { dim: "TRL", level: 5, toolType: "tea", order: 1 },
      { dim: "TRL", level: 5, toolType: "swot", order: 2 },
      { dim: "TRL", level: 6, toolType: "tea", order: 1 },
      { dim: "TRL", level: 7, toolType: "tea", order: 1 },
    ];

    const toInsert: { levelId: number; toolTemplateId: number; displayOrder: number }[] = [];
    for (const spec of specs) {
      const lvl = levelLookup(spec.dim, spec.level);
      const tool = toolByType.get(spec.toolType);
      if (!lvl || !tool) continue;
      const key = `${lvl.id}-${tool.id}`;
      if (!existingSet.has(key)) {
        toInsert.push({ levelId: lvl.id, toolTemplateId: tool.id, displayOrder: spec.order });
      }
    }

    if (toInsert.length > 0) {
      console.log(`Backfilling ${toInsert.length} missing level_tools entries...`);
      for (const row of toInsert) {
        try {
          await db.insert(levelTools).values(row);
        } catch (e: any) {
          if (!e.message?.includes('duplicate')) throw e;
        }
      }
    }

    const validSet = new Set<string>();
    for (const spec of specs) {
      const lvl = levelLookup(spec.dim, spec.level);
      const tool = toolByType.get(spec.toolType);
      if (lvl && tool) validSet.add(`${lvl.id}-${tool.id}`);
    }
    const toRemove = existingLevelTools.filter(lt => !validSet.has(`${lt.levelId}-${lt.toolTemplateId}`));
    if (toRemove.length > 0) {
      console.log(`Removing ${toRemove.length} stale level_tools entries...`);
      for (const row of toRemove) {
        await db.delete(levelTools).where(
          and(eq(levelTools.levelId, row.levelId), eq(levelTools.toolTemplateId, row.toolTemplateId))
        );
      }
    }
  }

  async normalizeModuleNames(): Promise<void> {
    const renames: Record<string, string> = {
      "Business Model": "Commercial Model",
      "IPR": "Defensibility & Differentiation",
      "Team": "Team & Resources",
    };

    const allModules = await db.select().from(modules);
    for (const mod of allModules) {
      const newName = renames[mod.name];
      if (newName) {
        console.log(`Renaming module "${mod.name}" → "${newName}"`);
        await db.update(modules).set({ name: newName }).where(eq(modules.id, mod.id));
      }
    }
  }

  async backfillProgrammeFeatures(): Promise<void> {
    const ALL_FEATURE_KEYS = ["dashboard", "readiness_dimensions", "tool_repository", "investor_matching", "ai_coach", "experiment_tracker", "events", "my_journey"];
    const allProgs = await db.select().from(programmes);
    for (const prog of allProgs) {
      const existing = await db.select().from(programmeFeatures).where(eq(programmeFeatures.programmeId, prog.id));
      if (existing.length > 0 && existing.length < ALL_FEATURE_KEYS.length) {
        const existingKeys = new Set(existing.map(f => f.featureKey));
        const enabledKeys = new Set(existing.filter(f => f.enabled).map(f => f.featureKey));
        for (const key of ALL_FEATURE_KEYS) {
          if (!existingKeys.has(key)) {
            const shouldEnable = key === "experiment_tracker"
              ? enabledKeys.has("readiness_dimensions")
              : enabledKeys.size >= 3;
            console.log(`Backfilling feature "${key}" = ${shouldEnable} for programme "${prog.name}" (id=${prog.id})`);
            await db.insert(programmeFeatures).values({ programmeId: prog.id, featureKey: key, enabled: shouldEnable }).onConflictDoNothing();
          }
        }
      }
    }
  }

  async backfillCirlModule(): Promise<void> {
    const allModules = await db.select().from(modules);
    if (allModules.length === 0) return;

    let cirlMod = allModules.find(m => m.kthDimension === 'CIRL');

    if (!cirlMod) {
      console.log("Backfilling CIRL module...");
      const [inserted] = await db.insert(modules).values({
        name: "Climate Impact", kthDimension: "CIRL",
        description: "Assess, quantify, and validate climate impact",
        icon: "Leaf", color: "hsl(var(--chart-7))", displayOrder: 7,
      }).returning();
      cirlMod = inserted;

      const phases = ["Idea", "Idea", "Discovery", "Discovery", "Validation", "Validation", "Testing", "Testing", "Scaling"];
      const cirlContent = [
        { lvl: 1, title: "Climate impact thesis articulated", items: ["We have articulated a high-level climate impact thesis describing the environmental problem we address.","We have stated our motivation for pursuing climate impact (mission-driven, market opportunity, regulatory)."] },
        { lvl: 2, title: "Solution classified and lifecycle emissions scoped", items: ["We have classified our solution type (mitigation, adaptation, measurement, removal, enabling).","We have created an initial life-cycle emissions overview identifying key emission sources and sinks."] },
        { lvl: 3, title: "Effects inventory and incumbent baseline established", items: ["We have inventoried the direct and indirect effects of our solution on GHG emissions.","We have profiled the incumbent/baseline emissions our solution displaces or reduces.","We have a conceptual description of net unit impact (emission reduction or avoidance per unit of solution)."] },
        { lvl: 4, title: "Effects analysis and materiality assessment completed", items: ["We have analysed each solution effect with supporting data or engineering estimates.","We have completed a materiality assessment ranking effects by significance.","We have produced an initial quantitative estimate of net unit impact."] },
        { lvl: 5, title: "Net unit impact quantified and potential impact estimated", items: ["We have a rigorous quantification of net unit impact using primary data or validated models.","We have estimated potential impact by combining net unit impact with market size projections.","We have segmented impact by customer segment or use-case."] },
        { lvl: 6, title: "Impact projected and additionality assessed", items: ["We have projected net unit impact over time incorporating adoption curves and market dynamics.","We have assessed additionality — demonstrating impact would not occur without our solution.","We have crafted an impact narrative suitable for investor communications."] },
        { lvl: 7, title: "Planned impact model with validation evidence", items: ["We have a planned impact model integrating engineering data, market projections, and adoption assumptions.","We have gathered validation evidence (pilot data, third-party review, customer measurements).","We have identified adjustment factors and risks that could affect realised impact."] },
        { lvl: 8, title: "Impact assessment and KPI framework in place", items: ["We have completed a comprehensive impact assessment summary with methodology documentation.","We have selected impact metrics and KPIs aligned with recognised frameworks (GHG Protocol, IRIS+, SDGs).","We have an impact data collection plan defining sources, frequency, and responsibility."] },
        { lvl: 9, title: "Realised impact tracked and continuously improved", items: ["We have a realised impact dashboard showing actual measured impact against projections.","We have an impact reporting system producing investor-grade reports.","We have a verification and continuous improvement process including third-party review.","We maintain an impact model recalibration log updating assumptions based on real data."] },
      ];

      for (let i = 1; i <= 9; i++) {
        const content = cirlContent.find(c => c.lvl === i);
        const [level] = await db.insert(levels).values({
          moduleId: cirlMod.id,
          levelNumber: i,
          title: content?.title || `CIRL Level ${i}`,
          description: `Focus on moving from ${phases[i-1]} phase.`,
          phaseLabel: phases[i-1],
        }).returning();

        const itemLabels = content?.items || [`Confirm hypothesis for Level ${i}`, `Validate assumptions for Level ${i}`, `Document findings for Level ${i}`];
        await db.insert(checklistItems).values(
          itemLabels.map((label, idx) => ({ levelId: level.id, label, displayOrder: idx + 1 }))
        );
      }
      console.log("CIRL module created.");
    }

    const cirlEnabled = await this.getSystemSetting('cirl_enabled');
    if (cirlEnabled === 'false') return;

    const allStartups = await db.select({ id: startups.id }).from(startups);
    const existingAccess = await db.select().from(startupModuleAccess)
      .where(eq(startupModuleAccess.moduleId, cirlMod.id));
    const accessSet = new Set(existingAccess.map(a => a.startupId));
    let granted = 0;
    for (const s of allStartups) {
      if (!accessSet.has(s.id)) {
        await db.insert(startupModuleAccess).values({ startupId: s.id, moduleId: cirlMod.id, grantedBy: "system" });
        granted++;
      }
    }
    if (granted > 0) console.log(`CIRL module access granted to ${granted} startups.`);
  }

  async upgradeGenericContent(): Promise<void> {
    const existingModules = await this.getModules();
    if (existingModules.length === 0) return;

    const firstLevel = await db.select().from(levels).limit(1);
    if (firstLevel.length === 0) return;
    const isGeneric = /^(CRL|TRL|BRL|IPRL|TMRL|FRL|CIRL) Level \d+$/.test(firstLevel[0].title);
    if (!isGeneric) return;

    console.log("Upgrading generic placeholder content to real KTH readiness levels...");

    const kthContent: Record<string, { lvl: number; title: string; items: string[] }[]> = {
      "CRL": [
        { lvl: 1, title: "Hypothesis of possible market needs", items: ["We have a high-level assumptions about target customers and their needs (not yet specific or validated).","We have begun building basic knowledge of the market and customers/users (We have done some desk research on the market and problems faced by customers/users, but we have not yet talked to customers/users directly)"] },
        { lvl: 2, title: "Identified specific market needs", items: ["We have some market research (typically from secondary sources) showing evidence of a large addressable market.","We have brief familiarity with the market—possible customers and needs, and current alternatives.","We have an initial quantified description of the problem hypothesis for our target customer."] },
        { lvl: 3, title: "Market/Industry research & first direct market feedback", items: ["We have received feedback from initial primary market research (possible users/customers or experts with industry/market knowledge).","We have conducted systematic industry research from secondary sources to understand the sector, incumbents, and potential competitors.","We have conducted systematic market research from secondary sources showing an understanding of the potential market, including estimates of market/segment sizes.","We have a more developed understanding of possible customers and segments.","The problem/need hypothesis has been iterated using customer/user/expert feedback."] },
        { lvl: 4, title: "Confirmed problem/needs from primary research & understanding of the value chain", items: ["The problem/need and its importance is confirmed by multiple customers/users (≈30).","We understand the current value chain and the proposed location of our product/service within the chain.","We have market/customer segmentation with initial basic customer profiles in place.","We have identified the user, the paying customer, and the decision maker","We have defined a product/service hypothesis with clear positioning against market alternatives, based on customer/user feedback."] },
        { lvl: 5, title: "Established interest and relations with customers", items: ["Customers/users have expressed interest for the product/service and confirmed initial problem–solution fit.","We have developed a first sales pitch articulating the value proposition for the target market.","We have established relationships with potential target customers/users who provide input.","We have defined a value proposition adapted to the target customer/segment.","We have identified initial target market segments/customers."] },
        { lvl: 6, title: "Benefits confirmed by first customer testing", items: ["Customer/user testing has confirmed the value and benefits of our product/service.","We have iterated our value proposition and sales pitch based on customer/user feedback.","We have defined a first sales/user-acquisition process and initiated structured sales activities.","We have identified a hypothetical route to market and key partners/stakeholders relevant to reach customers/users."] },
        { lvl: 7, title: "Customers in extended testing, first test sales or small number of active users", items: ["We have customer agreements in place for first sales/test sales of early versions, with customers/users engaged in product/service qualification or extended testing.","We have a small number of active users of early versions who provide user feedback.","We have iterated our route to market and initiated discussions with partners to reach customers/users."] },
        { lvl: 8, title: "First commercial sales and implemented sales process - evidence of intial traction", items: ["We have sold a market-ready product/service to customers at or near the target market price.","We have a substantial number of active users of the market-ready product/service and evidence of repeat customers.","We have implemented a sales/user-acquisition process with dedicated people and supporting systems (e.g., CRM).","We have agreements in place with first partners to reach customers."] },
        { lvl: 9, title: "Widespread sales and scaling - significant customer traction", items: ["We have widespread product deployment with scalable, repeatable sales to several customers.","We have a large and substantially growing number of active users.","We are focused on business development: customer acquisition, growth of sales, and building user/customer demand."] },
      ],
      "TRL": [
        { lvl: 1, title: "Initial research results or initial technology idea identified", items: ["We have identified potential benefits or useful applications of the technology.","We have at least a vague idea of a technology to be developed."] },
        { lvl: 2, title: "Formulation of technology concept and/or application", items: ["We have defined and described the concept of the potential technology.","We have defined speculative practical applications (no proof or detailed analysis yet that the technology will work)."] },
        { lvl: 3, title: "Successful laboratory proof-of-concept of critical functions and/or characteristics", items: ["Laboratory tests of important parameters/features/functions show a feasible technology concept.","We have initiated active R&D to develop the technology.","We have an initial concept for end-user requirements/specifications and/or use cases."] },
        { lvl: 4, title: "Technology validation in laboratory", items: ["We have integrated basic components and shown them working together to produce desired results in the laboratory.","Our test results provide initial evidence validating the technology and show a significant improvement in key commercial KPI(s)."] },
        { lvl: 5, title: "Technology validation in a relevant environment", items: ["We have integrated and tested basic components in a more realistic form in a relevant environment.","Our test results validate the technology, and key commercial KPI(s) are on target.","We have more defined end-user requirements/specifications and/or use cases based on user feedback."] },
        { lvl: 6, title: "Technology prototype demonstration in relevant environment", items: ["We have shown a representative model or prototype that meets most important performance requirements in a relevant environment."] },
        { lvl: 7, title: "Technology prototype demonstration in operational environment", items: ["We have shown a prototype or the complete technology working in an operational environment.","We have complete end-user requirements/specifications and/or use cases in place."] },
        { lvl: 8, title: "Technology complete and proven to work in actual operations", items: ["We have a complete technology proven to work in actual operations by first users."] },
        { lvl: 9, title: "Technology complete and proven in actual operations over time", items: ["We have a complete, scalable technology proven to work in actual operations by several users over time.","We are conducting ongoing, continuous development to improve and optimise the technology and production."] },
      ],
      "BRL": [
        { lvl: 1, title: "Unclear hypothesis of possible business idea, market potential, and competition", items: ["We can state a preliminary business idea/value proposition or commercial model (not yet specific).","We have basic awareness of the market's potential/size and possible applications.","We have basic awareness of competition/industry and alternative solutions."] },
        { lvl: 2, title: "First hypothesis of possible business concept and identified overall market potential and competition", items: ["We have a structured description of the proposed business concept and value proposition.","We have brief familiarity (from secondary sources) with market size, segments, and the competitive landscape."] },
        { lvl: 3, title: "Description of sustainable business model and target market(s) (including competition)", items: ["We have a description of the proposed commercial model.","We describe relevant factors in the model that drive positive and negative environmental/sustainability contributions.","We have an estimate of market size and defined hypothesised target markets (TAM/SAM).","We have defined the competition and identified relevant inputs from the competitive landscape (positioning, business models, prices, etc.) to inform the model."] },
        { lvl: 4, title: "Economically viable business model Initial assessment of environmental and social sustainability", items: ["We have initial P&L projections for the proposed commercial model that indicate economic viability.","We have completed an initial assessment that indicates environmental and social sustainability."] },
        { lvl: 5, title: "Key assumptions of commercial model tested on market", items: ["We have received initial feedback on the revenue model from potential customers or experts with market knowledge.","We have received initial cost feedback from external partners/suppliers/experts.","We have specified key measures to increase environmental and social positive impact in the business model.","We have updated the P&L projection based on market feedback, and it indicates economic viability.","We have updated the target-market description (segments, TAM/SAM/SOM, competitive analysis) based on market feedback."] },
        { lvl: 6, title: "Commercial model shows economic viability (includes data from test sales)", items: ["We have tested the full commercial model in one or more realistic business scenarios.","We have full financial projections, based on feedback from realistic business cases, that show economic viability."] },
        { lvl: 7, title: "Viability of commercial model validated by initial commercial sales", items: ["Initial commercial sales/revenue on commercial terms demonstrate willingness to pay from a significant number of customers.","We have complete financial projections validated by first sales/revenue and associated data.","We have agreements in place with key suppliers, partners, and channel partners to execute the commercial model."] },
        { lvl: 8, title: "Sales and metrics confirm a viable commercial model with reliable margin estimates", items: ["We have metrics from initial business operations (1–3 years) that show a viable commercial model that can meet margin, scalability, and environmental & social impact expectations.","We have sales channels, revenue streams, and a supply chain in place and operational.","We iterate our commercial model to optimise margins and environmental & social performance."] },
        { lvl: 9, title: "Commercial model proven to meet expectations on profit, scalability and impact over time", items: ["Our commercial model is operational and the business meets or exceeds expectations on profit, growth, scalability, and environmental & social impact.","We operate credible systems and metrics that track economic, environmental, and social performance.","Historic data demonstrates the business is viable, profitable, and sustainable over time."] },
      ],
      "IPRL": [
        { lvl: 1, title: "Hypothesis of possible Defensibility/IPR & Differentiation", items: ["Hypothesis that results or ideas contain some form of IPR/defensibility Hypothesis on areas of differentiation","We recognise potential IPR/defensibility in our results or ideas and potential areas of differentiation.","We can provide a basic description of possible Intellectual Property Rights (IPR) and other aspects of defensibility.","We have at least limited awareness of relevant legal aspects (e.g., ownership, use-rights).","We have at least limited knowledge of the technical field, state of the art, and relevant publications."] },
        { lvl: 2, title: "Identified forms of Defensibility/IPR with ownership Identified target areas of Differentiation", items: ["We have mapped different forms of defensibility/IPR and differentiation that exist or could arise.","We have specific ideas for defensibility/IPR, even if not yet fully described.","We have identified IP-related agreements, clarified ownership/inventors/contributors, and understand applicable IP policies and legal requirements."] },
        { lvl: 3, title: "Detailed description of potential Defensibility/IPR & evaluation potential protection Detailed description of potential areas of differentiation", items: ["We have considered which forms of IPR are key and could/should be protected.","We have a sufficiently detailed description of defensibility/IPR to evaluate protectability, and a detailed description and mapping of differentiation areas.","We have evaluated protection possibilities based on initial searches and analysed differentiation areas.","We have conducted initial searches/analysis of relevant prior art or conflicting IPR and analysed potential differentiation based on current offerings/substitutes."] },
        { lvl: 4, title: "Confirmation & description of IPR protection Confirmation & description differentation and commercial relevance", items: ["Professional searches/analysis confirm possibilities for protecting key IPR.","We have developed an IPR strategy (priorities set) and a differentiation strategy with evidenced commercial relevance.","We have made an initial simple IPR filing (e.g., a provisional patent). (If applicable) We have an initial estimate of the scale required for network effects to provide defensibility."] },
        { lvl: 5, title: "Draft of IPR/Defensibility and Differentiation strategies Filed first formal application/registration of IPR", items: ["We have draft IPR/defensibility and differentiation strategies in place.","We have filed the first formal application/registration for key IPR.","We have basic agreements in place to secure control of key IPR."] },
        { lvl: 6, title: "First complete IPR/Definsibility and Differentiation strategies Positive response on filed IPR applications/registrations", items: ["We have complete IPR and differentiation strategies elaborated and validated.","We have identified potential complementary or additional IPR to protect.","We have completed an initial freedom-to-operate (FTO) assessment and understand the IPR landscape and potential barriers.","We have received at least one positive response on a filed IPR application/registration and analysed the response.","Where an IPR response was not positive, we have analysed it and prepared a response with good prospects of success."] },
        { lvl: 7, title: "Implementation of IPR/Defensibility Strategy Implementation of Differentiation strategy", items: ["We have entered the national/regional phase (patents) with completed key IPR applications/registrations.","We are implementing the differentiation strategy, including communications and supporting materials.","We have performed a deeper freedom-to-operate (FTO) assessment and understand dependencies on/restrictions by third-party IPR."] },
        { lvl: 8, title: "Defensibility/IPR strategy and management practices implemented Filed formal applications/registrations of complementary/additional IPR Differentiation strategy reviewed and updated", items: ["We have an IPR/defensibility strategy and management practices implemented and supporting the business, IPR-related agreements are professionally managed, with a process to secure new IPR in place.","Key IPR is granted in the first country/region with relevant scope for the business.","We have filed complementary or additional IPR applications/registrations.","We have reviewed and updated our differentiation strategy."] },
        { lvl: 9, title: "Strong IPR/Defensibility support and protection for business Differentiation strategy implelented with review/update process", items: ["Our IPR/defensibility and differentiation strategies support the business and create commercial value.","Key and complementary IPR is granted and maintained in several countries/regions.","We have agreements in place to access all necessary external IPR/defensibility."] },
      ],
      "TMRL": [
        { lvl: 1, title: "Lack of necessary competencies/resources to verify idea Little insight into team requirements", items: ["We can name the key competency gaps that remain unfilled in the team.","We can describe, at a basic level, the competencies and resources that will be required to verify and develop the idea."] },
        { lvl: 2, title: "Limited competencies/resources for idea verification Initial assessment of additional necessary competencies/resources", items: ["We have begun to assemble competencies and capacity/resources, though they are still limited.","We have completed an initial assessment of additional team competencies/resources required to verify/develop the idea.","We have an initial formulation of project goals/objectives."] },
        { lvl: 3, title: "Some necessary competencies/resources to verify/develop idea Defined required near-term competencies/resources", items: ["We have some of the necessary competencies/capacity and resources to verify/develop the idea.","Requirements for competencies, capacity and resources are identified.","An initial (<1 year) plan exists to secure the prioritised competencies and resources."] },
        { lvl: 4, title: "Business Lead present - clear direction of travel Several needed competencies/resources in place and plan to complement", items: ["The team shows clear commitment to the start-up.","At least one Business Lead is present.","Some necessary competencies/capacity and resources are in place.","A plan has been developed and initiated to obtain necessary additional competencies/capacity and resources.","The team has started discussions on roles, commitment, ownership, etc."] },
        { lvl: 5, title: "Initial founding team with main required competencies, capacity and resources. Team agrees on ownership, roles, goals and vision", items: ["We have an initial founding team with the required competencies and capacity, all contributing significant time, and the near-term minimum resources are in place.","The team is aligned: roles are clarified; goals and vision are shared; commitment is clear.","The team has agreed respective shareholdings (signed); ownership is balanced and incentivising, reflecting past and future contributions.","Activities are in progress to obtain additional competencies, capacity and resources.","Initial systems/processes/tools are in place to share knowledge and information within the team."] },
        { lvl: 6, title: "Complementary, diverse, and committed founding team with all necessary competencies, capacity and resources to begin building the business.", items: ["A complementary and diverse founding team is in place with minimum resources, capable of starting to build the business.","We have all key near-term competencies and capacity in place, including a clearly designated CEO, and the minimum required resources are present.","The team is committed; everyone feels responsibility and accountability.","We have initiated recruitment of advisors and/or board members.","We are aware of risks to team performance from resource constraints.","We are aware of internal risks to team performance (e.g., conflicts, politics, conflicting priorities)."] },
        { lvl: 7, title: "Well-functioning management team and positive culture Medium term growth plan for expanding team, building organisation and acquiring resources", items: ["We have a well-functioning management team with clear roles.","Goals, vision, purpose, and culture are clearly articulated and documented to support team and organisational development.","We have a medium-term (~2 years) plan in place to build the organisation, acquire resources, and grow the team.","Processes/systems and a plan for continuous learning and staff development are implemented.","The board and advisors are operational and support business and organisational development."] },
        { lvl: 8, title: "Professional organisation - Board, CEO, management & staff - with required utilised resources", items: ["We have clear leadership and a management team with relevant professional experience, and our business-critical resources are in place and well utilised.","A competent, diverse board and relevant advisors are in place and used professionally.","HR policies/processes (and an HR owner) are in place to assure good HR practices and team diversity.","We have a medium-term recruitment and resource plan to acquire the required competencies, capacity, and other critical resources.","All levels of the organisation are properly trained and motivated."] },
        { lvl: 9, title: "High performing, well-structured organisation at all levels that is maintained, develops and performs over time", items: ["We operate a high-performing, well-functioning organisation and achieve a high level of resource utilisation that contributes to business success.","All levels of the organisation are actively engaged in continuous learning and development.","Our culture, structure, processes and resources are continuously improved and developed.","Incentives and rewards are aligned to motivate the whole organisation to reach goals and perform well.","The management team is maintained, developed, and performs over time."] },
      ],
      "FRL": [
        { lvl: 1, title: "No clear description of initial verification activities No clear view of initial funding needs and funding options", items: ["We recognise the core activities we must verify and that funding will be required to do so.","We are aware, at a basic level, that multiple funding options exist and that we need to explore them further."] },
        { lvl: 2, title: "Description of initial verification activities Defined funding need and sources for initial milestones", items: ["We have identified initial activities and costs to verify the potential/feasibility of the idea (1–6 months).","We have a basic plan with funding options for initial milestones (1–6 months)."] },
        { lvl: 3, title: "Funding secured for initial verification plan", items: ["We have secured sufficient funding for initial verification/feasibility activities (1–6 months).","We understand the pros and cons of different funding types."] },
        { lvl: 4, title: "Funding secured for commercial verification plan", items: ["We have a commercial-potential verification plan (3–12 months).","We have identified relevant funding sources for this plan.","We have secured funding to implement a substantial portion of the verification plan."] },
        { lvl: 5, title: "First pitch tested on relevant audience Defined near term funding requirement and developed funding strategy", items: ["We have iterated our funding pitch after testing it with a relevant audience.","We have an initial 12-month P&L budget and cash-flow forecast, and we have tested the initial pitch deck with a relevant audience.","We have a funding strategy with identified sources consistent with a viable commercial model.","We understand the requirements and consequences of external funding for our commercial model, control, and ownership."] },
        { lvl: 6, title: "Iterated pitch by testing on relevant audience Initiated contacts with relevant external funders", items: ["We have iterated our pitch with a relevant audience and initiated contacts with relevant funders.","We have a 3–5 year P&L budget and cash-flow model that clarifies near- and medium-term funding requirements."] },
        { lvl: 7, title: "Initial discussions with potential external funders Full pitch and supporting material ready", items: ["We are in term-sheet discussions with potential external funders.","We have a fully tested pitch and business plan with financial projections, milestones, and deliverables, and our data room contains all documents required for initial due diligence.","Basic accounting systems and documentation are in place, and the data room meets the minimum documentation standard."] },
        { lvl: 8, title: "Concrete negotiations with one or more external funders who show clear interest", items: ["We are in concrete negotiations (beyond term-sheet stage) with one or more external funders who show clear interest.","All required supporting materials/documents for external funding are in place.","Our legal entity is correctly established with a clear cap table and ownership structure suitable for the planned funding source.","All key legal, IPR, financial, and operational documents and agreements are organised in a data room and available for due diligence (DD)."] },
        { lvl: 9, title: "Secured funding for nest stage of Operations Financial monitoring and forecasting system fully implemented.", items: ["We have secured funding for the next stage of development with a defined runway aligned to the current business plan.","We have a fully implemented financial monitoring/bookkeeping system for real-time control, budgeting, and forecasting."] },
      ],
      "CIRL": [
        { lvl: 1, title: "Climate impact thesis articulated", items: ["We have articulated a high-level climate impact thesis describing the environmental problem we address.","We have stated our motivation for pursuing climate impact (mission-driven, market opportunity, regulatory)."] },
        { lvl: 2, title: "Solution classified and lifecycle emissions scoped", items: ["We have classified our solution type (mitigation, adaptation, measurement, removal, enabling).","We have created an initial life-cycle emissions overview identifying key emission sources and sinks."] },
        { lvl: 3, title: "Effects inventory and incumbent baseline established", items: ["We have inventoried the direct and indirect effects of our solution on GHG emissions.","We have profiled the incumbent/baseline emissions our solution displaces or reduces.","We have a conceptual description of net unit impact (emission reduction or avoidance per unit of solution)."] },
        { lvl: 4, title: "Effects analysis and materiality assessment completed", items: ["We have analysed each solution effect with supporting data or engineering estimates.","We have completed a materiality assessment ranking effects by significance.","We have produced an initial quantitative estimate of net unit impact."] },
        { lvl: 5, title: "Net unit impact quantified and potential impact estimated", items: ["We have a rigorous quantification of net unit impact using primary data or validated models.","We have estimated potential impact by combining net unit impact with market size projections.","We have segmented impact by customer segment or use-case."] },
        { lvl: 6, title: "Impact projected and additionality assessed", items: ["We have projected net unit impact over time incorporating adoption curves and market dynamics.","We have assessed additionality — demonstrating impact would not occur without our solution.","We have crafted an impact narrative suitable for investor communications."] },
        { lvl: 7, title: "Planned impact model with validation evidence", items: ["We have a planned impact model integrating engineering data, market projections, and adoption assumptions.","We have gathered validation evidence (pilot data, third-party review, customer measurements).","We have identified adjustment factors and risks that could affect realised impact."] },
        { lvl: 8, title: "Impact assessment and KPI framework in place", items: ["We have completed a comprehensive impact assessment summary with methodology documentation.","We have selected impact metrics and KPIs aligned with recognised frameworks (GHG Protocol, IRIS+, SDGs).","We have an impact data collection plan defining sources, frequency, and responsibility."] },
        { lvl: 9, title: "Realised impact tracked and continuously improved", items: ["We have a realised impact dashboard showing actual measured impact against projections.","We have an impact reporting system producing investor-grade reports.","We have a verification and continuous improvement process including third-party review.","We maintain an impact model recalibration log updating assumptions based on real data."] },
      ],
    };

    for (const mod of existingModules) {
      const dimContent = kthContent[mod.kthDimension!];
      if (!dimContent) continue;

      for (const content of dimContent) {
        const [level] = await db.select().from(levels)
          .where(and(eq(levels.moduleId, mod.id), eq(levels.levelNumber, content.lvl)));
        if (!level) continue;

        await db.update(levels).set({ title: content.title }).where(eq(levels.id, level.id));

        const existingItems = await db.select().from(checklistItems).where(eq(checklistItems.levelId, level.id));

        const progressRows = await db.select({ itemId: checklistProgress.checklistItemId })
          .from(checklistProgress)
          .where(sql`${checklistProgress.checklistItemId} IN (SELECT id FROM checklist_items WHERE level_id = ${level.id})`);
        const itemsWithProgress = new Set(progressRows.map(r => r.itemId));

        const toolLinkRows = await db.select({ itemId: checklistItemTools.checklistItemId })
          .from(checklistItemTools)
          .where(sql`${checklistItemTools.checklistItemId} IN (SELECT id FROM checklist_items WHERE level_id = ${level.id})`);
        const itemsWithTools = new Set(toolLinkRows.map(r => r.itemId));

        const protectedIds = new Set([...itemsWithProgress, ...itemsWithTools]);
        const idsToDelete = existingItems.filter(it => !protectedIds.has(it.id)).map(it => it.id);

        if (idsToDelete.length > 0) {
          await db.delete(checklistItems).where(sql`${checklistItems.id} IN (${sql.join(idsToDelete.map(id => sql`${id}`), sql`, `)})`);
        }

        const protectedLabels = new Set(
          existingItems.filter(it => protectedIds.has(it.id)).map(it => it.label)
        );

        let order = existingItems.filter(it => protectedIds.has(it.id)).length + 1;
        for (const label of content.items) {
          if (protectedLabels.has(label)) continue;
          await db.insert(checklistItems).values({ levelId: level.id, label, displayOrder: order });
          order++;
        }
      }
    }

    console.log("Content upgrade complete — real KTH readiness levels applied.");
  }

  async isUserAdmin(userId: string): Promise<boolean> {
    const [user] = await db.select({ isAdmin: users.isAdmin, role: users.role }).from(users).where(eq(users.id, userId));
    if (!user) return false;
    return user.isAdmin || ["admin", "superadmin", "investor_admin"].includes(user.role);
  }

  async isInvestorAdmin(userId: string): Promise<boolean> {
    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    if (!user) return false;
    return ["superadmin", "investor_admin"].includes(user.role);
  }

  async getAllStartupsWithMembers(): Promise<any[]> {
    const allStartups = await db.select().from(startups);
    const allMembers = await db
      .select({
        startupId: startupMembers.startupId,
        userId: startupMembers.userId,
        role: startupMembers.role,
        userRole: users.role,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(startupMembers)
      .innerJoin(users, eq(startupMembers.userId, users.id));

    const allProgress = await db.select().from(checklistProgress).where(eq(checklistProgress.completed, true));
    const allItems = await db
      .select({
        id: checklistItems.id,
        levelId: checklistItems.levelId,
        moduleId: levels.moduleId,
        levelNumber: levels.levelNumber,
      })
      .from(checklistItems)
      .innerJoin(levels, eq(checklistItems.levelId, levels.id));
    const allModules = await this.getModules();

    return allStartups.map(s => {
      const members = allMembers.filter(m => m.startupId === s.id);
      const progressForStartup = allProgress.filter(p => p.startupId === s.id);
      const completedItemIds = new Set(progressForStartup.map(p => p.checklistItemId));

      const readinessLevels: Record<string, number> = {};
      for (const mod of allModules) {
        const modItems = allItems.filter(i => i.moduleId === mod.id);
        const itemsByLevel = new Map<number, number[]>();
        for (const item of modItems) {
          const arr = itemsByLevel.get(item.levelNumber) || [];
          arr.push(item.id);
          itemsByLevel.set(item.levelNumber, arr);
        }
        let achievedLevel = 0;
        for (let lvl = 1; lvl <= 9; lvl++) {
          const itemsAtLevel = itemsByLevel.get(lvl) || [];
          if (itemsAtLevel.length === 0) break;
          if (isLevelDone(mod.id, lvl, itemsAtLevel, completedItemIds)) achievedLevel = lvl;
          else break;
        }
        readinessLevels[mod.name] = achievedLevel;
      }

      return {
        ...s,
        members,
        readinessLevels,
      };
    });
  }

  async getProgressSnapshotForAllStartups(): Promise<any[]> {
    const allProgress = await db
      .select({
        startupId: checklistProgress.startupId,
        checklistItemId: checklistProgress.checklistItemId,
        completed: checklistProgress.completed,
        completedAt: checklistProgress.completedAt,
      })
      .from(checklistProgress)
      .where(eq(checklistProgress.completed, true));

    const allItems = await db
      .select({
        id: checklistItems.id,
        levelId: checklistItems.levelId,
        moduleId: levels.moduleId,
        levelNumber: levels.levelNumber,
      })
      .from(checklistItems)
      .innerJoin(levels, eq(checklistItems.levelId, levels.id));

    const allModules = await this.getModules();
    const allStartupsList = await db.select({ id: startups.id, name: startups.name }).from(startups);

    return allStartupsList.map(s => {
      const progressForStartup = allProgress.filter(p => p.startupId === s.id);
      const completedItemIds = new Set(progressForStartup.map(p => p.checklistItemId));

      const dimensions: Record<string, { achieved: number; totalItems: number; completedItems: number }> = {};
      for (const mod of allModules) {
        const modItems = allItems.filter(i => i.moduleId === mod.id);
        const completedCount = modItems.filter(i => completedItemIds.has(i.id)).length;
        const itemsByLevel = new Map<number, number[]>();
        for (const item of modItems) {
          const arr = itemsByLevel.get(item.levelNumber) || [];
          arr.push(item.id);
          itemsByLevel.set(item.levelNumber, arr);
        }
        let achievedLevel = 0;
        for (let lvl = 1; lvl <= 9; lvl++) {
          const itemsAtLevel = itemsByLevel.get(lvl) || [];
          if (itemsAtLevel.length === 0) break;
          if (isLevelDone(mod.id, lvl, itemsAtLevel, completedItemIds)) achievedLevel = lvl;
          else break;
        }
        dimensions[mod.name] = { achieved: achievedLevel, totalItems: modItems.length, completedItems: completedCount };
      }

      return { startupId: s.id, startupName: s.name, dimensions };
    });
  }

  async getDashboardStats() {
    const allStartupsList = await db.select().from(startups);
    const totalCompanies = allStartupsList.length;

    const allUsers = await db.select().from(users);
    const totalUsers = allUsers.length;
    const totalFounders = allUsers.filter(u => u.role === "founder").length;
    const totalAdmins = allUsers.filter(u => u.role === "admin" || u.role === "superadmin").length;

    const allProgrammes = await db.select().from(programmes);
    const totalProgrammes = allProgrammes.length;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentCompletions = await db
      .select()
      .from(checklistProgress)
      .where(and(eq(checklistProgress.completed, true), gte(checklistProgress.completedAt, sevenDaysAgo)));
    const recentActivity = recentCompletions.length;

    const snapshot = await this.getProgressSnapshotForAllStartups();

    const dimensionTotals: Record<string, { sum: number; count: number }> = {};
    const companyAverages: { name: string; avg: number }[] = [];

    for (const s of snapshot) {
      const dims = Object.entries(s.dimensions) as [string, { achieved: number }][];
      let companySum = 0;
      let companyCount = 0;
      for (const [dimName, dimData] of dims) {
        if (!dimensionTotals[dimName]) dimensionTotals[dimName] = { sum: 0, count: 0 };
        dimensionTotals[dimName].sum += dimData.achieved;
        dimensionTotals[dimName].count += 1;
        companySum += dimData.achieved;
        companyCount++;
      }
      if (companyCount > 0) {
        companyAverages.push({ name: s.startupName, avg: companySum / companyCount });
      }
    }

    const dimensionAverages: Record<string, number> = {};
    let totalDimSum = 0;
    let totalDimCount = 0;
    for (const [name, data] of Object.entries(dimensionTotals)) {
      dimensionAverages[name] = data.count > 0 ? Math.round((data.sum / data.count) * 10) / 10 : 0;
      totalDimSum += data.sum;
      totalDimCount += data.count;
    }
    const averageReadiness = totalDimCount > 0 ? Math.round((totalDimSum / totalDimCount) * 10) / 10 : 0;

    companyAverages.sort((a, b) => b.avg - a.avg);
    const highestReadiness = companyAverages.length > 0
      ? { name: companyAverages[0].name, level: Math.round(companyAverages[0].avg * 10) / 10 }
      : null;

    const allRequests = await db.select().from(introductionRequests);
    const totalIntroductionRequests = allRequests.length;
    const allItems = await db.select({ status: introductionItems.status }).from(introductionItems);
    const totalIntroductionsPending = allItems.filter(i => i.status === "pending").length;
    const totalIntroductionsApproved = allItems.filter(i => ["approved", "email_sent", "confirmed"].includes(i.status)).length;

    return {
      totalCompanies,
      totalUsers,
      totalProgrammes,
      totalFounders,
      totalAdmins,
      averageReadiness,
      dimensionAverages,
      highestReadiness,
      recentActivity,
      totalIntroductionRequests,
      totalIntroductionsPending,
      totalIntroductionsApproved,
    };
  }

  async getMilestoneGroups(): Promise<MilestoneGroup[]> {
    return db.select().from(milestoneGroups).orderBy(milestoneGroups.displayOrder);
  }

  async createMilestoneGroup(data: InsertMilestoneGroup): Promise<MilestoneGroup> {
    const [g] = await db.insert(milestoneGroups).values(data).returning();
    return g;
  }

  async updateMilestoneGroup(id: number, data: Partial<InsertMilestoneGroup>): Promise<MilestoneGroup | undefined> {
    const [g] = await db.update(milestoneGroups).set(data).where(eq(milestoneGroups.id, id)).returning();
    return g;
  }

  async deleteMilestoneGroup(id: number): Promise<void> {
    await db.update(milestones).set({ groupId: null }).where(eq(milestones.groupId, id));
    await db.delete(milestoneGroups).where(eq(milestoneGroups.id, id));
  }

  async getMilestones(): Promise<Milestone[]> {
    return db.select().from(milestones).orderBy(milestones.displayOrder);
  }

  async getMilestone(id: number): Promise<Milestone | undefined> {
    const [m] = await db.select().from(milestones).where(eq(milestones.id, id));
    return m;
  }

  async createMilestone(data: InsertMilestone): Promise<Milestone> {
    const [m] = await db.insert(milestones).values(data).returning();
    return m;
  }

  async updateMilestone(id: number, data: Partial<InsertMilestone>): Promise<Milestone | undefined> {
    const [m] = await db.update(milestones).set({ ...data, updatedAt: new Date() }).where(eq(milestones.id, id)).returning();
    return m;
  }

  async deleteMilestone(id: number): Promise<void> {
    await db.delete(milestones).where(eq(milestones.id, id));
  }

  async computeReadinessLevels(startupId: number): Promise<Record<string, number>> {
    const allProgress = await db
      .select({ checklistItemId: checklistProgress.checklistItemId })
      .from(checklistProgress)
      .where(and(eq(checklistProgress.startupId, startupId), eq(checklistProgress.completed, true)));
    const completedIds = new Set(allProgress.map(p => p.checklistItemId));

    const allItems = await db
      .select({ id: checklistItems.id, moduleId: levels.moduleId, levelNumber: levels.levelNumber })
      .from(checklistItems)
      .innerJoin(levels, eq(checklistItems.levelId, levels.id));
    const allModules = await this.getModules();

    const result: Record<string, number> = {};
    for (const mod of allModules) {
      const modItems = allItems.filter(i => i.moduleId === mod.id);
      const itemsByLevel = new Map<number, number[]>();
      for (const item of modItems) {
        const arr = itemsByLevel.get(item.levelNumber) || [];
        arr.push(item.id);
        itemsByLevel.set(item.levelNumber, arr);
      }
      let achieved = 0;
      for (let lvl = 1; lvl <= 9; lvl++) {
        const ids = itemsByLevel.get(lvl) || [];
        if (ids.length === 0) break;
        if (isLevelDone(mod.id, lvl, ids, completedIds)) achieved = lvl;
        else break;
      }
      result[mod.name] = achieved;
    }
    return result;
  }

  async recordReadinessSnapshot(startupId: number, levelsMap: Record<string, number>): Promise<ReadinessSnapshot> {
    const [snap] = await db.insert(readinessSnapshots).values({ startupId, levels: levelsMap }).returning();
    return snap;
  }

  async getReadinessTimeline(): Promise<ReadinessSnapshot[]> {
    return db.select().from(readinessSnapshots).orderBy(readinessSnapshots.createdAt);
  }

  async getReadinessTimelineForStartups(startupIds: number[]): Promise<ReadinessSnapshot[]> {
    if (startupIds.length === 0) return [];
    return db.select().from(readinessSnapshots)
      .where(inArray(readinessSnapshots.startupId, startupIds))
      .orderBy(readinessSnapshots.createdAt);
  }

  async getReadinessSnapshotsForStartup(startupId: number): Promise<ReadinessSnapshot[]> {
    return db.select().from(readinessSnapshots)
      .where(eq(readinessSnapshots.startupId, startupId))
      .orderBy(readinessSnapshots.createdAt);
  }

  async getMilestoneCategories(): Promise<MilestoneCategory[]> {
    return db.select().from(milestoneCategories).orderBy(milestoneCategories.displayOrder);
  }

  async createMilestoneCategory(data: InsertMilestoneCategory): Promise<MilestoneCategory> {
    const [cat] = await db.insert(milestoneCategories).values(data).returning();
    return cat;
  }

  async updateMilestoneCategory(id: number, data: Partial<InsertMilestoneCategory>): Promise<MilestoneCategory | undefined> {
    const [cat] = await db.update(milestoneCategories).set(data).where(eq(milestoneCategories.id, id)).returning();
    return cat;
  }

  async deleteMilestoneCategory(id: number): Promise<void> {
    await db.delete(milestoneCategories).where(eq(milestoneCategories.id, id));
  }

  async getMilestoneStages(): Promise<MilestoneStage[]> {
    return db.select().from(milestoneStages).orderBy(milestoneStages.displayOrder);
  }

  async createMilestoneStage(data: InsertMilestoneStage): Promise<MilestoneStage> {
    const [stage] = await db.insert(milestoneStages).values(data).returning();
    return stage;
  }

  async updateMilestoneStage(id: number, data: Partial<InsertMilestoneStage>): Promise<MilestoneStage | undefined> {
    const [stage] = await db.update(milestoneStages).set(data).where(eq(milestoneStages.id, id)).returning();
    return stage;
  }

  async deleteMilestoneStage(id: number): Promise<void> {
    await db.delete(milestoneStages).where(eq(milestoneStages.id, id));
  }

  async getStartupModuleAccess(startupId: number): Promise<StartupModuleAccess[]> {
    return db.select().from(startupModuleAccess).where(eq(startupModuleAccess.startupId, startupId));
  }

  async grantModuleAccess(startupId: number, moduleId: number, grantedBy: string): Promise<StartupModuleAccess> {
    const existing = await db.select().from(startupModuleAccess)
      .where(and(eq(startupModuleAccess.startupId, startupId), eq(startupModuleAccess.moduleId, moduleId)));
    if (existing.length > 0) return existing[0];
    const [access] = await db.insert(startupModuleAccess).values({ startupId, moduleId, grantedBy }).returning();
    return access;
  }

  async revokeModuleAccess(startupId: number, moduleId: number): Promise<void> {
    await db.delete(startupModuleAccess)
      .where(and(eq(startupModuleAccess.startupId, startupId), eq(startupModuleAccess.moduleId, moduleId)));
  }

  async hasModuleAccess(startupId: number, moduleId: number): Promise<boolean> {
    const [access] = await db.select().from(startupModuleAccess)
      .where(and(eq(startupModuleAccess.startupId, startupId), eq(startupModuleAccess.moduleId, moduleId)));
    return !!access;
  }

  async getMatchFeedback(fundingRoundAirtableId: string): Promise<MatchFeedback[]> {
    return db.select().from(matchFeedback)
      .where(eq(matchFeedback.fundingRoundAirtableId, fundingRoundAirtableId))
      .orderBy(desc(matchFeedback.createdAt));
  }

  async getAllMatchFeedback(): Promise<MatchFeedback[]> {
    return db.select().from(matchFeedback).orderBy(desc(matchFeedback.createdAt));
  }

  async saveMatchResults(userId: string, startupId: number | null, fundingRoundAirtableId: string, formValues: any, matches: any): Promise<void> {
    if (startupId) {
      await db.delete(matchResults).where(and(eq(matchResults.userId, userId), eq(matchResults.startupId, startupId)));
    } else {
      await db.delete(matchResults).where(eq(matchResults.userId, userId));
    }
    await db.insert(matchResults).values({
      userId,
      startupId,
      fundingRoundAirtableId,
      formValues,
      matches,
    });
  }

  async getLatestMatchResults(userId: string, startupId: number | null): Promise<any | null> {
    const conditions = startupId
      ? and(eq(matchResults.userId, userId), eq(matchResults.startupId, startupId))
      : eq(matchResults.userId, userId);
    const rows = await db.select().from(matchResults).where(conditions).orderBy(desc(matchResults.createdAt)).limit(1);
    return rows.length > 0 ? rows[0] : null;
  }

  async upsertMatchFeedback(data: InsertMatchFeedback): Promise<MatchFeedback> {
    const existing = await db.select().from(matchFeedback)
      .where(and(
        eq(matchFeedback.investorAirtableId, data.investorAirtableId),
        eq(matchFeedback.fundingRoundAirtableId, data.fundingRoundAirtableId)
      ));
    if (existing.length > 0) {
      const [updated] = await db.update(matchFeedback)
        .set({ rating: data.rating, reason: data.reason, totalScore: data.totalScore })
        .where(eq(matchFeedback.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(matchFeedback).values(data).returning();
    return created;
  }

  async createIntroductionRequest(data: {
    userId: string;
    startupId?: number;
    fundingRoundData: any;
    startupData: any;
    items: { investorAirtableId: string; investorName: string; investorEmail?: string; matchScore?: number }[];
  }): Promise<IntroductionRequest & { items: IntroductionItem[] }> {
    const [request] = await db.insert(introductionRequests).values({
      userId: data.userId,
      startupId: data.startupId || null,
      fundingRoundData: data.fundingRoundData,
      startupData: data.startupData,
      status: "pending_review",
    }).returning();

    const itemValues = data.items.map(item => ({
      requestId: request.id,
      investorAirtableId: item.investorAirtableId,
      investorName: item.investorName,
      investorEmail: item.investorEmail || null,
      matchScore: item.matchScore || null,
      status: "pending",
    }));

    const insertedItems = await db.insert(introductionItems).values(itemValues).returning();

    return { ...request, items: insertedItems };
  }

  async getIntroductionRequest(id: number): Promise<(IntroductionRequest & { items: IntroductionItem[] }) | undefined> {
    const [request] = await db.select().from(introductionRequests).where(eq(introductionRequests.id, id));
    if (!request) return undefined;
    const items = await db.select().from(introductionItems).where(eq(introductionItems.requestId, id)).orderBy(desc(introductionItems.matchScore));
    return { ...request, items };
  }

  async getIntroductionRequestsByUser(userId: string, startupId?: number | null): Promise<(IntroductionRequest & { items: IntroductionItem[] })[]> {
    const conditions = startupId
      ? and(eq(introductionRequests.userId, userId), eq(introductionRequests.startupId, startupId))
      : eq(introductionRequests.userId, userId);
    const requests = await db.select().from(introductionRequests).where(conditions).orderBy(desc(introductionRequests.createdAt));
    const results = [];
    for (const req of requests) {
      const items = await db.select().from(introductionItems).where(eq(introductionItems.requestId, req.id)).orderBy(desc(introductionItems.matchScore));
      results.push({ ...req, items });
    }
    return results;
  }

  async getAllIntroductionRequests(): Promise<(IntroductionRequest & { items: IntroductionItem[] })[]> {
    const requests = await db.select().from(introductionRequests).orderBy(desc(introductionRequests.createdAt));
    const results = [];
    for (const req of requests) {
      const items = await db.select().from(introductionItems).where(eq(introductionItems.requestId, req.id)).orderBy(desc(introductionItems.matchScore));
      results.push({ ...req, items });
    }
    return results;
  }

  async updateIntroductionItemStatus(itemId: number, status: string, adminNote?: string, adminUserId?: string, responseToken?: string): Promise<IntroductionItem | undefined> {
    const updateData: any = { status, updatedAt: new Date() };
    if (adminNote !== undefined) updateData.adminNote = adminNote;
    if (adminUserId !== undefined) updateData.adminUserId = adminUserId;
    if (responseToken !== undefined) updateData.responseToken = responseToken;
    const [updated] = await db.update(introductionItems).set(updateData).where(eq(introductionItems.id, itemId)).returning();
    return updated;
  }

  async getIntroductionItemByToken(token: string): Promise<(IntroductionItem & { request: IntroductionRequest }) | undefined> {
    const [item] = await db.select().from(introductionItems).where(eq(introductionItems.responseToken, token));
    if (!item) return undefined;
    const [request] = await db.select().from(introductionRequests).where(eq(introductionRequests.id, item.requestId));
    if (!request) return undefined;
    return { ...item, request };
  }

  async updateIntroductionItemByToken(token: string, status: string): Promise<IntroductionItem | undefined> {
    const [updated] = await db.update(introductionItems).set({ status, updatedAt: new Date() }).where(eq(introductionItems.responseToken, token)).returning();
    return updated;
  }

  async addIntroductionItemVote(itemId: number, userId: string, vote: string): Promise<any> {
    const [result] = await db.insert(introductionItemVotes)
      .values({ itemId, userId, vote })
      .onConflictDoUpdate({
        target: [introductionItemVotes.itemId, introductionItemVotes.userId],
        set: { vote },
      })
      .returning();
    return result;
  }

  async getIntroductionItemVotes(itemId: number): Promise<any[]> {
    return db.select().from(introductionItemVotes).where(eq(introductionItemVotes.itemId, itemId));
  }

  async countInvestorAdmins(): Promise<number> {
    const admins = await db.select({ id: users.id }).from(users)
      .where(or(eq(users.role, "investor_admin"), eq(users.role, "superadmin")));
    return admins.length;
  }

  async getAdminsByRole(role: string): Promise<User[]> {
    return db.select().from(users).where(and(eq(users.isAdmin, true), eq(users.adminRole, role)));
  }

  async updateUserAdminRole(userId: string, role: string | null): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ adminRole: role, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    return updated;
  }

  async getAdminUsers(): Promise<User[]> {
    return db.select().from(users).where(eq(users.isAdmin, true));
  }

  async recordDeckView(introductionItemId: number, viewerIp?: string, userAgent?: string): Promise<void> {
    await db.insert(deckViews).values({ introductionItemId, viewerIp: viewerIp || null, userAgent: userAgent || null });
  }

  async getDeckViewStats(introductionItemId: number): Promise<{ viewCount: number; lastViewedAt: Date | null }> {
    const rows = await db.select({
      count: sql<number>`count(*)::int`,
      lastViewed: sql<Date | null>`max(${deckViews.viewedAt})`,
    }).from(deckViews).where(eq(deckViews.introductionItemId, introductionItemId));
    return { viewCount: rows[0]?.count ?? 0, lastViewedAt: rows[0]?.lastViewed ?? null };
  }

  async getDeckViewStatsBatch(itemIds: number[]): Promise<Map<number, { viewCount: number; lastViewedAt: Date | null }>> {
    const result = new Map<number, { viewCount: number; lastViewedAt: Date | null }>();
    if (itemIds.length === 0) return result;
    const rows = await db.select({
      itemId: deckViews.introductionItemId,
      count: sql<number>`count(*)::int`,
      lastViewed: sql<Date | null>`max(${deckViews.viewedAt})`,
    }).from(deckViews).where(inArray(deckViews.introductionItemId, itemIds)).groupBy(deckViews.introductionItemId);
    for (const row of rows) {
      result.set(row.itemId, { viewCount: row.count, lastViewedAt: row.lastViewed });
    }
    return result;
  }

  // --- Programme Methods ---

  async createProgramme(data: InsertProgramme): Promise<Programme> {
    const [programme] = await db.insert(programmes).values(data).returning();
    return programme;
  }

  async updateProgramme(id: number, data: Partial<InsertProgramme>): Promise<Programme | undefined> {
    const [updated] = await db.update(programmes).set({ ...data, updatedAt: new Date() }).where(eq(programmes.id, id)).returning();
    return updated;
  }

  async deleteProgramme(id: number): Promise<void> {
    await db.delete(programmeFeatures).where(eq(programmeFeatures.programmeId, id));
    await db.delete(programmeStartups).where(eq(programmeStartups.programmeId, id));
    await db.delete(programmeAdmins).where(eq(programmeAdmins.programmeId, id));
    await db.delete(invitations).where(eq(invitations.programmeId, id));
    await db.delete(programmes).where(eq(programmes.id, id));
  }

  async deleteStartup(id: number): Promise<void> {
    await db.delete(checklistProgress).where(eq(checklistProgress.startupId, id));
    await db.delete(toolEntries).where(eq(toolEntries.startupId, id));
    await db.delete(startupTargets).where(eq(startupTargets.startupId, id));
    await db.delete(startupMembers).where(eq(startupMembers.startupId, id));
    await db.delete(startupModuleAccess).where(eq(startupModuleAccess.startupId, id));
    await db.delete(missionCompletions).where(eq(missionCompletions.startupId, id));
    await db.delete(rewardUnlocks).where(eq(rewardUnlocks.startupId, id));
    await db.delete(startupMissions).where(eq(startupMissions.startupId, id));
    await db.delete(readinessSnapshots).where(eq(readinessSnapshots.startupId, id));
    await db.delete(matchFeedback).where(eq(matchFeedback.startupId, id));
    await db.delete(matchResults).where(eq(matchResults.startupId, id));
    await db.delete(programmeStartups).where(eq(programmeStartups.startupId, id));
    await db.delete(startupCohorts).where(eq(startupCohorts.startupId, id));
    await db.delete(startupGroups).where(eq(startupGroups.startupId, id));
    await db.delete(invitations).where(eq(invitations.startupId, id));
    await db.delete(chatMessages).where(eq(chatMessages.startupId, id));
    await db.delete(activityLog).where(eq(activityLog.startupId, id));
    const startupAssumptions = await db.select({ id: assumptions.id }).from(assumptions).where(eq(assumptions.startupId, id));
    for (const a of startupAssumptions) {
      await db.delete(experiments).where(eq(experiments.assumptionId, a.id));
    }
    await db.delete(assumptions).where(eq(assumptions.startupId, id));
    const requests = await db.select({ id: introductionRequests.id }).from(introductionRequests).where(eq(introductionRequests.startupId, id));
    for (const req of requests) {
      await db.delete(introductionItems).where(eq(introductionItems.requestId, req.id));
    }
    await db.delete(introductionRequests).where(eq(introductionRequests.startupId, id));
    await db.delete(startups).where(eq(startups.id, id));
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(startupMembers).where(eq(startupMembers.userId, id));
    await db.delete(programmeAdmins).where(eq(programmeAdmins.userId, id));
    await db.delete(eirGroupAssignments).where(eq(eirGroupAssignments.userId, id));
    await db.delete(chatMessages).where(eq(chatMessages.userId, id));
    await db.delete(activityLog).where(eq(activityLog.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }

  async getProgramme(id: number): Promise<Programme | undefined> {
    const [programme] = await db.select().from(programmes).where(eq(programmes.id, id));
    return programme;
  }

  async getProgrammeByName(name: string): Promise<Programme | undefined> {
    const [programme] = await db.select().from(programmes).where(eq(programmes.name, name));
    return programme;
  }

  async getAllProgrammes(): Promise<Programme[]> {
    return db.select().from(programmes).orderBy(programmes.name);
  }

  async getProgrammesForAdmin(userId: string): Promise<Programme[]> {
    const user = await this.getUser(userId);
    if (user?.role === "superadmin") {
      return this.getAllProgrammes();
    }
    const assignments = await db.select({ programmeId: programmeAdmins.programmeId }).from(programmeAdmins).where(eq(programmeAdmins.userId, userId));
    if (assignments.length === 0) return [];
    const ids = assignments.map(a => a.programmeId);
    return db.select().from(programmes).where(inArray(programmes.id, ids)).orderBy(programmes.name);
  }

  async getProgrammesForStartup(startupId: number): Promise<Programme[]> {
    const links = await db.select({ programmeId: programmeStartups.programmeId }).from(programmeStartups).where(eq(programmeStartups.startupId, startupId));
    if (links.length === 0) return [];
    const ids = links.map(l => l.programmeId);
    return db.select().from(programmes).where(inArray(programmes.id, ids));
  }

  // --- Programme Features ---

  async setProgrammeFeature(programmeId: number, featureKey: string, enabled: boolean): Promise<ProgrammeFeature> {
    const ALL_FEATURE_KEYS = ["dashboard", "readiness_dimensions", "tool_repository", "investor_matching", "ai_coach", "experiment_tracker", "events", "my_journey"];
    const existingFeatures = await db.select().from(programmeFeatures).where(eq(programmeFeatures.programmeId, programmeId));
    const existingKeys = new Set(existingFeatures.map(f => f.featureKey));
    for (const key of ALL_FEATURE_KEYS) {
      if (!existingKeys.has(key) && key !== featureKey) {
        const defaultEnabled = existingFeatures.length === 0;
        await db.insert(programmeFeatures).values({ programmeId, featureKey: key, enabled: defaultEnabled }).onConflictDoNothing();
      }
    }
    const [existing] = existingFeatures.filter(f => f.featureKey === featureKey);
    if (existing) {
      const [updated] = await db.update(programmeFeatures).set({ enabled }).where(eq(programmeFeatures.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(programmeFeatures).values({ programmeId, featureKey, enabled }).returning();
    return created;
  }

  async getProgrammeFeatures(programmeId: number): Promise<ProgrammeFeature[]> {
    return db.select().from(programmeFeatures).where(eq(programmeFeatures.programmeId, programmeId));
  }

  async getStartupFeatures(startupId: number): Promise<{ featureKey: string; enabled: boolean }[]> {
    const progs = await this.getProgrammesForStartup(startupId);
    if (progs.length === 0) return [];
    const progIds = progs.map(p => p.id);
    const allFeatures = await db.select().from(programmeFeatures).where(inArray(programmeFeatures.programmeId, progIds));
    if (allFeatures.length === 0) return [];
    const ALL_FEATURE_KEYS = ["dashboard", "readiness_dimensions", "tool_repository", "investor_matching", "ai_coach", "experiment_tracker", "events", "my_journey"];
    const featureMap = new Map<string, boolean>();
    for (const key of ALL_FEATURE_KEYS) {
      featureMap.set(key, false);
    }
    for (const f of allFeatures) {
      if (f.enabled) {
        featureMap.set(f.featureKey, true);
      }
    }
    return Array.from(featureMap.entries()).map(([featureKey, enabled]) => ({ featureKey, enabled }));
  }

  // --- Programme-Startup ---

  async addStartupToProgramme(programmeId: number, startupId: number): Promise<ProgrammeStartup> {
    const [existing] = await db.select().from(programmeStartups).where(and(eq(programmeStartups.programmeId, programmeId), eq(programmeStartups.startupId, startupId)));
    if (existing) return existing;
    const [link] = await db.insert(programmeStartups).values({ programmeId, startupId }).returning();
    return link;
  }

  async removeStartupFromProgramme(programmeId: number, startupId: number): Promise<void> {
    await db.delete(programmeStartups).where(and(eq(programmeStartups.programmeId, programmeId), eq(programmeStartups.startupId, startupId)));
  }

  async getStartupsInProgramme(programmeId: number): Promise<(Startup & { members: any[] })[]> {
    const links = await db.select({ startupId: programmeStartups.startupId }).from(programmeStartups).where(eq(programmeStartups.programmeId, programmeId));
    if (links.length === 0) return [];
    const ids = links.map(l => l.startupId);
    const startupsResult = await db.select().from(startups).where(inArray(startups.id, ids));
    const result: (Startup & { members: any[] })[] = [];
    for (const s of startupsResult) {
      const members = await db
        .select({ member: startupMembers, user: users })
        .from(startupMembers)
        .innerJoin(users, eq(startupMembers.userId, users.id))
        .where(eq(startupMembers.startupId, s.id));
      result.push({ ...s, members: members.map(m => ({ ...m.member, user: m.user })) });
    }
    return result;
  }

  // --- Programme-Admin ---

  async assignAdminToProgramme(programmeId: number, userId: string): Promise<ProgrammeAdmin> {
    const [existing] = await db.select().from(programmeAdmins).where(and(eq(programmeAdmins.programmeId, programmeId), eq(programmeAdmins.userId, userId)));
    if (existing) return existing;
    const [assignment] = await db.insert(programmeAdmins).values({ programmeId, userId }).returning();
    return assignment;
  }

  async removeAdminFromProgramme(programmeId: number, userId: string): Promise<void> {
    await db.delete(programmeAdmins).where(and(eq(programmeAdmins.programmeId, programmeId), eq(programmeAdmins.userId, userId)));
  }

  async getProgrammeAdmins(programmeId: number): Promise<(ProgrammeAdmin & { user: User })[]> {
    const results = await db
      .select({ admin: programmeAdmins, user: users })
      .from(programmeAdmins)
      .innerJoin(users, eq(programmeAdmins.userId, users.id))
      .where(eq(programmeAdmins.programmeId, programmeId));
    return results.map(r => ({ ...r.admin, user: r.user }));
  }

  // --- Invitations ---

  async createInvitation(data: { email: string; startupId: number | null; programmeId: number | null; token: string; invitedById: string; role?: string | null; pendingProfile?: any; pendingEirGroupIds?: number[] }): Promise<Invitation> {
    const [invitation] = await db.insert(invitations).values(data as any).returning();
    return invitation;
  }

  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    const [invitation] = await db.select().from(invitations).where(eq(invitations.token, token));
    return invitation;
  }

  async getInvitationById(id: number): Promise<Invitation | undefined> {
    const [invitation] = await db.select().from(invitations).where(eq(invitations.id, id));
    return invitation;
  }

  async acceptInvitation(id: number): Promise<Invitation | undefined> {
    const [updated] = await db.update(invitations).set({ status: "accepted", acceptedAt: new Date() }).where(eq(invitations.id, id)).returning();
    return updated;
  }

  async setInvitationPendingEirGroups(invitationId: number, groupIds: number[]): Promise<Invitation | undefined> {
    const unique = Array.from(new Set((groupIds || []).map(n => Number(n)).filter(n => Number.isFinite(n))));
    const [updated] = await db.update(invitations)
      .set({ pendingEirGroupIds: unique as any })
      .where(eq(invitations.id, invitationId))
      .returning();
    return updated;
  }

  async getPendingEirInvitations(): Promise<Invitation[]> {
    return db.select().from(invitations)
      .where(and(eq(invitations.role, "eir"), eq(invitations.status, "pending")))
      .orderBy(desc(invitations.createdAt));
  }

  async getPendingEirInvitationsForGroup(groupId: number): Promise<Invitation[]> {
    const all = await this.getPendingEirInvitations();
    return all.filter(inv => Array.isArray(inv.pendingEirGroupIds) && (inv.pendingEirGroupIds as number[]).includes(groupId));
  }

  async getInvitationsForProgramme(programmeId: number): Promise<(Invitation & { startup: Startup })[]> {
    const invs = await db.select().from(invitations).where(eq(invitations.programmeId, programmeId)).orderBy(desc(invitations.createdAt));
    const result: (Invitation & { startup: Startup })[] = [];
    for (const inv of invs) {
      const [startup] = await db.select().from(startups).where(eq(startups.id, inv.startupId));
      if (startup) result.push({ ...inv, startup });
    }
    return result;
  }

  async getPendingInvitationsForStartup(startupId: number): Promise<Invitation[]> {
    return db.select().from(invitations).where(and(eq(invitations.startupId, startupId), eq(invitations.status, "pending")));
  }

  async getInvitationByStartupAndEmail(startupId: number, email: string): Promise<Invitation | undefined> {
    const [inv] = await db.select().from(invitations).where(and(eq(invitations.startupId, startupId), eq(invitations.email, email.toLowerCase())));
    return inv;
  }

  async getPendingInvitationsByEmail(email: string): Promise<Invitation[]> {
    return db.select().from(invitations).where(and(eq(invitations.email, email.toLowerCase()), eq(invitations.status, "pending")));
  }

  async getInvitationsByEmail(email: string): Promise<Invitation[]> {
    return db.select().from(invitations).where(eq(invitations.email, email.toLowerCase()));
  }

  async addStartupMember(userId: string, startupId: number): Promise<void> {
    await db.insert(startupMembers).values({ startupId, userId, role: "member" }).onConflictDoNothing();
  }

  // --- User role management ---

  async setUserRole(userId: string, role: string): Promise<User | undefined> {
    const isAdminRole = ["admin", "superadmin", "investor_admin"].includes(role);
    const [updated] = await db.update(users).set({ role, isAdmin: isAdminRole, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    return updated;
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    const user = await this.getUser(userId);
    return user?.role === "superadmin";
  }

  async isAdminForProgramme(userId: string, programmeId: number): Promise<boolean> {
    const user = await this.getUser(userId);
    if (user?.role === "superadmin") return true;
    if (user?.role !== "admin") return false;
    const [assignment] = await db.select().from(programmeAdmins).where(and(eq(programmeAdmins.programmeId, programmeId), eq(programmeAdmins.userId, userId)));
    return !!assignment;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.email);
  }

  async getSystemSetting(key: string): Promise<string | null> {
    const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return row?.value ?? null;
  }

  async setSystemSetting(key: string, value: string): Promise<void> {
    const [existing] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    if (existing) {
      await db.update(systemSettings).set({ value, updatedAt: new Date() }).where(eq(systemSettings.key, key));
    } else {
      await db.insert(systemSettings).values({ key, value });
    }
  }

  async listChangelogEntries(opts?: { onlyPublished?: boolean }): Promise<ChangelogEntry[]> {
    if (opts?.onlyPublished) {
      return db.select().from(changelogEntries).where(eq(changelogEntries.isPublished, true)).orderBy(desc(changelogEntries.publishedAt));
    }
    return db.select().from(changelogEntries).orderBy(desc(changelogEntries.publishedAt));
  }

  async getChangelogEntry(id: number): Promise<ChangelogEntry | undefined> {
    const [row] = await db.select().from(changelogEntries).where(eq(changelogEntries.id, id));
    return row;
  }

  async getChangelogEntryBySource(taskRef: string): Promise<ChangelogEntry | undefined> {
    const rows = await db.select().from(changelogEntries);
    return rows.find(r => {
      const src = r.source as { type?: string; taskRef?: string } | null;
      return src?.taskRef === taskRef;
    });
  }

  async createChangelogEntry(data: InsertChangelogEntry): Promise<ChangelogEntry> {
    const [row] = await db.insert(changelogEntries).values(data).returning();
    return row;
  }

  async updateChangelogEntry(id: number, data: Partial<InsertChangelogEntry>): Promise<ChangelogEntry | undefined> {
    const [row] = await db.update(changelogEntries).set({ ...data, updatedAt: new Date() }).where(eq(changelogEntries.id, id)).returning();
    return row;
  }

  async deleteChangelogEntry(id: number): Promise<void> {
    await db.delete(changelogEntries).where(eq(changelogEntries.id, id));
  }

  async getRewards(): Promise<Reward[]> {
    return db.select().from(rewards);
  }

  async getReward(id: number): Promise<Reward | undefined> {
    const [row] = await db.select().from(rewards).where(eq(rewards.id, id));
    return row;
  }

  async createReward(data: InsertReward): Promise<Reward> {
    const [row] = await db.insert(rewards).values(data).returning();
    return row;
  }

  async updateReward(id: number, data: Partial<InsertReward>): Promise<Reward | undefined> {
    const [row] = await db.update(rewards).set({ ...data, updatedAt: new Date() }).where(eq(rewards.id, id)).returning();
    return row;
  }

  async deleteReward(id: number): Promise<void> {
    await db.delete(rewardUnlocks).where(eq(rewardUnlocks.rewardId, id));
    await db.delete(rewards).where(eq(rewards.id, id));
  }

  async getMissionCompletions(startupId: number): Promise<MissionCompletion[]> {
    return db.select().from(missionCompletions).where(eq(missionCompletions.startupId, startupId));
  }

  async setMissionCompletion(milestoneId: number, startupId: number, status: string, adminId?: string): Promise<MissionCompletion> {
    const [existing] = await db.select().from(missionCompletions)
      .where(and(eq(missionCompletions.milestoneId, milestoneId), eq(missionCompletions.startupId, startupId)));

    const now = new Date();
    if (existing) {
      const updateData: any = { status, updatedAt: now };
      if (status === "scores_met" && existing.status !== "scores_met" && existing.status !== "admin_confirmed") {
        updateData.scoresMetAt = now;
      }
      if (status === "admin_confirmed" && existing.status !== "admin_confirmed") {
        updateData.adminConfirmedAt = now;
        updateData.adminConfirmedBy = adminId;
        if (!existing.scoresMetAt) updateData.scoresMetAt = now;
      }
      const [row] = await db.update(missionCompletions).set(updateData)
        .where(eq(missionCompletions.id, existing.id)).returning();
      return row;
    } else {
      const insertData: any = { milestoneId, startupId, status };
      if (status === "scores_met") insertData.scoresMetAt = now;
      if (status === "admin_confirmed") {
        insertData.scoresMetAt = now;
        insertData.adminConfirmedAt = now;
        insertData.adminConfirmedBy = adminId;
      }
      const [row] = await db.insert(missionCompletions).values(insertData).returning();
      return row;
    }
  }

  async getCompletionQueue(): Promise<(MissionCompletion & { startupName: string; milestoneTitle: string; requirements: any })[]> {
    const completions = await db.select().from(missionCompletions).where(eq(missionCompletions.status, "scores_met"));
    const allStartups = await db.select().from(startups);
    const allMilestones = await db.select().from(milestones);

    return completions.map(c => {
      const s = allStartups.find(s => s.id === c.startupId);
      const m = allMilestones.find(m => m.id === c.milestoneId);
      return {
        ...c,
        startupName: s?.name || "Unknown",
        milestoneTitle: m?.title || "Unknown",
        requirements: m?.requirements || {},
      };
    });
  }

  async getMissionReviewData(milestoneId: number, startupId: number): Promise<any> {
    const milestone = await db.select().from(milestones).where(eq(milestones.id, milestoneId));
    if (!milestone.length) throw new Error("Milestone not found");
    const requirements = milestone[0].requirements as Record<string, number>;

    const allModules = await db.select().from(modules);
    const allLevels = await db.select().from(levels);
    const allChecklistItems = await db.select().from(checklistItems);
    const allItemTools = await db.select().from(checklistItemTools);
    const allToolTemplates = await db.select().from(toolTemplates);

    const startupProgress = await db.select().from(checklistProgress)
      .where(and(eq(checklistProgress.startupId, startupId), eq(checklistProgress.completed, true)));
    const completedItemIds = new Set(startupProgress.map(p => p.checklistItemId));

    const startupToolEntries = await db.select().from(toolEntries)
      .where(eq(toolEntries.startupId, startupId));

    const result: any[] = [];

    for (const [dimensionName, requiredLevel] of Object.entries(requirements)) {
      const mod = allModules.find(m => m.kthDimension === dimensionName || m.name === dimensionName);
      if (!mod) continue;

      const modLevels = allLevels.filter(l => l.moduleId === mod.id && l.levelNumber <= requiredLevel)
        .sort((a, b) => a.levelNumber - b.levelNumber);

      const itemsByLevel = allChecklistItems.filter(ci => modLevels.some(l => l.id === ci.levelId));
      const itemIds = itemsByLevel.map(i => i.id);
      const relevantItemTools = allItemTools.filter(it => itemIds.includes(it.checklistItemId));
      const relevantToolIds = [...new Set(relevantItemTools.map(it => it.toolTemplateId))];
      const relevantTemplates = allToolTemplates.filter(t => relevantToolIds.includes(t.id));

      let achievedLevel = 0;
      for (const lvl of modLevels) {
        const lvlItems = allChecklistItems.filter(ci => ci.levelId === lvl.id);
        if (lvlItems.length === 0) break;
        if (isLevelDone(mod.id, lvl.levelNumber, lvlItems.map(i => i.id), completedItemIds)) {
          achievedLevel = lvl.levelNumber;
        } else break;
      }

      const levelsData = modLevels.map(lvl => {
        const lvlChecklist = allChecklistItems
          .filter(ci => ci.levelId === lvl.id)
          .sort((a, b) => a.displayOrder - b.displayOrder);

        const checklistWithStatus = lvlChecklist.map(ci => {
          const linkedToolIds = allItemTools
            .filter(it => it.checklistItemId === ci.id)
            .map(it => it.toolTemplateId);
          const linkedTools = relevantTemplates.filter(t => linkedToolIds.includes(t.id));
          const toolEntriesForItem = linkedTools.map(t => {
            const entry = startupToolEntries.find(e => e.toolTemplateId === t.id);
            return {
              toolTemplateId: t.id,
              toolName: t.name,
              toolType: t.toolType,
              hasEntry: !!entry,
              currentData: entry?.currentData || null,
            };
          });

          return {
            id: ci.id,
            label: ci.label,
            completed: completedItemIds.has(ci.id),
            tools: toolEntriesForItem,
          };
        });

        return {
          levelNumber: lvl.levelNumber,
          title: lvl.title,
          checklistItems: checklistWithStatus,
        };
      });

      result.push({
        dimensionName,
        moduleName: mod.name,
        moduleColor: mod.color,
        requiredLevel,
        achievedLevel,
        levels: levelsData,
      });
    }

    return result;
  }

  async getRewardUnlocks(startupId: number): Promise<RewardUnlock[]> {
    return db.select().from(rewardUnlocks).where(eq(rewardUnlocks.startupId, startupId));
  }

  async getAllRewardUnlocks(): Promise<(RewardUnlock & { startupName: string; rewardName: string; rewardType: string })[]> {
    const unlocks = await db.select().from(rewardUnlocks);
    const allStartups = await db.select().from(startups);
    const allRewards = await db.select().from(rewards);
    return unlocks.map(u => {
      const s = allStartups.find(s => s.id === u.startupId);
      const r = allRewards.find(r => r.id === u.rewardId);
      return { ...u, startupName: s?.name || "Unknown", rewardName: r?.name || "Unknown", rewardType: r?.type || "custom" };
    });
  }

  async createRewardUnlock(rewardId: number, startupId: number): Promise<RewardUnlock> {
    const [existing] = await db.select().from(rewardUnlocks)
      .where(and(eq(rewardUnlocks.rewardId, rewardId), eq(rewardUnlocks.startupId, startupId)));
    if (existing) return existing;
    const [row] = await db.insert(rewardUnlocks).values({ rewardId, startupId, unlockedAt: new Date() }).returning();
    return row;
  }

  async updateRewardUnlock(id: number, data: Partial<{ submittedAt: Date; reviewedAt: Date; reviewedBy: string; reviewStatus: string; reviewNotes: string }>): Promise<RewardUnlock | undefined> {
    const [row] = await db.update(rewardUnlocks).set(data).where(eq(rewardUnlocks.id, id)).returning();
    return row;
  }

  async getGrantQueue(): Promise<(RewardUnlock & { startupName: string; rewardName: string; rewardMetadata: any })[]> {
    const allUnlocks = await db.select().from(rewardUnlocks)
      .where(and(eq(rewardUnlocks.reviewStatus, "pending")));
    const allStartups = await db.select().from(startups);
    const allRewards = await db.select().from(rewards);
    const grantRewards = allRewards.filter(r => r.type === "grant_payment");
    const grantRewardIds = new Set(grantRewards.map(r => r.id));

    return allUnlocks
      .filter(u => grantRewardIds.has(u.rewardId) && u.submittedAt)
      .map(u => {
        const s = allStartups.find(s => s.id === u.startupId);
        const r = grantRewards.find(r => r.id === u.rewardId);
        return { ...u, startupName: s?.name || "Unknown", rewardName: r?.name || "Unknown", rewardMetadata: r?.metadata || {} };
      });
  }

  async checkAndUnlockRewards(startupId: number): Promise<RewardUnlock[]> {
    const allRewards = await db.select().from(rewards);
    const completions = await db.select().from(missionCompletions)
      .where(and(
        eq(missionCompletions.startupId, startupId),
        or(eq(missionCompletions.status, "admin_confirmed"), eq(missionCompletions.status, "scores_met"))
      ));
    const confirmedMilestoneIds = new Set(completions.map(c => c.milestoneId));

    const allMilestonesList = await db.select().from(milestones);

    const newUnlocks: RewardUnlock[] = [];
    for (const reward of allRewards) {
      const requiredMIds = (reward.requiredMissionIds as number[]) || [];
      const requiredGIds = (reward.requiredGroupIds as number[]) || [];
      if (requiredMIds.length === 0 && requiredGIds.length === 0) continue;

      const missionsMet = requiredMIds.every(id => confirmedMilestoneIds.has(id));

      let groupsMet = true;
      if (requiredGIds.length > 0) {
        for (const gId of requiredGIds) {
          const groupMilestones = allMilestonesList.filter(m => m.groupId === gId);
          if (groupMilestones.length === 0) { groupsMet = false; break; }
          const allConfirmed = groupMilestones.every(m => confirmedMilestoneIds.has(m.id));
          if (!allConfirmed) { groupsMet = false; break; }
        }
      }

      if (missionsMet && groupsMet) {
        const unlock = await this.createRewardUnlock(reward.id, startupId);
        newUnlocks.push(unlock);
      }
    }
    return newUnlocks;
  }

  async autoDetectScoresMet(startupId: number): Promise<MissionCompletion[]> {
    const readiness = await this.computeReadinessLevels(startupId);
    const allMilestones = await db.select().from(milestones);
    const existingCompletions = await db.select().from(missionCompletions)
      .where(eq(missionCompletions.startupId, startupId));

    const updated: MissionCompletion[] = [];
    const newlyCompletedIds: number[] = [];
    for (const milestone of allMilestones) {
      const requirements = milestone.requirements as Record<string, number>;
      const allMet = Object.entries(requirements).every(([dimName, reqLevel]) => {
        return (readiness[dimName] || 0) >= reqLevel;
      });

      const existing = existingCompletions.find(c => c.milestoneId === milestone.id);
      if (allMet && (!existing || existing.status === "incomplete")) {
        const completion = await this.setMissionCompletion(milestone.id, startupId, "scores_met");
        updated.push(completion);
        newlyCompletedIds.push(milestone.id);
      } else if (!allMet && existing && existing.status === "scores_met") {
        const completion = await this.setMissionCompletion(milestone.id, startupId, "incomplete");
        updated.push(completion);
      }
    }

    if (newlyCompletedIds.length > 0) {
      try {
        const [startup] = await db.select().from(startups).where(eq(startups.id, startupId));
        if (startup) {
          const currentActiveId = startup.activeMilestoneId ? Number(startup.activeMilestoneId) : null;
          const justCompletedActive = currentActiveId && newlyCompletedIds.includes(currentActiveId);
          if (justCompletedActive) {
            const completedMilestone = allMilestones.find(m => m.id === currentActiveId);
            if (completedMilestone?.groupId) {
              const groupMissions = allMilestones
                .filter(m => m.groupId === completedMilestone.groupId)
                .sort((a, b) => a.displayOrder - b.displayOrder);
              const currentIdx = groupMissions.findIndex(m => m.id === currentActiveId);
              const allCompletionsNow = [
                ...existingCompletions.filter(c => !updated.find(u => u.milestoneId === c.milestoneId)),
                ...updated,
              ];
              let nextMission = null;
              for (let i = currentIdx + 1; i < groupMissions.length; i++) {
                const comp = allCompletionsNow.find(c => c.milestoneId === groupMissions[i].id);
                if (!comp || (comp.status !== "scores_met" && comp.status !== "admin_confirmed")) {
                  nextMission = groupMissions[i];
                  break;
                }
              }
              if (nextMission) {
                await db.update(startups)
                  .set({ activeMilestoneId: String(nextMission.id) })
                  .where(eq(startups.id, startupId));
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to auto-advance active milestone:", err);
      }
    }

    return updated;
  }

  async getMatchingConfig(): Promise<any> {
    const saved = await this.getSystemSetting("matching_config");
    const defaults = getDefaultMatchingConfig();
    if (!saved) return defaults;
    try {
      const parsed = JSON.parse(saved);
      return deepMerge(defaults, parsed);
    } catch {
      return defaults;
    }
  }

  async updateMatchingConfig(config: any): Promise<void> {
    await this.setSystemSetting("matching_config", JSON.stringify(config));
  }

  async getFeedbackInsights(): Promise<FeedbackInsight | null> {
    const rows = await db.select().from(feedbackInsights).orderBy(desc(feedbackInsights.generatedAt)).limit(1);
    return rows.length > 0 ? rows[0] : null;
  }

  async saveFeedbackInsights(insights: any[], feedbackCount: number, generatedBy: string): Promise<FeedbackInsight> {
    const [created] = await db.insert(feedbackInsights).values({
      insights,
      feedbackCount,
      generatedBy,
    }).returning();
    return created;
  }

  async getStartupMissions(startupId: number): Promise<StartupMission[]> {
    return db.select().from(startupMissions).where(eq(startupMissions.startupId, startupId));
  }

  async assignMissionToStartup(startupId: number, milestoneId: number, assignedBy: string): Promise<StartupMission> {
    const existing = await db.select().from(startupMissions)
      .where(and(eq(startupMissions.startupId, startupId), eq(startupMissions.milestoneId, milestoneId)));
    if (existing.length > 0) return existing[0];
    const [result] = await db.insert(startupMissions).values({ startupId, milestoneId, assignedBy }).returning();
    return result;
  }

  async removeMissionFromStartup(startupId: number, milestoneId: number): Promise<void> {
    await db.delete(startupMissions).where(
      and(eq(startupMissions.startupId, startupId), eq(startupMissions.milestoneId, milestoneId))
    );
  }

  // --- Cohorts ---
  async getCohortsByProgramme(programmeId: number): Promise<Cohort[]> {
    return db.select().from(cohorts).where(eq(cohorts.programmeId, programmeId));
  }

  async getCohort(id: number): Promise<Cohort | undefined> {
    const [result] = await db.select().from(cohorts).where(eq(cohorts.id, id));
    return result;
  }

  async createCohort(data: InsertCohort): Promise<Cohort> {
    const [result] = await db.insert(cohorts).values(data).returning();
    return result;
  }

  async updateCohort(id: number, data: Partial<InsertCohort>): Promise<Cohort | undefined> {
    const [result] = await db.update(cohorts).set(data).where(eq(cohorts.id, id)).returning();
    return result;
  }

  async deleteCohort(id: number): Promise<void> {
    await db.delete(startupCohorts).where(eq(startupCohorts.cohortId, id));
    const groupsInCohort = await db.select().from(groups).where(eq(groups.cohortId, id));
    for (const g of groupsInCohort) {
      await db.delete(startupGroups).where(eq(startupGroups.groupId, g.id));
      await db.delete(eirGroupAssignments).where(eq(eirGroupAssignments.groupId, g.id));
    }
    await db.delete(groups).where(eq(groups.cohortId, id));
    await db.delete(cohorts).where(eq(cohorts.id, id));
  }

  // --- Groups ---
  async getGroupsByCohort(cohortId: number): Promise<Group[]> {
    return db.select().from(groups).where(eq(groups.cohortId, cohortId));
  }

  async getGroupsByProgramme(programmeId: number): Promise<Group[]> {
    const programmeCohorts = await db.select().from(cohorts).where(eq(cohorts.programmeId, programmeId));
    if (programmeCohorts.length === 0) return [];
    const cohortIds = programmeCohorts.map(c => c.id);
    return db.select().from(groups).where(inArray(groups.cohortId, cohortIds));
  }

  async getGroup(id: number): Promise<Group | undefined> {
    const [result] = await db.select().from(groups).where(eq(groups.id, id));
    return result;
  }

  async createGroup(data: InsertGroup): Promise<Group> {
    const [result] = await db.insert(groups).values(data).returning();
    return result;
  }

  async updateGroup(id: number, data: Partial<InsertGroup>): Promise<Group | undefined> {
    const [result] = await db.update(groups).set(data).where(eq(groups.id, id)).returning();
    return result;
  }

  async deleteGroup(id: number): Promise<void> {
    await db.delete(startupGroups).where(eq(startupGroups.groupId, id));
    await db.delete(eirGroupAssignments).where(eq(eirGroupAssignments.groupId, id));
    await db.delete(groups).where(eq(groups.id, id));
  }

  // --- Startup-Cohort assignments ---
  async addStartupToCohort(startupId: number, cohortId: number): Promise<StartupCohort> {
    const existing = await db.select().from(startupCohorts)
      .where(and(eq(startupCohorts.startupId, startupId), eq(startupCohorts.cohortId, cohortId)));
    if (existing.length > 0) return existing[0];
    const [result] = await db.insert(startupCohorts).values({ startupId, cohortId }).returning();
    return result;
  }

  async removeStartupFromCohort(startupId: number, cohortId: number): Promise<void> {
    await db.delete(startupCohorts).where(
      and(eq(startupCohorts.startupId, startupId), eq(startupCohorts.cohortId, cohortId))
    );
  }

  async getStartupCohorts(startupId: number): Promise<Cohort[]> {
    const assignments = await db.select().from(startupCohorts).where(eq(startupCohorts.startupId, startupId));
    if (assignments.length === 0) return [];
    const cohortIds = assignments.map(a => a.cohortId);
    return db.select().from(cohorts).where(inArray(cohorts.id, cohortIds));
  }

  async getStartupsInCohort(cohortId: number): Promise<Startup[]> {
    const assignments = await db.select().from(startupCohorts).where(eq(startupCohorts.cohortId, cohortId));
    if (assignments.length === 0) return [];
    const startupIds = assignments.map(a => a.startupId);
    return db.select().from(startups).where(inArray(startups.id, startupIds));
  }

  // --- Startup-Group assignments ---
  async addStartupToGroup(startupId: number, groupId: number): Promise<StartupGroup> {
    const existing = await db.select().from(startupGroups)
      .where(and(eq(startupGroups.startupId, startupId), eq(startupGroups.groupId, groupId)));
    if (existing.length > 0) return existing[0];
    const [result] = await db.insert(startupGroups).values({ startupId, groupId }).returning();
    return result;
  }

  async removeStartupFromGroup(startupId: number, groupId: number): Promise<void> {
    await db.delete(startupGroups).where(
      and(eq(startupGroups.startupId, startupId), eq(startupGroups.groupId, groupId))
    );
  }

  async getStartupGroups(startupId: number): Promise<Group[]> {
    const assignments = await db.select().from(startupGroups).where(eq(startupGroups.startupId, startupId));
    if (assignments.length === 0) return [];
    const groupIds = assignments.map(a => a.groupId);
    return db.select().from(groups).where(inArray(groups.id, groupIds));
  }

  async getStartupsInGroup(groupId: number): Promise<Startup[]> {
    const assignments = await db.select().from(startupGroups).where(eq(startupGroups.groupId, groupId));
    if (assignments.length === 0) return [];
    const startupIds = assignments.map(a => a.startupId);
    return db.select().from(startups).where(inArray(startups.id, startupIds));
  }

  // --- EIR Group assignments ---
  async assignEirToGroup(userId: string, groupId: number, assignedBy: string): Promise<EirGroupAssignment> {
    const existing = await db.select().from(eirGroupAssignments)
      .where(and(eq(eirGroupAssignments.userId, userId), eq(eirGroupAssignments.groupId, groupId)));
    if (existing.length > 0) return existing[0];
    const [result] = await db.insert(eirGroupAssignments).values({ userId, groupId, assignedBy }).returning();
    return result;
  }

  async removeEirFromGroup(userId: string, groupId: number): Promise<void> {
    await db.delete(eirGroupAssignments).where(
      and(eq(eirGroupAssignments.userId, userId), eq(eirGroupAssignments.groupId, groupId))
    );
  }

  async getEirGroups(userId: string): Promise<(Group & { cohortName: string; programmeName: string; programmeId: number })[]> {
    const assignments = await db.select().from(eirGroupAssignments).where(eq(eirGroupAssignments.userId, userId));
    if (assignments.length === 0) return [];
    const groupIds = assignments.map(a => a.groupId);
    const groupRows = await db.select().from(groups).where(inArray(groups.id, groupIds));
    if (groupRows.length === 0) return [];
    const cohortIds = [...new Set(groupRows.map(g => g.cohortId))];
    const cohortRows = await db.select().from(cohorts).where(inArray(cohorts.id, cohortIds));
    const programmeIds = [...new Set(cohortRows.map(c => c.programmeId))];
    const programmeRows = await db.select().from(programmes).where(inArray(programmes.id, programmeIds));

    const cohortMap = new Map(cohortRows.map(c => [c.id, c]));
    const programmeMap = new Map(programmeRows.map(p => [p.id, p]));

    return groupRows.map(g => {
      const cohort = cohortMap.get(g.cohortId)!;
      const programme = programmeMap.get(cohort.programmeId)!;
      return { ...g, cohortName: cohort.name, programmeName: programme.name, programmeId: programme.id };
    });
  }

  async getGroupEirs(groupId: number): Promise<(EirGroupAssignment & { user: User })[]> {
    const assignments = await db.select().from(eirGroupAssignments).where(eq(eirGroupAssignments.groupId, groupId));
    if (assignments.length === 0) return [];
    const userIds = assignments.map(a => a.userId);
    const userRows = await db.select().from(users).where(inArray(users.id, userIds));
    const userMap = new Map(userRows.map(u => [u.id, u]));
    // Only return users who still have the EIR permission — a user who has
    // had EIR removed keeps their group assignment row for audit but should
    // not appear in EIR-facing lists.
    return assignments
      .map(a => ({ ...a, user: userMap.get(a.userId)! }))
      .filter(a => a.user && a.user.isEir === true);
  }

  async isEir(userId: string): Promise<boolean> {
    const user = await this.getUser(userId);
    return user?.isEir === true;
  }

  async setUserIsEir(userId: string, isEir: boolean): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ isEir, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async getEirsForStartup(startupId: number): Promise<User[]> {
    const groupRows = await db
      .select({ groupId: startupGroups.groupId })
      .from(startupGroups)
      .where(eq(startupGroups.startupId, startupId));
    if (groupRows.length === 0) return [];
    const groupIds = groupRows.map((g) => g.groupId);
    const assignmentRows = await db
      .select({ userId: eirGroupAssignments.userId })
      .from(eirGroupAssignments)
      .where(inArray(eirGroupAssignments.groupId, groupIds));
    const userIds = Array.from(new Set(assignmentRows.map((a) => a.userId)));
    if (userIds.length === 0) return [];
    const userRows = await db
      .select()
      .from(users)
      .where(inArray(users.id, userIds));
    return userRows.filter((u) => u.isEir === true);
  }

  async getEirsForFounder(userId: string): Promise<User[]> {
    const memberships = await db
      .select({ startupId: startupMembers.startupId })
      .from(startupMembers)
      .where(eq(startupMembers.userId, userId));
    if (memberships.length === 0) return [];
    const startupIds = Array.from(new Set(memberships.map((m) => m.startupId)));
    const seen = new Set<string>();
    const out: User[] = [];
    for (const sid of startupIds) {
      const eirs = await this.getEirsForStartup(sid);
      for (const e of eirs) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        out.push(e);
      }
    }
    return out;
  }

  async createEirSessionRequest(data: InsertEirSessionRequest): Promise<EirSessionRequest> {
    const [row] = await db.insert(eirSessionRequests).values(data).returning();
    return row;
  }

  async getEirSessionRequestsForFounder(userId: string): Promise<EirSessionRequest[]> {
    return db
      .select()
      .from(eirSessionRequests)
      .where(eq(eirSessionRequests.founderUserId, userId))
      .orderBy(desc(eirSessionRequests.createdAt));
  }

  // --- Filtered stats ---
  async getProgressSnapshotForStartups(startupIds: number[]): Promise<any[]> {
    if (startupIds.length === 0) return [];

    const allProgress = await db
      .select({
        startupId: checklistProgress.startupId,
        checklistItemId: checklistProgress.checklistItemId,
        completed: checklistProgress.completed,
      })
      .from(checklistProgress)
      .where(and(eq(checklistProgress.completed, true), inArray(checklistProgress.startupId, startupIds)));

    const allItems = await db
      .select({
        id: checklistItems.id,
        levelId: checklistItems.levelId,
        moduleId: levels.moduleId,
        levelNumber: levels.levelNumber,
      })
      .from(checklistItems)
      .innerJoin(levels, eq(checklistItems.levelId, levels.id));

    const allModules = await this.getModules();
    const targetStartups = await db.select({ id: startups.id, name: startups.name }).from(startups).where(inArray(startups.id, startupIds));

    return targetStartups.map(s => {
      const progressForStartup = allProgress.filter(p => p.startupId === s.id);
      const completedItemIds = new Set(progressForStartup.map(p => p.checklistItemId));

      const dimensions: Record<string, { achieved: number; totalItems: number; completedItems: number }> = {};
      for (const mod of allModules) {
        const modItems = allItems.filter(i => i.moduleId === mod.id);
        const completedCount = modItems.filter(i => completedItemIds.has(i.id)).length;
        const itemsByLevel = new Map<number, number[]>();
        for (const item of modItems) {
          const arr = itemsByLevel.get(item.levelNumber) || [];
          arr.push(item.id);
          itemsByLevel.set(item.levelNumber, arr);
        }
        let achievedLevel = 0;
        for (let lvl = 1; lvl <= 9; lvl++) {
          const itemsAtLevel = itemsByLevel.get(lvl) || [];
          if (itemsAtLevel.length === 0) break;
          if (isLevelDone(mod.id, lvl, itemsAtLevel, completedItemIds)) achievedLevel = lvl;
          else break;
        }
        dimensions[mod.name] = { achieved: achievedLevel, totalItems: modItems.length, completedItems: completedCount };
      }

      return { startupId: s.id, startupName: s.name, dimensions };
    });
  }

  async getDashboardStatsFiltered(options?: { cohortId?: number; groupId?: number }): Promise<any> {
    let startupIds: number[] | null = null;

    if (options?.groupId) {
      const startupsInGroup = await this.getStartupsInGroup(options.groupId);
      startupIds = startupsInGroup.map(s => s.id);
    } else if (options?.cohortId) {
      const startupsInCohort = await this.getStartupsInCohort(options.cohortId);
      startupIds = startupsInCohort.map(s => s.id);
    }

    if (startupIds !== null && startupIds.length === 0) {
      return {
        totalCompanies: 0,
        averageReadiness: 0,
        dimensionAverages: {},
        highestReadiness: null,
        recentActivity: 0,
      };
    }

    const snapshot = startupIds !== null
      ? await this.getProgressSnapshotForStartups(startupIds)
      : await this.getProgressSnapshotForAllStartups();

    const dimensionTotals: Record<string, { sum: number; count: number }> = {};
    const companyAverages: { name: string; avg: number }[] = [];

    for (const s of snapshot) {
      const dims = Object.entries(s.dimensions) as [string, { achieved: number }][];
      let companySum = 0;
      let companyCount = 0;
      for (const [name, dim] of dims) {
        if (!dimensionTotals[name]) dimensionTotals[name] = { sum: 0, count: 0 };
        dimensionTotals[name].sum += dim.achieved;
        dimensionTotals[name].count += 1;
        companySum += dim.achieved;
        companyCount++;
      }
      if (companyCount > 0) companyAverages.push({ name: s.startupName, avg: companySum / companyCount });
    }

    const dimensionAverages: Record<string, number> = {};
    let totalLevels = 0;
    let totalDims = 0;
    for (const [name, totals] of Object.entries(dimensionTotals)) {
      dimensionAverages[name] = totals.count > 0 ? Math.round((totals.sum / totals.count) * 10) / 10 : 0;
      totalLevels += totals.sum;
      totalDims += totals.count;
    }

    const averageReadiness = totalDims > 0 ? Math.round((totalLevels / totalDims) * 10) / 10 : 0;
    const sorted = companyAverages.sort((a, b) => b.avg - a.avg);
    const highestReadiness = sorted.length > 0 ? { name: sorted[0].name, level: Math.round(sorted[0].avg * 10) / 10 } : null;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let recentActivityCount = 0;
    if (startupIds !== null) {
      if (startupIds.length > 0) {
        const recent = await db.select().from(checklistProgress)
          .where(and(eq(checklistProgress.completed, true), gte(checklistProgress.completedAt, sevenDaysAgo), inArray(checklistProgress.startupId, startupIds)));
        recentActivityCount = recent.length;
      }
    } else {
      const recent = await db.select().from(checklistProgress)
        .where(and(eq(checklistProgress.completed, true), gte(checklistProgress.completedAt, sevenDaysAgo)));
      recentActivityCount = recent.length;
    }

    return {
      totalCompanies: snapshot.length,
      averageReadiness,
      dimensionAverages,
      highestReadiness,
      recentActivity: recentActivityCount,
    };
  }

  async upgradeMilestoneNames(): Promise<void> {
    const allMilestones = await db.select().from(milestones);
    const renames: Record<string, { title: string; tagline: string }> = {
      "Validate initial customer demand": { title: "Ready to Validate Customer Demand", tagline: "Demonstrate that you understand your market and customers." },
      "Raise pre-seed round": { title: "Ready to Raise Pre-Seed", tagline: "Prove you're ready across all dimensions — then we'll connect you with investors." },
      "Secure first pilot customer": { title: "Ready to Secure First Pilot", tagline: "Show you're prepared to deliver value to a real customer." },
      "Raise seed round": { title: "Ready to Raise Seed", tagline: "Reach the readiness level that institutional investors expect." },
    };

    for (const m of allMilestones) {
      const rename = renames[m.title];
      if (rename) {
        await db.update(milestones).set({ title: rename.title, tagline: rename.tagline, updatedAt: new Date() }).where(eq(milestones.id, m.id));
        console.log(`Renamed milestone "${m.title}" → "${rename.title}"`);
      }
    }

    const allRewards = await db.select().from(rewards);
    const rewardColors: Record<string, string> = {
      "Get matched to a mentor": "teal",
      "Validation Grant": "amber",
      "Access to Investor Introductions": "purple",
    };
    for (const r of allRewards) {
      const color = rewardColors[r.name];
      if (color && r.accentColor !== color) {
        await db.update(rewards).set({ accentColor: color, updatedAt: new Date() }).where(eq(rewards.id, r.id));
        console.log(`Set reward "${r.name}" accent color to ${color}`);
      }
    }
  }

  async getInlineToolConfigs(): Promise<InlineToolConfig[]> {
    return db.select().from(inlineToolConfigs);
  }

  async getInlineToolConfig(id: number): Promise<InlineToolConfig | undefined> {
    const [config] = await db.select().from(inlineToolConfigs).where(eq(inlineToolConfigs.id, id));
    return config;
  }

  async getInlineToolConfigsByLevel(levelId: number): Promise<InlineToolConfig[]> {
    const rows = await db.select({ config: inlineToolConfigs }).from(inlineToolConfigs)
      .innerJoin(checklistItems, eq(inlineToolConfigs.checklistItemId, checklistItems.id))
      .where(eq(checklistItems.levelId, levelId));
    return rows.map(r => r.config);
  }

  async getInlineToolConfigByChecklistItem(checklistItemId: number): Promise<InlineToolConfig | undefined> {
    const [config] = await db.select().from(inlineToolConfigs)
      .where(eq(inlineToolConfigs.checklistItemId, checklistItemId));
    return config;
  }

  async getInlineToolConfigByStableKey(stableKey: string): Promise<InlineToolConfig | undefined> {
    const [config] = await db.select().from(inlineToolConfigs)
      .where(eq(inlineToolConfigs.stableKey, stableKey));
    return config;
  }

  async createInlineToolConfig(data: InsertInlineToolConfig): Promise<InlineToolConfig> {
    const [config] = await db.insert(inlineToolConfigs).values(data).returning();
    return config;
  }

  async updateInlineToolConfig(id: number, data: Partial<InsertInlineToolConfig>): Promise<InlineToolConfig | undefined> {
    const [config] = await db.update(inlineToolConfigs).set(data).where(eq(inlineToolConfigs.id, id)).returning();
    return config;
  }

  async deleteInlineToolConfig(id: number): Promise<void> {
    await db.delete(toolExampleData).where(eq(toolExampleData.inlineToolConfigId, id));
    await db.delete(inlineToolConfigs).where(eq(inlineToolConfigs.id, id));
  }

  async getExampleCompanies(): Promise<ExampleCompany[]> {
    return db.select().from(exampleCompanies).orderBy(exampleCompanies.displayOrder);
  }

  async createExampleCompany(data: InsertExampleCompany): Promise<ExampleCompany> {
    const [company] = await db.insert(exampleCompanies).values(data).returning();
    return company;
  }

  async updateExampleCompany(id: number, data: Partial<InsertExampleCompany>): Promise<ExampleCompany | undefined> {
    const [company] = await db.update(exampleCompanies).set(data).where(eq(exampleCompanies.id, id)).returning();
    return company;
  }

  async deleteExampleCompany(id: number): Promise<void> {
    await db.delete(toolExampleData).where(eq(toolExampleData.exampleCompanyId, id));
    await db.delete(exampleCompanies).where(eq(exampleCompanies.id, id));
  }

  async getToolExampleData(inlineToolConfigId: number): Promise<ToolExampleData[]> {
    return db.select().from(toolExampleData).where(eq(toolExampleData.inlineToolConfigId, inlineToolConfigId));
  }

  async upsertToolExampleData(inlineToolConfigId: number, exampleCompanyId: number, data: any): Promise<ToolExampleData> {
    const [existing] = await db.select().from(toolExampleData)
      .where(and(eq(toolExampleData.inlineToolConfigId, inlineToolConfigId), eq(toolExampleData.exampleCompanyId, exampleCompanyId)));
    if (existing) {
      const [updated] = await db.update(toolExampleData).set({ exampleData: data })
        .where(eq(toolExampleData.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(toolExampleData).values({ inlineToolConfigId, exampleCompanyId, exampleData: data }).returning();
    return created;
  }

  async deleteToolExampleData(id: number): Promise<void> {
    await db.delete(toolExampleData).where(eq(toolExampleData.id, id));
  }

  async seedInlineToolConfigs(): Promise<void> {
    // === One-shot de-duplication migration (idempotent) ===
    // Historical seed runs accumulated thousands of duplicate config rows per
    // checklist_item_id. Keep the highest-id row per checklist_item_id, repoint
    // any tool_example_data rows pointing at duplicates, and drop the rest.
    const dupCheck = await db.execute(sql`
      SELECT COUNT(*)::int AS c FROM (
        SELECT checklist_item_id FROM inline_tool_configs
        GROUP BY checklist_item_id HAVING COUNT(*) > 1
      ) d
    `);
    const dupGroups = Number((dupCheck.rows[0] as any)?.c ?? 0);
    if (dupGroups > 0) {
      const totalBefore = await db.execute(sql`SELECT COUNT(*)::int AS c FROM inline_tool_configs`);
      console.log(`[inline_tool_configs] De-dup migration: ${dupGroups} checklist items have duplicate configs; total rows before=${(totalBefore.rows[0] as any).c}`);
      await db.transaction(async (tx) => {
        await tx.execute(sql`
          UPDATE tool_example_data ted
          SET inline_tool_config_id = keeper.keeper_id
          FROM (
            SELECT checklist_item_id, MAX(id) AS keeper_id
            FROM inline_tool_configs
            GROUP BY checklist_item_id
          ) keeper
          JOIN inline_tool_configs dup
            ON dup.checklist_item_id = keeper.checklist_item_id
           AND dup.id <> keeper.keeper_id
          WHERE ted.inline_tool_config_id = dup.id
        `);
        await tx.execute(sql`
          DELETE FROM inline_tool_configs
          WHERE id IN (
            SELECT id FROM (
              SELECT id,
                     ROW_NUMBER() OVER (PARTITION BY checklist_item_id ORDER BY id DESC) AS rn
              FROM inline_tool_configs
            ) ranked
            WHERE rn > 1
          )
        `);
      });
      const totalAfter = await db.execute(sql`SELECT COUNT(*)::int AS c FROM inline_tool_configs`);
      console.log(`[inline_tool_configs] De-dup migration complete; total rows after=${(totalAfter.rows[0] as any).c}`);
    }

    // === Normalise stable_key to canonical "DIM:LEVEL:ORDER" for every row ===
    // The two-step UPDATE (temp keys → canonical keys) avoids transient
    // UNIQUE(stable_key) conflicts when rows need to swap keys, so we can then
    // add the UNIQUE constraint and upsert by stable_key safely.
    await db.transaction(async (tx) => {
      await tx.execute(sql`UPDATE inline_tool_configs SET stable_key = '__migrate_' || id`);
      await tx.execute(sql`
        UPDATE inline_tool_configs itc
        SET stable_key = m.kth_dimension || ':' || l.level_number || ':' || ci.display_order
        FROM checklist_items ci
        JOIN levels l ON l.id = ci.level_id
        JOIN modules m ON m.id = l.module_id
        WHERE itc.checklist_item_id = ci.id
      `);
    });

    // === Ensure unique constraints (idempotent) ===
    // checklist_item_id: hard guarantee one config per checklist item.
    // stable_key:        enables upsert-by-stable-key seeding and surfaces
    //                    key-identity drift immediately.
    for (const { name, ddl } of [
      { name: "checklist_item_id", ddl: sql`ALTER TABLE inline_tool_configs ADD CONSTRAINT inline_tool_configs_checklist_item_id_unique UNIQUE (checklist_item_id)` },
      { name: "stable_key",        ddl: sql`ALTER TABLE inline_tool_configs ADD CONSTRAINT inline_tool_configs_stable_key_unique UNIQUE (stable_key)` },
    ]) {
      try {
        await db.execute(ddl);
        console.log(`[inline_tool_configs] Added UNIQUE(${name}) constraint`);
      } catch (err: any) {
        const msg = String(err?.message ?? err);
        if (!/already exists|duplicate/i.test(msg)) {
          console.warn(`[inline_tool_configs] Could not add UNIQUE(${name}) constraint:`, msg);
        }
      }
    }

    const existing = await db.select().from(inlineToolConfigs);
    const existingKeys = new Set(existing.map(c => c.stableKey));

    const allItems = await db.select().from(checklistItems)
      .innerJoin(levels, eq(checklistItems.levelId, levels.id))
      .innerJoin(modules, eq(levels.moduleId, modules.id));

    const itemMap = new Map<string, number>();
    const itemsByDimLevel = new Map<string, { id: number; displayOrder: number; label: string }[]>();
    for (const row of allItems) {
      const r = row as Record<string, Record<string, unknown>>;
      const mod = r["modules"] || {};
      const lvl = r["levels"] || {};
      const ci = r["checklist_items"] || {};
      const key = `${mod.kthDimension}:${lvl.levelNumber}:${ci.displayOrder}`;
      itemMap.set(key, ci.id as number);
      const dimLvlKey = `${mod.kthDimension}:${lvl.levelNumber}`;
      if (!itemsByDimLevel.has(dimLvlKey)) itemsByDimLevel.set(dimLvlKey, []);
      itemsByDimLevel.get(dimLvlKey)!.push({ id: ci.id as number, displayOrder: ci.displayOrder as number, label: ci.label as string });
    }
    for (const items of itemsByDimLevel.values()) {
      items.sort((a, b) => a.displayOrder - b.displayOrder);
    }

    const TOOL_IDS = {
      LEAN_CANVAS: 1, CUSTOMER_PROFILE: 2, PITCH_DECK: 3, VPC: 4,
      TEA: 5, COMPETITOR: 6, TAM: 7, SWOT: 8, IP_STRATEGY: 9,
      TEAM_MATRIX: 10, FINANCIAL: 11, FUNDING_STRATEGY: 12, SALES_DECK: 13,
    };

    const configs: InsertInlineToolConfig[] = [
      {
        stableKey: "CRL:1:1", layoutType: "fill_in_gaps", title: "Customer Segments", icon: "Users",
        fieldDefinitions: [
          { key: "customerSegment", label: "Customer segment", type: "text", placeholder: "customer segment" },
          { key: "problem", label: "Problem", type: "text", placeholder: "problem" },
          { key: "impacts", label: "Resulting in", type: "checkbox_group", options: ["Revenue loss", "Cost increase", "Regulatory issues"], allowCustom: true },
        ],
        templateSentence: "As a {customerSegment}, I am facing {problem}, which is resulting in:",
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_customerSegments",
        completenessType: "list", completenessFields: ["customerSegment", "problem", "impacts"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:1:2", layoutType: "repeatable_list", title: "TAM by Segment", icon: "DollarSign",
        fieldDefinitions: [
          { key: "segmentName", label: "Customer Segment", type: "text", placeholder: "e.g. UK homeowners", required: true },
          { key: "avgSpendPerYear", label: "Avg. annual spend per customer", type: "currency", placeholder: "0" },
          { key: "customerCount", label: "Global customers in segment", type: "number", placeholder: "0" },
          { key: "segmentTAM", label: "Segment TAM", type: "currency", formula: "{avgSpendPerYear} * {customerCount}", readOnly: true },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_segmentTAMs",
        completenessType: "list", completenessFields: ["segmentName"],
        syncsToLabel: "Lean Canvas",
        runningTotals: { field: "segmentTAM", label: "Total Addressable Market (TAM)", formula: "{avgSpendPerYear} * {customerCount}" },
        requiresPreviousComplete: true,
        prePopulateFrom: { toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_customerSegments", fieldMap: { segmentName: "customerSegment" } },
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:2:1", layoutType: "repeatable_list", title: "Market Size Evidence", icon: "BarChart3",
        fieldDefinitions: [
          { key: "segmentName", label: "Customer Segment", type: "text", placeholder: "e.g. UK homeowners", required: true },
          { key: "calculatedTAM", label: "Estimated TAM", type: "currency", placeholder: "0" },
          { key: "sources", label: "Evidence Sources", type: "sources_list" },
        ],
        toolTemplateId: TOOL_IDS.TAM, dataKey: "_marketSizeEvidence",
        completenessType: "list", completenessFields: ["segmentName", "calculatedTAM"],
        syncsToLabel: "TAM/SAM/SOM",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_segmentTAMs", fieldMap: { segmentName: "segmentName", calculatedTAM: "{avgSpendPerYear}*{customerCount}" } },
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:2:2", layoutType: "competitor_analysis", title: "Current Alternatives", icon: "Search",
        fieldDefinitions: [
          { key: "segmentName", label: "Customer Segment", type: "text", required: true },
        ],
        toolTemplateId: TOOL_IDS.COMPETITOR, dataKey: "_alternatives",
        completenessType: "list", completenessFields: ["segmentName"],
        syncsToLabel: "Competitor Analysis",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_customerSegments", fieldMap: { segmentName: "customerSegment" } },
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:2:3", layoutType: "repeatable_list", title: "Problem Quantifier", icon: "Target",
        fieldDefinitions: [
          { key: "segment", label: "Customer Segment", type: "text", placeholder: "Customer segment", required: true },
          { key: "problem", label: "Customer Problem", type: "textarea", placeholder: "What problem does this segment face?" },
          { key: "frequency", label: "How often does this problem occur?", type: "radio", options: ["Daily", "Weekly", "Monthly", "Yearly"] },
          { key: "cost", label: "Financial impact of problem per customer, per year", type: "currency", placeholder: "0" },
          { key: "severity", label: "Severity", type: "slider", min: 1, max: 10, minLabel: "Minor inconvenience", maxLabel: "Critical blocker" },
        ],
        toolTemplateId: TOOL_IDS.CUSTOMER_PROFILE, dataKey: "_problemQuantification",
        completenessType: "list", completenessFields: ["segment", "frequency", "cost", "severity"],
        prePopulateFrom: { toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_customerSegments", fieldMap: { segment: "customerSegment", problem: "problem" } },
        syncsToLabel: "Customer Profiles",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:3:1", layoutType: "repeatable_list", title: "Interview Log", icon: "MessageSquare",
        fieldDefinitions: [
          { key: "interviewType", label: "Type", type: "radio", options: ["customer", "expert"], widthHint: "half" },
          { key: "who", label: "Name / Company", type: "text", placeholder: "Name / Company" },
          { key: "role", label: "Role", type: "select", options: ["Customer", "Expert"] },
          { key: "keyQuote", label: "Key Quote", type: "text", placeholder: "Key quote or statement..." },
          { key: "insight", label: "Insight", type: "text", placeholder: "Your key insight..." },
        ],
        toolTemplateId: TOOL_IDS.CUSTOMER_PROFILE, dataKey: "_interviewLog",
        completenessType: "list", completenessFields: ["who", "role", "keyQuote", "insight"],
        syncsToLabel: "Customer Profiles",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:3:2", layoutType: "repeatable_list", title: "Industry Map", icon: "Building2",
        fieldDefinitions: [
          { key: "name", label: "Company", type: "text", placeholder: "Company/player name" },
          { key: "type", label: "Type", type: "select", options: ["Incumbent", "Startup", "Scale-up", "Adjacent player"] },
          { key: "marketShare", label: "Market Share %", type: "text", placeholder: "Est. market share %" },
          { key: "trend", label: "Trend", type: "select", options: ["Growing", "Declining", "Stable"] },
        ],
        toolTemplateId: TOOL_IDS.COMPETITOR, dataKey: "_industryMap",
        completenessType: "list", completenessFields: ["name", "type", "marketShare", "trend"],
        syncsToLabel: "Competitor Analysis",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.COMPETITOR, dataKey: "_alternatives", fieldMap: { name: "name" }, flattenKey: "competitors" },
        toolLevelFields: [
          { key: "sources", label: "Sources", type: "sources_list" },
        ],
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:3:3", layoutType: "repeatable_list", title: "Segment Sizing", icon: "BarChart3",
        fieldDefinitions: [
          { key: "segment", label: "Segment", type: "text", placeholder: "Market segment name" },
          { key: "size", label: "Size ($)", type: "text", placeholder: "Segment size ($)" },
          { key: "source", label: "Source", type: "text", placeholder: "Data source" },
          { key: "growth", label: "Growth %", type: "text", placeholder: "Growth rate %" },
        ],
        toolTemplateId: TOOL_IDS.TAM, dataKey: "_segmentSizes",
        completenessType: "list", completenessFields: ["segment", "size", "source", "growth"],
        syncsToLabel: "TAM/SAM/SOM",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:3:4", layoutType: "repeatable_list", title: "Segment Refinement", icon: "Users",
        fieldDefinitions: [
          { key: "name", label: "Segment", type: "text", placeholder: "Segment name" },
          { key: "demographics", label: "Demographics", type: "text", placeholder: "Who are they?" },
          { key: "behaviors", label: "Behaviours", type: "text", placeholder: "What do they do?" },
          { key: "needs", label: "Needs", type: "text", placeholder: "What do they need?" },
        ],
        toolTemplateId: TOOL_IDS.CUSTOMER_PROFILE, dataKey: "_segmentRefinement",
        completenessType: "list", completenessFields: ["name", "demographics", "behaviors", "needs"],
        syncsToLabel: "Customer Profiles",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:3:5", layoutType: "single_object", title: "Problem Hypothesis Evolution", icon: "TrendingUp",
        fieldDefinitions: [
          { key: "original", label: "Original hypothesis", type: "textarea", placeholder: "What you originally believed the problem was..." },
          { key: "keyChange", label: "What changed & why", type: "text", placeholder: "Key change based on feedback..." },
          { key: "evidence", label: "Evidence", type: "text", placeholder: "Sources that changed your thinking..." },
          { key: "revised", label: "Revised problem statement", type: "textarea", placeholder: "Your updated problem statement..." },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_problemEvolution",
        completenessType: "object", completenessFields: ["original", "revised", "evidence", "keyChange"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:4:1", layoutType: "single_object", title: "Validation Evidence", icon: "UserCheck",
        fieldDefinitions: [
          { key: "interviewCount", label: "Interviews conducted", type: "text", placeholder: "e.g., 32" },
          { key: "hypotheses", label: "Linked hypotheses", type: "checkbox_group", optionsFromApi: "/api/startups/:startupId/assumptions/hypotheses" },
          { key: "confidence", label: "Confidence level that the customer would pay to solve the problem", type: "slider", min: 1, max: 10, minLabel: "Low", maxLabel: "High" },
          { key: "keyThemes", label: "Consistent themes", type: "textarea", placeholder: "Top themes from interviews..." },
          { key: "topQuotes", label: "Top supporting quotes", type: "textarea", placeholder: "Most compelling quotes..." },
        ],
        toolTemplateId: TOOL_IDS.CUSTOMER_PROFILE, dataKey: "_validationEvidence",
        completenessType: "object", completenessFields: ["interviewCount", "hypotheses", "keyThemes", "topQuotes", "confidence"],
        syncsToLabel: "Customer Profiles",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:4:2", layoutType: "value_chain", title: "Value Chain Map", icon: "Route",
        fieldDefinitions: [],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_valueChain",
        completenessType: "value_chain", completenessFields: [],
        dataSyncRules: [{ sourceField: "steps", targetField: "_channels", targetToolTemplateId: TOOL_IDS.LEAN_CANVAS, syncMode: "value_chain_partners" }],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:4:3", layoutType: "repeatable_list", title: "Segment Refinement", icon: "Users",
        fieldDefinitions: [
          { key: "name", label: "Segment", type: "text", placeholder: "Segment name" },
          { key: "demographics", label: "Demographics", type: "text", placeholder: "Who are they?" },
          { key: "behaviors", label: "Behaviours", type: "text", placeholder: "What do they do?" },
          { key: "needs", label: "Needs", type: "text", placeholder: "What do they need?" },
        ],
        toolTemplateId: TOOL_IDS.CUSTOMER_PROFILE, dataKey: "_segmentRefinement",
        completenessType: "list", completenessFields: ["name", "demographics", "behaviors", "needs"],
        syncsToLabel: "Customer Profiles",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:4:4", layoutType: "repeatable_list", title: "Buyer Roles", icon: "Users",
        fieldDefinitions: [
          { key: "segment", label: "Segment", type: "text", placeholder: "Segment / company type" },
          { key: "user", label: "End User", type: "text", placeholder: "End user (who uses it)" },
          { key: "payer", label: "Payer", type: "text", placeholder: "Payer (who pays)" },
          { key: "decisionMaker", label: "Decision Maker", type: "text", placeholder: "Decision maker" },
        ],
        toolTemplateId: TOOL_IDS.CUSTOMER_PROFILE, dataKey: "_buyerRoles",
        completenessType: "list", completenessFields: ["segment", "user", "payer", "decisionMaker"],
        syncsToLabel: "Customer Profiles",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_customerSegments", fieldMap: { segment: "customerSegment" } },
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:4:5", layoutType: "single_object", title: "Positioning Statement", icon: "Target",
        fieldDefinitions: [
          { key: "target", label: "For (target customer)", type: "text", placeholder: "e.g., manufacturing plant managers" },
          { key: "category", label: "Category", type: "text", placeholder: "e.g., energy monitoring platform" },
          { key: "differentiator", label: "Key differentiator", type: "text", placeholder: "What makes you uniquely better?" },
          { key: "reasonToBelieve", label: "Reason to believe", type: "text", placeholder: "Evidence or proof that backs up your claim..." },
        ],
        toolTemplateId: TOOL_IDS.VPC, dataKey: "_positioning",
        completenessType: "object", completenessFields: ["target", "category", "differentiator", "reasonToBelieve"],
        syncsToLabel: "Value Proposition Canvas",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:5:1", layoutType: "repeatable_list", title: "Evidence of Interest", icon: "Star",
        fieldDefinitions: [
          { key: "customerSegment", label: "Customer Segment", type: "select", options: [], optionsFromTool: { toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_customerSegments", field: "customerSegment" }, placeholder: "Select segment..." },
          { key: "customerName", label: "Customer / Contact Name", type: "text", placeholder: "Name of the customer or contact..." },
          { key: "type", label: "Type", type: "select", options: ["LOI", "Sign-up", "Verbal", "Pilot", "Pre-order"], placeholder: "Select or type...", allowCustom: true },
          { key: "date", label: "Date", type: "text", placeholder: "Date" },
          { key: "detail", label: "Detail", type: "text", placeholder: "Who expressed interest and what they committed to..." },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_evidenceOfInterest",
        completenessType: "list", completenessFields: ["type", "detail", "date"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:5:2", layoutType: "repeatable_list", title: "Sales Pitch 5-Beat Workbook", icon: "FileText",
        fieldDefinitions: [
          { key: "segments", label: "Customer segments this pitch covers", type: "checkbox_group", options: [], optionsFromTool: { toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_customerSegments", field: "customerSegment" } },
          { key: "theShift", label: "The Shift", type: "textarea", placeholder: "What undeniable change makes your solution necessary now?" },
          { key: "theStakes", label: "The Stakes", type: "textarea", placeholder: "What happens to companies that don't adapt?" },
          { key: "thePromisedLand", label: "The Promised Land", type: "textarea", placeholder: "What does the winning future look like for your buyer?" },
          { key: "yourMagic", label: "Your Magic", type: "textarea", placeholder: "How does your solution get them there? Include one proof point." },
          { key: "theAsk", label: "The Ask", type: "text", placeholder: "What specific next step do you want them to take?" },
        ],
        toolTemplateId: TOOL_IDS.SALES_DECK, dataKey: "_salesPitchDraft",
        completenessType: "list", completenessFields: ["segments", "theShift", "theStakes", "thePromisedLand", "yourMagic", "theAsk"],
        syncsToLabel: "Sales Deck",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:5:3", layoutType: "repeatable_list", title: "Customer Relationships", icon: "Handshake",
        fieldDefinitions: [
          { key: "name", label: "Contact", type: "text", placeholder: "Contact name", quickAdd: true },
          { key: "company", label: "Company", type: "text", placeholder: "Company (optional)" },
          { key: "frequency", label: "Frequency", type: "text", placeholder: "How often? e.g. weekly, monthly (optional)" },
          { key: "value", label: "Value", type: "text", placeholder: "What input do they provide? (optional)" },
        ],
        toolTemplateId: TOOL_IDS.CUSTOMER_PROFILE, dataKey: "_relationships",
        completenessType: "list", completenessFields: ["name"],
        syncsToLabel: "Customer Profiles",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:5:4", layoutType: "repeatable_list", title: "Value Props per Segment", icon: "Target",
        fieldDefinitions: [
          { key: "segment", label: "Segment", type: "text", placeholder: "Customer segment" },
          { key: "valueProp", label: "Value Proposition", type: "text", placeholder: "Key value proposition" },
          { key: "keyBenefit", label: "Key Benefit", type: "text", placeholder: "Primary benefit" },
        ],
        toolTemplateId: TOOL_IDS.VPC, dataKey: "_valueProps",
        completenessType: "list", completenessFields: ["segment", "valueProp", "keyBenefit"],
        syncsToLabel: "Value Proposition Canvas",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:5:5", layoutType: "single_object", title: "Beachhead Market", icon: "Target",
        fieldDefinitions: [
          { key: "segment", label: "Beachhead segment", type: "text", placeholder: "Which segment will you serve first?" },
          { key: "tamForSegment", label: "TAM for segment", type: "text", placeholder: "$ size" },
          { key: "whyFirst", label: "Why this segment first?", type: "textarea", placeholder: "Why is this the right starting point?" },
          { key: "reachStrategy", label: "How will you reach them?", type: "text", placeholder: "Direct sales, partnerships, events..." },
        ],
        toolTemplateId: TOOL_IDS.TAM, dataKey: "_beachhead",
        completenessType: "object", completenessFields: ["segment", "whyFirst", "tamForSegment", "reachStrategy"],
        syncsToLabel: "TAM/SAM/SOM",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:6:1", layoutType: "repeatable_list", title: "Test Results Log", icon: "Activity",
        fieldDefinitions: [
          { key: "testType", label: "Test Type", type: "text", placeholder: "Test type (usability, A/B, pilot...)" },
          { key: "metric", label: "Key Metric", type: "text", placeholder: "Key metric" },
          { key: "finding", label: "Finding", type: "text", placeholder: "What did you learn?" },
          { key: "nextAction", label: "Next Action", type: "text", placeholder: "Next action based on this..." },
        ],
        toolTemplateId: TOOL_IDS.SALES_DECK, dataKey: "_testResults",
        completenessType: "list", completenessFields: ["testType", "finding", "metric", "nextAction"],
        syncsToLabel: "Sales Deck",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:6:2", layoutType: "single_object", title: "Value Prop Iteration", icon: "TrendingUp",
        fieldDefinitions: [
          { key: "previousVP", label: "Previous value proposition", type: "textarea", placeholder: "What was your VP before testing?" },
          { key: "feedback", label: "Customer feedback received", type: "textarea", placeholder: "What did customers say?" },
          { key: "updatedVP", label: "Updated value proposition", type: "textarea", placeholder: "Your refined VP after feedback..." },
          { key: "keyLearning", label: "Key learning", type: "text", placeholder: "What changed and why?" },
        ],
        toolTemplateId: TOOL_IDS.VPC, dataKey: "_vpIteration",
        completenessType: "object", completenessFields: ["previousVP", "feedback", "updatedVP", "keyLearning"],
        syncsToLabel: "Value Proposition Canvas",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:6:3", layoutType: "repeatable_list", title: "Sales Funnel", icon: "ShoppingCart",
        fieldDefinitions: [
          { key: "stage", label: "Stage", type: "text", placeholder: "Stage name" },
          { key: "action", label: "Action", type: "text", placeholder: "Your action at this stage..." },
          { key: "metric", label: "Metric", type: "text", placeholder: "Target metric" },
        ],
        defaultRows: [
          { stage: "Awareness", action: "", metric: "", _fixed: false },
          { stage: "Interest", action: "", metric: "", _fixed: false },
          { stage: "Decision", action: "", metric: "", _fixed: false },
          { stage: "Purchase", action: "", metric: "", _fixed: false },
        ],
        toolTemplateId: TOOL_IDS.SALES_DECK, dataKey: "_salesFunnel",
        completenessType: "list", completenessFields: ["stage", "action", "metric"],
        syncsToLabel: "Sales Deck",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:6:4", layoutType: "single_object", title: "Route to Market", icon: "Route",
        fieldDefinitions: [
          {
            key: "channels",
            label: "Channels (Bullseye — rank in priority order)",
            type: "ranked_multi_select",
            placeholder: "Pick the channels you'll prioritise and rank them",
            allowCustom: true,
            options: [
              "Targeting Blogs",
              "Publicity",
              "Unconventional PR",
              "Search Engine Marketing (SEM)",
              "Social & Display Ads",
              "Offline Ads",
              "Search Engine Optimisation (SEO)",
              "Content Marketing",
              "Email Marketing",
              "Engineering as Marketing",
              "Viral Marketing",
              "Business Development",
              "Sales",
              "Affiliate Programmes",
              "Existing Platforms",
              "Trade Shows",
              "Offline Events",
              "Speaking Engagements",
              "Community Building",
              "Partnerships",
            ],
          },
          { key: "partners", label: "Key partners / stakeholders", type: "textarea", placeholder: "Who do you need to partner with?" },
          { key: "timeline", label: "Timeline", type: "text", placeholder: "Expected timeline to market..." },
          { key: "risks", label: "Key risks", type: "text", placeholder: "Top risk in this approach..." },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_routeToMarket",
        completenessType: "object", completenessFields: ["channels", "partners", "timeline", "risks"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:7:1", layoutType: "repeatable_list", title: "Customer Agreements", icon: "FileText",
        fieldDefinitions: [
          { key: "company", label: "Company", type: "text", placeholder: "Company name" },
          { key: "type", label: "Type", type: "text", placeholder: "Type (pilot/trial/paid)" },
          { key: "status", label: "Status", type: "text", placeholder: "Status" },
          { key: "feedback", label: "Feedback", type: "text", placeholder: "Key feedback from this customer..." },
        ],
        toolTemplateId: TOOL_IDS.SALES_DECK, dataKey: "_customerAgreements",
        completenessType: "list", completenessFields: ["company", "type", "status", "feedback"],
        syncsToLabel: "Sales Deck",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:7:2", layoutType: "single_object", title: "Active Users", icon: "Users",
        fieldDefinitions: [
          { key: "totalUsers", label: "Total users", type: "text", placeholder: "e.g., 150" },
          { key: "activeUsers", label: "Active users", type: "text", placeholder: "e.g., 85" },
          { key: "retentionRate", label: "Retention rate", type: "text", placeholder: "e.g., 72%" },
          { key: "keyMetric", label: "Key usage metric", type: "text", placeholder: "e.g., avg 3 sessions/week" },
          { key: "topFeedback", label: "Top user feedback", type: "textarea", placeholder: "What are users saying?" },
        ],
        toolTemplateId: TOOL_IDS.SALES_DECK, dataKey: "_activeUsers",
        completenessType: "object", completenessFields: ["totalUsers", "activeUsers", "topFeedback", "retentionRate", "keyMetric"],
        syncsToLabel: "Sales Deck",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:7:3", layoutType: "single_object", title: "Route Iteration", icon: "Route",
        fieldDefinitions: [
          { key: "originalRoute", label: "Original route to market", type: "text", placeholder: "Your initial go-to-market plan..." },
          { key: "whatChanged", label: "What changed and why", type: "textarea", placeholder: "How has your distribution strategy evolved?" },
          { key: "partnerStatus", label: "Partner discussions status", type: "text", placeholder: "Where are partner talks?" },
          { key: "newChannels", label: "New channels discovered", type: "text", placeholder: "Any new routes found?" },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_routeIteration",
        completenessType: "object", completenessFields: ["originalRoute", "whatChanged", "partnerStatus", "newChannels"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:8:1", layoutType: "single_object", title: "Sales Metrics", icon: "DollarSign",
        fieldDefinitions: [
          { key: "totalCustomers", label: "Total customers", type: "text", placeholder: "e.g., 25" },
          { key: "revenue", label: "Revenue", type: "text", placeholder: "e.g., £250K ARR" },
          { key: "avgPrice", label: "Avg price", type: "text", placeholder: "e.g., £10K/year" },
          { key: "repeatRate", label: "Repeat rate", type: "text", placeholder: "e.g., 80%" },
          { key: "pipeline", label: "Pipeline", type: "text", placeholder: "e.g., £500K in discussions" },
        ],
        toolTemplateId: TOOL_IDS.SALES_DECK, dataKey: "_salesMetrics",
        completenessType: "object", completenessFields: ["totalCustomers", "revenue", "avgPrice", "repeatRate", "pipeline"],
        syncsToLabel: "Sales Deck",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:8:2", layoutType: "single_object", title: "Active Users", icon: "Users",
        fieldDefinitions: [
          { key: "totalUsers", label: "Total users", type: "text", placeholder: "e.g., 150" },
          { key: "activeUsers", label: "Active users", type: "text", placeholder: "e.g., 85" },
          { key: "retentionRate", label: "Retention rate", type: "text", placeholder: "e.g., 72%" },
          { key: "keyMetric", label: "Key usage metric", type: "text", placeholder: "e.g., avg 3 sessions/week" },
          { key: "topFeedback", label: "Top user feedback", type: "textarea", placeholder: "What are users saying?" },
        ],
        toolTemplateId: TOOL_IDS.SALES_DECK, dataKey: "_activeUsers",
        completenessType: "object", completenessFields: ["totalUsers", "activeUsers", "topFeedback", "retentionRate", "keyMetric"],
        syncsToLabel: "Sales Deck",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:8:3", layoutType: "single_object", title: "Sales Process", icon: "Briefcase",
        fieldDefinitions: [
          { key: "process", label: "Sales process", type: "textarea", placeholder: "Your repeatable sales process..." },
          { key: "team", label: "Sales team", type: "text", placeholder: "Who sells and how?" },
          { key: "tools", label: "Tools used", type: "text", placeholder: "CRM, outreach tools..." },
          { key: "conversionRate", label: "Conversion rate", type: "text", placeholder: "e.g., 15% lead-to-close" },
        ],
        toolTemplateId: TOOL_IDS.SALES_DECK, dataKey: "_salesProcess",
        completenessType: "object", completenessFields: ["process", "team", "tools", "conversionRate"],
        syncsToLabel: "Sales Deck",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:8:4", layoutType: "repeatable_list", title: "Partner Tracker", icon: "Handshake",
        fieldDefinitions: [
          { key: "name", label: "Partner", type: "text", placeholder: "Partner name" },
          { key: "type", label: "Type", type: "text", placeholder: "Type (reseller, tech, channel)" },
          { key: "contribution", label: "Contribution", type: "text", placeholder: "What value do they add?" },
          { key: "status", label: "Status", type: "text", placeholder: "Status (active/negotiating/planned)" },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_partnerTracker",
        completenessType: "list", completenessFields: ["name", "type", "contribution", "status"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:9:1", layoutType: "single_object", title: "Growth Metrics", icon: "TrendingUp",
        fieldDefinitions: [
          { key: "deploymentScale", label: "Number of customers", type: "number", placeholder: "e.g., 50" },
          { key: "salesVelocity", label: "New deals per month", type: "number", placeholder: "e.g., 5" },
          { key: "geoReach", label: "Geographic reach", type: "checkbox_group", options: ["Africa", "Antarctica", "Asia", "Europe", "North America", "Oceania", "South America"] },
          { key: "growthRate", label: "Annual revenue growth rate", type: "percentage", placeholder: "e.g., 20" },
          { key: "strategy", label: "Growth strategy", type: "textarea", placeholder: "How will you scale from here?" },
        ],
        toolTemplateId: TOOL_IDS.SALES_DECK, dataKey: "_growthMetrics",
        completenessType: "object", completenessFields: ["deploymentScale", "salesVelocity", "geoReach", "growthRate", "strategy"],
        syncsToLabel: "Sales Deck",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:9:2", layoutType: "single_object", title: "Active Users", icon: "Users",
        fieldDefinitions: [
          { key: "totalUsers", label: "Total users", type: "text", placeholder: "e.g., 150" },
          { key: "activeUsers", label: "Active users", type: "text", placeholder: "e.g., 85" },
          { key: "retentionRate", label: "Retention rate", type: "text", placeholder: "e.g., 72%" },
          { key: "keyMetric", label: "Key usage metric", type: "text", placeholder: "e.g., avg 3 sessions/week" },
          { key: "topFeedback", label: "Top user feedback", type: "textarea", placeholder: "What are users saying?" },
        ],
        toolTemplateId: TOOL_IDS.SALES_DECK, dataKey: "_activeUsers",
        completenessType: "object", completenessFields: ["totalUsers", "activeUsers", "topFeedback", "retentionRate", "keyMetric"],
        syncsToLabel: "Sales Deck",
        checklistItemId: 0,
      },
      {
        stableKey: "CRL:9:3", layoutType: "single_object", title: "Growth Metrics", icon: "TrendingUp",
        fieldDefinitions: [
          { key: "deploymentScale", label: "Number of customers", type: "number", placeholder: "e.g., 50" },
          { key: "salesVelocity", label: "New deals per month", type: "number", placeholder: "e.g., 5" },
          { key: "geoReach", label: "Geographic reach", type: "checkbox_group", options: ["Africa", "Antarctica", "Asia", "Europe", "North America", "Oceania", "South America"] },
          { key: "growthRate", label: "Annual revenue growth rate", type: "percentage", placeholder: "e.g., 20" },
          { key: "strategy", label: "Growth strategy", type: "textarea", placeholder: "How will you scale from here?" },
        ],
        toolTemplateId: TOOL_IDS.SALES_DECK, dataKey: "_growthMetrics",
        completenessType: "object", completenessFields: ["deploymentScale", "salesVelocity", "geoReach", "growthRate", "strategy"],
        syncsToLabel: "Sales Deck",
        checklistItemId: 0,
      },

      // ═══════════════════════════════════════════════════
      // TRL (Technology) — Dimension 2
      // ═══════════════════════════════════════════════════

      // TRL Level 1 — Idea
      {
        stableKey: "TRL:1:4", layoutType: "repeatable_list", title: "Application Hypothesis", icon: "Lightbulb",
        fieldDefinitions: [
          { key: "application", label: "Application", type: "text", placeholder: "e.g., industrial waste heat recovery", required: true },
          { key: "targetUser", label: "Target User / Industry", type: "text", placeholder: "e.g., manufacturing plants" },
          { key: "keyBenefit", label: "Key Benefit", type: "text", placeholder: "e.g., 15% energy cost reduction" },
          { key: "feasibility", label: "Feasibility", type: "radio", options: ["High", "Medium", "Low"] },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_applicationHypothesis",
        completenessType: "list", completenessFields: ["application", "targetUser", "keyBenefit"],
        syncsToLabel: "Lean Canvas",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_customerSegments", fieldMap: { targetUser: "customerSegment" } },
        checklistItemId: 0,
      },
      {
        stableKey: "TRL:1:5", layoutType: "single_object", title: "Technology Concept (Initial)", icon: "Cpu",
        fieldDefinitions: [
          { key: "techDescription", label: "Technology description", type: "textarea", placeholder: "What is the technology? (plain language)" },
          { key: "scientificPrinciple", label: "Scientific principle", type: "textarea", placeholder: "What underlying science does it rely on?" },
          { key: "whatItEnables", label: "What it could enable", type: "textarea", placeholder: "What problem could it solve if developed successfully?" },
          { key: "keyUnknowns", label: "Key unknowns", type: "textarea", placeholder: "What do you not yet know?" },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_techConceptInitial",
        completenessType: "object", completenessFields: ["techDescription", "scientificPrinciple", "whatItEnables", "keyUnknowns"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },

      // TRL Level 2 — Idea
      {
        stableKey: "TRL:2:4", layoutType: "single_object", title: "Technology Concept (Defined)", icon: "Cpu",
        fieldDefinitions: [
          { key: "techDescription", label: "Technology description", type: "textarea", placeholder: "Iterate on your initial technology concept" },
          { key: "howItWorks", label: "How it works", type: "textarea", placeholder: "Key mechanism or process (simplified)" },
          { key: "keyComponents", label: "Key components / materials", type: "textarea", placeholder: "e.g., novel membrane, proprietary catalyst, ML model" },
          { key: "performanceTarget", label: "Performance target", type: "text", placeholder: "e.g., 90% efficiency, <£50/unit cost, 10x throughput" },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_techConceptDefined",
        completenessType: "object", completenessFields: ["techDescription", "howItWorks", "keyComponents", "performanceTarget"],
        syncsToLabel: "Lean Canvas",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_techConceptInitial", fieldMap: { techDescription: "techDescription" } },
        checklistItemId: 0,
      },
      {
        stableKey: "TRL:2:5", layoutType: "repeatable_list", title: "Speculative Applications", icon: "Sparkles",
        fieldDefinitions: [
          { key: "application", label: "Application", type: "text", placeholder: "Application name", required: true },
          { key: "market", label: "Market", type: "text", placeholder: "Target market" },
          { key: "performanceRequired", label: "Performance Required", type: "text", placeholder: "e.g., COP > 3.5" },
          { key: "revenuePotential", label: "Revenue Potential", type: "currency", placeholder: "0" },
          { key: "likelihood", label: "Likelihood", type: "radio", options: ["High", "Medium", "Low"] },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_speculativeApplications",
        completenessType: "list", completenessFields: ["application", "market", "performanceRequired"],
        syncsToLabel: "Lean Canvas",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_applicationHypothesis", fieldMap: { application: "application", market: "targetUser" } },
        checklistItemId: 0,
      },

      // TRL Level 3 — Discovery
      {
        stableKey: "TRL:3:4", layoutType: "repeatable_list", title: "Lab Test Results", icon: "FlaskConical",
        fieldDefinitions: [
          { key: "parameter", label: "Parameter Tested", type: "text", placeholder: "e.g., conversion efficiency", required: true },
          { key: "targetValue", label: "Target Value", type: "text", placeholder: "e.g., >85%" },
          { key: "achievedValue", label: "Achieved Value", type: "text", placeholder: "e.g., 87%" },
          { key: "testConditions", label: "Test Conditions", type: "text", placeholder: "e.g., Lab scale, 25°C, 1atm" },
          { key: "pass", label: "Pass?", type: "radio", options: ["Yes", "No"] },
        ],
        toolTemplateId: TOOL_IDS.TEA, dataKey: "_labTestResults",
        completenessType: "list", completenessFields: ["parameter", "targetValue", "achievedValue", "pass"],
        syncsToLabel: "Techno-Economic Assessment",
        checklistItemId: 0,
      },
      {
        stableKey: "TRL:3:5", layoutType: "single_object", title: "R&D Status", icon: "Microscope",
        fieldDefinitions: [
          { key: "rdTeam", label: "R&D team", type: "textarea", placeholder: "Who is working on this? (names, expertise)" },
          { key: "currentFocus", label: "Current R&D focus", type: "textarea", placeholder: "What are you working on right now?" },
          { key: "milestones", label: "Key R&D milestones (next 6 months)", type: "textarea", placeholder: "e.g., achieve target efficiency, build first prototype" },
          { key: "budget", label: "R&D budget", type: "text", placeholder: "e.g., £50K for materials + £30K for equipment access" },
          { key: "facilities", label: "Facilities", type: "text", placeholder: "e.g., university lab, shared workspace, own facility" },
        ],
        toolTemplateId: TOOL_IDS.TEA, dataKey: "_rdStatus",
        completenessType: "object", completenessFields: ["rdTeam", "currentFocus", "milestones", "budget"],
        syncsToLabel: "Techno-Economic Assessment",
        checklistItemId: 0,
      },
      {
        stableKey: "TRL:3:6", layoutType: "repeatable_list", title: "User Requirements (Initial)", icon: "ClipboardList",
        fieldDefinitions: [
          { key: "requirement", label: "Requirement", type: "text", placeholder: "User requirement", required: true },
          { key: "source", label: "Source", type: "text", placeholder: "e.g., Customer interviews" },
          { key: "priority", label: "Priority", type: "radio", options: ["Must-have", "Should-have", "Nice-to-have"] },
          { key: "status", label: "Current Status", type: "radio", options: ["Not yet tested", "In progress", "Validated"] },
        ],
        toolTemplateId: TOOL_IDS.VPC, dataKey: "_userRequirementsInitial",
        completenessType: "list", completenessFields: ["requirement", "source", "priority"],
        syncsToLabel: "Value Proposition Canvas",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.CUSTOMER_PROFILE, dataKey: "_segmentRefinement", fieldMap: { requirement: "needs" } },
        checklistItemId: 0,
      },

      // TRL Level 4 — Discovery
      {
        stableKey: "TRL:4:4", layoutType: "single_object", title: "Integration Test Results", icon: "Puzzle",
        fieldDefinitions: [
          { key: "componentsIntegrated", label: "Components integrated", type: "textarea", placeholder: "e.g., sensor module + processing unit + power supply" },
          { key: "testDescription", label: "Test description", type: "textarea", placeholder: "What did the integrated system do?" },
          { key: "keyResult", label: "Key result", type: "textarea", placeholder: "e.g., successfully measured X with Y% accuracy" },
          { key: "remainingChallenges", label: "Remaining integration challenges", type: "textarea", placeholder: "What doesn't work together yet?" },
          { key: "documentation", label: "Documentation", type: "text", placeholder: "Where are test results documented? (link or reference)" },
        ],
        toolTemplateId: TOOL_IDS.TEA, dataKey: "_integrationTestResults",
        completenessType: "object", completenessFields: ["componentsIntegrated", "testDescription", "keyResult"],
        syncsToLabel: "Techno-Economic Assessment",
        checklistItemId: 0,
      },
      {
        stableKey: "TRL:4:5", layoutType: "repeatable_list", title: "Commercial KPI Validation", icon: "TrendingUp",
        fieldDefinitions: [
          { key: "kpi", label: "Commercial KPI", type: "text", placeholder: "e.g., cost per kWh", required: true },
          { key: "incumbentBenchmark", label: "Incumbent Benchmark", type: "text", placeholder: "e.g., £0.15" },
          { key: "yourResult", label: "Your Result", type: "text", placeholder: "e.g., £0.09" },
          { key: "improvement", label: "Improvement", type: "text", placeholder: "e.g., 40% reduction" },
          { key: "evidence", label: "Evidence", type: "text", placeholder: "e.g., Lab test report dated YYYY-MM-DD" },
        ],
        toolTemplateId: TOOL_IDS.TEA, dataKey: "_commercialKpiValidation",
        completenessType: "list", completenessFields: ["kpi", "incumbentBenchmark", "yourResult", "improvement"],
        syncsToLabel: "Techno-Economic Assessment",
        checklistItemId: 0,
      },

      // TRL Level 5 — Validation
      {
        stableKey: "TRL:5:4", layoutType: "single_object", title: "Relevant Environment Testing", icon: "Building",
        fieldDefinitions: [
          { key: "testEnvironment", label: "Test environment", type: "textarea", placeholder: "e.g., partner manufacturing site, outdoor test rig, customer premises" },
          { key: "differsFromLab", label: "How it differs from lab", type: "textarea", placeholder: "e.g., real-world temperatures, dust, vibration, variable load" },
          { key: "componentsTested", label: "Components tested", type: "textarea", placeholder: "What was included in this test?" },
          { key: "keyResults", label: "Key results", type: "textarea", placeholder: "Summary of performance in realistic conditions" },
          { key: "degradation", label: "Degradation vs. lab", type: "textarea", placeholder: "Any performance loss vs. laboratory? How much?" },
        ],
        toolTemplateId: TOOL_IDS.TEA, dataKey: "_relevantEnvTesting",
        completenessType: "object", completenessFields: ["testEnvironment", "differsFromLab", "keyResults"],
        syncsToLabel: "Techno-Economic Assessment",
        checklistItemId: 0,
      },
      {
        stableKey: "TRL:5:5", layoutType: "repeatable_list", title: "KPI Validation (Relevant Environment)", icon: "BarChart3",
        fieldDefinitions: [
          { key: "kpi", label: "KPI", type: "text", placeholder: "e.g., cost per kWh", required: true },
          { key: "target", label: "Target", type: "text", placeholder: "Target value" },
          { key: "labResult", label: "Lab Result", type: "text", placeholder: "Previous lab result", readOnly: true },
          { key: "fieldResult", label: "Field Result", type: "text", placeholder: "New field result" },
          { key: "onTarget", label: "On Target?", type: "radio", options: ["Yes", "No"] },
          { key: "notes", label: "Notes", type: "text", placeholder: "e.g., degradation from humidity" },
        ],
        toolTemplateId: TOOL_IDS.TEA, dataKey: "_kpiValidationRelevant",
        completenessType: "list", completenessFields: ["kpi", "target", "fieldResult", "onTarget"],
        syncsToLabel: "Techno-Economic Assessment",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.TEA, dataKey: "_commercialKpiValidation", fieldMap: { kpi: "kpi", target: "incumbentBenchmark", labResult: "yourResult" } },
        checklistItemId: 0,
      },
      {
        stableKey: "TRL:5:6", layoutType: "repeatable_list", title: "Updated User Requirements", icon: "ClipboardCheck",
        fieldDefinitions: [
          { key: "requirement", label: "Requirement", type: "text", placeholder: "User requirement", required: true },
          { key: "source", label: "Source", type: "text", placeholder: "e.g., Customer interviews" },
          { key: "priority", label: "Priority", type: "radio", options: ["Must-have", "Should-have", "Nice-to-have"] },
          { key: "status", label: "Status", type: "radio", options: ["Not yet tested", "In progress", "Validated"] },
          { key: "changeFromInitial", label: "Change from Initial", type: "radio", options: ["New", "Upgraded", "Unchanged"] },
        ],
        toolTemplateId: TOOL_IDS.VPC, dataKey: "_userRequirementsUpdated",
        completenessType: "list", completenessFields: ["requirement", "priority", "status", "changeFromInitial"],
        syncsToLabel: "Value Proposition Canvas",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.VPC, dataKey: "_userRequirementsInitial", fieldMap: { requirement: "requirement", source: "source", priority: "priority" } },
        checklistItemId: 0,
      },

      // TRL Level 6 — Validation
      {
        stableKey: "TRL:6:4", layoutType: "single_object", title: "Prototype Demonstration", icon: "Rocket",
        fieldDefinitions: [
          { key: "prototypeVersion", label: "Prototype version", type: "text", placeholder: "e.g., v2.1" },
          { key: "demoEnvironment", label: "Demonstration environment", type: "textarea", placeholder: "e.g., customer pilot site, field test" },
          { key: "requirementsMet", label: "Performance requirements met", type: "textarea", placeholder: "Which key specs were achieved?" },
          { key: "requirementsNotMet", label: "Requirements not yet met", type: "textarea", placeholder: "Which specs need more work?" },
          { key: "stakeholderFeedback", label: "Stakeholder feedback", type: "textarea", placeholder: "What did observers/testers say?" },
          { key: "documentation", label: "Documentation", type: "text", placeholder: "e.g., test report, video, third-party witness" },
        ],
        toolTemplateId: TOOL_IDS.TEA, dataKey: "_prototypeDemonstration",
        completenessType: "object", completenessFields: ["prototypeVersion", "demoEnvironment", "requirementsMet", "stakeholderFeedback"],
        syncsToLabel: "Techno-Economic Assessment",
        checklistItemId: 0,
      },

      // TRL Level 7 — Testing
      {
        stableKey: "TRL:7:1", layoutType: "single_object", title: "Operational Demonstration", icon: "Factory",
        fieldDefinitions: [
          { key: "opEnvironment", label: "Operational environment", type: "textarea", placeholder: "e.g., live production line at Customer X" },
          { key: "testDuration", label: "Duration of test", type: "text", placeholder: "e.g., 3 months continuous operation" },
          { key: "performanceSummary", label: "Performance summary", type: "textarea", placeholder: "Key metrics achieved during operational testing" },
          { key: "failuresIssues", label: "Failures / issues encountered", type: "textarea", placeholder: "What went wrong and how was it resolved?" },
          { key: "operatorFeedback", label: "Operator feedback", type: "textarea", placeholder: "What did the end-users/operators say?" },
        ],
        toolTemplateId: TOOL_IDS.TEA, dataKey: "_operationalDemonstration",
        completenessType: "object", completenessFields: ["opEnvironment", "testDuration", "performanceSummary"],
        syncsToLabel: "Techno-Economic Assessment",
        checklistItemId: 0,
      },
      {
        stableKey: "TRL:7:2", layoutType: "single_object", title: "Final Requirements Specification", icon: "FileCheck",
        fieldDefinitions: [
          { key: "requirementsDocumented", label: "Requirements documented?", type: "radio", options: ["Yes", "No", "Partially"] },
          { key: "totalRequirements", label: "Total requirements", type: "text", placeholder: "e.g., 45 requirements across 6 categories" },
          { key: "percentMet", label: "% requirements met", type: "percentage", placeholder: "e.g., 85" },
          { key: "criticalGaps", label: "Critical gaps remaining", type: "textarea", placeholder: "Which must-have requirements are not yet met?" },
          { key: "signOffStatus", label: "Sign-off status", type: "text", placeholder: "Have key customers reviewed and approved the spec?" },
        ],
        toolTemplateId: TOOL_IDS.VPC, dataKey: "_finalRequirementsSpec",
        completenessType: "object", completenessFields: ["requirementsDocumented", "totalRequirements", "percentMet"],
        syncsToLabel: "Value Proposition Canvas",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.VPC, dataKey: "_userRequirementsUpdated", fieldMap: { totalRequirements: "_count" } },
        checklistItemId: 0,
      },

      // TRL Level 8 — Testing
      {
        stableKey: "TRL:8:1", layoutType: "single_object", title: "Operational Proof", icon: "ShieldCheck",
        fieldDefinitions: [
          { key: "deploymentCount", label: "Number of operational deployments", type: "text", placeholder: "e.g., 5 customer sites" },
          { key: "totalOperatingTime", label: "Total operating hours/duration", type: "text", placeholder: "e.g., 12,000+ hours across all sites" },
          { key: "uptime", label: "Uptime / reliability", type: "text", placeholder: "e.g., 99.2% uptime" },
          { key: "keyPerformanceMetric", label: "Key performance metric", type: "text", placeholder: "e.g., delivering X output consistently" },
          { key: "customerSatisfaction", label: "Customer satisfaction", type: "text", placeholder: "e.g., NPS of 45, 100% renewal rate" },
          { key: "knownLimitations", label: "Known limitations", type: "textarea", placeholder: "What doesn't work perfectly yet?" },
        ],
        toolTemplateId: TOOL_IDS.TEA, dataKey: "_operationalProof",
        completenessType: "object", completenessFields: ["deploymentCount", "totalOperatingTime", "uptime", "keyPerformanceMetric"],
        syncsToLabel: "Techno-Economic Assessment",
        checklistItemId: 0,
      },

      // TRL Level 9 — Scaling
      {
        stableKey: "TRL:9:1", layoutType: "single_object", title: "Scalability Evidence", icon: "Scale",
        fieldDefinitions: [
          { key: "totalDeployments", label: "Total deployments", type: "text", placeholder: "e.g., 50+ sites" },
          { key: "operatingHistory", label: "Operating history", type: "text", placeholder: "e.g., 2+ years in production" },
          { key: "scalabilityEvidence", label: "Scalability evidence", type: "textarea", placeholder: "e.g., unit cost decreased 30% from deployment 1 to 50" },
          { key: "manufacturingReadiness", label: "Manufacturing readiness", type: "textarea", placeholder: "e.g., contract manufacturer producing at 100 units/month" },
          { key: "reliabilityData", label: "Reliability data", type: "text", placeholder: "e.g., MTBF of X hours, defect rate of Y%" },
        ],
        toolTemplateId: TOOL_IDS.TEA, dataKey: "_scalabilityEvidence",
        completenessType: "object", completenessFields: ["totalDeployments", "operatingHistory", "scalabilityEvidence"],
        syncsToLabel: "Techno-Economic Assessment",
        checklistItemId: 0,
      },
      {
        stableKey: "TRL:9:2", layoutType: "single_object", title: "Continuous Development", icon: "RefreshCw",
        fieldDefinitions: [
          { key: "currentFocus", label: "Current development focus", type: "textarea", placeholder: "e.g., v3 with 20% efficiency improvement" },
          { key: "productionOptimisation", label: "Production optimisation", type: "textarea", placeholder: "e.g., reduced assembly time by 35%, yield improvement programme" },
          { key: "rdInvestment", label: "R&D investment", type: "text", placeholder: "e.g., 15% of revenue reinvested in R&D" },
          { key: "techRoadmap", label: "Technology roadmap", type: "textarea", placeholder: "e.g., v3 (Q3), v4 with new materials (Q1 next year)" },
          { key: "competitiveTracking", label: "Competitive R&D tracking", type: "textarea", placeholder: "Are competitors closing the gap? How do you stay ahead?" },
        ],
        toolTemplateId: TOOL_IDS.TEA, dataKey: "_continuousDevelopment",
        completenessType: "object", completenessFields: ["currentFocus", "productionOptimisation", "rdInvestment", "techRoadmap"],
        syncsToLabel: "Techno-Economic Assessment",
        checklistItemId: 0,
      },

      // ═══════════════════════════════════════════
      // TMRL (Team & Resources) — Dimension 5
      // ═══════════════════════════════════════════

      // TMRL Level 1 — Idea
      {
        stableKey: "TMRL:1:1", layoutType: "repeatable_list", title: "Competency Gap Identification", icon: "AlertTriangle",
        fieldDefinitions: [
          { key: "competency", label: "Competency Needed", type: "text", placeholder: "e.g., electrochemistry expertise", required: true },
          { key: "whyCritical", label: "Why It's Critical", type: "text", placeholder: "Core to product development" },
          { key: "source", label: "Source (which dimension surfaced this?)", type: "text", placeholder: "e.g., TRL L3 — only 1 researcher" },
          { key: "currentCoverage", label: "Current Coverage", type: "text", placeholder: "e.g., No one on team" },
          { key: "severity", label: "Gap Severity", type: "radio", options: ["Critical", "Important", "Nice-to-have"] },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_competencyGaps",
        completenessType: "list", completenessFields: ["competency", "whyCritical", "severity"],
        syncsToLabel: "Team Competency Matrix",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.CUSTOMER_PROFILE, dataKey: "_interviewLog", fieldMap: { competency: "role", source: "insight" } },
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:1:2", layoutType: "single_object", title: "Resource Requirements (Initial)", icon: "ClipboardList",
        fieldDefinitions: [
          { key: "technicalCompetencies", label: "Technical competencies needed", type: "textarea", placeholder: "What expertise is missing?" },
          { key: "commercialCompetencies", label: "Commercial competencies needed", type: "textarea", placeholder: "e.g., B2B sales, regulatory affairs, marketing" },
          { key: "legalCompetencies", label: "Legal/IP competencies needed", type: "textarea", placeholder: "e.g., patent attorney, IP licensing" },
          { key: "keyResources", label: "Key resources needed", type: "textarea", placeholder: "e.g., lab access, prototyping equipment, £X budget" },
          { key: "timeline", label: "Timeline", type: "text", placeholder: "When do you need these by?" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_resourceRequirementsInitial",
        completenessType: "object", completenessFields: ["technicalCompetencies", "commercialCompetencies", "keyResources", "timeline"],
        syncsToLabel: "Team Competency Matrix",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.TEA, dataKey: "_rdStatus", fieldMap: { technicalCompetencies: "rdTeam", keyResources: "facilities" } },
        checklistItemId: 0,
      },

      // TMRL Level 2 — Idea
      {
        stableKey: "TMRL:2:1", layoutType: "repeatable_list", title: "Current Team & Resources", icon: "Users",
        fieldDefinitions: [
          { key: "person", label: "Person / Resource", type: "text", placeholder: "e.g., Dr Jane Smith", required: true },
          { key: "role", label: "Role / Contribution", type: "text", placeholder: "e.g., CTO, lead researcher" },
          { key: "timeCommitment", label: "Time Commitment", type: "text", placeholder: "e.g., full-time, 2 days/week" },
          { key: "keyCompetency", label: "Key Competency", type: "text", placeholder: "e.g., materials science PhD" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_currentTeam",
        completenessType: "list", completenessFields: ["person", "role", "timeCommitment"],
        syncsToLabel: "Team Competency Matrix",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.TEA, dataKey: "_rdStatus", fieldMap: { person: "rdTeam" } },
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:2:2", layoutType: "single_object", title: "Team Needs Assessment", icon: "UserSearch",
        fieldDefinitions: [
          { key: "competenciesWeHave", label: "Competencies we have", type: "textarea", placeholder: "Summary of current team competencies" },
          { key: "competenciesWeLack", label: "Competencies we lack", type: "textarea", placeholder: "Summary of gaps" },
          { key: "howToFillGaps", label: "How we plan to fill gaps", type: "textarea", placeholder: "e.g., hire, advisor, partner, outsource" },
          { key: "resourcesWeHave", label: "Resources we have", type: "textarea", placeholder: "e.g., lab access via university, £20K personal funds" },
          { key: "resourcesWeLack", label: "Resources we lack", type: "textarea", placeholder: "e.g., prototyping budget, CRM tool, office space" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_teamNeedsAssessment",
        completenessType: "object", completenessFields: ["competenciesWeHave", "competenciesWeLack", "howToFillGaps"],
        syncsToLabel: "Team Competency Matrix",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_resourceRequirementsInitial", fieldMap: { competenciesWeLack: "technicalCompetencies", resourcesWeHave: "keyResources" } },
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:2:3", layoutType: "single_object", title: "Project Goals", icon: "Target",
        fieldDefinitions: [
          { key: "sixMonthGoal", label: "6-month goal", type: "textarea", placeholder: "What do you aim to achieve?" },
          { key: "keyMilestones", label: "Key milestones", type: "textarea", placeholder: "Key milestones from R&D and customer validation" },
          { key: "successCriteria", label: "Success criteria", type: "textarea", placeholder: "How will you know you've succeeded?" },
          { key: "biggestRisk", label: "Biggest risk to achieving goals", type: "textarea", placeholder: "What could go wrong?" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_projectGoals",
        completenessType: "object", completenessFields: ["sixMonthGoal", "keyMilestones", "successCriteria", "biggestRisk"],
        syncsToLabel: "Team Competency Matrix",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.CUSTOMER_PROFILE, dataKey: "_validationEvidence", fieldMap: { keyMilestones: "keyThemes" } },
        checklistItemId: 0,
      },

      // TMRL Level 3 — Discovery
      {
        stableKey: "TMRL:3:1", layoutType: "repeatable_list", title: "Team Capability Snapshot", icon: "Users",
        fieldDefinitions: [
          { key: "competencyArea", label: "Competency Area", type: "text", placeholder: "e.g., Materials Science", required: true },
          { key: "persons", label: "Person(s)", type: "text", placeholder: "Who covers this?" },
          { key: "strength", label: "Strength", type: "radio", options: ["Strong", "Adequate", "Basic"] },
          { key: "gap", label: "Gap?", type: "radio", options: ["Yes", "No", "Needs mentoring"] },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_teamCapabilitySnapshot",
        completenessType: "list", completenessFields: ["competencyArea", "persons", "strength"],
        syncsToLabel: "Team Competency Matrix",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_currentTeam", fieldMap: { competencyArea: "keyCompetency", persons: "person" } },
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:3:2", layoutType: "repeatable_list", title: "Requirements Matrix", icon: "LayoutGrid",
        fieldDefinitions: [
          { key: "requirement", label: "Requirement", type: "text", placeholder: "e.g., IP attorney", required: true },
          { key: "type", label: "Type", type: "radio", options: ["Hire", "Advisor", "Partner", "Outsource"] },
          { key: "priority", label: "Priority", type: "radio", options: ["Critical", "High", "Medium"] },
          { key: "howToAcquire", label: "How to Acquire", type: "text", placeholder: "e.g., university network, job board" },
          { key: "timeline", label: "Timeline", type: "text", placeholder: "Month X" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_requirementsMatrix",
        completenessType: "list", completenessFields: ["requirement", "type", "priority", "howToAcquire"],
        syncsToLabel: "Team Competency Matrix",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_competencyGaps", fieldMap: { requirement: "competency" } },
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:3:3", layoutType: "single_object", title: "Resource Acquisition Plan", icon: "CalendarCheck",
        fieldDefinitions: [
          { key: "q1Priorities", label: "Q1 priorities", type: "textarea", placeholder: "e.g., hire part-time engineer, secure lab access" },
          { key: "q2Priorities", label: "Q2 priorities", type: "textarea", placeholder: "e.g., onboard regulatory advisor, apply for equipment grant" },
          { key: "totalBudget", label: "Total budget for team/resources", type: "text", placeholder: "e.g., £60K" },
          { key: "keyDependencies", label: "Key dependencies", type: "textarea", placeholder: "What must happen first?" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_resourceAcquisitionPlan",
        completenessType: "object", completenessFields: ["q1Priorities", "q2Priorities", "totalBudget", "keyDependencies"],
        syncsToLabel: "Team Competency Matrix",
        checklistItemId: 0,
      },

      // TMRL Level 4 — Discovery
      {
        stableKey: "TMRL:4:1", layoutType: "repeatable_list", title: "Team Commitment Assessment", icon: "UserCheck",
        fieldDefinitions: [
          { key: "teamMember", label: "Team Member", type: "text", placeholder: "Name", required: true },
          { key: "role", label: "Role", type: "text", placeholder: "e.g., CTO" },
          { key: "timeCommitment", label: "Time Commitment", type: "text", placeholder: "e.g., full-time from Month 3" },
          { key: "otherCommitments", label: "Other Commitments", type: "text", placeholder: "e.g., finishing PhD" },
          { key: "fullyCommitted", label: "Fully Committed?", type: "radio", options: ["Yes", "Transitioning", "Part-time"] },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_teamCommitment",
        completenessType: "list", completenessFields: ["teamMember", "role", "timeCommitment", "fullyCommitted"],
        syncsToLabel: "Team Competency Matrix",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_currentTeam", fieldMap: { teamMember: "person", role: "role", timeCommitment: "timeCommitment" } },
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:4:2", layoutType: "single_object", title: "Business Lead Profile", icon: "Briefcase",
        fieldDefinitions: [
          { key: "businessLeadName", label: "Business Lead name", type: "text", placeholder: "Who is leading the commercial side?" },
          { key: "relevantExperience", label: "Relevant experience", type: "textarea", placeholder: "e.g., 5yr enterprise sales in energy sector" },
          { key: "keyResponsibilities", label: "Key responsibilities", type: "textarea", placeholder: "e.g., customer development, fundraising, partnerships" },
          { key: "gapAreas", label: "Gap areas", type: "textarea", placeholder: "Where does the business lead need support?" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_businessLeadProfile",
        completenessType: "object", completenessFields: ["businessLeadName", "relevantExperience", "keyResponsibilities"],
        syncsToLabel: "Team Competency Matrix",
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:4:3", layoutType: "repeatable_list", title: "Capability Status", icon: "CheckSquare",
        fieldDefinitions: [
          { key: "competency", label: "Competency / Resource", type: "text", placeholder: "e.g., Materials Science", required: true },
          { key: "status", label: "Status", type: "radio", options: ["In place", "Partial", "Missing"] },
          { key: "personSource", label: "Person / Source", type: "text", placeholder: "Name or source" },
          { key: "quality", label: "Quality", type: "radio", options: ["Strong", "Adequate"] },
          { key: "changeSinceL3", label: "Change Since L3", type: "radio", options: ["Improved", "Same", "Declined"] },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_capabilityStatus",
        completenessType: "list", completenessFields: ["competency", "status", "personSource"],
        syncsToLabel: "Team Competency Matrix",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_teamCapabilitySnapshot", fieldMap: { competency: "competencyArea", personSource: "persons" } },
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:4:4", layoutType: "repeatable_list", title: "Hiring & Resource Plan", icon: "UserPlus",
        fieldDefinitions: [
          { key: "roleResource", label: "Role / Resource", type: "text", placeholder: "e.g., Process Engineer", required: true },
          { key: "priority", label: "Priority", type: "radio", options: ["Critical", "High", "Medium"] },
          { key: "source", label: "Source", type: "text", placeholder: "e.g., university network, job board" },
          { key: "status", label: "Status", type: "radio", options: ["Interviewing", "Confirmed", "Searching"] },
          { key: "targetStart", label: "Target Start", type: "text", placeholder: "Month X" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_hiringResourcePlan",
        completenessType: "list", completenessFields: ["roleResource", "priority", "source", "status"],
        syncsToLabel: "Team Competency Matrix",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_requirementsMatrix", fieldMap: { roleResource: "requirement", priority: "priority", source: "howToAcquire" } },
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:4:5", layoutType: "single_object", title: "Founder Alignment Discussion", icon: "Handshake",
        fieldDefinitions: [
          { key: "rolesDiscussed", label: "Roles discussed?", type: "textarea", placeholder: "e.g., CEO: Name, CTO: Name — agreed in principle" },
          { key: "ownershipSplit", label: "Ownership split discussed?", type: "textarea", placeholder: "e.g., 50/50, or vesting-based — status of discussion" },
          { key: "vestingStructure", label: "Vesting structure?", type: "textarea", placeholder: "e.g., 4-year vest, 1-year cliff — agreed / under discussion" },
          { key: "commitmentLevels", label: "Commitment levels agreed?", type: "textarea", placeholder: "e.g., both full-time from Month X" },
          { key: "unresolvedIssues", label: "Unresolved issues", type: "textarea", placeholder: "Any tensions or open questions?" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_founderAlignment",
        completenessType: "object", completenessFields: ["rolesDiscussed", "ownershipSplit", "vestingStructure", "commitmentLevels"],
        syncsToLabel: "Team Competency Matrix",
        checklistItemId: 0,
      },

      // TMRL Level 5 — Validation
      {
        stableKey: "TMRL:5:1", layoutType: "repeatable_list", title: "Founding Team Roster", icon: "Users",
        fieldDefinitions: [
          { key: "name", label: "Name", type: "text", placeholder: "Full name", required: true },
          { key: "role", label: "Role", type: "text", placeholder: "e.g., CEO" },
          { key: "keyCompetency", label: "Key Competency", type: "text", placeholder: "e.g., commercial strategy" },
          { key: "timeCommitment", label: "Time Commitment", type: "text", placeholder: "e.g., Full-time" },
          { key: "startDate", label: "Start Date", type: "text", placeholder: "YYYY-MM" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_foundingTeamRoster",
        completenessType: "list", completenessFields: ["name", "role", "keyCompetency", "timeCommitment"],
        syncsToLabel: "Team Competency Matrix",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_teamCommitment", fieldMap: { name: "teamMember", role: "role", timeCommitment: "timeCommitment" } },
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:5:2", layoutType: "single_object", title: "Team Alignment Summary", icon: "Compass",
        fieldDefinitions: [
          { key: "sharedVision", label: "Shared vision statement", type: "textarea", placeholder: "What are you building and why? (1–2 sentences)" },
          { key: "rolesResponsibilities", label: "Roles and responsibilities", type: "textarea", placeholder: "Who owns what?" },
          { key: "decisionMaking", label: "Decision-making process", type: "textarea", placeholder: "e.g., consensus, CEO decides after input, domain leads decide" },
          { key: "commitmentLevel", label: "Commitment level", type: "textarea", placeholder: "e.g., all founders full-time, minimum 2 years" },
          { key: "conflictResolution", label: "Conflict resolution approach", type: "textarea", placeholder: "How will you handle disagreements?" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_teamAlignmentSummary",
        completenessType: "object", completenessFields: ["sharedVision", "rolesResponsibilities", "decisionMaking", "commitmentLevel"],
        syncsToLabel: "Team Competency Matrix",
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:5:3", layoutType: "single_object", title: "Ownership Structure", icon: "PieChart",
        fieldDefinitions: [
          { key: "equitySplit", label: "Equity split", type: "textarea", placeholder: "e.g., Founder A: 45%, Founder B: 35%, ESOP: 20%" },
          { key: "vestingSchedule", label: "Vesting schedule", type: "textarea", placeholder: "e.g., 4-year vest, 1-year cliff" },
          { key: "signed", label: "Signed?", type: "radio", options: ["Yes", "No"] },
          { key: "esopReserved", label: "ESOP reserved?", type: "text", placeholder: "e.g., 15% reserved for future hires" },
          { key: "rationale", label: "Rationale for split", type: "textarea", placeholder: "Why this allocation?" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_ownershipStructure",
        completenessType: "object", completenessFields: ["equitySplit", "vestingSchedule", "signed", "rationale"],
        syncsToLabel: "Team Competency Matrix",
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:5:4", layoutType: "repeatable_list", title: "Resource Acquisition Status", icon: "PackageCheck",
        fieldDefinitions: [
          { key: "need", label: "Need", type: "text", placeholder: "e.g., Process Engineer", required: true },
          { key: "actionUnderway", label: "Action Underway", type: "text", placeholder: "e.g., Interviewing, Applied, Negotiating" },
          { key: "status", label: "Status", type: "radio", options: ["In progress", "Complete", "Blocked"] },
          { key: "expectedCompletion", label: "Expected Completion", type: "text", placeholder: "Month X" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_resourceAcquisitionStatus",
        completenessType: "list", completenessFields: ["need", "actionUnderway", "status"],
        syncsToLabel: "Team Competency Matrix",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_hiringResourcePlan", fieldMap: { need: "roleResource", status: "status" } },
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:5:5", layoutType: "single_object", title: "Team Systems", icon: "Settings",
        fieldDefinitions: [
          { key: "communication", label: "Communication", type: "textarea", placeholder: "e.g., Slack, weekly standup" },
          { key: "documentation", label: "Documentation", type: "textarea", placeholder: "e.g., Notion, Google Drive" },
          { key: "projectManagement", label: "Project management", type: "textarea", placeholder: "e.g., Linear, Asana, Trello" },
          { key: "knowledgeSharing", label: "Knowledge sharing", type: "textarea", placeholder: "e.g., shared lab notebook, weekly show & tell" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_teamSystems",
        completenessType: "object", completenessFields: ["communication", "documentation", "projectManagement", "knowledgeSharing"],
        syncsToLabel: "Team Competency Matrix",
        checklistItemId: 0,
      },

      // TMRL Level 6 — Validation
      {
        stableKey: "TMRL:6:1", layoutType: "single_object", title: "Team Diversity & Complementarity", icon: "Puzzle",
        fieldDefinitions: [
          { key: "technicalExpertise", label: "Technical expertise coverage", type: "textarea", placeholder: "e.g., materials science, software engineering, process design" },
          { key: "commercialExpertise", label: "Commercial expertise coverage", type: "textarea", placeholder: "e.g., enterprise sales, marketing, partnerships" },
          { key: "diversityDimensions", label: "Diversity dimensions", type: "textarea", placeholder: "e.g., gender, cultural background, industry experience, age" },
          { key: "complementarity", label: "Complementarity assessment", type: "textarea", placeholder: "Where do founders' skills overlap vs. complement?" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_teamDiversity",
        completenessType: "object", completenessFields: ["technicalExpertise", "commercialExpertise", "diversityDimensions", "complementarity"],
        syncsToLabel: "Team Competency Matrix",
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:6:2", layoutType: "single_object", title: "Leadership & Capacity", icon: "Crown",
        fieldDefinitions: [
          { key: "ceo", label: "CEO", type: "text", placeholder: "Name — key responsibilities" },
          { key: "ctoCpo", label: "CTO/CPO", type: "text", placeholder: "Name — key responsibilities" },
          { key: "otherKeyRoles", label: "Other key roles filled", type: "textarea", placeholder: "e.g., Head of Sales: Name" },
          { key: "remainingGaps", label: "Remaining gaps", type: "textarea", placeholder: "Any critical roles still unfilled?" },
          { key: "resourcesSecured", label: "Resources secured", type: "textarea", placeholder: "e.g., office, lab, equipment, working capital" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_leadershipCapacity",
        completenessType: "object", completenessFields: ["ceo", "ctoCpo", "otherKeyRoles", "resourcesSecured"],
        syncsToLabel: "Team Competency Matrix",
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:6:3", layoutType: "repeatable_list", title: "Commitment Check", icon: "HeartHandshake",
        fieldDefinitions: [
          { key: "teamMember", label: "Team Member", type: "text", placeholder: "Name", required: true },
          { key: "role", label: "Role", type: "text", placeholder: "e.g., CEO" },
          { key: "fullTimeSince", label: "Full-time Since", type: "text", placeholder: "YYYY-MM" },
          { key: "keyAccountability", label: "Key Accountability", type: "text", placeholder: "e.g., revenue & fundraising" },
          { key: "committedForYears", label: "Committed for (years)", type: "text", placeholder: "e.g., 3+ years" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_commitmentCheck",
        completenessType: "list", completenessFields: ["teamMember", "role", "fullTimeSince", "keyAccountability"],
        syncsToLabel: "Team Competency Matrix",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_foundingTeamRoster", fieldMap: { teamMember: "name", role: "role" } },
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:6:4", layoutType: "repeatable_list", title: "Advisory Board Pipeline", icon: "GraduationCap",
        fieldDefinitions: [
          { key: "name", label: "Name", type: "text", placeholder: "Advisor name", required: true },
          { key: "expertise", label: "Expertise", type: "text", placeholder: "e.g., energy sector CEO" },
          { key: "role", label: "Role", type: "text", placeholder: "e.g., Advisor" },
          { key: "status", label: "Status", type: "radio", options: ["Confirmed", "In discussions"] },
          { key: "valueTheyAdd", label: "Value They Add", type: "text", placeholder: "e.g., customer intros" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_advisoryBoardPipeline",
        completenessType: "list", completenessFields: ["name", "expertise", "role", "status"],
        syncsToLabel: "Team Competency Matrix",
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:6:5", layoutType: "repeatable_list", title: "Resource Risk Register", icon: "ShieldAlert",
        fieldDefinitions: [
          { key: "risk", label: "Risk", type: "text", placeholder: "e.g., Key person leaves", required: true },
          { key: "likelihood", label: "Likelihood", type: "radio", options: ["High", "Medium", "Low"] },
          { key: "impact", label: "Impact", type: "radio", options: ["High", "Medium", "Low"] },
          { key: "mitigation", label: "Mitigation", type: "text", placeholder: "e.g., vesting cliff, documentation" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_resourceRiskRegister",
        completenessType: "list", completenessFields: ["risk", "likelihood", "impact", "mitigation"],
        syncsToLabel: "Team Competency Matrix",
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:6:6", layoutType: "single_object", title: "Internal Risk Assessment", icon: "AlertTriangle",
        fieldDefinitions: [
          { key: "potentialConflicts", label: "Potential conflicts identified", type: "textarea", placeholder: "e.g., disagreement on go-to-market timing" },
          { key: "conflictingPriorities", label: "Conflicting priorities", type: "textarea", placeholder: "e.g., founder still has academic commitments" },
          { key: "mitigationMeasures", label: "Mitigation measures", type: "textarea", placeholder: "e.g., regular founder check-ins, defined decision rights" },
          { key: "externalSupport", label: "External support", type: "textarea", placeholder: "e.g., coach, mentor, peer group" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_internalRiskAssessment",
        completenessType: "object", completenessFields: ["potentialConflicts", "conflictingPriorities", "mitigationMeasures"],
        syncsToLabel: "Team Competency Matrix",
        checklistItemId: 0,
      },

      // TMRL Level 7 — Testing
      {
        stableKey: "TMRL:7:1", layoutType: "repeatable_list", title: "Management Team", icon: "Users",
        fieldDefinitions: [
          { key: "name", label: "Name", type: "text", placeholder: "Full name", required: true },
          { key: "title", label: "Title", type: "text", placeholder: "e.g., CEO" },
          { key: "responsibilities", label: "Responsibilities", type: "text", placeholder: "e.g., Strategy, fundraising" },
          { key: "reportsTo", label: "Reports To", type: "text", placeholder: "e.g., Board" },
          { key: "performance", label: "Performance", type: "radio", options: ["Strong", "Adequate", "Needs support"] },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_managementTeam",
        completenessType: "list", completenessFields: ["name", "title", "responsibilities", "performance"],
        syncsToLabel: "Team Competency Matrix",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_leadershipCapacity", fieldMap: { name: "ceo" } },
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:7:2", layoutType: "single_object", title: "Culture & Vision Documentation", icon: "BookOpen",
        fieldDefinitions: [
          { key: "missionStatement", label: "Mission statement", type: "textarea", placeholder: "Your company's mission" },
          { key: "vision", label: "Vision", type: "textarea", placeholder: "Where do you want to be in 5 years?" },
          { key: "coreValues", label: "Core values", type: "textarea", placeholder: "3–5 values that guide behaviour" },
          { key: "whereDocumented", label: "Where documented?", type: "text", placeholder: "e.g., website, employee handbook, onboarding deck" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_cultureVisionDoc",
        completenessType: "object", completenessFields: ["missionStatement", "vision", "coreValues", "whereDocumented"],
        syncsToLabel: "Team Competency Matrix",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_teamAlignmentSummary", fieldMap: { missionStatement: "sharedVision" } },
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:7:3", layoutType: "single_object", title: "Org Growth Plan (2-Year)", icon: "TrendingUp",
        fieldDefinitions: [
          { key: "currentHeadcount", label: "Current headcount", type: "text", placeholder: "e.g., 6" },
          { key: "targetYear1", label: "Target headcount (Year 1)", type: "text", placeholder: "e.g., 12" },
          { key: "targetYear2", label: "Target headcount (Year 2)", type: "text", placeholder: "e.g., 25" },
          { key: "keyHires", label: "Key hires planned", type: "textarea", placeholder: "e.g., VP Sales (Q1), 3 engineers (Q2), ops manager (Q3)" },
          { key: "resourceInvestments", label: "Resource investments", type: "textarea", placeholder: "e.g., new lab, expanded office, manufacturing line" },
          { key: "budgetForGrowth", label: "Budget for growth", type: "text", placeholder: "e.g., £500K hiring + £200K infrastructure" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_orgGrowthPlan",
        completenessType: "object", completenessFields: ["currentHeadcount", "targetYear1", "targetYear2", "keyHires"],
        syncsToLabel: "Team Competency Matrix",
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:7:4", layoutType: "single_object", title: "Learning & Development", icon: "GraduationCap",
        fieldDefinitions: [
          { key: "onboardingProcess", label: "Onboarding process", type: "textarea", placeholder: "e.g., 2-week structured onboarding with buddy system" },
          { key: "ldBudget", label: "L&D budget", type: "text", placeholder: "e.g., £1K per person per year" },
          { key: "trainingOpportunities", label: "Training opportunities", type: "textarea", placeholder: "e.g., conference attendance, online courses, mentoring" },
          { key: "performanceReview", label: "Performance review cadence", type: "text", placeholder: "e.g., quarterly 1-on-1s, annual reviews" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_learningDevelopment",
        completenessType: "object", completenessFields: ["onboardingProcess", "ldBudget", "trainingOpportunities", "performanceReview"],
        syncsToLabel: "Team Competency Matrix",
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:7:5", layoutType: "repeatable_list", title: "Board & Advisors", icon: "Building2",
        fieldDefinitions: [
          { key: "name", label: "Name", type: "text", placeholder: "Full name", required: true },
          { key: "role", label: "Role", type: "text", placeholder: "e.g., Board Chair, Advisor" },
          { key: "expertise", label: "Expertise", type: "text", placeholder: "e.g., scaling deeptech" },
          { key: "meetingCadence", label: "Meeting Cadence", type: "text", placeholder: "e.g., Monthly, Quarterly" },
          { key: "keyContribution", label: "Key Contribution", type: "text", placeholder: "e.g., strategic direction" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_boardAdvisors",
        completenessType: "list", completenessFields: ["name", "role", "expertise", "keyContribution"],
        syncsToLabel: "Team Competency Matrix",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_advisoryBoardPipeline", fieldMap: { name: "name", role: "role", expertise: "expertise" } },
        checklistItemId: 0,
      },

      // TMRL Level 8 — Testing
      {
        stableKey: "TMRL:8:1", layoutType: "single_object", title: "Leadership Assessment", icon: "Award",
        fieldDefinitions: [
          { key: "ceoBackground", label: "CEO background", type: "textarea", placeholder: "Relevant experience for this role" },
          { key: "managementStrength", label: "Management team strength", type: "textarea", placeholder: "Where strong? Where needs development?" },
          { key: "keyResourcesInPlace", label: "Key resources in place", type: "textarea", placeholder: "e.g., lab, office, manufacturing partner, IP portfolio" },
          { key: "resourceUtilisation", label: "Resource utilisation", type: "textarea", placeholder: "Are resources being used effectively? Any waste?" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_leadershipAssessment",
        completenessType: "object", completenessFields: ["ceoBackground", "managementStrength", "keyResourcesInPlace", "resourceUtilisation"],
        syncsToLabel: "Team Competency Matrix",
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:8:2", layoutType: "single_object", title: "Board Effectiveness", icon: "BarChart3",
        fieldDefinitions: [
          { key: "boardComposition", label: "Board composition", type: "textarea", placeholder: "Summary of board members" },
          { key: "boardDiversity", label: "Board diversity", type: "textarea", placeholder: "Gender, background, skill diversity" },
          { key: "meetingCadence", label: "Meeting cadence", type: "text", placeholder: "e.g., monthly board meetings, annual strategy offsite" },
          { key: "boardEffectiveness", label: "Board effectiveness", type: "textarea", placeholder: "Is the board adding value? What could improve?" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_boardEffectiveness",
        completenessType: "object", completenessFields: ["boardComposition", "boardDiversity", "meetingCadence", "boardEffectiveness"],
        syncsToLabel: "Team Competency Matrix",
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:8:3", layoutType: "single_object", title: "HR Systems", icon: "Settings",
        fieldDefinitions: [
          { key: "hrOwner", label: "HR owner", type: "text", placeholder: "Name / title (or outsourced to...)" },
          { key: "keyPolicies", label: "Key policies in place", type: "textarea", placeholder: "e.g., employment contracts, D&I policy, grievance procedure" },
          { key: "recruitmentProcess", label: "Recruitment process", type: "textarea", placeholder: "e.g., structured interviews, skills assessments, diversity targets" },
          { key: "employeeHandbook", label: "Employee handbook", type: "radio", options: ["Yes", "No", "In progress"] },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_hrSystems",
        completenessType: "object", completenessFields: ["hrOwner", "keyPolicies", "recruitmentProcess", "employeeHandbook"],
        syncsToLabel: "Team Competency Matrix",
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:8:4", layoutType: "repeatable_list", title: "Recruitment Pipeline", icon: "UserPlus",
        fieldDefinitions: [
          { key: "role", label: "Role", type: "text", placeholder: "e.g., Senior Process Engineer", required: true },
          { key: "department", label: "Department", type: "text", placeholder: "e.g., R&D" },
          { key: "priority", label: "Priority", type: "radio", options: ["Critical", "High", "Medium"] },
          { key: "status", label: "Status", type: "radio", options: ["Sourcing", "Interviewing", "Offer", "Filled"] },
          { key: "targetStartDate", label: "Target Start Date", type: "text", placeholder: "e.g., Q2 2026" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_recruitmentPipeline",
        completenessType: "list", completenessFields: ["role", "department", "priority", "status"],
        syncsToLabel: "Team Competency Matrix",
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:8:5", layoutType: "single_object", title: "Team Health Check", icon: "HeartPulse",
        fieldDefinitions: [
          { key: "lastEngagementSurvey", label: "Last engagement survey", type: "text", placeholder: "Date and result (e.g., 4.2/5)" },
          { key: "trainingCompletionRate", label: "Training completion rate", type: "text", placeholder: "e.g., 90% completed required training" },
          { key: "retentionRate", label: "Retention rate (last 12m)", type: "text", placeholder: "e.g., 85%" },
          { key: "motivationDrivers", label: "Key motivation drivers", type: "textarea", placeholder: "What keeps the team engaged?" },
          { key: "areasForImprovement", label: "Areas for improvement", type: "textarea", placeholder: "Top concern from staff feedback?" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_teamHealthCheck",
        completenessType: "object", completenessFields: ["lastEngagementSurvey", "trainingCompletionRate", "retentionRate", "motivationDrivers"],
        syncsToLabel: "Team Competency Matrix",
        checklistItemId: 0,
      },

      // TMRL Level 9 — Scaling
      {
        stableKey: "TMRL:9:1", layoutType: "single_object", title: "Organisational Performance", icon: "Activity",
        fieldDefinitions: [
          { key: "revenuePerEmployee", label: "Revenue per employee", type: "text", placeholder: "e.g., £150K" },
          { key: "teamSize", label: "Team size", type: "text", placeholder: "e.g., 30" },
          { key: "kpis", label: "Key performance indicators", type: "textarea", placeholder: "e.g., NPS, employee satisfaction, delivery velocity" },
          { key: "operationalEfficiency", label: "Operational efficiency", type: "textarea", placeholder: "Where performing well? Where is there waste?" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_orgPerformance",
        completenessType: "object", completenessFields: ["revenuePerEmployee", "teamSize", "kpis", "operationalEfficiency"],
        syncsToLabel: "Team Competency Matrix",
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:9:2", layoutType: "single_object", title: "L&D Maturity", icon: "GraduationCap",
        fieldDefinitions: [
          { key: "ldBudgetPercent", label: "L&D budget (% of payroll)", type: "text", placeholder: "e.g., 3%" },
          { key: "programmesInPlace", label: "Programmes in place", type: "textarea", placeholder: "e.g., leadership development, technical upskilling" },
          { key: "knowledgeSharing", label: "Knowledge sharing practices", type: "textarea", placeholder: "e.g., internal tech talks, cross-functional rotations" },
          { key: "externalLearning", label: "External learning", type: "textarea", placeholder: "e.g., conference budget, university partnerships" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_ldMaturity",
        completenessType: "object", completenessFields: ["ldBudgetPercent", "programmesInPlace", "knowledgeSharing", "externalLearning"],
        syncsToLabel: "Team Competency Matrix",
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:9:3", layoutType: "single_object", title: "Continuous Improvement", icon: "RefreshCw",
        fieldDefinitions: [
          { key: "processReviewCadence", label: "Process review cadence", type: "textarea", placeholder: "e.g., quarterly retrospectives, annual org review" },
          { key: "recentImprovements", label: "Recent improvements made", type: "textarea", placeholder: "e.g., restructured engineering teams, new onboarding" },
          { key: "cultureHealthIndicators", label: "Culture health indicators", type: "textarea", placeholder: "e.g., Glassdoor rating, internal surveys, attrition" },
          { key: "structuralChanges", label: "Structural changes planned", type: "textarea", placeholder: "e.g., creating VP Engineering role, opening EU office" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_continuousImprovement",
        completenessType: "object", completenessFields: ["processReviewCadence", "recentImprovements", "cultureHealthIndicators", "structuralChanges"],
        syncsToLabel: "Team Competency Matrix",
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:9:4", layoutType: "single_object", title: "Incentive Structure", icon: "Gift",
        fieldDefinitions: [
          { key: "equityOptions", label: "Equity/options programme", type: "textarea", placeholder: "e.g., EMI options for all employees, 4-year vest" },
          { key: "bonusStructure", label: "Bonus structure", type: "textarea", placeholder: "e.g., annual bonus tied to company + individual OKRs" },
          { key: "nonFinancial", label: "Non-financial incentives", type: "textarea", placeholder: "e.g., flexible working, learning budget, team events" },
          { key: "alignmentCheck", label: "Alignment check", type: "textarea", placeholder: "Are incentives driving the right behaviours?" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_incentiveStructure",
        completenessType: "object", completenessFields: ["equityOptions", "bonusStructure", "nonFinancial", "alignmentCheck"],
        syncsToLabel: "Team Competency Matrix",
        checklistItemId: 0,
      },
      {
        stableKey: "TMRL:9:5", layoutType: "single_object", title: "Management Development", icon: "UserCog",
        fieldDefinitions: [
          { key: "successionPlanning", label: "Succession planning", type: "textarea", placeholder: "e.g., identified potential successors for 2 key roles" },
          { key: "executiveCoaching", label: "Executive coaching", type: "textarea", placeholder: "e.g., CEO has external coach, monthly sessions" },
          { key: "managementTraining", label: "Management training", type: "textarea", placeholder: "e.g., leadership programme for all managers" },
          { key: "performanceTrend", label: "Performance trend", type: "textarea", placeholder: "Is the management team getting stronger? Evidence?" },
        ],
        toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_managementDevelopment",
        completenessType: "object", completenessFields: ["successionPlanning", "executiveCoaching", "managementTraining", "performanceTrend"],
        syncsToLabel: "Team Competency Matrix",
        checklistItemId: 0,
      },

      // ═══════════════════════════════════════════════════
      // IPRL (Defensibility & Differentiation) — Dimension 3
      // ═══════════════════════════════════════════════════

      // IPRL Level 1 — Idea
      {
        stableKey: "IPRL:1:1", layoutType: "single_object", title: "Defensibility Hypothesis", icon: "Shield",
        fieldDefinitions: [
          { key: "protectable", label: "What might be protectable?", type: "textarea", placeholder: "Describe what in your technology/approach might be protectable" },
          { key: "defensibilityType", label: "Type of defensibility", type: "text", placeholder: "e.g., patent, trade secret, copyright, brand, network effects" },
          { key: "differentiationHypothesis", label: "Initial differentiation hypothesis", type: "textarea", placeholder: "What makes you different from alternatives?" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_defensibilityHypothesis",
        completenessType: "object", completenessFields: ["protectable", "defensibilityType", "differentiationHypothesis"],
        syncsToLabel: "IP Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_techConceptInitial", fieldMap: { protectable: "techDescription" } },
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:1:2", layoutType: "repeatable_list", title: "IPR Inventory", icon: "ClipboardList",
        fieldDefinitions: [
          { key: "asset", label: "Asset / Idea", type: "text", placeholder: "e.g., novel algorithm, unique formulation", required: true },
          { key: "iprType", label: "IPR Type", type: "text", placeholder: "Patent / Trade secret / Copyright / Design" },
          { key: "differentiationAngle", label: "Differentiation Angle", type: "text", placeholder: "How does this differentiate you?" },
          { key: "confidence", label: "Confidence", type: "radio", options: ["High", "Medium", "Low"] },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_iprInventory",
        completenessType: "list", completenessFields: ["asset", "iprType", "confidence"],
        syncsToLabel: "IP Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_techConceptDefined", fieldMap: { asset: "keyComponents" } },
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:1:3", layoutType: "single_object", title: "IPR Description", icon: "FileText",
        fieldDefinitions: [
          { key: "coreIpDescription", label: "Core IP description", type: "textarea", placeholder: "Describe the novel invention or creation in plain language" },
          { key: "whyNovel", label: "Why is it novel?", type: "textarea", placeholder: "What makes this different from existing solutions?" },
          { key: "otherDefensibility", label: "Other defensibility", type: "textarea", placeholder: "e.g., regulatory moat, data advantage, switching costs" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_iprDescription",
        completenessType: "object", completenessFields: ["coreIpDescription", "whyNovel", "otherDefensibility"],
        syncsToLabel: "IP Strategy",
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:1:4", layoutType: "single_object", title: "Legal Awareness Check", icon: "Scale",
        fieldDefinitions: [
          { key: "whoCreated", label: "Who created the IP?", type: "text", placeholder: "e.g., founders, university lab, employer" },
          { key: "ownershipStatus", label: "Current ownership status", type: "text", placeholder: "e.g., unclear — created during PhD, university may have claim" },
          { key: "useRightRestrictions", label: "Known use-right restrictions", type: "text", placeholder: "e.g., research-only licence from university" },
          { key: "ipPolicies", label: "Employment/academic IP policies", type: "text", placeholder: "e.g., university IP policy requires disclosure" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_legalAwareness",
        completenessType: "object", completenessFields: ["whoCreated", "ownershipStatus", "useRightRestrictions", "ipPolicies"],
        syncsToLabel: "IP Strategy",
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:1:5", layoutType: "repeatable_list", title: "State of the Art Survey", icon: "BookOpen",
        fieldDefinitions: [
          { key: "publication", label: "Publication / Patent", type: "text", placeholder: "Title", required: true },
          { key: "author", label: "Author / Assignee", type: "text", placeholder: "Author name" },
          { key: "keyFinding", label: "Key Finding", type: "text", placeholder: "What they show" },
          { key: "relevance", label: "Relevance to Your IP", type: "text", placeholder: "How it relates to your work" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_stateOfArtSurvey",
        completenessType: "list", completenessFields: ["publication", "author", "keyFinding", "relevance"],
        syncsToLabel: "IP Strategy",
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:1:7", layoutType: "single_object", title: "Legal Aspects Awareness", icon: "Scale",
        fieldDefinitions: [
          { key: "areasOfAwareness", label: "Areas of awareness", type: "checkbox_group", options: ["Ownership", "Use-rights", "Licensing", "Confidentiality", "Inventor / contributor rights", "Employer / university policies"], allowCustom: true },
          { key: "notes", label: "What we currently know", type: "textarea", placeholder: "e.g., founders hold all rights, no university claim; no licences in or out yet" },
          { key: "openQuestions", label: "Open legal questions", type: "textarea", placeholder: "e.g., does our pilot agreement cover IP arising from the project?" },
          { key: "counselEngaged", label: "Counsel engaged?", type: "radio", options: ["Yes", "No", "Planned"] },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_legalAspectsAwareness",
        completenessType: "object", completenessFields: ["areasOfAwareness", "notes", "counselEngaged"],
        syncsToLabel: "IP Strategy",
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:1:8", layoutType: "repeatable_list", title: "Technical Field & State of the Art Scan", icon: "BookOpen",
        fieldDefinitions: [
          { key: "source", label: "Source", type: "text", placeholder: "e.g., Nature Energy 2024, Google Patents, competitor whitepaper", required: true },
          { key: "type", label: "Type", type: "select", options: ["Paper", "Patent", "Product", "Industry report", "Standard / regulation", "Other"], placeholder: "Select source type..." },
          { key: "keyFinding", label: "Key finding", type: "textarea", placeholder: "What does it show that is relevant to your technical field?" },
          { key: "dateReviewed", label: "Date reviewed", type: "date" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_technicalFieldScan",
        completenessType: "list", completenessFields: ["source", "type", "keyFinding"],
        syncsToLabel: "IP Strategy",
        checklistItemId: 0,
      },

      // IPRL Level 2 — Idea
      {
        stableKey: "IPRL:2:1", layoutType: "repeatable_list", title: "Defensibility Map", icon: "Map",
        fieldDefinitions: [
          { key: "category", label: "Category", type: "text", placeholder: "e.g., Technology, Brand, Network, Data", required: true },
          { key: "specificAsset", label: "Specific Asset", type: "text", placeholder: "e.g., catalyst process patent" },
          { key: "type", label: "Type", type: "text", placeholder: "Patent / Trade secret / Brand / Network" },
          { key: "status", label: "Status", type: "radio", options: ["To be filed", "Active", "Pending"] },
          { key: "strength", label: "Strength", type: "radio", options: ["High", "Medium", "Low"] },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_defensibilityMap",
        completenessType: "list", completenessFields: ["category", "specificAsset", "type", "status", "strength"],
        syncsToLabel: "IP Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_iprInventory", fieldMap: { specificAsset: "asset", type: "iprType" } },
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:2:2", layoutType: "repeatable_list", title: "IPR Ideas", icon: "Lightbulb",
        fieldDefinitions: [
          { key: "idea", label: "Idea", type: "text", placeholder: "e.g., patent on catalyst process", required: true },
          { key: "description", label: "Description", type: "text", placeholder: "Brief description" },
          { key: "protectionRoute", label: "Protection Route", type: "text", placeholder: "e.g., utility patent, PCT" },
          { key: "priority", label: "Priority", type: "radio", options: ["High", "Medium", "Low"] },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_iprIdeas",
        completenessType: "list", completenessFields: ["idea", "description", "protectionRoute", "priority"],
        syncsToLabel: "IP Strategy",
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:2:3", layoutType: "single_object", title: "IP Ownership Audit", icon: "UserCheck",
        fieldDefinitions: [
          { key: "inventors", label: "Inventors / contributors", type: "textarea", placeholder: "List all inventors and contributors" },
          { key: "ownershipAgreements", label: "Ownership agreements in place", type: "textarea", placeholder: "e.g., IP assignment from co-founders, university licence" },
          { key: "gaps", label: "Gaps in ownership", type: "textarea", placeholder: "e.g., former collaborator has no signed assignment" },
          { key: "applicablePolicies", label: "Applicable IP policies", type: "textarea", placeholder: "e.g., university IP policy, employer IP clauses" },
          { key: "legalCounsel", label: "Legal counsel engaged?", type: "text", placeholder: "Yes / No — if yes, who?" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_ipOwnershipAudit",
        completenessType: "object", completenessFields: ["inventors", "ownershipAgreements", "gaps", "applicablePolicies", "legalCounsel"],
        syncsToLabel: "IP Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.TEA, dataKey: "_rdStatus", fieldMap: { inventors: "rdTeam" } },
        checklistItemId: 0,
      },

      // IPRL Level 3 — Discovery
      {
        stableKey: "IPRL:3:1", layoutType: "repeatable_list", title: "IPR Prioritisation", icon: "ListOrdered",
        fieldDefinitions: [
          { key: "iprAsset", label: "IPR Asset", type: "text", placeholder: "e.g., novel membrane process", required: true },
          { key: "protectionMethod", label: "Protection Method", type: "text", placeholder: "e.g., patent, trade secret" },
          { key: "commercialValue", label: "Commercial Value", type: "radio", options: ["Critical", "High", "Medium"] },
          { key: "costToProtect", label: "Cost to Protect", type: "text", placeholder: "e.g., £5–15K" },
          { key: "priority", label: "Priority", type: "text", placeholder: "Rank (1, 2, 3...)" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_iprPrioritisation",
        completenessType: "list", completenessFields: ["iprAsset", "protectionMethod", "commercialValue", "priority"],
        syncsToLabel: "IP Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_defensibilityMap", fieldMap: { iprAsset: "specificAsset", protectionMethod: "type" } },
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:3:2", layoutType: "single_object", title: "Protectability Assessment", icon: "ShieldCheck",
        fieldDefinitions: [
          { key: "detailedIpDescription", label: "Detailed IP description", type: "textarea", placeholder: "Expand on your core IP description" },
          { key: "noveltyAssessment", label: "Novelty assessment", type: "textarea", placeholder: "What is new compared to prior art?" },
          { key: "nonObviousnessArgument", label: "Non-obviousness argument", type: "textarea", placeholder: "Why wouldn't a skilled person arrive at this?" },
          { key: "differentiationMap", label: "Differentiation map", type: "textarea", placeholder: "Cover technical, UX, business model, cost, speed dimensions" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_protectabilityAssessment",
        completenessType: "object", completenessFields: ["detailedIpDescription", "noveltyAssessment", "nonObviousnessArgument", "differentiationMap"],
        syncsToLabel: "IP Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_iprDescription", fieldMap: { detailedIpDescription: "coreIpDescription" } },
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:3:3", layoutType: "repeatable_list", title: "Prior Art Search Results", icon: "Search",
        fieldDefinitions: [
          { key: "searchType", label: "Search Type", type: "text", placeholder: "e.g., Google Patents", required: true },
          { key: "scope", label: "Scope", type: "text", placeholder: "Keywords: X, Y, Z" },
          { key: "keyFindings", label: "Key Findings", type: "text", placeholder: "Found N relevant results" },
          { key: "impactOnIp", label: "Impact on Your IP", type: "text", placeholder: "e.g., FTO confirmed / need to design around" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_priorArtSearch",
        completenessType: "list", completenessFields: ["searchType", "scope", "keyFindings", "impactOnIp"],
        syncsToLabel: "IP Strategy",
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:3:4", layoutType: "repeatable_list", title: "Competitive Differentiation Analysis", icon: "Swords",
        fieldDefinitions: [
          { key: "competitor", label: "Competitor / Substitute", type: "text", placeholder: "Company name", required: true },
          { key: "theirIp", label: "Their IP / Defensibility", type: "text", placeholder: "e.g., patent US12345, brand strength" },
          { key: "yourDifferentiation", label: "Your Differentiation", type: "text", placeholder: "How you're different" },
          { key: "defensibilityGap", label: "Defensibility Gap", type: "text", placeholder: "Where you need protection" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_competitiveDiffAnalysis",
        completenessType: "list", completenessFields: ["competitor", "theirIp", "yourDifferentiation", "defensibilityGap"],
        syncsToLabel: "IP Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.COMPETITOR, dataKey: "_industryMap", fieldMap: { competitor: "name" } },
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:3:7", layoutType: "repeatable_list", title: "Prior Art & Differentiation Searches", icon: "Search",
        fieldDefinitions: [
          { key: "searchType", label: "Search type", type: "select", options: ["Patent search", "Academic literature", "Product / market scan", "Standards / regulation", "Other"], placeholder: "Select search type...", required: true },
          { key: "scope", label: "Scope and keywords", type: "textarea", placeholder: "e.g., 'solid-state electrolyte', filed 2018–2024, EU + US" },
          { key: "keyFindings", label: "Key findings", type: "textarea", placeholder: "What prior art or conflicting IPR did you find?" },
          { key: "differentiationImpact", label: "Differentiation impact", type: "textarea", placeholder: "How does this change your defensibility or differentiation story?" },
          { key: "dateCompleted", label: "Date completed", type: "date" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_priorArtDifferentiationSearches",
        completenessType: "list", completenessFields: ["searchType", "scope", "keyFindings", "differentiationImpact"],
        syncsToLabel: "IP Strategy",
        checklistItemId: 0,
      },

      // ═══════════════════════════════════════════════════
      // BRL (Commercial Model) — Dimension 4
      // ═══════════════════════════════════════════════════

      // BRL Level 1 — Idea
      {
        stableKey: "BRL:1:1", layoutType: "single_object", title: "Revenue Model Hypothesis", icon: "DollarSign",
        fieldDefinitions: [
          { key: "whoPays", label: "Who pays?", type: "text", readOnly: true, placeholder: "⟵ From CRL L1: Customer Segments" },
          { key: "revenueModel", label: "Proposed revenue model", type: "text", placeholder: "e.g., SaaS subscription, licensing, hardware sales, pay-per-use" },
          { key: "pricingHypothesis", label: "Pricing hypothesis", type: "text", placeholder: "e.g., £X/unit, £X/month, % of savings" },
          { key: "whyThisModel", label: "Why this model?", type: "textarea", placeholder: "What makes this the right way to capture value?" },
        ],
        toolTemplateId: TOOL_IDS.TEA, dataKey: "_revenueModelHypothesis",
        completenessType: "object", completenessFields: ["revenueModel", "pricingHypothesis", "whyThisModel"],
        syncsToLabel: "Techno-Economic Assessment",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_customerSegments", fieldMap: { whoPays: "customerSegment" } },
        checklistItemId: 0,
      },
      {
        stableKey: "BRL:1:2", layoutType: "single_object", title: "Market Potential (Commercial Lens)", icon: "TrendingUp",
        fieldDefinitions: [
          { key: "marketSizing", label: "Market sizing (from CRL)", type: "textarea", readOnly: true, placeholder: "⟵ From CRL L1: TAM by Segment" },
          { key: "revenueOpportunity", label: "Revenue opportunity", type: "textarea", placeholder: "Given the TAM above, what's a realistic revenue target in Year 3?" },
          { key: "keyApplications", label: "Key commercial applications", type: "textarea", placeholder: "Which applications have the best revenue potential?" },
        ],
        toolTemplateId: TOOL_IDS.TEA, dataKey: "_marketPotentialCommercial",
        completenessType: "object", completenessFields: ["revenueOpportunity", "keyApplications"],
        syncsToLabel: "Techno-Economic Assessment",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_segmentTAMs", fieldMap: { marketSizing: "segmentName" } },
        checklistItemId: 0,
      },
      {
        stableKey: "BRL:1:3", layoutType: "repeatable_list", title: "Competitive Pricing Intelligence", icon: "Search",
        fieldDefinitions: [
          { key: "competitor", label: "Competitor / Alternative", type: "text", placeholder: "Competitor name", required: true },
          { key: "businessModel", label: "Their Business Model", type: "text", placeholder: "e.g., direct sales, SaaS, licensing" },
          { key: "pricePoint", label: "Their Price Point", type: "text", placeholder: "e.g., £X/unit, £X/month" },
          { key: "implication", label: "What This Means for Your Pricing", type: "text", placeholder: "Key implication for your model" },
        ],
        toolTemplateId: TOOL_IDS.TEA, dataKey: "_competitivePricingIntel",
        completenessType: "list", completenessFields: ["competitor", "businessModel", "pricePoint", "implication"],
        syncsToLabel: "Techno-Economic Assessment",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.COMPETITOR, dataKey: "_industryMap", fieldMap: { competitor: "name" } },
        checklistItemId: 0,
      },

      // IPRL Level 4 — Discovery
      {
        stableKey: "IPRL:4:1", layoutType: "single_object", title: "Professional Search Results", icon: "FileSearch",
        fieldDefinitions: [
          { key: "searchFirm", label: "Search firm / attorney", type: "text", placeholder: "Who conducted the search?" },
          { key: "dateCompleted", label: "Date completed", type: "date" },
          { key: "conclusion", label: "Conclusion", type: "text", placeholder: "e.g., patentable, partially patentable, not patentable" },
          { key: "keyPriorArt", label: "Key prior art identified", type: "textarea", placeholder: "Most relevant competing references" },
          { key: "nextSteps", label: "Recommended next steps", type: "textarea", placeholder: "e.g., file provisional, narrow claims, pursue trade secret" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_professionalSearchResults",
        completenessType: "object", completenessFields: ["searchFirm", "conclusion", "keyPriorArt", "nextSteps"],
        syncsToLabel: "IP Strategy",
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:4:2", layoutType: "single_object", title: "IPR & Differentiation Strategy", icon: "Target",
        fieldDefinitions: [
          { key: "iprStrategySummary", label: "IPR strategy summary", type: "textarea", placeholder: "e.g., file PCT for core process, trade secret for formulation, trademark for brand" },
          { key: "priorityOrder", label: "Priority order", type: "textarea", placeholder: "Priority ranking of IP assets to protect" },
          { key: "differentiationStrategy", label: "Differentiation strategy", type: "textarea", placeholder: "How differentiation links to commercial advantage" },
          { key: "commercialEvidence", label: "Commercial evidence", type: "textarea", placeholder: "e.g., customers cite X as reason to buy" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_iprStrategy",
        completenessType: "object", completenessFields: ["iprStrategySummary", "priorityOrder", "differentiationStrategy", "commercialEvidence"],
        syncsToLabel: "IP Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_iprPrioritisation", fieldMap: { priorityOrder: "iprAsset" } },
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:4:3", layoutType: "single_object", title: "First Filing Record", icon: "FilePlus",
        fieldDefinitions: [
          { key: "filingType", label: "Filing type", type: "text", placeholder: "e.g., provisional patent, trademark application, design registration" },
          { key: "filingDate", label: "Filing date", type: "date" },
          { key: "jurisdiction", label: "Jurisdiction", type: "text", placeholder: "e.g., UK, US, PCT" },
          { key: "applicationNumber", label: "Application number", type: "text", placeholder: "Reference number" },
          { key: "keyClaimsScope", label: "Key claims / scope", type: "textarea", placeholder: "Summary of what is covered" },
          { key: "networkEffectsEstimate", label: "Network effects estimate (if applicable)", type: "textarea", placeholder: "e.g., need 10K users for data flywheel to become defensible" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_firstFilingRecord",
        completenessType: "object", completenessFields: ["filingType", "filingDate", "jurisdiction", "applicationNumber", "keyClaimsScope"],
        syncsToLabel: "IP Strategy",
        checklistItemId: 0,
      },

      // IPRL Level 5 — Validation
      {
        stableKey: "IPRL:5:1", layoutType: "single_object", title: "Strategy Draft Summary", icon: "FileEdit",
        fieldDefinitions: [
          { key: "iprStrategyDraft", label: "IPR strategy (draft)", type: "textarea", placeholder: "Your IP protection strategy" },
          { key: "defensibilityStrategyDraft", label: "Defensibility strategy (draft)", type: "textarea", placeholder: "How you'll maintain your competitive moat over time" },
          { key: "differentiationStrategyDraft", label: "Differentiation strategy (draft)", type: "textarea", placeholder: "How positioning will evolve as market matures" },
          { key: "budgetAllocated", label: "Budget allocated", type: "text", placeholder: "e.g., £25K for IP filings in Year 1" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_strategyDraft",
        completenessType: "object", completenessFields: ["iprStrategyDraft", "defensibilityStrategyDraft", "differentiationStrategyDraft", "budgetAllocated"],
        syncsToLabel: "IP Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_iprStrategy", fieldMap: { iprStrategyDraft: "iprStrategySummary", differentiationStrategyDraft: "differentiationStrategy" } },
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:5:2", layoutType: "single_object", title: "Formal Filing Record", icon: "FileCheck",
        fieldDefinitions: [
          { key: "filingType", label: "Filing type", type: "text", placeholder: "e.g., PCT patent, UK trademark, EU design registration" },
          { key: "applicationNumber", label: "Application number", type: "text", placeholder: "Application reference number" },
          { key: "filingDate", label: "Filing date", type: "date" },
          { key: "scopeClaims", label: "Scope / claims", type: "textarea", placeholder: "What is covered?" },
          { key: "attorneyFirm", label: "Attorney / firm", type: "text", placeholder: "Who is handling the filing?" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_formalFiling",
        completenessType: "object", completenessFields: ["filingType", "applicationNumber", "filingDate", "scopeClaims", "attorneyFirm"],
        syncsToLabel: "IP Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_firstFilingRecord", fieldMap: { applicationNumber: "applicationNumber", filingType: "filingType" } },
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:5:3", layoutType: "repeatable_list", title: "IP Agreements Tracker", icon: "Handshake",
        fieldDefinitions: [
          { key: "agreement", label: "Agreement", type: "text", placeholder: "e.g., IP assignment", required: true },
          { key: "parties", label: "Parties", type: "text", placeholder: "e.g., Co-founder → Company" },
          { key: "ipCovered", label: "IP Covered", type: "text", placeholder: "All prior work" },
          { key: "status", label: "Status", type: "radio", options: ["Signed", "In negotiation", "Needed"] },
          { key: "dateSigned", label: "Date Signed", type: "date" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_ipAgreementsTracker",
        completenessType: "list", completenessFields: ["agreement", "parties", "ipCovered", "status"],
        syncsToLabel: "IP Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_ipOwnershipAudit", fieldMap: { parties: "inventors" } },
        checklistItemId: 0,
      },

      // IPRL Level 6 — Validation
      {
        stableKey: "IPRL:6:1", layoutType: "single_object", title: "Complete Strategy Review", icon: "ClipboardCheck",
        fieldDefinitions: [
          { key: "iprStrategyFinal", label: "IPR strategy (final)", type: "textarea", placeholder: "Your finalised IP protection strategy" },
          { key: "differentiationStrategyFinal", label: "Differentiation strategy (final)", type: "textarea", placeholder: "How you differentiate on technology, cost, UX, brand, ecosystem" },
          { key: "validationMethod", label: "Validation method", type: "textarea", placeholder: "How was the strategy tested? e.g., attorney review, investor feedback" },
          { key: "keyRisk", label: "Key risk", type: "textarea", placeholder: "Biggest threat to your defensibility" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_completeStrategyReview",
        completenessType: "object", completenessFields: ["iprStrategyFinal", "differentiationStrategyFinal", "validationMethod", "keyRisk"],
        syncsToLabel: "IP Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_strategyDraft", fieldMap: { iprStrategyFinal: "iprStrategyDraft", differentiationStrategyFinal: "differentiationStrategyDraft" } },
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:6:2", layoutType: "repeatable_list", title: "Complementary IP Pipeline", icon: "GitBranch",
        fieldDefinitions: [
          { key: "iprAsset", label: "IPR Asset", type: "text", placeholder: "e.g., improved formulation v2", required: true },
          { key: "type", label: "Type", type: "text", placeholder: "Patent / Trade secret / Design" },
          { key: "rationale", label: "Rationale", type: "text", placeholder: "Extends protection to next-gen product" },
          { key: "timeline", label: "Timeline", type: "text", placeholder: "File by Q3" },
          { key: "budget", label: "Budget", type: "text", placeholder: "e.g., £8K" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_complementaryIpPipeline",
        completenessType: "list", completenessFields: ["iprAsset", "type", "rationale", "timeline"],
        syncsToLabel: "IP Strategy",
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:6:3", layoutType: "single_object", title: "FTO Assessment Summary", icon: "AlertTriangle",
        fieldDefinitions: [
          { key: "ftoScope", label: "FTO scope", type: "textarea", placeholder: "What products/processes were assessed?" },
          { key: "conductedBy", label: "Conducted by", type: "text", placeholder: "Attorney / firm name" },
          { key: "blockingPatents", label: "Key blocking patents found", type: "textarea", placeholder: "Most relevant blocking IP" },
          { key: "riskLevel", label: "Risk level", type: "radio", options: ["High", "Medium", "Low"] },
          { key: "mitigationPlan", label: "Mitigation plan", type: "textarea", placeholder: "e.g., design around, seek licence, challenge validity" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_ftoAssessment",
        completenessType: "object", completenessFields: ["ftoScope", "conductedBy", "blockingPatents", "riskLevel", "mitigationPlan"],
        syncsToLabel: "IP Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_priorArtSearch", fieldMap: { blockingPatents: "keyFindings" } },
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:6:4", layoutType: "repeatable_list", title: "IPR Response Log", icon: "MessageSquare",
        fieldDefinitions: [
          { key: "application", label: "Application", type: "text", placeholder: "Application number", required: true },
          { key: "responseType", label: "Response Type", type: "text", placeholder: "e.g., office action" },
          { key: "date", label: "Date", type: "date" },
          { key: "outcome", label: "Outcome", type: "text", placeholder: "e.g., positive, objections raised" },
          { key: "nextStep", label: "Next Step", type: "text", placeholder: "e.g., respond by X date" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_iprResponseLog",
        completenessType: "list", completenessFields: ["application", "responseType", "outcome", "nextStep"],
        syncsToLabel: "IP Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_formalFiling", fieldMap: { application: "applicationNumber" } },
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:6:5", layoutType: "single_object", title: "IPR Objection Response", icon: "Reply",
        fieldDefinitions: [
          { key: "applicationRef", label: "Application reference", type: "text", placeholder: "Patent/TM application number" },
          { key: "objectionSummary", label: "Objection summary", type: "textarea", placeholder: "What was the examiner's concern?" },
          { key: "responseStrategy", label: "Your response strategy", type: "textarea", placeholder: "How will you address the objection?" },
          { key: "attorneyAssessment", label: "Attorney's assessment", type: "text", placeholder: "Prospects of success: High / Medium / Low" },
          { key: "responseDeadline", label: "Response deadline", type: "date" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_iprObjectionResponse",
        completenessType: "object", completenessFields: ["applicationRef", "objectionSummary", "responseStrategy", "attorneyAssessment"],
        syncsToLabel: "IP Strategy",
        checklistItemId: 0,
      },

      // IPRL Level 7 — Testing
      {
        stableKey: "IPRL:7:1", layoutType: "repeatable_list", title: "National Phase Filings", icon: "Globe",
        fieldDefinitions: [
          { key: "application", label: "Application", type: "text", placeholder: "Patent #", required: true },
          { key: "jurisdiction", label: "Jurisdiction", type: "text", placeholder: "e.g., US, EP, CN, JP" },
          { key: "filingDate", label: "Filing Date", type: "date" },
          { key: "status", label: "Status", type: "text", placeholder: "e.g., under examination" },
          { key: "estimatedGrant", label: "Estimated Grant", type: "text", placeholder: "e.g., 2027" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_nationalPhaseFilings",
        completenessType: "list", completenessFields: ["application", "jurisdiction", "status", "estimatedGrant"],
        syncsToLabel: "IP Strategy",
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:7:2", layoutType: "single_object", title: "Differentiation Execution", icon: "Rocket",
        fieldDefinitions: [
          { key: "keyMessages", label: "Key differentiation messages", type: "textarea", placeholder: "Your core differentiation messages" },
          { key: "supportingMaterials", label: "Supporting materials", type: "textarea", placeholder: "e.g., whitepaper, case study, third-party validation report" },
          { key: "channelsUsed", label: "Channels used", type: "text", placeholder: "e.g., website, sales deck, conference presentations" },
          { key: "customerFeedback", label: "Customer feedback on positioning", type: "textarea", placeholder: "Do customers recognise your differentiation?" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_differentiationExecution",
        completenessType: "object", completenessFields: ["keyMessages", "supportingMaterials", "channelsUsed", "customerFeedback"],
        syncsToLabel: "IP Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_completeStrategyReview", fieldMap: { keyMessages: "differentiationStrategyFinal" } },
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:7:3", layoutType: "single_object", title: "Detailed FTO Update", icon: "ShieldAlert",
        fieldDefinitions: [
          { key: "updatedFtoScope", label: "Updated FTO scope", type: "textarea", placeholder: "What products/processes were re-assessed?" },
          { key: "thirdPartyDependencies", label: "Third-party IP dependencies", type: "textarea", placeholder: "Any licences needed from others?" },
          { key: "restrictionsIdentified", label: "Restrictions identified", type: "textarea", placeholder: "e.g., cannot sell in jurisdiction X without licence from Y" },
          { key: "mitigationActions", label: "Mitigation actions", type: "textarea", placeholder: "e.g., licence negotiation started, design-around completed" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_detailedFtoUpdate",
        completenessType: "object", completenessFields: ["updatedFtoScope", "thirdPartyDependencies", "restrictionsIdentified", "mitigationActions"],
        syncsToLabel: "IP Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_ftoAssessment", fieldMap: { updatedFtoScope: "ftoScope" } },
        checklistItemId: 0,
      },

      // IPRL Level 8 — Testing
      {
        stableKey: "IPRL:8:1", layoutType: "single_object", title: "IP Management System", icon: "Settings",
        fieldDefinitions: [
          { key: "ipManagementProcess", label: "IP management process", type: "textarea", placeholder: "e.g., quarterly invention disclosure reviews, IP committee" },
          { key: "ipRegister", label: "IP register/database", type: "text", placeholder: "Where is IP tracked? e.g., dedicated IP management tool" },
          { key: "agreementManagement", label: "Agreement management", type: "text", placeholder: "How are NDAs, licences, and assignments tracked?" },
          { key: "newIpCapture", label: "New IP capture process", type: "textarea", placeholder: "How do employees report new inventions?" },
          { key: "responsiblePerson", label: "Responsible person", type: "text", placeholder: "Who owns IP management?" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_ipManagementSystem",
        completenessType: "object", completenessFields: ["ipManagementProcess", "ipRegister", "agreementManagement", "newIpCapture", "responsiblePerson"],
        syncsToLabel: "IP Strategy",
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:8:2", layoutType: "repeatable_list", title: "Granted IPR", icon: "Award",
        fieldDefinitions: [
          { key: "iprType", label: "IPR Type", type: "text", placeholder: "Patent / Trademark / Design", required: true },
          { key: "reference", label: "Reference", type: "text", placeholder: "Patent #" },
          { key: "jurisdiction", label: "Jurisdiction", type: "text", placeholder: "e.g., US" },
          { key: "grantDate", label: "Grant Date", type: "date" },
          { key: "scope", label: "Scope", type: "text", placeholder: "Key claims" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_grantedIpr",
        completenessType: "list", completenessFields: ["iprType", "reference", "jurisdiction", "scope"],
        syncsToLabel: "IP Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_nationalPhaseFilings", fieldMap: { reference: "application", jurisdiction: "jurisdiction" } },
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:8:3", layoutType: "repeatable_list", title: "Additional Filings", icon: "FilePlus2",
        fieldDefinitions: [
          { key: "application", label: "Application", type: "text", placeholder: "Application reference", required: true },
          { key: "type", label: "Type", type: "text", placeholder: "e.g., continuation patent" },
          { key: "jurisdiction", label: "Jurisdiction", type: "text", placeholder: "e.g., US, CN" },
          { key: "filingDate", label: "Filing Date", type: "date" },
          { key: "rationale", label: "Rationale", type: "text", placeholder: "Why?" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_additionalFilings",
        completenessType: "list", completenessFields: ["application", "type", "jurisdiction", "rationale"],
        syncsToLabel: "IP Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_complementaryIpPipeline", fieldMap: { application: "iprAsset", type: "type" } },
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:8:4", layoutType: "single_object", title: "Differentiation Strategy Review", icon: "RefreshCw",
        fieldDefinitions: [
          { key: "originalDifferentiation", label: "Original differentiation", type: "textarea", placeholder: "Your original differentiation strategy", readOnly: true },
          { key: "marketChanges", label: "Market changes", type: "textarea", placeholder: "What shifted in the competitive landscape?" },
          { key: "updatedDifferentiation", label: "Updated differentiation", type: "textarea", placeholder: "How has your positioning evolved?" },
          { key: "evidenceItWorks", label: "Evidence it works", type: "textarea", placeholder: "e.g., win rate improved, customers cite X" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_differentiationStrategyReview",
        completenessType: "object", completenessFields: ["originalDifferentiation", "marketChanges", "updatedDifferentiation", "evidenceItWorks"],
        syncsToLabel: "IP Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_completeStrategyReview", fieldMap: { originalDifferentiation: "differentiationStrategyFinal" } },
        checklistItemId: 0,
      },

      // IPRL Level 9 — Scaling
      {
        stableKey: "IPRL:9:1", layoutType: "single_object", title: "IP Value Assessment", icon: "Gem",
        fieldDefinitions: [
          { key: "revenueProtected", label: "Revenue protected by IP", type: "text", placeholder: "Revenue figure" },
          { key: "dealsWon", label: "Competitive deals won due to IP", type: "textarea", placeholder: "e.g., 3 deals where patent was cited as differentiator" },
          { key: "licensingRevenue", label: "Licensing revenue (if any)", type: "text", placeholder: "e.g., £X from licensing" },
          { key: "differentiationImpact", label: "Differentiation impact", type: "textarea", placeholder: "How does positioning drive acquisition?" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_ipValueAssessment",
        completenessType: "object", completenessFields: ["revenueProtected", "dealsWon", "licensingRevenue", "differentiationImpact"],
        syncsToLabel: "IP Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.SALES_DECK, dataKey: "_salesMetrics", fieldMap: { revenueProtected: "revenue" } },
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:9:2", layoutType: "repeatable_list", title: "Global IP Portfolio", icon: "Globe2",
        fieldDefinitions: [
          { key: "iprType", label: "IPR Type", type: "text", placeholder: "Patent / Trademark / Design", required: true },
          { key: "reference", label: "Reference", type: "text", placeholder: "Patent #" },
          { key: "jurisdictions", label: "Jurisdictions", type: "text", placeholder: "e.g., US, EP, CN, JP" },
          { key: "status", label: "Status", type: "radio", options: ["Granted", "Pending"] },
          { key: "annualMaintenanceCost", label: "Annual Maintenance Cost", type: "text", placeholder: "£X/year" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_globalIpPortfolio",
        completenessType: "list", completenessFields: ["iprType", "reference", "jurisdictions", "status"],
        syncsToLabel: "IP Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_grantedIpr", fieldMap: { iprType: "iprType", reference: "reference", jurisdictions: "jurisdiction" } },
        checklistItemId: 0,
      },
      {
        stableKey: "IPRL:9:3", layoutType: "repeatable_list", title: "External IP Agreements", icon: "FileSignature",
        fieldDefinitions: [
          { key: "agreement", label: "Agreement", type: "text", placeholder: "e.g., in-licence", required: true },
          { key: "counterparty", label: "Counterparty", type: "text", placeholder: "Company X" },
          { key: "ipCovered", label: "IP Covered", type: "text", placeholder: "Patent Y" },
          { key: "terms", label: "Terms", type: "text", placeholder: "e.g., exclusive, royalty-bearing" },
          { key: "renewalDate", label: "Renewal Date", type: "date" },
        ],
        toolTemplateId: TOOL_IDS.IP_STRATEGY, dataKey: "_externalIpAgreements",
        completenessType: "list", completenessFields: ["agreement", "counterparty", "ipCovered", "terms"],
        syncsToLabel: "IP Strategy",
        checklistItemId: 0,
      },

      // ── FRL (Funding Readiness) L1–L9 ──

      // FRL L1
      {
        stableKey: "FRL:1:1", layoutType: "single_object", title: "Verification Activities (Initial)", icon: "ClipboardList",
        fieldDefinitions: [
          { key: "keyActivities", label: "Key activities to verify", type: "textarea", placeholder: "e.g., customer interviews, lab proof-of-concept, IP search" },
          { key: "timeHorizon", label: "Estimated time horizon", type: "text", placeholder: "e.g., 6 months" },
          { key: "fundingRequired", label: "Funding required?", type: "textarea", placeholder: "Yes — rough estimate of how much and why" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_verificationActivities",
        completenessType: "object", completenessFields: ["keyActivities", "timeHorizon", "fundingRequired"],
        syncsToLabel: "Funding Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.TEA, dataKey: "_rdStatus", fieldMap: { keyActivities: "milestones" } },
        checklistItemId: 0,
      },
      {
        stableKey: "FRL:1:2", layoutType: "repeatable_list", title: "Funding Options Awareness", icon: "Lightbulb",
        fieldDefinitions: [
          { key: "fundingType", label: "Funding Type", type: "text", placeholder: "e.g., Grants, Angel investment, Bootstrapping", required: true },
          { key: "description", label: "Description", type: "text", placeholder: "e.g., Non-dilutive, competitive" },
          { key: "relevance", label: "Relevance to You", type: "text", placeholder: "e.g., Innovate UK, Horizon Europe" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_fundingOptionsAwareness",
        completenessType: "list", completenessFields: ["fundingType", "description"],
        syncsToLabel: "Funding Strategy",
        checklistItemId: 0,
      },

      // FRL L2
      {
        stableKey: "FRL:2:1", layoutType: "repeatable_list", title: "Verification Plan & Budget", icon: "Calculator",
        fieldDefinitions: [
          { key: "activity", label: "Activity", type: "text", placeholder: "e.g., 20 customer interviews", required: true },
          { key: "purpose", label: "Purpose", type: "text", placeholder: "e.g., Validate problem hypothesis" },
          { key: "estimatedCost", label: "Estimated Cost", type: "currency", placeholder: "0" },
          { key: "timeline", label: "Timeline", type: "text", placeholder: "e.g., Month 1–2" },
          { key: "sourceDimension", label: "Source Dimension", type: "text", placeholder: "e.g., CRL, TRL, IPRL" },
          { key: "ipProtectionCost", label: "IP protection cost estimate (from IPRL)", type: "text", readOnly: true, placeholder: "Auto-populated from IPRL" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_verificationPlanBudget",
        completenessType: "list", completenessFields: ["activity", "estimatedCost"],
        syncsToLabel: "Funding Strategy",
        runningTotals: { field: "estimatedCost", label: "Total Verification Budget" },
        prePopulateFrom: { toolTemplateId: TOOL_IDS.TEA, dataKey: "_rdStatus", fieldMap: { activity: "currentFocus", estimatedCost: "budget" } },
        checklistItemId: 0,
      },
      {
        stableKey: "FRL:2:2", layoutType: "single_object", title: "Initial Funding Plan", icon: "FileText",
        fieldDefinitions: [
          { key: "totalFundingNeeded", label: "Total funding needed (6 months)", type: "currency", placeholder: "0" },
          { key: "primarySource", label: "Primary funding source", type: "text", placeholder: "e.g., university grant, personal savings, angel" },
          { key: "backupSource", label: "Backup funding source", type: "text", placeholder: "e.g., competition prize, accelerator stipend" },
          { key: "keyMilestone", label: "Key milestone this funds", type: "textarea", placeholder: "e.g., validated technical feasibility + 30 customer interviews" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_initialFundingPlan",
        completenessType: "object", completenessFields: ["totalFundingNeeded", "primarySource", "keyMilestone"],
        syncsToLabel: "Funding Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_verificationPlanBudget", fieldMap: { totalFundingNeeded: "estimatedCost" } },
        checklistItemId: 0,
      },

      // FRL L3
      {
        stableKey: "FRL:3:1", layoutType: "single_object", title: "Secured Funding", icon: "BadgeCheck",
        fieldDefinitions: [
          { key: "fundingNeeded", label: "Funding needed", type: "currency", readOnly: true, placeholder: "From Initial Funding Plan" },
          { key: "amountSecured", label: "Amount secured", type: "currency", placeholder: "e.g., 35000" },
          { key: "sources", label: "Source(s)", type: "textarea", placeholder: "e.g., Innovate UK Smart Grant (£25K) + personal investment (£10K)" },
          { key: "conditions", label: "Conditions attached", type: "textarea", placeholder: "e.g., match-funding required, IP remains with company" },
          { key: "runway", label: "Runway", type: "text", placeholder: "e.g., 5 months at current burn rate" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_securedFunding",
        completenessType: "object", completenessFields: ["amountSecured", "sources", "runway"],
        syncsToLabel: "Funding Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_initialFundingPlan", fieldMap: { fundingNeeded: "totalFundingNeeded" } },
        checklistItemId: 0,
      },
      {
        stableKey: "FRL:3:2", layoutType: "repeatable_list", title: "Funding Type Assessment", icon: "Scale",
        fieldDefinitions: [
          { key: "fundingType", label: "Funding Type", type: "text", placeholder: "e.g., Grants", required: true },
          { key: "pros", label: "Pros", type: "text", placeholder: "e.g., Non-dilutive, validation" },
          { key: "cons", label: "Cons", type: "text", placeholder: "e.g., Slow, restrictive" },
          { key: "suitability", label: "Suitability for Your Stage", type: "text", placeholder: "High / Medium / Low — explain" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_fundingTypeAssessment",
        completenessType: "list", completenessFields: ["fundingType", "pros", "cons", "suitability"],
        syncsToLabel: "Funding Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_fundingOptionsAwareness", fieldMap: { fundingType: "fundingType" } },
        checklistItemId: 0,
      },

      // FRL L4
      {
        stableKey: "FRL:4:1", layoutType: "single_object", title: "Commercial Verification Plan", icon: "Briefcase",
        fieldDefinitions: [
          { key: "commercialHypotheses", label: "Key commercial hypotheses to test", type: "textarea", placeholder: "e.g., revenue/margin assumptions to validate" },
          { key: "activitiesPlanned", label: "Activities planned", type: "textarea", placeholder: "e.g., 3 paid pilots, first sales hire, marketing MVP" },
          { key: "timeline", label: "Timeline", type: "text", placeholder: "e.g., 9 months" },
          { key: "totalBudget", label: "Total budget", type: "currency", placeholder: "0" },
          { key: "keyMilestones", label: "Key milestones", type: "textarea", placeholder: "e.g., 3 paying customers, £50K revenue, validated unit economics" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_commercialVerificationPlan",
        completenessType: "object", completenessFields: ["commercialHypotheses", "activitiesPlanned", "totalBudget", "keyMilestones"],
        syncsToLabel: "Funding Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_plProjection", fieldMap: { commercialHypotheses: "revenueAssumptions" } },
        checklistItemId: 0,
      },
      {
        stableKey: "FRL:4:2", layoutType: "repeatable_list", title: "Funding Source Pipeline", icon: "GitBranch",
        fieldDefinitions: [
          { key: "source", label: "Source", type: "text", placeholder: "e.g., Innovate UK", required: true },
          { key: "type", label: "Type", type: "text", placeholder: "e.g., Grant, Equity, Debt" },
          { key: "amountTargeted", label: "Amount Targeted", type: "currency", placeholder: "0" },
          { key: "status", label: "Status", type: "text", placeholder: "e.g., Application submitted" },
          { key: "timeline", label: "Timeline", type: "text", placeholder: "e.g., Decision in 6 weeks" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_fundingSourcePipeline",
        completenessType: "list", completenessFields: ["source", "type", "amountTargeted", "status"],
        syncsToLabel: "Funding Strategy",
        checklistItemId: 0,
      },
      {
        stableKey: "FRL:4:3", layoutType: "single_object", title: "Funding Secured (Commercial Phase)", icon: "BadgeCheck",
        fieldDefinitions: [
          { key: "planBudget", label: "Plan budget", type: "currency", readOnly: true, placeholder: "From Commercial Verification Plan" },
          { key: "totalSecured", label: "Total secured", type: "currency", placeholder: "0" },
          { key: "breakdown", label: "Breakdown", type: "textarea", placeholder: "e.g., Grant: £80K, Angel: £40K" },
          { key: "percentFunded", label: "% of plan funded", type: "percentage", formula: "({totalSecured} / {planBudget}) * 100", readOnly: true },
          { key: "gapRemaining", label: "Gap remaining", type: "textarea", placeholder: "e.g., £30K — plan to cover from pilot revenue" },
          { key: "runway", label: "Runway at current burn", type: "text", placeholder: "e.g., 8 months" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_fundingSecuredCommercial",
        completenessType: "object", completenessFields: ["totalSecured", "breakdown", "runway"],
        syncsToLabel: "Funding Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_commercialVerificationPlan", fieldMap: { planBudget: "totalBudget" } },
        checklistItemId: 0,
      },

      // FRL L5
      {
        stableKey: "FRL:5:1", layoutType: "repeatable_list", title: "Pitch Iteration Log", icon: "MessageSquare",
        fieldDefinitions: [
          { key: "audience", label: "Audience", type: "text", placeholder: "e.g., VC partner at Fund X", required: true },
          { key: "date", label: "Date", type: "date" },
          { key: "keyFeedback", label: "Key Feedback", type: "text", placeholder: "e.g., Unit economics need evidence" },
          { key: "changeMade", label: "Change Made to Pitch", type: "text", placeholder: "e.g., Added pilot customer data from CRL" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_pitchIterationLog",
        completenessType: "list", completenessFields: ["audience", "keyFeedback", "changeMade"],
        syncsToLabel: "Funding Strategy",
        checklistItemId: 0,
      },
      {
        stableKey: "FRL:5:2", layoutType: "single_object", title: "Financial Forecast & Pitch Status", icon: "BarChart3",
        fieldDefinitions: [
          { key: "revenueForecast", label: "12-month revenue forecast", type: "currency", placeholder: "0" },
          { key: "costForecast", label: "12-month cost forecast", type: "currency", placeholder: "0" },
          { key: "monthlyCashBurn", label: "Monthly cash burn", type: "currency", placeholder: "0" },
          { key: "breakEvenTarget", label: "Cash-flow breakeven target", type: "text", placeholder: "e.g., Month 14" },
          { key: "pitchTestedWith", label: "Pitch deck tested with", type: "text", placeholder: "e.g., 5 investors, 2 accelerators" },
          { key: "overallFeedback", label: "Overall pitch feedback", type: "textarea", placeholder: "Summary of top reactions and concerns" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_financialForecastPitch",
        completenessType: "object", completenessFields: ["revenueForecast", "costForecast", "monthlyCashBurn", "pitchTestedWith"],
        syncsToLabel: "Funding Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_plSummary", fieldMap: { revenueForecast: "revenueYear1" } },
        checklistItemId: 0,
      },
      {
        stableKey: "FRL:5:3", layoutType: "single_object", title: "Funding Strategy", icon: "Target",
        fieldDefinitions: [
          { key: "nearTermNeed", label: "Near-term funding need (12 months)", type: "currency", placeholder: "0" },
          { key: "targetSources", label: "Target sources", type: "textarea", placeholder: "e.g., seed round (£300K) + grant (£200K)" },
          { key: "fundingTimeline", label: "Funding timeline", type: "text", placeholder: "e.g., close seed by Q2, grant decision Q3" },
          { key: "dilutionBudget", label: "Dilution budget", type: "text", placeholder: "e.g., willing to give up 15–20% at seed" },
          { key: "backupPlan", label: "Backup plan", type: "textarea", placeholder: "What if primary sources don't come through?" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_fundingStrategy",
        completenessType: "object", completenessFields: ["nearTermNeed", "targetSources", "fundingTimeline", "dilutionBudget"],
        syncsToLabel: "Funding Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_plSummary", fieldMap: { nearTermNeed: "totalCostsYear1" } },
        checklistItemId: 0,
      },
      {
        stableKey: "FRL:5:4", layoutType: "single_object", title: "Funding Consequences Assessment", icon: "AlertTriangle",
        fieldDefinitions: [
          { key: "currentOwnership", label: "Current ownership", type: "text", readOnly: true, placeholder: "From TMRL Ownership Structure" },
          { key: "equityDilution", label: "Equity dilution impact", type: "text", placeholder: "e.g., founders will own X% post-seed" },
          { key: "boardChanges", label: "Board/governance changes", type: "textarea", placeholder: "e.g., investor board seat, veto rights" },
          { key: "reportingObligations", label: "Reporting obligations", type: "textarea", placeholder: "e.g., monthly investor updates, quarterly board meetings" },
          { key: "growthExpectations", label: "Growth expectations", type: "textarea", placeholder: "What return timeline are investors expecting?" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_fundingConsequences",
        completenessType: "object", completenessFields: ["equityDilution", "boardChanges", "reportingObligations", "growthExpectations"],
        syncsToLabel: "Funding Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_ownershipStructure", fieldMap: { currentOwnership: "equitySplit" } },
        checklistItemId: 0,
      },
      {
        stableKey: "FRL:5:7", layoutType: "single_object", title: "External Funding Implications", icon: "AlertTriangle",
        fieldDefinitions: [
          { key: "controlImpact", label: "Impact on control", type: "textarea", placeholder: "e.g., investor approval rights on hires, budget, exit; loss of unilateral decision-making" },
          { key: "ownershipImpact", label: "Impact on ownership", type: "textarea", placeholder: "e.g., expected dilution at this round and over the next two rounds" },
          { key: "commercialModelImpact", label: "Impact on the commercial model", type: "textarea", placeholder: "e.g., pressure for faster growth, change in target segment, push to higher-margin products" },
          { key: "governanceChanges", label: "Governance changes expected", type: "textarea", placeholder: "e.g., new board seat, reporting cadence, reserved matters" },
          { key: "comfortLevel", label: "Comfort level with these trade-offs", type: "slider", min: 1, max: 10, minLabel: "Very uncomfortable", maxLabel: "Fully comfortable" },
          { key: "redLines", label: "Constraints we will not accept", type: "textarea", placeholder: "e.g., loss of founder majority pre-Series A, full ratchet anti-dilution, mandatory exit by year 5" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_externalFundingImplications",
        completenessType: "object", completenessFields: ["controlImpact", "ownershipImpact", "commercialModelImpact", "comfortLevel"],
        syncsToLabel: "Funding Strategy",
        checklistItemId: 0,
      },

      // FRL L6
      {
        stableKey: "FRL:6:1", layoutType: "repeatable_list", title: "Funder Engagement Tracker", icon: "Users",
        fieldDefinitions: [
          { key: "funder", label: "Funder", type: "text", placeholder: "e.g., Fund X", required: true },
          { key: "type", label: "Type", type: "select", options: ["VC", "Angel", "Grant", "CVC", "Accelerator", "Other"], placeholder: "Select type..." },
          { key: "stageOfEngagement", label: "Stage of Engagement", type: "text", placeholder: "e.g., first meeting, DD" },
          { key: "interestLevel", label: "Interest Level", type: "select", options: ["Hot", "Warm", "Cold"], placeholder: "Select..." },
          { key: "nextStep", label: "Next Step", type: "text", placeholder: "Next action" },
          { key: "pitchContext", label: "Pitch iteration context (from FRL L5)", type: "text", readOnly: true, placeholder: "Auto-populated from FRL pitch log" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_funderEngagementTracker",
        completenessType: "list", completenessFields: ["funder", "type", "stageOfEngagement", "interestLevel"],
        syncsToLabel: "Funding Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_fundingSourcePipeline", fieldMap: { funder: "source", type: "type" } },
        checklistItemId: 0,
      },
      {
        stableKey: "FRL:6:2", layoutType: "single_object", title: "Multi-Year Financial Model", icon: "TrendingUp",
        fieldDefinitions: [
          { key: "year1RevenueCost", label: "Year 1 revenue / cost", type: "text", placeholder: "e.g., £500K / £400K" },
          { key: "year3RevenueCost", label: "Year 3 revenue / cost", type: "text", placeholder: "e.g., £3M / £2M" },
          { key: "year5RevenueCost", label: "Year 5 revenue / cost", type: "text", placeholder: "e.g., £8M / £5M" },
          { key: "totalFundingRequired", label: "Total funding required (to profitability)", type: "currency", placeholder: "0" },
          { key: "fundingRoundsPlanned", label: "Funding rounds planned", type: "textarea", placeholder: "e.g., Seed: £500K (now), Series A: £2M (Month 18)" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_multiYearFinancialModel",
        completenessType: "object", completenessFields: ["year1RevenueCost", "year3RevenueCost", "totalFundingRequired", "fundingRoundsPlanned"],
        syncsToLabel: "Funding Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_financialProjections", fieldMap: { year1RevenueCost: "revenueYear1", year3RevenueCost: "revenueYear3" } },
        checklistItemId: 0,
      },

      // FRL L7
      {
        stableKey: "FRL:7:1", layoutType: "repeatable_list", title: "Term Sheet Tracker", icon: "FileText",
        fieldDefinitions: [
          { key: "funder", label: "Funder", type: "text", placeholder: "e.g., Fund X", required: true },
          { key: "amount", label: "Amount", type: "currency", placeholder: "0" },
          { key: "valuationTerms", label: "Valuation / Terms", type: "text", placeholder: "e.g., £3M pre-money, SAFE" },
          { key: "status", label: "Status", type: "text", placeholder: "e.g., term sheet received" },
          { key: "keyConditions", label: "Key Conditions", type: "text", placeholder: "e.g., lead needed, DD pending" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_termSheetTracker",
        completenessType: "list", completenessFields: ["funder", "amount", "status"],
        syncsToLabel: "Funding Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_funderEngagementTracker", fieldMap: { funder: "funder" } },
        checklistItemId: 0,
      },
      {
        stableKey: "FRL:7:2", layoutType: "single_object", title: "Fundraising Readiness Checklist", icon: "CheckSquare",
        fieldDefinitions: [
          { key: "pitchDeckStatus", label: "Pitch deck status", type: "text", placeholder: "e.g., v7, tested with 15+ investors" },
          { key: "businessPlan", label: "Business plan", type: "text", placeholder: "e.g., 20-page plan with 5-year model" },
          { key: "customerEvidence", label: "Customer evidence (from CRL)", type: "textarea", readOnly: true, placeholder: "Auto-summary from CRL data" },
          { key: "technologyEvidence", label: "Technology evidence (from TRL)", type: "textarea", readOnly: true, placeholder: "Auto-summary from TRL data" },
          { key: "ipEvidence", label: "IP evidence (from IPRL)", type: "textarea", readOnly: true, placeholder: "Auto-summary from IPRL data" },
          { key: "financialModel", label: "Financial model (from BRL)", type: "textarea", readOnly: true, placeholder: "Auto-summary from BRL data" },
          { key: "teamCapTable", label: "Team & cap table (from TMRL)", type: "textarea", readOnly: true, placeholder: "Auto-summary from TMRL data" },
          { key: "dataRoomPlatform", label: "Data room platform", type: "text", placeholder: "e.g., Google Drive, DocSend, Notion" },
          { key: "missingDocuments", label: "Missing documents", type: "textarea", placeholder: "Anything not yet in the data room?" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_fundraisingReadiness",
        completenessType: "object", completenessFields: ["pitchDeckStatus", "businessPlan", "dataRoomPlatform"],
        syncsToLabel: "Funding Strategy",
        checklistItemId: 0,
      },
      {
        stableKey: "FRL:7:3", layoutType: "single_object", title: "Accounting & Documentation", icon: "BookOpen",
        fieldDefinitions: [
          { key: "accountingSystem", label: "Accounting system", type: "text", placeholder: "e.g., Xero, QuickBooks" },
          { key: "bookkeepingCurrent", label: "Bookkeeping current?", type: "text", placeholder: "Yes / No — last updated date" },
          { key: "bankStatements", label: "Bank statements", type: "text", placeholder: "Available for X months" },
          { key: "keyContracts", label: "Key contracts filed", type: "textarea", placeholder: "e.g., customer agreements, supplier contracts" },
          { key: "legalEntity", label: "Legal entity properly set up", type: "text", placeholder: "e.g., Ltd incorporated, articles in place" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_accountingDocumentation",
        completenessType: "object", completenessFields: ["accountingSystem", "bookkeepingCurrent", "legalEntity"],
        syncsToLabel: "Funding Strategy",
        checklistItemId: 0,
      },

      // FRL L8
      {
        stableKey: "FRL:8:1", layoutType: "single_object", title: "Negotiation Status", icon: "Handshake",
        fieldDefinitions: [
          { key: "leadInvestor", label: "Lead investor", type: "text", placeholder: "e.g., Fund X" },
          { key: "roundSize", label: "Round size", type: "currency", placeholder: "0" },
          { key: "termsAgreed", label: "Terms agreed", type: "text", placeholder: "e.g., £4M pre-money, 20% ESOP" },
          { key: "ddStatus", label: "Due diligence status", type: "text", placeholder: "e.g., complete / legal DD in progress" },
          { key: "expectedCloseDate", label: "Expected close date", type: "date" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_negotiationStatus",
        completenessType: "object", completenessFields: ["leadInvestor", "roundSize", "termsAgreed", "ddStatus"],
        syncsToLabel: "Funding Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_termSheetTracker", fieldMap: { leadInvestor: "funder", roundSize: "amount", termsAgreed: "valuationTerms" } },
        checklistItemId: 0,
      },
      {
        stableKey: "FRL:8:2", layoutType: "repeatable_list", title: "Funding Documents Checklist", icon: "FileCheck",
        fieldDefinitions: [
          { key: "document", label: "Document", type: "text", placeholder: "e.g., SHA (Shareholders Agreement)", required: true },
          { key: "status", label: "Status", type: "select", options: ["Not Started", "Drafted", "Reviewed", "Signed", "Filed"], placeholder: "Select status..." },
          { key: "lastUpdated", label: "Last Updated", type: "date" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_fundingDocumentsChecklist",
        completenessType: "list", completenessFields: ["document", "status"],
        syncsToLabel: "Funding Strategy",
        checklistItemId: 0,
      },
      {
        stableKey: "FRL:8:3", layoutType: "single_object", title: "Cap Table & Structure", icon: "PieChart",
        fieldDefinitions: [
          { key: "legalEntity", label: "Legal entity", type: "text", placeholder: "e.g., Acme Ltd, UK Ltd company" },
          { key: "currentCapTable", label: "Current cap table", type: "textarea", readOnly: true, placeholder: "From TMRL Ownership Structure" },
          { key: "postRoundCapTable", label: "Post-round cap table (planned)", type: "textarea", placeholder: "e.g., Founders: 60%, Investors: 25%, ESOP: 15%" },
          { key: "shareClassStructure", label: "Share class structure", type: "text", placeholder: "e.g., ordinary + preference shares for investors" },
          { key: "knownIssues", label: "Known issues", type: "textarea", placeholder: "e.g., none / need to convert SAFE notes" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_capTableStructure",
        completenessType: "object", completenessFields: ["legalEntity", "postRoundCapTable", "shareClassStructure"],
        syncsToLabel: "Funding Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.TEAM_MATRIX, dataKey: "_ownershipStructure", fieldMap: { currentCapTable: "equitySplit" } },
        checklistItemId: 0,
      },
      {
        stableKey: "FRL:8:4", layoutType: "single_object", title: "Data Room Audit", icon: "FolderSearch",
        fieldDefinitions: [
          { key: "dataRoomPlatform", label: "Data room platform", type: "text", placeholder: "e.g., DocSend, Google Drive" },
          { key: "legalComplete", label: "Legal section complete?", type: "textarea", readOnly: true, placeholder: "Auto-check from TMRL & IPRL" },
          { key: "financialComplete", label: "Financial section complete?", type: "textarea", readOnly: true, placeholder: "Auto-check from BRL & FRL" },
          { key: "ipComplete", label: "IP section complete?", type: "textarea", readOnly: true, placeholder: "Auto-check from IPRL" },
          { key: "ipAgreements", label: "IP agreements & filings", type: "textarea", readOnly: true, placeholder: "Auto-check from IPRL agreements & patents" },
          { key: "commercialComplete", label: "Commercial section complete?", type: "textarea", readOnly: true, placeholder: "Auto-check from CRL" },
          { key: "accountingStatus", label: "Accounting & documentation", type: "textarea", readOnly: true, placeholder: "Auto-check from FRL accounting data" },
          { key: "lastReviewed", label: "Last reviewed", type: "date" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_dataRoomAudit",
        completenessType: "object", completenessFields: ["dataRoomPlatform", "lastReviewed"],
        syncsToLabel: "Funding Strategy",
        checklistItemId: 0,
      },

      // FRL L9
      {
        stableKey: "FRL:9:1", layoutType: "single_object", title: "Funding Secured (Growth Stage)", icon: "Trophy",
        fieldDefinitions: [
          { key: "roundCompleted", label: "Round completed", type: "text", placeholder: "e.g., Seed / Series A" },
          { key: "amountRaised", label: "Amount raised", type: "currency", placeholder: "0" },
          { key: "keyInvestors", label: "Key investors", type: "textarea", placeholder: "Names and lead" },
          { key: "runway", label: "Runway", type: "text", placeholder: "e.g., 24 months at planned burn" },
          { key: "keyMilestones", label: "Key milestones this funds", type: "textarea", placeholder: "e.g., scale to £5M ARR, expand to EU, hire to 25" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_fundingSecuredGrowth",
        completenessType: "object", completenessFields: ["roundCompleted", "amountRaised", "keyInvestors", "runway"],
        syncsToLabel: "Funding Strategy",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_negotiationStatus", fieldMap: { roundCompleted: "termsAgreed", amountRaised: "roundSize", keyInvestors: "leadInvestor" } },
        checklistItemId: 0,
      },
      {
        stableKey: "FRL:9:2", layoutType: "single_object", title: "Financial Systems", icon: "Monitor",
        fieldDefinitions: [
          { key: "accountingSystem", label: "Accounting system", type: "text", placeholder: "e.g., Xero with Syft Analytics" },
          { key: "reportingCadence", label: "Reporting cadence", type: "text", placeholder: "e.g., monthly P&L, weekly cash-flow, quarterly board pack" },
          { key: "budgetingProcess", label: "Budgeting process", type: "text", placeholder: "e.g., annual budget with quarterly reforecasts" },
          { key: "kpiDashboard", label: "KPI dashboard", type: "text", placeholder: "e.g., Metabase/Looker dashboard with revenue, burn, runway" },
          { key: "auditReview", label: "Audit / review", type: "text", placeholder: "e.g., annual audit by mid-tier firm" },
        ],
        toolTemplateId: TOOL_IDS.FUNDING_STRATEGY, dataKey: "_financialSystems",
        completenessType: "object", completenessFields: ["accountingSystem", "reportingCadence", "budgetingProcess", "kpiDashboard"],
        syncsToLabel: "Funding Strategy",
        checklistItemId: 0,
      },

      // BRL Level 2 — Idea
      {
        stableKey: "BRL:2:1", layoutType: "single_object", title: "Business Concept (Financial View)", icon: "Briefcase",
        fieldDefinitions: [
          { key: "valueProposition", label: "Value proposition", type: "textarea", readOnly: true, placeholder: "⟵ From CRL L4: Positioning Statement" },
          { key: "techAdvantage", label: "Technology advantage", type: "textarea", readOnly: true, placeholder: "⟵ From TRL L4: Commercial KPI Validation" },
          { key: "revenueModelDetailed", label: "Revenue model (detailed)", type: "textarea", placeholder: "How exactly do you capture value? Describe pricing tiers, contract structure" },
          { key: "costStructure", label: "Cost structure hypothesis", type: "textarea", placeholder: "What are the major cost categories? (COGS, R&D, sales, operations)" },
          { key: "marginHypothesis", label: "Margin hypothesis", type: "text", placeholder: "What gross margin do you expect and why?" },
        ],
        toolTemplateId: TOOL_IDS.TEA, dataKey: "_businessConceptFinancial",
        completenessType: "object", completenessFields: ["revenueModelDetailed", "costStructure", "marginHypothesis"],
        syncsToLabel: "Techno-Economic Assessment",
        prePopulateFrom: [
          { toolTemplateId: TOOL_IDS.VPC, dataKey: "_positioning", fieldMap: { valueProposition: "differentiator" } },
          { toolTemplateId: TOOL_IDS.TEA, dataKey: "_commercialKpiValidation", fieldMap: { techAdvantage: "improvement" } },
        ],
        checklistItemId: 0,
      },
      {
        stableKey: "BRL:2:2", layoutType: "repeatable_list", title: "Competitive Model Benchmarking", icon: "BarChart3",
        fieldDefinitions: [
          { key: "competitor", label: "Competitor", type: "text", placeholder: "Competitor name", required: true },
          { key: "revenueModel", label: "Revenue Model", type: "text", placeholder: "e.g., SaaS, hardware, licensing" },
          { key: "estimatedRevenue", label: "Estimated Revenue", type: "text", placeholder: "e.g., £XM ARR" },
          { key: "grossMargin", label: "Gross Margin (est.)", type: "text", placeholder: "e.g., 60–70%" },
          { key: "keyInsight", label: "Key Insight for Your Model", type: "text", placeholder: "What you learn for your own model" },
        ],
        toolTemplateId: TOOL_IDS.TEA, dataKey: "_competitiveModelBenchmark",
        completenessType: "list", completenessFields: ["competitor", "revenueModel", "keyInsight"],
        syncsToLabel: "Techno-Economic Assessment",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.COMPETITOR, dataKey: "_industryMap", fieldMap: { competitor: "name" } },
        checklistItemId: 0,
      },

      // BRL Level 3 — Discovery
      {
        stableKey: "BRL:3:1", layoutType: "single_object", title: "Commercial Model Canvas", icon: "LayoutGrid",
        fieldDefinitions: [
          { key: "customerSegmentsBuyer", label: "Customer segments & buyer", type: "textarea", readOnly: true, placeholder: "⟵ From CRL L4: Buyer Roles" },
          { key: "valueProposition", label: "Value proposition", type: "textarea", readOnly: true, placeholder: "⟵ From CRL L4: Positioning Statement" },
          { key: "revenueStreams", label: "Revenue streams", type: "textarea", placeholder: "Describe each stream: e.g., hardware sales (40%), service (35%), licensing (25%)" },
          { key: "costStructure", label: "Cost structure", type: "textarea", placeholder: "Key cost drivers: COGS breakdown, R&D, sales, G&A" },
          { key: "keyResources", label: "Key resources", type: "textarea", placeholder: "e.g., IP, manufacturing partnerships, domain expertise" },
          { key: "keyActivities", label: "Key activities", type: "textarea", placeholder: "e.g., product development, pilot deployments, regulatory approval" },
          { key: "keyPartners", label: "Key partners", type: "textarea", placeholder: "⟵ Refer to CRL L4: Value Chain Map — list key commercial partners" },
        ],
        toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_commercialModelCanvas",
        completenessType: "object", completenessFields: ["revenueStreams", "costStructure", "keyResources", "keyActivities"],
        syncsToLabel: "Financial Model",
        prePopulateFrom: [
          { toolTemplateId: TOOL_IDS.CUSTOMER_PROFILE, dataKey: "_buyerRoles", fieldMap: { customerSegmentsBuyer: "segment" } },
          { toolTemplateId: TOOL_IDS.VPC, dataKey: "_positioning", fieldMap: { valueProposition: "differentiator" } },
        ],
        checklistItemId: 0,
      },
      {
        stableKey: "BRL:3:2", layoutType: "repeatable_list", title: "Sustainability Factors", icon: "Leaf",
        fieldDefinitions: [
          { key: "factor", label: "Factor", type: "text", placeholder: "e.g., CO₂ emissions, materials use", required: true },
          { key: "positiveContribution", label: "Positive Contribution", type: "text", placeholder: "e.g., Reduces X tonnes/year vs. incumbent" },
          { key: "negativeContribution", label: "Negative Contribution", type: "text", placeholder: "e.g., Manufacturing process uses Y energy" },
          { key: "netAssessment", label: "Net Assessment", type: "radio", options: ["Positive", "Negative", "Neutral"] },
        ],
        toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_sustainabilityFactors",
        completenessType: "list", completenessFields: ["factor", "positiveContribution", "netAssessment"],
        syncsToLabel: "Financial Model",
        checklistItemId: 0,
      },
      {
        stableKey: "BRL:3:3", layoutType: "single_object", title: "Revenue Addressable Market", icon: "Target",
        fieldDefinitions: [
          { key: "marketSizing", label: "Market sizing (from CRL)", type: "textarea", readOnly: true, placeholder: "⟵ From CRL L3: Segment Sizing" },
          { key: "beachheadMarket", label: "Beachhead market", type: "textarea", readOnly: true, placeholder: "⟵ From CRL L5: Beachhead Market" },
          { key: "samRefinement", label: "SAM refinement", type: "textarea", placeholder: "What portion of TAM can you realistically serve with current model? With reasoning." },
          { key: "somYear1to2", label: "SOM (Year 1–2)", type: "textarea", placeholder: "Realistic revenue target with assumptions" },
          { key: "keyAssumptions", label: "Key assumptions", type: "textarea", placeholder: "What must be true for these numbers to hold?" },
        ],
        toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_revenueAddressableMarket",
        completenessType: "object", completenessFields: ["samRefinement", "somYear1to2", "keyAssumptions"],
        syncsToLabel: "Financial Model",
        prePopulateFrom: [
          { toolTemplateId: TOOL_IDS.TAM, dataKey: "_segmentSizes", fieldMap: { marketSizing: "segment" } },
          { toolTemplateId: TOOL_IDS.VPC, dataKey: "_beachheadMarket", fieldMap: { beachheadMarket: "segment" } },
        ],
        checklistItemId: 0,
      },
      {
        stableKey: "BRL:3:4", layoutType: "repeatable_list", title: "Competitive Input for Model", icon: "Crosshair",
        fieldDefinitions: [
          { key: "competitor", label: "Competitor", type: "text", placeholder: "Competitor name", required: true },
          { key: "theirPricePoint", label: "Their Price Point", type: "text", placeholder: "e.g., £X/unit, £X/month" },
          { key: "theirModel", label: "Their Model", type: "text", placeholder: "e.g., SaaS, direct sales" },
          { key: "lessonForYou", label: "Lesson for Your Commercial Model", type: "text", placeholder: "e.g., their SaaS pricing validates £X/month range" },
        ],
        toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_competitiveInputForModel",
        completenessType: "list", completenessFields: ["competitor", "theirPricePoint", "lessonForYou"],
        syncsToLabel: "Financial Model",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.COMPETITOR, dataKey: "_industryMap", fieldMap: { competitor: "name" } },
        checklistItemId: 0,
      },
      {
        stableKey: "BRL:3:7", layoutType: "repeatable_list", title: "Competitive Landscape Inputs", icon: "Crosshair",
        fieldDefinitions: [
          { key: "competitor", label: "Competitor / alternative", type: "text", placeholder: "Competitor name", required: true },
          { key: "positioning", label: "Their positioning", type: "text", placeholder: "How they describe themselves to customers" },
          { key: "businessModel", label: "Their business model", type: "text", placeholder: "e.g., SaaS, hardware + service, marketplace" },
          { key: "pricePoint", label: "Their price point", type: "text", placeholder: "e.g., £X/unit, £X/month, % of savings" },
          { key: "insightForModel", label: "Insight for your model", type: "textarea", placeholder: "What this tells you about pricing, packaging or segment choice" },
          { key: "source", label: "Source", type: "text", placeholder: "e.g., their website, sales call, analyst report" },
        ],
        toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_competitiveLandscapeInputs",
        completenessType: "list", completenessFields: ["competitor", "businessModel", "pricePoint", "insightForModel"],
        syncsToLabel: "Financial Model",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.COMPETITOR, dataKey: "_industryMap", fieldMap: { competitor: "name" } },
        checklistItemId: 0,
      },

      // BRL Level 4 — Discovery
      {
        stableKey: "BRL:4:1", layoutType: "single_object", title: "P&L Projection (Initial)", icon: "FileSpreadsheet",
        fieldDefinitions: [
          { key: "revenueYear1", label: "Revenue Year 1", type: "text", placeholder: "e.g., £150K — based on beachhead" },
          { key: "revenueYear3", label: "Revenue Year 3", type: "text", placeholder: "e.g., £2M" },
          { key: "grossMarginTarget", label: "Gross margin target", type: "text", placeholder: "e.g., 55%" },
          { key: "cogsBreakdown", label: "COGS breakdown", type: "textarea", placeholder: "e.g., materials: £X, manufacturing: £X, delivery: £X" },
          { key: "rdCosts", label: "R&D costs", type: "text", readOnly: true, placeholder: "⟵ From TRL L3: R&D Status (budget)" },
          { key: "ipCosts", label: "IP costs", type: "text", placeholder: "⟵ Refer to IPRL L5 if completed — enter IP budget allocation" },
          { key: "breakEvenTimeline", label: "Break-even timeline", type: "text", placeholder: "e.g., Month 18" },
          { key: "biggestFinancialRisk", label: "Biggest financial risk", type: "text", placeholder: "e.g., long sales cycles in enterprise" },
        ],
        toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_plProjectionInitial",
        completenessType: "object", completenessFields: ["revenueYear1", "revenueYear3", "grossMarginTarget", "cogsBreakdown", "breakEvenTimeline"],
        syncsToLabel: "Financial Model",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.TEA, dataKey: "_rdStatus", fieldMap: { rdCosts: "budget" } },
        checklistItemId: 0,
      },
      {
        stableKey: "BRL:4:2", layoutType: "single_object", title: "Sustainability Assessment (Initial)", icon: "Leaf",
        fieldDefinitions: [
          { key: "keySustainabilityFactors", label: "Key sustainability factors", type: "textarea", readOnly: true, placeholder: "⟵ From BRL L3: Sustainability Factors" },
          { key: "primaryEnvBenefit", label: "Primary environmental benefit (quantified)", type: "textarea", placeholder: "e.g., displaces 500 tCO₂/year per deployment" },
          { key: "primarySocialBenefit", label: "Primary social benefit (quantified)", type: "textarea", placeholder: "e.g., creates X local manufacturing jobs" },
          { key: "negativeContributions", label: "Negative contributions (quantified)", type: "textarea", placeholder: "e.g., production process uses Y MWh energy" },
          { key: "mitigationPlan", label: "Mitigation plan", type: "textarea", placeholder: "How will you address the negatives?" },
          { key: "methodology", label: "Assessment methodology", type: "text", placeholder: "e.g., simplified LCA, SDG alignment mapping" },
        ],
        toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_sustainabilityAssessment",
        completenessType: "object", completenessFields: ["primaryEnvBenefit", "primarySocialBenefit", "negativeContributions", "mitigationPlan"],
        syncsToLabel: "Financial Model",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_sustainabilityFactors", fieldMap: { keySustainabilityFactors: "factor" } },
        checklistItemId: 0,
      },

      // BRL Level 5 — Validation
      {
        stableKey: "BRL:5:1", layoutType: "repeatable_list", title: "Revenue Model Feedback", icon: "MessageSquare",
        fieldDefinitions: [
          { key: "source", label: "Source", type: "text", placeholder: "Contact name / company", required: true },
          { key: "feedback", label: "Feedback on Pricing / Revenue Model", type: "textarea", placeholder: "Key feedback on pricing or model" },
          { key: "changeMade", label: "Change Made to Model", type: "text", placeholder: "How you responded" },
        ],
        toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_revenueModelFeedback",
        completenessType: "list", completenessFields: ["source", "feedback", "changeMade"],
        syncsToLabel: "Financial Model",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.CUSTOMER_PROFILE, dataKey: "_relationships", fieldMap: { source: "name" } },
        checklistItemId: 0,
      },
      {
        stableKey: "BRL:5:2", layoutType: "repeatable_list", title: "Cost Validation", icon: "Calculator",
        fieldDefinitions: [
          { key: "costComponent", label: "Cost Component", type: "text", placeholder: "e.g., materials, manufacturing", required: true },
          { key: "assumedCost", label: "Assumed Cost", type: "text", placeholder: "From BRL L4 P&L" },
          { key: "feedbackSource", label: "Feedback Source", type: "text", placeholder: "Supplier/partner name" },
          { key: "validatedCost", label: "Validated Cost", type: "text", placeholder: "e.g., £Y/unit" },
          { key: "delta", label: "Delta", type: "text", placeholder: "+/- %" },
        ],
        toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_costValidation",
        completenessType: "list", completenessFields: ["costComponent", "assumedCost", "validatedCost", "delta"],
        syncsToLabel: "Financial Model",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_plProjectionInitial", fieldMap: { assumedCost: "cogsBreakdown" } },
        checklistItemId: 0,
      },
      {
        stableKey: "BRL:5:3", layoutType: "repeatable_list", title: "Impact Measures", icon: "Heart",
        fieldDefinitions: [
          { key: "measure", label: "Measure", type: "text", placeholder: "e.g., switch to bio-based material", required: true },
          { key: "category", label: "Category", type: "text", readOnly: true, placeholder: "⟵ From BRL L3: Sustainability Factors" },
          { key: "expectedImpact", label: "Expected Impact", type: "text", placeholder: "Reduces emissions by X%" },
          { key: "costFeasibility", label: "Cost/Feasibility", type: "text", placeholder: "+5% COGS, readily available" },
        ],
        toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_impactMeasures",
        completenessType: "list", completenessFields: ["measure", "expectedImpact", "costFeasibility"],
        syncsToLabel: "Financial Model",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_sustainabilityFactors", fieldMap: { category: "factor" } },
        checklistItemId: 0,
      },
      {
        stableKey: "BRL:5:4", layoutType: "single_object", title: "Updated P&L Summary", icon: "FileSpreadsheet",
        fieldDefinitions: [
          { key: "revenueYear1Updated", label: "Revenue Year 1 (updated)", type: "text", placeholder: "Updated from BRL L4 P&L — enter new figure" },
          { key: "grossMarginUpdated", label: "Gross margin (updated)", type: "text", placeholder: "Updated gross margin %" },
          { key: "keyChanges", label: "Key changes from feedback", type: "textarea", placeholder: "What shifted and why? Reference BRL L5 cost/revenue feedback" },
          { key: "stillViable", label: "Still viable?", type: "radio", options: ["Yes", "Conditionally", "Needs pivot"] },
          { key: "viabilityExplanation", label: "Explanation", type: "textarea", placeholder: "Explain your assessment" },
        ],
        toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_updatedPLSummary",
        completenessType: "object", completenessFields: ["revenueYear1Updated", "grossMarginUpdated", "keyChanges", "stillViable"],
        syncsToLabel: "Financial Model",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_plProjectionInitial", fieldMap: { revenueYear1Updated: "revenueYear1", grossMarginUpdated: "grossMarginTarget" } },
        checklistItemId: 0,
      },
      {
        stableKey: "BRL:5:5", layoutType: "single_object", title: "Market Model Update", icon: "RefreshCw",
        fieldDefinitions: [
          { key: "currentSegments", label: "Current segments (from CRL)", type: "textarea", readOnly: true, placeholder: "⟵ From CRL L4: Segment Profiles" },
          { key: "currentTamSam", label: "Current TAM/SAM (from CRL + BRL)", type: "textarea", readOnly: true, placeholder: "⟵ From BRL L3: Revenue Addressable Market" },
          { key: "whatChanged", label: "What changed based on market feedback?", type: "textarea", placeholder: "New commercial insights that affect the model" },
          { key: "updatedSom", label: "Updated SOM", type: "textarea", placeholder: "Revised near-term revenue target with reasoning" },
          { key: "competitiveLandscapeShift", label: "Competitive landscape shift", type: "text", placeholder: "Any new entrants or pricing moves?" },
        ],
        toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_marketModelUpdate",
        completenessType: "object", completenessFields: ["whatChanged", "updatedSom", "competitiveLandscapeShift"],
        syncsToLabel: "Financial Model",
        prePopulateFrom: [
          { toolTemplateId: TOOL_IDS.CUSTOMER_PROFILE, dataKey: "_segmentRefinement", fieldMap: { currentSegments: "name" } },
          { toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_revenueAddressableMarket", fieldMap: { currentTamSam: "samRefinement" } },
        ],
        checklistItemId: 0,
      },

      // BRL Level 6 — Validation
      {
        stableKey: "BRL:6:1", layoutType: "repeatable_list", title: "Business Scenario Test", icon: "FlaskConical",
        fieldDefinitions: [
          { key: "scenario", label: "Scenario", type: "text", placeholder: "e.g., pilot with Utility X", required: true },
          { key: "customerContext", label: "Customer/Context", type: "text", placeholder: "Customer or market context" },
          { key: "revenueGenerated", label: "Revenue Generated", type: "text", placeholder: "£X" },
          { key: "keyLearning", label: "Key Learning", type: "text", placeholder: "What worked / didn't" },
          { key: "modelAdjustment", label: "Model Adjustment", type: "text", placeholder: "Change made to model" },
        ],
        toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_businessScenarioTest",
        completenessType: "list", completenessFields: ["scenario", "revenueGenerated", "keyLearning", "modelAdjustment"],
        syncsToLabel: "Financial Model",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.SALES_DECK, dataKey: "_customerAgreements", fieldMap: { customerContext: "company" } },
        checklistItemId: 0,
      },
      {
        stableKey: "BRL:6:2", layoutType: "single_object", title: "Financial Projections (Validated)", icon: "TrendingUp",
        fieldDefinitions: [
          { key: "threeYearRevenue", label: "3-year revenue projection", type: "textarea", placeholder: "e.g., Y1: £500K, Y2: £1.5M, Y3: £4M" },
          { key: "grossMarginValidated", label: "Gross margin (validated)", type: "text", placeholder: "e.g., 52% based on pilot data" },
          { key: "unitEconomics", label: "Unit economics", type: "textarea", placeholder: "e.g., CAC: £X, LTV: £Y, LTV/CAC: Z" },
          { key: "cashFlowBreakeven", label: "Cash-flow breakeven", type: "text", placeholder: "e.g., Month 24" },
          { key: "confidenceLevel", label: "Confidence level", type: "radio", options: ["High", "Medium", "Low"] },
          { key: "confidenceEvidence", label: "Based on what evidence?", type: "textarea", placeholder: "What evidence supports this confidence level?" },
        ],
        toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_financialProjectionsValidated",
        completenessType: "object", completenessFields: ["threeYearRevenue", "grossMarginValidated", "unitEconomics", "cashFlowBreakeven", "confidenceLevel"],
        syncsToLabel: "Financial Model",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_updatedPLSummary", fieldMap: { grossMarginValidated: "grossMarginUpdated" } },
        checklistItemId: 0,
      },

      // BRL Level 7 — Testing
      {
        stableKey: "BRL:7:1", layoutType: "repeatable_list", title: "Commercial Sales Evidence", icon: "ShoppingCart",
        fieldDefinitions: [
          { key: "customer", label: "Customer", type: "text", placeholder: "Customer name", required: true },
          { key: "dealValue", label: "Deal Value", type: "text", placeholder: "£X" },
          { key: "contractTerms", label: "Contract Terms", type: "text", placeholder: "e.g., annual, 2-year" },
          { key: "discountGiven", label: "Discount Given?", type: "text", placeholder: "e.g., full price, 10% discount" },
          { key: "wtpSignal", label: "WTP Signal", type: "text", placeholder: "e.g., paid upfront, fast decision" },
        ],
        toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_commercialSalesEvidence",
        completenessType: "list", completenessFields: ["customer", "dealValue", "contractTerms", "wtpSignal"],
        syncsToLabel: "Financial Model",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.SALES_DECK, dataKey: "_customerAgreements", fieldMap: { customer: "company" } },
        checklistItemId: 0,
      },
      {
        stableKey: "BRL:7:2", layoutType: "single_object", title: "Sales-Validated Financials", icon: "FileCheck",
        fieldDefinitions: [
          { key: "projectedRevenue", label: "Projected revenue", type: "text", readOnly: true, placeholder: "⟵ From BRL L6: Financial Projections" },
          { key: "actualRevenue", label: "Actual revenue to date", type: "text", placeholder: "⟵ Refer to CRL L8: Sales Metrics — enter actual revenue" },
          { key: "variance", label: "Variance", type: "text", placeholder: "Actual vs. projected difference" },
          { key: "avgDealSize", label: "Average deal size", type: "text", placeholder: "e.g., £44K" },
          { key: "grossMarginActual", label: "Gross margin (actual)", type: "text", placeholder: "e.g., 49%" },
          { key: "varianceDrivers", label: "Key variance drivers", type: "textarea", placeholder: "Where and why do actuals differ from plan?" },
        ],
        toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_salesValidatedFinancials",
        completenessType: "object", completenessFields: ["variance", "avgDealSize", "grossMarginActual", "varianceDrivers"],
        syncsToLabel: "Financial Model",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_financialProjectionsValidated", fieldMap: { projectedRevenue: "threeYearRevenue" } },
        checklistItemId: 0,
      },
      {
        stableKey: "BRL:7:3", layoutType: "repeatable_list", title: "Supply Chain & Partner Agreements", icon: "Handshake",
        fieldDefinitions: [
          { key: "partner", label: "Partner", type: "text", placeholder: "Partner name", required: true },
          { key: "roleInModel", label: "Role in Model", type: "text", placeholder: "e.g., manufacturing, distribution, channel" },
          { key: "agreementType", label: "Agreement Type", type: "text", placeholder: "e.g., MOU, supply agreement, reseller contract" },
          { key: "status", label: "Status", type: "radio", options: ["Active", "Negotiating", "Planned"] },
          { key: "criticalDependency", label: "Critical Dependency?", type: "radio", options: ["Yes", "No"] },
        ],
        toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_supplyChainPartnerAgreements",
        completenessType: "list", completenessFields: ["partner", "roleInModel", "agreementType", "status"],
        syncsToLabel: "Financial Model",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_partnerTracker", fieldMap: { partner: "name", roleInModel: "type" } },
        checklistItemId: 0,
      },

      // BRL Level 8 — Testing
      {
        stableKey: "BRL:8:1", layoutType: "single_object", title: "Operational Metrics Dashboard", icon: "BarChart3",
        fieldDefinitions: [
          { key: "annualRevenue", label: "Annual revenue (latest)", type: "text", placeholder: "Latest annual revenue figure" },
          { key: "grossMarginTrailing", label: "Gross margin (trailing 12m)", type: "text", placeholder: "e.g., 54%" },
          { key: "revenueGrowthRate", label: "Revenue growth rate", type: "text", placeholder: "e.g., 85% YoY" },
          { key: "unitEconomicsActual", label: "Unit economics (actual)", type: "textarea", placeholder: "e.g., CAC: £X, LTV: £Y, payback: Z months" },
          { key: "environmentalKPI", label: "Environmental KPI", type: "text", placeholder: "e.g., 2,400 tCO₂ avoided to date" },
          { key: "socialKPI", label: "Social KPI", type: "text", placeholder: "e.g., 15 skilled jobs created" },
          { key: "scalabilityIndicator", label: "Scalability indicator", type: "text", readOnly: true, placeholder: "⟵ From TRL L8: Operational Proof" },
        ],
        toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_operationalMetricsDashboard",
        completenessType: "object", completenessFields: ["annualRevenue", "grossMarginTrailing", "revenueGrowthRate", "unitEconomicsActual", "environmentalKPI"],
        syncsToLabel: "Financial Model",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.TEA, dataKey: "_operationalProof", fieldMap: { scalabilityIndicator: "deploymentCount" } },
        checklistItemId: 0,
      },
      {
        stableKey: "BRL:8:2", layoutType: "single_object", title: "Commercial Infrastructure", icon: "Building2",
        fieldDefinitions: [
          { key: "activeSalesChannels", label: "Active sales channels", type: "textarea", readOnly: true, placeholder: "⟵ From CRL L8: Sales Process" },
          { key: "revenueStreamsMix", label: "Revenue streams (actual mix)", type: "textarea", placeholder: "e.g., hardware: 60%, service: 30%, licensing: 10%" },
          { key: "supplyChainStatus", label: "Supply chain status", type: "textarea", placeholder: "Current supply chain status and key agreements" },
          { key: "bottleneckRisk", label: "Bottleneck / risk", type: "textarea", placeholder: "What's the weakest link?" },
        ],
        toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_commercialInfrastructure",
        completenessType: "object", completenessFields: ["revenueStreamsMix", "supplyChainStatus", "bottleneckRisk"],
        syncsToLabel: "Financial Model",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.SALES_DECK, dataKey: "_salesProcess", fieldMap: { activeSalesChannels: "process" } },
        checklistItemId: 0,
      },
      {
        stableKey: "BRL:8:3", layoutType: "repeatable_list", title: "Model Iteration Log", icon: "History",
        fieldDefinitions: [
          { key: "date", label: "Date", type: "text", placeholder: "YYYY-MM", required: true },
          { key: "changeMade", label: "Change Made", type: "text", placeholder: "e.g., shifted to annual contracts" },
          { key: "rationale", label: "Rationale", type: "text", placeholder: "Improve cash flow" },
          { key: "impactOnMargin", label: "Impact on Margin", type: "text", placeholder: "+3pp gross margin" },
          { key: "impactOnSustainability", label: "Impact on Sustainability", type: "text", placeholder: "Neutral / Positive / Negative" },
        ],
        toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_modelIterationLog",
        completenessType: "list", completenessFields: ["date", "changeMade", "rationale", "impactOnMargin"],
        syncsToLabel: "Financial Model",
        checklistItemId: 0,
      },

      // BRL Level 9 — Scaling
      {
        stableKey: "BRL:9:1", layoutType: "single_object", title: "Performance vs. Expectations", icon: "Award",
        fieldDefinitions: [
          { key: "profitVsPlan", label: "Profit vs. plan", type: "textarea", placeholder: "Target vs. actual EBITDA performance" },
          { key: "growthVsPlan", label: "Growth vs. plan", type: "textarea", placeholder: "Target vs. actual ARR growth" },
          { key: "scalabilityEvidence", label: "Scalability evidence", type: "textarea", placeholder: "e.g., replicated in 3 new geographies" },
          { key: "envImpactVsTarget", label: "Environmental impact vs. target", type: "textarea", placeholder: "Target vs. actual environmental KPI" },
          { key: "socialImpactVsTarget", label: "Social impact vs. target", type: "textarea", placeholder: "Target vs. actual social KPI" },
        ],
        toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_performanceVsExpectations",
        completenessType: "object", completenessFields: ["profitVsPlan", "growthVsPlan", "scalabilityEvidence", "envImpactVsTarget"],
        syncsToLabel: "Financial Model",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_financialProjectionsValidated", fieldMap: { profitVsPlan: "threeYearRevenue" } },
        checklistItemId: 0,
      },
      {
        stableKey: "BRL:9:2", layoutType: "single_object", title: "Performance Tracking Systems", icon: "Monitor",
        fieldDefinitions: [
          { key: "financialReporting", label: "Financial reporting system", type: "text", placeholder: "e.g., Xero with monthly board reporting" },
          { key: "environmentalTracking", label: "Environmental tracking", type: "text", placeholder: "e.g., carbon accounting via X, annual third-party audit" },
          { key: "socialImpactTracking", label: "Social impact tracking", type: "text", placeholder: "e.g., annual impact report, B Corp assessment" },
          { key: "reportingCadence", label: "Reporting cadence", type: "text", placeholder: "e.g., monthly financial, quarterly impact, annual audit" },
        ],
        toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_performanceTrackingSystems",
        completenessType: "object", completenessFields: ["financialReporting", "environmentalTracking", "socialImpactTracking", "reportingCadence"],
        syncsToLabel: "Financial Model",
        checklistItemId: 0,
      },
      {
        stableKey: "BRL:9:3", layoutType: "repeatable_list", title: "Historic Performance", icon: "Calendar",
        fieldDefinitions: [
          { key: "year", label: "Year", type: "text", placeholder: "Year 1, Year 2...", required: true },
          { key: "revenue", label: "Revenue", type: "text", placeholder: "£X" },
          { key: "grossMargin", label: "Gross Margin", type: "text", placeholder: "X%" },
          { key: "netProfit", label: "Net Profit", type: "text", placeholder: "£X" },
          { key: "environmentalKPI", label: "Environmental KPI", type: "text", placeholder: "Metric" },
          { key: "socialKPI", label: "Social KPI", type: "text", placeholder: "Metric" },
        ],
        toolTemplateId: TOOL_IDS.FINANCIAL, dataKey: "_historicPerformance",
        completenessType: "list", completenessFields: ["year", "revenue", "grossMargin"],
        syncsToLabel: "Financial Model",
        checklistItemId: 0,
      },

      // CIRL Level 1 — Idea
      {
        stableKey: "CIRL:1:1", layoutType: "single_object", title: "Climate Impact Thesis", icon: "Leaf",
        fieldDefinitions: [
          { key: "environmentalProblem", label: "What environmental/climate problem does your solution address?", type: "textarea", placeholder: "Describe the climate or environmental problem..." },
          { key: "howAddressed", label: "How does your solution address this problem?", type: "textarea", placeholder: "Describe the mechanism of impact..." },
          { key: "scale", label: "What is the potential scale of impact?", type: "textarea", placeholder: "e.g., gigatonne-scale CO₂ reduction, millions of people adapted..." },
          { key: "evidenceBasis", label: "What evidence supports your thesis?", type: "textarea", placeholder: "Scientific literature, market data, policy trends..." },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_climateImpactThesis",
        completenessType: "object", completenessFields: ["environmentalProblem", "howAddressed", "scale"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },
      {
        stableKey: "CIRL:1:2", layoutType: "single_object", title: "Impact Motivation", icon: "Heart",
        fieldDefinitions: [
          { key: "primaryMotivation", label: "Primary motivation", type: "radio", options: ["Mission-driven", "Market opportunity", "Regulatory compliance", "Multiple drivers"] },
          { key: "founderConnection", label: "Founder connection to the problem", type: "textarea", placeholder: "Why does this climate problem matter to you personally?" },
          { key: "stakeholderAlignment", label: "Stakeholder alignment", type: "textarea", placeholder: "How do investors, customers, and team align with this mission?" },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_impactMotivation",
        completenessType: "object", completenessFields: ["primaryMotivation", "founderConnection"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },

      // CIRL Level 2 — Idea
      {
        stableKey: "CIRL:2:1", layoutType: "single_object", title: "Solution Classification", icon: "Tag",
        fieldDefinitions: [
          { key: "solutionType", label: "Solution type", type: "radio", options: ["Mitigation", "Adaptation", "Measurement", "Removal", "Enabling"] },
          { key: "sectorCategory", label: "Sector / category", type: "text", placeholder: "e.g., Energy, Transport, Agriculture, Industry, Buildings" },
          { key: "mechanismDescription", label: "Impact mechanism", type: "textarea", placeholder: "How does your solution reduce/avoid/remove emissions or enable others to do so?" },
          { key: "projectDrawdownAlignment", label: "Project Drawdown alignment", type: "text", placeholder: "e.g., Drawdown Solution #12: Distributed Solar" },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_solutionClassification",
        completenessType: "object", completenessFields: ["solutionType", "sectorCategory", "mechanismDescription"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },
      {
        stableKey: "CIRL:2:2", layoutType: "repeatable_list", title: "Life Cycle Emissions Overview", icon: "Recycle",
        fieldDefinitions: [
          { key: "lifecycleStage", label: "Lifecycle stage", type: "text", placeholder: "e.g., Raw materials, Manufacturing, Use phase, End-of-life", required: true },
          { key: "emissionType", label: "Emission type", type: "radio", options: ["Source (emissions)", "Sink (reduction/removal)", "Neutral"] },
          { key: "magnitude", label: "Estimated magnitude", type: "radio", options: ["High", "Medium", "Low", "Unknown"] },
          { key: "notes", label: "Notes", type: "textarea", placeholder: "Key assumptions or data gaps..." },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_lifeCycleEmissions",
        completenessType: "list", completenessFields: ["lifecycleStage", "emissionType"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },

      // CIRL Level 3 — Discovery
      {
        stableKey: "CIRL:3:1", layoutType: "repeatable_list", title: "Solution Effects Inventory", icon: "List",
        fieldDefinitions: [
          { key: "effectName", label: "Effect", type: "text", placeholder: "e.g., Displaced grid electricity, Reduced transport fuel", required: true },
          { key: "effectType", label: "Type", type: "radio", options: ["Direct reduction", "Indirect reduction", "Avoided emissions", "Increased emissions", "Rebound effect"] },
          { key: "ghgScope", label: "GHG scope", type: "radio", options: ["Scope 1", "Scope 2", "Scope 3", "Multiple"] },
          { key: "description", label: "Description", type: "textarea", placeholder: "Describe the causal chain..." },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_solutionEffectsInventory",
        completenessType: "list", completenessFields: ["effectName", "effectType"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },
      {
        stableKey: "CIRL:3:2", layoutType: "repeatable_list", title: "Incumbent Emissions Profile", icon: "Factory",
        fieldDefinitions: [
          { key: "incumbentName", label: "Incumbent / baseline", type: "text", placeholder: "e.g., Grid electricity, Diesel vehicles", required: true },
          { key: "emissionFactor", label: "Emission factor", type: "text", placeholder: "e.g., 0.4 kgCO₂e/kWh" },
          { key: "dataSource", label: "Data source", type: "text", placeholder: "e.g., IEA 2024, DEFRA emission factors" },
          { key: "notes", label: "Notes", type: "textarea", placeholder: "Assumptions, geographic scope..." },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_incumbentEmissions",
        completenessType: "list", completenessFields: ["incumbentName", "emissionFactor"],
        syncsToLabel: "Lean Canvas",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.COMPETITOR, dataKey: "_alternatives", fieldMap: { incumbentName: "segmentName" } },
        checklistItemId: 0,
      },
      {
        stableKey: "CIRL:3:3", layoutType: "single_object", title: "Net Unit Impact Concept", icon: "Zap",
        fieldDefinitions: [
          { key: "unitDefinition", label: "Unit of solution", type: "text", placeholder: "e.g., per kWh generated, per km driven, per tonne processed" },
          { key: "conceptualCalculation", label: "Conceptual calculation", type: "textarea", placeholder: "Baseline emissions per unit − Solution emissions per unit = Net unit impact" },
          { key: "expectedDirection", label: "Expected direction", type: "radio", options: ["Net positive (reduces emissions)", "Net negative (increases emissions)", "Uncertain"] },
          { key: "keyAssumptions", label: "Key assumptions", type: "textarea", placeholder: "List the main assumptions behind this concept..." },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_netUnitImpactConcept",
        completenessType: "object", completenessFields: ["unitDefinition", "conceptualCalculation", "expectedDirection"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },

      // CIRL Level 4 — Discovery
      {
        stableKey: "CIRL:4:1", layoutType: "repeatable_list", title: "Solution Effects Analysis", icon: "BarChart3",
        fieldDefinitions: [
          { key: "effectName", label: "Effect", type: "text", placeholder: "Effect name", required: true },
          { key: "quantifiedImpact", label: "Quantified impact per unit", type: "text", placeholder: "e.g., −0.3 kgCO₂e/kWh" },
          { key: "dataQuality", label: "Data quality", type: "radio", options: ["Measured", "Engineering estimate", "Literature proxy", "Assumption"] },
          { key: "methodology", label: "Methodology / source", type: "textarea", placeholder: "How was this quantified?" },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_solutionEffectsAnalysis",
        completenessType: "list", completenessFields: ["effectName", "quantifiedImpact", "dataQuality"],
        syncsToLabel: "Lean Canvas",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_solutionEffectsInventory", fieldMap: { effectName: "effectName" } },
        checklistItemId: 0,
      },
      {
        stableKey: "CIRL:4:2", layoutType: "repeatable_list", title: "Materiality Assessment", icon: "Scale",
        fieldDefinitions: [
          { key: "effectName", label: "Effect", type: "text", placeholder: "Effect name", required: true },
          { key: "magnitude", label: "Magnitude", type: "radio", options: ["Very High", "High", "Medium", "Low", "Negligible"] },
          { key: "certainty", label: "Certainty", type: "radio", options: ["High", "Medium", "Low"] },
          { key: "material", label: "Material?", type: "radio", options: ["Yes — include in NUI calculation", "No — document and exclude"] },
          { key: "justification", label: "Justification", type: "textarea", placeholder: "Why include or exclude this effect?" },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_materialityAssessment",
        completenessType: "list", completenessFields: ["effectName", "magnitude", "material"],
        syncsToLabel: "Lean Canvas",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_solutionEffectsInventory", fieldMap: { effectName: "effectName" } },
        checklistItemId: 0,
      },
      {
        stableKey: "CIRL:4:3", layoutType: "single_object", title: "Net Unit Impact Estimate", icon: "Calculator",
        fieldDefinitions: [
          { key: "unitDefinition", label: "Unit of solution", type: "text", placeholder: "e.g., per kWh, per trip, per tonne" },
          { key: "baselineEmissions", label: "Baseline emissions per unit", type: "text", placeholder: "e.g., 0.4 kgCO₂e" },
          { key: "solutionEmissions", label: "Solution emissions per unit", type: "text", placeholder: "e.g., 0.05 kgCO₂e" },
          { key: "netUnitImpact", label: "Net unit impact (auto-calculate placeholder)", type: "text", placeholder: "e.g., −0.35 kgCO₂e per kWh" },
          { key: "methodology", label: "Methodology notes", type: "textarea", placeholder: "Describe calculation approach and data sources..." },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_netUnitImpactEstimate",
        completenessType: "object", completenessFields: ["unitDefinition", "baselineEmissions", "solutionEmissions", "netUnitImpact"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },

      // CIRL Level 5 — Validation
      {
        stableKey: "CIRL:5:1", layoutType: "single_object", title: "Net Unit Impact Quantification", icon: "Target",
        fieldDefinitions: [
          { key: "unitDefinition", label: "Unit of solution", type: "text", placeholder: "e.g., per kWh generated" },
          { key: "quantifiedNUI", label: "Quantified net unit impact", type: "text", placeholder: "e.g., −0.35 kgCO₂e/kWh" },
          { key: "primaryDataUsed", label: "Primary data used", type: "textarea", placeholder: "Describe primary data sources (lab results, pilot measurements, LCA data)..." },
          { key: "validationMethod", label: "Validation method", type: "textarea", placeholder: "e.g., third-party LCA, peer review, ISO 14064 methodology" },
          { key: "uncertaintyRange", label: "Uncertainty range", type: "text", placeholder: "e.g., ±15% based on sensitivity analysis" },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_netUnitImpactQuantification",
        completenessType: "object", completenessFields: ["quantifiedNUI", "primaryDataUsed", "validationMethod"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },
      {
        stableKey: "CIRL:5:2", layoutType: "single_object", title: "Potential Impact Estimate", icon: "TrendingUp",
        fieldDefinitions: [
          { key: "netUnitImpact", label: "Net unit impact", type: "text", readOnly: true, placeholder: "⟵ FROM CIRL L5: NUI Quantification" },
          { key: "marketSizeUnits", label: "Addressable market (in units)", type: "text", placeholder: "e.g., 10M kWh/year addressable" },
          { key: "potentialAnnualImpact", label: "Potential annual impact (auto-calculate placeholder)", type: "text", placeholder: "e.g., −3,500 tCO₂e/year" },
          { key: "timeHorizon", label: "Time horizon", type: "text", placeholder: "e.g., by 2030 at full market penetration" },
          { key: "assumptions", label: "Key assumptions", type: "textarea", placeholder: "Market penetration rate, adoption curves, geographic scope..." },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_potentialImpactEstimate",
        completenessType: "object", completenessFields: ["marketSizeUnits", "potentialAnnualImpact", "timeHorizon"],
        syncsToLabel: "Lean Canvas",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_netUnitImpactQuantification", fieldMap: { netUnitImpact: "quantifiedNUI" } },
        checklistItemId: 0,
      },
      {
        stableKey: "CIRL:5:3", layoutType: "repeatable_list", title: "Impact Segmentation", icon: "PieChart",
        fieldDefinitions: [
          { key: "segment", label: "Customer segment / use-case", type: "text", placeholder: "e.g., Residential solar, Commercial fleet", required: true },
          { key: "unitsInSegment", label: "Addressable units", type: "text", placeholder: "e.g., 2M households" },
          { key: "nuiForSegment", label: "Net unit impact for segment", type: "text", placeholder: "e.g., −0.4 kgCO₂e/kWh" },
          { key: "segmentImpact", label: "Segment total impact", type: "text", placeholder: "e.g., −800 tCO₂e/year" },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_impactSegmentation",
        completenessType: "list", completenessFields: ["segment", "nuiForSegment"],
        syncsToLabel: "Lean Canvas",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_customerSegments", fieldMap: { segment: "customerSegment" } },
        checklistItemId: 0,
      },

      // CIRL Level 6 — Validation
      {
        stableKey: "CIRL:6:1", layoutType: "repeatable_list", title: "Net Unit Impact Projection", icon: "LineChart",
        fieldDefinitions: [
          { key: "year", label: "Year", type: "text", placeholder: "e.g., 2025, 2026...", required: true },
          { key: "projectedNUI", label: "Projected NUI", type: "text", placeholder: "e.g., −0.35 kgCO₂e/unit" },
          { key: "projectedUnits", label: "Projected units sold/deployed", type: "text", placeholder: "e.g., 50,000" },
          { key: "projectedTotalImpact", label: "Projected total impact", type: "text", placeholder: "e.g., −17,500 tCO₂e" },
          { key: "assumptions", label: "Key assumptions", type: "textarea", placeholder: "Adoption curve, market dynamics..." },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_nuiProjection",
        completenessType: "list", completenessFields: ["year", "projectedNUI", "projectedUnits"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },
      {
        stableKey: "CIRL:6:2", layoutType: "single_object", title: "Additionality Assessment", icon: "Plus",
        fieldDefinitions: [
          { key: "additionalityType", label: "Additionality type", type: "radio", options: ["Financial", "Technological", "Barrier removal", "Regulatory", "Multiple"] },
          { key: "wouldItHappenAnyway", label: "Would this impact occur without your solution?", type: "textarea", placeholder: "Explain why the baseline scenario would persist without your intervention..." },
          { key: "uniqueContribution", label: "What is your unique contribution?", type: "textarea", placeholder: "What specifically does your solution enable that alternatives do not?" },
          { key: "evidenceOfAdditionality", label: "Evidence of additionality", type: "textarea", placeholder: "Market data, policy analysis, or customer evidence supporting additionality..." },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_additionalityAssessment",
        completenessType: "object", completenessFields: ["additionalityType", "wouldItHappenAnyway", "uniqueContribution"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },
      {
        stableKey: "CIRL:6:3", layoutType: "single_object", title: "Impact Narrative for Investors", icon: "Presentation",
        fieldDefinitions: [
          { key: "impactStory", label: "Impact story (2-3 paragraphs)", type: "textarea", placeholder: "Tell the story of your climate impact: problem → solution → quantified impact → market opportunity..." },
          { key: "keyMetric", label: "Headline impact metric", type: "text", placeholder: "e.g., 1M tCO₂e avoided by 2030" },
          { key: "sdgAlignment", label: "SDG alignment", type: "text", placeholder: "e.g., SDG 7 (Affordable & Clean Energy), SDG 13 (Climate Action)" },
          { key: "comparableImpact", label: "Comparable impact", type: "text", placeholder: "e.g., equivalent to removing 200,000 cars from the road" },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_impactNarrative",
        completenessType: "object", completenessFields: ["impactStory", "keyMetric"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },

      // CIRL Level 7 — Testing
      {
        stableKey: "CIRL:7:1", layoutType: "single_object", title: "Planned Impact Model", icon: "FileSpreadsheet",
        fieldDefinitions: [
          { key: "modelDescription", label: "Model description", type: "textarea", placeholder: "Describe your impact model structure: inputs, calculations, outputs..." },
          { key: "engineeringData", label: "Engineering data inputs", type: "textarea", placeholder: "Lab results, performance data, efficiency metrics used..." },
          { key: "marketInputs", label: "Market projection inputs", type: "textarea", placeholder: "Addressable market, adoption rate, growth projections..." },
          { key: "adoptionAssumptions", label: "Adoption assumptions", type: "textarea", placeholder: "Customer acquisition rate, deployment timeline, geographic rollout..." },
          { key: "modelOutput", label: "Model output summary", type: "textarea", placeholder: "Projected cumulative impact over 5–10 years..." },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_plannedImpactModel",
        completenessType: "object", completenessFields: ["modelDescription", "engineeringData", "marketInputs", "modelOutput"],
        syncsToLabel: "Lean Canvas",
        prePopulateFrom: { toolTemplateId: TOOL_IDS.TAM, dataKey: "_marketSizeEvidence", fieldMap: { marketInputs: "segmentName" } },
        checklistItemId: 0,
      },
      {
        stableKey: "CIRL:7:2", layoutType: "repeatable_list", title: "Impact Validation Evidence", icon: "CheckCircle",
        fieldDefinitions: [
          { key: "evidenceType", label: "Evidence type", type: "radio", options: ["Pilot data", "Customer measurement", "Third-party review", "Academic validation", "Certification"], required: true },
          { key: "description", label: "Description", type: "textarea", placeholder: "What was measured or validated?" },
          { key: "result", label: "Result", type: "text", placeholder: "e.g., 32% emission reduction confirmed" },
          { key: "source", label: "Source / reviewer", type: "text", placeholder: "e.g., DNV, University of X, Customer Y" },
          { key: "date", label: "Date", type: "text", placeholder: "e.g., 2025 Q2" },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_impactValidationEvidence",
        completenessType: "list", completenessFields: ["evidenceType", "description", "result"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },
      {
        stableKey: "CIRL:7:3", layoutType: "repeatable_list", title: "Adjustment Factors & Risks", icon: "AlertTriangle",
        fieldDefinitions: [
          { key: "factor", label: "Adjustment factor / risk", type: "text", placeholder: "e.g., Rebound effect, Grid decarbonisation, Usage patterns", required: true },
          { key: "direction", label: "Direction of impact", type: "radio", options: ["Reduces claimed impact", "Increases claimed impact", "Uncertain"] },
          { key: "magnitude", label: "Estimated magnitude", type: "radio", options: ["High (>20%)", "Medium (5-20%)", "Low (<5%)"] },
          { key: "mitigationPlan", label: "Mitigation / response", type: "textarea", placeholder: "How will you account for or mitigate this factor?" },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_adjustmentFactors",
        completenessType: "list", completenessFields: ["factor", "direction", "magnitude"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },

      // CIRL Level 8 — Testing
      {
        stableKey: "CIRL:8:1", layoutType: "single_object", title: "Impact Assessment Summary", icon: "FileText",
        fieldDefinitions: [
          { key: "executiveSummary", label: "Executive summary", type: "textarea", placeholder: "One-paragraph summary of your climate impact assessment..." },
          { key: "methodology", label: "Methodology", type: "textarea", placeholder: "Describe the methodology used (GHG Protocol, consequential LCA, etc.)..." },
          { key: "keyFindings", label: "Key findings", type: "textarea", placeholder: "Headline findings: net unit impact, potential total impact, additionality..." },
          { key: "limitations", label: "Limitations and caveats", type: "textarea", placeholder: "Data gaps, boundary assumptions, uncertainty ranges..." },
          { key: "peerReviewStatus", label: "Peer review / audit status", type: "text", placeholder: "e.g., Reviewed by X, audited by Y, pending..." },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_impactAssessmentSummary",
        completenessType: "object", completenessFields: ["executiveSummary", "methodology", "keyFindings"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },
      {
        stableKey: "CIRL:8:2", layoutType: "repeatable_list", title: "Impact Metrics & KPI Selection", icon: "Gauge",
        fieldDefinitions: [
          { key: "metricName", label: "Metric / KPI", type: "text", placeholder: "e.g., tCO₂e avoided per year", required: true },
          { key: "framework", label: "Framework alignment", type: "text", placeholder: "e.g., GHG Protocol, IRIS+ PI2764, SDG 13.2" },
          { key: "currentValue", label: "Current value", type: "text", placeholder: "e.g., 500 tCO₂e/year" },
          { key: "targetValue", label: "Target value (12 months)", type: "text", placeholder: "e.g., 2,000 tCO₂e/year" },
          { key: "measurementMethod", label: "Measurement method", type: "text", placeholder: "e.g., metered data, customer reports, modelled" },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_impactMetricsKPI",
        completenessType: "list", completenessFields: ["metricName", "framework", "currentValue"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },
      {
        stableKey: "CIRL:8:3", layoutType: "single_object", title: "Impact Data Collection Plan", icon: "Database",
        fieldDefinitions: [
          { key: "dataSources", label: "Data sources", type: "textarea", placeholder: "List all data sources: metered data, surveys, third-party databases..." },
          { key: "collectionFrequency", label: "Collection frequency", type: "text", placeholder: "e.g., real-time metering, monthly surveys, quarterly reports" },
          { key: "responsibility", label: "Responsibility", type: "text", placeholder: "Who owns data collection? e.g., Impact Manager, automated system" },
          { key: "qualityAssurance", label: "Quality assurance", type: "textarea", placeholder: "How do you ensure data quality? Validation checks, audits..." },
          { key: "toolsAndSystems", label: "Tools and systems", type: "text", placeholder: "e.g., custom dashboard, Metabase, Salesforce Impact module" },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_impactDataCollectionPlan",
        completenessType: "object", completenessFields: ["dataSources", "collectionFrequency", "responsibility"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },

      // CIRL Level 9 — Scaling
      {
        stableKey: "CIRL:9:1", layoutType: "single_object", title: "Realised Impact Dashboard", icon: "LayoutDashboard",
        fieldDefinitions: [
          { key: "headlineMetric", label: "Headline impact metric", type: "text", placeholder: "e.g., 12,500 tCO₂e avoided to date" },
          { key: "vsProjection", label: "Performance vs projection", type: "textarea", placeholder: "How does actual impact compare to your model projections?" },
          { key: "trendDescription", label: "Trend description", type: "textarea", placeholder: "Is impact accelerating, steady, or declining? Why?" },
          { key: "dashboardLink", label: "Dashboard link", type: "text", placeholder: "URL to your impact dashboard (if available)" },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_realisedImpactDashboard",
        completenessType: "object", completenessFields: ["headlineMetric", "vsProjection", "trendDescription"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },
      {
        stableKey: "CIRL:9:2", layoutType: "single_object", title: "Impact Reporting System", icon: "FileBarChart",
        fieldDefinitions: [
          { key: "reportingFramework", label: "Reporting framework", type: "text", placeholder: "e.g., GHG Protocol, TCFD, CDP, IRIS+" },
          { key: "reportFrequency", label: "Report frequency", type: "text", placeholder: "e.g., quarterly investor report, annual impact report" },
          { key: "audience", label: "Primary audience", type: "text", placeholder: "e.g., investors, customers, regulators, board" },
          { key: "reportContents", label: "Report contents", type: "textarea", placeholder: "What does your impact report include? Metrics, methodology, narrative..." },
          { key: "lastReportDate", label: "Last report date", type: "text", placeholder: "e.g., 2025 Q4" },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_impactReportingSystem",
        completenessType: "object", completenessFields: ["reportingFramework", "reportFrequency", "reportContents"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },
      {
        stableKey: "CIRL:9:3", layoutType: "single_object", title: "Verification & Continuous Improvement", icon: "ShieldCheck",
        fieldDefinitions: [
          { key: "verificationBody", label: "Verification body", type: "text", placeholder: "e.g., DNV, Bureau Veritas, independent academic review" },
          { key: "verificationScope", label: "Verification scope", type: "textarea", placeholder: "What was verified? Methodology, data, claims..." },
          { key: "verificationResult", label: "Verification result", type: "textarea", placeholder: "Summary of findings and any adjustments required..." },
          { key: "improvementProcess", label: "Continuous improvement process", type: "textarea", placeholder: "How do you continuously improve your impact methodology and data quality?" },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_verificationContinuousImprovement",
        completenessType: "object", completenessFields: ["verificationBody", "verificationScope", "improvementProcess"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },
      {
        stableKey: "CIRL:9:4", layoutType: "repeatable_list", title: "Impact Model Recalibration Log", icon: "RefreshCw",
        fieldDefinitions: [
          { key: "date", label: "Date", type: "text", placeholder: "e.g., 2025 Q3", required: true },
          { key: "parameterChanged", label: "Parameter changed", type: "text", placeholder: "e.g., baseline emission factor, adoption rate" },
          { key: "oldValue", label: "Old value", type: "text", placeholder: "Previous assumption" },
          { key: "newValue", label: "New value", type: "text", placeholder: "Updated value" },
          { key: "reason", label: "Reason for change", type: "textarea", placeholder: "New data, methodology update, market change..." },
          { key: "impactOnResults", label: "Impact on results", type: "text", placeholder: "e.g., NUI changed from −0.35 to −0.32 kgCO₂e" },
        ],
        toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_impactModelRecalibration",
        completenessType: "list", completenessFields: ["date", "parameterChanged", "reason"],
        syncsToLabel: "Lean Canvas",
        checklistItemId: 0,
      },
    ];

    const itemIdToKey = new Map<number, string>();
    for (const [key, id] of itemMap.entries()) {
      itemIdToKey.set(id, key);
    }

    let newConfigsInserted = 0;
    for (const config of configs) {
      let checklistItemId = itemMap.get(config.stableKey);
      if (!checklistItemId) {
        const parts = config.stableKey.split(":");
        const dimLvlKey = `${parts[0]}:${parts[1]}`;
        const itemIndex = parseInt(parts[2], 10) - 1;
        const items = itemsByDimLevel.get(dimLvlKey);
        if (items && itemIndex >= 0 && itemIndex < items.length) {
          checklistItemId = items[itemIndex].id;
        }
      }
      if (checklistItemId) {
        // Always align stable_key with the canonical key for the resolved
        // checklist item so the ON CONFLICT (stable_key) upsert matches the
        // existing normalised row (and never collides on checklist_item_id).
        const canonical = itemIdToKey.get(checklistItemId);
        if (canonical) config.stableKey = canonical;
        config.checklistItemId = checklistItemId;
        // Upsert by stable_key: insert if new, update content fields if a row
        // with this stable_key already exists. checklist_item_id is excluded
        // from the SET clause because stable_key is now canonical and stable.
        const inserted = await db
          .insert(inlineToolConfigs)
          .values(config)
          .onConflictDoUpdate({
            target: inlineToolConfigs.stableKey,
            set: {
              layoutType: config.layoutType,
              title: config.title,
              icon: config.icon,
              fieldDefinitions: config.fieldDefinitions,
              templateSentence: config.templateSentence ?? null,
              isKeyAssumption: config.isKeyAssumption ?? false,
              defaultRows: config.defaultRows ?? null,
              toolTemplateId: config.toolTemplateId,
              dataKey: config.dataKey,
              completenessType: config.completenessType,
              completenessFields: config.completenessFields ?? null,
              minimumSubmissions: config.minimumSubmissions ?? null,
              runningTotals: config.runningTotals ?? null,
              syncsToToolTemplateId: config.syncsToToolTemplateId ?? null,
              syncsToLabel: config.syncsToLabel ?? null,
              prePopulateFrom: config.prePopulateFrom ?? null,
              toolLevelFields: config.toolLevelFields ?? null,
              dataSyncRules: config.dataSyncRules ?? null,
              requiresPreviousComplete: config.requiresPreviousComplete ?? false,
              revisionOf: config.revisionOf ?? null,
              revisionMode: config.revisionMode ?? null,
              extensionFields: config.extensionFields ?? null,
            },
          })
          .returning({ id: inlineToolConfigs.id });
        if (inserted.length > 0 && !existingKeys.has(config.stableKey)) {
          existingKeys.add(config.stableKey);
          newConfigsInserted++;
        }
      }
    }

    // === Safety guard: warn if duplicate configs ever re-appear ===
    const guard = await db.execute(sql`
      SELECT COUNT(*)::int AS total,
             COUNT(DISTINCT stable_key)::int AS distinct_keys,
             COUNT(DISTINCT checklist_item_id)::int AS distinct_items
      FROM inline_tool_configs
    `);
    const g = guard.rows[0] as any;
    if (Number(g.total) !== Number(g.distinct_items)) {
      console.warn(`[inline_tool_configs] ⚠ Duplicate detected: ${g.total} rows but ${g.distinct_items} distinct checklist_item_ids`);
    }
    if (Number(g.total) !== Number(g.distinct_keys)) {
      console.warn(`[inline_tool_configs] ⚠ Stable-key conflict: ${g.total} rows but ${g.distinct_keys} distinct stable_keys`);
    }

    const allCurrentConfigs = await db.select().from(inlineToolConfigs);
    for (const cfg of allCurrentConfigs) {
      if (!cfg.checklistItemId) continue;
      const correctKey = itemIdToKey.get(cfg.checklistItemId);
      if (correctKey && correctKey !== cfg.stableKey) {
        await db.update(inlineToolConfigs).set({ stableKey: correctKey }).where(eq(inlineToolConfigs.id, cfg.id));
      }
    }

    for (const cfg of allCurrentConfigs) {
      if (cfg.stableKey === "CRL:1:1") {
        const fields = (cfg.completenessFields as string[]) || [];
        if (!fields.includes("impacts")) {
          await db.update(inlineToolConfigs)
            .set({ completenessFields: [...fields, "impacts"] })
            .where(eq(inlineToolConfigs.id, cfg.id));
        }
      }
      if (cfg.stableKey === "CRL:4:2" && (cfg.layoutType !== "value_chain" || cfg.completenessType !== "value_chain")) {
        await db.update(inlineToolConfigs)
          .set({
            layoutType: "value_chain",
            completenessType: "value_chain",
            completenessFields: [],
            dataSyncRules: [{ sourceField: "steps", targetField: "_channels", targetToolTemplateId: TOOL_IDS.LEAN_CANVAS, syncMode: "value_chain_partners" }],
          })
          .where(eq(inlineToolConfigs.id, cfg.id));
      }
    }

    const fiveBeatFields = [
      { key: "segments", label: "Customer segments this pitch covers", type: "checkbox_group", options: [] as string[], optionsFromTool: { toolTemplateId: TOOL_IDS.LEAN_CANVAS, dataKey: "_customerSegments", field: "customerSegment" } },
      { key: "theShift", label: "The Shift", type: "textarea", placeholder: "What undeniable change makes your solution necessary now?" },
      { key: "theStakes", label: "The Stakes", type: "textarea", placeholder: "What happens to companies that don't adapt?" },
      { key: "thePromisedLand", label: "The Promised Land", type: "textarea", placeholder: "What does the winning future look like for your buyer?" },
      { key: "yourMagic", label: "Your Magic", type: "textarea", placeholder: "How does your solution get them there? Include one proof point." },
      { key: "theAsk", label: "The Ask", type: "text", placeholder: "What specific next step do you want them to take?" },
    ];
    const fiveBeatCompleteness = ["segments", "theShift", "theStakes", "thePromisedLand", "yourMagic", "theAsk"];
    const fiveBeatExData: Record<string, unknown> = {
      "Octopus Energy": [{ segments: ["UK homeowners"], theShift: "Energy markets are deregulating and consumers now demand transparency and green sourcing — switching providers takes minutes, not months.", theStakes: "Suppliers that cling to opaque pricing and fossil fuels will haemorrhage customers to transparent, renewable alternatives.", thePromisedLand: "A world where every household runs on 100% green energy with full visibility into costs and usage, managed from a single app.", yourMagic: "Octopus's smart tariff engine uses half-hourly pricing to cut bills by up to 20% while sourcing only renewable energy — already powering 3 million UK homes.", theAsk: "Switch in 2 minutes at octopus.energy and see your first green bill." }],
      "Northvolt": [{ segments: ["European automakers"], theShift: "EU battery regulations now mandate carbon-footprint disclosure and local sourcing, reshaping the EV supply chain.", theStakes: "Automakers reliant on Asian imports face tariff risk, ESG non-compliance and single-point supply failure.", thePromisedLand: "A fully European, traceable battery supply chain that meets the toughest sustainability standards and secures OEM production lines.", yourMagic: "Northvolt's gigafactory produces cells with 70% lower CO₂ than the industry average — validated by BMW and Volvo production contracts.", theAsk: "Partner with us for your next EV programme — request a pilot cell batch today." }],
      "Wayve": [{ segments: ["Automotive OEMs"], theShift: "Cities are tightening AV permits while ride-hail fleets demand scalable autonomy — hand-coded driving stacks can't keep up.", theStakes: "Companies locked into HD-map-dependent systems will spend billions re-mapping every new city and still fail edge cases.", thePromisedLand: "Autonomous vehicles that learn to drive anywhere, generalising from data instead of maps — scaling to new cities in weeks, not years.", yourMagic: "Wayve's end-to-end deep learning model achieved 120 miles per human intervention in London with zero HD-map dependency — backed by a $1B raise from SoftBank and Microsoft.", theAsk: "Book a demo ride in London and see generalised autonomy in action." }],
    };

    for (const cfg of allCurrentConfigs) {
      if (cfg.stableKey === "CRL:5:2") {
        const fieldKeys = ((cfg.fieldDefinitions as { key: string }[]) || []).map(f => f.key);
        const needsMigration = cfg.layoutType !== "repeatable_list"
          || cfg.title !== "Sales Pitch 5-Beat Workbook"
          || !fieldKeys.includes("theShift")
          || !fieldKeys.includes("segments");

        if (needsMigration) {
          await db.update(inlineToolConfigs)
            .set({
              layoutType: "repeatable_list",
              title: "Sales Pitch 5-Beat Workbook",
              fieldDefinitions: fiveBeatFields,
              completenessType: "list",
              completenessFields: fiveBeatCompleteness,
            })
            .where(eq(inlineToolConfigs.id, cfg.id));
        }

        const toolTemplateId = cfg.toolTemplateId;
        const affectedEntries = await db.select().from(toolEntries).where(eq(toolEntries.toolTemplateId, toolTemplateId));
        for (const te of affectedEntries) {
          const data = te.currentData as Record<string, unknown>;
          const pitchData = data?._salesPitchDraft;
          if (pitchData && !Array.isArray(pitchData) && typeof pitchData === "object") {
            const old = pitchData as Record<string, string>;
            const migrated = [{
              segments: [] as string[],
              theShift: "",
              theStakes: "",
              thePromisedLand: old.headline || "",
              yourMagic: `${old.problem || ""}\n\n${old.solution || ""}`.trim(),
              theAsk: old.callToAction || "",
            }];
            await db.update(toolEntries)
              .set({ currentData: { ...data, _salesPitchDraft: migrated } })
              .where(eq(toolEntries.id, te.id));
          }
        }

        const existingEx = await db.select().from(toolExampleData).where(eq(toolExampleData.inlineToolConfigId, cfg.id));
        const companies = await db.select().from(exampleCompanies);
        const companyMap = new Map(companies.map(c => [c.id, c.name]));
        for (const ex of existingEx) {
          const companyName = companyMap.get(ex.exampleCompanyId);
          if (companyName && fiveBeatExData[companyName]) {
            const exData = ex.exampleData as Record<string, unknown>[] | Record<string, unknown>;
            const isOldFormat = !Array.isArray(exData) || (exData.length > 0 && !("theShift" in exData[0]));
            if (isOldFormat) {
              await db.update(toolExampleData)
                .set({ exampleData: fiveBeatExData[companyName] })
                .where(eq(toolExampleData.id, ex.id));
            }
          }
        }
        break;
      }
    }

    // CRL:6:4 — Route to Market: migrate existing example rows and tool entries
    // from free-text `channels` to ranked array of Bullseye channels.
    const routeToMarketExData: Record<string, string[]> = {
      "Octopus Energy": ["Affiliate Programmes", "Content Marketing", "Viral Marketing", "Search Engine Optimisation (SEO)", "Partnerships"],
      "Northvolt": ["Sales", "Partnerships", "Business Development", "Trade Shows"],
      "Wayve": ["Partnerships", "Business Development", "Speaking Engagements", "Publicity"],
    };
    for (const cfg of allCurrentConfigs) {
      if (cfg.stableKey === "CRL:6:4") {
        const existingEx = await db.select().from(toolExampleData).where(eq(toolExampleData.inlineToolConfigId, cfg.id));
        const companies = await db.select().from(exampleCompanies);
        const companyMap = new Map(companies.map(c => [c.id, c.name]));
        for (const ex of existingEx) {
          const exData = ex.exampleData as Record<string, unknown>;
          if (!exData || typeof exData !== "object" || Array.isArray(exData)) continue;
          if (typeof exData.channels === "string") {
            const companyName = companyMap.get(ex.exampleCompanyId);
            const ranked = (companyName && routeToMarketExData[companyName]) || [];
            await db.update(toolExampleData)
              .set({ exampleData: { ...exData, channels: ranked } })
              .where(eq(toolExampleData.id, ex.id));
          }
        }

        const affectedEntries = await db.select().from(toolEntries).where(eq(toolEntries.toolTemplateId, cfg.toolTemplateId));
        for (const te of affectedEntries) {
          const data = te.currentData as Record<string, unknown> | null;
          if (!data) continue;
          const rtm = data._routeToMarket;
          if (!rtm || typeof rtm !== "object" || Array.isArray(rtm)) continue;
          const rtmObj = rtm as Record<string, unknown>;
          if (typeof rtmObj.channels === "string" && rtmObj.channels.trim()) {
            await db.update(toolEntries)
              .set({
                currentData: {
                  ...data,
                  _routeToMarket: {
                    ...rtmObj,
                    channels: [],
                    channels_legacy: rtmObj.channels,
                  },
                },
              })
              .where(eq(toolEntries.id, te.id));
          }
        }
        break;
      }
    }

    const existingExDataCheck = await db.select().from(toolExampleData);
    const configsWithExamples = new Set(existingExDataCheck.map(d => d.inlineToolConfigId));
    const allConfigsHaveExamples = existing.every(c => configsWithExamples.has(c.id));
    if (newConfigsInserted === 0 && existing.length > 0 && allConfigsHaveExamples) return;

    const existingCompanies = await db.select().from(exampleCompanies);
    if (existingCompanies.length === 0) {
      await db.insert(exampleCompanies).values([
        { name: "Octopus Energy", tagline: "UK renewable energy supplier (B2C)", displayColor: "#e11d48", displayOrder: 0, websiteUrl: "octopusenergy.com" },
        { name: "Northvolt", tagline: "European EV battery manufacturer (B2B)", displayColor: "#2563eb", displayOrder: 1, websiteUrl: "northvolt.com" },
        { name: "Wayve", tagline: "AI autonomous driving software (B2B/platform)", displayColor: "#7c3aed", displayOrder: 2, websiteUrl: "wayve.ai" },
      ]);
    }

    const seededCompanies = await db.select().from(exampleCompanies);
    const octopus = seededCompanies.find(c => c.name === "Octopus Energy");
    const northvolt = seededCompanies.find(c => c.name === "Northvolt");
    const wayve = seededCompanies.find(c => c.name === "Wayve");

    if (!octopus || !northvolt || !wayve) return;

    const existingExData = await db.select().from(toolExampleData);
    const existingExConfigIds = new Set(existingExData.map(d => d.inlineToolConfigId));

    const seededConfigs = await db.select().from(inlineToolConfigs);
    const configByKey = new Map(seededConfigs.map(c => [c.stableKey, c]));

    const exampleDataSeed: Record<string, { octopus: unknown; northvolt: unknown; wayve: unknown }> = {
      "CRL:1:1": {
        octopus: [{ customerSegment: "UK homeowners", problem: "expensive, inflexible energy tariffs" }],
        northvolt: [{ customerSegment: "European automakers", problem: "lack of local, sustainable EV battery supply" }],
        wayve: [{ customerSegment: "Automotive OEMs", problem: "costly, unscalable rule-based self-driving systems" }],
      },
      "CRL:2:1": {
        octopus: [{ segmentName: "UK Homeowners", calculatedTAM: "56000000000", sources: [{ label: "Ofgem 2023", url: "https://www.ofgem.gov.uk/publications" }] }],
        northvolt: [{ segmentName: "European OEMs", calculatedTAM: "46000000000", sources: [{ label: "BloombergNEF", url: "https://about.bnef.com/" }] }],
        wayve: [{ segmentName: "Fleet Operators", calculatedTAM: "300000000000", sources: [{ label: "McKinsey Mobility 2024", url: "https://www.mckinsey.com/industries/automotive-and-assembly" }] }],
      },
      "CRL:2:2": {
        octopus: [{ segmentName: "UK Homeowners", kprs: ["Price", "Green energy", "Smart tariffs", "Customer service"], competitors: [{ id: "ex1", name: "British Gas", ratings: [{ kpr: "Price", rating: "neutral" }, { kpr: "Green energy", rating: "weakness" }, { kpr: "Smart tariffs", rating: "weakness" }, { kpr: "Customer service", rating: "weakness" }] }] }],
        northvolt: [{ segmentName: "European OEMs", kprs: ["Local supply", "Sustainability", "Cost parity", "Scale"], competitors: [{ id: "ex1", name: "CATL", ratings: [{ kpr: "Local supply", rating: "weakness" }, { kpr: "Sustainability", rating: "weakness" }, { kpr: "Cost parity", rating: "strength" }, { kpr: "Scale", rating: "strength" }] }] }],
        wayve: [{ segmentName: "Fleet Operators", kprs: ["Scalability", "Cost", "Generalisation", "Safety"], competitors: [{ id: "ex1", name: "Waymo", ratings: [{ kpr: "Scalability", rating: "weakness" }, { kpr: "Cost", rating: "weakness" }, { kpr: "Generalisation", rating: "weakness" }, { kpr: "Safety", rating: "strength" }] }] }],
      },
      "CRL:3:1": {
        octopus: [{ who: "Sarah M.", role: "Customer", keyQuote: "I switched because I wanted 100% green energy at a fair price", insight: "Green credentials are a primary purchase driver" }],
        northvolt: [{ who: "VW Procurement Lead", role: "Customer", keyQuote: "We need European battery supply for resilience", insight: "Supply chain sovereignty is a key buying factor" }],
        wayve: [{ who: "Fleet Manager, Ocado", role: "Customer", keyQuote: "We need AI that generalises across delivery routes", insight: "Generalisation across routes beats per-route mapping" }],
      },
      "CRL:4:1": {
        octopus: { interviewCount: "200+", confidence: "High", keyThemes: "Price transparency, green energy, smart tariffs", topQuotes: "Agile Octopus is a game-changer for my bills" },
        northvolt: { interviewCount: "45", confidence: "High", keyThemes: "Local supply, sustainability traceability, cost parity", topQuotes: "Having a European supplier is strategic for us" },
        wayve: { interviewCount: "30", confidence: "Medium", keyThemes: "Scalability, cost of HD maps, generalisation", topQuotes: "If your AI can drive anywhere without mapping, that changes everything" },
      },
      "CRL:5:1": {
        octopus: [{ customerSegment: "UK homeowners", customerName: "Early Adopter Group", type: "Sign-up", date: "2016", detail: "First 1,000 customers signed up within 3 months of launch" }],
        northvolt: [{ customerSegment: "European automakers", customerName: "Volkswagen Procurement", type: "LOI", date: "2017", detail: "Volkswagen signed initial €1B supply agreement" }],
        wayve: [{ customerSegment: "Automotive OEMs", customerName: "Asda Logistics", type: "Pilot", date: "2021", detail: "Asda selected Wayve for autonomous grocery delivery pilot" }],
      },
      "CRL:5:2": {
        octopus: [{ segments: ["UK homeowners"], theShift: "Energy markets are deregulating and consumers now demand transparency and green sourcing — switching providers takes minutes, not months.", theStakes: "Suppliers that cling to opaque pricing and fossil fuels will haemorrhage customers to transparent, renewable alternatives.", thePromisedLand: "A world where every household runs on 100% green energy with full visibility into costs and usage, managed from a single app.", yourMagic: "Octopus's smart tariff engine uses half-hourly pricing to cut bills by up to 20% while sourcing only renewable energy — already powering 3 million UK homes.", theAsk: "Switch in 2 minutes at octopus.energy and see your first green bill." }],
        northvolt: [{ segments: ["European automakers"], theShift: "EU battery regulations now mandate carbon-footprint disclosure and local sourcing, reshaping the EV supply chain.", theStakes: "Automakers reliant on Asian imports face tariff risk, ESG non-compliance and single-point supply failure.", thePromisedLand: "A fully European, traceable battery supply chain that meets the toughest sustainability standards and secures OEM production lines.", yourMagic: "Northvolt's gigafactory produces cells with 70% lower CO₂ than the industry average — validated by BMW and Volvo production contracts.", theAsk: "Partner with us for your next EV programme — request a pilot cell batch today." }],
        wayve: [{ segments: ["Automotive OEMs"], theShift: "Cities are tightening AV permits while ride-hail fleets demand scalable autonomy — hand-coded driving stacks can't keep up.", theStakes: "Companies locked into HD-map-dependent systems will spend billions re-mapping every new city and still fail edge cases.", thePromisedLand: "Autonomous vehicles that learn to drive anywhere, generalising from data instead of maps — scaling to new cities in weeks, not years.", yourMagic: "Wayve's end-to-end deep learning model achieved 120 miles per human intervention in London with zero HD-map dependency — backed by a $1B raise from SoftBank and Microsoft.", theAsk: "Book a demo ride in London and see generalised autonomy in action." }],
      },
      "CRL:6:1": {
        octopus: [{ testType: "A/B test", metric: "Conversion rate", finding: "Green messaging +22% vs price-only messaging", nextAction: "Lead with sustainability on landing page" }],
        northvolt: [{ testType: "Pilot production", metric: "Cell yield rate", finding: "94% yield achieved in first production run", nextAction: "Scale to full gigafactory line" }],
        wayve: [{ testType: "Urban driving test", metric: "Miles per intervention", finding: "120 miles per human intervention in London", nextAction: "Expand training data for roundabouts" }],
      },
      "CRL:7:1": {
        octopus: [{ company: "Thames Water (pilot)", type: "Paid", status: "Active", feedback: "Great API integration for smart meter data" }],
        northvolt: [{ company: "BMW", type: "Supply agreement", status: "Active", feedback: "Cells meeting performance specs" }],
        wayve: [{ company: "Asda/Ocado", type: "Pilot", status: "Active", feedback: "Deliveries completing with good customer satisfaction" }],
      },
      "CRL:1:2": {
        octopus: [{ segmentName: "UK Homeowners", avgSpendPerYear: "2000", customerCount: "28000000" }],
        northvolt: [{ segmentName: "European OEMs", avgSpendPerYear: "80000000", customerCount: "15" }],
        wayve: [{ segmentName: "Fleet Operators", avgSpendPerYear: "500000", customerCount: "200" }],
      },
      "CRL:2:3": {
        octopus: [{ segment: "UK Homeowners", problem: "Expensive, inflexible energy tariffs", frequency: "Monthly", cost: "2000", severity: "7" }],
        northvolt: [{ segment: "European OEMs", problem: "Lack of local, sustainable EV battery supply", frequency: "Yearly", cost: "200000000", severity: "9" }],
        wayve: [{ segment: "Fleet Operators", problem: "Costly, unscalable rule-based self-driving systems", frequency: "Daily", cost: "50000", severity: "8" }],
      },
      "CRL:3:2": {
        octopus: [{ name: "British Gas (Centrica)", type: "Incumbent", marketShare: "20%", trend: "Declining" }],
        northvolt: [{ name: "CATL", type: "Incumbent", marketShare: "37%", trend: "Growing" }],
        wayve: [{ name: "Waymo (Alphabet)", type: "Incumbent", marketShare: "65% of AV miles", trend: "Growing" }],
      },
      "CRL:3:3": {
        octopus: [{ segment: "European energy retail", size: "€300B", source: "EU Energy Agency 2023", growth: "3%" }],
        northvolt: [{ segment: "European EV battery", size: "$46B", source: "BloombergNEF 2024", growth: "25%" }],
        wayve: [{ segment: "Global AV software", size: "$300B", source: "McKinsey 2024", growth: "40%" }],
      },
      "CRL:3:4": {
        octopus: [{ name: "UK Homeowners", demographics: "25-65, all income levels", behaviors: "Compare energy bills online", needs: "Lower bills, green energy, simplicity" }],
        northvolt: [{ name: "European OEMs", demographics: "Large manufacturers", behaviors: "Long procurement cycles", needs: "Reliable local supply, ESG compliance" }],
        wayve: [{ name: "Delivery Companies", demographics: "Large fleet operators", behaviors: "Cost-optimise last mile", needs: "Reduce driver costs, scale delivery capacity" }],
      },
      "CRL:3:5": {
        octopus: { original: "People want cheaper energy", keyChange: "Green credentials matter as much as price", evidence: "200+ customer interviews", revised: "UK homeowners want affordable, transparent, 100% green energy with smart tariff flexibility" },
        northvolt: { original: "OEMs want cheaper batteries", keyChange: "Supply chain sovereignty and ESG now trump pure cost", evidence: "45 OEM procurement interviews", revised: "European automakers need locally manufactured, traceable, low-carbon batteries at cost parity" },
        wayve: { original: "Fleets want autonomous vehicles", keyChange: "Generalisation across routes matters more than perfect single-route performance", evidence: "30 fleet manager interviews", revised: "Fleet operators need AI driving software that works on any road without per-city mapping investment" },
      },
      "CRL:4:2": {
        octopus: {
          steps: [
            { id: "s1", label: "Renewable generators", roleType: "Supply", tag: "partner" },
            { id: "s2", label: "National Grid", roleType: "Transmission", tag: "" },
            { id: "s3", label: "Octopus Energy", roleType: "Retailer + Tech", tag: "you" },
            { id: "s4", label: "UK Households", roleType: "End customer", tag: "buyer" },
          ],
          answers: { q1buyer: "UK Households", q1why: "They pay the energy bill — we save them money with smart green tariffs", q2: "Households buy from Big 6 incumbents with opaque pricing and fossil-heavy mix", q3: "We offer 100% green energy, real-time pricing via Kraken, and lower bills through smart shifting", q4blocker: "National Grid", q4why: "Grid constraints and regulatory approvals can delay smart tariff rollouts", q5evidence: "Proven (revenue)" },
          evidenceLevel: 5,
        },
        northvolt: {
          steps: [
            { id: "s1", label: "Lithium/nickel miners", roleType: "Raw materials", tag: "partner" },
            { id: "s2", label: "Northvolt", roleType: "Cell manufacturer", tag: "you" },
            { id: "s3", label: "European OEMs", roleType: "Vehicle assembly", tag: "buyer" },
            { id: "s4", label: "EV drivers", roleType: "End user", tag: "" },
          ],
          answers: { q1buyer: "European OEMs", q1why: "VW, BMW etc. need local, traceable, low-carbon battery cells to meet ESG targets", q2: "OEMs import cells from Asian suppliers with long lead times and limited ESG traceability", q3: "Local European supply cuts lead time, improves traceability, reduces scope 3 emissions", q4blocker: "European OEMs", q4why: "Switching costs are high — qualification takes 18+ months per cell chemistry", q5evidence: "Demonstrated intent (LOI)" },
          evidenceLevel: 4,
        },
        wayve: {
          steps: [
            { id: "s1", label: "Sensor/compute HW", roleType: "Hardware supply", tag: "partner" },
            { id: "s2", label: "Wayve", roleType: "AI driving software", tag: "you" },
            { id: "s3", label: "Fleet operators", roleType: "Deployment", tag: "buyer" },
            { id: "s4", label: "Delivery recipients", roleType: "End user", tag: "" },
          ],
          answers: { q1buyer: "Fleet operators", q1why: "They pay per-vehicle licence — our AI reduces driver cost and scales capacity", q2: "Fleets use human drivers with high turnover and fixed per-mile costs", q3: "Software replaces per-driver cost with per-vehicle licence, enabling 24/7 operation", q4blocker: "Fleet operators", q4why: "Safety concerns and regulatory approval timelines could delay fleet-wide adoption", q5evidence: "Direct conversation" },
          evidenceLevel: 3,
        },
      },
      "CRL:4:3": {
        octopus: [{ name: "UK Homeowners", demographics: "All ages, all income levels", behaviors: "Price comparison sites, switching", needs: "Savings, green energy, control" }],
        northvolt: [{ name: "European OEMs", demographics: "VW, BMW, Volvo etc.", behaviors: "Long-term contracts, due diligence", needs: "Volume, quality, sustainability proof" }],
        wayve: [{ name: "Fleet Operators", demographics: "Delivery/logistics companies", behaviors: "ROI-driven tech adoption", needs: "Lower costs, safety, scalability" }],
      },
      "CRL:4:4": {
        octopus: [{ segment: "UK households", user: "Bill payer", payer: "Bill payer", decisionMaker: "Bill payer" }],
        northvolt: [{ segment: "Automotive OEMs", user: "EV driver (indirect)", payer: "OEM procurement", decisionMaker: "VP Supply Chain" }],
        wayve: [{ segment: "Delivery fleets", user: "Fleet dispatcher", payer: "Fleet CFO", decisionMaker: "CTO / COO" }],
      },
      "CRL:4:5": {
        octopus: { target: "UK homeowners switching energy supplier", category: "Smart green energy retailer", differentiator: "Tech-powered dynamic tariffs (Agile Octopus) with 100% renewable sourcing", reasonToBelieve: "3M+ customers, Kraken platform licensed to 50M accounts globally" },
        northvolt: { target: "European automotive OEMs", category: "European battery cell manufacturer", differentiator: "Lowest carbon footprint in industry with fully European supply chain", reasonToBelieve: "$55B order backlog from VW, BMW, Volvo, Scania" },
        wayve: { target: "Fleet operators seeking autonomous driving", category: "AI-first autonomous driving software", differentiator: "End-to-end deep learning that generalises to any road without HD maps", reasonToBelieve: "$1B+ raised, partnerships with Uber, Microsoft, Asda" },
      },
      "CRL:5:3": {
        octopus: [{ name: "Greg Jackson (CEO)", company: "Octopus Energy", frequency: "Ongoing", value: "Customer community engagement" }],
        northvolt: [{ name: "Herbert Diess", company: "Volkswagen", frequency: "Quarterly", value: "Strategic partnership guidance" }],
        wayve: [{ name: "Dara Khosrowshahi", company: "Uber", frequency: "Monthly", value: "Go-to-market partnership input" }],
      },
      "CRL:5:4": {
        octopus: [{ segment: "UK homeowners", valueProp: "100% green energy at a fair, transparent price", keyBenefit: "Save money while going green" }],
        northvolt: [{ segment: "European OEMs", valueProp: "European-made, low-carbon batteries at cost parity", keyBenefit: "Supply chain sovereignty + ESG compliance" }],
        wayve: [{ segment: "Fleet operators", valueProp: "AI driving that works anywhere without mapping", keyBenefit: "Eliminate per-city mapping costs, scale faster" }],
      },
      "CRL:5:5": {
        octopus: { segment: "UK residential energy customers", tamForSegment: "£55B", whyFirst: "Highest switching rates in Europe, strong green sentiment", reachStrategy: "Digital marketing, price comparison sites, referral programme" },
        northvolt: { segment: "Premium European OEMs (VW, BMW, Volvo)", tamForSegment: "$12B", whyFirst: "Strongest ESG pressure, willing to pay for European supply", reachStrategy: "Direct enterprise sales, strategic partnerships" },
        wayve: { segment: "UK grocery delivery fleets", tamForSegment: "$500M", whyFirst: "Controlled routes, high driver costs, eager early adopters", reachStrategy: "Pilot partnerships with Asda, Ocado" },
      },
      "CRL:6:2": {
        octopus: { previousVP: "Cheapest green energy", feedback: "Customers valued transparency and control over just price", updatedVP: "Smart, transparent, 100% green energy that puts you in control", keyLearning: "Control and transparency are as important as price" },
        northvolt: { previousVP: "European-made batteries", feedback: "OEMs need traceability proof for ESG reporting", updatedVP: "Traceable, low-carbon European batteries with full lifecycle documentation", keyLearning: "Traceability documentation is a key differentiator" },
        wayve: { previousVP: "Self-driving software", feedback: "Fleet managers care about generalisation across routes", updatedVP: "AI driving software that learns and generalises to any road", keyLearning: "Per-route performance < generalisation capability" },
      },
      "CRL:6:3": {
        octopus: [{ stage: "Awareness", action: "SEO + price comparison sites", metric: "500K visits/month" }, { stage: "Interest", action: "Green energy calculator", metric: "30% engagement" }, { stage: "Decision", action: "Simple switch process", metric: "15% conversion" }, { stage: "Purchase", action: "2-minute sign-up", metric: "95% completion" }],
        northvolt: [{ stage: "Awareness", action: "Industry events + PR", metric: "100 inbound inquiries/quarter" }, { stage: "Interest", action: "Technical demos", metric: "50% to next stage" }, { stage: "Decision", action: "Pilot cell testing", metric: "80% pilot success" }, { stage: "Purchase", action: "Multi-year supply contract", metric: "Average $2B contract" }],
        wayve: [{ stage: "Awareness", action: "Research publications + demos", metric: "200 inbound contacts/year" }, { stage: "Interest", action: "Demo rides", metric: "70% request pilot" }, { stage: "Decision", action: "City-scale pilot", metric: "90% pilot renewal" }, { stage: "Purchase", action: "Platform license agreement", metric: "Multi-year deals" }],
      },
      "CRL:6:4": {
        octopus: { channels: ["Affiliate Programmes", "Content Marketing", "Viral Marketing", "Search Engine Optimisation (SEO)", "Partnerships"], partners: "Price comparison sites (Uswitch), renewable generators", timeline: "Continuous customer acquisition", risks: "Energy price cap regulation" },
        northvolt: { channels: ["Sales", "Partnerships", "Business Development", "Trade Shows"], partners: "VW, BMW, Volvo, mining companies", timeline: "3-5 year factory build + ramp", risks: "Capital intensity, raw material supply" },
        wayve: { channels: ["Partnerships", "Business Development", "Speaking Engagements", "Publicity"], partners: "Microsoft (compute), Uber (go-to-market), vehicle OEMs", timeline: "2-3 years to commercial deployment", risks: "Regulatory approval, safety validation" },
      },
      "CRL:7:2": {
        octopus: { totalUsers: "3M+", activeUsers: "2.5M", retentionRate: "85%", keyMetric: "Monthly app engagement 60%+", topFeedback: "Love Agile Octopus tariff and the app" },
        northvolt: { totalUsers: "10 OEM accounts", activeUsers: "8 in active production", retentionRate: "100%", keyMetric: "Cell quality yield 95%+", topFeedback: "Cells meeting all performance specifications" },
        wayve: { totalUsers: "5 fleet partners", activeUsers: "3 in active pilots", retentionRate: "100% pilot renewal", keyMetric: "120+ miles per intervention", topFeedback: "Impressive generalisation across new routes" },
      },
      "CRL:7:3": {
        octopus: { originalRoute: "Price comparison site partnerships only", whatChanged: "Added referral programme + B2B licensing of Kraken platform", partnerStatus: "50+ Kraken licensees globally", newChannels: "B2B tech licensing now 40% of strategy" },
        northvolt: { originalRoute: "Direct sales to German OEMs", whatChanged: "Expanded to Scandinavian and French OEMs, added recycling vertical", partnerStatus: "Active contracts with 10+ OEMs", newChannels: "Battery recycling as a service" },
        wayve: { originalRoute: "Direct fleet partnerships", whatChanged: "Added Uber partnership for ride-hail, Microsoft for compute", partnerStatus: "3 strategic partners signed", newChannels: "Ride-hail platform integration" },
      },
      "CRL:8:1": {
        octopus: { totalCustomers: "3M+", revenue: "£6B ARR", avgPrice: "£2K/year", repeatRate: "85% retention", pipeline: "Entering international markets" },
        northvolt: { totalCustomers: "10+", revenue: "$800M contracted", avgPrice: "$80M avg contract", repeatRate: "100% renewal so far", pipeline: "$55B order backlog" },
        wayve: { totalCustomers: "5", revenue: "Pilot stage", avgPrice: "Custom pricing", repeatRate: "N/A", pipeline: "$1B+ raised for commercial scale" },
      },
      "CRL:8:2": {
        octopus: { totalUsers: "3M+", activeUsers: "2.5M", retentionRate: "85%", keyMetric: "60% monthly app engagement", topFeedback: "Best energy app in the UK" },
        northvolt: { totalUsers: "10", activeUsers: "8", retentionRate: "100%", keyMetric: "95%+ cell yield", topFeedback: "Consistently high quality" },
        wayve: { totalUsers: "5", activeUsers: "3", retentionRate: "100%", keyMetric: "120+ miles/intervention", topFeedback: "Best generalisation we've seen" },
      },
      "CRL:8:3": {
        octopus: { process: "Online self-serve switch, automated onboarding, smart meter install", team: "Digital-first, minimal human sales", tools: "Kraken CRM, automated billing", conversionRate: "15% visitor-to-customer" },
        northvolt: { process: "Enterprise sales: RFP response → pilot → multi-year contract", team: "10-person enterprise sales team", tools: "Salesforce, custom technical demo platform", conversionRate: "80% pilot-to-contract" },
        wayve: { process: "Research demo → pilot agreement → commercial license", team: "BD team of 5 + technical solutions engineers", tools: "Custom demo fleet, simulation platform", conversionRate: "70% demo-to-pilot" },
      },
      "CRL:8:4": {
        octopus: [{ name: "Uswitch", type: "Channel", contribution: "Customer acquisition via comparison", status: "Active" }],
        northvolt: [{ name: "Volkswagen", type: "Strategic", contribution: "Anchor customer + co-investment", status: "Active" }],
        wayve: [{ name: "Microsoft", type: "Tech", contribution: "Azure compute infrastructure", status: "Active" }],
      },
      "CRL:9:1": {
        octopus: { deploymentScale: 3000000, salesVelocity: 100000, geoReach: ["Europe", "Asia", "North America"], growthRate: 50, strategy: "International expansion + B2B platform licensing" },
        northvolt: { deploymentScale: 8, salesVelocity: 2, geoReach: ["Europe", "North America"], growthRate: 100, strategy: "Gigafactory scaling + recycling vertical" },
        wayve: { deploymentScale: 3, salesVelocity: 2, geoReach: ["Europe"], growthRate: 200, strategy: "Scale via Uber partnership + OEM licensing" },
      },
      "CRL:9:2": {
        octopus: { totalUsers: "3M+", activeUsers: "2.5M", retentionRate: "85%", keyMetric: "NPS 80+", topFeedback: "Best energy company in the UK" },
        northvolt: { totalUsers: "10+", activeUsers: "10", retentionRate: "100%", keyMetric: "99.5% delivery on-time", topFeedback: "Most reliable European supplier" },
        wayve: { totalUsers: "5+", activeUsers: "3", retentionRate: "100%", keyMetric: "200+ miles/intervention (improving)", topFeedback: "Only AV company that doesn't need HD maps" },
      },
      "CRL:9:3": {
        octopus: { deploymentScale: 5000000, salesVelocity: 150000, geoReach: ["Europe", "Asia", "North America", "Oceania"], growthRate: 50, strategy: "Platform play: Kraken as energy industry OS" },
        northvolt: { deploymentScale: 15, salesVelocity: 5, geoReach: ["Europe", "North America"], growthRate: 100, strategy: "Vertical integration: mining to recycling" },
        wayve: { deploymentScale: 10, salesVelocity: 4, geoReach: ["Europe", "North America"], growthRate: 300, strategy: "Foundation model approach: one AI for all driving" },
      },

      // TRL example data
      "TRL:1:4": {
        octopus: [{ application: "Smart grid demand response", targetUser: "UK homeowners", keyBenefit: "15% energy cost reduction via time-of-use optimisation", feasibility: "High" }],
        northvolt: [{ application: "Lithium-ion cell manufacturing", targetUser: "European automakers", keyBenefit: "Local, low-carbon EV battery supply chain", feasibility: "High" }],
        wayve: [{ application: "End-to-end learned autonomous driving", targetUser: "Automotive OEMs", keyBenefit: "Eliminate HD map dependency, scale to any road", feasibility: "Medium" }],
      },
      "TRL:1:5": {
        octopus: { techDescription: "Software platform combining smart meter data, dynamic pricing algorithms, and renewable energy forecasting", scientificPrinciple: "Machine learning for energy demand prediction + real-time pricing optimisation", whatItEnables: "Consumers shift usage to cheapest/greenest periods automatically", keyUnknowns: "Consumer willingness to change energy habits, smart meter rollout pace" },
        northvolt: { techDescription: "Large-format prismatic lithium-ion battery cells using NMC and LFP chemistries", scientificPrinciple: "Electrochemistry — lithium intercalation in layered oxide cathodes and graphite anodes", whatItEnables: "European-made EV batteries with lowest carbon footprint in industry", keyUnknowns: "Achieving cost parity with Asian manufacturers at European labour costs" },
        wayve: { techDescription: "Deep neural network that learns to drive from raw sensor data (camera, LiDAR) without hand-coded rules", scientificPrinciple: "End-to-end deep learning / imitation learning from human driving demonstrations", whatItEnables: "Autonomous driving that generalises to any road without pre-mapped environments", keyUnknowns: "Safety guarantees for edge cases, regulatory acceptance of learned systems" },
      },
      "TRL:2:4": {
        octopus: { techDescription: "Kraken platform — cloud-based energy technology stack handling billing, smart grid optimisation, and customer management", howItWorks: "Ingests smart meter data, runs ML demand forecasts, sets half-hourly tariff prices, automates grid balancing", keyComponents: "Smart meter API, demand forecasting ML models, dynamic pricing engine, customer app", performanceTarget: "Process 1M+ meter readings/hour, pricing decisions in <500ms" },
        northvolt: { techDescription: "High-energy-density NMC 811 prismatic cells for automotive applications", howItWorks: "Electrode coating, cell assembly, formation cycling in gigafactory-scale clean rooms", keyComponents: "NMC 811 cathode, silicon-graphite anode, ceramic separator, proprietary electrolyte", performanceTarget: "Energy density >250 Wh/kg, cycle life >1500 cycles, cost <€100/kWh" },
        wayve: { techDescription: "AV2.0 — end-to-end neural network that maps sensor input directly to driving actions", howItWorks: "Multimodal transformer processes camera + LiDAR inputs, outputs steering/throttle/brake commands", keyComponents: "Vision transformer backbone, world model, imitation learning pipeline, simulation engine", performanceTarget: ">200 miles between interventions, works across 10+ cities without retraining" },
      },
      "TRL:2:5": {
        octopus: [{ application: "Smart grid demand response", market: "UK residential energy", performanceRequired: "15%+ bill savings vs fixed tariff", revenuePotential: "55000000000", likelihood: "High" }, { application: "B2B energy platform licensing", market: "Global energy utilities", performanceRequired: "Handle 50M+ customer accounts", revenuePotential: "10000000000", likelihood: "Medium" }],
        northvolt: [{ application: "EV traction batteries", market: "European automotive", performanceRequired: ">250 Wh/kg, <€100/kWh", revenuePotential: "46000000000", likelihood: "High" }, { application: "Grid-scale energy storage", market: "Renewable energy", performanceRequired: ">4000 cycle life, <€80/kWh", revenuePotential: "12000000000", likelihood: "Medium" }],
        wayve: [{ application: "Autonomous delivery", market: "Last-mile logistics", performanceRequired: ">99.9% safe journey completion", revenuePotential: "50000000000", likelihood: "High" }, { application: "Autonomous ride-hailing", market: "Urban mobility", performanceRequired: "Door-to-door urban driving", revenuePotential: "300000000000", likelihood: "Medium" }],
      },
      "TRL:3:4": {
        octopus: [{ parameter: "Demand forecast accuracy", targetValue: ">90%", achievedValue: "93%", testConditions: "10,000 UK households, 6-month historical data", pass: "Yes" }, { parameter: "Dynamic pricing latency", targetValue: "<1 second", achievedValue: "420ms", testConditions: "Simulated 100K concurrent meter reads", pass: "Yes" }],
        northvolt: [{ parameter: "Cell energy density", targetValue: ">250 Wh/kg", achievedValue: "265 Wh/kg", testConditions: "Lab-scale pouch cells, 25°C, C/3 rate", pass: "Yes" }, { parameter: "Cycle life (80% retention)", targetValue: ">1500 cycles", achievedValue: "1650 cycles", testConditions: "1C charge/discharge, 25°C", pass: "Yes" }],
        wayve: [{ parameter: "Miles per intervention", targetValue: ">50", achievedValue: "78", testConditions: "Suburban London, clear weather, daytime", pass: "Yes" }, { parameter: "Lane-keeping accuracy", targetValue: ">95%", achievedValue: "97.2%", testConditions: "Mixed urban/suburban routes, 100 hours", pass: "Yes" }],
      },
      "TRL:3:5": {
        octopus: { rdTeam: "Greg Jackson (CEO/CTO), 15 software engineers, 3 ML engineers, 2 energy market analysts", currentFocus: "Real-time dynamic pricing engine and Agile Octopus tariff development", milestones: "Launch Agile Octopus publicly, scale to 100K smart meter integrations, achieve 95% forecast accuracy", budget: "£2M for engineering team + £500K cloud infrastructure", facilities: "London HQ office, AWS cloud infrastructure" },
        northvolt: { rdTeam: "Peter Carlsson (CEO), 50+ electrochemists, 20 process engineers, 10 materials scientists", currentFocus: "Scaling NMC 811 cell chemistry from lab to pilot line production", milestones: "Build pilot production line (250 MWh), achieve >95% cell yield, validate automotive-grade quality", budget: "€50M for pilot facility + €15M for R&D materials", facilities: "Västerås R&D centre, pilot production facility" },
        wayve: { rdTeam: "Alex Kendall (CEO), 30 ML researchers, 15 robotics engineers, 5 safety engineers", currentFocus: "Scaling training data pipeline and improving end-to-end driving model", milestones: "Reach 100+ miles/intervention, expand to 3 cities, build simulation platform", budget: "£10M compute costs + £5M fleet operations + £3M team", facilities: "London office, Azure cloud (Microsoft partnership), test fleet of 20 vehicles" },
      },
      "TRL:3:6": {
        octopus: [{ requirement: "Half-hourly pricing visibility", source: "Customer interviews", priority: "Must-have", status: "Validated" }, { requirement: "Automated appliance scheduling", source: "Beta user feedback", priority: "Should-have", status: "In progress" }],
        northvolt: [{ requirement: "Automotive-grade quality (IATF 16949)", source: "OEM procurement specs", priority: "Must-have", status: "In progress" }, { requirement: "Full lifecycle carbon traceability", source: "EU Battery Regulation", priority: "Must-have", status: "Not yet tested" }],
        wayve: [{ requirement: "Works in rain and low light", source: "Fleet operator interviews", priority: "Must-have", status: "In progress" }, { requirement: "No per-city HD map required", source: "Scalability requirement", priority: "Must-have", status: "Validated" }],
      },
      "TRL:4:4": {
        octopus: { componentsIntegrated: "Smart meter API + ML forecast engine + dynamic pricing module + customer app", testDescription: "End-to-end test: real smart meter data → forecast → price signal → app notification → customer response", keyResult: "Full pipeline working for 500 beta users with 93% forecast accuracy and 420ms pricing latency", remainingChallenges: "Scaling to 100K+ meters simultaneously, handling network outages gracefully", documentation: "Internal technical report Q3 2018" },
        northvolt: { componentsIntegrated: "Electrode coating + cell assembly + formation cycling + quality testing", testDescription: "Pilot line integration: end-to-end cell manufacturing from raw materials to finished prismatic cell", keyResult: "Successfully produced 1,000 automotive-grade cells meeting VW specifications", remainingChallenges: "Yield rate at 92% (target 95%), electrode coating uniformity at scale", documentation: "Pilot production report, shared with VW procurement" },
        wayve: { componentsIntegrated: "Camera array + LiDAR + compute unit + neural network + vehicle control interface", testDescription: "Full autonomous driving stack: sensor fusion → neural network inference → vehicle actuation on public roads", keyResult: "78 miles per intervention in suburban London, smooth lane changes and intersection handling", remainingChallenges: "Roundabout navigation, construction zone handling, heavy rain performance", documentation: "Internal safety report, demo videos shared with investors" },
      },
      "TRL:4:5": {
        octopus: [{ kpi: "Customer energy cost savings", incumbentBenchmark: "£0 (fixed tariff)", yourResult: "£200/year average savings", improvement: "15% bill reduction", evidence: "500-user beta trial, 6 months, Oct 2018" }],
        northvolt: [{ kpi: "Cell manufacturing cost", incumbentBenchmark: "€120/kWh (CATL)", yourResult: "€110/kWh", improvement: "8% cost reduction", evidence: "Pilot line cost analysis, Q4 2019" }, { kpi: "Carbon footprint per kWh", incumbentBenchmark: "120 kg CO₂e (industry avg)", yourResult: "35 kg CO₂e", improvement: "71% reduction", evidence: "LCA analysis by third-party auditor" }],
        wayve: [{ kpi: "Cost per autonomous mile", incumbentBenchmark: "£5+ (Waymo, HD-map based)", yourResult: "£0.80", improvement: "84% cost reduction", evidence: "Fleet ops analysis, no HD map costs" }, { kpi: "Time to deploy in new city", incumbentBenchmark: "6+ months (competitor map building)", yourResult: "2 weeks (no mapping needed)", improvement: "12x faster", evidence: "London→Cambridge deployment test" }],
      },
      "TRL:5:4": {
        octopus: { testEnvironment: "Live UK energy grid with 50,000 real customer smart meters", differsFromLab: "Real grid constraints, variable renewable generation, actual customer behaviour patterns", componentsTested: "Full Kraken stack: meter ingestion, forecasting, pricing, billing, customer notifications", keyResults: "93% forecast accuracy maintained at scale, Agile Octopus tariff delivering avg 15% savings", degradation: "Minimal — forecast accuracy dropped 1% due to unusual weather patterns, recovered after model retrain" },
        northvolt: { testEnvironment: "Pilot production line at Västerås facility, semi-automated", differsFromLab: "Scale (1000x lab output), industrial process control, real supply chain materials", componentsTested: "Electrode coating, cell stacking, electrolyte filling, formation cycling, end-of-line testing", keyResults: "95% cell yield achieved, cells meeting VW performance specs consistently", degradation: "2-3% performance variance from lab results due to process variations, within acceptable range" },
        wayve: { testEnvironment: "Public roads in London, Cambridge, and Manchester — mixed urban driving", differsFromLab: "Real traffic, pedestrians, cyclists, varied weather, construction zones, diverse road types", componentsTested: "Full AV stack on modified Jaguar I-PACE fleet with safety drivers", keyResults: "120+ miles per intervention across 3 cities, smooth handling of 95% of driving scenarios", degradation: "Performance drops in heavy rain (60 mi/intervention vs 120 dry) and complex roundabouts" },
      },
      "TRL:5:5": {
        octopus: [{ kpi: "Customer energy cost savings", target: "15%+ bill reduction", labResult: "£200/year (500 users)", fieldResult: "£180/year (50K users)", onTarget: "Yes", notes: "Slightly lower at scale due to grid constraints" }],
        northvolt: [{ kpi: "Cell energy density", target: ">250 Wh/kg", labResult: "265 Wh/kg", fieldResult: "258 Wh/kg", onTarget: "Yes", notes: "3% lower due to production tolerances" }, { kpi: "Cell yield rate", target: ">95%", labResult: "98% (lab)", fieldResult: "95.2%", onTarget: "Yes", notes: "Marginal — improving with process refinement" }],
        wayve: [{ kpi: "Miles per intervention", target: ">100", labResult: "78 (suburban only)", fieldResult: "120+ (3 cities)", onTarget: "Yes", notes: "Exceeded target due to model improvements" }, { kpi: "Deployment speed to new city", target: "<1 month", labResult: "N/A", fieldResult: "2 weeks", onTarget: "Yes", notes: "No HD mapping needed" }],
      },
      "TRL:5:6": {
        octopus: [{ requirement: "Half-hourly pricing visibility", source: "Customer interviews", priority: "Must-have", status: "Validated", changeFromInitial: "Unchanged" }, { requirement: "EV smart charging integration", source: "Customer demand", priority: "Must-have", status: "In progress", changeFromInitial: "New" }],
        northvolt: [{ requirement: "IATF 16949 certification", source: "OEM procurement specs", priority: "Must-have", status: "Validated", changeFromInitial: "Unchanged" }, { requirement: "Battery passport (EU Battery Regulation)", source: "Regulatory", priority: "Must-have", status: "In progress", changeFromInitial: "New" }],
        wayve: [{ requirement: "Works in rain and low light", source: "Fleet operators", priority: "Must-have", status: "In progress", changeFromInitial: "Unchanged" }, { requirement: "Remote fleet monitoring dashboard", source: "Fleet managers", priority: "Should-have", status: "In progress", changeFromInitial: "New" }],
      },
      "TRL:6:4": {
        octopus: { prototypeVersion: "Kraken v2.0", demoEnvironment: "Live UK market with 500K+ customers on Agile Octopus tariff", requirementsMet: "Real-time dynamic pricing, smart meter integration, customer app with live tariff display, automated billing", requirementsNotMet: "Automated appliance control (beta), grid services revenue sharing", stakeholderFeedback: "Customers report avg 15% savings; Which? rated #1 energy company; Ofgem praised innovation", documentation: "Public case studies, Which? award documentation, Ofgem innovation sandbox report" },
        northvolt: { prototypeVersion: "Ett Gigafactory Phase 1", demoEnvironment: "Full-scale gigafactory production line in Skellefteå, Sweden", requirementsMet: "Automotive-grade NMC cells at 258 Wh/kg, 95%+ yield, full traceability, IATF 16949 certified", requirementsNotMet: "Cost parity with CATL (currently 5% premium), full recycling loop integration", stakeholderFeedback: "VW: 'Cells meeting all performance specs'; BMW: 'Best European supplier for quality and sustainability'", documentation: "IATF 16949 certificate, VW qualification report, third-party LCA audit" },
        wayve: { prototypeVersion: "AV2.0 Gen3", demoEnvironment: "Public roads across London, Manchester, and delivery routes for Asda/Ocado", requirementsMet: "120+ mi/intervention, works across 3 cities without retraining, smooth urban driving in most conditions", requirementsNotMet: "Heavy rain performance (60 mi/intervention), complex multi-lane roundabouts, construction zones", stakeholderFeedback: "Asda: 'Impressive delivery completion rate'; Uber: 'Most promising AV approach we've seen for scale'", documentation: "Safety case documentation, demo ride videos, fleet telemetry dashboards" },
      },
      "TRL:7:1": {
        octopus: { opEnvironment: "UK national energy market — 3M+ live customer accounts", testDuration: "5+ years continuous operation since 2016 launch", performanceSummary: "Serving 3M+ customers, Kraken platform licensed globally to manage 50M+ accounts, consistent 15% savings delivered", failuresIssues: "Early scaling issues with meter data ingestion resolved by 2019; occasional API latency during peak demand — mitigated with auto-scaling", operatorFeedback: "Net Promoter Score 80+, rated #1 energy supplier by Which? for multiple years" },
        northvolt: { opEnvironment: "Live automotive supply chain — shipping cells to VW, BMW, Volvo production lines", testDuration: "18+ months continuous production and delivery", performanceSummary: "Producing at 16 GWh/year rate, cells integrated into production vehicles, $55B order backlog secured", failuresIssues: "Early yield variations resolved through process control improvements; one batch recall in Q2 2023 due to electrolyte impurity — resolved with enhanced QC", operatorFeedback: "OEM procurement leads report 'cells consistently meeting specs' with 99.5% delivery on-time" },
        wayve: { opEnvironment: "Public roads in 5 UK cities with commercial delivery and ride-hailing partners", testDuration: "24+ months of continuous fleet operation with safety drivers", performanceSummary: "200+ miles per intervention (improving monthly), successful deliveries for Asda, pilot with Uber for ride-hailing", failuresIssues: "Safety driver intervention required for complex roundabouts (reducing quarterly); one minor incident in heavy fog — improved sensor fusion pipeline", operatorFeedback: "Fleet partners report 'best generalisation capability we've tested'; safety drivers report increasing confidence" },
      },
      "TRL:7:2": {
        octopus: { requirementsDocumented: "Yes", totalRequirements: "120 requirements across 8 categories (UX, billing, grid, security, etc.)", percentMet: "95", criticalGaps: "Real-time grid services API (in development), smart home device integration (beta)", signOffStatus: "Requirements reviewed and approved by Ofgem, major customer panels, and engineering team" },
        northvolt: { requirementsDocumented: "Yes", totalRequirements: "85 requirements across automotive, safety, environmental, and quality standards", percentMet: "92", criticalGaps: "Full battery passport compliance (EU regulation effective 2027), second-life repurposing certification", signOffStatus: "IATF 16949 certified, VW and BMW qualification complete, EU auditors reviewed" },
        wayve: { requirementsDocumented: "Partially", totalRequirements: "60 requirements across safety, performance, operational, and regulatory", percentMet: "80", criticalGaps: "Regulatory approval for fully driverless operation (no safety driver), heavy weather performance specification", signOffStatus: "Internal safety board approved, fleet partners signed off on pilot specs, regulatory discussions ongoing" },
      },
      "TRL:8:1": {
        octopus: { deploymentCount: "UK + 6 international markets via Kraken licensing", totalOperatingTime: "8+ years continuous, 3M+ UK accounts + 50M+ via Kraken globally", uptime: "99.97% platform availability", keyPerformanceMetric: "Processing 100M+ meter readings daily, real-time pricing for all tariffs", customerSatisfaction: "NPS 80+, Which? #1 rated, 85% retention rate", knownLimitations: "Dependent on smart meter rollout pace in new markets; grid services revenue not yet fully realised" },
        northvolt: { deploymentCount: "3 gigafactories (Skellefteå operational, Heide and Montréal under construction)", totalOperatingTime: "30,000+ production hours at Skellefteå", uptime: "94% factory utilisation rate", keyPerformanceMetric: "16 GWh/year production rate, 95%+ yield, 258 Wh/kg energy density", customerSatisfaction: "100% contract renewal, 99.5% on-time delivery", knownLimitations: "Cost still 5% above Asian competitors; raw material supply chain concentration risk" },
        wayve: { deploymentCount: "5 UK cities with active fleet operations", totalOperatingTime: "500,000+ autonomous miles driven", uptime: "98% fleet availability during operational hours", keyPerformanceMetric: "200+ miles per intervention, improving 2x per year", customerSatisfaction: "All pilot partners renewed, Uber signed commercial partnership", knownLimitations: "Still requires safety driver for regulatory compliance; heavy weather performance gap" },
      },
      "TRL:9:1": {
        octopus: { totalDeployments: "UK direct + Kraken licensed in 15+ countries", operatingHistory: "8+ years, serving 50M+ accounts globally", scalabilityEvidence: "Unit cost per customer decreased 60% from year 1 to year 8; Kraken handles any energy market structure", manufacturingReadiness: "N/A (software) — fully cloud-native, auto-scaling architecture", reliabilityData: "99.97% uptime, <200ms average API response time, zero billing errors per 100K transactions" },
        northvolt: { totalDeployments: "3 gigafactories planned (150 GWh total capacity by 2030)", operatingHistory: "3+ years of commercial production", scalabilityEvidence: "Cell cost reduced 25% from first production run to current; yield improved from 90% to 95%+", manufacturingReadiness: "Skellefteå at 16 GWh/yr, Heide (Germany) factory breaking ground, Montréal factory in construction", reliabilityData: "MTBF equivalent: 0.2% field failure rate across all shipped cells" },
        wayve: { totalDeployments: "5 cities active, planning 10+ by 2027", operatingHistory: "3+ years of public road operations", scalabilityEvidence: "Time to deploy in new city: 2 weeks (vs 6+ months for competitors); training cost per new city near zero", manufacturingReadiness: "Software-only — scales via cloud compute (Microsoft Azure partnership)", reliabilityData: "200+ mi/intervention, doubling annually; incident rate below insurance industry threshold" },
      },
      "TRL:9:2": {
        octopus: { currentFocus: "Kraken v3: AI-powered energy management with predictive device control", productionOptimisation: "Cloud cost reduced 40% via architecture optimisation; customer onboarding automated 95%", rdInvestment: "20% of revenue reinvested in platform R&D", techRoadmap: "v3 AI energy management (Q3), Home battery integration (Q1 next year), Vehicle-to-grid (Q3 next year)", competitiveTracking: "Traditional utilities cannot match tech speed; monitoring Ovo, Bulb for UK; tracking Tibber in Nordics" },
        northvolt: { currentFocus: "Next-gen sodium-ion cells for grid storage + solid-state battery R&D", productionOptimisation: "Electrode coating speed increased 40%; reject rate reduced from 8% to 5% in 12 months", rdInvestment: "12% of revenue + €200M dedicated R&D facility", techRoadmap: "Sodium-ion pilot (Q4), solid-state prototype (next year Q2), 95%+ recycled material cells (2027)", competitiveTracking: "CATL advancing sodium-ion commercially; BYD expanding European factories; need to maintain quality advantage" },
        wayve: { currentFocus: "LINGO-2: multimodal foundation model for driving with natural language reasoning", productionOptimisation: "Training pipeline 3x more efficient via data curation; inference cost reduced 50% through model distillation", rdInvestment: "80%+ of capital invested in R&D and compute", techRoadmap: "LINGO-2 deployment (Q3), highway driving capability (Q1 next year), first driverless operation permit (2027)", competitiveTracking: "Waymo expanding but still map-dependent; Tesla FSD improving but regulatory challenges; our generalisation advantage is growing" },
      },

      "TMRL:1:1": {
        octopus: [{ competency: "Enterprise sales", whyCritical: "Required for B2B Kraken licensing deals", source: "CRL L5 — no dedicated sales lead", currentCoverage: "Greg Jackson handles some, but stretched", severity: "Critical" }, { competency: "Energy market regulation", whyCritical: "Ofgem compliance and tariff approval", source: "BRL L4 — regulatory costs underestimated", currentCoverage: "External advisors only", severity: "Important" }],
        northvolt: [{ competency: "Gigafactory process engineering", whyCritical: "Core to scaling from pilot to mass production", source: "TRL L3 — pilot line yield issues", currentCoverage: "5 process engineers, need 20+", severity: "Critical" }, { competency: "Automotive quality (IATF 16949)", whyCritical: "Required for OEM supply contracts", source: "TRL L3 — certification in progress", currentCoverage: "1 quality manager", severity: "Critical" }],
        wayve: [{ competency: "Safety engineering", whyCritical: "Required for regulatory approval of AV operations", source: "TRL L3 — safety case development needed", currentCoverage: "5 safety engineers, need 10+", severity: "Critical" }, { competency: "Fleet operations management", whyCritical: "Scaling from 20 to 200+ vehicle fleet", source: "CRL L5 — fleet partners demanding ops excellence", currentCoverage: "Basic ops team in place", severity: "Important" }],
      },
      "TMRL:1:2": {
        octopus: { technicalCompetencies: "ML engineers for demand forecasting, cloud architects for scaling Kraken", commercialCompetencies: "Enterprise sales team, energy market analysts, customer success managers", legalCompetencies: "Energy regulatory counsel, data privacy (GDPR) specialist", keyResources: "Cloud infrastructure budget (£500K), London office expansion", timeline: "Q1–Q2 next year" },
        northvolt: { technicalCompetencies: "Electrochemists, process engineers, automation specialists for gigafactory", commercialCompetencies: "OEM account managers, supply chain specialists", legalCompetencies: "IP attorney for battery chemistry patents, EU regulatory specialist", keyResources: "Gigafactory construction (€4B), pilot materials (€15M), R&D centre", timeline: "Rolling over 24 months" },
        wayve: { technicalCompetencies: "ML researchers (vision transformers), robotics engineers, simulation specialists", commercialCompetencies: "Partnership managers for OEMs and fleet operators", legalCompetencies: "AV regulatory specialist, insurance/liability counsel", keyResources: "GPU compute cluster (£10M), test vehicle fleet expansion, safety driver team", timeline: "Q1–Q3 next year" },
      },
      "TMRL:2:1": {
        octopus: [{ person: "Greg Jackson", role: "CEO / CTO", timeCommitment: "Full-time", keyCompetency: "Energy market + tech strategy" }, { person: "Stuart Jackson", role: "COO", timeCommitment: "Full-time", keyCompetency: "Operations and scaling" }],
        northvolt: [{ person: "Peter Carlsson", role: "CEO", timeCommitment: "Full-time", keyCompetency: "Supply chain (ex-Tesla)" }, { person: "Paolo Cerruti", role: "COO", timeCommitment: "Full-time", keyCompetency: "Manufacturing operations" }],
        wayve: [{ person: "Alex Kendall", role: "CEO", timeCommitment: "Full-time", keyCompetency: "ML/computer vision research" }, { person: "Amar Shah", role: "CTO", timeCommitment: "Full-time", keyCompetency: "Robotics and systems engineering" }],
      },
      "TMRL:2:2": {
        octopus: { competenciesWeHave: "Energy market expertise, software engineering, customer acquisition", competenciesWeLack: "Enterprise B2B sales, international expansion, regulatory affairs at scale", howToFillGaps: "Hire VP Sales, engage regulatory consultants, partner with local energy companies", resourcesWeHave: "London office, AWS infrastructure, £6M seed funding", resourcesWeLack: "Dedicated sales team, international offices, larger engineering team" },
        northvolt: { competenciesWeHave: "Battery chemistry R&D, supply chain management, CEO network from Tesla", competenciesWeLack: "Gigafactory-scale manufacturing, automotive quality systems, EU regulatory compliance", howToFillGaps: "Hire 50+ process engineers, recruit quality director from automotive, engage regulatory advisors", resourcesWeHave: "Västerås R&D centre, pilot line, initial €12M funding", resourcesWeLack: "Gigafactory land and construction, scaled raw material supply chain" },
        wayve: { competenciesWeHave: "World-class ML research, computer vision, simulation engineering", competenciesWeLack: "Fleet operations at scale, commercial partnerships, safety certification", howToFillGaps: "Hire fleet ops director, recruit BD lead from automotive, grow safety team", resourcesWeHave: "London office, Microsoft Azure partnership, test fleet of 20 vehicles", resourcesWeLack: "Expanded fleet (100+ vehicles), dedicated safety testing facility" },
      },
      "TMRL:2:3": {
        octopus: { sixMonthGoal: "Launch Agile Octopus tariff to 10,000 customers and begin Kraken platform development", keyMilestones: "Smart meter integration complete, dynamic pricing live, first 5,000 customers", successCriteria: "10K customers, 15% average bill savings, NPS > 50", biggestRisk: "Smart meter rollout delays limiting addressable market" },
        northvolt: { sixMonthGoal: "Complete pilot production line and produce first 1,000 automotive-grade cells", keyMilestones: "Pilot line operational, first cells meeting VW specs, IATF 16949 audit scheduled", successCriteria: "1,000 cells produced, >95% yield, VW qualification initiated", biggestRisk: "Equipment delivery delays for pilot line construction" },
        wayve: { sixMonthGoal: "Reach 100+ miles per intervention and expand testing to 3 cities", keyMilestones: "Model v2 deployed, Cambridge and Manchester routes added, Asda pilot started", successCriteria: "100 mi/intervention, 3 cities operational, first commercial delivery pilot", biggestRisk: "Regulatory uncertainty around AV testing permits in new cities" },
      },
      "TMRL:3:1": {
        octopus: [{ competencyArea: "Energy market expertise", persons: "Greg Jackson", strength: "Strong", gap: "No" }, { competencyArea: "Software engineering", persons: "Engineering team (15)", strength: "Strong", gap: "No" }, { competencyArea: "Enterprise sales", persons: "None dedicated", strength: "Basic", gap: "Yes" }],
        northvolt: [{ competencyArea: "Battery chemistry", persons: "R&D team (50+)", strength: "Strong", gap: "No" }, { competencyArea: "Manufacturing engineering", persons: "Process engineers (20)", strength: "Adequate", gap: "Needs mentoring" }, { competencyArea: "Automotive quality", persons: "Quality manager (1)", strength: "Basic", gap: "Yes" }],
        wayve: [{ competencyArea: "ML research", persons: "ML team (30)", strength: "Strong", gap: "No" }, { competencyArea: "Safety engineering", persons: "Safety team (5)", strength: "Adequate", gap: "Needs mentoring" }, { competencyArea: "Fleet operations", persons: "Ops team (3)", strength: "Basic", gap: "Yes" }],
      },
      "TMRL:3:2": {
        octopus: [{ requirement: "VP Enterprise Sales", type: "Hire", priority: "Critical", howToAcquire: "Executive recruiter, energy sector network", timeline: "Month 3" }, { requirement: "Regulatory advisor", type: "Advisor", priority: "High", howToAcquire: "Ofgem network, industry associations", timeline: "Month 2" }],
        northvolt: [{ requirement: "Process engineers (15+)", type: "Hire", priority: "Critical", howToAcquire: "Universities, automotive industry recruitment", timeline: "Month 1–6" }, { requirement: "Quality director", type: "Hire", priority: "Critical", howToAcquire: "Automotive industry headhunt", timeline: "Month 2" }],
        wayve: [{ requirement: "Safety engineers (5+)", type: "Hire", priority: "Critical", howToAcquire: "Aerospace and automotive safety networks", timeline: "Month 1–4" }, { requirement: "Fleet operations director", type: "Hire", priority: "High", howToAcquire: "Logistics industry recruitment", timeline: "Month 3" }],
      },
      "TMRL:3:3": {
        octopus: { q1Priorities: "Hire VP Sales, onboard regulatory advisor, expand engineering team by 5", q2Priorities: "Build sales team (3 AEs), recruit customer success lead, data scientist hire", totalBudget: "£800K for hiring + £200K for office expansion", keyDependencies: "Series A funding close, Ofgem tariff approval" },
        northvolt: { q1Priorities: "Hire quality director, begin process engineer recruitment wave, secure raw material contracts", q2Priorities: "Onboard 10 process engineers, recruit supply chain manager, engage automotive auditors", totalBudget: "€5M for hiring + €50M for factory equipment", keyDependencies: "Gigafactory land acquisition, VW qualification timeline" },
        wayve: { q1Priorities: "Hire 3 safety engineers, recruit fleet ops director, expand compute budget", q2Priorities: "Add 5 ML researchers, hire BD lead for OEM partnerships, grow test fleet", totalBudget: "£3M for hiring + £10M for compute + £2M for fleet expansion", keyDependencies: "Series B funding, AV testing permits for new cities" },
      },
      "TMRL:4:1": {
        octopus: [{ teamMember: "Greg Jackson", role: "CEO / CTO", timeCommitment: "Full-time", otherCommitments: "None", fullyCommitted: "Yes" }, { teamMember: "Stuart Jackson", role: "COO", timeCommitment: "Full-time", otherCommitments: "None", fullyCommitted: "Yes" }],
        northvolt: [{ teamMember: "Peter Carlsson", role: "CEO", timeCommitment: "Full-time", otherCommitments: "Board roles (winding down)", fullyCommitted: "Transitioning" }, { teamMember: "Paolo Cerruti", role: "COO", timeCommitment: "Full-time", otherCommitments: "None", fullyCommitted: "Yes" }],
        wayve: [{ teamMember: "Alex Kendall", role: "CEO", timeCommitment: "Full-time", otherCommitments: "Academic publishing (winding down)", fullyCommitted: "Transitioning" }, { teamMember: "Amar Shah", role: "CTO", timeCommitment: "Full-time", otherCommitments: "None", fullyCommitted: "Yes" }],
      },
      "TMRL:4:2": {
        octopus: { businessLeadName: "Greg Jackson", relevantExperience: "Serial entrepreneur, deep energy market knowledge, built customer-facing tech products", keyResponsibilities: "Overall strategy, fundraising, product vision, key customer relationships", gapAreas: "Enterprise B2B sales experience — needs dedicated VP Sales hire" },
        northvolt: { businessLeadName: "Peter Carlsson", relevantExperience: "Former VP Supply Chain at Tesla — scaled Gigafactory supply chain, deep automotive network", keyResponsibilities: "Fundraising, OEM relationships, strategic partnerships, government relations", gapAreas: "European regulatory landscape, public company governance preparation" },
        wayve: { businessLeadName: "Alex Kendall", relevantExperience: "PhD in computer vision (Cambridge), published 50+ papers, deep VC network", keyResponsibilities: "Research direction, fundraising, Microsoft partnership, talent attraction", gapAreas: "Commercial partnerships at scale — needs experienced BD/sales hire" },
      },
      "TMRL:4:3": {
        octopus: [{ competency: "Software engineering", status: "In place", personSource: "15 engineers", quality: "Strong", changeSinceL3: "Improved" }, { competency: "Enterprise sales", status: "Partial", personSource: "VP Sales hired", quality: "Adequate", changeSinceL3: "Improved" }],
        northvolt: [{ competency: "Battery R&D", status: "In place", personSource: "50+ researchers", quality: "Strong", changeSinceL3: "Same" }, { competency: "Manufacturing engineering", status: "Partial", personSource: "20 process engineers", quality: "Adequate", changeSinceL3: "Improved" }],
        wayve: [{ competency: "ML research", status: "In place", personSource: "30 ML researchers", quality: "Strong", changeSinceL3: "Same" }, { competency: "Safety engineering", status: "Partial", personSource: "8 safety engineers", quality: "Adequate", changeSinceL3: "Improved" }],
      },
      "TMRL:4:4": {
        octopus: [{ roleResource: "VP Enterprise Sales", priority: "Critical", source: "Executive recruiter", status: "Confirmed", targetStart: "Month 4" }, { roleResource: "3 Account Executives", priority: "High", source: "Job boards, referrals", status: "Interviewing", targetStart: "Month 5" }],
        northvolt: [{ roleResource: "Quality Director", priority: "Critical", source: "Automotive headhunt", status: "Confirmed", targetStart: "Month 3" }, { roleResource: "15 Process Engineers", priority: "Critical", source: "University recruitment", status: "Interviewing", targetStart: "Month 2–6" }],
        wayve: [{ roleResource: "Fleet Operations Director", priority: "Critical", source: "Logistics recruitment", status: "Interviewing", targetStart: "Month 4" }, { roleResource: "5 Safety Engineers", priority: "Critical", source: "Aerospace/auto networks", status: "Searching", targetStart: "Month 2–5" }],
      },
      "TMRL:4:5": {
        octopus: { rolesDiscussed: "CEO: Greg Jackson — strategy & product. COO: Stuart Jackson — ops & scaling. Agreed.", ownershipSplit: "50/50 between co-founders, with 10% ESOP reserved", vestingStructure: "4-year vest, 1-year cliff — signed", commitmentLevels: "Both full-time since founding, minimum 5-year commitment", unresolvedIssues: "None — aligned on vision and execution" },
        northvolt: { rolesDiscussed: "CEO: Peter Carlsson — fundraising, strategy, OEM relationships. COO: Paolo Cerruti — manufacturing ops. Agreed.", ownershipSplit: "Peter: 40%, Paolo: 25%, early team: 15%, ESOP: 20%", vestingStructure: "4-year vest, 1-year cliff for all founders — signed", commitmentLevels: "All full-time, Peter transitioning from board roles by Month 6", unresolvedIssues: "Peter's board role transition timeline — needs to be fully dedicated" },
        wayve: { rolesDiscussed: "CEO: Alex Kendall — research, fundraising, partnerships. CTO: Amar Shah — engineering & systems. Agreed.", ownershipSplit: "Alex: 35%, Amar: 25%, early team: 15%, ESOP: 25%", vestingStructure: "4-year vest, 1-year cliff — signed", commitmentLevels: "Both full-time, Alex winding down academic publishing", unresolvedIssues: "Academic paper commitments — Alex needs to fully transition to company focus" },
      },
      "TMRL:5:1": {
        octopus: [{ name: "Greg Jackson", role: "CEO", keyCompetency: "Energy market + tech strategy", timeCommitment: "Full-time", startDate: "2015-10" }, { name: "Stuart Jackson", role: "COO", keyCompetency: "Operations and business scaling", timeCommitment: "Full-time", startDate: "2015-10" }],
        northvolt: [{ name: "Peter Carlsson", role: "CEO", keyCompetency: "Supply chain, fundraising, OEM relationships", timeCommitment: "Full-time", startDate: "2016-01" }, { name: "Paolo Cerruti", role: "COO", keyCompetency: "Manufacturing operations, factory build", timeCommitment: "Full-time", startDate: "2016-03" }],
        wayve: [{ name: "Alex Kendall", role: "CEO", keyCompetency: "ML/computer vision, research leadership", timeCommitment: "Full-time", startDate: "2017-06" }, { name: "Amar Shah", role: "CTO", keyCompetency: "Robotics, systems engineering", timeCommitment: "Full-time", startDate: "2017-06" }],
      },
      "TMRL:5:2": {
        octopus: { sharedVision: "Make green energy accessible and affordable for every UK household through technology and smart tariffs", rolesResponsibilities: "Greg: product, strategy, fundraising. Stuart: ops, scaling, customer service. Engineering team: platform development.", decisionMaking: "Co-founders decide jointly on strategy; domain leads own execution", commitmentLevel: "All founders full-time, minimum 5-year commitment", conflictResolution: "Weekly founder sync, external advisor for major disagreements" },
        northvolt: { sharedVision: "Build Europe's first homegrown gigafactory to supply sustainable batteries and reduce dependency on Asian imports", rolesResponsibilities: "Peter: fundraising, OEM relationships, government affairs. Paolo: factory ops, supply chain, quality. R&D lead: chemistry and process.", decisionMaking: "CEO decides on strategy after input from leadership team; domain leads execute", commitmentLevel: "All founders full-time, committed through gigafactory ramp to full production", conflictResolution: "Monthly leadership team reviews, board mediation for founder disputes" },
        wayve: { sharedVision: "Build AI that can drive any vehicle, anywhere — making autonomous driving truly scalable and affordable", rolesResponsibilities: "Alex: research direction, fundraising, Microsoft partnership. Amar: engineering, fleet ops, safety. ML leads: model development.", decisionMaking: "CEO sets research direction; CTO owns engineering decisions; joint decisions on partnerships", commitmentLevel: "All founders full-time, committed through Series C and beyond", conflictResolution: "Weekly founder 1-on-1, quarterly board reviews, external coach for founder dynamics" },
      },
      "TMRL:5:3": {
        octopus: { equitySplit: "Greg Jackson: 45%, Stuart Jackson: 45%, ESOP: 10%", vestingSchedule: "4-year vest, 1-year cliff for both founders", signed: "Yes", esopReserved: "10% reserved for key hires (VP Sales, engineering leads)", rationale: "Equal split reflects equal contribution and commitment from co-founding" },
        northvolt: { equitySplit: "Peter Carlsson: 35%, Paolo Cerruti: 20%, Early team: 15%, ESOP: 15%, Investor reserved: 15%", vestingSchedule: "4-year vest, 1-year cliff for all founders and early team", signed: "Yes", esopReserved: "15% for key manufacturing and R&D hires", rationale: "Peter's larger share reflects fundraising network from Tesla and CEO responsibilities" },
        wayve: { equitySplit: "Alex Kendall: 30%, Amar Shah: 22%, Early team: 13%, ESOP: 20%, Investor reserved: 15%", vestingSchedule: "4-year vest, 1-year cliff for all founders", signed: "Yes", esopReserved: "20% — larger pool to attract top ML researchers from DeepMind, Google", rationale: "Larger ESOP reflects need to compete for scarce ML talent; Alex's larger share reflects research IP and CEO role" },
      },
      "TMRL:5:4": {
        octopus: [{ need: "VP Enterprise Sales", actionUnderway: "Executive recruiter engaged, shortlist of 3 candidates", status: "In progress", expectedCompletion: "Month 5" }, { need: "3 ML Engineers", actionUnderway: "Job postings live, university outreach", status: "In progress", expectedCompletion: "Month 4–6" }],
        northvolt: [{ need: "Quality Director", actionUnderway: "Hired — starts next month", status: "Complete", expectedCompletion: "Month 3" }, { need: "15 Process Engineers", actionUnderway: "8 hired, 7 in pipeline", status: "In progress", expectedCompletion: "Month 6" }],
        wayve: [{ need: "Fleet Operations Director", actionUnderway: "Final interviews with 2 candidates", status: "In progress", expectedCompletion: "Month 4" }, { need: "5 Safety Engineers", actionUnderway: "3 hired, 2 searching", status: "In progress", expectedCompletion: "Month 5" }],
      },
      "TMRL:5:5": {
        octopus: { communication: "Slack (primary), weekly all-hands, daily engineering standup", documentation: "Notion for product specs, Google Drive for business docs", projectManagement: "Linear for engineering, Notion for company OKRs", knowledgeSharing: "Weekly engineering demos, monthly company knowledge share sessions" },
        northvolt: { communication: "Microsoft Teams, daily production standup, weekly leadership review", documentation: "SharePoint for manufacturing SOPs, Confluence for R&D", projectManagement: "Jira for R&D, SAP for production planning", knowledgeSharing: "Monthly R&D seminars, cross-team rotation programme, shared lab notebooks" },
        wayve: { communication: "Slack, daily ML standup, weekly company all-hands", documentation: "Notion for research notes, GitHub for code, Google Drive for partnerships", projectManagement: "Linear for engineering, Notion for research roadmap", knowledgeSharing: "Weekly ML paper club, internal tech talks, research blog posts" },
      },
      "TMRL:6:1": {
        octopus: { technicalExpertise: "Software engineering, ML/data science, energy market analytics, cloud infrastructure", commercialExpertise: "Energy retail, customer acquisition, B2B platform licensing, regulatory affairs", diversityDimensions: "Gender: 40% women in leadership; background: mix of energy industry and tech; international team from 15 countries", complementarity: "Greg brings energy market vision, Stuart brings operational scaling — minimal overlap, strong complementarity" },
        northvolt: { technicalExpertise: "Electrochemistry, process engineering, automation, materials science, quality systems", commercialExpertise: "OEM relationship management, supply chain procurement, government affairs, EU regulatory", diversityDimensions: "Gender: 35% women; background: team from 40+ nationalities; mix of automotive, chemicals, and energy", complementarity: "Peter brings strategic vision and network, Paolo brings manufacturing execution — clear role separation" },
        wayve: { technicalExpertise: "ML/AI research, computer vision, robotics, simulation engineering, safety systems", commercialExpertise: "OEM partnerships, fleet operator relationships, investor relations", diversityDimensions: "Gender: 30% women (improving); background: strong academic diversity, team from 20+ countries; age range 24–55", complementarity: "Alex brings research leadership and fundraising, Amar brings systems engineering — complementary with some overlap in ML" },
      },
      "TMRL:6:2": {
        octopus: { ceo: "Greg Jackson — strategy, product vision, fundraising, key customer relationships", ctoCpo: "Pete Miller (VP Engineering) — platform architecture, engineering team leadership", otherKeyRoles: "Stuart Jackson (COO): operations, scaling. Rachel Sherrington: customer experience", remainingGaps: "VP Sales (hiring), Head of International (planned)", resourcesSecured: "London HQ, AWS infrastructure, £300M+ in funding secured" },
        northvolt: { ceo: "Peter Carlsson — fundraising, OEM relationships, government affairs, strategy", ctoCpo: "CTO (R&D Lead) — battery chemistry, cell design, process development", otherKeyRoles: "Paolo Cerruti (COO): factory operations. Quality Director: IATF compliance. Supply Chain Director: raw materials", remainingGaps: "Head of Recycling (planned), VP Sales for energy storage vertical", resourcesSecured: "Skellefteå gigafactory, Västerås R&D centre, €6B+ in funding" },
        wayve: { ceo: "Alex Kendall — research direction, fundraising, Microsoft partnership, talent attraction", ctoCpo: "Amar Shah (CTO) — engineering, fleet operations, safety systems, deployment", otherKeyRoles: "VP Research: ML model development. Fleet Ops Director: vehicle operations. Head of Safety: safety case", remainingGaps: "VP Commercial Partnerships (hiring), Head of Government Relations (planned)", resourcesSecured: "London office, Microsoft Azure partnership, test fleet of 50+ vehicles, $1B+ in funding" },
      },
      "TMRL:6:3": {
        octopus: [{ teamMember: "Greg Jackson", role: "CEO", fullTimeSince: "2015-10", keyAccountability: "Strategy, product, fundraising", committedForYears: "5+ years" }, { teamMember: "Stuart Jackson", role: "COO", fullTimeSince: "2015-10", keyAccountability: "Operations, customer service, scaling", committedForYears: "5+ years" }],
        northvolt: [{ teamMember: "Peter Carlsson", role: "CEO", fullTimeSince: "2016-06", keyAccountability: "Fundraising, OEM partnerships, strategy", committedForYears: "5+ years" }, { teamMember: "Paolo Cerruti", role: "COO", fullTimeSince: "2016-03", keyAccountability: "Factory operations, supply chain", committedForYears: "5+ years" }],
        wayve: [{ teamMember: "Alex Kendall", role: "CEO", fullTimeSince: "2017-09", keyAccountability: "Research, fundraising, partnerships", committedForYears: "5+ years" }, { teamMember: "Amar Shah", role: "CTO", fullTimeSince: "2017-06", keyAccountability: "Engineering, fleet ops, safety", committedForYears: "5+ years" }],
      },
      "TMRL:6:4": {
        octopus: [{ name: "Lord Adair Turner", expertise: "Energy policy, financial regulation", role: "Advisor", status: "Confirmed", valueTheyAdd: "Government and regulatory relationships" }, { name: "Energy sector CTO", expertise: "Grid technology, smart meters", role: "Technical Advisor", status: "Confirmed", valueTheyAdd: "Technical validation and industry credibility" }],
        northvolt: [{ name: "Former Volkswagen executive", expertise: "Automotive procurement, EV strategy", role: "Board Advisor", status: "Confirmed", valueTheyAdd: "OEM introductions and market insight" }, { name: "Battery recycling expert", expertise: "Circular economy, EU regulations", role: "Advisor", status: "In discussions", valueTheyAdd: "Recycling strategy and regulatory guidance" }],
        wayve: [{ name: "Microsoft AI Research Director", expertise: "Large-scale ML, cloud computing", role: "Technical Advisor", status: "Confirmed", valueTheyAdd: "Azure compute partnership, ML architecture guidance" }, { name: "Former Uber autonomy lead", expertise: "AV commercialisation, fleet operations", role: "Advisor", status: "Confirmed", valueTheyAdd: "Commercialisation strategy and fleet ops expertise" }],
      },
      "TMRL:6:5": {
        octopus: [{ risk: "Key engineer leaves for Big Tech", likelihood: "Medium", impact: "High", mitigation: "Competitive equity packages, engineering culture investment, knowledge documentation" }, { risk: "Funding gap delays hiring plan", likelihood: "Low", impact: "Medium", mitigation: "Revenue growth reducing dependency on funding; bridge facility available" }],
        northvolt: [{ risk: "Key person departure during factory ramp", likelihood: "Medium", impact: "High", mitigation: "4-year vesting with cliff, retention bonuses, succession planning" }, { risk: "Skilled worker shortage in northern Sweden", likelihood: "High", impact: "Medium", mitigation: "Relocation packages, remote work options, university partnerships" }],
        wayve: [{ risk: "Top ML researchers poached by DeepMind/Google", likelihood: "High", impact: "High", mitigation: "Competitive equity, research publication culture, unique real-world AV data access" }, { risk: "Safety driver recruitment challenges", likelihood: "Medium", impact: "Medium", mitigation: "Partnership with driving schools, competitive pay, career progression to safety engineering" }],
      },
      "TMRL:6:6": {
        octopus: { potentialConflicts: "Debate between growth speed vs. customer service quality", conflictingPriorities: "Engineering team split between Kraken licensing platform and core retail product", mitigationMeasures: "Separate engineering squads for Kraken vs retail; monthly prioritisation reviews", externalSupport: "External board members provide strategic arbitration" },
        northvolt: { potentialConflicts: "Tension between R&D innovation pace and production quality requirements", conflictingPriorities: "Peter's remaining board commitments vs full-time CEO demands", mitigationMeasures: "Clear R&D vs production budgets, Peter's board transition plan with deadlines", externalSupport: "Board chair mediates founder tensions; external McKinsey support for factory strategy" },
        wayve: { potentialConflicts: "Research publication vs commercial IP protection tension", conflictingPriorities: "Alex's academic ties vs full-time CEO responsibilities", mitigationMeasures: "Publication review process (IP clearance first), Alex's academic commitments capped at 5% time", externalSupport: "External coach for founder dynamics, quarterly board reviews on team health" },
      },
      "TMRL:7:1": {
        octopus: [{ name: "Greg Jackson", title: "CEO", responsibilities: "Strategy, fundraising, product vision", reportsTo: "Board", performance: "Strong" }, { name: "Stuart Jackson", title: "COO", responsibilities: "Operations, customer service, scaling", reportsTo: "CEO", performance: "Strong" }, { name: "Pete Miller", title: "VP Engineering", responsibilities: "Platform development, Kraken architecture", reportsTo: "CEO", performance: "Strong" }],
        northvolt: [{ name: "Peter Carlsson", title: "CEO", responsibilities: "Strategy, fundraising, OEM partnerships", reportsTo: "Board", performance: "Strong" }, { name: "Paolo Cerruti", title: "COO", responsibilities: "Factory operations, supply chain", reportsTo: "CEO", performance: "Strong" }, { name: "Quality Director", title: "VP Quality", responsibilities: "IATF 16949, product quality", reportsTo: "COO", performance: "Adequate" }],
        wayve: [{ name: "Alex Kendall", title: "CEO", responsibilities: "Research direction, fundraising, partnerships", reportsTo: "Board", performance: "Strong" }, { name: "Amar Shah", title: "CTO", responsibilities: "Engineering, fleet ops, safety", reportsTo: "CEO", performance: "Strong" }, { name: "VP Research", title: "VP Research", responsibilities: "ML model development, research team", reportsTo: "CTO", performance: "Strong" }],
      },
      "TMRL:7:2": {
        octopus: { missionStatement: "Use technology and green energy to make energy affordable, sustainable, and customer-friendly for everyone", vision: "Kraken platform powering 100M+ energy accounts globally by 2030, making Octopus the world's largest green energy platform", coreValues: "Customer obsession, Sustainability first, Move fast and learn, Radical transparency, Be the energy company you'd want to buy from", whereDocumented: "Company website, employee handbook, onboarding deck, office walls" },
        northvolt: { missionStatement: "Build the world's greenest battery to enable the European transition to renewable energy and electric transport", vision: "150 GWh production capacity by 2030, becoming Europe's #1 battery manufacturer with the lowest carbon footprint", coreValues: "Sustainability at core, Safety first, Innovation through collaboration, European industrial leadership, Long-term thinking", whereDocumented: "Company website, employee handbook, factory floor displays, investor presentations" },
        wayve: { missionStatement: "Build AI that can drive any vehicle, anywhere — making autonomous mobility safe, scalable, and accessible for all", vision: "World's first AI driver that works on any road without maps, deployed in 50+ cities by 2030", coreValues: "Research excellence, Safety is non-negotiable, Learn from the real world, Simplicity over complexity, Impact at scale", whereDocumented: "Company website, research blog, onboarding materials, Notion wiki" },
      },
      "TMRL:7:3": {
        octopus: { currentHeadcount: "2,500", targetYear1: "3,500", targetYear2: "5,000", keyHires: "VP International (Q1), 50 engineers (rolling), Head of Grid Services (Q2), Regional MDs for new markets", resourceInvestments: "New London office floor, expanded cloud infrastructure, Kraken dev centre in Manchester", budgetForGrowth: "£15M hiring + £5M infrastructure + £3M training" },
        northvolt: { currentHeadcount: "4,000", targetYear1: "5,500", targetYear2: "8,000", keyHires: "VP Sales Energy Storage (Q1), 200 factory workers (rolling), Head of Recycling (Q2), plant managers for Heide", resourceInvestments: "Heide gigafactory construction, recycling R&D facility, expanded R&D centre", budgetForGrowth: "€50M hiring + €4B factory construction + €200M R&D facility" },
        wayve: { currentHeadcount: "300", targetYear1: "500", targetYear2: "800", keyHires: "VP Commercial (Q1), 50 ML researchers (rolling), Head of Government Relations (Q2), fleet expansion team", resourceInvestments: "Expanded compute cluster, additional test vehicles (100+), safety testing facility", budgetForGrowth: "£20M hiring + £30M compute + £10M fleet + £5M facility" },
      },
      "TMRL:7:4": {
        octopus: { onboardingProcess: "2-week structured onboarding: company immersion, team integration, buddy system, 90-day check-in", ldBudget: "£2K per person per year + conference attendance", trainingOpportunities: "Internal tech talks, Udemy access, annual hackathon, mentoring programme, leadership development for managers", performanceReview: "Quarterly 1-on-1s with manager, annual 360° review, bi-annual career development conversations" },
        northvolt: { onboardingProcess: "3-week onboarding: safety training (1 week), role-specific training (1 week), factory immersion (1 week)", ldBudget: "€3K per person per year + €500K annual training programme budget", trainingOpportunities: "Battery academy (internal), university partnerships for advanced degrees, cross-functional rotations, safety certifications", performanceReview: "Monthly 1-on-1s, quarterly performance reviews, annual development planning" },
        wayve: { onboardingProcess: "2-week onboarding: research immersion, safety protocol training, fleet operations shadowing, buddy system", ldBudget: "£3K per person per year + conference/publication budget", trainingOpportunities: "Weekly ML paper club, internal research seminars, conference attendance (NeurIPS, CVPR), 20% research time", performanceReview: "Quarterly 1-on-1s, bi-annual research/engineering reviews, annual career planning" },
      },
      "TMRL:7:5": {
        octopus: [{ name: "Lord Adair Turner", role: "Board Chair", expertise: "Energy policy, financial regulation, governance", meetingCadence: "Monthly", keyContribution: "Strategic direction, government relationships" }, { name: "Energy sector CTO", role: "Technical Advisor", expertise: "Smart grid technology, energy systems", meetingCadence: "Quarterly", keyContribution: "Technical validation and industry credibility" }],
        northvolt: [{ name: "Former VW executive", role: "Board Member", expertise: "Automotive procurement, EV strategy", meetingCadence: "Monthly", keyContribution: "OEM relationship strategy, market insight" }, { name: "Battery recycling expert", role: "Advisor", expertise: "Circular economy, EU battery regulation", meetingCadence: "Quarterly", keyContribution: "Recycling strategy and regulatory compliance guidance" }],
        wayve: [{ name: "Microsoft AI Director", role: "Technical Advisor", expertise: "Large-scale ML, cloud computing, AI safety", meetingCadence: "Monthly", keyContribution: "Azure partnership, ML architecture, AI safety guidance" }, { name: "Former Uber AV lead", role: "Advisor", expertise: "AV commercialisation, fleet operations", meetingCadence: "Quarterly", keyContribution: "Commercialisation strategy, operational scaling" }],
      },
      "TMRL:8:1": {
        octopus: { ceoBackground: "Greg Jackson: serial entrepreneur, co-founded multiple energy tech companies, deep understanding of energy markets and customer technology", managementStrength: "Strong in technology, operations, and customer acquisition. Enterprise B2B sales leadership still developing. International expansion management being built.", keyResourcesInPlace: "London HQ, Kraken platform (£2B+ valuation), AWS infrastructure, 3M+ customer relationships, brand recognition (Which? #1)", resourceUtilisation: "Engineering capacity well-utilised (>90%); office space at 85% utilisation; cloud costs optimised 40% via architecture improvements" },
        northvolt: { ceoBackground: "Peter Carlsson: former VP Supply Chain at Tesla, scaled Gigafactory 1 supply chain, deep OEM network, successful €6B+ fundraising", managementStrength: "Strong in manufacturing, supply chain, fundraising. Quality systems improving rapidly. Need to strengthen energy storage sales team and recycling leadership.", keyResourcesInPlace: "Skellefteå gigafactory (16 GWh), Västerås R&D centre, IATF 16949 certification, $55B order backlog, EU government support", resourceUtilisation: "Factory running at 94% utilisation; R&D facilities well-used; raw materials procurement optimised but still 5% above target cost" },
        wayve: { ceoBackground: "Alex Kendall: PhD Cambridge (computer vision), 50+ publications, raised $1B+, built world-class ML research team, Microsoft strategic partnership", managementStrength: "Exceptional in ML research and talent attraction. Fleet operations management maturing rapidly. Commercial partnerships developing — need experienced VP Commercial.", keyResourcesInPlace: "Azure compute partnership (Microsoft), 50+ test vehicles, safety testing infrastructure, proprietary driving dataset (largest in UK)", resourceUtilisation: "Compute at 85% utilisation; fleet vehicles operating 12hrs/day; research team publishing at top venues while shipping production models" },
      },
      "TMRL:8:2": {
        octopus: { boardComposition: "Lord Adair Turner (Chair), Greg Jackson (CEO), Stuart Jackson (COO), 2 independent NEDs, 1 investor representative", boardDiversity: "Gender: 2 women, 4 men; background: energy, finance, technology, policy; age range 35–65", meetingCadence: "Monthly board meetings, annual strategy offsite, quarterly committee meetings", boardEffectiveness: "Board adds significant value on regulatory strategy and governance. Could improve on international market expertise. Investor representative brings strong financial discipline." },
        northvolt: { boardComposition: "Peter Carlsson (CEO), Paolo Cerruti (COO), VW representative, Goldman Sachs representative, 2 independent NEDs", boardDiversity: "Gender: 2 women, 4 men; background: automotive, finance, chemicals, sustainability; 6 nationalities represented", meetingCadence: "Monthly board meetings, quarterly strategy reviews, annual factory tour for all board members", boardEffectiveness: "Board provides strong OEM and financial oversight. VW rep ensures alignment with key customer. Need to add recycling/circular economy expertise." },
        wayve: { boardComposition: "Alex Kendall (CEO), Microsoft representative, SoftBank representative, Eclipse Ventures partner, 1 independent NED", boardDiversity: "Gender: 1 woman, 4 men; background: AI/ML, automotive, venture capital, robotics; 4 nationalities", meetingCadence: "Monthly board meetings, quarterly strategy reviews, bi-annual research deep-dives", boardEffectiveness: "Board brings strong tech and investment perspective. Microsoft rep ensures compute partnership alignment. Need to add automotive industry and regulatory expertise." },
      },
      "TMRL:8:3": {
        octopus: { hrOwner: "VP People — dedicated HR leadership since 2020", keyPolicies: "Employment contracts, D&I policy, flexible working policy, grievance procedure, equity compensation framework", recruitmentProcess: "Structured interviews (5 stages), technical assessments, culture fit panels, diversity targets (40% women)", employeeHandbook: "Yes" },
        northvolt: { hrOwner: "CHRO — hired from Volvo Cars, team of 15 HR professionals", keyPolicies: "Employment contracts, safety training requirements, D&I policy, relocation support, EU works council compliance", recruitmentProcess: "Structured interviews, factory floor assessments, safety orientation, diversity targets, university graduate programme", employeeHandbook: "Yes" },
        wayve: { hrOwner: "VP People — hired from DeepMind, team of 8 HR professionals", keyPolicies: "Employment contracts, research publication policy, equity compensation, flexible working, visa sponsorship", recruitmentProcess: "Research paper review, technical interviews (3 rounds), safety awareness assessment, culture interview", employeeHandbook: "Yes" },
      },
      "TMRL:8:4": {
        octopus: [{ role: "Head of International Expansion", department: "Strategy", priority: "Critical", status: "Interviewing", targetStartDate: "Q1 2026" }, { role: "Senior ML Engineer (x3)", department: "Engineering", priority: "High", status: "Sourcing", targetStartDate: "Q2 2026" }],
        northvolt: [{ role: "Head of Recycling", department: "R&D", priority: "Critical", status: "Sourcing", targetStartDate: "Q1 2026" }, { role: "Plant Manager (Heide)", department: "Operations", priority: "Critical", status: "Interviewing", targetStartDate: "Q2 2026" }],
        wayve: [{ role: "VP Commercial Partnerships", department: "Business Development", priority: "Critical", status: "Offer", targetStartDate: "Q1 2026" }, { role: "Senior Safety Engineer (x2)", department: "Safety", priority: "High", status: "Sourcing", targetStartDate: "Q1 2026" }],
      },
      "TMRL:8:5": {
        octopus: { lastEngagementSurvey: "Q4 2025 — 4.3/5 (up from 4.1)", trainingCompletionRate: "92% completed required training modules", retentionRate: "88% (12-month rolling)", motivationDrivers: "Mission-driven work (green energy), innovative tech culture, equity participation, flexible working", areasForImprovement: "Career progression clarity for mid-level engineers, cross-team collaboration" },
        northvolt: { lastEngagementSurvey: "Q3 2025 — 3.9/5", trainingCompletionRate: "95% completed safety training, 80% completed role-specific", retentionRate: "82% (12-month rolling)", motivationDrivers: "Building European industrial champion, sustainability mission, competitive pay in northern Sweden, pioneering technology", areasForImprovement: "Work-life balance during factory ramp, remote work options for non-factory roles" },
        wayve: { lastEngagementSurvey: "Q4 2025 — 4.5/5", trainingCompletionRate: "88% completed required training", retentionRate: "90% (12-month rolling — strong for ML industry)", motivationDrivers: "Cutting-edge ML research, real-world impact, publication culture, equity upside, research freedom", areasForImprovement: "Scaling communication as team grows, maintaining research culture at 300+ people" },
      },
      "TMRL:9:1": {
        octopus: { revenuePerEmployee: "£280K", teamSize: "2,500", kpis: "Revenue per employee, NPS (80+), employee satisfaction (4.3/5), platform uptime (99.97%), customer acquisition cost", operationalEfficiency: "Strong: automated customer onboarding (95%), cloud cost optimised (40% reduction). Opportunity: international ops could be more efficient" },
        northvolt: { revenuePerEmployee: "€180K", teamSize: "4,000", kpis: "Revenue per employee, factory utilisation (94%), cell yield (95%+), on-time delivery (99.5%), safety incident rate", operationalEfficiency: "Strong: factory utilisation high, yield improving. Opportunity: raw material costs still 5% above target, logistics could be streamlined" },
        wayve: { revenuePerEmployee: "£150K (pre-revenue — measured by funding per employee and milestones)", teamSize: "300", kpis: "Miles per intervention (200+), papers published (30+/yr), fleet availability (98%), model improvement rate (2x/year), partner satisfaction", operationalEfficiency: "Strong: compute utilisation 85%, fleet operating 12hrs/day. Opportunity: training pipeline efficiency, reducing simulation-to-real gap" },
      },
      "TMRL:9:2": {
        octopus: { ldBudgetPercent: "2.5% of payroll", programmesInPlace: "Leadership development programme, engineering career ladder, management training for new managers, Udemy enterprise access", knowledgeSharing: "Weekly engineering demos, monthly company knowledge share, internal tech blog, cross-team hackathons", externalLearning: "Conference attendance budget (£2K/person), university partnerships for advanced degrees, industry speaker programme" },
        northvolt: { ldBudgetPercent: "3% of payroll", programmesInPlace: "Battery Academy (internal university), leadership development for factory managers, safety certification programme, cross-functional rotations", knowledgeSharing: "Monthly R&D seminars, factory floor knowledge boards, cross-site video conferencing, shared experimental databases", externalLearning: "University partnerships (Uppsala, KTH), industry conference attendance, visiting researcher programme" },
        wayve: { ldBudgetPercent: "4% of payroll (including compute for research)", programmesInPlace: "ML research mentorship, engineering leadership development, safety certification, publication support programme", knowledgeSharing: "Weekly ML paper club, fortnightly research seminars, internal research blog, cross-team ML workshops", externalLearning: "NeurIPS/CVPR/ICRA attendance, university collaborations (Cambridge, Oxford), visiting researcher programme" },
      },
      "TMRL:9:3": {
        octopus: { processReviewCadence: "Quarterly engineering retrospectives, annual company-wide process review, monthly OKR reviews", recentImprovements: "Restructured into product-aligned squads (from function-aligned), automated 95% of customer onboarding, introduced bi-weekly cross-team demos", cultureHealthIndicators: "Employee satisfaction 4.3/5, Glassdoor 4.5/5, voluntary attrition 12%, offer acceptance rate 85%", structuralChanges: "Creating VP International role, establishing Manchester engineering hub, building dedicated Kraken licensing team" },
        northvolt: { processReviewCadence: "Monthly production reviews, quarterly factory-wide retrospectives, annual strategic planning cycle", recentImprovements: "Reduced cell reject rate from 8% to 5%, implemented real-time quality monitoring, restructured R&D into chemistry and process teams", cultureHealthIndicators: "Employee satisfaction 3.9/5, safety incident rate below industry average, voluntary attrition 18% (high due to remote location)", structuralChanges: "Creating Head of Recycling role, establishing Heide factory management team, building dedicated energy storage sales division" },
        wayve: { processReviewCadence: "Bi-weekly engineering retrospectives, monthly research direction reviews, quarterly company strategy reviews", recentImprovements: "Restructured ML team into foundation model and deployment squads, introduced safety review board, improved training pipeline 3x", cultureHealthIndicators: "Employee satisfaction 4.5/5, voluntary attrition 10% (excellent for ML industry), offer acceptance 90%", structuralChanges: "Creating VP Commercial role, establishing dedicated safety engineering department, building government relations function" },
      },
      "TMRL:9:4": {
        octopus: { equityOptions: "EMI options for all employees (vested over 4 years), refresher grants for high performers, ESOP pool: 10% of company", bonusStructure: "Annual bonus: 10-20% base salary tied to company revenue + individual OKRs, spot bonuses for exceptional contributions", nonFinancial: "Flexible working (hybrid, 2 days office), green energy discount, learning budget, team events, 25 days holiday + birthday off", alignmentCheck: "Strong alignment — team motivated by mission (green energy) and equity upside. Retention rate validates incentive effectiveness." },
        northvolt: { equityOptions: "Share options for all employees (4-year vest), additional grants for factory leadership, ESOP pool: 15%", bonusStructure: "Annual bonus: production quality + safety targets (factory), individual OKRs (office), retention bonus for first 2 years", nonFinancial: "Relocation support (northern Sweden), subsidised housing, on-site gym and canteen, 30 days holiday (Swedish standard), parental leave", alignmentCheck: "Incentives drive safety and quality focus. Relocation package essential for talent in remote location. Need to improve retention incentives." },
        wayve: { equityOptions: "EMI options for all employees (4-year vest, 1-year cliff), significant grants for ML researchers, ESOP pool: 20%", bonusStructure: "Annual bonus: company milestones + individual research/engineering impact, publication bonuses, patent bonuses", nonFinancial: "20% research time, conference attendance, publication support, flexible working, team offsites, learning budget (£3K/yr)", alignmentCheck: "Larger ESOP pool and research freedom are key differentiators vs Big Tech. Publication culture attracts top ML talent. Need to ensure commercial impact is also incentivised." },
      },
      "TMRL:9:5": {
        octopus: { successionPlanning: "Identified potential successors for CEO, COO, and VP Engineering roles; documented key responsibilities and transition plans", executiveCoaching: "CEO has external coach (monthly sessions), COO enrolled in scaling leadership programme", managementTraining: "New manager training programme (6-month), leadership development for VPs, annual management offsite", performanceTrend: "Management team rated 4.4/5 by direct reports (up from 4.1 two years ago). Adding international leadership is the next step." },
        northvolt: { successionPlanning: "Succession plans for CEO, COO, and factory plant managers; cross-training programme for critical manufacturing roles", executiveCoaching: "CEO and COO both have external coaches; leadership team attends quarterly executive development programme", managementTraining: "Factory manager certification programme, cross-functional leadership rotations, EU management best practices training", performanceTrend: "Management team growing in capability as factory scales. Quality leadership still needs strengthening. External benchmarking shows strong progress." },
        wayve: { successionPlanning: "Succession plans for CEO, CTO, and VP Research; ML research leads being groomed for VP roles", executiveCoaching: "CEO has external coach (bi-weekly), CTO enrolled in engineering leadership programme", managementTraining: "Research leadership programme for senior ML scientists, engineering management training, safety leadership certification", performanceTrend: "Management team rated 4.6/5 by direct reports. Research leadership world-class. Commercial and operations management maturing as company scales." },
      },
      // FRL example data
      "FRL:1:1": {
        octopus: { keyActivities: "Customer acquisition testing, Agile Octopus tariff MVP, smart meter integration pilot", timeHorizon: "6 months", fundingRequired: "Yes — approximately £500K for initial platform development and customer acquisition testing" },
        northvolt: { keyActivities: "Lab-scale cell production, electrode coating optimisation, VW qualification sample preparation", timeHorizon: "12 months", fundingRequired: "Yes — approximately €50M for pilot production line and R&D materials" },
        wayve: { keyActivities: "End-to-end neural network training, test vehicle fleet setup, simulation platform development", timeHorizon: "9 months", fundingRequired: "Yes — approximately £5M for compute infrastructure, test fleet, and engineering team" },
      },
      "FRL:1:2": {
        octopus: [{ fundingType: "Venture Capital", description: "Equity investment from tech-focused VCs", relevance: "Strong fit — energy tech with platform potential" }, { fundingType: "Revenue/Bootstrapping", description: "Self-funded from early customer revenue", relevance: "Possible once tariff goes live" }],
        northvolt: [{ fundingType: "Strategic Investment", description: "Investment from automotive OEMs", relevance: "Critical — VW as anchor investor + customer" }, { fundingType: "Government Grants", description: "EU green industrialisation funding", relevance: "High — European battery sovereignty agenda" }],
        wayve: [{ fundingType: "Venture Capital", description: "Deep tech VC funding", relevance: "Primary source — capital-intensive AI R&D" }, { fundingType: "Corporate VC", description: "Investment from automotive/tech corporates", relevance: "Microsoft, Uber as strategic partners" }],
      },
      "FRL:2:1": {
        octopus: [{ activity: "Smart meter API integration", purpose: "Enable real-time energy data", estimatedCost: "150000", timeline: "Month 1–3", sourceDimension: "TRL", ipProtectionCost: "" }, { activity: "Customer acquisition pilot", purpose: "Test go-to-market messaging", estimatedCost: "50000", timeline: "Month 2–4", sourceDimension: "CRL", ipProtectionCost: "" }, { activity: "Trademark registration (Kraken)", purpose: "Protect Kraken brand", estimatedCost: "15000", timeline: "Month 1–2", sourceDimension: "IPRL", ipProtectionCost: "15000" }],
        northvolt: [{ activity: "Pilot production line setup", purpose: "Prove manufacturing at scale", estimatedCost: "35000000", timeline: "Month 1–9", sourceDimension: "TRL", ipProtectionCost: "" }, { activity: "OEM qualification testing", purpose: "Meet automotive quality standards", estimatedCost: "5000000", timeline: "Month 6–12", sourceDimension: "TRL", ipProtectionCost: "" }, { activity: "Patent filings (5 initial)", purpose: "Protect cell chemistry innovations", estimatedCost: "250000", timeline: "Month 1–6", sourceDimension: "IPRL", ipProtectionCost: "250000" }],
        wayve: [{ activity: "Training data collection (100K miles)", purpose: "Build driving dataset", estimatedCost: "2000000", timeline: "Month 1–6", sourceDimension: "TRL", ipProtectionCost: "" }, { activity: "Cloud compute for model training", purpose: "Train end-to-end driving model", estimatedCost: "3000000", timeline: "Month 1–9", sourceDimension: "TRL", ipProtectionCost: "" }, { activity: "Patent filings (ML architecture)", purpose: "Protect core algorithms", estimatedCost: "180000", timeline: "Month 2–6", sourceDimension: "IPRL", ipProtectionCost: "180000" }],
      },
      "FRL:2:2": {
        octopus: { totalFundingNeeded: "500000", primarySource: "Octopus Group internal investment", backupSource: "Energy tech grant programmes", keyMilestone: "Launch Agile Octopus tariff to first 1,000 customers" },
        northvolt: { totalFundingNeeded: "50000000", primarySource: "Volkswagen strategic investment + EIB loan", backupSource: "Swedish government green industry grants", keyMilestone: "Build pilot production line, produce first automotive-grade cells" },
        wayve: { totalFundingNeeded: "5000000", primarySource: "Seed round from deep tech VCs", backupSource: "UK government AI research grants", keyMilestone: "Demonstrate autonomous driving in London without HD maps" },
      },
      "FRL:3:1": {
        octopus: { fundingNeeded: "500000", amountSecured: "600000", sources: "Octopus Group (£500K internal) + Ofgem Innovation Fund (£100K)", conditions: "Innovation fund requires open-source API documentation", runway: "8 months at current burn rate" },
        northvolt: { fundingNeeded: "50000000", amountSecured: "52000000", sources: "Volkswagen (€30M equity) + European Investment Bank (€12M loan) + Swedish Energy Agency (€10M grant)", conditions: "VW supply agreement contingent on quality milestones; EIB requires quarterly reporting", runway: "14 months for pilot phase" },
        wayve: { fundingNeeded: "5000000", amountSecured: "5500000", sources: "Compound VC (£2M lead) + Balderton Capital (£1.5M) + Cambridge Enterprise (£500K) + Innovate UK (£1.5M)", conditions: "Standard seed terms; Innovate UK grant requires UK-based R&D", runway: "12 months at current team size" },
      },
      "FRL:3:2": {
        octopus: [{ fundingType: "Internal/Corporate", pros: "Fast, no external governance", cons: "Limited scale", suitability: "High — perfect for MVP stage" }, { fundingType: "Government grants", pros: "Non-dilutive, validation signal", cons: "Slow application process, reporting burden", suitability: "Medium — useful supplement" }],
        northvolt: [{ fundingType: "Strategic investment", pros: "Anchor customer + capital, market signal", cons: "Potential exclusivity pressure", suitability: "High — VW deal is critical" }, { fundingType: "Development bank loans", pros: "Low interest, large scale", cons: "Repayment obligations, covenants", suitability: "High — EIB is ideal for capex" }],
        wayve: [{ fundingType: "Venture Capital", pros: "Large cheques, tech expertise, follow-on", cons: "Dilutive, board pressure for growth", suitability: "High — standard for deep tech AI" }, { fundingType: "Government grants", pros: "Non-dilutive, legitimacy", cons: "Slow, restrictive on IP", suitability: "Medium — good for specific R&D projects" }],
      },
      "FRL:4:1": {
        octopus: { commercialHypotheses: "Customers will switch for 15%+ savings on dynamic tariffs; Kraken platform can be licensed to other utilities", activitiesPlanned: "Scale to 100K customers, launch Agile Octopus nationally, first Kraken licensing deal", timeline: "12 months", totalBudget: "5000000", keyMilestones: "100K customers, £10M ARR, first international Kraken license signed" },
        northvolt: { commercialHypotheses: "European OEMs will pay 5-10% premium for local, low-carbon batteries; gigafactory yield >95% achievable", activitiesPlanned: "Scale pilot to 1GWh, complete VW/BMW qualification, begin gigafactory construction", timeline: "18 months", totalBudget: "200000000", keyMilestones: "First gigafactory breaking ground, 3 OEM qualifications complete, $5B order backlog" },
        wayve: { commercialHypotheses: "End-to-end learned driving generalises to new cities without retraining; fleet partners will pay per-mile", activitiesPlanned: "Expand to 3 UK cities, Asda delivery pilot, begin Uber integration", timeline: "12 months", totalBudget: "20000000", keyMilestones: "100+ miles/intervention, 3 fleet partners signed, Uber pilot launched" },
      },
      "FRL:4:2": {
        octopus: [{ source: "Octopus Group", type: "Equity", amountTargeted: "3000000", status: "Committed", timeline: "Immediate" }, { source: "Amazon", type: "Strategic equity", amountTargeted: "10000000", status: "In discussions", timeline: "6 months" }],
        northvolt: [{ source: "Goldman Sachs", type: "Equity", amountTargeted: "100000000", status: "Term sheet", timeline: "3 months" }, { source: "European Investment Bank", type: "Debt", amountTargeted: "50000000", status: "Application submitted", timeline: "6 months" }, { source: "Swedish Government", type: "Grant", amountTargeted: "30000000", status: "Approved", timeline: "Immediate" }],
        wayve: [{ source: "Eclipse Ventures", type: "Equity", amountTargeted: "10000000", status: "Due diligence", timeline: "2 months" }, { source: "Microsoft", type: "Strategic equity", amountTargeted: "5000000", status: "In discussions", timeline: "4 months" }],
      },
      "FRL:4:3": {
        octopus: { planBudget: "5000000", totalSecured: "4500000", breakdown: "Octopus Group: £3M equity, Amazon: negotiations ongoing, Ofgem innovation: £500K", gapRemaining: "£500K — expect to close Amazon deal within 3 months", runway: "10 months" },
        northvolt: { planBudget: "200000000", totalSecured: "180000000", breakdown: "Goldman Sachs: €100M equity, EIB: €50M loan, Swedish Government: €30M grant", gapRemaining: "€20M — covered by additional investor interest", runway: "16 months for Phase 1" },
        wayve: { planBudget: "20000000", totalSecured: "15000000", breakdown: "Eclipse Ventures: £10M (Series A lead), Microsoft: £5M strategic", gapRemaining: "£5M — targeting additional VC participation", runway: "14 months" },
      },
      "FRL:5:1": {
        octopus: [{ audience: "Energy tech investor panel", date: "2018-06-15", keyFeedback: "Need to show customer acquisition cost declining", changeMade: "Added CAC trend data showing 40% reduction over 6 months" }, { audience: "Amazon corporate development", date: "2018-09-01", keyFeedback: "Kraken platform licensing is the real value", changeMade: "Repositioned pitch around Kraken platform play, not just UK retail" }],
        northvolt: [{ audience: "Goldman Sachs partners", date: "2019-03-01", keyFeedback: "Need clearer path to cost parity with Asian producers", changeMade: "Added detailed manufacturing cost roadmap showing parity by 2023" }, { audience: "EU Commissioner for Energy", date: "2019-05-15", keyFeedback: "Emphasise European energy sovereignty angle", changeMade: "Added EU supply chain risk slide with CATL/BYD dependency data" }],
        wayve: [{ audience: "Eclipse Ventures partners", date: "2021-01-15", keyFeedback: "Show safety metrics vs competitors", changeMade: "Added miles-per-intervention benchmarking vs Waymo/Cruise" }, { audience: "Microsoft M12 team", date: "2021-04-01", keyFeedback: "Highlight compute efficiency advantage", changeMade: "Added training efficiency comparison showing 10x less data needed vs competitors" }],
      },
      "FRL:5:2": {
        octopus: { revenueForecast: "50000000", costForecast: "35000000", monthlyCashBurn: "2500000", breakEvenTarget: "Month 18", pitchTestedWith: "8 investors, 3 strategic partners", overallFeedback: "Strong unit economics, questions about regulatory risk and energy price cap impact" },
        northvolt: { revenueForecast: "200000000", costForecast: "300000000", monthlyCashBurn: "25000000", breakEvenTarget: "Month 36", pitchTestedWith: "12 institutional investors, 5 OEM partners", overallFeedback: "Compelling European sovereignty thesis; concerns about execution risk and capital intensity" },
        wayve: { revenueForecast: "2000000", costForecast: "15000000", monthlyCashBurn: "1200000", breakEvenTarget: "Month 48", pitchTestedWith: "10 VCs, 3 corporate investors", overallFeedback: "Best end-to-end approach in market; questions about regulatory timeline for driverless operation" },
      },
      "FRL:5:3": {
        octopus: { nearTermNeed: "15000000", targetSources: "Series A: £10M VC + £5M Amazon strategic", fundingTimeline: "Close Series A by Q3 2019", dilutionBudget: "Willing to give up 20-25% at Series A", backupPlan: "Revenue growing fast enough to extend runway 6 months; could do smaller bridge round" },
        northvolt: { nearTermNeed: "750000000", targetSources: "Series B: €500M equity + €250M project finance", fundingTimeline: "Close by Q1 2020 to start gigafactory construction", dilutionBudget: "15-20% dilution at Series B; protect founder veto on key decisions", backupPlan: "Phase gigafactory construction; increase OEM pre-payment requirements" },
        wayve: { nearTermNeed: "50000000", targetSources: "Series B: £30M VC + £20M Microsoft strategic", fundingTimeline: "Close by Q2 2022", dilutionBudget: "20% dilution at Series B", backupPlan: "Focus on fewer cities; reduce fleet size to extend runway" },
      },
      "FRL:5:4": {
        octopus: { currentOwnership: "Greg Jackson: 40%, Octopus Group: 50%, Early employees: 10%", equityDilution: "Founders + Group will own ~75% post-Series A", boardChanges: "One VC board observer seat; no veto rights", reportingObligations: "Monthly financial update to investors; quarterly board meeting", growthExpectations: "10x revenue within 3 years; international expansion" },
        northvolt: { currentOwnership: "Peter Carlsson: 15%, Paolo Cerruti: 10%, VW: 20%, Other investors: 40%, ESOP: 15%", equityDilution: "Founders will own ~18% post-Series B (with anti-dilution)", boardChanges: "2 investor board seats; VW retains strategic partnership veto", reportingObligations: "Monthly board reporting, quarterly investor calls, annual strategy review", growthExpectations: "Path to profitability by 2025; 100GWh capacity by 2030" },
        wayve: { currentOwnership: "Alex Kendall: 25%, Co-founders: 15%, Seed investors: 30%, ESOP: 30%", equityDilution: "Founders will own ~20% post-Series B", boardChanges: "Lead investor board seat; founder retains majority board control", reportingObligations: "Monthly investor update; quarterly board meetings", growthExpectations: "Commercial deployment within 3 years; major OEM partnership" },
      },
      "FRL:6:1": {
        octopus: [{ funder: "Amazon", type: "CVC", stageOfEngagement: "Due diligence complete", interestLevel: "Hot", nextStep: "Final term sheet negotiation", pitchContext: "4 pitch iterations logged" }, { funder: "Generation Investment Management", type: "VC", stageOfEngagement: "Second meeting", interestLevel: "Warm", nextStep: "Management presentation", pitchContext: "4 pitch iterations logged" }],
        northvolt: [{ funder: "Goldman Sachs", type: "VC", stageOfEngagement: "Term sheet signed", interestLevel: "Hot", nextStep: "Complete legal DD", pitchContext: "5 pitch iterations logged" }, { funder: "BlackRock", type: "VC", stageOfEngagement: "First meeting", interestLevel: "Warm", nextStep: "Send detailed financial model", pitchContext: "5 pitch iterations logged" }, { funder: "IKEA Foundation", type: "CVC", stageOfEngagement: "DD in progress", interestLevel: "Hot", nextStep: "Site visit to Västerås", pitchContext: "5 pitch iterations logged" }],
        wayve: [{ funder: "Microsoft", type: "CVC", stageOfEngagement: "Strategic partnership agreed", interestLevel: "Hot", nextStep: "Finalise investment terms alongside Azure deal", pitchContext: "3 pitch iterations logged" }, { funder: "Eclipse Ventures", type: "VC", stageOfEngagement: "Term sheet discussions", interestLevel: "Hot", nextStep: "Board approval", pitchContext: "3 pitch iterations logged" }],
      },
      "FRL:6:2": {
        octopus: { year1RevenueCost: "£50M / £35M", year3RevenueCost: "£2B / £1.5B", year5RevenueCost: "£6B / £4.5B", totalFundingRequired: "20000000", fundingRoundsPlanned: "Series A: £15M (closing), Series B: £100M (Month 24 if needed, may not need given revenue growth)" },
        northvolt: { year1RevenueCost: "€200M / €300M", year3RevenueCost: "€2B / €1.8B", year5RevenueCost: "€8B / €6B", totalFundingRequired: "5000000000", fundingRoundsPlanned: "Series B: €750M (now), Project finance: €2B (Year 2), Series C/IPO: €2B+ (Year 3-4)" },
        wayve: { year1RevenueCost: "£2M / £15M", year3RevenueCost: "£50M / £40M", year5RevenueCost: "£500M / £300M", totalFundingRequired: "200000000", fundingRoundsPlanned: "Series B: £50M (now), Series C: £150M (Month 18)" },
      },
      "FRL:7:1": {
        octopus: [{ funder: "Amazon", amount: "10000000", valuationTerms: "£200M pre-money, preferred shares", status: "Term sheet signed", keyConditions: "Kraken licensing exclusivity discussions" }],
        northvolt: [{ funder: "Goldman Sachs-led consortium", amount: "750000000", valuationTerms: "€3B pre-money, Series B preferred", status: "Term sheet signed, legal DD", keyConditions: "Gigafactory construction milestones; VW supply agreement renewal" }, { funder: "IKEA Foundation", amount: "100000000", valuationTerms: "Same terms as lead", status: "Verbal commitment", keyConditions: "Subject to lead close" }],
        wayve: [{ funder: "Eclipse Ventures + Microsoft", amount: "50000000", valuationTerms: "£200M pre-money, Series B preferred", status: "Term sheet received", keyConditions: "Safety milestone (100+ mi/intervention); Microsoft Azure commitment" }],
      },
      "FRL:7:2": {
        octopus: { pitchDeckStatus: "v8, tested with 12+ investors including Amazon", businessPlan: "Full business plan with Kraken platform licensing model", customerEvidence: "3M+ UK customers, 85% retention, NPS 80+, Agile Octopus delivering 15% savings", technologyEvidence: "Kraken platform operational, processing 100M+ meter readings/day, 99.97% uptime", ipEvidence: "Kraken platform trade secrets, proprietary pricing algorithms, brand trademark", financialModel: "5-year model showing profitability by Year 2, Kraken licensing adds £2B+ revenue stream", teamCapTable: "Greg Jackson (CEO), strong engineering team, Octopus Group 50% → diluting to ~40%", dataRoomPlatform: "DocSend", missingDocuments: "Updated Kraken licensing term sheet template" },
        northvolt: { pitchDeckStatus: "v12, presented to 20+ institutional investors", businessPlan: "Comprehensive gigafactory business plan with 10-year model", customerEvidence: "$55B order backlog from VW, BMW, Volvo; 100% contract renewal", technologyEvidence: "Pilot line producing automotive-grade cells, 95%+ yield, 258 Wh/kg", ipEvidence: "25+ patents filed covering cell chemistry, manufacturing process, recycling; FTO complete", financialModel: "10-year model showing profitability at 40 GWh scale (Year 4), IRR >25%", teamCapTable: "Peter Carlsson (CEO), 500+ employees, founders 25% → diluting to ~18%", dataRoomPlatform: "Intralinks", missingDocuments: "Updated environmental impact assessment for gigafactory expansion" },
        wayve: { pitchDeckStatus: "v6, tested with 15 investors", businessPlan: "Technology-led plan focused on platform licensing model", customerEvidence: "5 fleet partners, 3 active pilots, 100% pilot renewal, Asda/Ocado positive feedback", technologyEvidence: "120+ miles per intervention, works across 3 cities, no HD maps needed", ipEvidence: "12 patents filed on end-to-end driving architecture; key ML innovations protected", financialModel: "5-year model, breakeven at scale in Year 4, £500M revenue target Year 5", teamCapTable: "Alex Kendall (CEO), 80+ team, founders 40% → 20% post-Series B", dataRoomPlatform: "Google Drive (organised)", missingDocuments: "Regulatory engagement timeline document" },
      },
      "FRL:7:3": {
        octopus: { accountingSystem: "Xero with integrated bank feeds", bookkeepingCurrent: "Yes — updated weekly", bankStatements: "Available for 24 months", keyContracts: "Ofgem licence, energy supply agreements, Kraken licensing template", legalEntity: "Octopus Energy Ltd, UK Ltd company, properly incorporated" },
        northvolt: { accountingSystem: "SAP S/4HANA (enterprise-grade)", bookkeepingCurrent: "Yes — updated daily", bankStatements: "Available for 36 months across multiple entities", keyContracts: "VW supply agreement, EIB loan facility, land lease agreements, employment contracts for 500+ staff", legalEntity: "Northvolt AB, Swedish corporation, proper governance structure" },
        wayve: { accountingSystem: "Xero", bookkeepingCurrent: "Yes — updated monthly", bankStatements: "Available for 18 months", keyContracts: "Asda pilot agreement, Microsoft Azure partnership, employee contracts, IP assignment agreements", legalEntity: "Wayve Technologies Ltd, UK Ltd company, articles of association in place" },
      },
      "FRL:8:1": {
        octopus: { leadInvestor: "Amazon", roundSize: "10000000", termsAgreed: "£200M pre-money, preferred shares with standard protections", ddStatus: "Complete — legal and financial DD passed", expectedCloseDate: "2019-05-15" },
        northvolt: { leadInvestor: "Goldman Sachs-led consortium", roundSize: "1000000000", termsAgreed: "€3B pre-money, Series B preferred, 2 board seats", ddStatus: "Legal DD 90% complete; environmental DD pending final report", expectedCloseDate: "2020-06-30" },
        wayve: { leadInvestor: "Eclipse Ventures", roundSize: "50000000", termsAgreed: "£200M pre-money, Series B preferred, 1 board seat, Microsoft co-invest", ddStatus: "Technical DD complete, legal DD in final review", expectedCloseDate: "2022-03-01" },
      },
      "FRL:8:2": {
        octopus: [{ document: "Share Purchase Agreement", status: "Reviewed", lastUpdated: "2019-04-20" }, { document: "Articles of Association (updated)", status: "Drafted", lastUpdated: "2019-04-15" }, { document: "Disclosure letter", status: "Drafted", lastUpdated: "2019-04-18" }],
        northvolt: [{ document: "Shareholders Agreement", status: "Reviewed", lastUpdated: "2020-05-10" }, { document: "Subscription Agreement", status: "Drafted", lastUpdated: "2020-05-08" }, { document: "Board composition agreement", status: "Reviewed", lastUpdated: "2020-05-12" }, { document: "IP assignment confirmation", status: "Signed", lastUpdated: "2020-04-01" }],
        wayve: [{ document: "Share Purchase Agreement", status: "Reviewed", lastUpdated: "2022-02-10" }, { document: "Investor Rights Agreement", status: "Drafted", lastUpdated: "2022-02-08" }, { document: "IP assignment certificates", status: "Signed", lastUpdated: "2022-01-15" }],
      },
      "FRL:8:3": {
        octopus: { legalEntity: "Octopus Energy Ltd, UK Ltd company", currentCapTable: "Greg Jackson: 40%, Octopus Group: 50%, ESOP: 10%", postRoundCapTable: "Greg Jackson: 35%, Octopus Group: 43%, Amazon: 5%, ESOP: 17%", shareClassStructure: "Ordinary shares + Series A preferred (Amazon)", knownIssues: "None — clean cap table" },
        northvolt: { legalEntity: "Northvolt AB, Swedish corporation", currentCapTable: "Founders: 25%, VW: 20%, Seed investors: 40%, ESOP: 15%", postRoundCapTable: "Founders: 18%, VW: 15%, Goldman consortium: 25%, Other investors: 30%, ESOP: 12%", shareClassStructure: "Common shares + Series B preferred with liquidation preference", knownIssues: "Need to harmonise VW preferred rights with new investor terms" },
        wayve: { legalEntity: "Wayve Technologies Ltd, UK Ltd company", currentCapTable: "Founders: 40%, Seed investors: 30%, ESOP: 30%", postRoundCapTable: "Founders: 20%, Seed: 15%, Eclipse/Microsoft: 25%, ESOP: 25%, Other: 15%", shareClassStructure: "Ordinary shares + Series B preferred", knownIssues: "SAFE notes from pre-seed need conversion — terms agreed" },
      },
      "FRL:8:4": {
        octopus: { dataRoomPlatform: "DocSend", legalComplete: "✓ Cap table clean, articles updated, Ofgem licence current", financialComplete: "✓ 3-year audited accounts, 5-year model, monthly management accounts", ipComplete: "✓ Kraken trademarks registered, trade secrets documented", ipAgreements: "✓ Kraken licensing agreements (3), trademark registrations (5)", commercialComplete: "✓ Customer metrics dashboard, key contracts, Kraken licensing pipeline", accountingStatus: "✓ Accounting & documentation present", lastReviewed: "2019-04-25" },
        northvolt: { dataRoomPlatform: "Intralinks", legalComplete: "✓ Swedish corporate filings, board minutes, employment contracts for key staff", financialComplete: "✓ Audited accounts, 10-year model, VW supply contract financials", ipComplete: "✓ 25+ patents filed, FTO report, IP assignment confirmations", ipAgreements: "✓ 25 patent filings, VW cross-licensing agreement, 3 IP assignment confirmations", commercialComplete: "✓ $55B order backlog documentation, OEM qualification reports", accountingStatus: "✓ Accounting & documentation present", lastReviewed: "2020-05-20" },
        wayve: { dataRoomPlatform: "Google Drive (organised)", legalComplete: "✓ UK Ltd filings current, articles in place, SAFE conversion terms agreed", financialComplete: "✓ 18-month accounts, 5-year model, burn analysis", ipComplete: "✓ 12 patents filed, ML architecture IP documented, FTO assessment", ipAgreements: "✓ 12 patent filings, ML architecture trade secret documentation", commercialComplete: "✓ Pilot agreements, Asda/Ocado results, Uber partnership terms", accountingStatus: "✓ Accounting & documentation present", lastReviewed: "2022-02-15" },
      },
      "FRL:9:1": {
        octopus: { roundCompleted: "Series A — Amazon strategic investment", amountRaised: "10000000", keyInvestors: "Amazon (lead), existing Octopus Group participation", runway: "18 months (though approaching cash-flow positive)", keyMilestones: "Scale to 1M customers, launch Kraken licensing internationally, achieve profitability" },
        northvolt: { roundCompleted: "Series B — Goldman Sachs-led mega-round", amountRaised: "1000000000", keyInvestors: "Goldman Sachs (lead), IKEA Foundation, Volkswagen (follow-on), BlackRock", runway: "30 months for gigafactory Phase 1", keyMilestones: "Complete gigafactory construction, reach 16 GWh annual production, begin Heide factory" },
        wayve: { roundCompleted: "Series B — Eclipse/Microsoft co-led", amountRaised: "50000000", keyInvestors: "Eclipse Ventures (co-lead), Microsoft (co-lead), existing investors", runway: "24 months at planned team growth", keyMilestones: "200+ miles/intervention, expand to 5 cities, launch Uber commercial pilot, begin US expansion planning" },
      },
      "FRL:9:2": {
        octopus: { accountingSystem: "Xero with Syft Analytics integration", reportingCadence: "Monthly P&L, weekly cash-flow, quarterly board pack", budgetingProcess: "Annual budget with monthly reforecasts; department-level budgets", kpiDashboard: "Custom internal dashboard: customer acquisition, retention, ARPU, Kraken licensing revenue", auditReview: "Annual audit by Deloitte" },
        northvolt: { accountingSystem: "SAP S/4HANA with real-time cost tracking", reportingCadence: "Daily production costs, weekly cash-flow, monthly P&L, quarterly board + investor pack", budgetingProcess: "Rolling 18-month forecast with monthly variance analysis", kpiDashboard: "Power BI dashboard: production volume, yield, cost/kWh, order backlog, capex vs plan", auditReview: "Annual audit by KPMG; quarterly internal audit" },
        wayve: { accountingSystem: "Xero with Float cash-flow forecasting", reportingCadence: "Monthly P&L and burn analysis, quarterly board pack, monthly investor email", budgetingProcess: "Annual budget with quarterly reforecasts; R&D vs commercial split tracked", kpiDashboard: "Notion + custom dashboard: miles/intervention, cities deployed, fleet utilisation, compute efficiency", auditReview: "Annual review by mid-tier firm; preparing for full audit ahead of Series C" },
      },

      // IPRL example data
      "IPRL:1:1": {
        octopus: { protectable: "Kraken platform — dynamic pricing algorithms and smart meter data processing", defensibilityType: "Trade secret, software copyright, brand", differentiationHypothesis: "Tech-powered dynamic tariffs with 100% renewable sourcing that incumbents can't match" },
        northvolt: { protectable: "NMC 811 cathode formulation and gigafactory process know-how", defensibilityType: "Patent, trade secret", differentiationHypothesis: "Lowest carbon footprint in industry with fully European supply chain" },
        wayve: { protectable: "End-to-end deep learning driving model and training pipeline", defensibilityType: "Patent, trade secret, data advantage", differentiationHypothesis: "AI that generalises to any road without HD maps — no competitor can match this" },
      },
      "IPRL:1:2": {
        octopus: [{ asset: "Dynamic pricing algorithm", iprType: "Trade secret", differentiationAngle: "Real-time pricing no other supplier offers", confidence: "High" }, { asset: "Kraken platform architecture", iprType: "Copyright", differentiationAngle: "Scalable energy platform licensable globally", confidence: "High" }],
        northvolt: [{ asset: "NMC 811 cathode formulation", iprType: "Patent", differentiationAngle: "Higher energy density at lower cost", confidence: "High" }, { asset: "Low-carbon manufacturing process", iprType: "Trade secret", differentiationAngle: "71% lower carbon footprint than industry average", confidence: "Medium" }],
        wayve: [{ asset: "End-to-end driving neural network", iprType: "Patent", differentiationAngle: "No HD map dependency — works anywhere", confidence: "High" }, { asset: "Driving data training pipeline", iprType: "Trade secret", differentiationAngle: "Proprietary dataset of 1M+ miles", confidence: "High" }],
      },
      "IPRL:1:3": {
        octopus: { coreIpDescription: "Cloud-based energy technology platform that ingests smart meter data, runs ML demand forecasts, and sets half-hourly tariff prices automatically", whyNovel: "No other energy supplier combines real-time dynamic pricing with ML forecasting at consumer scale", otherDefensibility: "Network effects from 50M+ accounts globally via Kraken licensing; brand recognition as UK's #1 rated energy company" },
        northvolt: { coreIpDescription: "Novel NMC 811 cathode composition with proprietary binder system enabling 265 Wh/kg energy density at scale", whyNovel: "Unique combination of high nickel content with stability — no other European manufacturer has achieved this at gigafactory scale", otherDefensibility: "First-mover advantage in European battery manufacturing; €55B order backlog creates switching costs" },
        wayve: { coreIpDescription: "Neural network architecture that maps raw sensor data directly to driving actions without intermediate HD map or rule-based modules", whyNovel: "Only company successfully deploying end-to-end learned driving on public roads; competitors use rule-based stacks", otherDefensibility: "Data advantage from 1M+ miles of real-world driving data; Microsoft partnership for compute" },
      },
      "IPRL:1:4": {
        octopus: { whoCreated: "In-house engineering team at Octopus Energy", ownershipStatus: "Company owns all IP — all employees have IP assignment clauses", useRightRestrictions: "None — all developed in-house", ipPolicies: "Standard employee IP assignment in employment contracts" },
        northvolt: { whoCreated: "R&D team at Northvolt, some based on former Tesla/CATL experience", ownershipStatus: "Company owns core IP; some background IP from founders' prior experience reviewed", useRightRestrictions: "No restrictive covenants identified from prior employers", ipPolicies: "Swedish employment IP law — employer owns work-related inventions; all employees signed IP assignment" },
        wayve: { whoCreated: "Alex Kendall (CEO) and ML research team; foundational work from Cambridge University PhD", ownershipStatus: "University IP licence obtained for foundational research; all subsequent work owned by company", useRightRestrictions: "Cambridge licence is non-exclusive for foundational research methods", ipPolicies: "Cambridge University IP policy — spin-out licence agreement in place" },
      },
      "IPRL:1:5": {
        octopus: [{ publication: "Real-time pricing in electricity markets", author: "Borenstein & Holland, 2005", keyFinding: "Dynamic pricing can reduce peak demand by 10-15%", relevance: "Validates our dynamic pricing approach; our ML improvement is novel" }],
        northvolt: [{ publication: "High-nickel layered oxide cathodes for Li-ion batteries", author: "Manthiram, 2020", keyFinding: "NMC 811 achieves high energy density but stability challenges remain", relevance: "Our proprietary binder system solves the stability problem identified" }],
        wayve: [{ publication: "End-to-End Learning for Self-Driving Cars", author: "Bojarski et al. (NVIDIA), 2016", keyFinding: "Neural networks can learn steering from images alone", relevance: "Foundational work; we extend to full driving stack with multi-modal inputs" }],
      },
      "IPRL:2:1": {
        octopus: [{ category: "Technology", specificAsset: "Kraken dynamic pricing engine", type: "Trade secret", status: "Active", strength: "High" }, { category: "Brand", specificAsset: "Octopus Energy brand + customer community", type: "Trademark", status: "Active", strength: "High" }],
        northvolt: [{ category: "Technology", specificAsset: "NMC 811 cathode formulation", type: "Patent", status: "Pending", strength: "High" }, { category: "Process", specificAsset: "Low-carbon manufacturing process", type: "Trade secret", status: "Active", strength: "Medium" }],
        wayve: [{ category: "Technology", specificAsset: "End-to-end driving neural network", type: "Patent", status: "Pending", strength: "High" }, { category: "Data", specificAsset: "1M+ miles real-world driving dataset", type: "Trade secret", status: "Active", strength: "High" }],
      },
      "IPRL:2:2": {
        octopus: [{ idea: "Smart grid optimisation method", description: "ML-based algorithm for balancing renewable generation with consumer demand", protectionRoute: "Trade secret (competitive advantage)", priority: "High" }],
        northvolt: [{ idea: "Cathode binder system patent", description: "Novel binder composition for high-nickel cathodes enabling stability at scale", protectionRoute: "PCT patent application", priority: "High" }],
        wayve: [{ idea: "Sensor fusion architecture patent", description: "Novel method for combining camera and LiDAR data for end-to-end driving", protectionRoute: "PCT patent application", priority: "High" }],
      },
      "IPRL:2:3": {
        octopus: { inventors: "Greg Jackson (CEO/CTO), Engineering leads — 8 named contributors to core platform", ownershipAgreements: "All employees have IP assignment clauses; contractor agreements include IP transfer", gaps: "No gaps — fully in-house development team", applicablePolicies: "UK employment IP law; company IP policy in employee handbook", legalCounsel: "Yes — Bristows LLP for IP matters" },
        northvolt: { inventors: "Peter Carlsson (CEO), Dr. Sanna Holmström (Head of R&D), 12 named electrochemists", ownershipAgreements: "All employees signed IP assignment; university collaboration agreement with Uppsala University", gaps: "Two former Tesla engineers — reviewed their non-compete agreements, no conflict identified", applicablePolicies: "Swedish IP law; Northvolt IP policy; university collaboration terms", legalCounsel: "Yes — Awapatent AB for patents, Mannheimer Swartling for commercial IP" },
        wayve: { inventors: "Alex Kendall (CEO), 8 ML researchers named as inventors on patent applications", ownershipAgreements: "Cambridge University spin-out licence; all employees have IP assignment; Microsoft collaboration agreement preserves Wayve IP", gaps: "One researcher previously at DeepMind — reviewed prior employer IP clauses, no overlap", applicablePolicies: "Cambridge University IP policy; UK employment IP law; Microsoft Azure partnership terms", legalCounsel: "Yes — Marks & Clerk for patents, Bird & Bird for commercial IP" },
      },
      "IPRL:3:1": {
        octopus: [{ iprAsset: "Kraken dynamic pricing engine", protectionMethod: "Trade secret", commercialValue: "Critical", costToProtect: "£5K (confidentiality systems)", priority: "1" }, { iprAsset: "Octopus Energy brand", protectionMethod: "Trademark", commercialValue: "High", costToProtect: "£10K (multi-jurisdiction)", priority: "2" }],
        northvolt: [{ iprAsset: "NMC 811 cathode formulation", protectionMethod: "Patent (PCT)", commercialValue: "Critical", costToProtect: "£30K (PCT + national phase)", priority: "1" }, { iprAsset: "Low-carbon manufacturing process", protectionMethod: "Trade secret", commercialValue: "High", costToProtect: "£5K (confidentiality systems)", priority: "2" }],
        wayve: [{ iprAsset: "End-to-end driving neural network", protectionMethod: "Patent (PCT)", commercialValue: "Critical", costToProtect: "£25K (PCT + national phase)", priority: "1" }, { iprAsset: "Training data pipeline", protectionMethod: "Trade secret", commercialValue: "Critical", costToProtect: "£3K (access controls)", priority: "2" }],
      },
      "IPRL:3:2": {
        octopus: { detailedIpDescription: "ML-powered energy platform combining real-time smart meter data ingestion (100M+ readings/day), demand forecasting (93% accuracy), and dynamic pricing algorithms to set half-hourly tariffs", noveltyAssessment: "No other energy supplier combines ML forecasting with real-time consumer pricing at this scale; traditional utilities use static tariffs", nonObviousnessArgument: "The combination of ML demand forecasting with real-time dynamic consumer pricing required novel approaches to data processing latency, forecast accuracy at scale, and consumer UX design", differentiationMap: "Technology: ML pricing engine (unique); UX: Consumer-facing dynamic tariff (unique); Business model: Platform licensing (Kraken); Cost: Lower customer acquisition cost via tech; Speed: Sub-second pricing decisions" },
        northvolt: { detailedIpDescription: "High-energy-density NMC 811 cathode using proprietary binder system that enables stable cycling at >250 Wh/kg while maintaining >1500 cycle life at scale production", noveltyAssessment: "Proprietary binder composition solves the well-known stability-vs-density trade-off in high-nickel cathodes — no published prior art shows this approach", nonObviousnessArgument: "The binder system mechanism was counter-intuitive — industry assumed ceramic coatings were needed; our polymer approach was unexpected and required 18 months of iteration", differentiationMap: "Technology: Unique cathode chemistry (patentable); Cost: Competitive with Asian manufacturers; ESG: 71% lower carbon footprint; Business model: European supply chain sovereignty" },
        wayve: { detailedIpDescription: "Multimodal transformer architecture that processes camera and LiDAR inputs end-to-end to output driving actions, trained on 1M+ miles of real-world driving data via imitation learning", noveltyAssessment: "Only company successfully deploying end-to-end learned driving without HD maps or hand-coded rules on public roads", nonObviousnessArgument: "Industry consensus was that end-to-end learning couldn't handle safety-critical driving; our world model approach provides interpretability while maintaining generalisation", differentiationMap: "Technology: End-to-end learning (unique architecture); Cost: 84% lower cost per mile vs HD-map competitors; Speed: Deploy in new city in 2 weeks vs 6+ months; Business model: Software-only platform" },
      },
      "IPRL:3:3": {
        octopus: [{ searchType: "Patent database search", scope: "Dynamic energy pricing, smart meter ML, demand response", keyFindings: "50+ patents found; most relate to grid-level optimisation, not consumer-facing dynamic pricing", impactOnIp: "FTO confirmed — our consumer-facing application is distinct from grid-level patents" }],
        northvolt: [{ searchType: "PatSnap + Espacenet", scope: "NMC cathode compositions, binder systems, high-nickel cathodes", keyFindings: "200+ patents reviewed; LG and Samsung hold related NMC patents but different binder approaches", impactOnIp: "FTO largely confirmed; need to design around LG patent EP3456789 on electrode coating process" }],
        wayve: [{ searchType: "Google Patents + academic literature", scope: "End-to-end autonomous driving, learned driving models, sensor fusion", keyFindings: "30+ patents from Waymo, Tesla, Cruise; mostly rule-based or hybrid approaches", impactOnIp: "FTO confirmed — pure end-to-end approach without HD maps is novel and distinct from competitor IP" }],
      },
      "IPRL:3:4": {
        octopus: [{ competitor: "British Gas (Centrica)", theirIp: "Legacy billing systems, brand recognition", yourDifferentiation: "ML-powered dynamic pricing, modern tech platform", defensibilityGap: "Need to protect Kraken platform architecture via trade secrets" }],
        northvolt: [{ competitor: "CATL", theirIp: "2000+ patents on cell chemistry and manufacturing", yourDifferentiation: "European supply chain, lowest carbon footprint, NMC 811 binder innovation", defensibilityGap: "Need patents on cathode formulation to prevent CATL from replicating" }],
        wayve: [{ competitor: "Waymo (Alphabet)", theirIp: "3000+ patents on LiDAR, HD mapping, rule-based driving", yourDifferentiation: "End-to-end learning without HD maps — fundamentally different approach", defensibilityGap: "Need patents on neural network architecture and training methodology" }],
      },
      "IPRL:4:1": {
        octopus: { searchFirm: "Bristows LLP", dateCompleted: "2019-03-15", conclusion: "Trade secret route recommended — algorithms are best protected by confidentiality", keyPriorArt: "IBM patents on grid optimisation (not directly applicable to consumer pricing)", nextSteps: "Strengthen trade secret protections; file trademark registrations for Kraken brand" },
        northvolt: { searchFirm: "Awapatent AB", dateCompleted: "2020-06-20", conclusion: "Patentable — novel binder composition has no blocking prior art", keyPriorArt: "LG Energy Solution EP3456789 (electrode coating — requires design-around); Samsung SDI cathode patents (different chemistry)", nextSteps: "File PCT application for binder system; pursue trade secret for manufacturing process parameters" },
        wayve: { searchFirm: "Marks & Clerk", dateCompleted: "2021-02-10", conclusion: "Patentable — end-to-end driving architecture and world model are novel", keyPriorArt: "NVIDIA end-to-end steering patent (limited scope — steering only, not full driving); Waymo perception patents (rule-based, not end-to-end)", nextSteps: "File PCT for driving architecture and world model; file UK provisional for training methodology" },
      },
      "IPRL:4:2": {
        octopus: { iprStrategySummary: "Trade secret for Kraken algorithms; trademark for Octopus Energy and Kraken brands; copyright for software; no patents (algorithms best kept secret)", priorityOrder: "1. Kraken trade secrets, 2. Brand trademarks (UK, EU, international), 3. Software copyright, 4. Data protection compliance", differentiationStrategy: "Technology-led differentiation through platform capabilities that incumbents cannot replicate; reinforce with #1 customer satisfaction brand", commercialEvidence: "Kraken licensed to 50M+ accounts globally; brand drives lowest customer acquisition cost in UK energy" },
        northvolt: { iprStrategySummary: "PCT patent for NMC 811 binder system; trade secret for manufacturing process parameters; trademark for Northvolt brand", priorityOrder: "1. Cathode binder patent (PCT → EP, US, CN), 2. Manufacturing trade secrets, 3. Northvolt trademark, 4. Battery passport technology", differentiationStrategy: "Patent portfolio creates barrier to European competitors; ESG credentials and traceability create commercial differentiation with OEMs", commercialEvidence: "VW cited IP and ESG as key factors in €14B partnership; BMW noted traceability as competitive advantage" },
        wayve: { iprStrategySummary: "PCT patents for driving architecture and world model; trade secret for training data and pipeline; copyright for software", priorityOrder: "1. Driving architecture patent (PCT → US, EP, CN, JP), 2. World model patent, 3. Training pipeline trade secret, 4. Wayve trademark", differentiationStrategy: "Patents protect core architecture; trade secrets protect data advantage; together create a defensible AI-first driving platform", commercialEvidence: "Uber partnership specifically cited generalisation capability as key differentiator; $1B+ raised based on IP strength" },
      },
      "IPRL:4:3": {
        octopus: { filingType: "Trademark application", filingDate: "2019-06-01", jurisdiction: "UK", applicationNumber: "UK00003456789", keyClaimsScope: "Octopus Energy and Kraken brand names and logos for energy services and software", networkEffectsEstimate: "Platform gains value with each new utility licensee — target 100M+ accounts for dominant market position" },
        northvolt: { filingType: "PCT patent application", filingDate: "2020-09-15", jurisdiction: "PCT", applicationNumber: "PCT/EP2020/076543", keyClaimsScope: "Novel binder composition for NMC cathodes; method of manufacturing high-nickel cathode with improved stability", networkEffectsEstimate: "N/A — manufacturing IP, not network-dependent" },
        wayve: { filingType: "PCT patent application", filingDate: "2021-05-20", jurisdiction: "PCT", applicationNumber: "PCT/GB2021/051234", keyClaimsScope: "End-to-end neural network architecture for autonomous driving; world model for driving prediction and planning", networkEffectsEstimate: "Data flywheel — each mile driven improves the model; target 10M miles for dominant data advantage" },
      },
      "IPRL:5:1": {
        octopus: { iprStrategyDraft: "Protect Kraken platform via trade secrets and confidentiality agreements; trademark registrations in all operating markets; copyright registration for key software modules", defensibilityStrategyDraft: "Platform network effects create growing moat — each licensee adds value; brand loyalty drives retention; speed of innovation creates constant tech gap vs incumbents", differentiationStrategyDraft: "Lead with tech innovation (Agile Octopus, smart EV charging); reinforce with brand (Which? #1 rated); expand via platform licensing (Kraken)", budgetAllocated: "£50K for trademark registrations (5 jurisdictions); £20K for trade secret systems; £30K for legal counsel" },
        northvolt: { iprStrategyDraft: "File national phase patents in EP, US, CN, JP for binder system; maintain manufacturing process as trade secret; register trademarks in all manufacturing countries", defensibilityStrategyDraft: "Patent portfolio protects core chemistry; manufacturing know-how is trade secret; €55B order backlog creates switching costs; ESG credentials are hard to replicate", differentiationStrategyDraft: "Lead with sustainability (lowest carbon battery); back with performance (250+ Wh/kg); anchor with European supply chain sovereignty", budgetAllocated: "€200K for patent prosecution (4 jurisdictions); €30K for trade secret systems; €20K for trademark registrations" },
        wayve: { iprStrategyDraft: "File national phase patents in US, EP, CN, JP for driving architecture and world model; maintain training data as trade secret; protect software via copyright", defensibilityStrategyDraft: "Patents protect architecture; 1M+ miles of data create growing data moat; Microsoft partnership provides compute advantage; speed of model improvement creates perpetual lead", differentiationStrategyDraft: "Lead with generalisation (works anywhere without maps); back with cost (84% cheaper per mile); reinforce with partnerships (Uber, Microsoft)", budgetAllocated: "£150K for patent prosecution (4 jurisdictions); £50K for data security; £30K for legal counsel" },
      },
      "IPRL:5:2": {
        octopus: { filingType: "UK trademark registration", applicationNumber: "UK00003456789", filingDate: "2019-06-01", scopeClaims: "Octopus Energy and Kraken brands for energy services and software platforms", attorneyFirm: "Bristows LLP" },
        northvolt: { filingType: "PCT patent application", applicationNumber: "PCT/EP2020/076543", filingDate: "2020-09-15", scopeClaims: "NMC 811 cathode binder system — 12 claims covering composition, method, and battery cell", attorneyFirm: "Awapatent AB" },
        wayve: { filingType: "PCT patent application", applicationNumber: "PCT/GB2021/051234", filingDate: "2021-05-20", scopeClaims: "End-to-end driving architecture — 15 claims covering neural network structure, world model, and training method", attorneyFirm: "Marks & Clerk" },
      },
      "IPRL:5:3": {
        octopus: [{ agreement: "Employee IP assignment", parties: "All employees → Octopus Energy Ltd", ipCovered: "All work-related inventions and creations", status: "Signed", dateSigned: "2016-01-01" }],
        northvolt: [{ agreement: "IP assignment", parties: "Founders → Northvolt AB", ipCovered: "All prior work related to battery technology", status: "Signed", dateSigned: "2016-10-01" }, { agreement: "University collaboration", parties: "Uppsala University ↔ Northvolt", ipCovered: "Joint research on cathode materials", status: "Signed", dateSigned: "2019-03-15" }],
        wayve: [{ agreement: "University spin-out licence", parties: "Cambridge University → Wayve Technologies", ipCovered: "Foundational ML driving research", status: "Signed", dateSigned: "2017-06-01" }, { agreement: "Founder IP assignment", parties: "Alex Kendall → Wayve Technologies", ipCovered: "All prior autonomous driving research", status: "Signed", dateSigned: "2017-06-15" }],
      },
      "IPRL:6:1": {
        octopus: { iprStrategyFinal: "Trade secret protection for Kraken algorithms; trademark portfolio across 8 jurisdictions; software copyright; no patents — trade secret provides stronger protection for algorithms", differentiationStrategyFinal: "Tech innovation speed (3x faster feature releases than competitors) + brand loyalty (NPS 80+) + platform licensing (Kraken as industry OS)", validationMethod: "Reviewed by IP counsel (Bristows); validated by licensing revenue from Kraken; confirmed by investor due diligence", keyRisk: "Key person risk — core algorithm knowledge concentrated in senior engineering team; mitigated by documentation and team expansion" },
        northvolt: { iprStrategyFinal: "Patent portfolio for cathode chemistry (PCT → 4 national phases); trade secrets for manufacturing process; trademarks in 6 jurisdictions", differentiationStrategyFinal: "Sustainability leadership (71% lower carbon) + European supply chain security + quality/reliability (95%+ yield) + battery passport traceability", validationMethod: "Patent strategy reviewed by Awapatent; differentiation validated by €55B order backlog from OEMs citing ESG and supply chain sovereignty", keyRisk: "Patent validity — competitors (CATL, LG) may challenge; mitigated by strong prior art search and attorney confidence in novelty" },
        wayve: { iprStrategyFinal: "Patent portfolio for driving architecture and world model (PCT → 4 national phases); trade secret for training data and pipeline; copyright for software stack", differentiationStrategyFinal: "Generalisation (works anywhere without HD maps) + cost advantage (84% cheaper) + deployment speed (2 weeks vs 6 months) + foundation model approach", validationMethod: "Patent strategy reviewed by Marks & Clerk; differentiation validated by Uber partnership and $1B+ fundraise", keyRisk: "Regulatory uncertainty — autonomous driving regulations still evolving; patent landscape in AI/ML is contested territory" },
      },
      "IPRL:6:2": {
        octopus: [{ iprAsset: "EV smart charging algorithm", type: "Trade secret", rationale: "Extends platform to electric vehicle charging optimisation", timeline: "Active development", budget: "Included in R&D" }],
        northvolt: [{ iprAsset: "Sodium-ion cell chemistry", type: "Patent", rationale: "Extends portfolio to next-gen grid storage chemistry", timeline: "File by Q4 2024", budget: "€30K" }, { iprAsset: "Battery recycling process", type: "Patent", rationale: "Circular economy IP for end-of-life batteries", timeline: "File by Q2 2025", budget: "€25K" }],
        wayve: [{ iprAsset: "LINGO-2 multimodal foundation model", type: "Patent", rationale: "Next-gen driving model with natural language reasoning", timeline: "File by Q3 2024", budget: "£20K" }, { iprAsset: "Simulation training environment", type: "Trade secret", rationale: "Proprietary simulation engine for training and validation", timeline: "Active protection", budget: "£5K" }],
      },
      "IPRL:6:3": {
        octopus: { ftoScope: "Kraken platform — dynamic pricing, demand response, billing, customer management modules", conductedBy: "Bristows LLP", blockingPatents: "No blocking patents identified — trade secret approach avoids patent landscape; IBM grid patents are not applicable to consumer pricing", riskLevel: "Low", mitigationPlan: "Continue trade secret approach; monitor competitor patent filings quarterly" },
        northvolt: { ftoScope: "NMC 811 cell manufacturing — cathode preparation, electrode coating, cell assembly, formation", conductedBy: "Awapatent AB", blockingPatents: "LG Energy Solution EP3456789 (electrode coating method) — requires design-around for European manufacturing", riskLevel: "Medium", mitigationPlan: "Design-around for LG coating patent completed; alternative coating method validated; monitoring Samsung cathode patents" },
        wayve: { ftoScope: "Autonomous driving stack — sensor fusion, neural network inference, vehicle control, training pipeline", conductedBy: "Marks & Clerk", blockingPatents: "No direct blocking patents — end-to-end approach is fundamentally different from competitors' rule-based patents; monitoring Waymo and Cruise patent portfolios", riskLevel: "Low", mitigationPlan: "End-to-end approach sidesteps most competitor patents; continue monitoring AI/ML patent landscape" },
      },
      "IPRL:6:4": {
        octopus: [{ application: "UK00003456789", responseType: "Examination report", date: "2019-09-15", outcome: "Positive — trademark registered", nextStep: "File in additional jurisdictions" }],
        northvolt: [{ application: "PCT/EP2020/076543", responseType: "International search report", date: "2021-03-20", outcome: "Positive — all claims novel and inventive", nextStep: "Proceed to national phase filings" }],
        wayve: [{ application: "PCT/GB2021/051234", responseType: "International search report", date: "2022-01-15", outcome: "Largely positive — 12 of 15 claims considered novel", nextStep: "Amend 3 claims per examiner suggestions; enter national phase" }],
      },
      "IPRL:6:5": {
        octopus: { applicationRef: "N/A — no objections received", objectionSummary: "No objections — trademark registered without opposition", responseStrategy: "N/A", attorneyAssessment: "N/A", responseDeadline: "" },
        northvolt: { applicationRef: "PCT/EP2020/076543", objectionSummary: "Minor: examiner questioned novelty of claim 8 (general NMC formulation range overlap with Samsung prior art)", responseStrategy: "Narrow claim 8 to specific binder concentration range not taught in prior art; provide experimental evidence of unexpected performance improvement", attorneyAssessment: "High", responseDeadline: "2021-09-20" },
        wayve: { applicationRef: "PCT/GB2021/051234", objectionSummary: "Three claims (13-15) on general neural network training deemed too broad; examiner cited NVIDIA steering patent", responseStrategy: "Amend claims to specifically reference multi-modal transformer architecture and world model integration — distinct from NVIDIA CNN approach", attorneyAssessment: "High", responseDeadline: "2022-07-15" },
      },
      "IPRL:7:1": {
        octopus: [{ application: "UK00003456789", jurisdiction: "UK", filingDate: "2019-06-01", status: "Granted", estimatedGrant: "2019 (granted)" }, { application: "EU018234567", jurisdiction: "EU", filingDate: "2020-02-01", status: "Granted", estimatedGrant: "2020 (granted)" }],
        northvolt: [{ application: "EP21765432", jurisdiction: "EP", filingDate: "2021-09-15", status: "Under examination", estimatedGrant: "2024" }, { application: "US17/654321", jurisdiction: "US", filingDate: "2021-09-15", status: "Under examination", estimatedGrant: "2025" }, { application: "CN202110987654", jurisdiction: "CN", filingDate: "2021-09-15", status: "Under examination", estimatedGrant: "2024" }],
        wayve: [{ application: "EP22812345", jurisdiction: "EP", filingDate: "2022-05-20", status: "Under examination", estimatedGrant: "2025" }, { application: "US18/123456", jurisdiction: "US", filingDate: "2022-05-20", status: "Under examination", estimatedGrant: "2025" }, { application: "CN202210567890", jurisdiction: "CN", filingDate: "2022-05-20", status: "Under examination", estimatedGrant: "2025" }],
      },
      "IPRL:7:2": {
        octopus: { keyMessages: "UK's most innovative energy company; Kraken: the technology powering the global energy transition; Agile Octopus: the tariff that pays you to use green energy", supportingMaterials: "Which? #1 rated energy company award; Kraken case studies with global utilities; Agile Octopus customer savings reports", channelsUsed: "Website, press releases, customer app, industry conferences, social media", customerFeedback: "Strong recognition — 85% of surveyed customers cite innovation and green credentials as reasons for choosing Octopus" },
        northvolt: { keyMessages: "Europe's greenest battery; full lifecycle traceability from mine to wheel; made in Europe for European mobility", supportingMaterials: "Third-party LCA audit showing 71% lower carbon; battery passport prototype; VW and BMW testimonials", channelsUsed: "Industry conferences (IAA, Battery Show), direct sales presentations, sustainability reports, press", customerFeedback: "OEM procurement teams consistently cite sustainability credentials as key differentiator vs Asian competitors" },
        wayve: { keyMessages: "AI that learns to drive — no maps needed; deploy anywhere in weeks, not months; the future of autonomous mobility", supportingMaterials: "Demo ride programme, LINGO-2 whitepaper, safety case documentation, fleet telemetry dashboards", channelsUsed: "Industry conferences (CES, GTC), research publications, demo rides, partnership announcements", customerFeedback: "Fleet partners recognise generalisation as unique — 'only AV company that doesn't need city-specific mapping'" },
      },
      "IPRL:7:3": {
        octopus: { updatedFtoScope: "Expanded to cover smart EV charging, home battery integration, and vehicle-to-grid services", thirdPartyDependencies: "Smart meter data access via UK Data Communications Company (DCC) — regulated access, no IP barriers", restrictionsIdentified: "None — trade secret approach avoids patent FTO issues; all technology developed in-house", mitigationActions: "Continue monitoring energy tech patent landscape; maintain trade secret protections" },
        northvolt: { updatedFtoScope: "Expanded to cover sodium-ion chemistry, battery recycling processes, and battery passport technology", thirdPartyDependencies: "LG electrode coating patent — design-around completed and validated; potential licence needed for recycling technology from Umicore", restrictionsIdentified: "Cannot use LG original coating method — must use redesigned process; recycling technology needs licence or own development", mitigationActions: "LG coating design-around validated; recycling licence negotiation with Umicore initiated; own recycling R&D running in parallel" },
        wayve: { updatedFtoScope: "Expanded to cover LINGO-2 foundation model, highway driving capability, and simulation training", thirdPartyDependencies: "Microsoft Azure for compute (commercial agreement, no IP restrictions); camera/LiDAR hardware from suppliers (standard commercial terms)", restrictionsIdentified: "No restrictions identified — end-to-end approach remains distinct from competitor patent portfolios", mitigationActions: "Continue monitoring AI/ML patent landscape; engaged patent watching service for Waymo, Tesla, and Cruise filings" },
      },
      "IPRL:8:1": {
        octopus: { ipManagementProcess: "Annual IP audit; quarterly review of trade secret protections; continuous monitoring of competitor activity", ipRegister: "Internal IP register maintained by legal team; trade secret log with access controls", agreementManagement: "Tracked in legal team contract management system; automated renewal reminders", newIpCapture: "Engineering team submits innovation reports; quarterly IP brainstorm sessions", responsiblePerson: "General Counsel with support from CTO" },
        northvolt: { ipManagementProcess: "Quarterly invention disclosure reviews; annual patent portfolio review; monthly monitoring of competitor patent publications", ipRegister: "Darts-IP patent management platform; separate trade secret register with classification", agreementManagement: "Contract lifecycle management system; IP clauses flagged in all commercial agreements", newIpCapture: "Invention disclosure form on intranet; R&D team monthly IP review meetings; incentive programme for inventors", responsiblePerson: "VP IP & Legal, with IP committee including CTO and R&D leads" },
        wayve: { ipManagementProcess: "Monthly invention disclosure reviews; quarterly patent portfolio strategy session; continuous monitoring of AI/ML patent landscape", ipRegister: "Anaqua IP management platform; separate trade secret register for training data and algorithms", agreementManagement: "Legal ops team tracks all agreements in contract management tool; IP clauses reviewed by IP counsel", newIpCapture: "ML researchers submit invention disclosure via internal tool; patent bonus scheme for filed applications", responsiblePerson: "Head of IP with support from CTO" },
      },
      "IPRL:8:2": {
        octopus: [{ iprType: "Trademark", reference: "UK00003456789", jurisdiction: "UK", grantDate: "2019-09-01", scope: "Octopus Energy and Kraken brands for energy services and software" }, { iprType: "Trademark", reference: "EU018234567", jurisdiction: "EU", grantDate: "2020-06-01", scope: "Octopus Energy and Kraken brands across EU markets" }],
        northvolt: [{ iprType: "Patent", reference: "EP21765432B1", jurisdiction: "EP", grantDate: "2024-03-15", scope: "NMC 811 cathode binder composition and method of manufacture" }],
        wayve: [{ iprType: "Patent", reference: "EP22812345B1", jurisdiction: "EP", grantDate: "2025-01-20", scope: "End-to-end neural network architecture for autonomous driving with integrated world model" }],
      },
      "IPRL:8:3": {
        octopus: [{ application: "US97/654321", type: "Trademark", jurisdiction: "US", filingDate: "2021-03-01", rationale: "US market entry — protect Kraken brand" }],
        northvolt: [{ application: "PCT/EP2024/098765", type: "Patent", jurisdiction: "PCT", filingDate: "2024-06-01", rationale: "Sodium-ion cell chemistry — extends portfolio to grid storage" }, { application: "EP24567890", type: "Patent", jurisdiction: "EP", filingDate: "2024-09-15", rationale: "Battery recycling process — circular economy IP" }],
        wayve: [{ application: "PCT/GB2024/054321", type: "Patent", jurisdiction: "PCT", filingDate: "2024-03-01", rationale: "LINGO-2 multimodal foundation model for driving with language reasoning" }],
      },
      "IPRL:8:4": {
        octopus: { originalDifferentiation: "Tech innovation speed + brand loyalty + platform licensing", marketChanges: "Competitors (Ovo, Bulb) attempted tech-led approaches; Bulb collapsed; traditional utilities launching digital brands", updatedDifferentiation: "Platform dominance (50M+ accounts on Kraken) + ecosystem lock-in (smart EV charging, home batteries) + brand trust", evidenceItWorks: "Kraken licensing revenue growing 100%+ YoY; customer acquisition cost 50% below industry average" },
        northvolt: { originalDifferentiation: "Sustainability leadership + European supply chain + quality", marketChanges: "CATL and BYD announcing European factory plans; EU Battery Regulation raising bar for all manufacturers", updatedDifferentiation: "First-mover advantage in European manufacturing + full lifecycle traceability (battery passport) + recycling capability", evidenceItWorks: "OEM contracts continue to cite sustainability and traceability; €55B backlog maintained despite new market entrants" },
        wayve: { originalDifferentiation: "Generalisation + cost + deployment speed", marketChanges: "Tesla FSD improving rapidly; Waymo expanding service area; regulatory frameworks emerging for driverless operation", updatedDifferentiation: "Foundation model approach (LINGO-2) + Uber partnership for scale + regulatory engagement leadership + safety case methodology", evidenceItWorks: "Uber partnership; 200+ miles/intervention (doubling annually); fleet partners request expansion" },
      },
      "IPRL:9:1": {
        octopus: { revenueProtected: "£6B ARR protected by trade secrets and brand", dealsWon: "Kraken licensing deals worth £100M+ directly attributed to platform IP and trade secret protections", licensingRevenue: "Significant — Kraken licensing to global utilities generates substantial platform revenue", differentiationImpact: "Brand drives lowest customer acquisition cost in UK energy; tech platform creates 85% retention rate" },
        northvolt: { revenueProtected: "$800M contracted revenue protected by patent portfolio and trade secrets", dealsWon: "VW €14B deal specifically cited patent portfolio and sustainability IP as factors; 3 additional OEM contracts influenced by IP position", licensingRevenue: "None yet — IP used defensively; licensing strategy under consideration for recycling technology", differentiationImpact: "ESG credentials and patent portfolio cited as top-2 reasons OEMs choose Northvolt over Asian competitors" },
        wayve: { revenueProtected: "Pilot-stage revenue; $1B+ investment valuation protected by IP portfolio", dealsWon: "Uber partnership specifically cited unique IP position (end-to-end, no HD maps) as key factor", licensingRevenue: "None yet — platform licensing model planned for post-regulatory approval", differentiationImpact: "Generalisation capability is primary reason fleet partners choose Wayve over competitors; drives 100% pilot renewal rate" },
      },
      "IPRL:9:2": {
        octopus: [{ iprType: "Trademark", reference: "UK00003456789", jurisdictions: "UK, EU, US, JP, AU", status: "Granted", annualMaintenanceCost: "£15K/year" }],
        northvolt: [{ iprType: "Patent", reference: "EP21765432B1", jurisdictions: "EP, US, CN (pending JP)", status: "Granted", annualMaintenanceCost: "€40K/year" }, { iprType: "Trademark", reference: "Multiple", jurisdictions: "EU, US, CN, JP, KR", status: "Granted", annualMaintenanceCost: "€12K/year" }],
        wayve: [{ iprType: "Patent", reference: "EP22812345B1", jurisdictions: "EP, US (pending CN, JP)", status: "Granted", annualMaintenanceCost: "£35K/year" }, { iprType: "Patent", reference: "PCT/GB2024/054321", jurisdictions: "PCT (entering national phase)", status: "Pending", annualMaintenanceCost: "£5K/year" }],
      },
      "IPRL:9:3": {
        octopus: [{ agreement: "DCC data access", counterparty: "Data Communications Company", ipCovered: "Smart meter data access for energy services", terms: "Regulated access, standard commercial terms", renewalDate: "2027-01-01" }],
        northvolt: [{ agreement: "Research collaboration", counterparty: "Uppsala University", ipCovered: "Joint research on next-gen cathode materials", terms: "Non-exclusive licence; joint ownership of results", renewalDate: "2026-06-01" }],
        wayve: [{ agreement: "University spin-out licence", counterparty: "Cambridge University", ipCovered: "Foundational ML driving research methods", terms: "Non-exclusive; royalty-bearing on commercial revenue", renewalDate: "2030-06-01" }, { agreement: "Cloud compute partnership", counterparty: "Microsoft", ipCovered: "Wayve retains all IP; Azure used for training compute", terms: "Commercial compute agreement; no IP restrictions", renewalDate: "2027-12-01" }],
      },
      // BRL example data
      "BRL:1:1": {
        octopus: { whoPays: "UK homeowners", revenueModel: "SaaS subscription (monthly energy tariff)", pricingHypothesis: "£80–120/month variable tariff with smart pricing", whyThisModel: "Recurring revenue model aligned with essential monthly spend; smart tariffs differentiate from fixed-price incumbents" },
        northvolt: { whoPays: "European automakers", revenueModel: "Hardware sales (battery cells) with long-term supply contracts", pricingHypothesis: "€100–120/kWh per cell, multi-year volume agreements", whyThisModel: "Battery cells are a physical product; OEMs prefer long-term supply security over spot buying" },
        wayve: { whoPays: "Automotive OEMs", revenueModel: "Platform licensing (per-vehicle software license)", pricingHypothesis: "£500–2,000/vehicle/year or revenue share on rides", whyThisModel: "Software licensing scales without hardware costs; per-vehicle model aligns with OEM purchasing" },
      },
      "BRL:1:2": {
        octopus: { marketSizing: "UK Homeowners: £56B TAM", revenueOpportunity: "£500M ARR by Year 3 targeting 5% of UK switching market", keyApplications: "Smart grid demand response and dynamic tariff pricing — highest revenue per customer" },
        northvolt: { marketSizing: "European OEMs: $46B TAM", revenueOpportunity: "$2B revenue by Year 3 via 3 anchor OEM contracts", keyApplications: "EV traction batteries for premium European OEMs — highest willingness to pay for European supply" },
        wayve: { marketSizing: "Fleet Operators: $300B global AV TAM", revenueOpportunity: "£50M ARR by Year 3 from initial fleet partnerships", keyApplications: "Autonomous delivery and ride-hailing — clearest near-term revenue path" },
      },
      "BRL:1:3": {
        octopus: [{ competitor: "British Gas", businessModel: "Traditional fixed tariff, direct sales", pricePoint: "£100/month fixed", implication: "Dynamic pricing can undercut fixed tariffs during off-peak, attracting price-sensitive switchers" }],
        northvolt: [{ competitor: "CATL", businessModel: "High-volume manufacturing, direct OEM sales", pricePoint: "€90–100/kWh", implication: "Must achieve cost parity; can command premium for European supply chain and low carbon footprint" }],
        wayve: [{ competitor: "Waymo", businessModel: "Vertically integrated fleet operations", pricePoint: "£5+/autonomous mile (including HD maps)", implication: "Our map-free approach eliminates £millions in per-city mapping costs, enabling lower per-mile pricing" }],
      },
      "BRL:2:1": {
        octopus: { valueProposition: "Tech-powered dynamic tariffs with 100% renewable sourcing", techAdvantage: "15% bill reduction via ML demand forecasting", revenueModelDetailed: "Monthly subscription: variable tariff (Agile Octopus) with half-hourly pricing; B2B licensing of Kraken platform to other utilities at £X/customer/year", costStructure: "Wholesale energy (65%), platform development (15%), customer acquisition (10%), operations (10%)", marginHypothesis: "35% gross margin — energy retail is low-margin but tech licensing is 80%+ margin" },
        northvolt: { valueProposition: "Lowest carbon footprint with fully European supply chain", techAdvantage: "71% CO₂ reduction vs industry average, 8% cost reduction vs CATL", revenueModelDetailed: "Multi-year cell supply contracts (3–5 years, $500M–$5B each); pricing per kWh with volume tiers; premium for sustainability traceability", costStructure: "Raw materials (45%), manufacturing (25%), R&D (15%), SG&A (15%)", marginHypothesis: "25–30% gross margin at scale — capital intensive but improving with yield optimisation" },
        wayve: { valueProposition: "End-to-end deep learning that generalises without HD maps", techAdvantage: "84% cost reduction per autonomous mile, 12x faster city deployment", revenueModelDetailed: "Per-vehicle annual software license (£1K–2K/vehicle); premium tier with fleet management dashboard; revenue share option for ride-hailing (10–15% of fare)", costStructure: "R&D and compute (60%), fleet operations (20%), sales/BD (10%), G&A (10%)", marginHypothesis: "70%+ gross margin at scale — software-only model with near-zero marginal cost per vehicle" },
      },
      "BRL:2:2": {
        octopus: [{ competitor: "British Gas (Centrica)", revenueModel: "Traditional utility — fixed tariffs, in-person sales", estimatedRevenue: "£9B revenue", grossMargin: "5–8%", keyInsight: "Traditional model has razor-thin margins; tech-enabled model can achieve 35%+ via platform licensing" }],
        northvolt: [{ competitor: "CATL", revenueModel: "High-volume cell manufacturing, direct to OEMs", estimatedRevenue: "$45B revenue", grossMargin: "20–25%", keyInsight: "Scale drives margin; need 50GWh+ to compete on cost, but ESG premium commands 5–10% price uplift" }],
        wayve: [{ competitor: "Waymo (Alphabet)", revenueModel: "Vertically integrated fleet operations + licensing", estimatedRevenue: "$1B+ invested/year (pre-revenue at scale)", grossMargin: "N/A (pre-profit)", keyInsight: "Map-based approach requires $billions per city; our software-only model is capital-light and scalable" }],
      },
      "BRL:3:1": {
        octopus: { customerSegmentsBuyer: "UK homeowners (bill payer is user, payer, and decision maker)", valueProposition: "100% green energy at a fair, transparent price with smart tariff flexibility", revenueStreams: "Energy retail tariffs (85%), Kraken platform licensing (10%), grid services (5%)", costStructure: "Wholesale energy: £3.5B, platform R&D: £50M, customer acquisition: £30M, operations: £20M", keyResources: "Kraken technology platform, renewable energy supply agreements, smart meter integrations", keyActivities: "Platform development, tariff optimisation, customer acquisition, energy procurement", keyPartners: "Renewable generators, smart meter providers, Uswitch, Kraken licensees" },
        northvolt: { customerSegmentsBuyer: "European OEMs (EV driver indirect user, OEM procurement is payer, VP Supply Chain decides)", valueProposition: "European-made, low-carbon batteries at cost parity with full traceability", revenueStreams: "Cell sales to OEMs (90%), battery recycling services (5%), energy storage systems (5%)", costStructure: "Raw materials: €400M, manufacturing: €200M, R&D: €120M, SG&A: €80M", keyResources: "Gigafactory facilities, electrochemistry expertise, raw material supply agreements, EU regulatory relationships", keyActivities: "Cell manufacturing, quality control, R&D on next-gen chemistries, recycling process development", keyPartners: "VW, BMW, Volvo (customers), mining companies (supply), Siemens (factory automation)" },
        wayve: { customerSegmentsBuyer: "Fleet operators (dispatcher is user, fleet CFO is payer, CTO/COO decides)", valueProposition: "AI driving that works anywhere without per-city mapping investment", revenueStreams: "Per-vehicle software license (70%), fleet management SaaS (20%), revenue share on rides (10%)", costStructure: "R&D and compute: £30M, fleet ops: £10M, sales/BD: £5M, G&A: £5M", keyResources: "AV2.0 neural network, training data pipeline, Microsoft Azure compute, safety case documentation", keyActivities: "Model training, safety validation, fleet partner integration, regulatory engagement", keyPartners: "Microsoft (Azure compute), Uber (go-to-market), vehicle OEMs (hardware integration)" },
      },
      "BRL:3:2": {
        octopus: [{ factor: "CO₂ emissions", positiveContribution: "100% renewable energy sourcing eliminates ~2 tCO₂/customer/year", negativeContribution: "Data centre energy use for Kraken platform", netAssessment: "Positive" }, { factor: "Smart grid efficiency", positiveContribution: "Demand shifting reduces grid peak load by 15%", negativeContribution: "Smart meter manufacturing footprint", netAssessment: "Positive" }],
        northvolt: [{ factor: "Manufacturing carbon footprint", positiveContribution: "71% lower CO₂ per kWh vs industry average (hydroelectric power)", negativeContribution: "Energy-intensive cell production process", netAssessment: "Positive" }, { factor: "Raw materials", positiveContribution: "Recycling programme recovers 95% of battery materials", negativeContribution: "Mining of lithium and nickel", netAssessment: "Neutral" }],
        wayve: [{ factor: "Transport emissions", positiveContribution: "Enables efficient fleet routing, reducing fuel/energy waste by 20%", negativeContribution: "High compute training costs (GPU energy)", netAssessment: "Positive" }, { factor: "Road safety", positiveContribution: "Reduces human-error accidents (90% of crashes)", negativeContribution: "Edge case risks during early deployment", netAssessment: "Positive" }],
      },
      "BRL:3:3": {
        octopus: { marketSizing: "European energy retail: €300B", beachheadMarket: "UK residential energy customers: £55B TAM", samRefinement: "UK switching market (~30% of customers switch): £16.5B SAM; Octopus targets tech-savvy, green-minded switchers", somYear1to2: "£200M ARR by Year 2 — targeting 200K customers at £1K avg annual spend", keyAssumptions: "Smart meter rollout continues, energy price volatility maintains demand for dynamic tariffs" },
        northvolt: { marketSizing: "European EV battery: $46B", beachheadMarket: "Premium European OEMs (VW, BMW, Volvo): $12B TAM", samRefinement: "OEMs actively seeking European supply (ESG mandates): $8B SAM; limited by production capacity ramp", somYear1to2: "$800M revenue by Year 2 — first gigafactory at 16 GWh/year serving 3 anchor contracts", keyAssumptions: "EU Battery Regulation enforces local content rules; OEMs willing to pay 5–10% premium for European supply" },
        wayve: { marketSizing: "Global AV software: $300B", beachheadMarket: "UK grocery delivery fleets: $500M TAM", samRefinement: "UK and EU delivery/logistics fleets open to AV pilots: $2B SAM; limited by regulatory approval timeline", somYear1to2: "£10M ARR by Year 2 — 5 fleet partnerships at £2M avg annual license", keyAssumptions: "Regulatory approval for safety-driver-monitored operations; fleet partners commit to multi-year pilots" },
      },
      "BRL:3:4": {
        octopus: [{ competitor: "British Gas", theirPricePoint: "£100/month fixed tariff", theirModel: "Traditional retail + services bundling", lessonForYou: "Fixed pricing leaves money on table for smart consumers; dynamic pricing creates clear differentiation" }],
        northvolt: [{ competitor: "CATL", theirPricePoint: "€90–100/kWh", theirModel: "Volume manufacturing, cost leadership", lessonForYou: "Must match on cost but compete on sustainability premium; 5–10% ESG uplift validated by OEM procurement" }],
        wayve: [{ competitor: "Waymo", theirPricePoint: "£5+/mile (including HD map costs)", theirModel: "Vertically integrated fleet + licensing", lessonForYou: "Per-mile pricing benchmark validates our lower price point; software-only model avoids fleet ownership costs" }],
      },
      "BRL:4:1": {
        octopus: { revenueYear1: "£200M — 200K customers at £1K avg annual spend", revenueYear3: "£2B — targeting 2M customers + Kraken licensing revenue", grossMarginTarget: "35% (blended: 8% energy retail + 80% platform licensing)", cogsBreakdown: "Wholesale energy: £130M, network charges: £30M, smart meter costs: £5M, platform hosting: £5M", rdCosts: "£2M for engineering team + £500K cloud infrastructure", ipCosts: "Minimal — primarily software IP, no patent filing costs", breakEvenTimeline: "Month 14 — low fixed costs, variable energy procurement", biggestFinancialRisk: "Wholesale energy price spikes eroding margin; regulatory price cap changes" },
        northvolt: { revenueYear1: "$200M — pilot production sales to VW and BMW", revenueYear3: "$2B — first gigafactory at full capacity, second factory ramping", grossMarginTarget: "25% — capital-intensive manufacturing, improving with yield", cogsBreakdown: "Raw materials (lithium, nickel, cobalt): $90M, manufacturing labour: $30M, energy: $20M, equipment depreciation: $40M", rdCosts: "€50M for pilot facility + €15M for R&D materials", ipCosts: "€5M — patents on cell chemistry and manufacturing processes", breakEvenTimeline: "Month 30 — significant capex before production revenue", biggestFinancialRisk: "Raw material price volatility; gigafactory construction delays; yield rate below target" },
        wayve: { revenueYear1: "£5M — initial pilot licensing fees from 3 fleet partners", revenueYear3: "£80M — 50 fleet partners + Uber revenue share", grossMarginTarget: "70% — software-only model with high R&D amortisation", cogsBreakdown: "Cloud compute (inference): £1M, safety operations: £500K, customer support: £200K", rdCosts: "£10M compute costs + £5M fleet operations + £3M team", ipCosts: "£2M — AI model patents and trade secret protection", breakEvenTimeline: "Month 36 — high upfront R&D investment, but unit economics strong once deployed", biggestFinancialRisk: "Regulatory delays pushing back commercial deployment; compute costs if not optimised" },
      },
      "BRL:4:2": {
        octopus: { keySustainabilityFactors: "CO₂ emissions (Positive), Smart grid efficiency (Positive)", primaryEnvBenefit: "Displaces 2 tCO₂/customer/year — 6M tCO₂/year at 3M customers", primarySocialBenefit: "Reduces fuel poverty by offering cheapest green tariffs; creates 2,000+ tech jobs", negativeContributions: "Data centre operations consume 50 GWh/year", mitigationPlan: "100% renewable-powered data centres; efficiency programme targeting 30% compute reduction", methodology: "Simplified LCA for energy sourcing; Ofgem sustainability reporting framework" },
        northvolt: { keySustainabilityFactors: "Manufacturing carbon footprint (Positive), Raw materials (Neutral)", primaryEnvBenefit: "71% lower CO₂ per kWh vs industry average — equivalent to 500K tCO₂/year avoided at full capacity", primarySocialBenefit: "Creates 3,000+ manufacturing jobs in Northern Sweden; upskills local workforce in green tech", negativeContributions: "Production uses 2 TWh/year electricity; mining supply chain impacts", mitigationPlan: "100% hydroelectric power for production; closed-loop recycling targeting 95% material recovery by 2025", methodology: "Full lifecycle assessment (LCA) by third-party auditor; EU Battery Regulation compliance framework" },
        wayve: { keySustainabilityFactors: "Transport emissions (Positive), Road safety (Positive)", primaryEnvBenefit: "20% fleet fuel/energy reduction through optimised routing — 50K tCO₂/year at scale", primarySocialBenefit: "Reduces road accidents (targeting 90% reduction in fleet incidents); creates 500+ AI engineering jobs", negativeContributions: "GPU training runs consume 5 GWh/year; hardware manufacturing footprint of sensor arrays", mitigationPlan: "Carbon-neutral compute via Microsoft Azure's renewable commitments; model efficiency improvements reducing training compute by 50%", methodology: "Transport emissions modelling; road safety statistical analysis; Microsoft carbon accounting for compute" },
      },
      "BRL:5:1": {
        octopus: [{ source: "Greg Jackson (CEO) — customer feedback", feedback: "Customers love Agile Octopus but want a price floor guarantee for peace of mind", changeMade: "Introduced Agile with cap: variable pricing with maximum monthly limit" }],
        northvolt: [{ source: "VW Procurement Lead", feedback: "Pricing is competitive but need longer-term price lock for 5-year planning cycles", changeMade: "Introduced 5-year pricing with annual CPI adjustment cap" }],
        wayve: [{ source: "Dara Khosrowshahi (Uber)", feedback: "Revenue share model preferred over flat license fee — aligns incentives", changeMade: "Added revenue share tier: 12% of fare revenue as alternative to flat license" }],
      },
      "BRL:5:2": {
        octopus: [{ costComponent: "Wholesale energy procurement", assumedCost: "£650/customer/year", feedbackSource: "Energy trading desk analysis", validatedCost: "£680/customer/year", delta: "+5% — price volatility higher than modelled" }],
        northvolt: [{ costComponent: "Raw materials (lithium, nickel)", assumedCost: "€45/kWh", feedbackSource: "Mining supplier quotes (3 suppliers)", validatedCost: "€50/kWh", delta: "+11% — lithium price spike in 2022" }],
        wayve: [{ costComponent: "Cloud compute (inference)", assumedCost: "£200/vehicle/year", feedbackSource: "Microsoft Azure pricing team", validatedCost: "£180/vehicle/year", delta: "-10% — volume discount negotiated" }],
      },
      "BRL:5:3": {
        octopus: [{ measure: "Shift 50% of data centres to renewable-powered regions", category: "CO₂ emissions", expectedImpact: "30% reduction in data centre emissions", costFeasibility: "+3% hosting costs, feasible within 12 months" }],
        northvolt: [{ measure: "Implement closed-loop recycling for production scrap", category: "Raw materials", expectedImpact: "Recovers 95% of materials, reduces virgin material demand by 20%", costFeasibility: "€30M capex for recycling facility, 3-year payback" }],
        wayve: [{ measure: "Optimise model inference to reduce per-vehicle compute by 40%", category: "Transport emissions", expectedImpact: "Reduces cloud energy use by 40% per vehicle", costFeasibility: "6 months R&D effort, no additional cost" }],
      },
      "BRL:5:4": {
        octopus: { revenueYear1Updated: "£180M (revised down from £200M — slower smart meter rollout)", grossMarginUpdated: "32% (revised from 35% — higher wholesale costs)", keyChanges: "Wholesale energy costs +5% higher than modelled; customer acquisition 10% cheaper than expected; Kraken licensing growing faster than planned", stillViable: "Yes", viabilityExplanation: "Core energy retail margin slightly lower, but Kraken licensing (80% margin) growing faster than projected — blended margin trajectory improving" },
        northvolt: { revenueYear1Updated: "$180M (revised down from $200M — 3-month factory ramp delay)", grossMarginUpdated: "22% (revised from 25% — raw material price increase)", keyChanges: "Lithium prices +11% above forecast; yield rate on track at 95%; VW contract terms validated; second customer BMW accelerating orders", stillViable: "Conditionally", viabilityExplanation: "Viable at scale but raw material costs are the key variable; recycling programme essential for long-term margin improvement" },
        wayve: { revenueYear1Updated: "£6M (revised up from £5M — Uber partnership accelerated)", grossMarginUpdated: "72% (revised from 70% — compute costs lower)", keyChanges: "Azure volume discount reduced inference costs 10%; Uber partnership adding revenue share stream; safety driver costs still required for regulatory compliance", stillViable: "Yes", viabilityExplanation: "Strong unit economics; main constraint is regulatory timeline for removing safety drivers — once achieved, margin expands further" },
      },
      "BRL:5:5": {
        octopus: { currentSegments: "UK Homeowners, Small businesses", currentTamSam: "UK switching market SAM: £16.5B; SOM Year 1-2: £200M", whatChanged: "B2B Kraken licensing emerging as higher-margin growth channel; international expansion validated by demand from 6 countries", updatedSom: "£250M combined: £180M UK energy retail + £70M Kraken licensing", competitiveLandscapeShift: "Bulb (competitor) went into administration — market share opportunity; Ovo acquiring smaller players" },
        northvolt: { currentSegments: "European OEMs, Grid storage operators", currentTamSam: "European OEM SAM: $8B; SOM Year 1-2: $800M", whatChanged: "EU Battery Regulation creating tailwind for European supply; grid storage demand growing faster than EV batteries", updatedSom: "$850M combined: $750M OEM cells + $100M grid storage", competitiveLandscapeShift: "BYD announced European factory plans; CATL building Hungary plant — race for European production capacity" },
        wayve: { currentSegments: "UK delivery fleets, Ride-hailing platforms", currentTamSam: "UK/EU fleet SAM: $2B; SOM Year 1-2: £10M", whatChanged: "Uber partnership opened ride-hailing segment earlier than planned; regulatory discussions more positive than expected", updatedSom: "£15M combined: £8M delivery fleet licenses + £7M Uber revenue share", competitiveLandscapeShift: "Cruise (GM) suspended operations — reduces competition; Tesla FSD regulatory pushback creates opportunity" },
      },
      "BRL:6:1": {
        octopus: [{ scenario: "Agile Octopus national launch", customerContext: "UK residential customers switching from fixed tariffs", revenueGenerated: "£50M first quarter", keyLearning: "Conversion rate highest via price comparison sites; green messaging +22% vs price-only", modelAdjustment: "Increased marketing budget for comparison site partnerships" }],
        northvolt: [{ scenario: "VW pilot supply contract", customerContext: "Initial 1,000 cells for ID.3 production validation", revenueGenerated: "$15M pilot contract", keyLearning: "Cells met all specs; logistics to Wolfsburg factory need optimisation", modelAdjustment: "Added dedicated logistics team and buffer inventory at customer site" }],
        wayve: [{ scenario: "Asda delivery pilot (London)", customerContext: "20 vehicles, 50 delivery routes over 6 months", revenueGenerated: "£800K pilot fee", keyLearning: "Delivery completion rate 95%+; vehicle idle time reduced 30% vs human drivers", modelAdjustment: "Refined pricing from flat fee to per-delivery model — better aligns with customer value" }],
      },
      "BRL:6:2": {
        octopus: { threeYearRevenue: "Y1: £180M, Y2: £800M, Y3: £2.5B (including Kraken licensing)", grossMarginValidated: "32% blended (8% retail + 80% licensing)", unitEconomics: "CAC: £30, LTV: £2,400 (3-year retention), LTV/CAC: 80x", cashFlowBreakeven: "Month 8 — low fixed costs, energy procurement is variable", confidenceLevel: "High", confidenceEvidence: "3M+ paying customers, 85% retention rate, Kraken licensed to 50M+ accounts globally" },
        northvolt: { threeYearRevenue: "Y1: $180M, Y2: $800M, Y3: $2.5B (second factory online)", grossMarginValidated: "22% current, trending to 28% at scale", unitEconomics: "CAC: $500K per OEM relationship, LTV: $2B+ per contract, LTV/CAC: 4,000x", cashFlowBreakeven: "Month 30 — capital-intensive factory ramp", confidenceLevel: "Medium", confidenceEvidence: "$55B order backlog provides visibility; raw material price volatility is main risk" },
        wayve: { threeYearRevenue: "Y1: £6M, Y2: £25M, Y3: £80M (Uber scale + new fleet partners)", grossMarginValidated: "72% on software licenses", unitEconomics: "CAC: £200K per fleet partner, LTV: £5M+ per partner, payback: 6 months", cashFlowBreakeven: "Month 30 — R&D heavy initially, but strong unit economics post-deployment", confidenceLevel: "Medium", confidenceEvidence: "Uber partnership validated; regulatory timeline is main uncertainty" },
      },
      "BRL:7:1": {
        octopus: [{ customer: "Direct residential customers", dealValue: "£2K/year avg", contractTerms: "Monthly rolling (no lock-in)", discountGiven: "No discount — competitive on value", wtpSignal: "Customers actively switch to Octopus; 85% retention without contracts" }],
        northvolt: [{ customer: "Volkswagen Group", dealValue: "$5B multi-year", contractTerms: "5-year supply with annual volume ramp", discountGiven: "5% volume discount at 10GWh+", wtpSignal: "VW committed $5B before factory was operational — strong strategic WTP" }],
        wayve: [{ customer: "Asda/Ocado delivery", dealValue: "£2M/year license", contractTerms: "2-year pilot with commercial option", discountGiven: "50% pilot discount (full price on commercial conversion)", wtpSignal: "Renewed pilot and committed to commercial deployment — strong product-market fit signal" }],
      },
      "BRL:7:2": {
        octopus: { projectedRevenue: "Y1: £180M", actualRevenue: "£200M (ahead of plan)", variance: "+11% — faster customer acquisition than projected", avgDealSize: "£2K/year per customer", grossMarginActual: "33%", varianceDrivers: "Customer acquisition 20% above target; wholesale costs slightly higher but offset by volume; Kraken licensing revenue ahead of plan" },
        northvolt: { projectedRevenue: "Y1: $180M", actualRevenue: "$160M (behind plan)", variance: "-11% — factory ramp 3 months behind schedule", avgDealSize: "$80M per OEM contract", grossMarginActual: "20%", varianceDrivers: "Production ramp delay reduced volume; raw material costs higher than projected; yield rate on target at 95%" },
        wayve: { projectedRevenue: "Y1: £6M", actualRevenue: "£7M (ahead of plan)", variance: "+17% — Uber partnership revenue share exceeded expectations", avgDealSize: "£1.4M per fleet partner", grossMarginActual: "74%", varianceDrivers: "Compute costs lower than projected (Azure discount); Uber revenue share producing more than flat license would have; one additional pilot partner signed" },
      },
      "BRL:7:3": {
        octopus: [{ partner: "Renewable energy generators", roleInModel: "Energy supply", agreementType: "Long-term PPA (power purchase agreement)", status: "Active", criticalDependency: "Yes" }, { partner: "Uswitch", roleInModel: "Customer acquisition channel", agreementType: "Referral partnership", status: "Active", criticalDependency: "No" }],
        northvolt: [{ partner: "Volkswagen", roleInModel: "Anchor customer + co-investor", agreementType: "5-year supply agreement + JV", status: "Active", criticalDependency: "Yes" }, { partner: "LKAB (mining)", roleInModel: "Raw material supply", agreementType: "Long-term supply contract", status: "Active", criticalDependency: "Yes" }],
        wayve: [{ partner: "Microsoft", roleInModel: "Cloud compute infrastructure", agreementType: "Strategic partnership + Azure credits", status: "Active", criticalDependency: "Yes" }, { partner: "Uber", roleInModel: "Go-to-market / ride-hailing platform", agreementType: "Commercial deployment agreement", status: "Active", criticalDependency: "Yes" }],
      },
      "BRL:8:1": {
        octopus: { annualRevenue: "£6B ARR", grossMarginTrailing: "35% blended", revenueGrowthRate: "50% YoY", unitEconomicsActual: "CAC: £25, LTV: £2,800, payback: 4 months", environmentalKPI: "6M tCO₂/year avoided (100% renewable sourcing)", socialKPI: "2,500+ tech jobs created; cheapest green tariff reducing fuel poverty", scalabilityIndicator: "UK + 6 international markets via Kraken licensing, 50M+ accounts" },
        northvolt: { annualRevenue: "$800M contracted", grossMarginTrailing: "24%", revenueGrowthRate: "100% YoY production capacity growth", unitEconomicsActual: "Cell cost: €105/kWh (improving), margin: €25/kWh", environmentalKPI: "500K tCO₂/year avoided vs industry-average cells", socialKPI: "3,000+ manufacturing jobs in Northern Sweden", scalabilityIndicator: "3 gigafactories (Skellefteå operational, Heide and Montréal under construction)" },
        wayve: { annualRevenue: "£25M ARR", grossMarginTrailing: "73%", revenueGrowthRate: "300% YoY", unitEconomicsActual: "CAC: £150K per partner, LTV: £8M+, payback: 6 months", environmentalKPI: "50K tCO₂/year reduction via optimised fleet routing", socialKPI: "500+ AI engineering jobs; reduced delivery driver fatigue-related incidents by 40%", scalabilityIndicator: "5 UK cities with active fleet operations, 500K+ autonomous miles" },
      },
      "BRL:8:2": {
        octopus: { activeSalesChannels: "Online self-serve switch, automated onboarding, smart meter install", revenueStreamsMix: "Energy retail: 75%, Kraken platform licensing: 20%, grid services: 5%", supplyChainStatus: "PPAs with 15+ renewable generators; smart meter partnerships with 3 providers; Kraken hosted on AWS with multi-region redundancy", bottleneckRisk: "Smart meter rollout pace in new markets; wholesale energy price spikes during extreme weather" },
        northvolt: { activeSalesChannels: "Enterprise sales: RFP response → pilot → multi-year contract", revenueStreamsMix: "EV cell sales: 90%, grid storage: 5%, recycling: 5%", supplyChainStatus: "Active supply agreements with LKAB (lithium), Nornickel (nickel); Siemens factory automation contract; logistics partnerships with Maersk", bottleneckRisk: "Raw material supply concentration — lithium from 2 suppliers; cobalt sourcing ethics; factory construction timeline for Heide" },
        wayve: { activeSalesChannels: "Research demo → pilot agreement → commercial license", revenueStreamsMix: "Per-vehicle license: 65%, Uber revenue share: 25%, fleet management SaaS: 10%", supplyChainStatus: "Microsoft Azure strategic partnership (compute); sensor hardware from Luminar and Continental; vehicle integration with Jaguar Land Rover", bottleneckRisk: "Regulatory approval timeline for driverless operations; dependency on Microsoft Azure pricing for inference costs" },
      },
      "BRL:8:3": {
        octopus: [{ date: "2023-06", changeMade: "Introduced Kraken licensing as separate revenue stream", rationale: "Platform value exceeds energy retail; licensing is 80%+ margin", impactOnMargin: "+5pp blended gross margin", impactOnSustainability: "Positive — helps other utilities adopt green tech" }],
        northvolt: [{ date: "2023-03", changeMade: "Added recycling vertical to reclaim production scrap", rationale: "Reduces raw material costs and improves ESG story", impactOnMargin: "+2pp gross margin (lower material costs)", impactOnSustainability: "Positive — 95% material recovery reduces mining demand" }],
        wayve: [{ date: "2023-09", changeMade: "Shifted from flat license to revenue share with Uber", rationale: "Aligns incentives; higher ceiling on revenue per vehicle", impactOnMargin: "Neutral short-term, +10pp long-term as ride volume grows", impactOnSustainability: "Neutral" }],
      },
      "BRL:9:1": {
        octopus: { profitVsPlan: "Target: 30% gross margin | Actual: 35% — Kraken licensing margin higher than projected", growthVsPlan: "Target: 40% YoY | Actual: 50% YoY — international expansion accelerating", scalabilityEvidence: "Replicated in 6 international markets; Kraken platform handles 50M+ accounts globally without architecture changes", envImpactVsTarget: "Target: 5M tCO₂/year | Actual: 6M tCO₂/year — exceeded due to faster customer growth", socialImpactVsTarget: "Target: 2,000 jobs | Actual: 2,500+ — exceeded with international office expansion" },
        northvolt: { profitVsPlan: "Target: 25% gross margin | Actual: 24% — slightly behind due to raw material costs", growthVsPlan: "Target: $1B revenue | Actual: $800M — factory ramp delay but order backlog strong", scalabilityEvidence: "Second gigafactory (Heide) breaking ground; third (Montréal) in construction — proves manufacturing model is replicable", envImpactVsTarget: "Target: 400K tCO₂/year avoided | Actual: 500K tCO₂/year — exceeded due to cleaner production process", socialImpactVsTarget: "Target: 2,500 jobs | Actual: 3,000+ — manufacturing employment exceeding targets" },
        wayve: { profitVsPlan: "Target: 65% gross margin | Actual: 73% — compute optimisation drove higher margins", growthVsPlan: "Target: £20M ARR | Actual: £25M ARR — Uber partnership outperforming", scalabilityEvidence: "Deployed to 5 cities in 3 months without retraining; time-to-deploy validated at 2 weeks per city", envImpactVsTarget: "Target: 30K tCO₂/year | Actual: 50K tCO₂/year — more fleet vehicles than projected", socialImpactVsTarget: "Target: 300 jobs | Actual: 500+ — AI talent hiring ahead of plan" },
      },
      "BRL:9:2": {
        octopus: { financialReporting: "Xero with monthly board reporting; quarterly investor updates; annual audited accounts", environmentalTracking: "Carbon accounting via Ecoinvent; annual third-party LCA audit; Ofgem sustainability reporting", socialImpactTracking: "Annual impact report; employee satisfaction surveys; fuel poverty impact metrics", reportingCadence: "Monthly financial, quarterly sustainability, annual external audit and impact report" },
        northvolt: { financialReporting: "SAP ERP with monthly P&L; quarterly board reports; annual Big 4 audit", environmentalTracking: "Full LCA per ISO 14040; EU Battery Regulation compliance reporting; carbon accounting per GHG Protocol", socialImpactTracking: "Annual sustainability report; community impact assessment; B Corp certification in progress", reportingCadence: "Monthly financial, quarterly ESG dashboard, annual third-party audit and sustainability report" },
        wayve: { financialReporting: "QuickBooks with monthly board pack; quarterly investor reporting; annual audited accounts", environmentalTracking: "Microsoft carbon dashboard for compute; fleet emissions tracking per vehicle; annual environmental review", socialImpactTracking: "Road safety incident reporting; diversity and inclusion metrics; community engagement log", reportingCadence: "Monthly financial, quarterly safety and environmental, annual comprehensive impact report" },
      },
      "BRL:9:3": {
        octopus: [{ year: "Year 1", revenue: "£200M", grossMargin: "28%", netProfit: "-£10M (growth investment)", environmentalKPI: "500K tCO₂ avoided", socialKPI: "500 jobs created" }, { year: "Year 3", revenue: "£2.5B", grossMargin: "33%", netProfit: "£80M", environmentalKPI: "4M tCO₂ avoided", socialKPI: "1,500 jobs" }, { year: "Year 5", revenue: "£6B", grossMargin: "35%", netProfit: "£300M", environmentalKPI: "6M tCO₂ avoided", socialKPI: "2,500+ jobs" }],
        northvolt: [{ year: "Year 1", revenue: "$180M", grossMargin: "18%", netProfit: "-$200M (factory ramp)", environmentalKPI: "100K tCO₂ avoided", socialKPI: "1,000 jobs created" }, { year: "Year 3", revenue: "$2B", grossMargin: "24%", netProfit: "-$50M (second factory capex)", environmentalKPI: "500K tCO₂ avoided", socialKPI: "3,000 jobs" }, { year: "Year 5", revenue: "$5B (projected)", grossMargin: "28%", netProfit: "$200M (projected)", environmentalKPI: "1M tCO₂ avoided (projected)", socialKPI: "5,000+ jobs (projected)" }],
        wayve: [{ year: "Year 1", revenue: "£6M", grossMargin: "70%", netProfit: "-£40M (R&D investment)", environmentalKPI: "5K tCO₂ avoided", socialKPI: "200 jobs created" }, { year: "Year 3", revenue: "£80M", grossMargin: "73%", netProfit: "-£5M (scaling investment)", environmentalKPI: "50K tCO₂ avoided", socialKPI: "500 jobs" }, { year: "Year 5", revenue: "£500M (projected)", grossMargin: "75%", netProfit: "£100M (projected)", environmentalKPI: "200K tCO₂ avoided (projected)", socialKPI: "1,000+ jobs (projected)" }],
      },
    };

    const exampleRows: { inlineToolConfigId: number; exampleCompanyId: number; exampleData: unknown }[] = [];
    for (const [key, examples] of Object.entries(exampleDataSeed)) {
      const cfg = configByKey.get(key);
      if (!cfg) continue;
      if (existingExConfigIds.has(cfg.id)) continue;
      if (examples.octopus) exampleRows.push({ inlineToolConfigId: cfg.id, exampleCompanyId: octopus.id, exampleData: examples.octopus });
      if (examples.northvolt) exampleRows.push({ inlineToolConfigId: cfg.id, exampleCompanyId: northvolt.id, exampleData: examples.northvolt });
      if (examples.wayve) exampleRows.push({ inlineToolConfigId: cfg.id, exampleCompanyId: wayve.id, exampleData: examples.wayve });
    }

    for (const row of exampleRows) {
      await db.insert(toolExampleData).values(row);
    }
  }
}

function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export function getDefaultMatchingConfig() {
  return {
    weights: {
      stage: 0.20,
      ticketSize: 0.15,
      sectorOverlap: 0.20,
      geography: 0.10,
      instruments: 0.05,
      semantic: 0.30,
    },
    exclusionCap: 15,
    aiCandidateCount: 60,
    aiBatchSize: 5,
    aiModel: "gpt-4o-mini",
    aiMaxTokens: 1500,
    contextCharLimit: 2500,
    feedbackCount: 15,
    stageDistancePenalties: {
      direct: 100,
      oneAway: 50,
      twoAway: 20,
      threePlus: 0,
    },
    ticketSizeThresholds: {
      hardExcludeMinRatio: 0.5,
      hardExcludeMaxRatio: 2.0,
      partialCap: 60,
    },
    sectorMatchWeights: {
      direct: 1.0,
      partial: 0.5,
      subSector: 0.3,
    },
    investorTypePreference: {
      matchBoost: 1.10,
      nonMatchPenalty: 0.90,
    },
    defaultScores: {
      stageIncomplete: 30,
      ticketIncomplete: 40,
      noSectors: 30,
      noInvestorSectors: 20,
      noGeo: 50,
      noInvestorGeo: 30,
      noInstruments: 50,
      noInvestorInstruments: 40,
      aiFailure: 40,
    },
    stageCompatibility: {
      "Pre-seed": ["Pre-seed"],
      "Seed": ["Pre-seed", "Seed"],
      "Series A": ["Seed", "Series A"],
      "Series B": ["Series A", "Series B"],
      "Post-Series B": ["Series B", "Post-Series B"],
      "Growth": ["Series B", "Post-Series B", "Growth"],
    },
    geoCompatibility: {
      "United Kingdom": ["UK", "United Kingdom", "Europe", "Global", "Worldwide"],
      "Europe (excl. UK)": ["Europe", "Global", "Worldwide"],
      "North America": ["North America", "Global", "Worldwide"],
      "Africa": ["Africa", "Global", "Worldwide"],
      "Asia": ["Asia", "Global", "Worldwide"],
      "Global": ["Global", "Worldwide"],
    },
    aiSystemPrompt: `You are an expert investor-startup matching analyst for climate tech ventures. Respond in British English (use spellings such as organise, customise, programme, behaviour, colour, centre, analyse, optimise, recognise, prioritise, summarise).

Your task is to analyse the strategic fit between a startup seeking investment and a potential investor. Provide a thorough, evidence-based assessment.

STEP 1 - EXCLUSION CHECK (do this FIRST):
Scan the investor profile for hard constraints that would disqualify this startup:
- Geographic restrictions (e.g., "only invests in Cambridge companies")
- University/ecosystem affiliations (e.g., "Imperial College ventures only")
- Sector exclusions (e.g., "does not invest in consumer")
- Stage hard limits (e.g., "we never invest pre-revenue")

If any exclusion is found, set exclusion_found=true, score between 0-10, and explain the exclusion in your insight.

STEP 2 - ALIGNMENT SCORING (only if no exclusion):
Score the strategic alignment:
- 90-100: Exceptional strategic alignment across multiple dimensions
- 70-89: Strong alignment with clear synergies
- 50-69: Moderate fit with some gaps
- 30-49: Weak alignment
- 0-29: Poor fit

STEP 3 - WRITE YOUR INSIGHT (4-6 sentences, citing specific evidence):
Your insight MUST address each of these dimensions with concrete details from the profiles:
1. **Sector & Thesis Alignment**: Name the specific sectors or themes that overlap between the startup's focus and the investor's stated thesis or sector focus. Quote from their thesis if relevant.
2. **Stage & Ticket Fit**: Comment on whether the investor's typical stage and ticket size range matches the startup's current round.
3. **Geographic Relevance**: Note whether the investor's regional focus aligns with where the startup operates or is raising.
4. **Strategic Value-Add**: Based on the investor's description, portfolio, or type, explain what strategic value they could bring beyond capital (domain expertise, network, follow-on potential).
5. **Investor Type Match**: If the startup specified preferred investor types, note whether this investor matches and why that matters.

Do NOT use vague language like "good fit" or "aligns well" without citing the specific evidence from both profiles.

You MUST respond with valid JSON in this exact format:
{"score": <number 0-100>, "exclusion_found": <boolean>, "insight": "<4-6 sentence evidence-based analysis>"}`,
  };
}

// --- Events ---
export interface EventOccurrenceWithSeries extends EventOccurrence {
  series: EventSeries;
  resolvedTitle: string;
  resolvedDescription: string | null;
  resolvedLocationType: string;
  resolvedLocationDetails: string | null;
  rsvpCount?: number;
  myRsvp?: EventRsvp | null;
  linkedSprintIds?: number[];
}

export interface IEventStorage {
  createEventSeries(data: InsertEventSeries): Promise<EventSeries>;
  updateEventSeries(id: number, data: Partial<InsertEventSeries>): Promise<EventSeries>;
  getEventSeries(id: number): Promise<EventSeries | undefined>;
  deleteEventSeries(id: number): Promise<void>;
  createEventOccurrence(data: InsertEventOccurrence): Promise<EventOccurrence>;
  updateEventOccurrence(id: number, data: Partial<InsertEventOccurrence>): Promise<EventOccurrence>;
  getEventOccurrence(id: number): Promise<EventOccurrence | undefined>;
  getEventOccurrenceWithSeries(id: number, userId?: string): Promise<EventOccurrenceWithSeries | undefined>;
  getOccurrencesForSeries(seriesId: number): Promise<EventOccurrence[]>;
  cancelOccurrencesAfter(seriesId: number, fromDate: Date): Promise<void>;
  deleteOccurrence(id: number): Promise<void>;
  setEventAudiences(seriesId: number, audiences: Omit<InsertEventAudience, "seriesId">[]): Promise<void>;
  getEventAudiences(seriesId: number): Promise<EventAudience[]>;
  resolveEventAudienceUserIds(seriesId: number): Promise<string[]>;
  resolveAudienceUserIdsForPreview(audiences: { audienceType: string; audienceId: string | null }[]): Promise<string[]>;
  getUserEmails(userIds: string[]): Promise<{ id: string; email: string | null; firstName: string | null; lastName: string | null }[]>;
  getUpcomingEventsForUser(userId: string, limit?: number): Promise<EventOccurrenceWithSeries[]>;
  getPastEventsForUser(userId: string, limit?: number): Promise<EventOccurrenceWithSeries[]>;
  getAllEventSeriesAdmin(): Promise<(EventSeries & { occurrenceCount: number })[]>;
  upsertRsvp(eventId: number, userId: string, status: string): Promise<EventRsvp>;
  getRsvpsForEvent(eventId: number): Promise<(EventRsvp & { firstName: string | null; lastName: string | null; email: string | null })[]>;
  isUserExplicitlyInvitedToAnyEvent(userId: string): Promise<boolean>;
  getRecordingForEvent(eventId: number): Promise<EventRecording | undefined>;
  createEventRecording(data: InsertEventRecording): Promise<EventRecording>;
  updateEventRecording(id: number, data: Partial<InsertEventRecording>): Promise<EventRecording>;
  findEventByWherebyMeetingId(meetingId: string): Promise<EventOccurrence | undefined>;
  getEventSeriesSprintIds(seriesId: number): Promise<number[]>;
  setEventSeriesSprints(seriesId: number, sprintIds: number[]): Promise<void>;
  getSprintIdsBySeriesIds(seriesIds: number[]): Promise<Map<number, number[]>>;
}

// Declaration merging: tells TypeScript that DatabaseStorage carries the
// IEventStorage methods (added via prototype assignments below). This lets
// callers use `storage.createEventSeries(...)` with full typing — no `as any`.
export interface DatabaseStorage extends IEventStorage {}

DatabaseStorage.prototype.createEventSeries = async function (data: InsertEventSeries): Promise<EventSeries> {
  const [row] = await db.insert(eventSeries).values(data).returning();
  return row;
};

DatabaseStorage.prototype.updateEventSeries = async function (id: number, data: Partial<InsertEventSeries>): Promise<EventSeries> {
  const [row] = await db.update(eventSeries).set({ ...data, updatedAt: new Date() }).where(eq(eventSeries.id, id)).returning();
  return row;
};

DatabaseStorage.prototype.getEventSeries = async function (id: number): Promise<EventSeries | undefined> {
  const [row] = await db.select().from(eventSeries).where(eq(eventSeries.id, id));
  return row;
};

DatabaseStorage.prototype.deleteEventSeries = async function (id: number): Promise<void> {
  // No FK cascades on these tables — clear dependents (rsvps, recordings)
  // before deleting the occurrences they point at, then audiences, then
  // the series itself. Otherwise we leak orphan rows.
  const occs = await db.select({ id: eventOccurrences.id }).from(eventOccurrences).where(eq(eventOccurrences.seriesId, id));
  const occIds = occs.map(o => o.id);
  if (occIds.length > 0) {
    await db.delete(eventRsvps).where(inArray(eventRsvps.eventId, occIds));
    await db.delete(eventRecordings).where(inArray(eventRecordings.eventId, occIds));
  }
  await db.delete(eventOccurrences).where(eq(eventOccurrences.seriesId, id));
  await db.delete(eventAudiences).where(eq(eventAudiences.seriesId, id));
  await db.delete(eventSeriesSprints).where(eq(eventSeriesSprints.seriesId, id));
  await db.delete(eventSeries).where(eq(eventSeries.id, id));
};

DatabaseStorage.prototype.getEventSeriesSprintIds = async function (seriesId: number): Promise<number[]> {
  const rows = await db.select({ sprintId: eventSeriesSprints.sprintId }).from(eventSeriesSprints).where(eq(eventSeriesSprints.seriesId, seriesId));
  return rows.map(r => r.sprintId);
};

DatabaseStorage.prototype.setEventSeriesSprints = async function (seriesId: number, sprintIds: number[]): Promise<void> {
  await db.delete(eventSeriesSprints).where(eq(eventSeriesSprints.seriesId, seriesId));
  const unique = Array.from(new Set(sprintIds.filter(n => Number.isFinite(n))));
  if (unique.length > 0) {
    await db.insert(eventSeriesSprints).values(unique.map(sprintId => ({ seriesId, sprintId })));
  }
};

DatabaseStorage.prototype.getSprintIdsBySeriesIds = async function (seriesIds: number[]): Promise<Map<number, number[]>> {
  const out = new Map<number, number[]>();
  if (seriesIds.length === 0) return out;
  const rows = await db.select().from(eventSeriesSprints).where(inArray(eventSeriesSprints.seriesId, seriesIds));
  for (const r of rows) {
    const list = out.get(r.seriesId) || [];
    list.push(r.sprintId);
    out.set(r.seriesId, list);
  }
  return out;
};

DatabaseStorage.prototype.createEventOccurrence = async function (data: InsertEventOccurrence): Promise<EventOccurrence> {
  const [row] = await db.insert(eventOccurrences).values(data).returning();
  return row;
};

DatabaseStorage.prototype.updateEventOccurrence = async function (id: number, data: Partial<InsertEventOccurrence>): Promise<EventOccurrence> {
  const [row] = await db.update(eventOccurrences).set({ ...data, updatedAt: new Date() }).where(eq(eventOccurrences.id, id)).returning();
  return row;
};

DatabaseStorage.prototype.getEventOccurrence = async function (id: number): Promise<EventOccurrence | undefined> {
  const [row] = await db.select().from(eventOccurrences).where(eq(eventOccurrences.id, id));
  return row;
};

DatabaseStorage.prototype.getEventOccurrenceWithSeries = async function (id: number, userId?: string): Promise<EventOccurrenceWithSeries | undefined> {
  const [row] = await db.select().from(eventOccurrences).where(eq(eventOccurrences.id, id));
  if (!row) return undefined;
  const [series] = await db.select().from(eventSeries).where(eq(eventSeries.id, row.seriesId));
  if (!series) return undefined;
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(eventRsvps).where(and(eq(eventRsvps.eventId, id), eq(eventRsvps.status, "going")));
  let myRsvp: EventRsvp | null = null;
  if (userId) {
    const [r] = await db.select().from(eventRsvps).where(and(eq(eventRsvps.eventId, id), eq(eventRsvps.userId, userId)));
    myRsvp = r || null;
  }
  return {
    ...row,
    series,
    resolvedTitle: row.titleOverride || series.title,
    resolvedDescription: row.descriptionOverride ?? series.description,
    resolvedLocationType: row.locationTypeOverride || series.locationType,
    resolvedLocationDetails: row.locationDetailsOverride ?? series.locationDetails,
    rsvpCount: count || 0,
    myRsvp,
  };
};

DatabaseStorage.prototype.getOccurrencesForSeries = async function (seriesId: number): Promise<EventOccurrence[]> {
  return db.select().from(eventOccurrences).where(eq(eventOccurrences.seriesId, seriesId)).orderBy(eventOccurrences.startsAt);
};

DatabaseStorage.prototype.cancelOccurrencesAfter = async function (seriesId: number, fromDate: Date): Promise<void> {
  await db.update(eventOccurrences).set({ status: "cancelled", updatedAt: new Date() }).where(and(eq(eventOccurrences.seriesId, seriesId), gte(eventOccurrences.startsAt, fromDate)));
};

DatabaseStorage.prototype.deleteOccurrence = async function (id: number): Promise<void> {
  await db.delete(eventRsvps).where(eq(eventRsvps.eventId, id));
  await db.delete(eventRecordings).where(eq(eventRecordings.eventId, id));
  await db.delete(eventOccurrences).where(eq(eventOccurrences.id, id));
};

DatabaseStorage.prototype.setEventAudiences = async function (seriesId: number, audiences: Omit<InsertEventAudience, "seriesId">[]): Promise<void> {
  await db.delete(eventAudiences).where(eq(eventAudiences.seriesId, seriesId));
  if (audiences.length > 0) {
    await db.insert(eventAudiences).values(audiences.map(a => ({ ...a, seriesId })));
  }
};

DatabaseStorage.prototype.getEventAudiences = async function (seriesId: number): Promise<EventAudience[]> {
  return db.select().from(eventAudiences).where(eq(eventAudiences.seriesId, seriesId));
};

async function resolveAudienceListToUserIds(audiences: { audienceType: string; audienceId: string | null }[]): Promise<string[]> {
  const userIds = new Set<string>();
  for (const a of audiences) {
    if (a.audienceType === "all") {
      // "Everyone" = all founders (the platform is invitation-only for
      // ClimateTech founders; admins/EIRs/investors can still see events
      // they're explicitly added to via other audience types).
      const founderRows = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "founder"));
      founderRows.forEach(u => userIds.add(u.id));
    } else if (a.audienceType === "user" && a.audienceId) {
      // Explicit individual invite — admins/EIRs/investors can be added this way.
      userIds.add(a.audienceId);
    } else if (a.audienceType === "startup" && a.audienceId) {
      const sid = parseInt(a.audienceId);
      if (!isNaN(sid)) {
        const members = await db.select({ userId: startupMembers.userId }).from(startupMembers).where(eq(startupMembers.startupId, sid));
        members.forEach(m => userIds.add(m.userId));
      }
    } else if (a.audienceType === "programme" && a.audienceId) {
      const pid = parseInt(a.audienceId);
      if (!isNaN(pid)) {
        const links = await db.select({ startupId: programmeStartups.startupId }).from(programmeStartups).where(eq(programmeStartups.programmeId, pid));
        if (links.length > 0) {
          const sids = links.map(l => l.startupId);
          const members = await db.select({ userId: startupMembers.userId }).from(startupMembers).where(inArray(startupMembers.startupId, sids));
          members.forEach(m => userIds.add(m.userId));
        }
      }
    } else if (a.audienceType === "cohort" && a.audienceId) {
      const cid = parseInt(a.audienceId);
      if (!isNaN(cid)) {
        const links = await db.select({ startupId: startupCohorts.startupId }).from(startupCohorts).where(eq(startupCohorts.cohortId, cid));
        if (links.length > 0) {
          const sids = links.map(l => l.startupId);
          const members = await db.select({ userId: startupMembers.userId }).from(startupMembers).where(inArray(startupMembers.startupId, sids));
          members.forEach(m => userIds.add(m.userId));
        }
      }
    } else if (a.audienceType === "group" && a.audienceId) {
      const gid = parseInt(a.audienceId);
      if (!isNaN(gid)) {
        // Group audience resolves to startup-member founders only. EIRs are
        // NOT auto-included — admins must explicitly add them as `user`
        // audience entries to invite them.
        const links = await db.select({ startupId: startupGroups.startupId }).from(startupGroups).where(eq(startupGroups.groupId, gid));
        if (links.length > 0) {
          const sids = links.map(l => l.startupId);
          const members = await db.select({ userId: startupMembers.userId }).from(startupMembers).where(inArray(startupMembers.startupId, sids));
          members.forEach(m => userIds.add(m.userId));
        }
      }
    }
  }
  // Filter audience-derived members down to founder-role users. Individual
  // `user` audience entries (which may be admin/EIR/investor) are preserved
  // by re-adding them after the role filter.
  const explicitUserIds = new Set(
    audiences.filter(a => a.audienceType === "user" && a.audienceId).map(a => a.audienceId as string),
  );
  if (userIds.size === 0) return [];
  const ids = Array.from(userIds);
  const founderRows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, ids), eq(users.role, "founder")));
  const result = new Set(founderRows.map(r => r.id));
  explicitUserIds.forEach(uid => result.add(uid));
  return Array.from(result);
}

DatabaseStorage.prototype.resolveEventAudienceUserIds = async function (seriesId: number): Promise<string[]> {
  const audiences = await db.select().from(eventAudiences).where(eq(eventAudiences.seriesId, seriesId));
  return resolveAudienceListToUserIds(audiences);
};

DatabaseStorage.prototype.resolveAudienceUserIdsForPreview = async function (audiences) {
  return resolveAudienceListToUserIds(audiences);
};

DatabaseStorage.prototype.getUserEmails = async function (userIds: string[]) {
  if (userIds.length === 0) return [];
  return db.select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName }).from(users).where(inArray(users.id, userIds));
};

DatabaseStorage.prototype.getUpcomingEventsForUser = async function (userId: string, limit: number = 50): Promise<EventOccurrenceWithSeries[]> {
  // Get all programmes/cohorts/groups/startups the user belongs to
  const memberships = await db.select({ startupId: startupMembers.startupId }).from(startupMembers).where(eq(startupMembers.userId, userId));
  const userStartupIds = memberships.map(m => m.startupId);

  let userProgrammeIds: number[] = [];
  let userCohortIds: number[] = [];
  let userGroupIds: number[] = [];
  if (userStartupIds.length > 0) {
    const ps = await db.select({ programmeId: programmeStartups.programmeId }).from(programmeStartups).where(inArray(programmeStartups.startupId, userStartupIds));
    userProgrammeIds = Array.from(new Set(ps.map(p => p.programmeId)));
    const sc = await db.select({ cohortId: startupCohorts.cohortId }).from(startupCohorts).where(inArray(startupCohorts.startupId, userStartupIds));
    userCohortIds = Array.from(new Set(sc.map(c => c.cohortId)));
    const sg = await db.select({ groupId: startupGroups.groupId }).from(startupGroups).where(inArray(startupGroups.startupId, userStartupIds));
    userGroupIds = Array.from(new Set(sg.map(g => g.groupId)));
  }
  // EiR group assignments deliberately do NOT grant audience visibility:
  // resolveAudienceListToUserIds resolves group/cohort/programme audiences
  // to founder-role users only. To keep list visibility consistent with
  // detail/RSVP authorization, EiRs only see events where they're explicitly
  // invited via the `user` audience type.
  const [userRow] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
  const isFounder = userRow?.role === "founder";
  const isAdminLike = userRow?.role === "admin" || userRow?.role === "superadmin";

  const now = new Date();
  let seriesIds: number[];
  if (isAdminLike) {
    const allSeries = await db.select({ id: eventSeries.id }).from(eventSeries);
    seriesIds = allSeries.map(s => s.id);
  } else {
    const audienceConditions: any[] = [];
    if (isFounder) {
      audienceConditions.push(eq(eventAudiences.audienceType, "all"));
    }
    audienceConditions.push(and(eq(eventAudiences.audienceType, "user"), eq(eventAudiences.audienceId, userId))!);
    if (userStartupIds.length > 0) {
      audienceConditions.push(and(eq(eventAudiences.audienceType, "startup"), inArray(eventAudiences.audienceId, userStartupIds.map(String)))!);
    }
    if (userProgrammeIds.length > 0) {
      audienceConditions.push(and(eq(eventAudiences.audienceType, "programme"), inArray(eventAudiences.audienceId, userProgrammeIds.map(String)))!);
    }
    if (userCohortIds.length > 0) {
      audienceConditions.push(and(eq(eventAudiences.audienceType, "cohort"), inArray(eventAudiences.audienceId, userCohortIds.map(String)))!);
    }
    if (userGroupIds.length > 0) {
      audienceConditions.push(and(eq(eventAudiences.audienceType, "group"), inArray(eventAudiences.audienceId, userGroupIds.map(String)))!);
    }
    if (audienceConditions.length === 0) return [];
    const audienceRows = await db.select({ seriesId: eventAudiences.seriesId }).from(eventAudiences).where(or(...audienceConditions));
    seriesIds = Array.from(new Set(audienceRows.map(a => a.seriesId)));
  }
  if (seriesIds.length === 0) return [];

  const occRows = await db.select().from(eventOccurrences).where(and(inArray(eventOccurrences.seriesId, seriesIds), gte(eventOccurrences.endsAt, now))).orderBy(eventOccurrences.startsAt).limit(limit);
  if (occRows.length === 0) return [];
  const usedSeriesIds = Array.from(new Set(occRows.map(o => o.seriesId)));
  const seriesRows = await db.select().from(eventSeries).where(inArray(eventSeries.id, usedSeriesIds));
  const seriesMap = new Map(seriesRows.map(s => [s.id, s]));
  const rsvpRows = await db.select().from(eventRsvps).where(and(inArray(eventRsvps.eventId, occRows.map(o => o.id)), eq(eventRsvps.userId, userId)));
  const rsvpMap = new Map(rsvpRows.map(r => [r.eventId, r]));
  const sprintLinks = await (this as any).getSprintIdsBySeriesIds(usedSeriesIds) as Map<number, number[]>;

  return occRows
    .filter(o => seriesMap.has(o.seriesId))
    .map(o => {
      const s = seriesMap.get(o.seriesId)!;
      return {
        ...o,
        series: s,
        resolvedTitle: o.titleOverride || s.title,
        resolvedDescription: o.descriptionOverride ?? s.description,
        resolvedLocationType: o.locationTypeOverride || s.locationType,
        resolvedLocationDetails: o.locationDetailsOverride ?? s.locationDetails,
        myRsvp: rsvpMap.get(o.id) || null,
        linkedSprintIds: sprintLinks.get(o.seriesId) || [],
      };
    });
};

DatabaseStorage.prototype.getPastEventsForUser = async function (userId: string, limit: number = 50): Promise<EventOccurrenceWithSeries[]> {
  // Mirrors getUpcomingEventsForUser but for past events (endsAt < now), ordered desc.
  const memberships = await db.select({ startupId: startupMembers.startupId }).from(startupMembers).where(eq(startupMembers.userId, userId));
  const userStartupIds = memberships.map(m => m.startupId);
  let userProgrammeIds: number[] = [];
  let userCohortIds: number[] = [];
  let userGroupIds: number[] = [];
  if (userStartupIds.length > 0) {
    const ps = await db.select({ programmeId: programmeStartups.programmeId }).from(programmeStartups).where(inArray(programmeStartups.startupId, userStartupIds));
    userProgrammeIds = Array.from(new Set(ps.map(p => p.programmeId)));
    const sc = await db.select({ cohortId: startupCohorts.cohortId }).from(startupCohorts).where(inArray(startupCohorts.startupId, userStartupIds));
    userCohortIds = Array.from(new Set(sc.map(c => c.cohortId)));
    const sg = await db.select({ groupId: startupGroups.groupId }).from(startupGroups).where(inArray(startupGroups.startupId, userStartupIds));
    userGroupIds = Array.from(new Set(sg.map(g => g.groupId)));
  }
  // EiR group assignments intentionally excluded — see getUpcomingEventsForUser.
  const [userRow] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
  const isFounder = userRow?.role === "founder";
  const isAdminLike = userRow?.role === "admin" || userRow?.role === "superadmin";

  let seriesIds: number[];
  if (isAdminLike) {
    const allSeries = await db.select({ id: eventSeries.id }).from(eventSeries);
    seriesIds = allSeries.map(s => s.id);
  } else {
    const audienceConditions: any[] = [];
    if (isFounder) audienceConditions.push(eq(eventAudiences.audienceType, "all"));
    audienceConditions.push(and(eq(eventAudiences.audienceType, "user"), eq(eventAudiences.audienceId, userId))!);
    if (userStartupIds.length > 0) audienceConditions.push(and(eq(eventAudiences.audienceType, "startup"), inArray(eventAudiences.audienceId, userStartupIds.map(String)))!);
    if (userProgrammeIds.length > 0) audienceConditions.push(and(eq(eventAudiences.audienceType, "programme"), inArray(eventAudiences.audienceId, userProgrammeIds.map(String)))!);
    if (userCohortIds.length > 0) audienceConditions.push(and(eq(eventAudiences.audienceType, "cohort"), inArray(eventAudiences.audienceId, userCohortIds.map(String)))!);
    if (userGroupIds.length > 0) audienceConditions.push(and(eq(eventAudiences.audienceType, "group"), inArray(eventAudiences.audienceId, userGroupIds.map(String)))!);
    if (audienceConditions.length === 0) return [];
    const audienceRows = await db.select({ seriesId: eventAudiences.seriesId }).from(eventAudiences).where(or(...audienceConditions));
    seriesIds = Array.from(new Set(audienceRows.map(a => a.seriesId)));
  }
  if (seriesIds.length === 0) return [];

  const now = new Date();
  const occRows = await db.select().from(eventOccurrences).where(and(inArray(eventOccurrences.seriesId, seriesIds), sql`${eventOccurrences.endsAt} < ${now}`)).orderBy(desc(eventOccurrences.startsAt)).limit(limit);
  if (occRows.length === 0) return [];
  const usedSeriesIds = Array.from(new Set(occRows.map(o => o.seriesId)));
  const seriesRows = await db.select().from(eventSeries).where(inArray(eventSeries.id, usedSeriesIds));
  const seriesMap = new Map(seriesRows.map(s => [s.id, s]));
  const rsvpRows = await db.select().from(eventRsvps).where(and(inArray(eventRsvps.eventId, occRows.map(o => o.id)), eq(eventRsvps.userId, userId)));
  const rsvpMap = new Map(rsvpRows.map(r => [r.eventId, r]));
  const sprintLinks = await (this as any).getSprintIdsBySeriesIds(usedSeriesIds) as Map<number, number[]>;
  return occRows.filter(o => seriesMap.has(o.seriesId)).map(o => {
    const s = seriesMap.get(o.seriesId)!;
    return {
      ...o, series: s,
      resolvedTitle: o.titleOverride || s.title,
      resolvedDescription: o.descriptionOverride ?? s.description,
      resolvedLocationType: o.locationTypeOverride || s.locationType,
      resolvedLocationDetails: o.locationDetailsOverride ?? s.locationDetails,
      myRsvp: rsvpMap.get(o.id) || null,
      linkedSprintIds: sprintLinks.get(o.seriesId) || [],
    };
  });
};

DatabaseStorage.prototype.getAllEventSeriesAdmin = async function (): Promise<(EventSeries & { occurrenceCount: number })[]> {
  const rows = await db.select().from(eventSeries).orderBy(desc(eventSeries.createdAt));
  const result: (EventSeries & { occurrenceCount: number })[] = [];
  for (const r of rows) {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(eventOccurrences).where(eq(eventOccurrences.seriesId, r.id));
    result.push({ ...r, occurrenceCount: count || 0 });
  }
  return result;
};

DatabaseStorage.prototype.upsertRsvp = async function (eventId: number, userId: string, status: string): Promise<EventRsvp> {
  const [existing] = await db.select().from(eventRsvps).where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, userId)));
  if (existing) {
    const [row] = await db.update(eventRsvps).set({ status, respondedAt: new Date() }).where(eq(eventRsvps.id, existing.id)).returning();
    return row;
  }
  const [row] = await db.insert(eventRsvps).values({ eventId, userId, status }).returning();
  return row;
};

DatabaseStorage.prototype.isUserExplicitlyInvitedToAnyEvent = async function (userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: eventAudiences.id })
    .from(eventAudiences)
    .where(and(eq(eventAudiences.audienceType, "user"), eq(eventAudiences.audienceId, userId)))
    .limit(1);
  return !!row;
};

DatabaseStorage.prototype.getRsvpsForEvent = async function (eventId: number) {
  return db
    .select({
      id: eventRsvps.id,
      eventId: eventRsvps.eventId,
      userId: eventRsvps.userId,
      status: eventRsvps.status,
      respondedAt: eventRsvps.respondedAt,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(eventRsvps)
    .leftJoin(users, eq(eventRsvps.userId, users.id))
    .where(eq(eventRsvps.eventId, eventId));
};

DatabaseStorage.prototype.getRecordingForEvent = async function (eventId: number): Promise<EventRecording | undefined> {
  const [row] = await db.select().from(eventRecordings).where(eq(eventRecordings.eventId, eventId)).orderBy(desc(eventRecordings.createdAt)).limit(1);
  return row;
};

DatabaseStorage.prototype.createEventRecording = async function (data: InsertEventRecording): Promise<EventRecording> {
  const [row] = await db.insert(eventRecordings).values(data).returning();
  return row;
};

DatabaseStorage.prototype.updateEventRecording = async function (id: number, data: Partial<InsertEventRecording>): Promise<EventRecording> {
  const [row] = await db.update(eventRecordings).set({ ...data, updatedAt: new Date() }).where(eq(eventRecordings.id, id)).returning();
  return row;
};

DatabaseStorage.prototype.findEventByWherebyMeetingId = async function (meetingId: string): Promise<EventOccurrence | undefined> {
  const [row] = await db.select().from(eventOccurrences).where(eq(eventOccurrences.wherebyMeetingId, meetingId));
  return row;
};

export const storage = new DatabaseStorage();

// =============================================================================
// My Journey: sprints, sprint missions, KPIs, EIR profile, cohort dates
// =============================================================================

// Default phase plan for Undaunted: 7 Foundation sprints in KTH dimension order
// (2 weeks each) + 10 Mastermind sprints (~4 weeks each).
const UNDAUNTED_FOUNDATION_DIMENSIONS = [
  { dimension: "CRL", label: "Customer" },
  { dimension: "TRL", label: "Technology" },
  { dimension: "BRL", label: "Commercial Model" },
  { dimension: "IPRL", label: "Defensibility & Differentiation" },
  { dimension: "TMRL", label: "Team & Resources" },
  { dimension: "FRL", label: "Funding" },
  { dimension: "CIRL", label: "Climate Impact" },
];

DatabaseStorage.prototype.getSprintsForProgramme = async function (programmeId: number): Promise<Sprint[]> {
  return db.select().from(sprints).where(eq(sprints.programmeId, programmeId)).orderBy(sprints.phaseKey, sprints.orderIndex);
};

DatabaseStorage.prototype.createSprint = async function (data: InsertSprint): Promise<Sprint> {
  const [row] = await db.insert(sprints).values(data).returning();
  return row;
};

DatabaseStorage.prototype.updateSprint = async function (id: number, data: Partial<InsertSprint>): Promise<Sprint | undefined> {
  const [row] = await db.update(sprints).set(data).where(eq(sprints.id, id)).returning();
  return row;
};

DatabaseStorage.prototype.deleteSprint = async function (id: number): Promise<void> {
  // Cascade: remove any event-series links pointing at this sprint so we
  // don't leak orphan rows (no FK cascades on these tables).
  await db.delete(eventSeriesSprints).where(eq(eventSeriesSprints.sprintId, id));
  await db.delete(sprints).where(eq(sprints.id, id));
};

DatabaseStorage.prototype.getSprint = async function (id: number): Promise<Sprint | undefined> {
  const [row] = await db.select().from(sprints).where(eq(sprints.id, id));
  return row;
};

DatabaseStorage.prototype.getSprintMissionsForStartup = async function (startupId: number): Promise<SprintMission[]> {
  return db.select().from(sprintMissions).where(eq(sprintMissions.startupId, startupId)).orderBy(desc(sprintMissions.chosenAt));
};

DatabaseStorage.prototype.getSprintMission = async function (startupId: number, sprintId: number): Promise<SprintMission | undefined> {
  const [row] = await db.select().from(sprintMissions).where(and(eq(sprintMissions.startupId, startupId), eq(sprintMissions.sprintId, sprintId)));
  return row;
};

DatabaseStorage.prototype.upsertSprintMission = async function (data: InsertSprintMission): Promise<SprintMission> {
  const existing = await this.getSprintMission(data.startupId, data.sprintId);
  if (existing) {
    const [row] = await db.update(sprintMissions).set({
      missionId: data.missionId,
      confidence: data.confidence ?? existing.confidence,
      rationale: data.rationale ?? existing.rationale,
      // re-choosing resets confirmation
      status: "proposed",
      confirmedAt: null,
      confirmedBy: null,
      chosenBy: data.chosenBy,
      chosenAt: new Date(),
    }).where(eq(sprintMissions.id, existing.id)).returning();
    return row;
  }
  const [row] = await db.insert(sprintMissions).values(data).returning();
  return row;
};

DatabaseStorage.prototype.updateSprintMission = async function (id: number, data: Partial<InsertSprintMission>): Promise<SprintMission | undefined> {
  const [row] = await db.update(sprintMissions).set(data).where(eq(sprintMissions.id, id)).returning();
  return row;
};

DatabaseStorage.prototype.getRecentSprintMissionsForGroup = async function (groupId: number, limit: number = 25) {
  const rows = await db
    .select({
      mission: sprintMissions,
      startupName: startups.name,
      sprintLabel: sprints.label,
    })
    .from(sprintMissions)
    .innerJoin(startupGroups, eq(startupGroups.startupId, sprintMissions.startupId))
    .innerJoin(startups, eq(startups.id, sprintMissions.startupId))
    .innerJoin(sprints, eq(sprints.id, sprintMissions.sprintId))
    .where(eq(startupGroups.groupId, groupId))
    .orderBy(desc(sprintMissions.chosenAt))
    .limit(limit);
  return rows.map(r => ({ ...r.mission, startupName: r.startupName, sprintLabel: r.sprintLabel }));
};

DatabaseStorage.prototype.getSprintDefaultMissionCompletions = async function (startupId: number): Promise<SprintDefaultMissionCompletion[]> {
  return db.select().from(sprintDefaultMissionCompletions).where(eq(sprintDefaultMissionCompletions.startupId, startupId));
};

DatabaseStorage.prototype.markSprintDefaultMissionComplete = async function (startupId: number, sprintId: number, userId: string): Promise<SprintDefaultMissionCompletion> {
  // Atomic upsert: relies on the unique index on (startupId, sprintId) so two
  // concurrent clicks can't race into a 500. On conflict we keep the existing
  // row (first-write-wins) and return it.
  const [inserted] = await db.insert(sprintDefaultMissionCompletions)
    .values({ startupId, sprintId, completedBy: userId })
    .onConflictDoNothing({ target: [sprintDefaultMissionCompletions.startupId, sprintDefaultMissionCompletions.sprintId] })
    .returning();
  if (inserted) return inserted;
  const [existing] = await db.select().from(sprintDefaultMissionCompletions)
    .where(and(eq(sprintDefaultMissionCompletions.startupId, startupId), eq(sprintDefaultMissionCompletions.sprintId, sprintId)));
  return existing;
};

DatabaseStorage.prototype.getKpisForStartup = async function (startupId: number): Promise<Kpi[]> {
  return db.select().from(kpis).where(eq(kpis.startupId, startupId)).orderBy(kpis.displayOrder, kpis.id);
};

DatabaseStorage.prototype.createKpi = async function (data: InsertKpi): Promise<Kpi> {
  const [row] = await db.insert(kpis).values(data).returning();
  return row;
};

DatabaseStorage.prototype.updateKpi = async function (id: number, data: Partial<InsertKpi>): Promise<Kpi | undefined> {
  const [row] = await db.update(kpis).set({ ...data, updatedAt: new Date() }).where(eq(kpis.id, id)).returning();
  return row;
};

DatabaseStorage.prototype.deleteKpi = async function (id: number): Promise<void> {
  await db.delete(kpiSnapshots).where(eq(kpiSnapshots.kpiId, id));
  await db.delete(kpis).where(eq(kpis.id, id));
};

DatabaseStorage.prototype.getKpi = async function (id: number): Promise<Kpi | undefined> {
  const [row] = await db.select().from(kpis).where(eq(kpis.id, id));
  return row;
};

DatabaseStorage.prototype.getKpiSnapshots = async function (kpiId: number, limit: number = 24): Promise<KpiSnapshot[]> {
  return db.select().from(kpiSnapshots).where(eq(kpiSnapshots.kpiId, kpiId)).orderBy(desc(kpiSnapshots.recordedAt)).limit(limit);
};

DatabaseStorage.prototype.createKpiSnapshot = async function (data: InsertKpiSnapshot): Promise<KpiSnapshot> {
  const [row] = await db.insert(kpiSnapshots).values(data).returning();
  return row;
};

DatabaseStorage.prototype.ensureDefaultKpis = async function (startupId: number): Promise<void> {
  const existing = await db.select().from(kpis).where(eq(kpis.startupId, startupId)).limit(1);
  if (existing.length > 0) return;
  const defaults: InsertKpi[] = [
    { startupId, name: "Revenue signed", unit: "£", currentValue: "0", target: null, isDefault: true, displayOrder: 0 },
    { startupId, name: "LOIs received", unit: "count", currentValue: "0", target: null, isDefault: true, displayOrder: 1 },
    { startupId, name: "Customer conversations", unit: "count", currentValue: "0", target: null, isDefault: true, displayOrder: 2 },
  ];
  for (const k of defaults) {
    await db.insert(kpis).values(k);
  }
};

DatabaseStorage.prototype.seedDefaultPhasePlan = async function (): Promise<void> {
  const allProgs = await db.select().from(programmes);
  for (const prog of allProgs) {
    const existing = await db.select().from(sprints).where(eq(sprints.programmeId, prog.id));
    if (existing.length > 0) continue;
    // Foundation: 7 sprints × 2 weeks, in KTH dimension order
    for (let i = 0; i < UNDAUNTED_FOUNDATION_DIMENSIONS.length; i++) {
      const d = UNDAUNTED_FOUNDATION_DIMENSIONS[i];
      await db.insert(sprints).values({
        programmeId: prog.id,
        phaseKey: "foundation",
        orderIndex: i,
        dimension: d.dimension,
        label: d.label,
        durationWeeks: 2,
      });
    }
    // Mastermind: 10 sprints × 4 weeks
    for (let i = 0; i < 10; i++) {
      await db.insert(sprints).values({
        programmeId: prog.id,
        phaseKey: "mastermind",
        orderIndex: i,
        dimension: null,
        label: `Mastermind month ${i + 1}`,
        durationWeeks: 4,
      });
    }
    console.log(`Seeded default phase plan for programme "${prog.name}" (id=${prog.id})`);
  }
};

DatabaseStorage.prototype.updateUserEirProfile = async function (userId: string, data) {
  const patch: any = { updatedAt: new Date() };
  if (data.firstName !== undefined) patch.firstName = data.firstName;
  if (data.lastName !== undefined) patch.lastName = data.lastName;
  if (data.profileImageUrl !== undefined) patch.profileImageUrl = data.profileImageUrl;
  if (data.eirPhotoUrl !== undefined) patch.eirPhotoUrl = data.eirPhotoUrl;
  if (data.eirBio !== undefined) patch.eirBio = data.eirBio;
  if (data.eirCalendarUrl !== undefined) patch.eirCalendarUrl = data.eirCalendarUrl;
  const [row] = await db.update(users).set(patch).where(eq(users.id, userId)).returning();
  return row;
};

DatabaseStorage.prototype.updateUserJourneyState = async function (userId: string, state) {
  await db.update(users).set({ journeyState: state, updatedAt: new Date() }).where(eq(users.id, userId));
};

DatabaseStorage.prototype.listEirs = async function (): Promise<User[]> {
  return db.select().from(users).where(eq(users.isEir, true));
};

DatabaseStorage.prototype.updateCohortDates = async function (cohortId: number, data) {
  const patch: Partial<typeof cohorts.$inferInsert> = {};
  if (data.startDate !== undefined) patch.startDate = data.startDate;
  if (data.endDate !== undefined) patch.endDate = data.endDate;
  const [row] = await db.update(cohorts).set(patch).where(eq(cohorts.id, cohortId)).returning();
  return row;
};

DatabaseStorage.prototype.getSprintMissionById = async function (id: number): Promise<SprintMission | undefined> {
  const [row] = await db.select().from(sprintMissions).where(eq(sprintMissions.id, id));
  return row;
};

DatabaseStorage.prototype.getStartupCohortsWithDates = async function (startupId: number) {
  const assignments = await db.select().from(startupCohorts).where(eq(startupCohorts.startupId, startupId));
  if (assignments.length === 0) return [];
  const cohortIds = assignments.map(a => a.cohortId);
  return db.select().from(cohorts).where(inArray(cohorts.id, cohortIds));
};

DatabaseStorage.prototype.getRecentSprintActivityForGroup = async function (groupId: number, limit: number = 25) {
  const missionRows = await db
    .select({
      id: sprintMissions.id,
      sprintId: sprintMissions.sprintId,
      sprintLabel: sprints.label,
      phaseKey: sprints.phaseKey,
      startupId: sprintMissions.startupId,
      startupName: startups.name,
      missionId: sprintMissions.missionId,
      missionTitle: milestones.title,
      status: sprintMissions.status,
      recordedAt: sprintMissions.chosenAt,
    })
    .from(sprintMissions)
    .innerJoin(startupGroups, eq(startupGroups.startupId, sprintMissions.startupId))
    .innerJoin(startups, eq(startups.id, sprintMissions.startupId))
    .innerJoin(sprints, eq(sprints.id, sprintMissions.sprintId))
    .leftJoin(milestones, eq(milestones.id, sprintMissions.missionId))
    .where(eq(startupGroups.groupId, groupId))
    .orderBy(desc(sprintMissions.chosenAt))
    .limit(limit);

  const kpiRows = await db
    .select({
      sprintId: kpiSnapshots.sprintId,
      startupId: kpis.startupId,
      startupName: startups.name,
      kpiName: kpis.name,
      kpiUnit: kpis.unit,
      value: kpiSnapshots.value,
      recordedAt: kpiSnapshots.recordedAt,
      milestone: kpiSnapshots.recordedAtMilestone,
    })
    .from(kpiSnapshots)
    .innerJoin(kpis, eq(kpis.id, kpiSnapshots.kpiId))
    .innerJoin(startupGroups, eq(startupGroups.startupId, kpis.startupId))
    .innerJoin(startups, eq(startups.id, kpis.startupId))
    .where(eq(startupGroups.groupId, groupId))
    .orderBy(desc(kpiSnapshots.recordedAt))
    .limit(limit);

  const sprintLabelMap = new Map<number, string>();
  for (const m of missionRows) if (m.sprintId) sprintLabelMap.set(m.sprintId, m.sprintLabel);
  const items = [
    ...missionRows.map(m => ({
      type: "mission" as const,
      id: m.id,
      sprintId: m.sprintId,
      sprintTitle: m.sprintLabel,
      phase: m.phaseKey,
      startupId: m.startupId,
      startupName: m.startupName,
      title: m.missionTitle ?? `Mission #${m.missionId}`,
      value: m.status,
      recordedAt: m.recordedAt,
    })),
    ...kpiRows.map(k => ({
      type: "kpi" as const,
      id: null,
      sprintId: k.sprintId,
      sprintTitle: k.sprintId ? (sprintLabelMap.get(k.sprintId) ?? k.milestone) : k.milestone,
      phase: "",
      startupId: k.startupId,
      startupName: k.startupName,
      title: `${k.kpiName}${k.kpiUnit ? ` (${k.kpiUnit})` : ""}`,
      value: k.value,
      recordedAt: k.recordedAt,
    })),
  ];
  items.sort((a, b) => (b.recordedAt?.getTime() ?? 0) - (a.recordedAt?.getTime() ?? 0));
  return items.slice(0, limit);
};
