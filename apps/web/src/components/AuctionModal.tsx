import type { GameState } from '@circuit/game-engine';
import { Clock3, Gavel, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { getAtlasMap } from '../data/atlas';

export function AuctionModal({
  state,
  viewerId,
  pending,
  onAction
}: {
  state: GameState;
  viewerId: string;
  pending: boolean;
  onAction: (type: string, payload?: Record<string, number>) => void;
}) {
  const auction = state.auction;
  const [bid, setBid] = useState(() => (auction?.currentBid ?? 0) + state.rules.minimumBid);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!auction) return;
    setBid((value) => Math.max(value, auction.currentBid + state.rules.minimumBid));
  }, [auction, state.rules.minimumBid]);

  if (!auction) return null;
  const property = getAtlasMap(state.mapId).properties.get(auction.propertyId);
  const highest = auction.highestBidderId ? state.players[auction.highestBidderId] : null;
  const passed = auction.passedPlayerIds.includes(viewerId);
  const remaining = Math.max(0, Math.ceil((auction.endsAt - now) / 1000));

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="auction-title">
      <section className="auction-modal">
        <div className="modal-title">
          <h2 id="auction-title">
            <Gavel /> Live auction
          </h2>
          <span>
            <Clock3 /> 00:{String(remaining).padStart(2, '0')}
          </span>
        </div>
        <div className="auction-overview">
          <div className="auction-building">
            <LandmarkArt />
            <h3>{property?.name ?? auction.propertyId}</h3>
          </div>
          <div>
            <span className="section-label">Current bid</span>
            <strong className="auction-amount">${auction.currentBid.toLocaleString()}</strong>
            <p>
              Highest bidder: <b>{highest?.name ?? 'No bids yet'}</b>
            </p>
          </div>
          <div className="auction-participants">
            {state.turnOrder.map((id) => (
              <span
                className={
                  auction.passedPlayerIds.includes(id)
                    ? 'has-passed'
                    : id === auction.highestBidderId
                      ? 'is-highest'
                      : ''
                }
                key={id}
              >
                {state.players[id]?.name}
                {auction.passedPlayerIds.includes(id) ? ' · passed' : ''}
              </span>
            ))}
          </div>
        </div>
        <div className="bid-controls">
          <button type="button" onClick={() => setBid(auction.currentBid + 50)}>
            +$50
          </button>
          <button type="button" onClick={() => setBid(auction.currentBid + 100)}>
            +$100
          </button>
          <input
            type="number"
            min={auction.currentBid + state.rules.minimumBid}
            value={bid}
            onChange={(event) => setBid(Number(event.target.value))}
            aria-label="Bid amount"
          />
          <button
            className="button button--primary"
            disabled={pending || passed}
            type="button"
            onClick={() => onAction('BID_AUCTION', { amount: bid })}
          >
            <Gavel /> Place bid
          </button>
          <button
            className="button button--danger"
            disabled={pending || passed || auction.highestBidderId === viewerId}
            type="button"
            onClick={() => onAction('PASS_AUCTION')}
          >
            {passed ? (
              <>
                <X /> Passed
              </>
            ) : (
              'Pass'
            )}
          </button>
        </div>
        <p className="server-note">Bidding closes automatically on the authoritative server.</p>
      </section>
    </div>
  );
}

function LandmarkArt() {
  return (
    <div className="landmark-art">
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}
