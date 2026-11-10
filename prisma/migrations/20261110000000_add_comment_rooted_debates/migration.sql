ALTER TABLE "Debate"
  ALTER COLUMN "root_post_id" DROP NOT NULL,
  ADD COLUMN "root_comment_id" TEXT;

CREATE UNIQUE INDEX "Debate_root_comment_id_key" ON "Debate"("root_comment_id");

ALTER TABLE "Debate"
  ADD CONSTRAINT "Debate_root_comment_id_fkey"
  FOREIGN KEY ("root_comment_id") REFERENCES "Comment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Debate"
  ADD CONSTRAINT "Debate_exactly_one_root_target_check"
  CHECK (("root_post_id" IS NOT NULL AND "root_comment_id" IS NULL)
      OR ("root_post_id" IS NULL AND "root_comment_id" IS NOT NULL));
