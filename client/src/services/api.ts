import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Board interface
export interface Board {
  id: number;
  name: string;
}

export interface CreateBoardRequest {
  name: string;
}

// Board API methods
export const boardApi = {
  // Get all boards
  getBoards: async (): Promise<Board[]> => {
    const response = await api.get<Board[]>('/api/boards');
    return response.data;
  },

  // Create a new board
  createBoard: async (board: CreateBoardRequest): Promise<Board> => {
    const response = await api.post<Board>('/api/boards', board);
    return response.data;
  },
};

export default api;
