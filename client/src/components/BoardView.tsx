import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { boardApi, columnApi, cardApi, Board, Column, Card, User, getBoardToken } from '../services/api';
import ColumnComponent from './Column';
import ColumnForm from './ColumnForm';
import JoinBoardModal from './JoinBoardModal';
import { useBoardWebSocket } from '../hooks/useBoardWebSocket';

export default function BoardView() {
  const { code } = useParams<{ code: string }>();
  const [board, setBoard] = useState<Board | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [needsJoin, setNeedsJoin] = useState(false);
  const [columns, setColumns] = useState<Column[]>([]);
  const [cardsByColumn, setCardsByColumn] = useState<Record<number, Card[]>>({});
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!code) return;
    const load = async () => {
      try {
        const boardData = await boardApi.getBoardByCode(code);
        setBoard(boardData);

        const token = getBoardToken(boardData.id);
        if (token) {
          try {
            const user = await boardApi.getMe(boardData.id);
            setCurrentUser(user);
            setNeedsJoin(false);
          } catch {
            setNeedsJoin(true);
          }
        } else {
          setNeedsJoin(true);
        }

        const [columnsData, cardsData] = await Promise.all([
          columnApi.getColumns(boardData.id),
          cardApi.getCards(boardData.id),
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
        setExpired(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [code]);

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
    board?.id,
    handleCardCreated,
    handleCardUpdated,
    handleColumnCreated,
    handleCardDeleted,
    handleColumnUpdated,
    handleColumnDeleted
  );

  if (expired) {
    return (
      <div style={{ maxWidth: '800px', margin: '60px auto', padding: '40px', fontFamily: 'Arial, sans-serif', textAlign: 'center' }}>
        <h2>This link has expired or is invalid</h2>
        <p style={{ color: '#666' }}>Ask your team to generate a new link for this board.</p>
      </div>
    );
  }

  if (loading || !board) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div style={{ padding: '20px' }}>
      {needsJoin && board && (
        <JoinBoardModal
          boardId={board.id}
          boardName={board.name}
          onJoined={(user) => {
            setCurrentUser(user);
            setNeedsJoin(false);
          }}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <p style={{ color: '#666', margin: 0, fontSize: '0.9rem' }}>
          You are viewing this board via a shared link.
        </p>
        {currentUser && (
          <span style={{ fontSize: '0.9rem', color: '#555' }}>
            Logged in as <strong>{currentUser.name}</strong> ({currentUser.role})
          </span>
        )}
      </div>
      <h2 style={{ margin: '8px 0 20px 0' }}>{board.name}</h2>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', overflowX: 'auto', paddingBottom: '16px' }}>
        {columns.map((col) => (
          <ColumnComponent
            key={col.id}
            column={col}
            cards={cardsByColumn[col.id] ?? []}
            boardId={board.id}
            isAdmin={isAdmin}
            onCardCreated={handleCardCreated}
            onCardUpdated={handleCardUpdated}
            onCardDeleted={handleCardDeleted}
            onColumnUpdated={handleColumnUpdated}
            onColumnDeleted={handleColumnDeleted}
          />
        ))}
        {isAdmin && <ColumnForm boardId={board.id} onColumnCreated={handleColumnCreated} />}
      </div>
    </div>
  );
}
