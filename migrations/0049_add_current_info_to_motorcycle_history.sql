-- Add current plate number and owner name to motorcycle_history table
-- These fields store the motorcycle's plate number and owner name at the time of the change

ALTER TABLE motorcycle_history ADD COLUMN current_plate_number TEXT;
ALTER TABLE motorcycle_history ADD COLUMN current_owner_name TEXT;
