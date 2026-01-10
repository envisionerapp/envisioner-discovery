import { Request, Response } from 'express';
import { db } from '../utils/database';
import { asyncHandler } from '../middleware/errorHandler';

export class DiscardsController {
  // Get user's discarded creators
  getDiscarded = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    const discarded = await db.discoveryDiscarded.findMany({
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
      data: discarded,
      count: discarded.length,
    });
  });

  // Get discarded IDs only (for quick lookup)
  getDiscardedIds = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    const discarded = await db.discoveryDiscarded.findMany({
      where: { userId },
      select: { streamerId: true },
    });

    res.status(200).json({
      success: true,
      data: discarded.map(d => d.streamerId),
    });
  });

  // Add to discarded
  addDiscarded = asyncHandler(async (req: Request, res: Response) => {
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
    const discarded = await db.discoveryDiscarded.upsert({
      where: {
        userId_streamerId: { userId, streamerId },
      },
      create: { userId, streamerId },
      update: {}, // No update needed
    });

    res.status(201).json({
      success: true,
      data: discarded,
    });
  });

  // Remove from discarded
  removeDiscarded = asyncHandler(async (req: Request, res: Response) => {
    const { userId, streamerId } = req.body;

    if (!userId || !streamerId) {
      return res.status(400).json({
        success: false,
        error: 'userId and streamerId are required',
      });
    }

    try {
      await db.discoveryDiscarded.delete({
        where: {
          userId_streamerId: { userId, streamerId },
        },
      });

      res.status(200).json({
        success: true,
        message: 'Removed from discarded',
      });
    } catch (e) {
      // Already deleted or never existed
      res.status(200).json({
        success: true,
        message: 'Not found or already removed from discarded',
      });
    }
  });

  // Toggle discarded (add if not exists, remove if exists)
  toggleDiscarded = asyncHandler(async (req: Request, res: Response) => {
    const { userId, streamerId } = req.body;

    if (!userId || !streamerId) {
      return res.status(400).json({
        success: false,
        error: 'userId and streamerId are required',
      });
    }

    // Check if already discarded
    const existing = await db.discoveryDiscarded.findUnique({
      where: {
        userId_streamerId: { userId, streamerId },
      },
    });

    if (existing) {
      // Remove
      await db.discoveryDiscarded.delete({
        where: { id: existing.id },
      });
      return res.status(200).json({
        success: true,
        action: 'removed',
        isDiscarded: false,
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

      await db.discoveryDiscarded.create({
        data: { userId, streamerId },
      });

      return res.status(200).json({
        success: true,
        action: 'added',
        isDiscarded: true,
      });
    }
  });
}
