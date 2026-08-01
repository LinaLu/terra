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
    <div className="p-5 border-b border-gray-300">
      <h2 className="text-2xl font-bold mb-4">Create New Board</h2>
      <form onSubmit={handleSubmit} className="flex gap-2.5 items-center">
        <input
          type="text"
          value={boardName}
          onChange={(e) => setBoardName(e.target.value)}
          placeholder="Enter board name"
          disabled={loading}
          className="flex-1 p-2.5 text-base border border-gray-300 rounded"
        />
        <button
          type="submit"
          disabled={loading || !boardName.trim()}
          className={`px-5 py-2.5 text-base text-white border-none rounded cursor-pointer ${
            loading || !boardName.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? 'Creating...' : 'Create Board'}
        </button>
      </form>
    </div>
  );
}
