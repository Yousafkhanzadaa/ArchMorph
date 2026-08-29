# ArchMorph demo video script

Target runtime: **2 minutes 40 seconds**. The final video must be public on YouTube, include audio, stay under three minutes, and show the live WebMCP workflow functioning.

## Recording setup

- Use the public production URL in a supported ChatGPT in-app browser or Chrome WebMCP configuration.
- Start with a clean ArchMorph project and the browser agent already available.
- Record at a desktop viewport where the tool library, plan, and inspector are visible.
- Hide debug mode; the agent's real tool calls and visible product state are the proof.
- Use only narration and audio you own or have permission to publish.

## Timeline and narration

### 0:00–0:15 — Show the product immediately

**Screen:** ArchMorph plan editor, then a quick 3D orbit.

**Narration:**

> This is ArchMorph, an architecture-first design studio where a person and an AI agent edit the same live building model. It replaces fragile coordinate clicking with named WebMCP tools that understand rooms, walls, openings, floors, and stairs.

### 0:15–0:38 — Inspect shared architectural state

**Screen:** Ask the agent to inspect the project, active floor, and circulation. Keep the tool sequence and returned stable IDs visible briefly.

**Prompt:**

> Inspect this project, the active floor, and its circulation. Summarize the plot, buildable envelope, and current validation issues.

**Narration:**

> The agent begins with inspection instead of guessing from pixels. It receives stable element IDs, dimensions, metrics, circulation paths, and validation evidence from the same project currently open on screen.

### 0:38–1:20 — Perform a multi-step architectural edit

**Screen:** Ask for an upper floor and connected stair. Show the plan and 3D model updating as the agent works.

**Prompt:**

> Create an upper floor and a correctly connected straight stair. Inspect the available geometry first, validate the result, switch to 3D, and focus the stair.

**Narration:**

> This is a multi-step architectural task. The agent creates a level, resolves the correct floor IDs, places a stair with real dimensions, validates its connection and concept geometry, and presents the same result in 3D. Human actions and tool calls use one canonical operation pipeline.

### 1:20–1:48 — Human turn

**Screen:** Return to plan view and directly move or resize a nearby room.

**Narration:**

> Now I change the design directly. There is no separate AI copy of the project: this human edit enters the same history, persistence, validation, and synchronized 2D and 3D state.

### 1:48–2:15 — Agent re-inspection and correction

**Screen:** Ask the agent to re-inspect, explain any consequence, and correct it if necessary.

**Prompt:**

> Re-inspect the project after my edit. Explain any circulation or setback consequence, correct the issue if needed, and validate again.

**Narration:**

> The agent reads the new state rather than relying on stale coordinates. Validation findings identify affected elements and evidence, so the result remains understandable and correctable by the person.

### 2:15–2:40 — Walk and close

**Screen:** Enter Walk Mode, approach and ascend the stair, show the upper floor, then capture the final view.

**Narration:**

> Finally, the shared model becomes a navigable building. ArchMorph demonstrates what WebMCP is good at: precise, inspectable human-agent collaboration inside a visual application where chat alone and coordinate automation are not enough.

## Final edit checklist

- [ ] Show the functioning product within the first 15 seconds.
- [ ] Keep at least one native WebMCP tool sequence readable.
- [ ] Show both an agent edit and a direct human edit.
- [ ] Show validation evidence and synchronized plan/3D output.
- [ ] Include clear narration about what was built and how WebMCP is used.
- [ ] Remove loading time, dead air, setup, and debug-only footage.
- [ ] Keep the final runtime below 3:00.
- [ ] Upload publicly to YouTube and verify signed-out playback with audio.
