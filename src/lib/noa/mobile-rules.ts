export type MobileRole = "harel" | "rami";
export function mayRequestTrip(role: string | null) { return role === "harel"; }
export function mayShareLocation(role: string | null, status: string, consented: boolean) {
  return role === "rami" && status === "sharing" && consented;
}
export function parseWazeShare(text: string) {
  const matched = text.match(/https:\/\/(?:www\.)?waze\.com\/ul[^\s<>]*/i)?.[0];
  if (!matched) return null;
  const url = new URL(matched);
  if (url.pathname !== "/ul") return null;
  const arrival = text.match(/(?:בשעה\s*)?(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i)?.[1]?.trim() || "";
  const destination = text.match(/אל\s+(.+?)(?:\.\s*אפשר|[\n]|$)/)?.[1]?.trim() || "";
  return { url: url.href, arrival, destination };
}
export const deliverySheetId = "1FsLseQrKbIj_AvlE6-dW4J12Gr88P3uaoFVBjEcUjsw";
export const deliverySheetTab = "ארכיון_תעודות_גליה";
export function deliveryRow(data: { id: string; number: string; date: string; customer: string; address: string; items: string; documentUrl: string }, timestamp: string) {
  return [timestamp, data.date, "", data.number, "", "", data.customer, data.address, "ראמי", "", data.documentUrl, data.items, "", "", "", "", "הזנה ידנית", data.id, "ממתין לאישור"];
}