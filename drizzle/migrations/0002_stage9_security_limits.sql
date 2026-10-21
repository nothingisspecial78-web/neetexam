-- Uploads: max 20 per user per hour.
CREATE OR REPLACE FUNCTION public.limit_uploads()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM uploads WHERE user_id = NEW.user_id AND created_at > now() - interval '1 hour') >= 20 THEN
    RAISE EXCEPTION 'upload_rate_limit' USING HINT = 'Max 20 uploads per hour';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS uploads_rate_limit ON public.uploads;
CREATE TRIGGER uploads_rate_limit BEFORE INSERT ON public.uploads FOR EACH ROW EXECUTE FUNCTION public.limit_uploads();

-- Friend requests: max 20 per day and 100 pending per sender.
CREATE OR REPLACE FUNCTION public.limit_friend_requests()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'pending' AND (
       (SELECT count(*) FROM friendships WHERE requester_id = NEW.requester_id AND created_at > now() - interval '1 day') >= 20
    OR (SELECT count(*) FROM friendships WHERE requester_id = NEW.requester_id AND status = 'pending') >= 100) THEN
    RAISE EXCEPTION 'friend_rate_limit' USING HINT = 'Max 20 requests per day, 100 pending';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS friendships_rate_limit ON public.friendships;
CREATE TRIGGER friendships_rate_limit BEFORE INSERT ON public.friendships FOR EACH ROW EXECUTE FUNCTION public.limit_friend_requests();

-- Delete my account data: own rows removed, match history anonymised. The auth user is deleted afterwards by the server.
CREATE OR REPLACE FUNCTION public.delete_my_data()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  UPDATE matches SET a_name = 'محذوف' WHERE player_a = me;
  UPDATE matches SET b_name = 'محذوف' WHERE player_b = me;
  DELETE FROM answers WHERE owner_id = me;
  DELETE FROM test_results WHERE owner_id = me;
  DELETE FROM questions WHERE owner_id = me;
  DELETE FROM units WHERE owner_id = me;
  DELETE FROM uploads WHERE user_id = me;
  DELETE FROM friendships WHERE requester_id = me OR addressee_id = me;
  DELETE FROM credit_history WHERE owner_id = me;
  INSERT INTO activity_log(user_id, event_type) VALUES (me, 'account_deleted');
END $$;
REVOKE ALL ON FUNCTION public.delete_my_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_data() TO authenticated;

-- Activity log retention helper (90 days).
CREATE OR REPLACE FUNCTION public.prune_activity_log()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM activity_log WHERE created_at < now() - interval '90 days';
$$;
REVOKE ALL ON FUNCTION public.prune_activity_log() FROM PUBLIC, anon, authenticated;