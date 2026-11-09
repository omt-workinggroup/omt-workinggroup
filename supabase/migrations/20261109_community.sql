-- OMT Student Community 2.0: accounts, lounge, Q&A, projects, opportunities, events, challenges, XP,
-- reports and moderation. Tables live in the private "community" schema, which the REST API does not
-- expose. Every read and write goes through the SECURITY DEFINER functions below, which check the
-- signed-in user (auth.uid()), their role, rate limits and moderation rules. Nothing existing is changed.

create schema if not exists community;
revoke all on schema community from public, anon, authenticated;

-- ---------- Tables ----------
create table if not exists community.settings (key text primary key, value jsonb not null);
insert into community.settings values
  ('premoderate_posts', 'true'), ('premoderate_comments', 'false'),
  ('owner_emails', '["missolu.adeoye@gmail.com"]'),
  ('blocked_words', '["fuck","shit","bitch","cunt","nigger","faggot","retard","porn","nude","nudes","onlyfans","kill yourself","kys"]')
on conflict (key) do nothing;

create table if not exists community.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text not null check (handle ~ '^[A-Za-z0-9_]{3,24}$'),
  display_name text check (char_length(display_name) <= 40),
  bio text check (char_length(bio) <= 280),
  level text check (char_length(level) <= 60),
  interests text[] not null default '{}',
  goals text[] not null default '{}',
  public_profile boolean not null default false,
  on_leaderboard boolean not null default false,
  digest_opt_in boolean not null default false,
  role text not null default 'student' check (role in ('student','contributor','editor','moderator','admin','super_admin')),
  status text not null default 'active' check (status in ('active','suspended')),
  xp int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_handle_key on community.profiles (lower(handle));

create table if not exists community.posts (
  id bigint generated always as identity primary key,
  author uuid not null references community.profiles(id) on delete cascade,
  kind text not null check (kind in ('post','question','project')),
  category text not null check (char_length(category) <= 40),
  title text not null check (char_length(title) between 5 and 140),
  body text not null check (char_length(body) between 10 and 5000),
  tags text[] not null default '{}',
  stack text[] not null default '{}',
  demo_url text check (demo_url ~ '^https://[^\s]{3,300}$'),
  repo_url text check (repo_url ~ '^https://[^\s]{3,300}$'),
  beginner boolean not null default false,
  featured boolean not null default false,
  status text not null default 'pending' check (status in ('pending','published','hidden','removed')),
  accepted_comment bigint,
  likes int not null default 0,
  comments_count int not null default 0,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  search tsvector generated always as (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))) stored
);
create index if not exists posts_feed_idx on community.posts (kind, status, published_at desc);
create index if not exists posts_author_idx on community.posts (author, created_at desc);
create index if not exists posts_search_idx on community.posts using gin (search);

create table if not exists community.comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references community.posts(id) on delete cascade,
  author uuid not null references community.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 2 and 3000),
  status text not null default 'published' check (status in ('pending','published','hidden','removed')),
  votes int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on community.comments (post_id, created_at);

create table if not exists community.likes (post_id bigint references community.posts(id) on delete cascade, user_id uuid references community.profiles(id) on delete cascade, created_at timestamptz not null default now(), primary key (post_id, user_id));
create table if not exists community.votes (comment_id bigint references community.comments(id) on delete cascade, user_id uuid references community.profiles(id) on delete cascade, primary key (comment_id, user_id));
create table if not exists community.bookmarks (post_id bigint references community.posts(id) on delete cascade, user_id uuid references community.profiles(id) on delete cascade, created_at timestamptz not null default now(), primary key (post_id, user_id));
create table if not exists community.blocks (user_id uuid references community.profiles(id) on delete cascade, blocked_id uuid references community.profiles(id) on delete cascade, primary key (user_id, blocked_id));

create table if not exists community.reports (
  id bigint generated always as identity primary key,
  reporter uuid not null references community.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post','comment','user')),
  target_id text not null check (char_length(target_id) <= 64),
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  created_at timestamptz not null default now(),
  resolved_by uuid, resolved_at timestamptz,
  unique (reporter, target_type, target_id)
);

create table if not exists community.opportunities (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 3 and 160),
  organisation text not null check (char_length(organisation) between 2 and 120),
  description text not null check (char_length(description) between 10 and 1500),
  eligibility text check (char_length(eligibility) <= 600),
  location text check (char_length(location) <= 120),
  category text not null check (category in ('scholarship','internship','competition','hackathon','certification','training','volunteering','ambassador','mentorship','workshop')),
  regions text[] not null default '{}',
  audience text[] not null default '{}',
  fields text[] not null default '{}',
  deadline date,
  apply_url text not null check (apply_url ~ '^https://[^\s]{3,400}$'),
  verified boolean not null default false,
  last_checked date,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid, created_at timestamptz not null default now()
);

create table if not exists community.events (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 3 and 160),
  description text not null check (char_length(description) between 10 and 1500),
  category text not null check (category in ('workshop','webinar','conference','coding','competition','hackathon','programme','meetup')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null default 'UTC' check (char_length(timezone) <= 60),
  online boolean not null default true,
  location text check (char_length(location) <= 160),
  register_url text check (register_url ~ '^https://[^\s]{3,400}$'),
  organiser text not null check (char_length(organiser) between 2 and 120),
  reg_deadline date,
  verified boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid, created_at timestamptz not null default now()
);
create table if not exists community.event_saves (event_id bigint references community.events(id) on delete cascade, user_id uuid references community.profiles(id) on delete cascade, primary key (event_id, user_id));

create table if not exists community.challenges (
  id text primary key,
  topic text not null,
  difficulty text not null check (difficulty in ('beginner','intermediate','advanced')),
  weekly boolean not null default false,
  question text not null,
  options text[] not null,
  answer int not null,
  explanation text not null
);
create table if not exists community.challenge_attempts (
  user_id uuid references community.profiles(id) on delete cascade,
  challenge_id text references community.challenges(id) on delete cascade,
  choice int not null, correct boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_id, challenge_id)
);

create table if not exists community.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references community.profiles(id) on delete cascade,
  reason text not null, ref text not null, points int not null,
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref)
);

create table if not exists community.audit_log (
  id bigint generated always as identity primary key,
  actor uuid, action text not null, target_type text, target_id text, detail jsonb,
  created_at timestamptz not null default now()
);

alter table community.settings enable row level security;
alter table community.profiles enable row level security;
alter table community.posts enable row level security;
alter table community.comments enable row level security;
alter table community.likes enable row level security;
alter table community.votes enable row level security;
alter table community.bookmarks enable row level security;
alter table community.blocks enable row level security;
alter table community.reports enable row level security;
alter table community.opportunities enable row level security;
alter table community.events enable row level security;
alter table community.event_saves enable row level security;
alter table community.challenges enable row level security;
alter table community.challenge_attempts enable row level security;
alter table community.xp_events enable row level security;
alter table community.audit_log enable row level security;

-- ---------- Helpers (not callable from the API) ----------
create or replace function community.role_rank(p_role text) returns int language sql immutable set search_path = '' as $$
  select case p_role when 'student' then 0 when 'contributor' then 1 when 'editor' then 2 when 'moderator' then 3 when 'admin' then 4 when 'super_admin' then 5 else -1 end;
$$;

-- The caller's active profile, or an error.
create or replace function community.me() returns community.profiles language plpgsql stable security definer set search_path = '' as $$
declare r community.profiles;
begin
  select * into r from community.profiles where id = auth.uid();
  if r.id is null then raise exception 'not_signed_in' using errcode = 'P0001'; end if;
  if r.status <> 'active' then raise exception 'suspended' using errcode = 'P0001'; end if;
  return r;
end $$;

create or replace function community.require_role(p_min text) returns community.profiles language plpgsql stable security definer set search_path = '' as $$
declare r community.profiles := community.me();
begin
  if community.role_rank(r.role) < community.role_rank(p_min) then raise exception 'forbidden' using errcode = 'P0001'; end if;
  return r;
end $$;

create or replace function community.setting(p_key text) returns jsonb language sql stable security definer set search_path = '' as $$
  select value from community.settings where key = p_key;
$$;

-- Rejects text with blocked words (whole words, case-insensitive).
create or replace function community.check_text(p_text text) returns void language plpgsql stable security definer set search_path = '' as $$
declare w text;
begin
  for w in select jsonb_array_elements_text(community.setting('blocked_words')) loop
    if lower(p_text) ~ ('(^|[^a-z])' || w || '([^a-z]|$)') then raise exception 'blocked_words' using errcode = 'P0001'; end if;
  end loop;
  if (select count(*) from regexp_matches(p_text, 'https?://', 'g')) > 5 then raise exception 'too_many_links' using errcode = 'P0001'; end if;
end $$;

create or replace function community.award(p_user uuid, p_reason text, p_ref text, p_points int) returns boolean language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into community.xp_events (user_id, reason, ref, points) values (p_user, p_reason, p_ref, p_points) on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then update community.profiles set xp = xp + p_points where id = p_user; end if;
  return n > 0;
end $$;

create or replace function community.audit(p_action text, p_type text, p_id text, p_detail jsonb default null) returns void language sql security definer set search_path = '' as $$
  insert into community.audit_log (actor, action, target_type, target_id, detail) values (auth.uid(), p_action, p_type, p_id, p_detail);
$$;

create or replace function community.clean_list(p jsonb, p_max int, p_len int) returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct v), '{}') from (
    select left(trim(x), p_len) v from jsonb_array_elements_text(coalesce(p, '[]'::jsonb)) x where trim(x) <> '' limit p_max) s;
$$;

-- A post as the feed shows it (no email, no private fields).
create or replace function community.post_json(p community.posts, p_viewer uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'kind', p.kind, 'category', p.category, 'title', p.title, 'excerpt', left(p.body, 240),
    'tags', p.tags, 'stack', p.stack, 'demo_url', p.demo_url, 'repo_url', p.repo_url, 'beginner', p.beginner, 'featured', p.featured,
    'status', p.status, 'likes', p.likes, 'comments', p.comments_count, 'accepted', p.accepted_comment is not null,
    'created_at', coalesce(p.published_at, p.created_at),
    'author', (select jsonb_build_object('handle', a.handle, 'name', coalesce(a.display_name, a.handle), 'role', a.role, 'public', a.public_profile) from community.profiles a where a.id = p.author),
    'mine', p.author = p_viewer,
    'liked', exists (select 1 from community.likes l where l.post_id = p.id and l.user_id = p_viewer),
    'bookmarked', exists (select 1 from community.bookmarks b where b.post_id = p.id and b.user_id = p_viewer));
$$;

-- ---------- Account ----------
create or replace function public.c_profile_init(p_handle text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); em text; owners jsonb; r community.profiles;
begin
  if uid is null then raise exception 'not_signed_in' using errcode = 'P0001'; end if;
  select * into r from community.profiles where id = uid;
  if r.id is null then
    if p_handle is null or p_handle !~ '^[A-Za-z0-9_]{3,24}$' then raise exception 'bad_handle' using errcode = 'P0001'; end if;
    if exists (select 1 from community.profiles where lower(handle) = lower(p_handle)) then raise exception 'handle_taken' using errcode = 'P0001'; end if;
    perform community.check_text(p_handle);
    insert into community.profiles (id, handle) values (uid, p_handle) returning * into r;
  end if;
  -- The site owner's account becomes the first super administrator, once its email is confirmed.
  select email into em from auth.users where id = uid and email_confirmed_at is not null;
  owners := community.setting('owner_emails');
  if em is not null and owners ? lower(em) and r.role <> 'super_admin'
     and not exists (select 1 from community.profiles where role = 'super_admin') then
    update community.profiles set role = 'super_admin' where id = uid returning * into r;
    perform community.audit('owner_claimed', 'user', r.handle);
  end if;
  return public.c_me();
end $$;

create or replace function public.c_me() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r community.profiles;
begin
  select * into r from community.profiles where id = auth.uid();
  if r.id is null then return null; end if;
  return jsonb_build_object('handle', r.handle, 'name', r.display_name, 'bio', r.bio, 'level', r.level, 'interests', r.interests, 'goals', r.goals,
    'public_profile', r.public_profile, 'on_leaderboard', r.on_leaderboard, 'digest_opt_in', r.digest_opt_in,
    'role', r.role, 'status', r.status, 'xp', r.xp, 'staff', community.role_rank(r.role) >= 2, 'created_at', r.created_at);
end $$;

create or replace function public.c_profile_save(p jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r community.profiles := community.me();
begin
  if coalesce(p->>'name', '') <> '' then perform community.check_text(p->>'name'); end if;
  if coalesce(p->>'bio', '') <> '' then perform community.check_text(p->>'bio'); end if;
  update community.profiles set
    display_name = case when p ? 'name' then nullif(left(trim(p->>'name'), 40), '') else display_name end,
    bio = case when p ? 'bio' then nullif(left(trim(p->>'bio'), 280), '') else bio end,
    level = case when p ? 'level' then nullif(left(p->>'level', 60), '') else level end,
    interests = case when p ? 'interests' then community.clean_list(p->'interests', 12, 40) else interests end,
    goals = case when p ? 'goals' then community.clean_list(p->'goals', 8, 60) else goals end,
    public_profile = coalesce((p->>'public_profile')::boolean, public_profile),
    on_leaderboard = coalesce((p->>'on_leaderboard')::boolean, on_leaderboard),
    digest_opt_in = coalesce((p->>'digest_opt_in')::boolean, digest_opt_in)
  where id = r.id returning * into r;
  if cardinality(r.interests) > 0 and r.level is not null then perform community.award(r.id, 'first_steps', 'profile', 5); end if;
  return public.c_me();
end $$;

create or replace function public.c_public_profile(p_handle text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r community.profiles;
begin
  select * into r from community.profiles where lower(handle) = lower(p_handle) and status = 'active';
  if r.id is null or (not r.public_profile and r.id is distinct from auth.uid()) then return null; end if;
  return jsonb_build_object('handle', r.handle, 'name', coalesce(r.display_name, r.handle), 'bio', r.bio, 'level', r.level, 'interests', r.interests, 'xp', r.xp,
    'badges', community.badges(r.id),
    'projects', coalesce((select jsonb_agg(community.post_json(p, auth.uid()) order by p.published_at desc) from community.posts p where p.author = r.id and p.kind = 'project' and p.status = 'published'), '[]'));
end $$;

-- ---------- Feed, posts and comments ----------
create or replace function public.c_feed(p jsonb) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  v_kind text := nullif(p->>'kind', ''); v_cat text := nullif(p->>'category', ''); v_sort text := coalesce(p->>'sort', 'latest');
  v_q text := nullif(trim(p->>'q'), ''); v_tag text := nullif(p->>'tag', '');
  v_limit int := least(greatest(coalesce((p->>'limit')::int, 12), 1), 30);
  v_offset int := least(greatest(coalesce((p->>'offset')::int, 0), 0), 600);
  out jsonb;
begin
  select coalesce(jsonb_agg(community.post_json(x, viewer) order by x.rk desc, x.published_at desc), '[]') into out from (
    select ps.*,
      case v_sort
        when 'trending' then (ps.likes * 2 + ps.comments_count * 3 + 1) / power(extract(epoch from now() - ps.published_at) / 3600 + 2, 1.4)
        when 'helpful' then ps.likes + ps.comments_count * 2
        when 'appreciated' then ps.likes
        else 0 end as rk
    from community.posts ps
    where ps.status = 'published'
      and (v_kind is null or ps.kind = v_kind)
      and (v_cat is null or ps.category = v_cat)
      and (v_tag is null or v_tag = any(ps.tags) or v_tag = any(ps.stack))
      and (v_q is null or ps.search @@ websearch_to_tsquery('english', v_q) or ps.title ilike '%' || v_q || '%')
      and (v_sort <> 'unanswered' or (ps.comments_count = 0 and ps.accepted_comment is null))
      and (v_sort <> 'featured' or ps.featured)
      and (v_sort <> 'beginner' or ps.beginner)
      and (v_sort <> 'trending' or ps.published_at > now() - interval '30 days')
      and (viewer is null or not exists (select 1 from community.blocks b where b.user_id = viewer and b.blocked_id = ps.author))
    order by rk desc, ps.published_at desc
    limit v_limit offset v_offset) x;
  return out;
end $$;

create or replace function public.c_post(p_id bigint) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare viewer uuid := auth.uid(); ps community.posts; staff boolean;
begin
  select * into ps from community.posts where id = p_id;
  staff := exists (select 1 from community.profiles where id = viewer and community.role_rank(role) >= 3);
  if ps.id is null then return null; end if;
  if not staff and (ps.status = 'removed' or (ps.status <> 'published' and ps.author is distinct from viewer)) then return null; end if;
  return community.post_json(ps, viewer) || jsonb_build_object('body', ps.body, 'accepted_comment', ps.accepted_comment,
    'comments', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'body', c.body, 'votes', c.votes, 'created_at', c.created_at, 'status', c.status,
        'author', (select jsonb_build_object('handle', a.handle, 'name', coalesce(a.display_name, a.handle), 'role', a.role, 'public', a.public_profile) from community.profiles a where a.id = c.author),
        'mine', c.author = viewer, 'voted', exists (select 1 from community.votes v where v.comment_id = c.id and v.user_id = viewer))
      order by (c.id = ps.accepted_comment) desc, case when ps.kind = 'question' then c.votes else 0 end desc, c.created_at)
      from community.comments c where c.post_id = ps.id and (c.status = 'published' or (c.author = viewer and c.status <> 'removed') or staff)
        and (viewer is null or not exists (select 1 from community.blocks b where b.user_id = viewer and b.blocked_id = c.author))), '[]'));
end $$;

create or replace function public.c_post_create(p jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r community.profiles := community.me();
  v_kind text := p->>'kind'; v_cat text := p->>'category'; new_id bigint; v_status text;
  allowed text[];
begin
  if v_kind is null or v_kind not in ('post','question','project') then raise exception 'bad_kind' using errcode = 'P0001'; end if;
  allowed := case v_kind
    when 'project' then array['website','mobile','design','software','robotics','data','ai','creative','hardware']
    else array['general','programming','cybersecurity','networking','ai','design','student-life','career','help','projects'] end;
  if v_cat is null or not v_cat = any(allowed) then raise exception 'bad_category' using errcode = 'P0001'; end if;
  if (select count(*) from community.posts where author = r.id and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from community.posts where author = r.id and created_at > now() - interval '1 day') >= 15 then
    raise exception 'rate_limited' using errcode = 'P0001'; end if;
  perform community.check_text(coalesce(p->>'title', '') || ' ' || coalesce(p->>'body', '') || ' ' || coalesce((p->'tags')::text, '') || ' ' || coalesce((p->'stack')::text, ''));
  v_status := case when community.role_rank(r.role) >= 1 or community.setting('premoderate_posts') = 'false'::jsonb then 'published' else 'pending' end;
  insert into community.posts (author, kind, category, title, body, tags, stack, demo_url, repo_url, beginner, status, published_at)
  values (r.id, v_kind, v_cat, trim(p->>'title'), trim(p->>'body'), community.clean_list(p->'tags', 6, 24),
    case when v_kind = 'project' then community.clean_list(p->'stack', 8, 24) else '{}' end,
    case when v_kind = 'project' then nullif(trim(p->>'demo_url'), '') end, case when v_kind = 'project' then nullif(trim(p->>'repo_url'), '') end,
    coalesce((p->>'beginner')::boolean, false), v_status, case when v_status = 'published' then now() end)
  returning id into new_id;
  if v_status = 'published' and v_kind = 'project' then perform community.award(r.id, 'project_published', new_id::text, 20); end if;
  return jsonb_build_object('id', new_id, 'status', v_status);
end $$;

create or replace function public.c_post_delete(p_id bigint) returns boolean language plpgsql security definer set search_path = '' as $$
declare r community.profiles := community.me();
begin
  update community.posts set status = 'removed' where id = p_id and author = r.id;
  return found;
end $$;

create or replace function public.c_comment_create(p_post bigint, p_body text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r community.profiles := community.me(); v_status text; new_id bigint;
begin
  if not exists (select 1 from community.posts where id = p_post and status = 'published') then raise exception 'not_found' using errcode = 'P0001'; end if;
  if (select count(*) from community.comments where author = r.id and created_at > now() - interval '1 hour') >= 30 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  perform community.check_text(p_body);
  v_status := case when community.role_rank(r.role) >= 1 or community.setting('premoderate_comments') = 'false'::jsonb then 'published' else 'pending' end;
  insert into community.comments (post_id, author, body, status) values (p_post, r.id, trim(p_body), v_status) returning id into new_id;
  if v_status = 'published' then update community.posts set comments_count = comments_count + 1 where id = p_post; end if;
  return jsonb_build_object('id', new_id, 'status', v_status);
end $$;

create or replace function public.c_comment_delete(p_id bigint) returns boolean language plpgsql security definer set search_path = '' as $$
declare r community.profiles := community.me(); v_post bigint; v_was text;
begin
  select post_id, status into v_post, v_was from community.comments where id = p_id and author = r.id;
  if v_post is null then return false; end if;
  update community.comments set status = 'removed' where id = p_id;
  if v_was = 'published' then update community.posts set comments_count = greatest(comments_count - 1, 0) where id = v_post; end if;
  return true;
end $$;

create or replace function public.c_like(p_post bigint) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r community.profiles := community.me(); n int; v_likes int;
begin
  if not exists (select 1 from community.posts where id = p_post and status = 'published') then raise exception 'not_found' using errcode = 'P0001'; end if;
  delete from community.likes where post_id = p_post and user_id = r.id; get diagnostics n = row_count;
  if n = 0 then insert into community.likes (post_id, user_id) values (p_post, r.id); end if;
  update community.posts set likes = (select count(*) from community.likes where post_id = p_post) where id = p_post returning likes into v_likes;
  return jsonb_build_object('liked', n = 0, 'likes', v_likes);
end $$;

create or replace function public.c_vote(p_comment bigint) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r community.profiles := community.me(); n int; v int;
begin
  if not exists (select 1 from community.comments where id = p_comment and status = 'published' and author <> r.id) then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  delete from community.votes where comment_id = p_comment and user_id = r.id; get diagnostics n = row_count;
  if n = 0 then insert into community.votes (comment_id, user_id) values (p_comment, r.id); end if;
  update community.comments set votes = (select count(*) from community.votes where comment_id = p_comment) where id = p_comment returning votes into v;
  return jsonb_build_object('voted', n = 0, 'votes', v);
end $$;

create or replace function public.c_bookmark(p_post bigint) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r community.profiles := community.me(); n int;
begin
  delete from community.bookmarks where post_id = p_post and user_id = r.id; get diagnostics n = row_count;
  if n = 0 then
    if not exists (select 1 from community.posts where id = p_post and status = 'published') then raise exception 'not_found' using errcode = 'P0001'; end if;
    insert into community.bookmarks (post_id, user_id) values (p_post, r.id);
  end if;
  return jsonb_build_object('bookmarked', n = 0);
end $$;

create or replace function public.c_accept(p_post bigint, p_comment bigint) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r community.profiles := community.me(); v_author uuid;
begin
  if not exists (select 1 from community.posts where id = p_post and author = r.id and kind = 'question' and status = 'published') then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  select author into v_author from community.comments where id = p_comment and post_id = p_post and status = 'published';
  if v_author is null then raise exception 'not_found' using errcode = 'P0001'; end if;
  update community.posts set accepted_comment = p_comment where id = p_post;
  if v_author <> r.id then perform community.award(v_author, 'accepted_answer', p_post::text, 15); end if;
  return jsonb_build_object('accepted', p_comment);
end $$;

create or replace function public.c_report(p_type text, p_id text, p_reason text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r community.profiles := community.me(); n int;
begin
  if p_type is null or p_type not in ('post','comment','user') then raise exception 'bad_type' using errcode = 'P0001'; end if;
  if p_type <> 'user' and p_id !~ '^[0-9]{1,18}$' then raise exception 'bad_id' using errcode = 'P0001'; end if;
  if (select count(*) from community.reports where reporter = r.id and created_at > now() - interval '1 day') >= 20 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  insert into community.reports (reporter, target_type, target_id, reason) values (r.id, p_type, left(p_id, 64), left(trim(p_reason), 500)) on conflict do nothing;
  -- Three separate reports hide a post or comment until a moderator looks at it.
  select count(*) into n from community.reports where target_type = p_type and target_id = p_id and status = 'open';
  if n >= 3 and p_type = 'post' then update community.posts set status = 'hidden' where id = p_id::bigint and status = 'published'; end if;
  if n >= 3 and p_type = 'comment' then update community.comments set status = 'hidden' where id = p_id::bigint and status = 'published'; end if;
  return jsonb_build_object('reported', true);
end $$;

create or replace function public.c_block(p_handle text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r community.profiles := community.me(); v uuid; n int;
begin
  select id into v from community.profiles where lower(handle) = lower(p_handle);
  if v is null or v = r.id then raise exception 'not_found' using errcode = 'P0001'; end if;
  delete from community.blocks where user_id = r.id and blocked_id = v; get diagnostics n = row_count;
  if n = 0 then insert into community.blocks values (r.id, v); end if;
  return jsonb_build_object('blocked', n = 0);
end $$;

-- ---------- Opportunities and events ----------
create or replace function public.c_opportunities(p jsonb) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg((to_jsonb(o) - 'created_by' - 'status') || jsonb_build_object('expired', coalesce(o.deadline < current_date, false))
    order by coalesce(o.deadline < current_date, false), o.deadline nulls last, o.created_at desc), '[]')
  from community.opportunities o
  where o.status = 'published'
    and (nullif(p->>'category', '') is null or o.category = p->>'category')
    and (nullif(p->>'region', '') is null or (p->>'region') = any(o.regions))
    and (nullif(p->>'audience', '') is null or (p->>'audience') = any(o.audience))
    and (nullif(p->>'field', '') is null or (p->>'field') = any(o.fields))
    and (coalesce((p->>'include_expired')::boolean, true) or o.deadline is null or o.deadline >= current_date);
$$;

create or replace function public.c_events(p jsonb) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg((to_jsonb(e) - 'created_by' - 'status') || jsonb_build_object(
      'saved', exists (select 1 from community.event_saves s where s.event_id = e.id and s.user_id = auth.uid()),
      'past', coalesce(e.ends_at, e.starts_at) < now()) order by e.starts_at), '[]')
  from community.events e
  where e.status = 'published'
    and e.starts_at >= coalesce(nullif(p->>'from', '')::timestamptz, now() - interval '1 day')
    and (nullif(p->>'to', '') is null or e.starts_at < (p->>'to')::timestamptz)
    and (nullif(p->>'category', '') is null or e.category = p->>'category');
$$;

create or replace function public.c_event_save(p_event bigint) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r community.profiles := community.me(); n int;
begin
  delete from community.event_saves where event_id = p_event and user_id = r.id; get diagnostics n = row_count;
  if n = 0 then
    if not exists (select 1 from community.events where id = p_event and status = 'published') then raise exception 'not_found' using errcode = 'P0001'; end if;
    insert into community.event_saves values (p_event, r.id);
  end if;
  return jsonb_build_object('saved', n = 0);
end $$;

-- ---------- Challenges, XP and badges ----------
create or replace function community.today_challenges() returns setof community.challenges language sql stable security definer set search_path = '' as $$
  (select * from community.challenges where not weekly order by id
    offset (select mod((current_date - date '2026-01-01'), greatest(count(*), 1)::int) from community.challenges where not weekly) limit 1)
  union all
  (select * from community.challenges where weekly order by id
    offset (select mod(((current_date - date '2026-01-05') / 7), greatest(count(*), 1)::int) from community.challenges where weekly) limit 1);
$$;

create or replace function public.c_challenges() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'topic', c.topic, 'difficulty', c.difficulty, 'weekly', c.weekly, 'question', c.question, 'options', c.options,
      'attempt', (select jsonb_build_object('choice', a.choice, 'correct', a.correct, 'answer', c.answer, 'explanation', c.explanation)
                  from community.challenge_attempts a where a.challenge_id = c.id and a.user_id = auth.uid()))
    order by c.weekly), '[]')
  from community.today_challenges() c;
$$;

create or replace function public.c_challenge_submit(p_id text, p_choice int) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r community.profiles := community.me(); c community.challenges; ok boolean; n int;
begin
  select * into c from community.today_challenges() t where t.id = p_id;
  if c.id is null then raise exception 'not_today' using errcode = 'P0001'; end if;
  if p_choice is null or p_choice < 0 or p_choice >= cardinality(c.options) then raise exception 'bad_choice' using errcode = 'P0001'; end if;
  ok := p_choice = c.answer;
  insert into community.challenge_attempts (user_id, challenge_id, choice, correct) values (r.id, c.id, p_choice, ok) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then select a.choice, a.correct into p_choice, ok from community.challenge_attempts a where a.user_id = r.id and a.challenge_id = c.id; end if;
  if n > 0 and ok then perform community.award(r.id, case when c.weekly then 'weekly_challenge' else 'daily_challenge' end, c.id, case when c.weekly then 25 else 10 end); end if;
  return jsonb_build_object('correct', ok, 'choice', p_choice, 'answer', c.answer, 'explanation', c.explanation, 'first_try', n > 0);
end $$;

create or replace function public.c_leaderboard() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('handle', x.handle, 'name', x.name, 'xp', x.pts) order by x.pts desc), '[]') from (
    select p.handle, coalesce(p.display_name, p.handle) as name, sum(e.points) as pts
    from community.xp_events e join community.profiles p on p.id = e.user_id
    where p.on_leaderboard and p.status = 'active' and e.created_at > now() - interval '30 days'
    group by p.id, p.handle, p.display_name order by pts desc limit 20) x;
$$;

create or replace function community.badges(p_user uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_array(
    jsonb_build_object('id', 'first-steps', 'name', 'First Steps', 'how', 'Choose your level and interests.', 'earned', exists (select 1 from community.xp_events where user_id = p_user and reason = 'first_steps')),
    jsonb_build_object('id', 'problem-solver', 'name', 'Problem Solver', 'how', 'Solve 5 challenges.', 'earned', (select count(*) from community.challenge_attempts where user_id = p_user and correct) >= 5),
    jsonb_build_object('id', 'coding-explorer', 'name', 'Coding Explorer', 'how', 'Solve 3 programming challenges.', 'earned', (select count(*) from community.challenge_attempts a join community.challenges c on c.id = a.challenge_id where a.user_id = p_user and a.correct and c.topic = 'Programming') >= 3),
    jsonb_build_object('id', 'consistent-learner', 'name', 'Consistent Learner', 'how', 'Take challenges on 7 different days.', 'earned', (select count(distinct created_at::date) from community.challenge_attempts where user_id = p_user) >= 7),
    jsonb_build_object('id', 'community-contributor', 'name', 'Community Contributor', 'how', 'Have an answer accepted.', 'earned', exists (select 1 from community.xp_events where user_id = p_user and reason = 'accepted_answer')),
    jsonb_build_object('id', 'project-builder', 'name', 'Project Builder', 'how', 'Publish a project.', 'earned', exists (select 1 from community.posts where author = p_user and kind = 'project' and status = 'published')),
    jsonb_build_object('id', 'creative-thinker', 'name', 'Creative Thinker', 'how', 'Publish a design or creative project.', 'earned', exists (select 1 from community.posts where author = p_user and kind = 'project' and status = 'published' and category in ('design','creative'))),
    jsonb_build_object('id', 'tech-explorer', 'name', 'Tech Explorer', 'how', 'Save 3 events.', 'earned', (select count(*) from community.event_saves where user_id = p_user) >= 3));
$$;

create or replace function public.c_my_space() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r community.profiles := community.me();
begin
  return jsonb_build_object(
    'me', public.c_me(),
    'badges', community.badges(r.id),
    'xp_history', coalesce((select jsonb_agg(jsonb_build_object('reason', x.reason, 'points', x.points, 'at', x.created_at) order by x.created_at desc) from (select * from community.xp_events where user_id = r.id order by created_at desc limit 30) x), '[]'),
    'posts', coalesce((select jsonb_agg(community.post_json(p, r.id) order by p.created_at desc) from (select * from community.posts where author = r.id and status <> 'removed' order by created_at desc limit 50) p), '[]'),
    'bookmarks', coalesce((select jsonb_agg(community.post_json(p, r.id) order by b.created_at desc) from community.bookmarks b join community.posts p on p.id = b.post_id where b.user_id = r.id and p.status = 'published'), '[]'),
    'events', coalesce((select jsonb_agg((to_jsonb(e) - 'created_by' - 'status') order by e.starts_at) from community.event_saves s join community.events e on e.id = s.event_id where s.user_id = r.id and e.status = 'published'), '[]'),
    'challenges', coalesce((select jsonb_agg(jsonb_build_object('id', a.challenge_id, 'topic', c.topic, 'correct', a.correct, 'at', a.created_at) order by a.created_at desc) from community.challenge_attempts a join community.challenges c on c.id = a.challenge_id where a.user_id = r.id), '[]'),
    'blocked', coalesce((select jsonb_agg(p.handle) from community.blocks b join community.profiles p on p.id = b.blocked_id where b.user_id = r.id), '[]'));
end $$;

create or replace function public.c_home() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'trending', public.c_feed('{"sort":"trending","limit":4}'::jsonb),
    'projects', public.c_feed('{"kind":"project","sort":"latest","limit":3}'::jsonb),
    'unanswered', public.c_feed('{"kind":"question","sort":"unanswered","limit":3}'::jsonb),
    'opportunities', (select coalesce(jsonb_agg(x.v), '[]') from (select v from jsonb_array_elements(public.c_opportunities('{"include_expired":false}'::jsonb)) v limit 3) x),
    'events', (select coalesce(jsonb_agg(x.v), '[]') from (select v from jsonb_array_elements(public.c_events('{}'::jsonb)) v limit 3) x),
    'challenges', public.c_challenges(),
    'members', (select count(*) from community.profiles where status = 'active'),
    'published', (select count(*) from community.posts where status = 'published'));
$$;

-- ---------- Moderation and administration ----------
create or replace function public.c_mod_queue() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r community.profiles := community.require_role('moderator');
begin
  return jsonb_build_object(
    'posts', coalesce((select jsonb_agg(community.post_json(p, r.id) || jsonb_build_object('body', p.body) order by p.created_at) from community.posts p where p.status in ('pending','hidden')), '[]'),
    'comments', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'post_id', c.post_id, 'body', c.body, 'status', c.status, 'created_at', c.created_at, 'author', a.handle) order by c.created_at)
      from community.comments c join community.profiles a on a.id = c.author where c.status in ('pending','hidden')), '[]'),
    'reports', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'target_type', x.target_type, 'target_id', x.target_id, 'reason', x.reason, 'created_at', x.created_at, 'reporter', a.handle) order by x.created_at)
      from community.reports x join community.profiles a on a.id = x.reporter where x.status = 'open'), '[]'),
    'role', r.role);
end $$;

create or replace function public.c_mod_decide(p jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r community.profiles := community.require_role('moderator'); v_type text := p->>'type'; v_id bigint := (p->>'id')::bigint; v_action text := p->>'action';
  ps community.posts; v_new text; v_post bigint;
begin
  v_new := case v_action when 'approve' then 'published' when 'restore' then 'published' when 'hide' then 'hidden' when 'remove' then 'removed' end;
  if v_type = 'post' then
    if v_action in ('feature','unfeature') then
      update community.posts set featured = (v_action = 'feature') where id = v_id;
    elsif v_new is not null then
      update community.posts set status = v_new, published_at = case when v_new = 'published' then coalesce(published_at, now()) else published_at end where id = v_id returning * into ps;
      if v_new = 'published' and ps.kind = 'project' then perform community.award(ps.author, 'project_published', ps.id::text, 20); end if;
    else raise exception 'bad_action' using errcode = 'P0001'; end if;
  elsif v_type = 'comment' then
    if v_new is null then raise exception 'bad_action' using errcode = 'P0001'; end if;
    update community.comments set status = v_new where id = v_id returning post_id into v_post;
    update community.posts set comments_count = (select count(*) from community.comments c where c.post_id = v_post and c.status = 'published') where id = v_post;
  else raise exception 'bad_type' using errcode = 'P0001'; end if;
  update community.reports set status = 'actioned', resolved_by = r.id, resolved_at = now() where target_type = v_type and target_id = v_id::text and status = 'open';
  perform community.audit('mod_' || v_action, v_type, v_id::text, p->'note');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.c_mod_report_close(p_id bigint) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r community.profiles := community.require_role('moderator');
begin
  update community.reports set status = 'dismissed', resolved_by = r.id, resolved_at = now() where id = p_id and status = 'open';
  perform community.audit('report_dismissed', 'report', p_id::text);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.c_mod_users(p_q text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r community.profiles := community.require_role('moderator');
begin
  return coalesce((select jsonb_agg(jsonb_build_object('handle', p.handle, 'role', p.role, 'status', p.status, 'xp', p.xp, 'created_at', p.created_at,
      'posts', (select count(*) from community.posts x where x.author = p.id),
      'reports', (select count(*) from community.reports x where x.target_type = 'user' and lower(x.target_id) = lower(p.handle) and x.status = 'open')) order by p.created_at desc)
    from (select * from community.profiles where coalesce(p_q, '') = '' or handle ilike '%' || p_q || '%' order by created_at desc limit 50) p), '[]');
end $$;

create or replace function public.c_mod_user(p_handle text, p_action text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r community.profiles := community.require_role('moderator'); t community.profiles; v_role text;
begin
  select * into t from community.profiles where lower(handle) = lower(p_handle);
  if t.id is null then raise exception 'not_found' using errcode = 'P0001'; end if;
  if community.role_rank(t.role) >= community.role_rank(r.role) then raise exception 'forbidden' using errcode = 'P0001'; end if;
  if p_action in ('suspend','restore') then
    update community.profiles set status = case p_action when 'suspend' then 'suspended' else 'active' end where id = t.id;
  elsif p_action like 'role:%' then
    v_role := substr(p_action, 6);
    if community.role_rank(v_role) < 0 then raise exception 'bad_role' using errcode = 'P0001'; end if;
    -- Admins grant roles below their own; only a super administrator makes administrators.
    if community.role_rank(r.role) < 4 or community.role_rank(v_role) >= community.role_rank(r.role) then raise exception 'forbidden' using errcode = 'P0001'; end if;
    update community.profiles set role = v_role where id = t.id;
  else raise exception 'bad_action' using errcode = 'P0001'; end if;
  perform community.audit('user_' || p_action, 'user', t.handle);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.c_admin_opportunity_save(p jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r community.profiles := community.require_role('editor'); v_id bigint := nullif(p->>'id', '')::bigint;
begin
  if v_id is null then
    insert into community.opportunities (title, organisation, description, eligibility, location, category, regions, audience, fields, deadline, apply_url, verified, last_checked, status, created_by)
    values (p->>'title', p->>'organisation', p->>'description', nullif(p->>'eligibility', ''), nullif(p->>'location', ''), p->>'category',
      community.clean_list(p->'regions', 6, 30), community.clean_list(p->'audience', 6, 30), community.clean_list(p->'fields', 6, 30),
      nullif(p->>'deadline', '')::date, p->>'apply_url', coalesce((p->>'verified')::boolean, false), coalesce(nullif(p->>'last_checked', '')::date, current_date), coalesce(nullif(p->>'status', ''), 'draft'), r.id)
    returning id into v_id;
  else
    update community.opportunities set title = p->>'title', organisation = p->>'organisation', description = p->>'description', eligibility = nullif(p->>'eligibility', ''),
      location = nullif(p->>'location', ''), category = p->>'category', regions = community.clean_list(p->'regions', 6, 30), audience = community.clean_list(p->'audience', 6, 30),
      fields = community.clean_list(p->'fields', 6, 30), deadline = nullif(p->>'deadline', '')::date, apply_url = p->>'apply_url', verified = coalesce((p->>'verified')::boolean, false),
      last_checked = coalesce(nullif(p->>'last_checked', '')::date, current_date), status = coalesce(nullif(p->>'status', ''), status)
    where id = v_id;
  end if;
  perform community.audit('opportunity_saved', 'opportunity', v_id::text, jsonb_build_object('status', p->>'status'));
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.c_admin_event_save(p jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r community.profiles := community.require_role('editor'); v_id bigint := nullif(p->>'id', '')::bigint;
begin
  if v_id is null then
    insert into community.events (title, description, category, starts_at, ends_at, timezone, online, location, register_url, organiser, reg_deadline, verified, status, created_by)
    values (p->>'title', p->>'description', p->>'category', (p->>'starts_at')::timestamptz, nullif(p->>'ends_at', '')::timestamptz, coalesce(nullif(p->>'timezone', ''), 'UTC'),
      coalesce((p->>'online')::boolean, true), nullif(p->>'location', ''), nullif(p->>'register_url', ''), p->>'organiser', nullif(p->>'reg_deadline', '')::date,
      coalesce((p->>'verified')::boolean, false), coalesce(nullif(p->>'status', ''), 'draft'), r.id)
    returning id into v_id;
  else
    update community.events set title = p->>'title', description = p->>'description', category = p->>'category', starts_at = (p->>'starts_at')::timestamptz,
      ends_at = nullif(p->>'ends_at', '')::timestamptz, timezone = coalesce(nullif(p->>'timezone', ''), 'UTC'), online = coalesce((p->>'online')::boolean, true),
      location = nullif(p->>'location', ''), register_url = nullif(p->>'register_url', ''), organiser = p->>'organiser', reg_deadline = nullif(p->>'reg_deadline', '')::date,
      verified = coalesce((p->>'verified')::boolean, false), status = coalesce(nullif(p->>'status', ''), status)
    where id = v_id;
  end if;
  perform community.audit('event_saved', 'event', v_id::text, jsonb_build_object('status', p->>'status'));
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.c_admin_listings() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r community.profiles := community.require_role('editor');
begin
  return jsonb_build_object(
    'opportunities', coalesce((select jsonb_agg(to_jsonb(o) order by o.created_at desc) from community.opportunities o where o.status <> 'archived'), '[]'),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.starts_at desc) from community.events e where e.status <> 'archived'), '[]'));
end $$;

create or replace function public.c_mod_audit() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r community.profiles := community.require_role('admin');
begin
  return coalesce((select jsonb_agg(jsonb_build_object('action', l.action, 'target_type', l.target_type, 'target_id', l.target_id, 'detail', l.detail, 'at', l.created_at,
      'actor', (select handle from community.profiles where id = l.actor)) order by l.created_at desc)
    from (select * from community.audit_log order by created_at desc limit 100) l), '[]');
end $$;

-- ---------- Permissions: only the functions are reachable ----------
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'c\_%' loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'community' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
