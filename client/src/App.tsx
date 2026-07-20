import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import BoardForm from './components/BoardForm';
import BoardList from './components/BoardList';
import { boardApi, Board } from './services/api';

function Home() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadBoards(); }, []);

  const loadBoards = async () => {
    try {
      setError(null);
      const data = await boardApi.getBoards();
      setBoards(data);
    } catch (err) {
      console.error('Error loading boards:', err);
      setError('Failed to load boards. Make sure the server is running.');
    }
  };

  const handleCreateBoard = async (name: string) => {
    try {
      setLoading(true);
      setError(null);
      const newBoard = await boardApi.createBoard({ name });
      setBoards([...boards, newBoard]);
    } catch (err) {
      console.error('Error creating board:', err);
      setError('Failed to create board. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {error && (
        <div style={{ padding: '10px', margin: '20px', backgroundColor: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb', borderRadius: '4px' }}>
          {error}
        </div>
      )}
      <BoardForm onSubmit={handleCreateBoard} loading={loading} />
      <BoardList boards={boards} />
    </>
  );
}

function App() {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <header style={{ padding: '20px', backgroundColor: '#007bff', color: 'white' }}>
        <h1 style={{ margin: 0 }}>Terra - Team Retrospective Board</h1>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/boards/:id" element={<div style={{ padding: '20px' }}>Board page coming soon</div>} />
      </Routes>
    </div>
  );
}

export default App;
