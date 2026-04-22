import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import { createMessage, getProvider, getProviderName, type AITool } from "./ai-provider";
import { prisma } from "./db";
import { generateEmbedding, buildJobText } from "./embeddings";
import { searchSimilarProfiles, searchSimilarJobs, getJobEmbeddingVector } from "./vector-store";
import { rememberFact, recallFacts } from "./agent-memory";

export interface AgentAttachment {
  name: string;
  mediaType: string;
  kind: "image" | "text" | "file";
  base64Data?: string;
  textContent?: string;
}

export interface AgentStreamCallbacks {
  onText?: (text: string) => void;
  onToolStart?: (toolName: string) => void;
}

const SIMPLE_CHAT_RE =
  /^(hi|hello|hey|yo|sup|how are you|how's it going|whats up|what's up|good morning|good afternoon|good evening)[\s!.?]*$/i;
const TOOL_INTENT_RE = /(candidate|license|match|job|run|verify|find|list|search|remember|recall)/i;

const SYSTEM_PROMPT = `You are CaresLink, an AI recruitment assistant for healthcare. You help employers find candidates, match candidates to jobs, and verify nursing licenses.

You can list professional candidates with list_candidates and inspect an individual candidate with get_candidate_info.

You can list jobs with list_jobs. You can score and rank candidates against a job with run_job_matching (computes fresh scores) or get_job_matches (reads previously-computed scores). For RAG-enhanced matching (vector pre-filter + AI scoring), use find_candidates_for_job.

You have semantic search capabilities powered by vector embeddings. Prefer semantic_search_candidates over list_candidates when given a natural-language query like "RN with ICU experience in Tampa". Use find_similar_jobs to discover related positions.

You can verify nursing licenses via the Florida Department of Health (FL DOH) public database using verify_nursing_license. You can search by name or license number.

You have long-term memory. Use remember_fact when the employer shares preferences/requirements that should persist across conversations. Use recall_context to retrieve relevant memories before complex tasks.

Be concise and direct. Act first, then confirm. Never ask "would you like me to..." — just do it.`;

// ─── FL DOH nursing license scrape ──────────────────────────

async function scrapeFLMQA(args: {
  first_name?: string;
  last_name?: string;
  license_number?: string;
}): Promise<object> {
  const baseUrl = "https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders";

  try {
    const formData = new URLSearchParams();
    formData.append("Board", "BOARD OF NURSING");
    formData.append("Profession", "");
    formData.append("LicenseNumber", args.license_number || "");
    formData.append("BusinessName", "");
    formData.append("LastName", args.last_name || "");
    formData.append("FirstName", args.first_name || "");
    formData.append("City", "");
    formData.append("County", "");
    formData.append("ZipCode", "");
    formData.append("LicenseStatus", "");

    const resp = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: formData.toString(),
    });

    if (!resp.ok) {
      return { error: `FL MQA returned status ${resp.status}`, source: "FL DOH MQA" };
    }

    const html = await resp.text();
    const results: {
      name: string;
      licenseType: string;
      licenseNumber: string;
      status: string;
      expiration: string;
      city: string;
    }[] = [];

    const rowRegex = /<tr[^>]*class="[^"]*SearchResultsRow[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const cells: string[] = [];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        cells.push(cellMatch[1].replace(/<[^>]+>/g, "").trim());
      }
      if (cells.length >= 5) {
        results.push({
          name: cells[0] || "",
          licenseType: cells[1] || "",
          licenseNumber: cells[2] || "",
          status: cells[3] || "",
          expiration: cells[4] || "",
          city: cells[5] || "",
        });
      }
    }

    if (results.length === 0) {
      if (html.includes("No results found") || html.includes("0 results")) {
        return {
          source: "FL DOH MQA (Board of Nursing)",
          url: baseUrl,
          found: false,
          message: `No nursing license found for ${args.first_name || ""} ${args.last_name || ""} ${
            args.license_number ? `(License: ${args.license_number})` : ""
          }`.trim(),
        };
      }

      const simpleRowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let simpleMatch;
      let rowCount = 0;
      while ((simpleMatch = simpleRowRegex.exec(html)) !== null) {
        rowCount++;
        if (rowCount <= 1) continue;
        const cells: string[] = [];
        const cellRegex2 = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        let cellMatch2;
        while ((cellMatch2 = cellRegex2.exec(simpleMatch[1])) !== null) {
          cells.push(cellMatch2[1].replace(/<[^>]+>/g, "").trim());
        }
        if (cells.length >= 4) {
          results.push({
            name: cells[0] || "",
            licenseType: cells[1] || "",
            licenseNumber: cells[2] || "",
            status: cells[3] || "",
            expiration: cells[4] || "",
            city: cells[5] || "",
          });
        }
        if (results.length >= 5) break;
      }
    }

    if (results.length === 0) {
      return {
        source: "FL DOH MQA (Board of Nursing)",
        url: baseUrl,
        found: false,
        message: `No results found. Try checking the spelling or use a license number directly.`,
      };
    }

    return {
      source: "FL DOH MQA (Board of Nursing)",
      url: baseUrl,
      found: true,
      count: results.length,
      results: results.slice(0, 10),
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to query FL MQA",
      source: "FL DOH MQA",
      suggestion: "The FL DOH website may be temporarily unavailable. Try again later.",
    };
  }
}

// ─── Tool Definitions ───────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: "verify_nursing_license",
    description:
      "Verify a nursing license by searching the Florida Department of Health (FL DOH) MQA public database. Returns license type, status, expiration date, and location. Can search by name or license number.",
    input_schema: {
      type: "object" as const,
      properties: {
        first_name: { type: "string" as const, description: "Candidate's first name" },
        last_name: { type: "string" as const, description: "Candidate's last name" },
        license_number: { type: "string" as const, description: "License number (optional, more precise)" },
      },
      required: [],
    },
  },
  {
    name: "get_candidate_info",
    description: "Get details about a candidate (healthcare professional) by their profile ID",
    input_schema: {
      type: "object" as const,
      properties: {
        candidate_id: { type: "string" as const, description: "The profile (candidate) UUID" },
      },
      required: ["candidate_id"],
    },
  },
  {
    name: "list_candidates",
    description:
      "List healthcare professional candidates (profile rows where user_type = 'professional'). Optionally filter by role keyword or location.",
    input_schema: {
      type: "object" as const,
      properties: {
        role: { type: "string" as const, description: "Filter by role substring (case-insensitive)" },
        city: { type: "string" as const, description: "Filter by city" },
        limit: { type: "number" as const, description: "Max results (default 25)" },
      },
      required: [],
    },
  },
  {
    name: "list_jobs",
    description: "List jobs, optionally filtered by a title/role keyword.",
    input_schema: {
      type: "object" as const,
      properties: {
        keyword: { type: "string" as const, description: "Keyword to filter job_title or role" },
        limit: { type: "number" as const, description: "Max results (default 25)" },
      },
      required: [],
    },
  },
  {
    name: "get_job_matches",
    description:
      "Get AI-scored candidate matches previously stored for a job. Returns candidates ranked 0-100 with explanations.",
    input_schema: {
      type: "object" as const,
      properties: {
        job_id: { type: "string" as const, description: "The job UUID" },
        min_score: { type: "number" as const, description: "Minimum match score to include (default 0)" },
      },
      required: ["job_id"],
    },
  },
  {
    name: "run_job_matching",
    description: "Trigger fresh AI matching for a job against all professional candidates. Returns updated matches.",
    input_schema: {
      type: "object" as const,
      properties: {
        job_id: { type: "string" as const, description: "The job UUID" },
      },
      required: ["job_id"],
    },
  },
  {
    name: "find_candidates_for_job",
    description:
      "RAG-enhanced matching: vector pre-filter then AI fine-scoring. More accurate than run_job_matching when there are many candidates.",
    input_schema: {
      type: "object" as const,
      properties: {
        job_id: { type: "string" as const, description: "The job UUID" },
        top_k: { type: "number" as const, description: "How many candidates to pre-filter (default 20)" },
      },
      required: ["job_id"],
    },
  },
  {
    name: "semantic_search_candidates",
    description:
      "Natural-language candidate search using vector embeddings. Example: 'RN with ICU experience and BLS in Tampa'.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" as const, description: "Natural-language query" },
        limit: { type: "number" as const, description: "Max results (default 10)" },
        min_similarity: { type: "number" as const, description: "0-1 threshold (default 0.3)" },
      },
      required: ["query"],
    },
  },
  {
    name: "find_similar_jobs",
    description: "Find jobs similar to a description or to an existing job via vector embeddings.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" as const, description: "Natural-language description (alternative to job_id)" },
        job_id: { type: "string" as const, description: "Existing job UUID (alternative to query)" },
        limit: { type: "number" as const, description: "Max results (default 5)" },
      },
      required: [],
    },
  },
  {
    name: "remember_fact",
    description:
      "Store a fact in long-term memory. Use proactively when the employer states a preference or requirement that should persist.",
    input_schema: {
      type: "object" as const,
      properties: {
        fact: { type: "string" as const, description: "The fact to remember" },
        category: {
          type: "string" as const,
          enum: ["preference", "candidate_note", "job_requirement", "workflow", "general"],
          description: "Category of the fact",
        },
        entity_id: { type: "string" as const, description: "Optional related candidate/job UUID" },
        entity_type: { type: "string" as const, enum: ["candidate", "job"], description: "Entity type" },
      },
      required: ["fact", "category"],
    },
  },
  {
    name: "recall_context",
    description: "Recall facts relevant to a query from long-term memory.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" as const, description: "What to search for" },
        limit: { type: "number" as const, description: "Max facts (default 5)" },
      },
      required: ["query"],
    },
  },
];

// ─── Tool Execution ─────────────────────────────────────────

function profileName(p: { first_name: string | null; last_name: string | null }): string {
  return [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "Candidate";
}

async function executeFunction(
  name: string,
  args: Record<string, unknown>,
  userId?: string
): Promise<object> {
  switch (name) {
    case "verify_nursing_license": {
      return scrapeFLMQA({
        first_name: args.first_name ? String(args.first_name) : undefined,
        last_name: args.last_name ? String(args.last_name) : undefined,
        license_number: args.license_number ? String(args.license_number) : undefined,
      });
    }

    case "get_candidate_info": {
      const p = await prisma.profile.findUnique({
        where: { id: String(args.candidate_id) },
      });
      if (!p) return { error: "Candidate not found" };
      return {
        id: p.id,
        name: profileName(p),
        email: p.email,
        phone: p.phone_number,
        role: p.role,
        userType: p.user_type,
        about: p.about,
        city: p.city,
        state: p.state,
        country: p.country,
        preferredRoles: p.preferred_roles,
        careSpecialty: p.care_specialty,
        preferredJobType: p.preferred_job_type,
        preferredShiftType: p.preferred_shift_type,
      };
    }

    case "list_candidates": {
      const limit = typeof args.limit === "number" ? args.limit : 25;
      const role = args.role ? String(args.role) : undefined;
      const city = args.city ? String(args.city) : undefined;
      const candidates = await prisma.profile.findMany({
        where: {
          user_type: "professional",
          ...(role ? { role: { contains: role, mode: "insensitive" } } : {}),
          ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          role: true,
          city: true,
          state: true,
        },
        take: limit,
      });
      return {
        candidates: candidates.map((c) => ({
          id: c.id,
          name: profileName(c),
          email: c.email,
          role: c.role,
          city: c.city,
          state: c.state,
        })),
        count: candidates.length,
      };
    }

    case "list_jobs": {
      const limit = typeof args.limit === "number" ? args.limit : 25;
      const keyword = args.keyword ? String(args.keyword) : undefined;
      const jobsList = await prisma.jobs.findMany({
        where: keyword
          ? {
              OR: [
                { job_title: { contains: keyword, mode: "insensitive" } },
                { role: { contains: keyword, mode: "insensitive" } },
              ],
            }
          : {},
        select: {
          job_id: true,
          job_title: true,
          role: true,
          city: true,
          state: true,
          job_type: true,
          created_at: true,
          _count: { select: { job_match_scores: true, JobApplications: true } },
        },
        orderBy: { created_at: "desc" },
        take: limit,
      });
      return {
        jobs: jobsList.map((j) => ({
          id: j.job_id,
          title: j.job_title,
          role: j.role,
          location: [j.city, j.state].filter(Boolean).join(", ") || null,
          type: j.job_type,
          matchCount: j._count.job_match_scores,
          applicationCount: j._count.JobApplications,
        })),
        count: jobsList.length,
      };
    }

    case "get_job_matches": {
      const jobId = String(args.job_id);
      const minScore = typeof args.min_score === "number" ? args.min_score : 0;
      const matches = await prisma.job_match_scores.findMany({
        where: { job_id: jobId, score: { gte: minScore } },
        include: {
          profile: { select: { first_name: true, last_name: true, email: true, role: true } },
          jobs: { select: { job_title: true } },
        },
        orderBy: { score: "desc" },
        take: 10,
      });
      if (matches.length === 0) {
        return {
          matches: [],
          count: 0,
          message: "No matches found. Run AI matching first with run_job_matching.",
        };
      }
      return {
        jobTitle: matches[0].jobs.job_title,
        matches: matches.map((m) => ({
          candidateId: m.profile_id,
          candidateName: profileName(m.profile),
          candidateEmail: m.profile.email,
          candidateRole: m.profile.role,
          score: m.score,
          label: m.label,
          reason: m.reason,
        })),
        count: matches.length,
      };
    }

    case "run_job_matching": {
      try {
        const { computeAndStoreMatches } = await import("./matching-service");
        const jobId = String(args.job_id);
        const matches = await computeAndStoreMatches(jobId);
        return {
          success: true,
          jobId,
          matchesComputed: matches.length,
          topMatches: matches.slice(0, 5).map((m) => ({
            candidateName: profileName(m.profile),
            score: m.score,
            label: m.label,
            reason: m.reason,
          })),
        };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Failed to run job matching" };
      }
    }

    case "find_candidates_for_job": {
      try {
        const { computeAndStoreMatchesRAG } = await import("./matching-service");
        const jobId = String(args.job_id);
        const topK = typeof args.top_k === "number" ? args.top_k : 20;
        const matches = await computeAndStoreMatchesRAG(jobId, topK);
        return {
          success: true,
          jobId,
          matchesComputed: matches.length,
          method: "RAG-enhanced (vector pre-filter + AI scoring)",
          topMatches: matches.slice(0, 5).map((m) => ({
            candidateName: profileName(m.profile),
            score: m.score,
            label: m.label,
            reason: m.reason,
          })),
        };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "RAG matching failed" };
      }
    }

    case "semantic_search_candidates": {
      try {
        const query = String(args.query);
        const limit = typeof args.limit === "number" ? args.limit : 10;
        const minSimilarity = typeof args.min_similarity === "number" ? args.min_similarity : 0.3;

        const queryEmbedding = await generateEmbedding(query);
        const results = await searchSimilarProfiles(queryEmbedding, limit, minSimilarity);
        if (results.length === 0) {
          return {
            candidates: [],
            count: 0,
            message:
              "No semantically similar candidates found. Try a broader query, or embeddings may need to be generated first.",
          };
        }

        const ids = results.map((r) => r.profileId);
        const profiles = await prisma.profile.findMany({
          where: { id: { in: ids } },
          select: { id: true, first_name: true, last_name: true, email: true, role: true, city: true, state: true },
        });
        const byId = Object.fromEntries(profiles.map((p) => [p.id, p]));
        return {
          candidates: results
            .map((r) => {
              const p = byId[r.profileId];
              if (!p) return null;
              return {
                id: p.id,
                name: profileName(p),
                email: p.email,
                role: p.role,
                city: p.city,
                state: p.state,
                similarity: Number(r.similarity).toFixed(3),
              };
            })
            .filter(Boolean),
          count: results.length,
        };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Semantic search failed" };
      }
    }

    case "find_similar_jobs": {
      try {
        let queryEmbedding: number[];

        if (args.job_id) {
          const stored = await getJobEmbeddingVector(String(args.job_id));
          if (!stored) {
            const job = await prisma.jobs.findUnique({ where: { job_id: String(args.job_id) } });
            if (!job) return { error: "Job not found" };
            queryEmbedding = await generateEmbedding(
              buildJobText(job as Parameters<typeof buildJobText>[0])
            );
          } else {
            queryEmbedding = stored;
          }
        } else if (args.query) {
          queryEmbedding = await generateEmbedding(String(args.query));
        } else {
          return { error: "Provide either query or job_id" };
        }

        const limit = typeof args.limit === "number" ? args.limit : 5;
        const results = await searchSimilarJobs(queryEmbedding, limit);
        if (results.length === 0) return { jobs: [], count: 0, message: "No similar jobs found." };

        const ids = results.map((r) => r.jobId);
        const jobs = await prisma.jobs.findMany({
          where: { job_id: { in: ids } },
          select: { job_id: true, job_title: true, role: true, city: true, state: true, job_type: true },
        });
        const byId = Object.fromEntries(jobs.map((j) => [j.job_id, j]));
        return {
          jobs: results
            .map((r) => {
              const j = byId[r.jobId];
              if (!j) return null;
              return {
                id: j.job_id,
                title: j.job_title,
                role: j.role,
                location: [j.city, j.state].filter(Boolean).join(", ") || null,
                type: j.job_type,
                similarity: Number(r.similarity).toFixed(3),
              };
            })
            .filter(Boolean),
          count: results.length,
        };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Similar jobs search failed" };
      }
    }

    case "remember_fact": {
      try {
        if (!userId) return { error: "User context required to store memories" };
        const fact = String(args.fact);
        const category = String(args.category || "general");
        const entityId = args.entity_id ? String(args.entity_id) : null;
        const entityType = args.entity_type ? String(args.entity_type) : null;
        const result = await rememberFact(userId, fact, category, entityId, entityType);
        return { success: true, ...result, message: "Fact stored in long-term memory." };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Failed to store fact" };
      }
    }

    case "recall_context": {
      try {
        if (!userId) return { error: "User context required to recall memories" };
        const query = String(args.query);
        const limit = typeof args.limit === "number" ? args.limit : 5;
        const facts = await recallFacts(userId, query, limit);
        return {
          facts: facts.map((f) => ({
            fact: f.fact,
            category: f.category,
            relevance: Number(f.similarity).toFixed(3),
          })),
          count: facts.length,
        };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Failed to recall context" };
      }
    }

    default:
      return { error: `Unknown function: ${name}` };
  }
}

// ─── Prompt orchestration ───────────────────────────────────

function buildUserContent(
  userMessage: string,
  attachments: AgentAttachment[]
): MessageParam["content"] {
  const textBlocks: { type: "text"; text: string }[] = [];
  if (userMessage.trim()) {
    textBlocks.push({ type: "text", text: userMessage.trim() });
  }

  const content: MessageParam["content"] = [...textBlocks];
  for (const attachment of attachments.slice(0, 4)) {
    if (
      attachment.kind === "image" &&
      attachment.base64Data &&
      attachment.mediaType.startsWith("image/")
    ) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: attachment.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: attachment.base64Data,
        },
      });
      content.push({ type: "text", text: `Image attached: ${attachment.name}` });
      continue;
    }

    if (attachment.kind === "text" && attachment.textContent) {
      content.push({
        type: "text",
        text: `Attached file (${attachment.name}):\n${attachment.textContent.slice(0, 12000)}`,
      });
      continue;
    }

    content.push({
      type: "text",
      text: `Attached file: ${attachment.name} (${attachment.mediaType})`,
    });
  }

  return content;
}

export function isSimpleChatPrompt(message: string, attachments: AgentAttachment[]): boolean {
  if (attachments.length > 0) return false;
  const text = message.trim();
  if (!text) return false;
  if (text.length > 80) return false;
  if (TOOL_INTENT_RE.test(text)) return false;
  return SIMPLE_CHAT_RE.test(text) || text.split(/\s+/).length <= 8;
}

export async function runQuickAgentReply(
  message: string,
  model?: string,
  userId?: string
): Promise<string> {
  const response = await createMessage({
    model: model || "claude-haiku-4-5-20251001",
    maxTokens: 180,
    system: "You are CaresLink AI. Reply naturally in 1-2 short sentences. No tools.",
    messages: [{ role: "user", content: message }],
    endpoint: "agent",
    userId,
  });
  const text = response.content.find((b) => b.type === "text")?.text || "";
  return text || "Hi! I'm doing great - how can I help with recruiting today?";
}

export async function runAgent(
  userMessage: string,
  sessionId?: string,
  userId?: string,
  thinkingBudget?: number,
  attachments: AgentAttachment[] = [],
  model?: string,
  callbacks?: AgentStreamCallbacks
): Promise<string> {
  const provider = await getProvider();
  const providerName = await getProviderName();
  const apiKeyVar = provider === "groq" ? "GROQ_API_KEY" : "ANTHROPIC_API_KEY";
  if (provider === "anthropic" && !process.env.ANTHROPIC_API_KEY) {
    return "AI agent is not configured. Set ANTHROPIC_API_KEY in .env.local";
  }
  if (provider === "groq" && !process.env.GROQ_API_KEY) {
    return "AI agent is not configured. Set GROQ_API_KEY in .env.local (free at https://console.groq.com)";
  }

  const currentUserContent = buildUserContent(userMessage, attachments);
  let messages: MessageParam[] = [{ role: "user", content: currentUserContent }];

  if (sessionId && userId) {
    const memory = await prisma.agent_memory.findUnique({
      where: { session_id_user_id: { session_id: sessionId, user_id: userId } },
    });
    if (memory?.history && Array.isArray(memory.history)) {
      const stored = memory.history as unknown as MessageParam[];
      if (stored.length > 0) {
        messages = [...stored, { role: "user", content: currentUserContent }];
      }
    }
  }

  const maxTurns = 10;
  let turns = 0;
  let lastText = "";

  let systemPrompt = SYSTEM_PROMPT;
  if (userId) {
    try {
      const relevantFacts = await recallFacts(userId, userMessage, 3);
      if (relevantFacts.length > 0) {
        const contextBlock = relevantFacts
          .filter((f) => f.similarity > 0.35)
          .map((f) => `- ${f.fact}`)
          .join("\n");
        if (contextBlock) {
          systemPrompt += `\n\n[Relevant context from previous conversations:]\n${contextBlock}`;
        }
      }
    } catch {
      // Silently skip if semantic memory not available
    }
  }

  const saveHistory = async (history: MessageParam[]) => {
    if (!sessionId || !userId) return;
    const trimmed = history.slice(-20);
    await prisma.agent_memory.upsert({
      where: { session_id_user_id: { session_id: sessionId, user_id: userId } },
      update: { history: trimmed as object, updated_at: new Date() },
      create: { session_id: sessionId, user_id: userId, history: trimmed as object },
    });
  };

  try {
    while (turns < maxTurns) {
      const response = await createMessage({
        model: model || "claude-sonnet-4-6",
        maxTokens: 4096,
        system: systemPrompt,
        tools: TOOLS as AITool[],
        messages,
        endpoint: "agent",
        userId,
        thinkingBudget,
      });

      const textBlocks = response.content.filter((b) => b.type === "text");
      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");

      if (textBlocks.length > 0) {
        lastText = textBlocks[0].text || "";
        callbacks?.onText?.(lastText);
      }

      if (toolUseBlocks.length === 0) {
        const contentForHistory = response.content.map((b) =>
          b.type === "text"
            ? { type: "text" as const, text: b.text || "" }
            : { type: "tool_use" as const, id: b.id!, name: b.name!, input: b.input || {} }
        );
        await saveHistory([...messages, { role: "assistant", content: contentForHistory }]);
        return lastText || "Done.";
      }

      const contentForHistory = response.content.map((b) =>
        b.type === "text"
          ? { type: "text" as const, text: b.text || "" }
          : { type: "tool_use" as const, id: b.id!, name: b.name!, input: b.input || {} }
      );
      const assistantMsg: MessageParam = { role: "assistant", content: contentForHistory };
      const toolResults: { type: "tool_result"; tool_use_id: string; content: string }[] = [];

      for (const block of toolUseBlocks) {
        callbacks?.onToolStart?.(block.name || "tool");
        const result = await executeFunction(
          block.name!,
          (block.input ?? {}) as Record<string, unknown>,
          userId
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id!,
          content: JSON.stringify(result),
        });
      }

      messages = [...messages, assistantMsg, { role: "user", content: toolResults }];

      turns++;
    }

    await saveHistory(messages);
    return lastText || "Completed actions.";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("429") || msg.includes("overloaded") || msg.includes("rate")) {
      return `${providerName} API rate limit exceeded. Please wait a moment and try again.`;
    }
    if (msg.includes("401") || msg.includes("invalid_api_key") || msg.includes("authentication")) {
      return `${providerName} API key is invalid. Please check ${apiKeyVar} in your .env file.`;
    }
    throw err;
  }
}
