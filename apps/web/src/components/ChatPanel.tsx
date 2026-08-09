import { Send } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { useRealtimeStore } from '../store/realtime';

export function ChatPanel({ compact = false }: { compact?: boolean }) {
  const chat = useRealtimeStore((state) => state.chat);
  const sendChat = useRealtimeStore((state) => state.sendChat);
  const [message, setMessage] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.length]);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!message.trim()) return;
    await sendChat(message.trim());
    setMessage('');
  }

  return (
    <section className={compact ? 'chat-panel chat-panel--compact' : 'chat-panel'}>
      <span className="section-label">Chat</span>
      <div className="chat-messages" aria-live="polite">
        {chat.length === 0 ? <p className="chat-empty">No messages yet.</p> : null}
        {chat.map((entry) => (
          <p key={entry.id}>
            <strong>{entry.nickname}:</strong> {entry.text}
          </p>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={(event) => void submit(event)}>
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={280}
          placeholder="Message players…"
          aria-label="Message players"
        />
        <button type="submit" aria-label="Send message" disabled={!message.trim()}>
          <Send />
        </button>
      </form>
    </section>
  );
}
