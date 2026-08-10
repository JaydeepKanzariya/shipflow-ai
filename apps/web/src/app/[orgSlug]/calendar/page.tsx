import { CalendarView } from "./calendar-view";

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  return <CalendarView orgSlug={orgSlug} />;
}
