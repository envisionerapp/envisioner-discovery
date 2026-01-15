import { Request, Response } from 'express';
import { db } from '../utils/database';
import { asyncHandler } from '../middleware/errorHandler';

export class ShortlistController {
  // Get all shortlist entries for user (grouped by list)
  getShortlists = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string;
    const listName = req.query.listName as string | undefined;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    const where: any = { userId };
    if (listName) {
      where.listName = listName;
    }

    const shortlists = await db.discoveryShortlist.findMany({
      where,
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
            igamingScore: true,
            gamblingCompatibility: true,
            brandSafetyScore: true,
          },
        },
      },
      orderBy: [
        { listName: 'asc' },
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.status(200).json({
      success: true,
      data: shortlists,
      count: shortlists.length,
    });
  });

  // Get shortlist IDs for quick lookup
  getShortlistIds = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string;
    const listName = (req.query.listName as string) || 'default';

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    const shortlists = await db.discoveryShortlist.findMany({
      where: { userId, listName },
      select: { streamerId: true },
    });

    res.status(200).json({
      success: true,
      data: shortlists.map(s => s.streamerId),
    });
  });

  // Get all list names for user
  getListNames = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    const lists = await db.discoveryShortlist.groupBy({
      by: ['listName'],
      where: { userId },
      _count: { id: true },
    });

    res.status(200).json({
      success: true,
      data: lists.map(l => ({
        name: l.listName,
        count: l._count.id,
      })),
    });
  });

  // Add to shortlist
  addToShortlist = asyncHandler(async (req: Request, res: Response) => {
    const { userId, streamerId, listName = 'default', priority = 0, notes } = req.body;

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

    // Create or update
    const shortlist = await db.discoveryShortlist.upsert({
      where: {
        userId_streamerId_listName: { userId, streamerId, listName },
      },
      create: { userId, streamerId, listName, priority, notes },
      update: { priority, notes },
      include: {
        streamer: {
          select: {
            id: true,
            displayName: true,
            platform: true,
            avatarUrl: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: shortlist,
    });
  });

  // Remove from shortlist
  removeFromShortlist = asyncHandler(async (req: Request, res: Response) => {
    const { userId, streamerId, listName = 'default' } = req.body;

    if (!userId || !streamerId) {
      return res.status(400).json({
        success: false,
        error: 'userId and streamerId are required',
      });
    }

    try {
      await db.discoveryShortlist.delete({
        where: {
          userId_streamerId_listName: { userId, streamerId, listName },
        },
      });

      res.status(200).json({
        success: true,
        message: 'Removed from shortlist',
      });
    } catch (e) {
      res.status(200).json({
        success: true,
        message: 'Not found or already removed',
      });
    }
  });

  // Update shortlist entry (priority, notes)
  updateShortlistEntry = asyncHandler(async (req: Request, res: Response) => {
    const { userId, streamerId, listName = 'default', priority, notes } = req.body;

    if (!userId || !streamerId) {
      return res.status(400).json({
        success: false,
        error: 'userId and streamerId are required',
      });
    }

    const updateData: any = {};
    if (priority !== undefined) updateData.priority = priority;
    if (notes !== undefined) updateData.notes = notes;

    try {
      const updated = await db.discoveryShortlist.update({
        where: {
          userId_streamerId_listName: { userId, streamerId, listName },
        },
        data: updateData,
      });

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (e) {
      res.status(404).json({
        success: false,
        error: 'Shortlist entry not found',
      });
    }
  });

  // Reorder shortlist (bulk update priorities)
  reorderShortlist = asyncHandler(async (req: Request, res: Response) => {
    const { userId, listName = 'default', order } = req.body;

    if (!userId || !order || !Array.isArray(order)) {
      return res.status(400).json({
        success: false,
        error: 'userId and order array are required',
      });
    }

    // order is array of { streamerId, priority }
    const updates = order.map((item: { streamerId: string; priority: number }) =>
      db.discoveryShortlist.update({
        where: {
          userId_streamerId_listName: { userId, streamerId: item.streamerId, listName },
        },
        data: { priority: item.priority },
      })
    );

    await Promise.all(updates);

    res.status(200).json({
      success: true,
      message: 'Shortlist reordered',
    });
  });

  // Toggle shortlist (add if not exists, remove if exists)
  toggleShortlist = asyncHandler(async (req: Request, res: Response) => {
    const { userId, streamerId, listName = 'default', notes } = req.body;

    if (!userId || !streamerId) {
      return res.status(400).json({
        success: false,
        error: 'userId and streamerId are required',
      });
    }

    // Check if exists
    const existing = await db.discoveryShortlist.findUnique({
      where: {
        userId_streamerId_listName: { userId, streamerId, listName },
      },
    });

    if (existing) {
      // Remove
      await db.discoveryShortlist.delete({
        where: { id: existing.id },
      });
      return res.status(200).json({
        success: true,
        action: 'removed',
        isShortlisted: false,
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

      await db.discoveryShortlist.create({
        data: { userId, streamerId, listName, notes },
      });

      return res.status(200).json({
        success: true,
        action: 'added',
        isShortlisted: true,
      });
    }
  });
}
