import { useEffect, useRef } from 'react';
import { Card, Column, getBoardWsUrl } from '../services/api';

type WebSocketMessage =
  | { type: 'card_created' | 'card_updated'; data: Card }
  | { type: 'column_created' | 'column_updated'; data: Column }
  | { type: 'column_deleted'; data: { id: number } }
  | { type: 'card_deleted'; data: { id: number; column_id: number } }
  | { type: 'cards_reordered'; data: Card[] };

export function useBoardWebSocket(
  boardId: number | null | undefined,
  onCardCreated: (card: Card) => void,
  onCardUpdated: (card: Card) => void,
  onColumnCreated: (column: Column) => void,
  onCardDeleted?: (cardId: number, columnId: number) => void,
  onColumnUpdated?: (column: Column) => void,
  onColumnDeleted?: (columnId: number) => void,
  onCardsReordered?: (cards: Card[]) => void
) {
  const onCardCreatedRef = useRef(onCardCreated);
  const onCardUpdatedRef = useRef(onCardUpdated);
  const onColumnCreatedRef = useRef(onColumnCreated);
  const onCardDeletedRef = useRef(onCardDeleted);
  const onColumnUpdatedRef = useRef(onColumnUpdated);
  const onColumnDeletedRef = useRef(onColumnDeleted);
  const onCardsReorderedRef = useRef(onCardsReordered);

  useEffect(() => {
    onCardCreatedRef.current = onCardCreated;
    onCardUpdatedRef.current = onCardUpdated;
    onColumnCreatedRef.current = onColumnCreated;
    onCardDeletedRef.current = onCardDeleted;
    onColumnUpdatedRef.current = onColumnUpdated;
    onColumnDeletedRef.current = onColumnDeleted;
    onCardsReorderedRef.current = onCardsReordered;
  }, [onCardCreated, onCardUpdated, onColumnCreated, onCardDeleted, onColumnUpdated, onColumnDeleted, onCardsReordered]);

  useEffect(() => {
    if (!boardId) return;

    const wsUrl = getBoardWsUrl(boardId);
    let socket: WebSocket | null = null;
    let isMounted = true;
    let reconnectTimeout: number | null = null;

    const connect = () => {
      socket = new WebSocket(wsUrl);

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as WebSocketMessage;
          if (payload.type === 'card_created') {
            onCardCreatedRef.current(payload.data);
          } else if (payload.type === 'card_updated') {
            onCardUpdatedRef.current(payload.data);
          } else if (payload.type === 'column_created') {
            onColumnCreatedRef.current(payload.data);
          } else if (payload.type === 'column_updated') {
            if (onColumnUpdatedRef.current) {
              onColumnUpdatedRef.current(payload.data);
            }
          } else if (payload.type === 'column_deleted') {
            if (onColumnDeletedRef.current) {
              onColumnDeletedRef.current(payload.data.id);
            }
          } else if (payload.type === 'card_deleted') {
            if (onCardDeletedRef.current) {
              onCardDeletedRef.current(payload.data.id, payload.data.column_id);
            }
          } else if (payload.type === 'cards_reordered' && onCardsReorderedRef.current) {
            onCardsReorderedRef.current(payload.data);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      socket.onclose = () => {
        if (isMounted) {
          reconnectTimeout = window.setTimeout(connect, 3000);
        }
      };

      socket.onerror = (err) => {
        console.error('WebSocket error:', err);
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeout) window.clearTimeout(reconnectTimeout);
      if (socket) socket.close();
    };
  }, [boardId]);
}
