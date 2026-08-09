import type { GameState } from '@circuit/game-engine';
import { Building2, Gavel, Hammer, Landmark, LockKeyhole, UnlockKeyhole } from 'lucide-react';

import { getAtlasMap, type VisualTile } from '../data/atlas';

interface PropertyInspectorProps {
  state: GameState;
  tile: VisualTile;
  viewerId: string;
  pending: boolean;
  onAction: (type: string, payload?: Record<string, string | number>) => void;
  onTrade: () => void;
}

export function PropertyInspector({
  state,
  tile,
  viewerId,
  pending,
  onAction,
  onTrade
}: PropertyInspectorProps) {
  const property = getAtlasMap(state.mapId).properties.get(tile.id);
  const effectivePrice = property
    ? Math.round(property.purchasePrice * state.rules.propertyPriceMultiplier)
    : null;
  const ownership = state.properties[tile.id];
  const owner = ownership?.ownerId ? state.players[ownership.ownerId] : null;
  const isMine = ownership?.ownerId === viewerId;
  const isPending =
    state.pendingPropertyDecision?.propertyId === tile.id &&
    state.pendingPropertyDecision.playerId === viewerId;

  return (
    <aside className="property-inspector">
      <span className="section-label">
        {property ? 'City deed' : tile.kind.replaceAll('_', ' ')}
      </span>
      <div className="property-art">
        <Building2 />
      </div>
      <h2>{tile.name}</h2>
      {tile.region ? <p className="property-region">{tile.region}</p> : null}
      {property ? (
        <>
          <dl className="property-values">
            <div>
              <dt>Price</dt>
              <dd>${effectivePrice?.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Base rent</dt>
              <dd>${property.baseRent.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Mortgage</dt>
              <dd>${property.mortgageValue.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Upgrades</dt>
              <dd>{ownership?.upgradeLevel ?? 0}</dd>
            </div>
          </dl>
          <p className="ownership-line">
            {owner ? (
              <>
                Owned by <strong>{owner.name}</strong>
                {ownership?.mortgaged ? ' · Mortgaged' : ''}
              </>
            ) : (
              'Available from the bank'
            )}
          </p>
          {isPending ? (
            <div className="inspector-actions">
              <button
                className="button button--primary"
                disabled={pending}
                type="button"
                onClick={() => onAction('BUY_PROPERTY')}
              >
                <Landmark /> Buy
              </button>
              <button
                className="button button--outline"
                disabled={pending}
                type="button"
                onClick={() => onAction('DECLINE_PROPERTY')}
              >
                <Gavel /> Auction
              </button>
            </div>
          ) : null}
          {isMine ? (
            <div className="asset-actions">
              <button
                className="button button--outline"
                disabled={pending}
                type="button"
                onClick={() =>
                  onAction(ownership?.mortgaged ? 'UNMORTGAGE_PROPERTY' : 'MORTGAGE_PROPERTY', {
                    propertyId: tile.id
                  })
                }
              >
                {ownership?.mortgaged ? <UnlockKeyhole /> : <LockKeyhole />}
                {ownership?.mortgaged ? 'Unmortgage' : 'Mortgage'}
              </button>
              {!ownership?.mortgaged ? (
                <>
                  <button
                    className="button button--outline"
                    disabled={pending || ownership.upgradeLevel >= state.rules.maxUpgradeLevel}
                    type="button"
                    onClick={() => onAction('BUILD_UPGRADE', { propertyId: tile.id })}
                  >
                    <Hammer /> Upgrade
                  </button>
                  {ownership.upgradeLevel > 0 ? (
                    <button
                      className="text-button"
                      disabled={pending}
                      type="button"
                      onClick={() => onAction('SELL_UPGRADE', { propertyId: tile.id })}
                    >
                      Sell one upgrade
                    </button>
                  ) : null}
                </>
              ) : null}
              <button className="text-button" type="button" onClick={onTrade}>
                Offer in trade
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="tile-description">
          This travel space resolves automatically on the authoritative server when a token lands
          here.
        </p>
      )}
    </aside>
  );
}
