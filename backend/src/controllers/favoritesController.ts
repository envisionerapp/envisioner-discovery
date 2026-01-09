import { Request, Response } from 'express';
import { db } from '../utils/database';
import { asyncHandler } from '../middleware/errorHandler';

export class FavoritesController {
  // Get user's favorites
  getFavorites = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    const favorites = await db.discoveryFavorite.findMany({
      where: { userId },
      include: {
        streamer: {
          select: {
            id: true,
            platform: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            followers: true,
            isLive: true,
            currentViewers: true,
            region: true,
            primaryCategory: true,
            currentGame: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      data: favorites,
      count: favorites.length,
    });
  });

  // Get favorite IDs only (for quick lookup)
  getFavoriteIds = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    const favorites = await db.discoveryFavorite.findMany({
      where: { userId },
      select: { streamerId: true },
    });

    res.status(200).json({
      success: true,
      data: favorites.map(f => f.streamerId),
    });
  });

  // Add favorite
  addFavorite = asyncHandler(async (req: Request, res: Response) => {
    const { userId, streamerId } = req.body;

    if (!userId || !streamerId) {
      return res.status(400).json({
        success: false,
        error: 'userId and streamerId are required',
      });
    }

    // Check if streamer exists
    const streamer = await db.streamer.findUnique({
      where: { id: streamerId },
    });

    if (!streamer) {
      return res.status(404).json({
        success: false,
        error: 'Streamer not found',
      });
    }

    // Create or return existing
    const favorite = await db.discoveryFavorite.upsert({
      where: {
        userId_streamerId: { userId, streamerId },
      },
      create: { userId, streamerId },
      update: {}, // No update needed
    });

    res.status(201).json({
      success: true,
      data: favorite,
    });
  });

  // Remove favorite
  removeFavorite = asyncHandler(async (req: Request, res: Response) => {
    const { userId, streamerId } = req.body;

    if (!userId || !streamerId) {
      return res.status(400).json({
        success: false,
        error: 'userId and streamerId are required',
      });
    }

    try {
      await db.discoveryFavorite.delete({
        where: {
          userId_streamerId: { userId, streamerId },
        },
      });

      res.status(200).json({
        success: true,
        message: 'Favorite removed',
      });
    } catch (e) {
      // Already deleted or never existed
      res.status(200).json({
        success: true,
        message: 'Favorite not found or already removed',
      });
    }
  });

  // Toggle favorite (add if not exists, remove if exists)
  toggleFavorite = asyncHandler(async (req: Request, res: Response) => {
    const { userId, streamerId } = req.body;

    if (!userId || !streamerId) {
      return res.status(400).json({
        success: false,
        error: 'userId and streamerId are required',
      });
    }

    // Check if favorite exists
    const existing = await db.discoveryFavorite.findUnique({
      where: {
        userId_streamerId: { userId, streamerId },
      },
    });

    if (existing) {
      // Remove
      await db.discoveryFavorite.delete({
        where: { id: existing.id },
      });
      return res.status(200).json({
        success: true,
        action: 'removed',
        isFavorite: false,
      });
    } else {
      // Add
      const streamer = await db.streamer.findUnique({
        where: { id: streamerId },
      });

      if (!streamer) {
        return res.status(404).json({
          success: false,
          error: 'Streamer not found',
        });
      }

      await db.discoveryFavorite.create({
        data: { userId, streamerId },
      });

      return res.status(200).json({
        success: true,
        action: 'added',
        isFavorite: true,
      });
    }
  });
}
