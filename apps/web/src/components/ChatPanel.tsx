import { MessageCircle, Send } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { useRealtimeStore } from '../store/realtime';

export function ChatPanel({ compact = false }: { compact?: boolean }) {
  const chat = useRealtimeStore((state) => state.chat);
  const identity = useRealtimeStore((state) => state.identity);
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
      <header className="chat-panel__header">
        <span>
          <MessageCircle />
        </span>
        <div>
          <strong>Chat de la sala</strong>
          <small>Mensajes en tiempo real</small>
        </div>
      </header>
      <div className="chat-messages" aria-live="polite">
        {chat.length === 0 ? <p className="chat-empty">Todavía no hay mensajes.</p> : null}
        {chat.map((entry) => (
          <article
            className={
              entry.playerId === identity?.playerId ? 'chat-bubble is-self' : 'chat-bubble'
            }
            key={entry.id}
          >
            <span>{entry.nickname.slice(0, 1).toUpperCase()}</span>
            <p>
              <strong>{entry.nickname}</strong>
              {entry.text}
            </p>
          </article>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={(event) => void submit(event)}>
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={280}
          placeholder="Escribe a la sala…"
          aria-label="Mensaje para la sala"
        />
        <button type="submit" aria-label="Enviar mensaje" disabled={!message.trim()}>
          <Send />
        </button>
      </form>
    </section>
  );
}
