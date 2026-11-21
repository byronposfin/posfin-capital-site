import { useEffect, useState } from "react";
import FormRunner from "@/components/FormRunner";
import type { Boot } from "@/lib/boot-types";
import { parseRoute } from "@/lib/route";
import { StatementView } from "./statements";

export function App() {
  const [route] = useState(() => parseRoute(window.location.pathname));
  const [boot, setBoot] = useState<Boot | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!route) return;
    const q = window.location.search || "";
    let cancelled = false;
    fetch(`/api/forms/${route.form}/${encodeURIComponent(route.token)}${q}`, { headers: { accept: "application/json" } })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(r.status === 404 ? "This link is not valid." : "We couldn’t open this form. Please try the link again.");
        return j.boot as Boot;
      })
      .then((b) => { if (!cancelled) setBoot(b); })
      .catch((e: Error) => { if (!cancelled) setError(e.message || "We couldn’t open this form."); });
    return () => { cancelled = true; };
  }, [route]);

  if (!route) {
    return <p className="mx-auto max-w-xl p-8 text-[16px] text-[#0A1A33]">This link is not valid.</p>;
  }
  if (error) return <p className="mx-auto max-w-xl p-8 text-[16px] text-[#0A1A33]">{error}</p>;
  if (!boot) return <p className="mx-auto max-w-xl p-8 text-[16px] text-slate-500">Loading…</p>;
  if (route.view === "form") {
    return (
      <FormRunner
        form={route.form}
        token={route.token}
        brandId={boot.brandId}
        caseRef={boot.case.ref}
        demo={boot.case.demo}
        flags={boot.flags}
        prefillSources={boot.prefillSources}
        initial={boot.initial}
        resultHref={boot.resultHref}
        resultLabel={boot.resultLabel}
      />
    );
  }
  return <StatementView form={route.form} token={route.token} boot={boot} />;
}
