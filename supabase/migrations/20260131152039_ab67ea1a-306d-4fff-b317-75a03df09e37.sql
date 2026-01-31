-- Add new status value to request_status enum
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'handled_not_sent';