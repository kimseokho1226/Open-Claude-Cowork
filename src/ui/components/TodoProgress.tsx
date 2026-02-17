import { useMemo, useState } from "react";
import type { StreamMessage } from "../types";
import type { SDKMessage, SDKAssistantMessage } from "@anthropic-ai/claude-agent-sdk";

interface Todo {
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm?: string;
}

interface TodoProgressProps {
  messages: StreamMessage[];
}

export function TodoProgress({ messages }: TodoProgressProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract the latest todo list from messages
  const todos = useMemo(() => {
    let latestTodos: Todo[] = [];

    for (const msg of messages) {
      if (msg.type === "user_prompt") continue;

      const sdkMsg = msg as SDKMessage;

      if (sdkMsg.type === "assistant") {
        const assistantMsg = sdkMsg as SDKAssistantMessage;
        for (const content of assistantMsg.message.content) {
          if (content.type === "tool_use" && content.name === "TodoWrite") {
            const input = content.input as { todos?: Todo[] };
            if (input?.todos && Array.isArray(input.todos)) {
              latestTodos = input.todos;
            }
          }
        }
      }
    }

    return latestTodos;
  }, [messages]);

  if (todos.length === 0) return null;

  const completedCount = todos.filter(t => t.status === "completed").length;
  const inProgressCount = todos.filter(t => t.status === "in_progress").length;
  const pendingCount = todos.filter(t => t.status === "pending").length;
  const progress = Math.round((completedCount / todos.length) * 100);

  const currentTask = todos.find(t => t.status === "in_progress");

  return (
    <div className="mx-auto max-w-3xl mb-4">
      <div className="rounded-xl border border-ink-900/10 bg-surface overflow-hidden">
        {/* Header with progress bar */}
        <button
          className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-secondary transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-accent" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
              <span className="text-sm font-medium text-ink-700">Tasks</span>
            </div>

            {/* Mini progress */}
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 bg-surface-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-muted">{completedCount}/{todos.length}</span>
            </div>

            {/* Current task */}
            {currentTask && (
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-info" />
                </span>
                <span className="text-xs text-ink-600 truncate">{currentTask.activeForm || currentTask.content}</span>
              </div>
            )}
          </div>

          <svg viewBox="0 0 24 24" className={`h-4 w-4 text-muted shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {/* Expanded task list */}
        {isExpanded && (
          <div className="border-t border-ink-900/5 px-4 py-2 space-y-1">
            {todos.map((todo, idx) => (
              <div key={idx} className="flex items-start gap-2 py-1">
                {todo.status === "completed" ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-success shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4" />
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                ) : todo.status === "in_progress" ? (
                  <span className="relative flex h-4 w-4 items-center justify-center shrink-0 mt-0.5">
                    <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-info opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-info" />
                  </span>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                )}
                <span className={`text-sm ${todo.status === "completed" ? "text-muted line-through" : todo.status === "in_progress" ? "text-ink-700 font-medium" : "text-ink-600"}`}>
                  {todo.content}
                </span>
              </div>
            ))}

            {/* Status summary */}
            <div className="flex items-center gap-4 pt-2 border-t border-ink-900/5 mt-2 text-xs text-muted">
              {completedCount > 0 && (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  {completedCount} completed
                </span>
              )}
              {inProgressCount > 0 && (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-info" />
                  {inProgressCount} in progress
                </span>
              )}
              {pendingCount > 0 && (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-muted" />
                  {pendingCount} pending
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
