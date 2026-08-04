-- RTM-DATA-008: SQLite/libSQL cannot add CHECK constraints to these existing
-- tables without rebuilding them. These BEFORE triggers preserve all current
-- rows and protect the same stable scalar invariants for direct and ORM writes.
-- Preflight is intentionally external: run the read-only diagnostics documented
-- in docs/data-invariants.md on a copy before an environment applies this file.

-- Abort before installing protections if current rows violate an invariant.
-- The migration runner applies this file transactionally, so the guard is not
-- retained when the INSERT fails.
CREATE TABLE "_DataInvariantsGuard" (
  "valid" INTEGER NOT NULL CHECK ("valid" = 1)
);

INSERT INTO "_DataInvariantsGuard" ("valid")
SELECT CASE WHEN
  EXISTS (SELECT 1 FROM "Rating" WHERE
    typeof("value") NOT IN ('integer', 'real') OR "value" < 0.5 OR "value" > 5 OR
    abs(("value" * 2) - round("value" * 2)) > 0.000000001
  ) OR EXISTS (SELECT 1 FROM "Review" WHERE
    typeof("content") <> 'text' OR length(trim("content")) = 0 OR length("content") > 5000 OR
    typeof("ratingValue") NOT IN ('integer', 'real') OR "ratingValue" < 0.5 OR "ratingValue" > 5 OR
    abs(("ratingValue" * 2) - round("ratingValue" * 2)) > 0.000000001
  ) OR EXISTS (SELECT 1 FROM "DiaryLog" WHERE
    ("ratingValue" IS NOT NULL AND (
      typeof("ratingValue") NOT IN ('integer', 'real') OR "ratingValue" < 0.5 OR "ratingValue" > 5 OR
      abs(("ratingValue" * 2) - round("ratingValue" * 2)) > 0.000000001
    )) OR ("notes" IS NOT NULL AND (typeof("notes") <> 'text' OR length("notes") > 500))
  ) OR EXISTS (SELECT 1 FROM "MusicItem" WHERE "type" NOT IN ('ALBUM', 'SONG'))
    OR EXISTS (SELECT 1 FROM "FavoriteAlbum" WHERE typeof("slot") <> 'integer' OR "slot" NOT BETWEEN 1 AND 3)
    OR EXISTS (SELECT 1 FROM "MusicEvent" WHERE
      typeof("dateMonth") <> 'integer' OR "dateMonth" NOT BETWEEN 1 AND 12 OR
      typeof("dateDay") <> 'integer' OR "dateDay" NOT BETWEEN 1 AND 31
    )
  THEN 0 ELSE 1 END;

DROP TABLE "_DataInvariantsGuard";

CREATE TRIGGER "Rating_validate_insert"
BEFORE INSERT ON "Rating"
FOR EACH ROW WHEN
  typeof(NEW."value") NOT IN ('integer', 'real') OR
  NEW."value" < 0.5 OR NEW."value" > 5 OR
  abs((NEW."value" * 2) - round(NEW."value" * 2)) > 0.000000001
BEGIN
  SELECT RAISE(ABORT, 'Rating.value must be 0.5..5 in 0.5 steps');
END;

CREATE TRIGGER "Rating_validate_update"
BEFORE UPDATE OF "value" ON "Rating"
FOR EACH ROW WHEN
  typeof(NEW."value") NOT IN ('integer', 'real') OR
  NEW."value" < 0.5 OR NEW."value" > 5 OR
  abs((NEW."value" * 2) - round(NEW."value" * 2)) > 0.000000001
BEGIN
  SELECT RAISE(ABORT, 'Rating.value must be 0.5..5 in 0.5 steps');
END;

CREATE TRIGGER "Review_validate_insert"
BEFORE INSERT ON "Review"
FOR EACH ROW WHEN
  length(trim(NEW."content")) = 0 OR length(NEW."content") > 5000 OR
  typeof(NEW."ratingValue") NOT IN ('integer', 'real') OR
  NEW."ratingValue" < 0.5 OR NEW."ratingValue" > 5 OR
  abs((NEW."ratingValue" * 2) - round(NEW."ratingValue" * 2)) > 0.000000001
BEGIN
  SELECT RAISE(ABORT, 'Review content or ratingValue is invalid');
END;

CREATE TRIGGER "Review_validate_update"
BEFORE UPDATE OF "content", "ratingValue" ON "Review"
FOR EACH ROW WHEN
  length(trim(NEW."content")) = 0 OR length(NEW."content") > 5000 OR
  typeof(NEW."ratingValue") NOT IN ('integer', 'real') OR
  NEW."ratingValue" < 0.5 OR NEW."ratingValue" > 5 OR
  abs((NEW."ratingValue" * 2) - round(NEW."ratingValue" * 2)) > 0.000000001
BEGIN
  SELECT RAISE(ABORT, 'Review content or ratingValue is invalid');
END;

CREATE TRIGGER "DiaryLog_validate_insert"
BEFORE INSERT ON "DiaryLog"
FOR EACH ROW WHEN
  (NEW."ratingValue" IS NOT NULL AND (
    typeof(NEW."ratingValue") NOT IN ('integer', 'real') OR
    NEW."ratingValue" < 0.5 OR NEW."ratingValue" > 5 OR
    abs((NEW."ratingValue" * 2) - round(NEW."ratingValue" * 2)) > 0.000000001
  )) OR
  (NEW."notes" IS NOT NULL AND length(NEW."notes") > 500)
BEGIN
  SELECT RAISE(ABORT, 'DiaryLog ratingValue or notes is invalid');
END;

CREATE TRIGGER "DiaryLog_validate_update"
BEFORE UPDATE OF "ratingValue", "notes" ON "DiaryLog"
FOR EACH ROW WHEN
  (NEW."ratingValue" IS NOT NULL AND (
    typeof(NEW."ratingValue") NOT IN ('integer', 'real') OR
    NEW."ratingValue" < 0.5 OR NEW."ratingValue" > 5 OR
    abs((NEW."ratingValue" * 2) - round(NEW."ratingValue" * 2)) > 0.000000001
  )) OR
  (NEW."notes" IS NOT NULL AND length(NEW."notes") > 500)
BEGIN
  SELECT RAISE(ABORT, 'DiaryLog ratingValue or notes is invalid');
END;

CREATE TRIGGER "MusicItem_validate_insert"
BEFORE INSERT ON "MusicItem"
FOR EACH ROW WHEN NEW."type" NOT IN ('ALBUM', 'SONG')
BEGIN
  SELECT RAISE(ABORT, 'MusicItem.type must be ALBUM or SONG');
END;

CREATE TRIGGER "MusicItem_validate_update"
BEFORE UPDATE OF "type" ON "MusicItem"
FOR EACH ROW WHEN NEW."type" NOT IN ('ALBUM', 'SONG')
BEGIN
  SELECT RAISE(ABORT, 'MusicItem.type must be ALBUM or SONG');
END;

CREATE TRIGGER "FavoriteAlbum_validate_insert"
BEFORE INSERT ON "FavoriteAlbum"
FOR EACH ROW WHEN typeof(NEW."slot") <> 'integer' OR NEW."slot" NOT BETWEEN 1 AND 3
BEGIN
  SELECT RAISE(ABORT, 'FavoriteAlbum.slot must be 1, 2, or 3');
END;

CREATE TRIGGER "FavoriteAlbum_validate_update"
BEFORE UPDATE OF "slot" ON "FavoriteAlbum"
FOR EACH ROW WHEN typeof(NEW."slot") <> 'integer' OR NEW."slot" NOT BETWEEN 1 AND 3
BEGIN
  SELECT RAISE(ABORT, 'FavoriteAlbum.slot must be 1, 2, or 3');
END;

CREATE TRIGGER "MusicEvent_validate_insert"
BEFORE INSERT ON "MusicEvent"
FOR EACH ROW WHEN
  typeof(NEW."dateMonth") <> 'integer' OR NEW."dateMonth" NOT BETWEEN 1 AND 12 OR
  typeof(NEW."dateDay") <> 'integer' OR NEW."dateDay" NOT BETWEEN 1 AND 31
BEGIN
  SELECT RAISE(ABORT, 'MusicEvent dateMonth/dateDay is outside calendar bounds');
END;

CREATE TRIGGER "MusicEvent_validate_update"
BEFORE UPDATE OF "dateMonth", "dateDay" ON "MusicEvent"
FOR EACH ROW WHEN
  typeof(NEW."dateMonth") <> 'integer' OR NEW."dateMonth" NOT BETWEEN 1 AND 12 OR
  typeof(NEW."dateDay") <> 'integer' OR NEW."dateDay" NOT BETWEEN 1 AND 31
BEGIN
  SELECT RAISE(ABORT, 'MusicEvent dateMonth/dateDay is outside calendar bounds');
END;
