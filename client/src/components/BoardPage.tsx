import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { boardApi, columnApi, cardApi, Board, Column, Card, User, getBoardToken } from '../services/api';
import ColumnComponent from './Column';
import ColumnForm from './ColumnForm';
import JoinBoardModal from './JoinBoardModal';
import { useBoardWebSocket } from '../hooks/useBoardWebSocket';

export default function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const boardId = Number(id);

  const [board, setBoard] = useState<Board | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [needsJoin, setNeedsJoin] = useState(false);
  const [columns, setColumns] = useState<Column[]>([]);
  const [cardsByColumn, setCardsByColumn] = useState<Record<number, Card[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const boardData = await boardApi.getBoardById(boardId);
        setBoard(boardData);

        const token = getBoardToken(boardId);
        if (token) {
          try {
            const user = await boardApi.getMe(boardId);
            setCurrentUser(user);
            setNeedsJoin(false);
          } catch {
            setNeedsJoin(true);
          }
        } else {
          setNeedsJoin(true);
        }

        const [columnsData, cardsData] = await Promise.all([
          columnApi.getColumns(boardId),
          cardApi.getCards(boardId),
        ]);
        setColumns(columnsData);
        const grouped: Record<number, Card[]> = {};
        columnsData.forEach((col) => { grouped[col.id] = []; });
        cardsData.forEach((card) => {
          if (grouped[card.column_id]) {
            grouped[card.column_id].push(card);
          }
        });
        setCardsByColumn(grouped);
      } catch {
        setError('Failed to load board.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [boardId]);

  const handleColumnCreated = useCallback((column: Column) => {
    setColumns((prev) => {
      if (prev.some((c) => c.id === column.id)) return prev;
      return [...prev, column].sort((a, b) => a.position - b.position);
    });
  }, []);

  const handleColumnUpdated = useCallback((updatedColumn: Column) => {
    setColumns((prev) =>
      prev.map((c) => (c.id === updatedColumn.id ? updatedColumn : c))
    );
  }, []);

  const handleColumnDeleted = useCallback((columnId: number) => {
    setColumns((prev) => prev.filter((c) => c.id !== columnId));
    setCardsByColumn((prev) => {
      const next = { ...prev };
      delete next[columnId];
      return next;
    });
  }, []);

  const handleCardCreated = useCallback((card: Card) => {
    setCardsByColumn((prev) => {
      const existing = prev[card.column_id] ?? [];
      if (existing.some((c) => c.id === card.id)) {
        return prev;
      }
      return {
        ...prev,
        [card.column_id]: [...existing, card],
      };
    });
  }, []);

  const handleCardUpdated = useCallback((updatedCard: Card) => {
    setCardsByColumn((prev) => {
      const existing = prev[updatedCard.column_id] ?? [];
      const index = existing.findIndex((c) => c.id === updatedCard.id);
      if (index === -1) {
        return {
          ...prev,
          [updatedCard.column_id]: [...existing, updatedCard],
        };
      }
      return {
        ...prev,
        [updatedCard.column_id]: existing.map((card) =>
          card.id === updatedCard.id ? updatedCard : card
        ),
      };
    });
  }, []);

  const handleCardDeleted = useCallback((cardId: number, columnId: number) => {
    setCardsByColumn((prev) => {
      const existing = prev[columnId] ?? [];
      if (!existing.some((c) => c.id === cardId)) {
        return prev;
      }
      return {
        ...prev,
        [columnId]: existing.filter((card) => card.id !== cardId),
      };
    });
  }, []);

  useBoardWebSocket(
    boardId,
    handleCardCreated,
    handleCardUpdated,
    handleColumnCreated,
    handleCardDeleted,
    handleColumnUpdated,
    handleColumnDeleted
  );

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <div style={{ padding: '10px', backgroundColor: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb', borderRadius: '4px', marginBottom: '12px' }}>
          {error}
        </div>
        <Link to="/" style={{ color: '#007bff', textDecoration: 'none' }}>← Back to boards</Link>
      </div>
    );
  }

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div style={{ padding: '20px' }}>
      {needsJoin && board && (
        <JoinBoardModal
          boardId={boardId}
          boardName={board.name}
          onJoined={(user) => {
            setCurrentUser(user);
            setNeedsJoin(false);
          }}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <Link to="/" style={{ color: '#007bff', textDecoration: 'none', fontSize: '0.9rem' }}>← Back to boards</Link>
        {currentUser && (
          <span style={{ fontSize: '0.9rem', color: '#555' }}>
            Logged in as <strong>{currentUser.name}</strong> ({currentUser.role})
          </span>
        )}
      </div>
      <h2 style={{ margin: '8px 0 20px 0' }}>{board?.name}</h2>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', overflowX: 'auto', paddingBottom: '16px' }}>
        {columns.map((col) => (
          <ColumnComponent
            key={col.id}
            column={col}
            cards={cardsByColumn[col.id] ?? []}
            boardId={boardId}
            isAdmin={isAdmin}
            onCardCreated={handleCardCreated}
            onCardUpdated={handleCardUpdated}
            onCardDeleted={handleCardDeleted}
            onColumnUpdated={handleColumnUpdated}
            onColumnDeleted={handleColumnDeleted}
          />
        ))}
        {isAdmin && <ColumnForm boardId={boardId} onColumnCreated={handleColumnCreated} />}
      </div>
    </div>
  );
}
