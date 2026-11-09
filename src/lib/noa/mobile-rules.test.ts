import { describe, expect, it } from "vitest";
import { mayRequestTrip, mayShareLocation, parseWazeShare, deliveryRow } from "./mobile-rules";
describe("Noa mobile rules", () => {
  it("only Harel requests a trip", () => { expect(mayRequestTrip("harel")).toBe(true); expect(mayRequestTrip("rami")).toBe(false); expect(mayRequestTrip(null)).toBe(false); });
  it("requires Rami consent before GPS sharing", () => { expect(mayShareLocation("rami","sharing",true)).toBe(true); expect(mayShareLocation("rami","requested",false)).toBe(false); expect(mayShareLocation("harel","sharing",true)).toBe(false); expect(mayShareLocation("rami","stopped",true)).toBe(false); });
  it("preserves the supplied Waze destination and arrival", () => {
    const parsed = parseWazeShare("אגיע בשעה 7:35 AM אל התלמיד 6, הוד השרון. אפשר לעקוב אחרי הנסיעה שלי ב-Waze: https://www.waze.com/ul?a=sd3&token=sample&min_version=5.24");
    expect(parsed?.arrival).toBe("7:35 AM"); expect(parsed?.destination).toBe("התלמיד 6, הוד השרון"); expect(parsed?.url).toBe("https://www.waze.com/ul?a=sd3&token=sample&min_version=5.24"); expect(parseWazeShare("https://evil.example/ul")).toBe(null);
  });
  it("maps a note to the existing archive columns", () => {
    const row=deliveryRow({id:"id-1",number:"152299",date:"2026-11-08",customer:"לקוח",address:"התלמיד 6",items:"מלט",documentUrl:""},"time");
    expect(row[3]).toBe("152299"); expect(row[6]).toBe("לקוח"); expect(row[17]).toBe("id-1"); expect(row[18]).toBe("ממתין לאישור");
  });
});