"use client";
import * as React from "react";
import {
  Toggle,
  Stepper,
  Slider,
  ProgressView,
  Gauge,
} from "@sui";
import { GallerySection, Card, Cell, CellGrid } from "./chrome";

export function SectionControls(): React.ReactElement {
  const [wifi, setWifi] = React.useState(true);
  const [bluetooth, setBluetooth] = React.useState(false);
  const [airplane, setAirplane] = React.useState(false);
  const [starred, setStarred] = React.useState(true);
  const [checked, setChecked] = React.useState(true);
  const [qty, setQty] = React.useState(3);
  const [volume, setVolume] = React.useState(0.6);
  const [brightness, setBrightness] = React.useState(0.4);
  const [progress, setProgress] = React.useState(0.35);

  return (
    <GallerySection
      id="controls"
      title="Toggles & Controls"
      subtitle="Toggle styles, Stepper, Slider, ProgressView, Gauge"
    >
      <Card title="Toggle (.toggleStyle)">
        <CellGrid min={200}>
          <Cell label="switch — on / off">
            <Toggle isOn={wifi} onChange={setWifi} label="Wi-Fi" toggleStyle="switch" />
            <Toggle isOn={airplane} onChange={setAirplane} label="Airplane Mode" toggleStyle="switch" />
          </Cell>
          <Cell label="button">
            <Toggle
              isOn={starred}
              onChange={setStarred}
              label="Favorite"
              systemImage="star.fill"
              toggleStyle="button"
            />
          </Cell>
          <Cell label="checkbox">
            <Toggle isOn={checked} onChange={setChecked} label="Subscribe" toggleStyle="checkbox" />
          </Cell>
          <Cell label="disabled / tinted">
            <Toggle isOn={true} onChange={() => {}} label="Locked" toggleStyle="switch" disabled />
            <Toggle isOn={bluetooth} onChange={setBluetooth} label="Bluetooth" tint="orange" />
          </Cell>
        </CellGrid>
      </Card>

      <Card title="Stepper">
        <Cell align="center">
          <Stepper
            label={`Quantity: ${qty}`}
            value={qty}
            onChange={setQty}
            bounds={[0, 10]}
          />
          <Stepper
            label="People"
            value={qty}
            onChange={setQty}
            bounds={[1, 8]}
            format={(v) => `${v} guest${v === 1 ? "" : "s"}`}
          />
        </Cell>
      </Card>

      <Card title="Slider">
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 420 }}>
          <Slider
            value={volume}
            onChange={setVolume}
            bounds={[0, 1]}
            minimumValueLabel={<span aria-hidden>🔈</span>}
            maximumValueLabel={<span aria-hidden>🔊</span>}
          />
          <Slider value={brightness} onChange={setBrightness} bounds={[0, 1]} step={0.1} />
          <span style={{ color: "var(--sui-color-secondary-label)", fontSize: 13 }}>
            volume {Math.round(volume * 100)}% · brightness {Math.round(brightness * 100)}%
          </span>
        </div>
      </Card>

      <Card title="ProgressView — linear & circular">
        <CellGrid min={180}>
          <Cell label="determinate linear">
            <div style={{ width: "100%" }}>
              <ProgressView value={progress} total={1} label="Downloading…" />
              <div style={{ marginTop: 12 }}>
                <Slider value={progress} onChange={setProgress} bounds={[0, 1]} />
              </div>
            </div>
          </Cell>
          <Cell label="indeterminate spinner">
            <ProgressView progressViewStyle="circular" label="Syncing" />
          </Cell>
          <Cell label="forced circular w/ value">
            <ProgressView value={0.75} progressViewStyle="circular" />
          </Cell>
        </CellGrid>
      </Card>

      <Card title="Gauge (.gaugeStyle)">
        <CellGrid min={150}>
          <Cell label="circular" align="center">
            <Gauge
              value={volume}
              min={0}
              max={1}
              gaugeStyle="accessoryCircular"
              currentValueLabel={<span>{Math.round(volume * 100)}</span>}
              label={<span>Volume</span>}
            />
          </Cell>
          <Cell label="linear capacity" align="center">
            <Gauge
              value={68}
              min={0}
              max={100}
              gaugeStyle="linearCapacity"
              minimumValueLabel={<span>0</span>}
              maximumValueLabel={<span>100</span>}
              currentValueLabel={<span>68%</span>}
            />
          </Cell>
          <Cell label="linear" align="center">
            <Gauge
              value={brightness}
              min={0}
              max={1}
              gaugeStyle="accessoryLinear"
              label={<span>Brightness</span>}
            />
          </Cell>
        </CellGrid>
      </Card>
    </GallerySection>
  );
}
