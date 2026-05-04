type CallControlsProps = {
  muted: boolean;
  onMuteToggle: () => void;
  onStop: () => void;
};

export function CallControls({ muted, onMuteToggle, onStop }: CallControlsProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Mute / Unmute */}
      <button
        onClick={onMuteToggle}
        className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors duration-150
          ${muted
            ? "bg-red-600 hover:bg-red-500 text-zinc-50"
            : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
          }`}
      >
        {muted ? (
          /* Microphone-off icon */
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
            aria-hidden="true"
          >
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        ) : (
          /* Microphone icon */
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
            aria-hidden="true"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
        {muted ? "Unmute" : "Mute"}
      </button>

      {/* End call */}
      <button
        onClick={onStop}
        className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium bg-red-600 hover:bg-red-500 text-zinc-50 transition-colors duration-150"
      >
        {/* Phone-off / stop icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4"
          aria-hidden="true"
        >
          <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 2 2 0 0 1-.45-2.11 12.84 12.84 0 0 0-.7-2.81" />
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M3.57 3.57A19.79 19.79 0 0 0 2.21 8.7 2 2 0 0 0 4 10.68" />
        </svg>
        End call
      </button>
    </div>
  );
}
