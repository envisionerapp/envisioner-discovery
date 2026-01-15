-- CreateTable
CREATE TABLE "discovery_shortlists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "streamer_id" TEXT NOT NULL,
    "list_name" TEXT NOT NULL DEFAULT 'default',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discovery_shortlists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discovery_shortlists_user_id_list_name_idx" ON "discovery_shortlists"("user_id", "list_name");

-- CreateIndex
CREATE INDEX "discovery_shortlists_user_id_list_name_priority_idx" ON "discovery_shortlists"("user_id", "list_name", "priority" DESC);

-- CreateIndex
CREATE INDEX "discovery_shortlists_streamer_id_idx" ON "discovery_shortlists"("streamer_id");

-- CreateIndex
CREATE UNIQUE INDEX "discovery_shortlists_user_id_streamer_id_list_name_key" ON "discovery_shortlists"("user_id", "streamer_id", "list_name");

-- AddForeignKey
ALTER TABLE "discovery_shortlists" ADD CONSTRAINT "discovery_shortlists_streamer_id_fkey" FOREIGN KEY ("streamer_id") REFERENCES "discovery_creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
