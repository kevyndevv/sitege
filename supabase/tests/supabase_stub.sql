-- Minimal emulation of the parts of a Supabase database the migration relies on.
-- ONLY for local testing; never run against a real Supabase project.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema extensions;
create schema auth;
create schema storage;
grant usage on schema public, extensions, auth, storage to anon, authenticated, service_role;

create table auth.users (id uuid primary key, email text);

create function auth.uid() returns uuid
language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;

-- Supabase grants everything on public tables/functions to the API roles by default;
-- RLS is what actually protects data. Reproduce that so tests are realistic.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text, owner uuid, created_at timestamptz default now()
);
alter table storage.objects enable row level security;
grant all on storage.objects to anon, authenticated;

create publication supabase_realtime;
