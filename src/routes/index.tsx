import { createFileRoute } from "@tanstack/react-router";
import { StudioApp } from "@/components/studio/StudioApp";

// The home route ships no og:image, so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "סטודיו נועה · ח. סבן" },
    { name: "description", content: "סטודיו נועה של ח. סבן — צ׳אט, ידע ובדיקת כלים להנהלה." },
    { property: "og:title", content: "סטודיו נועה · ח. סבן" },
    { property: "og:description", content: "סביבת העבודה של נועה לצ׳אט, ידע וכלים." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  return <StudioApp />;
}
