import { useState, useEffect } from "react";
import { Input } from "../Field";

export function ColorInput({ initialValue, onCommit }: { initialValue: string; onCommit: (color: string) => void }) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);
  const [error, setError] = useState<string | null>(null);

  const validateAndCommit = () => {
    const v = value.trim();
    if (!v) {
      setError(null);
      onCommit("");
      return;
    }
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) {
      setError(null);
      onCommit(v);
    } else {
      setError("请输入有效的 #16进制色码");
    }
  };

  return (
    <div>
      <Input
        placeholder="#16进制色码"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
        onBlur={validateAndCommit}
        onKeyDown={(event) => {
          if (event.key === "Enter") validateAndCommit();
        }}
      />
      {error ? <p className="mt-1 text-xs text-coral">{error}</p> : null}
    </div>
  );
}
