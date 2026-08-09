import type { GameState } from '@circuit/game-engine';
import { Banknote, MapPin, PlaneTakeoff, Route } from 'lucide-react';

import { getAtlasMap } from '../data/atlas';

interface FlightDecisionProps {
  state: GameState;
  viewerId: string;
  pending: boolean;
  onAction: (type: string, payload?: Record<string, string>) => void;
}

export function FlightDecision({ state, viewerId, pending, onAction }: FlightDecisionProps) {
  const decision = state.pendingFlightDecision;
  if (!decision) return null;
  const map = getAtlasMap(state.mapId);
  const airport = map.tiles.find((tile) => tile.id === decision.airportTileId);
  const player = state.players[decision.playerId];
  const isMine = decision.playerId === viewerId;

  return (
    <div className="flight-choice-backdrop" role="presentation">
      <section
        className="flight-choice"
        role="dialog"
        aria-modal="true"
        aria-labelledby="flight-title"
      >
        <div className="flight-choice__heading">
          <span>
            <PlaneTakeoff />
          </span>
          <div>
            <small>Bifurcación de ruta</small>
            <h2 id="flight-title">{airport?.name ?? 'Aeropuerto internacional'}</h2>
            <p>
              {isMine
                ? `Elige un vuelo o continúa por tierra con ${decision.remainingSteps} pasos restantes.`
                : `${player?.name ?? 'El jugador'} está eligiendo su próxima ruta.`}
            </p>
          </div>
        </div>

        <div className="flight-choice__routes">
          {decision.options.map((option) => {
            const destination = map.tiles.find((tile) => tile.id === option.destinationTileId);
            const affordable = (player?.cash ?? 0) >= option.fee;
            return (
              <button
                type="button"
                key={option.destinationTileId}
                disabled={!isMine || pending || !affordable}
                onClick={() =>
                  onAction('TAKE_FLIGHT', { destinationTileId: option.destinationTileId })
                }
              >
                <PlaneTakeoff />
                <span>
                  <strong>{destination?.name ?? option.destinationTileId}</strong>
                  <small>
                    <MapPin /> {option.label}
                  </small>
                </span>
                <em>
                  <Banknote /> ${option.fee.toLocaleString()}
                </em>
                {!affordable ? <i>Fondos insuficientes</i> : null}
              </button>
            );
          })}
        </div>

        <button
          className="flight-choice__ground"
          type="button"
          disabled={!isMine || pending}
          onClick={() => onAction('DECLINE_FLIGHT')}
        >
          <Route /> Seguir por tierra · {decision.remainingSteps} pasos
        </button>
      </section>
    </div>
  );
}
