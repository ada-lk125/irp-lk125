const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const BASE_URL = `https://api.airtable.com/v0/${BASE_ID}`;

export const INVESTORS_TABLE = "tblpRQWbM6hi9rdPn";
export const INVESTORS_PEOPLE_TABLE = "tblATTHyZwpWbLOoK";
export const INTRO_TRACKER_TABLE = "tblOnWnzWNS5m0r08";
export const FOUNDERS_TABLE = "tblByqVm1OlyOZ1El";
export const FUNDING_ROUND_TABLE = "tblLCb6bo4OtxUtw2";
export const COMPANIES_TABLE = "tblhD9QrloIYqVB7H";

function getLogoDevUrl(websiteUrl?: string): string | undefined {
  if (!websiteUrl) return undefined;
  try {
    let url = websiteUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    const domain = new URL(url).hostname.replace(/^www\./, "");
    if (!domain || domain.includes(" ")) return undefined;
    return `/api/logo/${domain}`;
  } catch {
    return undefined;
  }
}

export interface Investor {
  id: string;
  organisation?: string;
  description?: string;
  logoUrl?: string;
  logoDevUrl?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  investorType?: string[];
  investmentStage?: string[];
  sectorFocus?: string[];
  subSectors?: string[];
  regionalFocus?: string[];
  hqLocation?: string;
  investmentThesis?: string;
  minTicketSize?: number;
  maxTicketSize?: number;
  investmentInstruments?: string[];
  qualityScore?: number;
  qualityTier?: string;
  connectionStrength?: string;
  linkedPeopleIds?: string[];
}

export interface AirtableFundingRound {
  id: string;
  startupId?: string;
  startupName?: string;
  roundStage?: string;
  amountRaising?: number;
  amountCommitted?: number;
  valuation?: number;
  minTicketSize?: number;
  maxTicketSize?: number;
  investmentTypes?: string[];
  roundClosingDate?: string;
  leadInvestorSecured?: string;
  pitchDeckLink?: string;
  tweetPitch?: string;
  tractionSummary?: string;
  currentRevenue?: number;
  unfairAdvantage?: string;
  targetInvestors?: string;
  diversityFocused?: string;
  impactPreferred?: string;
  roundGeography?: string;
  roundSectors?: string[];
  instruments?: string[];
  tractionLevel?: string;
  topMatchSummary?: string;
  preferredInvestorTypes?: string[];
}

export interface AirtableStartup {
  id: string;
  name?: string;
  description?: string;
  websiteUrl?: string;
  founderName?: string;
  email?: string;
  climateProblem?: string;
  solutionDescription?: string;
  climateType?: string;
  productType?: string;
  businessModel?: string;
  ventureStatus?: string;
  technologyDescription?: string;
  targetMarket?: string;
  competitors?: string;
  revenueGenerated?: string;
}

interface AirtableRecord {
  id: string;
  fields: Record<string, any>;
}

interface CacheEntry<T> {
  data: T[];
  timestamp: number;
}

const CACHE_TTL = 30 * 60 * 1000;

let investorsCache: CacheEntry<Investor> | null = null;

function toArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") return [val];
  return [];
}

export async function fetchAllRecords(tableId: string): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(`${BASE_URL}/${tableId}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Airtable API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    allRecords.push(...data.records);
    offset = data.offset;
  } while (offset);

  return allRecords;
}

function parseInvestor(record: AirtableRecord): Investor {
  const f = record.fields;
  const logo = f["Logo"];
  const websiteUrl = f["Website URL"];
  return {
    id: record.id,
    organisation: f["Organisation"],
    description: f["Description "] || f["Description"],
    logoUrl: Array.isArray(logo) && logo.length > 0 ? logo[0].url : undefined,
    logoDevUrl: getLogoDevUrl(websiteUrl),
    linkedinUrl: f["Organisation LinkedIn"],
    websiteUrl,
    investorType: toArray(f["Investor Type"]),
    investmentStage: toArray(f["Investment Stage"]),
    sectorFocus: toArray(f["Sector Focus"]),
    subSectors: toArray(f["Sub-Sectors"]),
    regionalFocus: toArray(f["Regional Focus"]),
    hqLocation: f["HQ Location "] || f["HQ Location"],
    investmentThesis: f["Investment Thesis "] || f["Investment Thesis"],
    minTicketSize: f["Minimum Ticket Size GBP"],
    maxTicketSize: f["Maximum Ticket Size GBP"],
    investmentInstruments: toArray(f["Investment Instruments"]),
    qualityScore: f["Investor Quality Score"],
    qualityTier: f["Investor Quality Tier "] || f["Investor Quality Tier"],
    connectionStrength: (() => {
      const raw = f["Connection Strength (1-5)"] || f["Connection Strength"] || f["Connection strength"] || f["Connection Strength "];
      if (Array.isArray(raw)) return raw[0] || undefined;
      return raw;
    })(),
    linkedPeopleIds: toArray(f["Undaunted Investors(People)"] || f["Investors (People)"] || f["People"]),
  };
}

export async function getInvestors(forceRefresh = false): Promise<Investor[]> {
  if (!forceRefresh && investorsCache && Date.now() - investorsCache.timestamp < CACHE_TTL) {
    return investorsCache.data;
  }
  const records = await fetchAllRecords(INVESTORS_TABLE);
  const investors = records.map(parseInvestor);
  investorsCache = { data: investors, timestamp: Date.now() };
  return investors;
}

async function createRecord(tableId: string, fields: Record<string, any>): Promise<AirtableRecord> {
  const res = await fetch(`${BASE_URL}/${tableId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ records: [{ fields }] }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Airtable create error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.records[0];
}

async function updateRecord(tableId: string, recordId: string, fields: Record<string, any>): Promise<AirtableRecord> {
  const res = await fetch(`${BASE_URL}/${tableId}/${recordId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Airtable update error (${res.status}): ${errText}`);
  }

  return await res.json();
}

async function findRecordsByFormula(tableId: string, formula: string): Promise<AirtableRecord[]> {
  const url = new URL(`${BASE_URL}/${tableId}`);
  url.searchParams.set("filterByFormula", formula);
  url.searchParams.set("pageSize", "100");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Airtable search error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.records || [];
}

export interface InvestorPerson {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  linkedinUrl?: string;
  investorOrgId?: string;
  investorOrgName?: string;
  sectorFocus?: string[];
  notes?: string;
}

let investorPeopleCache: CacheEntry<InvestorPerson> | null = null;

function parseInvestorPerson(record: AirtableRecord): InvestorPerson {
  const f = record.fields;
  const firstName = f["First Name"] || "";
  const lastName = f["Last Name"] || f["Surname"] || "";
  const fullName = f["Full Name"] || f["Name"] || [firstName, lastName].filter(Boolean).join(" ") || undefined;
  const orgLinked = f["Investor Organisation"] || f["Company"] || f["Organisation"] || f["Investor"];
  const orgNameLookup = f["Organisation Name (from Investor Organisation)"] || f["Organisation (from Investor)"] || f["Company(Text)"];
  const orgName = Array.isArray(orgNameLookup) && orgNameLookup.length > 0 ? orgNameLookup[0] : (typeof orgNameLookup === "string" ? orgNameLookup : undefined);

  return {
    id: record.id,
    name: fullName ? fullName.trim() : undefined,
    firstName: firstName ? String(firstName).trim() || undefined : undefined,
    lastName: lastName ? String(lastName).trim() || undefined : undefined,
    email: f["Email"] || f["Email Address"] || f["Investor Email "] || f["Investor Email"],
    role: f["Role"] || f["Title"] || f["Job Title"] || f["Job Title "],
    linkedinUrl: f["LinkedIn"] || f["LinkedIn URL"] || f["LinkedIn Profile"] || f["Personal LinkedIn"],
    investorOrgId: Array.isArray(orgLinked) && orgLinked.length > 0 ? orgLinked[0] : (typeof orgLinked === "string" ? orgLinked : undefined),
    investorOrgName: orgName,
    sectorFocus: toArray(f["Sector Focus"] || f["Sectors"]),
    notes: f["Notes"] || f["Comments"],
  };
}

export async function getInvestorPeople(forceRefresh = false): Promise<InvestorPerson[]> {
  if (!forceRefresh && investorPeopleCache && Date.now() - investorPeopleCache.timestamp < CACHE_TTL) {
    return investorPeopleCache.data;
  }
  const records = await fetchAllRecords(INVESTORS_PEOPLE_TABLE);
  const people = records.map(parseInvestorPerson);
  investorPeopleCache = { data: people, timestamp: Date.now() };
  return people;
}

export async function getInvestorPeopleByOrg(investorAirtableId: string): Promise<InvestorPerson[]> {
  const allInvestors = await getInvestors();
  const investor = allInvestors.find(inv => inv.id === investorAirtableId);
  const linkedIds = investor?.linkedPeopleIds;

  const allPeople = await getInvestorPeople();

  if (linkedIds && linkedIds.length > 0) {
    const linkedIdSet = new Set(linkedIds);
    const linkedPeople = allPeople.filter(p => linkedIdSet.has(p.id));
    if (linkedPeople.length > 0) return linkedPeople;
  }

  return allPeople.filter(p => p.investorOrgId === investorAirtableId);
}

export async function createInvestorPersonInAirtable(data: {
  name: string;
  email?: string;
  role?: string;
  linkedinUrl?: string;
  investorOrgId: string;
}): Promise<InvestorPerson> {
  const nameParts = data.name.trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  const fields: Record<string, any> = {};
  if (firstName) fields["First Name"] = firstName;
  if (lastName) fields["Last Name"] = lastName;
  fields["Full Name"] = data.name;
  if (data.email) fields["Email"] = data.email;
  if (data.role) fields["Role"] = data.role;
  if (data.linkedinUrl) fields["LinkedIn"] = data.linkedinUrl;
  fields["Investor Organisation"] = [data.investorOrgId];

  const record = await createRecord(INVESTORS_PEOPLE_TABLE, fields);

  investorPeopleCache = null;

  return parseInvestorPerson(record);
}

export async function lookupFounderByEmail(email: string): Promise<AirtableRecord | null> {
  const escaped = email.replace(/'/g, "\\'");
  const records = await findRecordsByFormula(FOUNDERS_TABLE, `{Email} = '${escaped}'`);
  return records.length > 0 ? records[0] : null;
}

export async function lookupCompanyByName(name: string): Promise<AirtableRecord | null> {
  const escaped = name.replace(/'/g, "\\'");
  const records = await findRecordsByFormula(COMPANIES_TABLE, `{Name} = '${escaped}'`);
  return records.length > 0 ? records[0] : null;
}

export async function createCompanyRecord(name: string): Promise<AirtableRecord> {
  return createRecord(COMPANIES_TABLE, { "Name": name });
}

export async function createIntroTrackerRecord(data: {
  dateOfRequest: string;
  status: "Requested" | "Intro made" | "Intro declined";
  introducedToPersonIds?: string[];
  founderRecordIds?: string[];
  introducedBy?: string;
}): Promise<AirtableRecord> {
  const fields: Record<string, any> = {
    "Date of intro request": data.dateOfRequest,
    "Intro status": data.status,
  };
  if (data.introducedToPersonIds && data.introducedToPersonIds.length > 0) {
    fields["Introduced to"] = data.introducedToPersonIds;
  }
  if (data.founderRecordIds && data.founderRecordIds.length > 0) {
    fields["Founder"] = data.founderRecordIds;
  }
  if (data.introducedBy) {
    fields["Introduced by"] = data.introducedBy;
  }
  return createRecord(INTRO_TRACKER_TABLE, fields);
}

export async function updateIntroTrackerRecord(recordId: string, data: {
  status?: "Requested" | "Intro made" | "Intro declined";
  introducedBy?: string;
  introducedToPersonIds?: string[];
}): Promise<AirtableRecord> {
  const fields: Record<string, any> = {};
  if (data.status) {
    fields["Intro status"] = data.status;
  }
  if (data.introducedBy) {
    fields["Introduced by"] = data.introducedBy;
  }
  if (data.introducedToPersonIds && data.introducedToPersonIds.length > 0) {
    fields["Introduced to"] = data.introducedToPersonIds;
  }
  return updateRecord(INTRO_TRACKER_TABLE, recordId, fields);
}

export async function findFundingRoundByName(name: string): Promise<AirtableRecord | null> {
  const escaped = name.replace(/'/g, "\\'");
  const records = await findRecordsByFormula(FUNDING_ROUND_TABLE, `{Name} = '${escaped}'`);
  return records.length > 0 ? records[0] : null;
}

export async function upsertFundingRound(data: {
  companyRecordId: string;
  startupName: string;
  roundStage: string;
  amountRaising?: number;
  minTicketSize?: number;
  investmentTypes?: string[];
  roundGeography?: string;
  roundSectors?: string[];
  tweetPitch?: string;
  tractionSummary?: string;
  unfairAdvantage?: string;
  preferredInvestorTypes?: string[];
}): Promise<AirtableRecord> {
  const recordName = `${data.startupName} - ${data.roundStage}`;
  const fields: Record<string, any> = {
    "Name": recordName,
    "Round Stage": data.roundStage,
    "Startup": [data.companyRecordId],
  };
  if (data.amountRaising != null) fields["Amount Raising"] = data.amountRaising;
  if (data.minTicketSize != null) fields["Min Ticket Size"] = data.minTicketSize;
  if (data.investmentTypes && data.investmentTypes.length > 0) fields["Investment Types"] = data.investmentTypes;
  if (data.roundGeography) fields["Round Geography"] = data.roundGeography;
  if (data.roundSectors && data.roundSectors.length > 0) fields["Round Sectors"] = data.roundSectors;
  if (data.tweetPitch) fields["Tweet Pitch"] = data.tweetPitch;
  if (data.tractionSummary) fields["Traction Summary"] = data.tractionSummary;
  if (data.unfairAdvantage) fields["Unfair Advantage"] = data.unfairAdvantage;
  if (data.preferredInvestorTypes && data.preferredInvestorTypes.length > 0) fields["Preferred Investor Types"] = data.preferredInvestorTypes;

  const existing = await findFundingRoundByName(recordName);
  if (existing) {
    return updateRecord(FUNDING_ROUND_TABLE, existing.id, fields);
  }

  return createRecord(FUNDING_ROUND_TABLE, fields);
}

export { toArray };
