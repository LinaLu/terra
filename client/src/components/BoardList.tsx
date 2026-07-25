import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Board } from '../services/api';

interface BoardListProps {
  boards: Board[];
  onGenerateLink?: (boardId: number) => void;
}

function isLinkActive(board: Board): boolean {
  if (!board.short_code || !board.link_expires_at) return false;
  return new Date(board.link_expires_at) > new Date();
}

export default function BoardList({ boards, onGenerateLink }: BoardListProps) {
  const [copiedBoardId, setCopiedBoardId] = useState<number | null>(null);

  if (boards.length === 0) {
    return (
      <div style={{ padding: '20px', color: '#666' }}>
        No boards yet. Create your first board above!
      </div>
    );
  }

  const handleCopy = (boardId: number, shareUrl: string) => {
    navigator.clipboard.writeText(shareUrl).catch((err) => console.error('Failed to copy share URL:', err));
    setCopiedBoardId(boardId);
    setTimeout(() => setCopiedBoardId(null), 2000);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Boards</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {boards.map((board) => {
          const active = isLinkActive(board);
          const shareUrl = active ? `${window.location.origin}/b/${board.short_code}` : null;

          return (
            <li
              key={board.id}
              style={{
                padding: '10px',
                margin: '10px 0',
                border: '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: '#f9f9f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Link to={`/boards/${board.id}`} style={{ fontWeight: 'bold', color: '#007bff', textDecoration: 'none' }}>
                {board.name}
              </Link>
              <div>
                {active && shareUrl ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <code style={{ backgroundColor: '#eee', padding: '2px 6px', borderRadius: '4px', fontSize: '14px' }}>
                      {shareUrl}
                    </code>
                    <button
                      onClick={() => handleCopy(board.id, shareUrl)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      {copiedBoardId === board.id ? 'Copied!' : 'Copy'}
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => onGenerateLink?.(board.id)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Generate link
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
