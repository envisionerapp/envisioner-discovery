import Joi from 'joi';
// Simplified for development - define types locally
enum Platform {
  TWITCH = 'twitch',
  YOUTUBE = 'youtube',
  KICK = 'kick'
}

enum Region {
  MEXICO = 'mexico',
  COLOMBIA = 'colombia',
  ARGENTINA = 'argentina',
  CHILE = 'chile',
  PERU = 'peru',
  VENEZUELA = 'venezuela'
}

enum FraudStatus {
  CLEAN = 'clean',
  SUSPICIOUS = 'suspicious',
  FLAGGED = 'flagged'
}

enum CampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed'
}

export const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .pattern(/@miela\.cc$/)
    .required()
    .messages({
      'string.pattern.base': 'Only @miela.cc email addresses are allowed'
    }),
  password: Joi.string().min(8).required(),
});

export const mfaVerifySchema = Joi.object({
  token: Joi.string().length(6).required(),
  userId: Joi.string().required(),
});

export const streamerFilterSchema = Joi.object({
  platforms: Joi.array().items(Joi.string().valid(...Object.values(Platform))),
  regions: Joi.array().items(Joi.string().valid(...Object.values(Region))),
  tags: Joi.array().items(Joi.string()),
  campaigns: Joi.array().items(Joi.string()),
  followersMin: Joi.number().min(0),
  followersMax: Joi.number().min(0),
  viewersMin: Joi.number().min(0),
  viewersMax: Joi.number().min(0),
  isLive: Joi.boolean(),
  usesCamera: Joi.boolean(),
  isVtuber: Joi.boolean(),
  fraudStatus: Joi.array().items(Joi.string().valid(...Object.values(FraudStatus))),
  lastStreamedWithin: Joi.number().min(0),
});

export const paginationSchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
  sortBy: Joi.string().default('updatedAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

export const streamerCreateSchema = Joi.object({
  platform: Joi.string().valid(...Object.values(Platform)).required(),
  username: Joi.string().min(1).max(100).required(),
  displayName: Joi.string().min(1).max(100).required(),
  profileUrl: Joi.string().uri().required(),
  avatarUrl: Joi.string().uri().allow(null),
  followers: Joi.number().min(0).default(0),
  currentViewers: Joi.number().min(0).allow(null),
  highestViewers: Joi.number().min(0).allow(null),
  lastStreamed: Joi.date().allow(null),
  isLive: Joi.boolean().default(false),
  currentGame: Joi.string().allow(null),
  topGames: Joi.array().items(Joi.string()).default([]),
  tags: Joi.array().items(Joi.string()).default([]),
  region: Joi.string().valid(...Object.values(Region)).required(),
  language: Joi.string().default('es'),
  socialLinks: Joi.array().items(Joi.object({
    platform: Joi.string().required(),
    url: Joi.string().uri().required(),
    verified: Joi.boolean().default(false),
  })).default([]),
  usesCamera: Joi.boolean().default(false),
  isVtuber: Joi.boolean().default(false),
  fraudCheck: Joi.string().valid(...Object.values(FraudStatus)).default(FraudStatus.CLEAN),
  notes: Joi.string().allow(null),
});

export const campaignCreateSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  description: Joi.string().min(1).max(1000).required(),
  rules: Joi.array().items(Joi.object({
    field: Joi.string().required(),
    operator: Joi.string().valid('equals', 'gt', 'gte', 'lt', 'lte', 'contains', 'in').required(),
    value: Joi.any().required(),
  })).default([]),
  isActive: Joi.boolean().default(true),
  startDate: Joi.date().allow(null),
  endDate: Joi.date().allow(null),
  budget: Joi.number().min(0).allow(null),
});

export const chatMessageSchema = Joi.object({
  message: Joi.string().min(1).max(1000).required(),
});

export const campaignAssignmentSchema = Joi.object({
  streamerId: Joi.string().required(),
  campaignId: Joi.string().required(),
  notes: Joi.string().allow(null),
  status: Joi.string().valid(...Object.values(CampaignStatus)).default(CampaignStatus.ACTIVE),
});

export const bulkStreamerUpdateSchema = Joi.object({
  streamers: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      updates: Joi.object({
        followers: Joi.number().min(0),
        currentViewers: Joi.number().min(0),
        highestViewers: Joi.number().min(0),
        lastStreamed: Joi.date(),
        isLive: Joi.boolean(),
        currentGame: Joi.string().allow(null),
        topGames: Joi.array().items(Joi.string()),
        fraudCheck: Joi.string().valid(...Object.values(FraudStatus)),
        notes: Joi.string().allow(null),
      })
    })
  ).min(1).max(1000).required()
});

export const scrapingConfigSchema = Joi.object({
  intervalMinutes: Joi.number().min(1).max(60).default(10),
  timeoutMs: Joi.number().min(5000).max(60000).default(30000),
  maxRetries: Joi.number().min(1).max(10).default(3),
  platforms: Joi.array().items(Joi.string().valid(...Object.values(Platform))).default(Object.values(Platform)),
});