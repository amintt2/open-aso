export type InsightSeverity = "high" | "medium" | "low" | "positive";

export type InsightKind = "length" | "duplicate" | "title-gap" | "subtitle-fit" | "alternative" | "not-ranking" | "working";

export type Insight = {
  id: string;
  kind: InsightKind;
  severity: InsightSeverity;
  title: string;
  detail: string;
  keyword?: string;
};

export type MetadataInsights = {
  appId: number;
  country: string;
  title: string;
  subtitle: string | null;
  limit: number;
  titleLength: number;
  subtitleLength: number;
  keywordsAnalyzed: number;
  insights: Insight[];
};
