-- Add qr_used flag to leave_requests
alter table public.leave_requests
  add column if not exists qr_used boolean not null default false;

-- Index for faster QR lookup
create index if not exists leave_requests_qr_token_idx on public.leave_requests(qr_token);
