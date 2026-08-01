import { useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Column as ColumnType, Card, cardApi } from '../services/api';
import CardForm from './CardForm';
import { COLUMN_ICONS } from './icons';

interface ColumnProps {
  column: ColumnType;
  cards: Card[];
  boardId: number;
  onCardCreated: (card: Card) => void;
  onCardUpdated?: (card: Card) => void;
  onCardDeleted?: (cardId: number, columnId: number) => void;
}

export default function Column({ column, cards, boardId, onCardCreated, onCardUpdated, onCardDeleted }: ColumnProps) {
  const [votingId, setVotingId] = useState<number | null>(null);
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const notifyUpdated = (updatedCard: Card) => {
    onCardUpdated?.(updatedCard);
  };

  const handleEditClick = (card: Card) => {
    setEditingCardId(card.id);
    setEditContent(card.content);
  };

  const handleCancelEdit = () => {
    setEditingCardId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (cardId: number) => {
    if (!editContent.trim()) return;
    try {
      setIsSubmitting(true);
      const updatedCard = await cardApi.updateCard(boardId, cardId, { content: editContent });
      notifyUpdated(updatedCard);
      setEditingCardId(null);
    } catch (err) {
      console.error('Failed to update card:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCard = async (cardId: number, columnId: number) => {
    if (!window.confirm('Are you sure you want to delete this card?')) return;
    try {
      setIsSubmitting(true);
      await cardApi.deleteCard(boardId, cardId);
      onCardDeleted?.(cardId, columnId);
    } catch (err) {
      console.error('Failed to delete card:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpvote = async (cardId: number) => {
    try {
      setVotingId(cardId);
      const updatedCard = await cardApi.upvoteCard(boardId, cardId);
      notifyUpdated(updatedCard);
    } catch (err) {
      console.error('Failed to upvote card:', err);
    } finally {
      setVotingId(null);
    }
  };

  const handleDownvote = async (cardId: number) => {
    try {
      setVotingId(cardId);
      const updatedCard = await cardApi.downvoteCard(boardId, cardId);
      notifyUpdated(updatedCard);
    } catch (err) {
      console.error('Failed to downvote card:', err);
    } finally {
      setVotingId(null);
    }
  };

  const ColumnIcon = column.icon ? COLUMN_ICONS[column.icon] : null;

  return (
    <div className="flex-1 min-w-[260px] flex flex-col rounded-xl p-3">
      <div className="flex items-center gap-2 mb-3">
        {ColumnIcon && <ColumnIcon size={22} strokeWidth={2} style={{ color: column.color ?? undefined }} />}
        <h3 className="m-0 text-base font-semibold text-gray-900">
          {column.name}
        </h3>
      </div>
      <Droppable droppableId={String(column.id)}>
        {(provided) => (
          <div
            className="flex-1 min-h-[50px]"
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {cards.map((card, index) => (
              <Draggable key={card.id} draggableId={String(card.id)} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`p-3 mb-2 rounded-xl shadow-sm ${column.color ? '' : 'bg-white border border-gray-200'} ${
                      snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-500' : ''
                    }`}
                    style={{
                      ...provided.draggableProps.style,
                      ...(column.color ? { backgroundColor: column.color } : {}),
                    }}
                  >
                    {editingCardId === card.id ? (
                      <div className="mb-2">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full p-1.5 text-sm border border-gray-300 rounded resize-y mb-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          rows={3}
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleSaveEdit(card.id)}
                            disabled={isSubmitting || !editContent.trim()}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={isSubmitting}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="m-0 mb-1.5 text-sm leading-relaxed">{card.content}</p>
                    )}

                    <div className="flex justify-between items-center mt-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-gray-500">
                          {card.author} · {new Date(card.created_at).toLocaleDateString()}
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleEditClick(card)}
                            disabled={isSubmitting}
                            className="p-0 border-none bg-transparent text-xs text-blue-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteCard(card.id, card.column_id)}
                            disabled={isSubmitting}
                            className="p-0 border-none bg-transparent text-xs text-red-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-1 bg-white/70 border border-black/10 rounded-full px-2 py-0.5">
                        <button
                          onClick={() => handleUpvote(card.id)}
                          disabled={votingId === card.id}
                          title="Upvote"
                          aria-label="Upvote"
                          className={`bg-transparent border-none text-xs p-0 leading-none ${
                            votingId === card.id ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-110 transition-transform'
                          }`}
                        >
                          👍
                        </button>
                        <span className="text-xs font-bold text-blue-600">
                          {card.votes ?? 0}
                        </span>
                        <button
                          onClick={() => handleDownvote(card.id)}
                          disabled={votingId === card.id || (card.votes ?? 0) <= 0}
                          title="Downvote"
                          aria-label="Downvote"
                          className={`bg-transparent border-none text-xs p-0 leading-none ${
                            votingId === card.id || (card.votes ?? 0) <= 0 
                              ? 'cursor-not-allowed opacity-50' 
                              : 'cursor-pointer hover:scale-110 transition-transform'
                          }`}
                        >
                          👎
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      <CardForm boardId={boardId} columnId={column.id} onCardCreated={onCardCreated} />
    </div>
  );
}
