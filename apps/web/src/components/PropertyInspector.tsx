import { calculateRent, ownerHasCompleteGroup, type GameState } from '@circuit/game-engine';
import {
  Building2,
  CheckCircle2,
  Factory,
  Gavel,
  Hammer,
  Home,
  Landmark,
  LockKeyhole,
  UnlockKeyhole
} from 'lucide-react';

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
  const tileConfig = getAtlasMap(state.mapId).config.tiles.find((item) => item.id === tile.id);
  const effectivePrice = property
    ? Math.round(property.purchasePrice * state.rules.propertyPriceMultiplier)
    : null;
  const ownership = state.properties[tile.id];
  const owner = ownership?.ownerId ? state.players[ownership.ownerId] : null;
  const isMine = ownership?.ownerId === viewerId;
  const countryProperties = property ? statePropertyConfigs(state.mapId, property.group) : [];
  const countryOwned = countryProperties.filter(
    (item) => state.properties[item.id]?.ownerId === viewerId
  ).length;
  const countryComplete = Boolean(
    property &&
    isMine &&
    ownerHasCompleteGroup(state, getAtlasMap(state.mapId).config, viewerId, property.group)
  );
  const currentRent = ownership?.ownerId
    ? calculateRent(state, getAtlasMap(state.mapId).config, ownership)
    : (property?.baseRent ?? 0);
  const canDevelopNow =
    countryComplete &&
    !ownership?.mortgaged &&
    (state.phase === 'TURN_START' || state.phase === 'TURN_END') &&
    (state.players[viewerId]?.cash ?? 0) >= (property?.upgradeCost ?? 0);
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
              <dt>Rent now</dt>
              <dd>${currentRent.toLocaleString()}</dd>
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
          <div className={countryComplete ? 'country-portfolio is-complete' : 'country-portfolio'}>
            <span>{countryComplete ? <CheckCircle2 /> : <Landmark />}</span>
            <div>
              <small>País · {tile.region ?? property.group.replace('country-', '')}</small>
              <strong>
                {isMine
                  ? `${countryOwned}/${countryProperties.length} ciudades`
                  : `${countryProperties.length} ciudades`}
              </strong>
              <p>
                {countryComplete
                  ? 'País completo: renta doble y construcción desbloqueada.'
                  : 'Controla todas sus ciudades para construir.'}
              </p>
            </div>
          </div>
          {ownership?.upgradeLevel ? (
            <div className="development-status">
              {ownership.upgradeLevel < 3 ? <Home /> : <Factory />}
              <span>
                <small>Desarrollo actual</small>
                <strong>{developmentName(ownership.upgradeLevel)}</strong>
              </span>
            </div>
          ) : null}
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
                    disabled={
                      pending ||
                      ownership.upgradeLevel >= state.rules.maxUpgradeLevel ||
                      !canDevelopNow
                    }
                    type="button"
                    onClick={() => onAction('BUILD_UPGRADE', { propertyId: tile.id })}
                  >
                    <Hammer />
                    {ownership.upgradeLevel >= state.rules.maxUpgradeLevel
                      ? 'Máximo desarrollo'
                      : `${nextDevelopmentName(ownership.upgradeLevel)} · $${property.upgradeCost.toLocaleString()}`}
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
          {tileConfig?.flightOptions?.length
            ? 'Cuando una ficha alcanza este aeropuerto, el jugador puede pagar un vuelo y cambiar de ruta o conservar sus pasos y continuar por tierra.'
            : 'Esta casilla de viaje se resuelve automáticamente en el servidor autoritativo.'}
        </p>
      )}
    </aside>
  );
}

function statePropertyConfigs(mapId: string, group: string) {
  return [...getAtlasMap(mapId).properties.values()].filter((property) => property.group === group);
}

function developmentName(level: number): string {
  return (
    ['Ciudad', 'Casas', 'Zona comercial', 'Empresas', 'Distrito corporativo'][level] ??
    'Distrito corporativo'
  );
}

function nextDevelopmentName(level: number): string {
  return (
    ['Construir casas', 'Abrir comercios', 'Fundar empresas', 'Crear distrito corporativo'][
      level
    ] ?? 'Máximo desarrollo'
  );
}
