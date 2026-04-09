/**
 * Unified AI Provider Abstraction
 *
 * Supports Anthropic (Claude) and Groq (Llama, Mixtral, etc.)
 * Provider is selected via AI_PROVIDER env var or the Settings table.
 *
 * All call sites use this module instead of importing SDKs directly.
 */

import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import type {
  ChatCompletionTool as GroqTool,
  ChatCompletionMessageParam as GroqMessage,
  ChatCompletion as GroqCompletion,
  ChatCompletionCreateParamsNonStreaming as GroqCreateParams,
} from "groq-sdk/resources/chat/completions";
import type { Tool as AnthropicTool, MessageParam } from "@anthropic-ai/sdk/resources/messages";

// ─── Types ──────────────────────────────────────────────────────

export type AIProvider = "anthropic" | "groq";

/** Unified content block returned from any provider */
export interface ContentBlock {
  type: "text" | "tool_use";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

/** Unified response from any provider */
export interface AIResponse {
  content: ContentBlock[];
  stopReason: "end_turn" | "tool_use" | "max_tokens";
}

/** Tool definition in Anthropic format (our canonical format) */
export type AITool = AnthropicTool;

// CreateMessageOptions is defined below, next to createMessage

// ─── Model mapping ──────────────────────────────────────────────

/** Default Groq models mapped from Anthropic model tiers */
const ANTHROPIC_TO_GROQ: Record<string, string> = {
  // Sonnet-class → Llama 3.3 70B (best Groq model for complex tasks)
  "claude-sonnet-4-20250514": "llama-3.3-70b-versatile",
  "claude-sonnet-4-6": "llama-3.3-70b-versatile",
  // Haiku-class → Llama 3.1 8B (fast, lightweight)
  "claude-haiku-4-5-20251001": "llama-3.1-8b-instant",
};

const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

function mapModel(anthropicModel: string, provider: AIProvider): string {
  if (provider === "anthropic") return anthropicModel;
  return ANTHROPIC_TO_GROQ[anthropicModel] || DEFAULT_GROQ_MODEL;
}

// ─── Clients (lazy singletons) ──────────────────────────────────

let _anthropic: Anthropic | null = null;
let _groq: Groq | null = null;

function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
    _anthropic = new Anthropic({ apiKey });
  }
  return _anthropic;
}

function getGroqClient(): Groq {
  if (!_groq) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY not set — add it to your .env file (free at https://console.groq.com)");
    _groq = new Groq({ apiKey });
  }
  return _groq;
}

// ─── Provider resolution ────────────────────────────────────────

/** Cached provider from settings (refreshed every 60s) */
let _cachedProvider: AIProvider | null = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

/**
 * Get the active AI provider.
 * Priority: AI_PROVIDER env var > Settings table > "anthropic" default
 */
export async function getProvider(): Promise<AIProvider> {
  // Env var takes priority (fast path, no DB hit)
  const envProvider = process.env.AI_PROVIDER?.toLowerCase();
  if (envProvider === "groq" || envProvider === "anthropic") {
    return envProvider;
  }

  // Check settings table (cached)
  if (_cachedProvider && Date.now() - _cacheTime < CACHE_TTL) {
    return _cachedProvider;
  }

  try {
    const { prisma } = await import("./db");
    const settings = await prisma.settings.findUnique({ where: { id: "default" } });
    const provider = (settings as Record<string, unknown>)?.aiProvider;
    if (provider === "groq" || provider === "anthropic") {
      _cachedProvider = provider;
      _cacheTime = Date.now();
      return provider;
    }
  } catch {
    // DB not available, fall through to default
  }

  _cachedProvider = "anthropic";
  _cacheTime = Date.now();
  return "anthropic";
}

/** Check if the configured provider is available (has API key) */
export function isProviderAvailable(provider: AIProvider): boolean {
  if (provider === "anthropic") return !!process.env.ANTHROPIC_API_KEY;
  if (provider === "groq") return !!process.env.GROQ_API_KEY;
  return false;
}

// ─── Format converters ──────────────────────────────────────────

/** Convert Anthropic-format tools to Groq/OpenAI-format tools */
function toGroqTools(tools: AITool[]): GroqTool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description || "",
      parameters: t.input_schema as Record<string, unknown>,
    },
  }));
}

/** Convert Anthropic-format messages to Groq/OpenAI-format messages */
function toGroqMessages(
  messages: MessageParam[],
  system?: string
): GroqMessage[] {
  const result: GroqMessage[] = [];

  // System prompt goes as the first message
  if (system) {
    result.push({ role: "system", content: system });
  }

  for (const msg of messages) {
    if (msg.role === "assistant") {
      // Anthropic assistant messages can have content blocks
      if (typeof msg.content === "string") {
        result.push({ role: "assistant", content: msg.content });
      } else if (Array.isArray(msg.content)) {
        // Check for tool_use blocks
        const textParts = msg.content.filter((b) => b.type === "text");
        const toolParts = msg.content.filter((b) => b.type === "tool_use");

        const textContent = textParts
          .map((b) => (b as { type: "text"; text: string }).text)
          .join("");

        if (toolParts.length > 0) {
          result.push({
            role: "assistant",
            content: textContent || null,
            tool_calls: toolParts.map((b) => {
              const tb = b as { type: "tool_use"; id: string; name: string; input: unknown };
              return {
                id: tb.id,
                type: "function" as const,
                function: {
                  name: tb.name,
                  arguments: JSON.stringify(tb.input),
                },
              };
            }),
          } as GroqMessage);
        } else {
          result.push({ role: "assistant", content: textContent });
        }
      }
    } else if (msg.role === "user") {
      if (typeof msg.content === "string") {
        result.push({ role: "user", content: msg.content });
      } else if (Array.isArray(msg.content)) {
        // Check for tool_result blocks (Anthropic format)
        const toolResults = msg.content.filter(
          (b) => (b as unknown as Record<string, unknown>).type === "tool_result"
        );
        if (toolResults.length > 0) {
          // Convert each tool_result to a Groq "tool" role message
          for (const tr of toolResults) {
            const trb = tr as { type: "tool_result"; tool_use_id: string; content: string };
            result.push({
              role: "tool",
              tool_call_id: trb.tool_use_id,
              content: typeof trb.content === "string" ? trb.content : JSON.stringify(trb.content),
            } as GroqMessage);
          }
        } else {
          // Text content blocks
          const text = msg.content
            .map((b) => {
              if ((b as unknown as Record<string, unknown>).type === "text") {
                return (b as unknown as { type: "text"; text: string }).text;
              }
              return "";
            })
            .join("");
          result.push({ role: "user", content: text });
        }
      }
    }
  }

  return result;
}

/** Convert Groq response to our unified AIResponse format */
function fromGroqResponse(response: GroqCompletion): AIResponse {
  const choice = response.choices[0];
  if (!choice) {
    return { content: [{ type: "text", text: "" }], stopReason: "end_turn" };
  }

  const content: ContentBlock[] = [];

  // Add text content if present
  if (choice.message.content) {
    content.push({ type: "text", text: choice.message.content });
  }

  // Add tool calls if present
  if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
    for (const tc of choice.message.tool_calls) {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(tc.function.arguments);
      } catch {
        input = {};
      }
      content.push({
        type: "tool_use",
        id: tc.id,
        name: tc.function.name,
        input,
      });
    }
  }

  // If no content at all, add empty text
  if (content.length === 0) {
    content.push({ type: "text", text: "" });
  }

  const stopReason: AIResponse["stopReason"] =
    choice.finish_reason === "tool_calls" ? "tool_use" :
    choice.finish_reason === "length" ? "max_tokens" :
    "end_turn";

  return { content, stopReason };
}

// ─── Usage logging ─────────────────────────────────────────────

/** Cost per 1M tokens in cents for each provider/model */
const COST_PER_1M_TOKENS: Record<string, { input: number; output: number }> = {
  // Anthropic (cents per 1M tokens)
  "claude-sonnet-4-6":        { input: 300, output: 1500 },
  "claude-sonnet-4-20250514": { input: 300, output: 1500 },
  "claude-haiku-4-5-20251001": { input: 80, output: 400 },
  // Groq (cents per 1M tokens)
  "llama-3.3-70b-versatile":  { input: 59, output: 79 },
  "llama-3.1-70b-versatile":  { input: 59, output: 79 },
  "llama-3.1-8b-instant":     { input: 5, output: 8 },
  "mixtral-8x7b-32768":       { input: 24, output: 24 },
  "gemma2-9b-it":             { input: 20, output: 20 },
};

function estimateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_1M_TOKENS[model] || { input: 100, output: 100 };
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
}

/** Log AI usage asynchronously (fire-and-forget, never blocks the response) */
function logUsage(data: {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  endpoint?: string;
  userId?: string;
  candidateId?: string;
  success: boolean;
  errorMessage?: string;
}) {
  const totalTokens = data.inputTokens + data.outputTokens;
  const costCents = estimateCostCents(data.model, data.inputTokens, data.outputTokens);

  import("./db").then(({ prisma }) =>
    prisma.aIUsageLog.create({
      data: {
        provider: data.provider,
        model: data.model,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalTokens,
        costCents,
        durationMs: data.durationMs,
        endpoint: data.endpoint,
        userId: data.userId,
        candidateId: data.candidateId,
        success: data.success,
        errorMessage: data.errorMessage,
      },
    }).catch((e) => console.error("Failed to log AI usage:", e))
  );
}

// ─── Main API ───────────────────────────────────────────────────

/** Options passed through for usage tracking */
export interface CreateMessageOptions {
  model?: string;
  system?: string;
  messages: MessageParam[];
  tools?: AITool[];
  maxTokens?: number;
  /**
   * Enable extended thinking (Anthropic only, claude-sonnet-4-6+ / claude-opus-4-6+).
   * budget_tokens controls how much the model "thinks" before responding.
   * Min: 1024. max_tokens must be > budget_tokens.
   * Set to 0 or omit to disable thinking (fast mode).
   */
  thinkingBudget?: number;
  /** Which feature triggered this call (e.g. "agent", "screening", "matching") */
  endpoint?: string;
  /** User who triggered the call */
  userId?: string;
  /** Candidate related to the call */
  candidateId?: string;
}

/**
 * Create an AI message (unified interface for both providers).
 *
 * Messages and tools use Anthropic format — automatically converted for Groq.
 * Returns a unified AIResponse with content blocks.
 */
export async function createMessage(opts: CreateMessageOptions): Promise<AIResponse> {
  const provider = await getProvider();
  const model = mapModel(opts.model || "claude-sonnet-4-6", provider);
  const maxTokens = opts.maxTokens || 4096;
  const startTime = Date.now();

  if (provider === "groq") {
    const groq = getGroqClient();
    const groqMessages = toGroqMessages(opts.messages, opts.system);
    const groqOpts: GroqCreateParams = {
      model,
      messages: groqMessages,
      max_tokens: maxTokens,
    };

    if (opts.tools && opts.tools.length > 0) {
      groqOpts.tools = toGroqTools(opts.tools);
      groqOpts.tool_choice = "auto";
    }

    try {
      const response = await groq.chat.completions.create(groqOpts);
      const durationMs = Date.now() - startTime;
      logUsage({
        provider: "groq",
        model,
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        durationMs,
        endpoint: opts.endpoint,
        userId: opts.userId,
        candidateId: opts.candidateId,
        success: true,
      });
      return fromGroqResponse(response);
    } catch (err) {
      logUsage({
        provider: "groq", model, inputTokens: 0, outputTokens: 0,
        durationMs: Date.now() - startTime,
        endpoint: opts.endpoint, userId: opts.userId,
        success: false, errorMessage: (err as Error).message,
      });
      throw err;
    }
  }

  // Default: Anthropic
  const anthropic = getAnthropicClient();

  // Extended thinking: requires budget >= 1024, max_tokens > budget
  const thinkingBudget = opts.thinkingBudget && opts.thinkingBudget >= 1024 ? opts.thinkingBudget : 0;
  const effectiveMaxTokens = thinkingBudget > 0 ? Math.max(maxTokens, thinkingBudget + 1024) : maxTokens;

  const anthropicOpts: Anthropic.MessageCreateParams = {
    model,
    max_tokens: effectiveMaxTokens,
    messages: opts.messages,
  };

  if (opts.system) {
    anthropicOpts.system = opts.system;
  }

  if (opts.tools && opts.tools.length > 0) {
    anthropicOpts.tools = opts.tools;
  }

  if (thinkingBudget > 0) {
    // Thinking is incompatible with tool_choice and temperature — strip them
    anthropicOpts.thinking = { type: "enabled", budget_tokens: thinkingBudget };
    delete anthropicOpts.tool_choice;
    delete anthropicOpts.temperature;
    // Tools also not compatible with extended thinking — clear them
    delete anthropicOpts.tools;
  }

  try {
    const response = await anthropic.messages.create(anthropicOpts);
    const durationMs = Date.now() - startTime;
    logUsage({
      provider: "anthropic",
      model,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      durationMs,
      endpoint: opts.endpoint,
      userId: opts.userId,
      candidateId: opts.candidateId,
      success: true,
    });

    // Convert Anthropic response to unified format
    const content: ContentBlock[] = response.content
      .filter((block) => block.type !== "thinking") // skip thinking blocks in unified output
      .map((block) => {
        if (block.type === "text") {
          return { type: "text" as const, text: block.text };
        }
        if (block.type === "tool_use") {
          return {
            type: "tool_use" as const,
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          };
        }
        return { type: "text" as const, text: "" };
      });

    const stopReason: AIResponse["stopReason"] =
      response.stop_reason === "tool_use" ? "tool_use" :
      response.stop_reason === "max_tokens" ? "max_tokens" :
      "end_turn";

    return { content, stopReason };
  } catch (err) {
    logUsage({
      provider: "anthropic", model, inputTokens: 0, outputTokens: 0,
      durationMs: Date.now() - startTime,
      endpoint: opts.endpoint, userId: opts.userId,
      success: false, errorMessage: (err as Error).message,
    });
    throw err;
  }
}

/**
 * Simple text completion — returns just the text string.
 * Convenience wrapper around createMessage for non-tool-use calls.
 */
export async function textCompletion(opts: {
  model?: string;
  system?: string;
  messages: MessageParam[];
  maxTokens?: number;
}): Promise<string> {
  const response = await createMessage(opts);
  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text || "";
}

/** Get the current provider name (for error messages, UI display) */
export async function getProviderName(): Promise<string> {
  const provider = await getProvider();
  return provider === "groq" ? "Groq" : "Anthropic";
}

/** Get available Groq models */
export function getGroqModels(): { id: string; name: string; contextWindow: number }[] {
  return [
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", contextWindow: 128000 },
    { id: "llama-3.1-70b-versatile", name: "Llama 3.1 70B", contextWindow: 128000 },
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B (Fast)", contextWindow: 128000 },
    { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", contextWindow: 32768 },
    { id: "gemma2-9b-it", name: "Gemma 2 9B", contextWindow: 8192 },
  ];
}
