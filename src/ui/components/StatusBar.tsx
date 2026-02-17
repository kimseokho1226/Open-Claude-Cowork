import { useMemo } from "react";
import type { StreamMessage } from "../types";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

interface StatusBarProps {
  messages: StreamMessage[];
  sessionStatus: string;
  isConnected: boolean;
}

export function StatusBar({ messages, sessionStatus, isConnected }: StatusBarProps) {
  // Extract model and usage info from messages
  const { modelName, totalInputTokens, totalOutputTokens, totalCost } = useMemo(() => {
    let model = "";
    let inputTokens = 0;
    let outputTokens = 0;
    let cost = 0;

    for (const msg of messages) {
      if (msg.type === "user_prompt") continue;

      const sdkMsg = msg as SDKMessage;

      // Get model from system init message
      if (sdkMsg.type === "system" && "subtype" in sdkMsg && sdkMsg.subtype === "init") {
        model = (sdkMsg as any).model || "";
      }

      // Get usage from result message
      if (sdkMsg.type === "result" && sdkMsg.subtype === "success") {
        if (sdkMsg.usage) {
          inputTokens = sdkMsg.usage.input_tokens || 0;
          outputTokens = sdkMsg.usage.output_tokens || 0;
        }
        if (typeof sdkMsg.total_cost_usd === "number") {
          cost = sdkMsg.total_cost_usd;
        }
      }
    }

    return {
      modelName: model,
      totalInputTokens: inputTokens,
      totalOutputTokens: outputTokens,
      totalCost: cost
    };
  }, [messages]);

  const formatTokens = (tokens: number) => {
    if (tokens === 0) return "-";
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(2)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  const getStatusColor = () => {
    if (!isConnected) return "text-error";
    switch (sessionStatus) {
      case "running": return "text-info";
      case "completed": return "text-success";
      case "error": return "text-error";
      default: return "text-muted";
    }
  };

  const getStatusLabel = () => {
    if (!isConnected) return "Disconnected";
    switch (sessionStatus) {
      case "running": return "Running";
      case "completed": return "Completed";
      case "error": return "Error";
      case "idle": return "Idle";
      default: return "Ready";
    }
  };

  const getStatusDot = () => {
    if (!isConnected) return "bg-error";
    switch (sessionStatus) {
      case "running": return "bg-info animate-pulse";
      case "completed": return "bg-success";
      case "error": return "bg-error";
      default: return "bg-muted";
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-1.5 border-t border-ink-900/10 bg-surface-secondary text-xs text-muted select-none">
      <div className="flex items-center gap-4">
        {/* Connection Status */}
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${getStatusDot()}`} />
          <span className={getStatusColor()}>{getStatusLabel()}</span>
        </div>

        {/* Model Name */}
        {modelName && (
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <span className="font-medium text-ink-600">{modelName}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Token Usage */}
        {(totalInputTokens > 0 || totalOutputTokens > 0) && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
              <span>{formatTokens(totalInputTokens)}</span>
            </div>
            <div className="flex items-center gap-1">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
              <span>{formatTokens(totalOutputTokens)}</span>
            </div>
          </div>
        )}

        {/* Cost */}
        {totalCost > 0 && (
          <div className="flex items-center gap-1 text-accent">
            <span>${totalCost.toFixed(4)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
