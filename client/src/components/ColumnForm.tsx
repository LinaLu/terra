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
      <div style={{ flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column' }}>
        <button
          onClick={() => setOpen(true)}
          style={{ width: '100%', padding: '12px', backgroundColor: 'transparent', border: '1px dashed #aaa', borderRadius: '4px', cursor: 'pointer', color: '#666', fontSize: '1rem' }}
        >
          + Add a column
        </button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', border: '1px solid #ddd', borderRadius: '4px', padding: '12px', backgroundColor: '#f9f9f9', height: 'fit-content' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Column name"
          style={{ width: '100%', padding: '6px', fontSize: '0.875rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
        />
        {error && (
          <div style={{ color: '#721c24', backgroundColor: '#f8d7da', border: '1px solid #f5c6cb', padding: '6px', borderRadius: '4px', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            style={{ flex: 1, padding: '6px', backgroundColor: submitting ? '#ccc' : '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '0.875rem' }}
          >
            {submitting ? 'Adding...' : 'Add column'}
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
    </div>
  );
}
