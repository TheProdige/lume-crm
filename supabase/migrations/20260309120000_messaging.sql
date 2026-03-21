-- ============================================================
-- Two-way SMS Messaging: conversations + messages tables
-- ============================================================

-- Conversations table (one per client phone number)
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  phone_number text NOT NULL,            -- E.164 format
  client_name text,                      -- denormalized for quick display
  last_message_text text,
  last_message_at timestamptz DEFAULT now(),
  unread_count integer DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_conversations_org ON public.conversations(org_id);
CREATE INDEX idx_conversations_phone ON public.conversations(phone_number);
CREATE INDEX idx_conversations_client ON public.conversations(client_id);
CREATE INDEX idx_conversations_last_msg ON public.conversations(last_message_at DESC);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  message_text text NOT NULL,
  status text DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'received')),
  provider_message_id text,              -- Twilio MessageSid
  sender_user_id uuid,                   -- which CRM user sent it (outbound only)
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at);
CREATE INDEX idx_messages_org ON public.messages(org_id);
CREATE INDEX idx_messages_provider ON public.messages(provider_message_id);

-- RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_auth ON public.conversations
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY messages_auth ON public.messages
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Trigger to update conversation on new message
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS trigger AS $$
BEGIN
  UPDATE public.conversations
  SET
    last_message_text = NEW.message_text,
    last_message_at = NEW.created_at,
    unread_count = CASE
      WHEN NEW.direction = 'inbound' THEN unread_count + 1
      ELSE unread_count
    END,
    updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_message_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();
