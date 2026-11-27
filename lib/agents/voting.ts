export type AgentVoteChoice = "agree" | "disagree" | "abstain";
export type ParsedAgentVote = { vote: AgentVoteChoice; reason: string };

export function parseAgentVote(raw: string): ParsedAgentVote {
  const candidate = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) return { vote: "abstain", reason: "لم يرجع الوكيل تصويتاً منظماً قابلاً للتحقق." };
  try {
    const parsed = JSON.parse(candidate) as { vote?: unknown; reason?: unknown };
    const vote: AgentVoteChoice = parsed.vote === "agree" || parsed.vote === "disagree" ? parsed.vote : "abstain";
    const reason = typeof parsed.reason === "string" ? parsed.reason.slice(0, 700) : "لم يذكر الوكيل سبباً واضحاً.";
    return { vote, reason };
  } catch {
    return { vote: "abstain", reason: "تعذر قراءة صيغة التصويت." };
  }
}

export function summarizeIndependentVotes(votes: ParsedAgentVote[]): "approved" | "review_required" {
  return votes.length === 3 && votes.every((item) => item.vote === "agree") ? "approved" : "review_required";
}
