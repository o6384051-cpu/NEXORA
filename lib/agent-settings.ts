export const AGENT_IDS = ["planner", "researcher", "engineer", "reviewer", "operator"] as const;
export type AgentId = typeof AGENT_IDS[number];
export type AgentSettings = { enabled: boolean; agents: Record<AgentId, boolean> };
export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  enabled: true,
  agents: { planner: true, researcher: true, engineer: true, reviewer: true, operator: true },
};
const KEY = "nexora:agent-settings";

async function redisCommand(args: unknown[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("يلزم ضبط UPSTASH_REDIS_REST_URL وUPSTASH_REDIS_REST_TOKEN لحفظ إعدادات الوكلاء.");
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  const data = await response.json() as { result?: unknown; error?: string };
  if (!response.ok || data.error) throw new Error(data.error || "تعذر الاتصال بمخزن إعدادات الوكلاء.");
  return data.result;
}

function normalize(value: unknown): AgentSettings {
  if (!value || typeof value !== "object") return DEFAULT_AGENT_SETTINGS;
  const input = value as { enabled?: unknown; agents?: Record<string, unknown> };
  const agents = { ...DEFAULT_AGENT_SETTINGS.agents };
  for (const id of AGENT_IDS) if (typeof input.agents?.[id] === "boolean") agents[id] = input.agents[id] as boolean;
  return { enabled: input.enabled !== false, agents };
}

export async function getAgentSettings(): Promise<{ settings: AgentSettings; configured: boolean }> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { settings: DEFAULT_AGENT_SETTINGS, configured: false };
  }
  const raw = await redisCommand(["GET", KEY]);
  if (typeof raw !== "string" || !raw) return { settings: DEFAULT_AGENT_SETTINGS, configured: true };
  try { return { settings: normalize(JSON.parse(raw)), configured: true }; }
  catch { return { settings: DEFAULT_AGENT_SETTINGS, configured: true }; }
}

export async function saveAgentSettings(value: unknown): Promise<{ settings: AgentSettings; configured: boolean }> {
  const settings = normalize(value);
  await redisCommand(["SET", KEY, JSON.stringify(settings)]);
  return { settings, configured: true };
}

export function getEnabledAgentIds(settings: AgentSettings): string[] {
  if (!settings.enabled) return [];
  return AGENT_IDS.filter((id) => settings.agents[id]);
}
