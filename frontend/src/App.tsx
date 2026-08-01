import {
  Component,
  useEffect,
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
    color: "#F2555B",
    bg: "rgba(242,85,91,0.12)",
    border: "rgba(242,85,91,0.35)",
  },
  medium: {
    label: "Medium",
    color: "#F0A93A",
    bg: "rgba(240,169,58,0.12)",
    border: "rgba(240,169,58,0.35)",
  },
  low: {
    label: "Low",
    color: "#34C77B",
    bg: "rgba(52,199,123,0.12)",
    border: "rgba(52,199,123,0.35)",
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
        <div className="flex min-h-screen items-center justify-center bg-[#0B0D12] px-6 text-white">
          <div className="max-w-md rounded-2xl border border-[#262B3A] bg-[#131620] p-8 text-center">
            <h1 className="mb-2 font-[Sora] text-2xl font-bold">
              Something went wrong
            </h1>
            <p className="mb-6 text-sm text-[#8A90A6]">{this.state.message}</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="rounded-lg bg-[#7C6CF0] px-5 py-2.5 font-medium hover:bg-[#6c5ce0]"
              >
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg bg-[#191D29] px-5 py-2.5 font-medium hover:bg-[#232838]"
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
        className={`w-full ${maxWidth} rounded-2xl border border-[#262B3A] bg-[#131620] shadow-2xl shadow-black/50`}
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
    <div className="min-h-screen bg-[#0B0D12] font-[Inter] text-[#E7E9EE]">
      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-[Sora] text-3xl font-bold tracking-tight">
              Todo
            </h1>
            <p className="mt-1 text-sm text-[#8A90A6]">
              {configError
                ? "Not connected"
                : `${total} ${total === 1 ? "task" : "tasks"} total`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-xl border border-[#262B3A] bg-[#131620] p-1">
              <button
                onClick={() => setView("list")}
                aria-label="List view"
                aria-pressed={view === "list"}
                className={`rounded-lg p-2 transition ${
                  view === "list"
                    ? "bg-[#191D29] text-white"
                    : "text-[#5C6278] hover:text-[#8A90A6]"
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
                    ? "bg-[#191D29] text-white"
                    : "text-[#5C6278] hover:text-[#8A90A6]"
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
              className="flex items-center gap-2 rounded-xl bg-[#7C6CF0] px-4 py-2.5 font-medium text-white shadow-lg shadow-[#7C6CF0]/20 transition hover:bg-[#6c5ce0] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="text-lg leading-none">+</span> New task
            </button>
          </div>
        </div>

        {/* Offline banner */}
        {!configError && isOffline && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#3A3420] bg-[#211D10] p-4 text-sm text-[#E8C77A]">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: "#E8C77A" }}
            />
            <span>
              You're offline — showing your last synced tasks. Adding, editing,
              and deleting are disabled until you're back online.
            </span>
          </div>
        )}

        {/* Error banner */}
        {bannerMessage && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-[#3A2430] bg-[#211018] p-4 text-sm text-[#F2A5AC]">
            <span>{bannerMessage}</span>
            <div className="flex shrink-0 gap-2">
              {!configError && (
                <button
                  onClick={fetchTodos}
                  className="rounded-lg bg-[#3A2430] px-3 py-1 font-medium hover:bg-[#4a2c3b]"
                >
                  Retry
                </button>
              )}
              <button
                onClick={() => setError(null)}
                className="rounded px-2 py-1 text-[#F2A5AC] hover:text-white"
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
            className="flex-1 rounded-xl border border-[#262B3A] bg-[#131620] px-4 py-2.5 text-sm outline-none transition focus:border-[#7C6CF0] disabled:opacity-50"
          />

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            disabled={!!configError}
            className="rounded-xl border border-[#262B3A] bg-[#131620] px-4 py-2.5 text-sm outline-none disabled:opacity-50"
          >
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            disabled={!!configError}
            className="rounded-xl border border-[#262B3A] bg-[#131620] px-4 py-2.5 text-sm outline-none disabled:opacity-50"
          >
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Todo List */}
        {configError ? null : loading ? (
          <div className="rounded-xl border border-[#262B3A] bg-[#131620] p-8 text-center text-sm text-[#8A90A6]">
            Loading...
          </div>
        ) : todos.length === 0 ? (
          <div className="rounded-xl border border-[#262B3A] bg-[#131620] p-8 text-center">
            <p className="text-sm text-[#8A90A6]">
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
                  className="group flex gap-3 rounded-xl border border-[#262B3A] bg-[#131620] p-4 transition hover:border-[#333a4d]"
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
                      borderColor: todo.completed ? "#34C77B" : "#3A3F51",
                      backgroundColor: todo.completed
                        ? "#34C77B"
                        : "transparent",
                    }}
                    aria-label={
                      todo.completed ? "Mark as pending" : "Mark as done"
                    }
                  >
                    {todo.completed && (
                      <span className="text-xs leading-none text-[#0B0D12]">
                        ✓
                      </span>
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className={`font-medium ${
                          todo.completed
                            ? "text-[#5C6278] line-through"
                            : "text-[#E7E9EE]"
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
                            ? "text-[#4A5064] line-through"
                            : "text-[#8A90A6]"
                        }`}
                      >
                        {todo.description}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-3 font-[JetBrains_Mono] text-xs text-[#5C6278]">
                      <span>{formatDate(todo.createdAt)}</span>
                      {due && (
                        <span
                          className={
                            overdue
                              ? "rounded bg-[#3A2430] px-1.5 py-0.5 text-[#F2A5AC]"
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
                      className="rounded-lg px-2.5 py-1.5 text-sm text-[#8A90A6] hover:bg-[#191D29] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Edit task"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget(todo)}
                      disabled={isOffline}
                      className="rounded-lg px-2.5 py-1.5 text-sm text-[#8A90A6] hover:bg-[#3A2430] hover:text-[#F2A5AC] disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="flex flex-col rounded-2xl border border-[#262B3A] bg-[#131620] p-5 transition hover:border-[#333a4d]"
                  style={{ borderTopColor: cfg.color, borderTopWidth: 3 }}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <PriorityBadge priority={todo.priority || "medium"} />
                    <button
                      onClick={() => toggleStatus(todo)}
                      disabled={isOffline}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition disabled:cursor-not-allowed disabled:opacity-50"
                      style={{
                        borderColor: todo.completed ? "#34C77B" : "#3A3F51",
                        backgroundColor: todo.completed
                          ? "#34C77B"
                          : "transparent",
                      }}
                      aria-label={
                        todo.completed ? "Mark as pending" : "Mark as done"
                      }
                    >
                      {todo.completed && (
                        <span className="text-xs leading-none text-[#0B0D12]">
                          ✓
                        </span>
                      )}
                    </button>
                  </div>

                  <h3
                    className={`font-medium ${
                      todo.completed
                        ? "text-[#5C6278] line-through"
                        : "text-[#E7E9EE]"
                    }`}
                  >
                    {todo.title}
                  </h3>

                  {todo.description && (
                    <p
                      className={`mt-1.5 line-clamp-3 text-sm ${
                        todo.completed
                          ? "text-[#4A5064] line-through"
                          : "text-[#8A90A6]"
                      }`}
                    >
                      {todo.description}
                    </p>
                  )}

                  <div className="mt-4 flex flex-1 items-end justify-between gap-2">
                    <div className="font-[JetBrains_Mono] text-xs text-[#5C6278]">
                      {due && (
                        <span
                          className={
                            overdue
                              ? "rounded bg-[#3A2430] px-1.5 py-0.5 text-[#F2A5AC]"
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
                        className="rounded-lg px-2 py-1 text-xs text-[#8A90A6] hover:bg-[#191D29] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Edit task"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(todo)}
                        disabled={isOffline}
                        className="rounded-lg px-2 py-1 text-xs text-[#8A90A6] hover:bg-[#3A2430] hover:text-[#F2A5AC] disabled:cursor-not-allowed disabled:opacity-50"
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
            <div className="flex items-center gap-2 text-sm text-[#8A90A6]">
              <span>
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)}{" "}
                of {total}
              </span>

              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-[#262B3A] bg-[#131620] px-2 py-1.5 text-sm outline-none"
                aria-label="Tasks per page"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                disabled={page === 1 || loading}
                onClick={() => setPage(1)}
                className="rounded-lg border border-[#262B3A] bg-[#131620] px-3 py-2 text-sm disabled:opacity-40"
                aria-label="First page"
              >
                «
              </button>
              <button
                disabled={page === 1 || loading}
                onClick={() => setPage((prev) => prev - 1)}
                className="rounded-lg border border-[#262B3A] bg-[#131620] px-3 py-2 text-sm disabled:opacity-40"
                aria-label="Previous page"
              >
                ‹
              </button>

              {getPageNumbers(page, totalPages).map((p, i) =>
                p === "…" ? (
                  <span
                    key={`ellipsis-${i}`}
                    className="px-2 text-sm text-[#5C6278]"
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
                        ? "border-[#7C6CF0] bg-[#7C6CF0]/15 text-[#7C6CF0]"
                        : "border-[#262B3A] bg-[#131620] text-[#8A90A6] hover:text-white"
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}

              <button
                disabled={page === totalPages || loading}
                onClick={() => setPage((prev) => prev + 1)}
                className="rounded-lg border border-[#262B3A] bg-[#131620] px-3 py-2 text-sm disabled:opacity-40"
                aria-label="Next page"
              >
                ›
              </button>
              <button
                disabled={page === totalPages || loading}
                onClick={() => setPage(totalPages)}
                className="rounded-lg border border-[#262B3A] bg-[#131620] px-3 py-2 text-sm disabled:opacity-40"
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
              <div className="mb-4 rounded-lg border border-[#3A2430] bg-[#211018] px-3 py-2 text-sm text-[#F2A5AC]">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#8A90A6]">
                  Title
                </label>
                <input
                  autoFocus
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  className="w-full rounded-xl border border-[#262B3A] bg-[#0B0D12] px-4 py-2.5 text-sm outline-none focus:border-[#7C6CF0]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#8A90A6]">
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Add more detail (optional)"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-[#262B3A] bg-[#0B0D12] px-4 py-2.5 text-sm outline-none focus:border-[#7C6CF0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#8A90A6]">
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
                            borderColor: active ? cfg.color : "#262B3A",
                            backgroundColor: active ? cfg.bg : "transparent",
                            color: active ? cfg.color : "#8A90A6",
                          }}
                        >
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#8A90A6]">
                    Due date
                  </label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full rounded-xl border border-[#262B3A] bg-[#0B0D12] px-3 py-2.5 text-sm outline-none focus:border-[#7C6CF0] [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeModal}
                disabled={submitting}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-[#8A90A6] hover:bg-[#191D29] hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitForm}
                disabled={submitting || !formTitle.trim()}
                className="rounded-xl bg-[#7C6CF0] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#6c5ce0] disabled:cursor-not-allowed disabled:opacity-40"
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
            <p className="mb-6 text-sm text-[#8A90A6]">
              "{deleteTarget.title}" will be permanently removed. This can't be
              undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-[#8A90A6] hover:bg-[#191D29] hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-xl bg-[#E5484D] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#d33f44] disabled:cursor-not-allowed disabled:opacity-40"
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
