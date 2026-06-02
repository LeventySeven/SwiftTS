/**
 * Shapes & drawing barrel — SwiftUI Cluster C9.
 * RE'd from `teardowns/SWIFTUI_C9_shapes-drawing.md`.
 *
 * The Shape protocol compiles to one universal `<Shape>` renderer (measured SVG
 * + a `pathIn(w,h)` callback); every concrete shape is a thin wrapper. Default
 * corners are `.continuous` (the figma-squircle, cornerSmoothing 0.6). Gradients
 * compile to CSS gradients with exact default points.
 */

// geometry + path
export * from "./geometry";
export * from "./style";
export * from "./Shape";
export * from "./Path";

// concrete shapes
export * from "./Rectangle";
export * from "./RoundedRectangle";
export * from "./UnevenRoundedRectangle";
export * from "./Circle";
export * from "./Ellipse";
export * from "./Capsule";
export * from "./AnyShape";

// container-relative shapes
export * from "./ContainerShapes";
export * from "./ButtonBorderShape";

// stroke / trim
export * from "./TrimmedShape";
export * from "./strokeBorder";

// transforms
export * from "./transforms";

// gradients
export * from "./gradient";
export * from "./Gradients";

// canvas / immediate-mode drawing
export * from "./GraphicsContext";
export * from "./Canvas";

// charts symbols (tabulated)
export * from "./chartSymbols";
