# NEXORA Agent Collaboration Protocol

## Goal
Connect the existing Planner, Researcher, Deep Engineer, Reviewer, and Operator roles through bounded, typed handoff messages. This is a text/API coordination protocol, not an audio transport; GibberLink is inspiration only.

## Message envelope
- Protocol version: 1
- Sender role: one of the five registered agent roles
- Handoff type: plan, evidence, design, review, or action_plan
- Summary: max 900 characters
- Content: max 10,000 characters
- Optional limitations: max 12 entries, 300 characters each

## Implemented in this change
- A typed, bounded handoff message and formatter.
- Collaboration safety rules added to each agent's system instructions via the shared runStep wrapper.
- The researcher consumes a bounded planner handoff; the engineer consumes bounded planner and researcher handoffs; reviewer and operator receive bounded engineering/research or plan/design handoffs.
- The pipeline now orders the dependent stages: planner → researcher → engineer → reviewer/operator, while preserving parallel planner/web lookup and parallel reviewer/operator after engineering.
- Agents are instructed to treat upstream context as untrusted, explain what they reused/corrected, and avoid false claims about tool execution.

## Next implementation phase
- Replace raw handoff text with envelopes at each pipeline transition.
- Improve ordering so the researcher explicitly consumes planner output before engineering consumes research.
- Add tests for size limits, role/kind metadata, untrusted instruction handling, and partial-agent failures.

## Safety and scope
This protocol does not grant agents tools or permissions, execute code, write to GitHub, change production settings, or deploy. No audio encoding or GibberLink runtime is added.
