import type { GameState, PropertyConfig } from '@circuit/game-engine';
import { ArrowLeftRight, Building2, Check, WalletCards, X } from 'lucide-react';
import { motion } from 'framer-motion';
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
      <motion.div
        className="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-title"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.section
          className="trade-modal trade-modal--incoming"
          initial={{ opacity: 0, y: 26, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
        >
          <div className="modal-title">
            <div>
              <span className="modal-kicker">Mesa de negociación</span>
              <h2 id="trade-title">
                <ArrowLeftRight /> Trato con {other?.name}
              </h2>
              <p>Compara ambos lados antes de tomar una decisión.</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar negociación">
              <X />
            </button>
          </div>
          <div className="trade-comparison">
            <TradeBundle
              title={isRecipient ? 'Te ofrecen' : 'Tú entregas'}
              cash={openTrade.offered.cash}
              propertyIds={openTrade.offered.propertyIds}
              propertyConfigs={propertyConfigs}
            />
            <ArrowLeftRight className="trade-exchange" />
            <TradeBundle
              title={isRecipient ? 'Te piden' : 'Tú recibes'}
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
                  <X /> Rechazar
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
                  Contraoferta
                </button>
                <button
                  className="button button--ready"
                  disabled={pending}
                  type="button"
                  onClick={() => onAction('ACCEPT_TRADE', { tradeId: openTrade.id })}
                >
                  <Check /> Aceptar trato
                </button>
              </>
            ) : (
              <button
                className="button button--danger"
                disabled={pending}
                type="button"
                onClick={() => onAction('CANCEL_TRADE', { tradeId: openTrade.id })}
              >
                Cancelar oferta
              </button>
            )}
          </div>
        </motion.section>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trade-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.form
        className="trade-modal"
        onSubmit={submit}
        initial={{ opacity: 0, y: 26, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
      >
        <div className="modal-title">
          <div>
            <span className="modal-kicker">Mercado entre jugadores</span>
            <h2 id="trade-title">
              <ArrowLeftRight /> {countering ? 'Preparar contraoferta' : 'Crear un trato'}
            </h2>
            <p>Combina dinero y ciudades. El servidor valida cada activo al aceptar.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar negociación">
            <X />
          </button>
        </div>
        <label className="trade-recipient">
          Negociar con
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
            title="Tú entregas"
            cash={offeredCash}
            maxCash={state.players[viewerId]?.cash ?? 0}
            onCash={setOfferedCash}
            properties={mine.map((item) => item.propertyId)}
            selected={offeredProperties}
            onToggle={(id) => toggle(offeredProperties, setOfferedProperties, id)}
            propertyConfigs={propertyConfigs}
          />
          <ArrowLeftRight className="trade-exchange" />
          <TradePicker
            title="Tú recibes"
            cash={requestedCash}
            maxCash={state.players[recipientId]?.cash ?? 0}
            onCash={setRequestedCash}
            properties={theirs.map((item) => item.propertyId)}
            selected={requestedProperties}
            onToggle={(id) => toggle(requestedProperties, setRequestedProperties, id)}
            propertyConfigs={propertyConfigs}
          />
        </div>
        <div className="trade-actions">
          <button className="button button--ghost" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button button--primary"
            disabled={pending || !recipientId}
            type="submit"
          >
            {countering ? 'Enviar contraoferta' : 'Enviar oferta'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

function TradePicker({
  title,
  cash,
  maxCash,
  onCash,
  properties,
  selected,
  onToggle,
  propertyConfigs
}: {
  title: string;
  cash: number;
  maxCash: number;
  onCash: (value: number) => void;
  properties: string[];
  selected: string[];
  onToggle: (id: string) => void;
  propertyConfigs: ReadonlyMap<string, PropertyConfig>;
}) {
  return (
    <section className="trade-side">
      <div className="trade-side__title">
        <h3>{title}</h3>
        <strong>${tradeValue(cash, selected, propertyConfigs).toLocaleString()}</strong>
      </div>
      <label>
        <span>
          <WalletCards /> Dinero
        </span>
        <input
          type="number"
          min={0}
          max={maxCash}
          step={50}
          value={cash}
          onChange={(event) => onCash(Number(event.target.value))}
        />
      </label>
      <span className="section-label">
        <Building2 /> Ciudades
      </span>
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
          <p className="trade-empty">No hay ciudades disponibles.</p>
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
      <div className="trade-side__title">
        <h3>{title}</h3>
        <strong>${tradeValue(cash, propertyIds, propertyConfigs).toLocaleString()}</strong>
      </div>
      <strong className="trade-cash">
        <WalletCards /> ${cash.toLocaleString()}
      </strong>
      {propertyIds.map((id) => (
        <div className="trade-bundle-row" key={id}>
          {propertyConfigs.get(id)?.name ?? id}
        </div>
      ))}
    </section>
  );
}

function tradeValue(
  cash: number,
  propertyIds: readonly string[],
  propertyConfigs: ReadonlyMap<string, PropertyConfig>
): number {
  return propertyIds.reduce(
    (total, propertyId) => total + (propertyConfigs.get(propertyId)?.purchasePrice ?? 0),
    cash
  );
}
