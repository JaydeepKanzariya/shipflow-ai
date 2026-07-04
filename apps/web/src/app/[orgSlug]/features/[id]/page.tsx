import { FeatureDetail } from "./feature-detail";

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>;
}) {
  const { id } = await params;
  return <FeatureDetail featureId={id} />;
}
