import { useState, FormEvent } from 'react';
import { cardApi, Card } from '../services/api';

interface CardFormProps {
  boardId: number;
  columnId: number;
  onCardCreated: (card: Card) => void;
}

export default function CardForm({ boardId, columnId, onCardCreated }: CardFormProps) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !author.trim()) return;
    try {
      setSubmitting(true);
      const newCard = await cardApi.createCard(boardId, {
        column_id: columnId,
        content: content.trim(),
        author: author.trim(),
      });
      onCardCreated(newCard);
      setContent('');
      setAuthor('');
      setOpen(false);
    } catch (err) {
      console.error('Failed to create card:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setOpen(false);
    setContent('');
    setAuthor('');
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ width: '100%', padding: '8px', marginTop: '8px', backgroundColor: 'transparent', border: '1px dashed #aaa', borderRadius: '4px', cursor: 'pointer', color: '#666', fontSize: '0.875rem' }}
      >
        + Add a card
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's on your mind?"
        rows={3}
        style={{ width: '100%', padding: '6px', fontSize: '0.875rem', border: '1px solid #ccc', borderRadius: '4px', resize: 'vertical', boxSizing: 'border-box' }}
      />
      <input
        type="text"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="Your name"
        style={{ width: '100%', padding: '6px', fontSize: '0.875rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
      />
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          type="submit"
          disabled={submitting || !content.trim() || !author.trim()}
          style={{ flex: 1, padding: '6px', backgroundColor: submitting ? '#ccc' : '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '0.875rem' }}
        >
          {submitting ? 'Adding...' : 'Add card'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          style={{ flex: 1, padding: '6px', backgroundColor: 'transparent', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem' }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
