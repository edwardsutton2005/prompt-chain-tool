"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const options = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Laptop },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex rounded-lg border bg-muted/40 p-1" aria-label="Theme">
      {options.map(({ value, label, Icon }) => (
        <Button
          key={value}
          type="button"
          variant={theme === value ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          aria-label={label}
          title={label}
          onClick={() => setTheme(value)}
        >
          <Icon className="h-4 w-4" />
        </Button>
      ))}
    </div>
  );
}
