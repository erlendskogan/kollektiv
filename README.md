# kirkegutta

Et sleek dashboard for kollektivet. Data lagres i Supabase.

## Kjoring

1. Sett opp Supabase (SQL under).
2. Aapne `index.html` i en nettleser.

## Funksjoner

- Kalender med egne hendelser (kan fjernes)
- Beholdningsliste med slidere for antall/prosent og 0%-varsel
- Leaderboard for husarbeid med bildebevis (lagres i Storage)

## Notater

- Bildebevis lagres i Supabase Storage (bucket `proofs`).

## Supabase SQL

Kjor dette i Supabase SQL editoren:

```sql
create extension if not exists pgcrypto;

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  title text not null,
  note text,
  created_at timestamptz default now()
);

create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  qty int not null,
  type text not null check (type in ('count','percent')),
  min int not null default 0,
  max int not null default 100,
  created_at timestamptz default now()
);

create table if not exists leaderboard (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  score int not null default 0,
  created_at timestamptz default now()
);

create table if not exists proofs (
  id uuid primary key default gen_random_uuid(),
  user_name text not null,
  task text not null,
  photo_url text not null,
  created_at timestamptz default now()
);

alter table events enable row level security;
alter table inventory enable row level security;
alter table leaderboard enable row level security;
alter table proofs enable row level security;

create policy "public read events" on events for select using (true);
create policy "public write events" on events for insert with check (true);
create policy "public update events" on events for update using (true);
create policy "public delete events" on events for delete using (true);

create policy "public read inventory" on inventory for select using (true);
create policy "public write inventory" on inventory for insert with check (true);
create policy "public update inventory" on inventory for update using (true);
create policy "public delete inventory" on inventory for delete using (true);

create policy "public read leaderboard" on leaderboard for select using (true);
create policy "public write leaderboard" on leaderboard for insert with check (true);
create policy "public update leaderboard" on leaderboard for update using (true);
create policy "public delete leaderboard" on leaderboard for delete using (true);

create policy "public read proofs" on proofs for select using (true);
create policy "public write proofs" on proofs for insert with check (true);
create policy "public update proofs" on proofs for update using (true);
create policy "public delete proofs" on proofs for delete using (true);
```

## Supabase Storage

1. Lag en bucket kalt `proofs` og sett den til public.
2. Legg til policies for Storage (public read/write).

## Deploy (Vercel)

Dette er en statisk app:
1. Importer repoet i Vercel.
2. Sett build til "No Build" / "Other".
3. Deploy.

Supabase keys ligger i `index.html`.
