// Local type definitions for frontend
export interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  mfaEnabled: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export enum Platform {
  TWITCH = 'twitch',
  YOUTUBE = 'youtube',
  KICK = 'kick'
}

export enum StreamerTag {
  GAMING = 'gaming',
  MUSIC = 'music',
  CHATTING = 'chatting',
  IRL = 'irl',
  ART = 'art',
  SPORTS = 'sports'
}

export enum Region {
  MEXICO = 'mexico',
  COLOMBIA = 'colombia',
  ARGENTINA = 'argentina',
  CHILE = 'chile',
  PERU = 'peru',
  VENEZUELA = 'venezuela'
}

export enum FraudStatus {
  CLEAN = 'clean',
  SUSPICIOUS = 'suspicious',
  FLAGGED = 'flagged'
}

export enum CampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed'
}