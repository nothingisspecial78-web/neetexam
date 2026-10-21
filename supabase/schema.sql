-- ==============================================================================
-- NEET Exam / Madras Platform - Complete Supabase Database Schema
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/itrshwmkxexqmmmxuxnm/sql/new
-- ==============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. TABLES
-- ==============================================================================

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  credits integer DEFAULT 100,
  arena_joined_at timestamptz,
  onboarded boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  last_seen_at timestamptz,
  friend_code text DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))
);

-- Uploads
CREATE TABLE IF NOT EXISTS public.uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid() NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  topic_hint text,
  status text DEFAULT 'review' NOT NULL,
  question_count integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Units
CREATE TABLE IF NOT EXISTS public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid DEFAULT auth.uid() NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  topic_area text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT units_owner_topic_unique UNIQUE (owner_id, topic_area)
);
CREATE UNIQUE INDEX IF NOT EXISTS units_owner_topic_idx ON public.units (owner_id, topic_area);

-- Questions
CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid DEFAULT auth.uid() NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  upload_id uuid REFERENCES public.uploads(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  question_text text NOT NULL,
  options jsonb NOT NULL,
  correct_index integer,
  answer_source text DEFAULT 'user' NOT NULL,
  status text DEFAULT 'draft' NOT NULL,
  ai_flag text,
  ai_suggestion jsonb,
  topic_area text,
  content_hash text NOT NULL,
  explanation text,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT questions_owner_content_hash_unique UNIQUE (owner_id, content_hash)
);
CREATE UNIQUE INDEX IF NOT EXISTS questions_owner_hash_idx ON public.questions (owner_id, content_hash);

-- Test Results
CREATE TABLE IF NOT EXISTS public.test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid DEFAULT auth.uid() NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  unit_ids uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
  total integer NOT NULL,
  correct integer NOT NULL,
  duration_s integer NOT NULL,
  mode text DEFAULT 'test' NOT NULL,
  answer_review jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Answers
CREATE TABLE IF NOT EXISTS public.answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid DEFAULT auth.uid() NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  test_result_id uuid REFERENCES public.test_results(id) ON DELETE SET NULL,
  chosen_index integer,
  is_correct boolean NOT NULL,
  time_ms integer DEFAULT 0 NOT NULL,
  mode text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Matches (Arena)
CREATE TABLE IF NOT EXISTS public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  status text NOT NULL,
  player_a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  player_b uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  a_name text,
  b_name text,
  duration_s integer DEFAULT 60 NOT NULL,
  question_ids uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  a_correct integer DEFAULT 0 NOT NULL,
  a_wrong integer DEFAULT 0 NOT NULL,
  a_last_at timestamptz,
  a_answer_at timestamptz,
  b_correct integer DEFAULT 0 NOT NULL,
  b_wrong integer DEFAULT 0 NOT NULL,
  b_last_at timestamptz,
  b_answer_at timestamptz,
  winner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  points integer DEFAULT 0 NOT NULL,
  heartbeat_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Friendships
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid DEFAULT auth.uid() NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  responded_at timestamptz,
  CONSTRAINT friendships_not_self CHECK (requester_id <> addressee_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS friendships_unique_pair ON public.friendships (
  LEAST(requester_id, addressee_id),
  GREATEST(requester_id, addressee_id)
);

-- Credit History
CREATE TABLE IF NOT EXISTS public.credit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance integer NOT NULL,
  change integer DEFAULT 0 NOT NULL,
  match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Activity Log
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- ==============================================================================
-- 2. ROW LEVEL SECURITY (RLS)
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Helper: is_friend function
CREATE OR REPLACE FUNCTION public.is_friend(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE ((requester_id = _a AND addressee_id = _b) OR (requester_id = _b AND addressee_id = _a))
      AND status = 'accepted'
  );
$$;

-- Profiles: Users can read and update their own profile
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- Uploads: Users manage their own uploads
DROP POLICY IF EXISTS "uploads_all_own" ON public.uploads;
CREATE POLICY "uploads_all_own" ON public.uploads FOR ALL USING (user_id = auth.uid());

-- Units: Own units OR friend units (accepted)
DROP POLICY IF EXISTS "units_select" ON public.units;
CREATE POLICY "units_select" ON public.units FOR SELECT USING (
  owner_id = auth.uid() OR public.is_friend(owner_id, auth.uid())
);
DROP POLICY IF EXISTS "units_modify_own" ON public.units;
CREATE POLICY "units_modify_own" ON public.units FOR ALL USING (owner_id = auth.uid());

-- Questions: Own questions OR friend active questions
DROP POLICY IF EXISTS "questions_select" ON public.questions;
CREATE POLICY "questions_select" ON public.questions FOR SELECT USING (
  owner_id = auth.uid() OR (status = 'active' AND public.is_friend(owner_id, auth.uid()))
);
DROP POLICY IF EXISTS "questions_modify_own" ON public.questions;
CREATE POLICY "questions_modify_own" ON public.questions FOR ALL USING (owner_id = auth.uid());

-- Answers & Test Results: Own only
DROP POLICY IF EXISTS "answers_own" ON public.answers;
CREATE POLICY "answers_own" ON public.answers FOR ALL USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "test_results_own" ON public.test_results;
CREATE POLICY "test_results_own" ON public.test_results FOR ALL USING (owner_id = auth.uid());

-- Friendships: Requester or addressee can read/modify
DROP POLICY IF EXISTS "friendships_select" ON public.friendships;
CREATE POLICY "friendships_select" ON public.friendships FOR SELECT USING (
  requester_id = auth.uid() OR addressee_id = auth.uid()
);
DROP POLICY IF EXISTS "friendships_insert" ON public.friendships;
CREATE POLICY "friendships_insert" ON public.friendships FOR INSERT WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "friendships_update" ON public.friendships;
CREATE POLICY "friendships_update" ON public.friendships FOR UPDATE USING (
  requester_id = auth.uid() OR addressee_id = auth.uid()
);

-- Matches: Player A or Player B can read
DROP POLICY IF EXISTS "matches_select" ON public.matches;
CREATE POLICY "matches_select" ON public.matches FOR SELECT USING (
  player_a = auth.uid() OR player_b = auth.uid() OR status = 'waiting'
);

-- Credit History: Own rows read only
DROP POLICY IF EXISTS "credit_history_select" ON public.credit_history;
CREATE POLICY "credit_history_select" ON public.credit_history FOR SELECT USING (owner_id = auth.uid());

-- Activity Log: Admin/internal only
DROP POLICY IF EXISTS "activity_log_select" ON public.activity_log;
CREATE POLICY "activity_log_select" ON public.activity_log FOR SELECT USING (user_id = auth.uid());

-- Revoke write permissions for students on server-only tables
REVOKE INSERT, UPDATE, DELETE ON public.activity_log, public.credit_history, public.matches FROM authenticated, anon;

-- ==============================================================================
-- 3. FUNCTIONS & STORED PROCEDURES (RPC)
-- ==============================================================================

-- Auth user creation hook
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, credits)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)),
    100
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure profile exists
CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u auth.users%ROWTYPE;
BEGIN
  SELECT * INTO u FROM auth.users WHERE id = auth.uid();
  IF u.id IS NULL THEN RETURN; END IF;
  INSERT INTO public.profiles(id, display_name, credits)
  VALUES (u.id, COALESCE(NULLIF(btrim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1)), 100)
  ON CONFLICT (id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.ensure_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;

-- Presence tracker
CREATE OR REPLACE FUNCTION public.touch_presence()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET last_seen_at = now() WHERE id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.touch_presence() TO authenticated;

-- Search students by name or friend code
CREATE OR REPLACE FUNCTION public.search_students(_q text)
RETURNS TABLE (
  avatar_url text,
  display_name text,
  id uuid,
  question_count bigint
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.avatar_url,
    p.display_name,
    p.id,
    COALESCE((SELECT count(*) FROM public.questions q WHERE q.owner_id = p.id AND q.status = 'active'), 0)::bigint AS question_count
  FROM public.profiles p
  WHERE p.id <> auth.uid()
    AND (
      p.display_name ILIKE '%' || _q || '%'
      OR p.friend_code ILIKE _q || '%'
    )
  LIMIT 20;
$$;
GRANT EXECUTE ON FUNCTION public.search_students(text) TO authenticated;

-- Related profiles (friends and recent match opponents)
CREATE OR REPLACE FUNCTION public.related_profiles()
RETURNS TABLE (
  avatar_url text,
  display_name text,
  id uuid,
  last_seen_at timestamptz,
  question_count bigint
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH related_ids AS (
    SELECT CASE WHEN requester_id = auth.uid() THEN addressee_id ELSE requester_id END AS uid
    FROM public.friendships
    WHERE (requester_id = auth.uid() OR addressee_id = auth.uid()) AND status = 'accepted'
    UNION
    SELECT CASE WHEN player_a = auth.uid() THEN player_b ELSE player_a END AS uid
    FROM public.matches
    WHERE (player_a = auth.uid() OR player_b = auth.uid()) AND player_b IS NOT NULL
  )
  SELECT
    p.avatar_url,
    p.display_name,
    p.id,
    p.last_seen_at,
    COALESCE((SELECT count(*) FROM public.questions q WHERE q.owner_id = p.id AND q.status = 'active'), 0)::bigint AS question_count
  FROM public.profiles p
  INNER JOIN related_ids r ON p.id = r.uid;
$$;
GRANT EXECUTE ON FUNCTION public.related_profiles() TO authenticated;

-- Dashboard Data Summary
CREATE OR REPLACE FUNCTION public.dashboard_data()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_runs jsonb;
  v_units jsonb;
  v_answers jsonb;
  v_matches jsonb;
  v_credits jsonb;
  v_arena jsonb;
  v_questions jsonb;
  my_credits int;
  my_rank int;
BEGIN
  -- Questions
  SELECT COALESCE(jsonb_agg(to_jsonb(q)), '[]'::jsonb) INTO v_questions
  FROM (
    SELECT id, unit_id, owner_id, content_hash, topic_area, created_at, status
    FROM public.questions
    WHERE owner_id = auth.uid() OR public.is_friend(owner_id, auth.uid())
    ORDER BY created_at DESC
  ) q;

  -- Units
  SELECT COALESCE(jsonb_agg(to_jsonb(u)), '[]'::jsonb) INTO v_units
  FROM (
    SELECT id, name, topic_area, owner_id
    FROM public.units
    WHERE owner_id = auth.uid() OR public.is_friend(owner_id, auth.uid())
  ) u;

  -- Answers
  SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]'::jsonb) INTO v_answers
  FROM (
    SELECT question_id, is_correct, time_ms, mode, created_at
    FROM public.answers
    WHERE owner_id = auth.uid()
    ORDER BY created_at DESC
    LIMIT 2000
  ) a;

  -- Test runs
  SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) INTO v_runs
  FROM (
    SELECT id, unit_ids, total, correct, duration_s, created_at, mode, (answer_review IS NOT NULL) as reviewable
    FROM public.test_results
    WHERE owner_id = auth.uid()
    ORDER BY created_at DESC
    LIMIT 50
  ) r;

  -- Matches
  SELECT COALESCE(jsonb_agg(to_jsonb(m)), '[]'::jsonb) INTO v_matches
  FROM (
    SELECT id, player_a, a_name, b_name, a_correct, b_correct, a_wrong, b_wrong, winner_id, points, duration_s, created_at
    FROM public.matches
    WHERE (player_a = auth.uid() OR player_b = auth.uid()) AND status = 'finished'
    ORDER BY created_at DESC
    LIMIT 50
  ) m;

  -- Credits history
  SELECT COALESCE(jsonb_agg(to_jsonb(c)), '[]'::jsonb) INTO v_credits
  FROM (
    SELECT balance, change, created_at
    FROM public.credit_history
    WHERE owner_id = auth.uid()
    ORDER BY created_at ASC
  ) c;

  -- Arena rank
  SELECT COALESCE(credits, 0) INTO my_credits FROM public.profiles WHERE id = auth.uid();
  SELECT count(*) + 1 INTO my_rank FROM public.profiles WHERE credits > my_credits;
  v_arena := jsonb_build_object('credits', COALESCE(my_credits, 0), 'rank', my_rank);

  RETURN jsonb_build_object(
    'questions', v_questions,
    'units', v_units,
    'answers', v_answers,
    'runs', v_runs,
    'matches', v_matches,
    'credits', v_credits,
    'arena', v_arena
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.dashboard_data() TO authenticated;

-- Save test run
CREATE OR REPLACE FUNCTION public.save_test_run(_answers jsonb, _duration integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  run_id uuid := gen_random_uuid();
  ans_elem jsonb;
  tot int := 0;
  corr int := 0;
  target_qid uuid;
  chosen_txt text;
  exp_txt text;
  is_corr boolean;
BEGIN
  tot := jsonb_array_length(_answers);
  FOR i IN 0..(tot - 1) LOOP
    ans_elem := _answers->i;
    chosen_txt := ans_elem->>'chosen_text';
    exp_txt := ans_elem->>'expected_correct_text';
    is_corr := (chosen_txt IS NOT NULL AND exp_txt IS NOT NULL AND chosen_txt = exp_txt);
    IF is_corr THEN corr := corr + 1; END IF;
  END LOOP;

  INSERT INTO public.test_results (id, owner_id, unit_ids, total, correct, duration_s, mode, answer_review)
  VALUES (run_id, auth.uid(), ARRAY[]::uuid[], tot, corr, _duration, 'test', _answers);

  FOR i IN 0..(tot - 1) LOOP
    ans_elem := _answers->i;
    target_qid := (ans_elem->>'question_id')::uuid;
    chosen_txt := ans_elem->>'chosen_text';
    exp_txt := ans_elem->>'expected_correct_text';
    is_corr := (chosen_txt IS NOT NULL AND exp_txt IS NOT NULL AND chosen_txt = exp_txt);

    INSERT INTO public.answers (owner_id, question_id, test_result_id, is_correct, time_ms, mode)
    VALUES (auth.uid(), target_qid, run_id, is_corr, COALESCE((ans_elem->>'time_ms')::int, 0), 'test');
  END LOOP;

  RETURN run_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.save_test_run(jsonb, integer) TO authenticated;

-- Arena Me
CREATE OR REPLACE FUNCTION public.arena_me()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  my_credits int;
  my_rank int;
  total_players int;
BEGIN
  SELECT COALESCE(credits, 0) INTO my_credits FROM public.profiles WHERE id = auth.uid();
  SELECT count(*) + 1 INTO my_rank FROM public.profiles WHERE credits > my_credits;
  SELECT count(*) INTO total_players FROM public.profiles WHERE credits IS NOT NULL;
  RETURN jsonb_build_object('credits', COALESCE(my_credits, 0), 'rank', my_rank, 'players', total_players);
END;
$$;
GRANT EXECUTE ON FUNCTION public.arena_me() TO authenticated;

-- Arena Current Match
CREATE OR REPLACE FUNCTION public.arena_current()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m record;
BEGIN
  SELECT id, kind, status, player_a, player_b, a_name, b_name, duration_s, starts_at, ends_at,
         a_correct, a_wrong, a_last_at, a_answer_at, b_correct, b_wrong, b_last_at, b_answer_at,
         winner_id, points, created_at, array_length(question_ids, 1) as total
  INTO m
  FROM public.matches
  WHERE (player_a = auth.uid() OR player_b = auth.uid())
    AND status IN ('active', 'finishing', 'waiting', 'invited')
  ORDER BY 
    CASE status
      WHEN 'active' THEN 1
      WHEN 'finishing' THEN 2
      WHEN 'invited' THEN 3
      WHEN 'waiting' THEN 4
      ELSE 5
    END ASC,
    created_at DESC
  LIMIT 1;

  IF m.id IS NULL THEN
    RETURN jsonb_build_object('now', now(), 'match', null);
  END IF;

  RETURN jsonb_build_object('now', now(), 'match', to_jsonb(m));
END;
$$;
GRANT EXECUTE ON FUNCTION public.arena_current() TO authenticated;

-- Find Opponent
CREATE OR REPLACE FUNCTION public.find_opponent()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  waiting_id uuid;
  my_name text;
  q_ids uuid[];
BEGIN
  SELECT display_name INTO my_name FROM public.profiles WHERE id = auth.uid();

  -- Clean up previous waiting matches by this user
  UPDATE public.matches
  SET status = 'cancelled'
  WHERE status = 'waiting' AND player_a = auth.uid();

  -- Cancel expired active matches
  UPDATE public.matches
  SET status = 'cancelled'
  WHERE status = 'active' AND ends_at < now() - interval '15 seconds';

  -- Cancel stale waiting matches older than 45s
  UPDATE public.matches
  SET status = 'cancelled'
  WHERE status = 'waiting' AND created_at < now() - interval '45 seconds';

  SELECT id INTO waiting_id FROM public.matches
  WHERE (player_a = auth.uid() OR player_b = auth.uid())
    AND status = 'active'
    AND ends_at >= now();
  IF waiting_id IS NOT NULL THEN
    RETURN waiting_id;
  END IF;

  SELECT id INTO waiting_id FROM public.matches
  WHERE status = 'waiting' AND player_a <> auth.uid() AND kind = 'random'
  ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;

  IF waiting_id IS NOT NULL THEN
    UPDATE public.matches
    SET player_b = auth.uid(),
        b_name = my_name,
        status = 'active',
        starts_at = now() + interval '3 seconds',
        ends_at = now() + interval '3 seconds' + interval '60 seconds'
    WHERE id = waiting_id;
    RETURN waiting_id;
  END IF;

  SELECT array_agg(sub.id) INTO q_ids FROM (
    SELECT id FROM (
      SELECT DISTINCT ON (COALESCE(content_hash, id::text)) id
      FROM public.questions
      WHERE status = 'active' AND correct_index IS NOT NULL AND jsonb_array_length(options) >= 2
      ORDER BY COALESCE(content_hash, id::text)
    ) u
    ORDER BY random()
    LIMIT 50
  ) sub;

  IF q_ids IS NULL OR array_length(q_ids, 1) < 1 THEN
    SELECT array_agg(sub2.id) INTO q_ids FROM (
      SELECT id FROM public.questions WHERE correct_index IS NOT NULL AND jsonb_array_length(options) >= 2 ORDER BY random() LIMIT 50
    ) sub2;
  END IF;

  INSERT INTO public.matches (kind, status, player_a, a_name, duration_s, question_ids)
  VALUES ('random', 'waiting', auth.uid(), my_name, 60, COALESCE(q_ids, ARRAY[]::uuid[]))
  RETURNING id INTO waiting_id;

  RETURN waiting_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.find_opponent() TO authenticated;

-- Challenge Friend
CREATE OR REPLACE FUNCTION public.challenge_friend(_friend uuid, _duration integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_id uuid;
  my_name text;
  friend_name text;
  q_ids uuid[];
BEGIN
  SELECT display_name INTO my_name FROM public.profiles WHERE id = auth.uid();
  SELECT display_name INTO friend_name FROM public.profiles WHERE id = _friend;

  SELECT array_agg(sub.id) INTO q_ids FROM (
    SELECT id FROM (
      SELECT DISTINCT ON (COALESCE(content_hash, id::text)) id
      FROM public.questions
      WHERE status = 'active' AND correct_index IS NOT NULL AND jsonb_array_length(options) >= 2
      ORDER BY COALESCE(content_hash, id::text)
    ) u
    LIMIT 50
  ) sub;

  IF q_ids IS NULL OR array_length(q_ids, 1) < 1 THEN
    SELECT array_agg(sub2.id) INTO q_ids FROM (
      SELECT id FROM public.questions WHERE correct_index IS NOT NULL AND jsonb_array_length(options) >= 2 ORDER BY random() LIMIT 50
    ) sub2;
  END IF;

  UPDATE public.matches
  SET status = 'cancelled'
  WHERE status IN ('waiting', 'invited')
    AND (player_a = auth.uid() OR player_b = auth.uid());

  INSERT INTO public.matches (kind, status, player_a, player_b, a_name, b_name, duration_s, question_ids)
  VALUES ('challenge', 'invited', auth.uid(), _friend, my_name, friend_name, COALESCE(_duration, 60), COALESCE(q_ids, ARRAY[]::uuid[]))
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.challenge_friend(uuid, integer) TO authenticated;

-- Respond Invite
CREATE OR REPLACE FUNCTION public.respond_invite(_id uuid, _accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _accept THEN
    UPDATE public.matches
    SET status = 'active',
        starts_at = now() + interval '3 seconds',
        ends_at = now() + interval '3 seconds' + (duration_s || ' seconds')::interval
    WHERE id = _id AND player_b = auth.uid() AND status IN ('waiting', 'invited');
  ELSE
    UPDATE public.matches
    SET status = 'cancelled'
    WHERE id = _id AND (player_b = auth.uid() OR player_a = auth.uid()) AND status IN ('waiting', 'invited');
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.respond_invite(uuid, boolean) TO authenticated;

-- Cancel Match
CREATE OR REPLACE FUNCTION public.cancel_match(_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.matches SET status = 'cancelled' WHERE id = _id AND (player_a = auth.uid() OR player_b = auth.uid()) AND status IN ('waiting', 'invited');
$$;
GRANT EXECUTE ON FUNCTION public.cancel_match(uuid) TO authenticated;

-- Match Question
CREATE OR REPLACE FUNCTION public.match_question(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m public.matches%ROWTYPE;
  curr_idx int;
  target_qid uuid;
  q public.questions%ROWTYPE;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = _id;
  IF m.id IS NULL THEN RETURN NULL; END IF;

  IF auth.uid() = m.player_a THEN
    curr_idx := m.a_correct + m.a_wrong;
  ELSIF auth.uid() = m.player_b THEN
    curr_idx := m.b_correct + m.b_wrong;
  ELSE
    RETURN NULL;
  END IF;

  IF curr_idx >= array_length(m.question_ids, 1) THEN
    RETURN NULL;
  END IF;

  -- Ensure valid non-corrupted question is fetched
  WHILE curr_idx < array_length(m.question_ids, 1) LOOP
    target_qid := m.question_ids[curr_idx + 1];
    SELECT * INTO q FROM public.questions WHERE id = target_qid;
    IF q.id IS NOT NULL AND q.question_text IS NOT NULL AND jsonb_array_length(q.options) >= 2 THEN
      EXIT;
    END IF;
    curr_idx := curr_idx + 1;
  END LOOP;

  IF q.id IS NULL THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'index', curr_idx,
    'question', q.question_text,
    'question_text', q.question_text,
    'options', q.options
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.match_question(uuid) TO authenticated;

-- Answer Match
CREATE OR REPLACE FUNCTION public.answer_match(_id uuid, _index integer, _choice integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m public.matches%ROWTYPE;
  target_qid uuid;
  q public.questions%ROWTYPE;
  is_ok boolean;
  next_data jsonb;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = _id FOR UPDATE;
  IF m.id IS NULL OR m.status <> 'active' THEN
    RAISE EXCEPTION 'المباراة غير نشطة';
  END IF;

  IF _index >= array_length(m.question_ids, 1) THEN
    RETURN jsonb_build_object('correct', false, 'correct_index', null, 'next', null);
  END IF;

  target_qid := m.question_ids[_index + 1];
  SELECT * INTO q FROM public.questions WHERE id = target_qid;
  is_ok := (q.correct_index = _choice);

  IF auth.uid() = m.player_a THEN
    IF is_ok THEN
      UPDATE public.matches SET a_correct = a_correct + 1, a_last_at = now() WHERE id = _id;
    ELSE
      UPDATE public.matches SET a_wrong = a_wrong + 1, a_last_at = now() WHERE id = _id;
    END IF;
  ELSIF auth.uid() = m.player_b THEN
    IF is_ok THEN
      UPDATE public.matches SET b_correct = b_correct + 1, b_last_at = now() WHERE id = _id;
    ELSE
      UPDATE public.matches SET b_wrong = b_wrong + 1, b_last_at = now() WHERE id = _id;
    END IF;
  END IF;

  next_data := public.match_question(_id);

  RETURN jsonb_build_object(
    'correct', is_ok,
    'correct_index', q.correct_index,
    'next', next_data
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.answer_match(uuid, integer, integer) TO authenticated;

-- Settle Match (Service role only)
CREATE OR REPLACE FUNCTION public.settle_match(_id uuid, _winner uuid, _points integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.matches; loser uuid; pts integer := 0;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = _id FOR UPDATE;
  IF m.id IS NULL OR m.status <> 'active' OR now() < m.ends_at + interval '2 seconds' THEN RETURN false; END IF;
  PERFORM set_config('app.match_id', _id::text, true);
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
REVOKE ALL ON FUNCTION public.settle_match(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;

-- Delete my data
CREATE OR REPLACE FUNCTION public.delete_my_data()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  UPDATE public.matches SET a_name = 'محذوف' WHERE player_a = me;
  UPDATE public.matches SET b_name = 'محذوف' WHERE player_b = me;
  DELETE FROM public.answers WHERE owner_id = me;
  DELETE FROM public.test_results WHERE owner_id = me;
  DELETE FROM public.questions WHERE owner_id = me;
  DELETE FROM public.units WHERE owner_id = me;
  DELETE FROM public.uploads WHERE user_id = me;
  DELETE FROM public.friendships WHERE requester_id = me OR addressee_id = me;
  DELETE FROM public.credit_history WHERE owner_id = me;
  INSERT INTO public.activity_log(user_id, event_type) VALUES (me, 'account_deleted');
END $$;
GRANT EXECUTE ON FUNCTION public.delete_my_data() TO authenticated;

-- Prune activity log (90 days)
CREATE OR REPLACE FUNCTION public.prune_activity_log()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.activity_log WHERE created_at < now() - interval '90 days';
$$;

-- Auto-assign unit to question
CREATE OR REPLACE FUNCTION public.assign_question_unit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  u_id uuid;
  topic text := COALESCE(NULLIF(btrim(NEW.topic_area), ''), 'عام');
BEGIN
  IF NEW.status = 'active' AND NEW.unit_id IS NULL THEN
    SELECT id INTO u_id FROM public.units WHERE owner_id = NEW.owner_id AND topic_area = topic LIMIT 1;
    IF u_id IS NULL THEN
      INSERT INTO public.units (owner_id, name, topic_area)
      VALUES (NEW.owner_id, topic, topic)
      RETURNING id INTO u_id;
    END IF;
    NEW.unit_id := u_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tr_assign_question_unit ON public.questions;
CREATE TRIGGER tr_assign_question_unit BEFORE INSERT OR UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.assign_question_unit();

-- Rate limits
CREATE OR REPLACE FUNCTION public.limit_uploads()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.uploads WHERE user_id = NEW.user_id AND created_at > now() - interval '1 hour') >= 20 THEN
    RAISE EXCEPTION 'upload_rate_limit' USING HINT = 'Max 20 uploads per hour';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS uploads_rate_limit ON public.uploads;
CREATE TRIGGER uploads_rate_limit BEFORE INSERT ON public.uploads FOR EACH ROW EXECUTE FUNCTION public.limit_uploads();

CREATE OR REPLACE FUNCTION public.limit_friend_requests()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'pending' AND (
       (SELECT count(*) FROM public.friendships WHERE requester_id = NEW.requester_id AND created_at > now() - interval '1 day') >= 20
    OR (SELECT count(*) FROM public.friendships WHERE requester_id = NEW.requester_id AND status = 'pending') >= 100) THEN
    RAISE EXCEPTION 'friend_rate_limit' USING HINT = 'Max 20 requests per day, 100 pending';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS friendships_rate_limit ON public.friendships;
CREATE TRIGGER friendships_rate_limit BEFORE INSERT ON public.friendships FOR EACH ROW EXECUTE FUNCTION public.limit_friend_requests();

-- Credit change logger
CREATE OR REPLACE FUNCTION public.record_credit_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
DROP TRIGGER IF EXISTS tr_record_credit_change ON public.profiles;
CREATE TRIGGER tr_record_credit_change AFTER INSERT OR UPDATE OF credits ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.record_credit_change();

-- Friend response timestamp
CREATE OR REPLACE FUNCTION public.stamp_friend_response()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND OLD.status = 'pending' THEN NEW.responded_at := now(); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS friendships_responded ON public.friendships;
CREATE TRIGGER friendships_responded BEFORE UPDATE ON public.friendships FOR EACH ROW EXECUTE FUNCTION public.stamp_friend_response();

-- Idempotent constraint additions for existing tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'questions_owner_content_hash_unique'
  ) THEN
    ALTER TABLE public.questions ADD CONSTRAINT questions_owner_content_hash_unique UNIQUE (owner_id, content_hash);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'units_owner_topic_unique'
  ) THEN
    ALTER TABLE public.units ADD CONSTRAINT units_owner_topic_unique UNIQUE (owner_id, topic_area);
  END IF;
END $$;

