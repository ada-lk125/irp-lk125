import { describe, expect, it, vi } from "vitest";
import { probeAirtableReadAccess } from "./airtable-read-access";

describe("Airtable read access probe", () => {
  it("uses bounded GET requests and reports access without reading response bodies", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 403 });

    const results = await probeAirtableReadAccess({
      apiKey: "test-key",
      baseId: "appTestBase",
      targets: [
        { name: "Investors", tableId: "tblInvestors" },
        { name: "Companies", tableId: "tblCompanies" },
      ],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(results).toEqual([
      { name: "Investors", ok: true, status: 200, detail: "readable" },
      {
        name: "Companies",
        ok: false,
        status: 403,
        detail: "token, base, or table access was denied",
      },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    for (const [url, init] of fetchImpl.mock.calls) {
      expect(String(url)).toContain("maxRecords=1");
      expect(init).toMatchObject({
        method: "GET",
        headers: { Authorization: "Bearer test-key" },
      });
    }
  });

  it("fails before making a request when required credentials are missing", async () => {
    const fetchImpl = vi.fn();
    await expect(
      probeAirtableReadAccess({
        apiKey: " ",
        baseId: "appTestBase",
        targets: [{ name: "Investors", tableId: "tblInvestors" }],
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/AIRTABLE_API_KEY must be set/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses a target-specific base when a source is configured separately", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    await probeAirtableReadAccess({
      apiKey: "test-key",
      baseId: "appInvestorBase",
      targets: [
        {
          name: "Funding Rounds",
          tableId: "tblFundraising",
          baseId: "appStartupBase",
        },
      ],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(String(fetchImpl.mock.calls[0][0])).toContain(
      "/appStartupBase/tblFundraising",
    );
  });
});
