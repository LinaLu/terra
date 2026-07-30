import { useEffect, useRef } from 'react';
import { Card, getBoardWsUrl } from '../services/api';

interface WebSocketMessage {
  type: 'card_created' | 'card_updated';
  data: Card;
}

export function useBoardWebSocket(
  boardId: number | null | undefined,
  onCardCreated: (card: Card) => void,
  onCardUpdated: (card: Card) => void
) {
  const onCardCreatedRef = useRef(onCardCreated);
  const onCardUpdatedRef = useRef(onCardUpdated);

  useEffect(() => {
    onCardCreatedRef.current = onCardCreated;
    onCardUpdatedRef.current = onCardUpdated;
  }, [onCardCreated, onCardUpdated]);

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
          const payload: WebSocketMessage = JSON.parse(event.data);
          if (payload.type === 'card_created') {
            onCardCreatedRef.current(payload.data);
          } else if (payload.type === 'card_updated') {
            onCardUpdatedRef.current(payload.data);
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
