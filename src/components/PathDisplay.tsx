export function PathDisplay({ path }: { path: string }) {
  if (!path) return <span>未知</span>;
  const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (lastSlash < 0) return <span>{path}</span>;
  const dir = path.slice(0, lastSlash + 1);
  const file = path.slice(lastSlash + 1);
  return (
    <span className="inline-flex min-w-0">
      <span className="truncate" style={{ direction: "rtl", textAlign: "left" }}>{dir}</span>
      <span className="shrink-0">{file}</span>
    </span>
  );
}
