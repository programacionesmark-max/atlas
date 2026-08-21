import type { GameState, PropertyConfig } from '@circuit/game-engine';
import { Building2, CheckCircle2, Hotel, Landmark, WalletCards, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

import { getAtlasMap, type VisualTile } from '../data/atlas';

interface EmpireModalProps {
  state: GameState;
  viewerId: string;
  onClose: () => void;
  onSelectProperty: (tile: VisualTile) => void;
}

interface CountryPortfolio {
  id: string;
  name: string;
  properties: readonly PropertyConfig[];
  owned: readonly PropertyConfig[];
  development: number;
}

export function EmpireModal({ state, viewerId, onClose, onSelectProperty }: EmpireModalProps) {
  const map = getAtlasMap(state.mapId);
  const countries = useMemo(() => buildPortfolio(state, viewerId), [state, viewerId]);
  const visibleCountries = countries.filter((country) => country.owned.length > 0);
  const totalValue = visibleCountries.reduce(
    (total, country) =>
      total +
      country.owned.reduce((subtotal, property) => {
        const level = state.properties[property.id]?.upgradeLevel ?? 0;
        return subtotal + property.purchasePrice + level * property.upgradeCost;
      }, 0),
    0
  );
  const completeCountries = visibleCountries.filter(
    (country) => country.owned.length === country.properties.length
  ).length;

  return (
    <motion.div
      className="modal-backdrop empire-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="empire-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.section
        className="empire-modal"
        initial={{ opacity: 0, y: 22, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
      >
        <header>
          <div>
            <span className="modal-kicker">Pasaporte Atlas</span>
            <h2 id="empire-title">Mi imperio</h2>
            <p>Completa un país para desbloquear casas y aumentar sus rentas.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar mi imperio">
            <X />
          </button>
        </header>

        <div className="empire-summary">
          <div>
            <Landmark />
            <span>
              <strong>{visibleCountries.reduce((sum, item) => sum + item.owned.length, 0)}</strong>{' '}
              ciudades
            </span>
          </div>
          <div>
            <CheckCircle2 />
            <span>
              <strong>{completeCountries}</strong> países
            </span>
          </div>
          <div>
            <WalletCards />
            <span>
              <strong>${totalValue.toLocaleString()}</strong> patrimonio
            </span>
          </div>
        </div>

        <div className="empire-countries">
          {visibleCountries.length ? (
            visibleCountries.map((country) => {
              const complete = country.owned.length === country.properties.length;
              return (
                <article
                  className={complete ? 'country-card is-complete' : 'country-card'}
                  key={country.id}
                >
                  <div className="country-card__heading">
                    <span>{complete ? <CheckCircle2 /> : <Landmark />}</span>
                    <div>
                      <strong>{country.name}</strong>
                      <small>
                        {country.owned.length}/{country.properties.length} ciudades
                      </small>
                    </div>
                    {country.development ? (
                      <em>
                        <Hotel /> {country.development}
                      </em>
                    ) : null}
                  </div>
                  <span className="country-card__progress" aria-hidden="true">
                    <i
                      style={{
                        width: `${(country.owned.length / country.properties.length) * 100}%`
                      }}
                    />
                  </span>
                  <div className="country-card__cities">
                    {country.properties.map((property) => {
                      const owned = state.properties[property.id]?.ownerId === viewerId;
                      const tile = map.tiles.find((item) => item.id === property.id);
                      return (
                        <button
                          type="button"
                          disabled={!owned || !tile}
                          className={owned ? 'is-owned' : ''}
                          key={property.id}
                          onClick={() => {
                            if (!tile) return;
                            onSelectProperty(tile);
                            onClose();
                          }}
                        >
                          <Building2 />
                          <span>
                            {property.name}
                            <small>
                              {owned
                                ? `$${property.purchasePrice.toLocaleString()}`
                                : 'Sin conquistar'}
                            </small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p>
                    {complete
                      ? 'País completo · ya puedes construir.'
                      : `Te faltan ${country.properties.length - country.owned.length} para construir.`}
                  </p>
                </article>
              );
            })
          ) : (
            <div className="empire-empty">
              <Landmark />
              <h3>Tu pasaporte está vacío</h3>
              <p>Compra tu primera ciudad para empezar un país.</p>
            </div>
          )}
        </div>
      </motion.section>
    </motion.div>
  );
}

function buildPortfolio(state: GameState, viewerId: string): CountryPortfolio[] {
  const groups = new Map<string, PropertyConfig[]>();
  for (const property of getAtlasMap(state.mapId).config.properties) {
    const current = groups.get(property.group) ?? [];
    current.push(property);
    groups.set(property.group, current);
  }
  return [...groups.entries()]
    .map(([id, properties]) => {
      const owned = properties.filter(
        (property) => state.properties[property.id]?.ownerId === viewerId
      );
      return {
        id,
        name: properties[0]?.region ?? id.replace('country-', ''),
        properties,
        owned,
        development: owned.reduce(
          (sum, property) => sum + (state.properties[property.id]?.upgradeLevel ?? 0),
          0
        )
      };
    })
    .sort((a, b) => b.owned.length - a.owned.length || a.name.localeCompare(b.name));
}
