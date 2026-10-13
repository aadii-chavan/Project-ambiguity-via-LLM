# UI / UX Design Spec (based on reference "CareOps Finances" screen)

Product working name: **ReqClear**.

## Visual language (taken from the reference)
- **Frame**: app sits in a large white rounded panel (radius 28px) over a soft lavender gradient page background.
- **Surfaces**: page `#F7F7F9`, cards `#FFFFFF`, hairline dividers `#ECECF1`; no heavy shadows, 1px borders.
- **Primary**: violet `#6C5CE7` (hover `#5B4BD6`, tint `#EFEBFF`, soft `#B9AEF5`). **Secondary**: amber `#E8A06A`. **Positive** `#16A34A`, **Negative** `#E5484D`, **Warning** `#F5A524`.
- **Ink**: `#14141F` text, `#6B6B7B` muted. **Tooltip/dark**: navy `#26233A`.
- **Type**: Plus Jakarta Sans (fallback Inter). Page title 32/700; KPI numbers 36/700 with the decimal/trailing part in muted `#B4B0C8` (the "$1 248,320" trick); labels 14/500.
- **Shape**: cards radius 20, buttons/inputs radius 12, pills fully round; square icon buttons 40x40 with 1px border.
- **Data viz motifs**: smooth area curves with hatched (diagonal-stripe) fill between series; segmented vertical-bar meters (green) for utilization; horizontal proportional bar split in violet shades + hatched last segment; dark tooltip with colored left ticks.
- **Motion**: 150–200ms ease; tab pill slides; numbers count up; cards fade-up on load.
- **Dark mode**: bg `#0F0F17`, card `#17171F`, border `#26263A`, same violet.

## Shell
Top bar: logo + **Project selector** (replaces "Westside clinic") + "Add project" | search, notifications (badge), user menu.
Primary nav (pill on active): **Dashboard · Analyze · Requirements · History · Settings**.
Page header: big title, right-aligned period select, export (upload icon) and settings icon buttons. Sub-tabs under title (underline style).

## Screens
1. **Dashboard** (mirrors Finances/Overview)
   - Sub-tabs: Overview · Issue types · Severity · Reports
   - KPI strip (4): *Requirements analyzed*, *Ambiguity rate*, *Avg quality (before→after)*, *Open issues* — each with "vs last session" trend arrow (green up/down).
   - **Ambiguity trends** area chart (before vs after quality, hatched fill, dark tooltip) per session/day.
   - Bottom split: **Issue types** table (icon, count, share, segmented bar, avg severity) | **Severity structure** (proportional violet bar split: high/medium/low/clean with %).
2. **Analyze**: large input card (textarea, drag-drop upload, sample chips), options row (strictness, style, glossary), primary "Analyze requirements" button; progress state streams per-requirement skeleton rows.
3. **Requirements / Results**: left list (ID, snippet, severity dot, score ring, filter chips & search); right detail card: original text with colored highlight spans, issue list with explanations, **diff view** original→rewrite, clarifying questions, buttons **Accept / Edit / Reject**, copy. Footer bulk action "Accept all high-confidence".
4. **History**: table of sessions (name, date, total, ambiguity rate, quality delta) with open/export/delete.
5. **Settings**: model, strictness default, writing style, glossary editor, theme.

## Component inventory
AppShell, TopBar, ProjectSwitcher, NavPills, PageHeader, SubTabs, KpiCard (muted-tail number), TrendChart (Recharts, hatched area, DarkTooltip), IssueTypeTable, SegmentedMeter, ProportionBar, RequirementList/Item, HighlightedText, IssueBadge, ScoreRing, DiffView, DecisionButtons, UploadDropzone, EmptyState, Skeletons, ThemeToggle.

## Stack decisions
Vite + React + TS, Tailwind (tokens above as CSS variables), shadcn/ui primitives, Recharts, Framer Motion, lucide-react, TanStack Query, React Router.
