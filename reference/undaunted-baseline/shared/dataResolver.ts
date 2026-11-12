export interface RevisionInfo {
  dataKey: string;
  level: number;
}

export interface InlineToolConfigRef {
  dataKey: string;
  revisionOf: RevisionInfo | null;
  toolTemplateId: number;
}

function extractLevelFromDataKey(dataKey: string): number {
  const match = dataKey.match(/__L(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

export function resolveLatestData(
  currentData: Record<string, unknown>,
  baseDataKey: string,
  configs: InlineToolConfigRef[],
): { data: unknown; level: number | null; revisedDataKey: string | null } {
  const revisions = configs
    .filter(c => c.revisionOf && c.revisionOf.dataKey === baseDataKey)
    .map(c => ({ ...c, revisionLevel: extractLevelFromDataKey(c.dataKey) }))
    .sort((a, b) => b.revisionLevel - a.revisionLevel);

  for (const rev of revisions) {
    const revData = currentData[rev.dataKey];
    if (revData !== undefined && revData !== null) {
      const isEmpty = Array.isArray(revData) ? revData.length === 0 : (typeof revData === "object" && Object.keys(revData as object).length === 0);
      if (!isEmpty) {
        return { data: revData, level: rev.revisionLevel, revisedDataKey: rev.dataKey };
      }
    }
  }

  return { data: currentData[baseDataKey], level: null, revisedDataKey: null };
}

export function hasRevisionForDataKey(
  currentData: Record<string, unknown>,
  baseDataKey: string,
  configs: InlineToolConfigRef[],
): { hasRevision: boolean; revisionLevel: number | null } {
  const result = resolveLatestData(currentData, baseDataKey, configs);
  return { hasRevision: result.revisedDataKey !== null, revisionLevel: result.level };
}

export function buildRevisionDataKey(baseDataKey: string, level: number): string {
  return `${baseDataKey}__L${level}`;
}
