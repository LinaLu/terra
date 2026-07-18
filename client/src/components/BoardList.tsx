import { Board } from '../services/api';

interface BoardListProps {
  boards: Board[];
}

export default function BoardList({ boards }: BoardListProps) {
  if (boards.length === 0) {
    return (
      <div style={{ padding: '20px', color: '#666' }}>
        No boards yet. Create your first board above!
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>Boards</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {boards.map((board) => (
          <li
            key={board.id}
            style={{
              padding: '10px',
              margin: '10px 0',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: '#f9f9f9',
            }}
          >
            <strong>{board.name}</strong>
            <span style={{ marginLeft: '10px', color: '#666', fontSize: '0.9em' }}>
              (ID: {board.id})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
