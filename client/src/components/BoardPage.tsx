import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { boardApi, columnApi, cardApi, Board, Column, Card } from '../services/api';
import ColumnComponent from './Column';
import ColumnForm from './ColumnForm';
import { useBoardWebSocket } from '../hooks/useBoardWebSocket';

export default function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const boardId = Number(id);

  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [cardsByColumn, setCardsByColumn] = useState<Record<number, Card[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const boardData = await boardApi.getBoardById(boardId);
        setBoard(boardData);
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

  useBoardWebSocket(boardId, handleCardCreated, handleCardUpdated, handleColumnCreated);

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

  return (
    <div style={{ padding: '20px' }}>
      <Link to="/" style={{ color: '#007bff', textDecoration: 'none', fontSize: '0.9rem' }}>← Back to boards</Link>
      <h2 style={{ margin: '8px 0 20px 0' }}>{board?.name}</h2>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', overflowX: 'auto', paddingBottom: '16px' }}>
        {columns.map((col) => (
          <ColumnComponent
            key={col.id}
            column={col}
            cards={cardsByColumn[col.id] ?? []}
            boardId={boardId}
            onCardCreated={handleCardCreated}
            onCardUpdated={handleCardUpdated}
          />
        ))}
        <ColumnForm boardId={boardId} onColumnCreated={handleColumnCreated} />
      </div>
    </div>
  );
}
