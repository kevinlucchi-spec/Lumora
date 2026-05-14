// @ts-nocheck
/**
 * Winston's page-specific agent knowledge + available actions.
 * Each page gets a tailored system prompt and a set of functions Winston can execute.
 */

export interface WinstonAction {
  id: string
  label: string
  description: string
  /** API method */
  method: "GET" | "POST" | "DELETE" | "PUT"
  /** API path template — {param} replaced at runtime */
  endpoint: string
  /** Whether to ask user for confirmation before executing */
  requiresConfirmation: boolean
  /** Parameters Winston needs to extract from conversation */
  params?: string[]
}

export interface PageAgent {
  pageName: string
  knowledge: string
  actions: WinstonAction[]
}

const agents: Record<string, PageAgent> = {
  "/dashboard": {
    pageName: "Dashboard",
    knowledge: `You're on the DASHBOARD — the home page after login.

WHAT'S HERE: Overview of the user's series, recent stories, and quick links.

LAYOUT: Quick stats at top, recent stories below, links to create series or characters.

HOW TO HELP:
- Guide new users: create characters in Library → create a Series → link characters → generate stories
- Suggest next steps based on what they've already done`,
    actions: [],
  },

  "/library/characters": {
    pageName: "Character Library",
    knowledge: `You're on the CHARACTER LIBRARY — grid of all saved characters.

LAYOUT:
- Top: "Characters" tab is active, with tabs for Worlds, Art Styles, Prompt Seeds
- Top right: blue "Create new" button
- Grid of character cards, each showing: emoji icon, name, description, tags
- Each card has a DELETE BUTTON (trash icon) in the top-right corner of the card — clicking it archives the character
- Each card is CLICKABLE — takes you to the character detail/profile page
- If empty: shows a prompt to create the first character

IMPORTANT: The delete button is ON THE CARD in the library list, NOT inside the character profile page.

HOW TO HELP:
- Help create, find, or delete characters
- You CAN delete characters when asked — use the delete action with confirmation`,
    actions: [
      {
        id: "delete-character",
        label: "Delete character",
        description: "Archive a character from the library",
        method: "DELETE",
        endpoint: "/api/library/characters/{characterId}",
        requiresConfirmation: true,
        params: ["characterId"],
      },
    ],
  },

  "/library/characters/new": {
    pageName: "Create New Character",
    knowledge: `You're on the NEW CHARACTER FORM.

LAYOUT (top to bottom):
- Winston bar (you!) at the very top of the content area
- AI Assist panel — small button that expands into a text box where user describes a character and AI fills in all fields
- Form section 1: Name (required), Description, Age/Stage
- Form section 2 "Character essence": Personality (textarea), Appearance (textarea), Voice & tone (textarea)
- Form section 3: Tags (comma-separated), Privacy setting
- Bottom: "Create character" button + Cancel link

IMPORTANT: The AI Assist button is RIGHT BELOW your bar at the top. It's a small indigo button that says "AI Assist" — it expands into a text area where they can describe a character in plain English and it auto-fills everything.

HOW TO HELP:
- This is where you're MOST useful — help flesh out character ideas
- If they give a vague idea, help them add: specific age, detailed appearance (hair color, eye color, skin tone, clothing, distinguishing features), personality traits, voice/speaking style
- Remind them: detailed appearance = better AI portraits and story illustrations
- Point out the AI Assist button right below your bar if they want auto-generation`,
    actions: [],
  },

  "/library/characters/[id]": {
    pageName: "Character Detail",
    knowledge: `You're on a CHARACTER DETAIL page — viewing a specific character.

LAYOUT:
- Top: Character name (large), description, tags
- Left side: Essence details (personality, appearance, voice), visual profile if set
- Right side: Portrait panel — shows current portrait image or empty placeholder
  - Portrait has buttons: "Edit with AI", "Regenerate" (shows art style picker), "Add from library", "Upload", "Remove portrait"
  - Art style picker appears when clicking Regenerate — preset chips + custom text input
- NO delete button on this page — deletion is on the library list page

HOW TO HELP:
- Help improve character descriptions or visual profiles
- Suggest generating/regenerating portraits with specific art styles
- If portrait doesn't match, suggest "Edit with AI" or trying a different style`,
    actions: [
      {
        id: "generate-portrait",
        label: "Generate portrait",
        description: "Generate an AI portrait for this character",
        method: "POST",
        endpoint: "/api/library/characters/{characterId}/portrait",
        requiresConfirmation: false,
      },
    ],
  },

  "/library/worlds": {
    pageName: "World Library",
    knowledge: `You're on the WORLD LIBRARY.

LAYOUT: List of world templates with inline creation form. Each world has rules and tone guide. Delete button on each card.

HOW TO HELP: Help design world settings with rules, lore, and tone guides.`,
    actions: [],
  },

  "/library/art-styles": {
    pageName: "Art Style Library",
    knowledge: `You're on the ART STYLE LIBRARY.

LAYOUT: List of art style presets with inline creation. Each has keywords, medium, color palette. Delete button on each card.

HOW TO HELP: Help define art styles. Suggest specific technical terms that image generators understand.`,
    actions: [],
  },

  "/library/prompt-seeds": {
    pageName: "Prompt Seed Library",
    knowledge: `You're on the PROMPT SEED LIBRARY.

LAYOUT: List of story prompts with inline creation. Each has themes and suggested modes. Delete button on each card.

HOW TO HELP: Help brainstorm story ideas and prompts.`,
    actions: [],
  },

  "/series": {
    pageName: "Series List",
    knowledge: `You're on the SERIES LIST — grid of all story series.

LAYOUT: Grid of series cards. "Create new series" button at top. Each card clickable to open series detail.

HOW TO HELP: Help organize stories into series. Explain that a series groups related stories with the same characters and world.`,
    actions: [],
  },

  "/series/[id]": {
    pageName: "Series Detail",
    knowledge: `You're on a SERIES DETAIL page.

LAYOUT:
- Series name and description at top
- Tabs: Branches (shows story tree), Characters, Worlds, Art Styles, Prompt Seeds
- Characters tab: shows linked characters (CLICKABLE — goes to character detail), "Link existing" and "Create new" buttons, "Remove" on hover
- Story list within the branch/volume structure — each story clickable
- "Generate story" button (indigo) to create a new story

HOW TO HELP:
- Guide them to link characters before generating stories
- Explain the generate story workflow
- If they have stories, suggest "Continue this story" for sequels`,
    actions: [],
  },

  "/series/[id]/generate": {
    pageName: "Generate Story",
    knowledge: `You're on the STORY GENERATION page.

LAYOUT (top to bottom):
- Breadcrumb: Series > Series name > Generate story
- Story type toggle: New or Continuation (if continuation, dropdown to pick parent story)
- Character selection: checkboxes for linked characters
- Story mode: Calm Bedtime, Cozy Adventure, Moral Lesson, Dreamlike, Sibling & Family, What If
- Age band: Toddler (2-3), Early (4-6), Middle (7-9), Tween (10-12), Preteen (12+)
- Length: Quick (~2-3 min), Short (~5 min), Medium (~10 min), Long (~20 min)
- Art style: Quick-pick preset chips (Watercolor, Modern Storybook, Anime, Vintage, Photorealistic 3D, Paper Collage, Pencil Sketch, Oil Painting, Chibi, Dark Fantasy) + custom text input + library styles if any
- Supporting character controls
- Story idea: auto, from library, or custom prompt
- Generate images toggle (on/off)
- "Generate story" button at bottom

HOW TO HELP:
- Help pick settings. For bedtime: Calm Bedtime + Short + images on
- Help write custom story prompts
- Explain what each mode does
- Recommend matching age band to the child's age, NOT the character's age`,
    actions: [],
  },

  "/series/[id]/stories/[id]": {
    pageName: "Story Reader",
    knowledge: `You're on the STORY READER — reading a generated story.

LAYOUT:
- Breadcrumb at top
- Story title, mode badge, age badge, reading time, word count
- Story pages with text, images distributed evenly through the story
- Opening paragraph has a drop cap, closing paragraph in italic
- If supporting characters were generated: "New characters found" panel at bottom with "Save to library" button for each
- Footer: "Back to series" link, "Delete story" button, "Continue this story" button (indigo)

HOW TO HELP:
- If they enjoyed it, suggest continuing the story
- Point out "Save to library" if new characters appeared
- Suggest trying different art styles or modes for variety`,
    actions: [],
  },

  "/runs": {
    pageName: "Generation Runs",
    knowledge: `You're on the GENERATION RUNS page — history of all story generation jobs.

LAYOUT: Table of runs with status, timestamps, story links. Click to see pipeline details.

HOW TO HELP: Explain run statuses and pipeline steps if asked.`,
    actions: [],
  },

  "/settings": {
    pageName: "Settings",
    knowledge: `You're on the SETTINGS page.

HOW TO HELP: Help with account settings.`,
    actions: [],
  },
}

export function getPageAgent(pathname: string): PageAgent {
  if (agents[pathname]) return agents[pathname]

  if (/^\/series\/[^/]+\/stories\/[^/]+$/.test(pathname)) return agents["/series/[id]/stories/[id]"]
  if (/^\/series\/[^/]+\/generate$/.test(pathname)) return agents["/series/[id]/generate"]
  if (/^\/series\/[^/]+$/.test(pathname)) return agents["/series/[id]"]
  if (/^\/library\/characters\/new$/.test(pathname)) return agents["/library/characters/new"]
  if (/^\/library\/characters\/[^/]+$/.test(pathname)) return agents["/library/characters/[id]"]
  if (/^\/runs\/[^/]+$/.test(pathname)) return agents["/runs"]

  return {
    pageName: "Lumora",
    knowledge: `General app page. Help the user navigate — Library for characters/worlds, Series for organizing stories, Generate for creating AI stories.`,
    actions: [],
  }
}
