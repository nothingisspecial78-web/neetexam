DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Self-heal: a signed-in user without a profile row gets one (fixes "couldn't load your account").
CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u auth.users%ROWTYPE;
BEGIN
  SELECT * INTO u FROM auth.users WHERE id = auth.uid();
  IF u.id IS NULL THEN RETURN; END IF;
  INSERT INTO public.profiles(id, display_name)
  VALUES (u.id, COALESCE(NULLIF(btrim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.ensure_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;

INSERT INTO public.profiles(id, display_name)
SELECT u.id, COALESCE(NULLIF(btrim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1))
FROM auth.users u ON CONFLICT (id) DO NOTHING;

-- Activity log written automatically by the database (clients cannot write it).
CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'profiles' THEN
    INSERT INTO activity_log(user_id, event_type) VALUES (NEW.id, 'sign_up');
  ELSIF TG_TABLE_NAME = 'uploads' THEN
    INSERT INTO activity_log(user_id, event_type, details) VALUES (NEW.user_id, 'file_upload', jsonb_build_object('file', NEW.file_name));
  ELSIF TG_TABLE_NAME = 'friendships' THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO activity_log(user_id, event_type) VALUES (NEW.requester_id, 'friend_request_sent');
    ELSIF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
      INSERT INTO activity_log(user_id, event_type) VALUES (NEW.addressee_id, 'friend_request_accepted');
    END IF;
  ELSIF TG_TABLE_NAME = 'matches' THEN
    IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
      INSERT INTO activity_log(user_id, event_type, details) VALUES (NEW.player_a, 'match_started', jsonb_build_object('match', NEW.id, 'kind', NEW.kind));
    ELSIF NEW.status = 'finished' AND OLD.status IS DISTINCT FROM 'finished' THEN
      INSERT INTO activity_log(user_id, event_type, details) VALUES (NEW.player_a, 'match_finished', jsonb_build_object('match', NEW.id, 'points', NEW.points));
    END IF;
  ELSIF TG_TABLE_NAME = 'questions' THEN
    IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
      INSERT INTO activity_log(user_id, event_type, details)
      SELECT NEW.owner_id, 'questions_published', jsonb_build_object('upload', NEW.upload_id)
      WHERE NOT EXISTS (SELECT 1 FROM activity_log a WHERE a.user_id = NEW.owner_id AND a.event_type = 'questions_published'
        AND a.details->>'upload' = NEW.upload_id::text AND a.created_at > now() - interval '1 minute');
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.log_activity() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER log_profiles AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER log_uploads AFTER INSERT ON public.uploads FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER log_friendships AFTER INSERT OR UPDATE ON public.friendships FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER log_matches AFTER INSERT OR UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER log_questions AFTER UPDATE OF status ON public.questions FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE INDEX IF NOT EXISTS activity_log_created_idx ON public.activity_log(created_at DESC);