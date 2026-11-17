import {
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { flushSync } from "react-dom";
import { askChat, checkHealth } from "./chat-api.js";
import { conversationReducer, INITIAL_CONVERSATION, isFull, type Message } from "./conversation.js";
import { content } from "../../content/content.js";
import { chatStatus, type ChatStatus, type Health } from "./status.js";
import "./Chat.css";

const NAME = "Ask about Emiliano";
const SUBTITLE = "AI assistant. Answers come only from this site.";
const GREETING = "Hi! Ask me about Emiliano's experience or the V1be Coding series.";
const SUGGESTIONS = [
  "What does Emiliano work on?",
  "What is V1be Coding?",
  "How can I contact Emiliano?",
];
const MAX_QUESTION_LENGTH = 500;
// Matches .chat-log's padding (--space-4), so a scrolled-to message isn't flush with the edge.
const LOG_PADDING = 16;

// The shell renders this outside <main> and keeps it mounted across client-side
// navigation, so the conversation survives page changes and only a reload clears
// it. The closed panel is rendered (hidden) on both sides, so hydration matches
// and the tab's aria-controls always points at a real element.
export function Chat() {
  const panelId = useId();
  const headingId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [conversation, dispatch] = useReducer(conversationReducer, INITIAL_CONVERSATION);
  const health = useHealth();

  const tabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const startOverRef = useRef<HTMLButtonElement>(null);

  const { messages, pending } = conversation;
  const full = isFull(messages);
  const ready = health === "ok" && !full;
  const canSend = ready && !pending && draft.trim() !== "";
  const status = chatStatus({ health, pending, sendError: conversation.sendError });

  // Focus goes to the textbox when it can take it. Until the health check passes
  // it waits on the panel itself, and the effect below moves it on.
  function focusComposer() {
    if (full) startOverRef.current?.focus();
    else if (inputRef.current && !inputRef.current.disabled) inputRef.current.focus();
    else panelRef.current?.focus();
  }

  function openPanel() {
    flushSync(() => setOpen(true));
    focusComposer();
  }

  function closePanel() {
    setOpen(false);
    tabRef.current?.focus();
  }

  async function send(text: string) {
    const question = text.trim();
    if (!ready || pending || question === "") return;
    const outgoing: Message[] = [...messages, { role: "user", content: question }];
    dispatch({ type: "sent", text: question });
    setDraft("");
    try {
      dispatch({ type: "replied", text: await askChat(outgoing) });
    } catch (error) {
      dispatch({ type: "failed", error });
      // Give the question back unless the visitor has started typing another.
      setDraft((current) => current || question);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(draft);
  }

  function onSuggestion(question: string) {
    void send(question);
    // The suggestions disappear with the first send, so focus must move off them.
    inputRef.current?.focus();
  }

  function onPanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    closePanel();
  }

  function startOver() {
    flushSync(() => dispatch({ type: "startedOver" }));
    inputRef.current?.focus();
  }

  useEffect(() => {
    if (health === "ok" && document.activeElement === panelRef.current) inputRef.current?.focus();
  }, [health]);

  // A disabled textbox drops focus, so at the limit hand it to "Start over".
  useEffect(() => {
    if (full && open && panelRef.current?.contains(document.activeElement) === false) {
      startOverRef.current?.focus();
    }
  }, [full, open]);

  // A new reply scrolls into view from its top, so a long one isn't skipped past.
  useEffect(() => {
    const log = logRef.current;
    const last = log?.lastElementChild;
    if (!open || !log || !(last instanceof HTMLElement)) return;
    // The log is the message's offsetParent (position: relative in Chat.css).
    const showTop = last.offsetTop - LOG_PADDING;
    const showWhole = last.offsetTop + last.offsetHeight + LOG_PADDING - log.clientHeight;
    log.scrollTop = Math.max(0, Math.min(showTop, showWhole));
  }, [messages, open]);

  return (
    <aside className="chat" aria-label="Chat">
      <button
        ref={tabRef}
        type="button"
        className="chat-tab"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={open ? closePanel : openPanel}
      >
        <svg
          className="chat-tab-icon"
          viewBox="0 0 20 20"
          width="20"
          height="20"
          aria-hidden="true"
        >
          <path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h11A1.5 1.5 0 0 1 17 4.5v8a1.5 1.5 0 0 1-1.5 1.5H8l-4 3v-3h.5A1.5 1.5 0 0 1 3 12.5z" />
        </svg>
        {NAME}
      </button>
      <div
        ref={panelRef}
        id={panelId}
        className="chat-panel"
        role="dialog"
        aria-labelledby={headingId}
        tabIndex={-1}
        hidden={!open}
        onKeyDown={onPanelKeyDown}
      >
        <div className="chat-header">
          <h2 id={headingId} className="chat-heading">
            {NAME}
          </h2>
          <p className="chat-subtitle">{SUBTITLE}</p>
          <button type="button" className="chat-close" aria-label="Close chat" onClick={closePanel}>
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>
        <div ref={logRef} className="chat-log" role="log" aria-label="Conversation">
          <ChatMessage role="assistant" content={GREETING} />
          {messages.map((message, index) => (
            // Messages are only appended, or all cleared, so the index is stable.
            <ChatMessage key={index} role={message.role} content={message.content} />
          ))}
        </div>
        {conversation.showSuggestions && (
          <ul className="chat-suggestions">
            {SUGGESTIONS.map((question) => (
              <li key={question}>
                <button
                  type="button"
                  className="chat-suggestion"
                  disabled={!ready || pending}
                  onClick={() => onSuggestion(question)}
                >
                  {question}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="chat-status" role="status">
          {full ? <p>This conversation is full.</p> : <StatusMessage status={status} />}
        </div>
        {full && (
          <button ref={startOverRef} type="button" className="chat-start-over" onClick={startOver}>
            Start over
          </button>
        )}
        <form className="chat-composer" onSubmit={onSubmit}>
          <input
            ref={inputRef}
            className="chat-input"
            type="text"
            aria-label="Your question"
            placeholder="Type a question"
            autoComplete="off"
            maxLength={MAX_QUESTION_LENGTH}
            value={draft}
            disabled={!ready}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" className="chat-send" disabled={!canSend}>
            Send
          </button>
        </form>
      </div>
    </aside>
  );
}

function StatusMessage({ status }: { status: ChatStatus }) {
  if (!status.offerEmail) return status.text;
  return (
    <>
      {status.text} <a href={`mailto:${content.profile.email}`}>Email me instead</a>
    </>
  );
}

function ChatMessage({ role, content }: Message) {
  // Plain text only: React escapes it, and nothing parses Markdown.
  return (
    <p className={`chat-message chat-message-${role}`}>
      <span className="visually-hidden">{role === "user" ? "You: " : "Assistant: "}</span>
      {content}
    </p>
  );
}

// /api/health runs once per page load. A failure renders as a state, never a throw.
function useHealth(): Health {
  const [health, setHealth] = useState<Health>("checking");
  useEffect(() => {
    const controller = new AbortController();
    checkHealth(controller.signal).then(
      () => setHealth("ok"),
      (error: unknown) => {
        if (!controller.signal.aborted) setHealth({ error });
      },
    );
    return () => controller.abort();
  }, []);
  return health;
}
