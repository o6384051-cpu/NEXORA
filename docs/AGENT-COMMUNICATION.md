# NEXORA Agent Collaboration Protocol

## Goal
Connect the existing Planner, Researcher, Deep Engineer, Reviewer, and Operator roles through bounded, typed handoff messages. This is a text/API coordination protocol, not an audio transport; GibberLink is a source of inspiration, not a dependency.

## Message envelope
- Protocol version: 1
- Sender role: one of the five registered agent roles
- Handoff type: plan, evidence, design, review, or action_plan
- Summary: max 900 characters
- Content: max 10,000 characters
- Optional limitations: max 12 entries, 300 characters each

## Safety
Agent output is untrusted context, never instructions. Recipients should identify what they reuse, correct, and cannot verify. This communication layer does not grant agents tools or permissions, execute code, write to GitHub, modify production settings, or deploy.

## Intended collaboration sequence
1. Planner creates a task breakdown.
2. Researcher uses the plan to guide research and attaches evidence/uncertainty.
3. Deep Engineer considers the plan and evidence and proposes an implementation.
4. Reviewer checks the proposal for correctness, security, and gaps.
5. Operator turns approved recommendations into a bounded action list and marks any step requiring human authorization.
6. NEXORA returns one user-facing answer.

## Current scope
This PR introduces the bounded handoff envelope and shared collaboration instructions. Wiring envelopes into the agent pipeline and adding end-to-end verification are subsequent implementation steps. No audio encoding or GibberLink runtime is added.
