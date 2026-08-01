import {
  Component,
  useEffect,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

type Priority = "low" | "medium" | "high";

interface Todo {
  _id: string;
  title: string;
  description: string;
  priority: Priority;
  dueDate: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TodoResponse {
  success: boolean;
  data: Todo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; color: string; bg: string; border: string }
> = {
  high: {
    label: "High",
    color: "#FF5A52",
    bg: "rgba(255,90,82,0.12)",
    border: "rgba(255,90,82,0.35)",
  },
  medium: {
    label: "Medium",
    color: "#FFB443",
    bg: "rgba(255,180,67,0.12)",
    border: "rgba(255,180,67,0.35)",
  },
  low: {
    label: "Low",
    color: "#4CD97B",
    bg: "rgba(76,217,123,0.12)",
    border: "rgba(76,217,123,0.35)",
  },
};

/** Turns any thrown value into a readable string. */
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Something unexpected went wrong. Please try again.";
}

/**
 * Wraps fetch with status-code and JSON-shape checking so a bad response
 * (500 page, HTML error page, empty body, etc.) never reaches `.json()`
 * unguarded and never gets treated as a silent success.
 */
async function safeFetchJson<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error(
      "Could not reach the server. Check your connection and try again.",
    );
  }

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.message ? `: ${body.message}` : "";
    } catch {
      // response wasn't JSON, ignore
    }
    throw new Error(`Request failed (${res.status})${detail}`);
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new Error("Server returned an unexpected response.");
  }
}

type ViewMode = "list" | "card";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;

/** Builds a compact page-number sequence with "…" gaps for large page counts. */
function getPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "…")[] = [1];
  if (current > 3) pages.push("…");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("…");
  pages.push(total);

  return pages;
}

/** Injects the Sora / Inter / JetBrains Mono font families once per document. */
function useProductFonts() {
  useEffect(() => {
    if (document.getElementById("todo-app-fonts")) return;
    const link = document.createElement("link");
    link.id = "todo-app-fonts";
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
  }, []);
}

/* ------------------------------------------------------------------ */
/* Error boundary - catches render/runtime errors so the app shows a   */
/* recoverable screen instead of going blank.                          */
/* ------------------------------------------------------------------ */

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, message: getErrorMessage(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("App crashed:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: "" });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#120C09] px-6 text-white">
          <div className="max-w-md rounded-2xl border border-[#35251E] bg-[#1C1310] p-8 text-center">
            <h1 className="mb-2 font-[Sora] text-2xl font-bold">
              Something went wrong
            </h1>
            <p className="mb-6 text-sm text-[#A4897C]">{this.state.message}</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="rounded-lg bg-[#FF7A29] px-5 py-2.5 font-medium text-[#120C09] hover:bg-[#FF8C42]"
              >
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg bg-[#241A15] px-5 py-2.5 font-medium hover:bg-[#2E2119]"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/* ------------------------------------------------------------------ */
/* Small shared bits                                                    */
/* ------------------------------------------------------------------ */

/** Centered overlay shell shared by the add/edit modal and the delete-confirm popup. */
function Overlay({
  onClose,
  children,
  maxWidth = "max-w-lg",
}: {
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} rounded-2xl border border-[#35251E] bg-[#1C1310] shadow-2xl shadow-black/50`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: cfg.color }}
      />
      {cfg.label}
    </span>
  );
}

/**
 * Custom themed dropdown — replaces native <select> so it can match the
 * app's dark/orange styling exactly (native selects can't be restyled
 * consistently across browsers).
 */
interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

function Dropdown<T extends string>({
  value,
  onChange,
  options,
  disabled,
  ariaLabel,
  className = "",
}: {
  value: T;
  onChange: (value: T) => void;
  options: DropdownOption<T>[];
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border bg-[#1C1310] px-4 py-2.5 text-left text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? "border-[#FF7A29]" : "border-[#35251E] hover:border-[#4A3226]"
        }`}
      >
        <span className="truncate text-[#F5EBE3]">
          {selected?.label ?? "Select"}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={`shrink-0 text-[#A4897C] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          <path
            d="M2.5 4.5L6 8L9.5 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-20 mt-1.5 w-full min-w-max overflow-hidden rounded-xl border border-[#35251E] bg-[#1C1310] py-1 shadow-2xl shadow-black/50"
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-6 px-4 py-2.5 text-left text-sm transition ${
                  active
                    ? "bg-[#FF7A29]/12 text-[#FF7A29]"
                    : "text-[#D8C7BC] hover:bg-[#241A15]"
                }`}
              >
                {opt.label}
                {active && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M3 7.5L5.5 10L11 4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main app                                                             */
/* ------------------------------------------------------------------ */

function AppContent() {
  useProductFonts();

  const [todos, setTodos] = useState<Todo[]>([]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [view, setView] = useState<ViewMode>("list");

  // Offline support: read-only mode when the browser has no connection.
  // The last successful GET /todos response is served from the service
  // worker cache, but mutations require a live network so they're disabled.
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add / edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPriority, setFormPriority] = useState<Priority>("medium");
  const [formDueDate, setFormDueDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Todo | null>(null);
  const [deleting, setDeleting] = useState(false);

  const configError = !API_URL
    ? "VITE_API_URL is not set, so the app can't reach the server. Check your .env file."
    : null;

  const fetchTodos = async () => {
    if (!API_URL) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search,
        status,
        priority: priorityFilter,
      });

      const data = await safeFetchJson<TodoResponse>(
        `${API_URL}/todos?${params}`,
      );

      if (!data || !Array.isArray(data.data)) {
        throw new Error("Server returned an unexpected response shape.");
      }

      setTodos(data.data);
      setTotalPages(data.pagination?.totalPages ?? 1);
      setTotal(data.pagination?.total ?? data.data.length);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
      setTodos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, search, status, priorityFilter]);

  /* -------------------------- modal helpers -------------------------- */

  const openAddModal = () => {
    setEditingId(null);
    setFormTitle("");
    setFormDescription("");
    setFormPriority("medium");
    setFormDueDate("");
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (todo: Todo) => {
    setEditingId(todo._id);
    setFormTitle(todo.title);
    setFormDescription(todo.description || "");
    setFormPriority(todo.priority || "medium");
    setFormDueDate(todo.dueDate ? todo.dueDate.slice(0, 10) : "");
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
  };

  const submitForm = async () => {
    if (!formTitle.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (!API_URL || submitting) return;

    try {
      setSubmitting(true);
      setFormError(null);

      const payload = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        priority: formPriority,
        dueDate: formDueDate || null,
      };

      if (editingId) {
        await safeFetchJson(`${API_URL}/todos/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await safeFetchJson(`${API_URL}/todos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      setModalOpen(false);
      await fetchTodos();
    } catch (err) {
      console.error(err);
      setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  /* ------------------------------ actions ------------------------------ */

  const toggleStatus = async (todo: Todo) => {
    if (!API_URL) return;

    try {
      setError(null);

      await safeFetchJson(`${API_URL}/todos/${todo._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !todo.completed }),
      });

      await fetchTodos();
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !API_URL || deleting) return;

    try {
      setDeleting(true);
      setError(null);

      await safeFetchJson(`${API_URL}/todos/${deleteTarget._id}`, {
        method: "DELETE",
      });

      setDeleteTarget(null);
      await fetchTodos();
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  /* ------------------------------ helpers ------------------------------ */

  const formatDate = (value: string) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "Unknown date" : d.toLocaleString();
  };

  const formatDueDate = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isOverdue = (todo: Todo) => {
    if (!todo.dueDate || todo.completed) return false;
    const d = new Date(todo.dueDate);
    if (Number.isNaN(d.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
  };

  const bannerMessage = configError ?? error;

  return (
    <div className="min-h-screen bg-[#120C09] font-[Inter] text-[#F5EBE3]">
      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/favicon.png"
              alt="Todo logo"
              className="h-16 w-16 shrink-0 rounded-xl object-cover shadow-lg shadow-[#FF7A29]/30"
            />
            <div>
              <h1 className="font-[Sora] text-3xl font-bold tracking-tight">
                Todo
              </h1>
              <p className="mt-0.5 text-sm text-[#A4897C]">
                {configError
                  ? "Not connected"
                  : `${total} ${total === 1 ? "task" : "tasks"} total`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-xl border border-[#35251E] bg-[#1C1310] p-1">
              <button
                onClick={() => setView("list")}
                aria-label="List view"
                aria-pressed={view === "list"}
                className={`rounded-lg p-2 transition ${
                  view === "list"
                    ? "bg-[#FF7A29]/15 text-[#FF7A29]"
                    : "text-[#6B5348] hover:text-[#A4897C]"
                }`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    x="1"
                    y="2.5"
                    width="14"
                    height="2"
                    rx="1"
                    fill="currentColor"
                  />
                  <rect
                    x="1"
                    y="7"
                    width="14"
                    height="2"
                    rx="1"
                    fill="currentColor"
                  />
                  <rect
                    x="1"
                    y="11.5"
                    width="14"
                    height="2"
                    rx="1"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <button
                onClick={() => setView("card")}
                aria-label="Card view"
                aria-pressed={view === "card"}
                className={`rounded-lg p-2 transition ${
                  view === "card"
                    ? "bg-[#FF7A29]/15 text-[#FF7A29]"
                    : "text-[#6B5348] hover:text-[#A4897C]"
                }`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    x="1"
                    y="1"
                    width="6"
                    height="6"
                    rx="1.2"
                    fill="currentColor"
                  />
                  <rect
                    x="9"
                    y="1"
                    width="6"
                    height="6"
                    rx="1.2"
                    fill="currentColor"
                  />
                  <rect
                    x="1"
                    y="9"
                    width="6"
                    height="6"
                    rx="1.2"
                    fill="currentColor"
                  />
                  <rect
                    x="9"
                    y="9"
                    width="6"
                    height="6"
                    rx="1.2"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>

            <button
              onClick={openAddModal}
              disabled={!!configError || isOffline}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#FF8C42] to-[#E0621A] px-4 py-2.5 font-medium text-[#120C09] shadow-lg shadow-[#FF7A29]/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="text-lg leading-none">+</span> New task
            </button>
          </div>
        </div>

        {/* Offline banner */}
        {!configError && isOffline && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-[rgba(245,196,81,0.28)] bg-[rgba(245,196,81,0.10)] p-4 text-sm text-[#F5C451]">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: "#F5C451" }}
            />
            <span>
              You're offline — showing your last synced tasks. Adding, editing,
              and deleting are disabled until you're back online.
            </span>
          </div>
        )}

        {/* Error banner */}
        {bannerMessage && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-[rgba(255,90,82,0.28)] bg-[rgba(255,90,82,0.10)] p-4 text-sm text-[#FFB3AC]">
            <span>{bannerMessage}</span>
            <div className="flex shrink-0 gap-2">
              {!configError && (
                <button
                  onClick={fetchTodos}
                  className="rounded-lg bg-[rgba(255,90,82,0.18)] px-3 py-1 font-medium hover:bg-[rgba(255,90,82,0.28)]"
                >
                  Retry
                </button>
              )}
              <button
                onClick={() => setError(null)}
                className="rounded px-2 py-1 text-[#FFB3AC] hover:text-white"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            disabled={!!configError}
            className="flex-1 rounded-xl border border-[#35251E] bg-[#1C1310] px-4 py-2.5 text-sm outline-none transition focus:border-[#FF7A29] disabled:opacity-50"
          />

          <Dropdown
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            disabled={!!configError}
            ariaLabel="Filter by status"
            className="md:w-44"
            options={[
              { value: "all", label: "All statuses" },
              { value: "completed", label: "Completed" },
              { value: "pending", label: "Pending" },
            ]}
          />

          <Dropdown
            value={priorityFilter}
            onChange={(v) => {
              setPriorityFilter(v);
              setPage(1);
            }}
            disabled={!!configError}
            ariaLabel="Filter by priority"
            className="md:w-44"
            options={[
              { value: "all", label: "All priorities" },
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ]}
          />
        </div>

        {/* Todo List */}
        {configError ? null : loading ? (
          <div className="rounded-xl border border-[#35251E] bg-[#1C1310] p-8 text-center text-sm text-[#A4897C]">
            Loading...
          </div>
        ) : todos.length === 0 ? (
          <div className="rounded-xl border border-[#35251E] bg-[#1C1310] p-8 text-center">
            <p className="text-sm text-[#A4897C]">
              {search || status !== "all" || priorityFilter !== "all"
                ? "No tasks match your filters."
                : "No tasks yet. Add your first one."}
            </p>
          </div>
        ) : view === "list" ? (
          <div className="space-y-3">
            {todos.map((todo) => {
              const overdue = isOverdue(todo);
              const cfg = PRIORITY_CONFIG[todo.priority || "medium"];
              const due = todo.dueDate ? formatDueDate(todo.dueDate) : null;

              return (
                <div
                  key={todo._id}
                  className="group flex gap-3 rounded-xl border border-[#35251E] bg-[#1C1310] p-4 transition hover:border-[#4A3226]"
                >
                  <div
                    className="w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: cfg.color }}
                  />

                  <button
                    onClick={() => toggleStatus(todo)}
                    disabled={isOffline}
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      borderColor: todo.completed ? "#4CD97B" : "#4A3226",
                      backgroundColor: todo.completed
                        ? "#4CD97B"
                        : "transparent",
                    }}
                    aria-label={
                      todo.completed ? "Mark as pending" : "Mark as done"
                    }
                  >
                    {todo.completed && (
                      <span className="text-xs leading-none text-[#120C09]">
                        ✓
                      </span>
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className={`font-medium ${
                          todo.completed
                            ? "text-[#6B5348] line-through"
                            : "text-[#F5EBE3]"
                        }`}
                      >
                        {todo.title}
                      </h3>
                      <PriorityBadge priority={todo.priority || "medium"} />
                    </div>

                    {todo.description && (
                      <p
                        className={`mt-1 text-sm ${
                          todo.completed
                            ? "text-[#5C4A3F] line-through"
                            : "text-[#A4897C]"
                        }`}
                      >
                        {todo.description}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-3 font-[JetBrains_Mono] text-xs text-[#6B5348]">
                      <span>{formatDate(todo.createdAt)}</span>
                      {due && (
                        <span
                          className={
                            overdue
                              ? "rounded bg-[rgba(255,90,82,0.15)] px-1.5 py-0.5 text-[#FFB3AC]"
                              : ""
                          }
                        >
                          {overdue ? "Overdue: " : "Due "}
                          {due}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-start gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      onClick={() => openEditModal(todo)}
                      disabled={isOffline}
                      className="rounded-lg px-2.5 py-1.5 text-sm text-[#A4897C] hover:bg-[#241A15] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Edit task"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget(todo)}
                      disabled={isOffline}
                      className="rounded-lg px-2.5 py-1.5 text-sm text-[#A4897C] hover:bg-[rgba(255,90,82,0.15)] hover:text-[#FFB3AC] disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Delete task"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {todos.map((todo) => {
              const overdue = isOverdue(todo);
              const cfg = PRIORITY_CONFIG[todo.priority || "medium"];
              const due = todo.dueDate ? formatDueDate(todo.dueDate) : null;

              return (
                <div
                  key={todo._id}
                  className="flex flex-col rounded-2xl border border-[#35251E] bg-[#1C1310] p-5 transition hover:border-[#4A3226]"
                  style={{ borderTopColor: cfg.color, borderTopWidth: 3 }}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <PriorityBadge priority={todo.priority || "medium"} />
                    <button
                      onClick={() => toggleStatus(todo)}
                      disabled={isOffline}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition disabled:cursor-not-allowed disabled:opacity-50"
                      style={{
                        borderColor: todo.completed ? "#4CD97B" : "#4A3226",
                        backgroundColor: todo.completed
                          ? "#4CD97B"
                          : "transparent",
                      }}
                      aria-label={
                        todo.completed ? "Mark as pending" : "Mark as done"
                      }
                    >
                      {todo.completed && (
                        <span className="text-xs leading-none text-[#120C09]">
                          ✓
                        </span>
                      )}
                    </button>
                  </div>

                  <h3
                    className={`font-medium ${
                      todo.completed
                        ? "text-[#6B5348] line-through"
                        : "text-[#F5EBE3]"
                    }`}
                  >
                    {todo.title}
                  </h3>

                  {todo.description && (
                    <p
                      className={`mt-1.5 line-clamp-3 text-sm ${
                        todo.completed
                          ? "text-[#5C4A3F] line-through"
                          : "text-[#A4897C]"
                      }`}
                    >
                      {todo.description}
                    </p>
                  )}

                  <div className="mt-4 flex flex-1 items-end justify-between gap-2">
                    <div className="font-[JetBrains_Mono] text-xs text-[#6B5348]">
                      {due && (
                        <span
                          className={
                            overdue
                              ? "rounded bg-[rgba(255,90,82,0.15)] px-1.5 py-0.5 text-[#FFB3AC]"
                              : ""
                          }
                        >
                          {overdue ? "Overdue: " : "Due "}
                          {due}
                        </span>
                      )}
                    </div>

                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => openEditModal(todo)}
                        disabled={isOffline}
                        className="rounded-lg px-2 py-1 text-xs text-[#A4897C] hover:bg-[#241A15] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Edit task"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(todo)}
                        disabled={isOffline}
                        className="rounded-lg px-2 py-1 text-xs text-[#A4897C] hover:bg-[rgba(255,90,82,0.15)] hover:text-[#FFB3AC] disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Delete task"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!configError && todos.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-[#A4897C]">
              <span>
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)}{" "}
                of {total}
              </span>

              <Dropdown
                value={String(limit)}
                onChange={(v) => {
                  setLimit(Number(v));
                  setPage(1);
                }}
                ariaLabel="Tasks per page"
                options={PAGE_SIZE_OPTIONS.map((n) => ({
                  value: String(n),
                  label: `${n} / page`,
                }))}
              />
            </div>

            <div className="flex items-center gap-1">
              <button
                disabled={page === 1 || loading}
                onClick={() => setPage(1)}
                className="rounded-lg border border-[#35251E] bg-[#1C1310] px-3 py-2 text-sm disabled:opacity-40"
                aria-label="First page"
              >
                «
              </button>
              <button
                disabled={page === 1 || loading}
                onClick={() => setPage((prev) => prev - 1)}
                className="rounded-lg border border-[#35251E] bg-[#1C1310] px-3 py-2 text-sm disabled:opacity-40"
                aria-label="Previous page"
              >
                ‹
              </button>

              {getPageNumbers(page, totalPages).map((p, i) =>
                p === "…" ? (
                  <span
                    key={`ellipsis-${i}`}
                    className="px-2 text-sm text-[#6B5348]"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    disabled={loading}
                    onClick={() => setPage(p)}
                    className={`min-w-[2.25rem] rounded-lg border px-3 py-2 text-sm transition disabled:opacity-40 ${
                      p === page
                        ? "border-[#FF7A29] bg-[#FF7A29]/15 text-[#FF7A29]"
                        : "border-[#35251E] bg-[#1C1310] text-[#A4897C] hover:text-white"
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}

              <button
                disabled={page === totalPages || loading}
                onClick={() => setPage((prev) => prev + 1)}
                className="rounded-lg border border-[#35251E] bg-[#1C1310] px-3 py-2 text-sm disabled:opacity-40"
                aria-label="Next page"
              >
                ›
              </button>
              <button
                disabled={page === totalPages || loading}
                onClick={() => setPage(totalPages)}
                className="rounded-lg border border-[#35251E] bg-[#1C1310] px-3 py-2 text-sm disabled:opacity-40"
                aria-label="Last page"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <Overlay onClose={closeModal}>
          <div className="p-6">
            <h2 className="mb-5 font-[Sora] text-xl font-bold">
              {editingId ? "Edit task" : "New task"}
            </h2>

            {formError && (
              <div className="mb-4 rounded-lg border border-[rgba(255,90,82,0.28)] bg-[rgba(255,90,82,0.10)] px-3 py-2 text-sm text-[#FFB3AC]">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#A4897C]">
                  Title
                </label>
                <input
                  autoFocus
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  className="w-full rounded-xl border border-[#35251E] bg-[#120C09] px-4 py-2.5 text-sm outline-none focus:border-[#FF7A29]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#A4897C]">
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Add more detail (optional)"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-[#35251E] bg-[#120C09] px-4 py-2.5 text-sm outline-none focus:border-[#FF7A29]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#A4897C]">
                    Priority
                  </label>
                  <div className="flex gap-1.5">
                    {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((p) => {
                      const cfg = PRIORITY_CONFIG[p];
                      const active = formPriority === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setFormPriority(p)}
                          className="flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition"
                          style={{
                            borderColor: active ? cfg.color : "#35251E",
                            backgroundColor: active ? cfg.bg : "transparent",
                            color: active ? cfg.color : "#A4897C",
                          }}
                        >
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#A4897C]">
                    Due date
                  </label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full rounded-xl border border-[#35251E] bg-[#120C09] px-3 py-2.5 text-sm outline-none focus:border-[#FF7A29] [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeModal}
                disabled={submitting}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-[#A4897C] hover:bg-[#241A15] hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitForm}
                disabled={submitting || !formTitle.trim()}
                className="rounded-xl bg-gradient-to-br from-[#FF8C42] to-[#E0621A] px-5 py-2.5 text-sm font-medium text-[#120C09] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting
                  ? "Saving..."
                  : editingId
                    ? "Save changes"
                    : "Add task"}
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {/* Delete confirmation popup */}
      {deleteTarget && (
        <Overlay
          onClose={() => !deleting && setDeleteTarget(null)}
          maxWidth="max-w-sm"
        >
          <div className="p-6">
            <h2 className="mb-2 font-[Sora] text-lg font-bold">Delete task?</h2>
            <p className="mb-6 text-sm text-[#A4897C]">
              "{deleteTarget.title}" will be permanently removed. This can't be
              undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-[#A4897C] hover:bg-[#241A15] hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-xl bg-[#FF5A52] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#E0453D] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
