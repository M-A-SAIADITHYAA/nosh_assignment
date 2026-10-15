export interface Dish {
  dishId: string;
  dishName: string;
  imageUrl: string;
  isPublished: boolean;
  version: number;
}

export interface DishDraft {
  dishName: string;
  isPublished: boolean;
}

export interface ConflictState {
  currentDish: Dish;
  currentVersion: number;
  expectedVersion: number;
  message: string;
}

export interface RemoteUpdateState {
  remoteDish: Dish;
  remoteVersion: number;
  receivedAt: string;
}

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}
