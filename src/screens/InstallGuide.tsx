export default function InstallGuide({ onSkip }: { onSkip: () => void }) {
  return (
    <div className="screen fade-in" style={{ paddingTop: 24 }}>
      <div className="brandmark">
        <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" />
        <div className="eyebrow">Nibbles &amp; Bits</div>
      </div>
      <h1>First, put me on your home screen</h1>
      <p className="muted">
        On iPhone, an app on your home screen keeps its own storage, separate from Safari. Install first, then do setup
        from the new icon so everything you log stays put.
      </p>
      <ol className="card stack" style={{ paddingLeft: 38, margin: 0 }}>
        <li>
          Tap the <strong>Share</strong> button at the bottom of Safari (the square with an arrow pointing up).
        </li>
        <li>
          Scroll down and tap <strong>Add to Home Screen</strong>.
        </li>
        <li>
          Tap <strong>Add</strong>, then open <strong>Nibbles</strong> from your home screen.
        </li>
      </ol>
      <button className="btn secondary block" onClick={onSkip}>
        Continue in the browser anyway
      </button>
    </div>
  )
}
