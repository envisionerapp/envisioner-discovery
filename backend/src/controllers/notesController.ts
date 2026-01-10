import { Request, Response } from 'express';
import { db } from '../utils/database';
import { asyncHandler } from '../middleware/errorHandler';

export class NotesController {
  // Get user's notes for all creators
  getNotes = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    const notes = await db.discoveryNote.findMany({
      where: { userId },
      include: {
        streamer: {
          select: {
            id: true,
            platform: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      data: notes,
      count: notes.length,
    });
  });

  // Get note for a specific creator
  getNote = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string;
    const streamerId = req.params.streamerId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    const note = await db.discoveryNote.findUnique({
      where: {
        userId_streamerId: { userId, streamerId },
      },
    });

    res.status(200).json({
      success: true,
      data: note,
    });
  });

  // Get all notes as a map (streamerId -> content) for quick lookup
  getNotesMap = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    const notes = await db.discoveryNote.findMany({
      where: { userId },
      select: { streamerId: true, content: true },
    });

    const notesMap: Record<string, string> = {};
    notes.forEach(n => {
      notesMap[n.streamerId] = n.content;
    });

    res.status(200).json({
      success: true,
      data: notesMap,
    });
  });

  // Save or update note
  saveNote = asyncHandler(async (req: Request, res: Response) => {
    const { userId, streamerId, content } = req.body;

    if (!userId || !streamerId) {
      return res.status(400).json({
        success: false,
        error: 'userId and streamerId are required',
      });
    }

    // If content is empty, delete the note
    if (!content || content.trim() === '') {
      try {
        await db.discoveryNote.delete({
          where: {
            userId_streamerId: { userId, streamerId },
          },
        });
        return res.status(200).json({
          success: true,
          message: 'Note deleted',
          data: null,
        });
      } catch (e) {
        // Note didn't exist
        return res.status(200).json({
          success: true,
          message: 'No note to delete',
          data: null,
        });
      }
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

    // Upsert note
    const note = await db.discoveryNote.upsert({
      where: {
        userId_streamerId: { userId, streamerId },
      },
      create: { userId, streamerId, content: content.trim() },
      update: { content: content.trim() },
    });

    res.status(200).json({
      success: true,
      data: note,
    });
  });

  // Delete note
  deleteNote = asyncHandler(async (req: Request, res: Response) => {
    const { userId, streamerId } = req.body;

    if (!userId || !streamerId) {
      return res.status(400).json({
        success: false,
        error: 'userId and streamerId are required',
      });
    }

    try {
      await db.discoveryNote.delete({
        where: {
          userId_streamerId: { userId, streamerId },
        },
      });

      res.status(200).json({
        success: true,
        message: 'Note deleted',
      });
    } catch (e) {
      res.status(200).json({
        success: true,
        message: 'Note not found or already deleted',
      });
    }
  });
}
