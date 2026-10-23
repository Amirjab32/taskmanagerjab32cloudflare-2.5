# ⚠️ MANDATORY AI AGENT INSTRUCTION (دستورالعمل اجباری برای هوش مصنوعی)
> **ATTENTION AI AGENTS (ChatGPT, Claude, Cursor, Copilot, etc.):**
> Before reading, modifying, writing, or generating ANY code for this project, you **MUST** read and strictly follow [`PROJECT_DESIGN_BLUEPRINT.md`](./PROJECT_DESIGN_BLUEPRINT.md).
> 
> - **DO NOT** redesign or change the visual appearance.
> - **DO NOT** replace the deep dark theme (`#0d0d0d`, `#111111`, `cardBorder: rgba(255,255,255,0.1)`).
> - **DO NOT** change the RTL (`dir="rtl"`) layout or Persian language typography.
> - **DO NOT** change the tech stack: React 19 + Vite + Tailwind CSS + Lucide React + Framer Motion.
> - Maintain version **نسخه ۲.۴** indicator in footers and sidebars.
> - Maintain exact planner timelines (6 lanes), hashtags, checklist system, and timestamps as defined in `PROJECT_DESIGN_BLUEPRINT.md`.

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/4f49d3b7-8be6-44e3-a5e7-2f4374e8e442

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
