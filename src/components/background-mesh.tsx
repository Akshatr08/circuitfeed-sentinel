export function BackgroundMesh() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
      <svg className="h-full w-full" viewBox="0 0 1200 900" preserveAspectRatio="none">
        <g stroke="var(--line)" strokeWidth="1">
          <path d="M0 120 L280 60 L520 180 L820 90 L1200 150" fill="none" />
          <path d="M0 320 L220 260 L460 360 L760 280 L1200 340" fill="none" />
          <path d="M0 540 L260 470 L560 610 L900 500 L1200 560" fill="none" />
          <path d="M0 760 L300 680 L620 810 L940 700 L1200 760" fill="none" />
          <path d="M120 0 L260 220 L180 460 L300 720 L260 900" fill="none" />
          <path d="M520 0 L480 220 L620 460 L560 700 L660 900" fill="none" />
          <path d="M980 0 L900 220 L1040 420 L980 680 L1080 900" fill="none" />
        </g>
      </svg>
    </div>
  );
}
