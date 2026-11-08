import { describe, expect, it } from "vitest";
import { planReply, findConflict, screenSensitive, type Trace } from "./engine";
import { WRITE_IDS } from "./catalog";

const tool = async (id: string): Promise<Trace> => ({ id, tool: id, ms: 0, ok: true, simulated: true, params: {}, result: {} });
describe("Imported studio rules", () => {
  it("looks up the customer before producing cards", async () => {
    const result = await planReply({ message: "שלום", persona: "new", harelMode: "address", tool });
    expect(result.traces[0]?.tool).toBe("find_customer");
    expect(result.cards).toHaveLength(2);
  });
  it("keeps commercial cards away from the family persona", async () => {
    const result = await planReply({ message: "מלט", persona: "julie", harelMode: "address", tool });
    expect(result.cards).toEqual([]);
    expect(result.traces.map(t => t.tool)).toEqual(["find_customer"]);
  });
  it("flags the imported cement pallet conflict", () => {
    expect(findConflict("מלט 50 שקים")).not.toBe("");
    expect(findConflict("מלט 40 שקים")).toBe("");
  });
  it("blocks password knowledge", () => {
    expect(screenSensitive("סיסמה: private").ok).toBe(false);
  });
  it("treats signed inquiry link creation as a write", () => {
    expect(WRITE_IDS.has("harel_inquiry_link")).toBe(true);
  });
});