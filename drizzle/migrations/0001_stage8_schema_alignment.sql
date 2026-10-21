-- Server-only tables: students can only read (via RLS), never write.
REVOKE INSERT, UPDATE, DELETE ON public.activity_log, public.credit_history, public.matches FROM authenticated, anon;
REVOKE ALL ON public.activity_log FROM authenticated, anon;

-- Credit ledger: which match and why (spec: match_id, reason).
ALTER TABLE public.credit_history ADD COLUMN IF NOT EXISTS match_id uuid, ADD COLUMN IF NOT EXISTS reason text;
UPDATE public.credit_history SET reason = CASE WHEN change IS NULL THEN 'arena_join' ELSE 'match' END WHERE reason IS NULL;

CREATE OR REPLACE FUNCTION public.record_credit_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE mid uuid := nullif(current_setting('app.match_id', true), '')::uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.credit_history(owner_id, balance, reason) VALUES (NEW.id, coalesce(NEW.credits, 0), 'arena_join');
  ELSIF NEW.credits IS DISTINCT FROM OLD.credits THEN
    INSERT INTO public.credit_history(owner_id, balance, change, match_id, reason)
    VALUES (NEW.id, coalesce(NEW.credits, 0), coalesce(NEW.credits, 0) - coalesce(OLD.credits, 0), mid,
            CASE WHEN OLD.credits IS NULL THEN 'arena_join' WHEN mid IS NOT NULL THEN 'match' ELSE 'adjustment' END);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.settle_match(_id uuid, _winner uuid, _points integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE m public.matches; loser uuid; pts integer := 0;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = _id FOR UPDATE;
  IF m.id IS NULL OR m.status <> 'active' OR now() < m.ends_at + interval '2 seconds' THEN RETURN false; END IF;
  PERFORM set_config('app.match_id', _id::text, true); -- ledger rows get this match id
  IF _winner IS NOT NULL THEN
    IF _winner NOT IN (m.player_a, m.player_b) THEN RAISE EXCEPTION 'bad winner'; END IF;
    loser := CASE WHEN _winner = m.player_a THEN m.player_b ELSE m.player_a END;
    SELECT LEAST(GREATEST(coalesce(_points, 0), 0), GREATEST(coalesce(credits, 0), 0)) INTO pts
      FROM public.profiles WHERE id = loser FOR UPDATE;
    pts := coalesce(pts, 0);
    UPDATE public.profiles SET credits = coalesce(credits, 0) - pts WHERE id = loser;
    UPDATE public.profiles SET credits = coalesce(credits, 0) + pts WHERE id = _winner;
  END IF;
  UPDATE public.matches SET status = 'finished', winner_id = _winner, points = pts WHERE id = _id;
  PERFORM set_config('app.match_id', '', true);
  RETURN true;
END $$;
CREATE INDEX IF NOT EXISTS credit_history_match_idx ON public.credit_history(match_id);

-- Friendships: when the request was answered.
ALTER TABLE public.friendships ADD COLUMN IF NOT EXISTS responded_at timestamptz;
CREATE OR REPLACE FUNCTION public.stamp_friend_response()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND OLD.status = 'pending' THEN NEW.responded_at := now(); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS friendships_responded ON public.friendships;
CREATE TRIGGER friendships_responded BEFORE UPDATE ON public.friendships FOR EACH ROW EXECUTE FUNCTION public.stamp_friend_response();

-- Spec index on answers(user, date) exists as answers_owner_date_idx; add pair index for friendships lookups.
CREATE INDEX IF NOT EXISTS friendships_requester_addressee ON public.friendships(requester_id, addressee_id);