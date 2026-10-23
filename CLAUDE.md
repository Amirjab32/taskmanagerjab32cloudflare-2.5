# Mandatory Project Guidelines for Claude and AI Agents

When working on this repository, you must strictly follow these instructions:

1. **Design System & Visual Theme:**
   - Always refer to `PROJECT_DESIGN_BLUEPRINT.md` for exact UI/UX patterns, colors, and layout rules.
   - Theme is Deep Dark: Background `#0d0d0d`, Sidebar `#111111`, Card background `rgba(255,255,255,0.04)`, Card borders `rgba(255,255,255,0.1)`, Accent `bg-indigo-600` / `bg-indigo-500`.
   - Direction is strictly RTL (`dir="rtl"`). All Persian typography and Persian numbers (`toPersianDigits`) must be preserved.
   - Do NOT redesign or replace this design with generic light or blue templates.

2. **Tech Stack:**
   - React 19 + TypeScript
   - Vite
   - Tailwind CSS
   - Lucide React (`lucide-react`)
   - Framer Motion (`framer-motion`)

3. **Core Features & Integrity:**
   - Planner Timelines: 6 lanes (4 planned, 2 actual).
   - Task hashtag labels rendered next to task title.
   - Notes View: Checklist system (`☐` / `☑`) and timestamp insertion badge (`🕒 [تاریخ | ساعت]`).
   - App version: Version **نسخه ۲.۴** indicator must stay in footer and sidebar.
