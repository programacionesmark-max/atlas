import type { GameState } from '@circuit/game-engine';
import type { ChatMessage } from '@circuit/shared';
import { useEffect, useRef } from 'react';

import { soundManager, type SoundEffect } from './sound-manager';

const TRANSACTION_SOUNDS: Partial<Record<GameState['transactions'][number]['type'], SoundEffect>> =
  {
    PROPERTY_PURCHASE: 'buy',
    AUCTION_PURCHASE: 'buy',
    RENT: 'rent',
    TAX: 'money',
    BONUS: 'money',
    EVENT: 'card',
    PASS_START: 'money',
    TRADE: 'trade',
    MORTGAGE: 'money',
    UNMORTGAGE: 'money',
    UPGRADE_PURCHASE: 'buy',
    UPGRADE_SALE: 'money',
    BANKRUPTCY: 'bankruptcy'
  };

export function useGameAudio(state: GameState | null, viewerId: string | null): void {
  const previousRevision = useRef(state?.revision ?? 0);
  const previousTransactionId = useRef(state?.transactions.at(-1)?.id ?? null);
  const previousActivityId = useRef(state?.activity.at(-1)?.id ?? null);
  const previousPhase = useRef(state?.phase ?? null);

  useEffect(() => {
    if (!state || state.revision <= previousRevision.current) return;
    previousRevision.current = state.revision;
    const transaction = state.transactions.at(-1);
    const activity = state.activity.at(-1);
    const transactionIsNew = Boolean(
      transaction && transaction.id !== previousTransactionId.current
    );
    const activityIsNew = Boolean(activity && activity.id !== previousActivityId.current);
    const phaseChanged = state.phase !== previousPhase.current;
    previousTransactionId.current = transaction?.id ?? null;
    previousActivityId.current = activity?.id ?? null;
    previousPhase.current = state.phase;

    if (state.phase === 'GAME_OVER' && phaseChanged) {
      soundManager.play('victory');
      return;
    }
    const transactionSound =
      transactionIsNew && transaction ? TRANSACTION_SOUNDS[transaction.type] : undefined;
    if (transactionSound) {
      soundManager.play(transactionSound);
      return;
    }
    if (!activity || !activityIsNew) return;
    if (activity.type === 'DICE_ROLL' && activity.playerId !== viewerId) soundManager.play('dice');
    else if (activity.type === 'LANDING') soundManager.play('move');
    else if (activity.type.startsWith('TRADE_')) soundManager.play('trade');
    else if (activity.type.startsWith('AUCTION_')) soundManager.play('notification');
    else if (activity.type.includes('EVENT')) soundManager.play('card');
    else if (activity.type === 'BANKRUPTCY') soundManager.play('bankruptcy');
  }, [state, viewerId]);
}

export function useChatAudio(chat: readonly ChatMessage[], viewerId: string | null): void {
  const previousMessageId = useRef(chat.at(-1)?.id ?? null);

  useEffect(() => {
    const message = chat.at(-1);
    if (!message || message.id === previousMessageId.current) return;
    previousMessageId.current = message.id;
    if (message.playerId !== viewerId) soundManager.play('notification');
  }, [chat, viewerId]);
}
