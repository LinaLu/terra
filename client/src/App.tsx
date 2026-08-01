import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import BoardForm from './components/BoardForm';
import BoardList from './components/BoardList';
import BoardPage from './components/BoardPage';
import BoardView from './components/BoardView';
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

  const handleGenerateLink = async (boardId: number) => {
    try {
      const linkData = await boardApi.generateLink(boardId);
      setBoards(boards.map((b) =>
        b.id === boardId
          ? { ...b, short_code: linkData.short_code, link_expires_at: linkData.link_expires_at }
          : b
      ));
    } catch (err) {
      console.error('Error generating link:', err);
      setError('Failed to generate link. Please try again.');
    }
  };

  return (
    <>
      {error && (
        <div className="p-2.5 m-5 bg-red-100 text-red-800 border border-red-200 rounded">
          {error}
        </div>
      )}
      <BoardForm onSubmit={handleCreateBoard} loading={loading} />
      <BoardList boards={boards} onGenerateLink={handleGenerateLink} />
    </>
  );
}

function App() {
  return (
    <div className="max-w-[1200px] mx-auto font-sans">
      <header className="p-5 bg-blue-600 text-white">
        <h1 className="m-0 text-3xl font-bold">Terra - Team Retrospective Board</h1>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/boards/:id" element={<BoardPage />} />
        <Route path="/b/:code" element={<BoardView />} />
      </Routes>
    </div>
  );
}

export default App;
