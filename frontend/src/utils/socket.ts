import { io, Socket } from 'socket.io-client';
import { API_BASE } from './api';

let socket: Socket | null = null;

export const getSocket = (): Socket | null => {
  const token = localStorage.getItem('token');

  // Don't create socket if no token
  if (!token) {
    return null;
  }

  if (!socket) {
    socket = io(API_BASE || 'http://localhost:8080', {
      auth: {
        token,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socket.on('connect', () => {
      console.log('✅ Connected to Socket.IO server');
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from Socket.IO server');
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error);
    });
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const subscribeToLiveStatusUpdates = (callback: (data: any) => void) => {
  const socketInstance = getSocket();

  if (!socketInstance) {
    // Return a no-op unsubscribe function if no socket
    return () => {};
  }

  socketInstance.on('live:status_updated', callback);

  return () => {
    socketInstance.off('live:status_updated', callback);
  };
};