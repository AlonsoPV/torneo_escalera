"""Generate SQL seed for jsonl_raw_text from agent transcript JSONL."""
from __future__ import annotations

import json
from pathlib import Path

SRC = Path(
    r"C:\Users\alpev\.cursor\projects\c-Users-alpev-tennis-tournament-app\agent-transcripts"
    r"\829c44e6-5361-4d91-bf06-58ffed8d77a8\829c44e6-5361-4d91-bf06-58ffed8d77a8.jsonl"
)
OUT = Path(__file__).resolve().parent / "seed-transcript-829c44e6.sql"
SOURCE_PATH = (
    "829c44e6-5361-4d91-bf06-58ffed8d77a8/829c44e6-5361-4d91-bf06-58ffed8d77a8.jsonl"
)


def esc_sql(value: str) -> str:
    return value.replace("'", "''")


def extract_text(obj: dict) -> str:
    parts: list[str] = []
    msg = obj.get("message") or {}
    for chunk in msg.get("content") or []:
        if isinstance(chunk, dict) and chunk.get("type") == "text":
            parts.append(chunk.get("text") or "")
    return "\n".join(parts).strip()


def redact_assistant_text(text: str) -> str:
    if "[REDACTED]" in text:
        return "[REDACTED]"
    return text


def main() -> None:
    lines = [line for line in SRC.read_text(encoding="utf-8").splitlines() if line.strip()]
    chunks: list[str] = [
        "-- Seed transcript 829c44e6 (admin notifications + sync flow conversation)\n",
        "-- Run after 058_jsonl_raw_text.sql\n\n",
        "BEGIN;\n\n",
        f"DELETE FROM jsonl_raw_text WHERE source_path = '{SOURCE_PATH}';\n\n",
    ]

    for index, raw in enumerate(lines):
        obj = json.loads(raw)
        role = obj.get("role", "unknown")
        text = extract_text(obj)
        if role == "assistant":
            text = redact_assistant_text(text)

        line_json = esc_sql(json.dumps(obj, ensure_ascii=False))
        line_text = esc_sql(text)
        row_id = f"829c44e6-5361-4d91-bf06-58ffed8d77a8-{index:04d}"

        chunks.append(
            "INSERT INTO jsonl_raw_text (id, source_path, line_index, line_text, line_json) VALUES (\n"
            f"  '{row_id}',\n"
            f"  '{SOURCE_PATH}',\n"
            f"  {index},\n"
            f"  '{line_text}',\n"
            f"  '{line_json}'\n"
            ");\n\n"
        )

    chunks.append("COMMIT;\n")
    OUT.write_text("".join(chunks), encoding="utf-8")
    print(f"Wrote {OUT} ({len(lines)} rows, {OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
