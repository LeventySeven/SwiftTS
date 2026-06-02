"use client";
/**
 * `TimelineView` — `SwiftUI.TimelineView<Schedule, Content>` (SwiftUI :21842).
 *
 *   public struct TimelineView<Schedule, Content> where Schedule : TimelineSchedule {
 *     public struct Context {
 *       public enum Cadence { case live, seconds, minutes }
 *       public let date: Date
 *       public let cadence: Cadence
 *     }
 *     public init(_ schedule: Schedule, content: @escaping (Context) -> Content)
 *   }
 *
 * `TimelineView` re-evaluates its content on a SCHEDULE, handing each evaluation a
 * `Context` carrying the `date` the view is being drawn for. SwiftUI ships
 * several schedules:
 *
 *   .everyMinute                     → fires at the top of each minute
 *   .periodic(from:by:)              → fires every `interval` seconds from a start
 *   .animation(minimumInterval:)     → fires on the display's vsync (≈ per frame)
 *   .explicit(_:)                    → fires at the given list of dates
 *
 * Web mapping. A render-prop component that drives a `date` state on a schedule:
 *
 *   schedule = { every: ms }    → setInterval(ms)              (≈ .periodic)
 *   schedule = "periodic"       → setInterval(1000)            (per second)
 *   schedule = "animation"      → requestAnimationFrame loop   (≈ .animation)
 *
 * The child is a render-prop receiving the current `Date`:
 *
 *   <TimelineView schedule="animation">{(date) => <Clock now={date} />}</TimelineView>
 *
 * SSR-safe: on the server (and the first client render) it renders with `Date(0)`
 * so server and client markup match (no hydration mismatch); the live clock takes
 * over after mount inside an effect. Wraps the output in `<View>` so modifier
 * props still apply to the timeline container.
 */
import * as React from "react";
import { View, type ViewProps } from "../View";

/** A `TimelineSchedule`, expressed in the shapes the web component understands. */
export type TimelineSchedule =
  /** Fire every `every` milliseconds (≈ `.periodic(from:by:)`). */
  | { every: number }
  /** Per-frame updates via `requestAnimationFrame` (≈ `.animation`). */
  | "animation"
  /** Per-second updates (a convenient `.periodic` at 1s). */
  | "periodic";

export interface TimelineViewProps extends Omit<ViewProps, "children"> {
  /** When to re-evaluate `children`. Default `"periodic"` (1s). */
  schedule?: TimelineSchedule;
  /** Render-prop: receives the current `Date` for this evaluation. */
  children: (date: Date) => React.ReactNode;
}

/** Epoch-zero placeholder used for SSR + first paint so markup is deterministic. */
const SSR_DATE = new Date(0);

export const TimelineView = React.forwardRef<HTMLElement, TimelineViewProps>(
  function TimelineView({ schedule = "periodic", children, ...rest }, ref) {
    const [date, setDate] = React.useState<Date>(SSR_DATE);

    React.useEffect(() => {
      // Tick once immediately on mount so we move off the SSR placeholder.
      setDate(new Date());

      if (schedule === "animation") {
        let raf = 0;
        const loop = () => {
          setDate(new Date());
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
      }

      const intervalMs =
        schedule === "periodic"
          ? 1000
          : Math.max(0, (schedule as { every: number }).every);
      const id = setInterval(() => setDate(new Date()), intervalMs);
      return () => clearInterval(id);
      // Re-arm when the schedule identity changes.
    }, [schedule === "animation" ? "animation" : schedule === "periodic" ? "periodic" : (schedule as { every: number }).every]);

    return (
      <View ref={ref} {...rest}>
        {children(date)}
      </View>
    );
  },
);

TimelineView.displayName = "TimelineView";
