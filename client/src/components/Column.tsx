import { useState } from 'react';
import { Column as ColumnType, Card, cardApi } from '../services/api';
import CardForm from './CardForm';

interface ColumnProps {
  column: ColumnType;
  cards: Card[];
  boardId: number;
  onCardCreated: (card: Card) => void;
  onCardUpdated?: (card: Card) => void;
}

export default function Column({ column, cards, boardId, onCardCreated, onCardUpdated }: ColumnProps) {
  const [votingId, setVotingId] = useState<number | null>(null);

  const notifyUpdated = (updatedCard: Card) => {
    onCardUpdated?.(updatedCard);
  };

  const handleUpvote = async (cardId: number) => {
    try {
      setVotingId(cardId);
      const updatedCard = await cardApi.upvoteCard(boardId, cardId);
      notifyUpdated(updatedCard);
    } catch (err) {
      console.error('Failed to upvote card:', err);
    } finally {
      setVotingId(null);
    }
  };

  const handleDownvote = async (cardId: number) => {
    try {
      setVotingId(cardId);
      const updatedCard = await cardApi.downvoteCard(boardId, cardId);
      notifyUpdated(updatedCard);
    } catch (err) {
      console.error('Failed to downvote card:', err);
    } finally {
      setVotingId(null);
    }
  };

  return (
    <div style={{ flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', border: '1px solid #ddd', borderRadius: '4px', padding: '12px', backgroundColor: '#f9f9f9' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 'bold', borderBottom: '2px solid #007bff', paddingBottom: '6px' }}>
        {column.name}
      </h3>
      <div style={{ flex: 1 }}>
        {cards.map((card) => (
          <div key={card.id} style={{ padding: '8px', marginBottom: '8px', backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
            <p style={{ margin: '0 0 6px 0', fontSize: '0.9rem', lineHeight: '1.4' }}>{card.content}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: '#888' }}>
                {card.author} · {new Date(card.created_at).toLocaleDateString()}
              </span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#f0f4f8', border: '1px solid #d0d7de', borderRadius: '12px', padding: '2px 8px' }}>
                <button
                  onClick={() => handleUpvote(card.id)}
                  disabled={votingId === card.id}
                  title="Upvote"
                  aria-label="Upvote"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: votingId === card.id ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                    padding: '0',
                    lineHeight: '1',
                  }}
                >
                  👍
                </button>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#007bff' }}>
                  {card.votes ?? 0}
                </span>
                <button
                  onClick={() => handleDownvote(card.id)}
                  disabled={votingId === card.id || (card.votes ?? 0) <= 0}
                  title="Downvote"
                  aria-label="Downvote"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: votingId === card.id || (card.votes ?? 0) <= 0 ? 'not-allowed' : 'pointer',
                    opacity: (card.votes ?? 0) <= 0 ? 0.5 : 1,
                    fontSize: '0.8rem',
                    padding: '0',
                    lineHeight: '1',
                  }}
                >
                  👎
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <CardForm boardId={boardId} columnId={column.id} onCardCreated={onCardCreated} />
    </div>
  );
}
