-- Migration: indexes for fine-tuning dataset export queries
-- metadata jsonb already supports all new fields (system_prompt_hash, tokens_input, etc.)

CREATE INDEX IF NOT EXISTS idx_chat_messages_model ON aura_chat_messages(model);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON aura_chat_messages(created_at);
