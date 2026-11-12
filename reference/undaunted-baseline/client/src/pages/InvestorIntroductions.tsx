import { useState, useMemo, useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useActiveStartupId, useStartup } from "@/hooks/use-startups";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/posthog";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

import {
  Handshake, Search, ThumbsUp, ThumbsDown, ExternalLink, Globe,
  DollarSign, Target, Loader2, ChevronDown, ChevronUp, Building2,
  MapPin, Filter, Star, Briefcase, Lock, Pencil, TrendingUp,
  CheckCircle2, XCircle, Clock, Mail, Send, X, ListChecks, Info,
  Sparkles, ArrowRight
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { EditStartupDialog, type EditableStartup } from "@/components/Sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const ELIGIBLE_CONNECTION_STRENGTHS = ["good", "strong", "excellent", "very strong"];
const MIN_CONNECTION_STRENGTH_NUMERIC = 3;

function isConnectionEligible(investor: any): boolean {
  const raw = investor?.connectionStrength;
  if (raw == null) return false;

  if (typeof raw === "number") return raw >= MIN_CONNECTION_STRENGTH_NUMERIC;

  if (typeof raw === "string") {
    const trimmed = raw.toLowerCase().trim();
    if (ELIGIBLE_CONNECTION_STRENGTHS.includes(trimmed)) return true;
    const numMatch = trimmed.match(/(\d+)/);
    if (numMatch) return parseInt(numMatch[1], 10) >= MIN_CONNECTION_STRENGTH_NUMERIC;
  }

  return false;
}

const formatCurrency = (value: number | undefined | null): string => {
  if (value == null || isNaN(value)) return "";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);
};

const formatTicketRange = (min: number | undefined | null, max: number | undefined | null): string => {
  const parts: string[] = [];
  if (min != null && !isNaN(min)) parts.push(formatCurrency(min));
  if (max != null && !isNaN(max)) parts.push(formatCurrency(max));
  if (parts.length === 2) return `${parts[0]} - ${parts[1]}`;
  if (parts.length === 1) return parts[0];
  return "";
};

const getScoreColor = (score: number) => {
  if (score > 70) return "bg-green-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
};

const getScoreBadgeClasses = (score: number) => {
  if (score > 70) return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20";
  if (score >= 50) return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
  return "bg-muted text-muted-foreground";
};

const ROUND_STAGES = ["Pre-seed", "Seed", "Series A", "Series B", "Post-Series B", "Growth"];
const INVESTMENT_TYPES = ["Equity", "SAFE", "Convertible Note", "Grant", "Revenue Based"];
const GEOGRAPHIES = ["United Kingdom", "Europe", "North America", "Global", "Asia Pacific", "Middle East & Africa", "Latin America"];
const SECTORS = ["Carbon Economy", "Built Environment", "Energy", "SaaS", "Food & Agriculture", "Transport", "Nature", "Water", "Materials"];
const INVESTOR_TYPE_OPTIONS = ["VC", "Angel", "Family Office", "Corporate VC", "Accelerator", "Government / Grant Body", "Impact Fund", "Fund of Funds"];

const submitFormSchema = z.object({
  startupName: z.string().min(1, "Startup name is required"),
  description: z.string().min(1, "Description is required"),
  climateProblem: z.string().optional(),
  solutionDescription: z.string().optional(),
  businessModel: z.string().optional(),
  targetMarket: z.string().optional(),
  competitors: z.string().optional(),
  websiteUrl: z.string().optional(),
  roundStage: z.string().min(1, "Round stage is required"),
  amountRaising: z.number().optional(),
  minTicketSize: z.number().optional(),
  investmentTypes: z.array(z.string()).optional(),
  roundGeography: z.string().optional(),
  roundSectors: z.array(z.string()).optional(),
  tweetPitch: z.string().max(280, "Max 280 characters").optional(),
  tractionSummary: z.string().optional(),
  unfairAdvantage: z.string().optional(),
  preferredInvestorTypes: z.array(z.string()).optional(),
});

type SubmitFormValues = z.infer<typeof submitFormSchema>;

function CheckboxGroup({ options, value, onChange, testIdPrefix }: {
  options: string[];
  value: string[];
  onChange: (val: string[]) => void;
  testIdPrefix: string;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((opt) => (
        <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            data-testid={`checkbox-${testIdPrefix}-${opt.toLowerCase().replace(/\s+/g, "-")}`}
            checked={value.includes(opt)}
            onCheckedChange={(checked) => {
              if (checked) onChange([...value, opt]);
              else onChange(value.filter((v) => v !== opt));
            }}
          />
          {opt}
        </label>
      ))}
    </div>
  );
}

const emptyFormValues: SubmitFormValues = {
  startupName: "",
  description: "",
  climateProblem: "",
  solutionDescription: "",
  businessModel: "",
  targetMarket: "",
  competitors: "",
  websiteUrl: "",
  roundStage: "",
  amountRaising: undefined,
  minTicketSize: undefined,
  investmentTypes: [],
  roundGeography: "",
  roundSectors: [],
  tweetPitch: "",
  tractionSummary: "",
  unfairAdvantage: "",
  preferredInvestorTypes: [],
};

function StartupDetailsSummary({ startup, onEdit }: { startup: EditableStartup; onEdit: () => void }) {
  const fields = [
    { label: "Description", value: startup.description },
    { label: "Climate Problem", value: startup.climateProblem },
    { label: "Solution", value: startup.solutionDescription },
    { label: "Business Model", value: startup.businessModel },
    { label: "Target Market", value: startup.targetMarket },
    { label: "Competitors", value: startup.competitors },
    { label: "Website", value: startup.websiteUrl },
  ];
  const filledFields = fields.filter(f => f.value);
  const totalFields = fields.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Startup Details</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={onEdit} data-testid="button-edit-startup-details">
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{filledFields.length}/{totalFields} fields completed</p>
      </CardHeader>
      <CardContent>
        {filledFields.length === 0 ? (
          <p className="text-sm text-muted-foreground">No startup details added yet. Click Edit to add your company information.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            {fields.map((f) => (
              <div key={f.label} className="space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground">{f.label}</p>
                <p className="text-sm text-foreground truncate" data-testid={`text-summary-${f.label.toLowerCase().replace(/\s+/g, "-")}`}>
                  {f.value || <span className="text-muted-foreground italic">Not set</span>}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SubmitRoundTab({ onSuccess, initialValues }: { onSuccess: (data: any, formValues: SubmitFormValues) => void; initialValues?: SubmitFormValues | null }) {
  const { toast } = useToast();
  const { startupId } = useActiveStartupId();
  const { data: activeStartup } = useStartup(startupId || 0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const form = useForm<SubmitFormValues>({
    resolver: zodResolver(submitFormSchema),
    defaultValues: initialValues || emptyFormValues,
  });

  useEffect(() => {
    if (initialValues) {
      form.reset(initialValues);
    }
  }, [initialValues]);

  useEffect(() => {
    if (activeStartup) {
      form.setValue("startupName", activeStartup.name || "");
      form.setValue("description", activeStartup.description || "");
      form.setValue("climateProblem", activeStartup.climateProblem || "");
      form.setValue("solutionDescription", activeStartup.solutionDescription || "");
      form.setValue("businessModel", activeStartup.businessModel || "");
      form.setValue("targetMarket", activeStartup.targetMarket || "");
      form.setValue("competitors", activeStartup.competitors || "");
      form.setValue("websiteUrl", activeStartup.websiteUrl || "");
    }
  }, [activeStartup]);

  const [matchProgress, setMatchProgress] = useState<{ phase: string; current: number; total: number; message: string } | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [matchStartTime, setMatchStartTime] = useState<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  const resetMatchState = () => {
    setIsMatching(false);
    setMatchProgress(null);
    setMatchStartTime(null);
  };

  const startMatching = async (values: SubmitFormValues) => {
    if (isMatching) return;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsMatching(true);
    setMatchStartTime(Date.now());
    setMatchProgress({ phase: "filtering", current: 0, total: 1, message: "Starting..." });

    try {
      const res = await apiRequest("POST", "/api/investor-introductions/submit", { ...values, startupId: startupId || undefined });
      trackEvent("investor_match_submitted", { startupId });
      const { jobId } = await res.json();

      const es = new EventSource(`/api/investor-introductions/match-progress/${jobId}`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const progress = JSON.parse(event.data);
          setMatchProgress(progress);

          if (progress.phase === "complete") {
            es.close();
            eventSourceRef.current = null;
            fetch(`/api/investor-introductions/match-result/${jobId}`, { credentials: "include" })
              .then(r => r.json())
              .then(data => {
                resetMatchState();
                toast({ title: "Matching complete", description: `Found ${data.matches?.length || 0} investor matches.` });
                onSuccess(data, form.getValues());
              })
              .catch(err => {
                resetMatchState();
                toast({ title: "Failed to load results", description: err.message, variant: "destructive" });
              });
          } else if (progress.phase === "error") {
            es.close();
            eventSourceRef.current = null;
            resetMatchState();
            toast({ title: "Matching failed", description: progress.message, variant: "destructive" });
          }
        } catch {}
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        const pollForResult = async (retries: number) => {
          for (let i = 0; i < retries; i++) {
            await new Promise(r => setTimeout(r, 2000));
            try {
              const resultRes = await fetch(`/api/investor-introductions/match-result/${jobId}`, { credentials: "include" });
              if (resultRes.ok) {
                const data = await resultRes.json();
                if (data.matches) {
                  resetMatchState();
                  toast({ title: "Matching complete", description: `Found ${data.matches?.length || 0} investor matches.` });
                  onSuccess(data, form.getValues());
                  return;
                }
              } else if (resultRes.status === 202) {
                setMatchProgress((await resultRes.json()).progress);
                continue;
              }
            } catch {}
          }
          resetMatchState();
          toast({ title: "Connection lost", description: "Please try again.", variant: "destructive" });
        };
        pollForResult(15);
      };
    } catch (err: any) {
      resetMatchState();
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    }
  };

  if (isMatching && matchProgress) {
    const pct = matchProgress.total > 0
      ? Math.round((matchProgress.current / matchProgress.total) * 100)
      : 0;
    const elapsed = matchStartTime ? (Date.now() - matchStartTime) / 1000 : 0;
    const estimatedTotal = pct > 5 ? (elapsed / (pct / 100)) : 0;
    const remaining = estimatedTotal > 0 ? Math.max(0, Math.round(estimatedTotal - elapsed)) : 0;

    const phaseLabels: Record<string, string> = {
      "filtering": "Filtering investors",
      "ai-scoring": "AI analysis in progress",
      "finalizing": "Finalising results",
      "complete": "Done!",
    };

    return (
      <Card className="p-8" data-testid="card-match-progress">
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-xl font-semibold text-foreground" data-testid="text-match-phase">
              {phaseLabels[matchProgress.phase] || matchProgress.phase}
            </h3>
            <p className="text-sm text-muted-foreground" data-testid="text-match-detail">
              {matchProgress.message}
            </p>
          </div>
          <div className="w-full max-w-md space-y-2">
            <Progress value={pct} className="h-3" data-testid="progress-matching" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span data-testid="text-match-pct">{pct}%</span>
              {remaining > 0 && pct > 5 && (
                <span data-testid="text-match-eta">~{remaining}s remaining</span>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const startupForEdit: EditableStartup | null = activeStartup ? {
    id: activeStartup.id,
    name: activeStartup.name,
    description: activeStartup.description || null,
    logoUrl: activeStartup.logoUrl || null,
    climateProblem: activeStartup.climateProblem || null,
    solutionDescription: activeStartup.solutionDescription || null,
    climateType: activeStartup.climateType || null,
    productType: activeStartup.productType || null,
    businessModel: activeStartup.businessModel || null,
    targetMarket: activeStartup.targetMarket || null,
    competitors: activeStartup.competitors || null,
    websiteUrl: activeStartup.websiteUrl || null,
  } : null;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => startMatching(v))} className="space-y-8" autoComplete="off">
        {startupForEdit ? (
          <>
            <StartupDetailsSummary startup={startupForEdit} onEdit={() => setEditDialogOpen(true)} />
            <EditStartupDialog
              open={editDialogOpen}
              onOpenChange={setEditDialogOpen}
              startup={startupForEdit}
              initialTab="details"
            />
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Startup Details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">No startup selected. Please select a startup first.</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Funding Round</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField control={form.control} name="roundStage" render={({ field }) => (
              <FormItem>
                <FormLabel>Round Stage *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger data-testid="select-round-stage"><SelectValue placeholder="Select stage" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {ROUND_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid md:grid-cols-2 gap-4">
              <FormField control={form.control} name="amountRaising" render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount Raising (GBP)</FormLabel>
                  <FormControl>
                    <Input data-testid="input-amount-raising" type="number" placeholder="e.g. 500000"
                      value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
                  </FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="minTicketSize" render={({ field }) => (
                <FormItem>
                  <FormLabel>Min Ticket Size (GBP)</FormLabel>
                  <FormControl>
                    <Input data-testid="input-min-ticket" type="number" placeholder="e.g. 25000"
                      value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
                  </FormControl>
                </FormItem>
              )} />
            </div>
            <div>
              <Label>Investment Types</Label>
              <FormField control={form.control} name="investmentTypes" render={({ field }) => (
                <FormItem className="mt-2">
                  <CheckboxGroup options={INVESTMENT_TYPES} value={field.value || []} onChange={field.onChange} testIdPrefix="investment-type" />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="roundGeography" render={({ field }) => (
              <FormItem>
                <FormLabel>Round Geography</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger data-testid="select-round-geography"><SelectValue placeholder="Select geography" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {GEOGRAPHIES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <div>
              <Label>Sectors</Label>
              <FormField control={form.control} name="roundSectors" render={({ field }) => (
                <FormItem className="mt-2">
                  <CheckboxGroup options={SECTORS} value={field.value || []} onChange={field.onChange} testIdPrefix="sector" />
                </FormItem>
              )} />
            </div>
            <div>
              <Label>Preferred Investor Types</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">Select the types of investors you'd like to be matched with. Leave empty to see all types.</p>
              <FormField control={form.control} name="preferredInvestorTypes" render={({ field }) => (
                <FormItem>
                  <CheckboxGroup options={INVESTOR_TYPE_OPTIONS} value={field.value || []} onChange={field.onChange} testIdPrefix="investor-type-pref" />
                </FormItem>
              )} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Pitch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField control={form.control} name="tweetPitch" render={({ field }) => (
              <FormItem>
                <FormLabel>Tweet Pitch (max 280 chars)</FormLabel>
                <FormControl><Textarea data-testid="input-tweet-pitch" placeholder="Your elevator pitch in 280 characters" maxLength={280} {...field} /></FormControl>
                <p className="text-xs text-muted-foreground">{field.value?.length || 0}/280</p>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="tractionSummary" render={({ field }) => (
              <FormItem>
                <FormLabel>Traction Summary</FormLabel>
                <FormControl><Textarea data-testid="input-traction-summary" placeholder="Key traction metrics and milestones" {...field} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="unfairAdvantage" render={({ field }) => (
              <FormItem>
                <FormLabel>Unfair Advantage</FormLabel>
                <FormControl><Textarea data-testid="input-unfair-advantage" placeholder="What gives you an edge?" {...field} /></FormControl>
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="w-full" data-testid="button-submit-round">
          Submit & Run Matching
        </Button>
      </form>
    </Form>
  );
}

const SCORE_DIMENSIONS = [
  { key: "stageMatch", label: "Stage", max: 20, rawMax: 100 },
  { key: "ticketSizeMatch", label: "Ticket", max: 15, rawMax: 100 },
  { key: "sectorOverlap", label: "Sector", max: 20, rawMax: 100 },
  { key: "geographyMatch", label: "Geo", max: 10, rawMax: 100 },
  { key: "instrumentMatch", label: "Instruments", max: 5, rawMax: 100 },
  { key: "semanticScore", label: "AI", max: 30, rawMax: 100 },
];

function ScorePopup({ scoreBreakdown, matchReasons, aiInsight }: { scoreBreakdown: any; matchReasons?: string[]; aiInsight?: string }) {
  return (
    <div className="w-72 space-y-3">
      <p className="text-xs font-semibold text-foreground">Score Breakdown</p>
      <div className="space-y-1.5">
        {SCORE_DIMENSIONS.map((dim) => {
          const rawVal = scoreBreakdown?.[dim.key] ?? 0;
          const weighted = (rawVal / dim.rawMax) * dim.max;
          const pct = dim.rawMax > 0 ? Math.min(100, (rawVal / dim.rawMax) * 100) : 0;
          return (
            <div key={dim.key} className="flex items-center gap-2 text-xs">
              <span className="w-20 text-muted-foreground">{dim.label}</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full">
                <div className={`h-full rounded-full ${getScoreColor(pct)}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="w-10 text-right tabular-nums text-muted-foreground">{parseFloat(weighted.toFixed(1))}/{dim.max}</span>
            </div>
          );
        })}
      </div>
      {matchReasons && matchReasons.length > 0 && (
        <div className="pt-2 border-t">
          <ul className="space-y-0.5">
            {matchReasons.map((r: string, i: number) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                <span className="text-green-500 mt-0.5">&#8226;</span>{r}
              </li>
            ))}
          </ul>
        </div>
      )}
      {aiInsight && (
        <div className="pt-2 border-t">
          <p className="text-xs italic text-muted-foreground line-clamp-4">{aiInsight}</p>
        </div>
      )}
    </div>
  );
}

const INITIAL_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
];

function getInitialColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return INITIAL_COLORS[Math.abs(hash) % INITIAL_COLORS.length];
}

function getIntroStatusBadge(status: string) {
  switch (status) {
    case "pending": return { label: "Pending Review", icon: Clock, className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
    case "approved": return { label: "Approved", icon: CheckCircle2, className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
    case "email_sent": return { label: "Email Sent", icon: Mail, className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
    case "confirmed": return { label: "Confirmed", icon: CheckCircle2, className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
    case "denied": return { label: "Declined", icon: XCircle, className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
    case "rejected": return { label: "Rejected", icon: XCircle, className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" };
    case "personal_intro": return { label: "Intro Made", icon: Handshake, className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
    default: return null;
  }
}

function InvestorCard({ investor, matchResult, isTopMatch, onExpand, expanded, onFeedback, feedback, feedbackPending, selectable, selected, onSelect, introStatus }: {
  investor: any;
  matchResult?: any;
  isTopMatch?: boolean;
  onExpand: () => void;
  expanded: boolean;
  onFeedback?: (rating: "up" | "down", reason?: string) => void;
  feedback?: { rating: "up" | "down"; reason?: string };
  feedbackPending?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (checked: boolean) => void;
  introStatus?: string;
}) {
  const [showScorePopup, setShowScorePopup] = useState(false);
  const [feedbackReason, setFeedbackReason] = useState("");
  const [logoError, setLogoError] = useState(false);
  const score = matchResult?.scoreBreakdown?.totalScore ?? null;
  const sectorFocus = Array.isArray(investor.sectorFocus) ? investor.sectorFocus : investor.sectorFocus ? [investor.sectorFocus] : [];
  const investorTypes = Array.isArray(investor.investorType) ? investor.investorType : investor.investorType ? [investor.investorType] : [];
  const stages = Array.isArray(investor.investmentStage) ? investor.investmentStage : investor.investmentStage ? [investor.investmentStage] : [];
  const regions = Array.isArray(investor.regionalFocus) ? investor.regionalFocus : investor.regionalFocus ? [investor.regionalFocus] : [];
  const instruments = investor.investmentInstruments || investor.instruments || [];
  const logoSrc = !logoError ? (investor.logoDevUrl || investor.logoUrl) : null;
  const orgName = investor.organisation || investor.organisationName || investor.name || "";
  const initial = orgName.charAt(0).toUpperCase();
  const hqLocation = investor.hqLocation && !investor.hqLocation.includes("Unknown") ? investor.hqLocation.split(",")[0] : null;

  return (
    <Card
      className={`transition-all cursor-pointer hover-elevate ${isTopMatch ? "ring-2 ring-primary/60" : ""} ${selected ? "ring-2 ring-primary bg-primary/5" : ""}`}
      data-testid={`card-investor-${investor.id || investor.airtableId}`}
      onClick={onExpand}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {selectable && !introStatus && isConnectionEligible(investor) && (
            <div
              className={`flex-shrink-0 flex flex-col items-center gap-1 pt-0.5 px-1.5 py-1.5 rounded-xl transition-colors ${selected ? "bg-primary/10" : "hover:bg-muted"}`}
              onClick={(e) => e.stopPropagation()}
              data-testid={`select-area-${investor.id || investor.airtableId}`}
            >
              <Checkbox
                checked={selected}
                onCheckedChange={(checked) => onSelect?.(!!checked)}
                className="h-5 w-5 border border-primary/60 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                data-testid={`checkbox-select-${investor.id || investor.airtableId}`}
              />
              <span className="text-[10px] font-medium text-primary/70 leading-none select-none">Intro</span>
            </div>
          )}
          {selectable && !introStatus && !isConnectionEligible(investor) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-0.5 px-1.5 py-1.5 rounded-xl opacity-40" onClick={(e) => e.stopPropagation()}>
                    <Info className="h-4 w-4 text-muted-foreground" data-testid={`info-no-intro-${investor.id || investor.airtableId}`} />
                    <span className="text-[10px] text-muted-foreground leading-none select-none">N/A</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[200px]">
                  <p className="text-xs">No direct connection — introduction not available for this investor</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {logoSrc ? (
            <div className="h-10 w-10 rounded-xl bg-white dark:bg-muted border border-border/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
              <img
                src={logoSrc}
                alt=""
                className="max-h-[32px] max-w-[32px] object-contain"
                loading="lazy"
                onError={() => setLogoError(true)}
              />
            </div>
          ) : (
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${getInitialColor(orgName)} text-white font-bold text-base`}>
              {initial}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm leading-tight truncate" data-testid={`text-investor-name-${investor.id || investor.airtableId}`}>
                {orgName}
              </h3>
              {isTopMatch && <Star className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />}
            </div>
            {hqLocation && (
              <p className="text-xs text-muted-foreground mt-0.5">{hqLocation}</p>
            )}
          </div>
          {score != null && (
            <div
              className="relative flex-shrink-0"
              onMouseEnter={() => setShowScorePopup(true)}
              onMouseLeave={() => setShowScorePopup(false)}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`rounded-full h-11 w-11 flex items-center justify-center text-base font-bold text-white cursor-default ${getScoreColor(score)}`} data-testid={`score-badge-${investor.id || investor.airtableId}`}>
                {Math.round(score)}
              </div>
              {showScorePopup && (
                <div className="absolute right-0 top-full mt-2 z-50 bg-card rounded-xl border border-card-border elevation-3 p-3" onClick={(e) => e.stopPropagation()}>
                  <ScorePopup
                    scoreBreakdown={matchResult?.scoreBreakdown}
                    matchReasons={matchResult?.matchReasons}
                    aiInsight={matchResult?.aiInsight}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {(investorTypes.length > 0 || introStatus) && (
          <div className="flex flex-wrap gap-1 mt-2">
            {introStatus && (() => {
              const badge = getIntroStatusBadge(introStatus);
              if (!badge) return null;
              const Icon = badge.icon;
              return (
                <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
                  <Icon className="h-3 w-3" />
                  {badge.label}
                </span>
              );
            })()}
            {investorTypes.map((t: string) => (
              <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate">{t}</Badge>
            ))}
          </div>
        )}

        {investor.description && (
          <p className={`text-xs text-muted-foreground mt-2${expanded ? " leading-relaxed" : " line-clamp-2"}`}>{investor.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
          {stages.length > 0 && (
            <span className="flex items-center gap-1">
              <Target className="h-3 w-3 flex-shrink-0" />
              {stages.slice(0, 2).join(", ")}{stages.length > 2 ? ` +${stages.length - 2}` : ""}
            </span>
          )}
          {(investor.minTicketSize || investor.maxTicketSize) && (
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 flex-shrink-0" />
              {formatTicketRange(investor.minTicketSize, investor.maxTicketSize)}
            </span>
          )}
          {regions.length > 0 && (
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3 flex-shrink-0" />
              {regions.slice(0, 2).join(", ")}{regions.length > 2 ? ` +${regions.length - 2}` : ""}
            </span>
          )}
        </div>

        {sectorFocus.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {(expanded ? sectorFocus : sectorFocus.slice(0, 3)).map((s: string) => <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate">{s}</Badge>)}
            {!expanded && sectorFocus.length > 3 && <span className="text-[10px] text-muted-foreground self-center">+{sectorFocus.length - 3}</span>}
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
          {onFeedback && matchResult ? (
            <div className="flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant={feedback?.rating === "up" ? "default" : "ghost"}
                data-testid={`button-thumbs-up-${investor.id || investor.airtableId}`}
                onClick={() => { if (!feedback?.rating) onFeedback("up"); }}
                disabled={feedbackPending}
                className="h-7 w-7 p-0"
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant={feedback?.rating === "down" ? "destructive" : "ghost"}
                data-testid={`button-thumbs-down-${investor.id || investor.airtableId}`}
                onClick={() => { if (!feedback?.rating) onFeedback("down"); }}
                disabled={feedbackPending}
                className="h-7 w-7 p-0"
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </Button>
              {feedback?.rating && !feedback?.reason && (
                <div className="flex gap-1 ml-1">
                  <Input
                    placeholder={feedback.rating === "up" ? "What made this good?" : "Why not?"}
                    className="text-xs h-7 w-32"
                    value={feedbackReason}
                    onChange={(e) => setFeedbackReason(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`input-feedback-reason-${investor.id || investor.airtableId}`}
                  />
                  <Button size="sm" className="h-7 px-2 text-xs" onClick={() => onFeedback(feedback.rating, feedbackReason)} data-testid={`button-submit-feedback-${investor.id || investor.airtableId}`}>
                    Send
                  </Button>
                </div>
              )}
              {feedback?.reason && (
                <span className="text-[10px] text-muted-foreground ml-1 italic">Feedback sent</span>
              )}
            </div>
          ) : (
            <div />
          )}
          <button className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors" data-testid={`button-expand-${investor.id || investor.airtableId}`}>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Less" : "More"}
          </button>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-3" onClick={(e) => e.stopPropagation()}>
            {investor.investmentThesis && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Investment Thesis</p>
                <p className="text-xs text-muted-foreground leading-relaxed italic">{investor.investmentThesis}</p>
              </div>
            )}
            {Array.isArray(instruments) && instruments.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Instruments</p>
                <p className="text-xs">{instruments.join(", ")}</p>
              </div>
            )}
            {(matchResult?.aiInsight || investor.aiInsight) && (
              <div className="bg-muted/50 rounded-xl p-3 border-l border-primary/40">
                <p className="text-xs font-semibold text-muted-foreground mb-1">AI Insight</p>
                <p className="text-xs italic leading-relaxed">{matchResult?.aiInsight || investor.aiInsight}</p>
              </div>
            )}
            {investor.websiteUrl && (
              <a
                href={investor.websiteUrl.startsWith("http") ? investor.websiteUrl : `https://${investor.websiteUrl}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> Visit Website
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RoundSummaryBanner({ formValues, matchCount, onEdit, matchedAt }: { formValues: SubmitFormValues; matchCount: number; onEdit: () => void; matchedAt?: string | null }) {
  const sectors = formValues.roundSectors || [];

  const formatMatchDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className="bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
              <h3 className="font-semibold text-sm">{formValues.startupName}</h3>
              <Badge variant="default" className="no-default-hover-elevate no-default-active-elevate">{formValues.roundStage}</Badge>
              <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">{matchCount} matched</Badge>
              {matchedAt && (
                <span className="text-xs text-muted-foreground" data-testid="text-matched-at">
                  Matched {formatMatchDate(matchedAt)}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {formValues.amountRaising && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />Raising {formatCurrency(formValues.amountRaising)}
                </span>
              )}
              {formValues.minTicketSize && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />Min ticket {formatCurrency(formValues.minTicketSize)}
                </span>
              )}
              {formValues.roundGeography && (
                <span className="flex items-center gap-1">
                  <Globe className="h-3 w-3" />{formValues.roundGeography}
                </span>
              )}
            </div>
            {sectors.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {sectors.map((s) => <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate">{s}</Badge>)}
              </div>
            )}
            {formValues.preferredInvestorTypes && formValues.preferredInvestorTypes.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                <span className="text-[10px] text-muted-foreground mr-0.5">Preferred types:</span>
                {formValues.preferredInvestorTypes.map((t) => <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate">{t}</Badge>)}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 flex-shrink-0"
            onClick={onEdit}
            data-testid="button-edit-round"
          >
            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LockedDatabaseView({ onGoToSubmit }: { onGoToSubmit: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
        <Lock className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">Submit your round first</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        To see matched investors ranked by relevance, fill in your funding round details in the Submit Round tab. We'll score and rank all 350+ investors against your specific criteria.
      </p>
      <Button onClick={onGoToSubmit} data-testid="button-go-to-submit">
        <Briefcase className="h-4 w-4 mr-2" /> Go to Submit Round
      </Button>
    </div>
  );
}

function InvestorDatabaseTab({ matchResults, formValues, onEditRound, matchedAt }: { matchResults: any | null; formValues: SubmitFormValues | null; onEditRound: () => void; matchedAt?: string | null }) {
  const { startupId } = useActiveStartupId();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const hasMatches = !!matchResults?.matches;
  const [sortBy, setSortBy] = useState(hasMatches ? "score" : "name-asc");
  const [filterType, setFilterType] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterSector, setFilterSector] = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [feedbackState, setFeedbackState] = useState<Record<string, { rating: "up" | "down"; reason?: string }>>({});
  const [filterIntroAvailable, setFilterIntroAvailable] = useState(false);
  const [selectedInvestors, setSelectedInvestors] = useState<Set<string>>(new Set());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showIntroductions, setShowIntroductions] = useState(false);
  const [showIntroBanner, setShowIntroBanner] = useState(() => {
    try { return localStorage.getItem("hideIntroBanner") !== "true"; } catch { return true; }
  });

  const { data: investors, isLoading } = useQuery<any[]>({
    queryKey: ["/api/investor-introductions/investors"],
  });

  const feedbackMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/investor-introductions/feedback", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Feedback submitted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to submit feedback", description: error.message, variant: "destructive" });
    },
  });

  const { data: introRequests, isLoading: introLoading } = useQuery<any[]>({
    queryKey: ["/api/investor-introductions/requests", startupId],
    queryFn: async () => {
      const url = startupId
        ? `/api/investor-introductions/requests?startupId=${startupId}`
        : "/api/investor-introductions/requests";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch requests");
      return res.json();
    },
  });

  const requestIntroMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/investor-introductions/request", data);
      return res.json();
    },
    onSuccess: () => {
      trackEvent("investor_intro_requested", { startupId });
      toast({ title: "Introduction request submitted", description: "The Undaunted team will review your selections." });
      setSelectedInvestors(new Set());
      setShowConfirmDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/investor-introductions/requests", startupId] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to submit request", description: error.message, variant: "destructive" });
    },
  });

  const introStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!introRequests) return map;
    for (const req of introRequests) {
      for (const item of req.items || []) {
        const existing = map.get(item.investorAirtableId);
        if (!existing || item.status !== "rejected") {
          map.set(item.investorAirtableId, item.status);
        }
      }
    }
    return map;
  }, [introRequests]);

  const handleToggleSelect = (investorId: string, checked: boolean) => {
    setSelectedInvestors(prev => {
      const next = new Set(prev);
      if (checked && next.size < 10) {
        next.add(investorId);
      } else {
        next.delete(investorId);
      }
      return next;
    });
  };

  const handleSubmitRequest = () => {
    if (!investors || !formValues) return;
    const selected = investors.filter(inv => selectedInvestors.has(inv.id || inv.airtableId));
    requestIntroMutation.mutate({
      fundingRoundData: formValues,
      startupData: formValues,
      startupId: startupId || undefined,
      investors: selected.map(inv => {
        const invId = inv.id || inv.airtableId;
        const matchResult = matchMap.get(invId);
        return {
          investorAirtableId: invId,
          investorName: inv.organisation || inv.organisationName || inv.name || "",
          investorEmail: inv.emailAddress || inv.email || undefined,
          matchScore: matchResult?.scoreBreakdown?.totalScore ? Math.round(matchResult.scoreBreakdown.totalScore) : undefined,
        };
      }),
    });
  };

  const matchMap = useMemo(() => {
    if (!matchResults?.matches) return new Map();
    const map = new Map();
    matchResults.matches.forEach((m: any) => {
      const key = m.investorAirtableId || m.investor?.id || m.investor?.airtableId;
      if (key) map.set(key, m);
    });
    return map;
  }, [matchResults]);

  const filteredInvestors = useMemo(() => {
    if (!investors) return [];
    let list = [...investors];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((inv) => {
        const name = (inv.organisation || inv.organisationName || inv.name || "").toLowerCase();
        const desc = (inv.description || "").toLowerCase();
        const sectors = Array.isArray(inv.sectorFocus) ? inv.sectorFocus.join(" ").toLowerCase() : (inv.sectorFocus || "").toLowerCase();
        return name.includes(q) || desc.includes(q) || sectors.includes(q);
      });
    }

    if (filterType) {
      list = list.filter((inv) => {
        const types = Array.isArray(inv.investorType) ? inv.investorType : [inv.investorType];
        return types.some((t: string) => t === filterType);
      });
    }
    if (filterStage) {
      list = list.filter((inv) => {
        const stages = Array.isArray(inv.investmentStage) ? inv.investmentStage : [inv.investmentStage];
        return stages.some((s: string) => s === filterStage);
      });
    }
    if (filterSector) {
      list = list.filter((inv) => {
        const sectors = Array.isArray(inv.sectorFocus) ? inv.sectorFocus : [inv.sectorFocus];
        return sectors.some((s: string) => s === filterSector);
      });
    }
    if (filterRegion) {
      list = list.filter((inv) => {
        const regions = Array.isArray(inv.regionalFocus) ? inv.regionalFocus : [inv.regionalFocus];
        return regions.some((r: string) => r === filterRegion);
      });
    }

    if (filterIntroAvailable) {
      list = list.filter((inv) => isConnectionEligible(inv));
    }

    if (sortBy === "score" && matchMap.size > 0) {
      list.sort((a, b) => {
        const sa = matchMap.get(a.id || a.airtableId)?.scoreBreakdown?.totalScore ?? -1;
        const sb = matchMap.get(b.id || b.airtableId)?.scoreBreakdown?.totalScore ?? -1;
        return sb - sa;
      });
    } else if (sortBy === "name-desc") {
      list.sort((a, b) => (b.organisation || b.organisationName || b.name || "").localeCompare(a.organisation || a.organisationName || a.name || ""));
    } else {
      list.sort((a, b) => (a.organisation || a.organisationName || a.name || "").localeCompare(b.organisation || b.organisationName || b.name || ""));
    }

    return list;
  }, [investors, searchQuery, sortBy, filterType, filterStage, filterSector, filterRegion, filterIntroAvailable, matchMap]);

  const uniqueTypes = useMemo(() => {
    if (!investors) return [];
    const set = new Set<string>();
    investors.forEach((inv) => {
      const types = Array.isArray(inv.investorType) ? inv.investorType : inv.investorType ? [inv.investorType] : [];
      types.forEach((t: string) => { if (t) set.add(t); });
    });
    return Array.from(set).sort();
  }, [investors]);

  const uniqueStages = useMemo(() => {
    if (!investors) return [];
    const set = new Set<string>();
    investors.forEach((inv) => {
      const stages = Array.isArray(inv.investmentStage) ? inv.investmentStage : inv.investmentStage ? [inv.investmentStage] : [];
      stages.forEach((s: string) => { if (s) set.add(s); });
    });
    return Array.from(set).sort();
  }, [investors]);

  const uniqueSectors = useMemo(() => {
    if (!investors) return [];
    const set = new Set<string>();
    investors.forEach((inv) => {
      const sectors = Array.isArray(inv.sectorFocus) ? inv.sectorFocus : inv.sectorFocus ? [inv.sectorFocus] : [];
      sectors.forEach((s: string) => { if (s) set.add(s); });
    });
    return Array.from(set).sort();
  }, [investors]);

  const uniqueRegions = useMemo(() => {
    if (!investors) return [];
    const set = new Set<string>();
    investors.forEach((inv) => {
      const regions = Array.isArray(inv.regionalFocus) ? inv.regionalFocus : inv.regionalFocus ? [inv.regionalFocus] : [];
      regions.forEach((r: string) => { if (r) set.add(r); });
    });
    return Array.from(set).sort();
  }, [investors]);

  const handleFeedback = (investor: any, matchResult: any, rating: "up" | "down", reason?: string) => {
    const invId = investor.id || investor.airtableId;
    setFeedbackState((prev) => ({ ...prev, [invId]: { rating, reason } }));
    feedbackMutation.mutate({
      investorAirtableId: invId,
      investorName: investor.organisation || investor.organisationName || investor.name,
      fundingRoundAirtableId: matchResults?.fundingRoundAirtableId,
      startupName: formValues?.startupName,
      startupId: startupId,
      rating,
      reason,
      totalScore: matchResult?.scoreBreakdown?.totalScore || 0,
    });
  };

  if (!hasMatches || !formValues) {
    return <LockedDatabaseView onGoToSubmit={onEditRound} />;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RoundSummaryBanner
        formValues={formValues}
        matchCount={matchResults.matches.length}
        onEdit={onEditRound}
        matchedAt={matchedAt}
      />

      {showIntroBanner && (
        <Card className="bg-gradient-to-r from-primary/5 to-primary/[0.02]" data-testid="banner-intro-guidance">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5 h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-foreground mb-1">Request Investor Introductions</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Ready to connect? Here's how it works:
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">1</span> Select investors using the checkboxes</span>
                  <span className="flex items-center gap-1"><ArrowRight className="h-3 w-3 text-muted-foreground/40 hidden sm:block" /></span>
                  <span className="flex items-center gap-1"><span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">2</span> Review your choices</span>
                  <span className="flex items-center gap-1"><ArrowRight className="h-3 w-3 text-muted-foreground/40 hidden sm:block" /></span>
                  <span className="flex items-center gap-1"><span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">3</span> We'll reach out on your behalf</span>
                </div>
              </div>
              <button
                onClick={() => { setShowIntroBanner(false); try { localStorage.setItem("hideIntroBanner", "true"); } catch {} }}
                className="flex-shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                data-testid="button-dismiss-intro-banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {introRequests && introRequests.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <button
              className="w-full flex items-center justify-between"
              onClick={() => setShowIntroductions(!showIntroductions)}
              data-testid="button-toggle-introductions"
            >
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">My Introduction Requests</span>
                <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">{introRequests.length}</Badge>
              </div>
              {showIntroductions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showIntroductions && (
              <div className="mt-3 space-y-3">
                {introRequests.map((req: any) => (
                  <div key={req.id} className="rounded-xl border border-card-border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">
                        Submitted {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : ""}
                      </p>
                      <Badge variant="outline" className="text-[10px] no-default-hover-elevate no-default-active-elevate">{req.items?.length || 0} investors</Badge>
                    </div>
                    <div className="space-y-1.5">
                      {(req.items || []).map((item: any) => {
                        const badge = getIntroStatusBadge(item.status);
                        return (
                          <div key={item.id} className="flex items-center justify-between text-sm">
                            <span className="truncate">{item.investorName}</span>
                            {badge && (
                              <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${badge.className}`}>
                                {(() => { const Icon = badge.icon; return <Icon className="h-3 w-3" />; })()}
                                {badge.label}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-search-investors"
            placeholder="Search investors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-40" data-testid="select-sort-investors">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {matchMap.size > 0 && <SelectItem value="score">Match Score</SelectItem>}
            <SelectItem value="name-asc">Name A-Z</SelectItem>
            <SelectItem value="name-desc">Name Z-A</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground"><Filter className="h-3 w-3" /> Filters:</div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36" data-testid="select-filter-type"><SelectValue placeholder="Investor Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {uniqueTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="w-36" data-testid="select-filter-stage"><SelectValue placeholder="Stage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {uniqueStages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSector} onValueChange={setFilterSector}>
          <SelectTrigger className="w-36" data-testid="select-filter-sector"><SelectValue placeholder="Sector" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sectors</SelectItem>
            {uniqueSectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterRegion} onValueChange={setFilterRegion}>
          <SelectTrigger className="w-36" data-testid="select-filter-region"><SelectValue placeholder="Region" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            {uniqueRegions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          variant={filterIntroAvailable ? "default" : "outline"}
          size="sm"
          className={`gap-1.5 ${filterIntroAvailable ? "" : "text-muted-foreground"}`}
          onClick={() => setFilterIntroAvailable(!filterIntroAvailable)}
          data-testid="button-filter-intro-available"
        >
          <Handshake className="h-3.5 w-3.5" />
          Intro Available
        </Button>
        {(filterType || filterStage || filterSector || filterRegion || filterIntroAvailable) && (
          <Button variant="ghost" size="sm" data-testid="button-clear-filters" onClick={() => { setFilterType(""); setFilterStage(""); setFilterSector(""); setFilterRegion(""); setFilterIntroAvailable(false); }}>
            Clear
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{filteredInvestors.length} investor{filteredInvestors.length !== 1 ? "s" : ""}</p>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredInvestors.map((investor, index) => {
          const invId = investor.id || investor.airtableId;
          const matchResult = matchMap.get(invId);
          const isTopMatch = hasMatches && sortBy === "score" && index < 5;
          const existingIntroStatus = introStatusMap.get(invId);
          return (
            <InvestorCard
              key={invId}
              investor={investor}
              matchResult={matchResult}
              isTopMatch={isTopMatch}
              onExpand={() => setExpandedId(expandedId === invId ? null : invId)}
              expanded={expandedId === invId}
              onFeedback={hasMatches ? (rating, reason) => handleFeedback(investor, matchResult, rating, reason) : undefined}
              feedback={feedbackState[invId]}
              feedbackPending={feedbackMutation.isPending}
              selectable={hasMatches}
              selected={selectedInvestors.has(invId)}
              onSelect={(checked) => handleToggleSelect(invId, checked)}
              introStatus={existingIntroStatus}
            />
          );
        })}
      </div>

      {filteredInvestors.length === 0 && (
        <div className="text-center py-12">
          <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No investors found matching your criteria</p>
        </div>
      )}

      {selectedInvestors.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-primary text-primary-foreground rounded-full elevation-3 px-6 py-3 flex items-center gap-4">
            <span className="text-sm font-medium">{selectedInvestors.size}/10 selected</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowConfirmDialog(true)}
              data-testid="button-request-introductions"
              className="rounded-full"
            >
              <Send className="h-4 w-4 mr-1.5" />
              Request Introductions
            </Button>
            <button
              onClick={() => setSelectedInvestors(new Set())}
              className="text-primary-foreground/70 hover:text-primary-foreground"
              data-testid="button-clear-selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Introductions</DialogTitle>
            <DialogDescription>
              You're about to request introductions to {selectedInvestors.size} investor{selectedInvestors.size !== 1 ? "s" : ""}. The Undaunted team will review each one and reach out to the investors on your behalf.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {investors?.filter(inv => selectedInvestors.has(inv.id || inv.airtableId)).map(inv => {
              const invId = inv.id || inv.airtableId;
              const score = matchMap.get(invId)?.scoreBreakdown?.totalScore;
              return (
                <div key={invId} className="flex items-center justify-between p-2 rounded-xl bg-muted/50">
                  <span className="text-sm font-medium">{inv.organisation || inv.organisationName || inv.name}</span>
                  {score != null && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${getScoreColor(score)}`}>
                      {Math.round(score)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} data-testid="button-cancel-request">Cancel</Button>
            <Button onClick={handleSubmitRequest} disabled={requestIntroMutation.isPending} data-testid="button-confirm-request">
              {requestIntroMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Confirm Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function InvestorIntroductions() {
  const { startupId } = useActiveStartupId();
  const [activeTab, setActiveTab] = useState("submit");
  const [matchResults, setMatchResults] = useState<any>(null);
  const [formValues, setFormValues] = useState<SubmitFormValues | null>(null);
  const [matchedAt, setMatchedAt] = useState<string | null>(null);
  const [restoredFromSaved, setRestoredFromSaved] = useState(false);
  const prevStartupIdRef = useRef(startupId);

  const { data: savedMatches, isLoading: savedLoading } = useQuery<any>({
    queryKey: ["/api/investor-introductions/latest-matches", startupId],
    queryFn: async () => {
      const url = startupId
        ? `/api/investor-introductions/latest-matches?startupId=${startupId}`
        : "/api/investor-introductions/latest-matches";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch latest matches");
      return res.json();
    },
  });

  useEffect(() => {
    if (prevStartupIdRef.current !== startupId) {
      setMatchResults(null);
      setFormValues(null);
      setMatchedAt(null);
      setRestoredFromSaved(false);
      setActiveTab("submit");
      prevStartupIdRef.current = startupId;
    }
  }, [startupId]);

  useEffect(() => {
    if (savedMatches && !matchResults && !restoredFromSaved) {
      setMatchResults(savedMatches.matchResults);
      setFormValues(savedMatches.formValues);
      setMatchedAt(savedMatches.createdAt);
      setActiveTab("database");
      setRestoredFromSaved(true);
    }
  }, [savedMatches, matchResults, restoredFromSaved]);

  const handleSubmitSuccess = (data: any, values: SubmitFormValues) => {
    setMatchResults(data);
    setFormValues(values);
    setMatchedAt(new Date().toISOString());
    setActiveTab("database");
  };

  const handleEditRound = () => {
    setActiveTab("submit");
  };

  const hasSubmitted = !!matchResults?.matches;

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-page-title">
            Investor Introductions
          </h1>
          <p className="text-muted-foreground">Find and connect with relevant investors.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-list">
          <TabsTrigger value="submit" data-testid="tab-submit-round">Submit Round</TabsTrigger>
          <TabsTrigger value="database" data-testid="tab-investor-database" className="flex items-center gap-1.5">
            {!hasSubmitted && !savedLoading && <Lock className="h-3 w-3" />}
            Investor Database
          </TabsTrigger>
        </TabsList>

        <TabsContent value="submit">
          <SubmitRoundTab onSuccess={handleSubmitSuccess} initialValues={formValues} />
        </TabsContent>

        <TabsContent value="database">
          <InvestorDatabaseTab matchResults={matchResults} formValues={formValues} onEditRound={handleEditRound} matchedAt={matchedAt} />
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
