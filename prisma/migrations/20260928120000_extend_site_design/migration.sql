-- AlterTable
ALTER TABLE "SiteDesign"
ADD COLUMN     "surfaceColor" TEXT NOT NULL DEFAULT '#ffffff',
ADD COLUMN     "mutedColor" TEXT NOT NULL DEFAULT '#475569',
ADD COLUMN     "headerStyle" TEXT NOT NULL DEFAULT 'plain',
ADD COLUMN     "heroStyle" TEXT NOT NULL DEFAULT 'banded',
ADD COLUMN     "cardDensity" TEXT NOT NULL DEFAULT 'comfortable';

-- Rows written before the palette was split kept a single backgroundColor for
-- the whole page. Split it: light sites get white cards on a soft page, dark
-- sites keep their dark surface and gain an even darker page behind it.
WITH legacy AS (
  SELECT
    id,
    "backgroundColor" AS original,
    ('x' || substring("backgroundColor" from 2 for 2))::bit(8)::int
      + ('x' || substring("backgroundColor" from 4 for 2))::bit(8)::int
      + ('x' || substring("backgroundColor" from 6 for 2))::bit(8)::int AS brightness
  FROM "SiteDesign"
)
UPDATE "SiteDesign" AS d
SET
  "surfaceColor" = l.original,
  "backgroundColor" = CASE WHEN l.brightness > 384 THEN '#f7f8fa' ELSE '#0b1220' END,
  "mutedColor" = CASE WHEN l.brightness > 384 THEN '#475569' ELSE '#94a3b8' END
FROM legacy AS l
WHERE d.id = l.id;
