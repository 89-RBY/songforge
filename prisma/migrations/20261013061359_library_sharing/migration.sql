-- AlterTable
ALTER TABLE "Song" ADD COLUMN     "audioPurgedAt" TIMESTAMP(3),
ADD COLUMN     "coverHue" INTEGER,
ADD COLUMN     "energy" INTEGER,
ADD COLUMN     "favorite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "genre" TEXT,
ADD COLUMN     "mood" TEXT,
ADD COLUMN     "sharedAt" TIMESTAMP(3),
ADD COLUMN     "shareToken" TEXT,
ADD COLUMN     "variationOf" TEXT;

-- CreateIndex
CREATE INDEX "Song_userId_favorite_idx" ON "Song"("userId", "favorite");

-- CreateIndex
CREATE UNIQUE INDEX "Song_shareToken_key" ON "Song"("shareToken");
