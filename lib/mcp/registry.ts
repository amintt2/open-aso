import { toolInfo, type McpTool, type ToolInfo } from "./define";
import { adsTools } from "./tools/ads";
import { analyticsTools } from "./tools/analytics";
import { posthogTools } from "./tools/posthog";
import { asoTools } from "./tools/aso";
import { manageTools } from "./tools/manage";
import { impactTools } from "./tools/impact";
import { trendsTools } from "./tools/trends";

export const TOOLS: McpTool[] = [...asoTools, ...manageTools, ...adsTools, ...analyticsTools, ...posthogTools, ...impactTools, ...trendsTools];

export function toolCatalog(): ToolInfo[] {
  return TOOLS.map(toolInfo);
}
