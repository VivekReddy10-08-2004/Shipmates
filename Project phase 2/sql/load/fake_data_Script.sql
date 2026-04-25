USE Shipmates; -- Had to change the import from USE flashcardsdb, since it kept giving me an error otherwise - Rise
-- see if we already have users. 
SELECT user_id, email FROM Users limit 10;

-- if empty, creater a service user
INSERT into Users(email, password_hash, first_name, last_name)
VALUES ('importer@example.com', 'dummy', 'Importer', 'bot');
SELECT last_insert_id() AS creator_id;
