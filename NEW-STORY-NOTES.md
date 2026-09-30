# Generated adventures — September 19, 2026

New Adventure now selects the hero and generates a fresh story through the existing private DM service. Each story has a unique ID, title, premise, opening, objective, resolution conditions, hidden truth, two named NPCs and three named locations. Creative directions vary; recent titles and the previous premise are supplied to avoid repetition, and repeated recent titles are rejected.

Generation and validation finish before the existing adventure is replaced. A failed request keeps the prior save. Successful generation starts fresh NPC health, memories, resources and a journal; it retains the saved hero. Continue restores the same story and conversation history. New Adventure replaces the current single adventure slot; it does not archive old worlds.

The DM receives the generated world as campaign canon. Legacy lantern/lens quest actions are excluded, generated names work in NPC and travel commands, and the journal shows the generated objective. Story events and discoveries persist in conversation/world facts. The DM can conclude the objective when recorded events satisfy its resolution conditions.

Scope: new stories share the current three-location travel and prototype encounter mechanics. Their public names, scenes, conflicts and objectives are generated; their mechanics and map topology are not generated. A location guide replaces the old illustration for these worlds; new landscape images and arbitrary dungeon layouts are not yet generated. Numerical rewards/inventory and additional characters still require supported engine mechanics. This is not full procedural D&D rules automation.

Validation: all verification scripts and web export passed. Two live generated plots differed. An isolated browser run created a new story, saved it, answered as its named NPC, reloaded through Continue, and retained the story objective and conversation in the journal. Main player save was not changed by testing.
