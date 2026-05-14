DELETE FROM `pending_codes`
WHERE rowid NOT IN (
    SELECT MIN(rowid)
    FROM `pending_codes`
    GROUP BY `code`
);
CREATE UNIQUE INDEX `pending_codes_code_unique` ON `pending_codes` (`code`);
