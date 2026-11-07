# 2026 Taipei Fall TownPass hackathon

This is a dated competition profile derived from the user-supplied `2026 城市通入門指引` workshop export dated 2026-10 and checked against the official event page and TownPass repo on 2026-10-26. Competition rules can change. Before making an eligibility, licensing, publication, AI, map, or submission claim, re-open the current organizer rule sheet or ask the organizer when the public source is incomplete.

## Project and delivery constraints

- Keep all competition source code reproducible and ready for public release. The workshop guide calls for the WebView, backend, and modified TownPass source when applicable.
- The workshop guide specifies AGPL-3.0 for competition deliverables and says the public repo remains available for at least one year. The TownPass host repo itself is GPL-3.0. Preserve upstream notices and verify the current organizer-provided license text before release; do not state license compatibility as legal advice.
- List every production dataset with publisher, dataset name, URL, update frequency, and applicable license or terms. Mark mock and generated data explicitly in the README and demo.
- List third-party packages, assets, models, map tiles, and their licenses. Prefer open-source and no-cost dependencies required by the current rules. Replace assets marked personal-use-only or no-redistribution.
- Keep the implementation maintainable by the organizer: exact setup commands, pinned runtime versions, configuration examples without secrets, architecture, test evidence, deployment steps, and known limitations.

## Maps and open data

For this event, the workshop guide directs teams to open map stacks such as Leaflet or MapLibre with OpenStreetMap or National Land Surveying and Mapping Center sources. Do not reuse Google Maps, Mapbox, or another prior-year provider without confirming the current rule and licensing or billing terms.

Prefer `data.taipei` for Taipei datasets, then relevant national sources such as `data.gov.tw` or TDX. Verify live schemas and do not let an AI-generated dataset name, endpoint, or field enter production without opening the publisher source.

## Product framing and judging

Choose one primary user and entry situation before expanding features: a person who knows the exact service, a person who has a need but does not know the available service, or a person browsing without a fixed goal. Make the demo follow that user through one complete flow.

Review the proposal from both public-service and resident perspectives. The workshop guide highlights security, innovation, felt usefulness, participation, convenience, and transparency. Turn these into evidence rather than slogans: identify the protected data, the concrete unmet need, the plain-language guidance, and who will maintain the service and refresh its data after handoff.

## Runtime AI

Cloud AI tools may assist planning, coding, debugging, and documentation during development when the current rules allow them. For product runtime, the workshop guide requires LLM inference and processing of user input or project data to stay on the device, without a cloud model API.

When the product includes runtime AI:

- make the user problem and non-AI fallback explicit; AI is optional to a strong service;
- place the model behind an authorized custom native handler rather than loading a multi-gigabyte model in the WebView;
- test the full feature in airplane mode on the demo device;
- record model name, exact version, quantization, inference framework, source, license, download size, memory requirement, supported devices, cold-load time, and fallback;
- verify Traditional Chinese quality with task-specific examples;
- do not make the core public service depend on hardware that excludes the documented support baseline without providing a simpler path;
- re-check the organizer’s current prohibited-tool and model list instead of embedding a brand list in code or documentation.

## Deployment and handoff

- Serve the WebView frontend over HTTPS. Firebase Hosting is the workshop example; GitHub Pages, Cloudflare Pages, Vercel, or another HTTPS host may be used only if the current project and event allow it.
- A backend is optional. When used, provide a reproducible container or equivalent handoff path, read its port from the deployment environment, configure CORS narrowly for the frontend origin, and keep secrets server-side.
- The workshop example uses Cloud Run and `asia-east1`. Treat provider, region, commands, cost, and unauthenticated-access settings as project choices requiring current verification. Do not copy an interactive deployment answer such as allowing public access without confirming the API’s authentication design.
- Do not use the retired `gcr.io` Container Registry flow. If Google Cloud is selected, use the current Artifact Registry and Cloud Run documentation.
- After deployment, update the host `destinationUrl` and re-test the entire flow inside TownPass, including every bridge method.

## Demo and submission

The workshop guide describes a live product demo rather than a slide deck, with an initial two-minute presentation and a longer final plus questions. When preparing competition delivery, verify the current timing, then show the user need, one complete TownPass flow, data sources, and the key implementation decision.

Before submission, verify that the repo contains all required source, the correct organizer-approved license and notice, setup instructions, data and dependency inventories, AI disclosure when applicable, and evidence that another machine can build the project from the README.
