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
      <div className="p-5 text-gray-600">
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
    <div className="p-5">
      <h2 className="text-2xl font-bold mb-4">Boards</h2>
      <ul className="list-none p-0">
        {boards.map((board) => {
          const active = isLinkActive(board);
          const shareUrl = active ? `${window.location.origin}/b/${board.short_code}` : null;

          return (
            <li
              key={board.id}
              className="p-2.5 my-2.5 border border-gray-300 rounded bg-gray-50 flex justify-between items-center"
            >
              <Link to={`/boards/${board.id}`} className="font-bold text-blue-600 no-underline hover:underline">
                {board.name}
              </Link>
              <div>
                {active && shareUrl ? (
                  <span className="inline-flex items-center gap-2">
                    <code className="bg-gray-200 px-1.5 py-0.5 rounded text-sm">
                      {shareUrl}
                    </code>
                    <button
                      onClick={() => handleCopy(board.id, shareUrl)}
                      className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white border-none rounded cursor-pointer"
                    >
                      {copiedBoardId === board.id ? 'Copied!' : 'Copy'}
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => onGenerateLink?.(board.id)}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white border-none rounded cursor-pointer"
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
