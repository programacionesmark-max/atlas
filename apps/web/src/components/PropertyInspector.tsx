import { calculateRent, ownerHasCompleteGroup, type GameState } from '@circuit/game-engine';
import {
  CheckCircle2,
  Gavel,
  Hammer,
  Hotel,
  Home,
  Landmark,
  LockKeyhole,
  UnlockKeyhole
} from 'lucide-react';
import { useEffect, useState } from 'react';

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
  const [view, setView] = useState<'CITY' | 'COUNTRY'>('CITY');
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
  const nextRent =
    property && ownership?.ownerId && ownership.upgradeLevel < state.rules.maxUpgradeLevel
      ? calculateRent(state, getAtlasMap(state.mapId).config, {
          ...ownership,
          upgradeLevel: ownership.upgradeLevel + 1
        })
      : null;
  const canDevelopNow =
    countryComplete &&
    !ownership?.mortgaged &&
    (state.phase === 'TURN_START' || state.phase === 'TURN_END') &&
    (state.players[viewerId]?.cash ?? 0) >= (property?.upgradeCost ?? 0);
  const isPending =
    state.pendingPropertyDecision?.propertyId === tile.id &&
    state.pendingPropertyDecision.playerId === viewerId;

  useEffect(() => setView('CITY'), [tile.id]);

  return (
    <aside className={property ? 'property-inspector is-property' : 'property-inspector'}>
      <span className="section-label">{property ? 'Ciudad' : tile.kind.replaceAll('_', ' ')}</span>
      <h2>{tile.name}</h2>
      {tile.region ? <p className="property-region">{tile.region}</p> : null}
      {property ? (
        <>
          <div className="property-tabs" role="tablist" aria-label="Detalles de la propiedad">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'CITY'}
              className={view === 'CITY' ? 'is-active' : ''}
              onClick={() => setView('CITY')}
            >
              Ciudad
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'COUNTRY'}
              className={view === 'COUNTRY' ? 'is-active' : ''}
              onClick={() => setView('COUNTRY')}
            >
              País{' '}
              <span>
                {countryOwned}/{countryProperties.length}
              </span>
            </button>
          </div>

          {view === 'CITY' ? (
            <div className="property-tab-panel" role="tabpanel">
              <dl className="property-values">
                <div>
                  <dt>Precio</dt>
                  <dd>${effectivePrice?.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Renta actual</dt>
                  <dd>${currentRent.toLocaleString()}</dd>
                </div>
              </dl>
              <p className="ownership-line">
                {owner ? (
                  <>
                    Propiedad de <strong>{owner.name}</strong>
                    {ownership?.mortgaged ? ' · Hipotecada' : ''}
                  </>
                ) : (
                  'Disponible en el banco'
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
                    <Landmark /> Comprar por ${effectivePrice?.toLocaleString()}
                  </button>
                  <button
                    className="button button--outline"
                    disabled={pending}
                    type="button"
                    onClick={() => onAction('DECLINE_PROPERTY')}
                  >
                    <Gavel /> Subastar
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
                    {ownership?.mortgaged ? 'Cancelar hipoteca' : 'Hipotecar'}
                  </button>
                  <button className="text-button" type="button" onClick={onTrade}>
                    Ofrecer en intercambio
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="property-tab-panel" role="tabpanel">
              <div
                className={countryComplete ? 'country-portfolio is-complete' : 'country-portfolio'}
              >
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
                      ? 'País completo. Ya puedes construir.'
                      : 'Consigue todas para construir casas.'}
                  </p>
                  <span className="country-progress-bar" aria-hidden="true">
                    <i
                      style={{
                        width: `${countryProperties.length ? (countryOwned / countryProperties.length) * 100 : 0}%`
                      }}
                    />
                  </span>
                </div>
              </div>
              {ownership?.upgradeLevel ? (
                <div className="development-status">
                  {developmentIcon(ownership.upgradeLevel)}
                  <span>
                    <small>Desarrollo actual</small>
                    <strong>{developmentName(ownership.upgradeLevel)}</strong>
                    <p>Renta actual · ${currentRent.toLocaleString()}</p>
                  </span>
                </div>
              ) : null}
              {isMine && countryComplete ? (
                <div className="classic-build-track" aria-label="Progreso de construcción">
                  {[1, 2, 3, 4].map((level) => (
                    <span className={ownership.upgradeLevel >= level ? 'is-built' : ''} key={level}>
                      <Home />
                      {level}
                    </span>
                  ))}
                  <span className={ownership.upgradeLevel >= 5 ? 'is-built' : ''}>
                    <Hotel /> Hotel
                  </span>
                </div>
              ) : null}
              {isMine && !ownership?.mortgaged ? (
                <div className="asset-actions">
                  <button
                    className="button button--outline build-upgrade-button"
                    disabled={
                      pending ||
                      ownership.upgradeLevel >= state.rules.maxUpgradeLevel ||
                      !canDevelopNow
                    }
                    type="button"
                    onClick={() => onAction('BUILD_UPGRADE', { propertyId: tile.id })}
                  >
                    <Hammer />
                    <span>
                      <strong>
                        {ownership.upgradeLevel >= state.rules.maxUpgradeLevel
                          ? 'Máximo desarrollo'
                          : nextDevelopmentName(ownership.upgradeLevel)}
                      </strong>
                      {ownership.upgradeLevel < state.rules.maxUpgradeLevel ? (
                        <small>
                          ${property.upgradeCost.toLocaleString()}
                          {nextRent !== null ? ` · renta $${nextRent.toLocaleString()}` : ''}
                        </small>
                      ) : null}
                    </span>
                  </button>
                  {ownership.upgradeLevel > 0 ? (
                    <button
                      className="text-button"
                      disabled={pending}
                      type="button"
                      onClick={() => onAction('SELL_UPGRADE', { propertyId: tile.id })}
                    >
                      Vender una mejora
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
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
  if (level >= 5) return 'Hotel';
  return `${level} ${level === 1 ? 'casa' : 'casas'}`;
}

function nextDevelopmentName(level: number): string {
  if (level >= 4) return level === 4 ? 'Construir hotel' : 'Máximo desarrollo';
  return `Construir casa ${level + 1}`;
}

function developmentIcon(level: number) {
  return level >= 5 ? <Hotel /> : <Home />;
}
