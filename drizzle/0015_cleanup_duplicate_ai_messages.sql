-- Migration: Cleanup duplicate AI messages
-- This removes duplicate messages based on segmentId in contextMetadata
-- Keeps the oldest message for each unique (sessionId, segmentId) pair

-- Step 1: Identify and remove duplicate messages based on segmentId
-- For messages that have a segmentId in contextMetadata, keep only the oldest one
DELETE FROM ai_messages
WHERE id NOT IN (
    SELECT MIN(id)
    FROM ai_messages
    WHERE context_metadata IS NOT NULL
      AND json_extract(context_metadata, '$.segmentId') IS NOT NULL
    GROUP BY
        session_id,
        json_extract(context_metadata, '$.segmentId')
)
AND context_metadata IS NOT NULL
AND json_extract(context_metadata, '$.segmentId') IS NOT NULL;

-- Step 2: Create an index to improve query performance
-- This doesn't enforce uniqueness but helps with deduplication queries
CREATE INDEX IF NOT EXISTS idx_ai_messages_session_segment
ON ai_messages (session_id);

-- Note: We can't create a unique constraint on JSON-extracted values in SQLite
-- The deduplication is handled at the application level in:
-- - src/routes/api/ai/chat/+server.ts (completedSegmentsMap)
-- - src/lib/components/ai/AiChatWorkspace.svelte (loadMessages filter)
