import type { ReactNode } from "react";
import type { JobStatus } from "../lib/types";

type IconName =
  | "upload" | "external" | "check" | "key" | "search" | "copy" | "print" | "refresh"
  | "alert" | "arrow" | "file" | "pen" | "chat" | "trash" | "eye" | "eye-off" | "download";

const paths: Record<IconName, ReactNode> = {
  upload: <><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" /><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" /></>,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="1.5" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></>,
  print: <><path d="M7 9V4h10v5" /><rect x="4" y="9" width="16" height="7" rx="1.5" /><path d="M7 14h10v6H7z" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14.5-4.5L4 8" /><path d="M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16" /><path d="M20 20v-4h-4" /></>,
  alert: <><path d="M12 4 2.8 19.5h18.4z" /><path d="M12 10v4.5M12 17.2v.3" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  file: <><path d="M6 3h8l4 4v13.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
  pen: <><path d="M15.5 4.5 19.5 8.5 9 19H5v-4z" /><path d="m13 7 4 4" /></>,
  chat: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z" /></>,
  trash: <><path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  "eye-off": <><path d="M4 4l16 16M10 6a9 9 0 0 1 2-.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.6 3.4M6.6 7.6C4 9.4 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4-.9" /><path d="M9.9 10a3 3 0 0 0 4.1 4.2" /></>,
  download: <><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M4 17v1.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V17" /></>,
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

/** Note sur 20 écrite au stylo rouge, comme sur une copie. */
export function Grade({ score, size = "md" }: { score?: number; size?: "sm" | "md" | "lg" }) {
  if (score === undefined) {
    return <span className={`grade grade--${size} grade--none`} aria-label="Pas encore notée">–</span>;
  }
  const n = Math.round(score / 5);
  const tone = n >= 15 ? "high" : n >= 11 ? "mid" : "low";
  return (
    <span className={`grade grade--${size} grade--${tone}`} aria-label={`Note ${n} sur 20`}>
      <span className="grade__n">{n}</span>
      <span className="grade__d">/20</span>
      <svg className="grade__ul" viewBox="0 0 60 10" preserveAspectRatio="none" aria-hidden="true">
        <path d="M2 6.5C14 4 30 3.2 58 4.5M8 9c14-1.6 28-2 44-1.4" />
      </svg>
    </span>
  );
}

/** Une ligne de copie : annotation dans la marge rouge, contenu sur la réglure. */
export function Row({ note, children, className = "", id }: { note?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <div className={`row ${className}`} id={id}>
      <aside className="row__note">{note}</aside>
      <div className="row__body">{children}</div>
    </div>
  );
}

export function Status({ job }: { job?: JobStatus }) {
  if (!job || job.phase === "idle") return null;
  return (
    <div className={`status status--${job.phase}`} role={job.phase === "error" ? "alert" : "status"} aria-live="polite">
      {job.phase === "running" && <span className="spinner" aria-hidden="true" />}
      {job.phase === "error" && <Icon name="alert" />}
      {job.phase === "done" && <Icon name="check" />}
      <div>
        <strong>{job.label}</strong>
        {job.detail && <p>{job.detail}</p>}
      </div>
    </div>
  );
}

export function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 31) return `il y a ${days} j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
