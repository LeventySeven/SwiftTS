"use client";
import * as React from "react";
import { Picker, PickerOption, DatePicker } from "@sui";
import { GallerySection, Card, Cell, CellGrid } from "./chrome";

export function SectionSelection(): React.ReactElement {
  const [flavor, setFlavor] = React.useState("vanilla");
  const [view, setView] = React.useState("day");
  const [weekday, setWeekday] = React.useState("wed");
  const [tint, setTint] = React.useState("blue");
  const [date, setDate] = React.useState(() => new Date(2026, 5, 2, 9, 41));
  const [gdate, setGdate] = React.useState(() => new Date(2026, 5, 14, 14, 30));

  return (
    <GallerySection
      id="selection"
      title="Selection"
      subtitle="Picker (menu / segmented / wheel / inline) and DatePicker"
    >
      <Card title="Picker styles (.pickerStyle)">
        <CellGrid min={220}>
          <Cell label="menu">
            <Picker selection={flavor} onChange={setFlavor} label="Flavor" pickerStyle="menu">
              <PickerOption value="vanilla">Vanilla</PickerOption>
              <PickerOption value="chocolate">Chocolate</PickerOption>
              <PickerOption value="strawberry">Strawberry</PickerOption>
              <PickerOption value="pistachio">Pistachio</PickerOption>
            </Picker>
          </Cell>

          <Cell label="segmented">
            <Picker selection={view} onChange={setView} pickerStyle="segmented">
              <PickerOption value="day">Day</PickerOption>
              <PickerOption value="week">Week</PickerOption>
              <PickerOption value="month">Month</PickerOption>
              <PickerOption value="year">Year</PickerOption>
            </Picker>
          </Cell>

          <Cell label="palette (color tags)">
            <Picker selection={tint} onChange={setTint} pickerStyle="palette">
              <PickerOption value="blue" color="var(--sui-color-system-blue)">
                Blue
              </PickerOption>
              <PickerOption value="green" color="var(--sui-color-system-green)">
                Green
              </PickerOption>
              <PickerOption value="orange" color="var(--sui-color-system-orange)">
                Orange
              </PickerOption>
              <PickerOption value="pink" color="var(--sui-color-system-pink)">
                Pink
              </PickerOption>
            </Picker>
          </Cell>
        </CellGrid>
      </Card>

      <Card title="Inline & wheel pickers">
        <CellGrid min={220}>
          <Cell label="inline">
            <Picker selection={weekday} onChange={setWeekday} pickerStyle="inline">
              <PickerOption value="mon">Monday</PickerOption>
              <PickerOption value="tue">Tuesday</PickerOption>
              <PickerOption value="wed">Wednesday</PickerOption>
              <PickerOption value="thu">Thursday</PickerOption>
              <PickerOption value="fri">Friday</PickerOption>
            </Picker>
          </Cell>
          <Cell label="wheel">
            <Picker selection={flavor} onChange={setFlavor} pickerStyle="wheel">
              <PickerOption value="vanilla">Vanilla</PickerOption>
              <PickerOption value="chocolate">Chocolate</PickerOption>
              <PickerOption value="strawberry">Strawberry</PickerOption>
              <PickerOption value="pistachio">Pistachio</PickerOption>
              <PickerOption value="mango">Mango</PickerOption>
            </Picker>
          </Cell>
        </CellGrid>
      </Card>

      <Card title="DatePicker">
        <CellGrid min={260}>
          <Cell label="compact (date + time)">
            <DatePicker
              selection={date}
              onChange={setDate}
              datePickerStyle="compact"
              components={["date", "hourAndMinute"]}
            />
          </Cell>
          <Cell label="graphical">
            <div style={{ width: "100%", maxWidth: 320 }}>
              <DatePicker
                selection={gdate}
                onChange={setGdate}
                datePickerStyle="graphical"
                components={["date"]}
              />
            </div>
          </Cell>
        </CellGrid>
      </Card>
    </GallerySection>
  );
}
