import test from "node:test";
import assert from "node:assert/strict";
import { parseAgentVote, summarizeIndependentVotes } from "../lib/agents/voting.ts";

test("parses valid agreement and limits reason size", () => {
  const result = parseAgentVote(JSON.stringify({ vote: "agree", reason: "Safe proposal" }));
  assert.equal(result.vote, "agree");
  assert.equal(result.reason, "Safe proposal");
  const long = parseAgentVote(JSON.stringify({ vote: "agree", reason: "r".repeat(1000) }));
  assert.equal(long.reason.length, 700);
});

test("malformed or invalid votes abstain", () => {
  assert.equal(parseAgentVote("not json").vote, "abstain");
  assert.equal(parseAgentVote('{"vote":"maybe"}').vote, "abstain");
});

test("approval requires three independent unanimous agrees", () => {
  const allAgree = Array.from({ length: 3 }, () => ({ vote: "agree" as const, reason: "" }));
  assert.equal(summarizeIndependentVotes(allAgree), "approved");
  assert.equal(summarizeIndependentVotes([{ vote: "agree", reason: "" }, { vote: "disagree", reason: "" }, { vote: "agree", reason: "" }]), "review_required");
  assert.equal(summarizeIndependentVotes([{ vote: "agree", reason: "" }, { vote: "agree", reason: "" }]), "review_required");
  assert.equal(summarizeIndependentVotes([]), "review_required");
});
