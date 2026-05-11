type IconProps = { size?: number };
type StarProps = IconProps & { filled?: boolean };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const Icon = {
  Book: ({ size = 16 }: IconProps) => (
    <svg {...base(size)}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  Pages: ({ size = 16 }: IconProps) => (
    <svg {...base(size)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="14" y2="17" />
    </svg>
  ),
  Flame: ({ size = 16 }: IconProps) => (
    <svg {...base(size)}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1.5 0 2.8-.6 4-2 1.5-1.8 1.5-3.5 1-5.5-.5-1.5-2-3.5-3.5-4.5.5 2.5-.5 4-2 5.5-1.5 1.5-3 2-3 4z" />
    </svg>
  ),
  Star: ({ size = 16, filled = false }: StarProps) => (
    <svg {...base(size)} fill={filled ? "currentColor" : "none"}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  Search: ({ size = 16 }: IconProps) => (
    <svg {...base(size)}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Plus: ({ size = 16 }: IconProps) => (
    <svg {...base(size)}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  ChevronLeft: ({ size = 16 }: IconProps) => (
    <svg {...base(size)}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  ChevronRight: ({ size = 16 }: IconProps) => (
    <svg {...base(size)}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  ChevronDown: ({ size = 16 }: IconProps) => (
    <svg {...base(size)}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  Trash: ({ size = 14 }: IconProps) => (
    <svg {...base(size)}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  ),
  X: ({ size = 16 }: IconProps) => (
    <svg {...base(size)}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Check: ({ size = 16 }: IconProps) => (
    <svg {...base(size)}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Logout: ({ size = 14 }: IconProps) => (
    <svg {...base(size)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Camera: ({ size = 14 }: IconProps) => (
    <svg {...base(size)}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  Logo: ({ size = 20 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
};
