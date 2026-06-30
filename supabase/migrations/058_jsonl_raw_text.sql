-- Raw JSONL transcript storage (line-level text + full JSON payload).

create table if not exists public.jsonl_raw_text (
  id text primary key,
  source_path text not null,
  line_index integer not null,
  line_text text not null default '',
  line_json text not null,
  created_at timestamptz not null default now(),
  constraint jsonl_raw_text_source_line_unique unique (source_path, line_index)
);

create index if not exists jsonl_raw_text_source_path_idx
  on public.jsonl_raw_text (source_path);

create index if not exists jsonl_raw_text_line_index_idx
  on public.jsonl_raw_text (line_index);

comment on table public.jsonl_raw_text is
  'Stores agent transcript JSONL lines: searchable text plus original JSON per row.';

comment on column public.jsonl_raw_text.line_text is
  'Plain-text extract from the JSONL line (user query or assistant reply).';

comment on column public.jsonl_raw_text.line_json is
  'Full original JSONL line as text.';
