-- AI Chat Sessions
-- Stores Bacain conversation history per user per book

CREATE TABLE IF NOT EXISTS ai_chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id VARCHAR NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One session per user per book
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_chats_user_book ON ai_chats(user_id, book_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_ai_chats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_chats_updated_at ON ai_chats;
CREATE TRIGGER trg_ai_chats_updated_at
  BEFORE UPDATE ON ai_chats
  FOR EACH ROW EXECUTE FUNCTION update_ai_chats_updated_at();
