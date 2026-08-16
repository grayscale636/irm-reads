import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Icon } from "@/components/design/Icons";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface BookAIChatProps {
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  status: string;
  pagesRead: number;
  totalPages: number;
  onClose: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || "http://192.168.100.220:8211/api";

export default function BookAIChat({
  bookId,
  bookTitle,
  bookAuthor,
  status,
  pagesRead,
  totalPages,
  onClose,
}: BookAIChatProps) {
  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load existing chat session on mount
  useEffect(() => {
    const loadSession = async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) return;

      try {
        const res = await fetch(`${API_BASE}/ai/chats/${bookId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        }
      } catch {
        // silently fail — start fresh
      } finally {
        setSessionLoaded(true);
      }
    };
    loadSession();
  }, [bookId]);

  // Auto-scroll ke bawah pas ada message baru
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setLoading(true);

    const token = localStorage.getItem("auth_token");

    try {
      const res = await fetch(`${API_BASE}/ai/discuss`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bookId, message: text }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Gagal connect" }));
        setMessages((prev) => [
          ...prev,
          { role: "user", content: text },
          { role: "assistant", content: `❌ ${err.error || "Error. Coba lagi."}` },
        ]);
        setLoading(false);
        return;
      }

      const data = await res.json();
      // Server returns full messages array — use it as source of truth
      if (data.messages && Array.isArray(data.messages)) {
        setMessages(data.messages);
      } else {
        // Fallback: just append
        setMessages((prev) => [
          ...prev,
          { role: "user", content: text },
          { role: "assistant", content: data.reply },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: "❌ Gagal terhubung ke server. Coba lagi." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    const token = localStorage.getItem("auth_token");
    try {
      await fetch(`${API_BASE}/ai/chats/${bookId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // ok even if fails
    }
    setMessages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!open) return null;

  // Status label
  const statusLabel =
    status === "want-to-read"
      ? "Pengin dibaca"
      : status === "reading"
      ? `${pagesRead}/${totalPages} hal`
      : status === "completed"
      ? `${totalPages} hal · Selesai`
      : status === "paused"
      ? "Dihentikan"
      : "Tidak dilanjutkan";

  return (
    <div className="irm-ai">
      {/* Header */}
      <div className="irm-ai__head">
        <div className="irm-ai__head-left">
          <span className="irm-ai__avatar">💬</span>
          <div>
            <div className="irm-ai__name">Bacain</div>
            <div className="irm-ai__status">{statusLabel}</div>
          </div>
        </div>
        <div className="irm-ai__head-actions">
          {messages.length > 0 && (
            <button
              className="irm-ai__clear"
              onClick={clearChat}
              title="Hapus riwayat chat"
            >
              <Icon.Trash size={14} />
            </button>
          )}
          <button className="irm-ai__close" onClick={onClose} title="Close">
            <Icon.X size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="irm-ai__msgs" ref={listRef}>
        {!sessionLoaded ? (
          <div className="irm-ai__welcome">
            <div className="irm-ai__loading-session">
              <span className="irm-ai__dot" />
              <span className="irm-ai__dot" />
              <span className="irm-ai__dot" />
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="irm-ai__welcome">
            <div className="irm-ai__welcome-icon">📖</div>
            <p>
              Halo! Aku <strong>Bacain</strong>, asisten pengingat cerita kamu.
            </p>
            <p className="irm-ai__welcome-sub">
              Lupa sesuatu? Tanya aja — aku bantu rekap <strong>{bookTitle}</strong>{" "}
              {status === "want-to-read"
                ? "saat kamu mulai baca nanti."
                : `sampai halaman ${pagesRead}.`}
            </p>
            <div className="irm-ai__suggestions">
              <button
                className="irm-ai__suggestion"
                onClick={() => setInput("Ceritain dong tentang buku ini secara umum")}
              >
                Rekap cerita sejauh ini
              </button>
              <button
                className="irm-ai__suggestion"
                onClick={() => setInput("Siapa aja tokoh yang udah muncul?")}
              >
                Tokoh yang muncul
              </button>
              <button
                className="irm-ai__suggestion"
                onClick={() => setInput("Apa yang terakhir terjadi?")}
                disabled={status === "completed" || status === "want-to-read"}
              >
                Yang terakhir terjadi
              </button>
            </div>
          </div>
        ) : null}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`irm-ai__msg irm-ai__msg--${msg.role}`}
          >
            {msg.role === "assistant" && (
              <span className="irm-ai__msg-avatar">💬</span>
            )}
            <div className="irm-ai__bubble">
              {msg.role === "assistant" ? (
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="irm-ai__msg irm-ai__msg--assistant">
            <span className="irm-ai__msg-avatar">💬</span>
            <div className="irm-ai__bubble irm-ai__loading">
              <span className="irm-ai__dot" />
              <span className="irm-ai__dot" />
              <span className="irm-ai__dot" />
            </div>
          </div>
        )}

        {/* bottom spacer for scroll */}
        <div style={{ height: 8 }} />
      </div>

      {/* Input */}
      <div className="irm-ai__input-row">
        <textarea
          ref={inputRef}
          className="irm-ai__input"
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tanya tentang buku ini..."
          disabled={loading}
        />
        <button
          className="irm-ai__send"
          disabled={!input.trim() || loading}
          onClick={sendMessage}
        >
          <Icon.Send size={15} />
        </button>
      </div>
    </div>
  );
}
