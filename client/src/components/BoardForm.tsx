import { useState, FormEvent } from 'react';

interface BoardFormProps {
  onSubmit: (name: string) => void;
  loading: boolean;
}

export default function BoardForm({ onSubmit, loading }: BoardFormProps) {
  const [boardName, setBoardName] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (boardName.trim()) {
      onSubmit(boardName);
      setBoardName('');
    }
  };

  return (
    <div style={{ padding: '20px', borderBottom: '1px solid #ddd' }}>
      <h2>Create New Board</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input
          type="text"
          value={boardName}
          onChange={(e) => setBoardName(e.target.value)}
          placeholder="Enter board name"
          disabled={loading}
          style={{
            flex: 1,
            padding: '10px',
            fontSize: '16px',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        />
        <button
          type="submit"
          disabled={loading || !boardName.trim()}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Creating...' : 'Create Board'}
        </button>
      </form>
    </div>
  );
}
