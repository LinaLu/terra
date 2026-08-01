import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { boardApi, columnApi, cardApi, Board, Column, Card } from '../services/api';
import ColumnComponent from './Column';
import ColumnForm from './ColumnForm';
import { useBoardWebSocket } from '../hooks/useBoardWebSocket';

export default function BoardView() {
  const { code } = useParams<{ code: string }>();
  const [board, setBoard] = useState<Board | null>(null);
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

  useBoardWebSocket(board?.id, handleCardCreated, handleCardUpdated, handleColumnCreated);

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

  return (
    <div style={{ padding: '20px' }}>
      <p style={{ color: '#666', margin: '0 0 12px 0', fontSize: '0.9rem' }}>
        You are viewing this board via a shared link.
      </p>
      <h2 style={{ margin: '8px 0 20px 0' }}>{board.name}</h2>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', overflowX: 'auto', paddingBottom: '16px' }}>
        {columns.map((col) => (
          <ColumnComponent
            key={col.id}
            column={col}
            cards={cardsByColumn[col.id] ?? []}
            boardId={board.id}
            onCardCreated={handleCardCreated}
            onCardUpdated={handleCardUpdated}
          />
        ))}
        <ColumnForm boardId={board.id} onColumnCreated={handleColumnCreated} />
      </div>
    </div>
  );
}
