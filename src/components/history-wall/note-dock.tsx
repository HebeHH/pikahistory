"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ClipboardEvent } from "react";

import type { HistoryWallRecord, SourceReference, VisualReference } from "@/contracts/history-wall.types";
import { renderMarkdown } from "@/lib/history-wall/markdown";
import { formatYear } from "@/lib/history-wall/time-scale";
import { imageForRecord } from "@/lib/history-wall/civ-images";
import PikaSprite from "./pika-sprite";

interface NoteDockProps {
  record: HistoryWallRecord | null;
  saving: boolean;
  suggestion: string | null;
  onClose: () => void;
  onSave: (record: HistoryWallRecord) => void;
  onExplore: () => void;
}

/* ---- Minimal Web Speech API typing (avoids `any`) ---- */
interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechWindow = {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};
function getSpeechCtor(): (new () => SpeechRecognitionLike) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Full study note lives in `details.markdown`; `notes` is the short summary fallback. */
function readMarkdown(record: HistoryWallRecord): string {
  return record.details?.markdown?.trim() ? record.details.markdown : record.notes;
}
function readTags(record: HistoryWallRecord): string[] {
  return record.details?.tags ?? [];
}
function readSources(record: HistoryWallRecord): SourceReference[] {
  return record.details?.sources ?? [];
}
function readMedia(record: HistoryWallRecord): VisualReference[] {
  return record.details?.media ?? [];
}

export default function NoteDock({ record, saving, suggestion, onClose, onSave, onExplore }: NoteDockProps) {
  const open = record !== null;
  return (
    <div
      style={{
        flex: `0 0 ${open ? 342 : 0}px`,
        height: 342,
        transform: open ? "translateY(0)" : "translateY(100%)",
        transition: "transform .28s ease, flex-basis .28s ease",
        background: "var(--surface)",
        borderTop: "1px solid var(--line)",
        boxShadow: "0 -6px 24px rgba(43,38,32,.06)",
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {record && (
        // key => editor state resets cleanly when a different record opens.
        <DockContent
          key={record.id}
          record={record}
          saving={saving}
          suggestion={suggestion}
          onClose={onClose}
          onSave={onSave}
          onExplore={onExplore}
        />
      )}
    </div>
  );
}

export function DockContent({
  record,
  saving,
  suggestion,
  onClose,
  onSave,
  onExplore,
  startEditing = false,
}: NoteDockProps & { record: HistoryWallRecord; startEditing?: boolean }) {
  const [editing, setEditing] = useState(startEditing);
  const [title, setTitle] = useState(record.title);
  const [label, setLabel] = useState(record.span.displayLabel);
  const [notes, setNotes] = useState(readMarkdown(record));
  const [tagsText, setTagsText] = useState(readTags(record).join(", "));

  const discard = () => {
    setTitle(record.title);
    setLabel(record.span.displayLabel);
    setNotes(readMarkdown(record));
    setTagsText(readTags(record).join(", "));
    setEditing(false);
  };

  const [listening, setListening] = useState(false);
  const [speechOk] = useState(() => Boolean(getSpeechCtor()));
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const Ctor = getSpeechCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (event) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) text += event.results[i][0].transcript;
      setNotes((b) => (b ? b.trimEnd() + " " : "") + text.trim());
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    return () => rec.abort();
  }, []);

  const toggleMic = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      rec.start();
      setListening(true);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const item = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"));
    if (!item) return;
    e.preventDefault();
    const file = item.getAsFile();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ta = notesRef.current;
      const insert = `\n![pasted image](${reader.result})\n`;
      if (!ta) return setNotes((b) => b + insert);
      const start = ta.selectionStart ?? notes.length;
      setNotes(notes.slice(0, start) + insert + notes.slice(start));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const details = {
      markdown: notes,
      tags,
      sources: record.details?.sources ?? [],
      media: record.details?.media ?? [],
    };
    const updated = {
      ...record,
      title: title.trim() || record.title,
      span: { ...record.span, displayLabel: label.trim() || record.span.displayLabel },
      details,
    } as HistoryWallRecord;
    onSave(updated);
    setEditing(false);
  };

  const tags = readTags(record);
  const sources = readSources(record);
  const landmark = imageForRecord(record);
  const media: VisualReference[] = [
    ...(landmark ? [{ kind: "url" as const, value: landmark.url, alt: landmark.credit }] : []),
    ...readMedia(record),
  ];
  const inputCls = "w-full rounded-md border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]";

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ padding: "12px 22px", borderBottom: "1px solid var(--line-2)" }}>
        <div className="flex items-center gap-3" style={{ minWidth: 0, flex: 1 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 0 3px rgba(232,169,12,.2)", flex: "0 0 auto" }} />
          {editing ? (
            <input className={`${inputCls} font-serif`} style={{ maxWidth: 320, fontSize: 18, fontWeight: 700, borderColor: "var(--line)" }} value={title} onChange={(e) => setTitle(e.target.value)} />
          ) : (
            <span className="font-serif" style={{ fontSize: 19, fontWeight: 700, color: "var(--text)" }}>
              {record.title}
            </span>
          )}
          {editing ? (
            <input className={`${inputCls} font-mono`} style={{ maxWidth: 170, fontSize: 12, borderColor: "var(--line)" }} value={label} onChange={(e) => setLabel(e.target.value)} />
          ) : (
            <span className="font-mono" style={{ fontSize: 12, background: "var(--timeline-to)", border: "1px solid var(--line)", borderRadius: 5, padding: "2px 8px", color: "var(--muted)", whiteSpace: "nowrap" }}>
              {record.span.displayLabel}
            </span>
          )}
          {!editing &&
            tags.map((tag) => (
              <span key={tag} style={{ fontSize: 11, color: "#8a6d3b", background: "#f3ead6", borderRadius: 999, padding: "2px 10px", whiteSpace: "nowrap" }}>
                #{tag}
              </span>
            ))}
        </div>

        <div className="flex items-center gap-3" style={{ flex: "0 0 auto" }}>
          <span className="font-mono flex items-center gap-1" style={{ fontSize: 10, color: "var(--faint)" }}>
            <span className="material-symbols-outlined filled" style={{ fontSize: 13, color: "var(--accent)" }}>
              bolt
            </span>
            {record.type.toUpperCase()} · {formatYear(record.span.startYear)}
          </span>
          {editing ? (
            <div className="flex gap-2">
              <button type="button" onClick={discard} style={btnGhost}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  close
                </span>
                Discard
              </button>
              <button type="button" onClick={handleSave} disabled={saving} style={btnPrimary}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  save
                </span>
                {saving ? "Saving…" : "Save note"}
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setEditing(true)} style={btnPrimary}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                edit
              </span>
              Edit note
            </button>
          )}
          <button type="button" onClick={onClose} style={{ ...btnGhost, border: "none" }} title="Close">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              close
            </span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex" style={{ flex: 1, minHeight: 0 }}>
        <div className="overflow-auto" style={{ flex: 1.7, padding: "16px 22px 18px", borderRight: "1px solid var(--line-2)" }}>
          {editing ? (
            <>
              <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                <button type="button" onClick={toggleMic} disabled={!speechOk} title={speechOk ? "Dictate" : "Speech not supported"} style={{ ...chip, ...(listening ? { background: "#fee2e2", borderColor: "#ef4444", color: "#b91c1c" } : {}) }}>
                  {listening ? "● Recording…" : "🎤 Dictate"}
                </button>
                <span style={{ fontSize: 11, color: "var(--faint)" }}>Markdown · paste an image to embed</span>
              </div>
              <textarea ref={notesRef} value={notes} onChange={(e) => setNotes(e.target.value)} onPaste={onPaste} className="font-mono" style={{ width: "100%", minHeight: 160, resize: "vertical", border: "1px solid var(--line)", borderRadius: 8, padding: 10, fontSize: 12.5 }} />
              <div style={{ marginTop: 10 }}>
                <label className="font-mono" style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--faint)" }}>
                  TAGS (comma-separated)
                </label>
                <input className={inputCls} style={{ borderColor: "var(--line)", marginTop: 4 }} value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="ancient-china, bronze-age" />
              </div>
            </>
          ) : (
            <div className="note-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(readMarkdown(record) || "*No notes yet — click Edit to add some.*") }} />
          )}
        </div>

        {/* Right rail */}
        <div className="overflow-auto" style={{ flex: "0 0 316px", padding: "16px 20px" }}>
          <div className="font-mono" style={{ fontSize: 10, letterSpacing: "0.15em", color: "var(--faint)", marginBottom: 8 }}>
            MEDIA
          </div>
          <div className="flex gap-2" style={{ marginBottom: 18, flexWrap: "wrap" }}>
            {media.length > 0
              ? media.map((m, i) =>
                  m.kind === "emoji" ? (
                    <div key={i} className="flex items-center justify-center" style={{ width: 74, height: 74, borderRadius: 8, border: "1px solid var(--line-4)", background: "var(--app-bg)", fontSize: 32 }} title={m.alt}>
                      {m.value}
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={m.value} alt={m.alt ?? ""} style={{ width: 74, height: 74, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line-4)" }} />
                  ),
                )
              : ["image", "play_circle"].map((glyph, i) => (
                  <div key={glyph} className="flex flex-col items-center justify-center" style={{ flex: 1, height: 74, borderRadius: 8, border: "1px solid var(--line-4)", background: "repeating-linear-gradient(45deg,#efe8d8,#efe8d8 7px,#e8e0cd 7px,#e8e0cd 14px)", color: "var(--muted)", gap: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                      {glyph}
                    </span>
                    <span style={{ fontSize: 10 }}>{i === 0 ? "image slot" : "clip slot"}</span>
                  </div>
                ))}
          </div>
          <div className="font-mono" style={{ fontSize: 10, letterSpacing: "0.15em", color: "var(--faint)", marginBottom: 8 }}>
            SOURCES
          </div>
          {sources.length ? (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-1" style={{ fontSize: 13, color: "var(--accent-deep)", textDecoration: "underline" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                      link
                    </span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <span style={{ fontSize: 12, color: "var(--faint)" }}>No sources yet.</span>
          )}
        </div>
      </div>

      {/* AI suggestion strip */}
      <div className="flex items-center gap-3" style={{ padding: "12px 22px", background: "linear-gradient(90deg, rgba(232,169,12,.14), rgba(232,169,12,.05))", borderTop: "1px solid rgba(232,169,12,.35)" }}>
        <span className="flex items-center justify-center pika-bob" style={{ width: 38, height: 38, flex: "0 0 auto" }} title="Pika!">
          <PikaSprite size={38} mood="spark" />
        </span>
        <span className="font-serif" style={{ flex: 1, fontStyle: "italic", fontSize: 14, color: "#4a4335" }}>
          {suggestion ?? "Pika-pika… ⚡ sniffing out a rabbit-hole from your notes…"}
        </span>
        <button type="button" onClick={onExplore} className="flex items-center gap-1" style={{ background: "var(--text)", color: "var(--app-bg)", borderRadius: 8, padding: "7px 14px", fontSize: 13, flex: "0 0 auto" }}>
          Explore
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            arrow_forward
          </span>
        </button>
      </div>
    </>
  );
}

const btnGhost: CSSProperties = { display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 7, padding: "5px 10px", background: "transparent", cursor: "pointer" };
const btnPrimary: CSSProperties = { display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--app-bg)", background: "var(--text)", borderRadius: 7, padding: "5px 12px", cursor: "pointer", border: "none" };
const chip: CSSProperties = { fontSize: 12, border: "1px solid var(--line)", borderRadius: 6, padding: "4px 9px", background: "#fafaf7", cursor: "pointer" };
