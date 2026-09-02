"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { useState, useRef, useEffect } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen(!open)}
        className="h-9 w-9"
        aria-label="Toggle theme"
      >
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </Button>
      
      {open && (
        <div className="absolute right-0 top-full mt-2 w-36 rounded-md border bg-white dark:bg-gray-800 shadow-lg z-50">
          <div className="p-1">
            <button
              className={`flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${
                theme === "light" ? "bg-gray-100 dark:bg-gray-700" : ""
              }`}
              onClick={() => {
                setTheme("light");
                setOpen(false);
              }}
            >
              <Sun className="h-4 w-4" />
              Light
            </button>
            <button
              className={`flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${
                theme === "dark" ? "bg-gray-100 dark:bg-gray-700" : ""
              }`}
              onClick={() => {
                setTheme("dark");
                setOpen(false);
              }}
            >
              <Moon className="h-4 w-4" />
              Dark
            </button>
            <button
              className={`flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${
                theme === "system" ? "bg-gray-100 dark:bg-gray-700" : ""
              }`}
              onClick={() => {
                setTheme("system");
                setOpen(false);
              }}
            >
              <Monitor className="h-4 w-4" />
              System
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
