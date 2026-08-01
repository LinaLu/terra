import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { boardApi, columnApi, cardApi, Board, Column, Card, User, getBoardToken } from '../services/api';
import ColumnComponent from './Column';
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
      
      // Remove reordered cards from their old locations
      reorderedCards.forEach((card) => {
        Object.keys(next).forEach((colId) => {
          const numColId = Number(colId);
          if (next[numColId]) {
            next[numColId] = next[numColId].filter(c => c.id !== card.id);
          }
        });
      });

      // Add them to their new locations
      reorderedCards.forEach((card) => {
        if (!next[card.column_id]) {
          next[card.column_id] = [];
        }
        next[card.column_id].push(card);
      });

      // Sort all columns by position
      Object.keys(next).forEach((colId) => {
        next[Number(colId)].sort((a, b) => a.position - b.position);
      });

      return next;
    });
  }, []);

  useBoardWebSocket(
    board?.id,
    handleCardCreated,
    handleCardUpdated,
    handleCardDeleted,
    handleCardsReordered
  );

  const onDragEnd = async (result: DropResult) => {
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
      
      // Optimistically update the card's column ID
      const updatedCard = { ...movedCard, column_id: destColumnId };
      destCards.splice(destination.index, 0, updatedCard);

      // Reassign positions for the destination column
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
        // Also need to reassign positions for the source column if it changed
        const updatedSourceCards = sourceCards.map((card, index) => ({
          ...card,
          position: index + 1
        }));
        newState[sourceColumnId] = updatedSourceCards;
      }

      // Prepare backend payload
      const updates = [];
      if (sourceColumnId !== destColumnId) {
        updates.push(...newState[sourceColumnId].map(c => ({ id: c.id, column_id: sourceColumnId, position: c.position })));
      }
      updates.push(...newState[destColumnId].map(c => ({ id: c.id, column_id: destColumnId, position: c.position })));

      // Fire and forget backend update
      cardApi.reorderCards(board.id, { cards: updates }).catch(err => {
        console.error('Failed to reorder cards', err);
      });

      return newState;
    });
  };

  if (expired) {
    return (
      <div className="max-w-[800px] my-[60px] mx-auto p-10 font-sans text-center">
        <h2>This link has expired or is invalid</h2>
        <p className="text-gray-600">Ask your team to generate a new link for this board.</p>
      </div>
    );
  }

  if (loading || !board) {
    return <div className="p-5">Loading...</div>;
  }

  return (
    <div className="p-5">
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
      <div className="flex justify-between items-center mb-2">
        <p className="text-gray-600 m-0 text-sm">
          You are viewing this board via a shared link.
        </p>
        {currentUser && (
          <span className="text-sm text-gray-600">
            Logged in as <strong>{currentUser.name}</strong> ({currentUser.role})
          </span>
        )}
      </div>
      <h2 className="my-2 mb-5 text-2xl font-bold">{board.name}</h2>
      
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-6 items-start overflow-x-auto pb-4">
          {columns.map((col) => (
            <ColumnComponent
              key={col.id}
              column={col}
              cards={cardsByColumn[col.id] ?? []}
              boardId={board.id}
              onCardCreated={handleCardCreated}
              onCardUpdated={handleCardUpdated}
              onCardDeleted={handleCardDeleted}
            />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
