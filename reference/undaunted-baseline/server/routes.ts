import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import * as Sentry from "@sentry/node";
import OpenAI from "openai";
import multer from "multer";
import crypto from "crypto";
import { assembleReadinessContext, buildSystemPrompt } from "./chat-context";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { introductionItems, introductionItemVotes, introductionRequests, invitations, startupMembers, insertInlineToolConfigSchema, insertExampleCompanySchema, toolEntries, type InsertEventSeries, type InsertEventOccurrence } from "@shared/schema";

type EventUpdatePayload = {
  titleOverride?: string | null;
  descriptionOverride?: string | null;
  locationTypeOverride?: "virtual" | "in_person" | null;
  locationDetailsOverride?: string | null;
  startsAt?: string;
  endsAt?: string;
  sprintIds?: number[];
};
import { hasRevisionForDataKey } from "@shared/dataResolver";
import type { InlineToolConfigRef } from "@shared/dataResolver";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

interface MatchJob {
  id: string;
  userId: string;
  status: "running" | "complete" | "error";
  progress: { phase: string; current: number; total: number; message: string };
  result?: any;
  error?: string;
  listeners: Set<(data: string) => void>;
  createdAt: number;
}

const matchJobs = new Map<string, MatchJob>();

async function migratePrePopToRefs(storage: typeof import("./storage").storage) {
  const configs = await storage.getInlineToolConfigs();
  const templates = await storage.getToolTemplates();

  interface FieldDefRecord { key: string; label: string; ref?: string; displayLabel?: string; [k: string]: unknown }
  interface PrePopRecord { toolTemplateId: number; dataKey: string; fieldMap: Record<string, string> }
  interface SyncRuleRecord { sourceField: string; targetToolTemplateId: number; targetField: string }

  const sourceFieldLabelMap = new Map<string, string>();
  for (const c of configs) {
    for (const f of (c.fieldDefinitions || []) as FieldDefRecord[]) {
      if (f.key && f.label) {
        sourceFieldLabelMap.set(`${c.toolTemplateId}:${c.dataKey}:${f.key}`, f.label);
      }
    }
  }
  for (const t of templates) {
    const tFields = Array.isArray(t.fieldDefinitions) ? t.fieldDefinitions as Array<{ id: string; label: string }> : [];
    for (const f of tFields) {
      if (f.id && f.label) {
        sourceFieldLabelMap.set(`${t.id}:_default:${f.id}`, f.label);
      }
    }
  }

  for (const config of configs) {
    const fields = (config.fieldDefinitions || []) as FieldDefRecord[];
    const hasAnyRef = fields.some(f => f.ref);
    if (hasAnyRef) continue;

    const listLayouts = new Set(["repeatable_list", "fill_in_gaps", "competitor_analysis"]);
    if (listLayouts.has(config.layoutType)) continue;

    const prePop = config.prePopulateFrom as PrePopRecord | PrePopRecord[] | null | undefined;
    const syncRules = (config.dataSyncRules as SyncRuleRecord[] | null) || [];

    if (!prePop && syncRules.length === 0) continue;

    let updated = false;
    const updatedFields = fields.map(f => ({ ...f }));

    if (prePop) {
      const prePopConfigs = Array.isArray(prePop) ? prePop : [prePop];
      for (const pp of prePopConfigs) {
        if (!pp.toolTemplateId || !pp.dataKey || !pp.fieldMap) continue;
        for (const [targetKey, sourceKey] of Object.entries(pp.fieldMap)) {
          const fieldIdx = updatedFields.findIndex(f => f.key === targetKey);
          if (fieldIdx >= 0 && !updatedFields[fieldIdx].ref) {
            const refStr = `${pp.toolTemplateId}:${pp.dataKey}:${sourceKey}`;
            updatedFields[fieldIdx].ref = refStr;
            const sourceLabel = sourceFieldLabelMap.get(refStr);
            if (sourceLabel) updatedFields[fieldIdx].displayLabel = sourceLabel;
            updated = true;
          }
        }
      }
    }

    for (const rule of syncRules) {
      if (!rule.targetToolTemplateId || !rule.sourceField || !rule.targetField) continue;
      const fieldIdx = updatedFields.findIndex(f => f.key === rule.sourceField);
      if (fieldIdx >= 0 && !updatedFields[fieldIdx].ref) {
        const refStr = `${rule.targetToolTemplateId}:_default:${rule.targetField}`;
        updatedFields[fieldIdx].ref = refStr;
        const sourceLabel = sourceFieldLabelMap.get(refStr);
        if (sourceLabel) updatedFields[fieldIdx].displayLabel = sourceLabel;
        updated = true;
      }
    }

    if (updated) {
      await storage.updateInlineToolConfig(config.id, {
        fieldDefinitions: updatedFields,
        prePopulateFrom: null,
        dataSyncRules: null,
      });
      console.log(`Migrated refs for inline tool config ${config.id} (${config.stableKey})`);
    }
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of matchJobs) {
    if (now - job.createdAt > 10 * 60 * 1000) matchJobs.delete(id);
  }
}, 60 * 1000);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Setup Auth first
  await setupAuth(app);
  registerAuthRoutes(app);

  if (process.env.SENTRY_DSN) {
    app.use((req, _res, next) => {
      const user = req.user as { claims?: { sub?: string; email?: string } } | undefined;
      if (user?.claims?.sub) {
        const userId = user.claims.sub;
        storage.getUser(userId).then((dbUser) => {
          if (dbUser) {
            Sentry.setUser({
              id: dbUser.id,
              username: dbUser.email || undefined,
            });
            Sentry.setTag("user_role", dbUser.role);
            if (dbUser.adminRole) {
              Sentry.setTag("admin_role", dbUser.adminRole);
            }
          }
          next();
        }).catch(() => {
          Sentry.setUser({ id: userId });
          next();
        });
      } else {
        next();
      }
    });
  }

  // Ensure superadmin role is set for designated admin emails
  const SUPER_ADMIN_EMAILS = ["maikoschaffrath@gmail.com"];
  for (const email of SUPER_ADMIN_EMAILS) {
    try {
      const user = await storage.getUserByEmail(email);
      if (user && user.role !== "superadmin") {
        await storage.updateUserRole(user.id, "superadmin");
        console.log(`Auto-promoted ${email} to superadmin`);
      }
    } catch (err) {
      console.error(`Failed to check/promote superadmin ${email}:`, err);
    }
  }

  // Auto-seed content if database is empty (non-fatal — server starts even if seeding fails)
  try {
    await storage.seedContent();
  } catch (err) {
    console.error("Failed to seed content (non-fatal):", err);
  }
  try {
    await storage.upgradeGenericContent();
  } catch (err) {
    console.error("Failed to upgrade generic content (non-fatal):", err);
  }
  try {
    await storage.backfillCirlModule();
  } catch (err) {
    console.error("Failed to backfill CIRL module (non-fatal):", err);
  }
  try {
    await storage.normalizeModuleNames();
  } catch (err) {
    console.error("Failed to normalize module names (non-fatal):", err);
  }
  try {
    await storage.seedMilestoneData();
  } catch (err) {
    console.error("Failed to seed milestone data (non-fatal):", err);
  }
  try {
    await storage.upgradeMilestoneNames();
  } catch (err) {
    console.error("Failed to upgrade milestone names (non-fatal):", err);
  }
  try {
    await storage.backfillProgrammeFeatures();
  } catch (err) {
    console.error("Failed to backfill programme features (non-fatal):", err);
  }
  try {
    await storage.seedDefaultPhasePlan();
  } catch (err) {
    console.error("Failed to seed default phase plan (non-fatal):", err);
  }
  try {
    await storage.seedInlineToolConfigs();
  } catch (err) {
    console.error("Failed to seed inline tool configs (non-fatal):", err);
  }
  try {
    const r = await storage.backfillUnlinkedToolVisibility();
    if (r.hidden > 0) console.log(`[tool_templates] Auto-hid ${r.hidden} unlinked tool template(s).`);
  } catch (err) {
    console.error("Failed to backfill unlinked tool visibility (non-fatal):", err);
  }
  try {
    await migratePrePopToRefs(storage);
  } catch (err) {
    console.error("Failed to migrate prePopulate to refs (non-fatal):", err);
  }
  try {
    const { generateChangelogFromGit } = await import("./services/changelog-generator");
    generateChangelogFromGit().then(r => {
      if (r.created > 0) console.log(`Changelog: generated ${r.created} entr${r.created === 1 ? "y" : "ies"} (skipped ${r.skipped}).`);
    }).catch(err => console.error("Changelog auto-generation failed (non-fatal):", err));
  } catch (err) {
    console.error("Failed to start changelog generation (non-fatal):", err);
  }
  try {
    const BACKFILL_FLAG = "changelog.autoDraftBackfill.v1.done";
    const alreadyDone = await storage.getSystemSetting(BACKFILL_FLAG);
    if (alreadyDone !== "true") {
      const all = await storage.listChangelogEntries();
      const autoDrafts = all.filter(e => !e.isPublished && (e.source as any)?.type === "auto");
      for (const entry of autoDrafts) {
        await storage.updateChangelogEntry(entry.id, {
          isPublished: true,
          publishedAt: entry.publishedAt ?? new Date(),
        });
      }
      await storage.setSystemSetting(BACKFILL_FLAG, "true");
      if (autoDrafts.length > 0) {
        console.log(`Changelog: published ${autoDrafts.length} previously-drafted auto entr${autoDrafts.length === 1 ? "y" : "ies"} (one-time backfill).`);
      }
    }
  } catch (err) {
    console.error("Failed to backfill auto-generated changelog drafts (non-fatal):", err);
  }
  try {
    const existing = await storage.listChangelogEntries();
    if (existing.length === 0) {
      await storage.createChangelogEntry({
        title: "Introducing the Changelog",
        description: "We've added a Changelog page so admins can see what's shipping on the platform and the reasoning behind each change.",
        reason: "Founders and the Undaunted team need a clear, ongoing record of platform improvements and the rationale for them so the work we do is visible and easier to communicate.",
        category: "announcement",
        publishedAt: new Date(),
        isPublished: true,
        source: { type: "manual" },
        createdBy: null,
      });
    }
  } catch (err) {
    console.error("Failed to seed initial changelog entry (non-fatal):", err);
  }
  try {
    const cirlSetting = await storage.getSystemSetting('cirl_enabled');
    if (cirlSetting === null) {
      await storage.setSystemSetting('cirl_enabled', 'true');
    }
  } catch (err) {
    console.error("Failed to seed cirl_enabled setting (non-fatal):", err);
  }

  registerObjectStorageRoutes(app);

  // --- Startups ---

  app.get(api.startups.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const userStartups = await storage.getStartups(userId);
    res.json(userStartups);
  });

  app.post(api.startups.create.path, isAuthenticated, async (req: any, res) => {
    try {
        const input = api.startups.create.input.parse(req.body);
        const userId = req.user.claims.sub;
        const newStartup = await storage.createStartup(userId, { ...input, status: "active" });
        res.status(201).json(newStartup);
    } catch (err) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ message: err.errors[0].message });
        } else {
            res.status(500).json({ message: "Internal server error" });
        }
    }
  });

  app.get(api.startups.get.path, isAuthenticated, async (req: any, res) => {
    const startupId = Number(req.params.id);
    const userId = req.user.claims.sub;
    
    // Check membership
    const isMember = await storage.isStartupMember(userId, startupId);
    if (!isMember) return res.status(403).json({ message: "Not a member of this startup" });

    const startup = await storage.getStartup(startupId);
    if (!startup) return res.status(404).json({ message: "Startup not found" });
    
    res.json(startup);
  });

  app.patch(api.startups.update.path, isAuthenticated, async (req: any, res) => {
    try {
      const startupId = Number(req.params.id);
      const userId = req.user.claims.sub;
      const isMember = await storage.isStartupMember(userId, startupId);
      if (!isMember) return res.status(403).json({ message: "Not a member of this startup" });
      const input = api.startups.update.input.parse(req.body);
      const updated = await storage.updateStartup(startupId, input);
      if (!updated) return res.status(404).json({ message: "Startup not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // --- Modules / Content ---

  app.get(api.modules.list.path, isAuthenticated, async (req: any, res) => {
    const allModules = await storage.getModules();
    const startupId = req.query.startupId ? Number(req.query.startupId) : null;
    if (startupId) {
      const access = await storage.getStartupModuleAccess(startupId);
      const accessibleIds = new Set(access.map(a => a.moduleId));
      res.json(allModules.filter(m => accessibleIds.has(m.id)));
    } else {
      res.json(allModules);
    }
  });

  app.get(api.modules.getStructure.path, isAuthenticated, async (req: any, res) => {
    const structure = await storage.getFullModuleStructure();
    const startupId = req.query.startupId ? Number(req.query.startupId) : null;
    if (startupId) {
      const access = await storage.getStartupModuleAccess(startupId);
      const accessibleIds = new Set(access.map(a => a.moduleId));
      res.json(structure.filter((m: any) => accessibleIds.has(m.id)));
    } else {
      res.json(structure);
    }
  });

  // --- Progress ---

  app.get(api.progress.get.path, isAuthenticated, async (req: any, res) => {
    const startupId = Number(req.params.startupId);
    const userId = req.user.claims.sub;

    const isMember = await storage.isStartupMember(userId, startupId);
    if (!isMember) return res.status(403).json({ message: "Not a member" });

    const progress = await storage.getChecklistProgress(startupId);
    res.json(progress);
  });

  app.post(api.progress.toggle.path, isAuthenticated, async (req: any, res) => {
    try {
        const input = api.progress.toggle.input.parse(req.body);
        const userId = req.user?.claims?.sub;

        if (!userId) {
          return res.status(401).json({ message: "User identity not found. Please log in again." });
        }

        const isMember = await storage.isStartupMember(userId, input.startupId);
        if (!isMember) return res.status(403).json({ message: "Not a member" });

        const result = await storage.toggleChecklistProgress(input.startupId, input.checklistItemId, input.completed, userId);

        try {
          const levelsMap = await storage.computeReadinessLevels(input.startupId);
          await storage.recordReadinessSnapshot(input.startupId, levelsMap);
          await storage.autoDetectScoresMet(input.startupId);
        } catch (snapErr) {
          console.error("Failed to record readiness snapshot:", snapErr);
        }

        res.json(result);
    } catch (err: any) {
        console.error("Error in checklist progress toggle:", err);
        if (err?.name === "ZodError") {
          return res.status(400).json({ message: "Invalid input: " + err.errors?.map((e: any) => e.message).join(", ") });
        }
        res.status(500).json({ message: "An unexpected error occurred while updating progress" });
    }
  });

  // --- Tools ---

  app.get(api.tools.templates.path, isAuthenticated, async (req, res) => {
    const templates = await storage.getToolTemplates();
    res.json(templates);
  });

  app.get("/api/tool-repository/templates", isAuthenticated, async (_req, res) => {
    const templates = await storage.getVisibleToolTemplates();
    res.json(templates);
  });

  app.get(api.tools.categories.path, isAuthenticated, async (req, res) => {
    const categories = await storage.getToolCategories();
    res.json(categories);
  });

  app.get(api.tools.getEntry.path, isAuthenticated, async (req: any, res) => {
    const startupId = Number(req.params.startupId);
    const toolTemplateId = Number(req.params.toolTemplateId);
    const userId = req.user.claims.sub;

    const isMember = await storage.isStartupMember(userId, startupId);
    if (!isMember) return res.status(403).json({ message: "Not a member" });

    const entry = await storage.getToolEntry(startupId, toolTemplateId);
    res.json(entry || null);
  });

  app.post(api.tools.saveEntry.path, isAuthenticated, async (req: any, res) => {
    try {
        const input = api.tools.saveEntry.input.parse(req.body);
        const userId = req.user.claims.sub;

        const isMember = await storage.isStartupMember(userId, input.startupId);
        if (!isMember) return res.status(403).json({ message: "Not a member" });

        const configs = await storage.getInlineToolConfigs();
        const toolConfigs = configs.filter(c => c.toolTemplateId === input.toolTemplateId);
        const configRefs: InlineToolConfigRef[] = toolConfigs.map(c => ({
          dataKey: c.dataKey,
          revisionOf: c.revisionOf as { dataKey: string; level: number } | null,
          toolTemplateId: c.toolTemplateId,
        }));
        const existingEntry = await storage.getToolEntry(input.startupId, input.toolTemplateId);
        const existingData = (existingEntry?.currentData as Record<string, unknown>) || {};
        const incomingData = input.data as Record<string, unknown>;
        const lockedKeys = new Set<string>();
        for (const tc of toolConfigs) {
          const { hasRevision } = hasRevisionForDataKey(existingData, tc.dataKey, configRefs);
          if (hasRevision) lockedKeys.add(tc.dataKey);
        }
        for (const key of lockedKeys) {
          const existingVal = existingData[key];
          const incomingVal = incomingData[key];
          if (JSON.stringify(existingVal) !== JSON.stringify(incomingVal)) {
            return res.status(409).json({ message: `Data key "${key}" is locked by a revision at a higher level` });
          }
          if (!(key in incomingData) && existingVal !== undefined) {
            (incomingData as Record<string, unknown>)[key] = existingVal;
          }
        }

        const result = await storage.saveToolEntry(input.startupId, input.toolTemplateId, input.data, userId, input.contextLevelId);

        try {
          await storage.syncKeyAssumptions(input.startupId, input.toolTemplateId, input.data);
        } catch (syncErr) {
          console.error("Key assumption sync failed (non-blocking):", syncErr);
        }

        res.json(result);
    } catch (err) {
        res.status(400).json({ message: "Invalid request" });
    }
  });

  app.get(api.tools.versions.path, isAuthenticated, async (req: any, res) => {
      // TODO: Add stricter checks if needed, but for now just check if user is logged in
      const versions = await storage.getToolEntryVersions(Number(req.params.id));
      res.json(versions);
  });

  app.post("/api/startups/:startupId/interview-guide", isAuthenticated, async (req: any, res) => {
    try {
      const startupId = Number(req.params.startupId);
      if (!Number.isFinite(startupId) || startupId <= 0) {
        return res.status(400).json({ message: "Invalid startupId" });
      }
      const userId = req.user.claims.sub;
      const { interviewType } = req.body;

      if (!interviewType || !["customer", "expert"].includes(interviewType)) {
        return res.status(400).json({ message: "interviewType must be 'customer' or 'expert'" });
      }

      const isMember = await storage.isStartupMember(userId, startupId);
      if (!isMember) return res.status(403).json({ message: "Not a member" });

      const startup = await storage.getStartup(startupId);
      if (!startup) return res.status(404).json({ message: "Startup not found" });

      const { generateInterviewGuide } = await import("./services/interview-guide");
      const questions = await generateInterviewGuide({
        startupId,
        interviewType,
        startupData: {
          name: startup.name,
          description: startup.description || undefined,
          climateProblem: startup.climateProblem || undefined,
          solutionDescription: startup.solutionDescription || undefined,
          businessModel: startup.businessModel || undefined,
          targetMarket: startup.targetMarket || undefined,
          competitors: startup.competitors || undefined,
          productType: startup.productType || undefined,
          climateType: startup.climateType || undefined,
          customerProblem: startup.customerProblem || undefined,
          marketDemandEvidence: startup.marketDemandEvidence || undefined,
        },
      });

      res.json({ questions, interviewType });
    } catch (err) {
      console.error("Interview guide generation failed:", err);
      res.status(500).json({ message: "Failed to generate interview guide" });
    }
  });

  // --- Targets ---

  app.get(api.targets.get.path, isAuthenticated, async (req: any, res) => {
    const startupId = Number(req.params.startupId);
    const userId = req.user.claims.sub;

    const isMember = await storage.isStartupMember(userId, startupId);
    if (!isMember) return res.status(403).json({ message: "Not a member" });

    const targets = await storage.getStartupTargets(startupId);
    res.json(targets);
  });

  app.post(api.targets.set.path, isAuthenticated, async (req: any, res) => {
    try {
      const startupId = Number(req.params.startupId);
      const input = api.targets.set.input.parse(req.body);
      const userId = req.user.claims.sub;

      const isMember = await storage.isStartupMember(userId, startupId);
      if (!isMember) return res.status(403).json({ message: "Not a member" });

      const result = await storage.setStartupTarget(startupId, input.moduleId, input.targetLevel, userId);
      res.json(result);
    } catch (err) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // --- Activity ---

  app.get(api.activity.recent.path, isAuthenticated, async (req: any, res) => {
    const startupId = Number(req.params.startupId);
    const userId = req.user.claims.sub;

    const isMember = await storage.isStartupMember(userId, startupId);
    if (!isMember) return res.status(403).json({ message: "Not a member" });

    const activity = await storage.getRecentActivity(startupId, 2);
    res.json(activity);
  });

  // --- Milestones (public) ---
  app.get(api.milestones.list.path, isAuthenticated, async (req: any, res) => {
    const data = await storage.getMilestones();
    res.json(data);
  });

  app.get("/api/milestone-stages", isAuthenticated, async (req: any, res) => {
    const stages = await storage.getMilestoneStages();
    res.json(stages);
  });

  app.get("/api/milestone-groups", isAuthenticated, async (req: any, res) => {
    const groups = await storage.getMilestoneGroups();
    res.json(groups);
  });

  // --- Assumptions & Experiments ---

  app.get("/api/startups/:startupId/assumptions/hypotheses", isAuthenticated, async (req: any, res) => {
    try {
      const startupId = Number(req.params.startupId);
      if (!Number.isFinite(startupId) || startupId <= 0) return res.status(400).json({ message: "Invalid startupId" });
      const userId = req.user.claims.sub;
      const isMember = await storage.isStartupMember(userId, startupId);
      if (!isMember) return res.status(403).json({ message: "Not a member" });
      const data = await storage.getAssumptionsWithExperiments(startupId);
      const hypotheses = [...new Set(
        data.map((a: any) => typeof a.hypothesis === "string" ? a.hypothesis.trim() : "")
          .filter((h: string) => h.length > 0)
      )].sort();
      res.json(hypotheses);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.assumptions.list.path, isAuthenticated, async (req: any, res) => {
    const startupId = Number(req.params.startupId);
    const userId = req.user.claims.sub;
    const isMember = await storage.isStartupMember(userId, startupId);
    if (!isMember) return res.status(403).json({ message: "Not a member" });
    const data = await storage.getAssumptionsWithExperiments(startupId);
    res.json(data);
  });

  app.post(api.assumptions.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const startupId = Number(req.params.startupId);
      const userId = req.user.claims.sub;
      const isMember = await storage.isStartupMember(userId, startupId);
      if (!isMember) return res.status(403).json({ message: "Not a member" });
      const input = api.assumptions.create.input.parse(req.body);
      const result = await storage.createAssumption(startupId, input);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.patch(api.assumptions.update.path, isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const userId = req.user.claims.sub;
      const assumption = await storage.getAssumptionById(id);
      if (!assumption) return res.status(404).json({ message: "Assumption not found" });
      const isMember = await storage.isStartupMember(userId, assumption.startupId);
      if (!isMember) return res.status(403).json({ message: "Not a member" });
      const input = api.assumptions.update.input.parse(req.body);
      const result = await storage.updateAssumption(id, input);
      if (!result) return res.status(404).json({ message: "Assumption not found" });
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete(api.assumptions.delete.path, isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id);
    const userId = req.user.claims.sub;
    const assumption = await storage.getAssumptionById(id);
    if (!assumption) return res.status(404).json({ message: "Assumption not found" });
    const isMember = await storage.isStartupMember(userId, assumption.startupId);
    if (!isMember) return res.status(403).json({ message: "Not a member" });
    await storage.deleteAssumption(id);
    res.json({ success: true });
  });

  app.get(api.experiments.list.path, isAuthenticated, async (req: any, res) => {
    const assumptionId = Number(req.params.assumptionId);
    const userId = req.user.claims.sub;
    const assumption = await storage.getAssumptionById(assumptionId);
    if (!assumption) return res.status(404).json({ message: "Assumption not found" });
    const isMember = await storage.isStartupMember(userId, assumption.startupId);
    if (!isMember) return res.status(403).json({ message: "Not a member" });
    const exps = await storage.getExperimentsByAssumption(assumptionId);
    res.json(exps);
  });

  app.post(api.experiments.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const assumptionId = Number(req.params.assumptionId);
      const userId = req.user.claims.sub;
      const assumption = await storage.getAssumptionById(assumptionId);
      if (!assumption) return res.status(404).json({ message: "Assumption not found" });
      const isMember = await storage.isStartupMember(userId, assumption.startupId);
      if (!isMember) return res.status(403).json({ message: "Not a member" });
      const input = api.experiments.create.input.parse(req.body);
      const result = await storage.createExperiment(assumptionId, {
        assumptionId,
        name: input.name,
        technique: input.technique,
        hypothesisIf: input.hypothesisIf || null,
        hypothesisThen: input.hypothesisThen || null,
        hypothesisBecause: input.hypothesisBecause || null,
        successMetric: input.successMetric || null,
        estimatedCost: input.estimatedCost || null,
        duration: input.duration || null,
        sampleSize: input.sampleSize || null,
        preCommitAnswer: input.preCommitAnswer || null,
        deadline: new Date(input.deadline),
      });
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        console.error("Failed to create experiment:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.patch(api.experiments.update.path, isAuthenticated, async (req: any, res) => {
    try {
      const experimentId = Number(req.params.experimentId);
      const userId = req.user.claims.sub;
      const experiment = await storage.getExperimentById(experimentId);
      if (!experiment) return res.status(404).json({ message: "Experiment not found" });
      const assumption = await storage.getAssumptionById(experiment.assumptionId);
      if (!assumption) return res.status(404).json({ message: "Assumption not found" });
      const isMember = await storage.isStartupMember(userId, assumption.startupId);
      if (!isMember) return res.status(403).json({ message: "Not a member" });
      const input = api.experiments.update.input.parse(req.body);
      const updates: Record<string, unknown> = {};
      if (input.technique !== undefined) {
        updates.technique = input.technique;
        const TECHNIQUE_LABELS: Record<string, string> = {
          "fake-door": "Fake Door", "facade": "Facade", "pinocchio": "Pinocchio",
          "mechanical-turk": "Mechanical Turk", "youtube": "YouTube", "provincial": "Provincial",
          "one-night-stand": "One-Night Stand", "infiltrator": "Infiltrator", "impostor": "Impostor",
        };
        const techName = TECHNIQUE_LABELS[input.technique] || input.technique;
        updates.name = `${techName} — ${assumption.hypothesis.slice(0, 50)}`;
      }
      if (input.hypothesisIf !== undefined) updates.hypothesisIf = input.hypothesisIf || null;
      if (input.hypothesisThen !== undefined) updates.hypothesisThen = input.hypothesisThen || null;
      if (input.hypothesisBecause !== undefined) updates.hypothesisBecause = input.hypothesisBecause || null;
      if (input.successMetric !== undefined) updates.successMetric = input.successMetric || null;
      if (input.estimatedCost !== undefined) updates.estimatedCost = input.estimatedCost || null;
      if (input.duration !== undefined) updates.duration = input.duration || null;
      if (input.sampleSize !== undefined) updates.sampleSize = input.sampleSize || null;
      if (input.preCommitAnswer !== undefined) updates.preCommitAnswer = input.preCommitAnswer || null;
      if (input.actualMetricValue !== undefined) updates.actualMetricValue = input.actualMetricValue || null;
      if (input.actualOutcomeNotes !== undefined) updates.actualOutcomeNotes = input.actualOutcomeNotes || null;
      if (input.deadline !== undefined) updates.deadline = new Date(input.deadline);
      if (Object.keys(updates).length === 0) return res.json(experiment);
      const result = await storage.updateExperiment(experimentId, updates as any);
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        console.error("Failed to update experiment:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.post(api.experiments.submitResults.path, isAuthenticated, async (req: any, res) => {
    try {
      const experimentId = Number(req.params.experimentId);
      const userId = req.user.claims.sub;
      const experiment = await storage.getExperimentById(experimentId);
      if (!experiment) return res.status(404).json({ message: "Experiment not found" });
      const assumption = await storage.getAssumptionById(experiment.assumptionId);
      if (!assumption) return res.status(404).json({ message: "Assumption not found" });
      const isMember = await storage.isStartupMember(userId, assumption.startupId);
      if (!isMember) return res.status(403).json({ message: "Not a member" });
      const input = api.experiments.submitResults.input.parse(req.body);

      const updatedExperiment = await storage.updateExperiment(experimentId, {
        actualMetricValue: input.actualMetricValue,
        actualOutcomeNotes: input.actualOutcomeNotes || null,
      } as any);

      const successMetric = (experiment.successMetric || "").toLowerCase().trim();
      const actualValue = input.actualMetricValue.toLowerCase().trim();

      let suggestedDecision: "Persevere" | "Pivot" | "Perish" = "Pivot";
      let rationale = "";

      const successNum = parseFloat(successMetric.replace(/[^0-9.\-]/g, ""));
      const actualNum = parseFloat(actualValue.replace(/[^0-9.\-]/g, ""));

      if (!isNaN(successNum) && !isNaN(actualNum)) {
        if (actualNum >= successNum) {
          suggestedDecision = "Persevere";
          rationale = `Actual result (${input.actualMetricValue}) meets or exceeds the success metric (${experiment.successMetric}). The hypothesis appears validated.`;
        } else if (successNum > 0 && actualNum / successNum >= 0.5) {
          suggestedDecision = "Pivot";
          rationale = `Actual result (${input.actualMetricValue}) falls short of the success metric (${experiment.successMetric}) but shows partial signal. Consider pivoting the approach.`;
        } else {
          suggestedDecision = "Perish";
          rationale = `Actual result (${input.actualMetricValue}) falls significantly short of the success metric (${experiment.successMetric}). Consider abandoning this assumption.`;
        }
      } else {
        const positiveIndicators = ["yes", "true", "passed", "confirmed", "validated", "success", "met", "achieved", "exceeded"];
        const negativeIndicators = ["no", "false", "failed", "not confirmed", "invalidated", "failure", "not met", "missed"];

        if (positiveIndicators.some(ind => actualValue.includes(ind))) {
          suggestedDecision = "Persevere";
          rationale = `Actual result indicates a positive outcome relative to the hypothesis.`;
        } else if (negativeIndicators.some(ind => actualValue.includes(ind))) {
          suggestedDecision = "Pivot";
          rationale = `Actual result indicates the hypothesis was not validated. Consider pivoting or abandoning.`;
        } else {
          suggestedDecision = "Pivot";
          rationale = `Could not automatically determine if results meet the success metric. Review carefully and override if needed.`;
        }
      }

      await storage.updateAssumption(assumption.id, { suggestedDecision });

      res.json({ experiment: updatedExperiment, suggestedDecision, rationale });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        console.error("Failed to submit experiment results:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // --- Admin ---

  const isAdmin = async (req: any, res: any, next: any) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorised" });
    const admin = await storage.isUserAdmin(userId);
    if (!admin) return res.status(403).json({ message: "Admin access required" });
    next();
  };

  app.post(api.admin.seed.path, async (req, res) => {
      await storage.seedContent();
      res.json({ message: "Seeded" });
  });

  // --- Changelog (platform-admin-only: admin + superadmin; excludes investor_admin/eir/founder) ---
  const { insertChangelogEntrySchema } = await import("@shared/schema");

  const isPlatformAdmin = async (req: any, res: any, next: any) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorised" });
    const user = await storage.getUser(userId);
    if (!user || !(user.role === "admin" || user.role === "superadmin")) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  app.get("/api/admin/changelog/check", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const user = userId ? await storage.getUser(userId) : null;
    res.json({ isPlatformAdmin: !!user && (user.role === "admin" || user.role === "superadmin") });
  });

  app.get("/api/admin/changelog", isAuthenticated, isPlatformAdmin, async (_req, res) => {
    const entries = await storage.listChangelogEntries();
    res.json(entries);
  });

  app.post("/api/admin/changelog", isAuthenticated, isPlatformAdmin, async (req: any, res) => {
    try {
      const body = { ...req.body };
      if (body.publishedAt && typeof body.publishedAt === "string") {
        body.publishedAt = new Date(body.publishedAt);
      }
      const data = insertChangelogEntrySchema.parse({ ...body, createdBy: req.user.claims.sub });
      const entry = await storage.createChangelogEntry(data);
      res.status(201).json(entry);
    } catch (err: any) {
      res.status(400).json({ message: err?.message || "Invalid input" });
    }
  });

  app.patch("/api/admin/changelog/:id", isAuthenticated, isPlatformAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const body = { ...req.body };
      if (body.publishedAt && typeof body.publishedAt === "string") {
        body.publishedAt = new Date(body.publishedAt);
      }
      const data = insertChangelogEntrySchema.partial().parse(body);
      const entry = await storage.updateChangelogEntry(id, data);
      if (!entry) return res.status(404).json({ message: "Not found" });
      res.json(entry);
    } catch (err: any) {
      res.status(400).json({ message: err?.message || "Invalid input" });
    }
  });

  app.delete("/api/admin/changelog/:id", isAuthenticated, isPlatformAdmin, async (req: any, res) => {
    const id = Number(req.params.id);
    await storage.deleteChangelogEntry(id);
    res.json({ ok: true });
  });

  app.post("/api/admin/changelog/regenerate", isAuthenticated, isPlatformAdmin, async (req: any, res) => {
    try {
      const { generateChangelogFromGit } = await import("./services/changelog-generator");
      const result = await generateChangelogFromGit({ createdBy: req.user.claims.sub });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to regenerate changelog" });
    }
  });

  app.get("/api/admin/changelog/export.csv", isAuthenticated, isPlatformAdmin, async (_req, res) => {
    const entries = await storage.listChangelogEntries();
    const userIds = Array.from(new Set(entries.map(e => e.createdBy).filter(Boolean) as string[]));
    const userMap = new Map<string, string>();
    for (const uid of userIds) {
      try {
        const u = await storage.getUser(uid);
        if (u) {
          const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || uid;
          userMap.set(uid, name);
        }
      } catch {}
    }
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const header = ["date", "category", "title", "description", "reason", "published", "source", "author"];
    const lines = [header.join(",")];
    for (const e of entries) {
      const src = e.source as { type?: string } | null;
      const author = e.createdBy ? (userMap.get(e.createdBy) || e.createdBy) : "";
      const dateStr = e.publishedAt instanceof Date ? e.publishedAt.toISOString().slice(0, 10) : String(e.publishedAt).slice(0, 10);
      lines.push([
        dateStr,
        e.category,
        e.title,
        e.description,
        e.reason || "",
        e.isPublished ? "published" : "draft",
        src?.type || "manual",
        author,
      ].map(escape).join(","));
    }
    const csv = lines.join("\n");
    const filename = `undaunted-changelog-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  });

  app.get(api.admin.checkAdmin.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const admin = await storage.isUserAdmin(userId);
    res.json({ isAdmin: admin });
  });

  app.get(api.admin.allStartups.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const data = await storage.getAllStartupsWithMembers();
    res.json(data);
  });

  app.get(api.admin.progressSnapshot.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const data = await storage.getProgressSnapshotForAllStartups();
    res.json(data);
  });

  app.get(api.admin.milestones.list.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const data = await storage.getMilestones();
    res.json(data);
  });

  app.post(api.admin.milestones.create.path, isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const input = api.admin.milestones.create.input.parse(req.body);
      const milestone = await storage.createMilestone(input);
      res.status(201).json(milestone);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.patch(api.admin.milestones.update.path, isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const input = api.admin.milestones.update.input.parse(req.body);
      const updated = await storage.updateMilestone(id, input);
      if (!updated) return res.status(404).json({ message: "Milestone not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete(api.admin.milestones.delete.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const id = Number(req.params.id);
    await storage.deleteMilestone(id);
    res.json({ success: true });
  });

  app.get("/api/admin/readiness-timeline", isAuthenticated, isAdmin, async (req: any, res) => {
    const data = await storage.getReadinessTimeline();
    res.json(data);
  });

  app.get("/api/admin/dashboard-stats", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // --- Milestone Categories ---

  app.get(api.admin.milestoneCategories.list.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const cats = await storage.getMilestoneCategories();
    res.json(cats);
  });

  app.post(api.admin.milestoneCategories.create.path, isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const input = api.admin.milestoneCategories.create.input.parse(req.body);
      const cat = await storage.createMilestoneCategory(input);
      res.status(201).json(cat);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.patch("/api/admin/milestone-categories/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const input = api.admin.milestoneCategories.update.input.parse(req.body);
      const cat = await storage.updateMilestoneCategory(id, input);
      if (!cat) return res.status(404).json({ message: "Category not found" });
      res.json(cat);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete("/api/admin/milestone-categories/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    const id = Number(req.params.id);
    await storage.deleteMilestoneCategory(id);
    res.json({ success: true });
  });

  // --- Milestone Stages ---

  app.get(api.admin.milestoneStages.list.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const stages = await storage.getMilestoneStages();
    res.json(stages);
  });

  app.post(api.admin.milestoneStages.create.path, isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const input = api.admin.milestoneStages.create.input.parse(req.body);
      const stage = await storage.createMilestoneStage(input);
      res.status(201).json(stage);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.patch("/api/admin/milestone-stages/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const input = api.admin.milestoneStages.update.input.parse(req.body);
      const stage = await storage.updateMilestoneStage(id, input);
      if (!stage) return res.status(404).json({ message: "Stage not found" });
      res.json(stage);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete("/api/admin/milestone-stages/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    const id = Number(req.params.id);
    await storage.deleteMilestoneStage(id);
    res.json({ success: true });
  });

  app.get("/api/admin/milestone-groups", isAuthenticated, isAdmin, async (req: any, res) => {
    const groups = await storage.getMilestoneGroups();
    res.json(groups);
  });

  app.post("/api/admin/milestone-groups", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { insertMilestoneGroupSchema } = await import("@shared/schema");
      const input = insertMilestoneGroupSchema.parse(req.body);
      const group = await storage.createMilestoneGroup(input);
      res.status(201).json(group);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(400).json({ message: err.message });
      }
    }
  });

  app.patch("/api/admin/milestone-groups/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { insertMilestoneGroupSchema } = await import("@shared/schema");
      const id = Number(req.params.id);
      const input = insertMilestoneGroupSchema.partial().parse(req.body);
      const group = await storage.updateMilestoneGroup(id, input);
      if (!group) return res.status(404).json({ message: "Not found" });
      res.json(group);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(400).json({ message: err.message });
      }
    }
  });

  app.delete("/api/admin/milestone-groups/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    const id = Number(req.params.id);
    await storage.deleteMilestoneGroup(id);
    res.json({ success: true });
  });

  // --- Rewards (Founder) ---

  app.get("/api/rewards", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let startupId: number | undefined;
      if (req.query.startupId) {
        const requested = Number(req.query.startupId);
        if (!Number.isFinite(requested) || requested <= 0) return res.status(400).json({ message: "Invalid startupId" });
        const isMember = await storage.isStartupMember(userId, requested);
        if (!isMember) return res.status(403).json({ message: "Not a member of this startup" });
        startupId = requested;
      } else {
        const userStartups = await storage.getStartups(userId);
        startupId = userStartups[0]?.id;
      }
      const allRewards = await storage.getRewards();
      const unlocks = startupId ? await storage.getRewardUnlocks(startupId) : [];
      const completions = startupId ? await storage.getMissionCompletions(startupId) : [];
      const allMilestones = await storage.getMilestones();

      const result = allRewards.map(r => {
        const unlock = unlocks.find(u => u.rewardId === r.id);
        const requiredIds = (r.requiredMissionIds as number[]) || [];
        const requiredGroups = (r.requiredGroupIds as number[]) || [];
        const completedMissionIds = completions
          .filter(c => c.status === "admin_confirmed" || c.status === "scores_met")
          .map(c => c.milestoneId);
        const missionsCompleted = requiredIds.filter(id => completedMissionIds.includes(id)).length;

        let pendingReview = false;
        if (!unlock) {
          const allDirectMet = requiredIds.length > 0 ? requiredIds.every(id => completedMissionIds.includes(id)) : true;
          const groupMissionIds = requiredGroups.flatMap(gId =>
            allMilestones.filter(m => m.groupId === gId).map(m => m.id)
          );
          const allGroupMet = groupMissionIds.length > 0 ? groupMissionIds.every(id => completedMissionIds.includes(id)) : true;
          const hasAnyRequirement = requiredIds.length > 0 || groupMissionIds.length > 0;
          const hasAnyPendingReview = completions.some(c =>
            (requiredIds.includes(c.milestoneId) || groupMissionIds.includes(c.milestoneId)) &&
            c.status === "scores_met"
          );
          pendingReview = hasAnyRequirement && allDirectMet && allGroupMet && hasAnyPendingReview;
        }

        return {
          ...r,
          unlock: unlock || null,
          missionsCompleted,
          totalMissionsRequired: requiredIds.length,
          isUnlocked: !!unlock,
          pendingReview,
        };
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/rewards/:id/submit", isAuthenticated, async (req: any, res) => {
    try {
      const rewardId = Number(req.params.id);
      const userId = req.user.claims.sub;
      const userStartups = await storage.getStartups(userId);
      const startupId = userStartups[0]?.id;
      if (!startupId) return res.status(400).json({ message: "No startup found" });

      const unlocks = await storage.getRewardUnlocks(startupId);
      const unlock = unlocks.find(u => u.rewardId === rewardId);
      if (!unlock) return res.status(400).json({ message: "Reward not unlocked" });

      const updated = await storage.updateRewardUnlock(unlock.id, { submittedAt: new Date(), reviewStatus: "pending" });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/mission-completions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let startupId: number | undefined;
      if (req.query.startupId) {
        const requested = Number(req.query.startupId);
        if (!Number.isFinite(requested) || requested <= 0) return res.status(400).json({ message: "Invalid startupId" });
        const isMember = await storage.isStartupMember(userId, requested);
        if (!isMember) return res.status(403).json({ message: "Not a member of this startup" });
        startupId = requested;
      } else {
        const userStartups = await storage.getStartups(userId);
        startupId = userStartups[0]?.id;
      }
      if (!startupId) return res.json([]);
      const completions = await storage.getMissionCompletions(startupId);
      res.json(completions);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // --- Admin Rewards ---

  app.get("/api/admin/rewards", isAuthenticated, isAdmin, async (req: any, res) => {
    const allRewards = await storage.getRewards();
    const allUnlocks = await storage.getAllRewardUnlocks();
    const result = allRewards.map(r => ({
      ...r,
      unlockCount: allUnlocks.filter(u => u.rewardId === r.id).length,
    }));
    res.json(result);
  });

  app.post("/api/admin/rewards", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const reward = await storage.createReward({ ...req.body, createdBy: userId });
      res.status(201).json(reward);
    } catch (err) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.patch("/api/admin/rewards/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    const id = Number(req.params.id);
    const updated = await storage.updateReward(id, req.body);
    if (!updated) return res.status(404).json({ message: "Reward not found" });
    res.json(updated);
  });

  app.delete("/api/admin/rewards/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    await storage.deleteReward(Number(req.params.id));
    res.json({ success: true });
  });

  // --- Admin Mission Confirmation ---

  app.get("/api/admin/completion-queue", isAuthenticated, isAdmin, async (req: any, res) => {
    const queue = await storage.getCompletionQueue();
    res.json(queue);
  });

  app.get("/api/admin/missions/:id/review/:startupId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const milestoneId = Number(req.params.id);
      const startupId = Number(req.params.startupId);
      if (!Number.isFinite(milestoneId) || milestoneId <= 0 || !Number.isFinite(startupId) || startupId <= 0) {
        return res.status(400).json({ message: "Invalid milestone or startup ID" });
      }
      const reviewData = await storage.getMissionReviewData(milestoneId, startupId);
      res.json(reviewData);
    } catch (err: any) {
      if (err.message === "Milestone not found") {
        return res.status(404).json({ message: err.message });
      }
      res.status(500).json({ message: "Failed to fetch review data" });
    }
  });

  app.post("/api/admin/missions/:id/confirm", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const milestoneId = Number(req.params.id);
      const { startupId } = req.body;
      const adminId = req.user.claims.sub;
      const completion = await storage.setMissionCompletion(milestoneId, startupId, "admin_confirmed", adminId);
      const newUnlocks = await storage.checkAndUnlockRewards(startupId);
      res.json({ completion, newUnlocks });
    } catch (err) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.post("/api/admin/missions/bulk-confirm", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { milestoneId, startupIds } = req.body;
      const adminId = req.user.claims.sub;
      const results: any[] = [];
      let totalUnlocks = 0;
      for (const startupId of startupIds) {
        const completion = await storage.setMissionCompletion(milestoneId, startupId, "admin_confirmed", adminId);
        const newUnlocks = await storage.checkAndUnlockRewards(startupId);
        totalUnlocks += newUnlocks.length;
        results.push({ startupId, completion, newUnlocks });
      }
      res.json({ confirmed: results.length, totalUnlocks, results });
    } catch (err) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // --- Admin Grant Review ---

  app.get("/api/admin/grant-queue", isAuthenticated, isAdmin, async (req: any, res) => {
    const queue = await storage.getGrantQueue();
    res.json(queue);
  });

  app.post("/api/admin/rewards/:id/review", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const rewardId = Number(req.params.id);
      const { startupId, status, notes } = req.body;
      const adminId = req.user.claims.sub;

      const unlocks = await storage.getRewardUnlocks(startupId);
      const unlock = unlocks.find(u => u.rewardId === rewardId);
      if (!unlock) return res.status(404).json({ message: "Reward unlock not found" });

      const updated = await storage.updateRewardUnlock(unlock.id, {
        reviewedAt: new Date(),
        reviewedBy: adminId,
        reviewStatus: status,
        reviewNotes: notes || null,
      });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // --- Admin Module Access ---

  app.get(api.admin.moduleAccess.get.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const startupId = Number(req.params.startupId);
    const access = await storage.getStartupModuleAccess(startupId);
    res.json(access);
  });

  app.post(api.admin.moduleAccess.grant.path, isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const input = api.admin.moduleAccess.grant.input.parse(req.body);
      const userId = req.user.claims.sub;
      const access = await storage.grantModuleAccess(input.startupId, input.moduleId, userId);
      res.json(access);
    } catch (err: any) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.delete(api.admin.moduleAccess.revoke.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const startupId = Number(req.params.startupId);
    const moduleId = Number(req.params.moduleId);
    await storage.revokeModuleAccess(startupId, moduleId);
    res.json({ success: true });
  });

  // --- Super Admin Middleware ---
  const isSuperAdmin = async (req: any, res: any, next: any) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorised" });
    const sa = await storage.isSuperAdmin(userId);
    if (!sa) return res.status(403).json({ message: "Super Admin access required" });
    next();
  };

  const isProgrammeAdmin = async (req: any, res: any, next: any) => {
    const userId = req.user?.claims?.sub;
    const programmeId = Number(req.params.programmeId || req.params.id);
    if (!userId) return res.status(401).json({ message: "Unauthorised" });
    const allowed = await storage.isAdminForProgramme(userId, programmeId);
    if (!allowed) return res.status(403).json({ message: "Not authorised for this programme" });
    next();
  };

  // --- Admin Check (extended) ---

  app.get("/api/admin/check-role", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    const role = user?.role || "founder";
    res.json({
      isAdmin: user?.isAdmin || false,
      role,
      isSuperAdmin: role === "superadmin",
      isInvestorAdmin: role === "superadmin" || role === "investor_admin",
      isEir: user?.isEir === true,
    });
  });

  // --- Programme Routes ---

  app.get("/api/admin/programmes", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const progs = await storage.getProgrammesForAdmin(userId);
      res.json(progs);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch programmes" });
    }
  });

  app.post("/api/admin/programmes", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { name, description } = req.body;
      if (!name) return res.status(400).json({ message: "Name is required" });
      const userId = req.user.claims.sub;
      const programme = await storage.createProgramme({ name, description, createdById: userId });
      res.status(201).json(programme);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create programme" });
    }
  });

  app.patch("/api/admin/programmes/:id", isAuthenticated, isProgrammeAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const { name, description } = req.body;
      const updated = await storage.updateProgramme(id, { name, description });
      if (!updated) return res.status(404).json({ message: "Programme not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update programme" });
    }
  });

  app.delete("/api/admin/programmes/:id", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteProgramme(id);
      res.json({ message: "Programme deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to delete programme" });
    }
  });

  app.get("/api/admin/programmes/:id", isAuthenticated, isProgrammeAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const programme = await storage.getProgramme(id);
      if (!programme) return res.status(404).json({ message: "Programme not found" });
      res.json(programme);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch programme" });
    }
  });

  // Programme Features
  app.get("/api/admin/programmes/:id/features", isAuthenticated, isProgrammeAdmin, async (req: any, res) => {
    try {
      const features = await storage.getProgrammeFeatures(Number(req.params.id));
      res.json(features);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch features" });
    }
  });

  app.patch("/api/admin/programmes/:id/features", isAuthenticated, isProgrammeAdmin, async (req: any, res) => {
    try {
      const { featureKey, enabled } = req.body;
      if (!featureKey || typeof enabled !== "boolean") return res.status(400).json({ message: "featureKey and enabled required" });
      const feature = await storage.setProgrammeFeature(Number(req.params.id), featureKey, enabled);
      res.json(feature);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update feature" });
    }
  });

  // Programme Startups
  app.get("/api/admin/programmes/:id/startups", isAuthenticated, isProgrammeAdmin, async (req: any, res) => {
    try {
      const startupsInProgramme = await storage.getStartupsInProgramme(Number(req.params.id));
      res.json(startupsInProgramme);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch startups" });
    }
  });

  app.post("/api/admin/programmes/:id/startups", isAuthenticated, isProgrammeAdmin, async (req: any, res) => {
    try {
      const { startupId } = req.body;
      if (!startupId) return res.status(400).json({ message: "startupId is required" });
      const result = await storage.addStartupToProgramme(Number(req.params.id), Number(startupId));
      res.status(201).json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to add startup to programme" });
    }
  });

  app.delete("/api/admin/programmes/:id/startups/:startupId", isAuthenticated, isProgrammeAdmin, async (req: any, res) => {
    try {
      await storage.removeStartupFromProgramme(Number(req.params.id), Number(req.params.startupId));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to remove startup from programme" });
    }
  });

  // Startup programmes lookup
  app.get("/api/admin/startups/:id/programmes", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const progs = await storage.getProgrammesForStartup(Number(req.params.id));
      res.json(progs);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch programmes for startup" });
    }
  });

  app.get("/api/admin/startups/:id/missions", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const missions = await storage.getStartupMissions(Number(req.params.id));
      res.json(missions);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch missions for startup" });
    }
  });

  app.post("/api/admin/startups/:id/missions", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const startupId = Number(req.params.id);
      const { milestoneId } = req.body;
      if (!milestoneId) return res.status(400).json({ message: "milestoneId is required" });
      const userId = req.user.claims.sub;
      const result = await storage.assignMissionToStartup(startupId, milestoneId, userId);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to assign mission" });
    }
  });

  app.delete("/api/admin/startups/:id/missions/:milestoneId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.removeMissionFromStartup(Number(req.params.id), Number(req.params.milestoneId));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to remove mission" });
    }
  });

  // --- Cohort Routes ---

  app.get("/api/admin/programmes/:id/cohorts", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const cohorts = await storage.getCohortsByProgramme(Number(req.params.id));
      res.json(cohorts);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch cohorts" });
    }
  });

  app.post("/api/admin/programmes/:id/cohorts", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { name, description } = req.body;
      if (!name) return res.status(400).json({ message: "name is required" });
      const userId = req.user.claims.sub;
      const cohort = await storage.createCohort({ name, description: description || null, programmeId: Number(req.params.id), createdBy: userId });
      res.status(201).json(cohort);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create cohort" });
    }
  });

  app.patch("/api/admin/cohorts/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { name, description } = req.body;
      const result = await storage.updateCohort(Number(req.params.id), { name, description });
      if (!result) return res.status(404).json({ message: "Cohort not found" });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update cohort" });
    }
  });

  app.delete("/api/admin/cohorts/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.deleteCohort(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete cohort" });
    }
  });

  app.get("/api/admin/cohorts/:id/startups", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const startups = await storage.getStartupsInCohort(Number(req.params.id));
      res.json(startups);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch startups in cohort" });
    }
  });

  app.post("/api/admin/cohorts/:id/startups", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { startupId } = req.body;
      if (!startupId) return res.status(400).json({ message: "startupId is required" });
      const result = await storage.addStartupToCohort(startupId, Number(req.params.id));
      res.status(201).json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to add startup to cohort" });
    }
  });

  app.delete("/api/admin/cohorts/:id/startups/:startupId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.removeStartupFromCohort(Number(req.params.startupId), Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to remove startup from cohort" });
    }
  });

  // --- Group Routes ---

  app.get("/api/admin/cohorts/:id/groups", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const groups = await storage.getGroupsByCohort(Number(req.params.id));
      res.json(groups);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch groups" });
    }
  });

  app.post("/api/admin/cohorts/:id/groups", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { name, description } = req.body;
      if (!name) return res.status(400).json({ message: "name is required" });
      const userId = req.user.claims.sub;
      const group = await storage.createGroup({ name, description: description || null, cohortId: Number(req.params.id), createdBy: userId });
      res.status(201).json(group);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create group" });
    }
  });

  app.patch("/api/admin/groups/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { name, description } = req.body;
      const result = await storage.updateGroup(Number(req.params.id), { name, description });
      if (!result) return res.status(404).json({ message: "Group not found" });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update group" });
    }
  });

  app.delete("/api/admin/groups/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.deleteGroup(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete group" });
    }
  });

  app.get("/api/admin/groups/:id/startups", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const startups = await storage.getStartupsInGroup(Number(req.params.id));
      res.json(startups);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch startups in group" });
    }
  });

  app.post("/api/admin/groups/:id/startups", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { startupId } = req.body;
      if (!startupId) return res.status(400).json({ message: "startupId is required" });
      const result = await storage.addStartupToGroup(startupId, Number(req.params.id));
      res.status(201).json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to add startup to group" });
    }
  });

  app.delete("/api/admin/groups/:id/startups/:startupId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.removeStartupFromGroup(Number(req.params.startupId), Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to remove startup from group" });
    }
  });

  // --- EIR Assignment Routes ---

  app.get("/api/admin/groups/:id/eirs", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const eirs = await storage.getGroupEirs(Number(req.params.id));
      res.json(eirs);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch EIRs" });
    }
  });

  app.post("/api/admin/groups/:id/eirs", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ message: "userId is required" });
      const adminId = req.user.claims.sub;
      const result = await storage.assignEirToGroup(userId, Number(req.params.id), adminId);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to assign EIR to group" });
    }
  });

  app.delete("/api/admin/groups/:id/eirs/:userId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.removeEirFromGroup(req.params.userId, Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to remove EIR from group" });
    }
  });

  // --- Pending EIR invitations (pre-assignment before invite acceptance) ---

  app.get("/api/admin/eir-invitations", isAuthenticated, isAdmin, async (_req: any, res) => {
    try {
      const invites = await storage.getPendingEirInvitations();
      res.json(invites);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch EIR invitations" });
    }
  });

  app.get("/api/admin/groups/:id/pending-eirs", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const invites = await storage.getPendingEirInvitationsForGroup(Number(req.params.id));
      res.json(invites);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch pending EIRs" });
    }
  });

  app.post("/api/admin/groups/:id/pending-eirs", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const invitationId = Number(req.body?.invitationId);
      const groupId = Number(req.params.id);
      if (!invitationId) return res.status(400).json({ message: "invitationId is required" });
      const inv = await storage.getInvitationById(invitationId);
      if (!inv || inv.role !== "eir" || inv.status !== "pending") {
        return res.status(404).json({ message: "Pending EIR invitation not found" });
      }
      const current = Array.isArray(inv.pendingEirGroupIds) ? (inv.pendingEirGroupIds as number[]) : [];
      const next = current.includes(groupId) ? current : [...current, groupId];
      const updated = await storage.setInvitationPendingEirGroups(invitationId, next);
      res.status(201).json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to pre-assign EIR to group" });
    }
  });

  app.delete("/api/admin/groups/:id/pending-eirs/:invitationId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const invitationId = Number(req.params.invitationId);
      const groupId = Number(req.params.id);
      const inv = await storage.getInvitationById(invitationId);
      if (!inv) return res.status(404).json({ message: "Invitation not found" });
      const current = Array.isArray(inv.pendingEirGroupIds) ? (inv.pendingEirGroupIds as number[]) : [];
      const next = current.filter(id => id !== groupId);
      await storage.setInvitationPendingEirGroups(invitationId, next);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to remove pending EIR assignment" });
    }
  });

  // --- Dashboard Stats Filtered ---

  app.get("/api/admin/dashboard-stats-filtered", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const cohortId = req.query.cohortId ? Number(req.query.cohortId) : undefined;
      const groupId = req.query.groupId ? Number(req.query.groupId) : undefined;
      const stats = await storage.getDashboardStatsFiltered({ cohortId, groupId });
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch filtered stats" });
    }
  });

  // --- EIR Routes ---

  const isEir = async (req: any, res: any, next: any) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorised" });
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorised" });
    const hasEirPermission = user.isEir === true;
    const isSa = user.role === "superadmin";
    const isAdm = user.isAdmin;
    if (!hasEirPermission && !isSa && !isAdm) return res.status(403).json({ message: "EIR access required" });
    next();
  };

  app.get("/api/eir/groups", isAuthenticated, isEir, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (user?.role === "superadmin" || user?.isAdmin) {
        const allProgrammes = await storage.getAllProgrammes();
        const allGroups: any[] = [];
        for (const p of allProgrammes) {
          const programmeGroups = await storage.getGroupsByProgramme(p.id);
          for (const g of programmeGroups) {
            const cohort = await storage.getCohort(g.cohortId);
            allGroups.push({ ...g, cohortName: cohort?.name || "", programmeName: p.name, programmeId: p.id });
          }
        }
        return res.json(allGroups);
      }
      const groups = await storage.getEirGroups(userId);
      res.json(groups);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch EIR groups" });
    }
  });

  app.get("/api/eir/groups/:id/startups", isAuthenticated, isEir, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const groupId = Number(req.params.id);
      if (user?.role !== "superadmin" && !user?.isAdmin) {
        const eirGroups = await storage.getEirGroups(userId);
        if (!eirGroups.find(g => g.id === groupId)) {
          return res.status(403).json({ message: "Not assigned to this group" });
        }
      }
      const startupsInGroup = await storage.getStartupsInGroup(groupId);
      const startupIds = startupsInGroup.map(s => s.id);
      const snapshot = await storage.getProgressSnapshotForStartups(startupIds);
      const allMilestones = await storage.getMilestones();
      const result = startupsInGroup.map(s => {
        const progress = snapshot.find((p: any) => p.startupId === s.id);
        return { ...s, dimensions: progress?.dimensions || {}, milestones: allMilestones };
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch startups" });
    }
  });

  app.get("/api/eir/groups/:id/stats", isAuthenticated, isEir, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const groupId = Number(req.params.id);
      if (user?.role !== "superadmin" && !user?.isAdmin) {
        const eirGroups = await storage.getEirGroups(userId);
        if (!eirGroups.find(g => g.id === groupId)) {
          return res.status(403).json({ message: "Not assigned to this group" });
        }
      }
      const stats = await storage.getDashboardStatsFiltered({ groupId });
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch group stats" });
    }
  });

  app.get("/api/eir/startups/:id/missions", isAuthenticated, isEir, async (req: any, res) => {
    try {
      const missions = await storage.getStartupMissions(Number(req.params.id));
      res.json(missions);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch missions" });
    }
  });

  app.post("/api/eir/startups/:id/missions", isAuthenticated, isEir, async (req: any, res) => {
    try {
      const startupId = Number(req.params.id);
      const { milestoneId } = req.body;
      if (!milestoneId) return res.status(400).json({ message: "milestoneId is required" });
      const userId = req.user.claims.sub;
      const result = await storage.assignMissionToStartup(startupId, milestoneId, userId);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to assign mission" });
    }
  });

  app.delete("/api/eir/startups/:id/missions/:milestoneId", isAuthenticated, isEir, async (req: any, res) => {
    try {
      await storage.removeMissionFromStartup(Number(req.params.id), Number(req.params.milestoneId));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to remove mission" });
    }
  });

  app.get("/api/eir/groups/:id/timeline", isAuthenticated, isEir, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const groupId = Number(req.params.id);
      if (user?.role !== "superadmin" && !user?.isAdmin) {
        const eirGroups = await storage.getEirGroups(userId);
        if (!eirGroups.find(g => g.id === groupId)) {
          return res.status(403).json({ message: "Not assigned to this group" });
        }
      }
      const group = await storage.getGroup(groupId);
      if (!group) return res.status(404).json({ message: "Group not found" });

      const groupStartups = await storage.getStartupsInGroup(groupId);
      const groupStartupIds = groupStartups.map(s => s.id);
      const groupTimeline = await storage.getReadinessTimelineForStartups(groupStartupIds);

      const cohortStartups = await storage.getStartupsInCohort(group.cohortId);
      const cohortOnlyIds = cohortStartups.map(s => s.id).filter(id => !groupStartupIds.includes(id));
      const cohortTimeline = await storage.getReadinessTimelineForStartups(cohortOnlyIds);

      const startupNames: Record<number, string> = {};
      groupStartups.forEach(s => { startupNames[s.id] = s.name; });
      cohortStartups.forEach(s => { startupNames[s.id] = s.name; });

      res.json({
        groupSnapshots: groupTimeline,
        cohortSnapshots: cohortTimeline,
        startupNames,
        groupStartupIds,
        cohortStartupIds: cohortOnlyIds,
      });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch timeline" });
    }
  });

  // Admin creates a startup
  app.post("/api/admin/startups", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { name, description, programmeId } = req.body;
      if (!name) return res.status(400).json({ message: "name is required" });
      const parsedProgrammeId = programmeId ? Number(programmeId) : null;
      if (programmeId && (!Number.isFinite(parsedProgrammeId) || (parsedProgrammeId as number) <= 0)) {
        return res.status(400).json({ message: "Invalid programmeId" });
      }
      const userId = req.user.claims.sub;
      const newStartup = await storage.createStartup(userId, { name, description: description || null, status: "active" }, !!parsedProgrammeId);
      if (parsedProgrammeId) {
        try {
          await storage.addStartupToProgramme(parsedProgrammeId, newStartup.id);
        } catch (linkErr: any) {
          console.error("Failed to assign programme, falling back to General:", linkErr);
          const generalProgrammes = await storage.getProgrammeByName("General");
          if (generalProgrammes) {
            await storage.addStartupToProgramme(generalProgrammes.id, newStartup.id);
          }
        }
      }
      res.status(201).json(newStartup);
    } catch (err: any) {
      console.error("Admin create startup error:", err);
      res.status(500).json({ message: "Failed to create startup" });
    }
  });

  // Admin invites users to a specific startup
  app.post("/api/admin/startups/:id/invite", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const startupId = Number(req.params.id);
      const startupCheck = await storage.getStartup(startupId);
      if (startupCheck?.status === "draft") {
        return res.status(400).json({ message: "Cannot invite users to a draft startup. Please confirm the startup first." });
      }
      const { emails, programmeId } = req.body;
      if (!Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ message: "emails array required" });
      }
      const userId = req.user.claims.sub;

      const startupProgs = await storage.getProgrammesForStartup(startupId);
      let effectiveProgrammeId = programmeId ? Number(programmeId) : (startupProgs[0]?.id || null);
      if (!effectiveProgrammeId) {
        return res.status(400).json({ message: "Startup must belong to a programme before inviting users" });
      }

      const programme = await storage.getProgramme(effectiveProgrammeId);
      const allStartups = await storage.getStartupsInProgramme(effectiveProgrammeId);
      const startup = allStartups.find(s => s.id === startupId);
      const companyName = startup?.name || "Startup";

      const createdInvitations = [];
      const emailRecipients: Array<{ to: string; programmeName: string; companyName: string; inviteUrl: string }> = [];
      const baseUrl = req.protocol + "://" + req.get("host");
      for (const email of emails) {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) continue;
        const token = crypto.randomBytes(32).toString("hex");
        const invitation = await storage.createInvitation({
          email: normalizedEmail,
          startupId,
          programmeId: effectiveProgrammeId,
          token,
          invitedById: userId,
        });
        createdInvitations.push(invitation);
        console.log(`[INVITE DEBUG] Created invitation id=${invitation.id} token=${token.substring(0, 12)}... for ${normalizedEmail}`);
        const verifyRead = await storage.getInvitationByToken(token);
        console.log(`[INVITE DEBUG] Verify read-back: ${verifyRead ? `found id=${verifyRead.id}` : 'NOT FOUND - DATA LOSS!'}`);

        emailRecipients.push({
          to: normalizedEmail,
          programmeName: programme?.name || "Programme",
          companyName,
          inviteUrl: `${baseUrl}/invite/${token}`,
        });
      }

      try {
        const { sendInvitationEmailBatch } = await import("./services/email");
        await sendInvitationEmailBatch(emailRecipients);
      } catch (emailErr: any) {
        console.error(`Failed to send invitation emails in batch:`, emailErr.message);
      }

      res.status(201).json({ invitations: createdInvitations });
    } catch (err: any) {
      console.error("Startup invite error:", err);
      res.status(500).json({ message: "Failed to send invitations" });
    }
  });

  // Programme Admins
  app.get("/api/admin/programmes/:id/admins", isAuthenticated, isProgrammeAdmin, async (req: any, res) => {
    try {
      const admins = await storage.getProgrammeAdmins(Number(req.params.id));
      res.json(admins);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch admins" });
    }
  });

  app.post("/api/admin/programmes/:id/admins", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ message: "userId is required" });
      const assignment = await storage.assignAdminToProgramme(Number(req.params.id), userId);
      res.status(201).json(assignment);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to assign admin" });
    }
  });

  app.delete("/api/admin/programmes/:id/admins/:userId", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      await storage.removeAdminFromProgramme(Number(req.params.id), req.params.userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to remove admin" });
    }
  });

  // Programme Invitations
  app.get("/api/admin/programmes/:id/invitations", isAuthenticated, isProgrammeAdmin, async (req: any, res) => {
    try {
      const invs = await storage.getInvitationsForProgramme(Number(req.params.id));
      res.json(invs);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  app.post("/api/admin/programmes/:id/invite", isAuthenticated, isProgrammeAdmin, async (req: any, res) => {
    try {
      const programmeId = Number(req.params.id);
      const { companyName, emails } = req.body;
      if (!companyName || !Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ message: "companyName and emails array required" });
      }
      const userId = req.user.claims.sub;

      let startup = (await storage.getStartupsInProgramme(programmeId)).find(s => s.name.toLowerCase() === companyName.toLowerCase());
      let startupId: number;
      if (startup) {
        if (startup.status === "draft") {
          return res.status(400).json({ message: "Cannot invite users to a draft startup. Please confirm the startup first." });
        }
        startupId = startup.id;
      } else {
        const newStartup = await storage.createStartup(userId, { name: companyName, status: "active" }, true);
        startupId = newStartup.id;
        await storage.addStartupToProgramme(programmeId, startupId);
        const allModules = await storage.getModules();
        const coreModules = allModules.filter(m => m.kthDimension !== 'INV');
        for (const mod of coreModules) {
          await storage.grantModuleAccess(startupId, mod.id, userId);
        }
      }

      const programme = await storage.getProgramme(programmeId);
      const createdInvitations = [];
      const emailRecipients: Array<{ to: string; programmeName: string; companyName: string; inviteUrl: string }> = [];
      const baseUrl = req.protocol + "://" + req.get("host");
      for (const email of emails) {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) continue;
        const token = crypto.randomBytes(32).toString("hex");
        const invitation = await storage.createInvitation({
          email: normalizedEmail,
          startupId,
          programmeId,
          token,
          invitedById: userId,
        });
        createdInvitations.push(invitation);

        emailRecipients.push({
          to: normalizedEmail,
          programmeName: programme?.name || "Programme",
          companyName,
          inviteUrl: `${baseUrl}/invite/${token}`,
        });
      }

      try {
        const { sendInvitationEmailBatch } = await import("./services/email");
        await sendInvitationEmailBatch(emailRecipients);
      } catch (emailErr: any) {
        console.error(`Failed to send invitation emails in batch:`, emailErr.message);
      }

      res.status(201).json({ invitations: createdInvitations, startupId });
    } catch (err: any) {
      console.error("Invite error:", err);
      res.status(500).json({ message: "Failed to send invitations" });
    }
  });

  // User role management (Super Admin only)
  app.patch("/api/admin/users/:id/role", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { role } = req.body;
      if (!["founder", "admin", "superadmin", "investor_admin"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      const updated = await storage.setUserRole(req.params.id, role);
      if (!updated) return res.status(404).json({ message: "User not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.delete("/api/admin/startups/:id", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteStartup(id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Failed to delete startup:", err);
      res.status(500).json({ message: "Failed to delete company" });
    }
  });

  app.delete("/api/admin/users/:id", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const requestingUserId = req.user.claims.sub;
      if (userId === requestingUserId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      await storage.deleteUser(userId);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Failed to delete user:", err);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.get("/api/admin/users/all", isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // System settings (admin)
  app.get("/api/admin/settings/:key", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const value = await storage.getSystemSetting(req.params.key);
      res.json({ key: req.params.key, value });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch setting" });
    }
  });

  app.patch("/api/admin/settings/:key", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { value } = req.body;
      if (value === undefined) return res.status(400).json({ message: "value is required" });
      await storage.setSystemSetting(req.params.key, String(value));
      res.json({ key: req.params.key, value: String(value) });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update setting" });
    }
  });

  // Public setting check (for coach visibility)
  app.get("/api/settings/:key", async (req: any, res) => {
    try {
      const value = await storage.getSystemSetting(req.params.key);
      res.json({ key: req.params.key, value });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch setting" });
    }
  });

  // Startup features endpoint (for frontend gating)
  app.get("/api/startups/:startupId/missions", isAuthenticated, async (req: any, res) => {
    try {
      const startupId = Number(req.params.startupId);
      const userId = req.user.claims.sub;
      const isMember = await storage.isStartupMember(userId, startupId);
      if (!isMember) return res.status(403).json({ message: "Not a member" });
      const missions = await storage.getStartupMissions(startupId);
      res.json(missions);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch startup missions" });
    }
  });

  // =====================================================================
  // My Journey: sprints, sprint missions, KPIs, EIR profile, cohort dates
  // =====================================================================

  const requireMyJourneyFeature = async (req: any, res: any, next: any) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorised" });
    const user = await storage.getUser(userId);
    const isAdminUser = user?.isAdmin || user?.role === "superadmin" || user?.role === "admin";
    if (isAdminUser) return next();
    const startupId = Number(req.params.startupId ?? req.body?.startupId);
    if (!startupId) return res.status(400).json({ message: "startupId is required" });
    // EIRs may access startup-scoped My Journey routes only for startups in their assigned groups.
    if (user?.isEir === true) {
      const startupGroupList = await storage.getStartupGroups(startupId);
      const eirGroups = await storage.getEirGroups(userId);
      const allowedGroupIds = new Set(eirGroups.map(g => g.id));
      const inGroup = startupGroupList.some(sg => allowedGroupIds.has(sg.id));
      if (!inGroup) return res.status(403).json({ message: "Not assigned to this startup's group" });
      return next();
    }
    const isMember = await storage.isStartupMember(userId, startupId);
    if (!isMember) return res.status(403).json({ message: "Not a member" });
    const features = await storage.getStartupFeatures(startupId);
    const enabled = features.some(f => f.featureKey === "my_journey" && f.enabled);
    if (!enabled) return res.status(403).json({ message: "Programme Journey not enabled for this startup" });
    next();
  };

  // Stricter middleware: only startup members (founders) and admins may MUTATE founder-owned
  // My Journey data (sprint commitments + KPI CRUD/snapshots). EIRs deliberately do not pass —
  // they use the dedicated EIR confirm/carry-over endpoints instead.
  const requireFounderMyJourney = async (req: any, res: any, next: any) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorised" });
    const user = await storage.getUser(userId);
    const isAdminUser = user?.isAdmin || user?.role === "superadmin" || user?.role === "admin";
    if (isAdminUser) return next();
    const startupId = Number(req.params.startupId ?? req.body?.startupId);
    if (!startupId) return res.status(400).json({ message: "startupId is required" });
    const isMember = await storage.isStartupMember(userId, startupId);
    if (!isMember) return res.status(403).json({ message: "Only startup members can modify journey data" });
    const features = await storage.getStartupFeatures(startupId);
    const enabled = features.some(f => f.featureKey === "my_journey" && f.enabled);
    if (!enabled) return res.status(403).json({ message: "Programme Journey not enabled for this startup" });
    next();
  };

  // Helper: pick first programme the startup belongs to (My Journey uses one phase plan per startup)
  async function getStartupProgrammeId(startupId: number): Promise<number | null> {
    const progs = await storage.getProgrammesForStartup(startupId);
    return progs[0]?.id ?? null;
  }

  // Compute the current sprint + position within it for a startup, based on
  // the earliest active cohort start date and the phase plan order.
  function computeCurrentSprint(
    phasePlan: any[],
    cohortsList: any[],
  ): { sprint: any; weekInSprint: number; position: "sprint_start" | "sprint_end" | "monthly" | "manual" } | null {
    if (!phasePlan?.length || !cohortsList?.length) return null;
    const dated = cohortsList.filter(c => c.startDate).map(c => ({ ...c, _start: new Date(c.startDate) }));
    if (!dated.length) return null;
    dated.sort((a, b) => a._start.getTime() - b._start.getTime());
    const start = dated[0]._start;
    const now = new Date();
    const weeksElapsed = Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (weeksElapsed < 0) return null;
    const ordered = [...phasePlan].sort((a, b) => {
      if (a.phaseKey === b.phaseKey) return a.orderIndex - b.orderIndex;
      return a.phaseKey === "foundation" ? -1 : 1;
    });
    let cursor = 0;
    for (const s of ordered) {
      const len = Math.max(1, s.durationWeeks || 2);
      if (weeksElapsed < cursor + len) {
        const weekInSprint = weeksElapsed - cursor;
        let position: "sprint_start" | "sprint_end" | "monthly" | "manual";
        if (weekInSprint === 0) position = "sprint_start";
        else if (weekInSprint >= len - 1) position = "sprint_end";
        else position = "monthly";
        return { sprint: s, weekInSprint, position };
      }
      cursor += len;
    }
    return null;
  }

  // Current readiness levels for a startup (used by My Journey mission picker to filter
  // missions whose requirements are within reach of the founder's current readiness).
  app.get("/api/startups/:startupId/readiness", isAuthenticated, requireMyJourneyFeature, async (req: any, res) => {
    try {
      const startupId = Number(req.params.startupId);
      const levels = await storage.computeReadinessLevels(startupId);
      res.json(levels);
    } catch (err: any) {
      console.error("[my-journey] readiness error", err);
      res.status(500).json({ message: "Failed to compute readiness" });
    }
  });

  // Thin read endpoint for readiness snapshots history (used by My Journey
  // history chart). Returns ordered snapshots for the startup; access is gated
  // by the My Journey feature middleware which already verifies membership.
  app.get("/api/startups/:startupId/readiness-snapshots", isAuthenticated, requireMyJourneyFeature, async (req: any, res) => {
    try {
      const startupId = Number(req.params.startupId);
      const snaps = await storage.getReadinessSnapshotsForStartup(startupId);
      res.json(snaps);
    } catch (err: any) {
      console.error("[my-journey] readiness-snapshots error", err);
      res.status(500).json({ message: "Failed to load readiness snapshots" });
    }
  });

  // Per-user persistence of the foundation→mastermind transition celebration: stored
  // on the user record (`users.journey_state.foundationCelebrationSeenForStartupIds`)
  // so each founder sees the modal exactly once for each startup, independently of
  // teammates and across devices.
  app.get("/api/startups/:startupId/journey-transition-seen", isAuthenticated, requireMyJourneyFeature, async (req: any, res) => {
    try {
      const startupId = Number(req.params.startupId);
      const user = await storage.getUser(req.user.claims.sub);
      const seenIds: number[] = (user?.journeyState as any)?.foundationCelebrationSeenForStartupIds || [];
      res.json({ seen: seenIds.includes(startupId) });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
  app.post("/api/startups/:startupId/journey-transition-seen", isAuthenticated, requireFounderMyJourney, async (req: any, res) => {
    try {
      const startupId = Number(req.params.startupId);
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const prev: number[] = (user?.journeyState as any)?.foundationCelebrationSeenForStartupIds || [];
      const next = prev.includes(startupId) ? prev : [...prev, startupId];
      await storage.updateUserJourneyState(userId, { foundationCelebrationSeenForStartupIds: next });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET orientation & phase progress for a startup
  app.get("/api/startups/:startupId/journey-progress", isAuthenticated, requireMyJourneyFeature, async (req: any, res) => {
    try {
      const startupId = Number(req.params.startupId);
      const programmeId = await getStartupProgrammeId(startupId);
      if (!programmeId) return res.json({ status: "no_programme" });
      const phasePlan = await storage.getSprintsForProgramme(programmeId);
      const cohortsList = await storage.getStartupCohortsWithDates(startupId);
      const cohort = cohortsList.filter(c => c.startDate).sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime())[0] ?? null;
      const cohortName = cohort?.name ?? null;
      const cohortStart = cohort?.startDate ? new Date(cohort.startDate) : null;
      const cohortEnd = cohort?.endDate ? new Date(cohort.endDate) : null;
      const ordered = [...phasePlan].sort((a, b) => {
        if (a.phaseKey === b.phaseKey) return a.orderIndex - b.orderIndex;
        return a.phaseKey === "foundation" ? -1 : 1;
      });
      const totals = { foundation: 0, mastermind: 0 };
      for (const s of ordered) totals[s.phaseKey as "foundation" | "mastermind"] = (totals[s.phaseKey as "foundation" | "mastermind"] || 0) + Math.max(1, s.durationWeeks || 2);
      // Precompute each sprint's absolute start/end dates (anchored on cohort start)
      const sprintWindows: Record<number, { startDate: string; endDate: string }> = {};
      if (cohortStart) {
        let cur = 0;
        for (const s of ordered) {
          const len = Math.max(1, s.durationWeeks || 2);
          const sStart = new Date(cohortStart.getTime() + cur * 7 * 24 * 60 * 60 * 1000);
          const sEnd = new Date(cohortStart.getTime() + (cur + len) * 7 * 24 * 60 * 60 * 1000);
          sprintWindows[s.id] = { startDate: sStart.toISOString(), endDate: sEnd.toISOString() };
          cur += len;
        }
      }
      let weeksElapsed: number | null = null;
      let hoursSinceSprintStart: number | null = null;
      if (cohortStart) {
        const diff = Math.floor((Date.now() - cohortStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
        weeksElapsed = diff;
      }
      let status: "pre_start" | "foundation" | "mastermind" | "graduated" = "pre_start";
      let weekInPhase = 0;
      let weeksInPhase = totals.foundation + totals.mastermind;
      let weekInSprint = 0;
      let currentSprintId: number | null = null;
      let sprintIndexInPhase = 0;
      let totalSprintsInPhase = 0;
      let phaseLabel = "Pre-start";
      let position: "pre_start" | "sprint_start" | "sprint_end" | "monthly" | "manual" | "graduated" = "pre_start";
      if (weeksElapsed != null) {
        if (weeksElapsed < 0) {
          status = "pre_start";
        } else {
          let cursor = 0;
          let matched = false;
          for (const s of ordered) {
            const len = Math.max(1, s.durationWeeks || 2);
            if (weeksElapsed < cursor + len) {
              currentSprintId = s.id;
              status = s.phaseKey as "foundation" | "mastermind";
              phaseLabel = status === "foundation" ? "Foundation" : "Mastermind";
              const phaseSprints = ordered.filter(x => x.phaseKey === status);
              totalSprintsInPhase = phaseSprints.length;
              sprintIndexInPhase = phaseSprints.findIndex(x => x.id === s.id) + 1;
              weeksInPhase = totals[status as "foundation" | "mastermind"];
              const cursorPhaseStart = ordered.filter(x => x.phaseKey === status).reduce((acc, x) => acc, 0);
              const beforeInPhase = phaseSprints.slice(0, sprintIndexInPhase - 1).reduce((acc, x) => acc + Math.max(1, x.durationWeeks || 2), 0);
              weekInSprint = weeksElapsed - cursor;
              weekInPhase = beforeInPhase + weekInSprint + 1; // 1-indexed
              position = weekInSprint === 0 ? "sprint_start" : (weekInSprint >= len - 1 ? "sprint_end" : "monthly");
              const sw = sprintWindows[s.id];
              if (sw) hoursSinceSprintStart = (Date.now() - new Date(sw.startDate).getTime()) / (60 * 60 * 1000);
              matched = true;
              break;
            }
            cursor += len;
          }
          if (!matched) {
            status = "graduated";
            phaseLabel = "Graduated";
            position = "graduated";
          }
        }
      }
      const user = await storage.getUser(req.user.claims.sub);
      const startup = await storage.getStartup(startupId);
      res.json({
        status,
        founderName: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || null,
        startupName: startup?.name ?? null,
        startupLogoUrl: startup?.logoUrl ?? null,
        cohortName,
        cohortStartDate: cohortStart?.toISOString() ?? null,
        cohortEndDate: cohortEnd?.toISOString() ?? null,
        weeksElapsed,
        weekInPhase,
        weeksInPhase,
        weekInSprint,
        currentSprintId,
        phaseLabel,
        sprintIndexInPhase,
        totalSprintsInPhase,
        position,
        daysUntilStart: cohortStart ? Math.ceil((cohortStart.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null,
        hoursSinceSprintStart,
        sprintWindows,
      });
    } catch (err: any) {
      console.error("[my-journey] progress error", err);
      res.status(500).json({ message: "Failed to compute progress" });
    }
  });

  // GET sprints (phase plan) for a startup's programme
  app.get("/api/startups/:startupId/sprints", isAuthenticated, requireMyJourneyFeature, async (req: any, res) => {
    try {
      const startupId = Number(req.params.startupId);
      const programmeId = await getStartupProgrammeId(startupId);
      if (!programmeId) return res.json([]);
      const sprints = await storage.getSprintsForProgramme(programmeId);
      res.json(sprints);
    } catch (err: any) {
      console.error("[my-journey] sprints error", err);
      res.status(500).json({ message: "Failed to fetch sprints" });
    }
  });

  // GET sprint missions for a startup
  app.get("/api/startups/:startupId/sprint-missions", isAuthenticated, requireMyJourneyFeature, async (req: any, res) => {
    try {
      const startupId = Number(req.params.startupId);
      const rows = await storage.getSprintMissionsForStartup(startupId);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch sprint missions" });
    }
  });

  // Choose / re-choose a mission for a sprint
  app.post("/api/startups/:startupId/sprint-missions", isAuthenticated, requireFounderMyJourney, async (req: any, res) => {
    try {
      const startupId = Number(req.params.startupId);
      const userId = req.user.claims.sub;
      const { sprintId, missionId, confidence, rationale } = req.body;
      if (!sprintId || !missionId) return res.status(400).json({ message: "sprintId and missionId required" });
      // Sprint ownership check: the sprint must belong to the startup's own programme.
      const programmeId = await getStartupProgrammeId(startupId);
      if (!programmeId) return res.status(400).json({ message: "Startup has no programme" });
      const programmeSprints = await storage.getSprintsForProgramme(programmeId);
      if (!programmeSprints.some(s => s.id === Number(sprintId))) {
        return res.status(403).json({ message: "Sprint does not belong to this startup's programme" });
      }
      const row = await storage.upsertSprintMission({ startupId, sprintId: Number(sprintId), missionId: Number(missionId), confidence: confidence ?? 5, rationale: rationale ?? null, status: "proposed", chosenBy: userId });
      // Mirror onto startup.activeMilestoneId so this mission is also the startup's headline focus.
      try { await storage.updateStartup(startupId, { activeMilestoneId: String(missionId) } as any); } catch (e) { console.warn("[my-journey] activeMilestoneId sync failed", e); }
      res.status(201).json(row);
    } catch (err: any) {
      console.error("[my-journey] sprint-mission upsert error", err);
      res.status(500).json({ message: "Failed to set sprint mission" });
    }
  });

  // Confirm sprint mission — EIR or admin only
  app.patch("/api/startups/:startupId/sprint-missions/:id/confirm", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdminUser = user?.isAdmin || user?.role === "superadmin" || user?.role === "admin";
      const isEirUser = user?.isEir === true;
      if (!isAdminUser && !isEirUser) return res.status(403).json({ message: "EIR or admin role required" });
      const id = Number(req.params.id);
      const startupId = Number(req.params.startupId);
      // Validate the sprint mission belongs to the route's startup
      const existing = await storage.getSprintMissionById(id);
      if (!existing || existing.startupId !== startupId) return res.status(404).json({ message: "Sprint mission not found" });
      // Sprint ownership check: the sprint mission's sprint must belong to the startup's programme.
      const programmeIdForConfirm = await getStartupProgrammeId(startupId);
      if (programmeIdForConfirm) {
        const programmeSprints = await storage.getSprintsForProgramme(programmeIdForConfirm);
        if (!programmeSprints.some(s => s.id === existing.sprintId)) {
          return res.status(403).json({ message: "Sprint does not belong to this startup's programme" });
        }
      }
      // If EIR (not admin), ensure they're assigned to a group containing this startup
      if (isEirUser && !isAdminUser) {
        const startupGroupList = await storage.getStartupGroups(startupId);
        const eirGroups = await storage.getEirGroups(userId);
        const allowedGroupIds = new Set(eirGroups.map(g => g.id));
        if (!startupGroupList.some(sg => allowedGroupIds.has(sg.id))) {
          return res.status(403).json({ message: "Not assigned to this startup's group" });
        }
      }
      const updated = await storage.updateSprintMission(id, { status: "confirmed", confirmedAt: new Date(), confirmedBy: userId } as any);
      res.json(updated);
    } catch (err: any) {
      console.error("[my-journey] confirm error", err);
      res.status(500).json({ message: "Failed to confirm sprint mission" });
    }
  });

  // Default-mission completions for foundation sprints (the built-in
  // "Review {dimension} readiness level" rows shown in Programme Journey).
  app.get("/api/startups/:startupId/sprint-default-completions", isAuthenticated, requireMyJourneyFeature, async (req: any, res) => {
    try {
      const startupId = Number(req.params.startupId);
      const rows = await storage.getSprintDefaultMissionCompletions(startupId);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch default mission completions" });
    }
  });

  app.post("/api/startups/:startupId/sprints/:sprintId/default-mission-complete", isAuthenticated, requireFounderMyJourney, async (req: any, res) => {
    try {
      const startupId = Number(req.params.startupId);
      const sprintId = Number(req.params.sprintId);
      const userId = req.user.claims.sub;
      // Ensure the sprint belongs to the startup's programme and has a dimension
      // (default missions only exist on foundation sprints with a KTH dimension).
      const programmeId = await getStartupProgrammeId(startupId);
      if (!programmeId) return res.status(400).json({ message: "Startup has no programme" });
      const programmeSprints = await storage.getSprintsForProgramme(programmeId);
      const sprint = programmeSprints.find(s => s.id === sprintId);
      if (!sprint) return res.status(403).json({ message: "Sprint does not belong to this startup's programme" });
      if (!sprint.dimension) return res.status(400).json({ message: "Sprint has no dimension — no default mission" });
      const row = await storage.markSprintDefaultMissionComplete(startupId, sprintId, userId);
      res.status(201).json(row);
    } catch (err: any) {
      console.error("[my-journey] default-mission-complete error", err);
      res.status(500).json({ message: "Failed to mark default mission complete" });
    }
  });

  // Carry over a sprint mission into the next sprint (EIR/admin)
  app.post("/api/startups/:startupId/sprint-missions/:id/carry-over", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdminUser = user?.isAdmin || user?.role === "superadmin" || user?.role === "admin";
      const isEirUser = user?.isEir === true;
      if (!isAdminUser && !isEirUser) return res.status(403).json({ message: "EIR or admin role required" });
      const id = Number(req.params.id);
      const startupId = Number(req.params.startupId);
      const existing = await storage.getSprintMissionById(id);
      if (!existing || existing.startupId !== startupId) return res.status(404).json({ message: "Sprint mission not found" });
      // If EIR (not admin), ensure they're assigned to a group containing this startup
      if (isEirUser && !isAdminUser) {
        const startupGroupList = await storage.getStartupGroups(startupId);
        const eirGroups = await storage.getEirGroups(userId);
        const allowedGroupIds = new Set(eirGroups.map(g => g.id));
        if (!startupGroupList.some(sg => allowedGroupIds.has(sg.id))) {
          return res.status(403).json({ message: "Not assigned to this startup's group" });
        }
      }
      const programmeId = await getStartupProgrammeId(startupId);
      if (!programmeId) return res.status(400).json({ message: "Startup has no programme" });
      const sprints = await storage.getSprintsForProgramme(programmeId);
      const currentSprint = sprints.find(s => s.id === existing.sprintId);
      if (!currentSprint) return res.status(404).json({ message: "Sprint not found (not in this startup's programme)" });
      // Find next sprint in chronological order across phases (Foundation → Mastermind),
      // so a mission missed at the end of Foundation can carry into the first Mastermind sprint.
      const ordered = [...sprints].sort((a, b) => {
        if (a.phaseKey === b.phaseKey) return a.orderIndex - b.orderIndex;
        return a.phaseKey === "foundation" ? -1 : 1;
      });
      const curIdx = ordered.findIndex(s => s.id === currentSprint.id);
      const next = curIdx >= 0 ? ordered[curIdx + 1] : undefined;
      if (!next) return res.status(400).json({ message: "No next sprint to carry over into" });
      await storage.updateSprintMission(id, { status: "carried_over" } as any);
      const newRow = await storage.upsertSprintMission({
        startupId, sprintId: next.id, missionId: existing.missionId,
        confidence: existing.confidence ?? 5, rationale: existing.rationale ?? null,
        status: "proposed", chosenBy: userId,
      });
      res.status(201).json(newRow);
    } catch (err: any) {
      console.error("[my-journey] carry-over error", err);
      res.status(500).json({ message: "Failed to carry over sprint mission" });
    }
  });

  // KPIs CRUD per startup
  app.get("/api/startups/:startupId/kpis", isAuthenticated, requireMyJourneyFeature, async (req: any, res) => {
    try {
      const startupId = Number(req.params.startupId);
      await storage.ensureDefaultKpis(startupId);
      const list = await storage.getKpisForStartup(startupId);
      // attach last 12 snapshots inline for sparklines
      const withSnap = await Promise.all(list.map(async k => ({ ...k, snapshots: await storage.getKpiSnapshots(k.id, 12) })));
      res.json(withSnap);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch KPIs" });
    }
  });

  app.post("/api/startups/:startupId/kpis", isAuthenticated, requireFounderMyJourney, async (req: any, res) => {
    try {
      const startupId = Number(req.params.startupId);
      const { name, unit, target, currentValue, displayOrder } = req.body;
      if (!name) return res.status(400).json({ message: "name required" });
      const row = await storage.createKpi({ startupId, name, unit: unit ?? "", target: target ?? null, currentValue: currentValue ?? "0", isDefault: false, displayOrder: displayOrder ?? 99 });
      res.status(201).json(row);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create KPI" });
    }
  });

  app.patch("/api/startups/:startupId/kpis/:id", isAuthenticated, requireFounderMyJourney, async (req: any, res) => {
    try {
      const startupId = Number(req.params.startupId);
      const id = Number(req.params.id);
      const existing = await storage.getKpi(id);
      if (!existing || existing.startupId !== startupId) return res.status(404).json({ message: "KPI not found" });
      const { name, unit, target, currentValue, displayOrder } = req.body;
      const row = await storage.updateKpi(id, { name, unit, target, currentValue, displayOrder });
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update KPI" });
    }
  });

  app.delete("/api/startups/:startupId/kpis/:id", isAuthenticated, requireFounderMyJourney, async (req: any, res) => {
    try {
      const startupId = Number(req.params.startupId);
      const id = Number(req.params.id);
      const existing = await storage.getKpi(id);
      if (!existing || existing.startupId !== startupId) return res.status(404).json({ message: "KPI not found" });
      await storage.deleteKpi(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete KPI" });
    }
  });

  // Record a KPI value (also updates currentValue on the KPI)
  app.post("/api/startups/:startupId/kpis/:id/snapshots", isAuthenticated, requireFounderMyJourney, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const startupId = Number(req.params.startupId);
      const id = Number(req.params.id);
      const existing = await storage.getKpi(id);
      if (!existing || existing.startupId !== startupId) return res.status(404).json({ message: "KPI not found" });
      const { value, recordedAtMilestone, sprintId } = req.body;
      if (value === undefined || value === null || value === "") return res.status(400).json({ message: "value required" });
      // Server-side inference of milestone tag when caller does not pass one.
      let inferredMilestone: string = recordedAtMilestone || "manual";
      let inferredSprintId: number | null = sprintId ?? null;
      if (!recordedAtMilestone) {
        const programmeId = await getStartupProgrammeId(startupId);
        if (programmeId) {
          const phasePlan = await storage.getSprintsForProgramme(programmeId);
          const cohorts = await storage.getStartupCohortsWithDates(startupId);
          const current = computeCurrentSprint(phasePlan, cohorts);
          if (current) {
            inferredSprintId = current.sprint.id;
            inferredMilestone = current.position; // sprint_start | sprint_end | monthly | manual
          }
        }
      }
      const snap = await storage.createKpiSnapshot({ kpiId: id, value: String(value), recordedAtMilestone: inferredMilestone, sprintId: inferredSprintId });
      await storage.updateKpi(id, { currentValue: String(value) });
      res.status(201).json(snap);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to record KPI snapshot" });
    }
  });

  // Self-serve profile update (any signed-in user). EIRs may additionally
  // update eirPhotoUrl / eirBio / eirCalendarUrl. Other users sending those
  // fields will be rejected with 403.
  app.patch("/api/me/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const baseSchema = z.object({
        firstName: z.string().trim().max(100).nullable().optional(),
        lastName: z.string().trim().max(100).nullable().optional(),
        profileImageUrl: z.string().trim().nullable().optional(),
        eirPhotoUrl: z.string().trim().nullable().optional(),
        eirBio: z.string().trim().max(2000).nullable().optional(),
        eirCalendarUrl: z.string().trim().nullable().optional(),
      });
      const parsed = baseSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const data = parsed.data;
      const eirOnlyKeys = ["eirPhotoUrl", "eirBio", "eirCalendarUrl"] as const;
      const isEir = user.isEir === true;
      if (!isEir) {
        for (const k of eirOnlyKeys) {
          if (data[k] !== undefined) {
            return res.status(403).json({ message: "EIR role required to update EIR fields" });
          }
        }
      }
      const updated = await storage.updateUserEirProfile(userId, {
        firstName: data.firstName,
        lastName: data.lastName,
        profileImageUrl: data.profileImageUrl,
        eirPhotoUrl: isEir ? data.eirPhotoUrl : undefined,
        eirBio: isEir ? data.eirBio : undefined,
        eirCalendarUrl: isEir ? data.eirCalendarUrl : undefined,
      } as any);
      res.json(updated);
    } catch (err: any) {
      console.error("[me] patch profile error", err);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // EIR self-update profile (photo / bio / calendar URL)
  app.patch("/api/me/eir-profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (user?.isEir !== true && user?.role !== "superadmin" && !user?.isAdmin) return res.status(403).json({ message: "EIR role required" });
      const { eirPhotoUrl, eirBio, eirCalendarUrl } = req.body;
      const updated = await storage.updateUserEirProfile(userId, { eirPhotoUrl, eirBio, eirCalendarUrl });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update EIR profile" });
    }
  });

  // Get the EIR(s) assigned to a startup, with profile fields
  app.get("/api/startups/:startupId/eirs", isAuthenticated, requireMyJourneyFeature, async (req: any, res) => {
    try {
      const startupId = Number(req.params.startupId);
      // Find groups containing this startup, then EIRs assigned to those groups
      const startupGroupsList = await storage.getStartupGroups(startupId);
      const eirIds = new Set<string>();
      for (const sg of startupGroupsList) {
        const assignments = await storage.getGroupEirs(sg.id);
        assignments.forEach(a => eirIds.add(a.userId));
      }
      const eirs = await Promise.all(Array.from(eirIds).map(id => storage.getUser(id)));
      const filtered = eirs.filter(Boolean).map((u: any) => ({
        id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email,
        eirPhotoUrl: u.eirPhotoUrl, eirBio: u.eirBio, eirCalendarUrl: u.eirCalendarUrl,
      }));
      res.json(filtered);
    } catch (err: any) {
      console.error("[my-journey] eirs error", err);
      res.status(500).json({ message: "Failed to fetch EIRs" });
    }
  });

  // Update user journey state (e.g. dismiss celebration)
  app.patch("/api/me/journey-state", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.updateUserJourneyState(userId, req.body || {});
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update journey state" });
    }
  });

  // List all EIRs (for admin assignment UIs)
  app.get("/api/admin/eirs", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      res.json(await storage.listEirs());
    } catch (err: any) {
      res.status(500).json({ message: "Failed to list EIRs" });
    }
  });

  // Admin: invite a new EIR (or promote an existing user to EIR).
  // If a user with this email already exists, they are promoted and their
  // profile fields are updated; no invitation email is sent. Otherwise a
  // role-only invitation is created and an invitation email is sent.
  app.post("/api/admin/eirs", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const schema = z.object({
        email: z.string().email("A valid email is required"),
        firstName: z.string().trim().optional(),
        lastName: z.string().trim().optional(),
        eirPhotoUrl: z.string().trim().optional().nullable(),
        eirBio: z.string().trim().optional().nullable(),
        eirCalendarUrl: z.string().trim().optional().nullable(),
        groupIds: z.array(z.number().int()).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const { email, firstName, lastName, eirPhotoUrl, eirBio, eirCalendarUrl, groupIds } = parsed.data;
      const normalizedEmail = email.toLowerCase().trim();
      const adminId = req.user.claims.sub;

      const existing = await storage.getUserByEmail(normalizedEmail);
      if (existing) {
        if (existing.isEir !== true) {
          await storage.setUserIsEir(existing.id, true);
        }
        const updated = await storage.updateUserEirProfile(existing.id, {
          firstName: firstName ?? existing.firstName ?? null,
          lastName: lastName ?? existing.lastName ?? null,
          eirPhotoUrl: eirPhotoUrl ?? existing.eirPhotoUrl ?? null,
          eirBio: eirBio ?? existing.eirBio ?? null,
          eirCalendarUrl: eirCalendarUrl ?? existing.eirCalendarUrl ?? null,
        });
        if (Array.isArray(groupIds)) {
          for (const gid of groupIds) {
            try { await storage.assignEirToGroup(existing.id, Number(gid), adminId); }
            catch (e) { console.error(`[admin] failed to assign EIR ${existing.id} to group ${gid}:`, e); }
          }
        }
        return res.status(200).json({ user: updated, promoted: true });
      }

      // New user — create a role-only invitation and send the EIR email.
      // Stash the draft profile on the invitation so it's applied
      // automatically when they first sign in (see handleInvitationOnLogin).
      const token = crypto.randomBytes(32).toString("hex");
      const pendingProfile: Record<string, string | null> = {};
      if (firstName !== undefined) pendingProfile.firstName = firstName ?? null;
      if (lastName !== undefined) pendingProfile.lastName = lastName ?? null;
      if (eirPhotoUrl !== undefined) pendingProfile.eirPhotoUrl = eirPhotoUrl ?? null;
      if (eirBio !== undefined) pendingProfile.eirBio = eirBio ?? null;
      if (eirCalendarUrl !== undefined) pendingProfile.eirCalendarUrl = eirCalendarUrl ?? null;
      // role: "eir" here is a sentinel meaning "grant EIR permission on accept".
      // `handleInvitationOnLogin` translates it to `setUserIsEir(true)` rather
      // than overwriting the user's base role.
      const invitation = await storage.createInvitation({
        email: normalizedEmail,
        startupId: null,
        programmeId: null,
        token,
        invitedById: adminId,
        role: "eir",
        pendingProfile: Object.keys(pendingProfile).length ? pendingProfile : null,
        pendingEirGroupIds: Array.isArray(groupIds) ? groupIds.map(Number) : [],
      });

      try {
        const baseUrl = req.protocol + "://" + req.get("host");
        const { sendEirInvitationEmail } = await import("./services/email");
        await sendEirInvitationEmail({
          to: normalizedEmail,
          firstName: firstName,
          inviteUrl: `${baseUrl}/invite/${token}`,
        });
      } catch (emailErr: any) {
        console.error("Failed to send EIR invitation email:", emailErr?.message || emailErr);
      }

      res.status(201).json({ invitation, promoted: false });
    } catch (err: any) {
      console.error("[admin] create eir error", err);
      res.status(500).json({ message: "Failed to invite EIR" });
    }
  });

  // Admin: remove the EIR permission from a user. Their base role
  // (founder/admin/superadmin) is left untouched — this only revokes the
  // additive EIR flag. Group assignments remain via foreign-key cascade
  // but they'll no longer appear in EIR-only lists or pass EIR-only checks.
  app.delete("/api/admin/eirs/:userId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = String(req.params.userId);
      const target = await storage.getUser(userId);
      if (!target) return res.status(404).json({ message: "User not found" });
      if (target.isEir !== true) return res.status(400).json({ message: "User is not an EIR" });
      const requesterId = req.user.claims.sub;
      if (userId === requesterId) {
        return res.status(400).json({ message: "You can't remove yourself" });
      }
      await storage.setUserIsEir(userId, false);
      res.json({ success: true, demoted: true });
    } catch (err: any) {
      console.error("[admin] delete eir error", err);
      res.status(500).json({ message: "Failed to remove EIR" });
    }
  });

  // Admin: edit an EIR's profile (name, photo, bio, calendar URL)
  app.patch("/api/admin/eirs/:userId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = String(req.params.userId);
      const target = await storage.getUser(userId);
      if (!target) return res.status(404).json({ message: "User not found" });
      if (target.isEir !== true) return res.status(400).json({ message: "User is not an EIR" });
      const patchSchema = z.object({
        firstName: z.string().trim().nullable().optional(),
        lastName: z.string().trim().nullable().optional(),
        eirPhotoUrl: z.string().trim().nullable().optional(),
        eirBio: z.string().trim().nullable().optional(),
        eirCalendarUrl: z.string().trim().nullable().optional(),
      });
      const parsed = patchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const updated = await storage.updateUserEirProfile(userId, parsed.data);
      res.json(updated);
    } catch (err: any) {
      console.error("[admin] patch eir error", err);
      res.status(500).json({ message: "Failed to update EIR" });
    }
  });

  // Admin: phase plan editor — manage sprints for a programme
  app.get("/api/admin/programmes/:programmeId/sprints", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      res.json(await storage.getSprintsForProgramme(Number(req.params.programmeId)));
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch sprints" });
    }
  });
  app.post("/api/admin/programmes/:programmeId/sprints", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const programmeId = Number(req.params.programmeId);
      const { phaseKey, orderIndex, dimension, label, durationWeeks } = req.body;
      const row = await storage.createSprint({ programmeId, phaseKey, orderIndex: orderIndex ?? 0, dimension: dimension ?? null, label, durationWeeks: durationWeeks ?? 2 });
      res.status(201).json(row);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create sprint" });
    }
  });
  app.patch("/api/admin/sprints/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const row = await storage.updateSprint(Number(req.params.id), req.body);
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update sprint" });
    }
  });
  app.delete("/api/admin/sprints/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.deleteSprint(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete sprint" });
    }
  });

  // Admin: cohort dates
  app.patch("/api/admin/cohorts/:id/dates", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.body;
      const row = await storage.updateCohortDates(Number(req.params.id), {
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      });
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update cohort dates" });
    }
  });

  // EIR dashboard: recent sprint missions & KPI updates for a group
  app.get("/api/eir/groups/:id/sprint-activity", isAuthenticated, isEir, async (req: any, res) => {
    try {
      const groupId = Number(req.params.id);
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (user?.role !== "superadmin" && !user?.isAdmin) {
        const eirGroups = await storage.getEirGroups(userId);
        if (!eirGroups.find(g => g.id === groupId)) return res.status(403).json({ message: "Not assigned to this group" });
      }
      const activity = await storage.getRecentSprintActivityForGroup(groupId, 25);
      res.json(activity);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch sprint activity" });
    }
  });

  app.get("/api/startups/:startupId/features", isAuthenticated, async (req: any, res) => {
    try {
      const startupId = Number(req.params.startupId);
      const userId = req.user.claims.sub;
      const isMember = await storage.isStartupMember(userId, startupId);
      if (!isMember) return res.status(403).json({ message: "Not a member" });
      const features = await storage.getStartupFeatures(startupId);
      res.json(features);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch features" });
    }
  });

  // Invitation validation (public, no auth)
  app.get("/api/invitations/:token", async (req: any, res) => {
    try {
      console.log(`[INVITE DEBUG] Looking up token: ${req.params.token.substring(0, 12)}...`);
      const allInvitations = await db.select({ id: invitations.id, token: invitations.token, status: invitations.status, email: invitations.email }).from(invitations);
      console.log(`[INVITE DEBUG] Total invitations in DB: ${allInvitations.length}`, allInvitations.map(i => ({ id: i.id, tokenPrefix: i.token.substring(0, 12), status: i.status })));
      const invitation = await storage.getInvitationByToken(req.params.token);
      console.log(`[INVITE DEBUG] Lookup result:`, invitation ? { id: invitation.id, status: invitation.status } : 'NOT FOUND');
      if (!invitation) return res.status(404).json({ message: "Invalid invitation" });
      if (invitation.status !== "pending") return res.status(400).json({ message: "Invitation already used", status: invitation.status });
      const programme = await storage.getProgramme(invitation.programmeId);
      const startup = (await storage.getStartupsInProgramme(invitation.programmeId)).find(s => s.id === invitation.startupId);
      res.json({
        email: invitation.email,
        programmeName: programme?.name,
        companyName: startup?.name,
        status: invitation.status,
      });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to validate invitation" });
    }
  });

  // --- Admin Level Content ---

  app.get("/api/admin/levels", isAuthenticated, isAdmin, async (req: any, res) => {
    const allLevels = await storage.getAllLevels();
    res.json(allLevels);
  });

  app.patch("/api/admin/levels/:id/content", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const levelId = parseInt(req.params.id);
      const { description, videoUrl, learningContent, furtherReadingLinks } = req.body;
      const data: any = {
        videoUrl: videoUrl ?? null,
        learningContent: learningContent ?? null,
        furtherReadingLinks: furtherReadingLinks ?? null,
      };
      if (typeof description === "string") {
        data.description = description;
      }
      const updated = await storage.updateLevelContent(levelId, data);
      res.json(updated);
    } catch (err: any) {
      console.error("Update level content error:", err);
      res.status(500).json({ message: "Failed to update level content" });
    }
  });

  app.get("/api/admin/levels/:id/checklist-items", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const levelId = parseInt(req.params.id);
      const items = await storage.getChecklistItems(levelId);
      res.json(items);
    } catch (err: any) {
      console.error("Get checklist items error:", err);
      res.status(500).json({ message: "Failed to get checklist items" });
    }
  });

  app.get("/api/admin/tool-templates", isAuthenticated, isPlatformAdmin, async (_req, res) => {
    try {
      const list = await storage.getToolTemplatesWithLinkage();
      res.json(list);
    } catch (err) {
      console.error("List tool templates with linkage error:", err);
      res.status(500).json({ message: "Failed to list tool templates" });
    }
  });

  app.patch("/api/admin/tool-templates/:id/visibility", isAuthenticated, isPlatformAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isHidden } = req.body;
      if (typeof isHidden !== "boolean") {
        return res.status(400).json({ message: "isHidden boolean is required" });
      }
      const updated = await storage.updateToolTemplateVisibility(id, isHidden);
      if (!updated) return res.status(404).json({ message: "Tool template not found" });
      res.json(updated);
    } catch (err) {
      console.error("Update tool visibility error:", err);
      res.status(500).json({ message: "Failed to update visibility" });
    }
  });

  app.patch("/api/admin/checklist-items/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const itemId = parseInt(req.params.id);
      const { label, explanatoryContent } = req.body;
      const data: any = {};
      if (typeof label === "string" && label.trim()) {
        data.label = label.trim();
      }
      if (explanatoryContent !== undefined) {
        data.explanatoryContent = explanatoryContent || null;
      }
      if (Object.keys(data).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      const updated = await storage.updateChecklistItem(itemId, data);
      if (!updated) return res.status(404).json({ message: "Checklist item not found" });
      res.json(updated);
    } catch (err: any) {
      console.error("Update checklist item error:", err);
      res.status(500).json({ message: "Failed to update checklist item" });
    }
  });

  // --- Knowledge Articles ---

  app.get(api.knowledge.list.path, isAuthenticated, async (req, res) => {
    const articles = await storage.getKnowledgeArticles();
    res.json(articles);
  });

  app.post(api.knowledge.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.knowledge.create.input.parse(req.body);
      const article = await storage.createKnowledgeArticle(input);
      res.status(201).json(article);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.patch(api.knowledge.update.path, isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const input = api.knowledge.update.input.parse(req.body);
      const updated = await storage.updateKnowledgeArticle(id, input);
      if (!updated) return res.status(404).json({ message: "Article not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete(api.knowledge.delete.path, isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id);
    await storage.deleteKnowledgeArticle(id);
    res.json({ success: true });
  });

  // --- Chat ---

  app.get(api.chat.messages.path, isAuthenticated, async (req: any, res) => {
    const startupId = Number(req.params.startupId);
    const userId = req.user.claims.sub;

    const isMember = await storage.isStartupMember(userId, startupId);
    if (!isMember) return res.status(403).json({ message: "Not a member" });

    const messages = await storage.getChatMessages(startupId, userId);
    res.json(messages.reverse());
  });

  app.delete(api.chat.clear.path, isAuthenticated, async (req: any, res) => {
    const startupId = Number(req.params.startupId);
    const userId = req.user.claims.sub;

    const isMember = await storage.isStartupMember(userId, startupId);
    if (!isMember) return res.status(403).json({ message: "Not a member" });

    await storage.clearChatHistory(startupId, userId);
    res.json({ success: true });
  });

  app.post(api.chat.send.path, isAuthenticated, async (req: any, res) => {
    try {
      const startupId = Number(req.params.startupId);
      const userId = req.user.claims.sub;

      const isMember = await storage.isStartupMember(userId, startupId);
      if (!isMember) return res.status(403).json({ message: "Not a member" });

      const { message } = api.chat.send.input.parse(req.body);

      await storage.saveChatMessage({
        startupId,
        userId,
        role: "user",
        content: message,
      });

      const context = await assembleReadinessContext(startupId, userId);
      const systemPrompt = buildSystemPrompt(context);

      const recentMessages = await storage.getChatMessages(startupId, userId, 20);
      const conversationHistory = recentMessages
        .reverse()
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      const abortController = new AbortController();
      let clientDisconnected = false;

      req.on("close", () => {
        clientDisconnected = true;
        abortController.abort();
      });

      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
        ],
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      let fullResponse = "";

      try {
        for await (const chunk of stream) {
          if (clientDisconnected) break;
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            fullResponse += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
      } catch (streamErr: any) {
        if (!clientDisconnected) {
          res.write(`data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`);
        }
      }

      if (fullResponse && !clientDisconnected) {
        await storage.saveChatMessage({
          startupId,
          userId,
          role: "assistant",
          content: fullResponse,
        });
      }

      if (!clientDisconnected) {
        res.write(`data: [DONE]\n\n`);
      }
      res.end();
    } catch (err: any) {
      console.error("Chat error:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Chat error: " + (err.message || "Unknown error") });
      } else {
        res.write(`data: ${JSON.stringify({ error: err.message || "Unknown error" })}\n\n`);
        res.end();
      }
    }
  });

  // --- Logo Proxy ---
  const logoCache = new Map<string, { data: Buffer; contentType: string; timestamp: number }>();
  const LOGO_CACHE_TTL = 1000 * 60 * 60 * 24;
  const logoFailCache = new Set<string>();

  app.get("/api/logo/:domain", async (req, res) => {
    const domain = req.params.domain;
    if (!domain || domain.includes("/") || domain.includes("..")) {
      return res.status(400).send("Invalid domain");
    }

    const cached = logoCache.get(domain);
    if (cached && Date.now() - cached.timestamp < LOGO_CACHE_TTL) {
      res.setHeader("Content-Type", cached.contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(cached.data);
    }

    if (logoFailCache.has(domain)) {
      return res.status(404).send("Logo not available");
    }

    const token = process.env.LOGO_DEV_TOKEN;
    if (!token) {
      return res.status(404).send("Logo service not configured");
    }

    try {
      const logoRes = await fetch(`https://img.logo.dev/${domain}?token=${token}&size=128&format=png`);
      if (!logoRes.ok) {
        logoFailCache.add(domain);
        setTimeout(() => logoFailCache.delete(domain), 1000 * 60 * 30);
        return res.status(404).send("Logo not found");
      }
      const contentType = logoRes.headers.get("content-type") || "image/png";
      const buffer = Buffer.from(await logoRes.arrayBuffer());
      logoCache.set(domain, { data: buffer, contentType, timestamp: Date.now() });
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(buffer);
    } catch (err) {
      logoFailCache.add(domain);
      setTimeout(() => logoFailCache.delete(domain), 1000 * 60 * 30);
      return res.status(404).send("Logo fetch failed");
    }
  });

  // --- Investor Introductions ---

  app.get(api.investorIntroductions.investors.path, isAuthenticated, async (req: any, res) => {
    try {
      const { getInvestors } = await import("./services/airtable");
      const investors = await getInvestors();
      res.json(investors);
    } catch (err: any) {
      console.error("Investor fetch error:", err);
      res.status(500).json({ message: "Failed to fetch investors: " + (err.message || "Unknown error") });
    }
  });

  app.post(api.investorIntroductions.submit.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.investorIntroductions.submit.input.parse(req.body);
      const jobId = `match-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const userId = req.user.claims.sub;

      const job: MatchJob = {
        id: jobId,
        userId,
        status: "running",
        progress: { phase: "filtering", current: 0, total: 1, message: "Starting..." },
        listeners: new Set(),
        createdAt: Date.now(),
      };
      matchJobs.set(jobId, job);

      (async () => {
        try {
          const { getInvestors } = await import("./services/airtable");
          const { runMatching } = await import("./services/matching");

          const localId = `local-${Date.now()}`;

          const investors = await getInvestors();
          const allFeedback = await storage.getAllMatchFeedback();
          const matchingConfig = await storage.getMatchingConfig();
          const feedbackEntries = allFeedback
            .filter(f => f.reason)
            .map(f => ({ investorName: f.investorName || "", startupName: f.startupName || "", reason: f.reason || "", rating: f.rating }));

          const fundingRound = {
            id: localId, startupId: localId, startupName: input.startupName,
            roundStage: input.roundStage, amountRaising: input.amountRaising,
            minTicketSize: input.minTicketSize,
            investmentTypes: input.investmentTypes, roundGeography: input.roundGeography,
            roundSectors: input.roundSectors,
            tweetPitch: input.tweetPitch, tractionSummary: input.tractionSummary,
            unfairAdvantage: input.unfairAdvantage,
            preferredInvestorTypes: input.preferredInvestorTypes,
          };

          const startup = {
            id: localId, name: input.startupName, description: input.description,
            climateProblem: input.climateProblem, solutionDescription: input.solutionDescription,
            businessModel: input.businessModel, targetMarket: input.targetMarket,
            competitors: input.competitors,
          };

          const matches = await runMatching(fundingRound as any, startup as any, investors, feedbackEntries, undefined, matchingConfig, (progress) => {
            job.progress = progress;
            const eventData = `data: ${JSON.stringify(progress)}\n\n`;
            for (const listener of job.listeners) listener(eventData);
          });

          const submittedStartupId = input.startupId ? Number(input.startupId) : null;
          try {
            await storage.saveMatchResults(userId, submittedStartupId, localId, input, matches);
          } catch (saveErr) {
            console.error("Failed to save match results:", saveErr);
          }

          job.status = "complete";
          job.result = { startupAirtableId: localId, fundingRoundAirtableId: localId, matches };
          const completeData = `data: ${JSON.stringify({ phase: "complete", current: 1, total: 1, message: "Matching complete!" })}\n\n`;
          for (const listener of job.listeners) listener(completeData);
        } catch (err: any) {
          console.error("Background matching error:", err);
          job.status = "error";
          job.error = err.message || "Unknown error";
          const errorData = `data: ${JSON.stringify({ phase: "error", current: 0, total: 0, message: job.error })}\n\n`;
          for (const listener of job.listeners) listener(errorData);
        }
      })();

      res.json({ jobId });
    } catch (err: any) {
      console.error("Submission error:", err);
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Submission failed: " + (err.message || "Unknown error") });
      }
    }
  });

  app.get("/api/investor-introductions/match-progress/:jobId", isAuthenticated, (req: any, res) => {
    const job = matchJobs.get(req.params.jobId);
    if (!job || job.userId !== req.user.claims.sub) return res.status(404).json({ message: "Job not found" });

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });

    res.write(`data: ${JSON.stringify(job.progress)}\n\n`);

    if (job.status === "complete") {
      res.write(`data: ${JSON.stringify({ phase: "complete", current: 1, total: 1, message: "Matching complete!" })}\n\n`);
      res.end();
      return;
    }

    if (job.status === "error") {
      res.write(`data: ${JSON.stringify({ phase: "error", current: 0, total: 0, message: job.error || "Failed" })}\n\n`);
      res.end();
      return;
    }

    const listener = (data: string) => {
      try { res.write(data); } catch {}
    };
    job.listeners.add(listener);

    req.on("close", () => {
      job.listeners.delete(listener);
    });
  });

  app.get("/api/investor-introductions/match-result/:jobId", isAuthenticated, (req: any, res) => {
    const job = matchJobs.get(req.params.jobId);
    if (!job || job.userId !== req.user.claims.sub) return res.status(404).json({ message: "Job not found" });
    if (job.status === "running") return res.status(202).json({ status: "running", progress: job.progress });
    if (job.status === "error") return res.status(500).json({ message: job.error || "Matching failed" });
    res.json(job.result);
  });

  app.get("/api/investor-introductions/latest-matches", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const activeStartupId = req.query.startupId ? Number(req.query.startupId) : null;
      const result = await storage.getLatestMatchResults(userId, activeStartupId);
      if (!result) {
        return res.json(null);
      }
      res.json({
        matchResults: {
          startupAirtableId: result.fundingRoundAirtableId,
          fundingRoundAirtableId: result.fundingRoundAirtableId,
          matches: result.matches,
        },
        formValues: result.formValues,
        createdAt: result.createdAt,
      });
    } catch (err: any) {
      console.error("Get latest matches error:", err);
      res.status(500).json({ message: "Failed to get latest matches" });
    }
  });

  app.post(api.investorIntroductions.feedback.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.investorIntroductions.feedback.input.parse(req.body);
      const result = await storage.upsertMatchFeedback(input);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: "Invalid feedback" });
    }
  });

  app.get(api.investorIntroductions.getFeedback.path, isAuthenticated, async (req: any, res) => {
    const roundId = req.params.roundId;
    const feedback = await storage.getMatchFeedback(roundId);
    res.json(feedback);
  });

  // Introduction Request routes (founder)
  app.post(api.investorIntroductions.requestIntro.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.investorIntroductions.requestIntro.input.parse(req.body);
      if (input.investors.length > 10) {
        return res.status(400).json({ message: "Maximum 10 investors per request" });
      }

      const request = await storage.createIntroductionRequest({
        userId: req.user.claims.sub,
        startupId: input.startupId,
        fundingRoundData: input.fundingRoundData,
        startupData: input.startupData,
        items: input.investors,
      });

      try {
        const admins = await storage.getAdminsByRole("investor_matching");
        const adminEmails = admins.map(a => a.email).filter(Boolean) as string[];
        if (adminEmails.length > 0) {
          const { sendAdminNotificationEmail } = await import("./services/email");
          const founderName = [req.user.firstName, req.user.lastName].filter(Boolean).join(" ") || req.user.email || "A founder";
          const startupName = input.startupData?.startupName || input.startupData?.name || "A Startup";
          await sendAdminNotificationEmail(adminEmails, startupName, founderName, input.investors.length, request.id);
        }
      } catch (emailErr) {
        console.error("Failed to send admin notification email:", emailErr);
      }

      (async () => {
        try {
          const { lookupFounderByEmail, lookupCompanyByName, createCompanyRecord, createIntroTrackerRecord, upsertFundingRound, getInvestorPeopleByOrg } = await import("./services/airtable");

          const founderEmail = req.user?.email;
          const startupName = input.startupData?.startupName || input.startupData?.name;
          const founderRecord = founderEmail ? await lookupFounderByEmail(founderEmail) : null;

          if (startupName && input.fundingRoundData) {
            let companyRecord = await lookupCompanyByName(startupName);
            if (!companyRecord) {
              companyRecord = await createCompanyRecord(startupName);
            }

            const frd = input.fundingRoundData;
            await upsertFundingRound({
              companyRecordId: companyRecord.id,
              startupName,
              roundStage: frd.roundStage || frd.fundraisingStage || "Unknown",
              amountRaising: frd.amountRaising,
              minTicketSize: frd.minTicketSize,
              investmentTypes: frd.investmentTypes,
              roundGeography: frd.roundGeography,
              roundSectors: frd.roundSectors,
              tweetPitch: frd.tweetPitch,
              tractionSummary: frd.tractionSummary,
              unfairAdvantage: frd.unfairAdvantage,
              preferredInvestorTypes: frd.preferredInvestorTypes,
            });
          }

          for (const item of request.items) {
            try {
              const people = await getInvestorPeopleByOrg(item.investorAirtableId);
              const personIds = people.map(p => p.id);

              const record = await createIntroTrackerRecord({
                dateOfRequest: new Date().toISOString().split("T")[0],
                status: "Requested",
                introducedToPersonIds: personIds.length > 0 ? personIds : undefined,
                founderRecordIds: founderRecord ? [founderRecord.id] : undefined,
              });

              await db.update(introductionItems).set({ airtableRecordId: record.id }).where(eq(introductionItems.id, item.id));
            } catch (itemErr) {
              console.error(`Airtable intro tracker sync failed for item ${item.id}:`, itemErr);
            }
          }
        } catch (syncErr) {
          console.error("Airtable intro request sync failed:", syncErr);
        }
      })();

      res.json(request);
    } catch (err: any) {
      console.error("Introduction request error:", err);
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Failed to create introduction request" });
      }
    }
  });

  app.get(api.investorIntroductions.getRequests.path, isAuthenticated, async (req: any, res) => {
    const startupId = req.query.startupId ? Number(req.query.startupId) : undefined;
    const requests = await storage.getIntroductionRequestsByUser(req.user.claims.sub, startupId);
    res.json(requests);
  });

  // Admin introduction routes (restricted to superadmin and investor_admin)
  app.get(api.admin.introductions.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub || req.user?.id;
    const allowed = await storage.isInvestorAdmin(userId);
    if (!allowed) return res.status(403).json({ message: "Unauthorised" });
    const requests = await storage.getAllIntroductionRequests();
    const totalInvestorAdmins = await storage.countInvestorAdmins();
    const allVotes = await db.select().from(introductionItemVotes);
    const votesByItem: Record<number, any[]> = {};
    for (const v of allVotes) {
      if (!votesByItem[v.itemId]) votesByItem[v.itemId] = [];
      votesByItem[v.itemId].push(v);
    }
    const allItemIds = requests.flatMap((r: any) => r.items.map((i: any) => i.id));
    const deckViewStatsMap = await storage.getDeckViewStatsBatch(allItemIds);
    const enriched = requests.map((req: any) => ({
      ...req,
      items: req.items.map((item: any) => {
        const dvStats = deckViewStatsMap.get(item.id);
        return {
          ...item,
          noConnectionVotes: (votesByItem[item.id] || []).filter((v: any) => v.vote === "no_connection").length,
          totalInvestorAdmins,
          deckViewCount: dvStats?.viewCount || 0,
          deckLastViewedAt: dvStats?.lastViewedAt || null,
        };
      }),
    }));
    res.json(enriched);
  });

  app.get("/api/admin/introductions/investor-people/:investorAirtableId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const allowed = await storage.isInvestorAdmin(userId);
      if (!allowed) return res.status(403).json({ message: "Unauthorised" });

      const { investorAirtableId } = req.params;
      const { getInvestorPeopleByOrg } = await import("./services/airtable");
      const { suggestContact, rankContacts } = await import("./services/contact-suggestion");
      const { eq: eqOp } = await import("drizzle-orm");

      const people = await getInvestorPeopleByOrg(investorAirtableId);

      const priorItems = await db.select().from(introductionItems)
        .where(eqOp(introductionItems.investorAirtableId, investorAirtableId));

      const priorInteractions = priorItems
        .filter(item => item.contactPersonId)
        .map(item => ({
          contactPersonId: item.contactPersonId!,
          successful: item.status === "email_sent" || item.status === "accepted",
        }));

      const startupSectors = req.query.sectors ? String(req.query.sectors).split(",") : [];
      const suggestion = suggestContact(people, startupSectors, priorInteractions);
      const ranked = rankContacts(people, startupSectors, priorInteractions);

      res.json({ people, suggestion, ranked });
    } catch (err: any) {
      console.error("Fetch investor people error:", err);
      res.status(500).json({ message: "Failed to fetch investor people" });
    }
  });

  app.post("/api/admin/introductions/investor-people", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const allowed = await storage.isInvestorAdmin(userId);
      if (!allowed) return res.status(403).json({ message: "Unauthorised" });

      const createContactSchema = z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email().optional().or(z.literal("")),
        role: z.string().optional(),
        linkedinUrl: z.string().url().optional().or(z.literal("")),
        investorOrgId: z.string().min(1, "Investor org ID is required"),
      });

      const parsed = createContactSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const { name, email, role, linkedinUrl, investorOrgId } = parsed.data;

      const { createInvestorPersonInAirtable } = await import("./services/airtable");
      const person = await createInvestorPersonInAirtable({
        name,
        email: email || undefined,
        role: role || undefined,
        linkedinUrl: linkedinUrl || undefined,
        investorOrgId,
      });
      res.status(201).json(person);
    } catch (err: any) {
      console.error("Create investor person error:", err);
      res.status(500).json({ message: "Failed to create investor person" });
    }
  });

  app.post("/api/admin/introductions/:itemId/generate-intro-message", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const allowed = await storage.isInvestorAdmin(userId);
      if (!allowed) return res.status(403).json({ message: "Unauthorised" });

      const itemId = parseInt(req.params.itemId);
      const [item] = await db.select().from(introductionItems).where(eq(introductionItems.id, itemId));
      if (!item) return res.status(404).json({ message: "Item not found" });

      const [request] = await db.select().from(introductionRequests).where(eq(introductionRequests.id, item.requestId));
      if (!request) return res.status(404).json({ message: "Request not found" });

      const { getInvestors } = await import("./services/airtable");
      const allInvestors = await getInvestors();
      const investor = allInvestors.find(inv => inv.id === item.investorAirtableId);

      const adminFirstName = req.user.firstName
        || (req.user.name ? (req.user.name as string).split(" ")[0] : undefined)
        || (req.user.email || "").split("@")[0]
        || "Team";

      const { generateIntroMessage } = await import("./services/intro-message");
      const message = await generateIntroMessage({
        investorName: item.investorName,
        investorData: investor || {},
        startupData: request.startupData as any,
        fundingRoundData: request.fundingRoundData as any,
        adminFirstName,
      });

      res.json({ message });
    } catch (err: any) {
      console.error("Generate intro message error:", err);
      res.status(500).json({ message: "Failed to generate message" });
    }
  });

  app.post("/api/admin/introductions/:itemId/approve", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const allowed = await storage.isInvestorAdmin(userId);
      if (!allowed) return res.status(403).json({ message: "Unauthorised" });

      const itemId = parseInt(req.params.itemId);
      const { adminNote, investorEmail, contactPersonId, contactPersonName, emailBody, sendMethod } = api.admin.introductions.approve.input.parse(req.body);

      const crypto = await import("crypto");
      const responseToken = crypto.randomBytes(32).toString("hex");
      const deckViewToken = crypto.randomBytes(16).toString("hex");

      const [item] = await db.select().from(introductionItems).where(eq(introductionItems.id, itemId));
      if (!item) return res.status(404).json({ message: "Item not found" });

      if (contactPersonId) {
        const { getInvestorPeopleByOrg } = await import("./services/airtable");
        const orgPeople = await getInvestorPeopleByOrg(item.investorAirtableId);
        const contactBelongsToOrg = orgPeople.some(p => p.id === contactPersonId);
        if (!contactBelongsToOrg) {
          return res.status(400).json({ message: "Selected contact does not belong to this investor organisation" });
        }
      }

      await storage.updateIntroductionItemStatus(itemId, "approved", adminNote, req.user.claims.sub, responseToken);

      await db.update(introductionItems).set({
        investorEmail,
        responseToken,
        deckViewToken,
        contactPersonId: contactPersonId || null,
        contactPersonName: contactPersonName || null,
      }).where(eq(introductionItems.id, itemId));

      const [request] = await db.select().from(introductionRequests).where(eq(introductionRequests.id, item.requestId));

      const adminFirstName = req.user.firstName
        || (req.user.name ? (req.user.name as string).split(" ")[0] : undefined)
        || (req.user.email || "").split("@")[0]
        || "Team";

      const slideDeckUrl = (request?.startupData as any)?.slideDeckUrl
        || (request?.fundingRoundData as any)?.pitchDeckLink
        || null;

      const INBOUND_DOMAIN = "hub.undaunted-hq.org";
      const inboundCcAddress = `intro-track+${itemId}@${INBOUND_DOMAIN}`;

      const baseUrl = process.env.NODE_ENV === 'production' || process.env.WEB_REPL_RENEWAL
        ? "https://hub.undaunted-hq.org"
        : process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://localhost:5000";

      const deckViewUrl = slideDeckUrl ? `${baseUrl}/api/deck/view/${deckViewToken}` : undefined;

      if (sendMethod === "mailto") {
        const startupName = request?.startupData?.startupName || request?.startupData?.name || "A Startup";
        const roundStage = request?.fundingRoundData?.roundStage || "Seed";
        const subject = `Introduction: ${startupName} — ${roundStage} Round`;
        const confirmUrl = `${baseUrl}/introductions/confirm/${responseToken}`;
        const declineUrl = `${baseUrl}/introductions/decline/${responseToken}`;

        if (item.airtableRecordId) {
          const adminName = [req.user.firstName, req.user.lastName].filter(Boolean).join(" ") || req.user.email || "Admin";
          (async () => {
            try {
              const { updateIntroTrackerRecord } = await import("./services/airtable");
              const updateData: { status: "Intro made"; introducedBy: string; introducedToPersonIds?: string[] } = {
                status: "Intro made",
                introducedBy: adminName,
              };
              if (contactPersonId) {
                updateData.introducedToPersonIds = [contactPersonId];
              }
              await updateIntroTrackerRecord(item.airtableRecordId!, updateData);
            } catch (syncErr) {
              console.error(`Airtable intro tracker approve sync failed for item ${itemId}:`, syncErr);
            }
          })();
        }

        const updated = await storage.getIntroductionRequest(item.requestId);
        return res.json({
          ...updated,
          mailto: {
            responseToken,
            inboundCcAddress,
            subject,
            confirmUrl,
            declineUrl,
            deckViewUrl,
            adminFirstName,
          },
        });
      }

      try {
        const { sendInvestorIntroEmail } = await import("./services/email");
        console.log(`Sending intro email to ${investorEmail} for investor ${item.investorName}...`);
        const finalEmailBody = (emailBody || adminNote || "").trim();
        if (!finalEmailBody) {
          return res.status(400).json({ message: "Email body is required" });
        }
        await sendInvestorIntroEmail({
          investorEmail,
          investorName: item.investorName,
          startupData: request?.startupData,
          fundingRoundData: request?.fundingRoundData,
          confirmToken: responseToken,
          declineToken: responseToken,
          emailBody: finalEmailBody,
          adminFirstName,
          deckViewUrl,
        });
        console.log(`Intro email sent successfully to ${investorEmail}`);
        await storage.updateIntroductionItemStatus(itemId, "email_sent");
      } catch (emailErr: any) {
        console.error("Failed to send investor email:", emailErr?.message || emailErr);
        console.error("Email error details:", JSON.stringify(emailErr, null, 2));
      }

      if (item.airtableRecordId) {
        const adminName = [req.user.firstName, req.user.lastName].filter(Boolean).join(" ") || req.user.email || "Admin";
        (async () => {
          try {
            const { updateIntroTrackerRecord } = await import("./services/airtable");
            const updateData: { status: "Intro made"; introducedBy: string; introducedToPersonIds?: string[] } = {
              status: "Intro made",
              introducedBy: adminName,
            };
            if (contactPersonId) {
              updateData.introducedToPersonIds = [contactPersonId];
            }
            await updateIntroTrackerRecord(item.airtableRecordId!, updateData);
          } catch (syncErr) {
            console.error(`Airtable intro tracker approve sync failed for item ${itemId}:`, syncErr);
          }
        })();
      }

      const updated = await storage.getIntroductionRequest(item.requestId);
      res.json(updated);
    } catch (err: any) {
      console.error("Approve error:", err);
      res.status(500).json({ message: "Failed to approve introduction" });
    }
  });

  app.post("/api/admin/introductions/:itemId/reject", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const allowed = await storage.isInvestorAdmin(userId);
      if (!allowed) return res.status(403).json({ message: "Unauthorised" });

      const itemId = parseInt(req.params.itemId);
      const { adminNote } = api.admin.introductions.reject.input.parse(req.body);

      await storage.updateIntroductionItemStatus(itemId, "rejected", adminNote || undefined, req.user.claims.sub);

      const [item] = await db.select().from(introductionItems).where(eq(introductionItems.id, itemId));
      if (item) {
        if (item.airtableRecordId) {
          (async () => {
            try {
              const { updateIntroTrackerRecord } = await import("./services/airtable");
              await updateIntroTrackerRecord(item.airtableRecordId!, { status: "Intro declined" });
            } catch (syncErr) {
              console.error(`Airtable intro tracker reject sync failed for item ${itemId}:`, syncErr);
            }
          })();
        }
        const updated = await storage.getIntroductionRequest(item.requestId);
        res.json(updated);
      } else {
        res.json({ success: true });
      }
    } catch (err: any) {
      console.error("Reject error:", err);
      res.status(500).json({ message: "Failed to reject introduction" });
    }
  });

  app.post("/api/admin/introductions/:itemId/no-connection", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const allowed = await storage.isInvestorAdmin(userId);
      if (!allowed) return res.status(403).json({ message: "Unauthorised" });

      const itemId = parseInt(req.params.itemId);
      const { adminNote } = api.admin.introductions.noConnection.input.parse(req.body);

      const [item] = await db.select().from(introductionItems).where(eq(introductionItems.id, itemId));
      if (!item) return res.status(404).json({ message: "Introduction item not found" });
      if (item.status !== "pending") return res.status(409).json({ message: "Can only vote on pending items" });

      await storage.addIntroductionItemVote(itemId, userId, "no_connection");

      const votes = await storage.getIntroductionItemVotes(itemId);
      const noConnectionVotes = votes.filter((v: any) => v.vote === "no_connection");
      const totalInvestorAdmins = await storage.countInvestorAdmins();

      if (totalInvestorAdmins > 0 && noConnectionVotes.length >= totalInvestorAdmins) {
        await storage.updateIntroductionItemStatus(itemId, "rejected", adminNote || "Auto-rejected: no admin connections", userId);
        if (item.airtableRecordId) {
          (async () => {
            try {
              const { updateIntroTrackerRecord } = await import("./services/airtable");
              await updateIntroTrackerRecord(item.airtableRecordId!, { status: "Intro declined" });
            } catch (syncErr) {
              console.error(`Airtable intro tracker no-connection reject sync failed for item ${itemId}:`, syncErr);
            }
          })();
        }
      }

      const updated = await storage.getIntroductionRequest(item.requestId);
      const allVotes = await storage.getIntroductionItemVotes(itemId);
      res.json({ ...updated, votes: allVotes, totalInvestorAdmins });
    } catch (err: any) {
      console.error("No connection vote error:", err);
      res.status(500).json({ message: "Failed to record no-connection vote" });
    }
  });

  app.post("/api/admin/introductions/:itemId/personal-intro", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const allowed = await storage.isInvestorAdmin(userId);
      if (!allowed) return res.status(403).json({ message: "Unauthorised" });

      const itemId = parseInt(req.params.itemId);
      const { adminNote } = api.admin.introductions.personalIntro.input.parse(req.body);

      const [item] = await db.select().from(introductionItems).where(eq(introductionItems.id, itemId));
      if (!item) return res.status(404).json({ message: "Introduction item not found" });
      if (item.status !== "pending") return res.status(409).json({ message: "Can only mark pending items as personal intro" });

      await storage.updateIntroductionItemStatus(itemId, "personal_intro", adminNote || undefined, userId);

      if (item.airtableRecordId) {
        const adminName = [req.user.firstName, req.user.lastName].filter(Boolean).join(" ") || req.user.email || "Admin";
        (async () => {
          try {
            const { updateIntroTrackerRecord } = await import("./services/airtable");
            await updateIntroTrackerRecord(item.airtableRecordId!, {
              status: "Intro made",
              introducedBy: adminName,
            });
          } catch (syncErr) {
            console.error(`Airtable intro tracker personal-intro sync failed for item ${itemId}:`, syncErr);
          }
        })();
      }

      const updated = await storage.getIntroductionRequest(item.requestId);
      res.json(updated);
    } catch (err: any) {
      console.error("Personal intro error:", err);
      res.status(500).json({ message: "Failed to record personal intro" });
    }
  });

  app.get("/api/admin/introductions/:itemId/votes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const allowed = await storage.isInvestorAdmin(userId);
      if (!allowed) return res.status(403).json({ message: "Unauthorised" });

      const itemId = parseInt(req.params.itemId);
      const votes = await storage.getIntroductionItemVotes(itemId);
      const totalInvestorAdmins = await storage.countInvestorAdmins();
      res.json({ votes, totalInvestorAdmins });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch votes" });
    }
  });

  // Admin matching config routes
  app.get("/api/admin/matching/config", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const allowed = await storage.isInvestorAdmin(userId);
      if (!allowed) return res.status(403).json({ message: "Unauthorised" });
      const config = await storage.getMatchingConfig();
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch matching config" });
    }
  });

  app.put("/api/admin/matching/config", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const allowed = await storage.isInvestorAdmin(userId);
      if (!allowed) return res.status(403).json({ message: "Unauthorised" });
      const config = req.body;
      if (config.weights) {
        const sum = Object.values(config.weights).reduce((a: number, b: any) => a + Number(b), 0);
        if (Math.abs(sum - 1.0) > 0.01) {
          return res.status(400).json({ message: `Weights must sum to 1.0 (currently ${sum.toFixed(3)})` });
        }
      }
      await storage.updateMatchingConfig(config);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update matching config" });
    }
  });

  app.get("/api/admin/matching/feedback-insights", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const allowed = await storage.isInvestorAdmin(userId);
      if (!allowed) return res.status(403).json({ message: "Unauthorised" });
      const insights = await storage.getFeedbackInsights();
      res.json(insights);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch feedback insights" });
    }
  });

  app.post("/api/admin/matching/analyze-feedback", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const allowed = await storage.isInvestorAdmin(userId);
      if (!allowed) return res.status(403).json({ message: "Unauthorised" });

      const allFeedback = await storage.getAllMatchFeedback();
      if (allFeedback.length === 0) {
        return res.json({ insights: [], feedbackCount: 0, message: "No feedback data available to analyse" });
      }

      const { analyzeFeedback } = await import("./services/feedback-analysis");
      const insights = await analyzeFeedback(allFeedback);
      const saved = await storage.saveFeedbackInsights(insights, allFeedback.length, userId);
      res.json(saved);
    } catch (err: any) {
      console.error("Feedback analysis error:", err);
      res.status(500).json({ message: "Failed to analyse feedback: " + (err.message || "Unknown error") });
    }
  });

  app.get("/api/admin/matching/feedback-stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const allowed = await storage.isInvestorAdmin(userId);
      if (!allowed) return res.status(403).json({ message: "Unauthorised" });
      const allFeedback = await storage.getAllMatchFeedback();
      const upvotes = allFeedback.filter(f => f.rating === "up");
      const downvotes = allFeedback.filter(f => f.rating === "down");
      const withReasons = allFeedback.filter(f => f.reason);
      res.json({
        total: allFeedback.length,
        upvotes: upvotes.length,
        downvotes: downvotes.length,
        withReasons: withReasons.length,
        upvotesWithReasons: upvotes.filter(f => f.reason).length,
        downvotesWithReasons: downvotes.filter(f => f.reason).length,
      });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch feedback stats" });
    }
  });

  app.get("/api/admin/matching/feedback-entries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const allowed = await storage.isInvestorAdmin(userId);
      if (!allowed) return res.status(403).json({ message: "Unauthorised" });
      const allFeedback = await storage.getAllMatchFeedback();
      const withReasons = allFeedback
        .filter(f => f.reason)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      res.json(withReasons);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch feedback entries" });
    }
  });

  app.get("/api/deck/view/:token", async (req, res) => {
    try {
      const token = req.params.token;
      const [item] = await db.select().from(introductionItems).where(eq(introductionItems.deckViewToken, token));
      if (!item) return res.status(404).send("Link not found");

      const [request] = await db.select().from(introductionRequests).where(eq(introductionRequests.id, item.requestId));
      const slideDeckUrl = (request?.startupData as any)?.slideDeckUrl
        || (request?.fundingRoundData as any)?.pitchDeckLink
        || null;

      if (!slideDeckUrl) return res.status(404).send("Deck not available");

      const viewerIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || undefined;
      const userAgent = req.headers["user-agent"] || undefined;
      await storage.recordDeckView(item.id, viewerIp, userAgent);

      console.log(`[DeckView] Item ${item.id} deck viewed from ${viewerIp}`);
      res.redirect(slideDeckUrl);
    } catch (err: any) {
      console.error("Deck view error:", err);
      res.status(500).send("Error");
    }
  });

  // Public investor response routes (no auth)
  app.get("/api/introductions/respond/:token", async (req, res) => {
    try {
      const token = req.params.token;
      const item = await storage.getIntroductionItemByToken(token);
      if (!item) return res.status(404).json({ message: "Invalid or expired link" });
      if (item.status === "confirmed") return res.json({ alreadyResponded: true, status: "confirmed" });

      await storage.updateIntroductionItemByToken(token, "confirmed");

      try {
        const user = await storage.getUser(item.request.userId);
        if (user?.email && item.investorEmail) {
          const { sendIntroductionConnectEmail } = await import("./services/email");
          const founderName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Founder";
          const startupName = (item.request.startupData as any)?.startupName || "your startup";
          await sendIntroductionConnectEmail({
            founderEmail: user.email,
            founderName,
            investorEmail: item.investorEmail,
            investorName: item.investorName,
            startupName,
            startupData: item.request.startupData,
          });
        }
      } catch (emailErr) {
        console.error("Failed to send introduction email:", emailErr);
      }

      res.json({ success: true, status: "confirmed", investorName: item.investorName });
    } catch (err: any) {
      console.error("Respond error:", err);
      res.status(500).json({ message: "Failed to process response" });
    }
  });

  app.get("/api/introductions/decline/:token", async (req, res) => {
    try {
      const token = req.params.token;
      const item = await storage.getIntroductionItemByToken(token);
      if (!item) return res.status(404).json({ message: "Invalid or expired link" });
      if (item.status === "denied") return res.json({ alreadyResponded: true, status: "denied" });

      await storage.updateIntroductionItemByToken(token, "denied");

      try {
        const user = await storage.getUser(item.request.userId);
        if (user?.email) {
          const { sendFounderNotificationEmail } = await import("./services/email");
          const founderName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Founder";
          const startupName = (item.request.startupData as any)?.startupName || "your startup";
          await sendFounderNotificationEmail(user.email, founderName, item.investorName, "denied", startupName);
        }
      } catch (emailErr) {
        console.error("Failed to notify founder of decline:", emailErr);
      }

      if (item.airtableRecordId) {
        (async () => {
          try {
            const { updateIntroTrackerRecord } = await import("./services/airtable");
            await updateIntroTrackerRecord(item.airtableRecordId!, { status: "Intro declined" });
          } catch (syncErr) {
            console.error(`Airtable intro tracker decline sync failed:`, syncErr);
          }
        })();
      }

      res.json({ success: true, status: "denied", investorName: item.investorName });
    } catch (err: any) {
      console.error("Decline error:", err);
      res.status(500).json({ message: "Failed to process response" });
    }
  });

  // Admin user management routes
  app.get(api.admin.users.list.path, isAuthenticated, async (req: any, res) => {
    const isAdmin = await storage.isUserAdmin(req.user.claims.sub);
    if (!isAdmin) return res.status(403).json({ message: "Unauthorised" });
    const admins = await storage.getAdminUsers();
    res.json(admins);
  });

  app.patch("/api/admin/users/:id/role", isAuthenticated, async (req: any, res) => {
    try {
      const isAdmin = await storage.isUserAdmin(req.user.claims.sub);
      if (!isAdmin) return res.status(403).json({ message: "Unauthorised" });
      const { adminRole } = api.admin.users.updateRole.input.parse(req.body);
      const updated = await storage.updateUserAdminRole(req.params.id, adminRole);
      if (!updated) return res.status(404).json({ message: "User not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.post(api.chat.tts.path, isAuthenticated, async (req: any, res) => {
    try {
      const { text } = api.chat.tts.input.parse(req.body);
      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice: "nova",
        input: text,
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      res.setHeader("Content-Type", "audio/mpeg");
      res.send(buffer);
    } catch (err: any) {
      console.error("TTS error:", err);
      res.status(500).json({ message: "TTS error: " + (err.message || "Unknown error") });
    }
  });

  app.post(api.chat.stt.path, isAuthenticated, upload.single("audio"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      const file = new File([req.file.buffer], req.file.originalname || "audio.webm", {
        type: req.file.mimetype || "audio/webm",
      });

      const transcription = await openai.audio.transcriptions.create({
        model: "gpt-4o-mini-transcribe",
        file: file,
        response_format: "json",
      });

      res.json({ text: transcription.text });
    } catch (err: any) {
      console.error("STT error:", err);
      res.status(500).json({ message: "STT error: " + (err.message || "Unknown error") });
    }
  });

  // --- CSV Import ---

  app.post("/api/admin/import-csv", isAuthenticated, isAdmin, upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No CSV file provided" });
      }
      const { parseCSVBuffer } = await import("./services/csv-import");
      const rows = parseCSVBuffer(req.file.buffer);
      const existingStartups = await storage.getAllStartupsWithMembers();
      const existingNames = new Set(existingStartups.map((s: any) => s.name.toLowerCase()));

      const seenInFile = new Map<string, number>();
      const preview = rows.map((row, idx) => {
        const nameLower = row.startupName.toLowerCase();
        const intraFileDuplicate = seenInFile.has(nameLower);
        seenInFile.set(nameLower, idx);
        const warnings = [...(row.warnings || [])];
        if (intraFileDuplicate) warnings.push("Duplicate within CSV file");
        return {
          ...row,
          warnings,
          name: row.startupName,
          isDuplicate: existingNames.has(nameLower) || intraFileDuplicate,
        };
      });

      res.json({ rows: preview, totalRows: preview.length });
    } catch (err: any) {
      console.error("CSV parse error:", err);
      res.status(500).json({ message: "Failed to parse CSV: " + (err.message || "Unknown error") });
    }
  });

  app.post("/api/admin/import-csv/confirm", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { rows, programmeId, cohortId } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "rows array required" });
      }
      for (const row of rows) {
        if (typeof row !== "object" || row === null) {
          return res.status(400).json({ message: "Each row must be an object" });
        }
        if (row.founderEmail && typeof row.founderEmail === "string") {
          const emailTrimmed = row.founderEmail.trim();
          if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
            return res.status(400).json({ message: `Invalid email format: ${emailTrimmed}` });
          }
        }
      }
      const userId = req.user.claims.sub;
      const { buildToolPrePopulation } = await import("./services/csv-import");

      const useAICapTable = req.body.useAICapTable === true;
      let parseCapTableWithAI: ((raw: string) => Promise<Array<{ name: string; role: string; equityPercent: string; linkedIn: string }>>) | null = null;
      if (useAICapTable) {
        const mod = await import("./services/airtable-import");
        parseCapTableWithAI = mod.parseCapTableWithAI;
      }

      for (const row of rows) {
        if (useAICapTable && parseCapTableWithAI && row.capTableRaw) {
          try {
            row.capTable = await parseCapTableWithAI(row.capTableRaw);
          } catch (e) {
            console.error("AI cap table parsing failed for row:", row.startupName, e);
          }
        }
      }

      const existingStartups = await storage.getAllStartupsWithMembers();
      const existingNames = new Set(existingStartups.map((s: any) => s.name.toLowerCase()));

      const created: any[] = [];
      const skippedDuplicates: string[] = [];
      for (const row of rows) {
        if (!row.startupName) continue;
        if (existingNames.has(row.startupName.toLowerCase())) {
          skippedDuplicates.push(row.startupName);
          continue;
        }
        existingNames.add(row.startupName.toLowerCase());

        const newStartup = await storage.createStartup(userId, {
          name: row.startupName,
          description: row.oneSentenceDescription || null,
          websiteUrl: row.websiteUrl || null,
          climateProblem: row.climateProblem || null,
          solutionDescription: row.solutionDescription || null,
          climateType: row.climateType || null,
          productType: row.productType || null,
          businessModel: row.businessModel || null,
          targetMarket: row.targetMarket || null,
          competitors: row.competitors || null,
          status: "draft",
          oneSentenceDescription: row.oneSentenceDescription || null,
          ventureStatus: row.ventureStatus || null,
          revenue: row.revenue || null,
          climateSectors: row.climateSectors || [],
          impactMetrics: row.impactMetrics || {},
          technologyCategories: row.technologyCategories || [],
          technologyDescription: row.technologyDescription || null,
          trl: row.trl || null,
          ipStatus: row.ipStatus || null,
          teamStrengths: row.teamStrengths || null,
          capTable: row.capTable || [],
          otherTeamMembers: row.otherTeamMembers || [],
          founderFirstName: row.founderFirstName || null,
          founderLastName: row.founderLastName || null,
          founderEmail: row.founderEmail || null,
          founderPhone: row.founderPhone || null,
          founderCommitment: row.founderCommitment || null,
          foundersDream: row.foundersDream || null,
          programmeFocus: row.programmeFocus || null,
          programmeGoals: row.programmeGoals || null,
          totalFundingRaised: row.totalFundingRaised || null,
          nonDilutiveFunding: row.nonDilutiveFunding || null,
          referralSource: row.referralSource || null,
          submittedAt: row.submittedAt || null,
          ukBased: row.ukBased || null,
          incorporated: row.incorporated || null,
          crn: row.crn || null,
          incorporationDate: row.incorporationDate || null,
          incorporationPlans: row.incorporationPlans || null,
          universitySpinout: row.universitySpinout || null,
          imperialConnection: row.imperialConnection || null,
          imperialConnectionType: row.imperialConnectionType || null,
          diversityInfo: {
            founders: row.diversityFounders || "",
            business: row.diversityBusiness || "",
          },
          slideDeckUrl: row.slideDeckUrl || null,
          onlineDemoUrl: row.onlineDemoUrl || null,
          marketDemandEvidence: row.marketDemandEvidence || null,
          customerProblem: row.customerProblem || null,
          problemImpact: row.problemImpact || null,
          commercialAvailabilityPlan: row.commercialAvailabilityPlan || null,
          supportReceived: row.supportReceived || null,
          previousProgrammes: row.previousProgrammes || null,
          greenhouseSupportBenefits: row.greenhouseSupportBenefits || null,
          programmeAppliedTo: row.programmeAppliedTo || null,
          airtableRecordId: row.airtableRecordId || null,
        }, true);

        if (programmeId) {
          try {
            await storage.addStartupToProgramme(Number(programmeId), newStartup.id);
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "";
            if (!msg.includes("duplicate")) console.error("Programme assignment failed:", e);
          }
        }

        if (cohortId) {
          try {
            await storage.addStartupToCohort(newStartup.id, Number(cohortId));
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "";
            if (!msg.includes("duplicate")) console.error("Cohort assignment failed:", e);
          }
        }

        if (programmeId) {
          try {
            const allModules = await storage.getModules();
            const coreModules = allModules.filter(m => m.kthDimension !== "INV");
            for (const mod of coreModules) {
              await storage.grantModuleAccess(newStartup.id, mod.id, userId);
            }
          } catch (e: unknown) {
            console.error("Module access grant failed:", e);
          }
        }

        const effectiveProgrammeId = programmeId ? Number(programmeId) : null;

        if (row.founderEmail) {
          const normalizedEmail = row.founderEmail.trim().toLowerCase();
          if (effectiveProgrammeId) {
            try {
              const token = crypto.randomBytes(32).toString("hex");
              await storage.createInvitation({
                email: normalizedEmail,
                startupId: newStartup.id,
                programmeId: effectiveProgrammeId,
                token,
                invitedById: userId,
              });
            } catch (e: unknown) {
              console.error("Founder placeholder invitation failed:", e);
            }
          }
        }

        if (row.founders && Array.isArray(row.founders) && effectiveProgrammeId) {
          for (const founder of row.founders) {
            if (!founder.selected || !founder.email) continue;
            const founderEmail = founder.email.trim().toLowerCase();
            try {
              const token = crypto.randomBytes(32).toString("hex");
              await storage.createInvitation({
                email: founderEmail,
                startupId: newStartup.id,
                programmeId: effectiveProgrammeId,
                token,
                invitedById: userId,
              });
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : "";
              if (!msg.includes("duplicate")) console.error("Founder invitation failed:", e);
            }
          }
        }

        const toolData = buildToolPrePopulation(row);
        for (const [toolId, data] of Object.entries(toolData)) {
          if (Object.keys(data as Record<string, unknown>).length > 0) {
            try {
              await storage.saveToolEntry(newStartup.id, Number(toolId), data as Record<string, unknown>, userId);
            } catch (e: unknown) {
              console.error(`Tool pre-population failed for tool ${toolId}:`, e);
            }
          }
        }

        created.push({ id: newStartup.id, name: newStartup.name });
      }

      const warnings: string[] = [];
      if (created.length > 0 && !programmeId) {
        warnings.push("No programme selected — founder placeholder invitations were not created. Assign a programme before confirming.");
      }
      if (skippedDuplicates.length > 0) {
        warnings.push(`Skipped ${skippedDuplicates.length} duplicate(s): ${skippedDuplicates.join(", ")}`);
      }
      res.status(201).json({
        created,
        count: created.length,
        skippedDuplicates: skippedDuplicates.length,
        warning: warnings.length > 0 ? warnings.join(" ") : undefined,
      });
    } catch (err: any) {
      console.error("CSV confirm error:", err);
      res.status(500).json({ message: "Failed to import startups: " + (err.message || "Unknown error") });
    }
  });

  // --- Airtable Import ---

  app.get("/api/admin/airtable-import/tables", isAuthenticated, isAdmin, async (_req: any, res) => {
    try {
      const { fetchTableMetadata, getConfiguredTableId } = await import("./services/airtable-import");
      const tables = await fetchTableMetadata();
      const configuredTableId = getConfiguredTableId();
      const result = tables.map(t => ({ id: t.id, name: t.name }));
      res.json({ tables: result, configuredTableId: configuredTableId || null });
    } catch (err: any) {
      console.error("Airtable tables fetch error:", err);
      res.status(500).json({ message: "Failed to fetch Airtable tables: " + (err.message || "Unknown error") });
    }
  });

  app.get("/api/admin/airtable-import/views", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { fetchTableMetadata, getFirstTableId } = await import("./services/airtable-import");
      const requestedTableId = req.query.tableId as string | undefined;
      if (requestedTableId && typeof requestedTableId !== "string") {
        return res.status(400).json({ message: "tableId must be a string" });
      }
      const tableId = requestedTableId || await getFirstTableId();
      const tables = await fetchTableMetadata();
      const table = tables.find(t => t.id === tableId);
      if (!table) {
        return res.status(404).json({ message: "Table not found" });
      }
      const views = table.views.map(v => ({ id: v.id, name: v.name, type: v.type }));
      const fields = table.fields.map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        options: f.options,
      }));
      res.json({ tableId, tableName: table.name, views, fields });
    } catch (err: any) {
      console.error("Airtable views fetch error:", err);
      res.status(500).json({ message: "Failed to fetch Airtable views: " + (err.message || "Unknown error") });
    }
  });

  app.post("/api/admin/airtable-import/preview", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { viewId, tableId: reqTableId } = req.body;
      if (!viewId || typeof viewId !== "string") {
        return res.status(400).json({ message: "viewId is required and must be a string" });
      }
      if (reqTableId && typeof reqTableId !== "string") {
        return res.status(400).json({ message: "tableId must be a string" });
      }

      const { fetchRecordsFromView, fetchFieldsForTable, mapRecordsToStartupRows, getFirstTableId } = await import("./services/airtable-import");
      const tableId = reqTableId || await getFirstTableId();
      const fields = await fetchFieldsForTable(tableId);
      const records = await fetchRecordsFromView(tableId, viewId);
      const { rows, fieldTypes } = await mapRecordsToStartupRows(records, fields);

      const existingStartups = await storage.getAllStartupsWithMembers();
      const existingNames = new Set(existingStartups.map((s: any) => s.name.toLowerCase()));

      const seenInFile = new Map<string, number>();
      const preview = rows.map((row, idx) => {
        const nameLower = row.startupName.toLowerCase();
        const intraFileDuplicate = seenInFile.has(nameLower);
        seenInFile.set(nameLower, idx);
        const warnings = [...(row.warnings || [])];
        if (intraFileDuplicate) warnings.push("Duplicate within import");
        return {
          ...row,
          warnings,
          name: row.startupName,
          isDuplicate: existingNames.has(nameLower) || intraFileDuplicate,
        };
      });

      res.json({ rows: preview, totalRows: preview.length, fieldTypes });
    } catch (err: any) {
      console.error("Airtable preview error:", err);
      res.status(500).json({ message: "Failed to preview Airtable data: " + (err.message || "Unknown error") });
    }
  });

  app.post("/api/admin/airtable-import/founders", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { companyRecordIds } = req.body;
      if (!Array.isArray(companyRecordIds) || companyRecordIds.length === 0) {
        return res.status(400).json({ message: "companyRecordIds array required" });
      }
      const { fetchFoundersForCompanies } = await import("./services/airtable-import");
      const founders = await fetchFoundersForCompanies(companyRecordIds);
      res.json({ founders });
    } catch (err: any) {
      console.error("Airtable founders fetch error:", err);
      res.status(500).json({ message: "Failed to fetch founders: " + (err.message || "Unknown error") });
    }
  });

  app.get("/api/startups/:id/profile", isAuthenticated, async (req: any, res) => {
    try {
      const startupId = Number(req.params.id);
      const userId = req.user.claims.sub;
      const isAdminUser = await storage.isUserAdmin(userId);
      const isMember = await storage.isStartupMember(userId, startupId);
      if (!isAdminUser && !isMember) {
        return res.status(403).json({ message: "Access denied" });
      }
      const startup = await storage.getStartup(startupId);
      if (!startup) return res.status(404).json({ message: "Startup not found" });

      const members = await db.select().from(startupMembers).where(eq(startupMembers.startupId, startupId));
      const programmes = await storage.getProgrammesForStartup(startupId);

      res.json({ ...startup, members, programmes });
    } catch (err: any) {
      console.error("Profile fetch error:", err);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  async function syncProfileToTools(startupId: number, startupData: Record<string, unknown>, userId: string) {
    const syncOps: Array<{ toolId: number; field: string; value: unknown; merge?: boolean }> = [];

    function hasValue(v: unknown): v is string {
      return v != null && typeof v === "string" && v.trim() !== "";
    }

    if (hasValue(startupData.slideDeckUrl)) syncOps.push({ toolId: 3, field: "slideDeckUrl", value: startupData.slideDeckUrl });
    if (hasValue(startupData.oneSentenceDescription)) syncOps.push({ toolId: 3, field: "companyPurpose", value: startupData.oneSentenceDescription });
    const problemVal = startupData.customerProblem || startupData.climateProblem;
    if (hasValue(problemVal)) {
      syncOps.push({ toolId: 1, field: "problem", value: problemVal });
      syncOps.push({ toolId: 3, field: "problem", value: problemVal });
    }
    if (hasValue(startupData.solutionDescription)) {
      syncOps.push({ toolId: 1, field: "solution", value: startupData.solutionDescription });
      syncOps.push({ toolId: 3, field: "solution", value: startupData.solutionDescription });
    }
    if (hasValue(startupData.targetMarket)) {
      syncOps.push({ toolId: 1, field: "customerSegments", value: startupData.targetMarket });
      syncOps.push({ toolId: 3, field: "marketSize", value: startupData.targetMarket });
    }
    if (hasValue(startupData.businessModel)) {
      syncOps.push({ toolId: 1, field: "revenueStreams", value: startupData.businessModel });
      syncOps.push({ toolId: 1, field: "costStructure", value: startupData.businessModel });
      syncOps.push({ toolId: 3, field: "businessModel", value: startupData.businessModel });
    }
    if (hasValue(startupData.ipStatus)) {
      syncOps.push({ toolId: 1, field: "unfairAdvantage", value: startupData.ipStatus });
      syncOps.push({ toolId: 9, field: "ipAssets", value: [{
        id: "profile-ip-1", name: "Primary IP", type: "Patent",
        status: startupData.ipStatus, description: String(startupData.ipStatus),
      }] });
    }
    if (hasValue(startupData.technologyDescription)) syncOps.push({ toolId: 3, field: "product", value: startupData.technologyDescription });
    if (hasValue(startupData.competitors)) {
      syncOps.push({ toolId: 3, field: "competition", value: startupData.competitors });
      const lines = String(startupData.competitors).split("\n").filter(l => l.trim());
      if (lines.length > 0) {
        syncOps.push({ toolId: 6, field: "competitors", value: lines.map((line, i) => ({
          id: `profile-${i}`, name: line.trim(), strengths: "", weaknesses: "", technologyApproach: "",
        })) });
      }
    }
    if (hasValue(startupData.teamStrengths)) syncOps.push({ toolId: 3, field: "team", value: startupData.teamStrengths });
    if (hasValue(startupData.totalFundingRaised)) {
      syncOps.push({ toolId: 3, field: "financials", value: `Total Funding Raised: ${startupData.totalFundingRaised}` });
      syncOps.push({ toolId: 12, field: "capitalNeeds", value: { totalRaised: String(startupData.totalFundingRaised) } });
    }
    if (hasValue(startupData.nonDilutiveFunding)) {
      syncOps.push({ toolId: 12, field: "nonDilutive", value: startupData.nonDilutiveFunding });
    }

    let fullStartup: Record<string, unknown> = startupData;
    const founderFirst = startupData.founderFirstName;
    const founderLast = startupData.founderLastName;
    const hasTeamUpdate = (founderFirst != null && founderFirst !== "") || (founderLast != null && founderLast !== "") ||
      (startupData.capTable != null && Array.isArray(startupData.capTable) && (startupData.capTable as unknown[]).length > 0) ||
      (startupData.otherTeamMembers != null && Array.isArray(startupData.otherTeamMembers) && (startupData.otherTeamMembers as unknown[]).length > 0);
    if (hasTeamUpdate) {
      try {
        const stored = await storage.getStartup(startupId);
        if (stored) fullStartup = { ...(stored as unknown as Record<string, unknown>), ...startupData };
      } catch { /* use partial data */ }

      const members: Array<{ id: string; name: string; role: string }> = [];
      const fFirst = fullStartup.founderFirstName as string || "";
      const fLast = fullStartup.founderLastName as string || "";
      if (fFirst || fLast) {
        members.push({ id: "founder-1", name: `${fFirst} ${fLast}`.trim(), role: "Founder" });
      }
      const cap = Array.isArray(fullStartup.capTable) ? (fullStartup.capTable as Array<{ name: string; role: string }>) : [];
      for (const m of cap) {
        if (m.name) members.push({ id: `cap-${m.name.replace(/\s/g, "-").toLowerCase()}`, name: m.name, role: m.role || "Team Member" });
      }
      const team = Array.isArray(fullStartup.otherTeamMembers) ? (fullStartup.otherTeamMembers as Array<{ name: string; role: string }>) : [];
      for (const m of team) {
        if (m.name) members.push({ id: `team-${m.name.replace(/\s/g, "-").toLowerCase()}`, name: m.name, role: m.role || "Team Member" });
      }
      if (members.length > 0) {
        syncOps.push({ toolId: 10, field: "members", value: members });
      }
    }

    if (syncOps.length === 0) return;

    const toolUpdates = new Map<number, Record<string, unknown>>();
    for (const op of syncOps) {
      if (!toolUpdates.has(op.toolId)) {
        try {
          const existing = await storage.getToolEntry(startupId, op.toolId);
          toolUpdates.set(op.toolId, (existing?.currentData as Record<string, unknown>) || {});
        } catch {
          toolUpdates.set(op.toolId, {});
        }
      }
      const data = toolUpdates.get(op.toolId)!;
      data[op.field] = op.value;
    }

    for (const [toolId, data] of toolUpdates) {
      try {
        await storage.saveToolEntry(startupId, toolId, data, userId);
      } catch (syncErr: unknown) {
        console.error(`Tool ${toolId} sync failed:`, syncErr);
      }
    }
  }

  function normalizeNumericFields(data: Record<string, unknown>): Record<string, unknown> {
    const numericFields = ["revenue", "totalFundingRaised", "nonDilutiveFunding"];
    for (const field of numericFields) {
      if (data[field] !== undefined && typeof data[field] === "string") {
        const val = data[field] as string;
        const cleaned = val.replace(/[£$€,\s]/g, "").trim().toLowerCase();
        const match = cleaned.match(/^([\d.]+)\s*(k|m|b|million|billion|thousand)?$/);
        if (match) {
          const num = parseFloat(match[1]);
          if (!isNaN(num)) {
            let multiplier = 1;
            const suffix = match[2];
            if (suffix === "k" || suffix === "thousand") multiplier = 1000;
            else if (suffix === "m" || suffix === "million") multiplier = 1000000;
            else if (suffix === "b" || suffix === "billion") multiplier = 1000000000;
            data[field] = String(Math.round(num * multiplier));
          }
        } else {
          const plain = parseFloat(cleaned);
          if (!isNaN(plain)) data[field] = String(Math.round(plain));
        }
      }
    }
    return data;
  }

  app.patch("/api/admin/startups/:id/profile", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const startupId = Number(req.params.id);
      const userId = req.user.claims.sub;
      const updates = normalizeNumericFields(req.body);
      delete updates.id;
      delete updates.createdAt;
      delete updates.createdById;
      updates.updatedAt = new Date();
      const updated = await storage.updateStartup(startupId, updates);
      if (!updated) return res.status(404).json({ message: "Startup not found" });
      await syncProfileToTools(startupId, updates, userId);
      res.json(updated);
    } catch (err: any) {
      console.error("Profile update error:", err);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.post("/api/admin/startups/:id/confirm", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const startupId = Number(req.params.id);
      const startup = await storage.getStartup(startupId);
      if (!startup) return res.status(404).json({ message: "Startup not found" });
      if (startup.status !== "draft") {
        return res.status(400).json({ message: "Startup is already active" });
      }

      const sendInvite = req.body.sendInvite !== false;

      const updated = await storage.updateStartup(startupId, { status: "active", updatedAt: new Date() });

      const confirmUserId = req.user.claims.sub;
      try {
        await syncProfileToTools(startupId, startup as unknown as Record<string, unknown>, confirmUserId);
      } catch (syncErr: unknown) {
        console.error("Tool sync on confirm failed:", syncErr);
      }

      let invitationsSent = 0;
      if (sendInvite) {
        const pendingInvitations = await storage.getPendingInvitationsForStartup(startupId);

        if (startup.founderEmail) {
          const normalizedFounderEmail = startup.founderEmail.trim().toLowerCase();
          const existingInvitation = await storage.getInvitationByStartupAndEmail(startupId, normalizedFounderEmail);
          if (!existingInvitation) {
            const startupProgs = await storage.getProgrammesForStartup(startupId);
            const programme = startupProgs[0];
            if (programme) {
              const token = crypto.randomBytes(32).toString("hex");
              const newInvitation = await storage.createInvitation({
                email: normalizedFounderEmail,
                startupId,
                programmeId: programme.id,
                token,
                invitedById: confirmUserId,
              });
              pendingInvitations.push(newInvitation);
            }
          }
        }

        if (pendingInvitations.length > 0) {
          try {
            const programmeCache = new Map<number, string>();
            for (const inv of pendingInvitations) {
              if (!programmeCache.has(inv.programmeId)) {
                const prog = await storage.getProgramme(inv.programmeId);
                programmeCache.set(inv.programmeId, prog?.name || "Programme");
              }
            }
            const { sendInvitationEmailBatch } = await import("./services/email");
            const baseUrl = req.protocol + "://" + req.get("host");
            const recipients = pendingInvitations.map(inv => ({
              to: inv.email,
              programmeName: programmeCache.get(inv.programmeId) || "Programme",
              companyName: startup.name,
              inviteUrl: `${baseUrl}/invite/${inv.token}`,
            }));
            await sendInvitationEmailBatch(recipients);
            invitationsSent = pendingInvitations.length;
          } catch (emailErr: any) {
            console.error(`Failed to send invitation emails for startup ${startupId}:`, emailErr.message);
          }
        }
      }

      res.json({ ...updated, invitationSent: invitationsSent > 0, invitationsSent });
    } catch (err: any) {
      console.error("Confirm startup error:", err);
      res.status(500).json({ message: "Failed to confirm startup" });
    }
  });

  app.post("/api/admin/startups/bulk-confirm", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "ids must be a non-empty array" });
      }

      const validIds = [...new Set(ids.map(Number).filter(n => Number.isInteger(n) && n > 0))];
      if (validIds.length === 0) {
        return res.status(400).json({ message: "No valid startup IDs provided" });
      }

      const confirmUserId = req.user.claims.sub;
      let approved = 0;
      let invitationsSent = 0;
      const errors: string[] = [];

      for (const startupId of validIds) {
        try {
          const startup = await storage.getStartup(startupId);
          if (!startup) {
            errors.push(`Startup ${startupId} not found`);
            continue;
          }
          if (startup.status !== "draft") {
            errors.push(`${startup.name} is already active`);
            continue;
          }

          await storage.updateStartup(startupId, { status: "active", updatedAt: new Date() });
          approved++;

          try {
            await syncProfileToTools(startupId, startup as unknown as Record<string, unknown>, confirmUserId);
          } catch (syncErr: unknown) {
            console.error("Tool sync on bulk confirm failed:", syncErr);
          }

          const pendingInvitations = await storage.getPendingInvitationsForStartup(startupId);

          if (startup.founderEmail) {
            const normalizedFounderEmail = startup.founderEmail.trim().toLowerCase();
            const existingInvitation = await storage.getInvitationByStartupAndEmail(startupId, normalizedFounderEmail);
            if (!existingInvitation) {
              const startupProgs = await storage.getProgrammesForStartup(startupId);
              const programme = startupProgs[0];
              if (programme) {
                const token = crypto.randomBytes(32).toString("hex");
                const newInvitation = await storage.createInvitation({
                  email: normalizedFounderEmail,
                  startupId,
                  programmeId: programme.id,
                  token,
                  invitedById: confirmUserId,
                });
                pendingInvitations.push(newInvitation);
              }
            }
          }

          if (pendingInvitations.length > 0) {
            try {
              const programmeCache = new Map<number, string>();
              for (const inv of pendingInvitations) {
                if (!programmeCache.has(inv.programmeId)) {
                  const prog = await storage.getProgramme(inv.programmeId);
                  programmeCache.set(inv.programmeId, prog?.name || "Programme");
                }
              }
              const { sendInvitationEmailBatch } = await import("./services/email");
              const baseUrl = req.protocol + "://" + req.get("host");
              const recipients = pendingInvitations.map(inv => ({
                to: inv.email,
                programmeName: programmeCache.get(inv.programmeId) || "Programme",
                companyName: startup.name,
                inviteUrl: `${baseUrl}/invite/${inv.token}`,
              }));
              await sendInvitationEmailBatch(recipients);
              invitationsSent += pendingInvitations.length;
            } catch (emailErr: any) {
              console.error(`Failed to send invitation emails for startup ${startupId}:`, emailErr.message);
            }
          }
        } catch (err: any) {
          errors.push(`Failed to approve startup ${startupId}: ${err.message}`);
        }
      }

      res.json({ approved, invitationsSent, errors });
    } catch (err: any) {
      console.error("Bulk confirm startups error:", err);
      res.status(500).json({ message: "Failed to bulk confirm startups" });
    }
  });

  app.patch("/api/startups/:id/profile", isAuthenticated, async (req: any, res) => {
    try {
      const startupId = Number(req.params.id);
      const userId = req.user.claims.sub;
      const isMember = await storage.isStartupMember(userId, startupId);
      if (!isMember) return res.status(403).json({ message: "Not a member" });
      const updates = normalizeNumericFields(req.body);
      delete updates.id;
      delete updates.createdAt;
      delete updates.createdById;
      delete updates.status;
      delete updates.programmeAppliedTo;
      updates.updatedAt = new Date();
      const updated = await storage.updateStartup(startupId, updates);
      if (!updated) return res.status(404).json({ message: "Startup not found" });
      await syncProfileToTools(startupId, updates, userId);
      res.json(updated);
    } catch (err: any) {
      console.error("Profile update error:", err);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // --- Inline Tool Configs ---

  app.get("/api/inline-tool-configs", isAuthenticated, async (req, res) => {
    try {
      const configs = await storage.getInlineToolConfigs();
      res.json(configs);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch inline tool configs" });
    }
  });

  app.get("/api/inline-tool-configs/by-stable-key/:key", isAuthenticated, async (req, res) => {
    try {
      const config = await storage.getInlineToolConfigByStableKey(req.params.key);
      if (!config) return res.status(404).json({ message: "Not found" });
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch inline tool config" });
    }
  });

  app.get("/api/inline-tool-configs/by-level/:levelId", isAuthenticated, async (req, res) => {
    try {
      const configs = await storage.getInlineToolConfigsByLevel(parseInt(req.params.levelId));
      res.json(configs);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch inline tool configs by level" });
    }
  });

  app.get("/api/inline-tool-configs/by-checklist-item/:id", isAuthenticated, async (req, res) => {
    try {
      const config = await storage.getInlineToolConfigByChecklistItem(parseInt(req.params.id));
      if (!config) return res.json(null);
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch inline tool config" });
    }
  });

  app.get("/api/inline-tool-configs/revision-lock/:startupId/:dataKey", isAuthenticated, async (req: any, res) => {
    try {
      const startupId = parseInt(req.params.startupId);
      const userId = req.user.claims.sub;
      const isMember = await storage.isStartupMember(userId, startupId);
      if (!isMember) return res.status(403).json({ message: "Not a member" });
      const dataKey = req.params.dataKey;
      const configs = await storage.getInlineToolConfigs();
      const configRefs: InlineToolConfigRef[] = configs.map(c => ({
        dataKey: c.dataKey,
        revisionOf: c.revisionOf as { dataKey: string; level: number } | null,
        toolTemplateId: c.toolTemplateId,
      }));
      const matchingConfig = configs.find(c => c.dataKey === dataKey);
      if (!matchingConfig) return res.json({ locked: false, revisionLevel: null });
      const entry = await storage.getToolEntry(startupId, matchingConfig.toolTemplateId);
      if (!entry?.currentData) return res.json({ locked: false, revisionLevel: null });
      const currentData = entry.currentData as Record<string, unknown>;
      const { hasRevision, revisionLevel } = hasRevisionForDataKey(currentData, dataKey, configRefs);
      res.json({ locked: hasRevision, revisionLevel });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to check revision lock" });
    }
  });

  app.get("/api/admin/field-registry", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const configs = await storage.getInlineToolConfigs();
      const templates = await storage.getToolTemplates();
      const templateMap = new Map(templates.map(t => [t.id, t.name]));

      interface RegistryField {
        key: string;
        label: string;
        type: string;
        usageCount: number;
      }
      interface RegistryEntry {
        configId: number;
        configTitle: string;
        stableKey: string;
        toolTemplateId: number;
        toolTemplateName: string;
        dataKey: string;
        sourceType: "inline" | "toolkit";
        layoutType: string;
        fields: RegistryField[];
      }

      const allEntries = await db.select({
        startupId: toolEntries.startupId,
        toolTemplateId: toolEntries.toolTemplateId,
        currentData: toolEntries.currentData,
      }).from(toolEntries);

      const usageStartups = new Map<string, Set<number>>();

      function collectNonEmptyKeys(obj: any): string[] {
        if (!obj || typeof obj !== "object") return [];
        if (Array.isArray(obj)) {
          const keys = new Set<string>();
          for (const item of obj) {
            if (item && typeof item === "object" && !Array.isArray(item)) {
              for (const k of Object.keys(item)) {
                if (item[k] !== null && item[k] !== undefined && item[k] !== "") {
                  keys.add(k);
                }
              }
            }
          }
          return Array.from(keys);
        }
        return Object.keys(obj).filter(k => obj[k] !== null && obj[k] !== undefined && obj[k] !== "");
      }

      const knownRefs = new Set<string>();
      const dataKeysByTemplate = new Map<number, Set<string>>();

      for (const c of configs) {
        const fields = (Array.isArray(c.fieldDefinitions) ? c.fieldDefinitions : []) as Array<{ key: string }>;
        if (!dataKeysByTemplate.has(c.toolTemplateId)) {
          dataKeysByTemplate.set(c.toolTemplateId, new Set());
        }
        dataKeysByTemplate.get(c.toolTemplateId)!.add(c.dataKey);
        for (const f of fields) {
          if (f.key) knownRefs.add(`${c.toolTemplateId}:${c.dataKey}:${f.key}`);
        }
      }

      for (const t of templates) {
        const defs = (Array.isArray(t.fieldDefinitions) ? t.fieldDefinitions : []) as Array<{ id: string }>;
        for (const f of defs) {
          if (f.id) knownRefs.add(`${t.id}:_default:${f.id}`);
        }
      }

      for (const entry of allEntries) {
        const root = entry.currentData as Record<string, any> | null;
        if (!root || typeof root !== "object") continue;

        const templateDataKeys = dataKeysByTemplate.get(entry.toolTemplateId);

        if (templateDataKeys) {
          for (const dk of templateDataKeys) {
            if (dk in root) {
              const nested = root[dk];
              const fieldKeys = collectNonEmptyKeys(nested);
              for (const fk of fieldKeys) {
                const refKey = `${entry.toolTemplateId}:${dk}:${fk}`;
                if (knownRefs.has(refKey)) {
                  if (!usageStartups.has(refKey)) usageStartups.set(refKey, new Set());
                  usageStartups.get(refKey)!.add(entry.startupId);
                }
              }
            }
          }
        }

        const topLevelKeys = collectNonEmptyKeys(root);
        for (const fk of topLevelKeys) {
          const refKey = `${entry.toolTemplateId}:_default:${fk}`;
          if (knownRefs.has(refKey)) {
            if (!usageStartups.has(refKey)) usageStartups.set(refKey, new Set());
            usageStartups.get(refKey)!.add(entry.startupId);
          }
        }
      }

      const inlineEntries: RegistryEntry[] = configs
        .map(c => ({
          configId: c.id,
          configTitle: c.title,
          stableKey: c.stableKey,
          toolTemplateId: c.toolTemplateId,
          toolTemplateName: templateMap.get(c.toolTemplateId) || `Tool #${c.toolTemplateId}`,
          dataKey: c.dataKey,
          sourceType: "inline" as const,
          layoutType: c.layoutType,
          fields: ((Array.isArray(c.fieldDefinitions) ? c.fieldDefinitions : []) as Array<{ key: string; label: string; type: string }>)
            .filter(f => f.key && f.label)
            .map(f => ({
              key: f.key,
              label: f.label,
              type: f.type,
              usageCount: usageStartups.get(`${c.toolTemplateId}:${c.dataKey}:${f.key}`)?.size || 0,
            })),
        }));

      const inlineTemplateIds = new Set(configs.map(c => c.toolTemplateId));

      const toolkitEntries: RegistryEntry[] = templates
        .filter(t => !inlineTemplateIds.has(t.id))
        .map(t => {
          const defs = (Array.isArray(t.fieldDefinitions) ? t.fieldDefinitions : []) as Array<{ id: string; label: string; type?: string }>;
          const validFields = defs.filter(f => f.id && f.label);
          if (validFields.length === 0) return null;
          return {
            configId: 0,
            configTitle: t.name,
            stableKey: `toolkit:${t.id}`,
            toolTemplateId: t.id,
            toolTemplateName: t.name,
            dataKey: "_default",
            sourceType: "toolkit" as const,
            layoutType: t.toolType,
            fields: validFields.map(f => ({
              key: f.id,
              label: f.label,
              type: f.type || "text",
              usageCount: usageStartups.get(`${t.id}:_default:${f.id}`)?.size || 0,
            })),
          };
        })
        .filter((e): e is RegistryEntry => e !== null);

      res.json([...inlineEntries, ...toolkitEntries]);
    } catch (err: any) {
      console.error("Field registry error:", err);
      res.status(500).json({ message: "Failed to fetch field registry" });
    }
  });

  app.post("/api/admin/inline-tool-configs", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const parsed = insertInlineToolConfigSchema.parse(req.body);
      const revOf = parsed.revisionOf as { dataKey: string; level: number } | null;
      if (revOf && parsed.revisionMode && parsed.stableKey) {
        const { buildRevisionDataKey } = await import("@shared/dataResolver");
        const currentLevel = parseInt(parsed.stableKey.split(":")[1] || "0", 10);
        if (currentLevel > 0) {
          const expectedDataKey = buildRevisionDataKey(revOf.dataKey, currentLevel);
          if (parsed.dataKey !== expectedDataKey) {
            parsed.dataKey = expectedDataKey;
          }
        }
      }
      const config = await storage.createInlineToolConfig(parsed);
      res.status(201).json(config);
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: err.errors });
      console.error("Create inline tool config error:", err);
      res.status(500).json({ message: "Failed to create inline tool config" });
    }
  });

  app.patch("/api/admin/inline-tool-configs/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const partial = insertInlineToolConfigSchema.partial().parse(req.body);
      const revOf = partial.revisionOf as { dataKey: string; level: number } | null | undefined;
      const revMode = partial.revisionMode;
      if (revOf && revMode) {
        const { buildRevisionDataKey } = await import("@shared/dataResolver");
        let currentLevel = 0;
        if (partial.stableKey) {
          currentLevel = parseInt(partial.stableKey.split(":")[1] || "0", 10);
        } else {
          const existing = await storage.getInlineToolConfig(parseInt(req.params.id));
          if (existing?.stableKey) {
            currentLevel = parseInt(existing.stableKey.split(":")[1] || "0", 10);
          }
        }
        if (currentLevel > 0) {
          const expectedDataKey = buildRevisionDataKey(revOf.dataKey, currentLevel);
          if (partial.dataKey !== expectedDataKey) {
            partial.dataKey = expectedDataKey;
          }
        }
      }
      const config = await storage.updateInlineToolConfig(parseInt(req.params.id), partial);
      if (!config) return res.status(404).json({ message: "Not found" });

      if (config.isKeyAssumption) {
        try {
          await storage.retroSyncKeyAssumptionsForConfig(config.id);
        } catch (syncErr) {
          console.error("Retro key assumption sync failed (non-blocking):", syncErr);
        }
      }

      res.json(config);
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: err.errors });
      console.error("Update inline tool config error:", err);
      res.status(500).json({ message: "Failed to update inline tool config" });
    }
  });

  app.delete("/api/admin/inline-tool-configs/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.deleteInlineToolConfig(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete inline tool config error:", err);
      res.status(500).json({ message: "Failed to delete inline tool config" });
    }
  });

  // --- Example Companies ---

  app.get("/api/example-companies", isAuthenticated, async (req, res) => {
    try {
      const companies = await storage.getExampleCompanies();
      res.json(companies);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch example companies" });
    }
  });

  app.post("/api/admin/example-companies", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const parsed = insertExampleCompanySchema.parse(req.body);
      const company = await storage.createExampleCompany(parsed);
      res.status(201).json(company);
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: err.errors });
      console.error("Create example company error:", err);
      res.status(500).json({ message: "Failed to create example company" });
    }
  });

  app.patch("/api/admin/example-companies/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const partial = insertExampleCompanySchema.partial().parse(req.body);
      const company = await storage.updateExampleCompany(parseInt(req.params.id), partial);
      if (!company) return res.status(404).json({ message: "Not found" });
      res.json(company);
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ message: "Validation error", errors: err.errors });
      console.error("Update example company error:", err);
      res.status(500).json({ message: "Failed to update example company" });
    }
  });

  app.delete("/api/admin/example-companies/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.deleteExampleCompany(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete example company error:", err);
      res.status(500).json({ message: "Failed to delete example company" });
    }
  });

  // --- Tool Example Data ---

  app.get("/api/tool-example-data/:configId", isAuthenticated, async (req, res) => {
    try {
      const data = await storage.getToolExampleData(parseInt(req.params.configId));
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch tool example data" });
    }
  });

  app.put("/api/admin/tool-example-data", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { inlineToolConfigId, exampleCompanyId, exampleData } = req.body;
      const data = await storage.upsertToolExampleData(inlineToolConfigId, exampleCompanyId, exampleData);
      res.json(data);
    } catch (err: any) {
      console.error("Upsert tool example data error:", err);
      res.status(500).json({ message: "Failed to save tool example data" });
    }
  });

  app.delete("/api/admin/tool-example-data/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.deleteToolExampleData(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete tool example data" });
    }
  });

  // --- Seed inline tool configs ---

  app.post("/api/admin/seed-inline-tools", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.seedInlineToolConfigs();
      res.json({ success: true, message: "Inline tool configs seeded" });
    } catch (err: any) {
      console.error("Seed inline tools error:", err);
      res.status(500).json({ message: "Failed to seed inline tools" });
    }
  });

  app.get("/api/startups/:startupId/fundraising-readiness", isAuthenticated, async (req: any, res) => {
    try {
      const startupId = parseInt(req.params.startupId);
      if (!startupId) return res.status(400).json({ message: "Invalid startup ID" });

      const userId = req.user?.claims?.sub;
      if (userId) {
        const isMember = await storage.isStartupMember(userId, startupId);
        if (!isMember) return res.status(403).json({ message: "Not a member of this startup" });
      }

      const allTemplates = await storage.getToolTemplates();
      const templateByName = new Map(allTemplates.map(t => [t.name.toLowerCase(), t.id]));
      const resolve = (name: string, fallback: number) => templateByName.get(name.toLowerCase()) ?? fallback;

      const TOOL_IDS = {
        LEAN_CANVAS: resolve("Lean Canvas", 1),
        CUSTOMER_PROFILE: resolve("Customer profiles", 2),
        TEA: resolve("Techno-Economic Assessment", 5),
        IP_STRATEGY: resolve("IP Strategy Planner", 9),
        TEAM_MATRIX: resolve("Team Skills Matrix", 10),
        FINANCIAL: resolve("Financial Modeller", 11),
        SALES_DECK: resolve("Sales Deck Builder", 13),
      };

      const [crlEntry, trlEntry, iprlEntry, brlEntry, tmrlEntry] = await Promise.all([
        storage.getToolEntry(startupId, TOOL_IDS.LEAN_CANVAS),
        storage.getToolEntry(startupId, TOOL_IDS.TEA),
        storage.getToolEntry(startupId, TOOL_IDS.IP_STRATEGY),
        storage.getToolEntry(startupId, TOOL_IDS.FINANCIAL),
        storage.getToolEntry(startupId, TOOL_IDS.TEAM_MATRIX),
      ]);
      const [salesEntry, customerProfileEntry] = await Promise.all([
        storage.getToolEntry(startupId, TOOL_IDS.SALES_DECK),
        storage.getToolEntry(startupId, TOOL_IDS.CUSTOMER_PROFILE),
      ]);

      const safe = (d: unknown, key: string): unknown => {
        if (!d || typeof d !== "object") return null;
        return (d as Record<string, unknown>)[key] ?? null;
      };

      const summariseCRL = () => {
        const parts: string[] = [];
        const agreements = safe(salesEntry?.currentData, "_customerAgreements");
        if (Array.isArray(agreements) && agreements.length > 0) parts.push(`${agreements.length} customer agreement(s)`);
        const evidence = safe(crlEntry?.currentData, "_evidenceOfInterest");
        if (Array.isArray(evidence) && evidence.length > 0) parts.push(`${evidence.length} evidence item(s) of interest`);
        const salesMetrics = safe(salesEntry?.currentData, "_activeUsers") as Record<string, unknown> | null;
        if (salesMetrics && salesMetrics.totalUsers) parts.push(`${salesMetrics.totalUsers} total users`);
        const validation = safe(customerProfileEntry?.currentData, "_validationEvidence") as Record<string, unknown> | null;
        if (validation && validation.interviewCount) parts.push(`${validation.interviewCount} interviews`);
        return parts.length > 0 ? `✓ ${parts.join(", ")}` : "✗ No customer evidence data found";
      };

      const summariseTRL = () => {
        const parts: string[] = [];
        const rdStatus = safe(trlEntry?.currentData, "_rdStatus") as Record<string, unknown> | null;
        if (rdStatus) {
          if (rdStatus.currentFocus) parts.push(`Focus: ${String(rdStatus.currentFocus).substring(0, 80)}`);
          if (rdStatus.milestones) parts.push("Milestones defined");
        }
        const opDemo = safe(trlEntry?.currentData, "_operationalDemonstration") as Record<string, unknown> | null;
        if (opDemo && opDemo.performanceSummary) parts.push("Operational demonstration complete");
        const labTests = safe(trlEntry?.currentData, "_labTestResults");
        if (Array.isArray(labTests) && labTests.length > 0) parts.push(`${labTests.length} lab test result(s)`);
        return parts.length > 0 ? `✓ ${parts.join(", ")}` : "✗ No technology evidence data found";
      };

      const summariseIPRL = () => {
        const parts: string[] = [];
        const ipData = iprlEntry?.currentData as Record<string, unknown> | null;
        if (ipData) {
          for (const key of Object.keys(ipData)) {
            const v = ipData[key];
            if (Array.isArray(v) && v.length > 0) {
              parts.push(`${v.length} IP record(s) in ${key.replace(/^_/, "")}`);
            } else if (v && typeof v === "object" && !Array.isArray(v)) {
              const nonEmpty = Object.values(v as Record<string, unknown>).filter(val => val && String(val).trim() !== "").length;
              if (nonEmpty > 0) parts.push(`${key.replace(/^_/, "")} data present`);
            }
          }
        }
        return parts.length > 0 ? `✓ ${parts.join(", ")}` : "✗ No IP evidence data found";
      };

      const summariseBRL = () => {
        const parts: string[] = [];
        const projections = safe(brlEntry?.currentData, "_financialProjections") as Record<string, unknown> | null;
        if (projections) {
          if (projections.revenueYear1) parts.push(`Year 1 revenue: £${projections.revenueYear1}`);
          parts.push("Financial projections present");
        }
        const plSummary = safe(brlEntry?.currentData, "_plSummary") as Record<string, unknown> | null;
        if (plSummary) parts.push("P&L summary present");
        const plProjection = safe(brlEntry?.currentData, "_plProjection") as Record<string, unknown> | null;
        if (plProjection) parts.push("P&L projection present");
        return parts.length > 0 ? `✓ ${parts.join(", ")}` : "✗ No financial model data found";
      };

      const summariseTMRL = () => {
        const parts: string[] = [];
        const tmData = tmrlEntry?.currentData as Record<string, unknown> | null;
        if (tmData) {
          const roster = tmData._teamRoster || tmData._foundingTeam;
          if (Array.isArray(roster) && roster.length > 0) parts.push(`${roster.length} team member(s)`);
          const ownership = tmData._ownershipStructure as Record<string, unknown> | null;
          if (ownership && ownership.equitySplit) parts.push(`Equity split: ${ownership.equitySplit}`);
          const capTable = tmData._capTable;
          if (Array.isArray(capTable) && capTable.length > 0) parts.push("Cap table defined");
        }
        return parts.length > 0 ? `✓ ${parts.join(", ")}` : "✗ No team/cap table data found";
      };

      const extractCRLSegments = () => {
        const segments = safe(customerProfileEntry?.currentData, "_customerProfiles");
        if (Array.isArray(segments) && segments.length > 0) {
          return segments.map((s: Record<string, unknown>) => s.segment || s.name || "").filter(Boolean).join(", ");
        }
        const validation = safe(customerProfileEntry?.currentData, "_validationEvidence") as Record<string, unknown> | null;
        if (validation && validation.targetSegment) return String(validation.targetSegment);
        return "";
      };

      const extractIPRLCosts = () => {
        const ipData = iprlEntry?.currentData as Record<string, unknown> | null;
        if (!ipData) return "";
        const strategy = ipData._ipStrategy as Record<string, unknown> | null;
        if (strategy && strategy.estimatedCost) return String(strategy.estimatedCost);
        const budget = ipData._ipBudget as Record<string, unknown> | null;
        if (budget && budget.totalCost) return String(budget.totalCost);
        return "";
      };

      const extractIPRLAgreements = () => {
        const ipData = iprlEntry?.currentData as Record<string, unknown> | null;
        if (!ipData) return "";
        const parts: string[] = [];
        const agreements = ipData._ipAgreements || ipData._licensingAgreements;
        if (Array.isArray(agreements) && agreements.length > 0) parts.push(`${agreements.length} IP agreement(s)`);
        const granted = ipData._grantedIPR || ipData._patentsGranted;
        if (Array.isArray(granted) && granted.length > 0) parts.push(`${granted.length} granted IPR`);
        else if (granted && typeof granted === "object") parts.push("Granted IPR data present");
        const filings = ipData._patentFilings || ipData._ipFilings;
        if (Array.isArray(filings) && filings.length > 0) parts.push(`${filings.length} filing(s)`);
        return parts.length > 0 ? `✓ ${parts.join(", ")}` : "";
      };

      const fundingStrategyEntry = await storage.getToolEntry(startupId, resolve("Funding Strategy Planner", 12));
      const frlPitchData = safe(fundingStrategyEntry?.currentData, "_pitchIterationLog");
      const frlPitchSummary = Array.isArray(frlPitchData) && frlPitchData.length > 0
        ? `${frlPitchData.length} pitch iteration(s) logged`
        : "";

      const frlFundingSourcePipeline = safe(fundingStrategyEntry?.currentData, "_fundingSourcePipeline");
      const frlPipelineSummary = Array.isArray(frlFundingSourcePipeline) && (frlFundingSourcePipeline as unknown[]).length > 0
        ? `${(frlFundingSourcePipeline as unknown[]).length} funding source(s) tracked`
        : "";

      const frlAccountingData = safe(fundingStrategyEntry?.currentData, "_accountingDocumentation") as Record<string, unknown> | null;
      const frlAccountingSummary = frlAccountingData && Object.values(frlAccountingData).some(v => v && String(v).trim() !== "")
        ? "✓ Accounting & documentation present"
        : "";

      res.json({
        customerEvidence: summariseCRL(),
        technologyEvidence: summariseTRL(),
        ipEvidence: summariseIPRL(),
        financialModel: summariseBRL(),
        teamCapTable: summariseTMRL(),
        crlSegments: extractCRLSegments(),
        iprlCosts: extractIPRLCosts(),
        iprlAgreements: extractIPRLAgreements(),
        frlPitchIterations: frlPitchSummary,
        frlFundingPipeline: frlPipelineSummary,
        frlAccountingStatus: frlAccountingSummary,
      });
    } catch (err: any) {
      console.error("Fundraising readiness error:", err);
      res.status(500).json({ message: "Failed to compute fundraising readiness" });
    }
  });

  app.post("/api/webhooks/resend/inbound", async (req, res) => {
    try {
      console.log("[Inbound Webhook] Received Resend inbound email webhook");

      const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error("[Inbound Webhook] RESEND_WEBHOOK_SECRET is not configured. Rejecting all inbound webhook requests.");
        return res.status(503).json({ message: "Webhook not configured" });
      }
      const providedSecret = req.headers["x-webhook-secret"];
      if (!providedSecret || providedSecret !== webhookSecret) {
        console.warn("[Inbound Webhook] Invalid or missing webhook secret");
        return res.status(401).json({ message: "Unauthorised" });
      }

      const payload = req.body;
      if (!payload || typeof payload !== "object") {
        console.warn("[Inbound Webhook] Empty or invalid payload received");
        return res.status(400).json({ message: "Invalid payload" });
      }

      function normalizeAddresses(field: unknown): string[] {
        if (Array.isArray(field)) return field.filter((v): v is string => typeof v === "string");
        if (typeof field === "string") return [field];
        return [];
      }

      const allAddresses: string[] = [
        ...normalizeAddresses(payload.to),
        ...normalizeAddresses(payload.cc),
      ];

      const INBOUND_DOMAIN = "hub.undaunted-hq.org";
      const introTrackPattern = new RegExp(`intro-track\\+(\\d+)@${INBOUND_DOMAIN.replace(/\./g, "\\.")}`, "i");
      let extractedItemId: number | null = null;
      for (const addr of allAddresses) {
        const match = addr.match(introTrackPattern);
        if (match) {
          extractedItemId = parseInt(match[1], 10);
          break;
        }
      }

      if (extractedItemId === null) {
        console.warn("[Inbound Webhook] No intro-track address found in to/cc fields:", allAddresses);
        return res.status(200).json({ message: "No matching introduction address found, ignoring" });
      }

      console.log(`[Inbound Webhook] Extracted item ID: ${extractedItemId}`);

      const [item] = await db.select().from(introductionItems).where(eq(introductionItems.id, extractedItemId));
      if (!item) {
        console.warn(`[Inbound Webhook] Introduction item ${extractedItemId} not found`);
        return res.status(200).json({ message: "Introduction item not found" });
      }

      if (item.status !== "approved") {
        console.log(`[Inbound Webhook] Item ${extractedItemId} status is '${item.status}', not 'approved'. Skipping update.`);
        return res.status(200).json({ message: `Item status is '${item.status}', no update needed` });
      }

      if (!item.responseToken) {
        console.warn(`[Inbound Webhook] Item ${extractedItemId} has no response token, skipping`);
        return res.status(200).json({ message: "Item missing response token" });
      }

      await storage.updateIntroductionItemStatus(extractedItemId, "email_sent");
      console.log(`[Inbound Webhook] Updated item ${extractedItemId} status from 'approved' to 'email_sent'`);

      res.status(200).json({ message: "Status updated to email_sent", itemId: extractedItemId });
    } catch (err: any) {
      console.error("[Inbound Webhook] Error processing inbound email:", err);
      res.status(500).json({ message: "Internal error processing webhook" });
    }
  });

  // ============================================================
  // EVENTS
  // ============================================================
  const { createWherebyMeeting, createWherebyMeetingWithRetry, deleteWherebyMeeting, isWherebyConfigured, getRecordingAccessUrl, transcribeAudioFromUrl, summarizeTranscript } = await import("./services/whereby");
  const { buildRRuleString, expandRRule } = await import("./services/recurrence");
  const { sendEventInvitations } = await import("./services/event-emails");
  const { buildIcs } = await import("./services/event-ics");
  const { z: zod } = await import("zod");

  const eventSeriesPayloadSchema = zod.object({
    title: zod.string().min(1),
    description: zod.string().optional().nullable(),
    locationType: zod.enum(["virtual", "in_person"]),
    locationDetails: zod.string().optional().nullable(),
    startsAt: zod.string(),
    endsAt: zod.string(),
    timezone: zod.string().optional(),
    coverImageUrl: zod.string().optional().nullable(),
    wherebyEnabled: zod.boolean().optional(),
    recordingEnabled: zod.boolean().optional(),
    transcriptionEnabled: zod.boolean().optional(),
    recurrence: zod.object({
      freq: zod.enum(["DAILY", "WEEKLY", "MONTHLY"]),
      interval: zod.number().int().positive().optional(),
      byweekday: zod.array(zod.string()).optional(),
      count: zod.number().int().positive().optional(),
      until: zod.string().optional(),
    }).nullable().optional(),
    audiences: zod.array(zod.object({
      audienceType: zod.enum(["all", "programme", "cohort", "group", "startup", "user"]),
      audienceId: zod.string().nullable().optional(),
    })),
    sendInvites: zod.boolean().optional(),
    sprintIds: zod.array(zod.number().int().positive()).optional(),
  });

  // In-flight lock per occurrence id to prevent duplicate Whereby room
  // creation when multiple viewers hit a virtual event detail page
  // simultaneously that has no room yet.
  const wherebyProvisionLocks = new Map<number, Promise<{ ok: boolean; error?: string }>>();

  async function provisionWherebyForOccurrence(occId: number, series: any, occ: any): Promise<{ ok: boolean; error?: string; skipped?: { recording: boolean; transcription: boolean } }> {
    if (series.locationType !== "virtual") return { ok: true };
    if (!series.wherebyEnabled) return { ok: true };
    if (!isWherebyConfigured()) {
      console.warn("[Events] Whereby not configured (WHEREBY_API_KEY missing) — virtual event has no join link");
      return { ok: false, error: "Whereby API key not configured" };
    }
    try {
      const { meeting, skipped } = await createWherebyMeetingWithRetry({
        startDate: new Date(occ.startsAt),
        endDate: new Date(occ.endsAt),
        enableRecording: !!series.recordingEnabled,
        enableTranscription: !!series.transcriptionEnabled,
      });
      console.log("[Events] Whereby room provisioned", { occId, meetingId: meeting.meetingId, roomUrl: meeting.roomUrl, skipped });
      await storage.updateEventOccurrence(occId, {
        wherebyMeetingId: meeting.meetingId,
        wherebyHostRoomUrl: meeting.hostRoomUrl || null,
        wherebyRoomUrl: meeting.roomUrl,
      });
      return { ok: true, skipped };
    } catch (err: any) {
      console.error("[Events] Whereby provisioning failed for occurrence", occId, err);
      return { ok: false, error: err?.message || String(err) };
    }
  }

  async function sendInvitesForOccurrence(
    seriesId: number,
    occId: number,
    opts?: { isUpdate?: boolean; isCancellation?: boolean; mode?: "master" | "exception" | "unique"; exdates?: Date[] },
  ) {
    const series = await storage.getEventSeries(seriesId);
    if (!series) return;
    const occ = await storage.getEventOccurrence(occId);
    if (!occ) return;
    const userIds: string[] = await storage.resolveEventAudienceUserIds(seriesId);
    // Always include the organiser so the creator gets a calendar invite for
    // their own event (especially useful when admins create events targeting
    // founder-only audiences).
    const allIds = Array.from(new Set([...userIds, series.organizerId]));
    const userInfos = await storage.getUserEmails(allIds);
    const recipients = userInfos
      .filter(u => u.email)
      .map(u => ({
        to: u.email!,
        userId: u.id,
        name: [u.firstName, u.lastName].filter(Boolean).join(" ") || undefined,
      }));
    if (recipients.length === 0) {
      console.warn("[Events] No recipients resolved for series", seriesId, "(organiser email also missing)");
      return;
    }
    console.log("[Events] Sending invites for series", seriesId, "occurrence", occId, "to", recipients.length, "recipient(s):", recipients.map(r => r.to).join(", "));
    const organiser = await storage.getUser(series.organizerId).catch(() => null);
    // Default mode: occurrences flagged isException → exception VEVENT;
    // otherwise treated as a unique standalone instance. Series-wide sends
    // explicitly pass mode="master" to emit RRULE under the canonical UID.
    const mode = opts?.mode ?? (occ.isException ? "exception" : "unique");
    await sendEventInvitations({
      series,
      occurrence: occ,
      recipients,
      organizerName: organiser ? `${organiser.firstName || ""} ${organiser.lastName || ""}`.trim() || undefined : undefined,
      organizerEmail: organiser?.email || undefined,
      joinUrl: occ.wherebyRoomUrl || null,
      isUpdate: opts?.isUpdate,
      isCancellation: opts?.isCancellation,
      mode,
      exdates: opts?.exdates,
    });
  }

  // Send a single SERIES-LEVEL invite (master VEVENT with RRULE) to every
  // recipient. Used for initial invites and scope=all updates/cancels so
  // calendar clients reconcile against one canonical entry.
  async function sendSeriesInvite(
    seriesId: number,
    opts?: { isUpdate?: boolean; isCancellation?: boolean },
  ) {
    const occs = await storage.getOccurrencesForSeries(seriesId);
    if (occs.length === 0) return;
    // The master is the earliest occurrence — its DTSTART must equal the
    // series' DTSTART so RRULE expansion is deterministic on receivers.
    const anchor = occs.reduce((min, o) => (new Date(o.startsAt) < new Date(min.startsAt) ? o : min), occs[0]);
    // Gather EXDATE entries from sibling occurrences so cancelled/moved
    // instances disappear from clients (notably Apple Calendar) that only
    // honour EXDATE on the master VEVENT. Skip for non-recurring series.
    const series = await storage.getEventSeries(seriesId);
    let exdates: Date[] | undefined;
    if (series?.rrule) {
      const list: Date[] = [];
      for (const o of occs) {
        if (o.id === anchor.id) continue;
        const isCancelled = o.status === "cancelled";
        const isMoved = o.recurrenceAnchor && new Date(o.recurrenceAnchor).getTime() !== new Date(o.startsAt).getTime();
        if (isCancelled || isMoved) {
          list.push(new Date(o.recurrenceAnchor || o.startsAt));
        }
      }
      if (list.length > 0) exdates = list;
    }
    await sendInvitesForOccurrence(seriesId, anchor.id, { ...opts, mode: "master", exdates });
  }

  // List my events (upcoming)
  // Backend gate: user must have the `events` programme feature enabled
  // (via any of their startup's programmes), be an admin, OR be explicitly
  // invited as an individual `user` audience entry on at least one event
  // series — so admins/EIRs/investors invited individually still get
  // access without being granted the programme feature.
  async function userHasEventsFeature(userId: string): Promise<boolean> {
    if (await storage.isUserAdmin(userId)) return true;
    const userStartups = await storage.getStartups(userId);
    for (const s of userStartups) {
      const features = await storage.getStartupFeatures(s.id);
      // OR-logic: enabled if ANY programme enables it; if no entries exist
      // for this key the default is "enabled" (matches frontend useFeatures).
      const f = features.find(x => x.featureKey === "events");
      if (!f || f.enabled) return true;
    }
    if (await storage.isUserExplicitlyInvitedToAnyEvent(userId)) return true;
    return false;
  }

  const requireEventsFeature = async (req: any, res: any, next: any) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorised" });
    if (!(await userHasEventsFeature(userId))) {
      return res.status(403).json({ message: "Events feature not enabled" });
    }
    next();
  };

  app.get("/api/events", isAuthenticated, requireEventsFeature, async (req: any, res) => {
    try {
      const events = await storage.getUpcomingEventsForUser(req.user.claims.sub, 100);
      res.json(events);
    } catch (err: any) {
      console.error("[Events] list error", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/events/past", isAuthenticated, requireEventsFeature, async (req: any, res) => {
    try {
      const events = await storage.getPastEventsForUser(req.user.claims.sub, 50);
      res.json(events);
    } catch (err: any) {
      console.error("[Events] past list error", err);
      res.status(500).json({ message: err.message });
    }
  });

  // Admin-only audience preview: takes a draft audience array and returns
  // the resolved recipient count + a small sample, so admins can sanity-check
  // who will be invited before they hit "Create".
  app.post("/api/admin/events/preview-audience", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const audiences: { audienceType: string; audienceId: string | null }[] = Array.isArray(req.body?.audiences) ? req.body.audiences : [];
      const userIds = await storage.resolveAudienceUserIdsForPreview(audiences);
      const sample = await storage.getUserEmails(userIds.slice(0, 5));
      res.json({
        recipientCount: userIds.length,
        sample: sample.map(u => ({
          email: u.email,
          name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email,
        })),
      });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Single event with auth check
  app.get("/api/events/:id", isAuthenticated, requireEventsFeature, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      let occ = await storage.getEventOccurrenceWithSeries(id, userId);
      if (!occ) return res.status(404).json({ message: "Not found" });
      const isAdmin = await storage.isUserAdmin(userId);
      if (!isAdmin) {
        const audienceUserIds: string[] = await storage.resolveEventAudienceUserIds(occ.seriesId);
        if (!audienceUserIds.includes(userId)) {
          return res.status(403).json({ message: "Not invited to this event" });
        }
      }

      // Lazy provisioning: if this is a virtual event with Whereby enabled but
      // no room URL (e.g. initial provisioning failed), provision now so the
      // client always sees a room. Guarded by an in-flight lock keyed by
      // occurrence id to avoid duplicate rooms when two viewers hit at once.
      if (
        occ.resolvedLocationType === "virtual" &&
        occ.series.wherebyEnabled &&
        !occ.wherebyRoomUrl &&
        occ.status !== "cancelled" &&
        Date.now() <= new Date(occ.endsAt).getTime() &&
        isWherebyConfigured()
      ) {
        const existing = wherebyProvisionLocks.get(id);
        if (existing) {
          try { await existing; } catch { /* ignore */ }
        } else {
          const p = provisionWherebyForOccurrence(id, occ.series, occ)
            .finally(() => wherebyProvisionLocks.delete(id));
          wherebyProvisionLocks.set(id, p);
          try { await p; } catch { /* logged inside provisioner */ }
        }
        const refreshed = await storage.getEventOccurrenceWithSeries(id, userId);
        if (refreshed) occ = refreshed;
      }

      const recording = await storage.getRecordingForEvent(id);

      // Look up organiser for "host" display.
      const organiser = await storage.getUser(occ.series.organizerId).catch(() => null);
      const organizerName = organiser
        ? [organiser.firstName, organiser.lastName].filter(Boolean).join(" ") || organiser.email || "Host"
        : null;

      // RSVP-gate the virtual join URL: only return room URLs when the user
      // has RSVPed "going" AND we're inside the join window (30 min before
      // start, until end). Admins always get the host URL. This prevents
      // any invitee — even those who declined — from joining the call.
      const now = Date.now();
      const startMs = new Date(occ.startsAt).getTime();
      const endMs = new Date(occ.endsAt).getTime();
      const joinWindowOpen = now >= startMs - 30 * 60 * 1000 && now <= endMs;
      const userIsGoing = occ.myRsvp?.status === "going";
      const canJoin = isAdmin || (userIsGoing && joinWindowOpen);
      const sanitized = {
        ...occ,
        organizerName,
        canJoin,
        joinWindowOpen,
        wherebyRoomUrl: canJoin ? occ.wherebyRoomUrl : null,
        wherebyHostRoomUrl: isAdmin ? occ.wherebyHostRoomUrl : null,
      };
      res.json({ ...sanitized, recording });
    } catch (err: any) {
      console.error("[Events] get error", err);
      res.status(500).json({ message: err.message });
    }
  });

  // RSVP list (visible to invited users + admins)
  app.get("/api/events/:id/rsvps", isAuthenticated, requireEventsFeature, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid event id" });
      const userId = req.user.claims.sub;
      const occurrence = await storage.getEventOccurrence(id);
      if (!occurrence) return res.status(404).json({ message: "Not found" });
      const isAdmin = await storage.isUserAdmin(userId);
      if (!isAdmin) {
        const audienceUserIds: string[] = await storage.resolveEventAudienceUserIds(occurrence.seriesId);
        if (!audienceUserIds.includes(userId)) {
          return res.status(403).json({ message: "Not invited" });
        }
      }
      const rsvps = await storage.getRsvpsForEvent(id);
      res.json(rsvps);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // RSVP
  app.post("/api/events/:id/rsvp", isAuthenticated, requireEventsFeature, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid event id" });
      const userId = req.user.claims.sub;
      const { status } = req.body;
      if (!["going", "maybe", "not_going"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      // Validate occurrence existence BEFORE upsert to prevent orphan RSVPs
      // (no FK constraints in schema — guard at the application layer).
      const occurrence = await storage.getEventOccurrence(id);
      if (!occurrence) return res.status(404).json({ message: "Event not found" });
      const audienceUserIds: string[] = await storage.resolveEventAudienceUserIds(occurrence.seriesId);
      const isAdmin = await storage.isUserAdmin(userId);
      if (!isAdmin && !audienceUserIds.includes(userId)) {
        return res.status(403).json({ message: "Not invited" });
      }
      const rsvp = await storage.upsertRsvp(id, userId, status);
      res.json(rsvp);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ICS download for a single occurrence
  app.get("/api/events/:id/ics", isAuthenticated, requireEventsFeature, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const occ = await storage.getEventOccurrenceWithSeries(id, userId);
      if (!occ) return res.status(404).end();
      const isAdminUser = await storage.isUserAdmin(userId);
      if (!isAdminUser) {
        const audienceUserIds: string[] = await storage.resolveEventAudienceUserIds(occ.seriesId);
        if (!audienceUserIds.includes(userId)) {
          return res.status(403).json({ message: "Not invited to this event" });
        }
      }
      // Identify the series ANCHOR occurrence (earliest startsAt). Only the
      // anchor may emit the master VEVENT (RRULE + canonical series UID).
      // Non-anchor non-exception occurrences are emitted as a standalone
      // VEVENT with a unique UID so calendar clients don't clobber the
      // series with an off-anchor master DTSTART.
      const allOccs = await storage.getOccurrencesForSeries(occ.seriesId);
      const anchor = allOccs.reduce(
        (min, o) => (new Date(o.startsAt) < new Date(min.startsAt) ? o : min),
        allOccs[0],
      );
      const isAnchor = anchor && anchor.id === occ.id;
      const isException = !!occ.isException;
      const useMaster = isAnchor && !isException;
      const useExceptionId = isException && !!occ.recurrenceAnchor;
      const uid = useMaster || useExceptionId
        ? `series-${occ.seriesId}@hub.undaunted-hq.org`
        : `series-${occ.seriesId}-occ-${occ.id}@hub.undaunted-hq.org`;
      const ics = buildIcs({
        uid,
        recurrenceId: useExceptionId ? occ.recurrenceAnchor : undefined,
        series: occ.series,
        occurrence: occ,
        resolvedTitle: occ.resolvedTitle,
        resolvedDescription: occ.resolvedDescription,
        resolvedLocation: occ.resolvedLocationType === "virtual" ? (occ.wherebyRoomUrl || "Virtual") : occ.resolvedLocationDetails,
        joinUrl: occ.wherebyRoomUrl,
        rrule: useMaster ? occ.series.rrule : null,
        method: "REQUEST",
        sequence: useMaster ? (occ.series.sequence ?? 0) : (occ.sequence ?? 0),
      });
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="event-${id}.ics"`);
      res.send(ics);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ----- Admin -----
  app.get("/api/admin/events", isAuthenticated, isAdmin, async (_req: any, res) => {
    try {
      const list = await storage.getAllEventSeriesAdmin();
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/events/:seriesId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const sid = parseInt(req.params.seriesId);
      const series = await storage.getEventSeries(sid);
      if (!series) return res.status(404).json({ message: "Not found" });
      const occurrences = await storage.getOccurrencesForSeries(sid);
      const audiences = await storage.getEventAudiences(sid);
      const sprintIds = await storage.getEventSeriesSprintIds(sid);
      res.json({ series, occurrences, audiences, sprintIds });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/events", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = eventSeriesPayloadSchema.parse(req.body);
      const startsAt = new Date(data.startsAt);
      const endsAt = new Date(data.endsAt);
      if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime()) || endsAt <= startsAt) {
        return res.status(400).json({ message: "Invalid start/end times" });
      }
      let rrule: string | null = null;
      if (data.recurrence) {
        rrule = buildRRuleString({
          ...data.recurrence,
          until: data.recurrence.until ? new Date(data.recurrence.until) : undefined,
        }, startsAt);
      }
      const series = await storage.createEventSeries({
        title: data.title,
        description: data.description ?? null,
        organizerId: userId,
        locationType: data.locationType,
        locationDetails: data.locationDetails ?? null,
        wherebyEnabled: data.wherebyEnabled ?? true,
        recordingEnabled: data.recordingEnabled ?? true,
        transcriptionEnabled: data.transcriptionEnabled ?? true,
        rrule,
        startsAt,
        endsAt,
        timezone: data.timezone || "UTC",
        coverImageUrl: data.coverImageUrl ?? null,
      });

      // Audiences
      await storage.setEventAudiences(series.id, data.audiences.map(a => ({
        audienceType: a.audienceType, audienceId: a.audienceId ?? null,
      })));

      // Sprint links (series-level — apply to all occurrences)
      if (data.sprintIds) {
        await storage.setEventSeriesSprints(series.id, data.sprintIds);
      }

      // Occurrences
      const durationMs = endsAt.getTime() - startsAt.getTime();
      let starts: Date[] = [startsAt];
      if (rrule) {
        starts = expandRRule(rrule, 200, 730);
        if (starts.length === 0) starts = [startsAt];
      }
      const createdIds: number[] = [];
      const wherebyErrors: string[] = [];
      let recordingSkipped = false;
      let transcriptionSkipped = false;
      for (const s of starts) {
        const occEnd = new Date(s.getTime() + durationMs);
        const occ = await storage.createEventOccurrence({
          seriesId: series.id,
          recurrenceAnchor: rrule ? s : null,
          startsAt: s,
          endsAt: occEnd,
        });
        createdIds.push(occ.id);
        if (data.locationType === "virtual" && data.wherebyEnabled !== false) {
          const result = await provisionWherebyForOccurrence(occ.id, series, { startsAt: s, endsAt: occEnd });
          if (!result.ok && result.error) wherebyErrors.push(result.error);
          if (result.skipped?.recording) recordingSkipped = true;
          if (result.skipped?.transcription) transcriptionSkipped = true;
        }
      }

      // Send invites for first occurrence (master) — covers entire series via RRULE in ICS.
      // Awaited so failures (e.g. Resend domain not verified) surface to the
      // admin in the response instead of being silently swallowed.
      let inviteError: string | null = null;
      if (data.sendInvites !== false && createdIds.length > 0) {
        try {
          await sendSeriesInvite(series.id);
        } catch (e: any) {
          console.error("[Events] invite send failed", e);
          inviteError = e?.message || String(e);
        }
      }

      res.status(201).json({
        series,
        occurrenceIds: createdIds,
        warnings: {
          wherebyError: wherebyErrors[0] || null,
          inviteError,
          featuresSkipped: {
            recording: recordingSkipped,
            transcription: transcriptionSkipped,
          },
        },
      });
    } catch (err: any) {
      console.error("[Events] create error", err);
      res.status(400).json({ message: err.message });
    }
  });

  // Retry / generate Whereby room for a single occurrence (admin tool —
  // useful when the original provisioning failed, e.g. due to a transient
  // Whereby API error). Returns the new room URL or the failure reason.
  app.post("/api/admin/events/:seriesId/occurrence/:occId/provision-whereby", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const sid = parseInt(req.params.seriesId);
      const oid = parseInt(req.params.occId);
      const occ = await storage.getEventOccurrence(oid);
      if (!occ || occ.seriesId !== sid) return res.status(404).json({ message: "Not found" });
      const series = await storage.getEventSeries(sid);
      if (!series) return res.status(404).json({ message: "Series not found" });
      const result = await provisionWherebyForOccurrence(oid, series, occ);
      const updated = await storage.getEventOccurrence(oid);
      res.json({ ok: result.ok, error: result.error || null, roomUrl: updated?.wherebyRoomUrl || null });
    } catch (err: any) {
      console.error("[Events] provision-whereby error", err);
      res.status(500).json({ message: err.message });
    }
  });

  // Update single occurrence (this), this & following, or all
  app.patch("/api/admin/events/:seriesId/occurrence/:occId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const sid = parseInt(req.params.seriesId);
      const oid = parseInt(req.params.occId);
      const scope: "this" | "following" | "all" =
        req.body.scope === "following" || req.body.scope === "all" ? req.body.scope : "this";
      const updates: EventUpdatePayload = req.body.updates || {};
      const occ = await storage.getEventOccurrence(oid);
      if (!occ || occ.seriesId !== sid) return res.status(404).json({ message: "Not found" });

      const occUpdate: Partial<InsertEventOccurrence> = {};
      if (updates.titleOverride !== undefined) occUpdate.titleOverride = updates.titleOverride;
      if (updates.descriptionOverride !== undefined) occUpdate.descriptionOverride = updates.descriptionOverride;
      if (updates.locationTypeOverride !== undefined) occUpdate.locationTypeOverride = updates.locationTypeOverride;
      if (updates.locationDetailsOverride !== undefined) occUpdate.locationDetailsOverride = updates.locationDetailsOverride;
      if (updates.startsAt) occUpdate.startsAt = new Date(updates.startsAt);
      if (updates.endsAt) occUpdate.endsAt = new Date(updates.endsAt);

      if (scope === "this") {
        occUpdate.isException = true;
        occUpdate.sequence = (occ.sequence ?? 0) + 1;
        await storage.updateEventOccurrence(oid, occUpdate);
      } else if (scope === "all") {
        const currentSeries = await storage.getEventSeries(sid);
        if (!currentSeries) return res.status(404).json({ message: "Series not found" });
        const seriesUpdate: Partial<InsertEventSeries> = { sequence: (currentSeries.sequence ?? 0) + 1 };
        if (updates.titleOverride !== undefined) seriesUpdate.title = updates.titleOverride || currentSeries.title;
        if (updates.descriptionOverride !== undefined) seriesUpdate.description = updates.descriptionOverride;
        if (updates.locationTypeOverride !== undefined) seriesUpdate.locationType = updates.locationTypeOverride;
        if (updates.locationDetailsOverride !== undefined) seriesUpdate.locationDetails = updates.locationDetailsOverride;

        // Time edits: compute delta against the edited occurrence and shift
        // the series anchor + every occurrence so cadence is preserved.
        const startDelta = occUpdate.startsAt
          ? occUpdate.startsAt.getTime() - new Date(occ.startsAt).getTime()
          : 0;
        const endDelta = occUpdate.endsAt
          ? occUpdate.endsAt.getTime() - new Date(occ.endsAt).getTime()
          : 0;
        if (startDelta !== 0) {
          seriesUpdate.startsAt = new Date(new Date(currentSeries.startsAt).getTime() + startDelta);
        }
        if (endDelta !== 0) {
          seriesUpdate.endsAt = new Date(new Date(currentSeries.endsAt).getTime() + endDelta);
        }
        await storage.updateEventSeries(sid, seriesUpdate);

        const occs = await storage.getOccurrencesForSeries(sid);
        for (const o of occs) {
          const perOccUpdate: Partial<InsertEventOccurrence> = {
            titleOverride: null, descriptionOverride: null,
            locationTypeOverride: null, locationDetailsOverride: null,
            isException: false,
          };
          if (startDelta !== 0) perOccUpdate.startsAt = new Date(new Date(o.startsAt).getTime() + startDelta);
          if (endDelta !== 0) perOccUpdate.endsAt = new Date(new Date(o.endsAt).getTime() + endDelta);
          await storage.updateEventOccurrence(o.id, perOccUpdate);
        }
      } else if (scope === "following") {
        const occs = await storage.getOccurrencesForSeries(sid);
        const fromDate = occ.startsAt;
        const startDelta = occUpdate.startsAt
          ? occUpdate.startsAt.getTime() - new Date(occ.startsAt).getTime()
          : 0;
        const endDelta = occUpdate.endsAt
          ? occUpdate.endsAt.getTime() - new Date(occ.endsAt).getTime()
          : 0;
        for (const o of occs) {
          if (new Date(o.startsAt) >= fromDate) {
            const perOccUpdate: Partial<InsertEventOccurrence> = {
              ...occUpdate,
              isException: true,
              sequence: (o.sequence ?? 0) + 1,
            };
            if (startDelta !== 0) perOccUpdate.startsAt = new Date(new Date(o.startsAt).getTime() + startDelta);
            if (endDelta !== 0) perOccUpdate.endsAt = new Date(new Date(o.endsAt).getTime() + endDelta);
            await storage.updateEventOccurrence(o.id, perOccUpdate);
          }
        }
      }

      // Sprint links are series-level — always apply regardless of scope.
      if (updates.sprintIds !== undefined) {
        await storage.setEventSeriesSprints(sid, updates.sprintIds);
      }

      // Scope-aware notification:
      //   this       → one exception VEVENT (RECURRENCE-ID + per-occ SEQUENCE)
      //   following  → one exception VEVENT per affected instance
      //   all        → ONE master series UPDATE (RRULE + bumped series SEQUENCE),
      //                NOT a fanout per-occurrence
      if (scope === "this") {
        sendInvitesForOccurrence(sid, oid, { isUpdate: true, mode: "exception" })
          .catch(e => console.error("[Events] update invite failed", e));
      } else if (scope === "all") {
        sendSeriesInvite(sid, { isUpdate: true })
          .catch(e => console.error("[Events] series update invite failed", e));
      } else if (scope === "following") {
        const occs = await storage.getOccurrencesForSeries(sid);
        const fromDate = occ.startsAt;
        for (const o of occs) {
          if (new Date(o.startsAt) >= fromDate) {
            sendInvitesForOccurrence(sid, o.id, { isUpdate: true, mode: "exception" })
              .catch(e => console.error("[Events] update invite failed", e));
          }
        }
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Cancel occurrence (this/following/all)
  app.delete("/api/admin/events/:seriesId/occurrence/:occId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const sid = parseInt(req.params.seriesId);
      const oid = parseInt(req.params.occId);
      const scope = (req.query.scope || "this") as "this" | "following" | "all";
      const occ = await storage.getEventOccurrence(oid);
      if (!occ || occ.seriesId !== sid) return res.status(404).json({ message: "Not found" });
      let toCancel: any[] = [];
      if (scope === "this") {
        // Single-occurrence cancel → exception VEVENT with bumped SEQUENCE.
        await storage.updateEventOccurrence(oid, {
          status: "cancelled",
          isException: true,
          sequence: (occ.sequence ?? 0) + 1,
        });
        toCancel = [await storage.getEventOccurrence(oid)];
      } else if (scope === "following") {
        // Mark each affected occurrence as exception + bump SEQUENCE so the
        // CANCEL ICS emits a RECURRENCE-ID line for each one.
        const allOccs = await storage.getOccurrencesForSeries(sid);
        for (const o of allOccs) {
          if (new Date(o.startsAt) >= occ.startsAt) {
            await storage.updateEventOccurrence(o.id, {
              status: "cancelled",
              isException: true,
              sequence: (o.sequence ?? 0) + 1,
            });
          }
        }
        toCancel = (await storage.getOccurrencesForSeries(sid)).filter((o: any) => new Date(o.startsAt) >= occ.startsAt);
      } else if (scope === "all") {
        // Series-wide cancel → bump series SEQUENCE; master CANCEL VEVENT
        // (with RRULE) cancels all instances under the original UID.
        const currentSeries = await storage.getEventSeries(sid);
        if (!currentSeries) return res.status(404).json({ message: "Series not found" });
        await storage.updateEventSeries(sid, {
          status: "cancelled",
          sequence: (currentSeries.sequence ?? 0) + 1,
        });
        const occs = await storage.getOccurrencesForSeries(sid);
        for (const o of occs) {
          await storage.updateEventOccurrence(o.id, { status: "cancelled" });
        }
        toCancel = await storage.getOccurrencesForSeries(sid);
      }
      // Best-effort: tear down Whereby for every affected occurrence.
      for (const o of toCancel) {
        if (o.wherebyMeetingId) deleteWherebyMeeting(o.wherebyMeetingId).catch(() => {});
      }
      // Cancellation email semantics:
      //   this/following → exception CANCEL VEVENT(s) under series UID
      //   all            → ONE master series CANCEL (RRULE + bumped series
      //                    SEQUENCE), NOT a fanout per-occurrence
      if (scope === "all") {
        sendSeriesInvite(sid, { isCancellation: true })
          .catch(() => {});
      } else {
        for (const o of toCancel) {
          sendInvitesForOccurrence(sid, o.id, { isCancellation: true, mode: "exception" })
            .catch(() => {});
        }
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Hard delete entire series
  app.delete("/api/admin/events/:seriesId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const sid = parseInt(req.params.seriesId);
      const occs = await storage.getOccurrencesForSeries(sid);
      for (const o of occs) {
        if (o.wherebyMeetingId) deleteWherebyMeeting(o.wherebyMeetingId).catch(() => {});
      }
      await storage.deleteEventSeries(sid);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Whereby webhook (transcription/recording lifecycle)
  app.post("/api/webhooks/whereby", express.json(), async (req: any, res) => {
    try {
      // Require a shared secret for webhook authentication. Without this,
      // anyone could spoof recording.ready events and trigger transcription
      // / state changes. Configure WHEREBY_WEBHOOK_SECRET and set it as the
      // `Authorization: Bearer <secret>` (or `X-Whereby-Secret`) header in
      // the Whereby dashboard webhook configuration.
      const expected = process.env.WHEREBY_WEBHOOK_SECRET;
      if (!expected) {
        console.error("[Whereby Webhook] WHEREBY_WEBHOOK_SECRET not configured — rejecting");
        return res.status(503).json({ message: "Webhook not configured" });
      }
      const provided = (req.headers["x-whereby-secret"] as string)
        || (req.headers["authorization"] as string)?.replace(/^Bearer\s+/i, "")
        || "";
      if (provided !== expected) {
        return res.status(401).json({ message: "Unauthorised" });
      }
      const event = req.body;
      const meetingId = event?.data?.meetingId || event?.meetingId;
      const type = event?.type || event?.event;
      if (!meetingId || !type) return res.status(200).json({ ok: true });

      const occ = await storage.findEventByWherebyMeetingId(meetingId);
      if (!occ) return res.status(200).json({ ok: true });

      let recording = await storage.getRecordingForEvent(occ.id);
      if (!recording) {
        recording = await storage.createEventRecording({ eventId: occ.id, status: "pending" });
      }

      if (type.includes("recording") && type.includes("ready")) {
        const recordingId = event?.data?.recordingId || event?.data?.id;
        const url = recordingId ? await getRecordingAccessUrl(recordingId) : null;
        await storage.updateEventRecording(recording.id, {
          wherebyRecordingId: recordingId || null,
          recordingUrl: url || null,
          status: "recording_ready",
        });
        // Kick off transcription async
        if (url) {
          (async () => {
            try {
              const transcript = await transcribeAudioFromUrl(url);
              if (transcript) {
                await storage.updateEventRecording(recording.id, { transcriptText: transcript, status: "transcribed" });
                const series = await storage.getEventSeries(occ.seriesId);
                const summary = await summarizeTranscript(transcript, series?.title || "Event");
                if (summary) {
                  await storage.updateEventRecording(recording.id, { summaryText: summary, status: "summarized" });
                }
              } else {
                await storage.updateEventRecording(recording.id, { status: "failed", errorMessage: "Transcription failed" });
              }
            } catch (e: any) {
              await storage.updateEventRecording(recording.id, { status: "failed", errorMessage: e.message });
            }
          })();
        }
      }
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[Whereby Webhook] error", err);
      res.status(200).json({ ok: true });
    }
  });

  return httpServer;
}
