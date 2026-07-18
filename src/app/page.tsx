import baseHistoryWallData from "../../public/data/history-wall.base.json";

import { parseHistoryWallData } from "@/contracts/history-wall.schema";

const historyWall = parseHistoryWallData(baseHistoryWallData);

const summary = [
  { label: "Civilizations", value: historyWall.civilizations.length },
  { label: "Events", value: historyWall.events.length },
  { label: "Eras", value: historyWall.eras.length },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16 sm:px-10">
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-amber-700">
        The past, in perspective
      </p>
      <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-stone-950 sm:text-7xl">
        History Wall
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-600">
        A shared timeline for seeing civilizations, eras, and world events in
        context.
      </p>

      <dl className="mt-12 grid max-w-2xl gap-px overflow-hidden rounded-2xl border border-stone-200 bg-stone-200 sm:grid-cols-3">
        {summary.map((item) => (
          <div className="bg-white p-6" key={item.label}>
            <dt className="text-sm text-stone-500">{item.label}</dt>
            <dd className="mt-1 text-3xl font-semibold text-stone-900">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-6 text-sm text-stone-500">
        Canonical data contract loaded successfully.
      </p>
    </main>
  );
}
