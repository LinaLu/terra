import axios from 'axios';

const getApiUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  return 'http://localhost:8000';
};

const API_URL = getApiUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

export interface Board {
  id: number;
  name: string;
  short_code: string | null;
  link_expires_at: string | null;
  admin_id: number | null;
}

export interface User {
  id: number;
  board_id: number;
  name: string;
  role: 'admin' | 'user';
}

export interface JoinResponse {
  user: User;
  session_token: string;
}

export interface LinkResponse {
  short_code: string;
  link_expires_at: string;
}

export interface Column {
  id: number;
  board_id: number;
  name: string;
  position: number;
}

export interface Card {
  id: number;
  column_id: number;
  content: string;
  author: string;
  votes: number;
  position: number;
  created_at: string;
}

export interface CreateBoardRequest {
  name: string;
}

export interface CreateColumnRequest {
  name: string;
}

export interface CreateCardRequest {
  column_id: number;
  content: string;
  position?: number;
}

export interface ReorderCardsRequest {
  cards: {
    id: number;
    column_id: number;
    position: number;
  }[];
}
export interface UpdateCardRequest {
  content: string;
}

export const getBoardToken = (boardId: number): string | null => {
  try {
    const raw = localStorage.getItem('terra_tokens');
    if (!raw) return null;
    const tokens = JSON.parse(raw);
    return tokens[boardId] ?? null;
  } catch {
    return null;
  }
};

export const setBoardToken = (boardId: number, token: string): void => {
  try {
    const raw = localStorage.getItem('terra_tokens');
    const tokens = raw ? JSON.parse(raw) : {};
    tokens[boardId] = token;
    localStorage.setItem('terra_tokens', JSON.stringify(tokens));
  } catch (err) {
    console.error('Failed to save token to localStorage:', err);
  }
};

const getAuthHeaders = (boardId: number) => {
  const token = getBoardToken(boardId);
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

export const getBoardWsUrl = (boardId: number): string => {
  const baseUrl = getApiUrl();
  const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
  const host = baseUrl.replace(/^https?:\/\//, '');
  return `${wsProtocol}://${host}/ws/boards/${boardId}`;
};

export const boardApi = {
  getBoards: async (): Promise<Board[]> => {
    const response = await api.get<Board[]>('/api/boards');
    return response.data;
  },
  createBoard: async (board: CreateBoardRequest): Promise<Board> => {
    const response = await api.post<Board>('/api/boards', board);
    return response.data;
  },
  getBoardById: async (id: number): Promise<Board> => {
    const response = await api.get<Board>(`/api/boards/${id}`);
    return response.data;
  },
  generateLink: async (boardId: number): Promise<LinkResponse> => {
    const response = await api.post<LinkResponse>(`/api/boards/${boardId}/link`);
    return response.data;
  },
  getBoardByCode: async (code: string): Promise<Board> => {
    const response = await api.get<Board>(`/b/${code}`);
    return response.data;
  },
  joinBoard: async (boardId: number, name: string): Promise<JoinResponse> => {
    const response = await api.post<JoinResponse>(`/api/boards/${boardId}/join`, { name });
    return response.data;
  },
  getMe: async (boardId: number): Promise<User> => {
    const response = await api.get<User>(`/api/boards/${boardId}/me`, getAuthHeaders(boardId));
    return response.data;
  },
};

export const columnApi = {
  getColumns: async (boardId: number): Promise<Column[]> => {
    const response = await api.get<Column[]>(`/api/boards/${boardId}/columns`);
    return response.data;
  },
  createColumn: async (boardId: number, column: CreateColumnRequest): Promise<Column> => {
    const response = await api.post<Column>(`/api/boards/${boardId}/columns`, column, getAuthHeaders(boardId));
    return response.data;
  },
  updateColumn: async (boardId: number, columnId: number, column: CreateColumnRequest): Promise<Column> => {
    const response = await api.put<Column>(`/api/boards/${boardId}/columns/${columnId}`, column, getAuthHeaders(boardId));
    return response.data;
  },
  deleteColumn: async (boardId: number, columnId: number): Promise<void> => {
    await api.delete(`/api/boards/${boardId}/columns/${columnId}`, getAuthHeaders(boardId));
  },
};

export const cardApi = {
  getCards: async (boardId: number): Promise<Card[]> => {
    const response = await api.get<Card[]>(`/api/boards/${boardId}/cards`);
    return response.data;
  },
  createCard: async (boardId: number, card: CreateCardRequest): Promise<Card> => {
    const response = await api.post<Card>(`/api/boards/${boardId}/cards`, card, getAuthHeaders(boardId));
    return response.data;
  },
  updateCard: async (boardId: number, cardId: number, cardUpdate: UpdateCardRequest): Promise<Card> => {
    const response = await api.put<Card>(`/api/boards/${boardId}/cards/${cardId}`, cardUpdate);
    return response.data;
  },
  deleteCard: async (boardId: number, cardId: number): Promise<void> => {
    await api.delete(`/api/boards/${boardId}/cards/${cardId}`);
  },
  upvoteCard: async (boardId: number, cardId: number): Promise<Card> => {
    const response = await api.post<Card>(`/api/boards/${boardId}/cards/${cardId}/upvote`);
    return response.data;
  },
  downvoteCard: async (boardId: number, cardId: number): Promise<Card> => {
    const response = await api.post<Card>(`/api/boards/${boardId}/cards/${cardId}/downvote`);
    return response.data;
  },
  reorderCards: async (boardId: number, request: ReorderCardsRequest): Promise<void> => {
    await api.put(`/api/boards/${boardId}/cards/reorder`, request);
  },
};

export default api;
