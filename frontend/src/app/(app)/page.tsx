export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="font-display text-5xl font-semibold tracking-tight">
        ASTRA
      </h1>
      <p className="mt-4 max-w-xl text-lg text-dust">
        Nine AI agents investigate unusual stars in Kepler data and rank what
        deserves a closer look.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="panel glow-ion rounded-3xl p-6">
          <p className="text-sm text-dust">Kepler-8</p>
          <p className="font-display mt-1 text-3xl text-ion">0.91</p>
          <p className="mt-2 text-sm text-starlight">Anomaly score</p>
        </div>
        <div className="panel glow-ember rounded-2xl p-6">
          <p className="text-sm text-dust">Kepler-90</p>
          <p className="font-display mt-1 text-3xl text-ember">0.46</p>
          <p className="mt-2 text-sm text-starlight">Priority score</p>
        </div>
      </div>
    </main>
  );
}