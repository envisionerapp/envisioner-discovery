import express from 'express';
import {
  startBatchEnrichment,
  enrichStreamer,
  enrichStreamers,
  getEnrichmentStatus,
  reEnrichStaleStreamers,
  getStreamerEnrichmentData
} from '../controllers/enrichmentController';

const router = express.Router();

// TODO: Add authentication middleware once available

/**
 * @route   POST /api/enrichment/start
 * @desc    Start batch enrichment for all unenriched streamers
 * @access  Private
 */
router.post('/start', startBatchEnrichment);

/**
 * @route   POST /api/enrichment/streamer/:streamerId
 * @desc    Enrich a single streamer by ID
 * @access  Private
 */
router.post('/streamer/:streamerId', enrichStreamer);

/**
 * @route   POST /api/enrichment/streamers
 * @desc    Enrich multiple streamers by IDs
 * @access  Private
 */
router.post('/streamers', enrichStreamers);

/**
 * @route   GET /api/enrichment/status
 * @desc    Get enrichment status and statistics
 * @access  Private
 */
router.get('/status', getEnrichmentStatus);

/**
 * @route   POST /api/enrichment/re-enrich
 * @desc    Re-enrich streamers that haven't been updated in X days
 * @access  Private
 */
router.post('/re-enrich', reEnrichStaleStreamers);

/**
 * @route   GET /api/enrichment/streamer/:streamerId
 * @desc    Get enrichment data for a specific streamer
 * @access  Private
 */
router.get('/streamer/:streamerId', getStreamerEnrichmentData);

export default router;
