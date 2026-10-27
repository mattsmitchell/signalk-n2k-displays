# signalk-n2k-displays

## About this fork

This experimental fork builds on [Scott Bender's signalk-n2k-displays](https://github.com/sbender9/signalk-n2k-displays) and [htool's instrument lighting PR #16](https://github.com/sbender9/signalk-n2k-displays/pull/16). Its goal is configurable display presets for mixed Raymarine and B&G networks, allowing a Signal K or Node-RED mode change to apply each display group's chosen palette and brightness.

Development is informed by testing with Raymarine P70/i70 and B&G Zeus/Nemesis displays. Preset functionality is a development goal and is not yet complete or validated. Changes will be tested before being proposed upstream.

## Experimental explicit presets

The plugin configuration has an **Explicit display presets** section. When enabled, configure separate Day and Night rows for each B&G/Navico or Raymarine group to control. Each row has a group and integer brightness percentage from 0 to 100; Raymarine rows also select Day 1, Day 2, Inverse, or Red/Black. B&G day/night follows the selected preset. A group omitted from a preset is not targeted by that preset. Disable unused groups in the corresponding brand settings.

For example, a night preset can contain B&G `default` at 66%, Raymarine `helm1` at 40% Red/Black, and Raymarine `cockpit` at 50% Inverse. From Node-RED or another authenticated Signal K client, PUT the string `night` or `day` to `electrical.displays.preset` using the Signal K v1 PUT API. Each PUT applies the entire configured preset once; repeating the PUT applies it again. Validation rejects invalid, duplicate, disabled, or empty groups before publishing any values.

Explicit preset mode disables this plugin's startup mapping, automatic source steering, group synchronization, device resync, and its legacy vendor PUT handlers. Glass intent and deprecated display-mode PUTs return 409 while preset mode is enabled. The existing webapp controls these legacy paths and therefore cannot control presets yet. Preset mode does not disable other plugins or CZone output: configure only one controller for the same display groups to avoid conflicting commands. Other values published at startup are Signal K intent and metadata, not vendor display commands from this plugin.

This branch publishes Signal K vendor paths; a separately configured `signalk-to-nmea2000` converter is needed to emit NMEA 2000. The companion converter and actual encoded frames have **not** been validated with these presets. In particular, B&G Day value and the Raymarine brightness Shared field need wire-level verification. Use offline testing first; the boat previously experienced unexplained brightness oscillation and reboots. A successful PUT confirms only that the plugin accepted and published the requested values, not that a display received or applied them.

Signal K plugin that controls and syncs NMEA 2000 display devices from Raymarine and Navico.

You can control brightness, night mode, and colors via Signal K.

The plugin can also sync between the device manufacturers. So if you change brightness directly on a Raymarine device, the plugin will change it for Navico devices.

Requires signalk-server 2.3.0 or newer.

## Control webapp

Phone-first lighting control. Bookmark `/signalk-n2k-displays/` when glass is unreadable. Live PUT goes to v1 paths (`electrical.displays.*`). On a phone that is not logged into Signal K, the page requests a **device key** (`POST /signalk/v1/access/requests`, description **Display lighting**, no hostname). Approve it under Signal K → Security → Access Requests; the JWT is kept in `localStorage` (`skDeviceToken`, shared with Control Panel on the same origin) and sent as `Authorization: Bearer`. Control is **Manual**, **Auto**, or **Learning**. Time / Sun / Lux mapping is in the webapp on a large screen and in plugin config (same source). Brand **Day** and **Night** tables map brightness to B&G and Raymarine; Night has color next to each brand (select for all). Chrome follows the phone light/dark setting.

![Display lighting webapp on a phone in dark mode, Auto and Night selected, brightness 40%, Navico 40% red palette and Raymarine 40% Red/Black](docs/webapp.png)

## Scope

**Job:** Own display lighting *policy*: light steering source → skipper brightness 0–1 and day/night → per-device native brightness and palette. Write those as Signal K paths. Provide a phone-first control webapp (Manual / Auto / Learning; wire `off` | `auto` | `auto-learning`).

**In:** Time / sun / lux steering (cascade lux → sun → time), glass paths `electrical.displays.{brightness,mode,control}`, maps, mapping table (large screen), group sync, power-on resync, PUT on v1 paths, one-major `environment.displayMode` mirror, embeddable webapp.

**Out:** NMEA 2000 encode (that is [signalk-to-nmea2000](https://github.com/SignalK/signalk-to-nmea2000) + canboatjs). Widescreen instrument layouts ([signalk-instrument-display-plugin](https://github.com/htool/signalk-instrument-display-plugin)). HEX PGN strings. simpleCan / second bus address. Garmin keypad until a lighting write protocol exists. Server `DisplayProvider`.

**Related:** [signalk-bandg-displaydaynight](https://github.com/htool/signalk-bandg-displaydaynight) is a stub that maps the old 1–10 blob onto `electrical.displays` brightness and mode and does not emit 130845.

## Deprecated `environment.displayMode`

For one major, this plugin mirrors `{ mode, backlight: round(brightness×10) }` and accepts the old PUT on `environment.displayMode.control`. Migrate to `electrical.displays.brightness` (0–1) and `.mode`. Details: [docs/displayMode-compat.md](docs/displayMode-compat.md).

Agents: start at [AGENTS.md](AGENTS.md) (`CLAUDE.md` is the same pointer). Features and ADRs are under [docs/](docs/). Process traps: [docs/dev-lessons.md](docs/dev-lessons.md). Showcase writeup: [docs/showcase.md](docs/showcase.md).
