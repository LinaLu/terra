import { useState, FormEvent } from 'react';
import { columnApi, Column } from '../services/api';

interface ColumnFormProps {
  boardId: number;
  onColumnCreated: (column: Column) => void;
}

export default function ColumnForm({ boardId, onColumnCreated }: ColumnFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setSubmitting(true);
      const newColumn = await columnApi.createColumn(boardId, {
        name: name.trim(),
      });
      onColumnCreated(newColumn);
      setError(null);
      setName('');
      setOpen(false);
    } catch (err) {
      console.error('Failed to create column:', err);
      setError('Failed to add column. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setOpen(false);
    setName('');
    setError(null);
  };

  if (!open) {
    return (
      <div className="flex-1 min-w-[240px] flex flex-col">
        <button
          onClick={() => setOpen(true)}
          className="w-full p-3 bg-transparent border border-dashed border-gray-400 rounded cursor-pointer text-gray-600 text-base hover:bg-gray-50"
        >
          + Add a column
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-[240px] flex flex-col border border-gray-300 rounded p-3 bg-gray-50 h-fit">
      <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Column name"
          className="w-full p-1.5 text-sm border border-gray-300 rounded box-border"
        />
        {error && (
          <div className="text-red-800 bg-red-100 border border-red-200 p-1.5 rounded text-sm">
            {error}
          </div>
        )}
        <div className="flex gap-1.5">
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className={`flex-1 p-1.5 text-white border-none rounded text-sm ${
              submitting || !name.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
            }`}
          >
            {submitting ? 'Adding...' : 'Add column'}
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
    </div>
  );
}
