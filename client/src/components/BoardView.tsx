import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { boardApi, Board } from '../services/api';

export default function BoardView() {
  const { code } = useParams<{ code: string }>();
  const [board, setBoard] = useState<Board | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!code) return;
    boardApi
      .getBoardByCode(code)
      .then(setBoard)
      .catch(() => setExpired(true));
  }, [code]);

  if (expired) {
    return (
      <div style={{ maxWidth: '800px', margin: '60px auto', padding: '40px', fontFamily: 'Arial, sans-serif', textAlign: 'center' }}>
        <h2>This link has expired or is invalid</h2>
        <p style={{ color: '#666' }}>Ask your team to generate a new link for this board.</p>
      </div>
    );
  }

  if (!board) {
    return <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px', fontFamily: 'Arial, sans-serif' }}>Loading...</div>;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <header style={{ padding: '20px', backgroundColor: '#007bff', color: 'white' }}>
        <h1 style={{ margin: 0 }}>{board.name}</h1>
      </header>
      <div style={{ padding: '20px', color: '#444' }}>
        <p>You are viewing this board via a shared link.</p>
      </div>
    </div>
  );
}
