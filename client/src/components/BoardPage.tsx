import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { boardApi, columnApi, cardApi, Board, Column, Card } from '../services/api';
import ColumnComponent from './Column';
import ColumnForm from './ColumnForm';
import { useBoardWebSocket } from '../hooks/useBoardWebSocket';
import { DragDropContext } from '@hello-pangea/dnd';

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

  const handleCardsReordered = useCallback((reorderedCards: Card[]) => {
    setCardsByColumn((prev) => {
      const next = { ...prev };
      
      reorderedCards.forEach((card) => {
        Object.keys(next).forEach((colId) => {
          const numColId = Number(colId);
          if (next[numColId]) {
            next[numColId] = next[numColId].filter(c => c.id !== card.id);
          }
        });
      });

      reorderedCards.forEach((card) => {
        if (!next[card.column_id]) {
          next[card.column_id] = [];
        }
        next[card.column_id].push(card);
      });

      Object.keys(next).forEach((colId) => {
        next[Number(colId)].sort((a, b) => a.position - b.position);
      });

      return next;
    });
  }, []);

  useBoardWebSocket(boardId, handleCardCreated, handleCardUpdated, handleColumnCreated, handleCardDeleted, handleCardsReordered);

  const onDragEnd = async (result: any) => {
    const { destination, source } = result;

    if (!destination || !board) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceColumnId = Number(source.droppableId);
    const destColumnId = Number(destination.droppableId);

    setCardsByColumn((prev) => {
      const sourceCards = Array.from(prev[sourceColumnId] || []);
      const destCards = sourceColumnId === destColumnId ? sourceCards : Array.from(prev[destColumnId] || []);

      const [movedCard] = sourceCards.splice(source.index, 1);
      
      const updatedCard = { ...movedCard, column_id: destColumnId };
      destCards.splice(destination.index, 0, updatedCard);

      const updatedDestCards = destCards.map((card, index) => ({
        ...card,
        position: index + 1
      }));

      const newState = {
        ...prev,
        [sourceColumnId]: sourceCards,
        [destColumnId]: updatedDestCards
      };
      
      if (sourceColumnId !== destColumnId) {
        const updatedSourceCards = sourceCards.map((card, index) => ({
          ...card,
          position: index + 1
        }));
        newState[sourceColumnId] = updatedSourceCards;
      }

      const updates = [];
      if (sourceColumnId !== destColumnId) {
        updates.push(...newState[sourceColumnId].map(c => ({ id: c.id, column_id: sourceColumnId, position: c.position })));
      }
      updates.push(...newState[destColumnId].map(c => ({ id: c.id, column_id: destColumnId, position: c.position })));

      cardApi.reorderCards(board.id, { cards: updates }).catch(err => {
        console.error('Failed to reorder cards', err);
      });

      return newState;
    });
  };

  if (loading) {
    return <div className="p-5">Loading...</div>;
  }

  if (error) {
    return (
      <div className="p-5">
        <div className="p-2.5 bg-red-100 text-red-800 border border-red-200 rounded mb-3">
          {error}
        </div>
        <Link to="/" className="text-blue-600 no-underline hover:underline">← Back to boards</Link>
      </div>
    );
  }

  return (
    <div className="p-5">
      <Link to="/" className="text-blue-600 no-underline hover:underline text-sm">← Back to boards</Link>
      <h2 className="my-2 mb-5 text-2xl font-bold">{board?.name}</h2>
      
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 items-start overflow-x-auto pb-4">
          {columns.map((col) => (
            <ColumnComponent
              key={col.id}
              column={col}
              cards={cardsByColumn[col.id] ?? []}
              boardId={boardId}
              onCardCreated={handleCardCreated}
              onCardUpdated={handleCardUpdated}
              onCardDeleted={handleCardDeleted}
            />
          ))}
          <ColumnForm boardId={boardId} onColumnCreated={handleColumnCreated} />
        </div>
      </DragDropContext>
    </div>
  );
}
