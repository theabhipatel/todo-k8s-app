import {
  Component,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

interface Todo {
  _id: string;
  title: string;
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
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
          <div className="max-w-md rounded-lg border border-slate-800 bg-slate-900 p-8 text-center">
            <h1 className="mb-2 text-2xl font-bold">Something went wrong</h1>
            <p className="mb-6 text-sm text-slate-400">{this.state.message}</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium hover:bg-blue-500"
              >
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg bg-slate-800 px-5 py-2.5 font-medium hover:bg-slate-700"
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
/* Main app                                                             */
/* ------------------------------------------------------------------ */

function AppContent() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const [page, setPage] = useState(1);
  const limit = 5;

  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      });

      const data = await safeFetchJson<TodoResponse>(
        `${API_URL}/todos?${params}`,
      );

      if (!data || !Array.isArray(data.data)) {
        throw new Error("Server returned an unexpected response shape.");
      }

      setTodos(data.data);
      setTotalPages(data.pagination?.totalPages ?? 1);
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
  }, [page, search, status]);

  const createTodo = async () => {
    if (!title.trim() || !API_URL || submitting) return;

    try {
      setSubmitting(true);
      setError(null);

      await safeFetchJson(`${API_URL}/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });

      setTitle("");
      await fetchTodos();
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const updateTodo = async () => {
    if (!editingId || !title.trim() || !API_URL || submitting) return;

    try {
      setSubmitting(true);
      setError(null);

      await safeFetchJson(`${API_URL}/todos/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });

      setEditingId(null);
      setTitle("");
      await fetchTodos();
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

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

  const deleteTodo = async (id: string) => {
    if (!API_URL) return;

    try {
      setError(null);

      await safeFetchJson(`${API_URL}/todos/${id}`, {
        method: "DELETE",
      });

      await fetchTodos();
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    }
  };

  const startEdit = (todo: Todo) => {
    setEditingId(todo._id);
    setTitle(todo.title);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTitle("");
  };

  const formatDate = (value: string) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "Unknown date" : d.toLocaleString();
  };

  const bannerMessage = configError ?? error;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="mb-8 text-center text-4xl font-bold">MERN Todo App</h1>

        {/* Error banner */}
        {bannerMessage && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-red-800 bg-red-950/50 p-4 text-sm text-red-200">
            <span>{bannerMessage}</span>
            <div className="flex shrink-0 gap-2">
              {!configError && (
                <button
                  onClick={fetchTodos}
                  className="rounded bg-red-800/60 px-3 py-1 font-medium hover:bg-red-800"
                >
                  Retry
                </button>
              )}
              <button
                onClick={() => setError(null)}
                className="rounded px-2 py-1 text-red-300 hover:text-white"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Create / Update */}
        <div className="mb-8 flex gap-3">
          <input
            type="text"
            placeholder="Enter todo..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") editingId ? updateTodo() : createTodo();
            }}
            disabled={!!configError}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-blue-500 disabled:opacity-50"
          />

          {editingId ? (
            <>
              <button
                onClick={updateTodo}
                disabled={submitting || !title.trim() || !!configError}
                className="rounded-lg bg-amber-500 px-5 py-3 font-medium text-black hover:bg-amber-400 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Update"}
              </button>
              <button
                onClick={cancelEdit}
                disabled={submitting}
                className="rounded-lg bg-slate-800 px-5 py-3 font-medium hover:bg-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={createTodo}
              disabled={submitting || !title.trim() || !!configError}
              className="rounded-lg bg-blue-600 px-5 py-3 font-medium hover:bg-blue-500 disabled:opacity-50"
            >
              {submitting ? "Adding..." : "Add"}
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="mb-8 flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            placeholder="Search todo..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            disabled={!!configError}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 outline-none disabled:opacity-50"
          />

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            disabled={!!configError}
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 disabled:opacity-50"
          >
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        {/* Todo List */}
        <div className="space-y-3">
          {configError ? null : loading ? (
            <div className="text-center text-slate-400">Loading...</div>
          ) : todos.length === 0 ? (
            <div className="rounded-lg border border-slate-800 p-6 text-center text-slate-400">
              No Todos Found
            </div>
          ) : (
            todos.map((todo) => (
              <div
                key={todo._id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 p-4"
              >
                <div>
                  <h3
                    className={`font-medium ${
                      todo.completed ? "line-through text-green-500" : ""
                    }`}
                  >
                    {todo.title}
                  </h3>

                  <p className="mt-1 text-sm text-slate-400">
                    {formatDate(todo.createdAt)}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => toggleStatus(todo)}
                    className={`rounded px-3 py-2 text-sm font-medium ${
                      todo.completed
                        ? "bg-yellow-500 text-black"
                        : "bg-green-600"
                    }`}
                  >
                    {todo.completed ? "Undo" : "Done"}
                  </button>

                  <button
                    onClick={() => startEdit(todo)}
                    className="rounded bg-blue-600 px-3 py-2 text-sm"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => deleteTodo(todo._id)}
                    className="rounded bg-red-600 px-3 py-2 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {!configError && (
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              disabled={page === 1 || loading}
              onClick={() => setPage((prev) => prev - 1)}
              className="rounded bg-slate-800 px-4 py-2 disabled:opacity-50"
            >
              Prev
            </button>

            <span>
              Page {page} / {totalPages}
            </span>

            <button
              disabled={page === totalPages || loading}
              onClick={() => setPage((prev) => prev + 1)}
              className="rounded bg-slate-800 px-4 py-2 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
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
