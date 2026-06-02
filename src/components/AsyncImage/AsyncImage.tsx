"use client";

/**
 * `<AsyncImage>` — SwiftUI's load-from-URL primitive (C1 §7).
 *
 * Spec: teardowns/SWIFTUI_C1_content-primitives.md §7 (`SwiftUI.swiftinterface:14266`).
 *
 *   AsyncImage(url: URL?, scale: 1)                            // solid placeholder → img
 *   AsyncImage(url:) { image in … } placeholder: { … }        // success/placeholder split
 *   AsyncImage(url:, transaction:) { phase in … }             // full phase control
 *
 * A small state machine drives three phases (`AsyncImagePhase`):
 *   .empty   → loading / not started → neutral gray rounded placeholder (system fill)
 *   .success → decoded image → `<img object-fit:cover>` with opacity fade-in
 *   .failure → load error → empty by default (the phase init can show an error icon)
 *
 * The load is performed via the browser's own `Image()` decoder so the success
 * phase only fires once the bytes are available (mirrors the URLSession fetch).
 * The `transaction` param animates the `.empty → .success` transition; here the
 * default is the CSS opacity fade (`.sui-asyncimage__img.loaded`).
 *
 * "use client" — owns load/phase state.
 */
import * as React from "react";
import styles from "./AsyncImage.module.css";

/** `AsyncImagePhase` (`SwiftUI.swiftinterface:14288`). */
export type AsyncImagePhase =
  | { state: "empty"; image: null; error: null }
  | { state: "success"; image: string; error: null }
  | { state: "failure"; image: null; error: Error };

export interface AsyncImageProps {
  /** `url:` — the image URL to load. Omit/`null` → stays in `.empty`. */
  url?: string | null;
  /**
   * `scale:` — the image's display scale (1 = @1x). Currently informational
   * (the browser handles DPR); kept for API parity.
   */
  scale?: number;
  /**
   * Full phase control (`@ViewBuilder content: (AsyncImagePhase) -> …`).
   * Wins over `content`/`placeholder`. Receives every phase.
   */
  phaseContent?: (phase: AsyncImagePhase) => React.ReactNode;
  /**
   * `content:` (success ViewBuilder) — transforms the loaded image. Receives
   * the resolved URL; default wraps it in a cover-fit `<img>`.
   */
  content?: (image: string) => React.ReactNode;
  /** `placeholder:` — the `.empty` view. Default = the gray fill box. */
  placeholder?: () => React.ReactNode;
  /**
   * `transaction:` — animates the phase transition. `animation:false` disables
   * the default opacity fade-in.
   */
  transaction?: { animation?: boolean };
  className?: string;
  style?: React.CSSProperties;
}

const EMPTY: AsyncImagePhase = { state: "empty", image: null, error: null };

export function AsyncImage({
  url,
  scale,
  phaseContent,
  content,
  placeholder,
  transaction,
  className,
  style,
}: AsyncImageProps): React.ReactElement {
  const [phase, setPhase] = React.useState<AsyncImagePhase>(EMPTY);
  // Avoid the `scale`-unused lint while keeping it part of the public API.
  void scale;

  React.useEffect(() => {
    if (url == null || url === "") {
      setPhase(EMPTY);
      return;
    }
    let cancelled = false;
    setPhase(EMPTY);
    const img = new globalThis.Image();
    img.onload = () => {
      if (!cancelled) setPhase({ state: "success", image: url, error: null });
    };
    img.onerror = () => {
      if (!cancelled)
        setPhase({
          state: "failure",
          image: null,
          error: new Error(`AsyncImage failed to load: ${url}`),
        });
    };
    img.src = url;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [url]);

  const rootClassName =
    [styles.asyncImage, className].filter(Boolean).join(" ") || undefined;

  // Full phase-control init wins.
  if (phaseContent) {
    return (
      <div className={rootClassName} style={style}>
        {phaseContent(phase)}
      </div>
    );
  }

  // success/placeholder split (or 1-arg default).
  let body: React.ReactNode;
  if (phase.state === "success") {
    body = content ? (
      content(phase.image)
    ) : (
      <img
        className={[
          styles.img,
          transaction?.animation === false ? styles.noFade : styles.loaded,
        ]
          .filter(Boolean)
          .join(" ")}
        src={phase.image}
        alt=""
      />
    );
  } else {
    // .empty AND .failure both fall back to the placeholder in the simple inits
    // (the 1-arg init shows the gray box on failure; matches SwiftUI behavior).
    body = placeholder ? (
      placeholder()
    ) : (
      <div className={styles.placeholder} aria-hidden="true" />
    );
  }

  return (
    <div className={rootClassName} style={style} data-phase={phase.state}>
      {body}
    </div>
  );
}

AsyncImage.displayName = "AsyncImage";
