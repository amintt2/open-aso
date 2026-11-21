import {
  Activity,
  ArrowLeftRight,
  Compass,
  Globe2,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  Lightbulb,
  LineChart,
  Megaphone,
  MessageSquareText,
  PlugZap,
  Settings,
  Smartphone,
  Swords,
  Tags,
  Terminal,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { slug: string; label: string; icon: LucideIcon };

export type NavGroup = { title?: string; items: NavItem[] };

export const APP_NAV_GROUPS: NavGroup[] = [
  { items: [{ slug: "", label: "Overview", icon: LayoutGrid }] },
  {
    title: "Keywords & rankings",
    items: [
      { slug: "keywords", label: "Keywords", icon: KeyRound },
      { slug: "trends", label: "Rankings & Trends", icon: LineChart },
      { slug: "suggestions", label: "Keyword Suggestions", icon: Lightbulb },
    ],
  },
  {
    title: "Traffic & revenue",
    items: [
      { slug: "traffic", label: "Traffic", icon: ArrowLeftRight },
      { slug: "impact", label: "Keyword Impact", icon: TrendingUp },
    ],
  },
  {
    title: "Market & competitors",
    items: [
      { slug: "competitors", label: "Competitors", icon: Swords },
      { slug: "opportunities", label: "Country Opportunities", icon: Globe2 },
    ],
  },
  {
    title: "Store listing",
    items: [
      { slug: "page", label: "App Store Page", icon: Smartphone },
      { slug: "pricing", label: "Price Localization", icon: Tags },
      { slug: "reviews", label: "Reviews", icon: MessageSquareText },
    ],
  },
];

export const APP_NAV: NavItem[] = APP_NAV_GROUPS.flatMap((g) => g.items);

export const GLOBAL_NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/apple-ads", label: "Apple Ads", icon: Megaphone },
  { href: "/integrations", label: "Integrations", icon: PlugZap },
  { href: "/mcp", label: "MCP Server", icon: Terminal },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const ACTIVITY_ICON = Activity;

export function appHref(appId: number, slug: string) {
  return slug ? `/apps/${appId}/${slug}` : `/apps/${appId}`;
}

export function isNavActive(pathname: string, href: string) {
  return href === "/" || /^\/apps\/[^/]+$/.test(href) ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
