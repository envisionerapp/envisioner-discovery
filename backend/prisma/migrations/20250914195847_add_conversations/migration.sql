-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add conversationId column with temporary default
ALTER TABLE "chat_messages" ADD COLUMN "conversationId" TEXT NOT NULL DEFAULT 'temp';

-- Create a default conversation for existing messages per user
INSERT INTO "conversations" ("id", "userId", "title", "updatedAt")
SELECT
    CONCAT(cm."userId", '-default-conversation'),
    cm."userId",
    'Chat History',
    NOW()
FROM "chat_messages" cm
GROUP BY cm."userId";

-- Update existing messages to reference the default conversation
UPDATE "chat_messages"
SET "conversationId" = CONCAT("userId", '-default-conversation')
WHERE "conversationId" = 'temp';

-- Remove the default constraint (it was temporary)
ALTER TABLE "chat_messages" ALTER COLUMN "conversationId" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
