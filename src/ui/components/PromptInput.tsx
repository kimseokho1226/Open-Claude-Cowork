import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientEvent } from "../types";
import { useAppStore } from "../store/useAppStore";

const DEFAULT_ALLOWED_TOOLS = "Read,Edit,Bash";
const MAX_ROWS = 12;
const LINE_HEIGHT = 21;
const MAX_HEIGHT = MAX_ROWS * LINE_HEIGHT;

// Common slash commands supported by Claude Code
const SLASH_COMMANDS = [
  { command: "/help", description: "Show available commands" },
  { command: "/commit", description: "Commit staged changes with AI message" },
  { command: "/review", description: "Review code changes" },
  { command: "/explain", description: "Explain selected code" },
  { command: "/fix", description: "Fix errors or bugs" },
  { command: "/test", description: "Generate tests for code" },
  { command: "/docs", description: "Generate documentation" },
];

interface PromptInputProps {
  sendEvent: (event: ClientEvent) => void;
  onSendMessage?: () => void;
  disabled?: boolean;
}

export function usePromptActions(sendEvent: (event: ClientEvent) => void) {
  const prompt = useAppStore((state) => state.prompt);
  const cwd = useAppStore((state) => state.cwd);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const sessions = useAppStore((state) => state.sessions);
  const setPrompt = useAppStore((state) => state.setPrompt);
  const setPendingStart = useAppStore((state) => state.setPendingStart);
  const setGlobalError = useAppStore((state) => state.setGlobalError);

  const activeSession = activeSessionId ? sessions[activeSessionId] : undefined;
  const isRunning = activeSession?.status === "running";

  const handleSend = useCallback(async () => {
    if (!prompt.trim()) return;

    if (!activeSessionId) {
      let title = "";
      try {
        setPendingStart(true);
        title = await window.electron.generateSessionTitle(prompt);
      } catch (error) {
        console.error(error);
        setPendingStart(false);
        setGlobalError("Failed to get session title.");
        return;
      }
      sendEvent({
        type: "session.start",
        payload: { title, prompt, cwd: cwd.trim() || undefined, allowedTools: DEFAULT_ALLOWED_TOOLS }
      });
    } else {
      if (activeSession?.status === "running") {
        setGlobalError("Session is still running. Please wait for it to finish.");
        return;
      }
      sendEvent({ type: "session.continue", payload: { sessionId: activeSessionId, prompt } });
    }
    setPrompt("");
  }, [activeSession, activeSessionId, cwd, prompt, sendEvent, setGlobalError, setPendingStart, setPrompt]);

  const handleStop = useCallback(() => {
    if (!activeSessionId) return;
    sendEvent({ type: "session.stop", payload: { sessionId: activeSessionId } });
  }, [activeSessionId, sendEvent]);

  const handleStartFromModal = useCallback(() => {
    if (!cwd.trim()) {
      setGlobalError("Working Directory is required to start a session.");
      return;
    }
    handleSend();
  }, [cwd, handleSend, setGlobalError]);

  return { prompt, setPrompt, isRunning, handleSend, handleStop, handleStartFromModal };
}

export function PromptInput({ sendEvent, onSendMessage, disabled = false }: PromptInputProps) {
  const { prompt, setPrompt, isRunning, handleSend, handleStop } = usePromptActions(sendEvent);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const isComposingRef = useRef(false);
  const [localValue, setLocalValue] = useState(prompt);
  const [showCommands, setShowCommands] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);

  // Filter commands based on input
  const filteredCommands = useMemo(() => {
    if (!localValue.startsWith("/")) return [];
    const query = localValue.slice(1).toLowerCase();
    return SLASH_COMMANDS.filter(cmd =>
      cmd.command.slice(1).toLowerCase().startsWith(query) ||
      cmd.description.toLowerCase().includes(query)
    );
  }, [localValue]);

  // Sync local value with store when prompt changes externally
  useEffect(() => {
    if (!isComposingRef.current) {
      setLocalValue(prompt);
    }
  }, [prompt]);

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    isComposingRef.current = false;
    const value = e.currentTarget.value;
    setLocalValue(value);
    setPrompt(value);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setLocalValue(value);
    // Only update store if not composing (for non-IME input)
    if (!isComposingRef.current) {
      setPrompt(value);
    }
    // Show command suggestions when typing "/"
    setShowCommands(value.startsWith("/") && value.length < 20);
    setSelectedCommandIndex(0);
  };

  const handleSelectCommand = (command: string) => {
    setLocalValue(command + " ");
    setPrompt(command + " ");
    setShowCommands(false);
    promptRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled && !isRunning) return;
    // Don't submit during IME composition
    if (isComposingRef.current) return;

    // Handle command selection with arrow keys
    if (showCommands && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCommandIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCommandIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        handleSelectCommand(filteredCommands[selectedCommandIndex].command);
        return;
      }
      if (e.key === "Escape") {
        setShowCommands(false);
        return;
      }
    }

    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    if (isRunning) { handleStop(); return; }
    onSendMessage?.();
    handleSend();
  };

  const handleButtonClick = () => {
    if (disabled && !isRunning) return;
    if (isRunning) {
      handleStop();
    } else {
      onSendMessage?.();
      handleSend();
    }
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    requestAnimationFrame(() => {
      target.style.height = "auto";
      const scrollHeight = target.scrollHeight;
      if (scrollHeight > MAX_HEIGHT) {
        target.style.height = `${MAX_HEIGHT}px`;
        target.style.overflowY = "auto";
      } else {
        target.style.height = `${scrollHeight}px`;
        target.style.overflowY = "hidden";
      }
    });
  };

  useEffect(() => {
    if (!promptRef.current) return;
    promptRef.current.style.height = "auto";
    const scrollHeight = promptRef.current.scrollHeight;
    if (scrollHeight > MAX_HEIGHT) {
      promptRef.current.style.height = `${MAX_HEIGHT}px`;
      promptRef.current.style.overflowY = "auto";
    } else {
      promptRef.current.style.height = `${scrollHeight}px`;
      promptRef.current.style.overflowY = "hidden";
    }
  }, [localValue]);

  return (
    <section className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-surface via-surface to-transparent pb-6 px-2 lg:pb-8 pt-8 lg:ml-[280px]">
      {/* Slash Command Suggestions */}
      {showCommands && filteredCommands.length > 0 && (
        <div className="mx-auto max-w-full lg:max-w-3xl mb-2 px-2">
          <div className="rounded-xl border border-ink-900/10 bg-surface shadow-card overflow-hidden">
            <div className="px-3 py-2 border-b border-ink-900/5 text-xs text-muted font-medium">
              Commands
            </div>
            <div className="py-1">
              {filteredCommands.map((cmd, idx) => (
                <button
                  key={cmd.command}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                    idx === selectedCommandIndex ? "bg-accent-subtle" : "hover:bg-surface-secondary"
                  }`}
                  onClick={() => handleSelectCommand(cmd.command)}
                  onMouseEnter={() => setSelectedCommandIndex(idx)}
                >
                  <span className="text-sm font-medium text-accent">{cmd.command}</span>
                  <span className="text-sm text-muted">{cmd.description}</span>
                </button>
              ))}
            </div>
            <div className="px-3 py-1.5 border-t border-ink-900/5 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-surface-secondary text-ink-600">↑</kbd>
                <kbd className="px-1 py-0.5 rounded bg-surface-secondary text-ink-600">↓</kbd>
                navigate
              </span>
              <span className="ml-3 inline-flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-surface-secondary text-ink-600">Tab</kbd>
                select
              </span>
              <span className="ml-3 inline-flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-surface-secondary text-ink-600">Esc</kbd>
                close
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-full items-end gap-3 rounded-2xl border border-ink-900/10 bg-surface px-4 py-3 shadow-card lg:max-w-3xl">
        <textarea
          rows={1}
          className="flex-1 resize-none bg-transparent py-1.5 text-sm text-ink-800 placeholder:text-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          placeholder={disabled ? "Create/select a task to start..." : "Describe what you want agent to handle..."}
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          ref={promptRef}
          disabled={disabled && !isRunning}
        />
        <button
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${isRunning ? "bg-error text-white hover:bg-error/90" : "bg-accent text-white hover:bg-accent-hover"}`}
          onClick={handleButtonClick}
          aria-label={isRunning ? "Stop session" : "Send prompt"}
          disabled={disabled && !isRunning}
        >
          {isRunning ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path d="M3.4 20.6 21 12 3.4 3.4l2.8 7.2L16 12l-9.8 1.4-2.8 7.2Z" fill="currentColor" /></svg>
          )}
        </button>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="mx-auto max-w-full lg:max-w-3xl mt-2 flex items-center justify-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-surface-secondary text-ink-500 font-mono text-[10px]">Enter</kbd>
          <span>send</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-surface-secondary text-ink-500 font-mono text-[10px]">Shift+Enter</kbd>
          <span>new line</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-surface-secondary text-ink-500 font-mono text-[10px]">/</kbd>
          <span>commands</span>
        </span>
      </div>
    </section>
  );
}
