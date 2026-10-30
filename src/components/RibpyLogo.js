/**
 * RiBpy maker mark: a gradient tile with a drawn "R" and a spark, plus the
 * wordmark. Links to the RiBpy GitHub profile. The tile tilts and a shine
 * sweeps across it on hover.
 */
export default function RibpyLogo({ className = "" }) {
  return (
    <a
      href="https://github.com/RiBpy"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="RiBpy on GitHub"
      className={`ribpy-logo group inline-flex items-center gap-2 ${className}`}
    >
      <span className="ribpy-mark relative grid h-8 w-8 place-items-center overflow-hidden rounded-[10px] bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-600 shadow-md shadow-teal-600/30 ring-1 ring-white/20">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 20V4h6a4.5 4.5 0 0 1 0 9H7" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12.5 13 18 20" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M20.6 1.8v3.4M18.9 3.5h3.4" stroke="#fde68a" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>
      <span className="text-[15px] font-bold tracking-tight text-slate-900">
        Ri<span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-sky-500 bg-clip-text text-transparent">Bpy</span>
      </span>
    </a>
  );
}
