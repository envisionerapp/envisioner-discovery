import { Server, Socket } from 'socket.io';
import { verify as jwtVerify } from 'jsonwebtoken';
import { db, logger } from '../utils/database';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
  };
}

export class SocketService {
  private io: Server;
  private connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(io: Server) {
    this.io = io;
  }

  initialize() {
    this.io.use(this.authenticateSocket.bind(this));

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
  }

  private async authenticateSocket(socket: AuthenticatedSocket, next: Function) {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwtVerify(token, process.env.JWT_SECRET as string) as any;
      const user = await db.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, email: true }
      });

      if (!user || !user.email.endsWith('@miela.cc')) {
        return next(new Error('Authentication error: Invalid user'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  }

  private handleConnection(socket: AuthenticatedSocket) {
    if (!socket.user) return;

    const userId = socket.user.id;
    this.connectedUsers.set(userId, socket.id);

    logger.info(`User ${socket.user.email} connected via Socket.IO`);

    // Join user to their personal room
    socket.join(`user:${userId}`);

    // Handle disconnection
    socket.on('disconnect', () => {
      this.connectedUsers.delete(userId);
      logger.info(`User ${socket.user?.email} disconnected from Socket.IO`);
    });

    // Handle chat message events
    socket.on('chat:typing', () => {
      socket.broadcast.to(`user:${userId}`).emit('chat:user_typing', {
        userId: userId,
        email: socket.user?.email
      });
    });

    socket.on('chat:stop_typing', () => {
      socket.broadcast.to(`user:${userId}`).emit('chat:user_stop_typing', {
        userId: userId
      });
    });

    // Handle streamer data requests
    socket.on('streamer:request_update', async (streamerId: string) => {
      try {
        const streamer = await db.streamer.findUnique({
          where: { id: streamerId },
          include: {
            campaignAssignments: {
              include: { campaign: true }
            }
          }
        });

        if (streamer) {
          socket.emit('streamer:updated', streamer);
        }
      } catch (error) {
        logger.error('Error handling streamer update request:', error);
        socket.emit('error', { message: 'Failed to fetch streamer data' });
      }
    });

    // Send initial connection confirmation
    socket.emit('connected', {
      userId: userId,
      email: socket.user.email,
      timestamp: new Date().toISOString()
    });
  }

  // Broadcast to all connected users
  broadcastToAll(event: string, data: any) {
    this.io.emit(event, data);
  }

  // Send to specific user
  sendToUser(userId: string, event: string, data: any) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  }

  // Broadcast streamer updates
  broadcastStreamerUpdate(streamer: any) {
    this.io.emit('streamer:updated', streamer);
  }

  // Broadcast scraping status updates
  broadcastScrapingStatus(status: any) {
    this.io.emit('scraping:status', status);
  }

  // Broadcast campaign updates
  broadcastCampaignUpdate(campaign: any) {
    this.io.emit('campaign:updated', campaign);
  }

  // Send chat response
  sendChatResponse(userId: string, response: any) {
    this.sendToUser(userId, 'chat:response', response);
  }

  // Get connected users count
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  // Get connected users
  getConnectedUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }
}

export let socketService: SocketService;
