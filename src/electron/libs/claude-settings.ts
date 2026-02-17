import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { loadApiConfig, saveApiConfig, type ApiConfig } from "./config-store.js";
import { app } from "electron";

// Get Claude Code CLI path
export function getClaudeCodePath(): string {
  if (app.isPackaged) {
    // For packaged apps, the SDK needs the explicit path to the CLI
    // The path should point to the unpackaged asar.unpacked directory
    return join(
      process.resourcesPath,
      'app.asar.unpacked/node_modules/@anthropic-ai/claude-agent-sdk/cli.js'
    );
  }
  // In development, use node_modules CLI
  return join(app.getAppPath(), 'node_modules/@anthropic-ai/claude-agent-sdk/cli.js');
}

// 获取当前有效的配置（优先界面配置，回退到文件配置）
export function getCurrentApiConfig(): ApiConfig | null {
  const uiConfig = loadApiConfig();
  if (uiConfig) {
    console.log("[claude-settings] Using UI config:", {
      baseURL: uiConfig.baseURL,
      model: uiConfig.model,
      apiType: uiConfig.apiType
    });
    return uiConfig;
  }

  // 回退到 ~/.claude/settings.json
  try {
    const settingsPath = join(homedir(), ".claude", "settings.json");
    const raw = readFileSync(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as { env?: Record<string, unknown> };
    if (parsed.env) {
      const authToken = parsed.env.ANTHROPIC_AUTH_TOKEN;
      const baseURL = parsed.env.ANTHROPIC_BASE_URL;
      const model = parsed.env.ANTHROPIC_MODEL;

      if (authToken && baseURL && model) {
        console.log("[claude-settings] Using file config from ~/.claude/settings.json");
        const config: ApiConfig = {
          apiKey: String(authToken),
          baseURL: String(baseURL),
          model: String(model),
          apiType: "anthropic"
        };
        // 持久化到 api-config.json
        try {
          saveApiConfig(config);
          console.log("[claude-settings] Persisted config to api-config.json");
        } catch (e) {
          console.error("[claude-settings] Failed to persist config:", e);
        }
        return config;
      }
    }
  } catch {
    // Ignore missing or invalid settings file.
  }
  
  console.log("[claude-settings] No config found");
  return null;
}

// Map common shorthand model names to valid full model identifiers.
// The Claude Code CLI rejects shorthand names like "claude-sonnet",
// so we normalize them to valid IDs with date suffixes.
const MODEL_ALIASES: Record<string, string> = {
  "sonnet": "claude-sonnet-4-5-20250929",
  "claude-sonnet": "claude-sonnet-4-5-20250929",
  "claude-sonnet-4": "claude-sonnet-4-20250514",
  "claude-sonnet-4-5": "claude-sonnet-4-5-20250929",
  "opus": "claude-opus-4-20250514",
  "claude-opus": "claude-opus-4-20250514",
  "claude-opus-4": "claude-opus-4-20250514",
  "claude-opus-4-6": "claude-opus-4-20250514",
  "haiku": "claude-haiku-4-5-20251001",
  "claude-haiku": "claude-haiku-4-5-20251001",
  "claude-haiku-4-5": "claude-haiku-4-5-20251001",
};

export function normalizeModelName(model: string): string {
  if (!model) return "claude-sonnet-4-5-20250929";
  const lower = model.trim().toLowerCase();
  if (MODEL_ALIASES[lower]) {
    console.log(`[claude-settings] Normalized model name: "${model}" → "${MODEL_ALIASES[lower]}"`);
    return MODEL_ALIASES[lower];
  }
  // Already a full model ID (has date suffix like -20250929) or unknown → pass through
  return model.trim();
}

export function buildEnvForConfig(config: ApiConfig): Record<string, string> {
  const baseEnv = { ...process.env } as Record<string, string>;

  baseEnv.ANTHROPIC_AUTH_TOKEN = config.apiKey;
  baseEnv.ANTHROPIC_BASE_URL = config.baseURL;
  baseEnv.ANTHROPIC_MODEL = normalizeModelName(config.model);

  return baseEnv;
}
