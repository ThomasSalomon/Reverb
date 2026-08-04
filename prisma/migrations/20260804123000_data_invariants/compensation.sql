-- Schema-only compensation for RTM-DATA-008. It does not change data.
DROP TRIGGER "MusicEvent_validate_update";
DROP TRIGGER "MusicEvent_validate_insert";
DROP TRIGGER "FavoriteAlbum_validate_update";
DROP TRIGGER "FavoriteAlbum_validate_insert";
DROP TRIGGER "MusicItem_validate_update";
DROP TRIGGER "MusicItem_validate_insert";
DROP TRIGGER "DiaryLog_validate_update";
DROP TRIGGER "DiaryLog_validate_insert";
DROP TRIGGER "Review_validate_update";
DROP TRIGGER "Review_validate_insert";
DROP TRIGGER "Rating_validate_update";
DROP TRIGGER "Rating_validate_insert";
