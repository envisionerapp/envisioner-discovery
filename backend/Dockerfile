# Backend Dockerfile
FROM node:20-alpine AS base
WORKDIR /app

# Install deps
COPY backend/package*.json ./
RUN npm ci

# Copy source
COPY backend ./

# Generate Prisma client and build TS
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 5000

# Run migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]

