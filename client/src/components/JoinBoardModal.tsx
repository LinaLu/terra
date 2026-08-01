import { useState, FormEvent } from 'react';
import { boardApi, setBoardToken, User } from '../services/api';

interface JoinBoardModalProps {
  boardId: number;
  boardName: string;
  onJoined: (user: User) => void;
}

export default function JoinBoardModal({ boardId, boardName, onJoined }: JoinBoardModalProps) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSubmitting(true);
      setError(null);
      const res = await boardApi.joinBoard(boardId, name.trim());
      setBoardToken(boardId, res.session_token);
      onJoined(res.user);
    } catch (err: any) {
      console.error('Failed to join board:', err);
      if (err.response?.status === 400 && err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Failed to join board. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '8px',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '8px' }}>Join {boardName}</h2>
        <p style={{ color: '#666', marginBottom: '20px', fontSize: '0.9rem' }}>
          Please enter your name to participate in this retrospective board.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            disabled={submitting}
            autoFocus
            style={{
              padding: '10px',
              fontSize: '16px',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />

          {error && (
            <div style={{
              color: '#721c24',
              backgroundColor: '#f8d7da',
              border: '1px solid #f5c6cb',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !name.trim()}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: submitting || !name.trim() ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: submitting || !name.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? 'Joining...' : 'Join Board'}
          </button>
        </form>
      </div>
    </div>
  );
}
