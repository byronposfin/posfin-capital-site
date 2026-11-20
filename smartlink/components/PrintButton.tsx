"use client";
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-300 bg-white px-3.5 text-[13.5px] font-semibold text-slate-700">
      Print
    </button>
  );
}
