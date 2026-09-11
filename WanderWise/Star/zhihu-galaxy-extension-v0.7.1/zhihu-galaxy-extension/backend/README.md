# Zhihu Galaxy data bridge

`start_bridge.ps1` uses the official `zhihu-cli` Skill bundled here. On first run it installs the compatible CLI and, if needed, asks once for your Access Secret using a hidden PowerShell prompt. The secret is handled by the CLI credential mechanism; it is not written into this extension or any `.env` file.

The extension calls `http://127.0.0.1:8765/api/analyze`. Since v0.4 this call is asynchronous from the user experience: the browser first opens the galaxy from currently available answers, while the bridge continues collecting/refining in the background. Its result is merged into the live galaxy when ready.

The request includes the current loading settings (`sortMode`, `maxAnswers`). The bridge uses them when ordering answers and selecting the semantic-refinement sample.

Environment switches: `ZH_GALAXY_SEARCH_PASSES=1..3`, `ZH_GALAXY_USE_ZHIDA=0|1`, `ZHIHU_CLI=<binary path>`, `ZHIHU_ACCESS_SECRET=<process-only secret>`.
