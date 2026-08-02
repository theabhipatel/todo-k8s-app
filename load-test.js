#!/usr/bin/env node

// =====================================================
// Configuration
// =====================================================

const BASE_URL = "https://api.todo.theabhipatel.com/todos";

const TOTAL_REQUESTS = 1_000_000;
const CONCURRENCY = 1000;

// Traffic Distribution
const CREATE_PERCENT = 60;
const UPDATE_PERCENT = 30;
const GET_PERCENT = 10;

// =====================================================

const ids = [];

let completed = 0;
let success = 0;
let failed = 0;

const start = Date.now();

function randomPriority() {
  return ["low", "medium", "high"][Math.floor(Math.random() * 3)];
}

function randomId() {
  return ids[Math.floor(Math.random() * ids.length)];
}

async function request(method, url, body) {
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error();
    }

    success++;
    return json;
  } catch (err) {
    failed++;
    return null;
  } finally {
    completed++;
  }
}

async function createTodo() {
  const result = await request("POST", BASE_URL, {
    title: `Load-${Date.now()}-${Math.random()}`,
    description: "Load Testing",
    priority: randomPriority(),
  });

  if (result?.data?._id) {
    ids.push(result.data._id);
  }
}

async function updateTodo() {
  if (!ids.length) {
    return createTodo();
  }

  await request("PUT", `${BASE_URL}/${randomId()}`, {
    completed: Math.random() > 0.5,
  });
}

async function getTodo() {
  if (!ids.length) {
    return createTodo();
  }

  await request("GET", `${BASE_URL}/${randomId()}`);
}

async function worker() {
  while (completed < TOTAL_REQUESTS) {
    const r = Math.random() * 100;

    if (r < CREATE_PERCENT) {
      await createTodo();
    } else if (r < CREATE_PERCENT + UPDATE_PERCENT) {
      await updateTodo();
    } else {
      await getTodo();
    }
  }
}

setInterval(() => {
  const elapsed = (Date.now() - start) / 1000;

  console.clear();

  console.log("========================================");
  console.log("           LOAD TEST STATUS");
  console.log("========================================");
  console.log("URL          :", BASE_URL);
  console.log("Progress     :", `${completed}/${TOTAL_REQUESTS}`);
  console.log("Success      :", success);
  console.log("Failed       :", failed);
  console.log("Stored IDs   :", ids.length);
  console.log("Concurrency  :", CONCURRENCY);
  console.log("Elapsed      :", elapsed.toFixed(1), "sec");
  console.log("RPS          :", (completed / elapsed).toFixed(2));
  console.log("========================================");
}, 2000);

(async () => {
  console.log("Starting Load Test...\n");

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  console.log("\nCompleted.");
})();

process.on("SIGINT", () => {
  console.log("\nStopped.");
  process.exit(0);
});
