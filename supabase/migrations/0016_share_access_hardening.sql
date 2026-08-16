-- 0016_share_access_hardening.sql
--
-- Fixes three defects in the doctor-share feature:
--
-- 1. The previous policy `public: view active share` allowed anon to
--    `select *` from EVERY live share row, so anyone could enumerate all
--    active share tokens and open every patient's brief. Dropped here.
-- 2. `token_hash` stored the raw token, so a single leaked DB read exposed
--    working links. Callers now store sha256(token) and the raw token never
--    reaches the database.
-- 3. The public brief page queried `profiles`/`medicines`/`visits` directly
--    with the anon key, but those tables require `auth.uid() = user_id`, so
--    an anonymous doctor always saw an empty brief. Replaced by the
--    `get_shared_brief` security-definer RPC below, which is the only anon
--    entry point and requires knowledge of the raw token.

drop policy if exists "public: view active share" on shares;

-- Duplicate hashes must be impossible: the public lookup resolves exactly one row.
delete from shares s
using shares dup
where s.token_hash = dup.token_hash
  and s.token_hash <> ''
  and s.ctid > dup.ctid;

drop index if exists idx_shares_token_hash;
create unique index if not exists idx_shares_token_hash_unique
  on shares (token_hash)
  where token_hash <> '';

-- Any pre-existing rows hold raw tokens in both token_hash and snapshot.
-- They cannot be migrated (the hash of an unknown-encoding token is not
-- recoverable), so revoke them and strip the leaked copies.
update shares
set revoked_at = coalesce(revoked_at, now()),
    snapshot = snapshot - 'token'
where snapshot ? 'token';

/**
 * Resolves a raw share token to the patient brief it grants access to.
 *
 * security definer so an anonymous doctor can read exactly the rows this token
 * authorises, without any broad anon grant on the underlying tables. Returns
 * null when the token is unknown, revoked, or expired — the caller cannot
 * distinguish these cases, which keeps the endpoint useless for probing.
 */
create or replace function get_shared_brief(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_share   shares;
  v_hash    text;
  v_profile jsonb;
  v_meds    jsonb;
  v_visits  jsonb;
begin
  if p_token is null or length(p_token) < 16 then
    return null;
  end if;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select * into v_share
  from shares
  where token_hash = v_hash
    and revoked_at is null
    and expires_at > now()
  limit 1;

  if not found then
    return null;
  end if;

  update shares
  set view_count = view_count + 1,
      last_viewed_at = now()
  where id = v_share.id;

  select to_jsonb(p) - 'user_id' into v_profile
  from profiles p
  where p.id = v_share.profile_id;

  select coalesce(jsonb_agg(to_jsonb(m) - 'user_id' order by m.start_date desc), '[]'::jsonb)
    into v_meds
  from medicines m
  where m.profile_id = v_share.profile_id
    and m.discontinued_at is null;

  select coalesce(jsonb_agg(sub.x order by sub.visit_date desc), '[]'::jsonb) into v_visits
  from (
    select to_jsonb(v) - 'user_id' as x, v.visit_date
    from visits v
    where v.profile_id = v_share.profile_id
    order by v.visit_date desc
    limit 3
  ) sub;

  return jsonb_build_object(
    'profile', v_profile,
    'medicines', v_meds,
    'visits', v_visits,
    'shared_at', v_share.created_at,
    'expires_at', v_share.expires_at
  );
end;
$$;

revoke all on function get_shared_brief(text) from public;
grant execute on function get_shared_brief(text) to anon, authenticated;
