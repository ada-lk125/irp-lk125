import { z } from 'zod';
import { 
  insertStartupSchema,
  insertKnowledgeArticleSchema,
  startups, 
  checklistProgress, 
  toolEntries, 
  toolEntryVersions,
  modules,
  levels,
  checklistItems,
  toolTemplates,
  startupTargets,
  assumptions,
  experiments,
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  startups: {
    list: {
      method: 'GET' as const,
      path: '/api/startups' as const,
      responses: {
        200: z.array(z.custom<typeof startups.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/startups' as const,
      input: insertStartupSchema,
      responses: {
        201: z.custom<typeof startups.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/startups/:id' as const,
      responses: {
        200: z.custom<typeof startups.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/startups/:id' as const,
      input: insertStartupSchema,
      responses: {
        200: z.custom<typeof startups.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    switch: {
        method: 'POST' as const,
        path: '/api/startups/:id/switch' as const,
        responses: {
            200: z.object({ success: z.boolean() }),
            404: errorSchemas.notFound
        }
    }
  },
  modules: {
    list: {
      method: 'GET' as const,
      path: '/api/modules' as const,
      responses: {
        200: z.array(z.custom<typeof modules.$inferSelect>()),
      },
    },
    getStructure: {
      method: 'GET' as const,
      path: '/api/modules/structure' as const, // Returns full tree with levels/items for quick load
      responses: {
        200: z.array(z.any()), // Complex nested type
      },
    },
  },
  progress: {
    get: {
        method: 'GET' as const,
        path: '/api/startups/:startupId/progress' as const,
        responses: {
            200: z.array(z.custom<typeof checklistProgress.$inferSelect>()),
        }
    },
    toggle: {
      method: 'POST' as const,
      path: '/api/checklist-progress' as const,
      input: z.object({
        startupId: z.number(),
        checklistItemId: z.number(),
        completed: z.boolean(),
      }),
      responses: {
        200: z.custom<typeof checklistProgress.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
        403: errorSchemas.notFound,
        500: errorSchemas.internal,
      },
    },
  },
  tools: {
    templates: {
      method: 'GET' as const,
      path: '/api/tool-templates' as const,
      responses: {
        200: z.array(z.custom<typeof toolTemplates.$inferSelect>()),
      },
    },
    getEntry: {
        method: 'GET' as const,
        path: '/api/startups/:startupId/tools/:toolTemplateId' as const,
        responses: {
            200: z.custom<typeof toolEntries.$inferSelect>().optional(),
        }
    },
    saveEntry: {
      method: 'POST' as const,
      path: '/api/tool-entries' as const,
      input: z.object({
        startupId: z.number(),
        toolTemplateId: z.number(),
        data: z.record(z.any()),
        contextLevelId: z.number().optional(), // For version history context
      }),
      responses: {
        200: z.custom<typeof toolEntries.$inferSelect>(),
      },
    },
    versions: {
        method: 'GET' as const,
        path: '/api/tool-entries/:id/versions' as const,
        responses: {
            200: z.array(z.custom<typeof toolEntryVersions.$inferSelect>())
        }
    },
    categories: {
      method: 'GET' as const,
      path: '/api/tool-categories' as const,
      responses: {
        200: z.array(z.object({
          toolTemplateId: z.number(),
          dimensions: z.array(z.string()),
        })),
      },
    },
  },
  targets: {
    get: {
      method: 'GET' as const,
      path: '/api/startups/:startupId/targets' as const,
      responses: {
        200: z.array(z.custom<typeof startupTargets.$inferSelect>()),
      },
    },
    set: {
      method: 'POST' as const,
      path: '/api/startups/:startupId/targets' as const,
      input: z.object({
        moduleId: z.number(),
        targetLevel: z.number().min(1).max(9),
      }),
      responses: {
        200: z.custom<typeof startupTargets.$inferSelect>(),
      },
    },
  },
  activity: {
    recent: {
      method: 'GET' as const,
      path: '/api/startups/:startupId/activity' as const,
      responses: {
        200: z.array(z.object({
          type: z.enum(['completed', 'updated']),
          moduleName: z.string(),
          levelNumber: z.number(),
          toolName: z.string().optional(),
          timestamp: z.string(),
        })),
      },
    },
  },
  knowledge: {
    list: {
      method: 'GET' as const,
      path: '/api/knowledge' as const,
      responses: { 200: z.array(z.any()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/knowledge' as const,
      input: insertKnowledgeArticleSchema,
      responses: { 201: z.any() },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/knowledge/:id' as const,
      input: insertKnowledgeArticleSchema.partial(),
      responses: { 200: z.any() },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/knowledge/:id' as const,
      responses: { 200: z.object({ success: z.boolean() }) },
    },
  },
  chat: {
    messages: {
      method: 'GET' as const,
      path: '/api/startups/:startupId/chat' as const,
      responses: { 200: z.array(z.any()) },
    },
    send: {
      method: 'POST' as const,
      path: '/api/startups/:startupId/chat' as const,
      input: z.object({ message: z.string() }),
      responses: { 200: z.any() },
    },
    clear: {
      method: 'DELETE' as const,
      path: '/api/startups/:startupId/chat' as const,
      responses: { 200: z.object({ success: z.boolean() }) },
    },
    tts: {
      method: 'POST' as const,
      path: '/api/chat/tts' as const,
      input: z.object({ text: z.string() }),
      responses: { 200: z.any() },
    },
    stt: {
      method: 'POST' as const,
      path: '/api/chat/stt' as const,
      responses: { 200: z.object({ text: z.string() }) },
    },
  },
  milestones: {
    list: {
      method: 'GET' as const,
      path: '/api/milestones' as const,
      responses: { 200: z.array(z.any()) },
    },
  },
  investorIntroductions: {
    investors: {
      method: 'GET' as const,
      path: '/api/investor-introductions/investors' as const,
      responses: { 200: z.array(z.any()) },
    },
    submit: {
      method: 'POST' as const,
      path: '/api/investor-introductions/submit' as const,
      input: z.object({
        startupName: z.string().min(1),
        description: z.string().min(1),
        climateProblem: z.string().optional(),
        solutionDescription: z.string().optional(),
        businessModel: z.string().optional(),
        targetMarket: z.string().optional(),
        competitors: z.string().optional(),
        websiteUrl: z.string().optional(),
        roundStage: z.string().min(1),
        amountRaising: z.number().optional(),
        minTicketSize: z.number().optional(),
        investmentTypes: z.array(z.string()).optional(),
        roundGeography: z.string().optional(),
        roundSectors: z.array(z.string()).optional(),
        tweetPitch: z.string().optional(),
        tractionSummary: z.string().optional(),
        unfairAdvantage: z.string().optional(),
        preferredInvestorTypes: z.array(z.string()).optional(),
        startupId: z.number().optional(),
      }),
      responses: {
        200: z.object({
          startupAirtableId: z.string(),
          fundingRoundAirtableId: z.string(),
          matches: z.array(z.any()),
        }),
        400: errorSchemas.validation,
      },
    },
    feedback: {
      method: 'POST' as const,
      path: '/api/investor-introductions/feedback' as const,
      input: z.object({
        investorAirtableId: z.string(),
        investorName: z.string().optional(),
        fundingRoundAirtableId: z.string(),
        startupName: z.string().optional(),
        startupId: z.number().optional(),
        rating: z.enum(["up", "down"]),
        reason: z.string().optional(),
        totalScore: z.number().optional(),
      }),
      responses: { 200: z.any() },
    },
    getFeedback: {
      method: 'GET' as const,
      path: '/api/investor-introductions/feedback/:roundId' as const,
      responses: { 200: z.array(z.any()) },
    },
    requestIntro: {
      method: 'POST' as const,
      path: '/api/investor-introductions/request' as const,
      input: z.object({
        fundingRoundData: z.any(),
        startupData: z.any(),
        startupId: z.number().optional(),
        investors: z.array(z.object({
          investorAirtableId: z.string(),
          investorName: z.string(),
          investorEmail: z.string().optional(),
          matchScore: z.number().optional(),
        })).min(1).max(10),
      }),
      responses: {
        200: z.any(),
        400: errorSchemas.validation,
      },
    },
    getRequests: {
      method: 'GET' as const,
      path: '/api/investor-introductions/requests' as const,
      responses: { 200: z.array(z.any()) },
    },
  },
  assumptions: {
    list: {
      method: 'GET' as const,
      path: '/api/startups/:startupId/assumptions' as const,
      responses: {
        200: z.array(z.any()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/startups/:startupId/assumptions' as const,
      input: z.object({
        hypothesis: z.string().min(1),
        source: z.string().optional(),
        dimension: z.string().optional(),
        confidence: z.number().min(0).max(100).optional(),
        impactIfWrong: z.number().int().min(0).max(10).optional(),
      }),
      responses: {
        201: z.custom<typeof assumptions.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/assumptions/:id' as const,
      input: z.object({
        turnDecision: z.enum(["Persevere", "Pivot", "Perish"]).optional(),
        suggestedDecision: z.enum(["Persevere", "Pivot", "Perish"]).optional(),
        stage: z.enum(["belief", "experiment", "turn"]).optional(),
      }),
      responses: {
        200: z.custom<typeof assumptions.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/assumptions/:id' as const,
      responses: {
        200: z.object({ success: z.boolean() }),
      },
    },
  },
  experiments: {
    list: {
      method: 'GET' as const,
      path: '/api/assumptions/:assumptionId/experiments' as const,
      responses: {
        200: z.array(z.any()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/assumptions/:assumptionId/experiments' as const,
      input: z.object({
        name: z.string().min(1),
        technique: z.string().min(1),
        hypothesisIf: z.string().optional(),
        hypothesisThen: z.string().optional(),
        hypothesisBecause: z.string().optional(),
        successMetric: z.string().optional(),
        estimatedCost: z.string().optional(),
        duration: z.string().optional(),
        sampleSize: z.string().optional(),
        preCommitAnswer: z.string().optional(),
        deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Deadline must be YYYY-MM-DD format"),
      }),
      responses: {
        201: z.custom<typeof experiments.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/experiments/:experimentId' as const,
      input: z.object({
        technique: z.string().min(1).optional(),
        hypothesisIf: z.string().optional(),
        hypothesisThen: z.string().optional(),
        hypothesisBecause: z.string().optional(),
        successMetric: z.string().optional(),
        estimatedCost: z.string().optional(),
        duration: z.string().optional(),
        sampleSize: z.string().optional(),
        preCommitAnswer: z.string().optional(),
        actualMetricValue: z.string().optional(),
        actualOutcomeNotes: z.string().optional(),
        deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Deadline must be YYYY-MM-DD format").optional(),
      }),
      responses: {
        200: z.custom<typeof experiments.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    submitResults: {
      method: 'POST' as const,
      path: '/api/experiments/:experimentId/submit-results' as const,
      input: z.object({
        actualMetricValue: z.string().min(1, "Actual metric value is required"),
        actualOutcomeNotes: z.string().optional(),
      }),
      responses: {
        200: z.object({
          experiment: z.custom<typeof experiments.$inferSelect>(),
          suggestedDecision: z.enum(["Persevere", "Pivot", "Perish"]),
          rationale: z.string(),
        }),
        404: errorSchemas.notFound,
      },
    },
  },
  admin: {
    moduleAccess: {
      get: {
        method: 'GET' as const,
        path: '/api/admin/startup-module-access/:startupId' as const,
        responses: { 200: z.array(z.any()) },
      },
      grant: {
        method: 'POST' as const,
        path: '/api/admin/startup-module-access' as const,
        input: z.object({
          startupId: z.number(),
          moduleId: z.number(),
        }),
        responses: { 200: z.any() },
      },
      revoke: {
        method: 'DELETE' as const,
        path: '/api/admin/startup-module-access/:startupId/:moduleId' as const,
        responses: { 200: z.object({ success: z.boolean() }) },
      },
    },
    seed: {
        method: 'POST' as const,
        path: '/api/admin/seed' as const,
        responses: {
            200: z.object({ message: z.string() })
        }
    },
    checkAdmin: {
      method: 'GET' as const,
      path: '/api/admin/check' as const,
      responses: {
        200: z.object({ isAdmin: z.boolean() }),
      },
    },
    allStartups: {
      method: 'GET' as const,
      path: '/api/admin/startups' as const,
      responses: {
        200: z.array(z.any()),
      },
    },
    progressSnapshot: {
      method: 'GET' as const,
      path: '/api/admin/progress-snapshot' as const,
      responses: {
        200: z.array(z.any()),
      },
    },
    milestones: {
      list: {
        method: 'GET' as const,
        path: '/api/admin/milestones' as const,
        responses: { 200: z.array(z.any()) },
      },
      create: {
        method: 'POST' as const,
        path: '/api/admin/milestones' as const,
        input: z.object({
          title: z.string().min(1),
          description: z.string(),
          tagline: z.string().optional(),
          stage: z.string().min(1),
          icon: z.string(),
          gradient: z.string(),
          accentColor: z.string(),
          requirements: z.record(z.number()),
          category: z.string().optional(),
          dependencies: z.array(z.number()).optional(),
          groupId: z.number().nullable().optional(),
          displayOrder: z.number().optional(),
        }),
        responses: { 201: z.any() },
      },
      update: {
        method: 'PATCH' as const,
        path: '/api/admin/milestones/:id' as const,
        input: z.object({
          title: z.string().min(1),
          description: z.string(),
          tagline: z.string().optional(),
          stage: z.string().min(1),
          icon: z.string(),
          gradient: z.string(),
          accentColor: z.string(),
          requirements: z.record(z.number()),
          category: z.string().optional(),
          dependencies: z.array(z.number()).optional(),
          groupId: z.number().nullable().optional(),
          displayOrder: z.number().optional(),
        }).partial(),
        responses: { 200: z.any() },
      },
      delete: {
        method: 'DELETE' as const,
        path: '/api/admin/milestones/:id' as const,
        responses: { 200: z.object({ success: z.boolean() }) },
      },
    },
    milestoneCategories: {
      list: {
        method: 'GET' as const,
        path: '/api/admin/milestone-categories' as const,
        responses: { 200: z.array(z.any()) },
      },
      create: {
        method: 'POST' as const,
        path: '/api/admin/milestone-categories' as const,
        input: z.object({
          value: z.string().min(1),
          label: z.string().min(1),
          gradient: z.string(),
          accentColor: z.string(),
          displayOrder: z.number().optional(),
        }),
        responses: { 201: z.any() },
      },
      update: {
        method: 'PATCH' as const,
        path: '/api/admin/milestone-categories/:id' as const,
        input: z.object({
          value: z.string().min(1),
          label: z.string().min(1),
          gradient: z.string(),
          accentColor: z.string(),
          displayOrder: z.number().optional(),
        }).partial(),
        responses: { 200: z.any() },
      },
      delete: {
        method: 'DELETE' as const,
        path: '/api/admin/milestone-categories/:id' as const,
        responses: { 200: z.object({ success: z.boolean() }) },
      },
    },
    milestoneStages: {
      list: {
        method: 'GET' as const,
        path: '/api/admin/milestone-stages' as const,
        responses: { 200: z.array(z.any()) },
      },
      create: {
        method: 'POST' as const,
        path: '/api/admin/milestone-stages' as const,
        input: z.object({
          value: z.string().min(1),
          label: z.string().min(1),
          description: z.string().optional(),
          displayOrder: z.number().optional(),
        }),
        responses: { 201: z.any() },
      },
      update: {
        method: 'PATCH' as const,
        path: '/api/admin/milestone-stages/:id' as const,
        input: z.object({
          value: z.string().min(1),
          label: z.string().min(1),
          description: z.string().optional(),
          displayOrder: z.number().optional(),
        }).partial(),
        responses: { 200: z.any() },
      },
      delete: {
        method: 'DELETE' as const,
        path: '/api/admin/milestone-stages/:id' as const,
        responses: { 200: z.object({ success: z.boolean() }) },
      },
    },
    introductions: {
      list: {
        method: 'GET' as const,
        path: '/api/admin/introductions' as const,
        responses: { 200: z.array(z.any()) },
      },
      approve: {
        method: 'POST' as const,
        path: '/api/admin/introductions/:itemId/approve' as const,
        input: z.object({
          adminNote: z.string().min(1),
          investorEmail: z.string().email(),
          contactPersonId: z.string().optional(),
          contactPersonName: z.string().optional(),
          emailBody: z.string().optional(),
          sendMethod: z.enum(["platform", "mailto"]).optional(),
        }),
        responses: { 200: z.any() },
      },
      reject: {
        method: 'POST' as const,
        path: '/api/admin/introductions/:itemId/reject' as const,
        input: z.object({
          adminNote: z.string().optional(),
        }),
        responses: { 200: z.any() },
      },
      noConnection: {
        method: 'POST' as const,
        path: '/api/admin/introductions/:itemId/no-connection' as const,
        input: z.object({
          adminNote: z.string().optional(),
        }),
        responses: { 200: z.any() },
      },
      personalIntro: {
        method: 'POST' as const,
        path: '/api/admin/introductions/:itemId/personal-intro' as const,
        input: z.object({
          adminNote: z.string().optional(),
        }),
        responses: { 200: z.any() },
      },
    },
    users: {
      list: {
        method: 'GET' as const,
        path: '/api/admin/users' as const,
        responses: { 200: z.array(z.any()) },
      },
      updateRole: {
        method: 'PATCH' as const,
        path: '/api/admin/users/:id/role' as const,
        input: z.object({
          adminRole: z.string().nullable(),
        }),
        responses: { 200: z.any() },
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
