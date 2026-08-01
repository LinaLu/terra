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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      setSubmitting(true);
      const newCard = await cardApi.createCard(boardId, {
        column_id: columnId,
        content: content.trim(),
      });
      onCardCreated(newCard);
      setError(null);
      setContent('');
      setOpen(false);
    } catch (err) {
      console.error('Failed to create card:', err);
      setError('Failed to add card. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setOpen(false);
    setContent('');
    setError(null);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full p-2 mt-2 bg-transparent border border-dashed border-gray-400 rounded cursor-pointer text-gray-600 text-sm hover:bg-gray-50"
      >
        + Add a card
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-1.5">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's on your mind?"
        rows={3}
        className="w-full p-1.5 text-sm border border-gray-300 rounded resize-y box-border"
      />
      {error && (
        <div className="text-red-800 bg-red-100 border border-red-200 p-1.5 rounded text-sm">
          {error}
        </div>
      )}
      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className={`flex-1 p-1.5 text-white border-none rounded text-sm ${
            submitting || !content.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
          }`}
        >
          {submitting ? 'Adding...' : 'Add card'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="flex-1 p-1.5 bg-transparent border border-gray-300 rounded cursor-pointer text-sm hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
