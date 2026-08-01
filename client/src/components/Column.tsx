import { useState } from 'react';
import { Column as ColumnType, Card, cardApi } from '../services/api';
import CardForm from './CardForm';

interface ColumnProps {
  column: ColumnType;
  cards: Card[];
  boardId: number;
  onCardCreated: (card: Card) => void;
  onCardUpdated?: (card: Card) => void;
  onCardDeleted?: (cardId: number, columnId: number) => void;
}

export default function Column({ column, cards, boardId, onCardCreated, onCardUpdated, onCardDeleted }: ColumnProps) {
  const [votingId, setVotingId] = useState<number | null>(null);
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const notifyUpdated = (updatedCard: Card) => {
    onCardUpdated?.(updatedCard);
  };

  const handleEditClick = (card: Card) => {
    setEditingCardId(card.id);
    setEditContent(card.content);
  };

  const handleCancelEdit = () => {
    setEditingCardId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (cardId: number) => {
    if (!editContent.trim()) return;
    try {
      setIsSubmitting(true);
      const updatedCard = await cardApi.updateCard(boardId, cardId, { content: editContent });
      notifyUpdated(updatedCard);
      setEditingCardId(null);
    } catch (err) {
      console.error('Failed to update card:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCard = async (cardId: number, columnId: number) => {
    if (!window.confirm('Are you sure you want to delete this card?')) return;
    try {
      setIsSubmitting(true);
      await cardApi.deleteCard(boardId, cardId);
      onCardDeleted?.(cardId, columnId);
    } catch (err) {
      console.error('Failed to delete card:', err);
    } finally {
      setIsSubmitting(false);
    }
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
            {editingCardId === card.id ? (
              <div style={{ marginBottom: '8px' }}>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  style={{ width: '100%', padding: '6px', fontSize: '0.9rem', border: '1px solid #ccc', borderRadius: '4px', resize: 'vertical', boxSizing: 'border-box', marginBottom: '4px' }}
                  rows={3}
                />
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => handleSaveEdit(card.id)}
                    disabled={isSubmitting || !editContent.trim()}
                    style={{ padding: '4px 8px', fontSize: '0.8rem', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: (isSubmitting || !editContent.trim()) ? 'not-allowed' : 'pointer' }}
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSubmitting}
                    style={{ padding: '4px 8px', fontSize: '0.8rem', backgroundColor: '#f8f9fa', color: '#333', border: '1px solid #ccc', borderRadius: '4px', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ margin: '0 0 6px 0', fontSize: '0.9rem', lineHeight: '1.4' }}>{card.content}</p>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.75rem', color: '#888' }}>
                  {card.author} · {new Date(card.created_at).toLocaleDateString()}
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button 
                    onClick={() => handleEditClick(card)}
                    disabled={isSubmitting}
                    style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.75rem', color: '#007bff', cursor: isSubmitting ? 'not-allowed' : 'pointer', textDecoration: 'underline' }}
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDeleteCard(card.id, card.column_id)}
                    disabled={isSubmitting}
                    style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.75rem', color: '#dc3545', cursor: isSubmitting ? 'not-allowed' : 'pointer', textDecoration: 'underline' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
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
