-- =====================================================
--  FlashPing — Supabase SQL 스키마
--  Supabase 대시보드 > SQL Editor에서 실행하세요
-- =====================================================

-- 1. presence 테이블 (사용자 상태 저장)
create table if not exists presence (
  code        text primary key,          -- 5자리 페어링 코드
  name        text not null default '',  -- 사용자 이름
  status      text not null default '안녕!', -- 상태 메시지
  updated_at  timestamptz not null default now()
);

-- updated_at 자동 갱신 함수
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 트리거
drop trigger if exists set_updated_at on presence;
create trigger set_updated_at
  before update on presence
  for each row execute function update_updated_at();

-- 2. Row Level Security (RLS) — 누구나 읽기/쓰기 가능 (간단한 앱용)
alter table presence enable row level security;

-- 모든 사용자 읽기 허용
create policy "allow_read" on presence
  for select using (true);

-- 모든 사용자 insert/update 허용 (코드 기반)
create policy "allow_write" on presence
  for insert with check (true);

create policy "allow_update" on presence
  for update using (true);

-- 3. Realtime 활성화
-- Supabase 대시보드 > Database > Replication 에서
-- presence 테이블 realtime을 켜거나, 아래 명령 실행:
alter publication supabase_realtime add table presence;

-- =====================================================
--  완료! 이제 config.js에 URL과 키를 넣고 배포하세요.
-- =====================================================
