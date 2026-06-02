#!/usr/bin/env python3
"""
W0 — SwiftUI inventory parser.
Parses Apple's authoritative .swiftinterface text declarations into a structured
work-list (INVENTORY.json) that drives every downstream workflow (W1-W4).

Tier-1A source: these files ARE the compiled public declarations Apple ships.
"""
import json, re, sys, os
from collections import defaultdict, Counter

SDK = "/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/System/Library/Frameworks"
FILES = {
    "SwiftUICore": f"{SDK}/SwiftUICore.framework/Versions/A/Modules/SwiftUICore.swiftmodule/arm64e-apple-macos.swiftinterface",
    "SwiftUI":     f"{SDK}/SwiftUI.framework/Versions/A/Modules/SwiftUI.swiftmodule/arm64e-apple-macos.swiftinterface",
    "Charts":      f"{SDK}/Charts.framework/Versions/A/Modules/Charts.swiftmodule/arm64e-apple-macos.swiftinterface",
}

STRING_RE = re.compile(r'"(?:\\.|[^"\\])*"')          # strip string literals before brace counting
DECL_RE   = re.compile(r'^\s*(?:@\w+[^\n]*\s+)*'      # leading attributes on same line (rare)
                       r'(?:final\s+|public\s+|nonisolated\s+|@\w+\s+)*'
                       r'(struct|enum|class|protocol|actor|extension)\s+'
                       r'([A-Za-z0-9_.]+)')
FUNC_RE   = re.compile(r'\bpublic\s+(?:static\s+|mutating\s+|nonisolated\s+|@\w+\s+)*func\s+([A-Za-z0-9_]+)')
RETURNS_VIEW_RE = re.compile(r'->\s*some\s+SwiftUICore\.View|->\s*some\s+SwiftUI\.View|->\s*some\s+View')

def strip_strings(line):
    return STRING_RE.sub('""', line)

def brace_delta(line):
    s = strip_strings(line)
    # ignore // line comments
    if '//' in s:
        s = s.split('//', 1)[0]
    return s.count('{') - s.count('}')

def parse_file(module, path):
    with open(path, 'r', errors='replace') as f:
        lines = f.readlines()

    types = []          # top-level type declarations
    extensions = []     # extension blocks (carry modifier funcs)
    depth = 0
    i = 0
    n = len(lines)
    pending_avail = []  # @available attribute lines accumulating before a decl

    while i < n:
        raw = lines[i]
        stripped = raw.strip()

        if depth == 0:
            if stripped.startswith('@available'):
                pending_avail.append(stripped)
            m = DECL_RE.match(raw)
            if m and depth == 0:
                kind, name = m.group(1), m.group(2)
                start = i + 1  # 1-based
                # find matching close brace (block may be `{ ... }` possibly on same line)
                d = brace_delta(raw)
                j = i
                # if no opening brace on this line yet, advance until we see one
                while d <= 0 and '{' not in strip_strings(lines[j]) and j + 1 < n:
                    j += 1
                    d += brace_delta(lines[j])
                # now walk to depth 0
                if '{' in strip_strings(lines[j]) or d > 0:
                    depthn = d if d > 0 else brace_delta(lines[j])
                    if depthn <= 0:
                        depthn = 1
                    k = j
                    # recompute cleanly from start of block
                    depthn = 0
                    k = i
                    started = False
                    while k < n:
                        depthn += brace_delta(lines[k])
                        if '{' in strip_strings(lines[k]):
                            started = True
                        if started and depthn <= 0:
                            break
                        k += 1
                    end = k + 1
                else:
                    end = start
                    k = i

                body = ''.join(lines[i:k+1])
                avail = ' '.join(pending_avail)
                rec = {
                    "kind": kind, "name": name, "module": module,
                    "line_start": start, "line_end": end,
                    "availability": avail[:400],
                }
                if kind == 'extension':
                    # extension target + conformance/where
                    header = lines[i]
                    # grab full header up to '{'
                    h = header
                    kk = i
                    while '{' not in strip_strings(h) and kk + 1 < n:
                        kk += 1
                        h += lines[kk]
                    hb = h.split('{', 1)[0]
                    rec["target"] = name
                    rec["header"] = ' '.join(hb.split())[:300]
                    # modifier funcs returning some View
                    mods = []
                    for fl in lines[i:k+1]:
                        fm = FUNC_RE.search(fl)
                        if fm and RETURNS_VIEW_RE.search(fl):
                            mods.append(fm.group(1))
                    rec["view_modifiers"] = sorted(set(mods))
                    # also count all public funcs (API surface of the extension)
                    rec["public_funcs"] = sorted(set(
                        FUNC_RE.search(fl).group(1) for fl in lines[i:k+1] if FUNC_RE.search(fl)
                    ))
                    extensions.append(rec)
                else:
                    # inheritance clause: between ':' and ('where' or '{')
                    header = ' '.join(body.split('{', 1)[0].split())
                    inh = []
                    if ':' in header:
                        after = header.split(':', 1)[1]
                        after = after.split(' where ')[0]
                        inh = [t.strip() for t in after.split(',') if t.strip()]
                    rec["inherits"] = inh[:12]
                    types.append(rec)
                pending_avail = []
                i = k + 1
                continue
            else:
                if not stripped.startswith('@available'):
                    pending_avail = []
                depth += brace_delta(raw)
                i += 1
                continue
        else:
            depth += brace_delta(raw)
            if depth < 0:
                depth = 0
            i += 1
            continue

    return types, extensions

# ---- classification ----
def conforms(inh, *needles):
    return any(any(nd in x for nd in needles) for x in inh)

def classify(t):
    inh = t.get("inherits", [])
    name = t["name"]
    tags = []
    if conforms(inh, "View") and not name.endswith("Modifier"):
        tags.append("View")
    if name.endswith("Style") or conforms(inh, "ButtonStyle", "ToggleStyle", "PickerStyle",
                                          "ListStyle", "LabelStyle", "MenuStyle", "GaugeStyle",
                                          "ProgressViewStyle", "TextFieldStyle", "DatePickerStyle",
                                          "ControlGroupStyle", "FormStyle", "TableStyle",
                                          "ToolbarStyle", "IndexViewStyle", "TabViewStyle",
                                          "DisclosureGroupStyle", "NavigationViewStyle",
                                          "WindowStyle", "PrimitiveButtonStyle", "ShapeStyle"):
        tags.append("Style")
    if conforms(inh, "Shape", "InsettableShape"):
        tags.append("Shape")
    if conforms(inh, "ViewModifier"):
        tags.append("ViewModifier")
    if conforms(inh, "Gesture"):
        tags.append("Gesture")
    if conforms(inh, "Layout"):
        tags.append("Layout")
    if conforms(inh, "Transition"):
        tags.append("Transition")
    if conforms(inh, "ShapeStyle") and "Style" not in tags:
        tags.append("ShapeStyle")
    return tags

# cluster rules: ordered (name-exact / keyword) -> cluster id
CLUSTERS = {
 "C1":  ("Content primitives", ["Text","Label","Image","AsyncImage","Link","Divider","Spacer","ProgressView","Gauge","SecureField"==None and "" or "n/a"]),
}

# name -> cluster (authoritative for well-known components)
NAME_CLUSTER = {
 # C1 content primitives
 "Text":"C1","Label":"C1","Image":"C1","AsyncImage":"C1","Link":"C1","Divider":"C1",
 "Spacer":"C1","ProgressView":"C1","Gauge":"C1","TextRenderer":"C1","Attachment":"C1",
 # C2 action controls
 "Button":"C2","Toggle":"C2","Menu":"C2","ShareLink":"C2","PasteButton":"C2","RenameButton":"C2",
 "EditButton":"C2","ControlGroup":"C2","HelpLink":"C2","SignInWithAppleButton":"C2",
 # C3 value input
 "TextField":"C3","SecureField":"C3","TextEditor":"C3","Slider":"C3","Stepper":"C3","ColorPicker":"C3",
 # C4 selection
 "Picker":"C4","DatePicker":"C4","MultiDatePicker":"C4",
 # C5 layout stacks
 "VStack":"C5","HStack":"C5","ZStack":"C5","LazyVStack":"C5","LazyHStack":"C5","Grid":"C5",
 "GridRow":"C5","LazyVGrid":"C5","LazyHGrid":"C5","ViewThatFits":"C5","Group":"C5","Section":"C5",
 "GeometryReader":"C5","ViewBuilder":"C5","AnyView":"C5","TupleView":"C5","EquatableView":"C5",
 "GridItem":"C5","_VariadicView":"C5",
 # C6 scroll & collections
 "ScrollView":"C6","List":"C6","Form":"C6","Table":"C6","OutlineGroup":"C6","DisclosureGroup":"C6",
 "ScrollViewReader":"C6","ScrollViewProxy":"C6","TableColumn":"C6","TableRow":"C6","ForEach":"C6",
 # C7 navigation
 "NavigationStack":"C7","NavigationSplitView":"C7","NavigationLink":"C7","TabView":"C7","Tab":"C7",
 "NavigationView":"C7","NavigationPath":"C7","TabSection":"C7","NavigationSplitViewVisibility":"C7",
 # C8 presentation/modal
 "Alert":"C8","ActionSheet":"C8","ContextMenu":"C8","Popover":"C8","PresentationDetent":"C8",
 # C9 shapes & drawing
 "Rectangle":"C9","RoundedRectangle":"C9","Circle":"C9","Ellipse":"C9","Capsule":"C9","Path":"C9",
 "Canvas":"C9","Gradient":"C9","LinearGradient":"C9","RadialGradient":"C9","AngularGradient":"C9",
 "EllipticalGradient":"C9","UnevenRoundedRectangle":"C9","ContainerRelativeShape":"C9",
 "ConcentricRectangle":"C9","AnyShape":"C9","ScaledShape":"C9","RotatedShape":"C9","OffsetShape":"C9",
 "TransformedShape":"C9","GraphicsContext":"C9",
 # C13 gestures
 "TapGesture":"C13","DragGesture":"C13","LongPressGesture":"C13","MagnifyGesture":"C13",
 "RotateGesture":"C13","RotateGesture3D":"C13","MagnificationGesture":"C13","RotationGesture":"C13",
 "SpatialTapGesture":"C13","SequenceGesture":"C13","SimultaneousGesture":"C13","ExclusiveGesture":"C13",
 "GestureState":"C13","AnyGesture":"C13","SpatialEventGesture":"C13",
}

KEYWORD_CLUSTER = [
 # (substring, cluster) — applied to type names not in NAME_CLUSTER
 ("Chart","C14"),("Mark","C14"),("Plot","C14"),("Axis","C14"),
 ("Gesture","C13"),
 ("Gradient","C9"),("Shape","C9"),
 ("Transition","C11"),("Animation","C11"),("Animator","C11"),("Keyframe","C11"),("Spring","C11"),
 ("Material","C12"),("Blur","C12"),("VisualEffect","C12"),
 ("Style","C15"),("Configuration","C15"),
 ("Environment","C16"),("Preference","C16"),("Binding","C16"),("State","C16"),("FocusState","C16"),
]

def assign_cluster(t, tags):
    name = t["name"]
    if name in NAME_CLUSTER:
        return NAME_CLUSTER[name]
    if "Shape" in tags: return "C9"
    if "Gesture" in tags: return "C13"
    if "Transition" in tags: return "C11"
    if "Style" in tags: return "C15"
    if "Layout" in tags: return "C5"
    for sub, cl in KEYWORD_CLUSTER:
        if sub in name:
            return cl
    if "View" in tags:
        return "C10"  # generic view/modifier surface
    return "C16"      # env/state/plumbing/other

def main():
    out_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    all_types, all_ext = [], []
    for module, path in FILES.items():
        if not os.path.exists(path):
            print(f"MISSING {module}: {path}", file=sys.stderr); continue
        ts, ex = parse_file(module, path)
        all_types += ts; all_ext += ex
        print(f"{module}: {len(ts)} types, {len(ex)} extensions")

    # classify
    views = []
    for t in all_types:
        t["tags"] = classify(t)
        t["cluster"] = assign_cluster(t, t["tags"])
        if "View" in t["tags"]:
            views.append(t["name"])

    # aggregate modifier surface from extensions of View
    modifier_counter = Counter()
    modifier_owner = {}
    for e in all_ext:
        if "View" in e.get("target","") or e.get("target","").endswith(".View"):
            for mname in e.get("view_modifiers", []):
                modifier_counter[mname] += 1
    # cluster tallies
    cluster_counts = Counter(t["cluster"] for t in all_types)

    inv = {
        "module_versions": "SwiftUI 7.4.27 / SwiftUICore / Charts — macOS 26.4 SDK, swift 6.3",
        "counts": {
            "types": len(all_types),
            "extensions": len(all_ext),
            "view_types": len(views),
            "unique_view_modifiers": len(modifier_counter),
        },
        "cluster_counts": dict(sorted(cluster_counts.items())),
        "view_types": sorted(views),
        "view_modifiers": [m for m,_ in modifier_counter.most_common()],
        "types": all_types,
        "extensions": all_ext,
    }
    with open(f"{out_dir}/INVENTORY.json", "w") as f:
        json.dump(inv, f, indent=1)
    print(f"\nWROTE {out_dir}/INVENTORY.json")
    print(f"types={len(all_types)} views={len(views)} modifiers={len(modifier_counter)} extensions={len(all_ext)}")
    print("cluster counts:", dict(sorted(cluster_counts.items())))

if __name__ == "__main__":
    main()
