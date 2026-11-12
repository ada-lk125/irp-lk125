export type AirtableReadTarget = {
  name: string;
  tableId: string;
  baseId?: string;
};

export type AirtableReadProbeResult = {
  name: string;
  ok: boolean;
  status: number | null;
  detail: string;
};

type ProbeOptions = {
  apiKey: string;
  baseId: string;
  targets: AirtableReadTarget[];
  fetchImpl?: typeof fetch;
};

function requireValue(value: string, label: string): string {
  const normalised = value.trim();
  if (!normalised) throw new Error(`${label} must be set.`);
  return normalised;
}

function statusDetail(status: number): string {
  if (status === 200) return "readable";
  if (status === 401) return "API key was rejected";
  if (status === 403) return "token, base, or table access was denied";
  if (status === 404) return "base or table was not found";
  return `unexpected HTTP status ${status}`;
}

export async function probeAirtableReadAccess(
  options: ProbeOptions,
): Promise<AirtableReadProbeResult[]> {
  const apiKey = requireValue(options.apiKey, "AIRTABLE_API_KEY");
  const baseId = requireValue(options.baseId, "AIRTABLE_BASE_ID");
  const fetchImpl = options.fetchImpl ?? fetch;

  return Promise.all(
    options.targets.map(async ({ name, tableId, baseId: configuredTargetBaseId }) => {
      const targetBaseId = requireValue(
        configuredTargetBaseId ?? baseId,
        `${name} base id`,
      );
      const url = new URL(
        `https://api.airtable.com/v0/${encodeURIComponent(targetBaseId)}/${encodeURIComponent(
          requireValue(tableId, `${name} table id`),
        )}`,
      );
      url.searchParams.set("maxRecords", "1");

      try {
        const response = await fetchImpl(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return {
          name,
          ok: response.ok,
          status: response.status,
          detail: statusDetail(response.status),
        };
      } catch {
        return {
          name,
          ok: false,
          status: null,
          detail: "network request failed",
        };
      }
    }),
  );
}
