-- Migration 001: Add fine-tuning fields to chat_messages
-- These columns enrich conversation data for future model fine-tuning.
-- All new columns are nullable to avoid breaking existing data.

alter table public.aura_chat_messages
  add column if not exists provider text default null;

alter table public.aura_chat_messages
  add column if not exists response_time_ms integer default null;

alter table public.aura_chat_messages
  add column if not exists tokens_used jsonb default null;

alter table public.aura_chat_messages
  add column if not exists behavior_mode text default null;

alter table public.aura_chat_messages
  add column if not exists risk_score integer default null;

alter table public.aura_chat_messages
  add column if not exists action_taken jsonb default null;

alter table public.aura_chat_messages
  add column if not exists user_satisfaction float default null;

comment on column public.aura_chat_messages.provider is 'LLM provider used: ollama, anthropic, openai';
comment on column public.aura_chat_messages.response_time_ms is 'Response generation time in milliseconds';
comment on column public.aura_chat_messages.tokens_used is 'Token usage: {"input": N, "output": N}';
comment on column public.aura_chat_messages.behavior_mode is 'Active behavior mode during this message';
comment on column public.aura_chat_messages.risk_score is 'Risk score if an action was proposed (1-5)';
comment on column public.aura_chat_messages.action_taken is 'Action details if a tool was executed';
comment on column public.aura_chat_messages.user_satisfaction is 'User satisfaction score (null until feedback implemented)';
