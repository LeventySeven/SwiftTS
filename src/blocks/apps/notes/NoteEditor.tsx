"use client";
/**
 * `<NoteEditor>` — column 3 of the macOS Apple Notes app.
 *
 * The open note as a sheet of "paper": a centered date stamp, the bold title
 * line, then the body rendered from the note's block list (paragraphs, headings,
 * checklists with toggleable yellow circles, bulleted lists, tables). On macOS
 * the formatting controls live in the window toolbar — there is no secondary
 * format bar above the paper — so the editor is just the scrollable sheet. When
 * no note is selected it shows the empty state.
 *
 * Local state: checkbox toggles for the rendered checklists (so the paper feels
 * live). Carries "use client".
 */
import * as React from "react";
import { SymbolGlyph } from "../../../components/controls/SymbolGlyph";
import type { Note, NoteBlock } from "./data";
import styles from "./notes.module.css";

export interface NoteEditorProps {
  note?: Note;
}

/** A live checklist block — circles toggle locally. */
function Checklist({
  items,
}: {
  items: { text: string; done?: boolean }[];
}): React.ReactElement {
  const [state, setState] = React.useState<boolean[]>(
    () => items.map((i) => Boolean(i.done)),
  );
  // Re-seed when the note (and thus items) changes identity.
  React.useEffect(() => {
    setState(items.map((i) => Boolean(i.done)));
  }, [items]);

  return (
    <ul className={styles.checklist}>
      {items.map((item, i) => {
        const on = state[i];
        return (
          <li key={i} className={styles.checkItem}>
            <span
              role="checkbox"
              aria-checked={on}
              tabIndex={0}
              className={`${styles.checkBox} ${on ? styles.checkBoxOn : ""}`}
              onClick={() =>
                setState((s) => s.map((v, j) => (j === i ? !v : v)))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setState((s) => s.map((v, j) => (j === i ? !v : v)));
                }
              }}
            >
              {on ? <SymbolGlyph name="checkmark" size={11} weight="bold" /> : null}
            </span>
            <span className={on ? styles.checkLabelDone : undefined}>
              {item.text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Render a single body block. */
function Block({ block }: { block: NoteBlock }): React.ReactElement {
  switch (block.kind) {
    case "heading":
      return <h2 className={styles.heading}>{block.text}</h2>;
    case "paragraph":
      return <p>{block.text}</p>;
    case "checklist":
      return <Checklist items={block.items} />;
    case "bullets":
      return (
        <ul className={styles.bullets}>
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className={styles.tableWrap}>
          <table className={styles.notesTable}>
            <thead>
              <tr>
                {block.headers.map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function NoteEditor({ note }: NoteEditorProps): React.ReactElement {
  if (!note) {
    return (
      <div className={styles.editor}>
        <div className={styles.empty}>
          <span className={styles.emptyGlyph}>
            <SymbolGlyph name="note.text" size={52} weight="regular" />
          </span>
          <span className={styles.emptyText}>No Note Selected</span>
        </div>
      </div>
    );
  }

  return (
    <article className={styles.editor} aria-label={note.title}>
      <div className={styles.paper}>
        <div className={styles.paperInner}>
          {note.fullDate ? (
            <div className={styles.paperDate}>{note.fullDate}</div>
          ) : null}
          <h1 className={styles.docTitle}>{note.title}</h1>
          <div className={styles.bodyText}>
            {note.body.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

NoteEditor.displayName = "NoteEditor";
