import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

export interface Board {
  id: number;
  name: string;
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
  created_at: string;
}

export interface CreateBoardRequest {
  name: string;
}

export interface CreateCardRequest {
  column_id: number;
  content: string;
  author: string;
}

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
};

export const columnApi = {
  getColumns: async (boardId: number): Promise<Column[]> => {
    const response = await api.get<Column[]>(`/api/boards/${boardId}/columns`);
    return response.data;
  },
};

export const cardApi = {
  getCards: async (boardId: number): Promise<Card[]> => {
    const response = await api.get<Card[]>(`/api/boards/${boardId}/cards`);
    return response.data;
  },
  createCard: async (boardId: number, card: CreateCardRequest): Promise<Card> => {
    const response = await api.post<Card>(`/api/boards/${boardId}/cards`, card);
    return response.data;
  },
};

export default api;
