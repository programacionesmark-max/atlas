import type { GameState, PropertyConfig } from '@circuit/game-engine';
import { ArrowLeftRight, Check, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { getAtlasMap } from '../data/atlas';

interface TradeModalProps {
  state: GameState;
  viewerId: string;
  pending: boolean;
  onClose: () => void;
  onAction: (type: string, payload: Record<string, unknown>) => void;
}

export function TradeModal({ state, viewerId, pending, onClose, onAction }: TradeModalProps) {
  const propertyConfigs = getAtlasMap(state.mapId).properties;
  const [recipientId, setRecipientId] = useState(
    () => state.turnOrder.find((id) => id !== viewerId) ?? ''
  );
  const [offeredCash, setOfferedCash] = useState(0);
  const [requestedCash, setRequestedCash] = useState(0);
  const [offeredProperties, setOfferedProperties] = useState<string[]>([]);
  const [requestedProperties, setRequestedProperties] = useState<string[]>([]);
  const [countering, setCountering] = useState(false);
  const openTrade = Object.values(state.trades).find(
    (trade) =>
      trade.status === 'OPEN' && (trade.recipientId === viewerId || trade.proposerId === viewerId)
  );
  const observedOpenTrade = useRef(Boolean(openTrade));

  useEffect(() => {
    if (openTrade) {
      observedOpenTrade.current = true;
      return;
    }
    if (observedOpenTrade.current) onClose();
  }, [onClose, openTrade]);

  const mine = useMemo(
    () => Object.values(state.properties).filter((property) => property.ownerId === viewerId),
    [state.properties, viewerId]
  );
  const theirs = useMemo(
    () => Object.values(state.properties).filter((property) => property.ownerId === recipientId),
    [recipientId, state.properties]
  );

  function toggle(list: string[], setList: (items: string[]) => void, id: string): void {
    setList(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  function submit(event: FormEvent): void {
    event.preventDefault();
    const offered = { cash: offeredCash, propertyIds: offeredProperties, resources: [] };
    const requested = { cash: requestedCash, propertyIds: requestedProperties, resources: [] };
    if (countering && openTrade) {
      onAction('COUNTER_TRADE', { tradeId: openTrade.id, offered, requested });
      setCountering(false);
      return;
    }
    onAction('OFFER_TRADE', { recipientId, offered, requested });
  }

  if (openTrade && !countering) {
    const isRecipient = openTrade.recipientId === viewerId;
    const other = state.players[isRecipient ? openTrade.proposerId : openTrade.recipientId];
    return (
      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="trade-title">
        <section className="trade-modal trade-modal--incoming">
          <div className="modal-title">
            <h2 id="trade-title">
              <ArrowLeftRight /> Trade with {other?.name}
            </h2>
            <button type="button" onClick={onClose}>
              <X />
            </button>
          </div>
          <div className="trade-comparison">
            <TradeBundle
              title={isRecipient ? 'They offer' : 'You offer'}
              cash={openTrade.offered.cash}
              propertyIds={openTrade.offered.propertyIds}
              propertyConfigs={propertyConfigs}
            />
            <ArrowLeftRight className="trade-exchange" />
            <TradeBundle
              title={isRecipient ? 'They request' : 'You request'}
              cash={openTrade.requested.cash}
              propertyIds={openTrade.requested.propertyIds}
              propertyConfigs={propertyConfigs}
            />
          </div>
          <div className="trade-actions">
            {isRecipient ? (
              <>
                <button
                  className="button button--danger"
                  disabled={pending}
                  type="button"
                  onClick={() => onAction('DECLINE_TRADE', { tradeId: openTrade.id })}
                >
                  <X /> Decline
                </button>
                <button
                  className="button button--outline"
                  disabled={pending}
                  type="button"
                  onClick={() => {
                    setRecipientId(openTrade.proposerId);
                    setOfferedCash(openTrade.requested.cash);
                    setRequestedCash(openTrade.offered.cash);
                    setOfferedProperties([...openTrade.requested.propertyIds]);
                    setRequestedProperties([...openTrade.offered.propertyIds]);
                    setCountering(true);
                  }}
                >
                  Counter
                </button>
                <button
                  className="button button--ready"
                  disabled={pending}
                  type="button"
                  onClick={() => onAction('ACCEPT_TRADE', { tradeId: openTrade.id })}
                >
                  <Check /> Accept
                </button>
              </>
            ) : (
              <button
                className="button button--danger"
                disabled={pending}
                type="button"
                onClick={() => onAction('CANCEL_TRADE', { tradeId: openTrade.id })}
              >
                Cancel offer
              </button>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="trade-title">
      <form className="trade-modal" onSubmit={submit}>
        <div className="modal-title">
          <h2 id="trade-title">
            <ArrowLeftRight /> {countering ? 'Counter offer' : 'Create trade'}
          </h2>
          <button type="button" onClick={onClose}>
            <X />
          </button>
        </div>
        <label className="trade-recipient">
          Trade with
          <select
            value={recipientId}
            disabled={countering}
            onChange={(event) => {
              setRecipientId(event.target.value);
              setRequestedProperties([]);
            }}
          >
            {state.turnOrder
              .filter((id) => id !== viewerId && state.players[id]?.status === 'ACTIVE')
              .map((id) => (
                <option key={id} value={id}>
                  {state.players[id]?.name}
                </option>
              ))}
          </select>
        </label>
        <div className="trade-comparison">
          <TradePicker
            title="You offer"
            cash={offeredCash}
            onCash={setOfferedCash}
            properties={mine.map((item) => item.propertyId)}
            selected={offeredProperties}
            onToggle={(id) => toggle(offeredProperties, setOfferedProperties, id)}
            propertyConfigs={propertyConfigs}
          />
          <ArrowLeftRight className="trade-exchange" />
          <TradePicker
            title="You request"
            cash={requestedCash}
            onCash={setRequestedCash}
            properties={theirs.map((item) => item.propertyId)}
            selected={requestedProperties}
            onToggle={(id) => toggle(requestedProperties, setRequestedProperties, id)}
            propertyConfigs={propertyConfigs}
          />
        </div>
        <div className="trade-actions">
          <button className="button button--ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button button--primary"
            disabled={pending || !recipientId}
            type="submit"
          >
            {countering ? 'Send counter' : 'Send offer'}
          </button>
        </div>
      </form>
    </div>
  );
}

function TradePicker({
  title,
  cash,
  onCash,
  properties,
  selected,
  onToggle,
  propertyConfigs
}: {
  title: string;
  cash: number;
  onCash: (value: number) => void;
  properties: string[];
  selected: string[];
  onToggle: (id: string) => void;
  propertyConfigs: ReadonlyMap<string, PropertyConfig>;
}) {
  return (
    <section className="trade-side">
      <h3>{title}</h3>
      <label>
        Cash
        <input
          type="number"
          min={0}
          step={50}
          value={cash}
          onChange={(event) => onCash(Number(event.target.value))}
        />
      </label>
      <span className="section-label">Properties</span>
      <div className="trade-property-list">
        {properties.length ? (
          properties.map((id) => (
            <label key={id}>
              <input
                type="checkbox"
                checked={selected.includes(id)}
                onChange={() => onToggle(id)}
              />
              <span>
                {propertyConfigs.get(id)?.name ?? id}
                <small>${propertyConfigs.get(id)?.purchasePrice.toLocaleString()}</small>
              </span>
            </label>
          ))
        ) : (
          <p>No properties available.</p>
        )}
      </div>
    </section>
  );
}

function TradeBundle({
  title,
  cash,
  propertyIds,
  propertyConfigs
}: {
  title: string;
  cash: number;
  propertyIds: readonly string[];
  propertyConfigs: ReadonlyMap<string, PropertyConfig>;
}) {
  return (
    <section className="trade-side">
      <h3>{title}</h3>
      <strong className="trade-cash">${cash.toLocaleString()}</strong>
      {propertyIds.map((id) => (
        <div className="trade-bundle-row" key={id}>
          {propertyConfigs.get(id)?.name ?? id}
        </div>
      ))}
    </section>
  );
}
