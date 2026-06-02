"use client";
/**
 * The searchable system — SwiftUI's `.searchable(text:)` family, ported to React.
 *
 * SwiftUI authoritative API (arm64e-apple-macos.swiftinterface):
 *   View.searchable(text: Binding<String>, placement: SearchFieldPlacement = .automatic,
 *                   prompt: Text? = nil)                                     (SwiftUI:5657)
 *   View.searchable(text:isPresented:placement:prompt:)                     (SwiftUI:5675)
 *   View.searchScopes(_ scope: Binding<V>, scopes: () -> S)                 (SwiftUI:2447)
 *   View.searchScopes(_ scope:activation:scopes:)                          (SwiftUI:2470)
 *   View.searchSuggestions(_ suggestions: () -> S)                          (SwiftUI:10645)
 *   View.searchCompletion(_:) / EnvironmentValues.isSearching / dismissSearch
 *   struct SearchFieldPlacement { automatic, toolbar, sidebar,
 *                                 navigationBarDrawer(displayMode:) }       (SwiftUI:9115)
 *
 * The web mapping. SwiftUI threads search state through the environment so a
 * deeply-nested row can read `@Environment(\.isSearching)` and call
 * `@Environment(\.dismissSearch)`. We reproduce that exactly with a
 * `SearchContext` (React context) seeded by `useSearchable(...)`, and surface the
 * `<SearchField>` view (the iOS rounded search bar) plus the `searchScopes`
 * (segmented scope picker) and `searchSuggestions` hooks.
 *
 * The binding contract follows the rest of the kit: `{ text, onChange }` rather
 * than a `Binding<String>` object (see TextField.tsx). `placement`/`prompt`
 * mirror SwiftUI 1:1.
 *
 * SSR-safe: all stateful work is in hooks/effects; importing the module renders
 * nothing on the server. "use client".
 */
import * as React from "react";
import { SymbolGlyph } from "../components/controls/SymbolGlyph";
import styles from "./search.module.css";

/* =============================================================================
 * Placement & activation — `SearchFieldPlacement` (SwiftUI:9115)
 * ========================================================================== */

/**
 * `SwiftUI.SearchFieldPlacement`. On the web there is no navigation chrome to
 * dock into, so these are advisory: `toolbar`/`navigationBarDrawer` render the
 * bar at the top of the searchable region, `sidebar` renders it inline. They are
 * preserved so call sites read 1:1 with SwiftUI and a host can position the bar.
 */
export type SearchFieldPlacement =
  | "automatic"
  | "toolbar"
  | "toolbarPrincipal"
  | "sidebar"
  | "navigationBarDrawer"
  | "navigationBarDrawerAlways";

/** `SearchScopeActivation` — when the scope bar reveals (SwiftUI:2470). */
export type SearchScopeActivation = "automatic" | "onTextEntry" | "onSearchPresentation";

/* =============================================================================
 * Scopes — `searchScopes(_:scopes:)` (SwiftUI:2447)
 * ========================================================================== */

/** One option in the search-scope segmented control. */
export interface SearchScope<Scope extends string = string> {
  /** The bound scope value (`@Hashable` in SwiftUI). */
  value: Scope;
  /** Visible segment title. */
  label: React.ReactNode;
}

/* =============================================================================
 * Suggestions — `searchSuggestions(_:)` / `searchCompletion(_:)` (SwiftUI:10645)
 * ========================================================================== */

/** A search suggestion row. Selecting it commits `completion` (or `text`). */
export interface SearchSuggestion {
  /** Stable identity for list diffing. */
  id?: string | number;
  /** Visible suggestion text/content. */
  text: React.ReactNode;
  /**
   * `.searchCompletion(_:)` — the string that REPLACES the query when chosen.
   * When omitted, choosing the row commits the row's plain string `text`.
   */
  completion?: string;
  /** Optional leading SF Symbol name (rendered via SymbolGlyph). */
  systemImage?: string;
}

/* =============================================================================
 * SearchContext — the environment carrier (`isSearching` / `dismissSearch`)
 * ========================================================================== */

export interface SearchContextValue<Scope extends string = string> {
  /** Current query text. */
  text: string;
  /** Commit a new query (drives the binding). */
  setText: (s: string) => void;
  /** `@Environment(\.isSearching)` — true while the field is focused/non-empty. */
  isSearching: boolean;
  /** `@Environment(\.dismissSearch)` — clears + blurs the field. */
  dismissSearch: () => void;
  /** Prompt/placeholder string. */
  prompt?: string;
  /** Resolved placement. */
  placement: SearchFieldPlacement;
  /** Active scope value (when `searchScopes` is in use). */
  scope?: Scope;
  /** Change the active scope. */
  setScope: (s: Scope) => void;
  /** Registered scopes. */
  scopes: ReadonlyArray<SearchScope<Scope>>;
  /** Register the scope set (called by `useSearchScopes`). */
  registerScopes: (scopes: ReadonlyArray<SearchScope<Scope>>, activation?: SearchScopeActivation) => void;
  /** When the scope bar should reveal. */
  scopeActivation: SearchScopeActivation;
  /** Registered suggestions. */
  suggestions: ReadonlyArray<SearchSuggestion>;
  /** Register/replace the suggestion set (called by `useSearchSuggestions`). */
  registerSuggestions: (suggestions: ReadonlyArray<SearchSuggestion>) => void;
  /** Mark the field focused (internal, used by `<SearchField>`). */
  _setFocused: (focused: boolean) => void;
}

const SearchContext = React.createContext<SearchContextValue | null>(null);

/**
 * `@Environment(\.isSearching)` + `@Environment(\.dismissSearch)`. Returns `null`
 * outside a searchable region (so nested rows can guard). Use `useSearchState`
 * for a non-null guaranteed value inside the region.
 */
export function useSearchContext<Scope extends string = string>():
  | SearchContextValue<Scope>
  | null {
  return React.useContext(SearchContext) as SearchContextValue<Scope> | null;
}

/** Like `useSearchContext` but throws when used outside a searchable region. */
export function useSearchState<Scope extends string = string>(): SearchContextValue<Scope> {
  const ctx = useSearchContext<Scope>();
  if (ctx == null) {
    throw new Error(
      "useSearchState must be used inside a <Searchable> region (the value returned by useSearchable).",
    );
  }
  return ctx;
}

/** `@Environment(\.isSearching)` convenience selector. */
export function useIsSearching(): boolean {
  return useSearchContext()?.isSearching ?? false;
}

/** `@Environment(\.dismissSearch)` convenience selector. */
export function useDismissSearch(): () => void {
  const ctx = useSearchContext();
  return ctx?.dismissSearch ?? (() => {});
}

/* =============================================================================
 * useSearchable — `.searchable(text:placement:prompt:)` (SwiftUI:5657)
 * ========================================================================== */

export interface UseSearchableOptions<Scope extends string = string> {
  /** ⇄ `text: Binding<String>` — current query. */
  text: string;
  /** ⇄ the binding setter. */
  onChange: (s: string) => void;
  /** ⇄ `placement:` (default `.automatic`). */
  placement?: SearchFieldPlacement;
  /** ⇄ `prompt:` — placeholder text (Text? / LocalizedStringKey collapsed to a string). */
  prompt?: string;
  /**
   * ⇄ `isPresented: Binding<Bool>` (SwiftUI:5675). Controlled presentation of the
   * field. When provided, `useSearchable` reflects/drives it via `onPresented`.
   */
  isPresented?: boolean;
  /** Setter paired with `isPresented`. */
  onPresentedChange?: (presented: boolean) => void;
}

export interface UseSearchableResult<Scope extends string = string> {
  /** The context value to feed a `<SearchContext.Provider>` (use `Provider`). */
  context: SearchContextValue<Scope>;
  /** A ready-made provider component wrapping the searchable region. */
  Provider: React.FC<{ children: React.ReactNode }>;
  /** Props to spread on a `<SearchField>` (text + handlers wired to the binding). */
  fieldProps: SearchFieldProps;
  /** `@Environment(\.isSearching)`. */
  isSearching: boolean;
  /** `@Environment(\.dismissSearch)`. */
  dismissSearch: () => void;
}

/**
 * Builds the search state machine for a region. Returns the `SearchContextValue`,
 * a `Provider` that publishes it to descendants, and `fieldProps` to drop onto a
 * `<SearchField>`. Mirrors `.searchable(text:placement:prompt:)`.
 */
export function useSearchable<Scope extends string = string>(
  opts: UseSearchableOptions<Scope>,
): UseSearchableResult<Scope> {
  const { text, onChange, placement = "automatic", prompt, isPresented, onPresentedChange } = opts;

  const [focused, setFocused] = React.useState(false);
  const [scope, setScopeState] = React.useState<Scope | undefined>(undefined);
  const [scopes, setScopes] = React.useState<ReadonlyArray<SearchScope<Scope>>>([]);
  const [scopeActivation, setScopeActivation] = React.useState<SearchScopeActivation>("automatic");
  const [suggestions, setSuggestions] = React.useState<ReadonlyArray<SearchSuggestion>>([]);

  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const onPresentedRef = React.useRef(onPresentedChange);
  onPresentedRef.current = onPresentedChange;

  // `isSearching` is true while focused OR the query is non-empty (the iOS rule:
  // the field stays "searching" while a query is present even after blur).
  const isSearching = focused || text.length > 0 || isPresented === true;

  const setText = React.useCallback((s: string) => {
    onChangeRef.current(s);
  }, []);

  const dismissSearch = React.useCallback(() => {
    onChangeRef.current("");
    setFocused(false);
    onPresentedRef.current?.(false);
  }, []);

  const setScope = React.useCallback((s: Scope) => setScopeState(s), []);

  const registerScopes = React.useCallback(
    (next: ReadonlyArray<SearchScope<Scope>>, activation?: SearchScopeActivation) => {
      setScopes(next);
      if (activation) setScopeActivation(activation);
      // default the active scope to the first registered scope
      setScopeState((cur) => (cur == null && next.length > 0 ? next[0]!.value : cur));
    },
    [],
  );

  const registerSuggestions = React.useCallback(
    (next: ReadonlyArray<SearchSuggestion>) => setSuggestions(next),
    [],
  );

  const _setFocused = React.useCallback(
    (f: boolean) => {
      setFocused(f);
      if (f) onPresentedRef.current?.(true);
    },
    [],
  );

  const context = React.useMemo<SearchContextValue<Scope>>(
    () => ({
      text,
      setText,
      isSearching,
      dismissSearch,
      prompt,
      placement,
      scope,
      setScope,
      scopes,
      registerScopes,
      scopeActivation,
      suggestions,
      registerSuggestions,
      _setFocused,
    }),
    [
      text,
      setText,
      isSearching,
      dismissSearch,
      prompt,
      placement,
      scope,
      setScope,
      scopes,
      registerScopes,
      scopeActivation,
      suggestions,
      registerSuggestions,
      _setFocused,
    ],
  );

  const Provider = React.useMemo<React.FC<{ children: React.ReactNode }>>(() => {
    const Comp: React.FC<{ children: React.ReactNode }> = ({ children }) =>
      React.createElement(
        SearchContext.Provider,
        { value: context as unknown as SearchContextValue },
        children,
      );
    Comp.displayName = "SearchableProvider";
    return Comp;
    // re-create only when context identity changes
  }, [context]);

  const fieldProps: SearchFieldProps = {
    text,
    onChange,
    prompt,
    placement,
    onFocusChange: _setFocused,
    onDismiss: dismissSearch,
  };

  return { context, Provider, fieldProps, isSearching, dismissSearch };
}

/* =============================================================================
 * useSearchScopes — `.searchScopes(_:scopes:)` (SwiftUI:2447)
 * ========================================================================== */

export interface UseSearchScopesOptions<Scope extends string = string> {
  /** The scope segments. */
  scopes: ReadonlyArray<SearchScope<Scope>>;
  /** ⇄ `activation:` — when the scope bar reveals (SwiftUI:2470). */
  activation?: SearchScopeActivation;
}

/**
 * Registers a scope set with the enclosing searchable region and returns the
 * active scope + setter and a ready-made `<SearchScopesBar>` segmented picker.
 * Mirrors `.searchScopes(_:scopes:)`.
 */
export function useSearchScopes<Scope extends string = string>(
  options: UseSearchScopesOptions<Scope>,
): {
  scope: Scope | undefined;
  setScope: (s: Scope) => void;
  ScopesBar: React.FC;
} {
  const ctx = useSearchState<Scope>();
  const { scopes, activation = "automatic" } = options;

  // register on mount / when the scope set changes
  const sig = JSON.stringify(scopes.map((s) => s.value));
  React.useEffect(() => {
    ctx.registerScopes(scopes, activation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, activation]);

  const ScopesBar = React.useMemo<React.FC>(() => {
    const Comp: React.FC = () =>
      React.createElement(SearchScopesBar as React.FC<SearchScopesBarProps<Scope>>, {
        scopes,
        scope: ctx.scope,
        onChange: ctx.setScope,
        activation,
        visible: scopeBarVisible(activation, ctx.isSearching, ctx.text.length > 0),
      });
    Comp.displayName = "SearchScopesBarBound";
    return Comp;
  }, [scopes, ctx.scope, ctx.setScope, ctx.isSearching, ctx.text, activation]);

  return { scope: ctx.scope, setScope: ctx.setScope, ScopesBar };
}

function scopeBarVisible(
  activation: SearchScopeActivation,
  isSearching: boolean,
  hasText: boolean,
): boolean {
  switch (activation) {
    case "onTextEntry":
      return hasText;
    case "onSearchPresentation":
      return isSearching;
    case "automatic":
    default:
      return isSearching;
  }
}

/* =============================================================================
 * useSearchSuggestions — `.searchSuggestions(_:)` (SwiftUI:10645)
 * ========================================================================== */

/**
 * Registers a suggestion list with the enclosing searchable region. Selecting a
 * suggestion commits its `completion` (or plain `text`) into the query, mirroring
 * `.searchCompletion(_:)`. Returns the live suggestion list + a bound dropdown.
 */
export function useSearchSuggestions(
  suggestions: ReadonlyArray<SearchSuggestion>,
): {
  suggestions: ReadonlyArray<SearchSuggestion>;
  commit: (s: SearchSuggestion) => void;
  SuggestionsList: React.FC;
} {
  const ctx = useSearchState();

  const sig = JSON.stringify(
    suggestions.map((s) => [s.id, s.completion, typeof s.text === "string" ? s.text : ""]),
  );
  React.useEffect(() => {
    ctx.registerSuggestions(suggestions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const commit = React.useCallback(
    (s: SearchSuggestion) => {
      const next = s.completion ?? (typeof s.text === "string" ? s.text : ctx.text);
      ctx.setText(next);
    },
    [ctx],
  );

  const SuggestionsList = React.useMemo<React.FC>(() => {
    const Comp: React.FC = () =>
      ctx.isSearching && suggestions.length > 0
        ? React.createElement(SearchSuggestionsList, { suggestions, onSelect: commit })
        : null;
    Comp.displayName = "SearchSuggestionsListBound";
    return Comp;
  }, [ctx.isSearching, suggestions, commit]);

  return { suggestions, commit, SuggestionsList };
}

/* =============================================================================
 * <SearchField> — the iOS search bar
 * ========================================================================== */

export interface SearchFieldProps {
  /** ⇄ `text` binding value. */
  text: string;
  /** ⇄ binding setter. */
  onChange: (s: string) => void;
  /** ⇄ `prompt:` placeholder. */
  prompt?: string;
  /** ⇄ `placement:` (advisory positioning on web). */
  placement?: SearchFieldPlacement;
  /** Fired when the field gains/loses focus (drives `isSearching`). */
  onFocusChange?: (focused: boolean) => void;
  /** Fired when Cancel/clear dismisses the search. */
  onDismiss?: () => void;
  /** Auto-focus on mount (e.g. for a `.searchable(isPresented:)` sheet). */
  autoFocus?: boolean;
  /** Show the trailing "Cancel" button when focused (iOS nav-bar behavior). */
  showsCancelButton?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The rounded iOS search bar: a `magnifyingglass` leading glyph, the query input,
 * an `xmark.circle.fill` clear button (when non-empty), and an optional trailing
 * Cancel button that appears while focused. Pure controlled input — drives the
 * `{ text, onChange }` binding. SSR-safe.
 */
export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  function SearchField(
    {
      text,
      onChange,
      prompt = "Search",
      placement = "automatic",
      onFocusChange,
      onDismiss,
      autoFocus,
      showsCancelButton = true,
      className,
      style,
    },
    forwardedRef,
  ) {
    const innerRef = React.useRef<HTMLInputElement | null>(null);
    const setRef = React.useCallback(
      (el: HTMLInputElement | null) => {
        innerRef.current = el;
        if (typeof forwardedRef === "function") forwardedRef(el);
        else if (forwardedRef) forwardedRef.current = el;
      },
      [forwardedRef],
    );

    const [focused, setFocused] = React.useState(false);

    React.useEffect(() => {
      if (autoFocus) innerRef.current?.focus();
    }, [autoFocus]);

    const clear = React.useCallback(() => {
      onChange("");
      innerRef.current?.focus();
    }, [onChange]);

    const cancel = React.useCallback(() => {
      onChange("");
      setFocused(false);
      onFocusChange?.(false);
      innerRef.current?.blur();
      onDismiss?.();
    }, [onChange, onFocusChange, onDismiss]);

    const showCancel = showsCancelButton && (focused || text.length > 0);

    return React.createElement(
      "div",
      {
        className: className ? `${styles.searchBar} ${className}` : styles.searchBar,
        "data-placement": placement,
        "data-searching": focused || text.length > 0 ? "" : undefined,
        style,
        role: "search",
      },
      React.createElement(
        "div",
        { className: styles.field },
        React.createElement(SymbolGlyph, {
          name: "magnifyingglass",
          className: styles.searchIcon,
          "aria-hidden": true,
        } as React.ComponentProps<typeof SymbolGlyph>),
        React.createElement("input", {
          ref: setRef,
          type: "search",
          className: styles.input,
          value: text,
          placeholder: prompt,
          // suppress the native WebKit clear button — we render our own
          autoComplete: "off",
          autoCorrect: "off",
          spellCheck: false,
          "aria-label": prompt,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
          onFocus: () => {
            setFocused(true);
            onFocusChange?.(true);
          },
          onBlur: () => {
            setFocused(false);
            onFocusChange?.(false);
          },
          onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Escape") cancel();
          },
        }),
        text.length > 0
          ? React.createElement(
              "button",
              {
                type: "button",
                className: styles.clearButton,
                "aria-label": "Clear search",
                // onMouseDown (not onClick) so the input doesn't blur first
                onMouseDown: (e: React.MouseEvent) => {
                  e.preventDefault();
                  clear();
                },
              },
              React.createElement(SymbolGlyph, {
                name: "xmark.circle.fill",
                "aria-hidden": true,
              } as React.ComponentProps<typeof SymbolGlyph>),
            )
          : null,
      ),
      showCancel
        ? React.createElement(
            "button",
            {
              type: "button",
              className: styles.cancelButton,
              onMouseDown: (e: React.MouseEvent) => {
                e.preventDefault();
                cancel();
              },
            },
            "Cancel",
          )
        : null,
    );
  },
);

SearchField.displayName = "SearchField";

/* =============================================================================
 * <SearchScopesBar> — segmented scope picker
 * ========================================================================== */

interface SearchScopesBarProps<Scope extends string = string> {
  scopes: ReadonlyArray<SearchScope<Scope>>;
  scope: Scope | undefined;
  onChange: (s: Scope) => void;
  activation?: SearchScopeActivation;
  /** Whether the bar is currently revealed (per activation rule). */
  visible?: boolean;
}

/** The segmented control that picks the active search scope. */
export function SearchScopesBar<Scope extends string = string>({
  scopes,
  scope,
  onChange,
  visible = true,
}: SearchScopesBarProps<Scope>): React.ReactElement | null {
  if (!visible || scopes.length === 0) return null;
  return React.createElement(
    "div",
    { className: styles.scopesBar, role: "tablist", "aria-label": "Search scopes" },
    scopes.map((s) =>
      React.createElement(
        "button",
        {
          key: String(s.value),
          type: "button",
          role: "tab",
          "aria-selected": s.value === scope,
          className:
            s.value === scope ? `${styles.scopeSegment} ${styles.scopeSelected}` : styles.scopeSegment,
          onClick: () => onChange(s.value),
        },
        s.label,
      ),
    ),
  );
}

/* =============================================================================
 * <SearchSuggestionsList> — the suggestions dropdown
 * ========================================================================== */

interface SearchSuggestionsListProps {
  suggestions: ReadonlyArray<SearchSuggestion>;
  onSelect: (s: SearchSuggestion) => void;
}

/** The dropdown of `.searchSuggestions(_:)` rows. */
export function SearchSuggestionsList({
  suggestions,
  onSelect,
}: SearchSuggestionsListProps): React.ReactElement | null {
  if (suggestions.length === 0) return null;
  return React.createElement(
    "ul",
    { className: styles.suggestions, role: "listbox" },
    suggestions.map((s, i) =>
      React.createElement(
        "li",
        {
          key: s.id ?? i,
          role: "option",
          className: styles.suggestionRow,
          onMouseDown: (e: React.MouseEvent) => {
            e.preventDefault();
            onSelect(s);
          },
        },
        s.systemImage
          ? React.createElement(SymbolGlyph, {
              name: s.systemImage,
              className: styles.suggestionIcon,
              "aria-hidden": true,
            } as React.ComponentProps<typeof SymbolGlyph>)
          : null,
        React.createElement("span", { className: styles.suggestionText }, s.text),
      ),
    ),
  );
}

/* =============================================================================
 * <Searchable> — convenience wrapper that wires it all together
 * ========================================================================== */

export interface SearchableProps<Scope extends string = string>
  extends UseSearchableOptions<Scope> {
  /** Optional scopes — renders a `<SearchScopesBar>` under the field. */
  scopes?: ReadonlyArray<SearchScope<Scope>>;
  /** Optional `activation:` for the scope bar. */
  scopeActivation?: SearchScopeActivation;
  /** Bound active scope (controlled). */
  scope?: Scope;
  /** Setter paired with `scope`. */
  onScopeChange?: (s: Scope) => void;
  /** Optional live suggestions (renders a dropdown while searching). */
  suggestions?: ReadonlyArray<SearchSuggestion>;
  /** The searchable content; can read `useIsSearching()` / `useSearchContext()`. */
  children?: React.ReactNode;
}

/**
 * One-shot `.searchable(...)` region: renders the `<SearchField>` (+ optional
 * scope bar and suggestions) above `children`, and publishes the search
 * environment so descendants can read `useIsSearching()` / `useSearchContext()`.
 */
export function Searchable<Scope extends string = string>(
  props: SearchableProps<Scope>,
): React.ReactElement {
  const {
    scopes,
    scopeActivation = "automatic",
    scope,
    onScopeChange,
    suggestions,
    children,
    ...searchable
  } = props;

  const { context, Provider, fieldProps } = useSearchable<Scope>(searchable);

  // sync controlled scope / scope registration without a child hook
  React.useEffect(() => {
    if (scopes && scopes.length > 0) context.registerScopes(scopes, scopeActivation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopes && JSON.stringify(scopes.map((s) => s.value)), scopeActivation]);
  React.useEffect(() => {
    if (scope != null) context.setScope(scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);
  React.useEffect(() => {
    if (suggestions) context.registerSuggestions(suggestions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions && suggestions.length]);

  const activeScope = scope ?? context.scope;
  const setScope = onScopeChange ?? context.setScope;

  return React.createElement(
    Provider,
    null,
    React.createElement(SearchField, fieldProps),
    scopes && scopes.length > 0
      ? React.createElement(SearchScopesBar as React.FC<SearchScopesBarProps<Scope>>, {
          scopes,
          scope: activeScope,
          onChange: setScope,
          activation: scopeActivation,
          visible: scopeBarVisible(scopeActivation, context.isSearching, context.text.length > 0),
        })
      : null,
    suggestions && suggestions.length > 0 && context.isSearching
      ? React.createElement(SearchSuggestionsList, {
          suggestions,
          onSelect: (s: SearchSuggestion) => context.setText(s.completion ?? (typeof s.text === "string" ? s.text : context.text)),
        })
      : null,
    children,
  );
}

export { SearchContext };
