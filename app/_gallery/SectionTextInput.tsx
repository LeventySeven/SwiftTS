"use client";
import * as React from "react";
import { TextField, SecureField, TextEditor, ColorPicker } from "@sui";
import { GallerySection, Card, Cell, CellGrid } from "./chrome";

export function SectionTextInput(): React.ReactElement {
  const [name, setName] = React.useState("Craig Federighi");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("hunter2");
  const [reveal, setReveal] = React.useState(false);
  const [bio, setBio] = React.useState(
    "Designed in California.\nThe quick brown fox jumps over the lazy dog.",
  );
  const [color, setColor] = React.useState("#007aff");

  return (
    <GallerySection
      id="textinput"
      title="Text Input"
      subtitle="TextField, SecureField, TextEditor, ColorPicker"
    >
      <Card title="TextField (.textFieldStyle)">
        <CellGrid min={240}>
          <Cell label="roundedBorder">
            <div style={{ width: "100%" }}>
              <TextField
                value={name}
                onChange={setName}
                prompt="Full name"
                fieldStyle="roundedBorder"
                clearButton
              />
            </div>
          </Cell>
          <Cell label="plain + email keyboard">
            <div style={{ width: "100%" }}>
              <TextField
                value={email}
                onChange={setEmail}
                prompt="you@example.com"
                fieldStyle="plain"
                keyboardType="emailAddress"
                autocapitalization="never"
                autocorrectionDisabled
              />
            </div>
          </Cell>
          <Cell label="invalid state">
            <div style={{ width: "100%" }}>
              <TextField
                value={email}
                onChange={setEmail}
                prompt="Required field"
                fieldStyle="roundedBorder"
                invalid={email.length === 0}
              />
            </div>
          </Cell>
        </CellGrid>
      </Card>

      <Card title="SecureField">
        <CellGrid min={240}>
          <Cell label="password">
            <div style={{ width: "100%" }}>
              <SecureField
                value={password}
                onChange={setPassword}
                prompt="Password"
                fieldStyle="roundedBorder"
              />
            </div>
          </Cell>
          <Cell label="reveal toggle">
            <div style={{ width: "100%", display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <SecureField
                  value={password}
                  onChange={setPassword}
                  prompt="Password"
                  fieldStyle="roundedBorder"
                  reveal={reveal}
                />
              </div>
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  color: "var(--sui-color-tint)",
                  fontSize: 13,
                }}
              >
                {reveal ? "Hide" : "Show"}
              </button>
            </div>
          </Cell>
        </CellGrid>
      </Card>

      <Card title="TextEditor">
        <div style={{ height: 120 }}>
          <TextEditor
            value={bio}
            onChange={setBio}
            editorStyle="roundedBorder"
            placeholder="Write something…"
          />
        </div>
      </Card>

      <Card title="ColorPicker">
        <Cell align="center">
          <ColorPicker color={color} onChange={setColor} label="Accent" />
          <span
            style={{
              fontFamily: "var(--sui-font-monospaced)",
              fontSize: 13,
              color: "var(--sui-color-secondary-label)",
            }}
          >
            {color}
          </span>
        </Cell>
      </Card>
    </GallerySection>
  );
}
