import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User } from "lucide-react";
import type { ChatMessage } from "../../types";
import { streamChat } from "../../api/client";

interface Props {
  tenantId: string;
  sessionId: string;
}

export function ChatWidget({ tenantId, sessionId }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [remaining, setRemaining] = useState(15);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    let assistantContent = "";
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    abortRef.current = streamChat(
      tenantId,
      sessionId,
      text,
      newMessages,
      (chunk) => {
        assistantContent += chunk;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: assistantContent,
          };
          return updated;
        });
      },
      () => {
        setStreaming(false);
        setRemaining((r) => Math.max(0, r - 1));
      },
      () => {
        setStreaming(false);
      }
    );
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-soft-md transition hover:bg-brand-600 active:scale-95"
          style={{
            bottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
            right: "max(1rem, env(safe-area-inset-right, 0px))",
            boxShadow: "0 12px 30px -4px rgba(54, 49, 45, 0.15)",
          }}
          aria-label="Открыть чат"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-[max(12px,env(safe-area-inset-bottom,0px))] left-3 right-3 z-50 flex h-[min(85dvh,32rem)] max-h-[min(85dvh,32rem)] flex-col overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-soft-md sm:bottom-5 sm:left-auto sm:right-5 sm:h-[500px] sm:w-[360px] sm:max-h-[80vh]"
        >
          <div className="flex items-center justify-between bg-brand-500 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Bot size={20} />
              <div>
                <p className="text-sm font-semibold">AI-Консультант</p>
                <p className="text-xs opacity-90">
                  {remaining > 0 ? `${remaining} сообщ. осталось` : "Лимит исчерпан"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1 opacity-90 transition-opacity hover:opacity-100"
              aria-label="Закрыть"
            >
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-base p-4">
            {messages.length === 0 && (
              <div className="flex h-full items-center justify-center">
                <p className="text-center text-sm text-ink-light">
                  Привет! Задайте вопрос об услугах, ценах или помогу выбрать процедуру
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100">
                    <Bot size={14} className="text-brand-600" />
                  </div>
                )}
                <div
                  className={`max-w-[min(75%,20rem)] min-w-0 overflow-hidden rounded-3xl px-3.5 py-2.5 text-sm leading-relaxed break-words shadow-soft ${
                    msg.role === "user" ? "" : "border border-brand-100 bg-white"
                  }`}
                  style={
                    msg.role === "user"
                      ? {
                          background: "var(--color-primary)",
                          color: "var(--color-primary-foreground)",
                          overflowWrap: "anywhere",
                        }
                      : {
                          color: "var(--color-text)",
                          overflowWrap: "anywhere",
                        }
                  }
                >
                  {msg.content || <span className="inline-block animate-pulse">●●●</span>}
                </div>
                {msg.role === "user" && (
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-100 bg-white">
                    <User size={14} className="text-ink-light" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-brand-100 bg-white p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={remaining > 0 ? "Спросите что-нибудь..." : "Лимит сообщений исчерпан"}
                disabled={remaining <= 0 || streaming}
                className="flex-1 rounded-3xl border border-brand-100 bg-white px-4 py-2.5 text-sm text-ink outline-none shadow-soft transition-colors disabled:opacity-40"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || streaming || remaining <= 0}
                className="btn-primary-soft flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-white shadow-soft disabled:opacity-35"
                aria-label="Отправить"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
